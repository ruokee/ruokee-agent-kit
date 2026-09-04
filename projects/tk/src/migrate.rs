use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::json;

use crate::error::{ErrorCategory, Result, TkError};
use crate::path::{atomic_write, storage_error};
use crate::project::{MetadataMode, Project};
use crate::task_store;
use crate::version::TASK_SCHEMA_VERSION;

#[derive(Debug, Clone, Serialize)]
pub struct FileMigration {
    pub path: PathBuf,
    pub source_version: u32,
    pub target_version: u32,
    pub conversions: Vec<String>,
    pub changed: bool,
    pub committed: bool,
    pub state: FileState,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum FileState {
    Planned,
    Committed,
    Uncommitted,
    Unknown,
}

#[derive(Debug, Serialize)]
pub struct MigrationResult {
    pub kind: &'static str,
    pub source: &'static str,
    pub target: String,
    pub affected_tasks: usize,
    pub changed: bool,
    pub committed: bool,
    pub partial: bool,
    pub dry_run: bool,
    pub files: Vec<FileMigration>,
}

struct PlannedFile {
    report: FileMigration,
    source: Vec<u8>,
    output: Vec<u8>,
}

pub fn schema(
    project: &Project,
    target: &str,
    selected: &[PathBuf],
    dry_run: bool,
) -> Result<MigrationResult> {
    let target_version = parse_target(target)?;
    let paths = select_carriers(project, selected)?;
    let mut plans = Vec::with_capacity(paths.len());
    for path in paths {
        plans.push(plan_file(project, path, target_version)?);
    }

    let changed = plans.iter().any(|plan| plan.report.changed);
    if dry_run || !changed {
        return Ok(result(target_version, dry_run, false, plans));
    }

    crate::project::ensure_mutable(project)?;
    let operation = crate::gc::begin_project_operation(&project.task_root)?;
    operation.execute(
        |_operation| {
            let changed_indices: Vec<usize> = plans
                .iter()
                .enumerate()
                .filter_map(|(index, plan)| plan.report.changed.then_some(index))
                .collect();
            for (position, index) in changed_indices.iter().copied().enumerate() {
                if let Err(error) = crate::cancel::checkpoint() {
                    if position == 0 {
                        return Err(error);
                    }
                    return Err(migration_failure(
                        error,
                        "Schema migration was cancelled after committing some files",
                        &plans,
                        position,
                        &changed_indices,
                    ));
                }
                let path = plans[index].report.path.clone();
                let observed = match fs::read(&path) {
                    Ok(observed) => observed,
                    Err(error) => {
                        return Err(migration_failure(
                            storage_error("read_migration_file", &path, error),
                            "Schema migration could not re-read a file after committing earlier files",
                            &plans,
                            position,
                            &changed_indices,
                        ));
                    }
                };
                if observed != plans[index].source {
                    mark_uncompleted(&mut plans, &changed_indices[position..]);
                    return Err(migration_failure(
                        TkError::new(
                            "changed_since_plan",
                            ErrorCategory::Conflict,
                            format!("Migration source changed: {}", path.display()),
                        ),
                        "Schema migration source changed after committing some files",
                        &plans,
                        position,
                        &changed_indices,
                    ));
                }
                if let Err(error) = atomic_write(&path, &plans[index].output) {
                    plans[index].report.state = FileState::Unknown;
                    mark_uncompleted(&mut plans, &changed_indices[position + 1..]);
                    return Err(migration_failure(
                        error,
                        "Schema migration stopped after committing some files",
                        &plans,
                        position,
                        &changed_indices,
                    ));
                }
                plans[index].report.committed = true;
                plans[index].report.state = FileState::Committed;
            }
            Ok(changed_indices
                .iter()
                .map(|index| plans[*index].report.path.clone())
                .collect::<Vec<_>>())
        },
        |completed, cleanup_path, error| {
            TkError::partial_commit(
                "Schema migration committed but cleanup failed",
                json!(completed),
                json!([cleanup_path]),
                error,
            )
        },
    )?;
    Ok(result(target_version, false, true, plans))
}

fn result(
    target_version: u32,
    dry_run: bool,
    committed: bool,
    plans: Vec<PlannedFile>,
) -> MigrationResult {
    let changed_count = plans.iter().filter(|plan| plan.report.changed).count();
    MigrationResult {
        kind: "schema",
        source: "mixed",
        target: target_version.to_string(),
        affected_tasks: changed_count,
        changed: changed_count != 0,
        committed: committed && changed_count != 0,
        partial: false,
        dry_run,
        files: plans.into_iter().map(|plan| plan.report).collect(),
    }
}

fn parse_target(target: &str) -> Result<u32> {
    let version = if target == "latest" {
        TASK_SCHEMA_VERSION
    } else {
        target.parse::<u32>().map_err(|_| {
            TkError::request(
                "invalid_request",
                "--to must be a positive schema integer or latest",
            )
        })?
    };
    if version == 0 || version > TASK_SCHEMA_VERSION {
        return Err(TkError::request(
            "invalid_request",
            format!("Cannot migrate to unsupported schema {version}"),
        ));
    }
    Ok(version)
}

fn select_carriers(project: &Project, selected: &[PathBuf]) -> Result<Vec<PathBuf>> {
    let graph = task_store::discover_tasks(&project.task_root, project.config.metadata_mode)?;
    let candidates = if selected.is_empty() {
        graph
            .tasks
            .iter()
            .map(|task| carrier(&task.task.directory, project.config.metadata_mode))
            .collect()
    } else {
        selected
            .iter()
            .map(|path| {
                let path = if path.is_absolute() {
                    path.clone()
                } else {
                    project.root.join(path)
                };
                crate::project::ensure_safe_project_path(&project.root, &path)?;
                path.canonicalize()
                    .map_err(|error| storage_error("resolve_migration_file", &path, error))
            })
            .collect::<Result<Vec<_>>>()?
    };

    let root = project
        .task_root
        .canonicalize()
        .map_err(|error| storage_error("resolve_task_root", &project.task_root, error))?;
    let expected = match project.config.metadata_mode {
        MetadataMode::Split => "tk.toml",
        MetadataMode::Embed => "TASK.md",
    };
    let mut seen = HashSet::new();
    let mut result = Vec::new();
    for path in candidates {
        let discovered_directory = path
            .parent()
            .is_some_and(|directory| graph.task_index(directory).is_some());
        if !path.starts_with(&root)
            || !discovered_directory
            || path.file_name().and_then(|name| name.to_str()) != Some(expected)
            || fs::symlink_metadata(&path).is_ok_and(|metadata| !metadata.file_type().is_file())
        {
            return Err(TkError::request(
                "invalid_request",
                format!(
                    "Not a discovered metadata carrier in this project: {}",
                    path.display()
                ),
            ));
        }
        if seen.insert(path.clone()) {
            result.push(path);
        }
    }
    result.sort();
    Ok(result)
}

fn plan_file(project: &Project, path: PathBuf, target: u32) -> Result<PlannedFile> {
    let source =
        fs::read(&path).map_err(|error| storage_error("read_migration_file", &path, error))?;
    let source_version = read_schema_version(project, &path, &source)?;
    if source_version > target {
        return Err(TkError::request(
            "invalid_request",
            format!("Schema downgrade from {source_version} to {target} is not supported"),
        ));
    }
    let (output, conversions) = migrate_forward(&path, source_version, target, &source)?;
    let changed = source_version != target;
    Ok(PlannedFile {
        source,
        output,
        report: FileMigration {
            path,
            source_version,
            target_version: target,
            conversions,
            changed,
            committed: false,
            state: if changed {
                FileState::Planned
            } else {
                FileState::Uncommitted
            },
        },
    })
}

fn read_schema_version(project: &Project, path: &Path, bytes: &[u8]) -> Result<u32> {
    match project.config.metadata_mode {
        MetadataMode::Split => {
            let text = std::str::from_utf8(bytes).map_err(|error| {
                TkError::new(
                    "invalid_managed_file",
                    ErrorCategory::ManagedFile,
                    error.to_string(),
                )
            })?;
            let value: toml::Value = toml::from_str(text).map_err(|error| {
                TkError::new(
                    "invalid_managed_file",
                    ErrorCategory::ManagedFile,
                    format!("{}: {error}", path.display()),
                )
            })?;
            value
                .get("schema_version")
                .and_then(toml::Value::as_integer)
                .and_then(|value| u32::try_from(value).ok())
                .ok_or_else(|| {
                    TkError::new(
                        "unsupported_schema",
                        ErrorCategory::ManagedFile,
                        format!("{} has no supported schema_version", path.display()),
                    )
                })
        }
        MetadataMode::Embed => {
            let directory = path.parent().expect("metadata carrier has parent");
            Ok(task_store::read_task(directory, MetadataMode::Embed)?
                .metadata
                .schema_version)
        }
    }
}

fn migrate_forward(
    path: &Path,
    version: u32,
    target: u32,
    source: &[u8],
) -> Result<(Vec<u8>, Vec<String>)> {
    if version < target {
        return Err(TkError::new(
            "unsupported_schema",
            ErrorCategory::ManagedFile,
            format!(
                "No published conversion from schema {version} for {}",
                path.display()
            ),
        ));
    }
    Ok((source.to_vec(), Vec::new()))
}

fn carrier(directory: &Path, mode: MetadataMode) -> PathBuf {
    match mode {
        MetadataMode::Split => directory.join("tk.toml"),
        MetadataMode::Embed => directory.join("TASK.md"),
    }
}

fn mark_uncompleted(plans: &mut [PlannedFile], indices: &[usize]) {
    for index in indices {
        plans[*index].report.state = FileState::Uncommitted;
    }
}

fn migration_failure(
    error: TkError,
    message: &str,
    plans: &[PlannedFile],
    failed_position: usize,
    changed_indices: &[usize],
) -> TkError {
    if failed_position == 0 {
        return error;
    }
    let completed: Vec<_> = changed_indices[..failed_position]
        .iter()
        .map(|index| &plans[*index].report.path)
        .collect();
    let uncompleted: Vec<_> = changed_indices[failed_position..]
        .iter()
        .map(|index| &plans[*index].report.path)
        .collect();
    TkError::partial_commit(message, json!(completed), json!(uncompleted), error)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_schema_zero() {
        assert!(parse_target("0").is_err());
    }

    #[test]
    fn accepts_current_schema() {
        assert_eq!(parse_target("latest").unwrap(), 1);
        assert_eq!(parse_target("1").unwrap(), 1);
    }
}
