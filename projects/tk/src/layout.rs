use std::collections::{BTreeSet, HashMap};
use std::fs;
use std::path::PathBuf;

use serde_json::json;

use crate::error::{ErrorCategory, Result, TkError};
use crate::path::storage_error;
use crate::project::{self, MetadataMode, Project, TaskLayout};
use crate::references::{DirectoryMove, mapped_path};
use crate::reports::{ScanReport, Step, Summary, TaskChange};
use crate::task_store::{self, TaskGraph};

struct Snapshot {
    path: PathBuf,
    content: Vec<u8>,
}

struct LayoutPlan {
    graph: TaskGraph,
    moves: Vec<DirectoryMove>,
    focus: Vec<PathBuf>,
    carriers: Vec<Snapshot>,
    config: Option<Vec<u8>>,
}

pub fn switch(
    project: &Project,
    target: TaskLayout,
    dry_run: bool,
    update: bool,
    extra: &[PathBuf],
    excluded_paths: &[PathBuf],
) -> Result<Summary> {
    run(
        project,
        target,
        None,
        dry_run,
        update,
        extra,
        excluded_paths,
    )
}

pub fn migrate(
    project: &Project,
    selected: &[PathBuf],
    dry_run: bool,
    update: bool,
    extra: &[PathBuf],
    excluded_paths: &[PathBuf],
) -> Result<Summary> {
    run(
        project,
        project.config.task_layout,
        Some(selected),
        dry_run,
        update,
        extra,
        excluded_paths,
    )
}

fn run(
    project: &Project,
    target: TaskLayout,
    selected: Option<&[PathBuf]>,
    dry_run: bool,
    update: bool,
    extra: &[PathBuf],
    excluded_paths: &[PathBuf],
) -> Result<Summary> {
    let switch_config = selected.is_none() && target != project.config.task_layout;
    let mut report = ScanReport::new(
        project,
        if selected.is_none() {
            "switch-layout"
        } else {
            "migrate-layout"
        },
        target,
        dry_run,
        update,
        excluded_paths,
    );
    let planning = build_plan(project, target, selected, &mut report).and_then(|plan| {
        report.scan.collect(
            project,
            &plan.graph,
            &plan.moves,
            &plan.focus,
            extra,
            &report.excluded_paths,
            update,
        )?;
        report.scan_complete = true;
        Ok(plan)
    });
    report.save_planning(planning.as_ref().map(|_| ()).map_err(Clone::clone))?;
    let plan = planning.expect("successful saved plan");
    if dry_run || plan.moves.is_empty() && !switch_config {
        return Ok(report.summary(plan.moves.len(), &[], false));
    }
    let mut steps: Vec<_> = plan
        .moves
        .iter()
        .map(|item| Step::new("move_directory", &item.target))
        .collect();
    if update {
        steps.extend(report.scan.steps(&plan.moves));
    }
    if switch_config {
        steps.push(Step::new("write_config", &project.config_path));
    }
    let mut completed = Vec::new();
    let mut config_changed = false;
    let result = (|| {
        project::ensure_mutable(project)?;
        let operation = crate::gc::begin_project_operation(&project.task_root)?;
        operation.execute(
            |_| {
                plan.verify_config(project)?;
                for snapshot in &plan.carriers {
                    snapshot.verify()?;
                }
                for item in &plan.moves {
                    verify_move(project, item)?;
                }
                report.scan.verify(
                    project,
                    &plan.graph,
                    &plan.moves,
                    &plan.focus,
                    extra,
                    &report.excluded_paths,
                )?;
                for item in &plan.moves {
                    crate::cancel::checkpoint()?;
                    verify_move(project, item)?;
                    for snapshot in plan
                        .carriers
                        .iter()
                        .filter(|snapshot| snapshot.path.starts_with(&item.source))
                    {
                        snapshot.verify()?;
                    }
                    crate::cancel::begin_write()?;
                    let parent = item.target.parent().expect("Task directory has parent");
                    fs::create_dir_all(parent)
                        .map_err(|error| storage_error("create_layout_directory", parent, error))?;
                    fs::rename(&item.source, &item.target).map_err(|error| {
                        storage_error("move_task_directory", &item.source, error)
                    })?;
                    completed.push(Step::new("move_directory", &item.target));
                }
                if update {
                    report.scan.commit(&plan.moves, &mut completed)?;
                }
                if switch_config {
                    crate::cancel::checkpoint()?;
                    plan.verify_config(project)?;
                    project::set_task_layout(project, target)?;
                    config_changed = true;
                    completed.push(Step::new("write_config", &project.config_path));
                }
                Ok(completed.len())
            },
            |count, cleanup, error| {
                TkError::partial_commit(
                    "Layout changes committed but cleanup failed",
                    json!(&steps[..*count]),
                    json!([Step::new("cleanup", &cleanup)]),
                    error,
                )
            },
        )
    })();
    result.map_err(|error| {
        report.error(error, &completed, &steps[completed.len()..], config_changed)
    })?;
    Ok(report.summary(plan.moves.len(), &completed, config_changed))
}

fn build_plan(
    project: &Project,
    target: TaskLayout,
    selected: Option<&[PathBuf]>,
    report: &mut ScanReport,
) -> Result<LayoutPlan> {
    let active = project.config.task_layout;
    let mut graph = TaskGraph::default();
    let mut directories = HashMap::new();
    append_graph(
        &mut graph,
        &mut directories,
        task_store::discover_tasks(&project.task_root, project.config.metadata_mode, active)?,
    );
    let mut roots = BTreeSet::new();
    if let Some(selected) = selected {
        if selected.is_empty() {
            return Err(TkError::request(
                "invalid_request",
                "Select at least one top-level Task with --task",
            ));
        }
        for path in selected {
            let directory = if path.is_absolute() {
                path.clone()
            } else {
                project.root.join(path)
            };
            project::ensure_safe_project_path(&project.root, &directory)?;
            let layout = [TaskLayout::Monthly, TaskLayout::Daily]
                .into_iter()
                .find(|layout| {
                    task_store::parse_top_level_task_path(&project.task_root, &directory, *layout)
                        .is_some()
                })
                .ok_or_else(|| {
                    TkError::request(
                        "invalid_request",
                        format!(
                            "Expected a canonical top-level Task directory: {}",
                            directory.display()
                        ),
                    )
                })?;
            if !roots.insert(directory.clone()) {
                continue;
            }
            if !directories.contains_key(&directory) {
                append_graph(
                    &mut graph,
                    &mut directories,
                    task_store::discover_task_tree(
                        &project.task_root,
                        &directory,
                        project.config.metadata_mode,
                        layout,
                    )?,
                );
            }
        }
    } else {
        roots.extend(
            graph
                .tasks
                .iter()
                .filter(|task| task.parent.is_none())
                .map(|task| task.task.directory.clone()),
        );
        if target != active {
            append_graph(
                &mut graph,
                &mut directories,
                task_store::discover_tasks(
                    &project.task_root,
                    project.config.metadata_mode,
                    target,
                )?,
            );
        }
    }
    let mut moves = Vec::new();
    for source in &roots {
        let parsed = [TaskLayout::Monthly, TaskLayout::Daily]
            .into_iter()
            .find_map(|layout| {
                task_store::parse_top_level_task_path(&project.task_root, source, layout)
            })
            .expect("canonical selected root");
        let destination = task_store::top_level_directory(
            &project.task_root,
            target,
            parsed.date,
            parsed.sequence,
            parsed.slug,
        );
        if source != &destination {
            moves.push(DirectoryMove {
                source: source.clone(),
                target: destination,
            });
        }
    }
    let mut focus = Vec::new();
    for task in &graph.tasks {
        if task
            .task
            .directory
            .ancestors()
            .any(|parent| roots.contains(parent))
        {
            focus.push(task.task.directory.clone());
            report.tasks.push(TaskChange {
                task_id: task.task.metadata.id,
                old_path: task.task.directory.clone(),
                target_path: mapped_path(&task.task.directory, &moves).into_owned(),
                old_name: task.task.metadata.name.clone(),
                new_name: task.task.metadata.name.clone(),
            });
        }
    }
    if let Some(candidate) = graph.invalid_candidates.iter().find(|candidate| {
        selected.is_none()
            || roots
                .iter()
                .any(|root| candidate.directory.starts_with(root))
    }) {
        return Err(candidate.error.clone());
    }
    for item in &moves {
        verify_move(project, item)?;
    }
    let mut ids = HashMap::new();
    let mut top_sequences = HashMap::new();
    let mut child_sequences = HashMap::new();
    for task in &graph.tasks {
        if let Some(previous) = ids.insert(task.task.metadata.id, &task.task.directory) {
            return Err(TkError::new("duplicate_task_id", ErrorCategory::Resolution, "Task ID appears in multiple directories")
                .with_details(json!({"task_id": task.task.metadata.id, "paths": [previous, &task.task.directory]})));
        }
        if let Some(parent) = task.parent {
            if task_store::generated_child_slug(&task.task.directory).is_some() {
                let prefix = task
                    .task
                    .directory
                    .file_name()
                    .and_then(|name| name.to_str())
                    .expect("generated UTF-8 child")
                    .split_once("--")
                    .expect("generated child sequence")
                    .0;
                if child_sequences
                    .insert((parent, prefix), &task.task.directory)
                    .is_some()
                {
                    return Err(TkError::invariant(
                        "duplicate_task_sequence",
                        "Child Task sequence is reused under one parent",
                    ));
                }
            }
        } else {
            let destination = mapped_path(&task.task.directory, &moves);
            let parsed =
                task_store::parse_top_level_task_path(&project.task_root, &destination, target)
                    .expect("final target layout");
            if let Some(previous) =
                top_sequences.insert((parsed.date, parsed.sequence), &task.task.directory)
            {
                return Err(TkError::invariant(
                    "duplicate_task_sequence",
                    "Top-level Task sequence is reused on one date",
                )
                .with_details(json!({"paths": [previous, &task.task.directory]})));
            }
        }
    }
    crate::app::validate_all_relations(&graph)?;
    let mut carriers = Vec::new();
    for task in &graph.tasks {
        let path = task
            .task
            .directory
            .join(match project.config.metadata_mode {
                MetadataMode::Split => "tk.toml",
                MetadataMode::Embed => "TASK.md",
            });
        let content = fs::read(&path)
            .map_err(|error| storage_error("snapshot_layout_metadata", &path, error))?;
        carriers.push(Snapshot { path, content });
    }
    let config = read_config_snapshot(project)?;
    Ok(LayoutPlan {
        graph,
        moves,
        focus,
        carriers,
        config,
    })
}

fn append_graph(
    target: &mut TaskGraph,
    directories: &mut HashMap<PathBuf, usize>,
    incoming: TaskGraph,
) {
    let mut indices = Vec::with_capacity(incoming.tasks.len());
    for mut task in incoming.tasks {
        let index = if let Some(index) = directories.get(&task.task.directory) {
            *index
        } else {
            task.parent = task.parent.map(|parent| indices[parent]);
            let index = target.tasks.len();
            directories.insert(task.task.directory.clone(), index);
            target.tasks.push(task);
            index
        };
        indices.push(index);
    }
    target
        .invalid_candidates
        .extend(incoming.invalid_candidates);
}

fn verify_move(project: &Project, item: &DirectoryMove) -> Result<()> {
    project::ensure_safe_project_path(&project.root, &item.source)?;
    project::ensure_safe_project_path(&project.root, &item.target)?;
    let metadata = fs::symlink_metadata(&item.source)
        .map_err(|error| storage_error("inspect_layout_source", &item.source, error))?;
    if !metadata.is_dir() {
        return Err(TkError::request(
            "invalid_request",
            "Layout source must be a Task directory",
        ));
    }
    match fs::symlink_metadata(&item.target) {
        Ok(_) => Err(TkError::new(
            "layout_target_exists",
            ErrorCategory::Conflict,
            format!("Layout target already exists: {}", item.target.display()),
        )),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(storage_error("inspect_layout_target", &item.target, error)),
    }
}

fn read_config_snapshot(project: &Project) -> Result<Option<Vec<u8>>> {
    match fs::read(&project.config_path) {
        Ok(bytes) => Ok(Some(bytes)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(storage_error(
            "snapshot_layout_config",
            &project.config_path,
            error,
        )),
    }
}

impl LayoutPlan {
    fn verify_config(&self, project: &Project) -> Result<()> {
        if self.config != read_config_snapshot(project)? {
            return Err(stale());
        }
        Ok(())
    }
}

impl Snapshot {
    fn verify(&self) -> Result<()> {
        let current = fs::read(&self.path)
            .map_err(|error| storage_error("verify_layout_metadata", &self.path, error))?;
        if current != self.content {
            return Err(stale());
        }
        Ok(())
    }
}

fn stale() -> TkError {
    TkError::new(
        "stale_layout_plan",
        ErrorCategory::Conflict,
        "Layout inputs changed after planning",
    )
}
