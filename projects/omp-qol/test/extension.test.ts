/**
 * Activation and `/qol` tests (matrix C02).
 *
 * The public settings getter is replaced at the extension seam. These tests
 * cover one-snapshot activation, repeated and concurrent `session_start`
 * events, module isolation, the global error path, and the read-only command.
 * Timing is driven by a release gate, not by a sleep.
 */

import { describe, expect, test } from "bun:test";
import type { ExtensionContext, ToolInfo } from "@oh-my-pi/pi-coding-agent";
import { activate, COMMAND_NAME, PACKAGE_NAME, PACKAGE_VERSION } from "../src/extension.ts";
import { MODULE_IDS } from "../src/settings.ts";
import { createHarness, type Harness } from "./host.ts";

type SessionHandler = (event: unknown, ctx: ExtensionContext) => Promise<void>;

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
    for (const id of MODULE_IDS) {
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
    for (const id of MODULE_IDS) {
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
    for (const id of MODULE_IDS) {
      expect(runtime.state.modules[id]).toEqual({ status: "disabled", reason: "master-disabled" });
    }
    expect(harness.tools).toEqual([]);
  });

  test("installs task argument cleanup for a built-in task tool", async () => {
    const taskInfo = {
      name: "task",
      description: "task",
      parameters: {
        toJsonSchema: () => ({ type: "object", properties: { sourceSession: { type: "string" } } }),
      },
      sourceInfo: { path: "<builtin:task>", source: "builtin", scope: "temporary", origin: "top-level" },
    } as unknown as ToolInfo;
    const harness = createHarness([taskInfo]);
    const { read } = gatedReader({});
    const runtime = activate(harness.pi, read);
    await sessionStartOf(harness)({}, harness.context());

    expect(runtime.state.modules.taskArgs).toEqual({ status: "enabled", detail: "rewrites=0" });
    const line = runtime
      .describe()
      .split("\n")
      .find((entry) => entry.startsWith("taskArgs: "));
    expect(line).toBe("taskArgs: enabled (rewrites=0) — enabled=true");
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
    expect(text).not.toContain("replay: ");
    expect(text).toContain("taskArgs: ");
    expect(text).toContain("copy: ");
    expect(text).toContain("shortcut=alt+shift+a");
    expect(text).toContain("enabled=false timeoutMs=900000");
    expect(text).not.toContain("user:");
    expect(text).not.toContain("project:");
    expect(runtime.describe()).toBe(text);
  });

  test("reports the copy switch and shortcut", async () => {
    const harness = createHarness();
    const runtime = activate(harness.pi, gatedReader({ copyEnabled: false }).read);
    await sessionStartOf(harness)({}, harness.context());

    const line = runtime
      .describe()
      .split("\n")
      .find((entry) => entry.startsWith("copy: "));
    expect(line).toContain("copy: disabled");
    expect(line).toContain("enabled=false");
    expect(line).toContain("shortcut=alt+shift+a");
  });

  test("an inactive wait module still reports its configured deadline", async () => {
    const waitLine = async (settings: Record<string, unknown>) => {
      const harness = createHarness();
      const runtime = activate(harness.pi, gatedReader(settings).read);
      await sessionStartOf(harness)({}, harness.context());
      return runtime
        .describe()
        .split("\n")
        .find((entry) => entry.startsWith("wait: "));
    };

    const absent = await waitLine({ waitJobsSeconds: 42 });
    expect(absent).toStartWith("wait: unavailable (wait-tool-absent)");
    expect(absent).toContain("jobsSeconds=42");

    const off = await waitLine({ waitEnabled: false, waitJobsSeconds: 42 });
    expect(off).not.toStartWith("wait: enabled");
    expect(off).toContain("enabled=false");
    expect(off).toContain("jobsSeconds=42");
  });
});
