/**
 * hub wait module tests (matrix W01-W05, with the host adapter seam of I01).
 *
 * Covers the description rewrite, the empty-window classifier, route and
 * deadline resolution, the deadline loop (including its clock and scheduler
 * seams), registration compatibility, and the real registered-tool adapter that
 * forwards the undeclared `interruptible` property.
 */

import { describe, expect, test } from "bun:test";
import { RegisteredToolAdapter } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/wrapper";
import type { ExtensionRunner } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/runner";
import type { RegisteredTool } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/types";
import type { AgentToolResult, AgentToolUpdateCallback, ExtensionContext, ToolInfo } from "@oh-my-pi/pi-coding-agent";
import type { ModuleContext, ModuleState } from "../src/extension.ts";
import { parseQolSettings, type QolSettings, type WaitSettings } from "../src/settings.ts";
import {
  createWaitDefinition,
  HUB_TOOL_NAME,
  hubApproval,
  installWaitModule,
  isEmptyWaitWindow,
  NATIVE_WAIT_WINDOW_SENTENCE,
  resolveWaitDeadline,
  resolveWaitRoute,
  rewriteWaitWindowText,
  runWaitLoop,
  waitDeadlineResult,
  WAIT_TIMEOUT_MAX_SECONDS,
  type HubWaitParams,
} from "../src/wait.ts";
import { createHarness, moduleContext, nativeHubToolInfo, toolResult, type Harness } from "./host.ts";

/** Verbatim `wait` bullet from the OMP 18.2.4 hub description. */
const NATIVE_HUB_DESCRIPTION =
  "- **`wait`**: use ONLY when completely blocked with no other work. Returns on the FIRST of: an incoming message, " +
  "a watched job finishing, the wait window elapsing (5s, lengthening with each back-to-back wait up to 5m), " +
  "or a steering interrupt — NOT when all jobs finish; re-issue to keep waiting.";

function settings(overrides: Record<string, unknown> = {}): QolSettings {
  const parsed = parseQolSettings(overrides);
  if (parsed.kind !== "loaded") throw new Error("expected loaded settings");
  return parsed.settings;
}

function waitSettings(overrides: Partial<WaitSettings> = {}): WaitSettings {
  return { ...settings().wait, ...overrides };
}

function emptyWindow(details: Record<string, unknown>): AgentToolResult {
  return toolResult({ details, useless: true });
}

function runningJob(id: string) {
  return { id, status: "running" };
}

/** Concatenated text blocks of a result, for assertions on model-facing output. */
function textOf(result: AgentToolResult): string {
  return result.content.map((part) => (part.type === "text" ? part.text : "")).join("\n");
}

/** A recorded delegation target. */
function delegator(handler: (params: Record<string, unknown>, signal?: AbortSignal) => Promise<AgentToolResult>) {
  const calls: Array<{ params: Record<string, unknown>; signal?: AbortSignal }> = [];
  const invoke = async (
    params: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ): Promise<AgentToolResult> => {
    calls.push({ params, ...(options?.signal === undefined ? {} : { signal: options.signal }) });
    return handler(params, options?.signal);
  };
  return { invoke, calls };
}

function callContext(overrides: Partial<ExtensionContext>): ExtensionContext {
  return createHarness().context(overrides);
}

/** Install the module against a host replacement. */
function install(overrides: {
  settings?: QolSettings;
  description?: string;
  parameters?: unknown;
  source?: string;
  hub?: boolean;
}): { state: ModuleState; harness: Harness; reports: string[] } {
  const description = overrides.description ?? NATIVE_HUB_DESCRIPTION;
  const parameters = overrides.parameters ?? (() => undefined);
  const infos: ToolInfo[] =
    overrides.hub === false
      ? []
      : [
          {
            ...nativeHubToolInfo(description, parameters),
            sourceInfo: {
              path: "<builtin:hub>",
              source: overrides.source ?? "builtin",
              scope: "temporary",
              origin: "top-level",
            },
          },
        ];
  const harness = createHarness(infos);
  const reports: string[] = [];
  const context: ModuleContext = moduleContext({
    pi: harness.pi,
    ctx: harness.context(),
    settings: overrides.settings ?? settings(),
    report: (key, message) => reports.push(`${key}: ${message}`),
  });
  return { state: installWaitModule(context), harness, reports };
}

/** A scheduler the test fires by hand, so no wall clock is involved. */
function manualScheduler() {
  const scheduled: number[] = [];
  let pending: { callback: () => void; cancelled: boolean } | undefined;
  return {
    schedule: (ms: number, callback: () => void): (() => void) => {
      scheduled.push(ms);
      const entry = { callback, cancelled: false };
      pending = entry;
      return () => {
        entry.cancelled = true;
      };
    },
    fire: (): void => {
      const entry = pending;
      pending = undefined;
      if (entry !== undefined && !entry.cancelled) entry.callback();
    },
    /** Every delay the loop asked for, in order. */
    scheduled,
  };
}

describe("description rewrite", () => {
  test("replaces the native window claim with the effective values", () => {
    const rewritten = rewriteWaitWindowText(NATIVE_HUB_DESCRIPTION, waitSettings({ jobsSeconds: 600 }));
    expect(rewritten).not.toBeNull();
    const text = rewritten ?? "";
    expect(text).not.toContain("lengthening with each back-to-back wait");
    expect(text).toContain("default 600s for job and mixed waits");
    expect(text).toContain("1200s for a message-only wait");
    expect(text).toContain(`(0, ${WAIT_TIMEOUT_MAX_SECONDS}]`);
    expect(text).toContain("re-issue to keep waiting");
  });

  test("states a disabled continuation instead of promising one", () => {
    const text = rewriteWaitWindowText(NATIVE_HUB_DESCRIPTION, waitSettings({ continueEmptyWindows: false })) ?? "";
    expect(text).toContain("stopping on a certain empty window");
    expect(text).toContain("`waitContinueEmptyWindows` is false");
  });

  test("refuses a description it cannot recognize", () => {
    expect(rewriteWaitWindowText("Hub tool without the native sentence.", waitSettings())).toBeNull();
  });
});

describe("empty window classifier", () => {
  test("accepts a list of still-running jobs", () => {
    expect(isEmptyWaitWindow(emptyWindow({ op: "wait", jobs: [runningJob("a"), runningJob("b")] }))).toBe(true);
  });

  test("accepts a clean message timeout", () => {
    expect(isEmptyWaitWindow(emptyWindow({ op: "wait", from: "Main", waited: null }))).toBe(true);
  });

  test("rejects anything that carries information or an unknown shape", () => {
    const cases: Array<[string, AgentToolResult]> = [
      ["a settled job", emptyWindow({ op: "wait", jobs: [{ id: "a", status: "completed" }] })],
      ["an empty job list", emptyWindow({ op: "wait", jobs: [] })],
      ["no useless flag", toolResult({ details: { op: "wait", jobs: [runningJob("a")] } })],
      [
        "an error result",
        toolResult({ details: { op: "wait", jobs: [runningJob("a")] }, useless: true, isError: true }),
      ],
      ["another op", emptyWindow({ op: "jobs", jobs: [runningJob("a")] })],
      ["an unknown details key", emptyWindow({ op: "wait", jobs: [runningJob("a")], peers: [] })],
      ["a consumed message", emptyWindow({ op: "wait", from: "Main", waited: { ts: 1, body: "hi" } })],
      ["mixed jobs", emptyWindow({ op: "wait", jobs: [runningJob("a"), { id: "b", status: "failed" }] })],
    ];
    for (const [label, result] of cases) expect([label, isEmptyWaitWindow(result)]).toEqual([label, false]);
  });
});

describe("route and deadline resolution", () => {
  const noJobs = () => ({ running: [] });
  const withJobs = () => ({ running: [{ id: "a" }] });

  test("routes by the call shape, with the snapshot deciding a from-only wait", () => {
    expect(resolveWaitRoute({ op: "wait", name: "web" }, noJobs)).toBe("process");
    expect(resolveWaitRoute({ op: "wait", ids: ["a"] }, noJobs)).toBe("jobs");
    expect(resolveWaitRoute({ op: "wait", from: "Peer" }, noJobs)).toBe("messages");
    expect(resolveWaitRoute({ op: "wait", from: "Peer" }, withJobs)).toBe("jobs");
    expect(resolveWaitRoute({ op: "wait", from: "Peer" }, () => null)).toBe("jobs");
    expect(resolveWaitRoute({ op: "wait", from: "Peer" }, () => "unknown")).toBe("jobs");
    expect(resolveWaitRoute({ op: "wait" }, noJobs)).toBe("jobs");
    expect(resolveWaitRoute({ op: "wait", ids: [], from: "Peer" }, noJobs)).toBe("messages");
  });

  test("uses the routed default when no explicit timeout is given", () => {
    const wait = waitSettings({ jobsSeconds: 100, messagesSeconds: 200, processSeconds: 300 });
    expect(resolveWaitDeadline({}, "jobs", wait)).toEqual({ kind: "deadline", seconds: 100 });
    expect(resolveWaitDeadline({}, "messages", wait)).toEqual({ kind: "deadline", seconds: 200 });
    expect(resolveWaitDeadline({}, "process", wait)).toEqual({ kind: "deadline", seconds: 300 });
  });

  test("accepts an explicit timeout in range and rejects the rest without clamping", () => {
    const wait = waitSettings({ jobsSeconds: 1200 });
    expect(resolveWaitDeadline({ timeout: 5 }, "jobs", wait)).toEqual({ kind: "deadline", seconds: 5 });
    expect(resolveWaitDeadline({ timeout: 0.05 }, "jobs", wait)).toEqual({ kind: "deadline", seconds: 0.05 });
    expect(resolveWaitDeadline({ timeout: WAIT_TIMEOUT_MAX_SECONDS }, "jobs", wait)).toEqual({
      kind: "deadline",
      seconds: WAIT_TIMEOUT_MAX_SECONDS,
    });
    for (const timeout of [0, -1, 3600.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = resolveWaitDeadline({ timeout }, "jobs", wait);
      expect(result.kind).toBe("invalid");
      if (result.kind === "invalid") expect(result.text).toContain("(0, 3600]");
    }
  });
});

describe("deadline loop", () => {
  test("keeps waiting across certain empty windows until a real result arrives", async () => {
    const clock = { at: 0 };
    const scheduler = manualScheduler();
    const { invoke, calls } = delegator(async (params) => {
      void params;
      if (calls.length < 3) return emptyWindow({ op: "wait", jobs: [runningJob("a")] });
      return toolResult({ text: "job finished", details: { op: "wait", jobs: [{ id: "a", status: "completed" }] } });
    });
    const result = await runWaitLoop({
      invoke,
      forward: { op: "wait" },
      deadlineSeconds: 1200,
      continueEmptyWindows: true,
      signal: undefined,
      onUpdate: undefined,
      now: () => clock.at,
      schedule: scheduler.schedule,
    });
    expect(calls).toHaveLength(3);
    expect(textOf(result)).toBe("job finished");
  });

  test("delivers an empty window when continuation is configured off", async () => {
    const { invoke, calls } = delegator(async () => emptyWindow({ op: "wait", jobs: [runningJob("a")] }));
    const result = await runWaitLoop({
      invoke,
      forward: { op: "wait" },
      deadlineSeconds: 1200,
      continueEmptyWindows: false,
      signal: undefined,
      onUpdate: undefined,
      now: () => 0,
      schedule: manualScheduler().schedule,
    });
    expect(calls).toHaveLength(1);
    expect(result.details).toEqual({ op: "wait", jobs: [runningJob("a")] });
  });

  test("delivers a terminal result without a second delegation", async () => {
    const terminal = toolResult({ text: "No running background jobs to wait for.", details: { op: "wait", jobs: [] } });
    const { invoke, calls } = delegator(async () => terminal);
    const result = await runWaitLoop({
      invoke,
      forward: { op: "wait" },
      deadlineSeconds: 1200,
      continueEmptyWindows: true,
      signal: undefined,
      onUpdate: undefined,
      now: () => 0,
      schedule: manualScheduler().schedule,
    });
    expect(calls).toHaveLength(1);
    expect(result).toBe(terminal);
  });

  test("returns the last empty window with a deadline note when its own timer fires", async () => {
    const clock = { at: 0 };
    const scheduler = manualScheduler();
    const window = emptyWindow({ op: "wait", jobs: [runningJob("a")] });
    const { invoke, calls } = delegator(async (_params, signal) => {
      if (signal?.aborted === true) return window;
      // The deadline lands mid-window; the native hub settles it as an empty window.
      scheduler.fire();
      clock.at = 1_200_000;
      return window;
    });
    const result = await runWaitLoop({
      invoke,
      forward: { op: "wait" },
      deadlineSeconds: 1200,
      continueEmptyWindows: true,
      signal: undefined,
      onUpdate: undefined,
      now: () => clock.at,
      schedule: scheduler.schedule,
    });
    expect(scheduler.scheduled).toEqual([1_200_000]);
    expect(calls).toHaveLength(1);
    expect(result.details).toEqual({ op: "wait", jobs: [runningJob("a")] });
    expect(textOf(result)).toContain("Wait deadline reached after 1200s");
    expect(result.useless).toBe(true);
  });

  test("falls back to a minimal result when the deadline aborts a window with no empty frame yet", async () => {
    const scheduler = manualScheduler();
    let attempts = 0;
    const { invoke } = delegator(async (_params, signal) => {
      attempts += 1;
      if (signal?.aborted === true) throw new Error("host aborted the window");
      // The window never settles on its own: only the deadline ends it.
      return await new Promise<AgentToolResult>((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new Error("host aborted the window")), { once: true });
        scheduler.fire();
      });
    });
    const result = await runWaitLoop({
      invoke,
      forward: { op: "wait" },
      deadlineSeconds: 0.05,
      continueEmptyWindows: true,
      signal: undefined,
      onUpdate: undefined,
      now: () => 0,
      schedule: scheduler.schedule,
    });
    expect(attempts).toBe(1);
    expect(result.details).toEqual({ op: "wait" });
    expect(textOf(result)).toContain("Wait deadline reached after 0.05s");
    expect(result.isError).toBeUndefined();
  });

  test("keeps an unrelated native error", async () => {
    const failure = new Error("hub exploded");
    const { invoke } = delegator(async () => {
      throw failure;
    });
    await expect(
      runWaitLoop({
        invoke,
        forward: { op: "wait" },
        deadlineSeconds: 1200,
        continueEmptyWindows: true,
        signal: undefined,
        onUpdate: undefined,
        now: () => 0,
        schedule: manualScheduler().schedule,
      }),
    ).rejects.toBe(failure);
  });

  test("an outer cancellation outranks the deadline and keeps its reason", async () => {
    const controller = new AbortController();
    const scheduler = manualScheduler();
    const { invoke } = delegator(async (_params, signal) => {
      controller.abort(new Error("steering"));
      scheduler.fire();
      expect(signal?.aborted).toBe(true);
      return emptyWindow({ op: "wait", jobs: [runningJob("a")] });
    });
    await expect(
      runWaitLoop({
        invoke,
        forward: { op: "wait" },
        deadlineSeconds: 1200,
        continueEmptyWindows: true,
        signal: controller.signal,
        onUpdate: undefined,
        now: () => 0,
        schedule: scheduler.schedule,
      }),
    ).rejects.toThrow("steering");
  });

  test("delivers a message that already came back when cancellation lands", async () => {
    const controller = new AbortController();
    const message = toolResult({ text: "peer replied", details: { op: "wait", from: "Main", waited: { ts: 1 } } });
    const { invoke } = delegator(async () => {
      controller.abort(new Error("cancelled"));
      return message;
    });
    const result = await runWaitLoop({
      invoke,
      forward: { op: "wait" },
      deadlineSeconds: 1200,
      continueEmptyWindows: true,
      signal: controller.signal,
      onUpdate: undefined,
      now: () => 0,
      schedule: manualScheduler().schedule,
    });
    expect(result).toBe(message);
  });

  test("appends the note to the delivered window text", () => {
    const result = waitDeadlineResult(emptyWindow({ op: "wait", jobs: [] }), 30);
    expect(result.content).toHaveLength(2);
    expect(textOf(result)).toContain("after 30s");
  });
});

describe("delegation", () => {
  async function execute(
    params: HubWaitParams,
    wait: WaitSettings,
    handler: (params: Record<string, unknown>, signal?: AbortSignal) => Promise<AgentToolResult>,
    overrides: Partial<ExtensionContext> = {},
  ) {
    const { invoke, calls } = delegator(handler);
    const definition = createWaitDefinition(
      nativeHubToolInfo(NATIVE_HUB_DESCRIPTION, () => undefined),
      "d",
      wait,
    );
    const result = await definition.execute(
      "call-1",
      params,
      undefined,
      undefined,
      callContext({ invokeTool: invoke, ...overrides }),
    );
    return { result, calls };
  }

  test("passes a non-wait operation through once, unchanged", async () => {
    const seen: Record<string, unknown>[] = [];
    for (const params of [
      { op: "jobs" },
      { op: "send", to: "Peer", message: "hi", await: true },
      { op: "logs", name: "web", follow: true, cursor: 4, timeout: 30 },
      { op: "cancel", ids: ["a"] },
    ] satisfies HubWaitParams[]) {
      const { calls } = await execute(params, waitSettings(), async (forwarded) => {
        seen.push(forwarded);
        return toolResult({ text: "ok" });
      });
      expect(calls).toHaveLength(1);
      expect(calls[0]?.params).toEqual(params);
    }
    expect(seen).toHaveLength(4);
  });

  test("fills a missing process timeout and forwards an explicit one", async () => {
    const wait = waitSettings({ processSeconds: 300 });
    const filled = await execute({ op: "wait", name: "web", for: "ready" }, wait, async () =>
      toolResult({ text: "ready" }),
    );
    expect(filled.calls[0]?.params).toEqual({ op: "wait", name: "web", for: "ready", timeout: 300 });

    const explicit = await execute({ op: "wait", name: "web", timeout: 42 }, wait, async () =>
      toolResult({ text: "ready" }),
    );
    expect(explicit.calls[0]?.params).toEqual({ op: "wait", name: "web", timeout: 42 });
  });

  test("keeps the QoL deadline out of the job and message windows", async () => {
    const wait = waitSettings({ jobsSeconds: 60, messagesSeconds: 90 });
    const jobs = await execute({ op: "wait", ids: ["a"], timeout: 30 }, wait, async () =>
      toolResult({ text: "settled", details: { op: "wait", jobs: [{ id: "a", status: "completed" }] } }),
    );
    expect(jobs.calls[0]?.params).toEqual({ op: "wait", ids: ["a"] });

    const messages = await execute(
      { op: "wait", from: "Peer" },
      wait,
      async () => toolResult({ text: "peer replied" }),
      { getAsyncJobSnapshot: () => ({ running: [], recent: [], delivery: {} }) as never },
    );
    expect(messages.calls[0]?.params).toEqual({ op: "wait", from: "Peer" });
  });

  test("reports an explicit timeout outside the accepted range as an error", async () => {
    const { result, calls } = await execute({ op: "wait", timeout: 3601 }, waitSettings(), async () =>
      toolResult({ text: "never" }),
    );
    expect(calls).toEqual([]);
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("(0, 3600]");
  });

  test("stops on an empty window when a tiny explicit deadline leaves no room", async () => {
    const { result, calls } = await execute({ op: "wait", ids: ["a"], timeout: 0.05 }, waitSettings(), async () =>
      emptyWindow({ op: "wait", jobs: [runningJob("a")] }),
    );
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(textOf(result)).toContain("Wait deadline reached after 0.05s");
  });

  test("returns an explicit error when the host exposes no delegation", async () => {
    const definition = createWaitDefinition(
      nativeHubToolInfo(NATIVE_HUB_DESCRIPTION, () => undefined),
      "d",
      waitSettings(),
    );
    const result = await definition.execute("call-1", { op: "wait" }, undefined, undefined, callContext({}));
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("ctx.invokeTool");
  });
});

describe("registration", () => {
  test("registers the wrapper for an intact built-in hub", () => {
    const { state, harness } = install({});
    expect(state).toEqual({ status: "enabled" });
    expect(harness.tools).toHaveLength(1);
    const tool = harness.tools[0];
    expect(tool?.name).toBe(HUB_TOOL_NAME);
    expect(tool?.loadMode).toBe("essential");
    expect(tool?.strict).toBe(true);
    expect(tool?.interruptible?.({ op: "wait" })).toBe(true);
    expect(tool?.interruptible?.({ op: "logs", follow: true })).toBe(true);
    expect(tool?.interruptible?.({ op: "jobs" })).toBe(false);
    expect(tool?.description).toContain("Wait deadline (omp-qol)");
  });

  test("stays inactive when the module is switched off", () => {
    const { state, harness } = install({ settings: settings({ waitEnabled: false }) });
    expect(state).toEqual({ status: "disabled", reason: "wait-disabled" });
    expect(harness.tools).toEqual([]);
  });

  test("reports every compatibility failure and registers nothing", () => {
    const cases: Array<[string, Parameters<typeof install>[0], ModuleState, string]> = [
      ["a missing hub", { hub: false }, { status: "unavailable", reason: "hub-tool-absent" }, "hub-tool-absent"],
      [
        "a shadowed hub",
        { source: "extension" },
        { status: "incompatible", reason: "hub-tool-shadowed" },
        "hub-tool-shadowed",
      ],
      [
        "an unknown description",
        { description: "Hub tool without the native sentence." },
        { status: "unavailable", reason: "hub-description-unrecognized" },
        "hub-description-unrecognized",
      ],
      [
        "unusable parameters",
        { parameters: 42 },
        { status: "incompatible", reason: "hub-schema-unrecognized" },
        "hub-schema-unrecognized",
      ],
    ];
    for (const [label, options, expected, reportKey] of cases) {
      const { state, harness, reports } = install(options);
      expect([label, state]).toEqual([label, expected]);
      expect(harness.tools).toEqual([]);
      expect(reports.some((entry) => entry.startsWith(`wait:${reportKey}`))).toBe(true);
      expect(harness.warnings).toEqual([]);
    }
  });

  test("keeps the native approval tiers and escalates unknown operations", () => {
    expect(hubApproval({ op: "wait" })).toBe("read");
    expect(hubApproval({ op: "jobs" })).toBe("read");
    expect(hubApproval({ op: "send", to: "Peer" })).toBe("read");
    expect(hubApproval({ op: "send", name: "web", text: "hi" })).toBe("exec");
    expect(hubApproval({ op: "stop", name: "web" })).toBe("exec");
    expect(hubApproval({ op: "unknown-op" })).toBe("exec");
    expect(hubApproval(undefined)).toBe("exec");
  });
});

describe("real registered-tool adapter", () => {
  /** Drive the host's own adapter, with a fake runner and delegation context. */
  function adapterOf(
    invokeTool: (
      params: Record<string, unknown>,
      options?: { onUpdate?: AgentToolUpdateCallback },
    ) => Promise<AgentToolResult>,
  ) {
    const definition = createWaitDefinition(
      nativeHubToolInfo(NATIVE_HUB_DESCRIPTION, () => undefined),
      "d",
      waitSettings(),
    );
    const registered = {
      definition,
      extensionPath: "/tmp/omp-qol",
      sourceInfo: { path: "/tmp/omp-qol", source: "extension", scope: "temporary", origin: "top-level" },
    } as unknown as RegisteredTool;
    const runner = {
      createContext: () => callContext({ invokeTool: invokeTool as never }),
    } as unknown as ExtensionRunner;
    return new RegisteredToolAdapter(registered, runner);
  }

  function interrupts(adapter: RegisteredToolAdapter, params: Record<string, unknown>): boolean {
    const mode = forwarded(adapter).interruptible;
    if (typeof mode === "function") return mode(params);
    return mode === true;
  }

  /**
   * The properties the adapter forwards from the definition at runtime. The
   * class itself declares only name, description, parameters, label, and
   * strict, so this view names what `applyToolProxy` copies.
   */
  function forwarded(adapter: RegisteredToolAdapter): {
    loadMode?: string;
    strict?: boolean;
    approval?: unknown;
    interruptible?: boolean | ((params: Partial<HubWaitParams>) => boolean);
  } {
    return adapter as unknown as {
      loadMode?: string;
      strict?: boolean;
      approval?: ((params: unknown) => string) | string;
      interruptible?: boolean | ((params: Partial<HubWaitParams>) => boolean);
    };
  }

  test("forwards interruptible, loadMode, strict, and approval, and delegates the call", async () => {
    const nativeCalls: Record<string, unknown>[] = [];
    const adapter = adapterOf(async (params) => {
      nativeCalls.push(params);
      return toolResult({ text: "native ran", details: { op: "jobs" } });
    });

    const view = forwarded(adapter);
    expect(view.loadMode).toBe("essential");
    expect(view.strict).toBe(true);
    // The adapter binds forwarded functions, so identity differs while behavior is kept.
    const approval = view.approval;
    expect(typeof approval).toBe("function");
    if (typeof approval === "function") {
      expect(approval({ op: "jobs" })).toBe("read");
      expect(approval({ op: "stop", name: "web" })).toBe("exec");
      expect(approval(undefined)).toBe("exec");
    }
    expect(interrupts(adapter, { op: "wait" })).toBe(true);
    expect(interrupts(adapter, { op: "logs", follow: true })).toBe(true);
    expect(interrupts(adapter, { op: "jobs" })).toBe(false);

    const result = await adapter.execute("call-1", { op: "jobs" }, undefined, undefined, undefined);
    expect(nativeCalls).toEqual([{ op: "jobs" }]);
    expect(textOf(result)).toBe("native ran");
  });

  test("keeps the progress channel of a delegated wait", async () => {
    const updates: unknown[] = [];
    const adapter = adapterOf(async (params, options) => {
      options?.onUpdate?.(toolResult({ text: "", details: { op: "wait", jobs: [runningJob("a")] } }));
      return toolResult({ text: "settled", details: { op: "wait", jobs: [{ id: "a", status: "completed" }] } });
    });

    const result = await adapter.execute(
      "call-2",
      { op: "wait", ids: ["a"] },
      undefined,
      (partial) => {
        updates.push(partial);
      },
      undefined,
    );
    expect(textOf(result)).toBe("settled");
    expect(updates).toHaveLength(1);
  });
});
