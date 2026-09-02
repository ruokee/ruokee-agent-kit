use std::collections::{BTreeMap, BTreeSet};
use std::env;
use std::fs;
use std::io::Read;
use std::os::unix::ffi::OsStrExt;
use std::os::unix::fs::PermissionsExt;
use std::path::{Component, Path, PathBuf};
use std::process::{Command, Output};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::error::{ErrorCategory, Result, TkError};
use crate::path::storage_error;
use crate::version::{COMPONENT_FORMAT_VERSION, RUNTIME_VERSION, require_compatible};

const DRIVER_CONTRACT_VERSION: u32 = 1;
const EMBEDDED_ARCHIVE: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/tk-components.tar.zst"));
const EMBEDDED_MANIFEST: &[u8] =
    include_bytes!(concat!(env!("OUT_DIR"), "/tk-components.manifest.json"));

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Harness {
    Codex,
    Claude,
    Pi,
    Omp,
}

impl Harness {
    fn name(self) -> &'static str {
        match self {
            Self::Codex => "codex",
            Self::Claude => "claude",
            Self::Pi => "pi",
            Self::Omp => "omp",
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct BundleManifest {
    component_format_version: u32,
    runtime_version: String,
    source_revision: String,
    archive_sha256: String,
    driver_contract_version: u32,
    components: BTreeMap<String, ComponentManifest>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct ComponentManifest {
    runtime_compat: String,
    payload: String,
    files: BTreeMap<String, FileManifest>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct FileManifest {
    sha256: String,
    mode: u32,
}

struct PayloadFile {
    bytes: Vec<u8>,
    mode: u32,
}

struct Bundle {
    manifest: BundleManifest,
    files: BTreeMap<String, PayloadFile>,
}

#[derive(Debug, Serialize)]
pub struct ComponentResult {
    pub harness: Harness,
    pub action: &'static str,
    pub version: String,
    pub runtime_compat: String,
    pub source_revision: String,
    pub changed: bool,
    pub committed: bool,
    pub partial: bool,
    pub dry_run: bool,
    pub completed: Vec<String>,
    pub uncompleted: Vec<String>,
    pub installed_paths: Vec<PathBuf>,
    pub removed_paths: Vec<PathBuf>,
}

pub fn install(harness: Harness, dry_run: bool) -> Result<ComponentResult> {
    let home = home()?;
    let runtime = home.join(".local/bin/tk");
    require_runtime(&runtime)?;
    require_harness(harness)?;
    let bundle = embedded_bundle()?;
    let component = bundle
        .manifest
        .components
        .get(harness.name())
        .expect("validated component exists");
    require_compatible(&component.runtime_compat)?;
    let target = component_target(harness, &home);
    let target_existed = entry_exists(&target)?;
    let target_before = target_fingerprint(&target)?;
    let registration =
        registration_state(harness, &target, &runtime, &bundle.manifest.runtime_version)?;
    let changed = component_differs(&target, component, &bundle.files)? || !registration.matches;
    let action = if !changed {
        "no_change"
    } else if dry_run {
        "would_install"
    } else if target_existed {
        "updated"
    } else {
        "installed"
    };
    let mut result = ComponentResult {
        harness,
        action,
        version: bundle.manifest.runtime_version.clone(),
        runtime_compat: component.runtime_compat.clone(),
        source_revision: bundle.manifest.source_revision.clone(),
        changed,
        committed: false,
        partial: false,
        dry_run,
        completed: Vec::new(),
        uncompleted: if changed {
            vec![target.display().to_string(), "Harness registration".into()]
        } else {
            Vec::new()
        },
        installed_paths: if changed {
            vec![target.clone()]
        } else {
            Vec::new()
        },
        removed_paths: Vec::new(),
    };
    if !changed || dry_run {
        return Ok(result);
    }

    let operation = crate::gc::begin_user_operation(&target)?;
    let completed = operation.execute(
        |operation| {
            let staging = operation.temporary_path("component")?;
            materialize_component(&staging, component, &bundle.files)?;
            crate::cancel::checkpoint()?;
            let current_registration =
                registration_state(harness, &target, &runtime, &bundle.manifest.runtime_version)?;
            if target_fingerprint(&target)? != target_before || current_registration != registration
            {
                return Err(TkError::new(
                    "changed_since_plan",
                    ErrorCategory::Conflict,
                    "Harness component state changed after preflight",
                ));
            }

            let mut completed = Vec::new();
            replace_target(&staging, &target)?;
            completed.push(target.display().to_string());
            if let Err(error) = crate::cancel::checkpoint() {
                return Err(partial_error(error, &completed, &["Harness registration"]));
            }
            if let Err(error) = configure(harness, &target, &runtime, &mut completed) {
                return Err(partial_error(error, &completed, &["Harness registration"]));
            }
            Ok(completed)
        },
        |completed, cleanup_path, error| {
            TkError::partial_commit(
                "Component installation committed but cleanup failed",
                serde_json::json!(completed),
                serde_json::json!([cleanup_path]),
                error,
            )
        },
    )?;
    result.committed = true;
    result.completed = completed;
    result.uncompleted.clear();
    Ok(result)
}
pub fn uninstall(harness: Harness, dry_run: bool) -> Result<ComponentResult> {
    let home = home()?;
    let runtime = home.join(".local/bin/tk");
    require_runtime(&runtime)?;
    require_harness(harness)?;
    let bundle = embedded_bundle()?;
    let component = bundle
        .manifest
        .components
        .get(harness.name())
        .expect("validated component exists");
    require_compatible(&component.runtime_compat)?;
    let target = component_target(harness, &home);
    let registration =
        registration_state(harness, &target, &runtime, &bundle.manifest.runtime_version)?;
    let target_exists = entry_exists(&target)?;
    let target_before = target_fingerprint(&target)?;
    let changed = target_exists || registration.present;
    let action = if !changed {
        "no_change"
    } else if dry_run {
        "would_uninstall"
    } else {
        "uninstalled"
    };
    let mut result = ComponentResult {
        harness,
        action,
        version: bundle.manifest.runtime_version.clone(),
        runtime_compat: component.runtime_compat.clone(),
        source_revision: bundle.manifest.source_revision.clone(),
        changed,
        committed: false,
        partial: false,
        dry_run,
        completed: Vec::new(),
        uncompleted: registration
            .present
            .then(|| "Harness registration".into())
            .into_iter()
            .chain(target_exists.then(|| target.display().to_string()))
            .collect(),
        installed_paths: Vec::new(),
        removed_paths: if target_exists {
            vec![target.clone()]
        } else {
            Vec::new()
        },
    };
    if !changed || dry_run {
        return Ok(result);
    }

    let operation = crate::gc::begin_user_operation(&target)?;
    let completed = operation.execute(
        |_operation| {
            crate::cancel::checkpoint()?;
            let current_registration =
                registration_state(harness, &target, &runtime, &bundle.manifest.runtime_version)?;
            if target_fingerprint(&target)? != target_before || current_registration != registration
            {
                return Err(TkError::new(
                    "changed_since_plan",
                    ErrorCategory::Conflict,
                    "Harness component state changed after preflight",
                ));
            }

            let mut completed = Vec::new();
            if registration.present
                && let Err(error) = deconfigure(harness, &target, &mut completed)
            {
                return Err(partial_error(
                    error,
                    &completed,
                    &["Harness registration", "Component target"],
                ));
            }
            if let Err(error) = crate::cancel::checkpoint() {
                return Err(partial_error(error, &completed, &["Component target"]));
            }
            if target_exists {
                if let Err(error) = remove_entry(&target) {
                    return Err(partial_error(error, &completed, &["Component target"]));
                }
                completed.push(target.display().to_string());
            }
            Ok(completed)
        },
        |completed, cleanup_path, error| {
            TkError::partial_commit(
                "Component uninstall committed but cleanup failed",
                serde_json::json!(completed),
                serde_json::json!([cleanup_path]),
                error,
            )
        },
    )?;
    result.committed = true;
    result.completed = completed;
    result.uncompleted.clear();
    Ok(result)
}

fn embedded_bundle() -> Result<Bundle> {
    let manifest: BundleManifest = serde_json::from_slice(EMBEDDED_MANIFEST).map_err(|error| {
        TkError::new(
            "invalid_component_manifest",
            ErrorCategory::ManagedFile,
            error.to_string(),
        )
    })?;
    if manifest.component_format_version != COMPONENT_FORMAT_VERSION
        || manifest.driver_contract_version != DRIVER_CONTRACT_VERSION
        || manifest.runtime_version != RUNTIME_VERSION
    {
        return Err(TkError::new(
            "component_incompatible",
            ErrorCategory::Compatibility,
            "Embedded component manifest does not match this runtime",
        ));
    }
    if digest(EMBEDDED_ARCHIVE) != manifest.archive_sha256 {
        return Err(TkError::new(
            "component_archive_invalid",
            ErrorCategory::ManagedFile,
            "Embedded component archive digest does not match its manifest",
        ));
    }
    for harness in [Harness::Codex, Harness::Claude, Harness::Pi, Harness::Omp] {
        let component = manifest.components.get(harness.name()).ok_or_else(|| {
            TkError::new(
                "component_manifest_incomplete",
                ErrorCategory::ManagedFile,
                format!("Missing {} component", harness.name()),
            )
        })?;
        if component.payload != format!("payloads/{}", harness.name()) {
            return Err(TkError::new(
                "component_manifest_invalid",
                ErrorCategory::ManagedFile,
                format!("Invalid payload root for {}", harness.name()),
            ));
        }
        require_compatible(&component.runtime_compat)?;
    }

    let decoder = zstd::Decoder::new(EMBEDDED_ARCHIVE).map_err(archive_error)?;
    let mut archive = tar::Archive::new(decoder);
    let mut files = BTreeMap::new();
    for entry in archive.entries().map_err(archive_error)? {
        let mut entry = entry.map_err(archive_error)?;
        if !entry.header().entry_type().is_file() {
            return Err(TkError::new(
                "component_archive_invalid",
                ErrorCategory::ManagedFile,
                "Embedded component archive contains a non-file entry",
            ));
        }
        let path = entry.path().map_err(archive_error)?.into_owned();
        let path = safe_archive_path(&path)?;
        let path_text = path.to_str().ok_or_else(|| {
            TkError::new(
                "component_archive_invalid",
                ErrorCategory::ManagedFile,
                "Embedded component archive contains a non-UTF-8 path",
            )
        })?;
        let mode = entry.header().mode().map_err(archive_error)?;
        let mut bytes = Vec::new();
        entry
            .read_to_end(&mut bytes)
            .map_err(|error| storage_error("read_component_archive", &path, error))?;
        if files
            .insert(path_text.replace('\\', "/"), PayloadFile { bytes, mode })
            .is_some()
        {
            return Err(TkError::new(
                "component_archive_invalid",
                ErrorCategory::ManagedFile,
                format!("Duplicate component archive path: {path_text}"),
            ));
        }
    }
    validate_payloads(&manifest, &files)?;
    Ok(Bundle { manifest, files })
}

fn validate_payloads(
    manifest: &BundleManifest,
    files: &BTreeMap<String, PayloadFile>,
) -> Result<()> {
    let mut expected_count = 0;
    for component in manifest.components.values() {
        expected_count += component.files.len();
        for (relative, expected) in &component.files {
            let path = format!("{}/{relative}", component.payload);
            let actual = files.get(&path).ok_or_else(|| {
                TkError::new(
                    "component_archive_invalid",
                    ErrorCategory::ManagedFile,
                    format!("Missing component archive file: {path}"),
                )
            })?;
            if digest(&actual.bytes) != expected.sha256 || actual.mode != expected.mode {
                return Err(TkError::new(
                    "component_archive_invalid",
                    ErrorCategory::ManagedFile,
                    format!("Component archive file does not match its manifest: {path}"),
                ));
            }
        }
    }
    if files.len() != expected_count {
        return Err(TkError::new(
            "component_archive_invalid",
            ErrorCategory::ManagedFile,
            "Embedded component archive contains unlisted files",
        ));
    }
    Ok(())
}

fn materialize_component(
    target: &Path,
    component: &ComponentManifest,
    files: &BTreeMap<String, PayloadFile>,
) -> Result<()> {
    fs::create_dir(target)
        .map_err(|error| storage_error("create_component_staging", target, error))?;
    for relative in component.files.keys() {
        let archive_path = format!("{}/{relative}", component.payload);
        let source = files.get(&archive_path).expect("validated payload file");
        let destination = target.join(safe_archive_path(Path::new(relative))?);
        let parent = destination.parent().expect("component file has a parent");
        fs::create_dir_all(parent)
            .map_err(|error| storage_error("create_component_directory", parent, error))?;
        fs::write(&destination, &source.bytes)
            .map_err(|error| storage_error("write_component_file", &destination, error))?;
        fs::set_permissions(&destination, fs::Permissions::from_mode(source.mode))
            .map_err(|error| storage_error("set_component_permissions", &destination, error))?;
    }
    Ok(())
}

fn component_differs(
    target: &Path,
    component: &ComponentManifest,
    files: &BTreeMap<String, PayloadFile>,
) -> Result<bool> {
    if !target.is_dir() {
        return Ok(true);
    }
    let mut observed = BTreeMap::new();
    let mut directories = BTreeSet::new();
    let mut unexpected = false;
    collect_installed_files(
        target,
        target,
        &mut observed,
        &mut directories,
        &mut unexpected,
    )?;
    let mut expected_directories = BTreeSet::new();
    for relative in component.files.keys() {
        let mut parent = Path::new(relative).parent();
        while let Some(directory) = parent {
            if directory.as_os_str().is_empty() {
                break;
            }
            expected_directories.insert(directory.to_string_lossy().replace('\\', "/"));
            parent = directory.parent();
        }
    }
    if unexpected || directories != expected_directories || observed.len() != component.files.len()
    {
        return Ok(true);
    }
    for (relative, expected) in &component.files {
        let Some((sha256, mode)) = observed.get(relative) else {
            return Ok(true);
        };
        let archive_path = format!("{}/{relative}", component.payload);
        let payload = files.get(&archive_path).expect("validated payload file");
        if sha256 != &expected.sha256 || *mode != expected.mode || digest(&payload.bytes) != *sha256
        {
            return Ok(true);
        }
    }
    Ok(false)
}

fn collect_installed_files(
    root: &Path,
    directory: &Path,
    files: &mut BTreeMap<String, (String, u32)>,
    directories: &mut BTreeSet<String>,
    unexpected: &mut bool,
) -> Result<()> {
    for entry in fs::read_dir(directory)
        .map_err(|error| storage_error("scan_component_target", directory, error))?
    {
        let entry =
            entry.map_err(|error| storage_error("scan_component_target", directory, error))?;
        let path = entry.path();
        let metadata = fs::symlink_metadata(&path)
            .map_err(|error| storage_error("inspect_component_target", &path, error))?;
        if metadata.file_type().is_symlink() {
            *unexpected = true;
        } else if metadata.is_dir() {
            let relative = path
                .strip_prefix(root)
                .expect("component target descendant")
                .to_string_lossy()
                .replace('\\', "/");
            directories.insert(relative);
            collect_installed_files(root, &path, files, directories, unexpected)?;
        } else if metadata.is_file() {
            let relative = path
                .strip_prefix(root)
                .expect("component target descendant")
                .to_string_lossy()
                .replace('\\', "/");
            let bytes = fs::read(&path)
                .map_err(|error| storage_error("read_component_target", &path, error))?;
            files.insert(
                relative,
                (digest(&bytes), metadata.permissions().mode() & 0o777),
            );
        } else {
            *unexpected = true;
        }
    }
    Ok(())
}

fn replace_target(staging: &Path, target: &Path) -> Result<()> {
    let mut completed = Vec::new();
    let target_existed = entry_exists(target)?;
    remove_entry(target)?;
    if target_existed {
        completed.push(format!("previous target removed: {}", target.display()));
    }
    let parent = target.parent().ok_or_else(|| {
        TkError::new(
            "invalid_component_target",
            ErrorCategory::Environment,
            format!("Component target has no parent: {}", target.display()),
        )
    })?;
    if let Err(error) = fs::create_dir_all(parent)
        .map_err(|error| storage_error("create_component_parent", parent, error))
    {
        return Err(component_tree_error(error, &completed, target));
    }
    if let Err(error) = copy_tree(staging, target, &mut completed) {
        return Err(component_tree_error(error, &completed, target));
    }
    Ok(())
}

fn copy_tree(source: &Path, target: &Path, completed: &mut Vec<String>) -> Result<()> {
    fs::create_dir(target)
        .map_err(|error| storage_error("create_component_target", target, error))?;
    completed.push(target.display().to_string());
    for entry in fs::read_dir(source)
        .map_err(|error| storage_error("scan_component_staging", source, error))?
    {
        let entry =
            entry.map_err(|error| storage_error("scan_component_staging", source, error))?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        let metadata = fs::symlink_metadata(&source_path)
            .map_err(|error| storage_error("inspect_component_staging", &source_path, error))?;
        if metadata.is_dir() {
            copy_tree(&source_path, &target_path, completed)?;
        } else if metadata.is_file() {
            fs::copy(&source_path, &target_path)
                .map_err(|error| storage_error("copy_component_file", &target_path, error))?;
            fs::set_permissions(&target_path, metadata.permissions())
                .map_err(|error| storage_error("set_component_permissions", &target_path, error))?;
            completed.push(target_path.display().to_string());
        } else {
            return Err(TkError::new(
                "invalid_component_payload",
                ErrorCategory::ManagedFile,
                format!(
                    "Unsupported staged component entry: {}",
                    source_path.display()
                ),
            ));
        }
    }
    Ok(())
}

fn component_tree_error(error: TkError, completed: &[String], target: &Path) -> TkError {
    if completed.is_empty() {
        return error;
    }
    TkError::partial_commit(
        "Component target replacement stopped after committing some paths",
        serde_json::json!(completed),
        serde_json::json!([target]),
        error,
    )
}

fn entry_exists(path: &Path) -> Result<bool> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(storage_error("inspect_component_target", path, error)),
    }
}

fn target_fingerprint(path: &Path) -> Result<String> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(digest(b"missing"));
        }
        Err(error) => return Err(storage_error("inspect_component_target", path, error)),
    };
    let mut hasher = Sha256::new();
    fingerprint_entry(path, path, &metadata, &mut hasher)?;
    Ok(format!("{:x}", hasher.finalize()))
}

fn fingerprint_entry(
    root: &Path,
    path: &Path,
    metadata: &fs::Metadata,
    hasher: &mut Sha256,
) -> Result<()> {
    let relative = path.strip_prefix(root).unwrap_or(path);
    hash_part(hasher, relative.as_os_str().as_bytes());
    hash_part(
        hasher,
        &(metadata.permissions().mode() & 0o7777).to_le_bytes(),
    );
    if metadata.file_type().is_symlink() {
        hash_part(hasher, b"symlink");
        let target = fs::read_link(path)
            .map_err(|error| storage_error("read_component_symlink", path, error))?;
        hash_part(hasher, target.as_os_str().as_bytes());
    } else if metadata.is_dir() {
        hash_part(hasher, b"directory");
        let mut entries = fs::read_dir(path)
            .map_err(|error| storage_error("scan_component_target", path, error))?
            .collect::<std::io::Result<Vec<_>>>()
            .map_err(|error| storage_error("scan_component_target", path, error))?;
        entries.sort_by_key(|entry| entry.file_name());
        for entry in entries {
            let child = entry.path();
            let child_metadata = fs::symlink_metadata(&child)
                .map_err(|error| storage_error("inspect_component_target", &child, error))?;
            fingerprint_entry(root, &child, &child_metadata, hasher)?;
        }
    } else if metadata.is_file() {
        hash_part(hasher, b"file");
        let mut file = fs::File::open(path)
            .map_err(|error| storage_error("read_component_target", path, error))?;
        let mut buffer = [0_u8; 16 * 1024];
        loop {
            let count = file
                .read(&mut buffer)
                .map_err(|error| storage_error("read_component_target", path, error))?;
            if count == 0 {
                break;
            }
            hasher.update(&buffer[..count]);
        }
    } else {
        hash_part(hasher, b"special");
    }
    Ok(())
}

fn hash_part(hasher: &mut Sha256, bytes: &[u8]) {
    hasher.update((bytes.len() as u64).to_le_bytes());
    hasher.update(bytes);
}

fn remove_entry(path: &Path) -> Result<()> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(storage_error("inspect_component_target", path, error)),
    };
    let before = target_fingerprint(path)?;
    let result = if metadata.is_dir() && !metadata.file_type().is_symlink() {
        fs::remove_dir_all(path)
            .map_err(|error| storage_error("remove_component_target", path, error))
    } else {
        fs::remove_file(path).map_err(|error| storage_error("remove_component_target", path, error))
    };
    match result {
        Ok(()) => Ok(()),
        Err(error) => {
            let changed = target_fingerprint(path).is_ok_and(|after| after != before);
            if changed {
                Err(TkError::partial_commit(
                    "Component target deletion stopped after changing its contents",
                    serde_json::json!([path]),
                    serde_json::json!([path]),
                    error,
                ))
            } else {
                Err(error)
            }
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
struct RegistrationState {
    present: bool,
    matches: bool,
}

fn registration_state(
    harness: Harness,
    root: &Path,
    runtime: &Path,
    version: &str,
) -> Result<RegistrationState> {
    let root = root.to_string_lossy();
    let runtime = runtime.to_string_lossy();
    match harness {
        Harness::Codex => {
            let value = run_driver_json("codex", &["mcp", "list", "--json"])?;
            let item = value
                .as_array()
                .and_then(|items| items.iter().find(|item| item["name"] == "tk"));
            let matches = item.is_some_and(|item| {
                item["enabled"] == true
                    && item["transport"]["type"] == "stdio"
                    && item["transport"]["command"] == runtime.as_ref()
                    && item["transport"]["args"] == serde_json::json!(["mcp"])
            });
            Ok(RegistrationState {
                present: item.is_some(),
                matches,
            })
        }
        Harness::Claude => {
            let plugins = run_driver_json("claude", &["plugin", "list", "--json"])?;
            let plugin = plugins
                .as_array()
                .and_then(|items| items.iter().find(|item| item["id"] == "tk@tk-local"));
            let marketplaces =
                run_driver_json("claude", &["plugin", "marketplace", "list", "--json"])?;
            let marketplace = marketplaces
                .as_array()
                .and_then(|items| items.iter().find(|item| item["name"] == "tk-local"));
            let matches_plugin = plugin.is_some_and(|item| {
                item["version"] == version && item["scope"] == "user" && item["enabled"] == true
            });
            let matches_marketplace = marketplace
                .is_some_and(|item| item["source"] == "directory" && item["path"] == root.as_ref());
            Ok(RegistrationState {
                present: plugin.is_some() || marketplace.is_some(),
                matches: matches_plugin && matches_marketplace,
            })
        }
        Harness::Pi => {
            let output = run_driver_text("pi", &["list"])?;
            let present = output.lines().any(|line| line.trim() == root.as_ref());
            Ok(RegistrationState {
                present,
                matches: present,
            })
        }
        Harness::Omp => {
            let value = run_driver_json("omp", &["plugin", "list", "--json"])?;
            let item = value["npm"]
                .as_array()
                .and_then(|items| items.iter().find(|item| item["name"] == "@ruokee/tk-omp"));
            Ok(RegistrationState {
                present: item.is_some(),
                matches: item
                    .is_some_and(|item| item["version"] == version && item["enabled"] == true),
            })
        }
    }
}

fn configure(
    harness: Harness,
    root: &Path,
    runtime: &Path,
    completed: &mut Vec<String>,
) -> Result<()> {
    let root = root.to_string_lossy().into_owned();
    let runtime = runtime.to_string_lossy().into_owned();
    match harness {
        Harness::Codex => {
            run_driver("codex", &["mcp", "add", "tk", "--", &runtime, "mcp"])?;
            completed.push("Codex MCP registration".into());
        }
        Harness::Claude => {
            run_driver(
                "claude",
                &["plugin", "marketplace", "add", &root, "--scope", "user"],
            )?;
            completed.push("Claude marketplace registration".into());
            crate::cancel::checkpoint()?;
            run_driver(
                "claude",
                &["plugin", "install", "tk@tk-local", "--scope", "user"],
            )?;
            completed.push("Claude plugin registration".into());
        }
        Harness::Pi => {
            run_driver("pi", &["install", &root])?;
            completed.push("Pi package registration".into());
        }
        Harness::Omp => {
            run_driver("omp", &["plugin", "install", &root, "--scope", "user"])?;
            completed.push("OMP plugin registration".into());
        }
    }
    Ok(())
}

fn deconfigure(harness: Harness, root: &Path, completed: &mut Vec<String>) -> Result<()> {
    let root = root.to_string_lossy().into_owned();
    match harness {
        Harness::Codex => {
            run_driver_allow_absent("codex", &["mcp", "remove", "tk"])?;
            completed.push("Codex MCP registration removed".into());
        }
        Harness::Claude => {
            run_driver_allow_absent(
                "claude",
                &["plugin", "uninstall", "tk@tk-local", "--scope", "user"],
            )?;
            completed.push("Claude plugin registration removed".into());
            crate::cancel::checkpoint()?;
            run_driver_allow_absent(
                "claude",
                &[
                    "plugin",
                    "marketplace",
                    "remove",
                    "tk-local",
                    "--scope",
                    "user",
                ],
            )?;
            completed.push("Claude marketplace registration removed".into());
        }
        Harness::Pi => {
            run_driver_allow_absent("pi", &["remove", &root])?;
            completed.push("Pi package registration removed".into());
        }
        Harness::Omp => {
            run_driver_allow_absent(
                "omp",
                &["plugin", "uninstall", "@ruokee/tk-omp", "--scope", "user"],
            )?;
            completed.push("OMP plugin registration removed".into());
        }
    }
    Ok(())
}

fn run_driver_json(executable: &str, args: &[&str]) -> Result<Value> {
    let output = run_driver_text(executable, args)?;
    serde_json::from_str(&output).map_err(|error| {
        TkError::new(
            "invalid_harness_output",
            ErrorCategory::Storage,
            format!("{executable} returned invalid JSON: {error}"),
        )
    })
}

fn run_driver_text(executable: &str, args: &[&str]) -> Result<String> {
    let output = driver_output(executable, args)?;
    if !output.status.success() {
        return Err(driver_error(executable, output));
    }
    String::from_utf8(output.stdout).map_err(|error| {
        TkError::new(
            "invalid_harness_output",
            ErrorCategory::Storage,
            format!("{executable} returned non-UTF-8 output: {error}"),
        )
    })
}

fn run_driver(executable: &str, args: &[&str]) -> Result<()> {
    let output = driver_output(executable, args)?;
    if output.status.success() {
        return Ok(());
    }
    Err(driver_error(executable, output))
}

fn run_driver_allow_absent(executable: &str, args: &[&str]) -> Result<()> {
    let output = driver_output(executable, args)?;
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr).to_ascii_lowercase();
    if ["not found", "not installed", "does not exist", "no such"]
        .iter()
        .any(|needle| stderr.contains(needle))
    {
        return Ok(());
    }
    Err(driver_error(executable, output))
}

fn driver_output(executable: &str, args: &[&str]) -> Result<Output> {
    let mut command = Command::new(executable);
    command.args(args);
    crate::process::output(&mut command, &format!("Harness command {executable}"))
}

fn driver_error(executable: &str, output: Output) -> TkError {
    TkError::new(
        "harness_driver_failed",
        ErrorCategory::Storage,
        format!(
            "{executable} exited with {}: {}",
            output.status,
            String::from_utf8_lossy(&output.stderr).trim()
        ),
    )
}

fn partial_error(error: TkError, completed: &[String], uncompleted: &[&str]) -> TkError {
    if completed.is_empty() {
        return error;
    }
    TkError::partial_commit(
        "Harness component lifecycle stopped after committing some changes",
        serde_json::json!(completed),
        serde_json::json!(uncompleted),
        error,
    )
}

fn require_runtime(path: &Path) -> Result<()> {
    let metadata = match fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err(TkError::new(
                "runtime_not_installed",
                ErrorCategory::Environment,
                format!("Runtime is not installed at {}", path.display()),
            ));
        }
        Err(error) => {
            return Err(TkError::new(
                "runtime_not_executable",
                ErrorCategory::Environment,
                format!("Could not inspect runtime {}: {error}", path.display()),
            ));
        }
    };
    if !metadata.file_type().is_file() || metadata.permissions().mode() & 0o111 == 0 {
        return Err(TkError::new(
            "runtime_not_executable",
            ErrorCategory::Environment,
            format!(
                "Runtime must be a regular executable file: {}",
                path.display()
            ),
        ));
    }
    Ok(())
}

fn require_harness(harness: Harness) -> Result<()> {
    let executable = harness.name();
    let path = env::var_os("PATH").unwrap_or_default();
    for directory in env::split_paths(&path) {
        let candidate = directory.join(executable);
        let Ok(metadata) = fs::metadata(&candidate) else {
            continue;
        };
        if metadata.file_type().is_file() && metadata.permissions().mode() & 0o111 != 0 {
            return Ok(());
        }
    }
    Err(TkError::new(
        "harness_unavailable",
        ErrorCategory::Environment,
        format!("Harness executable is unavailable or not executable: {executable}"),
    ))
}

fn component_target(harness: Harness, home: &Path) -> PathBuf {
    match harness {
        Harness::Codex => env::var_os("CODEX_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join(".codex"))
            .join("skills/tk"),
        _ => env::var_os("XDG_DATA_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join(".local/share"))
            .join("tk/components")
            .join(harness.name()),
    }
}

fn home() -> Result<PathBuf> {
    env::var_os("HOME").map(PathBuf::from).ok_or_else(|| {
        TkError::new(
            "home_unavailable",
            ErrorCategory::Environment,
            "HOME is unavailable",
        )
    })
}

fn safe_archive_path(path: &Path) -> Result<PathBuf> {
    if path.as_os_str().is_empty()
        || path.is_absolute()
        || path
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(TkError::new(
            "component_archive_invalid",
            ErrorCategory::ManagedFile,
            format!("Unsafe component archive path: {}", path.display()),
        ));
    }
    Ok(path.to_path_buf())
}

fn archive_error(error: std::io::Error) -> TkError {
    TkError::new(
        "component_archive_invalid",
        ErrorCategory::ManagedFile,
        error.to_string(),
    )
}

fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedded_components_are_self_consistent() {
        let bundle = embedded_bundle().unwrap();
        assert_eq!(bundle.manifest.components.len(), 4);
    }

    #[test]
    fn rejects_unsafe_archive_paths() {
        assert!(safe_archive_path(Path::new("../escape")).is_err());
        assert!(safe_archive_path(Path::new("/absolute")).is_err());
        assert_eq!(
            safe_archive_path(Path::new("skills/tk/SKILL.md")).unwrap(),
            Path::new("skills/tk/SKILL.md")
        );
    }

    #[test]
    fn runtime_preflight_requires_a_regular_executable() {
        let root = std::env::temp_dir().join(format!("tk-component-test-{}", uuid::Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        let missing = root.join("missing");
        assert_eq!(
            require_runtime(&missing).unwrap_err().code,
            "runtime_not_installed"
        );
        let runtime = root.join("tk");
        fs::write(&runtime, b"runtime").unwrap();
        assert_eq!(
            require_runtime(&runtime).unwrap_err().code,
            "runtime_not_executable"
        );
        fs::set_permissions(&runtime, fs::Permissions::from_mode(0o755)).unwrap();
        require_runtime(&runtime).unwrap();
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn component_diff_detects_extra_directories_and_symlinks() {
        let root = std::env::temp_dir().join(format!("tk-component-test-{}", uuid::Uuid::now_v7()));
        let bundle = embedded_bundle().unwrap();
        let component = bundle.manifest.components.get("pi").unwrap();
        materialize_component(&root, component, &bundle.files).unwrap();
        assert!(!component_differs(&root, component, &bundle.files).unwrap());

        let extra = root.join("extra");
        fs::create_dir(&extra).unwrap();
        assert!(component_differs(&root, component, &bundle.files).unwrap());
        fs::remove_dir(&extra).unwrap();

        std::os::unix::fs::symlink("missing", &extra).unwrap();
        assert!(component_differs(&root, component, &bundle.files).unwrap());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn deconfigure_partial_error_keeps_registration_uncompleted() {
        let error = partial_error(
            TkError::new("injected", ErrorCategory::Cancelled, "cancelled"),
            &["Claude plugin registration removed".into()],
            &["Harness registration", "Component target"],
        );
        let details = error.details.unwrap();
        assert_eq!(
            details["completed"],
            serde_json::json!(["Claude plugin registration removed"])
        );
        assert_eq!(
            details["uncompleted"],
            serde_json::json!(["Harness registration", "Component target"])
        );
        assert_eq!(details["original_error"]["code"], "injected");
    }

    #[test]
    fn harness_driver_is_killed_when_output_exceeds_the_limit() {
        let root = std::env::temp_dir().join(format!("tk-driver-test-{}", uuid::Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        let executable = root.join("driver");
        fs::write(
            &executable,
            "#!/bin/sh\nwhile :; do printf xxxxxxxxxxxxxxxx; done\n",
        )
        .unwrap();
        fs::set_permissions(&executable, fs::Permissions::from_mode(0o755)).unwrap();
        let error = driver_output(executable.to_str().unwrap(), &[]).unwrap_err();
        assert_eq!(error.code, "process_output_too_large");
        fs::remove_dir_all(root).unwrap();
    }
}
