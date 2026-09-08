use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use chrono::{DateTime, FixedOffset, Local};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::{NoContext, Timestamp, Uuid};

use crate::domain::{Metadata, Status, normalize_name, validate_extra};
use crate::error::{ErrorCategory, Result, TkError};
use crate::path::storage_error;
use crate::project::{CreationPolicy, Project};
use crate::task_store::{self, StoredTask};
use crate::version::TASK_SCHEMA_VERSION;
use crate::wal::{self, WalRead};

const MAX_TASK_SEQUENCE: u64 = 99;

#[derive(Debug)]
pub struct CreateTaskInput {
    pub name: String,
    pub status: Status,
    pub created_at: Option<String>,
    pub depends_on: Vec<String>,
    pub related_to: Vec<String>,
    pub extra: BTreeMap<String, Value>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SubtaskInput {
    pub name: String,
    #[serde(default = "default_open_status")]
    pub status: Status,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub depends_on: Vec<String>,
    #[serde(default)]
    pub related_to: Vec<String>,
    #[serde(default)]
    pub extra: BTreeMap<String, Value>,
}

#[derive(Debug)]
pub enum CreateRequest {
    Task {
        input: CreateTaskInput,
        user_confirmed: bool,
    },
    Subtasks {
        parent_ref: String,
        subtasks: Vec<SubtaskInput>,
        user_confirmed: bool,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReadView {
    Minimal,
    Summary,
    Detailed,
}

impl ReadView {
    pub const fn default_wal_limits(self) -> (usize, usize) {
        match self {
            Self::Minimal => (0, 0),
            Self::Summary => (5, 4_000),
            Self::Detailed => (50, 16_000),
        }
    }
}

#[derive(Debug)]
pub struct SearchRequest {
    pub query: String,
    pub regex: bool,
    pub search_body: bool,
    pub statuses: Vec<Status>,
    pub extra: BTreeMap<String, Value>,
    pub limit: usize,
}

#[derive(Debug, Default)]
pub struct UpdateRequest {
    pub add_depends_on: Vec<String>,
    pub remove_depends_on: Vec<String>,
    pub add_related_to: Vec<String>,
    pub remove_related_to: Vec<String>,
    pub set_extra: BTreeMap<String, Value>,
    pub unset_extra: Vec<String>,
    pub lifecycle: Option<LifecycleAction>,
}

#[derive(Debug)]
pub enum LifecycleAction {
    Start,
    Close {
        reason: String,
        force: bool,
        user_confirmed: bool,
    },
    Reopen {
        reason: String,
        user_confirmed: bool,
    },
}

#[derive(Debug, Clone, Serialize)]
pub struct TaskReference {
    pub id: Uuid,
    pub name: String,
    pub status: Status,
    pub task_dir: PathBuf,
}

#[derive(Debug, Serialize)]
pub struct CreateResult {
    pub changed: bool,
    pub committed: bool,
    pub partial: bool,
    pub created: Vec<TaskReference>,
}

#[derive(Debug, Serialize)]
pub struct ReadTask {
    #[serde(flatten)]
    pub metadata: Metadata,
    pub task_dir: PathBuf,
}

#[derive(Debug, Serialize)]
pub struct ReadResult {
    pub task: ReadTask,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wal: Option<WalRead>,
    #[serde(skip)]
    pub warnings: Vec<AppWarning>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppWarning {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct MutationResult {
    pub changed: bool,
    pub committed: bool,
    pub partial: bool,
    pub task: TaskReference,
    #[serde(skip)]
    pub warnings: Vec<AppWarning>,
}

#[derive(Debug, Serialize)]
pub struct SearchItem {
    pub id: Uuid,
    pub name: String,
    pub status: Status,
    pub created_at: DateTime<FixedOffset>,
    pub task_dir: PathBuf,
    #[serde(rename = "match")]
    pub match_reason: String,
    pub closed_ancestors: Vec<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub items: Vec<SearchItem>,
    pub truncated: bool,
    #[serde(skip)]
    pub warnings: Vec<AppWarning>,
}

pub fn create(project: &Project, request: CreateRequest) -> Result<CreateResult> {
    match request {
        CreateRequest::Task {
            input,
            user_confirmed,
        } => create_top_level(project, input, user_confirmed),
        CreateRequest::Subtasks {
            parent_ref,
            subtasks,
            user_confirmed,
        } => create_subtasks(project, &parent_ref, subtasks, user_confirmed),
    }
}

pub fn read(
    project: &Project,
    task_ref: &str,
    view: ReadView,
    wal_max_entries: usize,
    wal_max_length: usize,
) -> Result<ReadResult> {
    if wal_max_entries > 50 {
        return Err(TkError::request(
            "invalid_wal_max_entries",
            "wal_max_entries must be between 0 and 50",
        ));
    }
    if wal_max_length > 16_000 {
        return Err(TkError::request(
            "invalid_wal_max_length",
            "wal_max_length must be between 0 and 16000",
        ));
    }
    let task = resolve_ref(project, task_ref)?;
    let body = match view {
        ReadView::Minimal => None,
        ReadView::Summary | ReadView::Detailed => Some(task_store::read_body(
            &task.directory,
            project.config.metadata_mode,
        )?),
    };
    let (wal, warnings) = match view {
        ReadView::Minimal => (None, vec![]),
        ReadView::Summary | ReadView::Detailed => {
            let entry_view = match view {
                ReadView::Summary => wal::WalEntryView::Summary,
                ReadView::Detailed => wal::WalEntryView::Detailed,
                ReadView::Minimal => unreachable!(),
            };
            let mut result =
                wal::read(&task.directory, wal_max_entries, wal_max_length, entry_view)?;
            let warnings = result
                .warnings
                .drain(..)
                .map(|warning| AppWarning {
                    code: warning.code,
                    message: warning.message,
                    details: Some(serde_json::json!({"path": warning.path})),
                })
                .collect();
            (Some(result), warnings)
        }
    };
    Ok(ReadResult {
        task: ReadTask {
            task_dir: task.directory,
            metadata: task.metadata,
        },
        body,
        wal,
        warnings,
    })
}

pub fn search(project: &Project, request: SearchRequest) -> Result<SearchResult> {
    if request.query.is_empty() {
        return Err(TkError::request(
            "search_query_required",
            "search query cannot be empty",
        ));
    }
    if request.limit == 0 || request.limit > 100 {
        return Err(TkError::request(
            "invalid_search_limit",
            "search limit must be between 1 and 100",
        ));
    }
    validate_extra(&Value::Object(request.extra.clone().into_iter().collect()))?;
    let graph = task_store::discover_tasks(&project.task_root, project.config.metadata_mode)?;
    let query = classify_search_query(project, &request, &graph)?;
    let retained = request.limit;
    let mut matches = Vec::with_capacity(retained);
    let mut truncated = false;
    for (task_index, discovered) in graph.tasks.iter().enumerate() {
        let task = &discovered.task;
        if !request.statuses.is_empty() && !request.statuses.contains(&task.metadata.status) {
            continue;
        }
        if !request.extra.iter().all(|(key, expected)| {
            task.metadata
                .extra
                .get(key)
                .is_some_and(|actual| actual == expected)
        }) {
            continue;
        }
        let Some(match_reason) = query.matches(project, task, request.search_body)? else {
            continue;
        };
        matches.push(SearchItem {
            id: task.metadata.id,
            name: task.metadata.name.clone(),
            status: task.metadata.status,
            created_at: task.metadata.created_at,
            task_dir: task.directory.clone(),
            match_reason: match_reason.into(),
            closed_ancestors: closed_ancestors(&graph, task_index),
        });
        matches.sort_by(compare_search_items);
        if matches.len() > retained {
            truncated = true;
            matches.truncate(retained);
        }
    }

    Ok(SearchResult {
        items: matches,
        truncated,
        warnings: Vec::new(),
    })
}

fn compare_search_items(left: &SearchItem, right: &SearchItem) -> std::cmp::Ordering {
    search_match_rank(&left.match_reason)
        .cmp(&search_match_rank(&right.match_reason))
        .then_with(|| right.created_at.cmp(&left.created_at))
        .then_with(|| left.id.cmp(&right.id))
}

fn search_match_rank(match_reason: &str) -> u8 {
    match match_reason {
        "uuid" => 0,
        "path" => 1,
        "regex" => 2,
        "string" => 3,
        _ => u8::MAX,
    }
}

enum SearchQuery {
    UuidPrefix(String),
    Path(Option<PathBuf>),
    Regex(Regex),
    String(String),
}

impl SearchQuery {
    fn matches(
        &self,
        project: &Project,
        task: &StoredTask,
        search_body: bool,
    ) -> Result<Option<&'static str>> {
        match self {
            Self::UuidPrefix(prefix) => Ok(task
                .metadata
                .id
                .simple()
                .to_string()
                .starts_with(prefix)
                .then_some("uuid")),
            Self::Path(directory) => Ok(directory
                .as_ref()
                .is_some_and(|directory| directory == &task.directory)
                .then_some("path")),
            Self::Regex(regex) => {
                if regex.is_match(&task.metadata.name) {
                    return Ok(Some("regex"));
                }
                if search_body
                    && regex.is_match(&task_store::read_body(
                        &task.directory,
                        project.config.metadata_mode,
                    )?)
                {
                    return Ok(Some("regex"));
                }
                Ok(None)
            }
            Self::String(query) => {
                if task.metadata.name.contains(query) {
                    return Ok(Some("string"));
                }
                if search_body
                    && task_store::read_body(&task.directory, project.config.metadata_mode)?
                        .contains(query)
                {
                    return Ok(Some("string"));
                }
                Ok(None)
            }
        }
    }
}

fn classify_search_query(
    project: &Project,
    request: &SearchRequest,
    graph: &task_store::TaskGraph,
) -> Result<SearchQuery> {
    if let Ok(id) = Uuid::parse_str(&request.query) {
        return Ok(SearchQuery::UuidPrefix(id.simple().to_string()));
    }
    if let Some(path) = classify_existing_search_path(project, &request.query, graph)? {
        return Ok(SearchQuery::Path(path));
    }
    if request.regex {
        return Regex::new(&request.query)
            .map(SearchQuery::Regex)
            .map_err(|error| TkError::request("invalid_search_regex", error.to_string()));
    }
    let normalized_uuid: String = request
        .query
        .chars()
        .filter(|character| *character != '-')
        .collect();
    if (8..=32).contains(&normalized_uuid.len())
        && normalized_uuid
            .chars()
            .all(|character| character.is_ascii_hexdigit())
        && request
            .query
            .chars()
            .all(|character| character == '-' || character.is_ascii_hexdigit())
    {
        return Ok(SearchQuery::UuidPrefix(
            normalized_uuid.to_ascii_lowercase(),
        ));
    }
    Ok(SearchQuery::String(request.query.clone()))
}

fn classify_existing_search_path(
    project: &Project,
    query: &str,
    graph: &task_store::TaskGraph,
) -> Result<Option<Option<PathBuf>>> {
    let input = Path::new(query);
    let path = if input.is_absolute() {
        input.to_path_buf()
    } else {
        project.root.join(input)
    };
    if !path.exists() {
        return Ok(None);
    }
    if crate::project::ensure_safe_project_path(&project.root, &path).is_err() {
        return Ok(Some(None));
    }
    let canonical = path
        .canonicalize()
        .map_err(|error| storage_error("resolve_search_path", &path, error))?;
    if !canonical.starts_with(&project.task_root) {
        return Ok(Some(None));
    }
    Ok(Some(
        graph
            .owning_task_index(&canonical)
            .map(|index| graph.tasks[index].task.directory.clone()),
    ))
}

fn closed_ancestors(graph: &task_store::TaskGraph, task_index: usize) -> Vec<Uuid> {
    let mut closed = Vec::new();
    let mut ancestor = graph.tasks[task_index].parent;
    while let Some(index) = ancestor {
        let task = &graph.tasks[index];
        if task.task.metadata.status == Status::Closed {
            closed.push(task.task.metadata.id);
        }
        ancestor = task.parent;
    }
    closed
}

pub fn update(
    project: &Project,
    task_ref: &str,
    request: UpdateRequest,
    actor: &str,
) -> Result<MutationResult> {
    let task = resolve_ref(project, task_ref)?;
    if task.metadata.status == Status::Closed
        && !matches!(request.lifecycle, Some(LifecycleAction::Reopen { .. }))
    {
        return Err(TkError::invariant(
            "closed_task_read_only",
            "A closed Task only accepts an explicit reopen",
        ));
    }
    validate_update_input(&request)?;

    let add_depends_on =
        resolve_relation_additions(project, &request.add_depends_on, task.metadata.id)?;
    let remove_depends_on = resolve_relation_removals(project, &request.remove_depends_on)?;
    let add_related_to =
        resolve_relation_additions(project, &request.add_related_to, task.metadata.id)?;
    let remove_related_to = resolve_relation_removals(project, &request.remove_related_to)?;
    if intersects(&add_depends_on, &remove_depends_on)
        || intersects(&add_related_to, &remove_related_to)
    {
        return Err(TkError::request(
            "conflicting_relation_update",
            "The same relation cannot be added and removed in one update",
        ));
    }

    let original = task.metadata.clone();
    let mut changed = original.clone();
    apply_relation_delta(&mut changed.depends_on, &add_depends_on, &remove_depends_on);
    apply_relation_delta(&mut changed.related_to, &add_related_to, &remove_related_to);
    for (key, value) in request.set_extra {
        changed.extra.insert(key, value);
    }
    for key in request.unset_extra {
        changed.extra.remove(&key);
    }

    let wal_message = match request.lifecycle {
        None => None,
        Some(LifecycleAction::Start) => {
            changed = changed.transition(Status::Open)?;
            Some("Started Task.".to_owned())
        }
        Some(LifecycleAction::Close {
            reason,
            force,
            user_confirmed,
        }) => {
            require_lifecycle_authorization("close", &reason, user_confirmed)?;
            if !force {
                ensure_closeable(project, &task)?;
            }
            changed = changed.transition(Status::Closed)?;
            Some(format!("Closed Task: {reason}"))
        }
        Some(LifecycleAction::Reopen {
            reason,
            user_confirmed,
        }) => {
            require_lifecycle_authorization("reopen", &reason, user_confirmed)?;
            ensure_reopenable(project, &task)?;
            changed = changed.transition(Status::Open)?;
            Some(format!("Reopened Task: {reason}"))
        }
    };

    changed.validate()?;
    validate_relation_graph(project, &changed)?;
    if changed == original {
        return Ok(MutationResult {
            changed: false,
            committed: false,
            partial: false,
            task: task_reference(&task),
            warnings: vec![],
        });
    }

    crate::project::ensure_mutable(project)?;
    task_store::replace_metadata(&task.directory, &changed, project.config.metadata_mode)?;
    let mut warnings = Vec::new();
    if let Some(message) = wal_message
        && let Err(error) = wal::append(&task.directory, &message, None, actor)
    {
        warnings.push(AppWarning {
            code: "wal_append_failed".into(),
            message: error.message,
            details: error.details,
        });
    }
    Ok(MutationResult {
        changed: true,
        committed: true,
        partial: false,
        task: TaskReference {
            id: changed.id,
            name: changed.name,
            status: changed.status,
            task_dir: task.directory,
        },
        warnings,
    })
}

pub fn log(
    project: &Project,
    task_ref: &str,
    message: &str,
    body: Option<&str>,
    actor: &str,
) -> Result<MutationResult> {
    let task = resolve_ref(project, task_ref)?;
    if task.metadata.status == Status::Closed {
        return Err(TkError::invariant(
            "closed_task_read_only",
            "Cannot append a log entry to a closed Task",
        ));
    }
    crate::project::ensure_mutable(project)?;
    wal::append(&task.directory, message, body, actor)?;
    Ok(MutationResult {
        changed: true,
        committed: true,
        partial: false,
        task: task_reference(&task),
        warnings: vec![],
    })
}

pub fn resolve_ref(project: &Project, task_ref: &str) -> Result<StoredTask> {
    let graph = task_store::discover_tasks(&project.task_root, project.config.metadata_mode)?;
    resolve_ref_in_graph(project, task_ref, graph)
}

pub(crate) fn resolve_ref_in_graph(
    project: &Project,
    task_ref: &str,
    mut graph: task_store::TaskGraph,
) -> Result<StoredTask> {
    if let Ok(id) = Uuid::parse_str(task_ref) {
        let matches: Vec<_> = graph
            .tasks
            .into_iter()
            .filter(|task| task.task.metadata.id == id)
            .map(|task| task.task)
            .collect();
        return match matches.len() {
            0 => Err(resolution_error(
                "task_not_found",
                format!("No Task has ID {id}"),
            )),
            1 => Ok(matches.into_iter().next().unwrap()),
            _ => Err(resolution_error(
                "duplicate_task_id",
                format!("More than one Task has ID {id}"),
            )),
        };
    }

    let input = Path::new(task_ref);
    let path = if input.is_absolute() {
        input.to_path_buf()
    } else {
        project.root.join(input)
    };
    crate::project::ensure_safe_project_path(&project.root, &path).map_err(|_| {
        resolution_error(
            "invalid_task_ref",
            format!(
                "Task reference contains a symlink or leaves the project: {}",
                path.display()
            ),
        )
    })?;
    let canonical = path.canonicalize().map_err(|_| {
        resolution_error(
            "task_not_found",
            format!("Task reference does not exist: {}", path.display()),
        )
    })?;
    let directory = if canonical.is_file()
        && matches!(
            canonical.file_name().and_then(|value| value.to_str()),
            Some("tk.toml" | "TASK.md")
        ) {
        canonical.parent().unwrap().to_path_buf()
    } else if canonical.is_dir() {
        canonical
    } else {
        return Err(resolution_error(
            "invalid_task_ref",
            "Exact Task references cannot point to ordinary material",
        ));
    };
    if !directory.starts_with(&project.task_root) {
        return Err(resolution_error(
            "task_outside_root",
            format!("Task is outside {}", project.task_root.display()),
        ));
    }
    if let Some(index) = graph.task_index(&directory) {
        return Ok(graph.tasks.swap_remove(index).task);
    }
    if let Some(index) = graph
        .invalid_candidates
        .iter()
        .position(|candidate| candidate.directory == directory)
    {
        return Err(graph.invalid_candidates.swap_remove(index).error);
    }
    Err(resolution_error(
        "task_not_found",
        format!("No discovered Task exists at {}", directory.display()),
    ))
}

fn create_top_level(
    project: &Project,
    input: CreateTaskInput,
    user_confirmed: bool,
) -> Result<CreateResult> {
    let prepared = prepare_task(project, input.into(), None)?;
    require_creation_authorization(
        project.config.creation_policy,
        prepared.metadata.status,
        true,
        user_confirmed,
    )?;
    for _ in 0..100 {
        let final_path = top_level_path(
            project,
            prepared.metadata.created_at,
            &prepared.metadata.name,
        )?;
        if final_path.exists() {
            continue;
        }
        crate::project::ensure_mutable(project)?;
        let operation = crate::gc::begin_project_operation(&project.task_root)?;
        match operation.execute(
            |operation| commit_prepared(project, &prepared, &final_path, operation),
            |reference, cleanup_path, error| {
                TkError::partial_commit(
                    "Task creation committed but cleanup failed",
                    serde_json::json!(std::slice::from_ref(reference)),
                    serde_json::json!([cleanup_path]),
                    error,
                )
            },
        ) {
            Ok(reference) => {
                return Ok(CreateResult {
                    changed: true,
                    committed: true,
                    partial: false,
                    created: vec![reference],
                });
            }
            Err(error) if error.code == "task_path_conflict" => {}
            Err(error) => return Err(error),
        }
    }
    Err(TkError::new(
        "task_path_conflict",
        ErrorCategory::Conflict,
        "Could not allocate a unique top-level Task path",
    ))
}

fn create_subtasks(
    project: &Project,
    parent_ref: &str,
    subtasks: Vec<SubtaskInput>,
    user_confirmed: bool,
) -> Result<CreateResult> {
    if subtasks.is_empty() || subtasks.len() > 50 {
        return Err(TkError::request(
            "invalid_subtask_count",
            "subtask creation requires between 1 and 50 items",
        ));
    }
    let parent = resolve_ref(project, parent_ref)?;
    if parent.metadata.status == Status::Closed {
        return Err(TkError::invariant(
            "closed_parent",
            "Cannot create a subtask under a closed Task",
        ));
    }

    let mut prepared = Vec::with_capacity(subtasks.len());
    for input in subtasks {
        let task = prepare_task(project, input.into(), Some(parent.metadata.id))?;
        require_creation_authorization(
            project.config.creation_policy,
            task.metadata.status,
            false,
            user_confirmed,
        )?;
        prepared.push(task);
    }

    let base = parent.directory.join(&project.config.subtasks_dir);
    let graph = task_store::discover_tasks(&project.task_root, project.config.metadata_mode)?;
    let parent_index = graph.task_index(&parent.directory).ok_or_else(|| {
        TkError::new(
            "task_discovery_changed",
            ErrorCategory::Conflict,
            "Parent Task disappeared during subtask preparation",
        )
    })?;
    let existing = direct_subtasks(&graph, parent_index);
    let mut used = vec![false; existing.len()];
    let mut satisfied = Vec::new();
    let mut pending = Vec::new();
    for task in prepared {
        let mut matched = None;
        for (index, candidate) in existing.iter().enumerate() {
            if !used[index] && prepared_matches(&task, candidate) {
                matched = Some(index);
                break;
            }
        }
        if let Some(index) = matched {
            used[index] = true;
            satisfied.push(task_reference(&existing[index]));
        } else {
            pending.push(task);
        }
    }
    if pending.is_empty() {
        return Ok(CreateResult {
            changed: false,
            committed: false,
            partial: false,
            created: Vec::new(),
        });
    }

    let first_sequence = next_subtask_sequence(&graph, parent_index, &base)?;
    if first_sequence + pending.len() as u64 - 1 > MAX_TASK_SEQUENCE {
        return Err(TkError::new(
            "task_sequence_exhausted",
            ErrorCategory::Conflict,
            format!(
                "No two-digit Task sequence remains under {}",
                base.display()
            ),
        ));
    }
    let mut paths = Vec::with_capacity(pending.len());
    for (index, task) in pending.iter().enumerate() {
        let sequence = first_sequence + index as u64;
        let path = base.join(format!("{sequence:02}--{}", task.metadata.name));
        if path.exists() {
            return Err(TkError::new(
                "task_path_conflict",
                ErrorCategory::Conflict,
                format!("Task path already exists: {}", path.display()),
            ));
        }
        paths.push(path);
    }

    crate::project::ensure_mutable(project)?;
    let operation = crate::gc::begin_project_operation(&project.task_root)?;
    let (_completed, created) = operation.execute(
        |operation| {
            let mut completed = satisfied;
            let mut created = Vec::new();
            for (index, (task, path)) in pending.iter().zip(&paths).enumerate() {
                if let Err(error) = crate::cancel::checkpoint() {
                    if completed.is_empty() {
                        return Err(error);
                    }
                    return Err(TkError::partial_commit(
                        "Subtask creation was cancelled after satisfying some Tasks",
                        serde_json::json!(completed),
                        serde_json::json!(&paths[index..]),
                        error,
                    ));
                }
                match commit_prepared(project, task, path, operation) {
                    Ok(reference) => {
                        completed.push(reference.clone());
                        created.push(reference);
                    }
                    Err(error) if completed.is_empty() => return Err(error),
                    Err(error) => {
                        return Err(TkError::partial_commit(
                            "Subtask creation stopped after satisfying some Tasks",
                            serde_json::json!(completed),
                            serde_json::json!(&paths[index..]),
                            error,
                        ));
                    }
                }
            }
            Ok((completed, created))
        },
        |(completed, _), cleanup_path, error| {
            TkError::partial_commit(
                "Subtask creation committed but cleanup failed",
                serde_json::json!(completed),
                serde_json::json!([cleanup_path]),
                error,
            )
        },
    )?;
    Ok(CreateResult {
        changed: true,
        committed: true,
        partial: false,
        created,
    })
}

struct PreparedTask {
    metadata: Metadata,
    body: Vec<u8>,
    match_created_at: bool,
}

struct CommonTaskInput {
    name: String,
    status: Status,
    created_at: Option<String>,
    depends_on: Vec<String>,
    related_to: Vec<String>,
    extra: BTreeMap<String, Value>,
}

fn prepare_task(
    project: &Project,
    input: CommonTaskInput,
    _parent_id: Option<Uuid>,
) -> Result<PreparedTask> {
    if input.status == Status::Closed {
        return Err(TkError::request(
            "invalid_initial_status",
            "Task creation accepts only planning or open status",
        ));
    }
    let match_created_at = input.created_at.is_some();
    let name = normalize_name(&input.name)?;
    let created_at = parse_created_at(input.created_at.as_deref())?;
    let id = uuid_for_time(created_at)?;
    let depends_on = resolve_relations(project, &input.depends_on, id)?;
    let related_to = resolve_relations(project, &input.related_to, id)?;
    validate_extra(&Value::Object(input.extra.clone().into_iter().collect()))?;
    let metadata = Metadata {
        schema_version: TASK_SCHEMA_VERSION,
        id,
        name: name.clone(),
        status: input.status,
        created_at,
        depends_on,
        related_to,
        extra: input.extra,
    };
    metadata.validate()?;
    let body = format!("# {name}\n").into_bytes();
    Ok(PreparedTask {
        metadata,
        body,
        match_created_at,
    })
}

fn direct_subtasks(graph: &task_store::TaskGraph, parent: usize) -> Vec<&StoredTask> {
    graph
        .tasks
        .iter()
        .filter(|candidate| candidate.parent == Some(parent))
        .map(|candidate| &candidate.task)
        .collect()
}

fn prepared_matches(prepared: &PreparedTask, existing: &StoredTask) -> bool {
    let metadata = &existing.metadata;
    metadata.name == prepared.metadata.name
        && metadata.status == prepared.metadata.status
        && metadata.depends_on == prepared.metadata.depends_on
        && metadata.related_to == prepared.metadata.related_to
        && metadata.extra == prepared.metadata.extra
        && (!prepared.match_created_at || metadata.created_at == prepared.metadata.created_at)
}

fn resolve_relations(project: &Project, refs: &[String], self_id: Uuid) -> Result<Vec<Uuid>> {
    let mut ids = Vec::with_capacity(refs.len());
    for task_ref in refs {
        let id = resolve_ref(project, task_ref)?.metadata.id;
        if id == self_id {
            return Err(TkError::invariant(
                "self_relation",
                "A Task cannot relate to itself",
            ));
        }
        ids.push(id);
    }
    ids.sort_unstable();
    ids.dedup();
    Ok(ids)
}

fn commit_prepared(
    project: &Project,
    prepared: &PreparedTask,
    final_path: &Path,
    operation: &mut crate::gc::CleanupOperation,
) -> Result<TaskReference> {
    crate::project::ensure_safe_project_path(&project.root, final_path)?;
    let parent = final_path.parent().unwrap();
    crate::cancel::begin_write()?;
    fs::create_dir_all(parent)
        .map_err(|error| storage_error("create_task_parent", parent, error))?;
    if final_path.exists() {
        return Err(TkError::new(
            "task_path_conflict",
            ErrorCategory::Conflict,
            format!("Task path already exists: {}", final_path.display()),
        ));
    }
    let staging = operation.temporary_path(&format!("task-{}", prepared.metadata.id.simple()))?;
    fs::create_dir(&staging)
        .map_err(|error| storage_error("create_task_staging", &staging, error))?;
    task_store::create_task_files(
        &staging,
        &prepared.metadata,
        &prepared.body,
        project.config.metadata_mode,
    )?;
    if final_path.exists() {
        fs::remove_dir_all(&staging)
            .map_err(|error| storage_error("remove_task_staging", &staging, error))?;
        return Err(TkError::new(
            "task_path_conflict",
            ErrorCategory::Conflict,
            format!(
                "Task path appeared during creation: {}",
                final_path.display()
            ),
        ));
    }
    fs::rename(&staging, final_path)
        .map_err(|error| storage_error("commit_task_directory", final_path, error))?;
    Ok(TaskReference {
        id: prepared.metadata.id,
        name: prepared.metadata.name.clone(),
        status: prepared.metadata.status,
        task_dir: final_path.to_path_buf(),
    })
}

fn top_level_path(
    project: &Project,
    created_at: DateTime<FixedOffset>,
    name: &str,
) -> Result<PathBuf> {
    let year = created_at.format("%Y").to_string();
    let month = created_at.format("%m").to_string();
    let day = created_at.format("%d").to_string();
    let base = project.task_root.join(year).join(month);
    let graph = task_store::discover_tasks(&project.task_root, project.config.metadata_mode)?;
    let mut maximum = 0;
    for task in graph.tasks.iter().filter(|task| task.parent.is_none()) {
        if task.task.directory.parent() != Some(base.as_path()) {
            continue;
        }
        let Some(value) = task
            .task
            .directory
            .file_name()
            .and_then(|value| value.to_str())
        else {
            continue;
        };
        if let Some(sequence) = value
            .strip_prefix(&format!("{day}-"))
            .and_then(parse_sequence)
        {
            maximum = maximum.max(sequence);
        }
    }
    let sequence = next_sequence(maximum, &base)?;
    Ok(base.join(format!("{day}-{sequence:02}--{name}")))
}

fn next_subtask_sequence(graph: &task_store::TaskGraph, parent: usize, base: &Path) -> Result<u64> {
    let maximum = graph
        .tasks
        .iter()
        .filter(|task| task.parent == Some(parent))
        .filter_map(|task| {
            task.task
                .directory
                .file_name()
                .and_then(|value| value.to_str())
                .and_then(parse_sequence)
        })
        .max()
        .unwrap_or(0);
    next_sequence(maximum, base)
}

fn next_sequence(maximum: u64, base: &Path) -> Result<u64> {
    if maximum >= MAX_TASK_SEQUENCE {
        return Err(TkError::new(
            "task_sequence_exhausted",
            ErrorCategory::Conflict,
            format!(
                "No two-digit Task sequence remains under {}",
                base.display()
            ),
        ));
    }
    Ok(maximum + 1)
}

fn parse_sequence(value: &str) -> Option<u64> {
    let (prefix, slug) = value.split_once("--")?;
    (prefix.len() == 2 && prefix.bytes().all(|byte| byte.is_ascii_digit()) && !slug.is_empty())
        .then(|| prefix.parse().ok())
        .flatten()
}

fn parse_created_at(value: Option<&str>) -> Result<DateTime<FixedOffset>> {
    match value {
        Some(value) => DateTime::parse_from_rfc3339(value)
            .map_err(|error| TkError::request("invalid_created_at", error.to_string())),
        None => Ok(Local::now().fixed_offset()),
    }
}

fn uuid_for_time(value: DateTime<FixedOffset>) -> Result<Uuid> {
    let seconds = value.timestamp();
    if seconds < 0 {
        return Err(TkError::request(
            "invalid_created_at",
            "created_at must not be before the Unix epoch",
        ));
    }
    Ok(Uuid::new_v7(Timestamp::from_unix(
        NoContext,
        seconds as u64,
        value.timestamp_subsec_nanos(),
    )))
}

fn require_creation_authorization(
    policy: CreationPolicy,
    status: Status,
    top_level: bool,
    user_confirmed: bool,
) -> Result<()> {
    if !user_confirmed
        && (status == Status::Planning || (top_level && policy == CreationPolicy::Strict))
    {
        return Err(TkError::new(
            "creation_confirmation_required",
            ErrorCategory::Policy,
            if status == Status::Planning {
                "Planning Task creation requires current user confirmation"
            } else {
                "This top-level Task creation requires current user confirmation"
            },
        ));
    }
    Ok(())
}

fn validate_update_input(request: &UpdateRequest) -> Result<()> {
    let unset: HashSet<_> = request.unset_extra.iter().collect();
    if request.set_extra.keys().any(|key| unset.contains(key)) {
        return Err(TkError::request(
            "conflicting_extra_update",
            "The same extra key cannot be set and unset in one update",
        ));
    }
    validate_extra(&Value::Object(
        request.set_extra.clone().into_iter().collect(),
    ))
}

fn resolve_relation_additions(
    project: &Project,
    refs: &[String],
    self_id: Uuid,
) -> Result<BTreeSet<Uuid>> {
    let mut ids = BTreeSet::new();
    for task_ref in refs {
        let id = resolve_ref(project, task_ref)?.metadata.id;
        if id == self_id {
            return Err(TkError::invariant(
                "self_relation",
                "A Task cannot relate to itself",
            ));
        }
        ids.insert(id);
    }
    Ok(ids)
}

fn resolve_relation_removals(project: &Project, refs: &[String]) -> Result<BTreeSet<Uuid>> {
    let mut ids = BTreeSet::new();
    for task_ref in refs {
        let id = match Uuid::parse_str(task_ref) {
            Ok(id) => id,
            Err(_) => resolve_ref(project, task_ref)?.metadata.id,
        };
        ids.insert(id);
    }
    Ok(ids)
}

fn intersects(left: &BTreeSet<Uuid>, right: &BTreeSet<Uuid>) -> bool {
    left.iter().any(|id| right.contains(id))
}

fn apply_relation_delta(
    values: &mut Vec<Uuid>,
    additions: &BTreeSet<Uuid>,
    removals: &BTreeSet<Uuid>,
) {
    values.retain(|id| !removals.contains(id));
    values.extend(additions.iter().copied());
    values.sort_unstable();
    values.dedup();
}

fn require_lifecycle_authorization(action: &str, reason: &str, confirmed: bool) -> Result<()> {
    if reason.trim().is_empty() || reason.contains(['\r', '\n']) {
        return Err(TkError::request(
            "invalid_lifecycle_reason",
            "Lifecycle reason must be a non-empty single line",
        ));
    }
    if !confirmed {
        return Err(TkError::new(
            "lifecycle_confirmation_required",
            ErrorCategory::Policy,
            format!("{action} requires current user confirmation"),
        ));
    }
    Ok(())
}

fn ensure_closeable(project: &Project, task: &StoredTask) -> Result<()> {
    let graph = task_store::discover_tasks(&project.task_root, project.config.metadata_mode)?;
    let task_index = graph.task_index(&task.directory).ok_or_else(|| {
        TkError::new(
            "task_discovery_changed",
            ErrorCategory::Conflict,
            "Task disappeared before lifecycle validation",
        )
    })?;
    let status_by_id: HashMap<_, _> = graph
        .tasks
        .iter()
        .map(|candidate| (candidate.task.metadata.id, candidate.task.metadata.status))
        .collect();
    let open_descendants: Vec<_> = graph
        .tasks
        .iter()
        .enumerate()
        .filter(|(index, candidate)| {
            graph.is_descendant_of(*index, task_index)
                && candidate.task.metadata.status != Status::Closed
        })
        .map(|(_, candidate)| candidate.task.metadata.id)
        .collect();
    let open_dependencies: Vec<_> = task
        .metadata
        .depends_on
        .iter()
        .copied()
        .filter(|id| status_by_id.get(id) != Some(&Status::Closed))
        .collect();
    if !open_descendants.is_empty() || !open_dependencies.is_empty() {
        return Err(TkError::invariant(
            "task_not_closeable",
            "Task has open descendants or dependencies",
        )
        .with_details(serde_json::json!({
            "open_descendants": open_descendants,
            "open_dependencies": open_dependencies,
        })));
    }
    Ok(())
}

fn ensure_reopenable(project: &Project, task: &StoredTask) -> Result<()> {
    let graph = task_store::discover_tasks(&project.task_root, project.config.metadata_mode)?;
    let task_index = graph.task_index(&task.directory).ok_or_else(|| {
        TkError::new(
            "task_discovery_changed",
            ErrorCategory::Conflict,
            "Task disappeared before lifecycle validation",
        )
    })?;
    let mut ancestor = graph.tasks[task_index].parent;
    while let Some(index) = ancestor {
        let candidate = &graph.tasks[index];
        if candidate.task.metadata.status == Status::Closed {
            return Err(TkError::invariant(
                "closed_ancestor",
                format!(
                    "Cannot reopen below closed ancestor {}",
                    candidate.task.metadata.id
                ),
            ));
        }
        ancestor = candidate.parent;
    }
    Ok(())
}

fn validate_relation_graph(project: &Project, updated: &Metadata) -> Result<()> {
    let graph = task_store::discover_tasks(&project.task_root, project.config.metadata_mode)?;
    validate_relation_graph_in_tasks(&graph, updated)
}

pub(crate) fn validate_relation_graph_in_tasks(
    tasks: &task_store::TaskGraph,
    updated: &Metadata,
) -> Result<()> {
    let mut graph: HashMap<Uuid, Vec<Uuid>> = tasks
        .tasks
        .iter()
        .map(|task| (task.task.metadata.id, task.task.metadata.depends_on.clone()))
        .collect();
    graph.insert(updated.id, updated.depends_on.clone());
    for target in updated.depends_on.iter().chain(&updated.related_to) {
        if !graph.contains_key(target) {
            return Err(TkError::invariant(
                "unknown_relation_target",
                format!("Relation target does not exist: {target}"),
            ));
        }
    }

    fn visit(
        id: Uuid,
        graph: &HashMap<Uuid, Vec<Uuid>>,
        visiting: &mut HashSet<Uuid>,
        visited: &mut HashSet<Uuid>,
    ) -> bool {
        if visited.contains(&id) {
            return false;
        }
        if !visiting.insert(id) {
            return true;
        }
        let cycle = graph
            .get(&id)
            .into_iter()
            .flatten()
            .copied()
            .any(|target| visit(target, graph, visiting, visited));
        visiting.remove(&id);
        visited.insert(id);
        cycle
    }

    let mut visiting = HashSet::new();
    let mut visited = HashSet::new();
    if graph
        .keys()
        .copied()
        .any(|id| visit(id, &graph, &mut visiting, &mut visited))
    {
        return Err(TkError::invariant(
            "dependency_cycle",
            "depends_on would create a cycle",
        ));
    }
    Ok(())
}

fn task_reference(task: &StoredTask) -> TaskReference {
    TaskReference {
        id: task.metadata.id,
        name: task.metadata.name.clone(),
        status: task.metadata.status,
        task_dir: task.directory.clone(),
    }
}

fn resolution_error(code: &str, message: impl Into<String>) -> TkError {
    TkError::new(code, ErrorCategory::Resolution, message)
}

fn default_open_status() -> Status {
    Status::Open
}

impl From<CreateTaskInput> for CommonTaskInput {
    fn from(value: CreateTaskInput) -> Self {
        Self {
            name: value.name,
            status: value.status,
            created_at: value.created_at,
            depends_on: value.depends_on,
            related_to: value.related_to,
            extra: value.extra,
        }
    }
}

impl From<SubtaskInput> for CommonTaskInput {
    fn from(value: SubtaskInput) -> Self {
        Self {
            name: value.name,
            status: value.status,
            created_at: value.created_at,
            depends_on: value.depends_on,
            related_to: value.related_to,
            extra: value.extra,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::{InitOptions, MetadataMode, init};

    fn temp_project() -> (PathBuf, Project) {
        temp_project_with_policy(CreationPolicy::Strict)
    }

    fn temp_project_with_policy(policy: CreationPolicy) -> (PathBuf, Project) {
        let root = std::env::temp_dir().join(format!("tk-app-test-{}", Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        init(
            &root,
            InitOptions {
                creation_policy: Some(policy),
                ..InitOptions::default()
            },
        )
        .unwrap();
        let project = crate::project::discover(&root).unwrap();
        (root, project)
    }

    fn top_input(name: &str) -> CreateTaskInput {
        CreateTaskInput {
            name: name.into(),
            status: Status::Open,
            created_at: Some("2026-08-28T10:00:00+08:00".into()),
            depends_on: vec![],
            related_to: vec![],
            extra: BTreeMap::new(),
        }
    }

    fn subtask_input(name: &str) -> SubtaskInput {
        SubtaskInput {
            name: name.into(),
            status: Status::Open,
            created_at: Some("2026-08-28T11:00:00+08:00".into()),
            depends_on: vec![],
            related_to: vec![],
            extra: BTreeMap::new(),
        }
    }

    #[test]
    fn creates_reads_and_searches_top_level_task() {
        let (root, project) = temp_project();
        let created = create(
            &project,
            CreateRequest::Task {
                input: top_input("tk 设计"),
                user_confirmed: true,
            },
        )
        .unwrap();
        let reference = &created.created[0];
        assert!(reference.task_dir.ends_with("2026/08/28-01--tk-设计"));
        let loaded = read(
            &project,
            &reference.id.to_string(),
            ReadView::Summary,
            20,
            2000,
        )
        .unwrap();
        assert_eq!(loaded.body.as_deref(), Some("# tk-设计\n"));
        let found = search(
            &project,
            SearchRequest {
                query: "tk-设计".into(),
                regex: false,
                search_body: false,
                statuses: vec![],
                extra: BTreeMap::new(),
                limit: 20,
            },
        )
        .unwrap();
        assert_eq!(found.items.len(), 1);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn read_views_return_complete_body_and_project_wal_entries() {
        let (root, project) = temp_project();
        let reference = create(
            &project,
            CreateRequest::Task {
                input: top_input("read-contract"),
                user_confirmed: true,
            },
        )
        .unwrap()
        .created
        .remove(0);
        let body = format!("# read-contract\n\n{}\n", "current body ".repeat(300));
        fs::write(reference.task_dir.join("TASK.md"), &body).unwrap();
        wal::append(
            &reference.task_dir,
            "reviewed",
            Some("durable detail"),
            "test:agent",
        )
        .unwrap();

        let summary = read(
            &project,
            &reference.id.to_string(),
            ReadView::Summary,
            50,
            16_000,
        )
        .unwrap();
        assert_eq!(summary.body.as_deref(), Some(body.as_str()));
        assert!(
            summary
                .wal
                .as_ref()
                .unwrap()
                .entries
                .iter()
                .all(|entry| entry.body.is_none())
        );
        let serialized = serde_json::to_value(&summary).unwrap();
        assert!(serialized.get("truncated_wal").is_none());
        assert!(serialized["wal"].get("truncated").is_none());

        let detailed = read(
            &project,
            &reference.id.to_string(),
            ReadView::Detailed,
            50,
            16_000,
        )
        .unwrap();
        assert_eq!(detailed.body.as_deref(), Some(body.as_str()));
        assert_eq!(
            detailed
                .wal
                .unwrap()
                .entries
                .last()
                .and_then(|entry| entry.body.as_deref()),
            Some("durable detail")
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn minimal_read_skips_task_body_and_wal() {
        let (root, project) = temp_project();
        let reference = create(
            &project,
            CreateRequest::Task {
                input: top_input("minimal-read"),
                user_confirmed: true,
            },
        )
        .unwrap()
        .created
        .remove(0);
        fs::write(reference.task_dir.join("TASK.md"), [0xff]).unwrap();
        fs::write(reference.task_dir.join("wal"), "not a directory").unwrap();

        let result = read(
            &project,
            &reference.id.to_string(),
            ReadView::Minimal,
            50,
            16_000,
        )
        .unwrap();
        assert!(result.body.is_none());
        assert!(result.wal.is_none());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn read_rejects_wal_budgets_above_contract_limits() {
        let (root, project) = temp_project();
        let reference = create(
            &project,
            CreateRequest::Task {
                input: top_input("read-limits"),
                user_confirmed: true,
            },
        )
        .unwrap()
        .created
        .remove(0);

        let entries = read(
            &project,
            &reference.id.to_string(),
            ReadView::Summary,
            51,
            16_000,
        )
        .unwrap_err();
        assert_eq!(entries.code, "invalid_wal_max_entries");
        let length = read(
            &project,
            &reference.id.to_string(),
            ReadView::Summary,
            50,
            16_001,
        )
        .unwrap_err();
        assert_eq!(length.code, "invalid_wal_max_length");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn search_orders_match_classes_by_contract() {
        let created_at = DateTime::parse_from_rfc3339("2026-08-28T10:00:00+08:00").unwrap();
        let mut items = ["string", "regex", "path", "uuid"]
            .into_iter()
            .enumerate()
            .map(|(index, match_reason)| SearchItem {
                id: Uuid::from_u128(index as u128 + 1),
                name: match_reason.into(),
                status: Status::Open,
                created_at,
                task_dir: PathBuf::from(match_reason),
                match_reason: match_reason.into(),
                closed_ancestors: Vec::new(),
            })
            .collect::<Vec<_>>();

        items.sort_by(compare_search_items);

        assert_eq!(
            items
                .iter()
                .map(|item| item.match_reason.as_str())
                .collect::<Vec<_>>(),
            ["uuid", "path", "regex", "string"]
        );
    }

    #[test]
    fn search_retains_later_better_candidates_in_contract_order() {
        let (root, project) = temp_project();
        let mut older = top_input("needle older first");
        older.created_at = Some("2026-08-28T09:00:00+08:00".into());
        let older_first = create(
            &project,
            CreateRequest::Task {
                input: older,
                user_confirmed: true,
            },
        )
        .unwrap()
        .created
        .remove(0);

        let mut older = top_input("needle older second");
        older.created_at = Some("2026-08-28T09:00:00+08:00".into());
        let older_second = create(
            &project,
            CreateRequest::Task {
                input: older,
                user_confirmed: true,
            },
        )
        .unwrap()
        .created
        .remove(0);

        let mut newer = top_input("needle newer");
        newer.created_at = Some("2026-08-28T11:00:00+08:00".into());
        let newer = create(
            &project,
            CreateRequest::Task {
                input: newer,
                user_confirmed: true,
            },
        )
        .unwrap()
        .created
        .remove(0);

        let found = search(
            &project,
            SearchRequest {
                query: "needle".into(),
                regex: false,
                search_body: false,
                statuses: Vec::new(),
                extra: BTreeMap::new(),
                limit: 2,
            },
        )
        .unwrap();
        let expected_older = older_first.id.min(older_second.id);

        assert!(found.truncated);
        assert_eq!(found.items.len(), 2);
        assert_eq!(found.items[0].id, newer.id);
        assert_eq!(found.items[1].id, expected_older);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn strict_project_requires_top_level_confirmation() {
        let (root, project) = temp_project();
        assert!(
            create(
                &project,
                CreateRequest::Task {
                    input: top_input("blocked"),
                    user_confirmed: false,
                },
            )
            .is_err()
        );
        assert!(
            task_store::discover_tasks(&project.task_root, project.config.metadata_mode)
                .unwrap()
                .tasks
                .is_empty()
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn permissive_project_still_requires_confirmation_for_planning() {
        let (root, project) = temp_project_with_policy(CreationPolicy::Permissive);
        let mut planning = top_input("planning");
        planning.status = Status::Planning;
        assert!(
            create(
                &project,
                CreateRequest::Task {
                    input: planning,
                    user_confirmed: false,
                },
            )
            .is_err()
        );
        assert!(
            create(
                &project,
                CreateRequest::Task {
                    input: top_input("open"),
                    user_confirmed: false,
                },
            )
            .is_ok()
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn subtask_retry_counts_discovered_direct_children() {
        let (root, project) = temp_project();
        let parent = create(
            &project,
            CreateRequest::Task {
                input: top_input("parent"),
                user_confirmed: true,
            },
        )
        .unwrap()
        .created
        .remove(0);
        let ordinary =
            prepare_task(&project, subtask_input("first").into(), Some(parent.id)).unwrap();
        task_store::create_task_files(
            &parent.task_dir.join("matching-material"),
            &ordinary.metadata,
            &ordinary.body,
            project.config.metadata_mode,
        )
        .unwrap();
        let malformed = parent.task_dir.join("malformed-material");
        fs::create_dir(&malformed).unwrap();
        fs::write(malformed.join("tk.toml"), "not = [").unwrap();
        fs::write(malformed.join("TASK.md"), "ordinary material\n").unwrap();
        let mut planning = subtask_input("planning");
        planning.status = Status::Planning;
        assert!(
            create(
                &project,
                CreateRequest::Subtasks {
                    parent_ref: parent.id.to_string(),
                    subtasks: vec![planning],
                    user_confirmed: false,
                },
            )
            .is_err()
        );
        let first = create(
            &project,
            CreateRequest::Subtasks {
                parent_ref: parent.id.to_string(),
                subtasks: vec![subtask_input("first"), subtask_input("second")],
                user_confirmed: false,
            },
        )
        .unwrap();
        assert_eq!(first.created.len(), 1);

        let retry = create(
            &project,
            CreateRequest::Subtasks {
                parent_ref: parent.id.to_string(),
                subtasks: vec![subtask_input("first"), subtask_input("second")],
                user_confirmed: false,
            },
        )
        .unwrap();
        assert!(!retry.changed);
        assert!(!retry.committed);
        assert!(retry.created.is_empty());
        assert_eq!(
            task_store::discover_tasks(&project.task_root, project.config.metadata_mode)
                .unwrap()
                .tasks
                .len(),
            3
        );

        let duplicate = create(
            &project,
            CreateRequest::Subtasks {
                parent_ref: parent.id.to_string(),
                subtasks: vec![subtask_input("first"), subtask_input("first")],
                user_confirmed: false,
            },
        )
        .unwrap();
        assert_eq!(duplicate.created.len(), 1);
        assert_eq!(
            task_store::discover_tasks(&project.task_root, project.config.metadata_mode)
                .unwrap()
                .tasks
                .len(),
            4
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn subtask_retry_ignores_agent_edited_body() {
        let (root, project) = temp_project_with_policy(CreationPolicy::Permissive);
        let parent = create(
            &project,
            CreateRequest::Task {
                input: top_input("parent"),
                user_confirmed: true,
            },
        )
        .unwrap()
        .created
        .remove(0);
        let first = create(
            &project,
            CreateRequest::Subtasks {
                parent_ref: parent.id.to_string(),
                subtasks: vec![subtask_input("first")],
                user_confirmed: false,
            },
        )
        .unwrap()
        .created
        .remove(0);

        fs::write(
            first.task_dir.join("TASK.md"),
            "# first\n\nAgent rewrote this body after creation.\n",
        )
        .unwrap();

        let retry = create(
            &project,
            CreateRequest::Subtasks {
                parent_ref: parent.id.to_string(),
                subtasks: vec![subtask_input("first")],
                user_confirmed: false,
            },
        )
        .unwrap();
        assert!(!retry.changed);
        assert!(!retry.committed);
        assert!(retry.created.is_empty());
        assert_eq!(
            task_store::discover_tasks(&project.task_root, project.config.metadata_mode)
                .unwrap()
                .tasks
                .len(),
            2
        );
        assert_eq!(
            fs::read_to_string(first.task_dir.join("TASK.md")).unwrap(),
            "# first\n\nAgent rewrote this body after creation.\n"
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn split_and_embed_creation_write_only_the_normalized_name_heading() {
        for mode in [MetadataMode::Split, MetadataMode::Embed] {
            let root = std::env::temp_dir().join(format!("tk-app-test-{}", Uuid::now_v7()));
            fs::create_dir(&root).unwrap();
            let project = init(
                &root,
                InitOptions {
                    creation_policy: Some(CreationPolicy::Permissive),
                    metadata_mode: Some(mode),
                    ..InitOptions::default()
                },
            )
            .unwrap()
            .project;
            let created = create(
                &project,
                CreateRequest::Task {
                    input: top_input("Mixed Case!"),
                    user_confirmed: false,
                },
            )
            .unwrap()
            .created
            .remove(0);
            let carrier = created.task_dir.join("TASK.md");
            let content = fs::read_to_string(&carrier).unwrap();
            let body = content
                .strip_prefix("---\n")
                .and_then(|rest| rest.split_once("\n---\n"))
                .map(|(_, body)| body)
                .unwrap_or(&content);
            assert_eq!(body, "# Mixed-Case\n");
            fs::remove_dir_all(root).unwrap();
        }
    }

    #[test]
    fn subtask_sequence_uses_all_discovered_direct_children_after_config_change() {
        let root = std::env::temp_dir().join(format!("tk-app-test-{}", Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        let project = init(
            &root,
            InitOptions {
                subtasks_dir: Some("old-children".into()),
                ..InitOptions::default()
            },
        )
        .unwrap()
        .project;
        let parent = create(
            &project,
            CreateRequest::Task {
                input: top_input("parent"),
                user_confirmed: true,
            },
        )
        .unwrap()
        .created
        .remove(0);
        let first = create(
            &project,
            CreateRequest::Subtasks {
                parent_ref: parent.id.to_string(),
                subtasks: vec![subtask_input("first")],
                user_confirmed: false,
            },
        )
        .unwrap()
        .created
        .remove(0);
        assert!(first.task_dir.ends_with("old-children/01--first"));

        let imported =
            prepare_task(&project, subtask_input("imported").into(), Some(parent.id)).unwrap();
        task_store::create_task_files(
            &parent.task_dir.join("materials/03--imported"),
            &imported.metadata,
            &imported.body,
            project.config.metadata_mode,
        )
        .unwrap();
        fs::write(&project.config_path, "subtasks_dir = \"new-children\"\n").unwrap();
        let project = crate::project::discover(&root).unwrap();

        assert_eq!(
            resolve_ref(&project, &first.id.to_string())
                .unwrap()
                .directory,
            first.task_dir
        );
        let second = create(
            &project,
            CreateRequest::Subtasks {
                parent_ref: parent.id.to_string(),
                subtasks: vec![subtask_input("second")],
                user_confirmed: false,
            },
        )
        .unwrap()
        .created
        .remove(0);
        assert!(second.task_dir.ends_with("new-children/04--second"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn enforces_dependencies_and_closed_read_only() {
        let (root, project) = temp_project();
        let dependency = create(
            &project,
            CreateRequest::Task {
                input: top_input("dependency"),
                user_confirmed: true,
            },
        )
        .unwrap()
        .created
        .remove(0);
        let task = create(
            &project,
            CreateRequest::Task {
                input: top_input("consumer"),
                user_confirmed: true,
            },
        )
        .unwrap()
        .created
        .remove(0);

        update(
            &project,
            &task.id.to_string(),
            UpdateRequest {
                add_depends_on: vec![dependency.id.to_string()],
                ..UpdateRequest::default()
            },
            "test:agent",
        )
        .unwrap();
        assert!(
            update(
                &project,
                &task.id.to_string(),
                UpdateRequest {
                    lifecycle: Some(LifecycleAction::Close {
                        reason: "done".into(),
                        force: false,
                        user_confirmed: true,
                    }),
                    ..UpdateRequest::default()
                },
                "test:agent",
            )
            .is_err()
        );
        update(
            &project,
            &dependency.id.to_string(),
            UpdateRequest {
                lifecycle: Some(LifecycleAction::Close {
                    reason: "done".into(),
                    force: false,
                    user_confirmed: true,
                }),
                ..UpdateRequest::default()
            },
            "test:agent",
        )
        .unwrap();
        log(
            &project,
            &task.id.to_string(),
            "Verified dependency",
            None,
            "test:agent",
        )
        .unwrap();
        update(
            &project,
            &task.id.to_string(),
            UpdateRequest {
                lifecycle: Some(LifecycleAction::Close {
                    reason: "done".into(),
                    force: false,
                    user_confirmed: true,
                }),
                ..UpdateRequest::default()
            },
            "test:agent",
        )
        .unwrap();
        assert!(
            log(
                &project,
                &task.id.to_string(),
                "too late",
                None,
                "test:agent"
            )
            .is_err()
        );
        let read = read(&project, &task.id.to_string(), ReadView::Detailed, 20, 2000).unwrap();
        assert_eq!(read.wal.unwrap().entries.len(), 2);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_dependency_cycles() {
        let (root, project) = temp_project();
        let first = create(
            &project,
            CreateRequest::Task {
                input: top_input("first"),
                user_confirmed: true,
            },
        )
        .unwrap()
        .created
        .remove(0);
        let second = create(
            &project,
            CreateRequest::Task {
                input: top_input("second"),
                user_confirmed: true,
            },
        )
        .unwrap()
        .created
        .remove(0);
        update(
            &project,
            &first.id.to_string(),
            UpdateRequest {
                add_depends_on: vec![second.id.to_string()],
                ..UpdateRequest::default()
            },
            "test:agent",
        )
        .unwrap();
        assert!(
            update(
                &project,
                &second.id.to_string(),
                UpdateRequest {
                    add_depends_on: vec![first.id.to_string()],
                    ..UpdateRequest::default()
                },
                "test:agent",
            )
            .is_err()
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reopen_ignores_ordinary_files_between_canonical_tasks() {
        let root = std::env::temp_dir().join(format!("tk-app-test-{}", Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        let project = init(
            &root,
            InitOptions {
                subtasks_dir: Some("children/nested".into()),
                ..InitOptions::default()
            },
        )
        .unwrap()
        .project;
        let parent = create(
            &project,
            CreateRequest::Task {
                input: top_input("parent"),
                user_confirmed: true,
            },
        )
        .unwrap()
        .created
        .remove(0);
        let child = create(
            &project,
            CreateRequest::Subtasks {
                parent_ref: parent.id.to_string(),
                subtasks: vec![subtask_input("child")],
                user_confirmed: false,
            },
        )
        .unwrap()
        .created
        .remove(0);
        fs::write(
            parent.task_dir.join("children/TASK.md"),
            "ordinary material\n",
        )
        .unwrap();
        update(
            &project,
            &child.id.to_string(),
            UpdateRequest {
                lifecycle: Some(LifecycleAction::Close {
                    reason: "done".into(),
                    force: false,
                    user_confirmed: true,
                }),
                ..UpdateRequest::default()
            },
            "test",
        )
        .unwrap();
        let reopened = update(
            &project,
            &child.id.to_string(),
            UpdateRequest {
                lifecycle: Some(LifecycleAction::Reopen {
                    reason: "continue".into(),
                    user_confirmed: true,
                }),
                ..UpdateRequest::default()
            },
            "test",
        )
        .unwrap();
        assert_eq!(reopened.task.status, Status::Open);
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn subtask_creation_rejects_a_symlinked_configured_parent() {
        use std::os::unix::fs::symlink;

        let root = std::env::temp_dir().join(format!("tk-app-test-{}", Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        let project = init(
            &root,
            InitOptions {
                subtasks_dir: Some("children".into()),
                ..InitOptions::default()
            },
        )
        .unwrap()
        .project;
        let outside = std::env::temp_dir().join(format!("tk-app-outside-{}", Uuid::now_v7()));
        fs::create_dir(&outside).unwrap();
        let parent = create(
            &project,
            CreateRequest::Task {
                input: top_input("parent"),
                user_confirmed: true,
            },
        )
        .unwrap()
        .created
        .remove(0);
        symlink(&outside, parent.task_dir.join(&project.config.subtasks_dir)).unwrap();
        let error = create(
            &project,
            CreateRequest::Subtasks {
                parent_ref: parent.id.to_string(),
                subtasks: vec![subtask_input("child")],
                user_confirmed: false,
            },
        )
        .unwrap_err();
        assert_eq!(error.code, "invalid_exact_path");
        assert!(fs::read_dir(&outside).unwrap().next().is_none());
        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }

    #[test]
    fn sequence_allocation_ignores_large_noncanonical_prefixes() {
        let (root, project) = temp_project();
        let top_material = project.task_root.join("2026/08/28-999--notes");
        fs::create_dir_all(&top_material).unwrap();
        let parent = create(
            &project,
            CreateRequest::Task {
                input: top_input("parent"),
                user_confirmed: true,
            },
        )
        .unwrap()
        .created
        .remove(0);
        assert!(parent.task_dir.ends_with("28-01--parent"));
        fs::create_dir(parent.task_dir.join("999--notes")).unwrap();
        let child = create(
            &project,
            CreateRequest::Subtasks {
                parent_ref: parent.id.to_string(),
                subtasks: vec![subtask_input("child")],
                user_confirmed: false,
            },
        )
        .unwrap()
        .created
        .remove(0);
        assert!(child.task_dir.ends_with("01--child"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn two_digit_task_sequence_space_is_enforced() {
        let (root, project) = temp_project();
        let parent = create(
            &project,
            CreateRequest::Task {
                input: top_input("parent"),
                user_confirmed: true,
            },
        )
        .unwrap()
        .created
        .remove(0);
        let created_at = DateTime::parse_from_rfc3339("2026-08-28T10:00:00+08:00").unwrap();
        let metadata = |name: &str| Metadata {
            schema_version: TASK_SCHEMA_VERSION,
            id: Uuid::now_v7(),
            name: name.into(),
            status: Status::Open,
            created_at,
            depends_on: Vec::new(),
            related_to: Vec::new(),
            extra: BTreeMap::new(),
        };
        let month = project.task_root.join("2026/08");
        for sequence in 2..=MAX_TASK_SEQUENCE {
            let name = format!("top-{sequence:02}");
            task_store::create_task_files(
                &month.join(format!("28-{sequence:02}--{name}")),
                &metadata(&name),
                b"top\n",
                project.config.metadata_mode,
            )
            .unwrap();
        }
        let error = top_level_path(&project, created_at, "overflow").unwrap_err();
        assert_eq!(error.code, "task_sequence_exhausted");

        let subtask_base = parent.task_dir.join(&project.config.subtasks_dir);
        for sequence in 1..=MAX_TASK_SEQUENCE {
            let name = format!("child-{sequence:02}");
            task_store::create_task_files(
                &subtask_base.join(format!("{sequence:02}--{name}")),
                &metadata(&name),
                b"child\n",
                project.config.metadata_mode,
            )
            .unwrap();
        }
        let graph =
            task_store::discover_tasks(&project.task_root, project.config.metadata_mode).unwrap();
        let parent_index = graph.task_index(&parent.task_dir).unwrap();
        let error = next_subtask_sequence(&graph, parent_index, &subtask_base).unwrap_err();
        assert_eq!(error.code, "task_sequence_exhausted");
        fs::remove_dir_all(root).unwrap();
    }
}
