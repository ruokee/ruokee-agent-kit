use std::borrow::Cow;
use std::collections::{BTreeSet, HashMap, HashSet};
use std::fs;
use std::io::Write;
use std::ops::Range;
use std::path::{Component, Path, PathBuf};

use regex::Regex;
use serde::Serialize;

use crate::error::{ErrorCategory, Result, TkError};
use crate::path::{atomic_write_with, storage_error};
use crate::project::{GitPolicy, MetadataMode, Project};
use crate::reports::Step;
use crate::task_store::TaskGraph;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DirectoryMove {
    pub source: PathBuf,
    pub target: PathBuf,
}

// Callers sort directory moves by source before scanning.
pub fn mapped_path<'a>(path: &'a Path, moves: &[DirectoryMove]) -> Cow<'a, Path> {
    for ancestor in path.ancestors() {
        if let Ok(index) = moves.binary_search_by(|item| item.source.as_path().cmp(ancestor)) {
            let suffix = path.strip_prefix(ancestor).expect("ancestor prefix");
            return Cow::Owned(if suffix.as_os_str().is_empty() {
                moves[index].target.clone()
            } else {
                moves[index].target.join(suffix)
            });
        }
    }
    Cow::Borrowed(path)
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Reference {
    pub kind: &'static str,
    pub old_file: PathBuf,
    pub target_file: PathBuf,
    pub line: usize,
    pub byte_start: usize,
    pub byte_end: usize,
    pub original: String,
    pub replacement: String,
    pub old_target: PathBuf,
    pub target: PathBuf,
}

struct ReferenceFile {
    path: PathBuf,
    original: String,
    edits: Vec<(Range<usize>, String)>,
}

#[derive(Default, Serialize)]
pub struct ReferenceScan {
    pub scan_roots: Vec<PathBuf>,
    pub references: Vec<Reference>,
    #[serde(skip)]
    paths: Vec<PathBuf>,
    #[serde(skip)]
    files: Vec<ReferenceFile>,
}

impl ReferenceScan {
    pub fn collect(
        &mut self,
        project: &Project,
        graph: &TaskGraph,
        moves: &[DirectoryMove],
        focus: &[PathBuf],
        extra: &[PathBuf],
        keep_content: bool,
    ) -> Result<()> {
        let default = match project.config.git_policy {
            GitPolicy::Track => &project.root,
            GitPolicy::Ignore | GitPolicy::None => &project.task_root,
        };
        let mut roots = BTreeSet::from([default.clone()]);
        for path in extra {
            let path = if path.is_absolute() {
                path.clone()
            } else {
                project.root.join(path)
            };
            for ancestor in path.ancestors() {
                let metadata = fs::symlink_metadata(ancestor).map_err(|error| {
                    storage_error("inspect_reference_scan_path", ancestor, error)
                })?;
                if metadata.file_type().is_symlink() {
                    return Err(TkError::request(
                        "invalid_request",
                        format!(
                            "Reference scan path is a symbolic link: {}",
                            ancestor.display()
                        ),
                    ));
                }
            }
            roots.insert(normalize(&path));
        }
        self.scan_roots = roots.into_iter().collect();
        let mut excluded = HashSet::from([project.task_root.join(".tk-tmp")]);
        excluded.extend(
            graph
                .tasks
                .iter()
                .map(|task| task.task.directory.join("wal")),
        );
        excluded.extend(
            graph
                .invalid_candidates
                .iter()
                .map(|task| task.directory.join("wal")),
        );
        self.paths = walk(&self.scan_roots, &excluded)?;
        let needles = Needles::new(project, moves, focus)?;
        let embedded: HashSet<_> = graph
            .tasks
            .iter()
            .map(|task| task.task.directory.as_path())
            .collect();
        for path in &self.paths {
            crate::cancel::checkpoint()?;
            let text = fs::read_to_string(path)
                .map_err(|error| storage_error("read_markdown_reference", path, error))?;
            let body_start = if project.config.metadata_mode == MetadataMode::Embed
                && path.file_name().is_some_and(|name| name == "TASK.md")
                && path
                    .parent()
                    .is_some_and(|parent| embedded.contains(parent))
            {
                body_start(&text)
            } else {
                0
            };
            let mut line_starts = vec![0];
            line_starts.extend(text.match_indices('\n').map(|(offset, _)| offset + 1));
            let target_file = mapped_path(path, moves);
            let destinations = destinations(&text, body_start);
            let mut records = Vec::new();
            for destination in &destinations {
                let original = &text[destination.range.clone()];
                let translated = if destination.kind == "wikilink" {
                    needles.translate_wiki(original, &project.root)
                } else {
                    translate_link(
                        original,
                        path,
                        &target_file,
                        moves,
                        focus,
                        destination.angle,
                    )
                }?;
                if let Some((replacement, old_target, target)) = translated {
                    records.push(Reference {
                        kind: destination.kind,
                        old_file: path.clone(),
                        target_file: target_file.to_path_buf(),
                        line: line_starts
                            .partition_point(|offset| *offset <= destination.range.start),
                        byte_start: destination.range.start,
                        byte_end: destination.range.end,
                        original: original.to_owned(),
                        replacement,
                        old_target,
                        target,
                    });
                }
            }
            if let Some(pattern) = &needles.pattern {
                for found in pattern.find_iter(&text[body_start..]) {
                    let start = body_start + found.start();
                    let end = body_start + found.end();
                    if destinations
                        .iter()
                        .any(|item| start < item.protected.end && end > item.protected.start)
                        || !path_boundary(&text, start, end)
                        || inside_uri(&text, start)
                    {
                        continue;
                    }
                    let needle = &needles.items[found.as_str()];
                    records.push(Reference {
                        kind: "path_text",
                        old_file: path.clone(),
                        target_file: target_file.to_path_buf(),
                        line: line_starts.partition_point(|offset| *offset <= start),
                        byte_start: start,
                        byte_end: end,
                        original: found.as_str().to_owned(),
                        replacement: needle.replacement.clone(),
                        old_target: needle.source.clone(),
                        target: needle.target.clone(),
                    });
                }
            }
            records.sort_by_key(|record| (record.byte_start, record.byte_end));
            let mut edits = Vec::new();
            let mut previous_end = 0;
            for record in &records {
                if record.byte_start < previous_end {
                    return Err(TkError::new(
                        "overlapping_reference_edits",
                        ErrorCategory::Internal,
                        "Reference intervals overlap",
                    ));
                }
                previous_end = record.byte_end;
                if record.original != record.replacement {
                    edits.push((
                        record.byte_start..record.byte_end,
                        record.replacement.clone(),
                    ));
                }
            }
            self.references.extend(records);
            if keep_content && !edits.is_empty() {
                self.files.push(ReferenceFile {
                    path: path.clone(),
                    original: text,
                    edits,
                });
            }
        }
        Ok(())
    }

    pub fn file_count(&self) -> usize {
        self.files.len()
    }

    pub fn steps(&self, moves: &[DirectoryMove]) -> Vec<Step> {
        self.files
            .iter()
            .map(|file| Step::new("rewrite_references", &mapped_path(&file.path, moves)))
            .collect()
    }

    pub fn verify(
        &self,
        project: &Project,
        graph: &TaskGraph,
        moves: &[DirectoryMove],
        focus: &[PathBuf],
        extra: &[PathBuf],
    ) -> Result<()> {
        let mut current = Self::default();
        current.collect(project, graph, moves, focus, extra, false)?;
        if current.paths != self.paths || current.references != self.references {
            return Err(stale("Reference files or locations changed after scanning"));
        }
        for file in &self.files {
            verify_file(file, &file.path)?;
        }
        Ok(())
    }

    pub fn commit(&self, moves: &[DirectoryMove], completed: &mut Vec<Step>) -> Result<()> {
        for file in &self.files {
            crate::cancel::checkpoint()?;
            let target = mapped_path(&file.path, moves);
            verify_file(file, &target)?;
            atomic_write_with(&target, |writer| {
                let mut offset = 0;
                for (range, replacement) in &file.edits {
                    writer
                        .write_all(&file.original.as_bytes()[offset..range.start])
                        .and_then(|()| writer.write_all(replacement.as_bytes()))
                        .map_err(|error| {
                            storage_error("write_markdown_reference", &target, error)
                        })?;
                    offset = range.end;
                }
                writer
                    .write_all(&file.original.as_bytes()[offset..])
                    .map_err(|error| storage_error("write_markdown_reference", &target, error))
            })?;
            completed.push(Step::new("rewrite_references", &target));
        }
        Ok(())
    }
}

fn verify_file(file: &ReferenceFile, path: &Path) -> Result<()> {
    let current =
        fs::read(path).map_err(|error| storage_error("verify_markdown_reference", path, error))?;
    if current != file.original.as_bytes() {
        return Err(stale(&format!(
            "Reference content changed: {}",
            path.display()
        )));
    }
    Ok(())
}

fn stale(message: &str) -> TkError {
    TkError::new("stale_reference_scan", ErrorCategory::Conflict, message)
}

fn walk(roots: &[PathBuf], excluded: &HashSet<PathBuf>) -> Result<Vec<PathBuf>> {
    let mut paths = BTreeSet::new();
    let mut visited = HashSet::new();
    let mut pending: Vec<_> = roots
        .iter()
        .rev()
        .map(|path| (path.clone(), 0usize))
        .collect();
    while let Some((path, depth)) = pending.pop() {
        if excluded.iter().any(|root| path.starts_with(root))
            || path.file_name().is_some_and(|name| name == ".git")
        {
            continue;
        }
        let metadata = fs::symlink_metadata(&path)
            .map_err(|error| storage_error("inspect_markdown_reference", &path, error))?;
        if metadata.file_type().is_symlink() {
            continue;
        }
        if metadata.is_file() {
            if path.extension().is_some_and(|extension| extension == "md") {
                paths.insert(path);
            } else if roots.contains(&path) {
                return Err(TkError::request(
                    "invalid_request",
                    "Reference scan files must be Markdown",
                ));
            }
            continue;
        }
        if !metadata.is_dir() {
            if roots.contains(&path) {
                return Err(TkError::request(
                    "invalid_request",
                    "Reference scan paths must be files or directories",
                ));
            }
            continue;
        }
        if !visited.insert(path.clone()) {
            continue;
        }
        if depth >= 256 || visited.len() > 100_000 {
            return Err(TkError::new(
                "reference_scan_limit_exceeded",
                ErrorCategory::Storage,
                "Markdown reference scan exceeded its directory or depth limit",
            )
            .with_details(serde_json::json!({"path": path})));
        }
        for entry in fs::read_dir(&path)
            .map_err(|error| storage_error("scan_markdown_references", &path, error))?
        {
            let entry =
                entry.map_err(|error| storage_error("scan_markdown_references", &path, error))?;
            pending.push((entry.path(), depth + 1));
        }
    }
    Ok(paths.into_iter().collect())
}

fn body_start(text: &str) -> usize {
    let mut offset = 0;
    for (index, line) in text.split_inclusive('\n').enumerate() {
        offset += line.len();
        if index > 0 && line.trim_end_matches(['\r', '\n']) == "---" {
            return offset;
        }
    }
    0
}

struct Needle {
    source: PathBuf,
    target: PathBuf,
    replacement: String,
}

struct Needles {
    items: HashMap<String, Needle>,
    pattern: Option<Regex>,
}

impl Needles {
    fn new(project: &Project, moves: &[DirectoryMove], focus: &[PathBuf]) -> Result<Self> {
        let mut items = HashMap::new();
        for source in focus {
            let target = mapped_path(source, moves);
            for (old, new) in [
                (source.as_path(), target.as_ref()),
                (
                    source
                        .strip_prefix(&project.root)
                        .expect("Task inside project"),
                    target
                        .strip_prefix(&project.root)
                        .expect("Task target inside project"),
                ),
            ] {
                let old = old.to_str().ok_or_else(|| {
                    TkError::request("invalid_reference_path", "Reference paths must be UTF-8")
                })?;
                let new = new.to_str().ok_or_else(|| {
                    TkError::request("invalid_reference_path", "Reference paths must be UTF-8")
                })?;
                items.insert(
                    old.to_owned(),
                    Needle {
                        source: source.clone(),
                        target: target.to_path_buf(),
                        replacement: new.to_owned(),
                    },
                );
            }
        }
        let mut keys: Vec<_> = items.keys().collect();
        keys.sort_by(|left, right| right.len().cmp(&left.len()).then(left.cmp(right)));
        let pattern = if keys.is_empty() {
            None
        } else {
            Some(
                Regex::new(
                    &keys
                        .into_iter()
                        .map(|key| regex::escape(key))
                        .collect::<Vec<_>>()
                        .join("|"),
                )
                .map_err(|error| {
                    TkError::new(
                        "reference_pattern_failed",
                        ErrorCategory::Internal,
                        error.to_string(),
                    )
                })?,
            )
        };
        Ok(Self { items, pattern })
    }

    fn translate_wiki(
        &self,
        original: &str,
        project_root: &Path,
    ) -> Result<Option<(String, PathBuf, PathBuf)>> {
        if is_uri(original) {
            return Ok(None);
        }
        let decoded = decode(original)?;
        Ok((|| {
            if !decoded.contains('/') || is_uri(&decoded) {
                return None;
            }
            let original_path = Path::new(decoded.as_ref());
            let normalized = if original_path.is_absolute() {
                normalize(original_path)
            } else {
                normalize(&project_root.join(original_path))
            };
            let item = normalized
                .ancestors()
                .find_map(|ancestor| self.items.get(ancestor.to_str()?))?;
            let suffix = normalized
                .strip_prefix(&item.source)
                .expect("source ancestor");
            let target = if suffix.as_os_str().is_empty() {
                item.target.clone()
            } else {
                item.target.join(suffix)
            };
            let replacement = if item.source == item.target {
                original.to_owned()
            } else {
                encode(
                    if original_path.is_absolute() {
                        target.to_str()?
                    } else {
                        target
                            .strip_prefix(project_root)
                            .expect("Task target inside project")
                            .to_str()?
                    },
                    original.contains('%'),
                    true,
                )
            };
            Some((replacement, normalized, target))
        })())
    }
}

fn path_boundary(text: &str, start: usize, end: usize) -> bool {
    let prefix = &text[..start];
    let prefix = prefix.strip_suffix("./").unwrap_or(prefix);
    prefix.chars().next_back().is_none_or(|character| {
        character.is_whitespace()
            || matches!(
                character,
                '(' | '[' | '{' | '<' | '\'' | '"' | '`' | '=' | ':'
            )
    }) && text[end..].chars().next().is_none_or(|character| {
        character.is_whitespace()
            || matches!(
                character,
                '/' | ')'
                    | ']'
                    | '}'
                    | '>'
                    | '\''
                    | '"'
                    | '`'
                    | '#'
                    | '?'
                    | '|'
                    | ','
                    | ';'
                    | ':'
                    | '!'
            )
    })
}

fn inside_uri(text: &str, offset: usize) -> bool {
    let token = text[..offset]
        .rsplit(|character: char| {
            character.is_whitespace() || matches!(character, '(' | '[' | '"' | '\'' | '`')
        })
        .next()
        .unwrap_or("");
    is_uri(token)
}

fn is_uri(text: &str) -> bool {
    text.find(':').is_some_and(|colon| {
        colon > 0
            && text[..colon].chars().enumerate().all(|(index, character)| {
                character.is_ascii_alphabetic()
                    || index > 0
                        && (character.is_ascii_digit() || matches!(character, '+' | '-' | '.'))
            })
    })
}

pub fn normalize(path: &Path) -> PathBuf {
    let mut result = PathBuf::new();
    for part in path.components() {
        match part {
            Component::CurDir => {}
            Component::ParentDir => {
                result.pop();
            }
            other => result.push(other.as_os_str()),
        }
    }
    result
}

fn relative(from: &Path, target: &Path) -> PathBuf {
    let mut left = from.components().peekable();
    let mut right = target.components().peekable();
    while left.peek().is_some() && left.peek() == right.peek() {
        left.next();
        right.next();
    }
    let mut result = PathBuf::new();
    for _ in left {
        result.push("..");
    }
    for component in right {
        result.push(component.as_os_str());
    }
    if result.as_os_str().is_empty() {
        result.push(".");
    }
    result
}

fn translate_link(
    original: &str,
    source: &Path,
    target_file: &Path,
    moves: &[DirectoryMove],
    focus: &[PathBuf],
    angle: bool,
) -> Result<Option<(String, PathBuf, PathBuf)>> {
    if is_uri(original) {
        return Ok(None);
    }
    let decoded = decode(original)?;
    Ok((|| {
        if original.is_empty() {
            return None;
        }
        if is_uri(&decoded) {
            return None;
        }
        let path = Path::new(decoded.as_ref());
        let old = if path.is_absolute() {
            normalize(path)
        } else {
            normalize(&source.parent()?.join(path))
        };
        let target = mapped_path(&old, moves);
        if source == target_file
            && old == target.as_ref()
            && !focus.iter().any(|root| old.starts_with(root))
        {
            return None;
        }
        let still_applies = if path.is_absolute() {
            old == target.as_ref()
        } else {
            normalize(&target_file.parent()?.join(path)) == target.as_ref()
        };
        let replacement = if still_applies {
            original.to_owned()
        } else {
            let new_path = if path.is_absolute() {
                target.to_path_buf()
            } else {
                relative(target_file.parent()?, &target)
            };
            let mut text = new_path.to_str()?.to_owned();
            if original.starts_with("./") && !text.starts_with('.') {
                text.insert_str(0, "./");
            }
            encode(&text, original.contains('%'), angle)
        };
        Some((replacement, old.clone(), target.into_owned()))
    })())
}

fn decode(text: &str) -> Result<Cow<'_, str>> {
    if !text.contains(['%', '\\']) {
        return Ok(Cow::Borrowed(text));
    }
    let mut bytes = Vec::with_capacity(text.len());
    let source = text.as_bytes();
    let mut offset = 0;
    while offset < source.len() {
        if source[offset] == b'\\'
            && offset + 1 < source.len()
            && source[offset + 1].is_ascii_punctuation()
        {
            offset += 1;
        } else if source[offset] == b'%'
            && offset + 2 < source.len()
            && let (Some(left), Some(right)) = (
                (source[offset + 1] as char).to_digit(16),
                (source[offset + 2] as char).to_digit(16),
            )
        {
            bytes.push((left * 16 + right) as u8);
            offset += 3;
            continue;
        }
        bytes.push(source[offset]);
        offset += 1;
    }
    String::from_utf8(bytes).map(Cow::Owned).map_err(|error| {
        TkError::request(
            "invalid_reference_path",
            format!("Percent-decoded reference path is not UTF-8: {error}"),
        )
    })
}

fn encode(text: &str, encoded: bool, angle: bool) -> String {
    let mut result = String::with_capacity(text.len());
    for character in text.chars() {
        if encoded && !character.is_ascii()
            || character == '%'
            || character.is_whitespace() && !angle
            || matches!(character, '<' | '>' | '\\' | '#' | '?' | '|' | '[' | ']')
            || !angle && matches!(character, '(' | ')')
        {
            for byte in character.encode_utf8(&mut [0; 4]).bytes() {
                use std::fmt::Write;
                let _ = write!(result, "%{byte:02X}");
            }
        } else {
            result.push(character);
        }
    }
    result
}

struct Destination {
    range: Range<usize>,
    protected: Range<usize>,
    kind: &'static str,
    angle: bool,
}

fn escaped(bytes: &[u8], offset: usize) -> bool {
    let mut cursor = offset;
    while cursor > 0 && bytes[cursor - 1] == b'\\' {
        cursor -= 1;
    }
    (offset - cursor) % 2 != 0
}

fn destinations(text: &str, start: usize) -> Vec<Destination> {
    let bytes = text.as_bytes();
    let mut result = Vec::new();
    let mut offset = start;
    let mut fence: Option<(u8, usize)> = None;
    while offset < bytes.len() {
        let line_start = offset == start || bytes[offset - 1] == b'\n';
        if line_start {
            let end = text[offset..]
                .find('\n')
                .map_or(bytes.len(), |length| offset + length + 1);
            let line = &bytes[offset..end];
            let indent = line.iter().take_while(|byte| **byte == b' ').count();
            if indent <= 3 && indent < line.len() && matches!(line[indent], b'`' | b'~') {
                let marker = line[indent];
                let count = line[indent..]
                    .iter()
                    .take_while(|byte| **byte == marker)
                    .count();
                if count >= 3 {
                    if let Some((open, width)) = fence {
                        if open == marker && count >= width {
                            fence = None;
                        }
                    } else {
                        fence = Some((marker, count));
                    }
                    offset = end;
                    continue;
                }
            }
            if fence.is_some() {
                offset = end;
                continue;
            }
            let begin = offset + indent;
            if indent <= 3
                && bytes.get(begin) == Some(&b'[')
                && let Some(close) = text[begin + 1..end].find("]:")
            {
                let destination = begin + 1 + close + 2;
                if let Some(mut item) = parse_destination(bytes, destination, "markdown_link") {
                    item.protected = begin..end;
                    result.push(item);
                    offset = end;
                    continue;
                }
            }
        }
        if bytes[offset] == b'`' && !escaped(bytes, offset) {
            let width = bytes[offset..]
                .iter()
                .take_while(|byte| **byte == b'`')
                .count();
            let delimiter = &text[offset..offset + width];
            if let Some(end) = text[offset + width..].find(delimiter) {
                offset += width + end + width;
                continue;
            }
        }
        if !escaped(bytes, offset) && bytes[offset..].starts_with(b"[[") {
            if let Some(end) = text[offset + 2..].find("]]") {
                let finish = offset + 2 + end;
                let path_end = (offset + 2..finish)
                    .find(|index| {
                        matches!(bytes[*index], b'|' | b'#' | b'?') && !escaped(bytes, *index)
                    })
                    .unwrap_or(finish);
                result.push(Destination {
                    range: offset + 2..path_end,
                    protected: offset..finish + 2,
                    kind: "wikilink",
                    angle: true,
                });
                offset = finish + 2;
                continue;
            }
        }
        if bytes[offset] == b']'
            && !escaped(bytes, offset)
            && bytes.get(offset + 1) == Some(&b'(')
            && let Some(mut item) = parse_destination(bytes, offset + 2, "markdown_link")
        {
            item.protected = label_start(bytes, offset)..inline_end(bytes, offset + 2);
            offset = item.protected.end;
            result.push(item);
            continue;
        }
        offset += 1;
    }
    result.sort_by_key(|item| item.range.start);
    result.dedup_by(|left, right| left.range == right.range);
    result
}

fn parse_destination(bytes: &[u8], mut start: usize, kind: &'static str) -> Option<Destination> {
    while bytes.get(start).is_some_and(u8::is_ascii_whitespace) {
        start += 1;
    }
    let angle = bytes.get(start) == Some(&b'<');
    if angle {
        start += 1;
    }
    let mut end = start;
    let mut depth = 0;
    while let Some(&byte) = bytes.get(end) {
        if byte == b'\\' && end + 1 < bytes.len() {
            end += 2;
            continue;
        }
        if angle {
            if byte == b'>' {
                break;
            }
            if matches!(byte, b'\n' | b'\r') {
                return None;
            }
        } else {
            if byte == b')' {
                if depth == 0 {
                    break;
                }
                depth -= 1;
            } else if byte == b'(' {
                depth += 1;
            } else if byte.is_ascii_whitespace() {
                break;
            }
        }
        end += 1;
    }
    if angle && bytes.get(end) != Some(&b'>') || start == end {
        return None;
    }
    let path_end = (start..end)
        .find(|index| matches!(bytes[*index], b'#' | b'?') && !escaped(bytes, *index))
        .unwrap_or(end);
    Some(Destination {
        range: start..path_end,
        protected: start..end,
        kind,
        angle,
    })
}

fn label_start(bytes: &[u8], end: usize) -> usize {
    let mut depth = 1;
    for offset in (0..end).rev() {
        if escaped(bytes, offset) {
            continue;
        }
        if bytes[offset] == b']' {
            depth += 1;
        }
        if bytes[offset] == b'[' {
            depth -= 1;
            if depth == 0 {
                return offset;
            }
        }
    }
    end
}

fn inline_end(bytes: &[u8], start: usize) -> usize {
    let mut offset = start;
    let mut depth = 1;
    let mut quote = None;
    let mut angle = false;
    while let Some(&byte) = bytes.get(offset) {
        if byte == b'\\' && offset + 1 < bytes.len() {
            offset += 2;
            continue;
        }
        if let Some(marker) = quote {
            if byte == marker {
                quote = None;
            }
        } else if angle {
            if byte == b'>' {
                angle = false;
            }
        } else if byte == b'<' {
            angle = true;
        } else if matches!(byte, b'"' | b'\'')
            && offset > start
            && bytes[offset - 1].is_ascii_whitespace()
        {
            quote = Some(byte);
        } else if byte == b'(' {
            depth += 1;
        } else if byte == b')' {
            depth -= 1;
            if depth == 0 {
                return offset + 1;
            }
        }
        offset += 1;
    }
    bytes.len()
}
