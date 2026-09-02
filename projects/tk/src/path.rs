use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Component, Path, PathBuf};

use uuid::Uuid;

use crate::error::{ErrorCategory, Result, TkError};

pub fn validate_relative_path(value: &str, allow_empty: bool) -> Result<PathBuf> {
    if value.is_empty() {
        return if allow_empty {
            Ok(PathBuf::new())
        } else {
            Err(TkError::configuration(
                "invalid_project_path",
                "Project-relative path cannot be empty",
            ))
        };
    }

    let path = PathBuf::from(value);
    if path == Path::new(".")
        || path
            .components()
            .any(|part| !matches!(part, Component::Normal(_)))
    {
        return Err(TkError::configuration(
            "invalid_project_path",
            format!("Path must be project-relative without '.' or '..': {value}"),
        ));
    }
    Ok(path)
}

pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<()> {
    atomic_write_with(path, |file| {
        file.write_all(bytes)
            .map_err(|error| storage_error("write_temporary", path, error))
    })
}

pub fn atomic_write_with(
    path: &Path,
    write: impl FnOnce(&mut std::fs::File) -> Result<()>,
) -> Result<()> {
    crate::cancel::begin_write()?;
    let parent = path.parent().ok_or_else(|| {
        TkError::new(
            "invalid_write_path",
            ErrorCategory::Storage,
            format!("Path has no parent: {}", path.display()),
        )
    })?;
    fs::create_dir_all(parent).map_err(|error| storage_error("create_parent", parent, error))?;

    let temporary_path = parent.join(format!(
        ".tk-{}-{}.tmp",
        Uuid::now_v7(),
        path.file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("file")
    ));
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary_path)
        .map_err(|error| storage_error("create_temporary", &temporary_path, error))?;

    let result = (|| {
        write(&mut file)?;
        file.flush()
            .map_err(|error| storage_error("flush_temporary", &temporary_path, error))?;
        file.sync_all()
            .map_err(|error| storage_error("sync_temporary", &temporary_path, error))?;
        drop(file);
        fs::rename(&temporary_path, path)
            .map_err(|error| storage_error("replace_file", path, error))?;
        Ok(())
    })();

    if result.is_err() {
        let _ = fs::remove_file(&temporary_path);
    }
    result
}

pub fn storage_error(action: &str, path: &Path, error: std::io::Error) -> TkError {
    TkError::new(
        format!("{action}_failed"),
        ErrorCategory::Storage,
        format!("{}: {error}", path.display()),
    )
    .with_details(serde_json::json!({"path": path, "io_kind": format!("{:?}", error.kind())}))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unsafe_relative_paths() {
        assert!(validate_relative_path("../tasks", false).is_err());
        assert!(validate_relative_path("/tasks", false).is_err());
        assert!(validate_relative_path(".", false).is_err());
        assert_eq!(
            validate_relative_path("tasks/open", false).unwrap(),
            Path::new("tasks/open")
        );
    }
}
