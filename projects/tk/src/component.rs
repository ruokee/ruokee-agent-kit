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

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    Tools,
    Cli,
}

impl Mode {
    fn name(self) -> &'static str {
        match self {
            Self::Tools => "tools",
            Self::Cli => "cli",
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

fn component_id(harness: Harness, mode: Mode, language: Language) -> String {
    format!("{}/{}/{}", harness.name(), mode.name(), language.name())
}

fn skill_name(mode: Mode, language: Language) -> &'static str {
    match (mode, language) {
        (Mode::Tools, Language::En) => "tk",
        (Mode::Tools, Language::Zh) => "tk-zh",
        (Mode::Cli, Language::En) => "tk-cli",
        (Mode::Cli, Language::Zh) => "tk-cli-zh",
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
    cli_skills: BTreeMap<String, CliSkillManifest>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct ComponentManifest {
    harness: Harness,
    mode: Mode,
    language: Language,
    skill: String,
    runtime_compat: String,
    payload: String,
    files: BTreeMap<String, FileManifest>,
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
    pub mode: Option<Mode>,
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

pub fn install(
    harness: Harness,
    mode: Mode,
    language: Language,
    dry_run: bool,
) -> Result<ComponentResult> {
    let home = home()?;
    let runtime = home.join(".local/bin/tk");
    require_runtime(&runtime)?;
    require_harness(harness)?;
    let bundle = embedded_bundle()?;
    let component = bundle
        .manifest
        .components
        .get(&component_id(harness, mode, language))
        .expect("validated component exists");
    require_compatible(&component.runtime_compat)?;

    let skill = skill_name(mode, language);
    let target = component_target(harness, &home, skill);
    let targets = component_targets(harness, &home);
    let target_before = target_fingerprints(&targets)?;
    let target_existed = entry_exists(&target)?;
    let residual_existing = existing_entries(targets.iter().filter(|path| **path != target))?;
    let registration = registration_state(
        harness,
        mode,
        &target,
        &runtime,
        &bundle.manifest.runtime_version,
    )?;
    let target_changed =
        payload_differs(&target, &component.payload, &component.files, &bundle.files)?;
    let registration_changed = !registration.matches;
    let configure_needed = match harness {
        Harness::Codex => registration_changed,
        _ => target_changed || registration_changed,
    };
    let changed = target_changed || configure_needed || !residual_existing.is_empty();
    let existed = target_existed || registration.present || !residual_existing.is_empty();

    let mut planned = Vec::new();
    if target_changed {
        planned.push(target.display().to_string());
    }
    if configure_needed {
        planned.push(REGISTRATION_ITEM.into());
    }
    planned.extend(
        residual_existing
            .iter()
            .map(|path| path.display().to_string()),
    );
    let result = ComponentResult {
        harness: Some(harness),
        skill_root: None,
        mode: Some(mode),
        language: Some(language),
        skill: Some(skill),
        action: install_action(changed, dry_run, existed),
        version: bundle.manifest.runtime_version.clone(),
        runtime_compat: component.runtime_compat.clone(),
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
        Scope::Harness,
        "installation",
        &target,
        result,
        |operation| {
            stage_payload(
                operation,
                target_changed,
                "component",
                &component.payload,
                &component.files,
                &bundle.files,
            )
        },
        || {
            let current_registration = registration_state(
                harness,
                mode,
                &target,
                &runtime,
                &bundle.manifest.runtime_version,
            )?;
            Ok(target_fingerprints(&targets)? == target_before
                && current_registration == registration)
        },
        |progress, staging| {
            if let Some(staging) = staging {
                progress.path_step(&target, || replace_target(&staging, &target))?;
            }
            progress.checkpoint()?;
            if configure_needed {
                progress.step(REGISTRATION_ITEM, |completed| {
                    configure(
                        harness,
                        mode,
                        &target,
                        &runtime,
                        registration.installed,
                        completed,
                    )
                })?;
            }
            progress.remove_entries(&residual_existing)
        },
    )
}

pub fn install_skill_root(
    skill_root: PathBuf,
    language: Language,
    dry_run: bool,
) -> Result<ComponentResult> {
    require_absolute_skill_root(&skill_root)?;
    let home = home()?;
    let runtime = home.join(".local/bin/tk");
    require_runtime(&runtime)?;
    let bundle = embedded_bundle()?;
    let skill_manifest = bundle
        .manifest
        .cli_skills
        .get(language.name())
        .expect("validated CLI Skill exists");
    require_compatible(&skill_manifest.runtime_compat)?;

    let skill = skill_name(Mode::Cli, language);
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
        harness: None,
        skill_root: Some(skill_root.clone()),
        mode: Some(Mode::Cli),
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
        Scope::Skill,
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

pub fn uninstall(harness: Harness, dry_run: bool) -> Result<ComponentResult> {
    let home = home()?;
    let runtime = home.join(".local/bin/tk");
    require_runtime(&runtime)?;
    require_harness(harness)?;
    let bundle = embedded_bundle()?;
    let component = bundle
        .manifest
        .components
        .get(&component_id(harness, Mode::Tools, Language::En))
        .expect("validated component exists");
    require_compatible(&component.runtime_compat)?;

    let targets = component_targets(harness, &home);
    let target_before = target_fingerprints(&targets)?;
    let existing_targets = existing_entries(&targets)?;
    let registration_target =
        component_target(harness, &home, skill_name(Mode::Tools, Language::En));
    let registration = registration_state(
        harness,
        Mode::Tools,
        &registration_target,
        &runtime,
        &bundle.manifest.runtime_version,
    )?;
    let changed = !existing_targets.is_empty() || registration.present;

    let mut planned = Vec::new();
    if registration.present {
        planned.push(REGISTRATION_ITEM.into());
    }
    planned.extend(
        existing_targets
            .iter()
            .map(|path| path.display().to_string()),
    );
    let result = ComponentResult {
        harness: Some(harness),
        skill_root: None,
        mode: None,
        language: None,
        skill: None,
        action: uninstall_action(changed, dry_run),
        version: bundle.manifest.runtime_version.clone(),
        runtime_compat: component.runtime_compat.clone(),
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
        Scope::Harness,
        "uninstall",
        &registration_target,
        result,
        |_operation| Ok(None),
        || {
            let current_registration = registration_state(
                harness,
                Mode::Tools,
                &registration_target,
                &runtime,
                &bundle.manifest.runtime_version,
            )?;
            Ok(target_fingerprints(&targets)? == target_before
                && current_registration == registration)
        },
        |progress, _staging| {
            if registration.present {
                progress.step(REGISTRATION_ITEM, |completed| {
                    deconfigure(harness, &registration_target, completed)
                })?;
            }
            progress.remove_entries(&existing_targets)
        },
    )
}

pub fn uninstall_skill_root(skill_root: PathBuf, dry_run: bool) -> Result<ComponentResult> {
    require_absolute_skill_root(&skill_root)?;
    let home = home()?;
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
        harness: None,
        skill_root: Some(skill_root.clone()),
        mode: Some(Mode::Cli),
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
        Scope::Skill,
        "uninstall",
        &skill_root,
        result,
        |_operation| Ok(None),
        || Ok(target_fingerprints(&targets)? == target_before),
        |progress, _staging| progress.remove_entries(&existing_targets),
    )
}

const REGISTRATION_ITEM: &str = "Harness registration";

/// Which lifecycle a plan belongs to; selects the wording of its errors.
#[derive(Clone, Copy)]
enum Scope {
    Harness,
    Skill,
}

impl Scope {
    fn subject(self) -> &'static str {
        match self {
            Self::Harness => "Harness component",
            Self::Skill => "CLI Skill",
        }
    }

    fn cleanup_subject(self) -> &'static str {
        match self {
            Self::Harness => "Component",
            Self::Skill => "CLI Skill",
        }
    }
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
    scope: Scope,
    verb: &str,
    operation_target: &Path,
    mut result: ComponentResult,
    stage: impl FnOnce(&mut crate::gc::CleanupOperation) -> Result<Option<PathBuf>>,
    unchanged: impl FnOnce() -> Result<bool>,
    apply: impl FnOnce(&mut Progress, Option<PathBuf>) -> Result<()>,
) -> Result<ComponentResult> {
    if !result.changed || result.dry_run {
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
                    format!("{} state changed after preflight", scope.subject()),
                ));
            }
            let mut progress = Progress {
                scope,
                completed: Vec::new(),
                remaining,
            };
            apply(&mut progress, staging)?;
            Ok(progress.completed)
        },
        |completed, cleanup_path, error| {
            TkError::partial_commit(
                format!(
                    "{} {verb} committed but cleanup failed",
                    scope.cleanup_subject()
                ),
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

/// Tracks committed and remaining plan items so a failure after the first
/// committed change reports a partial commit.
struct Progress {
    scope: Scope,
    completed: Vec<String>,
    remaining: Vec<String>,
}

impl Progress {
    fn partial(&self, error: TkError) -> TkError {
        if self.completed.is_empty() {
            return error;
        }
        TkError::partial_commit(
            format!(
                "{} lifecycle stopped after committing some changes",
                self.scope.subject()
            ),
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
    if manifest.components.len() != 16 {
        return Err(TkError::new(
            "component_manifest_incomplete",
            ErrorCategory::ManagedFile,
            "Embedded component manifest must contain sixteen selections",
        ));
    }
    for harness in [Harness::Codex, Harness::Claude, Harness::Pi, Harness::Omp] {
        for mode in [Mode::Tools, Mode::Cli] {
            for language in [Language::En, Language::Zh] {
                let id = component_id(harness, mode, language);
                let component = manifest.components.get(&id).ok_or_else(|| {
                    TkError::new(
                        "component_manifest_incomplete",
                        ErrorCategory::ManagedFile,
                        format!("Missing {id} component"),
                    )
                })?;
                if component.harness != harness
                    || component.mode != mode
                    || component.language != language
                    || component.skill != skill_name(mode, language)
                    || component.payload != format!("payloads/{id}")
                {
                    return Err(TkError::new(
                        "component_manifest_invalid",
                        ErrorCategory::ManagedFile,
                        format!("Invalid component selection metadata for {id}"),
                    ));
                }
                require_compatible(&component.runtime_compat)?;
            }
        }
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
            || skill.skill != skill_name(Mode::Cli, language)
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
    for component in manifest.components.values() {
        validate_payload_files(
            &component.payload,
            &component.files,
            files,
            &mut expected_count,
        )?;
    }
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

#[derive(Clone, Copy, PartialEq, Eq)]
struct RegistrationState {
    present: bool,
    installed: bool,
    matches: bool,
}

fn registration_state(
    harness: Harness,
    mode: Mode,
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
            let matches = match mode {
                Mode::Tools => item.is_some_and(|item| {
                    item["enabled"] == true
                        && item["transport"]["type"] == "stdio"
                        && item["transport"]["command"] == runtime.as_ref()
                        && item["transport"]["args"] == serde_json::json!(["mcp"])
                }),
                Mode::Cli => item.is_none(),
            };
            Ok(RegistrationState {
                present: item.is_some(),
                installed: item.is_some(),
                matches,
            })
        }
        Harness::Claude => {
            let plugins = run_driver_json("claude", &["plugin", "list", "--json"])?;
            let plugin = plugins.as_array().and_then(|items| {
                items
                    .iter()
                    .find(|item| item["id"] == "tk@tk-local" && item["scope"] == "user")
            });
            let marketplaces =
                run_driver_json("claude", &["plugin", "marketplace", "list", "--json"])?;
            let marketplace = marketplaces
                .as_array()
                .and_then(|items| items.iter().find(|item| item["name"] == "tk-local"));
            let matches_plugin =
                plugin.is_some_and(|item| item["version"] == version && item["enabled"] == true);
            let matches_marketplace = marketplace
                .is_some_and(|item| item["source"] == "directory" && item["path"] == root.as_ref());
            Ok(RegistrationState {
                present: plugin.is_some() || marketplace.is_some(),
                installed: plugin.is_some(),
                matches: matches_plugin && matches_marketplace,
            })
        }
        Harness::Pi => {
            let output = run_driver_text("pi", &["list"])?;
            let present = output.lines().any(|line| line.trim() == root.as_ref());
            Ok(RegistrationState {
                present,
                installed: present,
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
                installed: item.is_some(),
                matches: item
                    .is_some_and(|item| item["version"] == version && item["enabled"] == true),
            })
        }
    }
}

fn configure(
    harness: Harness,
    mode: Mode,
    root: &Path,
    runtime: &Path,
    plugin_installed: bool,
    completed: &mut Vec<String>,
) -> Result<()> {
    let root = root.to_string_lossy().into_owned();
    let runtime = runtime.to_string_lossy().into_owned();
    match harness {
        Harness::Codex => match mode {
            Mode::Tools => {
                run_driver("codex", &["mcp", "add", "tk", "--", &runtime, "mcp"])?;
                completed.push("Codex MCP registration".into());
            }
            Mode::Cli => {
                run_driver_allow_absent("codex", &["mcp", "remove", "tk"])?;
                completed.push("Codex MCP registration removed".into());
            }
        },
        Harness::Claude => {
            run_driver(
                "claude",
                &["plugin", "marketplace", "add", &root, "--scope", "user"],
            )?;
            completed.push("Claude marketplace registration".into());
            crate::cancel::checkpoint()?;
            let action = if plugin_installed {
                "update"
            } else {
                "install"
            };
            run_driver(
                "claude",
                &["plugin", action, "tk@tk-local", "--scope", "user"],
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

fn component_target(harness: Harness, home: &Path, skill: &str) -> PathBuf {
    match harness {
        Harness::Codex => env::var_os("CODEX_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join(".codex"))
            .join("skills")
            .join(skill),
        _ => env::var_os("XDG_DATA_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join(".local/share"))
            .join("tk/components")
            .join(harness.name()),
    }
}

fn component_targets(harness: Harness, home: &Path) -> Vec<PathBuf> {
    match harness {
        Harness::Codex => ["tk", "tk-zh", "tk-cli", "tk-cli-zh"]
            .into_iter()
            .map(|skill| component_target(harness, home, skill))
            .collect(),
        _ => vec![component_target(harness, home, "tk")],
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
    fn embedded_bundle_covers_components_and_cli_skills() {
        let bundle = embedded_bundle().unwrap();
        let project = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        assert_eq!(bundle.manifest.runtime_version, env!("CARGO_PKG_VERSION"));
        assert_eq!(bundle.manifest.components.len(), 16);
        for harness in [Harness::Codex, Harness::Claude, Harness::Pi, Harness::Omp] {
            for mode in [Mode::Tools, Mode::Cli] {
                for language in [Language::En, Language::Zh] {
                    let component = bundle
                        .manifest
                        .components
                        .get(&component_id(harness, mode, language))
                        .unwrap();
                    let skill = skill_name(mode, language);
                    let skill_path = if harness == Harness::Codex {
                        "SKILL.md".into()
                    } else {
                        format!("skills/{skill}/SKILL.md")
                    };
                    assert!(component.files.contains_key(&skill_path));

                    match (harness, mode) {
                        (Harness::Claude, Mode::Tools) => {
                            assert!(component.files.contains_key(".mcp.json"));
                        }
                        (Harness::Claude, Mode::Cli) => {
                            assert!(!component.files.contains_key(".mcp.json"));
                        }
                        (Harness::Pi | Harness::Omp, Mode::Tools) => {
                            assert!(component.files.contains_key("extension.ts"));
                        }
                        (Harness::Pi | Harness::Omp, Mode::Cli) => {
                            assert!(!component.files.contains_key("extension.ts"));
                            assert!(!component.files.contains_key("common.ts"));
                        }
                        (Harness::Codex, _) => {}
                    }

                    assert_eq!(component.runtime_compat, crate::version::RUNTIME_COMPAT);

                    if matches!(harness, Harness::Pi | Harness::Omp) {
                        let harness_dir = project.join(harness.name());
                        for document in ["README.md", "README.zh.md"] {
                            let source = fs::read(harness_dir.join(document)).unwrap();
                            let archived = bundle
                                .files
                                .get(&format!("{}/{document}", component.payload))
                                .unwrap();
                            assert_eq!(
                                archived.bytes, source,
                                "{harness:?}/{mode:?}/{language:?} ships a stale {document}"
                            );
                        }
                        let english = std::str::from_utf8(
                            &bundle.files[&format!("{}/README.md", component.payload)].bytes,
                        )
                        .unwrap();
                        assert!(
                            english.contains("](./README.zh.md)"),
                            "{harness:?}/{mode:?}/{language:?} README.md has no Chinese link"
                        );
                        let chinese = std::str::from_utf8(
                            &bundle.files[&format!("{}/README.zh.md", component.payload)].bytes,
                        )
                        .unwrap();
                        assert!(
                            chinese.contains("](./README.md)"),
                            "{harness:?}/{mode:?}/{language:?} README.zh.md has no English link"
                        );

                        let source_package: Value = serde_json::from_slice(
                            &fs::read(harness_dir.join("package.json")).unwrap(),
                        )
                        .unwrap();
                        let archived_package: Value = serde_json::from_slice(
                            &bundle.files[&format!("{}/package.json", component.payload)].bytes,
                        )
                        .unwrap();
                        assert_eq!(archived_package["name"], source_package["name"]);
                        assert_eq!(archived_package["version"], source_package["version"]);
                        let integration = archived_package[harness.name()]
                            .as_object()
                            .expect("harness integration object");
                        match mode {
                            Mode::Tools => {
                                assert!(archived_package.get("dependencies").is_some());
                                assert!(integration.contains_key("extensions"));
                            }
                            Mode::Cli => {
                                assert!(archived_package.get("dependencies").is_none());
                                assert!(!integration.contains_key("extensions"));
                            }
                        }
                    }

                    if mode == Mode::Cli {
                        for file_path in component.files.keys() {
                            let path = format!("{}/{file_path}", component.payload);
                            let Ok(text) = std::str::from_utf8(&bundle.files[&path].bytes) else {
                                continue;
                            };
                            for name in [
                                "tk_search",
                                "tk_read",
                                "tk_create",
                                "tk_update",
                                "tk_log",
                                "tk_exec",
                            ] {
                                assert!(
                                    !text.contains(name),
                                    "CLI component {harness:?}/{language:?} contains {name} in {file_path}"
                                );
                            }
                        }
                    }
                }
            }
        }
        assert_eq!(bundle.manifest.cli_skills.len(), 2);
        for language in [Language::En, Language::Zh] {
            let skill = bundle.manifest.cli_skills.get(language.name()).unwrap();
            assert_eq!(skill.language, language);
            assert_eq!(skill.skill, skill_name(Mode::Cli, language));
            assert!(skill.files.contains_key("SKILL.md"));
            assert!(skill.files.keys().all(|path| !path.starts_with("skills/")));
        }
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
        let component = bundle.manifest.components.get("pi/tools/en").unwrap();
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

    #[test]
    fn failed_step_after_partial_progress_keeps_its_item_uncompleted() {
        let mut progress = Progress {
            scope: Scope::Harness,
            completed: Vec::new(),
            remaining: vec![REGISTRATION_ITEM.into(), "Component target".into()],
        };
        let error = progress
            .step(REGISTRATION_ITEM, |completed| {
                completed.push("Claude plugin registration removed".into());
                Err(TkError::new(
                    "injected",
                    ErrorCategory::Cancelled,
                    "cancelled",
                ))
            })
            .unwrap_err();
        assert_eq!(error.code, "partial_commit");
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

        let untouched = Progress {
            scope: Scope::Skill,
            completed: Vec::new(),
            remaining: vec!["target".into()],
        }
        .partial(TkError::new("injected", ErrorCategory::Cancelled, "x"));
        assert_eq!(untouched.code, "injected");
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
