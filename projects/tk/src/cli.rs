use std::path::PathBuf;
use std::process::ExitCode;

use clap::{Args, CommandFactory, Parser, Subcommand, ValueEnum};
use serde::Serialize;
use serde_json::{Value, json};

use crate::app::{
    self, CreateRequest, CreateTaskInput, LifecycleAction, ReadView, SearchRequest, SubtaskInput,
    UpdateRequest,
};
use crate::contract::parse_json_object;
use crate::domain::Status;
use crate::error::{ErrorCategory, Result, TkError};
use crate::gc;
use crate::project::{self, CreationPolicy, GitPolicy, InitOptions, MetadataMode};
use crate::version::{CLI_CONTRACT_VERSION, COMPONENT_FORMAT_VERSION, TASK_SCHEMA_VERSION};

#[derive(Debug, Clone, Copy, ValueEnum)]
enum Output {
    Text,
    Json,
}

#[derive(Debug, Parser)]
#[command(name = "tk", about = "Persistent local Task runtime")]
struct Cli {
    /// Print runtime and contract versions.
    #[arg(long)]
    version: bool,

    /// Select human-readable or structured output.
    #[arg(long, value_enum, default_value_t = Output::Text, global = true)]
    output: Output,

    /// Resolve the project from this directory.
    #[arg(long, global = true)]
    cwd: Option<PathBuf>,

    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Debug, Subcommand)]
enum Commands {
    /// Find Task candidates.
    Search(SearchArgs),
    /// Read one exact Task.
    Read(ReadArgs),
    /// Create a top-level Task or one batch of subtasks.
    Create {
        #[command(subcommand)]
        command: CreateCommands,
    },
    /// Update relations, extra metadata, or lifecycle.
    Update(UpdateArgs),
    /// Append one durable Task event.
    Log(LogArgs),
    /// Classify and conservatively remove tk temporary operations.
    Gc(GcArgs),
    /// Initialize project-local Task storage.
    Init(InitArgs),
}

#[derive(Debug, Args)]
struct SearchArgs {
    query: String,
    #[arg(long)]
    regex: bool,
    #[arg(long)]
    search_body: bool,
    #[arg(long, value_enum)]
    status: Vec<CliStatus>,
    #[arg(long)]
    extra: Option<String>,
    #[arg(long, default_value_t = 20)]
    limit: usize,
}

#[derive(Debug, Args)]
struct ReadArgs {
    task_ref: String,
    #[arg(long, value_enum, default_value_t = CliReadView::Summary)]
    view: CliReadView,
    #[arg(long, default_value_t = 20)]
    wal_max_entries: usize,
    #[arg(long, default_value_t = 16384)]
    wal_max_length: usize,
}

#[derive(Debug, Subcommand)]
enum CreateCommands {
    /// Create one top-level Task.
    Task(CreateTaskArgs),
    /// Create one atomic domain batch under a parent Task.
    Subtask(CreateSubtaskArgs),
}

#[derive(Debug, Args)]
struct CreateTaskArgs {
    name: String,
    #[arg(long)]
    body: Option<String>,
    #[arg(long, value_enum, default_value_t = CliCreationStatus::Open)]
    status: CliCreationStatus,
    #[arg(long)]
    created_at: Option<String>,
    #[arg(long)]
    depends_on: Vec<String>,
    #[arg(long)]
    related_to: Vec<String>,
    #[arg(long)]
    extra: Option<String>,
    #[arg(long)]
    user_confirmed: Option<bool>,
}

#[derive(Debug, Args)]
struct CreateSubtaskArgs {
    parent_ref: String,
    #[arg(long = "item", required = true, num_args = 1..=50)]
    items: Vec<String>,
    #[arg(long)]
    user_confirmed: Option<bool>,
}

#[derive(Debug, Args)]
struct UpdateArgs {
    task_ref: String,
    #[arg(long = "depends-on-add")]
    depends_on_add: Vec<String>,
    #[arg(long = "depends-on-remove")]
    depends_on_remove: Vec<String>,
    #[arg(long = "related-to-add")]
    related_to_add: Vec<String>,
    #[arg(long = "related-to-remove")]
    related_to_remove: Vec<String>,
    #[arg(long = "extra-set")]
    extra_set: Option<String>,
    #[arg(long = "extra-remove")]
    extra_remove: Vec<String>,
    #[arg(long)]
    start: bool,
    #[arg(long)]
    close: Option<String>,
    #[arg(long)]
    reopen: Option<String>,
    #[arg(long)]
    force: bool,
    #[arg(long)]
    user_confirmed: Option<bool>,
    #[arg(long)]
    actor: Option<String>,
}

#[derive(Debug, Args)]
struct LogArgs {
    task_ref: String,
    #[arg(long)]
    message: String,
    #[arg(long)]
    body: Option<String>,
    #[arg(long)]
    actor: Option<String>,
}

#[derive(Debug, Args)]
struct GcArgs {
    #[arg(long)]
    dry_run: bool,
}

#[derive(Debug, Args)]
struct InitArgs {
    #[arg(long)]
    task_root: Option<String>,
    #[arg(long)]
    subtasks_dir: Option<String>,
    #[arg(long, value_enum)]
    git_policy: Option<CliGitPolicy>,
    #[arg(long, value_enum)]
    creation_policy: Option<CliCreationPolicy>,
    #[arg(long, value_enum)]
    metadata_mode: Option<CliMetadataMode>,
    #[arg(long)]
    force: bool,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum CliStatus {
    Planning,
    Open,
    Closed,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum CliCreationStatus {
    Planning,
    Open,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum CliReadView {
    Metadata,
    Summary,
    Detailed,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum CliGitPolicy {
    Track,
    Ignore,
    None,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum CliCreationPolicy {
    Strict,
    Permissive,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum CliMetadataMode {
    Split,
    Embed,
}

struct CommandOutput {
    data: Value,
    text: String,
    warnings: Vec<Warning>,
}

#[derive(Serialize)]
struct Warning {
    code: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    details: Option<Value>,
}

pub fn run() -> ExitCode {
    let cli = Cli::parse();
    if cli.version && cli.command.is_some() {
        let error = TkError::request(
            "invalid_request",
            "--version cannot be combined with a command",
        );
        print_error(cli.output, &error);
        return ExitCode::from(2);
    }
    if let Some(option) = invalid_explicit_option(&cli) {
        let error = TkError::request(
            "invalid_request",
            format!("{option} is not accepted by this command"),
        );
        print_error(Output::Text, &error);
        return ExitCode::from(2);
    }
    if cli.version {
        print_version(cli.output);
        return ExitCode::SUCCESS;
    }

    let Some(command) = cli.command else {
        Cli::command().print_help().expect("writing help to stdout");
        println!();
        return ExitCode::SUCCESS;
    };

    let cwd = match cli.cwd {
        Some(path) => path,
        None => match std::env::current_dir() {
            Ok(path) => path,
            Err(error) => {
                let error = TkError::new(
                    "read_current_directory_failed",
                    ErrorCategory::Context,
                    error.to_string(),
                );
                print_error(cli.output, &error);
                return ExitCode::from(2);
            }
        },
    };

    match crate::cancel::check()
        .and_then(|()| execute(command, cwd))
        .and_then(|result| {
            crate::cancel::check()?;
            Ok(result)
        }) {
        Ok(result) => {
            print_success(cli.output, result);
            ExitCode::SUCCESS
        }
        Err(error) => {
            let code = match error.category {
                ErrorCategory::Cancelled => 130,
                ErrorCategory::Request => 2,
                ErrorCategory::Environment => 5,
                ErrorCategory::Storage | ErrorCategory::Internal => 4,
                _ => 3,
            };
            print_error(cli.output, &error);
            ExitCode::from(code)
        }
    }
}

fn invalid_explicit_option(cli: &Cli) -> Option<&'static str> {
    let present = |name: &str| {
        std::env::args_os().skip(1).any(|argument| {
            let argument = argument.to_string_lossy();
            argument == name || argument.starts_with(&format!("{name}="))
        })
    };
    let cwd = present("--cwd");
    let output = present("--output");

    if cli.version {
        return cwd.then_some("--cwd");
    }
    match cli.command.as_ref() {
        None => cwd.then_some("--cwd").or(output.then_some("--output")),
        Some(_) => None,
    }
}

fn discover_for_search(cwd: &std::path::Path, query: &str) -> Result<project::Project> {
    discover_for_existing_absolute_path(cwd, query)
}

fn discover_for_task_ref(cwd: &std::path::Path, task_ref: &str) -> Result<project::Project> {
    discover_for_existing_absolute_path(cwd, task_ref)
}

fn discover_for_existing_absolute_path(
    cwd: &std::path::Path,
    value: &str,
) -> Result<project::Project> {
    let path = std::path::Path::new(value);
    if path.is_absolute() && path.exists() {
        project::discover_from_exact_path(path)
    } else {
        project::discover(cwd)
    }
}

fn execute(command: Commands, cwd: PathBuf) -> Result<CommandOutput> {
    match command {
        Commands::Search(args) => {
            let project = discover_for_search(&cwd, &args.query)?;
            let extra = args
                .extra
                .as_deref()
                .map(parse_json_object)
                .transpose()?
                .unwrap_or_default();
            let mut result = app::search(
                &project,
                SearchRequest {
                    query: args.query,
                    regex: args.regex,
                    search_body: args.search_body,
                    statuses: args.status.into_iter().map(Into::into).collect(),
                    extra,
                    limit: args.limit,
                },
            )?;
            let warnings = convert_warnings(std::mem::take(&mut result.warnings));
            let text = result
                .items
                .iter()
                .map(|item| {
                    format!(
                        "{}\t{}\t{}\t{}",
                        item.id,
                        item.status,
                        item.name,
                        item.task_dir.display()
                    )
                })
                .collect::<Vec<_>>()
                .join("\n");
            Ok(CommandOutput {
                data: serde_json::to_value(result).expect("serializing search result"),
                text,
                warnings,
            })
        }
        Commands::Read(args) => {
            let project = discover_for_task_ref(&cwd, &args.task_ref)?;
            let mut result = app::read(
                &project,
                &args.task_ref,
                args.view.into(),
                args.wal_max_entries,
                args.wal_max_length,
            )?;
            let warnings = convert_warnings(std::mem::take(&mut result.warnings));
            let text = serde_json::to_string_pretty(&result).expect("serializing read result");
            Ok(CommandOutput {
                data: serde_json::to_value(result).expect("serializing read result"),
                text,
                warnings,
            })
        }
        Commands::Create { command } => {
            let project = match &command {
                CreateCommands::Task(_) => project::discover(&cwd)?,
                CreateCommands::Subtask(args) => discover_for_task_ref(&cwd, &args.parent_ref)?,
            };
            let request = match command {
                CreateCommands::Task(args) => CreateRequest::Task {
                    input: CreateTaskInput {
                        name: args.name,
                        body: args.body,
                        status: args.status.into(),
                        created_at: args.created_at,
                        depends_on: args.depends_on,
                        related_to: args.related_to,
                        extra: args
                            .extra
                            .as_deref()
                            .map(parse_json_object)
                            .transpose()?
                            .unwrap_or_default(),
                    },
                    user_confirmed: args.user_confirmed.unwrap_or(true),
                },
                CreateCommands::Subtask(args) => CreateRequest::Subtasks {
                    parent_ref: args.parent_ref,
                    subtasks: args
                        .items
                        .iter()
                        .map(|item| {
                            serde_json::from_str::<SubtaskInput>(item).map_err(|error| {
                                TkError::request(
                                    "invalid_subtask_item",
                                    format!("Invalid --item JSON: {error}"),
                                )
                            })
                        })
                        .collect::<Result<Vec<_>>>()?,
                    user_confirmed: args.user_confirmed.unwrap_or(true),
                },
            };
            let result = app::create(&project, request)?;
            let text = result
                .created
                .iter()
                .map(|task| format!("Created {} at {}", task.name, task.task_dir.display()))
                .collect::<Vec<_>>()
                .join("\n");
            Ok(CommandOutput {
                data: serde_json::to_value(result).expect("serializing create result"),
                text,
                warnings: vec![],
            })
        }
        Commands::Update(args) => {
            let project = discover_for_task_ref(&cwd, &args.task_ref)?;
            let lifecycle_count = usize::from(args.start)
                + usize::from(args.close.is_some())
                + usize::from(args.reopen.is_some());
            if lifecycle_count > 1 {
                return Err(TkError::request(
                    "conflicting_lifecycle_actions",
                    "Only one lifecycle action is allowed per update",
                ));
            }
            if args.force && args.close.is_none() {
                return Err(TkError::request(
                    "invalid_force_option",
                    "--force is valid only with --close",
                ));
            }
            let confirmed = args.user_confirmed.unwrap_or(true);
            let lifecycle = if args.start {
                Some(LifecycleAction::Start)
            } else if let Some(reason) = args.close {
                Some(LifecycleAction::Close {
                    reason,
                    force: args.force,
                    user_confirmed: confirmed,
                })
            } else {
                args.reopen.map(|reason| LifecycleAction::Reopen {
                    reason,
                    user_confirmed: confirmed,
                })
            };
            let mut result = app::update(
                &project,
                &args.task_ref,
                UpdateRequest {
                    add_depends_on: args.depends_on_add,
                    remove_depends_on: args.depends_on_remove,
                    add_related_to: args.related_to_add,
                    remove_related_to: args.related_to_remove,
                    set_extra: args
                        .extra_set
                        .as_deref()
                        .map(parse_json_object)
                        .transpose()?
                        .unwrap_or_default(),
                    unset_extra: args.extra_remove,
                    lifecycle,
                },
                args.actor.as_deref().unwrap_or("cli"),
            )?;
            let warnings = convert_warnings(std::mem::take(&mut result.warnings));
            let text = if result.changed {
                format!("Updated {}", result.task.task_dir.display())
            } else {
                "No changes".into()
            };
            Ok(CommandOutput {
                data: serde_json::to_value(result).expect("serializing update result"),
                text,
                warnings,
            })
        }
        Commands::Log(args) => {
            let project = discover_for_task_ref(&cwd, &args.task_ref)?;
            let mut result = app::log(
                &project,
                &args.task_ref,
                &args.message,
                args.body.as_deref(),
                args.actor.as_deref().unwrap_or("cli"),
            )?;
            let warnings = convert_warnings(std::mem::take(&mut result.warnings));
            let text = format!("Logged event for {}", result.task.task_dir.display());
            Ok(CommandOutput {
                data: serde_json::to_value(result).expect("serializing log result"),
                text,
                warnings,
            })
        }
        Commands::Gc(args) => {
            let result = gc::run(Some(&cwd), args.dry_run)?;
            Ok(CommandOutput {
                text: serde_json::to_string_pretty(&result).expect("serializing gc result"),
                data: serde_json::to_value(result).expect("serializing gc result"),
                warnings: vec![],
            })
        }
        Commands::Init(args) => {
            let result = project::init(
                &cwd,
                InitOptions {
                    task_root: args.task_root,
                    subtasks_dir: args.subtasks_dir,
                    git_policy: args.git_policy.map(Into::into),
                    creation_policy: args.creation_policy.map(Into::into),
                    metadata_mode: args.metadata_mode.map(Into::into),
                    force: args.force,
                },
            )?;
            let warnings = Vec::new();
            Ok(CommandOutput {
                data: json!({
                    "changed": true,
                    "project_root": result.project.root,
                    "task_root": result.project.task_root,
                    "metadata_mode": result.project.config.metadata_mode,
                }),
                text: format!(
                    "Initialized tk project at {}",
                    result.project.root.display()
                ),
                warnings,
            })
        }
    }
}

fn convert_warnings(warnings: Vec<app::AppWarning>) -> Vec<Warning> {
    warnings
        .into_iter()
        .map(|warning| Warning {
            code: warning.code,
            message: warning.message,
            details: warning.details,
        })
        .collect()
}

fn print_success(output: Output, result: CommandOutput) {
    match output {
        Output::Text => {
            println!("{}", result.text);
            for warning in result.warnings {
                eprintln!("warning[{}]: {}", warning.code, warning.message);
            }
        }
        Output::Json => {
            let mut envelope = serde_json::Map::from_iter([
                ("ok".into(), Value::Bool(true)),
                ("data".into(), result.data),
            ]);
            if !result.warnings.is_empty() {
                envelope.insert(
                    "warnings".into(),
                    serde_json::to_value(result.warnings).expect("serializing warnings"),
                );
            }
            println!("{}", Value::Object(envelope));
        }
    }
}

fn print_error(output: Output, error: &TkError) {
    match output {
        Output::Text => eprintln!("error[{}]: {}", error.code, error.message),
        Output::Json => println!(
            "{}",
            json!({
                "ok": false,
                "error": error,
            })
        ),
    }
}

fn print_version(output: Output) {
    match output {
        Output::Text => println!("tk {}", env!("CARGO_PKG_VERSION")),
        Output::Json => println!(
            "{}",
            json!({
                "runtime_version": env!("CARGO_PKG_VERSION"),
                "cli_contract_version": CLI_CONTRACT_VERSION,
                "task_schema_version": TASK_SCHEMA_VERSION,
                "component_format_version": COMPONENT_FORMAT_VERSION,
            })
        ),
    }
}

impl From<CliGitPolicy> for GitPolicy {
    fn from(value: CliGitPolicy) -> Self {
        match value {
            CliGitPolicy::Track => Self::Track,
            CliGitPolicy::Ignore => Self::Ignore,
            CliGitPolicy::None => Self::None,
        }
    }
}

impl From<CliCreationPolicy> for CreationPolicy {
    fn from(value: CliCreationPolicy) -> Self {
        match value {
            CliCreationPolicy::Strict => Self::Strict,
            CliCreationPolicy::Permissive => Self::Permissive,
        }
    }
}

impl From<CliMetadataMode> for MetadataMode {
    fn from(value: CliMetadataMode) -> Self {
        match value {
            CliMetadataMode::Split => Self::Split,
            CliMetadataMode::Embed => Self::Embed,
        }
    }
}

impl From<CliStatus> for Status {
    fn from(value: CliStatus) -> Self {
        match value {
            CliStatus::Planning => Self::Planning,
            CliStatus::Open => Self::Open,
            CliStatus::Closed => Self::Closed,
        }
    }
}

impl From<CliCreationStatus> for Status {
    fn from(value: CliCreationStatus) -> Self {
        match value {
            CliCreationStatus::Planning => Self::Planning,
            CliCreationStatus::Open => Self::Open,
        }
    }
}

impl From<CliReadView> for ReadView {
    fn from(value: CliReadView) -> Self {
        match value {
            CliReadView::Metadata => Self::Metadata,
            CliReadView::Summary => Self::Summary,
            CliReadView::Detailed => Self::Detailed,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_version_with_json_output() {
        let cli = Cli::try_parse_from(["tk", "--version", "--output", "json"]).unwrap();
        assert!(cli.version);
        assert!(matches!(cli.output, Output::Json));
    }

    #[test]
    fn actor_belongs_to_wal_writing_commands() {
        let cli = Cli::try_parse_from([
            "tk",
            "log",
            "task-ref",
            "--message",
            "done",
            "--actor",
            "test-agent",
        ])
        .unwrap();
        let Some(Commands::Log(args)) = cli.command else {
            panic!("expected log command");
        };
        assert_eq!(args.actor.as_deref(), Some("test-agent"));
        assert!(Cli::try_parse_from(["tk", "search", "task", "--actor", "agent"]).is_err());
    }

    #[test]
    fn parses_init_configuration() {
        let cli = Cli::try_parse_from([
            "tk",
            "init",
            "--metadata-mode",
            "embed",
            "--git-policy",
            "track",
        ])
        .unwrap();
        let Some(Commands::Init(args)) = cli.command else {
            panic!("expected init command");
        };
        assert!(matches!(args.metadata_mode, Some(CliMetadataMode::Embed)));
        assert!(matches!(args.git_policy, Some(CliGitPolicy::Track)));
    }

    #[test]
    fn requires_explicit_create_level() {
        assert!(Cli::try_parse_from(["tk", "create", "name"]).is_err());
        assert!(Cli::try_parse_from(["tk", "create", "task", "name"]).is_ok());
    }

    #[test]
    fn rejects_subtasks_alias() {
        assert!(Cli::try_parse_from(["tk", "create", "subtasks"]).is_err());
    }

    #[test]
    fn parses_subtask_confirmation_state() {
        let cli = Cli::try_parse_from([
            "tk",
            "create",
            "subtask",
            "parent",
            "--item",
            r#"{"name":"child","status":"planning"}"#,
            "--user-confirmed",
            "false",
        ])
        .unwrap();
        let Some(Commands::Create {
            command: CreateCommands::Subtask(args),
        }) = cli.command
        else {
            panic!("expected create subtask command");
        };
        assert_eq!(args.user_confirmed, Some(false));
    }
}
