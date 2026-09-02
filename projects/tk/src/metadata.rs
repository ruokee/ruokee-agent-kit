use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::error::{ErrorCategory, Result, TkError};
use crate::path::storage_error;
use crate::project::{self, MetadataMode, Project};
use crate::task_store;

#[derive(Debug, Clone, Serialize)]
pub struct MetadataTaskPlan {
    pub task_dir: String,
}

#[derive(Debug, Serialize)]
pub struct MigrationResult {
    pub kind: String,
    pub changed: bool,
    pub committed: bool,
    pub partial: bool,
    pub dry_run: bool,
    pub source: String,
    pub target: String,
    pub affected_tasks: usize,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub tasks: Vec<MetadataTaskPlan>,
}

struct PlannedTask {
    report: MetadataTaskPlan,
    directory: PathBuf,
    source_metadata: Vec<u8>,
    source_body: Option<Vec<u8>>,
    target_metadata: Vec<u8>,
    target_body: Option<Vec<u8>>,
    staged_metadata: Option<PathBuf>,
    staged_body: Option<PathBuf>,
}

pub fn switch(project: &Project, target: MetadataMode, dry_run: bool) -> Result<MigrationResult> {
    let source = project.config.metadata_mode;
    if source == target {
        return Ok(MigrationResult {
            kind: "metadata_switch".into(),
            changed: false,
            committed: false,
            partial: false,
            dry_run,
            source: source.to_string(),
            target: target.to_string(),
            affected_tasks: 0,
            tasks: Vec::new(),
        });
    }

    let mut plans = build_plan(project, target)?;
    let reports = plans.iter().map(|plan| plan.report.clone()).collect();
    let result = MigrationResult {
        kind: "metadata_switch".into(),
        changed: true,
        committed: !dry_run,
        partial: false,
        dry_run,
        source: source.to_string(),
        target: target.to_string(),
        affected_tasks: plans.len(),
        tasks: reports,
    };
    if dry_run {
        return Ok(result);
    }

    crate::project::ensure_mutable(project)?;
    if plans.is_empty() {
        project::set_metadata_mode(project, target)?;
        return Ok(result);
    }

    let operation = crate::gc::begin_project_operation(&project.task_root)?;
    operation.execute(
        |operation| {
            stage_all(operation, &mut plans)?;
            let mut completed = Vec::new();
            for index in 0..plans.len() {
                if let Err(error) = crate::cancel::checkpoint() {
                    if completed.is_empty() {
                        return Err(error);
                    }
                    let uncompleted = plans[index..]
                        .iter()
                        .map(|plan| plan.report.task_dir.clone())
                        .chain(std::iter::once(project.config_path.display().to_string()))
                        .collect::<Vec<_>>();
                    return Err(TkError::partial_commit(
                        "Metadata representation switch was cancelled after committing some files",
                        serde_json::json!(completed),
                        serde_json::json!(uncompleted),
                        error,
                    ));
                }
                if let Err(error) = commit_task(source, target, &plans[index]) {
                    if completed.is_empty() {
                        return Err(error);
                    }
                    let uncompleted = plans[index..]
                        .iter()
                        .map(|plan| plan.report.task_dir.clone())
                        .chain(std::iter::once(project.config_path.display().to_string()))
                        .collect::<Vec<_>>();
                    return Err(TkError::partial_commit(
                        "Metadata representation switch stopped after committing some files",
                        serde_json::json!(completed),
                        serde_json::json!(uncompleted),
                        error,
                    ));
                }
                completed.push(plans[index].report.task_dir.clone());
            }
            if let Err(error) = crate::cancel::checkpoint() {
                return Err(TkError::partial_commit(
                    "Metadata representation switch was cancelled before updating project configuration",
                    serde_json::json!(completed),
                    serde_json::json!([project.config_path.clone()]),
                    error,
                ));
            }
            if let Err(error) = project::set_metadata_mode(project, target) {
                return Err(TkError::partial_commit(
                    "Metadata representation files changed but the project configuration did not",
                    serde_json::json!(completed),
                    serde_json::json!([project.config_path.clone()]),
                    error,
                ));
            }
            completed.push(project.config_path.display().to_string());
            Ok(completed)
        },
        |completed, cleanup_path, error| {
            TkError::partial_commit(
                "Metadata representation switch committed but cleanup failed",
                serde_json::json!(completed),
                serde_json::json!([cleanup_path]),
                error,
            )
        },
    )?;
    Ok(result)
}

fn build_plan(project: &Project, target: MetadataMode) -> Result<Vec<PlannedTask>> {
    let candidates = task_store::scan_candidates(
        &project.task_root,
        &project.config.subtasks_dir,
        project.config.metadata_mode,
    )?;
    let mut ids = HashSet::new();
    let mut plans = Vec::with_capacity(candidates.len());
    for directory in candidates {
        let task = task_store::read_task(&directory, project.config.metadata_mode)?;
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
        plans.push(PlannedTask {
            report: MetadataTaskPlan {
                task_dir: path_text(relative)?,
            },
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
    Ok(plans)
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

fn commit_task(source: MetadataMode, target: MetadataMode, plan: &PlannedTask) -> Result<()> {
    verify_source(source, plan)?;
    let staged_metadata = plan
        .staged_metadata
        .as_deref()
        .expect("metadata payload was staged");
    match target {
        MetadataMode::Embed => {
            let task_path = plan.directory.join("TASK.md");
            fs::rename(staged_metadata, &task_path)
                .map_err(|error| storage_error("commit_embed_metadata", &task_path, error))?;
            let split_path = plan.directory.join("tk.toml");
            if let Err(error) = fs::remove_file(&split_path)
                .map_err(|error| storage_error("remove_split_metadata", &split_path, error))
            {
                return Err(TkError::partial_commit(
                    "Embedded metadata committed but split metadata remains",
                    serde_json::json!([task_path]),
                    serde_json::json!([split_path]),
                    error,
                ));
            }
            Ok(())
        }
        MetadataMode::Split => {
            let split_path = plan.directory.join("tk.toml");
            fs::rename(staged_metadata, &split_path)
                .map_err(|error| storage_error("commit_split_metadata", &split_path, error))?;
            let staged_body = plan
                .staged_body
                .as_deref()
                .expect("body payload was staged");
            let task_path = plan.directory.join("TASK.md");
            if let Err(error) = fs::rename(staged_body, &task_path)
                .map_err(|error| storage_error("commit_split_body", &task_path, error))
            {
                return Err(TkError::partial_commit(
                    "Split metadata committed but Task body did not",
                    serde_json::json!([split_path]),
                    serde_json::json!([task_path]),
                    error,
                ));
            }
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

fn path_text(path: &Path) -> Result<String> {
    path.to_str().map(ToOwned::to_owned).ok_or_else(|| {
        TkError::new(
            "non_utf8_task_path",
            ErrorCategory::ManagedFile,
            format!("Task path is not UTF-8: {}", path.display()),
        )
    })
}
