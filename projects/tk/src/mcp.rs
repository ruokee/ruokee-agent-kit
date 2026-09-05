use std::io::{self, Write};
use std::os::fd::AsFd;
use std::path::PathBuf;
use std::process::{ExitCode, Stdio};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use rmcp::model::{
    CallToolRequestParams, CallToolResponse, CallToolResult, Implementation, ListToolsResult,
    PaginatedRequestParams, ServerCapabilities, ServerInfo, Tool,
};
use rmcp::service::{RequestContext, RxJsonRpcMessage, TxJsonRpcMessage};
use rmcp::transport::Transport;
use rmcp::{ErrorData as McpError, RoleServer, ServerHandler, ServiceExt};
use serde::Serialize;
use serde_json::{Value, json};
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt, BufReader};
use tokio::net::unix::pipe::{Receiver, Sender};
use tokio::process::Command;

use crate::app::{
    self, AppWarning, CreateRequest, CreateTaskInput, LifecycleAction, ReadView, SearchRequest,
    SubtaskInput, UpdateRequest,
};
use crate::contract::{
    self, CreateParams, ExecParams, LogParams, ReadParams, SchemaType, SearchParams, TaskPayload,
    ToolReadView, UpdateParams,
};
use crate::domain::Status;
use crate::error::{ErrorCategory, Result, TkError};
use crate::project;

const MAX_PROCESS_OUTPUT: usize = 1024 * 1024;
const MAX_MCP_FRAME_BYTES: usize = 1024 * 1024;

struct BoundedStdioTransport<R, W> {
    reader: BufReader<R>,
    line: Vec<u8>,
    writer: Arc<tokio::sync::Mutex<W>>,
    max_frame_bytes: usize,
}

impl<R, W> BoundedStdioTransport<R, W>
where
    R: AsyncRead + Unpin,
    W: AsyncWrite + Unpin,
{
    fn new(reader: R, writer: W, max_frame_bytes: usize) -> Self {
        Self {
            reader: BufReader::new(reader),
            line: Vec::new(),
            writer: Arc::new(tokio::sync::Mutex::new(writer)),
            max_frame_bytes,
        }
    }

    async fn receive_message(&mut self) -> Option<RxJsonRpcMessage<RoleServer>> {
        loop {
            let available = match self.reader.fill_buf().await {
                Ok([]) => return None,
                Ok(available) => available,
                Err(error) => {
                    eprintln!("MCP input failed: {error}");
                    return None;
                }
            };
            let newline = available.iter().position(|byte| *byte == b'\n');
            let payload_bytes = newline.unwrap_or(available.len());
            if self.line.len().saturating_add(payload_bytes) > self.max_frame_bytes {
                eprintln!(
                    "MCP input frame exceeded the {} byte limit",
                    self.max_frame_bytes
                );
                return None;
            }
            self.line.extend_from_slice(&available[..payload_bytes]);
            let consumed = payload_bytes + usize::from(newline.is_some());
            self.reader.consume(consumed);
            if newline.is_none() {
                continue;
            }
            if self.line.last() == Some(&b'\r') {
                self.line.pop();
            }
            if self.line.is_empty() {
                continue;
            }
            let parsed = serde_json::from_slice(&self.line);
            self.line.clear();
            match parsed {
                Ok(message) => return Some(message),
                Err(error) => {
                    eprintln!("Ignoring invalid MCP input frame: {error}");
                }
            }
        }
    }
}

impl<R, W> Transport<RoleServer> for BoundedStdioTransport<R, W>
where
    R: AsyncRead + Send + Unpin,
    W: AsyncWrite + Send + Unpin + 'static,
{
    type Error = io::Error;

    fn send(
        &mut self,
        item: TxJsonRpcMessage<RoleServer>,
    ) -> impl Future<Output = std::result::Result<(), Self::Error>> + Send + 'static {
        let writer = self.writer.clone();
        let max_frame_bytes = self.max_frame_bytes;
        async move {
            let frame = encode_bounded_json_line(&item, max_frame_bytes)?;
            let mut writer = writer.lock().await;
            writer.write_all(&frame).await?;
            writer.flush().await
        }
    }

    async fn receive(&mut self) -> Option<RxJsonRpcMessage<RoleServer>> {
        self.receive_message().await
    }

    async fn close(&mut self) -> std::result::Result<(), Self::Error> {
        self.writer.lock().await.shutdown().await
    }
}

struct BoundedJsonBuffer {
    bytes: Vec<u8>,
    limit: usize,
}

impl Write for BoundedJsonBuffer {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        if self.bytes.len().saturating_add(bytes.len()) > self.limit {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "MCP output frame exceeds the configured byte limit",
            ));
        }
        self.bytes.extend_from_slice(bytes);
        Ok(bytes.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

fn encode_bounded_json_line(value: &impl Serialize, limit: usize) -> io::Result<Vec<u8>> {
    let mut buffer = BoundedJsonBuffer {
        bytes: Vec::new(),
        limit,
    };
    serde_json::to_writer(&mut buffer, value)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    buffer.bytes.push(b'\n');
    Ok(buffer.bytes)
}

pub fn serve() -> ExitCode {
    let runtime = match tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
    {
        Ok(runtime) => runtime,
        Err(error) => {
            eprintln!("MCP runtime failed: {error}");
            return ExitCode::from(4);
        }
    };
    let server = TkServer;
    match runtime.block_on(async {
        let stdin = std::io::stdin()
            .as_fd()
            .try_clone_to_owned()
            .map_err(|error| format!("duplicate stdin failed: {error}"))?;
        let stdout = std::io::stdout()
            .as_fd()
            .try_clone_to_owned()
            .map_err(|error| format!("duplicate stdout failed: {error}"))?;
        let transport = BoundedStdioTransport::new(
            Receiver::from_owned_fd(stdin)
                .map_err(|error| format!("open stdin pipe failed: {error}"))?,
            Sender::from_owned_fd(stdout)
                .map_err(|error| format!("open stdout pipe failed: {error}"))?,
            MAX_MCP_FRAME_BYTES,
        );
        let service = server
            .serve(transport)
            .await
            .map_err(|error| error.to_string())?;
        let cancellation = service.cancellation_token();
        let watcher = tokio::spawn(async move {
            while !crate::cancel::requested() {
                tokio::time::sleep(std::time::Duration::from_millis(25)).await;
            }
            cancellation.cancel();
        });
        let result = service.waiting().await.map_err(|error| error.to_string());
        watcher.abort();
        result
    }) {
        Ok(_) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("MCP transport failed: {error}");
            ExitCode::from(4)
        }
    }
}

#[derive(Clone)]
struct TkServer;

impl ServerHandler for TkServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(ServerCapabilities::builder().enable_tools().build())
            .with_server_info(Implementation::new("tk", crate::version::RUNTIME_VERSION))
    }

    async fn list_tools(
        &self,
        _request: Option<PaginatedRequestParams>,
        _context: RequestContext<RoleServer>,
    ) -> std::result::Result<ListToolsResult, McpError> {
        Ok(ListToolsResult {
            tools: mcp_tools(),
            ..Default::default()
        })
    }

    fn get_tool(&self, name: &str) -> Option<Tool> {
        mcp_tools().into_iter().find(|tool| tool.name == name)
    }

    async fn call_tool(
        &self,
        request: CallToolRequestParams,
        context: RequestContext<RoleServer>,
    ) -> std::result::Result<CallToolResponse, McpError> {
        let arguments = Value::Object(request.arguments.unwrap_or_default());
        let outcome = if request.name == "exec" {
            match decode(arguments) {
                Ok(params) => dispatch_exec(params, context).await,
                Err(error) => Err(error),
            }
        } else {
            let name = request.name.to_string();
            let cancelled = Arc::new(AtomicBool::new(false));
            let worker_cancelled = Arc::clone(&cancelled);
            let mut worker = tokio::task::spawn_blocking(move || {
                crate::cancel::with_request(worker_cancelled, || {
                    crate::cancel::check()?;
                    let result = dispatch(&name, arguments)?;
                    crate::cancel::check()?;
                    Ok(result)
                })
            });
            tokio::select! {
                result = &mut worker => join_dispatch(result),
                () = context.ct.cancelled() => {
                    cancelled.store(true, Ordering::SeqCst);
                    join_dispatch(worker.await)
                }
            }
        };
        let result = match outcome {
            Ok(outcome) => CallToolResult::structured(outcome.envelope()),
            Err(error) => CallToolResult::structured_error(json!({"ok": false, "error": error})),
        };
        Ok(result.into())
    }
}

fn join_dispatch(
    result: std::result::Result<Result<ToolOutcome>, tokio::task::JoinError>,
) -> Result<ToolOutcome> {
    result.map_err(|error| {
        TkError::new(
            "tool_worker_failed",
            ErrorCategory::Internal,
            error.to_string(),
        )
    })?
}

fn mcp_tools() -> Vec<Tool> {
    contract::tool_contract(SchemaType::Mcp, None)
        .tools
        .into_iter()
        .map(|definition| {
            let Value::Object(schema) = definition.input_schema else {
                unreachable!("tool input schema is always an object")
            };
            Tool::new(definition.name, definition.description, schema)
        })
        .collect()
}

fn dispatch(name: &str, arguments: Value) -> Result<ToolOutcome> {
    match name {
        "search" => dispatch_search(decode(arguments)?),
        "read" => dispatch_read(decode(arguments)?),
        "create" => dispatch_create(decode(arguments)?),
        "update" => dispatch_update(decode(arguments)?),
        "log" => dispatch_log(decode(arguments)?),
        _ => Err(TkError::request(
            "unknown_tool",
            format!("Unknown tk tool: {name}"),
        )),
    }
}

fn dispatch_search(params: SearchParams) -> Result<ToolOutcome> {
    let cwd = request_cwd(params.cwd)?;
    let project = discover_for_value(&cwd, &params.query)?;
    let result = app::search(
        &project,
        SearchRequest {
            query: params.query,
            regex: params.regex,
            search_body: params.search_body,
            statuses: params.status,
            extra: params.extra,
            limit: params.limit,
        },
    )?;
    Ok(ToolOutcome::plain(
        serde_json::to_value(result).expect("serializing search result"),
    ))
}

fn dispatch_read(params: ReadParams) -> Result<ToolOutcome> {
    let cwd = request_cwd(params.cwd)?;
    let project = discover_for_value(&cwd, &params.task_ref)?;
    let view = match params.view {
        ToolReadView::Minimal => ReadView::Minimal,
        ToolReadView::Summary => ReadView::Summary,
        ToolReadView::Detailed => ReadView::Detailed,
    };
    let (default_entries, default_length) = view.default_wal_limits();
    let mut result = app::read(
        &project,
        &params.task_ref,
        view,
        params.wal_max_entries.unwrap_or(default_entries),
        params.wal_max_length.unwrap_or(default_length),
    )?;
    let warnings = std::mem::take(&mut result.warnings);
    Ok(ToolOutcome {
        data: serde_json::to_value(result).expect("serializing read result"),
        warnings,
    })
}

fn dispatch_create(params: CreateParams) -> Result<ToolOutcome> {
    let (cwd, project_ref, request) = match params {
        CreateParams::Task {
            name,
            status,
            created_at,
            depends_on,
            related_to,
            extra,
            user_confirmed,
            cwd,
        } => (
            cwd,
            None,
            CreateRequest::Task {
                input: CreateTaskInput {
                    name,
                    status: status.unwrap_or(Status::Open),
                    created_at,
                    depends_on,
                    related_to,
                    extra,
                },
                user_confirmed,
            },
        ),
        CreateParams::Subtasks {
            parent_ref,
            subtasks,
            user_confirmed,
            cwd,
        } => (
            cwd,
            Some(parent_ref.clone()),
            CreateRequest::Subtasks {
                parent_ref,
                subtasks: subtasks.into_iter().map(subtask_input).collect(),
                user_confirmed,
            },
        ),
    };
    let cwd = request_cwd(cwd)?;
    let project = match project_ref {
        Some(task_ref) => discover_for_value(&cwd, &task_ref)?,
        None => project::discover(&cwd)?,
    };
    let result = app::create(&project, request)?;
    Ok(ToolOutcome::plain(
        serde_json::to_value(result).expect("serializing create result"),
    ))
}

fn dispatch_update(params: UpdateParams) -> Result<ToolOutcome> {
    let lifecycle_count = usize::from(params.start)
        + usize::from(params.close.is_some())
        + usize::from(params.reopen.is_some());
    if lifecycle_count > 1 {
        return Err(TkError::request(
            "conflicting_lifecycle_actions",
            "Only one lifecycle action is allowed per update",
        ));
    }
    if params.force && params.close.is_none() {
        return Err(TkError::request(
            "invalid_force_option",
            "force is valid only with close",
        ));
    }
    let cwd = request_cwd(params.cwd.clone())?;
    let project = discover_for_value(&cwd, &params.task_ref)?;
    let lifecycle = if params.start {
        Some(LifecycleAction::Start)
    } else if let Some(reason) = params.close {
        Some(LifecycleAction::Close {
            reason,
            force: params.force,
            user_confirmed: params.user_confirmed,
        })
    } else {
        params.reopen.map(|reason| LifecycleAction::Reopen {
            reason,
            user_confirmed: params.user_confirmed,
        })
    };
    let actor = params.actor.as_deref().unwrap_or("mcp");
    let mut result = app::update(
        &project,
        &params.task_ref,
        UpdateRequest {
            add_depends_on: params.depends_on_add,
            remove_depends_on: params.depends_on_remove,
            add_related_to: params.related_to_add,
            remove_related_to: params.related_to_remove,
            set_extra: params.extra_set,
            unset_extra: params.extra_remove,
            lifecycle,
        },
        actor,
    )?;
    let warnings = std::mem::take(&mut result.warnings);
    Ok(ToolOutcome {
        data: serde_json::to_value(result).expect("serializing update result"),
        warnings,
    })
}

fn dispatch_log(params: LogParams) -> Result<ToolOutcome> {
    let cwd = request_cwd(params.cwd.clone())?;
    let project = discover_for_value(&cwd, &params.task_ref)?;
    let mut result = app::log(
        &project,
        &params.task_ref,
        &params.message,
        params.body.as_deref(),
        params.actor.as_deref().unwrap_or("mcp"),
    )?;
    let warnings = std::mem::take(&mut result.warnings);
    Ok(ToolOutcome {
        data: serde_json::to_value(result).expect("serializing log result"),
        warnings,
    })
}

async fn dispatch_exec(
    params: ExecParams,
    context: RequestContext<RoleServer>,
) -> Result<ToolOutcome> {
    let Some(first) = params.argv.first() else {
        return Err(TkError::request(
            "invalid_exec_command",
            "tk_exec requires a command",
        ));
    };
    if !matches!(first.as_str(), "--version" | "init" | "check" | "rename") {
        return Err(TkError::request(
            "unsupported_exec_command",
            format!("tk_exec does not support {first}"),
        ));
    }
    if params.actor.is_some() && first != "rename" {
        return Err(TkError::request(
            "invalid_exec_actor",
            "actor is accepted only for tk_exec rename",
        ));
    }
    let executable = std::env::current_exe().map_err(|error| {
        TkError::new(
            "runtime_path_unavailable",
            ErrorCategory::Context,
            error.to_string(),
        )
    })?;
    let mut command = Command::new(executable);
    command.args(&params.argv);
    if first == "rename"
        && let Some(actor) = params.actor.as_deref()
    {
        command.arg("--actor").arg(actor);
    }
    let mut child = command
        .current_dir(request_cwd(params.cwd)?)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|error| {
            TkError::new(
                "exec_start_failed",
                ErrorCategory::Environment,
                error.to_string(),
            )
        })?;
    let stdout = child.stdout.take().expect("piped stdout");
    let stderr = child.stderr.take().expect("piped stderr");
    let (capture_stop, mut capture_stopped) = tokio::sync::mpsc::unbounded_channel();
    let stdout_task = tokio::spawn(read_bounded(stdout, capture_stop.clone()));
    let stderr_task = tokio::spawn(read_bounded(stderr, capture_stop.clone()));
    drop(capture_stop);
    let mut capture_forced_stop = false;
    let status = tokio::select! {
        status = child.wait() => status.map_err(|error| {
            TkError::new("exec_wait_failed", ErrorCategory::Storage, error.to_string())
        })?,
        Some(()) = capture_stopped.recv() => {
            capture_forced_stop = true;
            let _ = child.kill().await;
            child.wait().await.map_err(|error| {
                TkError::new("exec_wait_failed", ErrorCategory::Storage, error.to_string())
            })?
        },
        () = context.ct.cancelled() => {
            let _ = child.kill().await;
            let _ = child.wait().await;
            stdout_task.abort();
            stderr_task.abort();
            return Err(TkError::new(
                "cancelled",
                ErrorCategory::Cancelled,
                "tk_exec was cancelled",
            ));
        }
    };
    let stdout = stdout_task
        .await
        .map_err(|error| {
            TkError::new(
                "exec_stdout_failed",
                ErrorCategory::Storage,
                error.to_string(),
            )
        })?
        .map_err(|error| {
            TkError::new(
                "exec_stdout_failed",
                ErrorCategory::Storage,
                error.to_string(),
            )
        })?;
    let stderr = stderr_task
        .await
        .map_err(|error| {
            TkError::new(
                "exec_stderr_failed",
                ErrorCategory::Storage,
                error.to_string(),
            )
        })?
        .map_err(|error| {
            TkError::new(
                "exec_stderr_failed",
                ErrorCategory::Storage,
                error.to_string(),
            )
        })?;
    if capture_forced_stop || stdout.len() > MAX_PROCESS_OUTPUT || stderr.len() > MAX_PROCESS_OUTPUT
    {
        return Err(TkError::new(
            "exec_output_too_large",
            ErrorCategory::Context,
            "tk_exec output exceeded the 1 MiB limit",
        ));
    }
    let stdout = String::from_utf8(stdout).map_err(|error| {
        TkError::new(
            "exec_stdout_not_utf8",
            ErrorCategory::Context,
            error.to_string(),
        )
    })?;
    let stderr = String::from_utf8(stderr).map_err(|error| {
        TkError::new(
            "exec_stderr_not_utf8",
            ErrorCategory::Context,
            error.to_string(),
        )
    })?;
    if !status.success() {
        return Err(TkError::new(
            "exec_command_failed",
            ErrorCategory::Context,
            format!("tk exited with {status}"),
        )
        .with_details(json!({
            "exit_code": status.code(),
            "stdout": stdout,
            "stderr": stderr,
        })));
    }
    Ok(ToolOutcome::plain(json!({
        "exit_code": status.code(),
        "stdout": stdout,
        "stderr": stderr,
    })))
}

async fn read_bounded(
    stream: impl AsyncRead + Unpin,
    stop: tokio::sync::mpsc::UnboundedSender<()>,
) -> std::io::Result<Vec<u8>> {
    let mut bytes = Vec::new();
    let result = stream
        .take((MAX_PROCESS_OUTPUT + 1) as u64)
        .read_to_end(&mut bytes)
        .await;
    if result.is_err() || bytes.len() > MAX_PROCESS_OUTPUT {
        let _ = stop.send(());
    }
    result.map(|_| bytes)
}

fn subtask_input(task: TaskPayload) -> SubtaskInput {
    SubtaskInput {
        name: task.name,
        status: task.status.unwrap_or(Status::Open),
        created_at: task.created_at,
        depends_on: task.depends_on,
        related_to: task.related_to,
        extra: task.extra,
    }
}

fn request_cwd(cwd: Option<PathBuf>) -> Result<PathBuf> {
    match cwd {
        Some(cwd) => Ok(cwd),
        None => std::env::current_dir().map_err(|error| {
            TkError::new(
                "read_current_directory_failed",
                ErrorCategory::Context,
                error.to_string(),
            )
        }),
    }
}

fn discover_for_value(cwd: &std::path::Path, value: &str) -> Result<project::Project> {
    let path = std::path::Path::new(value);
    if path.is_absolute() && path.exists() {
        project::discover_from_exact_path(path)
    } else {
        project::discover(cwd)
    }
}

fn decode<T: serde::de::DeserializeOwned>(value: Value) -> Result<T> {
    serde_json::from_value(value)
        .map_err(|error| TkError::request("invalid_tool_arguments", error.to_string()))
}

struct ToolOutcome {
    data: Value,
    warnings: Vec<AppWarning>,
}

impl ToolOutcome {
    fn plain(data: Value) -> Self {
        Self {
            data,
            warnings: vec![],
        }
    }

    fn envelope(self) -> Value {
        let mut value = json!({"ok": true, "data": self.data});
        if !self.warnings.is_empty() {
            value["warnings"] = serde_json::to_value(self.warnings).expect("serializing warnings");
        }
        value
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tools_list_has_exact_protocol_names() {
        let tools = mcp_tools();
        let names: Vec<_> = tools.iter().map(|tool| tool.name.as_ref()).collect();
        assert_eq!(names, ["search", "read", "create", "update", "log", "exec"]);
    }

    #[test]
    fn create_schema_has_object_root_and_keeps_discriminated_union() {
        let contract =
            contract::tool_contract(SchemaType::Native, Some(crate::contract::NativeHarness::Pi));
        let create = contract
            .tools
            .iter()
            .find(|tool| tool.name == "tk_create")
            .unwrap();
        assert_eq!(create.input_schema["type"], "object");
        assert_eq!(create.input_schema["oneOf"].as_array().unwrap().len(), 2);
        assert!(create.input_schema["oneOf"][0]["additionalProperties"] == false);
        assert_eq!(
            create.input_schema["oneOf"][1]["properties"]["user_confirmed"]["default"],
            false
        );
    }

    #[test]
    fn bounded_transport_accepts_a_frame_at_the_limit() {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
            .block_on(async {
                let limit = 128;
                let base = br#"{"jsonrpc":"2.0","id":1,"method":"ping"}"#;
                let mut frame = base.to_vec();
                frame.resize(limit, b' ');
                frame.push(b'\n');
                let (mut peer, server) = tokio::io::duplex(limit + 16);
                let (reader, writer) = tokio::io::split(server);
                let mut transport = BoundedStdioTransport::new(reader, writer, limit);
                peer.write_all(&frame).await.unwrap();
                assert!(transport.receive().await.is_some());
            });
    }

    #[test]
    fn bounded_transport_closes_on_oversized_input() {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
            .block_on(async {
                for newline in [true, false] {
                    let limit = 128;
                    let mut frame = vec![b' '; limit + 1];
                    if newline {
                        frame.push(b'\n');
                    }
                    let (mut peer, server) = tokio::io::duplex(limit + 16);
                    let (reader, writer) = tokio::io::split(server);
                    let mut transport = BoundedStdioTransport::new(reader, writer, limit);
                    peer.write_all(&frame).await.unwrap();
                    assert!(transport.receive().await.is_none());
                }
            });
    }

    #[test]
    fn bounded_transport_rejects_oversized_output() {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
            .block_on(async {
                let (_peer, server) = tokio::io::duplex(256);
                let (reader, writer) = tokio::io::split(server);
                let mut transport = BoundedStdioTransport::new(reader, writer, 128);
                let message = TxJsonRpcMessage::<RoleServer>::error(
                    McpError::internal_error("x".repeat(256), None),
                    None,
                );
                let error = transport.send(message).await.unwrap_err();
                assert_eq!(error.kind(), io::ErrorKind::InvalidData);
            });
    }

    #[test]
    fn bounded_exec_capture_signals_as_soon_as_output_exceeds_the_limit() {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
            .block_on(async {
                let (mut writer, reader) = tokio::io::duplex(4096);
                let (stop, mut stopped) = tokio::sync::mpsc::unbounded_channel();
                let capture = tokio::spawn(read_bounded(reader, stop));
                let producer = tokio::spawn(async move {
                    writer
                        .write_all(&vec![b'x'; MAX_PROCESS_OUTPUT + 1])
                        .await
                        .unwrap();
                });
                stopped.recv().await.unwrap();
                assert_eq!(
                    capture.await.unwrap().unwrap().len(),
                    MAX_PROCESS_OUTPUT + 1
                );
                producer.await.unwrap();
            });
    }

    #[test]
    fn handled_create_failure_does_not_block_the_next_request() {
        let root =
            std::env::temp_dir().join(format!("tk-mcp-operation-test-{}", uuid::Uuid::now_v7()));
        std::fs::create_dir(&root).unwrap();
        let project = crate::project::init(&root, crate::project::InitOptions::default())
            .unwrap()
            .project;
        let blocked_year = project.task_root.join("2026");
        std::fs::write(&blocked_year, "not a directory").unwrap();
        let request = json!({
            "type": "task",
            "name": "persistent-request",
            "status": "open",
            "created_at": "2026-08-31T12:00:00+08:00",
            "user_confirmed": true,
            "cwd": root,
        });
        let first = match dispatch("create", request.clone()) {
            Ok(_) => panic!("first create unexpectedly succeeded"),
            Err(error) => error,
        };
        assert_ne!(first.code, "operation_in_progress");
        assert!(
            crate::gc::operation_directories(&project.task_root.join(".tk-tmp"))
                .unwrap()
                .is_empty()
        );

        std::fs::remove_file(blocked_year).unwrap();
        let second = dispatch("create", request).unwrap();
        assert_eq!(second.data["committed"], true);
        std::fs::remove_dir_all(root).unwrap();
    }
}
