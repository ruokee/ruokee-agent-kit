use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::io::Cursor;
use std::path::{Component, Path, PathBuf};

use serde_json::{Value, json};
use sha2::{Digest, Sha256};

const COMPONENT_FORMAT_VERSION: u32 = 2;
const DRIVER_CONTRACT_VERSION: u32 = 1;
const RUNTIME_COMPAT: &str = ">=0.1,<0.2";
const HARNESSES: [&str; 4] = ["codex", "claude", "pi", "omp"];
const MODES: [&str; 2] = ["tools", "cli"];
const LANGUAGES: [&str; 2] = ["en", "zh"];

#[derive(Clone)]
struct SourceFile {
    bytes: Vec<u8>,
    mode: u32,
}

fn main() {
    if let Err(error) = assemble() {
        panic!("component assembly failed: {error}");
    }
}

fn assemble() -> Result<(), Box<dyn std::error::Error>> {
    println!("cargo:rerun-if-env-changed=TK_SOURCE_REVISION");
    for path in ["skills", "claude", "pi", "omp"] {
        println!("cargo:rerun-if-changed={path}");
    }

    let project = PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").expect("manifest directory"));
    let out = PathBuf::from(env::var_os("OUT_DIR").expect("build output directory"));
    let mut payloads: BTreeMap<String, BTreeMap<String, SourceFile>> = BTreeMap::new();

    for harness in HARNESSES {
        for mode in MODES {
            for language in LANGUAGES {
                let component = component_id(harness, mode, language);
                let files = assemble_payload(&project, harness, mode, language)?;
                validate_payload(&component, &files, &project)?;
                payloads.insert(component, files);
            }
        }
    }

    let archive = encode_archive(&payloads)?;
    let archive_sha256 = digest(&archive);
    fs::write(out.join("tk-components.tar.zst"), &archive)?;

    let mut components = BTreeMap::new();
    for harness in HARNESSES {
        for mode in MODES {
            for language in LANGUAGES {
                let component = component_id(harness, mode, language);
                let files = payloads.get(&component).expect("known component payload");
                let records: BTreeMap<_, _> = files
                    .iter()
                    .map(|(path, file)| {
                        (
                            path.clone(),
                            json!({
                                "sha256": digest(&file.bytes),
                                "mode": file.mode,
                            }),
                        )
                    })
                    .collect();
                components.insert(
                    component.clone(),
                    json!({
                        "harness": harness,
                        "mode": mode,
                        "language": language,
                        "skill": skill_name(mode, language),
                        "runtime_compat": RUNTIME_COMPAT,
                        "payload": format!("payloads/{component}"),
                        "files": records,
                    }),
                );
            }
        }
    }
    let runtime_version = env::var("CARGO_PKG_VERSION")?;
    let source_revision = env::var("TK_SOURCE_REVISION")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| format!("package-v{runtime_version}"));
    let manifest = json!({
        "component_format_version": COMPONENT_FORMAT_VERSION,
        "runtime_version": runtime_version,
        "source_revision": source_revision,
        "archive_sha256": archive_sha256,
        "driver_contract_version": DRIVER_CONTRACT_VERSION,
        "components": components,
    });
    let mut manifest_bytes = serde_json::to_vec_pretty(&manifest)?;
    manifest_bytes.push(b'\n');
    fs::write(out.join("tk-components.manifest.json"), manifest_bytes)?;
    Ok(())
}

fn component_id(harness: &str, mode: &str, language: &str) -> String {
    format!("{harness}/{mode}/{language}")
}

fn skill_name(mode: &str, language: &str) -> &'static str {
    match (mode, language) {
        ("tools", "en") => "tk",
        ("tools", "zh") => "tk-zh",
        ("cli", "en") => "tk-cli",
        ("cli", "zh") => "tk-cli-zh",
        _ => unreachable!("known component selection"),
    }
}

fn assemble_payload(
    project: &Path,
    harness: &str,
    mode: &str,
    language: &str,
) -> Result<BTreeMap<String, SourceFile>, Box<dyn std::error::Error>> {
    let mut files = BTreeMap::new();
    if harness != "codex" {
        collect_tree(&project.join(harness), Path::new(""), &mut files)?;
        if mode == "cli" {
            make_cli_only(harness, &mut files)?;
        }
    }

    let skill = skill_name(mode, language);
    let prefix = if harness == "codex" {
        PathBuf::new()
    } else {
        PathBuf::from("skills").join(skill)
    };
    let skill_source = project.join("skills").join(skill);
    collect_tree(&skill_source, &prefix, &mut files)?;
    Ok(files)
}

fn make_cli_only(
    harness: &str,
    files: &mut BTreeMap<String, SourceFile>,
) -> Result<(), Box<dyn std::error::Error>> {
    match harness {
        "claude" => {
            files.remove(".mcp.json");
            let file = files
                .get_mut(".claude-plugin/plugin.json")
                .ok_or("Claude component is missing plugin.json")?;
            let mut value: Value = serde_json::from_slice(&file.bytes)?;
            let object = value
                .as_object_mut()
                .ok_or("Claude plugin.json must contain an object")?;
            object.remove("mcpServers");
            object.insert(
                "description".into(),
                Value::String("Persistent project-local Tasks through the tk CLI".into()),
            );
            file.bytes = serde_json::to_vec_pretty(&value)?;
            file.bytes.push(b'\n');
        }
        "pi" | "omp" => {
            files.remove("extension.ts");
            files.remove("common.ts");
            let file = files
                .get_mut("package.json")
                .ok_or("Harness component is missing package.json")?;
            let mut value: Value = serde_json::from_slice(&file.bytes)?;
            let object = value
                .as_object_mut()
                .ok_or("Harness package.json must contain an object")?;
            object.remove("dependencies");
            object.insert(
                "description".into(),
                Value::String(format!("First-party tk CLI Skill for {harness}")),
            );
            let integration = object
                .get_mut(harness)
                .and_then(Value::as_object_mut)
                .ok_or("Harness package.json is missing its integration object")?;
            integration.remove("extensions");
            file.bytes = serde_json::to_vec_pretty(&value)?;
            file.bytes.push(b'\n');
        }
        _ => unreachable!("Codex has no packaged adapter files"),
    }
    Ok(())
}

fn collect_tree(
    source: &Path,
    prefix: &Path,
    output: &mut BTreeMap<String, SourceFile>,
) -> Result<(), Box<dyn std::error::Error>> {
    if !source.is_dir() {
        return Err(format!("component source is not a directory: {}", source.display()).into());
    }
    let mut entries = fs::read_dir(source)?.collect::<std::io::Result<Vec<_>>>()?;
    entries.sort_by_key(|entry| entry.file_name());
    for entry in entries {
        let path = entry.path();
        let metadata = fs::symlink_metadata(&path)?;
        if metadata.file_type().is_symlink() {
            return Err(format!("component source contains a symlink: {}", path.display()).into());
        }
        let relative = prefix.join(entry.file_name());
        if metadata.is_dir() {
            collect_tree(&path, &relative, output)?;
        } else if metadata.is_file() {
            let archive_path = relative
                .to_str()
                .ok_or_else(|| format!("component path is not UTF-8: {}", path.display()))?
                .replace('\\', "/");
            if output
                .insert(
                    archive_path.clone(),
                    SourceFile {
                        bytes: fs::read(&path)?,
                        mode: 0o644,
                    },
                )
                .is_some()
            {
                return Err(format!("duplicate component path: {archive_path}").into());
            }
        } else {
            return Err(format!("unsupported component source: {}", path.display()).into());
        }
    }
    Ok(())
}

fn validate_payload(
    harness: &str,
    files: &BTreeMap<String, SourceFile>,
    project: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
    let project_text = project.to_string_lossy();
    for (relative, file) in files {
        let extension = Path::new(relative)
            .extension()
            .and_then(|value| value.to_str());
        if !matches!(extension, Some("md" | "json" | "toml" | "ts")) {
            continue;
        }
        let text = std::str::from_utf8(&file.bytes)
            .map_err(|error| format!("component text is not UTF-8: {relative}: {error}"))?;
        if text.contains(project_text.as_ref())
            || text.contains("projects/tk/")
            || text.contains("variants/zh/")
        {
            return Err(format!(
                "{harness} component contains a source-tree reference: {relative}"
            )
            .into());
        }
        if extension == Some("md") {
            validate_markdown_links(harness, relative, text, files)?;
        }
    }
    Ok(())
}

fn validate_markdown_links(
    harness: &str,
    source: &str,
    text: &str,
    files: &BTreeMap<String, SourceFile>,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut remaining = text;
    while let Some(start) = remaining.find("](") {
        remaining = &remaining[start + 2..];
        let Some(end) = remaining.find(')') else {
            break;
        };
        let raw = remaining[..end].trim();
        remaining = &remaining[end + 1..];
        let target = raw.split_once('#').map_or(raw, |(path, _)| path);
        let target = target
            .split_once('?')
            .map_or(target, |(path, _)| path)
            .trim();
        if target.is_empty()
            || target.starts_with("http://")
            || target.starts_with("https://")
            || target.starts_with("mailto:")
        {
            continue;
        }
        let resolved = resolve_link(source, target).ok_or_else(|| {
            format!("{harness} component link escapes its root: {source} -> {raw}")
        })?;
        let directory_prefix = format!("{resolved}/");
        if !files.contains_key(&resolved)
            && !files
                .keys()
                .any(|candidate| candidate.starts_with(&directory_prefix))
        {
            return Err(format!("{harness} component link is missing: {source} -> {raw}").into());
        }
    }
    Ok(())
}

fn resolve_link(source: &str, target: &str) -> Option<String> {
    let target = Path::new(target);
    if target.is_absolute() {
        return None;
    }
    let mut parts = Path::new(source)
        .parent()
        .into_iter()
        .flat_map(Path::components)
        .filter_map(|component| match component {
            Component::Normal(value) => value.to_str().map(str::to_owned),
            _ => None,
        })
        .collect::<Vec<_>>();
    for component in target.components() {
        match component {
            Component::CurDir => {}
            Component::Normal(value) => parts.push(value.to_str()?.to_owned()),
            Component::ParentDir => {
                parts.pop()?;
            }
            Component::Prefix(_) | Component::RootDir => return None,
        }
    }
    Some(parts.join("/"))
}

fn encode_archive(
    payloads: &BTreeMap<String, BTreeMap<String, SourceFile>>,
) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    let encoder = zstd::Encoder::new(Vec::new(), 19)?;
    let mut archive = tar::Builder::new(encoder);
    for (harness, files) in payloads {
        for (relative, file) in files {
            let path = format!("payloads/{harness}/{relative}");
            let mut header = tar::Header::new_gnu();
            header.set_size(file.bytes.len() as u64);
            header.set_mode(file.mode);
            header.set_uid(0);
            header.set_gid(0);
            header.set_mtime(0);
            header.set_entry_type(tar::EntryType::Regular);
            header.set_cksum();
            archive.append_data(&mut header, path, Cursor::new(&file.bytes))?;
        }
    }
    let encoder = archive.into_inner()?;
    Ok(encoder.finish()?)
}

fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
