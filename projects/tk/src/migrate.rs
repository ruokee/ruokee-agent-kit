use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::json;
use uuid::Uuid;

use crate::error::{ErrorCategory, Result, TkError};
use crate::path::{atomic_write, storage_error};
use crate::project::{MetadataMode, Project};
use crate::reports::{FileSummary, PlanReport, Step};
use crate::task_store;
use crate::version::TASK_SCHEMA_VERSION;

#[derive(Serialize)]
struct FileMigration {
    task_id: Uuid,
    pub path: PathBuf,
    pub source_version: u32,
    pub target_version: u32,
    pub conversions: Vec<String>,
    pub changed: bool,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum FileState {
    Planned,
    Committed,
    Uncommitted,
    Unknown,
}

#[derive(Serialize)]
struct SchemaPlan<'a> {
    requested_target: &'a str,
    target_version: Option<u32>,
    selected_files: Vec<PathBuf>,
    files: Vec<PlannedFile>,
}

#[derive(Serialize)]
struct PlannedFile {
    #[serde(flatten)]
    report: FileMigration,
    #[serde(skip)]
    state: FileState,
    #[serde(skip)]
    committed: bool,
    #[serde(skip)]
    source: Vec<u8>,
    #[serde(skip)]
    output: Vec<u8>,
}

#[derive(Serialize)]
struct FileExecution<'a> {
    #[serde(flatten)]
    file: &'a FileMigration,
    state: FileState,
    committed: bool,
}

pub fn schema(
    project: &Project,
    target: &str,
    selected: &[PathBuf],
    dry_run: bool,
) -> Result<FileSummary> {
    let mut report = PlanReport::new(
        project,
        "migrate-metadata",
        dry_run,
        SchemaPlan {
            requested_target: target,
            target_version: None,
            selected_files: selected
                .iter()
                .map(|path| {
                    if path.is_absolute() {
                        path.clone()
                    } else {
                        project.root.join(path)
                    }
                })
                .collect(),
            files: Vec::new(),
        },
    );
    let planning = (|| {
        let target_version = parse_target(target)?;
        report.plan.target_version = Some(target_version);
        let carriers = select_carriers(project, &report.plan.selected_files)?;
        report.plan.files.reserve(carriers.len());
        for (task_id, path) in carriers {
            report
                .plan
                .files
                .push(plan_file(project, task_id, path, target_version)?);
        }
        Ok(())
    })();
    let config = || {
        json!({"before": project.config.metadata_mode,
        "after": project.config.metadata_mode, "changed": false})
    };
    report.save_planning(planning, config())?;
    let planned_files = report
        .plan
        .files
        .iter()
        .filter(|plan| plan.report.changed)
        .count();
    let changed = planned_files != 0;
    if dry_run || !changed {
        return Ok(report
            .run
            .summary(planned_files, planned_files, false, changed));
    }

    let changed_indices: Vec<_> = report
        .plan
        .files
        .iter()
        .enumerate()
        .filter_map(|(index, plan)| plan.report.changed.then_some(index))
        .collect();
    let mut completed = 0;
    let execution = (|| {
        crate::project::ensure_mutable(project)?;
        let operation = crate::gc::begin_project_operation(&project.task_root)?;
        operation.execute(
            |_operation| {
                for &index in &changed_indices {
                    crate::cancel::checkpoint()?;
                    let plan = &report.plan.files[index];
                    let path = &plan.report.path;
                    let observed = fs::read(path)
                        .map_err(|error| storage_error("read_migration_file", path, error))?;
                    if observed != plan.source {
                        return Err(TkError::new(
                            "changed_since_plan",
                            ErrorCategory::Conflict,
                            format!("Migration source changed: {}", path.display()),
                        ));
                    }
                    if let Err(error) = atomic_write(path, &plan.output) {
                        report.plan.files[index].state = FileState::Unknown;
                        return Err(error);
                    }
                    report.plan.files[index].state = FileState::Committed;
                    report.plan.files[index].committed = true;
                    completed += 1;
                }
                Ok(())
            },
            |_, cleanup_path, error| {
                TkError::partial_commit(
                    "Schema migration committed but cleanup failed",
                    json!([]),
                    json!([Step::new("cleanup_operation", &cleanup_path)]),
                    error,
                )
            },
        )
    })();
    if let Err(error) = execution {
        for &index in &changed_indices[completed..] {
            if matches!(report.plan.files[index].state, FileState::Planned) {
                report.plan.files[index].state = FileState::Uncommitted;
            }
        }
        let steps: Vec<_> = changed_indices
            .iter()
            .map(|&index| Step::new("rewrite_file", &report.plan.files[index].report.path))
            .collect();
        let mut error = report
            .run
            .execution_error(error, &steps, completed, config());
        let files: Vec<_> = report
            .plan
            .files
            .iter()
            .map(|plan| FileExecution {
                file: &plan.report,
                state: plan.state,
                committed: plan.committed,
            })
            .collect();
        error
            .details
            .as_mut()
            .expect("execution error details")
            .as_object_mut()
            .expect("execution error object")
            .insert("files".into(), json!(files));
        return Err(error);
    }
    Ok(report
        .run
        .summary(planned_files, planned_files, false, changed))
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

fn select_carriers(project: &Project, selected: &[PathBuf]) -> Result<Vec<(Uuid, PathBuf)>> {
    let graph = task_store::discover_tasks(
        &project.task_root,
        project.config.metadata_mode,
        project.config.task_layout,
    )?;
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
        let task_index = path
            .parent()
            .and_then(|directory| graph.task_index(directory));
        if !path.starts_with(&root)
            || task_index.is_none()
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
            result.push((
                graph.tasks[task_index.expect("validated carrier")]
                    .task
                    .metadata
                    .id,
                path,
            ));
        }
    }
    result.sort_by(|left, right| left.1.cmp(&right.1));
    Ok(result)
}

fn plan_file(project: &Project, task_id: Uuid, path: PathBuf, target: u32) -> Result<PlannedFile> {
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
            task_id,
            path,
            source_version,
            target_version: target,
            conversions,
            changed,
        },
        committed: false,
        state: if changed {
            FileState::Planned
        } else {
            FileState::Uncommitted
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
