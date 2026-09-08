use std::fmt;
use std::fs;
use std::path::{Path, PathBuf};
use std::str::FromStr;

use serde::{Deserialize, Serialize};

use crate::error::{ErrorCategory, Result, TkError};
use crate::git;
use crate::path::{atomic_write, storage_error, validate_relative_path};

pub const CONFIG_PATH: &str = ".agents/tk_config.toml";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum GitPolicy {
    Track,
    Ignore,
    #[default]
    None,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum CreationPolicy {
    #[default]
    Strict,
    Permissive,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum MetadataMode {
    #[default]
    Split,
    Embed,
}

macro_rules! impl_text_enum {
    ($type:ty, {$($text:literal => $value:path),+ $(,)?}) => {
        impl FromStr for $type {
            type Err = TkError;

            fn from_str(value: &str) -> Result<Self> {
                match value {
                    $($text => Ok($value),)+
                    _ => Err(TkError::configuration(
                        "invalid_configuration_value",
                        format!("Unsupported value: {value}"),
                    )),
                }
            }
        }

        impl fmt::Display for $type {
            fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                let value = match self {
                    $($value => $text,)+
                };
                formatter.write_str(value)
            }
        }
    };
}

impl_text_enum!(GitPolicy, {"track" => GitPolicy::Track, "ignore" => GitPolicy::Ignore, "none" => GitPolicy::None});
impl_text_enum!(CreationPolicy, {"strict" => CreationPolicy::Strict, "permissive" => CreationPolicy::Permissive});
impl_text_enum!(MetadataMode, {"split" => MetadataMode::Split, "embed" => MetadataMode::Embed});

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProjectConfig {
    pub task_root: PathBuf,
    pub subtasks_dir: PathBuf,
    pub git_policy: GitPolicy,
    pub creation_policy: CreationPolicy,
    pub metadata_mode: MetadataMode,
}

impl Default for ProjectConfig {
    fn default() -> Self {
        Self {
            task_root: PathBuf::from(".tk"),
            subtasks_dir: PathBuf::new(),
            git_policy: GitPolicy::None,
            creation_policy: CreationPolicy::Strict,
            metadata_mode: MetadataMode::Split,
        }
    }
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct SparseConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    task_root: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    subtasks_dir: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    git_policy: Option<GitPolicy>,
    #[serde(skip_serializing_if = "Option::is_none")]
    creation_policy: Option<CreationPolicy>,
    #[serde(skip_serializing_if = "Option::is_none")]
    metadata_mode: Option<MetadataMode>,
}

#[derive(Debug)]
pub struct Project {
    pub root: PathBuf,
    pub task_root: PathBuf,
    pub config_path: PathBuf,
    pub config: ProjectConfig,
}

#[derive(Debug, Default)]
pub struct InitOptions {
    pub task_root: Option<String>,
    pub subtasks_dir: Option<String>,
    pub git_policy: Option<GitPolicy>,
    pub creation_policy: Option<CreationPolicy>,
    pub metadata_mode: Option<MetadataMode>,
    pub force: bool,
}

#[derive(Debug)]
pub struct InitResult {
    pub project: Project,
}

pub fn ensure_mutable(project: &Project) -> Result<()> {
    validate_task_root(&project.root, &project.task_root, true)?;
    crate::gc::ensure_project_writable(&project.task_root)?;
    git::check_policy(
        &project.root,
        &project.task_root,
        project
            .config_path
            .exists()
            .then_some(project.config_path.as_path()),
        project.config.git_policy,
    )
}

pub fn set_metadata_mode(project: &Project, mode: MetadataMode) -> Result<()> {
    let mut config = project.config.clone();
    config.metadata_mode = mode;
    write_config(&project.config_path, &config)
}

impl ProjectConfig {
    fn from_sparse(sparse: SparseConfig) -> Result<Self> {
        let defaults = Self::default();
        Ok(Self {
            task_root: match sparse.task_root {
                Some(value) => validate_relative_path(&value, false)?,
                None => defaults.task_root,
            },
            subtasks_dir: match sparse.subtasks_dir {
                Some(value) => validate_relative_path(&value, true)?,
                None => defaults.subtasks_dir,
            },
            git_policy: sparse.git_policy.unwrap_or(defaults.git_policy),
            creation_policy: sparse.creation_policy.unwrap_or(defaults.creation_policy),
            metadata_mode: sparse.metadata_mode.unwrap_or(defaults.metadata_mode),
        })
    }

    fn sparse(&self) -> SparseConfig {
        let defaults = Self::default();
        SparseConfig {
            task_root: (self.task_root != defaults.task_root)
                .then(|| self.task_root.to_string_lossy().into_owned()),
            subtasks_dir: (self.subtasks_dir != defaults.subtasks_dir)
                .then(|| self.subtasks_dir.to_string_lossy().into_owned()),
            git_policy: (self.git_policy != defaults.git_policy).then_some(self.git_policy),
            creation_policy: (self.creation_policy != defaults.creation_policy)
                .then_some(self.creation_policy),
            metadata_mode: (self.metadata_mode != defaults.metadata_mode)
                .then_some(self.metadata_mode),
        }
    }
}

pub fn discover(cwd: &Path) -> Result<Project> {
    discover_unchecked(cwd)
}

pub fn discover_unchecked(cwd: &Path) -> Result<Project> {
    const NON_GIT_DISCOVERY_LIMIT: usize = 8;

    let cwd = absolute_directory(cwd)?;
    for path in cwd.ancestors().take(NON_GIT_DISCOVERY_LIMIT) {
        if is_project_candidate(path) {
            return load(path);
        }
    }

    if let Some(git_root) = git::git_root(&cwd).ok().flatten()
        && !cwd
            .ancestors()
            .take(NON_GIT_DISCOVERY_LIMIT)
            .any(|path| path == git_root)
    {
        for path in cwd.ancestors().skip(NON_GIT_DISCOVERY_LIMIT) {
            if is_project_candidate(path) {
                return load(path);
            }
            if path == git_root {
                break;
            }
        }
    }

    Err(TkError::new(
        "project_not_initialized",
        ErrorCategory::Context,
        format!("No tk project found from {}", cwd.display()),
    ))
}

pub fn init(cwd: &Path, options: InitOptions) -> Result<InitResult> {
    let root = absolute_directory(cwd)?;
    let config_path = root.join(CONFIG_PATH);
    let config = ProjectConfig {
        task_root: validate_relative_path(options.task_root.as_deref().unwrap_or(".tk"), false)?,
        subtasks_dir: validate_relative_path(options.subtasks_dir.as_deref().unwrap_or(""), true)?,
        git_policy: options.git_policy.unwrap_or_default(),
        creation_policy: options.creation_policy.unwrap_or_default(),
        metadata_mode: options.metadata_mode.unwrap_or_default(),
    };
    let task_root = root.join(&config.task_root);
    validate_task_root(&root, &task_root, false)?;

    if !options.force && (config_path.exists() || task_root.exists()) {
        return Err(TkError::new(
            "project_already_initialized",
            ErrorCategory::Conflict,
            format!("tk project already exists at {}", root.display()),
        ));
    }

    git::check_policy(
        &root,
        &task_root,
        config_path.exists().then_some(config_path.as_path()),
        config.git_policy,
    )?;
    crate::cancel::begin_write()?;
    fs::create_dir_all(&task_root)
        .map_err(|error| storage_error("create_task_root", &task_root, error))?;
    write_config(&config_path, &config)?;

    Ok(InitResult {
        project: Project {
            root,
            task_root,
            config_path,
            config,
        },
    })
}

fn load(root: &Path) -> Result<Project> {
    let config_path = root.join(CONFIG_PATH);
    let config = read_config(&config_path)?;
    let task_root = root.join(&config.task_root);
    validate_task_root(root, &task_root, true)?;
    Ok(Project {
        root: root.to_path_buf(),
        task_root,
        config_path,
        config,
    })
}

fn validate_task_root(root: &Path, task_root: &Path, must_exist: bool) -> Result<()> {
    let relative = task_root.strip_prefix(root).map_err(|_| {
        TkError::configuration(
            "invalid_task_root",
            format!("Task root is outside the project: {}", task_root.display()),
        )
    })?;
    let mut current = root.to_path_buf();
    let mut missing = false;
    for component in relative.components() {
        current.push(component.as_os_str());
        if missing {
            continue;
        }
        match fs::symlink_metadata(&current) {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                return Err(TkError::configuration(
                    "invalid_task_root",
                    format!("Task root cannot contain symlinks: {}", current.display()),
                ));
            }
            Ok(metadata) if !metadata.is_dir() => {
                return Err(TkError::configuration(
                    "invalid_task_root",
                    format!(
                        "Task root component is not a directory: {}",
                        current.display()
                    ),
                ));
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => missing = true,
            Err(error) => return Err(storage_error("inspect_task_root", &current, error)),
        }
    }
    if must_exist && missing {
        return Err(TkError::new(
            "project_not_initialized",
            ErrorCategory::Context,
            format!("Configured Task root is missing: {}", task_root.display()),
        ));
    }
    if !missing {
        let canonical_root = root
            .canonicalize()
            .map_err(|error| storage_error("resolve_project_root", root, error))?;
        let canonical_tasks = task_root
            .canonicalize()
            .map_err(|error| storage_error("resolve_task_root", task_root, error))?;
        if !canonical_tasks.starts_with(&canonical_root) {
            return Err(TkError::configuration(
                "invalid_task_root",
                format!(
                    "Task root resolves outside the project: {}",
                    task_root.display()
                ),
            ));
        }
    }
    Ok(())
}

pub fn ensure_safe_project_path(root: &Path, path: &Path) -> Result<()> {
    let relative = path.strip_prefix(root).map_err(|_| {
        TkError::new(
            "invalid_exact_path",
            ErrorCategory::Context,
            format!("Path is outside the project: {}", path.display()),
        )
    })?;
    let mut current = root.to_path_buf();
    let mut missing = false;
    for component in relative.components() {
        let std::path::Component::Normal(value) = component else {
            return Err(TkError::new(
                "invalid_exact_path",
                ErrorCategory::Context,
                format!("Path is not structurally safe: {}", path.display()),
            ));
        };
        current.push(value);
        if missing {
            continue;
        }
        match fs::symlink_metadata(&current) {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                return Err(TkError::new(
                    "invalid_exact_path",
                    ErrorCategory::Context,
                    format!("Exact paths cannot contain symlinks: {}", current.display()),
                ));
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => missing = true,
            Err(error) => return Err(storage_error("inspect_exact_path", &current, error)),
        }
    }
    Ok(())
}

pub fn discover_from_exact_path(path: &Path) -> Result<Project> {
    discover_from_exact_path_with_validation(path, false)
}

pub fn discover_from_exact_path_for_rename(path: &Path) -> Result<Project> {
    discover_from_exact_path_with_validation(path, true)
}

fn discover_from_exact_path_with_validation(path: &Path, repair_name: bool) -> Result<Project> {
    if !path.is_absolute() || !path.exists() {
        return Err(TkError::new(
            "invalid_exact_path",
            ErrorCategory::Context,
            format!(
                "Exact Task or material path must be an existing absolute path: {}",
                path.display()
            ),
        ));
    }
    let canonical = path
        .canonicalize()
        .map_err(|error| storage_error("resolve_exact_path", path, error))?;
    let start = if canonical.is_dir() {
        canonical.as_path()
    } else {
        canonical.parent().ok_or_else(|| {
            TkError::new(
                "invalid_exact_path",
                ErrorCategory::Context,
                format!("Exact path has no parent: {}", canonical.display()),
            )
        })?
    };

    let mut first_error = None;
    if let Some(git_root) = git::git_root(start).ok().flatten()
        && is_project_candidate(&git_root)
    {
        match load(&git_root) {
            Ok(project) => match project_owns_path(&project, path, start, repair_name) {
                Ok(true) => return Ok(project),
                Ok(false) => {}
                Err(error) => {
                    first_error.get_or_insert(error);
                }
            },
            Err(error) => {
                first_error.get_or_insert(error);
            }
        }
    }

    for task_root in start.ancestors().filter_map(task_root_from_top_level) {
        for candidate in task_root.ancestors().skip(1).take(2) {
            if !is_project_candidate(candidate) {
                continue;
            }
            match load(candidate) {
                Ok(project) if project.task_root == task_root => {
                    match project_owns_path(&project, path, start, repair_name) {
                        Ok(true) => return Ok(project),
                        Ok(false) => {}
                        Err(error) => {
                            first_error.get_or_insert(error);
                        }
                    }
                }
                Ok(_) => {}
                Err(error) => {
                    first_error.get_or_insert(error);
                }
            }
        }
    }
    if let Some(error) = first_error {
        return Err(error);
    }
    Err(TkError::new(
        "project_not_initialized",
        ErrorCategory::Context,
        format!("No tk project owns {}", path.display()),
    ))
}

fn project_owns_path(
    project: &Project,
    original: &Path,
    path: &Path,
    repair_name: bool,
) -> Result<bool> {
    if !path.starts_with(&project.task_root)
        || ensure_safe_project_path(&project.root, original).is_err()
    {
        return Ok(false);
    }
    let graph = if repair_name {
        crate::task_store::discover_tasks_for_rename(
            &project.task_root,
            project.config.metadata_mode,
        )?
    } else {
        crate::task_store::discover_tasks(&project.task_root, project.config.metadata_mode)?
    };
    Ok(graph.owning_task_index(path).is_some())
}

fn task_root_from_top_level(path: &Path) -> Option<&Path> {
    if !is_top_level_task_directory(path) {
        return None;
    }
    let month = path.parent().filter(|value| is_digits(value, 2))?;
    let year = month.parent().filter(|value| is_digits(value, 4))?;
    year.parent()
}

fn is_top_level_task_directory(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
        return false;
    };
    let bytes = name.as_bytes();
    bytes.len() > 7
        && bytes[0..2].iter().all(u8::is_ascii_digit)
        && bytes[2] == b'-'
        && bytes[3..5].iter().all(u8::is_ascii_digit)
        && bytes[5..7] == *b"--"
}

fn is_digits(path: &Path, length: usize) -> bool {
    path.file_name()
        .and_then(|value| value.to_str())
        .is_some_and(|value| {
            value.len() == length && value.bytes().all(|byte| byte.is_ascii_digit())
        })
}

fn read_config(path: &Path) -> Result<ProjectConfig> {
    if !path.exists() {
        return Ok(ProjectConfig::default());
    }
    let contents = fs::read_to_string(path)
        .map_err(|error| storage_error("read_project_config", path, error))?;
    let sparse: SparseConfig = toml::from_str(&contents).map_err(|error| {
        TkError::configuration(
            "invalid_project_configuration",
            format!("{}: {error}", path.display()),
        )
        .with_details(serde_json::json!({"path": path}))
    })?;
    ProjectConfig::from_sparse(sparse)
}

fn write_config(path: &Path, config: &ProjectConfig) -> Result<()> {
    let sparse = config.sparse();
    if sparse.task_root.is_none()
        && sparse.subtasks_dir.is_none()
        && sparse.git_policy.is_none()
        && sparse.creation_policy.is_none()
        && sparse.metadata_mode.is_none()
    {
        if path.exists() {
            fs::remove_file(path)
                .map_err(|error| storage_error("remove_default_config", path, error))?;
        }
        return Ok(());
    }

    let contents = toml::to_string(&sparse).map_err(|error| {
        TkError::new(
            "encode_project_configuration_failed",
            ErrorCategory::Internal,
            error.to_string(),
        )
    })?;
    atomic_write(path, contents.as_bytes())
}

fn is_project_candidate(path: &Path) -> bool {
    path.join(CONFIG_PATH).is_file() || path.join(".tk").is_dir()
}

fn absolute_directory(path: &Path) -> Result<PathBuf> {
    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .map_err(|error| storage_error("read_current_directory", path, error))?
            .join(path)
    };
    let canonical = absolute
        .canonicalize()
        .map_err(|error| storage_error("resolve_working_directory", &absolute, error))?;
    if !canonical.is_dir() {
        return Err(TkError::new(
            "working_directory_not_directory",
            ErrorCategory::Context,
            format!(
                "Working directory is not a directory: {}",
                canonical.display()
            ),
        ));
    }
    Ok(canonical)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_directory() -> PathBuf {
        let path = std::env::temp_dir().join(format!("tk-project-test-{}", uuid::Uuid::now_v7()));
        fs::create_dir(&path).unwrap();
        path
    }

    #[test]
    fn writes_only_non_default_configuration() {
        let root = temp_directory();
        let result = init(&root, InitOptions::default()).unwrap();
        assert!(!result.project.config_path.exists());
        assert_eq!(discover(&root).unwrap().config, ProjectConfig::default());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn discovers_nearby_project_without_git_boundary() {
        let root = temp_directory();
        init(&root, InitOptions::default()).unwrap();
        let nested = root.join("one/two/three");
        fs::create_dir_all(&nested).unwrap();
        assert_eq!(discover(&nested).unwrap().root, root);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_unknown_configuration_keys() {
        let root = temp_directory();
        fs::create_dir(root.join(".agents")).unwrap();
        fs::create_dir(root.join(".tk")).unwrap();
        fs::write(root.join(CONFIG_PATH), "unknown = true\n").unwrap();
        assert!(discover(&root).is_err());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn force_init_rewrites_configuration_without_reading_tasks() {
        let root = temp_directory();
        init(&root, InitOptions::default()).unwrap();
        let task_path = root.join(".tk/TASK.md");
        fs::write(&task_path, "# candidate\n").unwrap();
        let options = InitOptions {
            metadata_mode: Some(MetadataMode::Embed),
            force: true,
            ..InitOptions::default()
        };
        let result = init(&root, options).unwrap();
        assert_eq!(result.project.config.metadata_mode, MetadataMode::Embed);
        assert_eq!(fs::read_to_string(task_path).unwrap(), "# candidate\n");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn exact_path_uses_git_root_for_deep_custom_task_root() {
        let root = temp_directory();
        let status = std::process::Command::new("git")
            .args(["init", "--quiet"])
            .current_dir(&root)
            .status()
            .unwrap();
        assert!(status.success());
        let project = init(
            &root,
            InitOptions {
                task_root: Some("state/work/tasks".into()),
                ..InitOptions::default()
            },
        )
        .unwrap()
        .project;
        let task = project.task_root.join("2026/08/31-01--deep-task");
        crate::task_store::create_task_files(
            &task,
            &crate::domain::Metadata {
                schema_version: crate::version::TASK_SCHEMA_VERSION,
                id: uuid::Uuid::now_v7(),
                name: "deep-task".into(),
                status: crate::domain::Status::Open,
                created_at: chrono::DateTime::parse_from_rfc3339("2026-08-31T12:00:00+08:00")
                    .unwrap(),
                depends_on: vec![],
                related_to: vec![],
                extra: Default::default(),
            },
            b"# deep task\n",
            MetadataMode::Split,
        )
        .unwrap();
        let material = task.join("TASK.md");
        let lookalike = task.join("materials/31-01-single-hyphen");
        fs::create_dir_all(&lookalike).unwrap();
        let nested_material = lookalike.join("notes.md");
        fs::write(&nested_material, "notes\n").unwrap();
        let imported = task.join("materials/imported");
        crate::task_store::create_task_files(
            &imported,
            &crate::domain::Metadata {
                schema_version: crate::version::TASK_SCHEMA_VERSION,
                id: uuid::Uuid::now_v7(),
                name: "imported".into(),
                status: crate::domain::Status::Open,
                created_at: chrono::DateTime::parse_from_rfc3339("2026-08-31T13:00:00+08:00")
                    .unwrap(),
                depends_on: vec![],
                related_to: vec![],
                extra: Default::default(),
            },
            b"# imported\n",
            MetadataMode::Split,
        )
        .unwrap();
        let imported_material = imported.join("notes.md");
        fs::write(&imported_material, "imported notes\n").unwrap();

        assert_eq!(discover_from_exact_path(&material).unwrap().root, root);
        assert_eq!(
            discover_from_exact_path(&nested_material).unwrap().root,
            root
        );
        assert_eq!(discover_from_exact_path(&imported).unwrap().root, root);
        assert_eq!(
            discover_from_exact_path(&imported.join("tk.toml"))
                .unwrap()
                .root,
            root
        );
        assert_eq!(
            discover_from_exact_path(&imported_material).unwrap().root,
            root
        );
        let carrier = task.join("tk.toml");
        let damaged = fs::read_to_string(&carrier)
            .unwrap()
            .replace("name = \"deep-task\"", "name = \"\"");
        fs::write(&carrier, damaged).unwrap();
        assert!(discover_from_exact_path(&carrier).is_err());
        assert_eq!(
            discover_from_exact_path_for_rename(&carrier).unwrap().root,
            root
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_symlinked_task_roots() {
        use std::os::unix::fs::symlink;

        let root = temp_directory();
        let outside = temp_directory();
        symlink(&outside, root.join(".tk")).unwrap();
        let error = discover(&root).unwrap_err();
        assert_eq!(error.code, "invalid_task_root");
        assert!(outside.read_dir().unwrap().next().is_none());
        fs::remove_file(root.join(".tk")).unwrap();
        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }

    #[test]
    fn force_init_rejects_a_symlink_inside_custom_task_root() {
        use std::os::unix::fs::symlink;

        let root = temp_directory();
        let outside = temp_directory();
        symlink(&outside, root.join("state")).unwrap();
        let error = init(
            &root,
            InitOptions {
                task_root: Some("state/tasks".into()),
                force: true,
                ..InitOptions::default()
            },
        )
        .unwrap_err();
        assert_eq!(error.code, "invalid_task_root");
        assert!(!outside.join("tasks").exists());
        fs::remove_file(root.join("state")).unwrap();
        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }

    #[test]
    fn write_preflight_rejects_a_task_root_replaced_by_a_symlink() {
        use std::os::unix::fs::symlink;

        let root = temp_directory();
        let outside = temp_directory();
        let project = init(&root, InitOptions::default()).unwrap().project;
        fs::remove_dir(&project.task_root).unwrap();
        symlink(&outside, &project.task_root).unwrap();
        let error = ensure_mutable(&project).unwrap_err();
        assert_eq!(error.code, "invalid_task_root");
        assert!(!outside.join(".tk-tmp").exists());
        fs::remove_file(&project.task_root).unwrap();
        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }
}
