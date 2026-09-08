use std::collections::{BTreeMap, HashMap, HashSet};
use std::ffi::OsString;
use std::fmt::Write as _;
use std::fs;
use std::os::unix::ffi::OsStringExt;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::app::{AppWarning, TaskReference};
use crate::domain::{Status, normalize_name};
use crate::error::{ErrorCategory, Result, TkError};
use crate::path::storage_error;
use crate::project::{self, GitPolicy, MetadataMode, Project};
use crate::task_store::{self, StoredTask};
use crate::wal;

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Error,
    Warning,
}

#[derive(Debug, Serialize)]
pub struct Diagnostic {
    pub severity: Severity,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<PathBuf>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct CheckResult {
    pub ok: bool,
    pub complete: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_root: Option<PathBuf>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub task_root: Option<PathBuf>,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MarkdownReference {
    pub path: PathBuf,
    pub line: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RenamePlan {
    pub task_id: Uuid,
    pub old_name: String,
    pub new_name: String,
    pub old_path: PathBuf,
    pub target_path: PathBuf,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_task: Option<PathBuf>,
    pub references: Vec<MarkdownReference>,
    pub expected_wal: String,
}

#[derive(Debug, Serialize)]
pub struct RenameResult {
    pub changed: bool,
    pub committed: bool,
    pub partial: bool,
    pub task: TaskReference,
    pub plan: RenamePlan,
    #[serde(skip)]
    pub warnings: Vec<AppWarning>,
}

pub fn check(cwd: &Path) -> CheckResult {
    let project = match project::discover_unchecked(cwd) {
        Ok(project) => project,
        Err(error) => {
            return CheckResult {
                ok: false,
                complete: false,
                project_root: None,
                task_root: None,
                diagnostics: vec![error_diagnostic(error, None)],
            };
        }
    };
    let mut diagnostics = Vec::new();
    let complete = match inspect_root(&project, &mut diagnostics) {
        Ok(()) => true,
        Err(error) => {
            diagnostics.push(error_diagnostic(error, None));
            false
        }
    };
    CheckResult {
        ok: complete
            && !diagnostics
                .iter()
                .any(|diagnostic| matches!(diagnostic.severity, Severity::Error)),
        complete,
        project_root: Some(project.root),
        task_root: Some(project.task_root),
        diagnostics,
    }
}

pub fn rename(
    project: &Project,
    task_ref: &str,
    requested_name: &str,
    dry_run: bool,
    ignore_brokenlinks: bool,
    actor: &str,
) -> Result<RenameResult> {
    let task = resolve_rename_ref(project, task_ref)?;
    if task.metadata.status == Status::Closed {
        return Err(TkError::new(
            "closed_task_read_only",
            ErrorCategory::Invariant,
            "Cannot rename a closed Task",
        ));
    }
    let plan = build_rename_plan(project, &task, requested_name)?;
    let metadata_changed = plan.old_name != plan.new_name;
    let path_changed = plan.old_path != plan.target_path;
    if !metadata_changed && !path_changed {
        return Ok(RenameResult {
            changed: false,
            committed: false,
            partial: false,
            task: task_reference(&task),
            plan,
            warnings: Vec::new(),
        });
    }
    if dry_run {
        return Ok(RenameResult {
            changed: true,
            committed: false,
            partial: false,
            task: task_reference(&task),
            plan,
            warnings: Vec::new(),
        });
    }
    if path_changed && !plan.references.is_empty() && !ignore_brokenlinks {
        let mut listing = String::new();
        for reference in &plan.references {
            let _ = writeln!(listing, "  {}:{}", reference.path.display(), reference.line);
        }
        let listing = listing.trim_end();
        return Err(TkError::new(
            "broken_reference_conflict",
            ErrorCategory::Conflict,
            format!(
                "Renaming {} would leave {} reference{} to the old path broken. Rename to {} after updating them, or pass --ignore-brokenlinks to move anyway:\n{}",
                plan.old_path.display(),
                plan.references.len(),
                if plan.references.len() == 1 { "" } else { "s" },
                plan.target_path.display(),
                listing
            ),
        )
        .with_details(json!({
            "old_path": plan.old_path,
            "new_name": plan.new_name,
            "target_path": plan.target_path,
            "references": plan.references,
        })));
    }

    project::ensure_mutable(project)?;
    let operation = crate::gc::begin_project_operation(&project.task_root)?;
    let (metadata, warnings, _completed) = operation.execute(
        |_operation| {
            let current = resolve_rename_ref(project, &task.metadata.id.to_string())?;
            let rechecked = build_rename_plan(project, &current, requested_name)?;
            if current.directory != task.directory
                || current.metadata != task.metadata
                || rechecked.target_path != plan.target_path
                || rechecked.references != plan.references
            {
                return Err(TkError::new(
                    "stale_rename_plan",
                    ErrorCategory::Conflict,
                    "Rename inputs changed during execution",
                ));
            }

            let mut completed = Vec::new();
            if path_changed {
                fs::rename(&plan.old_path, &plan.target_path)
                    .map_err(|error| storage_error("move_task_directory", &plan.old_path, error))?;
                completed.push(plan.target_path.clone());
            }
            let mut metadata = task.metadata.clone();
            metadata.name = plan.new_name.clone();
            let carrier = metadata_path(&plan.target_path, project.config.metadata_mode);
            if let Err(error) = task_store::replace_metadata_for_rename(
                &plan.target_path,
                &metadata,
                project.config.metadata_mode,
            ) {
                if completed.is_empty() {
                    return Err(error);
                }
                return Err(TkError::partial_commit(
                    "Task directory moved but its metadata rename did not commit",
                    json!(completed),
                    json!([carrier]),
                    error,
                ));
            }
            completed.push(carrier);

            let mut warnings = Vec::new();
            if let Err(error) = wal::append(&plan.target_path, &plan.expected_wal, None, actor) {
                warnings.push(AppWarning {
                    code: "wal_append_failed".into(),
                    message: error.message,
                    details: error.details,
                });
            }
            Ok((metadata, warnings, completed))
        },
        |(_, _, completed), cleanup_path, error| {
            TkError::partial_commit(
                "Task rename committed but cleanup failed",
                json!(completed),
                json!([cleanup_path]),
                error,
            )
        },
    )?;
    Ok(RenameResult {
        changed: true,
        committed: true,
        partial: false,
        task: TaskReference {
            id: metadata.id,
            name: metadata.name,
            status: metadata.status,
            task_dir: plan.target_path.clone(),
        },
        plan,
        warnings,
    })
}

fn resolve_rename_ref(project: &Project, task_ref: &str) -> Result<StoredTask> {
    let graph =
        task_store::discover_tasks_for_rename(&project.task_root, project.config.metadata_mode)?;
    crate::app::resolve_ref_in_graph(project, task_ref, graph)
}

fn build_rename_plan(
    project: &Project,
    task: &StoredTask,
    requested_name: &str,
) -> Result<RenamePlan> {
    let new_name = normalize_name(requested_name)?;
    let mut repaired_metadata = task.metadata.clone();
    repaired_metadata.name = new_name.clone();
    repaired_metadata.validate()?;
    let graph =
        task_store::discover_tasks_for_rename(&project.task_root, project.config.metadata_mode)?;
    crate::app::validate_relation_graph_in_tasks(&graph, &repaired_metadata)?;
    if graph
        .tasks
        .iter()
        .filter(|candidate| candidate.task.metadata.id == task.metadata.id)
        .count()
        != 1
    {
        return Err(TkError::new(
            "duplicate_task_id",
            ErrorCategory::Resolution,
            format!("More than one Task has ID {}", task.metadata.id),
        ));
    }
    let task_index = graph.task_index(&task.directory).ok_or_else(|| {
        TkError::new(
            "task_discovery_changed",
            ErrorCategory::Conflict,
            "Task disappeared before rename planning",
        )
    })?;
    let parent_task = graph.tasks[task_index]
        .parent
        .map(|parent| graph.tasks[parent].task.directory.clone());
    let generated_directory = graph.tasks[task_index].parent.is_none()
        || task_store::generated_child_slug(&task.directory).is_some();
    let target_path = if generated_directory {
        let file_name = task
            .directory
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| {
                TkError::new(
                    "invalid_task_path",
                    ErrorCategory::ManagedFile,
                    "Task directory name is not UTF-8",
                )
            })?;
        let (prefix, _) = file_name.split_once("--").ok_or_else(|| {
            TkError::new(
                "invalid_task_path",
                ErrorCategory::ManagedFile,
                format!(
                    "Generated Task directory lacks a sequence separator: {}",
                    task.directory.display()
                ),
            )
        })?;
        task.directory
            .parent()
            .expect("managed Task has a parent")
            .join(format!("{prefix}--{new_name}"))
    } else {
        task.directory.clone()
    };
    if target_path != task.directory && target_path.exists() {
        return Err(TkError::new(
            "rename_target_exists",
            ErrorCategory::Conflict,
            format!("Rename target already exists: {}", target_path.display()),
        ));
    }
    let references = scan_markdown_references(project, &task.directory)?;
    Ok(RenamePlan {
        task_id: task.metadata.id,
        old_name: task.metadata.name.clone(),
        new_name: new_name.clone(),
        old_path: task.directory.clone(),
        target_path,
        parent_task,
        references,
        expected_wal: format!("Renamed Task from {} to {new_name}.", task.metadata.name),
    })
}

fn scan_markdown_references(
    project: &Project,
    task_directory: &Path,
) -> Result<Vec<MarkdownReference>> {
    let relative = task_directory.strip_prefix(&project.root).map_err(|_| {
        TkError::new(
            "task_outside_project",
            ErrorCategory::ManagedFile,
            "Task path is outside the project",
        )
    })?;
    let needle = relative.to_string_lossy().replace('\\', "/");
    let paths = match project.config.git_policy {
        GitPolicy::Track => tracked_markdown(project)?,
        GitPolicy::Ignore | GitPolicy::None => task_root_markdown(project)?,
    };
    let embedded_tasks: HashSet<_> = if project.config.metadata_mode == MetadataMode::Embed {
        task_store::discover_tasks(&project.task_root, MetadataMode::Embed)?
            .tasks
            .into_iter()
            .map(|task| task.task.directory)
            .collect()
    } else {
        HashSet::new()
    };
    let mut references = Vec::new();
    for path in paths {
        scan_markdown_file(project, &path, &needle, &embedded_tasks, &mut references)?;
    }
    references.sort_by(|left, right| left.path.cmp(&right.path).then(left.line.cmp(&right.line)));
    references.dedup();
    Ok(references)
}

fn tracked_markdown(project: &Project) -> Result<Vec<PathBuf>> {
    tracked_markdown_with(project, Path::new("git"))
}

fn tracked_markdown_with(project: &Project, executable: &Path) -> Result<Vec<PathBuf>> {
    let mut command = Command::new(executable);
    command
        .args(["ls-files", "-z", "--", "*.md"])
        .current_dir(&project.root);
    let output = crate::process::output(&mut command, "git ls-files")?;
    if !output.status.success() {
        return Err(TkError::new(
            "git_scan_failed",
            ErrorCategory::Context,
            String::from_utf8_lossy(&output.stderr).trim().to_owned(),
        ));
    }
    let mut paths: Vec<_> = output
        .stdout
        .split(|byte| *byte == 0)
        .filter(|bytes| !bytes.is_empty())
        .map(|bytes| project.root.join(OsString::from_vec(bytes.to_vec())))
        .collect();
    paths.sort();
    Ok(paths)
}

fn task_root_markdown(project: &Project) -> Result<Vec<PathBuf>> {
    let mut paths = Vec::new();
    let mut pending = vec![project.task_root.clone()];
    while let Some(directory) = pending.pop() {
        for entry in fs::read_dir(&directory)
            .map_err(|error| storage_error("scan_markdown_references", &directory, error))?
        {
            let entry = entry
                .map_err(|error| storage_error("scan_markdown_references", &directory, error))?;
            let file_type = entry.file_type().map_err(|error| {
                storage_error("inspect_markdown_reference", &entry.path(), error)
            })?;
            if file_type.is_symlink() {
                continue;
            }
            if file_type.is_dir() {
                if !matches!(entry.file_name().to_str(), Some("wal" | ".tk-tmp")) {
                    pending.push(entry.path());
                }
            } else if entry.path().extension().and_then(|value| value.to_str()) == Some("md") {
                paths.push(entry.path());
            }
        }
    }
    paths.sort();
    Ok(paths)
}

fn scan_markdown_file(
    project: &Project,
    path: &Path,
    needle: &str,
    embedded_tasks: &HashSet<PathBuf>,
    references: &mut Vec<MarkdownReference>,
) -> Result<()> {
    let text = fs::read_to_string(path)
        .map_err(|error| storage_error("read_markdown_reference", path, error))?;
    let body_start = if project.config.metadata_mode == MetadataMode::Embed
        && path.file_name().and_then(|value| value.to_str()) == Some("TASK.md")
        && path
            .parent()
            .is_some_and(|directory| embedded_tasks.contains(directory))
    {
        embedded_body_line(&text).unwrap_or(0)
    } else {
        0
    };
    for (index, line) in text.lines().enumerate().skip(body_start) {
        if line.contains(needle) {
            references.push(MarkdownReference {
                path: path.to_path_buf(),
                line: index + 1,
            });
        }
    }
    Ok(())
}

fn embedded_body_line(text: &str) -> Option<usize> {
    let mut lines = text.lines();
    if lines.next()? != "---" {
        return None;
    }
    lines.position(|line| line == "---").map(|index| index + 2)
}

fn inspect_root(project: &Project, diagnostics: &mut Vec<Diagnostic>) -> Result<()> {
    let canonical_project = project
        .root
        .canonicalize()
        .map_err(|error| storage_error("resolve_project_root", &project.root, error))?;
    let canonical_tasks = project
        .task_root
        .canonicalize()
        .map_err(|error| storage_error("resolve_task_root", &project.task_root, error))?;
    if !canonical_tasks.starts_with(&canonical_project) {
        diagnostics.push(diagnostic(
            Severity::Error,
            "task_root_outside_project",
            "Task root resolves outside the project",
            Some(project.task_root.clone()),
        ));
    }
    inspect_cleanup_markers(project, diagnostics)?;
    inspect_symlinks(&project.task_root, diagnostics)?;

    let task_store::TaskGraph {
        tasks: discovered,
        invalid_candidates,
    } = task_store::discover_tasks(&project.task_root, project.config.metadata_mode)?;
    for candidate in invalid_candidates {
        diagnostics.push(error_diagnostic(candidate.error, Some(candidate.directory)));
    }
    let mut ids: HashMap<Uuid, Vec<PathBuf>> = HashMap::new();
    let mut sequences: BTreeMap<(PathBuf, String), Vec<PathBuf>> = BTreeMap::new();
    for candidate in &discovered {
        let task = &candidate.task;
        ids.entry(task.metadata.id)
            .or_default()
            .push(task.directory.clone());
        let file_name = task.directory.file_name().and_then(|name| name.to_str());
        let sequence = if candidate.parent.is_none() {
            file_name.and_then(|name| name.split_once("--").map(|(prefix, _)| prefix))
        } else if task_store::generated_child_slug(&task.directory).is_some() {
            file_name.and_then(|name| name.split_once("--").map(|(prefix, _)| prefix))
        } else {
            None
        };
        if let Some(sequence) = sequence {
            let parent = candidate.parent.map_or_else(
                || {
                    task.directory
                        .parent()
                        .unwrap_or(&project.task_root)
                        .to_path_buf()
                },
                |parent| discovered[parent].task.directory.clone(),
            );
            sequences
                .entry((parent, sequence.into()))
                .or_default()
                .push(task.directory.clone());
        }
        for warning in wal::inspect(&task.directory)? {
            diagnostics.push(Diagnostic {
                severity: Severity::Warning,
                code: warning.code,
                message: warning.message,
                path: Some(warning.path),
                details: None,
            });
        }
    }
    for (id, paths) in ids.iter().filter(|(_, paths)| paths.len() > 1) {
        diagnostics.push(Diagnostic {
            severity: Severity::Error,
            code: "duplicate_task_id".into(),
            message: format!("Task ID appears in multiple directories: {id}"),
            path: None,
            details: Some(json!({"paths": paths})),
        });
    }
    for ((parent, sequence), paths) in sequences.into_iter().filter(|(_, paths)| paths.len() > 1) {
        diagnostics.push(Diagnostic {
            severity: Severity::Error,
            code: "duplicate_task_sequence".into(),
            message: format!("Task sequence {sequence} is reused under one parent"),
            path: Some(parent.clone()),
            details: Some(json!({"parent": parent, "paths": paths})),
        });
    }
    let tasks: Vec<_> = discovered.into_iter().map(|task| task.task).collect();
    inspect_relations(&tasks, diagnostics);
    Ok(())
}

fn inspect_cleanup_markers(project: &Project, diagnostics: &mut Vec<Diagnostic>) -> Result<()> {
    let root = project.task_root.join(".tk-tmp");
    if !root.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(&root)
        .map_err(|error| storage_error("scan_temporary_operations", &root, error))?
    {
        let entry =
            entry.map_err(|error| storage_error("scan_temporary_operations", &root, error))?;
        let file_type = entry
            .file_type()
            .map_err(|error| storage_error("inspect_temporary_operation", &entry.path(), error))?;
        if !file_type.is_dir() || file_type.is_symlink() {
            diagnostics.push(diagnostic(
                Severity::Warning,
                "unknown_cleanup_content",
                "Unrecognized content exists in the tk temporary root",
                Some(entry.path()),
            ));
            continue;
        }
        let manifest = entry.path().join(crate::gc::MANIFEST_FILE);
        let text = fs::read_to_string(&manifest)
            .map_err(|error| storage_error("read_cleanup_manifest", &manifest, error))?;
        let classification = toml::from_str::<toml::Value>(&text).ok().filter(|value| {
            value
                .get("format_version")
                .and_then(toml::Value::as_integer)
                == Some(1)
                && value.get("producer").is_some()
                && value.get("created_at").is_some()
                && value
                    .get("temporary_paths")
                    .is_none_or(toml::Value::is_array)
        });
        if classification.is_some() {
            diagnostics.push(diagnostic(
                Severity::Error,
                "operation_in_progress",
                "A project activity marker blocks writes until the producer finishes and GC removes it",
                Some(manifest),
            ));
        } else {
            diagnostics.push(diagnostic(
                Severity::Warning,
                "unknown_cleanup_manifest",
                "Temporary content does not use the current cleanup manifest format",
                Some(manifest),
            ));
        }
    }
    Ok(())
}

fn inspect_relations(tasks: &[StoredTask], diagnostics: &mut Vec<Diagnostic>) {
    let known: HashSet<_> = tasks.iter().map(|task| task.metadata.id).collect();
    let graph: HashMap<_, _> = tasks
        .iter()
        .map(|task| (task.metadata.id, task.metadata.depends_on.clone()))
        .collect();
    for task in tasks {
        for target in task
            .metadata
            .depends_on
            .iter()
            .chain(&task.metadata.related_to)
        {
            if !known.contains(target) {
                diagnostics.push(Diagnostic {
                    severity: Severity::Error,
                    code: "unknown_relation_target".into(),
                    message: format!("Task relation target does not exist: {target}"),
                    path: Some(task.directory.clone()),
                    details: Some(json!({"task_id": task.metadata.id, "target_id": target})),
                });
            }
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
            .filter(|target| graph.contains_key(target))
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
        diagnostics.push(diagnostic(
            Severity::Error,
            "dependency_cycle",
            "Task dependencies contain a cycle",
            None,
        ));
    }
}

fn inspect_symlinks(root: &Path, diagnostics: &mut Vec<Diagnostic>) -> Result<()> {
    let mut pending = vec![root.to_path_buf()];
    while let Some(directory) = pending.pop() {
        for entry in fs::read_dir(&directory)
            .map_err(|error| storage_error("scan_task_symlinks", &directory, error))?
        {
            let entry =
                entry.map_err(|error| storage_error("scan_task_symlinks", &directory, error))?;
            let file_type = entry
                .file_type()
                .map_err(|error| storage_error("inspect_task_symlink", &entry.path(), error))?;
            if file_type.is_symlink() {
                diagnostics.push(diagnostic(
                    Severity::Error,
                    "symlink_in_task_root",
                    "Symlinks are not allowed in the managed Task tree",
                    Some(entry.path()),
                ));
            } else if file_type.is_dir() {
                pending.push(entry.path());
            }
        }
    }
    Ok(())
}

fn metadata_path(directory: &Path, mode: MetadataMode) -> PathBuf {
    match mode {
        MetadataMode::Split => directory.join("tk.toml"),
        MetadataMode::Embed => directory.join("TASK.md"),
    }
}

fn task_reference(task: &StoredTask) -> TaskReference {
    TaskReference {
        id: task.metadata.id,
        name: task.metadata.name.clone(),
        status: task.metadata.status,
        task_dir: task.directory.clone(),
    }
}

fn diagnostic(severity: Severity, code: &str, message: &str, path: Option<PathBuf>) -> Diagnostic {
    Diagnostic {
        severity,
        code: code.into(),
        message: message.into(),
        path,
        details: None,
    }
}

fn error_diagnostic(error: TkError, path: Option<PathBuf>) -> Diagnostic {
    let detail_path = error
        .details
        .as_ref()
        .and_then(|details| details.get("path"))
        .and_then(Value::as_str)
        .map(PathBuf::from);
    Diagnostic {
        severity: Severity::Error,
        code: error.code,
        message: error.message,
        path: path.or(detail_path),
        details: error.details,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_embedded_body_start() {
        assert_eq!(embedded_body_line("---\nid: x\n---\nbody\n"), Some(3));
        assert_eq!(embedded_body_line("body\n"), None);
    }

    #[test]
    fn required_io_failure_makes_check_incomplete_with_path() {
        let root =
            std::env::temp_dir().join(format!("tk-maintenance-test-{}", uuid::Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        crate::project::init(&root, crate::project::InitOptions::default()).unwrap();
        let project = crate::project::discover(&root).unwrap();
        let operation = project.task_root.join(".tk-tmp/incomplete");
        fs::create_dir_all(&operation).unwrap();
        let manifest = operation.join(crate::gc::MANIFEST_FILE);

        let result = check(&root);
        assert!(!result.complete);
        assert!(!result.ok);
        let diagnostic = result
            .diagnostics
            .iter()
            .find(|diagnostic| diagnostic.code == "read_cleanup_manifest_failed")
            .unwrap();
        assert_eq!(diagnostic.path.as_deref(), Some(manifest.as_path()));
        fs::remove_dir_all(root).unwrap();
    }

    fn split_metadata(schema_version: u32, id: Uuid, name: &str) -> String {
        format!(
            "schema_version = {schema_version}\nid = \"{id}\"\nname = \"{name}\"\nstatus = \"open\"\ncreated_at = \"2026-08-31T12:00:00+08:00\"\n"
        )
    }
    fn task_metadata(name: &str) -> crate::domain::Metadata {
        crate::domain::Metadata {
            schema_version: crate::version::TASK_SCHEMA_VERSION,
            id: Uuid::now_v7(),
            name: name.into(),
            status: crate::domain::Status::Open,
            created_at: chrono::DateTime::parse_from_rfc3339("2026-08-31T12:00:00+08:00").unwrap(),
            depends_on: Vec::new(),
            related_to: Vec::new(),
            extra: BTreeMap::new(),
        }
    }

    #[test]
    fn check_streams_wal_beyond_bounded_read_limits() {
        let root = std::env::temp_dir().join(format!("tk-check-wal-test-{}", Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        let project = crate::project::init(&root, crate::project::InitOptions::default())
            .unwrap()
            .project;
        let task = project.task_root.join("2026/08/31-01--wal-history");
        task_store::create_task_files(
            &task,
            &task_metadata("wal-history"),
            b"# wal-history\n",
            MetadataMode::Split,
        )
        .unwrap();
        let wal = task.join("wal");
        fs::create_dir(&wal).unwrap();
        let start = chrono::NaiveDate::from_ymd_opt(2020, 1, 1).unwrap();
        let mut total_bytes = 0;
        let first_path = wal.join(format!("{start}.md"));
        let fragment = format!("outside entry\n{}\n", "x".repeat(1024));
        total_bytes += fragment.len();
        fs::write(&first_path, fragment).unwrap();
        for offset in 1..=1024 {
            let date = start.checked_add_days(chrono::Days::new(offset)).unwrap();
            let text = format!(
                "## {date}T00:00:00+00:00 · test:writer\n\nmessage-{offset}\n\n{}\n",
                "x".repeat(1024)
            );
            total_bytes += text.len();
            fs::write(wal.join(format!("{date}.md")), text).unwrap();
        }
        assert!(total_bytes > 1024 * 1024);

        let result = check(&root);
        assert!(result.complete);
        assert!(result.ok, "{:?}", result.diagnostics);
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "wal_fragment"
                    && diagnostic.path.as_deref() == Some(first_path.as_path()))
        );
        assert!(
            result
                .diagnostics
                .iter()
                .all(|diagnostic| diagnostic.code != "wal_truncated")
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn cancellation_makes_wal_check_incomplete() {
        use std::sync::Arc;
        use std::sync::atomic::{AtomicBool, Ordering};

        let root = std::env::temp_dir().join(format!("tk-check-cancel-test-{}", Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        let project = crate::project::init(&root, crate::project::InitOptions::default())
            .unwrap()
            .project;
        let task = project.task_root.join("2026/08/31-01--cancelled");
        task_store::create_task_files(
            &task,
            &task_metadata("cancelled"),
            b"# cancelled\n",
            MetadataMode::Split,
        )
        .unwrap();
        wal::append(&task, "message", None, "test:writer").unwrap();
        let requested = Arc::new(AtomicBool::new(false));
        requested.store(true, Ordering::SeqCst);

        let result = crate::cancel::with_request(requested, || check(&root));
        assert!(!result.complete);
        assert!(!result.ok);
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "cancelled")
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn check_reports_malformed_split_carriers_without_becoming_incomplete() {
        let root = std::env::temp_dir().join(format!("tk-check-carrier-test-{}", Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        crate::project::init(&root, crate::project::InitOptions::default()).unwrap();
        let project = crate::project::discover(&root).unwrap();
        let fixtures = [
            ("2026/08/31-01--malformed", "not = [".to_owned()),
            (
                "2026/08/31-02--unsupported",
                split_metadata(999, Uuid::now_v7(), "unsupported"),
            ),
            (
                "2026/08/31-03--invalid-id",
                split_metadata(1, Uuid::new_v4(), "invalid-id"),
            ),
        ];
        for (directory, metadata) in fixtures {
            let directory = project.task_root.join(directory);
            fs::create_dir_all(&directory).unwrap();
            fs::write(directory.join("tk.toml"), metadata).unwrap();
            fs::write(directory.join("TASK.md"), "# broken\n").unwrap();
        }

        let result = check(&root);
        assert!(result.complete);
        assert!(!result.ok);
        let codes = result
            .diagnostics
            .iter()
            .map(|diagnostic| diagnostic.code.as_str())
            .collect::<Vec<_>>();
        assert!(codes.contains(&"invalid_task_metadata"));
        assert!(codes.contains(&"unsupported_schema_version"));
        assert!(codes.contains(&"invalid_task_id"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn check_reports_mixed_embed_carriers_without_becoming_incomplete() {
        let root = std::env::temp_dir().join(format!("tk-check-embed-test-{}", Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        crate::project::init(
            &root,
            crate::project::InitOptions {
                metadata_mode: Some(MetadataMode::Embed),
                ..crate::project::InitOptions::default()
            },
        )
        .unwrap();
        let project = crate::project::discover(&root).unwrap();
        let directory = project.task_root.join("2026/08/31-01--mixed");
        fs::create_dir_all(&directory).unwrap();
        fs::write(
            directory.join("TASK.md"),
            format!(
                "---\nschema_version: 1\nid: \"{}\"\nname: \"mixed\"\nstatus: \"open\"\ncreated_at: \"2026-08-31T12:00:00+08:00\"\n---\n# mixed\n",
                Uuid::now_v7()
            ),
        )
        .unwrap();
        fs::write(directory.join("tk.toml"), "unexpected = true\n").unwrap();

        let result = check(&root);
        assert!(result.complete);
        assert!(!result.ok);
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "metadata_mode_mismatch")
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn check_ignores_valid_looking_frontmatter_outside_canonical_task_paths() {
        let root = std::env::temp_dir().join(format!("tk-check-ordinary-test-{}", Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        let project = crate::project::init(
            &root,
            crate::project::InitOptions {
                metadata_mode: Some(MetadataMode::Embed),
                ..crate::project::InitOptions::default()
            },
        )
        .unwrap()
        .project;
        let directory = project.task_root.join("notes/archive");
        fs::create_dir_all(&directory).unwrap();
        fs::write(
            directory.join("TASK.md"),
            format!(
                "---\nschema_version: 1\nid: \"{}\"\nname: \"archive\"\nstatus: \"open\"\ncreated_at: \"2026-08-31T12:00:00+08:00\"\n---\nordinary material\n",
                Uuid::now_v7()
            ),
        )
        .unwrap();
        let result = check(&root);
        assert!(result.complete);
        assert!(result.ok, "{:?}", result.diagnostics);
        assert!(result.diagnostics.is_empty());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn check_reports_nested_invalid_carriers_and_logical_sequence_duplicates() {
        let root = std::env::temp_dir().join(format!("tk-check-nested-test-{}", Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        let project = crate::project::init(&root, crate::project::InitOptions::default())
            .unwrap()
            .project;
        let parent = project.task_root.join("2026/08/31-01--parent");
        task_store::create_task_files(
            &parent,
            &task_metadata("parent"),
            b"parent\n",
            MetadataMode::Split,
        )
        .unwrap();
        task_store::create_task_files(
            &parent.join("left/01--first"),
            &task_metadata("first"),
            b"first\n",
            MetadataMode::Split,
        )
        .unwrap();
        task_store::create_task_files(
            &parent.join("right/01--second"),
            &task_metadata("second"),
            b"second\n",
            MetadataMode::Split,
        )
        .unwrap();
        let malformed = parent.join("materials/broken");
        fs::create_dir_all(&malformed).unwrap();
        fs::write(malformed.join("tk.toml"), "schema_version = 1\n").unwrap();

        let result = check(&root);
        assert!(result.complete);
        assert!(!result.ok);
        let codes: Vec<_> = result
            .diagnostics
            .iter()
            .map(|diagnostic| diagnostic.code.as_str())
            .collect();
        assert!(codes.contains(&"duplicate_task_sequence"));
        assert!(codes.contains(&"missing_managed_file"));
        let duplicate = result
            .diagnostics
            .iter()
            .find(|diagnostic| diagnostic.code == "duplicate_task_sequence")
            .unwrap();
        assert_eq!(duplicate.path.as_deref(), Some(parent.as_path()));
        assert_eq!(duplicate.details.as_ref().unwrap()["parent"], json!(parent));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rename_keeps_non_generated_child_directory_in_place() {
        let root = std::env::temp_dir().join(format!("tk-rename-child-test-{}", Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        let project = crate::project::init(&root, crate::project::InitOptions::default())
            .unwrap()
            .project;
        let parent = project.task_root.join("2026/08/31-01--parent");
        task_store::create_task_files(
            &parent,
            &task_metadata("parent"),
            b"parent\n",
            MetadataMode::Split,
        )
        .unwrap();
        let imported = parent.join("materials/imported-task");
        let imported_metadata = task_metadata("imported");
        task_store::create_task_files(
            &imported,
            &imported_metadata,
            b"imported\n",
            MetadataMode::Split,
        )
        .unwrap();
        let generated = parent.join("children/01--generated");
        let generated_metadata = task_metadata("generated");
        task_store::create_task_files(
            &generated,
            &generated_metadata,
            b"generated\n",
            MetadataMode::Split,
        )
        .unwrap();

        let imported_result = rename(
            &project,
            &imported_metadata.id.to_string(),
            "renamed-import",
            false,
            false,
            "test:agent",
        )
        .unwrap();
        assert_eq!(imported_result.plan.old_path, imported);
        assert_eq!(imported_result.plan.target_path, imported);
        assert_eq!(imported_result.plan.parent_task, Some(parent.clone()));
        assert_eq!(
            task_store::read_task(&imported, MetadataMode::Split)
                .unwrap()
                .metadata
                .name,
            "renamed-import"
        );

        let generated_result = rename(
            &project,
            &generated_metadata.id.to_string(),
            "renamed-generated",
            false,
            false,
            "test:agent",
        )
        .unwrap();
        let generated_target = parent.join("children/01--renamed-generated");
        assert_eq!(generated_result.plan.target_path, generated_target);
        assert_eq!(generated_result.plan.parent_task, Some(parent.clone()));
        assert!(!generated.exists());
        assert_eq!(
            task_store::read_task(&generated_target, MetadataMode::Split)
                .unwrap()
                .metadata
                .name,
            "renamed-generated"
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn tracked_markdown_rejects_oversized_git_output() {
        use std::os::unix::fs::PermissionsExt;

        let root = std::env::temp_dir().join(format!("tk-git-scan-test-{}", Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        let project = crate::project::init(&root, crate::project::InitOptions::default())
            .unwrap()
            .project;
        let fake_git = root.join("git");
        fs::write(
            &fake_git,
            "#!/bin/sh\nwhile :; do printf xxxxxxxxxxxxxxxx; done\n",
        )
        .unwrap();
        fs::set_permissions(&fake_git, fs::Permissions::from_mode(0o755)).unwrap();
        let error = tracked_markdown_with(&project, &fake_git).unwrap_err();
        assert_eq!(error.code, "process_output_too_large");
        fs::remove_dir_all(root).unwrap();
    }

    fn rename_test_project(
        root: &Path,
        metadata_mode: MetadataMode,
        git_policy: GitPolicy,
    ) -> crate::project::Project {
        crate::project::init(
            root,
            crate::project::InitOptions {
                metadata_mode: Some(metadata_mode),
                git_policy: Some(git_policy),
                ..crate::project::InitOptions::default()
            },
        )
        .unwrap()
        .project
    }

    fn rename_task_directory(root: &Path, mode: MetadataMode) -> std::path::PathBuf {
        let directory = root.join(".tk/2026/08/31-01--source");
        task_store::create_task_files(&directory, &task_metadata("source"), b"source body\n", mode)
            .unwrap();
        directory
    }

    fn write_reference(root: &Path, relative: &str, content: &str) -> std::path::PathBuf {
        let path = root.join(relative);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, content).unwrap();
        path
    }

    #[test]
    fn path_moving_rename_with_references_requires_explicit_override() {
        for (mode, policy) in [
            (MetadataMode::Split, GitPolicy::None),
            (MetadataMode::Embed, GitPolicy::Track),
            (MetadataMode::Split, GitPolicy::Ignore),
        ] {
            let root = std::env::temp_dir().join(format!("tk-rename-gate-test-{}", Uuid::now_v7()));
            fs::create_dir(&root).unwrap();
            if policy != GitPolicy::None {
                let status = std::process::Command::new("git")
                    .args(["init", "--quiet"])
                    .current_dir(&root)
                    .status()
                    .unwrap();
                assert!(status.success());
                if policy == GitPolicy::Ignore {
                    fs::write(root.join(".gitignore"), ".tk\n").unwrap();
                }
            }
            let project = rename_test_project(&root, mode, policy);
            let directory = rename_task_directory(&root, mode);
            let references_expected: Vec<(&str, usize)> = if policy == GitPolicy::Track {
                write_reference(
                    &root,
                    "notes/links.md",
                    "intro line\nsee .tk/2026/08/31-01--source/README for detail\n",
                );
                write_reference(
                    &root,
                    "docs/other.md",
                    "also links .tk/2026/08/31-01--source/README here\n",
                );
                let status = std::process::Command::new("git")
                    .args(["add", "notes/links.md", "docs/other.md"])
                    .current_dir(&root)
                    .status()
                    .unwrap();
                assert!(status.success());
                vec![("notes/links.md", 2), ("docs/other.md", 1)]
            } else {
                write_reference(
                    &root,
                    ".tk/notes/links.md",
                    "intro line\nsee .tk/2026/08/31-01--source/README for detail\n",
                );
                write_reference(
                    &root,
                    ".tk/docs/other.md",
                    "also links .tk/2026/08/31-01--source/README here\n",
                );
                vec![(".tk/notes/links.md", 2), (".tk/docs/other.md", 1)]
            };
            let reference_contents: Vec<_> = references_expected
                .iter()
                .map(|(relative, _)| fs::read_to_string(root.join(relative)).unwrap())
                .collect();
            let body_before = task_store::read_body_bytes(&directory, mode).unwrap();
            let metadata_name_before = task_store::read_task(&directory, mode)
                .unwrap()
                .metadata
                .name;
            assert!(!directory.join("wal").exists());

            let dry = rename(
                &project,
                &directory.to_string_lossy(),
                "target",
                true,
                false,
                "test:agent",
            )
            .unwrap();
            assert!(dry.changed && !dry.committed);
            assert_eq!(dry.plan.references.len(), 2);
            assert!(directory.exists(), "dry-run must not move anything");

            let error = rename(
                &project,
                &directory.to_string_lossy(),
                "target",
                false,
                false,
                "test:agent",
            )
            .unwrap_err();
            assert_eq!(error.code, "broken_reference_conflict");
            assert!(matches!(error.category, ErrorCategory::Conflict));
            assert!(error.message.contains("31-01--target"));
            assert!(error.message.contains("--ignore-brokenlinks"));
            for (relative, line) in &references_expected {
                let listed = format!("{}/{relative}:{line}", root.display());
                assert!(error.message.contains(&listed), "message lists {listed}");
            }
            let details = error.details.as_ref().unwrap();
            assert_eq!(details["new_name"], "target");
            assert_eq!(
                details["target_path"],
                json!(root.join(".tk/2026/08/31-01--target"))
            );
            assert_eq!(details["old_path"], json!(directory));
            let listed_references = details["references"].as_array().unwrap();
            assert_eq!(listed_references.len(), 2);
            for (relative, line) in &references_expected {
                assert!(
                    listed_references.iter().any(|reference| {
                        reference["path"] == json!(root.join(relative))
                            && reference["line"] == *line
                    }),
                    "details list {relative}:{line}"
                );
            }
            assert!(directory.exists(), "gate must block before any write");
            assert!(!root.join(".tk/2026/08/31-01--target").exists());
            assert_eq!(
                task_store::read_task(&directory, mode)
                    .unwrap()
                    .metadata
                    .name,
                metadata_name_before
            );
            assert_eq!(
                task_store::read_body_bytes(&directory, mode).unwrap(),
                body_before
            );
            assert!(!directory.join("wal").exists());

            let overridden = rename(
                &project,
                &directory.to_string_lossy(),
                "target",
                false,
                true,
                "test:agent",
            )
            .unwrap();
            assert!(overridden.changed && overridden.committed);
            assert_eq!(overridden.plan.references.len(), 2);
            for (relative, content) in references_expected
                .iter()
                .map(|(relative, _)| *relative)
                .zip(&reference_contents)
            {
                let reference_path = root.join(relative);
                assert!(
                    reference_path.exists(),
                    "override must not rewrite reference files"
                );
                assert_eq!(
                    fs::read_to_string(&reference_path).unwrap(),
                    *content,
                    "reference content must stay unchanged"
                );
            }
            assert!(!directory.exists());
            fs::remove_dir_all(root).unwrap();
        }
    }

    #[test]
    fn rename_without_references_moves_the_path() {
        let root = std::env::temp_dir().join(format!("tk-rename-move-test-{}", Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        let project = rename_test_project(&root, MetadataMode::Split, GitPolicy::None);
        let directory = rename_task_directory(&root, MetadataMode::Split);

        let result = rename(
            &project,
            &directory.to_string_lossy(),
            "New Name!",
            false,
            false,
            "test:agent",
        )
        .unwrap();
        assert!(result.changed && result.committed);
        assert!(result.plan.references.is_empty());
        assert_eq!(result.plan.new_name, "New-Name");
        assert_eq!(
            result.plan.target_path,
            root.join(".tk/2026/08/31-01--New-Name")
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn non_generated_child_and_repeated_rename_skip_the_gate() {
        let root = std::env::temp_dir().join(format!("tk-rename-child-gate-{}", Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        let project = rename_test_project(&root, MetadataMode::Split, GitPolicy::None);
        let parent = project.task_root.join("2026/08/31-01--parent");
        task_store::create_task_files(
            &parent,
            &task_metadata("parent"),
            b"parent\n",
            MetadataMode::Split,
        )
        .unwrap();
        let imported = parent.join("materials/imported-task");
        let imported_metadata = task_metadata("imported");
        task_store::create_task_files(
            &imported,
            &imported_metadata,
            b"imported\n",
            MetadataMode::Split,
        )
        .unwrap();
        let old_relative = ".tk/2026/08/31-01--parent/materials/imported-task";
        write_reference(
            &root,
            ".tk/notes/child.md",
            &format!("points at {old_relative} from the task root\n"),
        );

        let first = rename(
            &project,
            &imported_metadata.id.to_string(),
            "renamed-import",
            false,
            false,
            "test:agent",
        )
        .unwrap();
        assert!(first.changed && first.committed);
        assert!(!first.plan.references.is_empty());
        assert_eq!(
            first.plan.references[0].path,
            root.join(".tk/notes/child.md")
        );
        assert_eq!(first.plan.target_path, imported);
        assert_eq!(
            task_store::read_task(&imported, MetadataMode::Split)
                .unwrap()
                .metadata
                .name,
            "renamed-import"
        );

        let repeat = rename(
            &project,
            &imported_metadata.id.to_string(),
            "renamed-import",
            false,
            false,
            "test:agent",
        )
        .unwrap();
        assert!(!repeat.changed && !repeat.committed);
        assert!(!repeat.plan.references.is_empty());
        assert_eq!(repeat.plan.target_path, imported);
        fs::remove_dir_all(root).unwrap();
    }
    fn damage_task_name(directory: &Path, mode: MetadataMode, old_name: &str) {
        let path = match mode {
            MetadataMode::Split => directory.join("tk.toml"),
            MetadataMode::Embed => directory.join("TASK.md"),
        };
        let text = fs::read_to_string(&path).unwrap();
        let needle = match mode {
            MetadataMode::Split => "name = \"source\"",
            MetadataMode::Embed => "name: \"source\"",
        };
        let replacement = match mode {
            MetadataMode::Split => format!("name = {}", serde_json::to_string(old_name).unwrap()),
            MetadataMode::Embed => format!("name: {}", serde_json::to_string(old_name).unwrap()),
        };
        assert!(text.contains(needle));
        fs::write(path, text.replacen(needle, &replacement, 1)).unwrap();
    }

    #[test]
    fn rename_repairs_invalid_names_in_split_and_embed() {
        for mode in [MetadataMode::Split, MetadataMode::Embed] {
            let old_names = [
                "source name".to_owned(),
                String::new(),
                "!!!".to_owned(),
                "a".repeat(33),
            ];
            for old_name in old_names {
                let root =
                    std::env::temp_dir().join(format!("tk-rename-repair-test-{}", Uuid::now_v7()));
                fs::create_dir(&root).unwrap();
                let project = rename_test_project(&root, mode, GitPolicy::None);
                let directory = rename_task_directory(&root, mode);
                damage_task_name(&directory, mode, &old_name);

                let result = rename(
                    &project,
                    &directory.to_string_lossy(),
                    "repaired",
                    false,
                    false,
                    "test:agent",
                )
                .unwrap();
                let target = project.task_root.join("2026/08/31-01--repaired");
                assert!(result.changed && result.committed);
                assert_eq!(result.plan.old_name, old_name);
                assert_eq!(
                    task_store::read_body_bytes(&target, mode).unwrap(),
                    b"source body\n"
                );
                assert_eq!(
                    task_store::read_task(&target, mode).unwrap().metadata.name,
                    "repaired"
                );
                fs::remove_dir_all(root).unwrap();
            }
        }
    }

    #[test]
    fn rename_repair_supports_exact_references_and_preserves_child_ownership() {
        let root = std::env::temp_dir().join(format!("tk-rename-parent-test-{}", Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        let project = rename_test_project(&root, MetadataMode::Embed, GitPolicy::None);
        let parent = rename_task_directory(&root, MetadataMode::Embed);
        let child = parent.join("children/01--child");
        let child_metadata = task_metadata("child");
        task_store::create_task_files(
            &child,
            &child_metadata,
            b"child body\n",
            MetadataMode::Embed,
        )
        .unwrap();
        let parent_id = task_store::read_task(&parent, MetadataMode::Embed)
            .unwrap()
            .metadata
            .id;
        damage_task_name(&parent, MetadataMode::Embed, "bad parent");

        for task_ref in [
            parent.to_string_lossy().into_owned(),
            parent.join("TASK.md").to_string_lossy().into_owned(),
            parent_id.to_string(),
        ] {
            let preview = rename(&project, &task_ref, "parent", true, false, "test:agent").unwrap();
            assert!(preview.changed && !preview.committed);
            assert_eq!(preview.plan.parent_task, None);
        }

        rename(
            &project,
            &parent_id.to_string(),
            "parent",
            false,
            false,
            "test:agent",
        )
        .unwrap();
        let target = project.task_root.join("2026/08/31-01--parent");
        let graph = task_store::discover_tasks(&project.task_root, MetadataMode::Embed).unwrap();
        let child_index = graph
            .task_index(&target.join("children/01--child"))
            .unwrap();
        let parent_index = graph.tasks[child_index].parent.unwrap();
        assert_eq!(graph.tasks[parent_index].task.metadata.id, parent_id);
        assert_eq!(graph.tasks[child_index].task.metadata.id, child_metadata.id);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rename_repair_rejects_duplicate_identity_and_other_metadata_damage() {
        let root = std::env::temp_dir().join(format!("tk-rename-invalid-test-{}", Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        let project = rename_test_project(&root, MetadataMode::Split, GitPolicy::None);
        let first = rename_task_directory(&root, MetadataMode::Split);
        let first_id = task_store::read_task(&first, MetadataMode::Split)
            .unwrap()
            .metadata
            .id;
        damage_task_name(&first, MetadataMode::Split, "bad name");

        let duplicate = project.task_root.join("2026/08/31-02--source");
        fs::create_dir_all(&duplicate).unwrap();
        fs::write(
            duplicate.join("tk.toml"),
            split_metadata(1, first_id, "other name"),
        )
        .unwrap();
        fs::write(duplicate.join("TASK.md"), "duplicate\n").unwrap();
        let error = rename(
            &project,
            &first.to_string_lossy(),
            "repaired",
            true,
            false,
            "test:agent",
        )
        .unwrap_err();
        assert_eq!(error.code, "duplicate_task_id");

        fs::remove_dir_all(&duplicate).unwrap();
        let carrier = first.join("tk.toml");
        let text = fs::read_to_string(&carrier).unwrap();
        fs::write(&carrier, format!("{text}depends_on = [\"{first_id}\"]\n")).unwrap();
        let error = rename(
            &project,
            &first.to_string_lossy(),
            "repaired",
            true,
            false,
            "test:agent",
        )
        .unwrap_err();
        assert_eq!(error.code, "self_relation");
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn rename_repairs_path_only_and_keeps_non_generated_child_path() {
        let root = std::env::temp_dir().join(format!("tk-rename-path-test-{}", Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        let project = rename_test_project(&root, MetadataMode::Split, GitPolicy::None);
        let wrong_path = project.task_root.join("2026/08/31-01--wrong");
        let parent_metadata = task_metadata("source");
        task_store::create_task_files(
            &wrong_path,
            &parent_metadata,
            b"parent body\n",
            MetadataMode::Split,
        )
        .unwrap();

        let path_repair = rename(
            &project,
            &parent_metadata.id.to_string(),
            "source",
            false,
            false,
            "test:agent",
        )
        .unwrap();
        let parent = project.task_root.join("2026/08/31-01--source");
        assert!(path_repair.changed && path_repair.committed);
        assert!(!wrong_path.exists());

        let imported = parent.join("materials/imported-task");
        task_store::create_task_files(
            &imported,
            &task_metadata("source"),
            b"imported body\n",
            MetadataMode::Split,
        )
        .unwrap();
        damage_task_name(&imported, MetadataMode::Split, "bad imported name");
        let repaired = rename(
            &project,
            &imported.to_string_lossy(),
            "imported",
            false,
            false,
            "test:agent",
        )
        .unwrap();
        assert_eq!(repaired.plan.target_path, imported);
        assert!(imported.exists());
        assert_eq!(
            task_store::read_task(&imported, MetadataMode::Split)
                .unwrap()
                .metadata
                .name,
            "imported"
        );
        fs::remove_dir_all(root).unwrap();
    }
}
