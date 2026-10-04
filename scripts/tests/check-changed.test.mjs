import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  ROOT,
  CHECKS,
  COMPLETE,
  OMP_COMPONENTS,
  buildCommands,
  checkChanged,
  checkComplete,
  collectChanges,
  parseArgs,
  parseNameStatus,
  parsePaths,
  runCommands,
  selectChecks,
  verifyRequirements,
} from "../check-changed.mjs";

const tests = [];
const test = (name, run) => tests.push([name, run]);
const nul = (...fields) => Buffer.from(`${fields.join("\0")}\0`);
const ids = (paths) => selectChecks(paths).ids;
const noPreflight = () => {};
const success = () => ({ status: 0 });
const quiet = () => {};
const tkIds = ["rust:fmt", "rust:test", "tk:adapters"];

function write(cwd, path, text = "# Example\n") {
  const file = join(cwd, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", timeout: 30_000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message || args.join(" "));
  return result.stdout.trim();
}

function commit(cwd, message = "fixture") {
  git(cwd, "add", "-A");
  return git(cwd, "commit", "-qm", message);
}

function repository(run, files = { "README.md": "# Fixture\n" }) {
  const cwd = mkdtempSync(join(tmpdir(), "check-changed-"));
  try {
    git(cwd, "init", "-q", "-b", "main");
    git(cwd, "config", "user.name", "Selector tests");
    git(cwd, "config", "user.email", "selector@example.invalid");
    for (const [path, text] of Object.entries(files)) write(cwd, path, text);
    commit(cwd);
    run(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

function fakeTools(cwd, files) {
  for (const file of files) {
    write(cwd, file, "#!/bin/sh\nexit 0\n");
    chmodSync(join(cwd, file), 0o755);
  }
}

test("strict CLI syntax and explicit baseline", () => {
  assert.deepEqual(parseArgs([]), { base: "main" });
  assert.deepEqual(parseArgs(["--base", "topic"]), { base: "topic" });
  assert.deepEqual(parseArgs(["--complete"]), { complete: true });
  for (const args of [
    ["--base"],
    ["--base", ""],
    ["--base", "main", "--base", "other"],
    ["--complete", "--base", "main"],
    ["--help"],
    ["topic"],
  ])
    assert.throws(() => parseArgs(args), /Usage/);
});

test("NUL status protocol preserves unusual names, copies, renames and deletions", () => {
  const names = ["docs/a b.md", "docs/中文.md", "docs/a\nb\tc.md", "docs/[x].md", "docs/-x.md", "docs/\ufeffx.md"];
  assert.deepEqual(parsePaths(nul(...names)), names);
  assert.deepEqual(
    parseNameStatus(nul("R100", names[0], names[1], "C75", names[2], names[3], "D", names[4], "T", names[5])),
    names,
  );
  assert.deepEqual(parsePaths(Buffer.alloc(0)), []);
  assert.deepEqual(parseNameStatus(Buffer.alloc(0)), []);
});

test("malformed or non-UTF-8 path streams cannot produce partial results", () => {
  for (const stream of [
    Buffer.from("M\0docs/a.md"),
    nul("R100", "docs/a.md"),
    nul("M"),
    nul("X", "docs/a.md"),
    nul("R101", "a", "b"),
    nul("M", "../a"),
    nul("M", "/a"),
    nul("M", ""),
    Buffer.from([0x4d, 0, 0xff, 0]),
  ])
    assert.throws(() => parseNameStatus(stream));
  assert.throws(() => parsePaths(nul("docs/../a.md")));
});

test("only registered explanatory Markdown is formatting-only", () => {
  const paths = [
    "README.md",
    "README.zh.md",
    "AGENTS.md",
    ".agents/adr/proposal/example.md",
    "docs/usage.md",
    "skills/example/SKILL.md",
    "variants/zh/skills/example/SKILL.md",
    "projects/tk/README.md",
    "projects/tk/docs/design.md",
    ...OMP_COMPONENTS.map((name) => `projects/${name}/README.md`),
  ];
  const plan = selectChecks(paths);
  assert.equal(plan.full, false);
  assert.deepEqual(plan.ids, []);
  assert.equal(plan.markdown.length, paths.length);
  for (const path of ["projects/new/README.md", "projects/tk/unknown.md", "unknown.md", "scripts/other.sh", "LICENSE"])
    assert.equal(selectChecks([path]).full, true, path);
});

test("every OMP component selects its own two checks; Markdown consumers take priority", () => {
  for (const name of OMP_COMPONENTS) {
    const expected = [`${name}:typecheck`, `${name}:test`];
    for (const path of ["src/entry.ts", "package.json", "src/prompt.md", "test/fixture.md"])
      assert.deepEqual(ids([`projects/${name}/${path}`]), expected);
    assert.deepEqual(ids([`projects/${name}/docs/usage.md`]), []);
  }
});

test("tk packaging trees select Rust and adapters, installation docs select Skill checks", () => {
  for (const path of ["src/main.rs", "skills/tk/SKILL.md", "claude/README.md", "pi/README.zh.md", "omp/README.md"])
    assert.deepEqual(ids([`projects/tk/${path}`]), tkIds, path);
  for (const path of [
    "docs/installation.md",
    "docs/installation.zh.md",
    "scripts/skills.sh",
    "scripts/tests/skills.sh",
  ])
    assert.deepEqual(ids([path]), ["skills"]);
});

test("shared inputs and unknown scopes discard partial selections", () => {
  for (const path of [
    "package.json",
    "pnpm-lock.yaml",
    ".prettierrc.yaml",
    ".prettierignore",
    "commitlint.config.mjs",
    ".gitignore",
    ".gitattributes",
    "projects/omp-qol/.gitignore",
    "scripts/check-changed.mjs",
    "scripts/tests/check-changed.test.mjs",
    "projects/new/src/code.ts",
  ]) {
    const plan = selectChecks(["projects/omp-qol/src/code.ts", path]);
    assert.equal(plan.full, true, path);
    assert.equal(buildCommands(plan, ROOT).length, 1);
    assert.deepEqual(buildCommands(plan, ROOT)[0].args, ["check"]);
  }
});

test("multi-scope union deduplicates in complete-check order", () => {
  const plan = selectChecks([
    "projects/omp-qol/src/a.ts",
    "projects/omp-status-bar/src/b.ts",
    "projects/tk/src/a.rs",
    "projects/tk/skills/tk/SKILL.md",
    "scripts/skills.sh",
    "projects/omp-qol/test/a.ts",
  ]);
  assert.deepEqual(plan.ids, [
    "rust:fmt",
    "rust:test",
    "omp-status-bar:typecheck",
    "omp-status-bar:test",
    "omp-qol:typecheck",
    "omp-qol:test",
    "tk:adapters",
    "skills",
  ]);
});

test("merge-base scope includes all working states but not main-only commits", () =>
  repository(
    (cwd) => {
      git(cwd, "switch", "-qc", "feature");
      write(cwd, "docs/committed.md");
      write(cwd, "docs/repeated.md", "# Committed\n");
      commit(cwd);
      git(cwd, "switch", "-q", "main");
      write(cwd, "main-only-unknown", "main\n");
      commit(cwd);
      git(cwd, "switch", "-q", "feature");
      write(cwd, "docs/staged.md");
      write(cwd, "docs/repeated.md", "# Staged\n");
      git(cwd, "add", "docs/staged.md", "docs/repeated.md");
      write(cwd, "README.md", "# Unstaged\n");
      write(cwd, "docs/repeated.md", "# Unstaged\n");
      write(cwd, "docs/untracked.md");
      write(cwd, "docs/ignored.md");
      const changes = collectChanges(cwd);
      assert.equal(changes.fallback, undefined);
      assert.deepEqual(changes.paths, [
        "README.md",
        "docs/committed.md",
        "docs/repeated.md",
        "docs/staged.md",
        "docs/untracked.md",
      ]);
      assert.deepEqual([...changes.sources.get("docs/repeated.md")], ["committed", "staged", "unstaged"]);
      assert.deepEqual([...changes.sources.get("docs/untracked.md")], ["untracked"]);
    },
    { "README.md": "# Base\n", ".gitignore": "docs/ignored.md\n" },
  ));

test("cross-component rename and deleted input preserve old consumers", () =>
  repository(
    (cwd) => {
      git(cwd, "switch", "-qc", "feature");
      mkdirSync(join(cwd, "projects/omp-qol/test"), { recursive: true });
      git(cwd, "mv", "projects/omp-system-prompt/src/prompt.md", "projects/omp-qol/test/moved.md");
      git(cwd, "rm", "projects/tk/skills/tk/SKILL.md");
      const changes = collectChanges(cwd);
      assert.deepEqual(changes.paths, [
        "projects/omp-qol/test/moved.md",
        "projects/omp-system-prompt/src/prompt.md",
        "projects/tk/skills/tk/SKILL.md",
      ]);
      const commands = buildCommands(selectChecks(changes.paths), cwd);
      assert.deepEqual(commands[0].args.slice(6), ["./projects/omp-qol/test/moved.md"]);
      assert.deepEqual(
        commands.slice(1).map((check) => check.id),
        [
          "rust:fmt",
          "rust:test",
          "omp-system-prompt:typecheck",
          "omp-system-prompt:test",
          "omp-qol:typecheck",
          "omp-qol:test",
          "tk:adapters",
        ],
      );
    },
    { "projects/omp-system-prompt/src/prompt.md": "# Rename\n", "projects/tk/skills/tk/SKILL.md": "# Delete\n" },
  ));

test("unusual real Git filenames remain independent literal argv entries", () =>
  repository((cwd) => {
    const names = ["docs/a b.md", "docs/中文.md", "docs/a\nb\tc.md", "docs/[x].md", "docs/-x.md"];
    for (const name of names) write(cwd, name);
    const changes = collectChanges(cwd);
    assert.deepEqual(changes.paths, [...names].sort());
    const command = buildCommands(selectChecks(changes.paths), cwd)[0];
    assert.deepEqual(
      command.args.slice(6),
      [...names].sort().map((name) => `./${name}`),
    );
  }));

test("deleted explanatory Markdown needs no formatter and never becomes complete success", () =>
  repository((cwd) => {
    git(cwd, "rm", "README.md");
    const output = [];
    assert.equal(
      checkChanged(
        cwd,
        "main",
        (line) => output.push(line),
        spawnSync,
        () => assert.fail("No command expected"),
      ),
      0,
    );
    assert.match(output.join("\n"), /only deleted explanatory Markdown/);
    assert.match(output.join("\n"), /not complete merge validation/);
  }));

test("dangling or unreadable existing Markdown fails rather than being treated as deleted", () =>
  repository((cwd) => {
    symlinkSync("missing", join(cwd, "README.md.link.md"));
    assert.throws(() => buildCommands({ full: false, ids: [], markdown: ["README.md.link.md"] }, cwd));
    if (process.getuid?.() !== 0) {
      chmodSync(join(cwd, "README.md"), 0);
      assert.throws(() => buildCommands(selectChecks(["README.md"]), cwd));
    }
  }));

test("Markdown batches stay bounded and contain each file exactly once", () =>
  repository((cwd) => {
    const paths = Array.from({ length: 400 }, (_, index) => `docs/${index}-${"x".repeat(70)}.md`);
    for (const path of paths) write(cwd, path);
    const commands = buildCommands(selectChecks(paths), cwd);
    assert.ok(commands.length > 1);
    assert.deepEqual(
      commands.flatMap((command) => command.args.slice(6)),
      [...paths].sort().map((path) => `./${path}`),
    );
    assert.ok(
      commands.every(
        (command) => command.args.slice(6).reduce((sum, arg) => sum + Buffer.byteLength(arg) + 1, 0) <= 24 * 1024,
      ),
    );
  }));

test("invalid refs and option-shaped refs select complete fallback without changing Git", () =>
  repository((cwd) => {
    const head = git(cwd, "rev-parse", "HEAD");
    for (const base of ["missing", "--git-dir=/missing", "HEAD^{tree}"]) {
      const changes = collectChanges(cwd, base);
      assert.ok(changes.fallback, base);
      assert.deepEqual(changes.paths, []);
    }
    assert.equal(git(cwd, "rev-parse", "HEAD"), head);
  }));

test("unrelated histories select complete fallback", () =>
  repository((cwd) => {
    git(cwd, "switch", "-q", "--orphan", "unrelated");
    write(cwd, "docs/unrelated.md");
    commit(cwd);
    assert.ok(collectChanges(cwd).fallback);
  }));

test("multiple merge bases select complete fallback", () =>
  repository((cwd) => {
    const initial = git(cwd, "rev-parse", "HEAD");
    const tree = git(cwd, "rev-parse", "HEAD^{tree}");
    const a = git(cwd, "commit-tree", tree, "-p", initial, "-m", "a");
    const b = git(cwd, "commit-tree", tree, "-p", initial, "-m", "b");
    const left = git(cwd, "commit-tree", tree, "-p", a, "-p", b, "-m", "left");
    const right = git(cwd, "commit-tree", tree, "-p", b, "-p", a, "-m", "right");
    git(cwd, "update-ref", "refs/heads/main", left);
    git(cwd, "update-ref", "refs/heads/feature", right);
    git(cwd, "switch", "-q", "feature");
    assert.match(collectChanges(cwd).fallback, /unique merge base/);
  }));

test("shallow repositories select complete fallback", () =>
  repository((cwd) => {
    const clone = join(cwd, "shallow");
    git(cwd, "clone", "-q", "--depth=1", pathToFileURL(cwd).href, clone);
    assert.match(collectChanges(clone).fallback, /Shallow/);
  }));

test("malformed, failed or truncated Git collection discards collected paths", () =>
  repository((cwd) => {
    write(cwd, "docs/new.md");
    for (const bad of [
      { status: 0, stdout: Buffer.from("bad") },
      { status: 1, stderr: Buffer.from("broken") },
      { error: new Error("output exceeded limit") },
    ]) {
      const run = (command, args, options) => (args.includes("--others") ? bad : spawnSync(command, args, options));
      const changes = collectChanges(cwd, "main", run);
      assert.ok(changes.fallback);
      assert.deepEqual(changes.paths, []);
      assert.equal(changes.sources.size, 0);
    }
  }));

test("non-UTF-8 real filenames select complete fallback", () =>
  repository((cwd) => {
    const path = Buffer.concat([Buffer.from(`${cwd}/`), Buffer.from([0xff]), Buffer.from(".md")]);
    writeFileSync(path, "invalid name\n");
    assert.ok(collectChanges(cwd).fallback);
  }));

test("missing Git and invalid repositories fail directly", () =>
  repository((cwd) => {
    const missing = () => ({ error: new Error("ENOENT") });
    assert.throws(() => collectChanges(cwd, "main", missing), /could not run/);
    mkdirSync(join(cwd, "subdir"));
    assert.throws(() => collectChanges(join(cwd, "subdir")), /checkout root/);
    assert.equal(checkChanged(cwd, "main", quiet, missing), 1);
    const invalid = mkdtempSync(join(cwd, "not-a-checkout-"));
    try {
      const runInvalidGit = (command, args, options) =>
        spawnSync(command, args, {
          ...options,
          env: { ...process.env, GIT_CEILING_DIRECTORIES: dirname(invalid) },
        });
      assert.throws(() => collectChanges(invalid, "main", runInvalidGit), /failed/);
      assert.equal(checkChanged(invalid, "main", quiet, runInvalidGit), 1);
    } finally {
      rmSync(invalid, { recursive: true, force: true });
    }
  }));

test("unresolved index conflicts fail before selecting checks", () =>
  repository((cwd) => {
    git(cwd, "switch", "-qc", "feature");
    write(cwd, "README.md", "# Feature\n");
    commit(cwd);
    git(cwd, "switch", "-q", "main");
    write(cwd, "README.md", "# Main\n");
    commit(cwd);
    assert.equal(spawnSync("git", ["merge", "feature"], { cwd, encoding: "utf8" }).status, 1);
    assert.throws(() => collectChanges(cwd), /index conflicts/);
  }));

test("command execution inherits output, uses checkout cwd and stops on first failure", () => {
  const commands = CHECKS.slice(0, 3);
  const calls = [];
  const lines = [];
  const run = (command, args, options) => {
    calls.push({ command, args, options });
    return { status: calls.length === 2 ? 7 : 0 };
  };
  assert.equal(
    runCommands(commands, ROOT, run, (line) => lines.push(line), noPreflight),
    7,
  );
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].options, { cwd: ROOT, stdio: "inherit", shell: false });
  assert.match(lines.at(-1), /Failed rust:test: exit 7/);
  for (const result of [
    { error: new Error("ENOENT"), status: null },
    { signal: "SIGTERM", status: null },
    { status: null },
  ])
    assert.equal(
      runCommands(commands, ROOT, () => result, quiet, noPreflight),
      1,
    );
});

test("preflight failure cannot run a command or produce success", () => {
  assert.equal(
    runCommands(
      CHECKS,
      ROOT,
      () => assert.fail("Must not run"),
      quiet,
      () => {
        throw new Error("missing");
      },
    ),
    1,
  );
});

test("selected local tools and inputs cannot be replaced by global tools", () =>
  repository((cwd) => {
    const typecheck = CHECKS.find((check) => check.id === "omp-qol:typecheck");
    assert.throws(() => verifyRequirements([typecheck], cwd), /local input/);
    fakeTools(cwd, typecheck.files);
    assert.throws(() => verifyRequirements([typecheck], cwd, { PATH: "" }), /Missing executable/);
    verifyRequirements([typecheck], cwd);
    assert.throws(
      () => verifyRequirements([{ id: "fixture", command: "definitely-missing-selector-executable", args: [] }], cwd),
      /Missing executable/,
    );
    const markdown = buildCommands(selectChecks(["README.md"]), cwd);
    assert.throws(() => verifyRequirements(markdown, cwd), /prettier/);
  }));

test("deleted required scripts cannot be silently skipped", () =>
  repository((cwd) => {
    const skill = CHECKS.find((check) => check.id === "skills");
    assert.throws(() => verifyRequirements([skill], cwd), /local input|non-root/);
  }));

test("complete fallback runs only pnpm check and reports its reason and failing step", () =>
  repository((cwd) => {
    write(cwd, "unknown-input", "unknown\n");
    const calls = [];
    const output = [];
    const status = checkChanged(
      cwd,
      "main",
      (line) => output.push(line),
      spawnSync,
      (command, args) => {
        calls.push([command, args]);
        return { status: 9 };
      },
      noPreflight,
    );
    assert.equal(status, 9);
    assert.deepEqual(calls, [["pnpm", ["check"]]]);
    assert.match(output.join("\n"), /Complete fallback: Unknown scope/);
    assert.match(output.join("\n"), /Failed complete: exit 9/);
    assert.doesNotMatch(output.join("\n"), /Passed/);
  }));

test("no changes explicitly reports an empty affected result", () =>
  repository((cwd) => {
    const output = [];
    assert.equal(
      checkChanged(
        cwd,
        "main",
        (line) => output.push(line),
        spawnSync,
        () => assert.fail("No checks expected"),
      ),
      0,
    );
    assert.match(output.join("\n"), /Selected: none/);
    assert.match(output.join("\n"), /final complete validation is still required/);
  }));

test("CLI uses its own linked worktree rather than the caller's cwd", () =>
  repository((cwd) => {
    write(cwd, "scripts/check-changed.mjs", readFileSync(join(ROOT, "scripts/check-changed.mjs"), "utf8"));
    fakeTools(cwd, ["node_modules/.bin/prettier"]);
    write(cwd, ".gitignore", "node_modules/\nlinked checkout/\n");
    write(cwd, "package.json", '{"private":true}\n');
    commit(cwd);
    const worktree = join(cwd, "linked checkout");
    git(cwd, "worktree", "add", "-q", "-b", "feature", worktree);
    fakeTools(worktree, ["node_modules/.bin/prettier"]);
    write(worktree, "docs/untracked.md");
    const result = spawnSync(process.execPath, [join(worktree, "scripts/check-changed.mjs")], {
      cwd,
      encoding: "utf8",
      timeout: 30_000,
    });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(result.stdout, /untracked/);
    assert.match(result.stdout, /Running markdown/);
    assert.doesNotMatch(result.stdout, /Complete fallback/);
    assert.equal(git(cwd, "status", "--porcelain"), "");
    git(cwd, "worktree", "remove", "--force", worktree);
  }));

test("root complete entry runs the shared list once, in order, without selection", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const commands = COMPLETE.map((check) => [check.command, ...check.args].join(" "));
  assert.deepEqual(commands.slice(0, 3), pkg.scripts["check:base"].split(" && "));
  assert.equal(commands.at(-1), "pnpm check:selector");
  assert.equal(new Set(COMPLETE.map((check) => check.id)).size, COMPLETE.length);
  for (const command of commands) assert.doesNotMatch(command, /^pnpm check(?::changed)?$/);

  const calls = [];
  const output = [];
  const run = (command, args, options) => {
    calls.push([[command, ...args].join(" "), options.cwd]);
    return { status: 0 };
  };
  assert.equal(
    checkComplete(ROOT, (line) => output.push(line), run, noPreflight),
    0,
  );
  assert.deepEqual(
    calls,
    commands.map((command) => [command, ROOT]),
  );
  assert.match(output.at(-1), /Passed complete check/);
});

let failed = 0;
for (const [name, run] of tests) {
  try {
    run();
    console.log(`ok   ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${name}\n`, error);
  }
}
console.log(`${tests.length - failed} passed; ${failed} failed`);
process.exitCode = failed ? 1 : 0;
