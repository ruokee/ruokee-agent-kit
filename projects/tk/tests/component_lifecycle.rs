use std::env;
use std::fs;
use std::os::unix::fs::{PermissionsExt, symlink};
use std::path::PathBuf;
use std::process::{Command, Output};

use serde_json::{Value, json};
use uuid::Uuid;

struct Fixture {
    root: PathBuf,
    home: PathBuf,
    codex_home: PathBuf,
}

impl Fixture {
    fn new() -> Self {
        let root = env::temp_dir().join(format!("tk-cli-test-{}", Uuid::now_v7()));
        let home = root.join("home");
        let codex_home = root.join("codex");
        fs::create_dir_all(home.join(".local/bin")).unwrap();
        symlink(env!("CARGO_BIN_EXE_tk"), home.join(".local/bin/tk")).unwrap();
        Self {
            root,
            home,
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

    fn output(&self, args: &[&str]) -> Output {
        Command::new(env!("CARGO_BIN_EXE_tk"))
            .args(["--output", "json"])
            .args(args)
            .env("HOME", &self.home)
            .env("XDG_STATE_HOME", self.root.join("state"))
            .env("CODEX_HOME", &self.codex_home)
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
}

impl Drop for Fixture {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.root).unwrap();
    }
}

#[test]
fn custom_skill_root_lifecycle_is_bounded_and_convergent() {
    let fixture = Fixture::new();
    let root = fixture.root.join(".agents/skills");
    let install = ["install", "--skill-root", ".agents/skills"];
    let would_install = fixture.run(&["install", "--skill-root", ".agents/skills", "--dry-run"]);
    assert_eq!(would_install["data"]["action"], "would_install");
    assert_eq!(would_install["data"]["skill_root"], json!(root));
    assert!(!root.exists());

    let installed = fixture.run(&install);
    assert_eq!(installed["data"]["action"], "installed");
    assert_eq!(installed["data"]["skill_root"], json!(root));
    assert_eq!(installed["data"]["language"], "en");
    assert_eq!(installed["data"]["skill"], "tk-cli");
    assert!(installed["data"].get("harness").is_none());
    let english = fs::read(root.join("tk-cli/SKILL.md")).unwrap();

    fs::create_dir(root.join("other")).unwrap();
    fs::write(root.join("other/marker"), "neighbor").unwrap();
    fs::write(root.join("tk-cli/extra"), "drift").unwrap();
    fs::write(root.join("tk-cli/SKILL.md"), "drift").unwrap();
    let updated = fixture.run(&install);
    assert_eq!(updated["data"]["action"], "updated");
    assert_eq!(fs::read(root.join("tk-cli/SKILL.md")).unwrap(), english);
    assert!(!root.join("tk-cli/extra").exists());
    assert_eq!(fixture.run(&install)["data"]["action"], "no_change");

    let would_switch = fixture.run(&[
        "install",
        "--skill-root",
        ".agents/skills",
        "--language",
        "zh",
        "--dry-run",
    ]);
    assert_eq!(would_switch["data"]["action"], "would_install");
    assert_eq!(fs::read(root.join("tk-cli/SKILL.md")).unwrap(), english);
    assert!(!root.join("tk-cli-zh").exists());
    let switched = fixture.run(&[
        "install",
        "--skill-root",
        ".agents/skills",
        "--language",
        "zh",
    ]);
    assert_eq!(switched["data"]["action"], "updated");
    assert!(!root.join("tk-cli").exists());
    assert!(root.join("tk-cli-zh/SKILL.md").is_file());

    let would_remove = fixture.run(&["uninstall", "--skill-root", ".agents/skills", "--dry-run"]);
    assert_eq!(would_remove["data"]["action"], "would_uninstall");
    assert!(would_remove["data"].get("language").is_none());
    assert!(would_remove["data"].get("skill").is_none());
    assert!(root.join("tk-cli-zh/SKILL.md").is_file());
    let removed = fixture.run(&["uninstall", "--skill-root", ".agents/skills"]);
    assert_eq!(removed["data"]["action"], "uninstalled");
    assert!(!root.join("tk-cli").exists());
    assert!(!root.join("tk-cli-zh").exists());
    assert_eq!(
        fs::read_to_string(root.join("other/marker")).unwrap(),
        "neighbor"
    );
    assert_eq!(
        fixture.run(&["uninstall", "--skill-root", ".agents/skills"])["data"]["action"],
        "no_change"
    );

    let absolute = fixture.root.join("absolute/skills");
    let result = fixture.run(&["install", "--skill-root", absolute.to_str().unwrap()]);
    assert_eq!(result["data"]["skill_root"], json!(absolute));
    assert!(absolute.join("tk-cli/SKILL.md").is_file());
}

#[test]
fn cli_install_targets_each_harness_root_without_host_commands() {
    for harness in ["codex", "claude", "pi", "omp"] {
        let fixture = Fixture::new();
        let root = fixture.cli_root(harness);
        fs::create_dir_all(root.join("neighbor")).unwrap();
        fs::write(root.join("neighbor/marker"), "untouched").unwrap();
        let installed = fixture.run(&["install", "--harness", harness]);
        assert_eq!(installed["data"]["action"], "installed", "{harness}");
        assert_eq!(installed["data"]["harness"], harness);
        assert!(installed["data"].get("skill_root").is_none());
        assert!(root.join("tk-cli/SKILL.md").is_file(), "{harness}");
        assert_eq!(installed["data"]["uncompleted"], json!([]));
        assert_eq!(
            fixture.run(&["install", "--harness", harness])["data"]["action"],
            "no_change"
        );

        let switched = fixture.run(&["install", "--harness", harness, "--language", "zh"]);
        assert_eq!(switched["data"]["action"], "updated");
        assert!(!root.join("tk-cli").exists());
        assert!(root.join("tk-cli-zh/SKILL.md").is_file());
        let removed = fixture.run(&["uninstall", "--harness", harness]);
        assert_eq!(removed["data"]["action"], "uninstalled");
        assert!(!root.join("tk-cli-zh").exists());
        assert_eq!(
            fs::read_to_string(root.join("neighbor/marker")).unwrap(),
            "untouched"
        );
    }
}

#[test]
fn failed_language_removal_reports_committed_installation() {
    let fixture = Fixture::new();
    let root = fixture.root.join("skills");
    let retained = root.join("tk-cli-zh");
    fs::create_dir_all(&retained).unwrap();
    fs::write(retained.join("protected"), "content").unwrap();
    fs::set_permissions(&retained, fs::Permissions::from_mode(0o500)).unwrap();
    let output = fixture.output(&["install", "--skill-root", "skills"]);
    fs::set_permissions(&retained, fs::Permissions::from_mode(0o700)).unwrap();
    assert_eq!(output.status.code(), Some(4));
    let result: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(result["error"]["code"], "partial_commit");
    let details = &result["error"]["details"];
    assert_eq!(details["completed"], json!([root.join("tk-cli")]));
    assert_eq!(details["uncompleted"], json!([retained]));
    assert!(root.join("tk-cli/SKILL.md").is_file());
    assert_eq!(
        fs::read_to_string(retained.join("protected")).unwrap(),
        "content"
    );
}

#[test]
fn lifecycle_preflight_rejects_existing_operation_markers() {
    let fixture = Fixture::new();
    fixture.run(&["install", "--skill-root", "skills"]);
    let skill = fixture.root.join("skills/tk-cli/SKILL.md");
    let original = fs::read(&skill).unwrap();
    let marker = fixture.root.join("state/tk/tmp/unfinished");
    fs::create_dir_all(&marker).unwrap();

    for args in [
        vec![
            "install",
            "--skill-root",
            "skills",
            "--language",
            "zh",
            "--dry-run",
        ],
        vec!["install", "--skill-root", "skills"],
        vec!["uninstall", "--skill-root", "skills", "--dry-run"],
        vec!["uninstall", "--skill-root", "skills"],
    ] {
        let output = fixture.output(&args);
        assert_eq!(output.status.code(), Some(3), "{args:?}");
        let result: Value = serde_json::from_slice(&output.stdout).unwrap();
        assert_eq!(result["error"]["code"], "operation_in_progress");
        assert_eq!(fs::read(&skill).unwrap(), original);
        assert!(!fixture.root.join("skills/tk-cli-zh").exists());
        assert!(marker.is_dir());
    }
}
