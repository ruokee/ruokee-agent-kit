/**
 * Activation and `/qol` tests (matrix C02).
 *
 * The public settings getter is replaced at the extension seam. These tests
 * cover one-snapshot activation, repeated and concurrent `session_start`
 * events, module isolation, the global error path, and the read-only command.
 * Timing is driven by a release gate, not by a sleep.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { activate, COMMAND_NAME, describeState, PACKAGE_NAME, PACKAGE_VERSION } from "../src/extension.ts";
import type { FieldProblem, QolSettings } from "../src/settings.ts";
import { parseQolSettings } from "../src/settings.ts";
import { createHarness, resetNativeReplay, type Harness } from "./host.ts";

type SessionHandler = (event: unknown, ctx: ExtensionContext) => Promise<void>;

/** Activation installs the process-wide replay wrapper; each case starts fresh. */
afterEach(resetNativeReplay);

function sessionStartOf(harness: Harness): SessionHandler {
  const handler = harness.handlers.get("session_start")?.[0];
  if (handler === undefined) throw new Error("the extension registered no session_start handler");
  return handler as SessionHandler;
}

/** A settings reader that records its calls and can be held open by a gate. */
function gatedReader(settings: Record<string, unknown> | Error, gate?: Promise<unknown>) {
  const calls: Array<{ packageName: string; cwd: string }> = [];
  const read = async (packageName: string, cwd: string): Promise<Record<string, unknown>> => {
    calls.push({ packageName, cwd });
    if (gate !== undefined) await gate;
    if (settings instanceof Error) throw settings;
    return settings;
  };
  return { read, calls };
}

/** The one activation snapshot an empty settings object produces. */
function defaultSettings(): QolSettings {
  const parsed = parseQolSettings({});
  if (parsed.kind !== "loaded") throw new Error("an empty settings object must load");
  return parsed.settings;
}

describe("activation", () => {
  test("reads the merged settings once for repeated and concurrent events", async () => {
    const harness = createHarness();
    const release = Promise.withResolvers<void>();
    const { read, calls } = gatedReader({}, release.promise);
    const runtime = activate(harness.pi, read);
    const start = sessionStartOf(harness);

    const first = start({}, harness.context());
    const second = start({}, harness.context());
    // The second event joins the pending activation instead of starting another read.
    expect(calls).toHaveLength(1);
    release.resolve();
    await Promise.all([first, second]);
    await start({}, harness.context());

    expect(calls).toHaveLength(1);
    expect(calls[0]?.packageName).toBe(PACKAGE_NAME);
    expect(calls[0]?.cwd).toBe("/tmp/omp-qol-project");
    expect(runtime.state.cwd).toBe("/tmp/omp-qol-project");
    expect(runtime.state.global).toEqual({ status: "ok" });
    expect(runtime.state.modules.wait.status).not.toBe("pending");
  });

  test("a settings read failure keeps every module on native behavior", async () => {
    const harness = createHarness();
    const { read } = gatedReader(new Error("settings store unavailable"));
    const runtime = activate(harness.pi, read);
    await sessionStartOf(harness)({}, harness.context());

    expect(runtime.state.global).toEqual({ status: "error", reason: "settings-reader-failed" });
    for (const id of ["wait", "recovery", "compaction"] as const) {
      expect(runtime.state.modules[id]).toEqual({ status: "disabled", reason: "settings-reader-failed" });
    }
    expect(harness.tools).toEqual([]);
    expect(harness.notifications).toHaveLength(1);
  });

  test("a global settings fault disables every module and notifies once", async () => {
    const harness = createHarness();
    const { read } = gatedReader({ notASetting: true });
    const runtime = activate(harness.pi, read);
    await sessionStartOf(harness)({}, harness.context());

    expect(runtime.state.global.status).toBe("error");
    for (const id of ["wait", "recovery", "compaction"] as const) {
      expect(runtime.state.modules[id].status).toBe("disabled");
    }
    expect(harness.tools).toEqual([]);
    expect(harness.warnings).toHaveLength(1);
    expect(harness.notifications).toHaveLength(1);
    expect(harness.notifications[0]?.message).toContain("notASetting=unknown-key");
  });

  test("the master switch stops every module", async () => {
    const harness = createHarness();
    const { read } = gatedReader({ enabled: false });
    const runtime = activate(harness.pi, read);
    await sessionStartOf(harness)({}, harness.context());

    expect(runtime.state.settings?.enabled).toBe(false);
    for (const id of ["wait", "recovery", "compaction", "replay"] as const) {
      expect(runtime.state.modules[id]).toEqual({ status: "disabled", reason: "master-disabled" });
    }
    expect(harness.tools).toEqual([]);
  });

  test("installs the replay wrapper and reports it with its rewrite count", async () => {
    const harness = createHarness();
    const { read } = gatedReader({});
    const runtime = activate(harness.pi, read);
    await sessionStartOf(harness)({}, harness.context());

    const state = { nativeHistoryReplayWarmed: false };
    new Map<unknown, unknown>().set("openai-responses:pro-20x", state);
    expect(state.nativeHistoryReplayWarmed).toBe(true);
    expect(runtime.state.modules.replay).toEqual({ status: "enabled", detail: "rewrites=0" });

    const line = runtime
      .describe()
      .split("\n")
      .find((entry) => entry.startsWith("replay: "));
    expect(line).toContain("enabled (rewrites=1)");
    expect(line).toContain("enabled=true");
  });

  test("stops the replay wrapper an earlier activation installed when the settings cannot be read", async () => {
    const first = createHarness();
    const { read: readFirst } = gatedReader({});
    activate(first.pi, readFirst);
    await sessionStartOf(first)({}, first.context());
    const installed = Map.prototype.set;

    const second = createHarness();
    const { read: readSecond } = gatedReader(new Error("settings store unavailable"));
    const runtime = activate(second.pi, readSecond);
    await sessionStartOf(second)({}, second.context());

    expect(runtime.state.modules.replay).toEqual({ status: "disabled", reason: "settings-reader-failed" });
    expect(Map.prototype.set).not.toBe(installed);
    expect(second.warnings.some((warning) => warning.includes("native replay stopped rewriting"))).toBe(true);

    const state = { nativeHistoryReplayWarmed: false };
    new Map<unknown, unknown>().set("openai-responses:pro-20x", state);
    expect(state.nativeHistoryReplayWarmed).toBe(false);
  });

  test("one invalid module leaves the others registerable", async () => {
    const harness = createHarness();
    const { read } = gatedReader({ recoveryMaxAttempts: 0 });
    const runtime = activate(harness.pi, read);
    await sessionStartOf(harness)({}, harness.context());

    expect(runtime.state.modules.recovery).toEqual({ status: "invalid", reason: "settings-invalid" });
    expect(runtime.state.modules.wait.status).not.toBe("invalid");
    expect(runtime.state.modules.wait.status).not.toBe("disabled");
    expect(runtime.state.modules.compaction.status).not.toBe("invalid");
    expect(harness.notifications.some((entry) => entry.message.includes("recoveryMaxAttempts=range"))).toBe(true);
  });

  test("each activation reports its own settings faults once", async () => {
    const harness = createHarness();
    const { read } = gatedReader({ waitJobsSeconds: "later" });
    activate(harness.pi, read);
    const start = sessionStartOf(harness);
    await start({}, harness.context());
    await start({}, harness.context());
    expect(harness.notifications.filter((entry) => entry.message.includes("waitJobsSeconds"))).toHaveLength(1);
  });
});

describe("the /qol command", () => {
  test("is registered, read-only, and reports version, cwd, refresh, and module states", async () => {
    const harness = createHarness();
    const { read } = gatedReader({});
    const runtime = activate(harness.pi, read);
    await sessionStartOf(harness)({}, harness.context());

    const command = harness.commands.get(COMMAND_NAME);
    expect(command).toBeDefined();
    const toolsBefore = harness.tools.length;
    await command?.handler("", harness.context());

    expect(harness.tools).toHaveLength(toolsBefore);
    const text = harness.notifications.at(-1)?.message ?? "";
    expect(text).toContain(`${PACKAGE_NAME} ${PACKAGE_VERSION}`);
    expect(text).toContain("/tmp/omp-qol-project");
    expect(text).toContain("restart OMP");
    expect(text).toContain("wait: ");
    expect(text).toContain("recovery: ");
    expect(text).toContain("compaction: ");
    expect(text).toContain("replay: ");
    expect(text).toContain("enabled=false timeoutMs=900000");
    expect(text).not.toContain("user:");
    expect(text).not.toContain("project:");
    expect(runtime.describe()).toBe(text);
  });

  test("reports the activation state before the first session_start", () => {
    const text = describeState({
      cwd: undefined,
      settings: undefined,
      problems: [],
      global: { status: "ok" },
      modules: {
        wait: { status: "pending" },
        recovery: { status: "pending" },
        compaction: { status: "pending" },
        replay: { status: "pending" },
      },
    });
    expect(text).toContain("wait: pending");
    expect(text).toContain("not activated in this process");
  });

  test("lists rejected keys by name and rule without values", () => {
    const problems: FieldProblem[] = [{ module: "compaction", key: "compactionTimeoutMs", rule: "integer" }];
    const text = describeState({
      cwd: "/x",
      settings: undefined,
      problems,
      global: { status: "ok" },
      modules: {
        wait: { status: "enabled" },
        recovery: { status: "disabled" },
        compaction: { status: "invalid" },
        replay: { status: "disabled" },
      },
    });
    expect(text).toContain("problems: compaction.compactionTimeoutMs=integer");
  });

  test("states that a floor above the native request deadline stops the compaction request from matching", async () => {
    const harness = createHarness();
    const { read } = gatedReader({ compactionTimeoutMs: 900_000, compactionTimeoutFloorMs: 400_000 });
    const runtime = activate(harness.pi, read);
    await sessionStartOf(harness)({}, harness.context());

    const line = runtime
      .describe()
      .split("\n")
      .find((entry) => entry.startsWith("compaction: "));
    expect(line).toContain("floorMs=400000");
    expect(line).toContain("no longer matches");

    const defaults = describeState({
      cwd: "/x",
      settings: defaultSettings(),
      problems: [],
      global: { status: "ok" },
      modules: {
        wait: { status: "enabled" },
        recovery: { status: "enabled" },
        compaction: { status: "enabled" },
        replay: { status: "enabled" },
      },
    });
    expect(defaults).not.toContain("no longer matches");
  });

  test("keeps the declared package version in step with the manifest", () => {
    const manifest = JSON.parse(readFileSync(path.join(import.meta.dir, "..", "package.json"), "utf8")) as {
      version?: string;
    };
    expect(manifest.version).toBe(PACKAGE_VERSION);
  });
});
