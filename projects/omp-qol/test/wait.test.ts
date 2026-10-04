/**
 * Wait deadline module tests for the standalone `wait` entry. Covers capability
 * selection, model-visible parameters, the structural continuation classifier,
 * deadline races, delegation, and the host adapter seam.
 */

import { describe, expect, test } from "bun:test";
import { RegisteredToolAdapter } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/wrapper";
import type { ExtensionRunner } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/runner";
import type { RegisteredTool } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/types";
import type { AgentToolResult, AgentToolUpdateCallback, ExtensionContext, ToolInfo } from "@oh-my-pi/pi-coding-agent";
import type { ModuleContext, ModuleState } from "../src/extension.ts";
import { parseQolSettings, type QolSettings, type WaitSettings } from "../src/settings.ts";
import {
  createNativeWaitDefinition,
  installWaitModule,
  isNativeEmptyWaitSchema,
  isRunningJobWaitWindow,
  nativeWaitDeadlineResult,
  resolveWaitDeadline,
  rewriteNativeWaitDescription,
  runWaitLoop,
  WAIT_TIMEOUT_MAX_SECONDS,
  WAIT_TOOL_NAME,
  type NativeWaitToolDefinition,
  type WaitLoopDeps,
} from "../src/wait.ts";
import { createHarness, moduleContext, nativeWaitToolInfo, toolResult, type Harness } from "./host.ts";

const NATIVE_WAIT_DESCRIPTION =
  "Wait for background activity. Returns when a background job finishes, an incoming message arrives, the native wait window elapses, or a steering interrupt occurs.";

/** Runtime shape emitted by `@oh-my-pi/omptype` for `type({})`. */
function nativeEmptyObjectSchema(): unknown {
  const schema = () => undefined;
  Object.assign(schema, {
    ir: {
      k: "object",
      props: [],
      index: undefined,
      symbolIndex: undefined,
      patternIndexes: undefined,
    },
  });
  return schema;
}

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

/** Install the module against a host replacement. */
function install(overrides: {
  settings?: QolSettings;
  parameters?: unknown;
  source?: string;
  waitEntry?: boolean;
  schemaBuilder?: boolean;
}): { state: ModuleState; harness: Harness; reports: string[] } {
  const infos: ToolInfo[] = [];
  if (overrides.waitEntry !== false) {
    infos.push({
      ...nativeWaitToolInfo(NATIVE_WAIT_DESCRIPTION, overrides.parameters ?? nativeEmptyObjectSchema()),
      sourceInfo: {
        path: "<builtin:wait>",
        source: overrides.source ?? "builtin",
        scope: "temporary",
        origin: "top-level",
      },
    });
  }
  const harness = createHarness(infos);
  if (overrides.schemaBuilder === false) {
    // Tests deliberately remove one runtime member omitted by the baseline API type.
    const runtime = harness.pi as unknown as { zod?: unknown };
    runtime.zod = undefined;
  }
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

/** Loop dependencies with no outer signal, no progress channel, and continuation on. */
function loopDeps(overrides: Partial<WaitLoopDeps> & Pick<WaitLoopDeps, "invoke">): WaitLoopDeps {
  return {
    deadlineSeconds: 1200,
    continueEmptyWindows: true,
    signal: undefined,
    onUpdate: undefined,
    now: () => 0,
    schedule: manualScheduler().schedule,
    ...overrides,
  };
}

describe("continuation classifier", () => {
  test("accepts only nonempty all-running job snapshots", () => {
    expect(
      isRunningJobWaitWindow(
        emptyWindow({
          op: "wait",
          meta: { source: { type: "report", value: "background jobs snapshot" } },
          jobs: [runningJob("a"), runningJob("b")],
        }),
      ),
    ).toBe(true);
  });

  test("returns every informative or terminal native result without continuation", () => {
    const cases: Array<[string, AgentToolResult]> = [
      ["message", toolResult({ text: "peer replied", details: { op: "wait", jobs: [], message: { body: "hi" } } })],
      ["no jobs", emptyWindow({ op: "wait", jobs: [] })],
      ["interruption", emptyWindow({ op: "wait", jobs: [], interrupted: true })],
      ["completed job", emptyWindow({ op: "wait", jobs: [{ id: "a", status: "completed" }] })],
      ["cancelled job", emptyWindow({ op: "wait", jobs: [{ id: "a", status: "cancelled" }] })],
      ["mixed jobs", emptyWindow({ op: "wait", jobs: [runningJob("a"), { id: "b", status: "failed" }] })],
      ["service event", toolResult({ text: "service exited", details: { op: "wait", jobs: [] } })],
      ["native error", toolResult({ details: { op: "wait", jobs: [runningJob("a")] }, useless: true, isError: true })],
      ["non-useless snapshot", toolResult({ details: { op: "wait", jobs: [runningJob("a")] } })],
      ["unknown detail", emptyWindow({ op: "wait", jobs: [runningJob("a")], interrupted: false })],
    ];
    for (const [label, result] of cases) {
      expect([label, isRunningJobWaitWindow(result)]).toEqual([label, false]);
    }
  });
});

describe("deadline resolution", () => {
  test("uses waitJobsSeconds when no explicit timeout is given", () => {
    expect(resolveWaitDeadline({}, waitSettings({ jobsSeconds: 100 }))).toEqual({ kind: "deadline", seconds: 100 });
  });

  test("accepts an explicit timeout in range and rejects the rest without clamping", () => {
    const wait = waitSettings({ jobsSeconds: 1200 });
    expect(resolveWaitDeadline({ timeout: 5 }, wait)).toEqual({ kind: "deadline", seconds: 5 });
    expect(resolveWaitDeadline({ timeout: 0.05 }, wait)).toEqual({ kind: "deadline", seconds: 0.05 });
    expect(resolveWaitDeadline({ timeout: WAIT_TIMEOUT_MAX_SECONDS }, wait)).toEqual({
      kind: "deadline",
      seconds: WAIT_TIMEOUT_MAX_SECONDS,
    });
    for (const timeout of [0, -1, 3600.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = resolveWaitDeadline({ timeout }, wait);
      expect(result.kind).toBe("invalid");
      if (result.kind === "invalid") expect(result.text).toContain("(0, 3600]");
    }
  });
});

describe("deadline loop", () => {
  test("returns the last running snapshot with a deadline note when its own timer fires", async () => {
    const clock = { at: 0 };
    const scheduler = manualScheduler();
    const window = emptyWindow({ op: "wait", jobs: [runningJob("a")] });
    const { invoke, calls } = delegator(async (_params, signal) => {
      // The deadline lands mid-window; the native wait settles it as a running snapshot.
      scheduler.fire();
      clock.at = 1_200_000;
      expect(signal?.aborted).toBe(true);
      return window;
    });
    const result = await runWaitLoop(loopDeps({ invoke, now: () => clock.at, schedule: scheduler.schedule }));
    expect(scheduler.scheduled).toEqual([1_200_000]);
    expect(calls).toHaveLength(1);
    expect(result.details).toEqual({ op: "wait", jobs: [runningJob("a")] });
    expect(textOf(result)).toContain("Wait deadline reached after 1200s");
    expect(textOf(result)).toContain("`proc://`");
    expect(result.useless).toBeUndefined();
  });

  test("falls back to a minimal result when the deadline aborts a window with no snapshot yet", async () => {
    const scheduler = manualScheduler();
    let attempts = 0;
    const { invoke } = delegator(async (_params, signal) => {
      attempts += 1;
      const nativeAbort = () => new Error("Operation aborted");
      if (signal?.aborted === true) throw nativeAbort();
      // The delegated host boundary may normalize ToolAbortError to a plain Error.
      return await new Promise<AgentToolResult>((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(nativeAbort()), { once: true });
        scheduler.fire();
      });
    });
    const result = await runWaitLoop(loopDeps({ invoke, deadlineSeconds: 0.05, schedule: scheduler.schedule }));
    expect(attempts).toBe(1);
    expect(result.details).toEqual({ op: "wait", jobs: [] });
    expect(textOf(result)).toContain("Wait deadline reached after 0.05s");
    expect(result.isError).toBeUndefined();
  });

  test("keeps an unrelated native error when its own timer fires", async () => {
    const scheduler = manualScheduler();
    const failure = new Error("native storage failure unrelated to abort");
    const { invoke } = delegator(async () => {
      scheduler.fire();
      throw failure;
    });
    await expect(runWaitLoop(loopDeps({ invoke, deadlineSeconds: 1, schedule: scheduler.schedule }))).rejects.toBe(
      failure,
    );
  });

  test("keeps an unrelated native error", async () => {
    const failure = new Error("wait exploded");
    const { invoke } = delegator(async () => {
      throw failure;
    });
    await expect(runWaitLoop(loopDeps({ invoke }))).rejects.toBe(failure);
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
      runWaitLoop(loopDeps({ invoke, signal: controller.signal, schedule: scheduler.schedule })),
    ).rejects.toThrow("steering");
  });

  test("delivers a message that already came back when cancellation lands", async () => {
    const controller = new AbortController();
    const message = toolResult({ text: "peer replied", details: { op: "wait", jobs: [], message: { body: "hi" } } });
    const { invoke } = delegator(async () => {
      controller.abort(new Error("cancelled"));
      return message;
    });
    expect(await runWaitLoop(loopDeps({ invoke, signal: controller.signal }))).toBe(message);
  });

  test("returns a terminal result that arrives after the deadline signal", async () => {
    const clock = { at: 0 };
    const scheduler = manualScheduler();
    const terminal = toolResult({ text: "late message", details: { op: "wait", jobs: [], message: { body: "hi" } } });
    const { invoke } = delegator(async (_params, signal) => {
      scheduler.fire();
      clock.at = 1;
      expect(signal?.aborted).toBe(true);
      return terminal;
    });
    const result = await runWaitLoop(
      loopDeps({ invoke, deadlineSeconds: 0.001, now: () => clock.at, schedule: scheduler.schedule }),
    );
    expect(result).toBe(terminal);
  });

  test("appends the note to the delivered window text", () => {
    const result = nativeWaitDeadlineResult(emptyWindow({ op: "wait", jobs: [runningJob("a")] }), 30);
    expect(result.content).toHaveLength(2);
    expect(textOf(result)).toContain("after 30s");
  });
});

describe("delegation", () => {
  async function execute(
    params: { timeout?: number },
    wait: WaitSettings,
    handler: (params: Record<string, unknown>, signal?: AbortSignal) => Promise<AgentToolResult>,
  ) {
    const harness = createHarness();
    const { invoke, calls } = delegator(handler);
    const definition: NativeWaitToolDefinition = createNativeWaitDefinition(
      harness.pi,
      rewriteNativeWaitDescription(NATIVE_WAIT_DESCRIPTION, wait),
      wait,
    );
    const result = await definition.execute(
      "call-standalone",
      params,
      undefined,
      undefined,
      harness.context({ invokeTool: invoke }),
    );
    return { result, calls };
  }

  test("delegates empty native arguments across running snapshots", async () => {
    let attempts = 0;
    const { result, calls } = await execute({ timeout: 1 }, waitSettings(), async () => {
      attempts += 1;
      if (attempts < 3) return emptyWindow({ op: "wait", jobs: [runningJob("a")] });
      return toolResult({ text: "job finished", details: { op: "wait", jobs: [{ id: "a", status: "completed" }] } });
    });
    expect(calls.map((call) => call.params)).toEqual([{}, {}, {}]);
    expect(textOf(result)).toBe("job finished");
  });

  test("keeps configured and explicit deadlines out of native arguments", async () => {
    for (const params of [{}, { timeout: 42 }]) {
      const delegated = await execute(params, waitSettings({ jobsSeconds: 10 }), async () =>
        toolResult({ text: "finished", details: { op: "wait", jobs: [{ id: "a", status: "completed" }] } }),
      );
      expect(delegated.calls.map((call) => call.params)).toEqual([{}]);
    }
  });

  test("returns native terminal outcomes after one delegation", async () => {
    const outcomes: Array<[string, AgentToolResult]> = [
      ["message", toolResult({ text: "message", details: { op: "wait", jobs: [], message: { body: "hi" } } })],
      ["no jobs", emptyWindow({ op: "wait", jobs: [] })],
      ["interruption", emptyWindow({ op: "wait", jobs: [], interrupted: true })],
      ["cancelled job", emptyWindow({ op: "wait", jobs: [{ id: "a", status: "cancelled" }] })],
      ["service event", toolResult({ text: "service exited", details: { op: "wait", jobs: [] } })],
      ["error", toolResult({ text: "error", details: { op: "wait", jobs: [] }, isError: true })],
    ];
    for (const [label, outcome] of outcomes) {
      const delegated = await execute({ timeout: 1 }, waitSettings(), async () => outcome);
      expect([label, delegated.calls.length]).toEqual([label, 1]);
      expect(delegated.result).toBe(outcome);
    }
  });

  test("honors disabled continuation without adding a deadline note", async () => {
    const running = emptyWindow({ op: "wait", jobs: [runningJob("a")] });
    const { result, calls } = await execute(
      { timeout: 1 },
      waitSettings({ continueEmptyWindows: false }),
      async () => running,
    );
    expect(calls).toHaveLength(1);
    expect(result).toBe(running);
    expect(textOf(result)).not.toContain("Wait deadline reached");
  });

  test("reports an explicit timeout outside the accepted range as an error", async () => {
    const { result, calls } = await execute({ timeout: 3601 }, waitSettings(), async () =>
      toolResult({ text: "never" }),
    );
    expect(calls).toEqual([]);
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("(0, 3600]");
  });

  test("returns an explicit error when the host exposes no delegation", async () => {
    const harness = createHarness();
    const definition = createNativeWaitDefinition(harness.pi, NATIVE_WAIT_DESCRIPTION, waitSettings());
    const result = await definition.execute("call-1", {}, undefined, undefined, harness.context({}));
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("ctx.invokeTool");
  });
});

describe("registration", () => {
  test("registers a parameterized read-only wait for an intact built-in entry", () => {
    const { state, harness } = install({});
    expect(state).toEqual({
      status: "enabled",
      detail:
        "entry=wait effectiveDefaultSeconds=1200 " +
        "messageContinuation=not-applicable processWait=not-applicable serviceContinuation=not-applicable",
    });
    expect(harness.tools).toHaveLength(1);
    const tool = harness.tools[0];
    expect(tool?.name).toBe(WAIT_TOOL_NAME);
    expect(tool?.approval).toBe("read");
    expect(tool?.interruptible).toBe(true);
    expect(tool?.loadMode).toBe("essential");
    expect(tool?.strict).toBe(true);

    const schema = tool?.parameters as unknown as { safeParse: (input: unknown) => { success: boolean } };
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ timeout: 1 }).success).toBe(true);
    expect(schema.safeParse({ timeout: WAIT_TIMEOUT_MAX_SECONDS }).success).toBe(true);
    expect(schema.safeParse({ timeout: 0 }).success).toBe(false);
    expect(schema.safeParse({ timeout: WAIT_TIMEOUT_MAX_SECONDS + 1 }).success).toBe(false);
    expect(schema.safeParse({ from: "Peer" }).success).toBe(false);
  });

  test("recognizes only the native empty object parameter structure", () => {
    expect(isNativeEmptyWaitSchema(nativeEmptyObjectSchema())).toBe(true);
    expect(isNativeEmptyWaitSchema(() => undefined)).toBe(false);
    expect(isNativeEmptyWaitSchema({ ir: { k: "object", props: [] } })).toBe(false);
    const withProperty = nativeEmptyObjectSchema();
    if (typeof withProperty !== "function" || !("ir" in withProperty)) throw new Error("invalid test schema");
    const ir = withProperty.ir as { props: unknown[] };
    ir.props.push({ name: "unexpected" });
    expect(isNativeEmptyWaitSchema(withProperty)).toBe(false);
  });

  test("stays inactive when the module is switched off", () => {
    const { state, harness } = install({ settings: settings({ waitEnabled: false }) });
    expect(state).toEqual({ status: "disabled", reason: "wait-disabled" });
    expect(harness.tools).toEqual([]);
  });

  test("reports every compatibility failure and registers nothing", () => {
    const cases: Array<[string, Parameters<typeof install>[0], ModuleState, string]> = [
      [
        "no wait entry",
        { waitEntry: false },
        { status: "unavailable", reason: "wait-tool-absent" },
        "wait-tool-absent",
      ],
      [
        "a shadowed wait",
        { source: "extension" },
        { status: "incompatible", reason: "wait-tool-shadowed" },
        "wait-tool-shadowed",
      ],
      [
        "an unexpected schema",
        { parameters: () => undefined },
        { status: "incompatible", reason: "wait-schema-unrecognized" },
        "wait-schema-unrecognized",
      ],
      [
        "a missing schema builder",
        { schemaBuilder: false },
        { status: "incompatible", reason: "wait-schema-builder-absent" },
        "wait-schema-builder-absent",
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
});

describe("real registered-tool adapter", () => {
  /** Drive the host's own adapter, with a fake runner and delegation context. */
  function adapterOf(
    invokeTool: (
      params: Record<string, unknown>,
      options?: { onUpdate?: AgentToolUpdateCallback },
    ) => Promise<AgentToolResult>,
  ) {
    const harness = createHarness();
    const definition = createNativeWaitDefinition(harness.pi, NATIVE_WAIT_DESCRIPTION, waitSettings());
    const registered = {
      definition,
      extensionPath: "/tmp/omp-qol",
      sourceInfo: { path: "/tmp/omp-qol", source: "extension", scope: "temporary", origin: "top-level" },
    } as unknown as RegisteredTool;
    const context: ExtensionContext = harness.context({ invokeTool: invokeTool as never });
    const runner = { createContext: () => context } as unknown as ExtensionRunner;
    return new RegisteredToolAdapter(registered, runner);
  }

  /**
   * The properties the adapter forwards from the definition at runtime. The
   * class itself declares only name, description, parameters, label, and
   * strict, so this view names what `applyToolProxy` copies.
   */
  type ForwardedView = { loadMode?: string; strict?: boolean; approval?: unknown; interruptible?: unknown };

  test("forwards interruptible, loadMode, strict, and approval, and delegates the call", async () => {
    const nativeCalls: Record<string, unknown>[] = [];
    const adapter = adapterOf(async (params) => {
      nativeCalls.push(params);
      return toolResult({ text: "job finished", details: { op: "wait", jobs: [{ id: "a", status: "completed" }] } });
    });

    const view: ForwardedView = adapter as unknown as ForwardedView;
    expect(view.loadMode).toBe("essential");
    expect(view.strict).toBe(true);
    expect(view.approval).toBe("read");
    expect(view.interruptible).toBe(true);

    const result = await adapter.execute("call-1", { timeout: 1 }, undefined, undefined, undefined);
    expect(nativeCalls).toEqual([{}]);
    expect(textOf(result)).toBe("job finished");
  });

  test("keeps the progress channel of a delegated wait", async () => {
    const updates: unknown[] = [];
    const adapter = adapterOf(async (_params, options) => {
      options?.onUpdate?.(toolResult({ text: "", details: { op: "wait", jobs: [runningJob("a")] } }));
      return toolResult({ text: "settled", details: { op: "wait", jobs: [{ id: "a", status: "completed" }] } });
    });

    const result = await adapter.execute(
      "call-2",
      { timeout: 1 },
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
