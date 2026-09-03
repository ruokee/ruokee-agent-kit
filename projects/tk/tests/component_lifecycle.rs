use std::env;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde_json::Value;
use uuid::Uuid;

struct ClaudeFixture {
    root: PathBuf,
    home: PathBuf,
    data_home: PathBuf,
    bin: PathBuf,
    state: PathBuf,
}

impl ClaudeFixture {
    fn new() -> Self {
        let root = env::temp_dir().join(format!("tk-claude-test-{}", Uuid::now_v7()));
        let home = root.join("home");
        let data_home = root.join("data");
        let bin = root.join("bin");
        let state = root.join("state");
        fs::create_dir_all(home.join(".local/bin")).unwrap();
        fs::create_dir_all(&bin).unwrap();
        fs::create_dir_all(&state).unwrap();

        write_executable(&home.join(".local/bin/tk"), "#!/bin/sh\nexit 0\n");
        write_executable(
            &bin.join("claude"),
            r#"#!/bin/sh
set -eu
state=$FAKE_CLAUDE_STATE
printf '%s\n' "$*" >> "$state/calls"
case "$1 $2 $3" in
  "plugin list --json")
    if [ -f "$state/version" ]; then
      IFS= read -r version < "$state/version"
      printf '[{"id":"tk@tk-local","version":"%s","scope":"user","enabled":true}]\n' "$version"
    else
      printf '[]\n'
    fi
    ;;
  "plugin marketplace list")
    if [ -f "$state/marketplace" ]; then
      IFS= read -r path < "$state/marketplace"
      printf '[{"name":"tk-local","source":"directory","path":"%s"}]\n' "$path"
    else
      printf '[]\n'
    fi
    ;;
  "plugin marketplace add")
    printf '%s\n' "$4" > "$state/marketplace"
    ;;
  "plugin install tk@tk-local")
    if [ ! -f "$state/version" ]; then
      printf '%s\n' "$FAKE_CLAUDE_TARGET_VERSION" > "$state/version"
    fi
    ;;
  "plugin update tk@tk-local")
    printf '%s\n' "$FAKE_CLAUDE_TARGET_VERSION" > "$state/version"
    ;;
  "plugin uninstall tk@tk-local")
    rm -f "$state/version"
    ;;
  "plugin marketplace remove")
    rm -f "$state/marketplace"
    ;;
  *)
    printf 'unsupported fake claude command: %s\n' "$*" >&2
    exit 2
    ;;
esac
"#,
        );

        Self {
            root,
            home,
            data_home,
            bin,
            state,
        }
    }

    fn run(&self, args: &[&str]) -> Value {
        let mut paths = vec![self.bin.clone()];
        paths.extend(env::split_paths(&env::var_os("PATH").unwrap_or_default()));
        let output = Command::new(env!("CARGO_BIN_EXE_tk"))
            .args(["--output", "json"])
            .args(args)
            .env("HOME", &self.home)
            .env("XDG_DATA_HOME", &self.data_home)
            .env("PATH", env::join_paths(paths).unwrap())
            .env("FAKE_CLAUDE_STATE", &self.state)
            .env("FAKE_CLAUDE_TARGET_VERSION", env!("CARGO_PKG_VERSION"))
            .current_dir(&self.root)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "tk failed\nstdout: {}\nstderr: {}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        serde_json::from_slice(&output.stdout).unwrap()
    }
}

impl Drop for ClaudeFixture {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.root).unwrap();
    }
}

fn write_executable(path: &Path, contents: &str) {
    fs::write(path, contents).unwrap();
    fs::set_permissions(path, fs::Permissions::from_mode(0o755)).unwrap();
}

#[test]
fn claude_plugin_lifecycle_converges_after_an_existing_version_upgrade() {
    let fixture = ClaudeFixture::new();

    let installed = fixture.run(&["install", "--harness", "claude"]);
    assert_eq!(installed["data"]["action"], "installed");
    let unchanged = fixture.run(&["install", "--harness", "claude", "--dry-run"]);
    assert_eq!(unchanged["data"]["action"], "no_change");

    fs::write(fixture.state.join("version"), "0.1.1\n").unwrap();
    let updated = fixture.run(&["install", "--harness", "claude"]);
    assert_eq!(updated["data"]["action"], "updated");
    assert_eq!(
        fs::read_to_string(fixture.state.join("version"))
            .unwrap()
            .trim(),
        env!("CARGO_PKG_VERSION")
    );
    let calls = fs::read_to_string(fixture.state.join("calls")).unwrap();
    assert!(
        calls
            .lines()
            .any(|line| line == "plugin install tk@tk-local --scope user")
    );
    assert!(
        calls
            .lines()
            .any(|line| line == "plugin update tk@tk-local --scope user")
    );
    let unchanged = fixture.run(&["install", "--harness", "claude", "--dry-run"]);
    assert_eq!(unchanged["data"]["action"], "no_change");

    let uninstalled = fixture.run(&["uninstall", "--harness", "claude"]);
    assert_eq!(uninstalled["data"]["action"], "uninstalled");
    let unchanged = fixture.run(&["uninstall", "--harness", "claude", "--dry-run"]);
    assert_eq!(unchanged["data"]["action"], "no_change");
}
