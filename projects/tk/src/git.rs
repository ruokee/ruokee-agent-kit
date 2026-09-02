use std::path::{Path, PathBuf};
use std::process::Command;

use crate::error::{ErrorCategory, Result, TkError};
use crate::project::GitPolicy;

pub fn git_root(cwd: &Path) -> Result<Option<PathBuf>> {
    git_root_with(cwd, Path::new("git"))
}

fn git_root_with(cwd: &Path, executable: &Path) -> Result<Option<PathBuf>> {
    let mut command = Command::new(executable);
    command
        .args(["rev-parse", "--show-toplevel"])
        .current_dir(cwd);
    let output = crate::process::output(&mut command, "git rev-parse")?;

    if output.status.success() {
        let value = String::from_utf8(output.stdout).map_err(|error| {
            TkError::new(
                "invalid_git_output",
                ErrorCategory::Context,
                format!("git returned non-UTF-8 worktree path: {error}"),
            )
        })?;
        return Ok(Some(PathBuf::from(value.trim())));
    }
    if output.status.code() == Some(128) {
        return Ok(None);
    }

    Err(TkError::new(
        "git_discovery_failed",
        ErrorCategory::Context,
        String::from_utf8_lossy(&output.stderr).trim().to_owned(),
    ))
}

pub fn check_policy(
    project_root: &Path,
    task_root: &Path,
    config_path: Option<&Path>,
    policy: GitPolicy,
) -> Result<()> {
    if policy == GitPolicy::None {
        return Ok(());
    }
    if git_root(project_root)?.is_none() {
        return Err(TkError::new(
            "git_worktree_required",
            ErrorCategory::Policy,
            format!("Git policy {policy} requires a Git worktree"),
        ));
    }

    let task_root_ignored = is_ignored(project_root, task_root)?;
    match policy {
        GitPolicy::Track if task_root_ignored => {
            return Err(TkError::new(
                "task_root_ignored",
                ErrorCategory::Policy,
                format!("Task root is ignored: {}", task_root.display()),
            ));
        }
        GitPolicy::Ignore if !task_root_ignored => {
            return Err(TkError::new(
                "task_root_not_ignored",
                ErrorCategory::Policy,
                format!("Task root is not ignored: {}", task_root.display()),
            ));
        }
        _ => {}
    }

    if policy == GitPolicy::Track
        && let Some(path) = config_path.filter(|path| path.exists())
        && is_ignored(project_root, path)?
    {
        return Err(TkError::new(
            "project_config_ignored",
            ErrorCategory::Policy,
            "Project configuration is ignored",
        ));
    }
    Ok(())
}

fn is_ignored(project_root: &Path, path: &Path) -> Result<bool> {
    let status = Command::new("git")
        .args(["check-ignore", "-q", "--"])
        .arg(path)
        .current_dir(project_root)
        .status()
        .map_err(|error| {
            TkError::new(
                "git_start_failed",
                ErrorCategory::Environment,
                format!("Could not run git check-ignore: {error}"),
            )
        })?;

    match status.code() {
        Some(0) => Ok(true),
        Some(1) => Ok(false),
        _ => Err(TkError::new(
            "git_policy_check_failed",
            ErrorCategory::Policy,
            format!("git check-ignore exited with {status}"),
        )),
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::os::unix::fs::PermissionsExt;

    use super::*;

    #[test]
    fn git_discovery_rejects_oversized_output() {
        let root = std::env::temp_dir().join(format!("tk-git-test-{}", uuid::Uuid::now_v7()));
        fs::create_dir(&root).unwrap();
        let fake_git = root.join("git");
        fs::write(
            &fake_git,
            "#!/bin/sh\nwhile :; do printf xxxxxxxxxxxxxxxx; done\n",
        )
        .unwrap();
        fs::set_permissions(&fake_git, fs::Permissions::from_mode(0o755)).unwrap();
        let error = git_root_with(&root, &fake_git).unwrap_err();
        assert_eq!(error.code, "process_output_too_large");
        fs::remove_dir_all(root).unwrap();
    }
}
