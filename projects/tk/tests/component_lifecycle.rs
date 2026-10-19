use std::env;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

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

struct CliFixture {
    root: PathBuf,
    home: PathBuf,
    data_home: PathBuf,
    bin: PathBuf,
    codex_home: PathBuf,
}

impl CliFixture {
    fn new(harness: &str) -> Self {
        let root = env::temp_dir().join(format!("tk-cli-test-{}", Uuid::now_v7()));
        let home = root.join("home");
        let data_home = root.join("data");
        let bin = root.join("bin");
        let codex_home = root.join("codex");
        fs::create_dir_all(home.join(".local/bin")).unwrap();
        fs::create_dir_all(&bin).unwrap();
        fs::create_dir_all(&codex_home).unwrap();

        write_executable(&home.join(".local/bin/tk"), "#!/bin/sh\nexit 0\n");
        let script = match harness {
            "codex" => {
                r#"#!/bin/sh
case "$1 $2" in
  "mcp list") printf '[]\n' ;;
  *) exit 0 ;;
esac
"#
            }
            "claude" => {
                r#"#!/bin/sh
case "$1 $2 $3" in
  "plugin list --json") printf '[]\n' ;;
  "plugin marketplace list") printf '[]\n' ;;
  *) exit 0 ;;
esac
"#
            }
            "pi" => {
                r#"#!/bin/sh
case "$1" in
  "list") exit 0 ;;
  *) exit 0 ;;
esac
"#
            }
            "omp" => {
                r#"#!/bin/sh
case "$1 $2 $3" in
  "plugin list --json") printf '{"npm":[]}\n' ;;
  *) exit 0 ;;
esac
"#
            }
            _ => unreachable!("known harness"),
        };
        write_executable(&bin.join(harness), script);

        Self {
            root,
            home,
            data_home,
            bin,
            codex_home,
        }
    }

    fn cli_root(&self, harness: &str) -> PathBuf {
        match harness {
            "codex" => self.codex_home.join("skills"),
            "claude" => self.home.join(".claude/skills"),
            "pi" => self.home.join(".pi/agent/skills"),
            "omp" => self.home.join(".omp/agent/skills"),
            _ => unreachable!("known harness"),
        }
    }

    fn tools_target(&self, harness: &str) -> PathBuf {
        match harness {
            "codex" => self.codex_home.join("skills/tk"),
            _ => self.data_home.join("tk/components").join(harness),
        }
    }

    fn output(&self, args: &[&str], path: &Path) -> Output {
        Command::new(env!("CARGO_BIN_EXE_tk"))
            .args(["--output", "json"])
            .args(args)
            .env("HOME", &self.home)
            .env("XDG_DATA_HOME", &self.data_home)
            .env("CODEX_HOME", &self.codex_home)
            .env("PATH", path)
            .current_dir(&self.root)
            .output()
            .unwrap()
    }

    fn run(&self, args: &[&str]) -> Value {
        let output = self.output(args, &self.bin);
        assert!(
            output.status.success(),
            "tk failed\nstdout: {}\nstderr: {}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        serde_json::from_slice(&output.stdout).unwrap()
    }

    fn run_without_harness(&self, args: &[&str]) -> Value {
        let output = self.output(args, Path::new(""));
        assert!(
            output.status.success(),
            "tk failed\nstdout: {}\nstderr: {}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        serde_json::from_slice(&output.stdout).unwrap()
    }
}

impl Drop for CliFixture {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.root).unwrap();
    }
}

struct CustomRootFixture {
    root: PathBuf,
    home: PathBuf,
    state_home: PathBuf,
}

impl CustomRootFixture {
    fn new() -> Self {
        let root = env::temp_dir().join(format!("tk-custom-root-test-{}", Uuid::now_v7()));
        let home = root.join("home");
        let state_home = root.join("state");
        fs::create_dir_all(home.join(".local/bin")).unwrap();
        fs::create_dir_all(&state_home).unwrap();
        write_executable(&home.join(".local/bin/tk"), "#!/bin/sh\nexit 0\n");
        Self {
            root,
            home,
            state_home,
        }
    }

    fn output(&self, args: &[&str]) -> Output {
        Command::new(env!("CARGO_BIN_EXE_tk"))
            .args(["--output", "json"])
            .args(args)
            .env("HOME", &self.home)
            .env("XDG_STATE_HOME", &self.state_home)
            .env("PATH", "")
            .current_dir(&self.root)
            .output()
            .unwrap()
    }

    fn run(&self, args: &[&str]) -> Value {
        let output = self.output(args);
        assert!(
            output.status.success(),
            "tk failed\nstdout: {}\nstderr: {}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        serde_json::from_slice(&output.stdout).unwrap()
    }

    fn run_error(&self, args: &[&str]) -> Value {
        let output = self.output(args);
        assert_eq!(output.status.code(), Some(2));
        serde_json::from_slice(&output.stdout).unwrap()
    }
}

impl Drop for CustomRootFixture {
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

#[test]
fn custom_skill_root_lifecycle_is_bounded_and_convergent() {
    let fixture = CustomRootFixture::new();
    let skill_root = fixture.root.join(".agents/skills");
    let would_install = fixture.run(&[
        "install",
        "--skill-root",
        ".agents/skills",
        "--mode",
        "cli",
        "--dry-run",
    ]);
    let data = &would_install["data"];
    assert_eq!(data["action"], "would_install");
    assert_eq!(data["skill_root"], skill_root.to_string_lossy().as_ref());
    assert!(!skill_root.exists());

    let installed = fixture.run(&["install", "--skill-root", ".agents/skills", "--mode", "cli"]);
    let data = &installed["data"];
    assert_eq!(data["action"], "installed");
    assert_eq!(data["skill_root"], skill_root.to_string_lossy().as_ref());
    assert_eq!(data["mode"], "cli");
    assert_eq!(data["language"], "en");
    assert_eq!(data["skill"], "tk-cli");
    assert!(data.get("harness").is_none());
    assert!(skill_root.join("tk-cli/SKILL.md").is_file());

    let unchanged = fixture.run(&[
        "install",
        "--skill-root",
        ".agents/skills",
        "--mode",
        "cli",
        "--dry-run",
    ]);
    assert_eq!(unchanged["data"]["action"], "no_change");

    fs::create_dir(skill_root.join("tk")).unwrap();
    fs::write(skill_root.join("tk/marker"), "tools").unwrap();
    fs::create_dir(skill_root.join("other")).unwrap();
    fs::write(skill_root.join("other/marker"), "other").unwrap();
    fs::write(skill_root.join("tk-cli/extra"), "drift").unwrap();

    let updated = fixture.run(&["install", "--skill-root", ".agents/skills", "--mode", "cli"]);
    assert_eq!(updated["data"]["action"], "updated");
    assert!(!skill_root.join("tk-cli/extra").exists());
    assert!(skill_root.join("tk/marker").is_file());
    assert!(skill_root.join("other/marker").is_file());

    let switched = fixture.run(&[
        "install",
        "--skill-root",
        ".agents/skills",
        "--mode",
        "cli",
        "--language",
        "zh",
    ]);
    assert_eq!(switched["data"]["action"], "updated");
    assert!(!skill_root.join("tk-cli").exists());
    assert!(skill_root.join("tk-cli-zh/SKILL.md").is_file());

    let invalid = fixture.run_error(&[
        "install",
        "--skill-root",
        ".agents/skills",
        "--mode",
        "tools",
    ]);
    assert_eq!(invalid["error"]["code"], "invalid_install_mode");

    let would_uninstall =
        fixture.run(&["uninstall", "--skill-root", ".agents/skills", "--dry-run"]);
    let data = &would_uninstall["data"];
    assert_eq!(data["action"], "would_uninstall");
    assert_eq!(data["mode"], "cli");
    assert!(data.get("language").is_none());
    assert!(data.get("skill").is_none());

    let uninstalled = fixture.run(&["uninstall", "--skill-root", ".agents/skills"]);
    assert_eq!(uninstalled["data"]["action"], "uninstalled");
    assert!(!skill_root.join("tk-cli").exists());
    assert!(!skill_root.join("tk-cli-zh").exists());
    assert!(skill_root.join("tk/marker").is_file());
    assert!(skill_root.join("other/marker").is_file());

    let unchanged = fixture.run(&["uninstall", "--skill-root", ".agents/skills", "--dry-run"]);
    assert_eq!(unchanged["data"]["action"], "no_change");
    let absolute_root = fixture.root.join("absolute/skills");
    let absolute_root_arg = absolute_root.to_string_lossy();
    let would_install = fixture.run(&[
        "install",
        "--skill-root",
        absolute_root_arg.as_ref(),
        "--mode",
        "cli",
        "--dry-run",
    ]);
    assert_eq!(would_install["data"]["action"], "would_install");
    assert_eq!(
        would_install["data"]["skill_root"],
        absolute_root.to_string_lossy().as_ref()
    );
    assert!(!absolute_root.exists());
}

#[test]
fn cli_install_targets_each_harness_root_and_replaces_selections() {
    for harness in ["codex", "claude", "pi", "omp"] {
        let fixture = CliFixture::new(harness);
        let root = fixture.cli_root(harness);
        let tools = fixture.tools_target(harness);
        fs::create_dir_all(&tools).unwrap();
        fs::write(tools.join("marker"), "tools").unwrap();
        let leftover_component = fixture.data_home.join("tk/components").join(harness);
        if harness == "codex" {
            fs::create_dir_all(&leftover_component).unwrap();
            fs::write(leftover_component.join("marker"), "component").unwrap();
        }

        let installed = fixture.run(&["install", "--harness", harness, "--mode", "cli"]);
        let data = &installed["data"];
        assert_eq!(data["action"], "updated", "{harness}");
        assert_eq!(data["mode"], "cli");
        assert_eq!(data["language"], "en");
        assert_eq!(data["skill"], "tk-cli");
        assert!(root.join("tk-cli/SKILL.md").is_file(), "{harness}");
        assert!(!tools.exists(), "{harness} kept its tools target");
        if harness == "codex" {
            assert!(
                !leftover_component.exists(),
                "{harness} kept its component directory"
            );
        }
        assert_eq!(data["uncompleted"], serde_json::json!([]), "{harness}");

        let unchanged = fixture.run(&[
            "install",
            "--harness",
            harness,
            "--mode",
            "cli",
            "--dry-run",
        ]);
        assert_eq!(unchanged["data"]["action"], "no_change", "{harness}");

        let switched = fixture.run(&[
            "install",
            "--harness",
            harness,
            "--mode",
            "cli",
            "--language",
            "zh",
        ]);
        assert_eq!(switched["data"]["action"], "updated", "{harness}");
        assert!(!root.join("tk-cli").exists(), "{harness}");
        assert!(root.join("tk-cli-zh/SKILL.md").is_file(), "{harness}");

        let tools_installed = fixture.run(&["install", "--harness", harness]);
        assert_eq!(tools_installed["data"]["mode"], "tools", "{harness}");
        assert!(!root.join("tk-cli").exists(), "{harness}");
        assert!(!root.join("tk-cli-zh").exists(), "{harness}");
        assert!(tools.exists(), "{harness}");

        let uninstalled = fixture.run(&["uninstall", "--harness", harness]);
        assert_eq!(uninstalled["data"]["action"], "uninstalled", "{harness}");
        assert!(!root.join("tk-cli").exists(), "{harness}");
        assert!(!root.join("tk-cli-zh").exists(), "{harness}");
        assert!(!tools.exists(), "{harness}");
    }
}

#[test]
fn cli_install_without_a_harness_still_writes_the_skill() {
    let fixture = CliFixture::new("omp");
    let root = fixture.cli_root("omp");
    let installed = fixture.run_without_harness(&["install", "--harness", "omp", "--mode", "cli"]);
    let data = &installed["data"];
    assert_eq!(data["action"], "installed");
    assert!(root.join("tk-cli/SKILL.md").is_file());
    assert!(
        data["uncompleted"]
            .as_array()
            .unwrap()
            .iter()
            .any(|item| item == "Harness registration")
    );

    let uninstalled = fixture.run_without_harness(&["uninstall", "--harness", "omp"]);
    assert_eq!(uninstalled["data"]["action"], "uninstalled");
    assert!(!root.join("tk-cli").exists());
    assert!(
        uninstalled["data"]["uncompleted"]
            .as_array()
            .unwrap()
            .iter()
            .any(|item| item == "Harness registration")
    );
}

#[test]
fn successful_registration_cleanup_removes_the_tools_target() {
    let fixture = CliFixture::new("claude");
    write_executable(
        &fixture.bin.join("claude"),
        &format!(
            r#"#!/bin/sh
case "$1 $2 $3" in
  "plugin list --json")
    printf '[{{"id":"tk@tk-local","version":"{}","scope":"user","enabled":true}}]\n'
    ;;
  "plugin marketplace list")
    printf '[]\n'
    ;;
  *) exit 0 ;;
esac
"#,
            env!("CARGO_PKG_VERSION")
        ),
    );
    let tools = fixture.tools_target("claude");
    fs::create_dir_all(&tools).unwrap();
    fs::write(tools.join("marker"), "tools").unwrap();

    let installed = fixture.run(&["install", "--harness", "claude", "--mode", "cli"]);
    let data = &installed["data"];
    assert_eq!(data["action"], "updated");
    assert!(fixture.cli_root("claude").join("tk-cli/SKILL.md").is_file());
    assert!(!tools.exists());
    assert_eq!(data["uncompleted"], serde_json::json!([]));
    assert!(
        data["completed"]
            .as_array()
            .unwrap()
            .iter()
            .any(|item| item == "Claude plugin registration removed")
    );
}

#[test]
fn failed_registration_cleanup_keeps_the_tools_target() {
    let fixture = CliFixture::new("claude");
    write_executable(
        &fixture.bin.join("claude"),
        r#"#!/bin/sh
case "$1 $2 $3" in
  "plugin list --json")
    printf '[{"id":"tk@tk-local","version":"0.1.12","scope":"user","enabled":true}]\n'
    ;;
  "plugin marketplace list")
    printf '[]\n'
    ;;
  "plugin uninstall tk@tk-local")
    exit 1
    ;;
  *) exit 0 ;;
esac
"#,
    );
    let tools = fixture.tools_target("claude");
    fs::create_dir_all(&tools).unwrap();
    fs::write(tools.join("marker"), "tools").unwrap();

    let installed = fixture.run(&["install", "--harness", "claude", "--mode", "cli"]);
    let data = &installed["data"];
    assert_eq!(data["action"], "updated");
    assert!(fixture.cli_root("claude").join("tk-cli/SKILL.md").is_file());
    assert!(tools.exists());
    assert!(
        data["uncompleted"]
            .as_array()
            .unwrap()
            .iter()
            .any(|item| item == "Harness registration")
    );
}
