use std::collections::{BTreeMap, HashMap, HashSet};
use std::ffi::OsString;
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
    actor: &str,
) -> Result<RenameResult> {
    let task = crate::app::resolve_ref(project, task_ref)?;
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

    project::ensure_mutable(project)?;
    let operation = crate::gc::begin_project_operation(&project.task_root)?;
    let (metadata, warnings, _completed) = operation.execute(
        |_operation| {
            let current = crate::app::resolve_ref(project, &task.metadata.id.to_string())?;
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
            if let Err(error) = task_store::replace_metadata(
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

fn build_rename_plan(
    project: &Project,
    task: &StoredTask,
    requested_name: &str,
) -> Result<RenamePlan> {
    let new_name = normalize_name(requested_name)?;
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
                "Task directory lacks a sequence separator: {}",
                task.directory.display()
            ),
        )
    })?;
    let target_path = task
        .directory
        .parent()
        .expect("managed Task has a parent")
        .join(format!("{prefix}--{new_name}"));
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
    let mut references = Vec::new();
    for path in paths {
        scan_markdown_file(project, &path, &needle, &mut references)?;
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
    references: &mut Vec<MarkdownReference>,
) -> Result<()> {
    let text = fs::read_to_string(path)
        .map_err(|error| storage_error("read_markdown_reference", path, error))?;
    let body_start = if project.config.metadata_mode == MetadataMode::Embed
        && path.file_name().and_then(|value| value.to_str()) == Some("TASK.md")
        && path.parent().is_some_and(|directory| {
            task_store::read_canonical_task(
                &project.task_root,
                &project.config.subtasks_dir,
                directory,
                MetadataMode::Embed,
            )
            .is_ok()
        }) {
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

    let candidates =
        task_store::scan_structural_candidates(&project.task_root, &project.config.subtasks_dir)?;
    let mut tasks = Vec::with_capacity(candidates.len());
    let mut ids: HashMap<Uuid, Vec<PathBuf>> = HashMap::new();
    let mut sequences: BTreeMap<(PathBuf, String), Vec<PathBuf>> = BTreeMap::new();
    for directory in candidates {
        let Some(slug) = task_store::canonical_task_slug(
            &project.task_root,
            &project.config.subtasks_dir,
            &directory,
        ) else {
            diagnostics.push(diagnostic(
                Severity::Error,
                "invalid_task_directory",
                "Managed Task carriers are not stored at a canonical Task path",
                Some(directory),
            ));
            continue;
        };
        let task = match task_store::read_task(&directory, project.config.metadata_mode) {
            Ok(task) => task,
            Err(error)
                if !matches!(
                    error.category,
                    ErrorCategory::Storage
                        | ErrorCategory::Environment
                        | ErrorCategory::Internal
                        | ErrorCategory::Cancelled
                ) =>
            {
                diagnostics.push(error_diagnostic(error, Some(directory)));
                continue;
            }
            Err(error) => return Err(error),
        };
        ids.entry(task.metadata.id)
            .or_default()
            .push(directory.clone());
        let (sequence, _) = directory
            .file_name()
            .and_then(|name| name.to_str())
            .and_then(|name| name.split_once("--"))
            .expect("canonical Task names contain the sequence separator");
        sequences
            .entry((
                directory
                    .parent()
                    .unwrap_or(&project.task_root)
                    .to_path_buf(),
                sequence.into(),
            ))
            .or_default()
            .push(directory.clone());
        if slug != task.metadata.name {
            diagnostics.push(diagnostic(
                Severity::Error,
                "task_name_path_mismatch",
                "Task metadata name does not match its directory suffix",
                Some(directory.clone()),
            ));
        }
        let wal_read = wal::read(&directory, usize::MAX, usize::MAX)?;
        for warning in wal_read.warnings {
            diagnostics.push(Diagnostic {
                severity: Severity::Warning,
                code: warning.code,
                message: warning.message,
                path: Some(warning.path),
                details: None,
            });
        }
        if wal_read.truncated {
            diagnostics.push(diagnostic(
                Severity::Warning,
                "wal_truncated",
                "WAL inspection reached its bounded read limit",
                Some(directory.join("wal")),
            ));
        }
        tasks.push(task);
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
    for ((_, sequence), paths) in sequences.into_iter().filter(|(_, paths)| paths.len() > 1) {
        diagnostics.push(Diagnostic {
            severity: Severity::Error,
            code: "duplicate_task_sequence".into(),
            message: format!("Task sequence {sequence} is reused under one parent"),
            path: None,
            details: Some(json!({"paths": paths})),
        });
    }
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
    Diagnostic {
        severity: Severity::Error,
        code: error.code,
        message: error.message,
        path,
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
    fn cleanup_marker_read_failure_aborts_check() {
        let root =
            std::env::temp_dir().join(format!("tk-maintenance-test-{}", uuid::Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        crate::project::init(&root, crate::project::InitOptions::default()).unwrap();
        let project = crate::project::discover(&root).unwrap();
        fs::create_dir_all(project.task_root.join(".tk-tmp/incomplete")).unwrap();
        let error = inspect_cleanup_markers(&project, &mut Vec::new()).unwrap_err();
        assert_eq!(error.code, "read_cleanup_manifest_failed");
        fs::remove_dir_all(root).unwrap();
    }

    fn split_metadata(schema_version: u32, id: Uuid, name: &str) -> String {
        format!(
            "schema_version = {schema_version}\nid = \"{id}\"\nname = \"{name}\"\nstatus = \"open\"\ncreated_at = \"2026-08-31T12:00:00+08:00\"\n"
        )
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
}
