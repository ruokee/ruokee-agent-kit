use std::collections::{BTreeSet, VecDeque};
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

use chrono::{DateTime, FixedOffset, Local};
use serde::Serialize;

use crate::error::{ErrorCategory, Result, TkError};
use crate::path::storage_error;

const MAX_WAL_INPUT_BYTES: usize = 1024 * 1024;
const MAX_WAL_READ_ENTRIES: usize = 1000;
const MAX_WAL_FILES: usize = 1024;

#[derive(Debug, Clone, Serialize)]
pub struct WalEntry {
    pub timestamp: DateTime<FixedOffset>,
    pub actor: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WalEntryView {
    Summary,
    Detailed,
}

#[derive(Debug, Clone, Serialize)]
pub struct WalWarning {
    pub code: String,
    pub message: String,
    pub path: PathBuf,
}

#[derive(Debug, Default, Serialize)]
pub struct WalRead {
    pub entries: Vec<WalEntry>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub warnings: Vec<WalWarning>,
}

pub fn append(
    task_directory: &Path,
    message: &str,
    body: Option<&str>,
    actor: &str,
) -> Result<WalEntry> {
    validate_single_line("message", message, false)?;
    validate_single_line("actor", actor, false)?;
    if actor.contains(" · ") {
        return Err(TkError::request(
            "invalid_actor",
            "actor cannot contain the WAL header delimiter",
        ));
    }

    let timestamp = Local::now().fixed_offset();
    crate::cancel::begin_write()?;
    let directory = task_directory.join("wal");
    match fs::symlink_metadata(&directory) {
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => {
            return Err(TkError::new(
                "invalid_wal_directory",
                ErrorCategory::ManagedFile,
                format!("WAL path is not a real directory: {}", directory.display()),
            ));
        }
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            fs::create_dir(&directory)
                .map_err(|error| storage_error("create_wal_directory", &directory, error))?;
        }
        Err(error) => return Err(storage_error("inspect_wal", &directory, error)),
    }
    let path = directory.join(format!("{}.md", timestamp.format("%Y-%m-%d")));
    match fs::symlink_metadata(&path) {
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_file() => {
            return Err(TkError::new(
                "invalid_wal_file",
                ErrorCategory::ManagedFile,
                format!("WAL entry path is not a regular file: {}", path.display()),
            ));
        }
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(storage_error("inspect_wal", &path, error)),
    }
    let needs_separator = path.metadata().is_ok_and(|metadata| metadata.len() > 0);
    let mut encoded = String::new();
    if needs_separator {
        encoded.push('\n');
    }
    encoded.push_str(&format!(
        "## {} · {}\n\n{}\n",
        timestamp.to_rfc3339(),
        actor,
        message
    ));
    if let Some(body) = body.filter(|body| !body.is_empty()) {
        encoded.push('\n');
        encoded.push_str(body);
        if !body.ends_with('\n') {
            encoded.push('\n');
        }
    }
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|error| storage_error("open_wal", &path, error))?;
    file.write_all(encoded.as_bytes())
        .map_err(|error| storage_error("append_wal", &path, error))?;
    file.flush()
        .map_err(|error| storage_error("flush_wal", &path, error))?;

    Ok(WalEntry {
        timestamp,
        actor: actor.to_owned(),
        message: message.to_owned(),
        body: body.filter(|body| !body.is_empty()).map(ToOwned::to_owned),
    })
}

pub fn read(
    task_directory: &Path,
    limit: usize,
    max_length: usize,
    view: WalEntryView,
) -> Result<WalRead> {
    read_bounded(task_directory, limit, max_length, view).map(|(result, _, _)| result)
}

pub fn inspect(task_directory: &Path) -> Result<Vec<WalWarning>> {
    let Some(directory) = wal_directory(task_directory)? else {
        return Ok(Vec::new());
    };
    let paths = wal_paths(&directory, None)?;
    let mut warnings = Vec::new();
    for path in paths {
        crate::cancel::check()?;
        inspect_file(&path, &mut warnings)?;
    }
    Ok(warnings)
}

fn read_bounded(
    task_directory: &Path,
    limit: usize,
    max_length: usize,
    view: WalEntryView,
) -> Result<(WalRead, usize, usize)> {
    let Some(directory) = wal_directory(task_directory)? else {
        return Ok((WalRead::default(), 0, 0));
    };
    let paths = wal_paths(&directory, Some(MAX_WAL_FILES))?;
    if paths.is_empty() {
        return Ok((WalRead::default(), 0, 0));
    }

    let entry_budget = limit.min(MAX_WAL_READ_ENTRIES);
    if entry_budget == 0 || max_length == 0 {
        return Ok((WalRead::default(), 0, 0));
    }

    let paths = paths.into_iter().rev().collect::<Vec<_>>();
    let mut entries = Vec::new();
    let mut warnings = Vec::new();
    let mut input_bytes = 0;
    for (index, path) in paths.iter().enumerate() {
        if entries.len() >= entry_budget || input_bytes >= MAX_WAL_INPUT_BYTES {
            break;
        }
        let mut file = File::open(path).map_err(|error| storage_error("read_wal", path, error))?;
        let length = file
            .metadata()
            .map_err(|error| storage_error("inspect_wal", path, error))?
            .len();
        let remaining = MAX_WAL_INPUT_BYTES - input_bytes;
        let take = usize::try_from(length.min(remaining as u64)).unwrap_or(remaining);
        file.seek(SeekFrom::Start(length.saturating_sub(take as u64)))
            .map_err(|error| storage_error("seek_wal", path, error))?;
        let mut bytes = Vec::with_capacity(take);
        file.take(take as u64)
            .read_to_end(&mut bytes)
            .map_err(|error| storage_error("read_wal", path, error))?;
        input_bytes += bytes.len();
        if std::str::from_utf8(&bytes).is_err() {
            warnings.push(WalWarning {
                code: "wal_invalid_utf8".into(),
                message: "WAL contains invalid UTF-8; invalid bytes were replaced".into(),
                path: path.clone(),
            });
        }
        let text = String::from_utf8_lossy(&bytes);
        let remaining_entries = entry_budget - entries.len();
        let mut parsed = parse_file(path, &text, remaining_entries, &mut warnings);
        entries.append(&mut parsed);
        if index + 1 < paths.len()
            && (entries.len() >= entry_budget || input_bytes >= MAX_WAL_INPUT_BYTES)
        {
            break;
        }
    }
    entries.sort_by_key(|entry| entry.timestamp);
    let parsed_entries = entries.len();

    let mut selected = Vec::new();
    let mut used: usize = 0;
    for entry in entries.into_iter().rev() {
        let entry = project_entry(entry, view);
        let size = serde_json::to_vec(&entry)
            .expect("serializing WAL entry for output budget")
            .len();
        if selected.len() >= limit || used.saturating_add(size) > max_length {
            break;
        }
        used += size;
        selected.push(entry);
    }
    selected.reverse();
    Ok((
        WalRead {
            entries: selected,
            warnings,
        },
        input_bytes,
        parsed_entries,
    ))
}

fn wal_directory(task_directory: &Path) -> Result<Option<PathBuf>> {
    let directory = task_directory.join("wal");
    let metadata = match fs::symlink_metadata(&directory) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(storage_error("inspect_wal", &directory, error)),
    };
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(TkError::new(
            "invalid_wal_directory",
            ErrorCategory::ManagedFile,
            format!("WAL path is not a directory: {}", directory.display()),
        ));
    }
    Ok(Some(directory))
}

fn wal_paths(directory: &Path, max_files: Option<usize>) -> Result<BTreeSet<PathBuf>> {
    let mut paths = BTreeSet::new();
    for entry in
        fs::read_dir(directory).map_err(|error| storage_error("scan_wal", directory, error))?
    {
        let entry = entry.map_err(|error| storage_error("scan_wal", directory, error))?;
        let path = entry.path();
        let metadata = fs::symlink_metadata(&path)
            .map_err(|error| storage_error("inspect_wal", &path, error))?;
        if metadata.is_file()
            && !metadata.file_type().is_symlink()
            && path.extension().is_some_and(|extension| extension == "md")
        {
            paths.insert(path);
            if max_files.is_some_and(|max_files| paths.len() > max_files) {
                let oldest = paths.iter().next().cloned().expect("set is non-empty");
                paths.remove(&oldest);
            }
        }
    }
    Ok(paths)
}

fn project_entry(mut entry: WalEntry, view: WalEntryView) -> WalEntry {
    if view == WalEntryView::Summary {
        entry.body = None;
    }
    entry
}

fn inspect_file(path: &Path, warnings: &mut Vec<WalWarning>) -> Result<()> {
    let file = File::open(path).map_err(|error| storage_error("read_wal", path, error))?;
    let mut reader = BufReader::new(file);
    let mut bytes = Vec::new();
    let mut current_has_message = None;
    let mut fragment = false;
    let mut invalid_utf8 = false;
    loop {
        crate::cancel::check()?;
        bytes.clear();
        if reader
            .read_until(b'\n', &mut bytes)
            .map_err(|error| storage_error("read_wal", path, error))?
            == 0
        {
            break;
        }
        if bytes.last() == Some(&b'\n') {
            bytes.pop();
        }
        if bytes.last() == Some(&b'\r') {
            bytes.pop();
        }
        if !invalid_utf8 && std::str::from_utf8(&bytes).is_err() {
            invalid_utf8 = true;
            warnings.push(WalWarning {
                code: "wal_invalid_utf8".into(),
                message: "WAL contains invalid UTF-8; invalid bytes were replaced".into(),
                path: path.to_path_buf(),
            });
        }
        let line = String::from_utf8_lossy(&bytes);
        if let Some(header) = line.strip_prefix("## ") {
            if parse_header(header).is_some() {
                finish_inspected_entry(path, current_has_message.take(), warnings);
                current_has_message = Some(false);
            } else if let Some(has_message) = &mut current_has_message {
                if !*has_message && !line.trim().is_empty() {
                    *has_message = true;
                }
            } else {
                fragment = true;
            }
        } else if let Some(has_message) = &mut current_has_message {
            if !*has_message && !line.trim().is_empty() {
                *has_message = true;
            }
        } else if !line.trim().is_empty() {
            fragment = true;
        }
    }
    crate::cancel::check()?;
    finish_inspected_entry(path, current_has_message, warnings);
    if fragment {
        warnings.push(WalWarning {
            code: "wal_fragment".into(),
            message: "WAL contains text outside a parseable entry".into(),
            path: path.to_path_buf(),
        });
    }
    Ok(())
}

fn finish_inspected_entry(path: &Path, has_message: Option<bool>, warnings: &mut Vec<WalWarning>) {
    if has_message == Some(false) {
        warnings.push(WalWarning {
            code: "wal_fragment".into(),
            message: "WAL entry has no message".into(),
            path: path.to_path_buf(),
        });
    }
}

fn parse_file(
    path: &Path,
    text: &str,
    max_entries: usize,
    warnings: &mut Vec<WalWarning>,
) -> Vec<WalEntry> {
    let mut entries = VecDeque::new();
    let mut current: Option<(DateTime<FixedOffset>, String, Vec<&str>)> = None;
    let mut fragment = false;

    for line in text.lines() {
        if let Some(header) = line.strip_prefix("## ") {
            if let Some((timestamp, actor)) = parse_header(header) {
                finish_entry(path, current.take(), &mut entries, max_entries, warnings);
                current = Some((timestamp, actor, Vec::new()));
            } else if let Some((_, _, lines)) = &mut current {
                lines.push(line);
            } else {
                fragment = true;
            }
        } else if let Some((_, _, lines)) = &mut current {
            lines.push(line);
        } else if !line.trim().is_empty() {
            fragment = true;
        }
    }
    finish_entry(path, current, &mut entries, max_entries, warnings);
    if fragment {
        warnings.push(WalWarning {
            code: "wal_fragment".into(),
            message: "WAL contains text outside a parseable entry".into(),
            path: path.to_path_buf(),
        });
    }
    entries.into_iter().collect()
}

fn parse_header(value: &str) -> Option<(DateTime<FixedOffset>, String)> {
    let (timestamp, actor) = value.split_once(" · ")?;
    if actor.is_empty() || actor.contains('\n') {
        return None;
    }
    Some((DateTime::parse_from_rfc3339(timestamp).ok()?, actor.into()))
}

fn finish_entry(
    path: &Path,
    current: Option<(DateTime<FixedOffset>, String, Vec<&str>)>,
    entries: &mut VecDeque<WalEntry>,
    max_entries: usize,
    warnings: &mut Vec<WalWarning>,
) {
    let Some((timestamp, actor, lines)) = current else {
        return;
    };
    let Some(message_index) = lines.iter().position(|line| !line.trim().is_empty()) else {
        warnings.push(WalWarning {
            code: "wal_fragment".into(),
            message: "WAL entry has no message".into(),
            path: path.to_path_buf(),
        });
        return;
    };
    let message = lines[message_index].to_owned();
    let body_lines = &lines[message_index + 1..];
    let first = body_lines.iter().position(|line| !line.is_empty());
    let last = body_lines.iter().rposition(|line| !line.is_empty());
    let body = first
        .zip(last)
        .map(|(first, last)| body_lines[first..=last].join("\n"));
    if entries.len() == max_entries {
        entries.pop_front();
    }
    entries.push_back(WalEntry {
        timestamp,
        actor,
        message,
        body,
    });
}

fn validate_single_line(field: &str, value: &str, allow_empty: bool) -> Result<()> {
    if (!allow_empty && value.trim().is_empty()) || value.contains(['\r', '\n']) {
        return Err(TkError::request(
            format!("invalid_{field}"),
            format!("{field} must be a non-empty single line"),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn temp_task() -> PathBuf {
        let path = std::env::temp_dir().join(format!("tk-wal-test-{}", Uuid::now_v7()));
        fs::create_dir(&path).unwrap();
        path
    }

    #[test]
    fn appends_and_reads_entries_with_budget() {
        let task = temp_task();
        append(&task, "first", Some("body"), "test:one").unwrap();
        append(&task, "second", None, "test:two").unwrap();
        let read = read(&task, 1, 100, WalEntryView::Detailed).unwrap();
        assert_eq!(read.entries.len(), 1);
        assert_eq!(read.entries[0].message, "second");
        fs::remove_dir_all(task).unwrap();
    }

    #[test]
    fn reports_unparseable_fragments() {
        let task = temp_task();
        fs::create_dir(task.join("wal")).unwrap();
        fs::write(task.join("wal/2026-08-28.md"), "broken tail\n").unwrap();
        assert_eq!(
            read(&task, 20, 2000, WalEntryView::Summary)
                .unwrap()
                .warnings
                .len(),
            1
        );
        fs::remove_dir_all(task).unwrap();
    }

    #[test]
    fn retains_h2_headings_inside_entry_body() {
        let task = temp_task();
        fs::create_dir(task.join("wal")).unwrap();
        fs::write(
            task.join("wal/2026-08-28.md"),
            "## 2026-08-28T10:00:00+08:00 · test:writer\nmessage\n\n## Heading\ndetail\n",
        )
        .unwrap();
        let result = read(&task, 20, 2000, WalEntryView::Detailed).unwrap();
        assert!(result.warnings.is_empty());
        assert_eq!(result.entries.len(), 1);
        assert_eq!(
            result.entries[0].body.as_deref(),
            Some("## Heading\ndetail")
        );
        fs::remove_dir_all(task).unwrap();
    }

    #[test]
    fn projects_entries_before_applying_the_byte_budget() {
        let task = temp_task();
        let entry = append(&task, "message", Some(&"x".repeat(500)), "test:writer").unwrap();
        let mut projected = entry.clone();
        projected.body = None;
        let summary_size = serde_json::to_vec(&projected).unwrap().len();
        assert!(serde_json::to_vec(&entry).unwrap().len() > summary_size);

        let summary = read(&task, 1, summary_size, WalEntryView::Summary).unwrap();
        assert_eq!(summary.entries.len(), 1);
        assert!(summary.entries[0].body.is_none());

        let detailed = read(&task, 1, summary_size, WalEntryView::Detailed).unwrap();
        assert!(detailed.entries.is_empty());
        fs::remove_dir_all(task).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn append_rejects_symlinked_wal_targets() {
        use std::os::unix::fs::symlink;

        let task = temp_task();
        let outside = task.with_extension("outside");
        fs::create_dir(&outside).unwrap();
        symlink(&outside, task.join("wal")).unwrap();
        let error = append(&task, "message", None, "test").unwrap_err();
        assert_eq!(error.code, "invalid_wal_directory");
        assert!(fs::read_dir(&outside).unwrap().next().is_none());
        fs::remove_dir_all(&task).unwrap();

        let task = temp_task();
        fs::create_dir(task.join("wal")).unwrap();
        let external_file = task.with_extension("external-file");
        fs::write(&external_file, "keep").unwrap();
        let entry = task
            .join("wal")
            .join(format!("{}.md", Local::now().format("%Y-%m-%d")));
        symlink(&external_file, entry).unwrap();
        let error = append(&task, "message", None, "test").unwrap_err();
        assert_eq!(error.code, "invalid_wal_file");
        assert_eq!(fs::read_to_string(&external_file).unwrap(), "keep");
        fs::remove_dir_all(&task).unwrap();
        fs::remove_file(external_file).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }
}

#[cfg(test)]
mod bounded_tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn bounds_input_bytes_and_parsed_entries_across_files() {
        let task = std::env::temp_dir().join(format!("tk-wal-bound-test-{}", Uuid::now_v7()));
        let directory = task.join("wal");
        fs::create_dir_all(&directory).unwrap();
        for day in 1..=3 {
            let mut text = String::new();
            for minute in 0..600 {
                text.push_str(&format!(
                    "## 2026-08-{day:02}T10:{:02}:00+08:00 · test:writer\n\nmessage-{minute}\n\n{}\n\n",
                    minute % 60,
                    "x".repeat(800)
                ));
            }
            fs::write(directory.join(format!("2026-08-{day:02}.md")), text).unwrap();
        }

        let (_, input_bytes, parsed_entries) =
            read_bounded(&task, usize::MAX, usize::MAX, WalEntryView::Detailed).unwrap();
        assert!(input_bytes <= MAX_WAL_INPUT_BYTES);
        assert!(parsed_entries <= MAX_WAL_READ_ENTRIES);
        fs::remove_dir_all(task).unwrap();
    }
}
