use std::collections::{BTreeMap, BTreeSet};
use std::env;
use std::fs;
use std::io::Read;
use std::os::unix::ffi::OsStrExt;
use std::os::unix::fs::PermissionsExt;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::error::{ErrorCategory, Result, TkError};
use crate::path::storage_error;
use crate::version::{COMPONENT_FORMAT_VERSION, RUNTIME_VERSION, require_compatible};

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

pub enum Target {
    Harness(Harness),
    SkillRoot(PathBuf),
}

impl Target {
    fn resolve(self, home: &Path) -> (Option<Harness>, PathBuf) {
        match self {
            Self::Harness(harness) => (Some(harness), cli_skill_root(harness, home)),
            Self::SkillRoot(root) => (None, root),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    En,
    Zh,
}

impl Language {
    fn name(self) -> &'static str {
        match self {
            Self::En => "en",
            Self::Zh => "zh",
        }
    }
}

fn skill_name(language: Language) -> &'static str {
    match language {
        Language::En => "tk-cli",
        Language::Zh => "tk-cli-zh",
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct BundleManifest {
    component_format_version: u32,
    runtime_version: String,
    source_revision: String,
    archive_sha256: String,
    cli_skills: BTreeMap<String, CliSkillManifest>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct CliSkillManifest {
    language: Language,
    skill: String,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub harness: Option<Harness>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skill_root: Option<PathBuf>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<Language>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skill: Option<&'static str>,
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

pub fn install(target: Target, language: Language, dry_run: bool) -> Result<ComponentResult> {
    let home = home()?;
    let (harness, skill_root) = target.resolve(&home);
    require_absolute_skill_root(&skill_root)?;
    let runtime = home.join(".local/bin/tk");
    require_runtime(&runtime)?;
    let bundle = embedded_bundle()?;
    let skill_manifest = bundle
        .manifest
        .cli_skills
        .get(language.name())
        .expect("validated CLI Skill exists");
    require_compatible(&skill_manifest.runtime_compat)?;

    let skill = skill_name(language);
    let target = skill_root.join(skill);
    let targets = cli_skill_targets(&skill_root);
    let target_before = target_fingerprints(&targets)?;
    let target_existed = entry_exists(&target)?;
    let residual_existing = existing_entries(targets.iter().filter(|path| **path != target))?;
    let target_changed = payload_differs(
        &target,
        &skill_manifest.payload,
        &skill_manifest.files,
        &bundle.files,
    )?;
    let changed = target_changed || !residual_existing.is_empty();
    let existed = target_existed || !residual_existing.is_empty();

    let mut planned = Vec::new();
    if target_changed {
        planned.push(target.display().to_string());
    }
    planned.extend(
        residual_existing
            .iter()
            .map(|path| path.display().to_string()),
    );
    let result = ComponentResult {
        harness,
        skill_root: harness.is_none().then(|| skill_root.clone()),
        language: Some(language),
        skill: Some(skill),
        action: install_action(changed, dry_run, existed),
        version: bundle.manifest.runtime_version.clone(),
        runtime_compat: skill_manifest.runtime_compat.clone(),
        source_revision: bundle.manifest.source_revision.clone(),
        changed,
        committed: false,
        partial: false,
        dry_run,
        completed: Vec::new(),
        uncompleted: planned,
        installed_paths: target_changed.then(|| target.clone()).into_iter().collect(),
        removed_paths: residual_existing.clone(),
    };
    commit_plan(
        "installation",
        &skill_root,
        result,
        |operation| {
            stage_payload(
                operation,
                target_changed,
                "skill",
                &skill_manifest.payload,
                &skill_manifest.files,
                &bundle.files,
            )
        },
        || Ok(target_fingerprints(&targets)? == target_before),
        |progress, staging| {
            if let Some(staging) = staging {
                progress.path_step(&target, || replace_target(&staging, &target))?;
            }
            progress.remove_entries(&residual_existing)
        },
    )
}

pub fn uninstall(target: Target, dry_run: bool) -> Result<ComponentResult> {
    let home = home()?;
    let (harness, skill_root) = target.resolve(&home);
    require_absolute_skill_root(&skill_root)?;
    let runtime = home.join(".local/bin/tk");
    require_runtime(&runtime)?;
    let bundle = embedded_bundle()?;
    let skill_manifest = bundle
        .manifest
        .cli_skills
        .get(Language::En.name())
        .expect("validated CLI Skill exists");
    require_compatible(&skill_manifest.runtime_compat)?;

    let targets = cli_skill_targets(&skill_root);
    let target_before = target_fingerprints(&targets)?;
    let existing_targets = existing_entries(&targets)?;
    let changed = !existing_targets.is_empty();
    let planned = existing_targets
        .iter()
        .map(|path| path.display().to_string())
        .collect::<Vec<_>>();
    let result = ComponentResult {
        harness,
        skill_root: harness.is_none().then(|| skill_root.clone()),
        language: None,
        skill: None,
        action: uninstall_action(changed, dry_run),
        version: bundle.manifest.runtime_version.clone(),
        runtime_compat: skill_manifest.runtime_compat.clone(),
        source_revision: bundle.manifest.source_revision.clone(),
        changed,
        committed: false,
        partial: false,
        dry_run,
        completed: Vec::new(),
        uncompleted: planned,
        installed_paths: Vec::new(),
        removed_paths: existing_targets.clone(),
    };
    commit_plan(
        "uninstall",
        &skill_root,
        result,
        |_operation| Ok(None),
        || Ok(target_fingerprints(&targets)? == target_before),
        |progress, _staging| progress.remove_entries(&existing_targets),
    )
}

fn install_action(changed: bool, dry_run: bool, existed: bool) -> &'static str {
    if !changed {
        "no_change"
    } else if dry_run {
        "would_install"
    } else if existed {
        "updated"
    } else {
        "installed"
    }
}

fn uninstall_action(changed: bool, dry_run: bool) -> &'static str {
    if !changed {
        "no_change"
    } else if dry_run {
        "would_uninstall"
    } else {
        "uninstalled"
    }
}

fn existing_entries<'a>(paths: impl IntoIterator<Item = &'a PathBuf>) -> Result<Vec<PathBuf>> {
    let mut existing = Vec::new();
    for path in paths {
        if entry_exists(path)? {
            existing.push(path.clone());
        }
    }
    Ok(existing)
}

fn stage_payload(
    operation: &mut crate::gc::CleanupOperation,
    needed: bool,
    name: &str,
    payload: &str,
    manifest: &BTreeMap<String, FileManifest>,
    files: &BTreeMap<String, PayloadFile>,
) -> Result<Option<PathBuf>> {
    if !needed {
        return Ok(None);
    }
    let path = operation.temporary_path(name)?;
    materialize_payload(&path, payload, manifest, files)?;
    Ok(Some(path))
}

/// Runs a planned lifecycle change inside one cleanup operation.
///
/// `stage` prepares files before the preflight recheck, `unchanged` repeats the
/// preflight, and `apply` commits each planned item through `Progress`.
fn commit_plan(
    verb: &str,
    operation_target: &Path,
    mut result: ComponentResult,
    stage: impl FnOnce(&mut crate::gc::CleanupOperation) -> Result<Option<PathBuf>>,
    unchanged: impl FnOnce() -> Result<bool>,
    apply: impl FnOnce(&mut Progress, Option<PathBuf>) -> Result<()>,
) -> Result<ComponentResult> {
    if !result.changed || result.dry_run {
        crate::gc::ensure_user_writable(&crate::gc::user_temp_root()?)?;
        return Ok(result);
    }
    let remaining = result.uncompleted.clone();
    let operation = crate::gc::begin_user_operation(operation_target)?;
    let completed = operation.execute(
        |operation| {
            let staging = stage(operation)?;
            crate::cancel::checkpoint()?;
            if !unchanged()? {
                return Err(TkError::new(
                    "changed_since_plan",
                    ErrorCategory::Conflict,
                    "CLI Skill state changed after preflight",
                ));
            }
            let mut progress = Progress {
                completed: Vec::new(),
                remaining,
            };
            apply(&mut progress, staging)?;
            Ok((progress.completed, progress.remaining))
        },
        |(completed, _remaining), cleanup_path, error| {
            TkError::partial_commit(
                format!("CLI Skill {verb} committed but cleanup failed"),
                serde_json::json!(completed),
                serde_json::json!([cleanup_path]),
                error,
            )
        },
    )?;
    result.committed = true;
    result.completed = completed.0;
    result.uncompleted = completed.1;
    Ok(result)
}

/// Tracks committed and remaining plan items so a failure after the first
/// committed change reports a partial commit.
struct Progress {
    completed: Vec<String>,
    remaining: Vec<String>,
}

impl Progress {
    fn partial(&self, error: TkError) -> TkError {
        if self.completed.is_empty() {
            return error;
        }
        TkError::partial_commit(
            "CLI Skill lifecycle stopped after committing some changes",
            serde_json::json!(self.completed),
            serde_json::json!(self.remaining),
            error,
        )
    }

    fn checkpoint(&self) -> Result<()> {
        crate::cancel::checkpoint().map_err(|error| self.partial(error))
    }

    fn step(
        &mut self,
        item: &str,
        action: impl FnOnce(&mut Vec<String>) -> Result<()>,
    ) -> Result<()> {
        if let Err(error) = action(&mut self.completed) {
            return Err(self.partial(error));
        }
        self.remaining.retain(|candidate| candidate != item);
        Ok(())
    }

    fn path_step(&mut self, path: &Path, action: impl FnOnce() -> Result<()>) -> Result<()> {
        let item = path.display().to_string();
        self.step(&item, |completed| {
            action()?;
            completed.push(item.clone());
            Ok(())
        })
    }

    fn remove_entries(&mut self, paths: &[PathBuf]) -> Result<()> {
        for path in paths {
            self.checkpoint()?;
            self.path_step(path, || remove_entry(path))?;
        }
        Ok(())
    }
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
    if manifest.cli_skills.len() != 2 {
        return Err(TkError::new(
            "component_manifest_incomplete",
            ErrorCategory::ManagedFile,
            "Embedded component manifest must contain two CLI Skills",
        ));
    }
    for language in [Language::En, Language::Zh] {
        let id = language.name();
        let skill = manifest.cli_skills.get(id).ok_or_else(|| {
            TkError::new(
                "component_manifest_incomplete",
                ErrorCategory::ManagedFile,
                format!("Missing {id} CLI Skill"),
            )
        })?;
        if skill.language != language
            || skill.skill != skill_name(language)
            || skill.payload != format!("payloads/cli-skills/{id}")
        {
            return Err(TkError::new(
                "component_manifest_invalid",
                ErrorCategory::ManagedFile,
                format!("Invalid CLI Skill metadata for {id}"),
            ));
        }
        require_compatible(&skill.runtime_compat)?;
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
    for skill in manifest.cli_skills.values() {
        validate_payload_files(&skill.payload, &skill.files, files, &mut expected_count)?;
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

fn validate_payload_files(
    payload: &str,
    manifest_files: &BTreeMap<String, FileManifest>,
    files: &BTreeMap<String, PayloadFile>,
    expected_count: &mut usize,
) -> Result<()> {
    *expected_count += manifest_files.len();
    for (relative, expected) in manifest_files {
        let path = format!("{payload}/{relative}");
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
    Ok(())
}

fn materialize_payload(
    target: &Path,
    payload: &str,
    manifest_files: &BTreeMap<String, FileManifest>,
    files: &BTreeMap<String, PayloadFile>,
) -> Result<()> {
    fs::create_dir(target)
        .map_err(|error| storage_error("create_component_staging", target, error))?;
    for relative in manifest_files.keys() {
        let archive_path = format!("{payload}/{relative}");
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

fn payload_differs(
    target: &Path,
    payload: &str,
    manifest_files: &BTreeMap<String, FileManifest>,
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
    for relative in manifest_files.keys() {
        let mut parent = Path::new(relative).parent();
        while let Some(directory) = parent {
            if directory.as_os_str().is_empty() {
                break;
            }
            expected_directories.insert(directory.to_string_lossy().replace('\\', "/"));
            parent = directory.parent();
        }
    }
    if unexpected || directories != expected_directories || observed.len() != manifest_files.len() {
        return Ok(true);
    }
    for (relative, expected) in manifest_files {
        let Some((sha256, mode)) = observed.get(relative) else {
            return Ok(true);
        };
        let archive_path = format!("{payload}/{relative}");
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

fn target_fingerprints(paths: &[PathBuf]) -> Result<BTreeMap<PathBuf, String>> {
    paths
        .iter()
        .map(|path| target_fingerprint(path).map(|fingerprint| (path.clone(), fingerprint)))
        .collect()
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

fn require_absolute_skill_root(path: &Path) -> Result<()> {
    if path.is_absolute() {
        return Ok(());
    }
    Err(TkError::request(
        "invalid_skill_root",
        format!("Skill root must be absolute: {}", path.display()),
    ))
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

fn codex_home(home: &Path) -> PathBuf {
    env::var_os("CODEX_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| home.join(".codex"))
}

fn cli_skill_root(harness: Harness, home: &Path) -> PathBuf {
    cli_skill_root_in(harness, home, &codex_home(home))
}

fn cli_skill_root_in(harness: Harness, home: &Path, codex_home: &Path) -> PathBuf {
    match harness {
        Harness::Codex => codex_home.join("skills"),
        Harness::Claude => home.join(".claude/skills"),
        Harness::Pi => home.join(".pi/agent/skills"),
        Harness::Omp => home.join(".omp/agent/skills"),
    }
}

fn cli_skill_targets(skill_root: &Path) -> Vec<PathBuf> {
    ["tk-cli", "tk-cli-zh"]
        .into_iter()
        .map(|skill| skill_root.join(skill))
        .collect()
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
    fn cli_skill_roots_follow_each_harness() {
        let home = Path::new("/home/test");
        let codex_home = Path::new("/codex");
        assert_eq!(
            cli_skill_root_in(Harness::Codex, home, codex_home),
            PathBuf::from("/codex/skills")
        );
        assert_eq!(
            cli_skill_root_in(Harness::Claude, home, codex_home),
            PathBuf::from("/home/test/.claude/skills")
        );
        assert_eq!(
            cli_skill_root_in(Harness::Pi, home, codex_home),
            PathBuf::from("/home/test/.pi/agent/skills")
        );
        assert_eq!(
            cli_skill_root_in(Harness::Omp, home, codex_home),
            PathBuf::from("/home/test/.omp/agent/skills")
        );
    }

    #[test]
    fn rejects_unsafe_archive_paths() {
        assert!(safe_archive_path(Path::new("../escape")).is_err());
        assert!(safe_archive_path(Path::new("/absolute")).is_err());
        assert_eq!(
            safe_archive_path(Path::new("references/guide.md")).unwrap(),
            Path::new("references/guide.md")
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
        let component = bundle.manifest.cli_skills.get("en").unwrap();
        materialize_payload(&root, &component.payload, &component.files, &bundle.files).unwrap();
        assert!(
            !payload_differs(&root, &component.payload, &component.files, &bundle.files,).unwrap()
        );

        let extra = root.join("extra");
        fs::create_dir(&extra).unwrap();
        assert!(
            payload_differs(&root, &component.payload, &component.files, &bundle.files,).unwrap()
        );
        fs::remove_dir(&extra).unwrap();

        std::os::unix::fs::symlink("missing", &extra).unwrap();
        assert!(
            payload_differs(&root, &component.payload, &component.files, &bundle.files,).unwrap()
        );
        fs::remove_dir_all(root).unwrap();
    }
}
