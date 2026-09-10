import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PACKAGE_NAME } from "../src/extension.ts";

interface ToolState {
  active: string[];
  enabled: string[];
  mounted: string[];
  registry: string[];
  lookup: Record<string, boolean>;
}

interface LiveActivation {
  before: ToolState;
  after: ToolState;
  repeated: ToolState;
}

interface LiveScenario {
  xdev: LiveActivation;
  secondActivation: LiveActivation;
  fallback: LiveActivation;
}

interface ChildResult {
  getterError: boolean;
  settings?: Record<string, unknown>;
  tools: Array<{ name: string; loadMode?: string }>;
  live?: LiveScenario;
}

const packageRoot = path.resolve(import.meta.dir, "..");
const childPath = path.join(import.meta.dir, "integration-child.ts");

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value)}\n`);
}

function makeChildEnv(home: string, agentDir: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  env.HOME = home;
  env.USERPROFILE = home;
  env.PI_CODING_AGENT_DIR = agentDir;
  env.PI_CONFIG_DIR = ".omp";
  for (const key of [
    "OMP_PROFILE",
    "PI_PROFILE",
    "XDG_CONFIG_HOME",
    "XDG_DATA_HOME",
    "XDG_STATE_HOME",
    "XDG_CACHE_HOME",
  ]) {
    delete env[key];
  }
  return env;
}

async function runChild(cwd: string, env: Record<string, string>, mode = "runner"): Promise<ChildResult> {
  const child = Bun.spawn([process.execPath, childPath, cwd, mode], {
    cwd: packageRoot,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdoutPromise = new Response(child.stdout).text();
  const stderrPromise = new Response(child.stderr).text();
  // A real child-process deadline is required here; fake timers cannot reap a hung subprocess.
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timeoutId = setTimeout(() => {
      child.kill();
      resolve("timeout");
    }, 45_000);
  });
  const status = await Promise.race([child.exited, timeout]);
  if (timeoutId !== undefined) clearTimeout(timeoutId);
  if (status === "timeout") {
    const exitCode = await child.exited;
    const stderr = await stderrPromise;
    throw new Error(
      `integration child timed out after termination (exit ${exitCode})${stderr.trim() ? `: ${stderr.trim()}` : ""}`,
    );
  }
  const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
  if (status !== 0) {
    throw new Error(`integration child exited with code ${status}${stderr.trim() ? `: ${stderr.trim()}` : ""}`);
  }
  const line = stdout
    .trim()
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean)
    .at(-1);
  if (!line) throw new Error("integration child produced no JSON output");
  return JSON.parse(line) as ChildResult;
}

function toolSummary(result: ChildResult): Array<{ name: string; loadMode?: string }> {
  return result.tools.map(({ name, loadMode }) => ({ name, loadMode }));
}

describe("public OMP plugin settings integration", () => {
  test("loads user and project settings through the real getter and runner", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "codex-web-settings-integration-"));
    const home = path.join(root, "home");
    const agentDir = path.join(root, "agent");
    const projectOne = path.join(root, "project-one");
    const projectTwo = path.join(root, "project-two");
    const runtimeLock = path.join(home, ".omp", "plugins", "omp-plugins.lock.json");
    const env = makeChildEnv(home, agentDir);
    const userSettings = {
      model: "provider/user-model",
      searchEnabled: true,
      searchLoadMode: "discoverable",
      fetchEnabled: false,
      fetchLoadMode: "essential",
    };

    try {
      mkdirSync(projectOne, { recursive: true });
      mkdirSync(projectTwo, { recursive: true });
      writeJson(runtimeLock, {
        plugins: {},
        settings: {
          [PACKAGE_NAME]: userSettings,
          "@other/plugin": { keep: "this entry" },
        },
      });
      writeJson(path.join(projectOne, ".omp", "plugin-overrides.json"), {
        settings: {
          [PACKAGE_NAME]: { searchEnabled: false, fetchEnabled: true },
        },
      });

      const projectOneResult = await runChild(projectOne, env);
      expect(projectOneResult.getterError).toBe(false);
      expect(projectOneResult.settings).toEqual({
        ...userSettings,
        searchEnabled: false,
        fetchEnabled: true,
      });
      expect(toolSummary(projectOneResult)).toEqual([{ name: "codex_web_fetch", loadMode: "essential" }]);

      const projectTwoResult = await runChild(projectTwo, env);
      expect(projectTwoResult.settings).toEqual(userSettings);
      expect(toolSummary(projectTwoResult)).toEqual([{ name: "codex_web_search", loadMode: "discoverable" }]);
      const liveSettings = {
        ...userSettings,
        searchLoadMode: "essential",
        fetchEnabled: true,
        fetchLoadMode: "discoverable",
      };
      writeJson(runtimeLock, { plugins: {}, settings: { [PACKAGE_NAME]: liveSettings } });
      const liveResult = await runChild(projectTwo, env, "live");
      expect(liveResult.getterError).toBe(false);
      expect(liveResult.settings).toEqual(liveSettings);
      expect(liveResult.live).toBeDefined();
      const live = liveResult.live;
      if (!live) throw new Error("live integration child returned no scenario");

      expect(live.xdev.before.registry).toEqual([]);
      expect(live.xdev.before.lookup).toEqual({ codex_web_search: false, codex_web_fetch: false });
      expect(live.xdev.after.registry).toEqual(["codex_web_fetch", "codex_web_search"]);
      expect(live.xdev.after.active).toEqual(["codex_web_search"]);
      expect(live.xdev.after.enabled).toEqual(["codex_web_fetch", "codex_web_search"]);
      expect(live.xdev.after.mounted).toEqual(["codex_web_fetch"]);
      expect(live.xdev.after.lookup).toEqual({ codex_web_search: true, codex_web_fetch: true });
      expect(live.xdev.repeated).toEqual(live.xdev.after);
      expect(live.secondActivation.before.registry).toEqual([]);
      expect(live.secondActivation.after).toEqual(live.xdev.after);
      expect(live.secondActivation.repeated).toEqual(live.secondActivation.after);

      expect(live.fallback.before.registry).toEqual([]);
      expect(live.fallback.after.active).toEqual(["codex_web_fetch", "codex_web_search"]);
      expect(live.fallback.after.enabled).toEqual(["codex_web_fetch", "codex_web_search"]);
      expect(live.fallback.after.mounted).toEqual([]);
      expect(live.fallback.after.lookup).toEqual({ codex_web_search: true, codex_web_fetch: true });
      expect(live.fallback.repeated).toEqual(live.fallback.after);

      writeJson(runtimeLock, {
        plugins: {},
        settings: { [PACKAGE_NAME]: { searchEnabled: false, fetchEnabled: false } },
      });
      const disabledLiveResult = await runChild(projectTwo, env, "live");
      expect(disabledLiveResult.live).toBeDefined();
      const disabledLive = disabledLiveResult.live;
      if (!disabledLive) throw new Error("disabled live integration child returned no scenario");
      for (const activation of [disabledLive.xdev, disabledLive.secondActivation, disabledLive.fallback]) {
        expect(activation.after.registry).toEqual([]);
        expect(activation.after.active).toEqual([]);
        expect(activation.after.enabled).toEqual([]);
        expect(activation.after.mounted).toEqual([]);
        expect(activation.after.lookup).toEqual({ codex_web_search: false, codex_web_fetch: false });
        expect(activation.repeated).toEqual(activation.after);
      }

      unlinkSync(runtimeLock);
      const missingUserResult = await runChild(projectTwo, env);
      expect(missingUserResult.getterError).toBe(false);
      expect(missingUserResult.settings).toEqual({});
      expect(toolSummary(missingUserResult)).toEqual([
        { name: "codex_web_search", loadMode: "essential" },
        { name: "codex_web_fetch", loadMode: "discoverable" },
      ]);

      writeJson(runtimeLock, { plugins: {}, settings: { [PACKAGE_NAME]: { searchEnabled: false } } });
      mkdirSync(path.join(projectTwo, ".omp"), { recursive: true });
      writeFileSync(path.join(projectTwo, ".omp", "plugin-overrides.json"), "{ malformed\n");
      const malformedProjectResult = await runChild(projectTwo, env);
      expect(malformedProjectResult.getterError).toBe(false);
      expect(malformedProjectResult.settings).toEqual({ searchEnabled: false });
      expect(toolSummary(malformedProjectResult)).toEqual([{ name: "codex_web_fetch", loadMode: "discoverable" }]);

      writeFileSync(runtimeLock, "{ malformed\n");
      const malformedUserResult = await runChild(projectTwo, env);
      expect(malformedUserResult.getterError).toBe(true);
      expect(malformedUserResult.tools).toEqual([]);

      writeJson(runtimeLock, { plugins: {}, settings: {} });
      const legacyYaml = path.join(agentDir, "omp-codex-web-access.yml");
      const legacyContent = "model: legacy/provider\nsearchEnabled: false\n";
      mkdirSync(agentDir, { recursive: true });
      writeFileSync(legacyYaml, legacyContent);
      const legacyBefore = readFileSync(legacyYaml, "utf8");
      const legacyResult = await runChild(projectTwo, env);
      expect(legacyResult.getterError).toBe(false);
      expect(legacyResult.settings).toEqual({});
      expect(toolSummary(legacyResult)).toEqual([
        { name: "codex_web_search", loadMode: "essential" },
        { name: "codex_web_fetch", loadMode: "discoverable" },
      ]);
      expect(readFileSync(legacyYaml, "utf8")).toBe(legacyBefore);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 180_000);
});
