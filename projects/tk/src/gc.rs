use std::collections::BTreeSet;
use std::env;
use std::fs;
use std::path::{Component, Path, PathBuf};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{ErrorCategory, Result, TkError};
use crate::path::storage_error;
use crate::project;

pub const MANIFEST_FILE: &str = "manifest.toml";
const FORMAT_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProducerIdentity {
    pub boot_id: String,
    pub pid: u32,
    pub start_ticks: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanupManifest {
    pub format_version: u32,
    pub operation_id: Uuid,
    pub producer: ProducerIdentity,
    pub created_at: DateTime<Utc>,
    pub scope: PathBuf,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub temporary_paths: Vec<PathBuf>,
}

#[derive(Debug)]
pub struct CleanupOperation {
    directory: PathBuf,
    manifest: CleanupManifest,
    finished: bool,
}

impl CleanupOperation {
    pub fn temporary_path(&mut self, relative: &str) -> Result<PathBuf> {
        let relative = Path::new(relative);
        if relative.as_os_str().is_empty()
            || relative
                .components()
                .any(|component| !matches!(component, Component::Normal(_)))
        {
            return Err(TkError::new(
                "invalid_temporary_path",
                ErrorCategory::Internal,
                format!("Temporary operation path must be relative and normalized: {relative:?}"),
            ));
        }
        let path = self.directory.join(relative);
        if !self.manifest.temporary_paths.contains(&path) {
            self.manifest.temporary_paths.push(path.clone());
            write_manifest(&self.directory, &self.manifest)?;
        }
        Ok(path)
    }

    #[cfg(test)]
    pub fn path(&self) -> &Path {
        &self.directory
    }

    pub fn finish(mut self) -> Result<()> {
        self.finished = true;
        if !self.directory.exists() {
            return Ok(());
        }
        fs::remove_dir_all(&self.directory)
            .map_err(|error| storage_error("remove_temporary_operation", &self.directory, error))
    }

    pub fn execute<T>(
        mut self,
        action: impl FnOnce(&mut Self) -> Result<T>,
        cleanup_failure: impl FnOnce(&T, PathBuf, TkError) -> TkError,
    ) -> Result<T> {
        match action(&mut self) {
            Ok(value) => {
                let cleanup_path = self.directory.clone();
                match self.finish() {
                    Ok(()) => Ok(value),
                    Err(error) => Err(cleanup_failure(&value, cleanup_path, error)),
                }
            }
            Err(error) => {
                let cleanup_path = self.directory.clone();
                match self.finish() {
                    Ok(()) => Err(error),
                    Err(cleanup_error) => Err(TkError::operation_cleanup_failed(
                        &cleanup_path,
                        error,
                        cleanup_error,
                    )),
                }
            }
        }
    }
}

impl Drop for CleanupOperation {
    fn drop(&mut self) {
        if !self.finished {
            let _ = fs::remove_dir_all(&self.directory);
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct GcEntry {
    pub manifest: PathBuf,
    pub classification: GcClassification,
    pub removed: bool,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GcClassification {
    Active,
    Unknown,
    Disposable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ProducerStatus {
    Active,
    Inactive,
    Unknown,
}

#[derive(Debug, Serialize)]
pub struct GcResult {
    pub changed: bool,
    pub committed: bool,
    pub partial: bool,
    pub dry_run: bool,
    pub project_discovered: bool,
    pub entries: Vec<GcEntry>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Copy)]
enum DeletionKind {
    Temporary,
    Manifest,
    Directory { entry_index: Option<usize> },
}

#[derive(Debug, Clone)]
struct DeletionStep {
    path: PathBuf,
    operation_directory: PathBuf,
    kind: DeletionKind,
}

pub fn run(cwd: Option<&Path>, dry_run: bool) -> Result<GcResult> {
    let project = match cwd.map(project::discover_unchecked).transpose() {
        Ok(project) => project,
        Err(error) if error.code == "project_not_initialized" => None,
        Err(error) => return Err(error),
    };
    let project_root = project.as_ref().map(|project| project.task_root.clone());
    let mut roots = vec![user_temp_root()?];
    if let Some(root) = &project_root {
        roots.push(root.join(".tk-tmp"));
    }

    let mut entries = Vec::new();
    let mut warnings = Vec::new();
    let mut deletion_plan = Vec::new();
    for root in &roots {
        inspect_temporary_root(root, &mut entries, &mut warnings, &mut deletion_plan)?;
    }
    let changed = !deletion_plan.is_empty();
    if !dry_run && changed {
        execute_deletion_plan(&deletion_plan, &mut entries, |step| {
            crate::cancel::begin_write()?;
            remove_deletion_step(step)
        })?;
    }

    if project_root.is_none() {
        warnings.push(
            "No tk project was discoverable; only user-level temporary operations were inspected"
                .into(),
        );
    }
    Ok(GcResult {
        changed,
        committed: changed && !dry_run,
        partial: false,
        dry_run,
        project_discovered: project_root.is_some(),
        entries,
        warnings,
    })
}

fn inspect_temporary_root(
    root: &Path,
    entries: &mut Vec<GcEntry>,
    warnings: &mut Vec<String>,
    deletion_plan: &mut Vec<DeletionStep>,
) -> Result<()> {
    let metadata = match fs::symlink_metadata(root) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(storage_error("inspect_temporary_root", root, error)),
    };
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        record_unknown_entry(root, entries, warnings);
        return Ok(());
    }
    let mut children = fs::read_dir(root)
        .map_err(|error| storage_error("scan_temporary_operations", root, error))?
        .collect::<std::io::Result<Vec<_>>>()
        .map_err(|error| storage_error("scan_temporary_operations", root, error))?;
    children.sort_by_key(|entry| entry.file_name());
    for child in children {
        let path = child.path();
        let metadata = fs::symlink_metadata(&path)
            .map_err(|error| storage_error("inspect_temporary_operation", &path, error))?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            record_unknown_entry(&path, entries, warnings);
            continue;
        }
        inspect_operation(&path, entries, warnings, deletion_plan)?;
    }
    Ok(())
}

fn inspect_operation(
    directory: &Path,
    entries: &mut Vec<GcEntry>,
    warnings: &mut Vec<String>,
    deletion_plan: &mut Vec<DeletionStep>,
) -> Result<()> {
    let manifest_path = directory.join(MANIFEST_FILE);
    let inspected: Result<(CleanupManifest, GcClassification)> = (|| {
        require_regular_file(&manifest_path, "cleanup manifest")?;
        let manifest = read_manifest(&manifest_path)?;
        let classification = classify(directory, &manifest)?;
        Ok((manifest, classification))
    })();
    let (manifest, classification) = match inspected {
        Ok(value) => value,
        Err(error) => {
            warnings.push(format!(
                "Preserved unknown temporary operation {}: {}",
                directory.display(),
                error.message
            ));
            entries.push(GcEntry {
                manifest: manifest_path,
                classification: GcClassification::Unknown,
                removed: false,
            });
            return Ok(());
        }
    };
    let entry_index = entries.len();
    entries.push(GcEntry {
        manifest: manifest_path.clone(),
        classification,
        removed: false,
    });
    if classification == GcClassification::Disposable {
        deletion_plan.extend(plan_operation_deletion(
            directory,
            &manifest,
            &manifest_path,
            entry_index,
        )?);
    }
    Ok(())
}

fn record_unknown_entry(path: &Path, entries: &mut Vec<GcEntry>, warnings: &mut Vec<String>) {
    warnings.push(format!(
        "Preserved unsupported content in a tk temporary root: {}",
        path.display()
    ));
    entries.push(GcEntry {
        manifest: path.to_path_buf(),
        classification: GcClassification::Unknown,
        removed: false,
    });
}

fn plan_operation_deletion(
    directory: &Path,
    manifest: &CleanupManifest,
    manifest_path: &Path,
    entry_index: usize,
) -> Result<Vec<DeletionStep>> {
    let mut plan = Vec::new();
    let mut registered = BTreeSet::new();
    for path in &manifest.temporary_paths {
        if registered.insert(path.clone()) {
            plan.push(DeletionStep {
                path: path.clone(),
                operation_directory: directory.to_path_buf(),
                kind: DeletionKind::Temporary,
            });
        }
    }
    let mut ancestors = BTreeSet::new();
    for path in &registered {
        let mut ancestor = path.parent();
        while let Some(path) = ancestor {
            if path == directory {
                break;
            }
            ancestors.insert(path.to_path_buf());
            ancestor = path.parent();
        }
    }
    let mut ancestors = ancestors.into_iter().collect::<Vec<_>>();
    ancestors.sort_by(|left, right| {
        right
            .components()
            .count()
            .cmp(&left.components().count())
            .then_with(|| left.cmp(right))
    });
    for path in ancestors {
        plan.push(DeletionStep {
            path,
            operation_directory: directory.to_path_buf(),
            kind: DeletionKind::Directory { entry_index: None },
        });
    }
    let temporary_manifest = directory.join(".manifest.toml.tmp");
    match fs::symlink_metadata(&temporary_manifest) {
        Ok(_) => {
            require_regular_file(&temporary_manifest, "temporary cleanup manifest")?;
            plan.push(DeletionStep {
                path: temporary_manifest,
                operation_directory: directory.to_path_buf(),
                kind: DeletionKind::Manifest,
            });
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => {
            return Err(storage_error(
                "inspect_cleanup_manifest",
                &temporary_manifest,
                error,
            ));
        }
    }
    plan.push(DeletionStep {
        path: manifest_path.to_path_buf(),
        operation_directory: directory.to_path_buf(),
        kind: DeletionKind::Manifest,
    });
    plan.push(DeletionStep {
        path: directory.to_path_buf(),
        operation_directory: directory.to_path_buf(),
        kind: DeletionKind::Directory {
            entry_index: Some(entry_index),
        },
    });
    Ok(plan)
}

fn execute_deletion_plan(
    plan: &[DeletionStep],
    entries: &mut [GcEntry],
    mut remove: impl FnMut(&DeletionStep) -> Result<()>,
) -> Result<Vec<PathBuf>> {
    let mut completed = Vec::new();
    for (index, step) in plan.iter().enumerate() {
        if let Err(error) = remove(step) {
            return Err(TkError::partial_commit(
                "Garbage collection stopped before completing its deletion plan",
                serde_json::json!(completed),
                serde_json::json!(
                    plan[index..]
                        .iter()
                        .map(|step| step.path.clone())
                        .collect::<Vec<_>>()
                ),
                error,
            ));
        }
        completed.push(step.path.clone());
        if let DeletionKind::Directory {
            entry_index: Some(entry_index),
        } = step.kind
        {
            entries[entry_index].removed = true;
        }
    }
    Ok(completed)
}

fn remove_deletion_step(step: &DeletionStep) -> Result<()> {
    match step.kind {
        DeletionKind::Temporary => remove_temporary_path(&step.operation_directory, &step.path),
        DeletionKind::Manifest => remove_known_file(&step.path),
        DeletionKind::Directory { .. } => remove_known_directory(&step.path),
    }
}

pub fn ensure_project_writable(task_root: &Path) -> Result<()> {
    let root = task_root.join(".tk-tmp");
    let markers = operation_directories(&root)?;
    if markers.is_empty() {
        return Ok(());
    }
    Err(TkError::new(
        "operation_in_progress",
        ErrorCategory::Conflict,
        format!(
            "A tk project activity marker exists under {}; run 'tk gc' after the producer exits",
            root.display()
        ),
    )
    .with_details(serde_json::json!({"markers": markers})))
}

pub fn begin_project_operation(task_root: &Path) -> Result<CleanupOperation> {
    ensure_project_writable(task_root)?;
    begin_operation(task_root, task_root.join(".tk-tmp"))
}

pub fn begin_user_operation(scope: &Path) -> Result<CleanupOperation> {
    let root = user_temp_root()?;
    let markers = operation_directories(&root)?;
    if !markers.is_empty() {
        return Err(TkError::new(
            "operation_in_progress",
            ErrorCategory::Conflict,
            format!(
                "A tk component operation marker exists under {}; run 'tk gc' after the producer exits",
                root.display()
            ),
        )
        .with_details(serde_json::json!({"markers": markers})));
    }
    begin_operation(scope, root)
}

fn begin_operation(scope: &Path, root: PathBuf) -> Result<CleanupOperation> {
    match fs::symlink_metadata(&root) {
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => {
            return Err(TkError::new(
                "unsafe_temporary_root",
                ErrorCategory::Storage,
                format!(
                    "Temporary operation root must be a real directory: {}",
                    root.display()
                ),
            ));
        }
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(storage_error("inspect_temporary_root", &root, error)),
    }
    crate::cancel::begin_write()?;
    fs::create_dir_all(&root)
        .map_err(|error| storage_error("create_temporary_root", &root, error))?;
    let producer = producer()?;
    let operation_id = Uuid::now_v7();
    let directory = root.join(format!(
        "{}--{}--{}--{operation_id}",
        producer.boot_id, producer.pid, producer.start_ticks
    ));
    fs::create_dir(&directory)
        .map_err(|error| storage_error("create_temporary_operation", &directory, error))?;
    let manifest = CleanupManifest {
        format_version: FORMAT_VERSION,
        operation_id,
        producer,
        created_at: Utc::now(),
        scope: scope.to_path_buf(),
        temporary_paths: Vec::new(),
    };
    if let Err(error) = write_manifest(&directory, &manifest) {
        let _ = fs::remove_dir_all(&directory);
        return Err(error);
    }
    Ok(CleanupOperation {
        directory,
        manifest,
        finished: false,
    })
}

fn write_manifest(directory: &Path, manifest: &CleanupManifest) -> Result<()> {
    let path = directory.join(MANIFEST_FILE);
    let temporary = directory.join(".manifest.toml.tmp");
    let text = toml::to_string_pretty(manifest).map_err(|error| {
        TkError::new(
            "serialize_cleanup_manifest_failed",
            ErrorCategory::Internal,
            error.to_string(),
        )
    })?;
    fs::write(&temporary, text)
        .map_err(|error| storage_error("write_cleanup_manifest", &temporary, error))?;
    fs::rename(&temporary, &path)
        .map_err(|error| storage_error("commit_cleanup_manifest", &path, error))
}

pub fn producer() -> Result<ProducerIdentity> {
    let boot_path = Path::new("/proc/sys/kernel/random/boot_id");
    let boot_id = fs::read_to_string(boot_path)
        .map_err(|error| storage_error("read_boot_id", boot_path, error))?
        .trim()
        .to_owned();
    let pid = std::process::id();
    let stat_path = PathBuf::from(format!("/proc/{pid}/stat"));
    let stat = fs::read_to_string(&stat_path)
        .map_err(|error| storage_error("read_process_identity", &stat_path, error))?;
    let (_, fields) = stat.rsplit_once(')').ok_or_else(|| {
        TkError::new(
            "invalid_process_identity",
            ErrorCategory::Environment,
            format!("Could not parse {}", stat_path.display()),
        )
    })?;
    let start_ticks = fields
        .split_whitespace()
        .nth(19)
        .and_then(|value| value.parse::<u64>().ok())
        .ok_or_else(|| {
            TkError::new(
                "invalid_process_identity",
                ErrorCategory::Environment,
                format!(
                    "Could not parse process start ticks from {}",
                    stat_path.display()
                ),
            )
        })?;
    Ok(ProducerIdentity {
        boot_id,
        pid,
        start_ticks,
    })
}

pub fn user_state_root() -> Result<PathBuf> {
    if let Some(path) = env::var_os("XDG_STATE_HOME") {
        return Ok(PathBuf::from(path).join("tk"));
    }
    let home = env::var_os("HOME").ok_or_else(|| {
        TkError::new(
            "state_home_unavailable",
            ErrorCategory::Environment,
            "HOME and XDG_STATE_HOME are both unavailable",
        )
    })?;
    Ok(PathBuf::from(home).join(".local/state/tk"))
}

pub(crate) fn user_temp_root() -> Result<PathBuf> {
    Ok(user_state_root()?.join("tmp"))
}

pub(crate) fn operation_directories(root: &Path) -> Result<Vec<PathBuf>> {
    let metadata = match fs::symlink_metadata(root) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(storage_error("inspect_temporary_root", root, error)),
    };
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Ok(Vec::new());
    }
    let mut directories = Vec::new();
    for entry in fs::read_dir(root)
        .map_err(|error| storage_error("scan_temporary_operations", root, error))?
    {
        let entry =
            entry.map_err(|error| storage_error("scan_temporary_operations", root, error))?;
        let path = entry.path();
        let metadata = fs::symlink_metadata(&path)
            .map_err(|error| storage_error("inspect_temporary_operation", &path, error))?;
        if metadata.is_dir() && !metadata.file_type().is_symlink() {
            directories.push(path);
        }
    }
    directories.sort();
    Ok(directories)
}

fn read_manifest(path: &Path) -> Result<CleanupManifest> {
    let text = fs::read_to_string(path)
        .map_err(|error| storage_error("read_cleanup_manifest", path, error))?;
    let manifest: CleanupManifest = toml::from_str(&text).map_err(|error| {
        TkError::new(
            "invalid_cleanup_manifest",
            ErrorCategory::ManagedFile,
            format!("{}: {error}", path.display()),
        )
    })?;
    if manifest.format_version != FORMAT_VERSION {
        return Err(TkError::new(
            "unsupported_cleanup_manifest",
            ErrorCategory::Compatibility,
            format!(
                "{} uses cleanup manifest format {}",
                path.display(),
                manifest.format_version
            ),
        ));
    }
    Ok(manifest)
}

fn remove_temporary_path(directory: &Path, path: &Path) -> Result<()> {
    validate_temporary_path(directory, path)?;
    validate_existing_path_chain(directory, path)?;
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(storage_error("inspect_temporary_item", path, error)),
    };
    if metadata.is_dir() {
        fs::remove_dir_all(path)
            .map_err(|error| storage_error("remove_temporary_item", path, error))
    } else if metadata.is_file() {
        fs::remove_file(path).map_err(|error| storage_error("remove_temporary_item", path, error))
    } else {
        Err(unsafe_cleanup_entry(path))
    }
}

fn remove_known_file(path: &Path) -> Result<()> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.is_file() && !metadata.file_type().is_symlink() => {
            fs::remove_file(path)
                .map_err(|error| storage_error("remove_cleanup_manifest", path, error))
        }
        Ok(_) => Err(unsafe_cleanup_entry(path)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(storage_error("inspect_cleanup_manifest", path, error)),
    }
}

fn remove_known_directory(path: &Path) -> Result<()> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.is_dir() && !metadata.file_type().is_symlink() => {
            fs::remove_dir(path)
                .map_err(|error| storage_error("remove_temporary_directory", path, error))
        }
        Ok(_) => Err(unsafe_cleanup_entry(path)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(storage_error("inspect_temporary_directory", path, error)),
    }
}

fn require_regular_file(path: &Path, description: &str) -> Result<()> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.is_file() && !metadata.file_type().is_symlink() => Ok(()),
        Ok(_) => Err(TkError::new(
            "unsafe_cleanup_entry",
            ErrorCategory::Conflict,
            format!(
                "The {description} is not a regular file: {}",
                path.display()
            ),
        )),
        Err(error) => Err(storage_error("inspect_cleanup_manifest", path, error)),
    }
}

fn validate_temporary_path(directory: &Path, path: &Path) -> Result<()> {
    let has_parent = path
        .components()
        .any(|component| matches!(component, Component::ParentDir));
    let reserved =
        path == directory.join(MANIFEST_FILE) || path == directory.join(".manifest.toml.tmp");
    if !has_parent && !reserved && path.starts_with(directory) && path != directory {
        return Ok(());
    }
    Err(TkError::new(
        "invalid_cleanup_path",
        ErrorCategory::Conflict,
        format!(
            "Temporary path is outside its cleanup operation or reserved: {}",
            path.display()
        ),
    ))
}

fn validate_existing_path_chain(directory: &Path, path: &Path) -> Result<()> {
    let relative = path
        .strip_prefix(directory)
        .map_err(|_| unsafe_cleanup_entry(path))?;
    let components = relative.components().collect::<Vec<_>>();
    let mut current = directory.to_path_buf();
    for (index, component) in components.iter().enumerate() {
        let Component::Normal(component) = component else {
            return Err(unsafe_cleanup_entry(path));
        };
        current.push(component);
        let metadata = match fs::symlink_metadata(&current) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
            Err(error) => return Err(storage_error("inspect_temporary_item", &current, error)),
        };
        if metadata.file_type().is_symlink()
            || (!metadata.is_file() && !metadata.is_dir())
            || (index + 1 < components.len() && !metadata.is_dir())
        {
            return Err(unsafe_cleanup_entry(&current));
        }
    }
    Ok(())
}

fn validate_operation_contents(directory: &Path, manifest: &CleanupManifest) -> Result<()> {
    for entry in fs::read_dir(directory)
        .map_err(|error| storage_error("scan_temporary_operation", directory, error))?
    {
        let entry =
            entry.map_err(|error| storage_error("scan_temporary_operation", directory, error))?;
        let path = entry.path();
        if path == directory.join(MANIFEST_FILE) || path == directory.join(".manifest.toml.tmp") {
            continue;
        }
        let covered = manifest
            .temporary_paths
            .iter()
            .any(|temporary| temporary.starts_with(&path) || path.starts_with(temporary));
        if !covered {
            return Err(TkError::new(
                "unknown_cleanup_content",
                ErrorCategory::Conflict,
                format!(
                    "Cleanup operation contains unregistered content: {}",
                    path.display()
                ),
            ));
        }
    }
    Ok(())
}

fn unsafe_cleanup_entry(path: &Path) -> TkError {
    TkError::new(
        "unsafe_cleanup_entry",
        ErrorCategory::Conflict,
        format!(
            "Refusing to remove an unsupported cleanup entry: {}",
            path.display()
        ),
    )
}

fn classify(directory: &Path, manifest: &CleanupManifest) -> Result<GcClassification> {
    for path in &manifest.temporary_paths {
        validate_temporary_path(directory, path)?;
        validate_existing_path_chain(directory, path)?;
    }
    validate_operation_contents(directory, manifest)?;
    Ok(match producer_status(&manifest.producer) {
        ProducerStatus::Active => GcClassification::Active,
        ProducerStatus::Inactive => GcClassification::Disposable,
        ProducerStatus::Unknown => GcClassification::Unknown,
    })
}

pub(crate) fn producer_status(identity: &ProducerIdentity) -> ProducerStatus {
    let boot_path = Path::new("/proc/sys/kernel/random/boot_id");
    let Ok(boot_id) = fs::read_to_string(boot_path) else {
        return ProducerStatus::Unknown;
    };
    if boot_id.trim() != identity.boot_id {
        return ProducerStatus::Inactive;
    }
    let stat_path = PathBuf::from(format!("/proc/{}/stat", identity.pid));
    let stat = match fs::read_to_string(stat_path) {
        Ok(stat) => stat,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return ProducerStatus::Inactive;
        }
        Err(_) => return ProducerStatus::Unknown,
    };
    match stat
        .rsplit_once(')')
        .and_then(|(_, fields)| fields.split_whitespace().nth(19))
        .and_then(|value| value.parse::<u64>().ok())
    {
        Some(start_ticks) if start_ticks == identity.start_ticks => ProducerStatus::Active,
        Some(_) => ProducerStatus::Inactive,
        None => ProducerStatus::Unknown,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_live_and_dead_producers() {
        let root = env::temp_dir().join(format!("tk-gc-test-{}", Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        let manifest = CleanupManifest {
            format_version: FORMAT_VERSION,
            operation_id: Uuid::now_v7(),
            producer: producer().unwrap(),
            created_at: Utc::now(),
            scope: root.clone(),
            temporary_paths: vec![root.join("staging")],
        };
        assert_eq!(
            classify(&root, &manifest).unwrap(),
            GcClassification::Active
        );
        let mut dead = manifest;
        dead.producer.start_ticks += 1;
        assert_eq!(
            classify(&root, &dead).unwrap(),
            GcClassification::Disposable
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_cleanup_paths_outside_operation() {
        let root = env::temp_dir().join(format!("tk-gc-test-{}", Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        let manifest = CleanupManifest {
            format_version: FORMAT_VERSION,
            operation_id: Uuid::now_v7(),
            producer: producer().unwrap(),
            created_at: Utc::now(),
            scope: root.clone(),
            temporary_paths: vec![root.join("../outside")],
        };
        assert!(classify(&root, &manifest).is_err());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn discovers_cleanup_operations_under_custom_task_root() {
        let root = env::temp_dir().join(format!("tk-gc-project-test-{}", Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        crate::project::init(
            &root,
            crate::project::InitOptions {
                task_root: Some("tasks".into()),
                ..crate::project::InitOptions::default()
            },
        )
        .unwrap();
        let project = crate::project::discover(&root).unwrap();
        let operation = begin_project_operation(&project.task_root).unwrap();
        let operation_path = operation.path().to_path_buf();

        let result = run(Some(&root), true).unwrap();
        assert!(result.project_discovered);
        assert!(
            result
                .entries
                .iter()
                .any(|entry| entry.manifest == operation_path.join(MANIFEST_FILE))
        );

        operation.finish().unwrap();
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn begin_project_operation_rejects_a_symlinked_temporary_root() {
        use std::os::unix::fs::symlink;

        let root = env::temp_dir().join(format!("tk-gc-project-test-{}", Uuid::now_v7()));
        let outside = env::temp_dir().join(format!("tk-gc-outside-test-{}", Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        fs::create_dir(&outside).unwrap();
        symlink(&outside, root.join(".tk-tmp")).unwrap();
        let error = begin_project_operation(&root).unwrap_err();
        assert_eq!(error.code, "unsafe_temporary_root");
        assert!(fs::read_dir(&outside).unwrap().next().is_none());
        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }

    fn dead_manifest(directory: &Path, temporary_paths: Vec<PathBuf>) -> CleanupManifest {
        let mut identity = producer().unwrap();
        identity.start_ticks += 1;
        CleanupManifest {
            format_version: FORMAT_VERSION,
            operation_id: Uuid::now_v7(),
            producer: identity,
            created_at: Utc::now(),
            scope: directory.to_path_buf(),
            temporary_paths,
        }
    }

    #[test]
    fn failed_operation_cleanup_allows_another_write_in_the_same_process() {
        let root = env::temp_dir().join(format!("tk-operation-guard-test-{}", Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        let operation = begin_project_operation(&root).unwrap();
        let error = operation
            .execute(
                |_operation| Err::<(), _>(TkError::request("planned_failure", "planned failure")),
                |_, _, _| unreachable!(),
            )
            .unwrap_err();
        assert_eq!(error.code, "planned_failure");
        begin_project_operation(&root).unwrap().finish().unwrap();
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn preserves_unknown_root_content_and_registered_symlinks() {
        use std::os::unix::fs::symlink;

        let root = env::temp_dir().join(format!("tk-gc-symlink-test-{}", Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        let unknown_file = root.join("unexpected");
        fs::write(&unknown_file, b"keep").unwrap();
        let external_file = root.with_extension("external-file");
        fs::write(&external_file, b"keep").unwrap();
        let unknown_link = root.join("unexpected-link");
        symlink(&external_file, &unknown_link).unwrap();

        for (name, external) in [
            ("file-link", external_file.clone()),
            ("directory-link", root.with_extension("external-directory")),
        ] {
            if name == "directory-link" {
                fs::create_dir(&external).unwrap();
            }
            let directory = root.join(name);
            fs::create_dir(&directory).unwrap();
            let temporary = directory.join("payload");
            symlink(&external, &temporary).unwrap();
            let manifest = dead_manifest(&directory, vec![temporary]);
            write_manifest(&directory, &manifest).unwrap();
        }

        let mut entries = Vec::new();
        let mut warnings = Vec::new();
        let mut plan = Vec::new();
        inspect_temporary_root(&root, &mut entries, &mut warnings, &mut plan).unwrap();
        assert!(plan.is_empty());
        assert!(
            entries
                .iter()
                .all(|entry| entry.classification == GcClassification::Unknown)
        );
        assert!(unknown_file.exists());
        assert!(unknown_link.symlink_metadata().is_ok());
        assert!(root.join("file-link/payload").symlink_metadata().is_ok());
        assert!(
            root.join("directory-link/payload")
                .symlink_metadata()
                .is_ok()
        );
        fs::remove_dir_all(&root).unwrap();
        fs::remove_file(external_file).unwrap();
        fs::remove_dir(root.with_extension("external-directory")).unwrap();
    }

    #[test]
    fn failure_reports_the_entire_remaining_deletion_plan() {
        let root = env::temp_dir().join(format!("tk-gc-plan-test-{}", Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        let mut later_path = PathBuf::new();
        for index in 0..2 {
            let directory = root.join(format!("operation-{index}"));
            fs::create_dir(&directory).unwrap();
            let temporary = directory.join("payload");
            fs::write(&temporary, b"temporary").unwrap();
            if index == 1 {
                later_path = temporary.clone();
            }
            let manifest = dead_manifest(&directory, vec![temporary]);
            write_manifest(&directory, &manifest).unwrap();
        }

        let mut entries = Vec::new();
        let mut warnings = Vec::new();
        let mut plan = Vec::new();
        inspect_temporary_root(&root, &mut entries, &mut warnings, &mut plan).unwrap();
        let error = execute_deletion_plan(&plan, &mut entries, |_step| {
            Err(TkError::new(
                "injected_remove_failure",
                ErrorCategory::Storage,
                "injected remove failure",
            ))
        })
        .unwrap_err();
        assert_eq!(error.code, "partial_commit");
        let uncompleted = error.details.unwrap()["uncompleted"]
            .as_array()
            .unwrap()
            .clone();
        assert!(uncompleted.contains(&serde_json::json!(later_path)));
        fs::remove_dir_all(root).unwrap();
    }
}
