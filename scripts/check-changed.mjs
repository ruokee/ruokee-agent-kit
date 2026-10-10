import { spawnSync } from "node:child_process";
import { accessSync, constants, lstatSync, realpathSync, statSync } from "node:fs";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const OMP_COMPONENTS = [
  "omp-status-bar",
  "omp-system-prompt",
  "omp-codex-web-access",
  "omp-context-pin",
  "omp-qol",
  "omp-smart-cache",
];
const PRETTIER = "node_modules/.bin/prettier";
const SKILL_TOOLS = [
  "sh",
  "git",
  "diff",
  "find",
  "cksum",
  "sort",
  "sed",
  "grep",
  "awk",
  "cp",
  "chmod",
  "touch",
  "rm",
  "mv",
  "ln",
  "id",
  "wc",
  "tail",
  "mktemp",
];
export const CHECKS = [
  { id: "rust:fmt", args: ["cargo:fmt:check"], tools: ["cargo", "rustfmt"] },
  { id: "rust:test", args: ["cargo:test"], tools: ["cargo"], files: ["projects/tk/Cargo.toml"] },
  ...OMP_COMPONENTS.flatMap((component) => [
    {
      id: `${component}:typecheck`,
      args: ["--dir", `projects/${component}`, "run", "typecheck"],
      files: [`projects/${component}/node_modules/.bin/tsc`],
    },
    {
      id: `${component}:test`,
      args: ["--dir", `projects/${component}`, "run", "test"],
      tools: ["bun"],
      files: [`projects/${component}/node_modules/@oh-my-pi/pi-coding-agent/package.json`],
    },
  ]),
  {
    id: "tk:adapters",
    command: "bun",
    args: ["test", "projects/tk/adapter-tests"],
    tools: ["sh"],
    files: ["projects/tk/adapter-tests/common.test.ts", "projects/tk/adapter/common.ts"],
  },
  {
    id: "skills",
    args: ["check:skills"],
    tools: SKILL_TOOLS,
    files: ["scripts/skills.sh", "scripts/tests/skills.sh", "docs/installation.md", "docs/installation.zh.md"],
  },
].map((check) => ({ command: "pnpm", ...check }));

// The complete check list. `pnpm check` runs it through `--complete`, and selector fallback runs `pnpm check`.
export const COMPLETE = [
  { id: "markdown:all", command: "pnpm", args: ["docs:lint"], files: [PRETTIER] },
  ...CHECKS,
  {
    id: "selector",
    command: "pnpm",
    args: ["check:selector"],
    tools: ["node"],
    files: ["scripts/check-changed.mjs", "scripts/tests/check-changed.test.mjs"],
  },
];

export function parseArgs(args) {
  if (args.length === 0) return { base: "main" };
  if (args.length === 1 && args[0] === "--complete") return { complete: true };
  if (args.length === 2 && args[0] === "--base" && args[1]) return { base: args[1] };
  throw new Error("Usage: node scripts/check-changed.mjs [--base <ref> | --complete]");
}

function tokens(buffer) {
  if (buffer.length === 0) return [];
  if (buffer.at(-1) !== 0) throw new Error("Truncated Git NUL output");
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buffer).split("\0").slice(0, -1);
}

function pathToken(path) {
  if (!path || isAbsolute(path) || path.split("/").some((part) => part === ".." || part === "." || !part)) {
    throw new Error("Invalid Git path");
  }
  return path;
}

export function parsePaths(buffer) {
  return tokens(buffer).map(pathToken);
}

export function parseNameStatus(buffer) {
  const fields = tokens(buffer);
  const paths = [];
  for (let index = 0; index < fields.length;) {
    const status = fields[index++];
    if (!/^(?:[ADMT]|[RC]\d{1,3})$/.test(status) || (/^[RC]/.test(status) && Number(status.slice(1)) > 100)) {
      throw new Error(`Unrecognized Git status: ${JSON.stringify(status)}`);
    }
    paths.push(pathToken(fields[index++]));
    if (/^[RC]/.test(status)) paths.push(pathToken(fields[index++]));
  }
  return paths;
}

export function collectChanges(cwd, base = "main", run = spawnSync) {
  const git = (args) => {
    const result = run("git", args, { cwd, encoding: null, timeout: 30_000, maxBuffer: 16 * 1024 * 1024 });
    if (result.error) throw new Error(`Git could not run: ${result.error.message}`);
    if (result.status !== 0)
      throw new Error(`Git ${args[0]} failed: ${result.stderr?.toString().trim() || result.signal || result.status}`);
    return result.stdout;
  };
  const text = (args) => new TextDecoder("utf-8", { fatal: true }).decode(git(args)).trim();
  const checkout = new TextDecoder("utf-8", { fatal: true })
    .decode(git(["rev-parse", "--show-toplevel"]))
    .replace(/\n$/, "");
  if (realpathSync(checkout) !== realpathSync(cwd)) throw new Error("Checks must use the checkout root");
  if (git(["ls-files", "--unmerged", "-z"]).length) throw new Error("Resolve index conflicts before checking changes");
  const result = { base, paths: [], sources: new Map() };
  try {
    if (text(["rev-parse", "--is-shallow-repository"]) !== "false") throw new Error("Shallow Git history");
    result.head = text(["rev-parse", "--verify", "HEAD^{commit}"]);
    result.baseCommit = text(["rev-parse", "--verify", "--end-of-options", `${base}^{commit}`]);
    const bases = text(["merge-base", "--all", result.baseCommit, result.head]).split("\n");
    if (bases.length !== 1 || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(bases[0]))
      throw new Error("No unique merge base");
    result.mergeBase = bases[0];
    const diff = ["diff", "--no-ext-diff", "--no-textconv", "--name-status", "-z", "--find-renames"];
    const inputs = [
      ["committed", [...diff, result.mergeBase, result.head, "--"], parseNameStatus],
      ["staged", [...diff, "--cached", result.head, "--"], parseNameStatus],
      ["unstaged", [...diff, "--"], parseNameStatus],
      ["untracked", ["ls-files", "--others", "--exclude-standard", "-z"], parsePaths],
    ];
    for (const [source, args, parse] of inputs) {
      for (const path of parse(git(args))) {
        if (!result.sources.has(path)) result.sources.set(path, new Set());
        result.sources.get(path).add(source);
      }
    }
    result.paths = [...result.sources.keys()].sort();
  } catch (error) {
    result.fallback = error.message;
    result.paths = [];
    result.sources.clear();
  }
  return result;
}

export function selectChecks(paths) {
  const ids = new Set();
  const scopes = new Set();
  const markdown = [];
  const reasons = [];
  const tk = () => {
    scopes.add("tk");
    ids.add("rust:fmt");
    ids.add("rust:test");
    ids.add("tk:adapters");
  };
  for (const path of [...new Set(paths)].sort()) {
    const md = path.endsWith(".md");
    if (md) markdown.push(path);
    if (
      [
        "package.json",
        "pnpm-lock.yaml",
        ".prettierrc.yaml",
        ".prettierignore",
        "commitlint.config.mjs",
        "scripts/check-changed.mjs",
        "scripts/tests/check-changed.test.mjs",
      ].includes(path) ||
      /(^|\/)\.git(?:ignore|attributes)$/.test(path)
    ) {
      reasons.push(`Shared check input: ${JSON.stringify(path)}`);
      continue;
    }
    const component = OMP_COMPONENTS.find((name) => path.startsWith(`projects/${name}/`));
    if (component) {
      const relative = path.slice(`projects/${component}/`.length);
      if (!md || /^(src|test)\//.test(relative)) {
        scopes.add(component);
        ids.add(`${component}:typecheck`);
        ids.add(`${component}:test`);
      } else scopes.add("documentation");
    } else if (path.startsWith("projects/tk/")) {
      const relative = path.slice("projects/tk/".length);
      if (!md || /^(skills|claude|pi|omp)\//.test(relative)) tk();
      else if (/^(README(?:\.zh)?\.md$|docs\/)/.test(relative)) scopes.add("documentation");
      else reasons.push(`Unknown tk scope: ${JSON.stringify(path)}`);
    } else if (
      ["docs/installation.md", "docs/installation.zh.md", "scripts/skills.sh", "scripts/tests/skills.sh"].includes(path)
    ) {
      scopes.add("skills");
      ids.add("skills");
    } else if (
      md &&
      (/^(docs|skills|variants\/zh\/skills|\.agents\/adr|\.agents\/spec)\//.test(path) ||
        ["README.md", "README.zh.md", "AGENTS.md"].includes(path))
    ) {
      scopes.add("documentation");
    } else reasons.push(`Unknown scope: ${JSON.stringify(path)}`);
  }
  return {
    full: reasons.length > 0,
    reasons,
    scopes: [...scopes],
    markdown,
    ids: CHECKS.filter((check) => ids.has(check.id)).map((check) => check.id),
  };
}

export function buildCommands(plan, cwd) {
  if (plan.full) {
    return [
      {
        id: "complete",
        command: "pnpm",
        args: ["check"],
        tools: [...new Set(COMPLETE.flatMap((check) => [check.command, ...(check.tools ?? [])]))],
        files: [...new Set(COMPLETE.flatMap((check) => check.files ?? []))],
      },
    ];
  }
  const markdown = plan.markdown.filter((path) => {
    const absolute = join(cwd, path);
    try {
      lstatSync(absolute);
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
    if (!statSync(absolute).isFile()) throw new Error(`Not a readable Markdown file: ${JSON.stringify(path)}`);
    accessSync(absolute, constants.R_OK);
    return true;
  });
  const commands = [];
  let batch = [];
  let size = 0;
  const flush = () => {
    if (batch.length)
      commands.push({
        id: "markdown",
        command: "pnpm",
        args: ["exec", "prettier", "--check", "--log-level", "warn", "--ignore-unknown", ...batch],
        files: [PRETTIER],
      });
    batch = [];
    size = 0;
  };
  for (const path of markdown) {
    const argument = `./${path}`;
    const bytes = Buffer.byteLength(argument) + 1;
    if (size + bytes > 24 * 1024) flush();
    batch.push(argument);
    size += bytes;
  }
  flush();
  return [...commands, ...CHECKS.filter((check) => plan.ids.includes(check.id))];
}

export function verifyRequirements(commands, cwd, env = process.env) {
  const tools = new Set();
  const files = new Set();
  for (const check of commands) {
    if ((check.id === "skills" || check.id === "complete") && process.getuid?.() === 0)
      throw new Error(`${check.id}: Skill permission checks require a non-root process`);
    for (const file of check.files ?? []) {
      if (files.has(file)) continue;
      files.add(file);
      try {
        const absolute = join(cwd, file);
        if (!statSync(absolute).isFile()) throw new Error("not a file");
        accessSync(absolute, constants.R_OK);
        if (file.includes("/.bin/")) accessSync(absolute, constants.X_OK);
      } catch {
        throw new Error(
          `${check.id}: Missing or unreadable local input ${JSON.stringify(file)}; prepare the selected environment first`,
        );
      }
    }
    for (const tool of [check.command, ...(check.tools ?? [])]) {
      if (tools.has(tool)) continue;
      tools.add(tool);
      const candidates = isAbsolute(tool)
        ? [tool]
        : (env.PATH ?? "").split(delimiter).map((directory) => resolve(cwd, directory, tool));
      if (
        !candidates.some((path) => {
          try {
            return statSync(path).isFile() && (accessSync(path, constants.X_OK), true);
          } catch {
            return false;
          }
        })
      )
        throw new Error(`${check.id}: Missing executable ${JSON.stringify(tool)}`);
    }
  }
}

export function runCommands(
  commands,
  cwd,
  run = spawnSync,
  log = console.log,
  verify = verifyRequirements,
  prefix = "[check:changed]",
) {
  try {
    verify(commands, cwd);
  } catch (error) {
    log(`${prefix} Preflight failed: ${error.message}`);
    return 1;
  }
  for (const check of commands) {
    const display = [check.command, ...check.args].map((arg) => JSON.stringify(arg)).join(" ");
    log(`${prefix} Running ${check.id}: ${display}`);
    const result = run(check.command, check.args, { cwd, stdio: "inherit", shell: false });
    if (result.error || result.signal || result.status !== 0) {
      log(`${prefix} Failed ${check.id}: ${result.error?.message || result.signal || `exit ${result.status}`}`);
      return Number.isInteger(result.status) && result.status > 0 ? result.status : 1;
    }
  }
  return 0;
}

export function checkComplete(cwd, log = console.log, run = spawnSync, verify = verifyRequirements) {
  const status = runCommands(COMPLETE, cwd, run, log, verify, "[check]");
  if (status === 0) log("[check] Passed complete check");
  return status;
}

export function checkChanged(
  cwd,
  base,
  log = console.log,
  runGit = spawnSync,
  run = spawnSync,
  verify = verifyRequirements,
) {
  try {
    const changes = collectChanges(cwd, base, runGit);
    log(
      `[check:changed] Baseline ${JSON.stringify(base)}: ${changes.baseCommit ?? "unresolved"}; HEAD ${changes.head ?? "unresolved"}; merge base ${changes.mergeBase ?? "unresolved"}`,
    );
    for (const path of changes.paths)
      log(`[check:changed] Path ${JSON.stringify(path)} (${[...changes.sources.get(path)].join(", ")})`);
    const plan = changes.fallback ? { full: true, reasons: [changes.fallback] } : selectChecks(changes.paths);
    if (plan.full) for (const reason of plan.reasons) log(`[check:changed] Complete fallback: ${reason}`);
    else log(`[check:changed] Scopes: ${plan.scopes.join(", ") || "none"}`);
    const commands = buildCommands(plan, cwd);
    log(`[check:changed] Selected: ${commands.map((check) => check.id).join(", ") || "none"}`);
    if (!commands.length)
      log(
        "[check:changed] No checks to run; no changes or only deleted explanatory Markdown. This is not complete merge validation.",
      );
    const status = runCommands(commands, cwd, run, log, verify);
    if (status === 0)
      log(
        `[check:changed] Passed ${plan.full ? "complete fallback" : "affected checks; final complete validation is still required"}`,
      );
    return status;
  } catch (error) {
    log(`[check:changed] Failed: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    process.exitCode = options.complete ? checkComplete(ROOT) : checkChanged(ROOT, options.base);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
