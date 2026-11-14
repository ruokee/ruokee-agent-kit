use std::collections::BTreeSet;
use std::fs::{self, OpenOptions};
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};

use chrono::{DateTime, FixedOffset, Local};
use serde::Serialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::error::{ErrorCategory, Result, TkError};
use crate::path::storage_error;
use crate::project::{Project, TaskLayout};
use crate::references::ReferenceScan;

pub const DIRECTORY: &str = "reports";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TaskChange {
    pub task_id: Uuid,
    pub old_path: PathBuf,
    pub target_path: PathBuf,
    pub old_name: String,
    pub new_name: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Step {
    pub kind: &'static str,
    pub path: PathBuf,
}

impl Step {
    pub fn new(kind: &'static str, path: &Path) -> Self {
        Self {
            kind,
            path: path.to_path_buf(),
        }
    }
}

#[derive(Serialize)]
pub struct ScanReport {
    pub report_version: u32,
    pub run_id: Uuid,
    pub created_at: DateTime<FixedOffset>,
    pub operation: &'static str,
    pub dry_run: bool,
    pub update_references: bool,
    pub project_root: PathBuf,
    pub task_root: PathBuf,
    pub task_layout: TaskLayout,
    pub target_layout: TaskLayout,
    pub scan_complete: bool,
    pub diagnostics: Vec<TkError>,
    pub tasks: Vec<TaskChange>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub excluded_paths: Vec<PathBuf>,
    #[serde(flatten)]
    pub scan: ReferenceScan,
    #[serde(skip)]
    pub path: PathBuf,
}

#[derive(Debug, Serialize)]
pub struct Summary {
    pub operation: &'static str,
    pub run_id: Uuid,
    pub dry_run: bool,
    pub changed: bool,
    pub committed: bool,
    pub partial: bool,
    pub affected_tasks: usize,
    pub planned_moves: usize,
    pub completed_moves: usize,
    pub reference_count: usize,
    pub planned_reference_files: usize,
    pub updated_reference_files: usize,
    pub config_changed: bool,
    pub report_path: PathBuf,
}

impl Summary {
    pub fn text(&self) -> String {
        format!(
            "{}: {} Tasks, {}/{} directory moves, {}/{} reference files updated\nConfiguration changed: {}\nReport: {}{}",
            self.operation,
            self.affected_tasks,
            self.completed_moves,
            self.planned_moves,
            self.updated_reference_files,
            self.planned_reference_files,
            self.config_changed,
            self.report_path.display(),
            if self.dry_run { "\nDry run" } else { "" }
        )
    }
}

impl ScanReport {
    pub fn new(
        project: &Project,
        operation: &'static str,
        target: TaskLayout,
        dry_run: bool,
        update_references: bool,
        excluded_paths: &[PathBuf],
    ) -> Self {
        let run = Run::new(project, operation, dry_run);
        Self {
            report_version: 1,
            run_id: run.run_id,
            created_at: run.created_at,
            operation,
            dry_run,
            update_references,
            project_root: run.project_root,
            task_root: run.task_root,
            task_layout: project.config.task_layout,
            target_layout: target,
            scan_complete: false,
            diagnostics: Vec::new(),
            tasks: Vec::new(),
            excluded_paths: excluded_paths
                .iter()
                .map(|path| {
                    if path.is_absolute() {
                        crate::references::normalize(path)
                    } else {
                        crate::references::normalize(&project.root.join(path))
                    }
                })
                .collect::<BTreeSet<_>>()
                .into_iter()
                .collect(),
            scan: ReferenceScan::default(),
            path: run.path,
        }
    }

    pub fn save_planning(&mut self, planning: Result<()>) -> Result<()> {
        if let Err(error) = &planning {
            self.diagnostics.push(error.clone());
        }
        if let Err(mut error) = self.save() {
            if let Err(original) = planning {
                error.details =
                    Some(json!({"report_error": error.details, "planning_error": original}));
            }
            return Err(error);
        }
        planning.map_err(|error| self.error(error, &[], &[], false))
    }

    fn save(&self) -> Result<()> {
        save_report(&self.task_root, &self.path, self)
    }

    pub fn summary(
        &self,
        planned_moves: usize,
        completed: &[Step],
        config_changed: bool,
    ) -> Summary {
        let affected_tasks = self
            .tasks
            .iter()
            .filter(|task| task.old_path != task.target_path || task.old_name != task.new_name)
            .count();
        let changed = affected_tasks != 0 || self.task_layout != self.target_layout;
        Summary {
            operation: self.operation,
            run_id: self.run_id,
            dry_run: self.dry_run,
            changed,
            committed: changed && !self.dry_run,
            partial: false,
            affected_tasks,
            planned_moves,
            completed_moves: completed
                .iter()
                .filter(|step| step.kind == "move_directory")
                .count(),
            reference_count: self.scan.references.len(),
            planned_reference_files: if self.update_references {
                self.scan.file_count()
            } else {
                0
            },
            updated_reference_files: completed
                .iter()
                .filter(|step| step.kind == "rewrite_references")
                .count(),
            config_changed,
            report_path: self.path.clone(),
        }
    }

    pub fn error(
        &self,
        error: TkError,
        completed: &[Step],
        uncompleted: &[Step],
        config_changed: bool,
    ) -> TkError {
        let error = if completed.is_empty() || error.code == "partial_commit" {
            error
        } else {
            TkError::partial_commit(
                "Path changes stopped after committing some steps",
                json!(completed),
                json!(uncompleted),
                error,
            )
        };
        attach_report(
            error,
            self.run_id,
            &self.path,
            json!({"before": self.task_layout,
            "after": if config_changed {self.target_layout} else {self.task_layout}, "changed": config_changed}),
        )
    }
}

#[derive(Serialize)]
pub struct Run {
    pub report_version: u32,
    pub run_id: Uuid,
    pub created_at: DateTime<FixedOffset>,
    pub operation: &'static str,
    pub dry_run: bool,
    pub project_root: PathBuf,
    pub task_root: PathBuf,
    #[serde(skip)]
    pub path: PathBuf,
}

impl Run {
    pub fn new(project: &Project, operation: &'static str, dry_run: bool) -> Self {
        let created_at = Local::now().fixed_offset();
        let run_id = Uuid::now_v7();
        let path = project
            .task_root
            .join(".tk-tmp")
            .join(DIRECTORY)
            .join(format!(
                "{}--{operation}--{run_id}.json",
                created_at.format("%Y%m%dT%H%M%S%z")
            ));
        Self {
            report_version: 1,
            run_id,
            created_at,
            operation,
            dry_run,
            project_root: project.root.clone(),
            task_root: project.task_root.clone(),
            path,
        }
    }

    pub fn error(&self, error: TkError, config: Value) -> TkError {
        attach_report(error, self.run_id, &self.path, config)
    }

    pub fn execution_error(
        &self,
        error: TkError,
        steps: &[Step],
        completed: usize,
        config: Value,
    ) -> TkError {
        let cleanup = error
            .details
            .as_ref()
            .and_then(|details| details.get("uncompleted"))
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let mut error = if completed == 0 || error.code == "partial_commit" {
            error
        } else {
            TkError::partial_commit(
                "Metadata changes stopped after committing some steps",
                json!(&steps[..completed]),
                json!(&steps[completed..]),
                error,
            )
        };
        let mut pending = json!(&steps[completed..]);
        pending
            .as_array_mut()
            .expect("step list")
            .extend(cleanup.into_iter().map(|item| {
                if item.is_string() {
                    json!({"kind": "cleanup_operation", "path": item})
                } else {
                    item
                }
            }));
        let mut details = match error.details.take() {
            Some(Value::Object(details)) => details,
            Some(other) => serde_json::Map::from_iter([("cause".into(), other)]),
            None => serde_json::Map::new(),
        };
        details.insert("completed".into(), json!(&steps[..completed]));
        details.insert("uncompleted".into(), pending);
        error.details = Some(Value::Object(details));
        self.error(error, config)
    }

    pub fn summary(
        self,
        affected_tasks: usize,
        planned_files: usize,
        config_changed: bool,
        changed: bool,
    ) -> FileSummary {
        FileSummary {
            operation: self.operation,
            run_id: self.run_id,
            dry_run: self.dry_run,
            report_path: self.path,
            changed,
            committed: changed && !self.dry_run,
            partial: false,
            affected_tasks,
            planned_files,
            completed_files: if self.dry_run { 0 } else { planned_files },
            config_changed,
        }
    }
}

#[derive(Serialize)]
pub struct PlanReport<P> {
    #[serde(flatten)]
    pub run: Run,
    pub plan_complete: bool,
    pub diagnostics: Vec<TkError>,
    #[serde(flatten)]
    pub plan: P,
}

impl<P: Serialize> PlanReport<P> {
    pub fn new(project: &Project, operation: &'static str, dry_run: bool, plan: P) -> Self {
        Self {
            run: Run::new(project, operation, dry_run),
            plan_complete: false,
            diagnostics: Vec::new(),
            plan,
        }
    }

    pub fn save_planning(&mut self, planning: Result<()>, config: Value) -> Result<()> {
        self.plan_complete = planning.is_ok();
        if let Err(error) = &planning {
            self.diagnostics.push(error.clone());
        }
        if let Err(mut error) = save_report(&self.run.task_root, &self.run.path, self) {
            if let Err(original) = planning {
                error.details =
                    Some(json!({"report_error": error.details, "planning_error": original}));
            }
            return Err(error);
        }
        planning.map_err(|error| self.run.error(error, config))
    }
}

#[derive(Debug, Serialize)]
pub struct FileSummary {
    pub operation: &'static str,
    pub run_id: Uuid,
    pub dry_run: bool,
    pub report_path: PathBuf,
    pub changed: bool,
    pub committed: bool,
    pub partial: bool,
    pub affected_tasks: usize,
    pub planned_files: usize,
    pub completed_files: usize,
    pub config_changed: bool,
}

impl FileSummary {
    pub fn text(&self) -> String {
        format!(
            "{}: {} Tasks, {}/{} files changed\nConfiguration changed: {}\nReport: {}{}",
            self.operation,
            self.affected_tasks,
            self.completed_files,
            self.planned_files,
            self.config_changed,
            self.report_path.display(),
            if self.dry_run { "\nDry run" } else { "" }
        )
    }
}

fn attach_report(mut error: TkError, run_id: Uuid, path: &Path, config: Value) -> TkError {
    let mut details = match error.details.take() {
        Some(Value::Object(details)) => details,
        Some(other) => serde_json::Map::from_iter([("cause".into(), other)]),
        None => serde_json::Map::new(),
    };
    details.insert("run_id".into(), json!(run_id));
    details.insert("report_path".into(), json!(path));
    details.insert("config".into(), config);
    error.details = Some(Value::Object(details));
    error
        .message
        .push_str(&format!("\nReport: {}", path.display()));
    error
}

fn save_report(task_root: &Path, path: &Path, report: &impl Serialize) -> Result<()> {
    crate::cancel::check()?;
    let temporary = task_root.join(".tk-tmp");
    let directory = temporary.join(DIRECTORY);
    for path in [&temporary, &directory] {
        match fs::symlink_metadata(path) {
            Ok(metadata) if metadata.is_dir() && !metadata.file_type().is_symlink() => {}
            Ok(_) => {
                return Err(TkError::new(
                    "invalid_report_directory",
                    ErrorCategory::Storage,
                    format!(
                        "Report storage must be a real directory: {}",
                        path.display()
                    ),
                ));
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                fs::create_dir(path)
                    .map_err(|error| storage_error("create_report_directory", path, error))?;
            }
            Err(error) => return Err(storage_error("inspect_report_directory", path, error)),
        }
    }
    let file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|error| storage_error("create_scan_report", path, error))?;
    let result = (|| {
        let mut writer = BufWriter::new(file);
        serde_json::to_writer_pretty(&mut writer, report).map_err(|error| {
            TkError::new(
                "write_scan_report_failed",
                ErrorCategory::Storage,
                error.to_string(),
            )
        })?;
        writer
            .write_all(b"\n")
            .map_err(|error| storage_error("write_scan_report", path, error))?;
        writer
            .flush()
            .map_err(|error| storage_error("flush_scan_report", path, error))?;
        writer
            .get_ref()
            .sync_all()
            .map_err(|error| storage_error("sync_scan_report", path, error))
    })();
    if result.is_err() {
        let _ = fs::remove_file(path);
    }
    result
}
