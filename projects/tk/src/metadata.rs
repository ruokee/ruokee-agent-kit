use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::json;
use uuid::Uuid;

use crate::error::{ErrorCategory, Result, TkError};
use crate::path::storage_error;
use crate::project::{self, MetadataMode, Project};
use crate::reports::{FileSummary, PlanReport, Step};
use crate::task_store;

#[derive(Serialize)]
struct FileChange {
    action: &'static str,
    path: PathBuf,
}

#[derive(Serialize)]
struct ConfigChange<'a> {
    path: &'a Path,
    key: &'static str,
    before: MetadataMode,
    after: MetadataMode,
}

#[derive(Serialize)]
struct SwitchPlan<'a> {
    source: MetadataMode,
    target: MetadataMode,
    tasks: Vec<PlannedTask>,
    config_change: Option<ConfigChange<'a>>,
}

#[derive(Serialize)]
struct PlannedTask {
    task_id: Uuid,
    #[serde(rename = "task_dir")]
    directory: PathBuf,
    file_changes: [FileChange; 2],
    #[serde(skip)]
    source_metadata: Vec<u8>,
    #[serde(skip)]
    source_body: Option<Vec<u8>>,
    #[serde(skip)]
    target_metadata: Vec<u8>,
    #[serde(skip)]
    target_body: Option<Vec<u8>>,
    #[serde(skip)]
    staged_metadata: Option<PathBuf>,
    #[serde(skip)]
    staged_body: Option<PathBuf>,
}

pub fn switch(project: &Project, target: MetadataMode, dry_run: bool) -> Result<FileSummary> {
    let source = project.config.metadata_mode;
    let changed = source != target;
    let mut report = PlanReport::new(
        project,
        "switch-metadata",
        dry_run,
        SwitchPlan {
            source,
            target,
            tasks: Vec::new(),
            config_change: changed.then_some(ConfigChange {
                path: &project.config_path,
                key: "metadata_mode",
                before: source,
                after: target,
            }),
        },
    );
    let planning = if changed {
        build_plan(project, target, &mut report.plan.tasks)
    } else {
        Ok(())
    };
    report.save_planning(
        planning,
        json!({"before": source, "after": source, "changed": false}),
    )?;
    let affected_tasks = report.plan.tasks.len();
    let planned_files = affected_tasks * 2;
    if dry_run || !changed {
        return Ok(report
            .run
            .summary(affected_tasks, planned_files, false, changed));
    }

    let mut completed = 0;
    let mut config_changed = false;
    let execution = (|| {
        project::ensure_mutable(project)?;
        if report.plan.tasks.is_empty() {
            project::set_metadata_mode(project, target)?;
            config_changed = true;
            completed += 1;
            return Ok(());
        }
        let operation = crate::gc::begin_project_operation(&project.task_root)?;
        operation.execute(
            |operation| {
                stage_all(operation, &mut report.plan.tasks)?;
                for plan in &report.plan.tasks {
                    crate::cancel::checkpoint()?;
                    commit_task(source, target, plan, &mut completed)?;
                }
                crate::cancel::checkpoint()?;
                project::set_metadata_mode(project, target)?;
                config_changed = true;
                completed += 1;
                Ok(())
            },
            |_, cleanup_path, error| {
                TkError::partial_commit(
                    "Metadata representation switch committed but cleanup failed",
                    json!([]),
                    json!([Step::new("cleanup_operation", &cleanup_path)]),
                    error,
                )
            },
        )
    })();
    if let Err(error) = execution {
        let steps: Vec<_> = report
            .plan
            .tasks
            .iter()
            .flat_map(|task| task.file_changes.iter())
            .map(|change| {
                Step::new(
                    match change.action {
                        "create" => "create_file",
                        "rewrite" => "rewrite_file",
                        "delete" => "delete_file",
                        _ => unreachable!("file change action"),
                    },
                    &change.path,
                )
            })
            .chain(std::iter::once(Step::new(
                "write_config",
                &project.config_path,
            )))
            .collect();
        return Err(report.run.execution_error(
            error,
            &steps,
            completed,
            json!({"before": source, "after": if config_changed { target } else { source },
                "changed": config_changed}),
        ));
    }
    Ok(report
        .run
        .summary(affected_tasks, planned_files, config_changed, changed))
}

fn build_plan(project: &Project, target: MetadataMode, plans: &mut Vec<PlannedTask>) -> Result<()> {
    let tasks = task_store::discover_tasks(
        &project.task_root,
        project.config.metadata_mode,
        project.config.task_layout,
    )?
    .into_tasks();
    let mut ids = HashSet::new();
    for task in tasks {
        let directory = task.directory;
        if !ids.insert(task.metadata.id) {
            return Err(TkError::new(
                "duplicate_task_id",
                ErrorCategory::Invariant,
                format!("Duplicate Task ID: {}", task.metadata.id),
            ));
        }
        let relative = directory.strip_prefix(&project.task_root).map_err(|_| {
            TkError::new(
                "task_outside_root",
                ErrorCategory::ManagedFile,
                "Task candidate is outside the configured root",
            )
        })?;
        path_text(relative)?;
        let body = task_store::read_body_bytes(&directory, project.config.metadata_mode)?;
        let source_metadata_path = metadata_path(&directory, project.config.metadata_mode);
        let source_metadata = fs::read(&source_metadata_path).map_err(|error| {
            storage_error("read_metadata_switch_source", &source_metadata_path, error)
        })?;
        let (source_body, target_metadata, target_body) = match target {
            MetadataMode::Embed => (
                Some(body.clone()),
                task_store::encode_embed_document(&task.metadata, &body)?,
                None,
            ),
            MetadataMode::Split => (
                None,
                task_store::encode_split_document(&task.metadata)?,
                Some(body),
            ),
        };
        let file_changes = match target {
            MetadataMode::Embed => [
                FileChange {
                    action: "rewrite",
                    path: directory.join("TASK.md"),
                },
                FileChange {
                    action: "delete",
                    path: directory.join("tk.toml"),
                },
            ],
            MetadataMode::Split => [
                FileChange {
                    action: "create",
                    path: directory.join("tk.toml"),
                },
                FileChange {
                    action: "rewrite",
                    path: directory.join("TASK.md"),
                },
            ],
        };
        plans.push(PlannedTask {
            task_id: task.metadata.id,
            file_changes,
            directory,
            source_metadata,
            source_body,
            target_metadata,
            target_body,
            staged_metadata: None,
            staged_body: None,
        });
    }
    plans.sort_by(|left, right| left.directory.cmp(&right.directory));
    Ok(())
}

fn stage_all(operation: &mut crate::gc::CleanupOperation, plans: &mut [PlannedTask]) -> Result<()> {
    for (index, plan) in plans.iter_mut().enumerate() {
        let metadata_path = operation.temporary_path(&format!("{index:06}-metadata"))?;
        write_staged(&metadata_path, &plan.target_metadata)?;
        plan.staged_metadata = Some(metadata_path);
        if let Some(body) = &plan.target_body {
            let body_path = operation.temporary_path(&format!("{index:06}-body"))?;
            write_staged(&body_path, body)?;
            plan.staged_body = Some(body_path);
        }
    }
    Ok(())
}

fn write_staged(path: &Path, bytes: &[u8]) -> Result<()> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|error| storage_error("create_metadata_switch_stage", path, error))?;
    file.write_all(bytes)
        .map_err(|error| storage_error("write_metadata_switch_stage", path, error))?;
    file.sync_all()
        .map_err(|error| storage_error("sync_metadata_switch_stage", path, error))
}

fn commit_task(
    source: MetadataMode,
    target: MetadataMode,
    plan: &PlannedTask,
    completed: &mut usize,
) -> Result<()> {
    verify_source(source, plan)?;
    let staged_metadata = plan
        .staged_metadata
        .as_deref()
        .expect("metadata payload was staged");
    match target {
        MetadataMode::Embed => {
            let task_path = &plan.file_changes[0].path;
            fs::rename(staged_metadata, task_path)
                .map_err(|error| storage_error("commit_embed_metadata", task_path, error))?;
            *completed += 1;
            let split_path = &plan.file_changes[1].path;
            fs::remove_file(split_path)
                .map_err(|error| storage_error("remove_split_metadata", split_path, error))?;
            *completed += 1;
            Ok(())
        }
        MetadataMode::Split => {
            let split_path = &plan.file_changes[0].path;
            fs::rename(staged_metadata, split_path)
                .map_err(|error| storage_error("commit_split_metadata", split_path, error))?;
            *completed += 1;
            let staged_body = plan
                .staged_body
                .as_deref()
                .expect("body payload was staged");
            let task_path = &plan.file_changes[1].path;
            fs::rename(staged_body, task_path)
                .map_err(|error| storage_error("commit_split_body", task_path, error))?;
            *completed += 1;
            Ok(())
        }
    }
}

fn verify_source(source: MetadataMode, plan: &PlannedTask) -> Result<()> {
    let metadata_path = metadata_path(&plan.directory, source);
    let observed = fs::read(&metadata_path)
        .map_err(|error| storage_error("read_metadata_switch_source", &metadata_path, error))?;
    if observed != plan.source_metadata {
        return Err(TkError::new(
            "changed_since_plan",
            ErrorCategory::Conflict,
            format!("Metadata source changed: {}", metadata_path.display()),
        ));
    }
    if let Some(expected_body) = &plan.source_body {
        let body_path = plan.directory.join("TASK.md");
        let observed = fs::read(&body_path)
            .map_err(|error| storage_error("read_metadata_switch_body", &body_path, error))?;
        if &observed != expected_body {
            return Err(TkError::new(
                "changed_since_plan",
                ErrorCategory::Conflict,
                format!("Task body changed: {}", body_path.display()),
            ));
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

fn path_text(path: &Path) -> Result<&str> {
    path.to_str().ok_or_else(|| {
        TkError::new(
            "non_utf8_task_path",
            ErrorCategory::ManagedFile,
            format!("Task path is not UTF-8: {}", path.display()),
        )
    })
}
