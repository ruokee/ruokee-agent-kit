/**
 * Compaction-deadline module tests (matrix P01-P04).
 *
 * The module patches the process-global `AbortSignal.timeout`, so every test
 * restores the original global and clears the registry slot. The clock and the
 * guard timer are injected, and the replaced original is swapped for a recorder
 * that returns a plain signal, so no test creates a real long-lived timer.
 */

import { afterEach, describe, expect, test } from "bun:test";
import type { ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import {
  compactionPatchRegistry,
  COMPACTION_REGISTRY_SCHEMA,
  createCompactionInstaller,
  type CompactionPatchRegistry,
} from "../src/compaction-timeout.ts";
import {
  activate,
  PACKAGE_VERSION,
  type ModuleContext,
  type ModuleOffReason,
  type ModuleState,
  type PluginSettingsReader,
  type QolState,
} from "../src/extension.ts";
import { parseQolSettings, type QolSettings } from "../src/settings.ts";
import { createHarness, moduleContext, TEST_RUNTIME_ID, type Harness } from "./host.ts";

const NATIVE_TIMEOUT = AbortSignal.timeout;
const REGISTRY_KEY = Symbol.for("ruokee.omp-qol.compaction-timeout.registry");
const LEGACY_KEY = Symbol.for("ruokee.omp.compaction-timeout.patched");
const REMOTE_START = { reason: "threshold", action: "remote" };

function globalSlots(): Record<symbol, unknown> {
  return globalThis as unknown as Record<symbol, unknown>;
}

/** Forget the process patch, as a fresh process would. */
function resetPatch(): void {
  AbortSignal.timeout = NATIVE_TIMEOUT;
  globalSlots()[REGISTRY_KEY] = undefined;
}

afterEach(() => {
  resetPatch();
  globalSlots()[LEGACY_KEY] = undefined;
});

function qolSettings(overrides: Record<string, unknown> = {}): QolSettings {
  const parsed = parseQolSettings(overrides);
  if (parsed.kind !== "loaded") throw new Error("expected loaded settings");
  return parsed.settings;
}

/** A clock the test advances by hand. */
function fakeClock(start = 1_000_000): { now: () => number; advance: (ms: number) => void } {
  let value = start;
  return {
    now: () => value,
    advance: (ms) => {
      value += ms;
    },
  };
}

/** Guard timers the test fires by hand, in the shape the installer takes. */
function guardTimers(): {
  scheduled: number[];
  setTimer: (callback: () => void, milliseconds: number) => () => void;
  fireAll: () => void;
} {
  const scheduled: number[] = [];
  const pending: Array<{ callback: () => void; cancelled: boolean }> = [];
  return {
    scheduled,
    setTimer: (callback, milliseconds) => {
      scheduled.push(milliseconds);
      const entry = { callback, cancelled: false };
      pending.push(entry);
      return () => {
        entry.cancelled = true;
      };
    },
    fireAll: () => {
      for (const entry of pending.splice(0)) if (!entry.cancelled) entry.callback();
    },
  };
}

interface InstallOptions {
  raw?: Record<string, unknown>;
  cwd?: string;
  clock?: ReturnType<typeof fakeClock>;
  enablePatch?: boolean;
  /** Runtime identity; a second value models a second activation in the process. */
  runtimeId?: string;
  /** Set when the master switch or this module's keys keep the module off. */
  off?: ModuleOffReason;
}

/** What one install attempt reports, whatever its outcome. */
interface Attempt {
  state: ModuleState;
  reports: string[];
  statuses: ModuleState[];
  harness: Harness;
  clock: ReturnType<typeof fakeClock>;
  timers: ReturnType<typeof guardTimers>;
  emit: (eventType: string, event: Record<string, unknown>) => Promise<void>;
  notices: () => string[];
}

function attemptInstall(options: InstallOptions = {}): Attempt {
  const clock = options.clock ?? fakeClock();
  const timers = guardTimers();
  const harness = createHarness();
  const reports: string[] = [];
  const statuses: ModuleState[] = [];
  const context: ModuleContext = moduleContext({
    pi: harness.pi,
    ctx: harness.context({ cwd: options.cwd ?? "/tmp/omp-qol-project" }),
    settings: qolSettings({
      compactionTimeoutEnabled: options.enablePatch ?? true,
      ...options.raw,
    }),
    runtimeId: options.runtimeId,
    off: options.off,
    report: (key, message) => reports.push(`${key}: ${message}`),
    setStatus: (id, status) => statuses.push(status),
  });
  const state = createCompactionInstaller({ now: clock.now, setTimer: timers.setTimer })(context);
  return {
    state,
    reports,
    statuses,
    harness,
    clock,
    timers,
    emit: async (eventType, event) => {
      await harness.emit(eventType, { type: eventType, ...event }, harness.context());
    },
    notices: () => harness.notifications.map((entry) => entry.message),
  };
}

interface PatchSetup extends Attempt {
  registry: CompactionPatchRegistry;
  /** Deadlines the wrapper forwarded to the replaced original, in order. */
  calls: number[];
}

/** Install the shipped patch, then record every deadline it forwards. */
function installPatch(options: InstallOptions = {}): PatchSetup {
  const attempt = attemptInstall(options);
  const registry = compactionPatchRegistry();
  if (registry === undefined) throw new Error(`expected the patch registry, got ${JSON.stringify(attempt.state)}`);
  const nativeOriginal = registry.original;
  const calls: number[] = [];
  registry.original = (milliseconds: number) => {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) return nativeOriginal.call(AbortSignal, milliseconds);
    calls.push(milliseconds);
    return new AbortController().signal;
  };
  return { ...attempt, registry, calls };
}

describe("compaction patch installation", () => {
  test("leaves AbortSignal.timeout alone while the experiment is off", () => {
    const attempt = attemptInstall({ enablePatch: false });
    expect(attempt.state).toEqual({ status: "disabled", reason: "compaction-disabled" });
    expect(AbortSignal.timeout).toBe(NATIVE_TIMEOUT);
    expect(compactionPatchRegistry()).toBeUndefined();
    expect(attempt.reports).toEqual([]);
  });

  test("installs one wrapper and records the original when enabled", () => {
    const setup = installPatch();
    expect(setup.state).toEqual({ status: "enabled" });
    expect(setup.registry.runtimeId).toBe(TEST_RUNTIME_ID);
    expect(setup.registry.packageVersion).toBe(PACKAGE_VERSION);
    expect(setup.registry.cwd).toBe("/tmp/omp-qol-project");
    expect(setup.registry.original).not.toBe(NATIVE_TIMEOUT);
    expect(AbortSignal.timeout).toBe(setup.registry.wrapper);
    expect(setup.registry.window).toBeUndefined();
  });

  test("is idempotent for the same runtime and never wraps twice", () => {
    const setup = installPatch();
    const wrapper = AbortSignal.timeout;
    const again = createCompactionInstaller()(
      moduleContext({
        pi: setup.harness.pi,
        ctx: setup.harness.context({ cwd: "/tmp/omp-qol-project" }),
        settings: qolSettings({ compactionTimeoutEnabled: true }),
        runtimeId: TEST_RUNTIME_ID,
      }),
    );
    expect(again).toEqual({ status: "enabled" });
    expect(AbortSignal.timeout).toBe(wrapper);
  });

  test("releases the patch when the same runtime asks for it off", () => {
    const setup = installPatch();
    const again = createCompactionInstaller()(
      moduleContext({
        pi: setup.harness.pi,
        ctx: setup.harness.context({ cwd: "/tmp/omp-qol-project" }),
        settings: qolSettings({ compactionTimeoutEnabled: false }),
        runtimeId: TEST_RUNTIME_ID,
      }),
    );
    expect(again).toEqual({ status: "disabled", reason: "compaction-disabled" });
    expect(AbortSignal.timeout).toBe(setup.registry.original);
    expect(setup.registry.disabledReason).toBe("compaction-disabled");
  });

  test("stops the installed patch when the same runtime installs another snapshot", () => {
    const setup = installPatch();
    const again = createCompactionInstaller()(
      moduleContext({
        pi: setup.harness.pi,
        ctx: setup.harness.context({ cwd: "/tmp/omp-qol-project" }),
        settings: qolSettings({ compactionTimeoutEnabled: true, compactionTimeoutMs: 600_000 }),
        runtimeId: TEST_RUNTIME_ID,
        setStatus: (id, status) => setup.statuses.push(status),
      }),
    );
    expect(again).toEqual({ status: "incompatible", reason: "config-conflict" });
    expect(setup.registry.disabledReason).toBe("config-conflict");
    expect(AbortSignal.timeout).toBe(setup.registry.original);
    expect(setup.statuses).toEqual([{ status: "incompatible", reason: "config-conflict" }]);
    AbortSignal.timeout(300_000);
    expect(setup.calls).toEqual([300_000]);
  });
});

describe("compaction patch range", () => {
  test("rewrites only matching deadlines, and only while a window is open", async () => {
    const setup = installPatch();
    AbortSignal.timeout(300_000);
    expect(setup.calls).toEqual([300_000]);

    await setup.emit("auto_compaction_start", REMOTE_START);
    AbortSignal.timeout(300_000);
    AbortSignal.timeout(299_999);
    AbortSignal.timeout(600_000);
    AbortSignal.timeout(900_000);
    expect(setup.calls.slice(1)).toEqual([900_000, 299_999, 900_000, 900_000]);
  });

  test("keeps native invalid-input semantics", async () => {
    const setup = installPatch();
    await setup.emit("auto_compaction_start", REMOTE_START);
    expect(() => AbortSignal.timeout(Number.NaN)).toThrow(TypeError);
    expect(() => AbortSignal.timeout(-5)).toThrow(TypeError);
    expect(setup.calls).toEqual([]);
  });

  test("notifies once per window and names the process-level side effect", async () => {
    const setup = installPatch();
    await setup.emit("auto_compaction_start", REMOTE_START);
    AbortSignal.timeout(300_000);
    AbortSignal.timeout(300_000);
    expect(setup.notices()).toHaveLength(1);
    expect(setup.notices()[0] ?? "").toContain("@ruokee/omp-qol");
    expect(setup.notices()[0] ?? "").toContain("900000 ms");
    expect(setup.notices()[0] ?? "").toContain("matching timeouts");

    await setup.emit("auto_compaction_end", { action: "remote", result: undefined, aborted: false, willRetry: false });
    await setup.emit("auto_compaction_start", REMOTE_START);
    AbortSignal.timeout(300_000);
    expect(setup.notices()).toHaveLength(2);
  });

  test("stays silent when the hit notice is off", async () => {
    const setup = installPatch({ raw: { compactionTimeoutNotify: false } });
    await setup.emit("auto_compaction_start", REMOTE_START);
    AbortSignal.timeout(300_000);
    expect(setup.notices()).toEqual([]);
    expect(setup.calls).toEqual([900_000]);
  });

  test("extends a matching deadline of any caller inside the window", async () => {
    // Process-level rewrite: a call that is not a compaction request, but uses a
    // deadline inside the range, is extended as well.
    const setup = installPatch();
    await setup.emit("auto_compaction_start", REMOTE_START);
    const unrelated = AbortSignal.timeout(300_000);
    expect(setup.calls).toEqual([900_000]);
    expect(unrelated).toBeInstanceOf(AbortSignal);
  });
});

describe("compaction window lifecycle", () => {
  test("opens only on a remote auto start, and closes on its end", async () => {
    const setup = installPatch();
    await setup.emit("auto_compaction_start", { reason: "threshold", action: "context-full" });
    expect(setup.registry.window).toBeUndefined();

    await setup.emit("auto_compaction_start", REMOTE_START);
    expect(setup.registry.window?.kind).toBe("auto");
    await setup.emit("auto_compaction_end", { action: "remote", result: undefined, aborted: true, willRetry: false });
    expect(setup.registry.window).toBeUndefined();
    AbortSignal.timeout(300_000);
    expect(setup.calls).toEqual([300_000]);
  });

  test("opens on a manual compaction, refines it, and closes on commit", async () => {
    const setup = installPatch();
    await setup.emit("session_before_compact", { signal: new AbortController().signal });
    await setup.emit("session.compacting", { sessionId: "session-a", messages: [] });
    expect(setup.registry.window).toMatchObject({ kind: "manual", sessionId: "session-a" });
    await setup.emit("session_compact", { fromExtension: false, compactionEntry: {} });
    expect(setup.registry.window).toBeUndefined();
  });

  test("keeps a before-compact hook inside an auto round", async () => {
    const setup = installPatch();
    await setup.emit("auto_compaction_start", REMOTE_START);
    await setup.emit("session_before_compact", { signal: new AbortController().signal });
    await setup.emit("session.compacting", { sessionId: "session-a", messages: [] });
    expect(setup.registry.disabledReason).toBeUndefined();
    expect(setup.registry.window?.kind).toBe("auto");
    AbortSignal.timeout(300_000);
    expect(setup.calls).toEqual([900_000]);
  });

  test("does not extend the guard lease on a repeated start notice", async () => {
    const setup = installPatch();
    await setup.emit("session.compacting", { sessionId: "session-a", messages: [] });
    const deadline = setup.registry.window?.guardDeadline;
    setup.clock.advance(3_599_999);
    await setup.emit("session.compacting", { sessionId: "session-a", messages: [] });
    expect(setup.registry.window?.guardDeadline).toBe(deadline);
    expect(setup.timers.scheduled).toEqual([3_600_000]);

    AbortSignal.timeout(300_000);
    expect(setup.calls).toEqual([900_000]);

    setup.clock.advance(2);
    AbortSignal.timeout(300_000);
    expect(setup.calls).toEqual([900_000, 300_000]);
  });

  test("ends rewriting on the guard timer", async () => {
    const setup = installPatch();
    await setup.emit("auto_compaction_start", REMOTE_START);
    setup.timers.fireAll();
    expect(setup.registry.window).toBeUndefined();
    AbortSignal.timeout(300_000);
    expect(setup.calls).toEqual([300_000]);
  });

  test("ends rewriting on cancel and on an already-aborted signal", async () => {
    const setup = installPatch();
    const abort = new AbortController();
    await setup.emit("session_before_compact", { signal: abort.signal });
    abort.abort();
    expect(setup.registry.window).toBeUndefined();
    AbortSignal.timeout(300_000);
    expect(setup.calls).toEqual([300_000]);

    resetPatch();
    const skipped = installPatch();
    const alreadyAborted = new AbortController();
    alreadyAborted.abort();
    await skipped.emit("session_before_compact", { signal: alreadyAborted.signal });
    expect(skipped.registry.window).toBeUndefined();
    AbortSignal.timeout(300_000);
    expect(skipped.calls).toEqual([300_000]);
  });

  test("binds a before-compact signal to a window an auto round opened", async () => {
    const setup = installPatch();
    await setup.emit("auto_compaction_start", REMOTE_START);
    const guardDeadline = setup.registry.window?.guardDeadline;
    const abort = new AbortController();
    await setup.emit("session_before_compact", { signal: abort.signal });
    expect(setup.registry.window?.kind).toBe("auto");
    expect(setup.registry.window?.guardDeadline).toBe(guardDeadline);
    expect(setup.timers.scheduled).toEqual([3_600_000]);

    abort.abort();
    expect(setup.registry.window).toBeUndefined();
    AbortSignal.timeout(300_000);
    expect(setup.calls).toEqual([300_000]);
  });

  test("binds a before-compact signal to a window `session.compacting` opened", async () => {
    const setup = installPatch();
    await setup.emit("session.compacting", { sessionId: "session-a", messages: [] });
    const abort = new AbortController();
    await setup.emit("session_before_compact", { signal: abort.signal });
    abort.abort();
    expect(setup.registry.window).toBeUndefined();
    AbortSignal.timeout(300_000);
    expect(setup.calls).toEqual([300_000]);
  });

  test("closes the open window when the before-compact signal already aborted", async () => {
    const setup = installPatch();
    await setup.emit("auto_compaction_start", REMOTE_START);
    const abort = new AbortController();
    abort.abort();
    await setup.emit("session_before_compact", { signal: abort.signal });
    expect(setup.registry.window).toBeUndefined();
    AbortSignal.timeout(300_000);
    expect(setup.calls).toEqual([300_000]);
  });

  test("keeps a stale abort listener from closing a later window", async () => {
    const setup = installPatch();
    const stale = new AbortController();
    await setup.emit("auto_compaction_start", REMOTE_START);
    await setup.emit("session_before_compact", { signal: stale.signal });
    expect(setup.registry.window).toBeDefined();

    // The window closes by its own end event, and a new one opens. The listener
    // of the closed window is released with it.
    await setup.emit("auto_compaction_end", { action: "remote", result: undefined, aborted: false, willRetry: false });
    await setup.emit("auto_compaction_start", REMOTE_START);
    const current = setup.registry.window;
    expect(current?.kind).toBe("auto");

    stale.abort();
    expect(setup.registry.window).toBe(current);
    AbortSignal.timeout(300_000);
    expect(setup.calls).toEqual([900_000]);
  });

  test("ends rewriting on a session switch and on shutdown", async () => {
    const switched = installPatch();
    await switched.emit("auto_compaction_start", REMOTE_START);
    await switched.emit("session_switch", { reason: "new", previousSessionFile: undefined });
    expect(switched.registry.window).toBeUndefined();

    resetPatch();
    const shutdown = installPatch();
    await shutdown.emit("session.compacting", { sessionId: "session-a", messages: [] });
    await shutdown.emit("session_shutdown", {});
    expect(shutdown.registry.window).toBeUndefined();
  });
});

describe("compaction serial method fallback", () => {
  const COMMITTED = { fromExtension: false, compactionEntry: {} };

  test("keeps the window through the host's per-method retry on one signal", async () => {
    // OMP runs the next compaction method on the same controller when one fails,
    // and each attempt emits `session_before_compact` and `session.compacting`
    // again. The fallback is one operation, not two overlapping rounds.
    const setup = installPatch();
    const abort = new AbortController();
    await setup.emit("session_before_compact", { signal: abort.signal });
    await setup.emit("session.compacting", { sessionId: "session-a", messages: [] });
    const window = setup.registry.window;
    AbortSignal.timeout(300_000);
    expect(setup.calls).toEqual([900_000]);

    await setup.emit("session_before_compact", { signal: abort.signal });
    await setup.emit("session.compacting", { sessionId: "session-a", messages: [] });

    expect(setup.registry.disabledReason).toBeUndefined();
    expect(setup.registry.window).toBe(window);
    expect(setup.registry.window?.kind).toBe("manual");
    expect(setup.registry.window?.sessionId).toBe("session-a");
    expect(setup.timers.scheduled).toEqual([3_600_000]);
    expect(setup.notices()).toHaveLength(1);
    AbortSignal.timeout(300_000);
    expect(setup.calls).toEqual([900_000, 900_000]);

    await setup.emit("session_compact", COMMITTED);
    expect(setup.registry.window).toBeUndefined();
    AbortSignal.timeout(300_000);
    expect(setup.calls).toEqual([900_000, 900_000, 300_000]);

    // The next compaction is a new operation with its own signal.
    await setup.emit("session_before_compact", { signal: new AbortController().signal });
    AbortSignal.timeout(300_000);
    expect(setup.calls).toEqual([900_000, 900_000, 300_000, 900_000]);
  });

  /** The ways a window can already be open when the first before-compact lands. */
  const openers: Array<{ name: string; open: (setup: PatchSetup) => Promise<void> }> = [
    { name: "the first event", open: async () => undefined },
    {
      name: "an auto round",
      open: async (setup) => {
        await setup.emit("auto_compaction_start", REMOTE_START);
      },
    },
    {
      name: "a compacting notice",
      open: async (setup) => {
        await setup.emit("session.compacting", { sessionId: "session-a", messages: [] });
      },
    },
  ];

  for (const opener of openers) {
    test(`keeps a window opened by ${opener.name} through a repeated signal`, async () => {
      const setup = installPatch();
      await opener.open(setup);
      const abort = new AbortController();
      await setup.emit("session_before_compact", { signal: abort.signal });
      const window = setup.registry.window;
      await setup.emit("session_before_compact", { signal: abort.signal });

      expect(setup.registry.disabledReason).toBeUndefined();
      expect(setup.registry.window).toBe(window);
      AbortSignal.timeout(300_000);
      expect(setup.calls).toEqual([900_000]);
    });

    test(`stops rewriting when a different live signal enters a window opened by ${opener.name}`, async () => {
      const setup = installPatch();
      await opener.open(setup);
      await setup.emit("session_before_compact", { signal: new AbortController().signal });
      await setup.emit("session_before_compact", { signal: new AbortController().signal });

      expect(setup.registry.disabledReason).toBe("overlapping-round");
      expect(setup.statuses).toEqual([{ status: "incompatible", reason: "overlapping-round" }]);
      expect(AbortSignal.timeout).toBe(setup.registry.original);
      AbortSignal.timeout(300_000);
      expect(setup.calls).toEqual([300_000]);
    });
  }

  test("re-binds nothing and keeps the notice state and guard lease of the first event", async () => {
    const setup = installPatch();
    const abort = new AbortController();
    await setup.emit("session_before_compact", { signal: abort.signal });
    const window = setup.registry.window;
    const guardDeadline = window?.guardDeadline;
    const cleanup = setup.registry.cleanup;
    expect(cleanup).toBeDefined();
    AbortSignal.timeout(300_000);

    // Time passes before the same signal arrives again, so a window that was
    // re-created or re-leased here would end at a later deadline than the original.
    setup.clock.advance(1_000);
    await setup.emit("session_before_compact", { signal: abort.signal });

    // The same window and the same binding: a repeated event adds no timer, no
    // listener, and no second binding of the signal.
    expect(setup.registry.window).toBe(window);
    expect(setup.registry.window?.guardDeadline).toBe(guardDeadline);
    expect(setup.registry.cleanup).toBe(cleanup);
    expect(setup.timers.scheduled).toEqual([3_600_000]);

    // The notice state is the state of the first event: the second matching call
    // rewrites the deadline and does not announce the window again.
    AbortSignal.timeout(300_000);
    expect(setup.calls).toEqual([900_000, 900_000]);
    expect(setup.notices()).toHaveLength(1);

    // The original lease still ends the rewrite at the deadline it was opened
    // with, without the scheduled guard timer firing.
    setup.clock.advance(3_599_000);
    AbortSignal.timeout(300_000);
    expect(setup.calls).toEqual([900_000, 900_000, 300_000]);
    expect(setup.registry.window).toBeUndefined();
  });

  test("keeps the cancel binding of the first event across a repeated signal", async () => {
    const setup = installPatch();
    const abort = new AbortController();
    await setup.emit("session_before_compact", { signal: abort.signal });
    await setup.emit("session_before_compact", { signal: abort.signal });

    abort.abort();
    expect(setup.registry.window).toBeUndefined();
    AbortSignal.timeout(300_000);
    expect(setup.calls).toEqual([300_000]);
  });

  test("does not remember a signal after its window closed", async () => {
    const setup = installPatch();
    const previous = new AbortController();
    await setup.emit("session_before_compact", { signal: previous.signal });
    await setup.emit("session_before_compact", { signal: previous.signal });
    await setup.emit("session_compact", COMMITTED);

    const current = new AbortController();
    await setup.emit("session_before_compact", { signal: current.signal });
    const window = setup.registry.window;
    previous.abort();
    expect(setup.registry.window).toBe(window);
    AbortSignal.timeout(300_000);
    expect(setup.calls).toEqual([900_000]);
  });

  test("still stops an auto round that starts again while it is open", async () => {
    const setup = installPatch();
    const abort = new AbortController();
    await setup.emit("auto_compaction_start", REMOTE_START);
    await setup.emit("session_before_compact", { signal: abort.signal });
    await setup.emit("session_before_compact", { signal: abort.signal });
    expect(setup.registry.disabledReason).toBeUndefined();

    await setup.emit("auto_compaction_start", REMOTE_START);
    expect(setup.registry.disabledReason).toBe("overlapping-round");
    expect(AbortSignal.timeout).toBe(setup.registry.original);
    await setup.emit("auto_compaction_end", { action: "remote", result: undefined, aborted: false, willRetry: false });
    AbortSignal.timeout(300_000);
    expect(setup.calls).toEqual([300_000]);
  });
});

describe("compaction conflicts", () => {
  test("refuses a known earlier patch", () => {
    globalSlots()[LEGACY_KEY] = true;
    const attempt = attemptInstall();
    expect(attempt.state).toEqual({ status: "incompatible", reason: "legacy-patch" });
    expect(AbortSignal.timeout).toBe(NATIVE_TIMEOUT);
    expect(attempt.reports[0] ?? "").toContain("legacy-patch");
  });

  test("refuses a registry it cannot read and leaves its wrapper in place", () => {
    // A registry written in an earlier layout of this very component.
    const earlierLayout = {
      schema: COMPACTION_REGISTRY_SCHEMA - 1,
      owner: "@ruokee/omp-qol#/tmp/omp-qol-project",
      original: NATIVE_TIMEOUT,
      wrapper: NATIVE_TIMEOUT,
      settings: qolSettings().compaction,
      window: undefined,
      disabledReason: undefined,
      cleanup: undefined,
      now: () => 0,
      notify: () => undefined,
      report: () => undefined,
    };
    globalSlots()[REGISTRY_KEY] = earlierLayout;
    expect(attemptInstall().state).toEqual({ status: "incompatible", reason: "registry-unrecognized" });
    expect(AbortSignal.timeout).toBe(NATIVE_TIMEOUT);

    // A layout of the current schema that this version still cannot validate.
    globalSlots()[REGISTRY_KEY] = { ...earlierLayout, schema: COMPACTION_REGISTRY_SCHEMA, runtimeId: 7 };
    expect(attemptInstall().state).toEqual({ status: "incompatible", reason: "registry-unrecognized" });
    expect(AbortSignal.timeout).toBe(NATIVE_TIMEOUT);

    // A layout from a later version of this component.
    globalSlots()[REGISTRY_KEY] = { ...earlierLayout, schema: COMPACTION_REGISTRY_SCHEMA + 1 };
    expect(attemptInstall().state).toEqual({ status: "incompatible", reason: "registry-unrecognized" });
  });

  test("stops the installed patch when a second activation enters the process", () => {
    const first = installPatch();
    const second = attemptInstall({ runtimeId: "@ruokee/omp-qol#second-activation" });
    expect(second.state).toEqual({ status: "incompatible", reason: "runtime-conflict" });
    expect(first.registry.disabledReason).toBe("runtime-conflict");
    expect(first.statuses).toEqual([{ status: "incompatible", reason: "runtime-conflict" }]);
    expect(first.reports).toEqual([
      "compaction:runtime-conflict: compaction patch stopped rewriting: runtime-conflict",
    ]);
    expect(AbortSignal.timeout).toBe(first.registry.original);
    AbortSignal.timeout(300_000);
    expect(first.calls).toEqual([300_000]);
    expect(second.reports[0] ?? "").toContain("owned the process patch");
  });

  test("stops the installed patch for a second activation whatever its own switch says", () => {
    const first = installPatch();
    const second = attemptInstall({
      runtimeId: "@ruokee/omp-qol#second-activation",
      cwd: "/tmp/other-project",
      enablePatch: false,
    });
    expect(second.state).toEqual({ status: "incompatible", reason: "runtime-conflict" });
    expect(first.registry.disabledReason).toBe("runtime-conflict");
    expect(AbortSignal.timeout).toBe(first.registry.original);
    AbortSignal.timeout(300_000);
    expect(first.calls).toEqual([300_000]);
  });

  test("stops the installed patch for an activation the master switch keeps off", () => {
    const first = installPatch();
    const second = attemptInstall({
      runtimeId: "@ruokee/omp-qol#off-activation",
      raw: { enabled: false },
      off: "master-disabled",
    });
    expect(second.state).toEqual({ status: "disabled", reason: "master-disabled" });
    expect(second.reports[0] ?? "").toContain("compaction:runtime-conflict");
    expect(first.registry.disabledReason).toBe("runtime-conflict");
    expect(AbortSignal.timeout).toBe(first.registry.original);
    AbortSignal.timeout(300_000);
    expect(first.calls).toEqual([300_000]);
  });

  test("stops the installed patch for an activation with invalid compaction keys", () => {
    const first = installPatch();
    const second = attemptInstall({
      runtimeId: "@ruokee/omp-qol#invalid-activation",
      raw: { compactionTimeoutMs: 300_000 },
      off: "settings-invalid",
    });
    expect(second.state).toEqual({ status: "invalid", reason: "settings-invalid" });
    expect(second.reports[0] ?? "").toContain("compaction:runtime-conflict");
    expect(first.registry.disabledReason).toBe("runtime-conflict");
    expect(AbortSignal.timeout).toBe(first.registry.original);
  });

  test("keeps a patch that a stopped activation already released", () => {
    const first = installPatch();
    const second = attemptInstall({ runtimeId: "@ruokee/omp-qol#second-activation" });
    expect(second.state).toEqual({ status: "incompatible", reason: "runtime-conflict" });
    const third = attemptInstall({ runtimeId: "@ruokee/omp-qol#third-activation" });
    expect(third.state).toEqual({ status: "incompatible", reason: "runtime-conflict" });
    expect(first.registry.disabledReason).toBe("runtime-conflict");
    expect(first.reports).toHaveLength(1);
    AbortSignal.timeout(300_000);
    expect(first.calls).toEqual([300_000]);
  });

  test("refuses to adopt a wrapper somebody else installed", () => {
    const setup = installPatch();
    const thirdParty = (milliseconds: number): AbortSignal => NATIVE_TIMEOUT(milliseconds);
    AbortSignal.timeout = thirdParty;
    const again = createCompactionInstaller()(
      moduleContext({
        pi: setup.harness.pi,
        ctx: setup.harness.context({ cwd: "/tmp/omp-qol-project" }),
        settings: qolSettings({ compactionTimeoutEnabled: true }),
        runtimeId: TEST_RUNTIME_ID,
      }),
    );
    expect(again).toEqual({ status: "incompatible", reason: "patch-overwritten" });
    expect(AbortSignal.timeout).toBe(thirdParty);
  });

  test("stops rewriting on overlap without overwriting a later wrapper", async () => {
    const setup = installPatch();
    const thirdParty = (milliseconds: number): AbortSignal => NATIVE_TIMEOUT(milliseconds);
    await setup.emit("auto_compaction_start", REMOTE_START);
    AbortSignal.timeout = thirdParty;
    await setup.emit("auto_compaction_start", REMOTE_START);
    expect(AbortSignal.timeout).toBe(thirdParty);
    expect(setup.registry.disabledReason).toBe("overlapping-round");
  });

  test("disables on an overlapping round", async () => {
    const attempt = attemptInstall();
    await attempt.emit("auto_compaction_start", REMOTE_START);
    await attempt.emit("auto_compaction_start", REMOTE_START);
    expect(compactionPatchRegistry()?.disabledReason).toBe("overlapping-round");
    expect(attempt.statuses).toEqual([{ status: "incompatible", reason: "overlapping-round" }]);
    expect(attempt.reports).toEqual([
      "compaction:overlapping-round: compaction patch stopped rewriting: overlapping-round",
    ]);
    expect(AbortSignal.timeout).toBe(NATIVE_TIMEOUT);
  });

  test("disables on a foreign session and on an unknown event order", async () => {
    const session = installPatch();
    await session.emit("session.compacting", { sessionId: "session-a", messages: [] });
    await session.emit("session.compacting", { sessionId: "session-b", messages: [] });
    expect(session.registry.disabledReason).toBe("overlapping-session");

    resetPatch();
    const order = attemptInstall();
    await order.emit("session_before_compact", { signal: new AbortController().signal });
    await order.emit("auto_compaction_start", REMOTE_START);
    expect(compactionPatchRegistry()?.disabledReason).toBe("unrecognized-order");
    expect(AbortSignal.timeout).toBe(NATIVE_TIMEOUT);
  });
});

describe("compaction activation", () => {
  async function activated(rawSettings: Record<string, unknown>): Promise<{ harness: Harness; state: QolState }> {
    const harness = createHarness();
    const runtime = activate(harness.pi, async () => rawSettings);
    await harness.emit("session_start", { type: "session_start" }, harness.context());
    return { harness, state: runtime.state };
  }

  test("installs through activation only when the switch is on", async () => {
    const off = await activated({});
    expect(off.state.modules.compaction).toEqual({ status: "disabled", reason: "compaction-disabled" });
    expect(AbortSignal.timeout).toBe(NATIVE_TIMEOUT);

    const on = await activated({ compactionTimeoutEnabled: true });
    expect(on.state.modules.compaction).toEqual({ status: "enabled" });
    expect(compactionPatchRegistry()?.settings.timeoutMs).toBe(900_000);
    expect(AbortSignal.timeout).not.toBe(NATIVE_TIMEOUT);

    await on.harness.emit(
      "auto_compaction_start",
      { type: "auto_compaction_start", ...REMOTE_START },
      on.harness.context(),
    );
    expect(compactionPatchRegistry()?.window?.kind).toBe("auto");

    const described = on.harness.commands.get("qol");
    expect(described).toBeDefined();
    await described?.handler("", on.harness.context() as ExtensionContext);
    const text = on.harness.notifications.at(-1)?.message ?? "";
    expect(text).toContain("compaction: enabled");
    expect(text).toContain("enabled=true timeoutMs=900000");
  });

  test("keeps sibling modules untouched when compaction keys are invalid", async () => {
    const harness = createHarness();
    const runtime = activate(harness.pi, async () => ({ compactionTimeoutMs: 300_000 }));
    await harness.emit("session_start", { type: "session_start" }, harness.context());
    expect(runtime.state.modules.compaction).toEqual({ status: "invalid", reason: "settings-invalid" });
    expect(runtime.state.modules.recovery).toEqual({ status: "enabled" });
    expect(AbortSignal.timeout).toBe(NATIVE_TIMEOUT);
  });

  /** The registry of the activation that installed the patch. */
  function installedRegistry(): CompactionPatchRegistry {
    const registry = compactionPatchRegistry();
    if (registry === undefined) throw new Error("expected an installed patch");
    return registry;
  }

  /** Activate with settings this extension cannot use at all. */
  async function settingsFailure(reader: PluginSettingsReader): Promise<{ harness: Harness; state: QolState }> {
    const harness = createHarness();
    const runtime = activate(harness.pi, reader);
    await harness.emit("session_start", { type: "session_start" }, harness.context());
    return { harness, state: runtime.state };
  }

  /**
   * Open an auto window on the activation that installed the patch, and record
   * every deadline its wrapper forwards instead of scheduling a signal.
   */
  async function openWindowAndWatch(harness: Harness): Promise<number[]> {
    const installed = installedRegistry();
    const nativeOriginal = installed.original;
    const calls: number[] = [];
    installed.original = (milliseconds: number) => {
      if (!Number.isFinite(milliseconds) || milliseconds < 0) return nativeOriginal.call(AbortSignal, milliseconds);
      calls.push(milliseconds);
      return new AbortController().signal;
    };
    await harness.emit("auto_compaction_start", { type: "auto_compaction_start", ...REMOTE_START }, harness.context());
    return calls;
  }

  test("stops the installed patch when a second activation loads in the same process", async () => {
    const first = await activated({ compactionTimeoutEnabled: true });
    expect(first.state.modules.compaction).toEqual({ status: "enabled" });
    const installed = installedRegistry();

    const second = await activated({ compactionTimeoutEnabled: true });
    expect(second.state.modules.compaction).toEqual({ status: "incompatible", reason: "runtime-conflict" });
    expect(first.state.modules.compaction).toEqual({ status: "incompatible", reason: "runtime-conflict" });
    expect(installed.disabledReason).toBe("runtime-conflict");
    expect(AbortSignal.timeout).toBe(installed.original);
    AbortSignal.timeout(300_000);
    // The process keeps the restored original once the first activation stopped.
    expect(AbortSignal.timeout).toBe(installed.original);
    expect(first.harness.warnings.some((warning) => warning.includes("stopped rewriting"))).toBe(true);
  });

  test("stops the installed patch from an activation the master switch keeps off", async () => {
    await activated({ compactionTimeoutEnabled: true });
    const installed = installedRegistry();

    const off = await activated({ enabled: false });
    expect(off.state.modules.compaction).toEqual({ status: "disabled", reason: "master-disabled" });
    expect(installed.disabledReason).toBe("runtime-conflict");
    expect(AbortSignal.timeout).toBe(installed.original);
    expect(off.harness.warnings.filter((warning) => warning.includes("another omp-qol runtime"))).toHaveLength(1);
  });

  test("stops the installed patch from a second activation with invalid compaction keys", async () => {
    await activated({ compactionTimeoutEnabled: true });
    const installed = installedRegistry();

    const invalid = await activated({ compactionTimeoutMs: 300_000 });
    expect(invalid.state.modules.compaction).toEqual({ status: "invalid", reason: "settings-invalid" });
    expect(installed.disabledReason).toBe("runtime-conflict");
    expect(AbortSignal.timeout).toBe(installed.original);
  });

  test("stops the installed patch when the settings getter fails", async () => {
    const first = await activated({ compactionTimeoutEnabled: true });
    const calls = await openWindowAndWatch(first.harness);
    AbortSignal.timeout(300_000);
    // Inside the open window the patch rewrites the deadline.
    expect(calls).toEqual([900_000]);

    const second = await settingsFailure(async () => {
      throw new Error("getter failed");
    });
    expect(second.state.global).toEqual({ status: "error", reason: "settings-reader-failed" });
    expect(second.state.modules.compaction).toEqual({ status: "disabled", reason: "settings-reader-failed" });

    AbortSignal.timeout(300_000);
    expect(calls).toEqual([900_000, 300_000]);
    expect(first.state.modules.compaction).toEqual({ status: "incompatible", reason: "runtime-conflict" });
    expect(second.harness.warnings.filter((warning) => warning.includes("has no usable settings"))).toHaveLength(1);
  });

  test("stops the installed patch when the settings root is not an object", async () => {
    const first = await activated({ compactionTimeoutEnabled: true });
    const calls = await openWindowAndWatch(first.harness);

    // A getter that returns something other than an object breaks the type its
    // own signature promises, which is the host fault under test here.
    const second = await settingsFailure(async () => "not a settings object" as unknown as Record<string, unknown>);
    expect(second.state.global).toEqual({ status: "error", reason: "settings-root-invalid" });
    expect(second.state.problems).toEqual([{ module: "global", key: "settings", rule: "root" }]);

    AbortSignal.timeout(300_000);
    expect(calls).toEqual([300_000]);
    expect(first.state.modules.compaction).toEqual({ status: "incompatible", reason: "runtime-conflict" });
  });

  test("stops the installed patch when the settings hold an unknown key", async () => {
    const first = await activated({ compactionTimeoutEnabled: true });
    const calls = await openWindowAndWatch(first.harness);

    const second = await settingsFailure(async () => ({ enabled: true, unknownKey: 1 }));
    expect(second.state.global).toEqual({ status: "error", reason: "settings-rejected" });
    expect(second.state.problems).toEqual([{ module: "global", key: "unknownKey", rule: "unknown-key" }]);

    AbortSignal.timeout(300_000);
    expect(calls).toEqual([300_000]);
    expect(first.state.modules.compaction).toEqual({ status: "incompatible", reason: "runtime-conflict" });
  });

  test("stops the installed patch when the master switch itself is invalid", async () => {
    const first = await activated({ compactionTimeoutEnabled: true });
    const calls = await openWindowAndWatch(first.harness);

    const second = await settingsFailure(async () => ({ enabled: "invalid" }));
    expect(second.state.global).toEqual({ status: "error", reason: "settings-rejected" });
    expect(second.state.problems).toEqual([{ module: "global", key: "enabled", rule: "type" }]);

    AbortSignal.timeout(300_000);
    expect(calls).toEqual([300_000]);
    expect(first.state.modules.compaction).toEqual({ status: "incompatible", reason: "runtime-conflict" });
  });

  test("installs nothing when the settings are unusable", async () => {
    await activated({ compactionTimeoutEnabled: true });
    const second = await settingsFailure(async () => ({ enabled: "invalid" }));

    // No module is turned on with a default value to make the check possible.
    expect(second.harness.tools).toEqual([]);
    for (const eventType of ["session_stop", "agent_start", "session_shutdown", "session_switch"]) {
      expect(second.harness.handlers.get(eventType)).toBeUndefined();
    }
    expect(second.state.modules.wait).toEqual({ status: "disabled", reason: "settings-rejected" });
    expect(second.state.modules.recovery).toEqual({ status: "disabled", reason: "settings-rejected" });
  });
});
