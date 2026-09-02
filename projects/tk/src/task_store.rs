use std::fs::{self, File};
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

use chrono::NaiveDate;

use crate::domain::Metadata;
use crate::error::{ErrorCategory, Result, TkError};
use crate::path::{atomic_write, atomic_write_with, storage_error};
use crate::project::MetadataMode;

const MAX_FRONTMATTER_BYTES: usize = 1024 * 1024;

#[derive(Debug)]
pub struct StoredTask {
    pub directory: PathBuf,
    pub metadata: Metadata,
}

pub fn read_task(directory: &Path, mode: MetadataMode) -> Result<StoredTask> {
    let metadata = match mode {
        MetadataMode::Split => read_split_metadata(directory)?,
        MetadataMode::Embed => {
            let split_path = directory.join("tk.toml");
            if split_path.exists() {
                return Err(managed_error(
                    "metadata_mode_mismatch",
                    &split_path,
                    "embed projects cannot contain tk.toml",
                ));
            }
            read_embed_metadata(&directory.join("TASK.md"))?.0
        }
    };
    Ok(StoredTask {
        directory: directory.to_path_buf(),
        metadata,
    })
}

pub fn read_body(directory: &Path, mode: MetadataMode) -> Result<String> {
    let body = read_body_bytes(directory, mode)?;
    String::from_utf8(body).map_err(|error| {
        managed_error(
            "invalid_task_body_utf8",
            directory.join("TASK.md"),
            error.to_string(),
        )
    })
}

pub fn read_body_bytes(directory: &Path, mode: MetadataMode) -> Result<Vec<u8>> {
    let path = directory.join("TASK.md");
    ensure_regular_file(&path)?;
    let mut file =
        File::open(&path).map_err(|error| storage_error("open_task_body", &path, error))?;
    if mode == MetadataMode::Embed {
        let (_, offset) = read_embed_metadata(&path)?;
        file.seek(SeekFrom::Start(offset))
            .map_err(|error| storage_error("seek_task_body", &path, error))?;
    }
    let mut body = Vec::new();
    file.read_to_end(&mut body)
        .map_err(|error| storage_error("read_task_body", &path, error))?;
    Ok(body)
}

pub fn encode_split_document(metadata: &Metadata) -> Result<Vec<u8>> {
    encode_toml(metadata)
}

pub fn encode_embed_document(metadata: &Metadata, body: &[u8]) -> Result<Vec<u8>> {
    std::str::from_utf8(body).map_err(|error| {
        managed_error(
            "invalid_task_body_utf8",
            PathBuf::from("TASK.md"),
            error.to_string(),
        )
    })?;
    let mut document = encode_frontmatter(metadata)?;
    document.extend_from_slice(body);
    Ok(document)
}

pub fn create_task_files(
    directory: &Path,
    metadata: &Metadata,
    body: &[u8],
    mode: MetadataMode,
) -> Result<()> {
    metadata.validate()?;
    std::str::from_utf8(body).map_err(|error| {
        managed_error(
            "invalid_task_body_utf8",
            directory.join("TASK.md"),
            error.to_string(),
        )
    })?;
    fs::create_dir_all(directory)
        .map_err(|error| storage_error("create_task_directory", directory, error))?;

    match mode {
        MetadataMode::Split => {
            atomic_write(&directory.join("tk.toml"), &encode_toml(metadata)?)?;
            atomic_write(&directory.join("TASK.md"), body)
        }
        MetadataMode::Embed => {
            let path = directory.join("TASK.md");
            let frontmatter = encode_frontmatter(metadata)?;
            atomic_write_with(&path, |file| {
                file.write_all(&frontmatter)
                    .and_then(|_| file.write_all(body))
                    .map_err(|error| storage_error("write_embed_task", &path, error))
            })
        }
    }
}

pub fn replace_metadata(directory: &Path, metadata: &Metadata, mode: MetadataMode) -> Result<()> {
    metadata.validate()?;
    match mode {
        MetadataMode::Split => atomic_write(&directory.join("tk.toml"), &encode_toml(metadata)?),
        MetadataMode::Embed => {
            let path = directory.join("TASK.md");
            ensure_regular_file(&path)?;
            let (_, body_offset) = read_embed_metadata(&path)?;
            let mut source = File::open(&path)
                .map_err(|error| storage_error("open_embed_task", &path, error))?;
            source
                .seek(SeekFrom::Start(body_offset))
                .map_err(|error| storage_error("seek_embed_body", &path, error))?;
            let frontmatter = encode_frontmatter(metadata)?;
            atomic_write_with(&path, |target| {
                target
                    .write_all(&frontmatter)
                    .map_err(|error| storage_error("write_embed_metadata", &path, error))?;
                std::io::copy(&mut source, target)
                    .map_err(|error| storage_error("copy_embed_body", &path, error))?;
                Ok(())
            })
        }
    }
}

pub fn is_canonical_task_directory(root: &Path, subtasks_dir: &Path, directory: &Path) -> bool {
    canonical_task_slug(root, subtasks_dir, directory).is_some()
}

pub fn canonical_task_slug<'a>(
    root: &Path,
    subtasks_dir: &Path,
    directory: &'a Path,
) -> Option<&'a str> {
    let relative = directory.strip_prefix(root).ok()?;
    let parts: Vec<_> = relative
        .components()
        .map(|component| match component {
            std::path::Component::Normal(value) => value.to_str(),
            _ => None,
        })
        .collect::<Option<_>>()?;
    if parts.len() < 3 || !digits(parts[0], 4) || !digits(parts[1], 2) {
        return None;
    }
    let mut slug = top_level_slug(parts[2])?;
    let year = parts[0].parse().ok()?;
    let month = parts[1].parse().ok()?;
    let day = parts[2][..2].parse().ok()?;
    NaiveDate::from_ymd_opt(year, month, day)?;
    let subtask_parts: Vec<_> = subtasks_dir
        .components()
        .map(|component| match component {
            std::path::Component::Normal(value) => value.to_str(),
            _ => None,
        })
        .collect::<Option<_>>()?;
    let mut index = 3;
    while index < parts.len() {
        if !subtask_parts.is_empty() {
            let end = index.checked_add(subtask_parts.len())?;
            if parts.get(index..end)? != subtask_parts.as_slice() {
                return None;
            }
            index = end;
        }
        slug = child_slug(parts.get(index)?)?;
        index += 1;
    }
    Some(slug)
}

pub fn read_canonical_task(
    root: &Path,
    subtasks_dir: &Path,
    directory: &Path,
    mode: MetadataMode,
) -> Result<StoredTask> {
    let slug = canonical_task_slug(root, subtasks_dir, directory).ok_or_else(|| {
        managed_error(
            "invalid_task_directory",
            directory,
            "Task is not stored at a canonical Task path",
        )
    })?;
    let task = read_task(directory, mode)?;
    if task.metadata.name != slug {
        return Err(managed_error(
            "task_name_path_mismatch",
            directory,
            "Task metadata name does not match its directory suffix",
        ));
    }
    Ok(task)
}

fn digits(value: &str, length: usize) -> bool {
    value.len() == length && value.bytes().all(|byte| byte.is_ascii_digit())
}

fn top_level_slug(value: &str) -> Option<&str> {
    let bytes = value.as_bytes();
    (bytes.len() > 7
        && bytes[0..2].iter().all(u8::is_ascii_digit)
        && bytes[2] == b'-'
        && bytes[3..5].iter().all(u8::is_ascii_digit)
        && bytes[5..7] == *b"--")
        .then(|| &value[7..])
}

fn child_slug(value: &str) -> Option<&str> {
    let bytes = value.as_bytes();
    (bytes.len() > 4 && bytes[0..2].iter().all(u8::is_ascii_digit) && bytes[2..4] == *b"--")
        .then(|| &value[4..])
}

pub fn visit_tasks(
    root: &Path,
    subtasks_dir: &Path,
    mode: MetadataMode,
    mut visitor: impl FnMut(StoredTask) -> Result<()>,
) -> Result<()> {
    visit_canonical_directories(root, subtasks_dir, |directory| {
        if let Ok(task) = read_canonical_task(root, subtasks_dir, directory, mode) {
            visitor(task)?;
        }
        Ok(())
    })
}

pub fn direct_canonical_tasks(
    root: &Path,
    subtasks_dir: &Path,
    base: &Path,
    mode: MetadataMode,
) -> Result<Vec<StoredTask>> {
    let mut tasks = Vec::new();
    for directory in direct_real_directories(base)? {
        if let Ok(task) = read_canonical_task(root, subtasks_dir, &directory, mode) {
            tasks.push(task);
        }
    }
    Ok(tasks)
}

pub fn scan_candidates(
    root: &Path,
    subtasks_dir: &Path,
    mode: MetadataMode,
) -> Result<Vec<PathBuf>> {
    let mut candidates = Vec::new();
    visit_tasks(root, subtasks_dir, mode, |task| {
        candidates.push(task.directory);
        Ok(())
    })?;
    candidates.sort();
    Ok(candidates)
}

pub fn scan_structural_candidates(root: &Path, subtasks_dir: &Path) -> Result<Vec<PathBuf>> {
    let mut candidates = Vec::new();
    visit_canonical_directories(root, subtasks_dir, |directory| {
        let metadata_present = carrier_present(&directory.join("tk.toml"))?;
        let body_present = carrier_present(&directory.join("TASK.md"))?;
        if metadata_present || body_present {
            candidates.push(directory.to_path_buf());
        }
        Ok(())
    })?;
    candidates.sort();
    Ok(candidates)
}

fn visit_canonical_directories(
    root: &Path,
    subtasks_dir: &Path,
    mut visitor: impl FnMut(&Path) -> Result<()>,
) -> Result<()> {
    for year in direct_real_directories(root)? {
        let Some(year_name) = year.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if !digits(year_name, 4) {
            continue;
        }
        for month in direct_real_directories(&year)? {
            let Some(month_name) = month.file_name().and_then(|value| value.to_str()) else {
                continue;
            };
            if !digits(month_name, 2)
                || !month_name
                    .parse::<u32>()
                    .is_ok_and(|month| (1..=12).contains(&month))
            {
                continue;
            }
            for task in direct_real_directories(&month)? {
                if !is_canonical_task_directory(root, subtasks_dir, &task) {
                    continue;
                }
                visitor(&task)?;
                visit_canonical_descendants(root, subtasks_dir, &task, &mut visitor)?;
            }
        }
    }
    Ok(())
}

fn visit_canonical_descendants(
    root: &Path,
    subtasks_dir: &Path,
    parent: &Path,
    visitor: &mut impl FnMut(&Path) -> Result<()>,
) -> Result<()> {
    let Some(base) = configured_subtask_base(parent, subtasks_dir)? else {
        return Ok(());
    };
    for task in direct_real_directories(&base)? {
        if !is_canonical_task_directory(root, subtasks_dir, &task) {
            continue;
        }
        visitor(&task)?;
        visit_canonical_descendants(root, subtasks_dir, &task, visitor)?;
    }
    Ok(())
}

fn configured_subtask_base(parent: &Path, subtasks_dir: &Path) -> Result<Option<PathBuf>> {
    let mut current = parent.to_path_buf();
    for component in subtasks_dir.components() {
        current.push(component.as_os_str());
        match fs::symlink_metadata(&current) {
            Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => {
                return Ok(None);
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(storage_error("inspect_subtask_root", &current, error)),
        }
    }
    Ok(Some(current))
}

fn direct_real_directories(base: &Path) -> Result<Vec<PathBuf>> {
    match fs::symlink_metadata(base) {
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => {
            return Ok(Vec::new());
        }
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(storage_error("inspect_task_directory", base, error)),
    }
    let mut directories = Vec::new();
    for entry in
        fs::read_dir(base).map_err(|error| storage_error("scan_task_directory", base, error))?
    {
        let entry = entry.map_err(|error| storage_error("scan_task_directory", base, error))?;
        let file_type = entry
            .file_type()
            .map_err(|error| storage_error("inspect_task_candidate", &entry.path(), error))?;
        if file_type.is_dir() && !file_type.is_symlink() {
            directories.push(entry.path());
        }
    }
    directories.sort();
    Ok(directories)
}

fn carrier_present(path: &Path) -> Result<bool> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(storage_error("inspect_task_candidate", path, error)),
    }
}

fn read_split_metadata(directory: &Path) -> Result<Metadata> {
    let metadata_path = directory.join("tk.toml");
    let body_path = directory.join("TASK.md");
    ensure_regular_file(&metadata_path)?;
    ensure_regular_file(&body_path)?;
    let text = fs::read_to_string(&metadata_path)
        .map_err(|error| storage_error("read_task_metadata", &metadata_path, error))?;
    let metadata: Metadata = toml::from_str(&text).map_err(|error| {
        managed_error("invalid_task_metadata", &metadata_path, error.to_string())
    })?;
    validate_managed_metadata(metadata, &metadata_path)
}

fn read_embed_metadata(path: &Path) -> Result<(Metadata, u64)> {
    ensure_regular_file(path)?;
    let file =
        File::open(path).map_err(|error| storage_error("open_task_metadata", path, error))?;
    let mut reader = BufReader::new(file);
    let mut line = Vec::new();
    let opening = read_line_capped(&mut reader, &mut line, 5)
        .map_err(|error| storage_error("read_task_metadata", path, error))?;
    if opening.is_none() || trim_line_ending(&line) != b"---" {
        return Err(managed_error(
            "missing_yaml_frontmatter",
            path,
            "TASK.md must start with a YAML frontmatter delimiter",
        ));
    }

    let mut yaml = Vec::new();
    loop {
        let remaining = MAX_FRONTMATTER_BYTES - yaml.len();
        let read = read_line_capped(&mut reader, &mut line, remaining.saturating_add(5))
            .map_err(|error| storage_error("read_task_metadata", path, error))?;
        let Some(read) = read else {
            return Err(frontmatter_too_large(path));
        };
        if read == 0 {
            return Err(managed_error(
                "unterminated_yaml_frontmatter",
                path,
                "YAML frontmatter has no closing delimiter",
            ));
        }
        if trim_line_ending(&line) == b"---" {
            break;
        }
        if line.len() > remaining {
            return Err(frontmatter_too_large(path));
        }
        yaml.extend_from_slice(&line);
    }
    let offset = reader
        .stream_position()
        .map_err(|error| storage_error("locate_task_body", path, error))?;
    let text = std::str::from_utf8(&yaml)
        .map_err(|error| managed_error("invalid_task_metadata_utf8", path, error.to_string()))?;
    reject_yaml_extensions(text, path)?;
    let metadata: Metadata = serde_yml::from_str(text)
        .map_err(|error| managed_error("invalid_task_metadata", path, error.to_string()))?;
    Ok((validate_managed_metadata(metadata, path)?, offset))
}

fn read_line_capped(
    reader: &mut impl BufRead,
    line: &mut Vec<u8>,
    limit: usize,
) -> std::io::Result<Option<usize>> {
    line.clear();
    loop {
        let available = reader.fill_buf()?;
        if available.is_empty() {
            return Ok(Some(line.len()));
        }
        let newline = available.iter().position(|byte| *byte == b'\n');
        let consumed = newline.map_or(available.len(), |index| index + 1);
        if line.len().saturating_add(consumed) > limit {
            return Ok(None);
        }
        line.extend_from_slice(&available[..consumed]);
        reader.consume(consumed);
        if newline.is_some() {
            return Ok(Some(line.len()));
        }
    }
}

fn frontmatter_too_large(path: &Path) -> TkError {
    managed_error(
        "yaml_frontmatter_too_large",
        path,
        format!("YAML frontmatter exceeds {MAX_FRONTMATTER_BYTES} bytes"),
    )
}

fn reject_yaml_extensions(text: &str, path: &Path) -> Result<()> {
    let value: serde_yml::Value = serde_yml::from_str(text)
        .map_err(|error| managed_error("invalid_task_metadata", path, error.to_string()))?;
    fn contains_tag(value: &serde_yml::Value) -> bool {
        match value {
            serde_yml::Value::Sequence(values) => values.iter().any(contains_tag),
            serde_yml::Value::Mapping(values) => values
                .iter()
                .any(|(key, value)| contains_tag(key) || contains_tag(value)),
            serde_yml::Value::Tagged(_) => true,
            _ => false,
        }
    }
    if contains_tag(&value) {
        return Err(managed_error(
            "unsupported_yaml_feature",
            path,
            "YAML tags are not supported in Task metadata",
        ));
    }
    Ok(())
}

fn validate_managed_metadata(mut metadata: Metadata, path: &Path) -> Result<Metadata> {
    if let Err(mut error) = metadata.validate() {
        error.category = ErrorCategory::ManagedFile;
        error.details = Some(serde_json::json!({"path": path}));
        return Err(error);
    }
    metadata.depends_on.sort_unstable();
    metadata.depends_on.dedup();
    metadata.related_to.sort_unstable();
    metadata.related_to.dedup();
    Ok(metadata)
}

fn encode_toml(metadata: &Metadata) -> Result<Vec<u8>> {
    let mut text = toml::to_string(metadata).map_err(|error| {
        TkError::new(
            "encode_task_metadata_failed",
            ErrorCategory::Internal,
            error.to_string(),
        )
    })?;
    if !text.ends_with('\n') {
        text.push('\n');
    }
    Ok(text.into_bytes())
}

fn encode_frontmatter(metadata: &Metadata) -> Result<Vec<u8>> {
    let mut output = String::from("---\n");
    output.push_str(&format!("schema_version: {}\n", metadata.schema_version));
    output.push_str(&format!("id: {}\n", json_string(&metadata.id.to_string())?));
    output.push_str(&format!("name: {}\n", json_string(&metadata.name)?));
    output.push_str(&format!(
        "status: {}\n",
        json_string(&metadata.status.to_string())?
    ));
    output.push_str(&format!(
        "created_at: {}\n",
        json_string(&metadata.created_at.to_rfc3339())?
    ));
    if !metadata.depends_on.is_empty() {
        let values: Vec<String> = metadata
            .depends_on
            .iter()
            .map(ToString::to_string)
            .collect();
        output.push_str(&format!(
            "depends_on: {}\n",
            serde_json::to_string(&values).unwrap()
        ));
    }
    if !metadata.related_to.is_empty() {
        let values: Vec<String> = metadata
            .related_to
            .iter()
            .map(ToString::to_string)
            .collect();
        output.push_str(&format!(
            "related_to: {}\n",
            serde_json::to_string(&values).unwrap()
        ));
    }
    if !metadata.extra.is_empty() {
        output.push_str(&format!(
            "extra: {}\n",
            serde_json::to_string(&metadata.extra).map_err(|error| {
                TkError::new(
                    "encode_task_metadata_failed",
                    ErrorCategory::Internal,
                    error.to_string(),
                )
            })?
        ));
    }
    output.push_str("---\n");
    Ok(output.into_bytes())
}

fn json_string(value: &str) -> Result<String> {
    serde_json::to_string(value).map_err(|error| {
        TkError::new(
            "encode_task_metadata_failed",
            ErrorCategory::Internal,
            error.to_string(),
        )
    })
}

fn trim_line_ending(line: &[u8]) -> &[u8] {
    line.strip_suffix(b"\n")
        .unwrap_or(line)
        .strip_suffix(b"\r")
        .unwrap_or_else(|| line.strip_suffix(b"\n").unwrap_or(line))
}

fn ensure_regular_file(path: &Path) -> Result<()> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| storage_error("inspect_managed_file", path, error))?;
    if metadata.file_type().is_symlink() || !metadata.file_type().is_file() {
        return Err(managed_error(
            "invalid_managed_file_type",
            path,
            "Managed file must be a regular file and cannot be a symlink",
        ));
    }
    Ok(())
}

fn managed_error(code: &str, path: impl AsRef<Path>, message: impl Into<String>) -> TkError {
    let path = path.as_ref();
    TkError::new(code, ErrorCategory::ManagedFile, message)
        .with_details(serde_json::json!({"path": path}))
}

impl std::fmt::Display for crate::domain::Status {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(match self {
            Self::Planning => "planning",
            Self::Open => "open",
            Self::Closed => "closed",
        })
    }
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use chrono::DateTime;
    use serde_json::json;
    use uuid::Uuid;

    use super::*;
    use crate::domain::Status;
    use crate::version::TASK_SCHEMA_VERSION;

    fn metadata() -> Metadata {
        Metadata {
            schema_version: TASK_SCHEMA_VERSION,
            id: Uuid::now_v7(),
            name: "tk-设计".into(),
            status: Status::Open,
            created_at: DateTime::parse_from_rfc3339("2026-08-28T10:00:00+08:00").unwrap(),
            depends_on: vec![],
            related_to: vec![],
            extra: BTreeMap::from([("area".into(), json!({"z": 1, "a": true}))]),
        }
    }

    fn temp_directory() -> PathBuf {
        let path = std::env::temp_dir().join(format!("tk-store-test-{}", Uuid::now_v7()));
        fs::create_dir(&path).unwrap();
        path
    }

    #[test]
    fn split_and_embed_decode_to_same_metadata() {
        let root = temp_directory();
        let split = root.join("split");
        let embed = root.join("embed");
        let expected = metadata();
        create_task_files(&split, &expected, b"# split\n", MetadataMode::Split).unwrap();
        create_task_files(&embed, &expected, b"# embed\n", MetadataMode::Embed).unwrap();
        assert_eq!(
            read_task(&split, MetadataMode::Split).unwrap().metadata,
            expected
        );
        assert_eq!(
            read_task(&embed, MetadataMode::Embed).unwrap().metadata,
            expected
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn embed_replacement_preserves_body_bytes() {
        let root = temp_directory();
        let task = root.join("task");
        let mut changed = metadata();
        let body = b"# title\r\n\r\n---\nbody\r\n";
        create_task_files(&task, &changed, body, MetadataMode::Embed).unwrap();
        changed.status = Status::Closed;
        replace_metadata(&task, &changed, MetadataMode::Embed).unwrap();
        assert_eq!(
            read_body(&task, MetadataMode::Embed).unwrap().as_bytes(),
            body
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_unknown_yaml_fields() {
        let root = temp_directory();
        let task = root.join("task");
        fs::create_dir(&task).unwrap();
        fs::write(
            task.join("TASK.md"),
            "---\nschema_version: 1\nunknown: true\n---\n# body\n",
        )
        .unwrap();
        assert!(read_task(&task, MetadataMode::Embed).is_err());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_oversized_embed_frontmatter_before_a_line_is_fully_read() {
        let root = temp_directory();
        let task = root.join("task");
        fs::create_dir(&task).unwrap();
        let path = task.join("TASK.md");

        let mut no_newline = b"---\n".to_vec();
        no_newline.extend(std::iter::repeat_n(b'x', MAX_FRONTMATTER_BYTES + 1024));
        fs::write(&path, no_newline).unwrap();
        let error = read_task(&task, MetadataMode::Embed).unwrap_err();
        assert_eq!(error.code, "yaml_frontmatter_too_large");

        let mut single_line = b"---\nname: ".to_vec();
        single_line.extend(std::iter::repeat_n(b'x', MAX_FRONTMATTER_BYTES + 1024));
        single_line.extend_from_slice(b"\n---\n");
        fs::write(&path, single_line).unwrap();
        let error = read_task(&task, MetadataMode::Embed).unwrap_err();
        assert_eq!(error.code, "yaml_frontmatter_too_large");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn candidate_scan_ignores_noncanonical_task_placements() {
        let root = temp_directory();
        let top = root.join("2026/08/28-01--tk-设计");
        create_task_files(&top, &metadata(), b"top\n", MetadataMode::Split).unwrap();

        let mut child_metadata = metadata();
        child_metadata.id = Uuid::now_v7();
        child_metadata.name = "child".into();
        let child = top.join("01--child");
        create_task_files(&child, &child_metadata, b"child\n", MetadataMode::Split).unwrap();

        let mut misplaced_metadata = metadata();
        misplaced_metadata.id = Uuid::now_v7();
        misplaced_metadata.name = "misplaced".into();
        let misplaced = top.join("materials/2026/08/28-02--misplaced");
        create_task_files(
            &misplaced,
            &misplaced_metadata,
            b"misplaced\n",
            MetadataMode::Split,
        )
        .unwrap();
        let arbitrary = root.join("foo--tk-设计");
        create_task_files(&arbitrary, &metadata(), b"arbitrary\n", MetadataMode::Split).unwrap();

        let candidates = scan_candidates(&root, Path::new(""), MetadataMode::Split).unwrap();
        assert_eq!(candidates, vec![top, child]);
        assert!(!is_canonical_task_directory(
            &root,
            Path::new(""),
            &misplaced
        ));
        assert!(is_canonical_task_directory(
            &root,
            Path::new("children/items"),
            &root.join("2026/08/28-01--parent/children/items/01--child")
        ));
        for invalid in [
            "2026/8/28-01--task",
            "2026/08/8-01--task",
            "2026/08/28-1--task",
            "2026/08/28-01-task",
            "2026/08/28-01--",
            "2026/13/28-01--task",
            "2026/02/30-01--task",
            "2026/08/28-01--parent/1--child",
        ] {
            assert!(!is_canonical_task_directory(
                &root,
                Path::new(""),
                &root.join(invalid)
            ));
        }
        fs::remove_dir_all(root).unwrap();
    }
}
