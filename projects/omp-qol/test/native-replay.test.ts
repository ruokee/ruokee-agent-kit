/**
 * Native-replay module tests.
 *
 * The module wraps the process-global `Map.prototype.set`, so every test injects
 * the prototype accessors and records what the installer installs; the real
 * prototype is never replaced, and the wrapper registry slot is cleared after
 * each test the way a fresh process has it. The map the wrapper forwards into is
 * a real `Map`, so a forwarded write is observable the way the host would see it.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { PACKAGE_VERSION, type ModuleContext, type ModuleOffReason, type ModuleState } from "../src/extension.ts";
import {
  createNativeReplayInstaller,
  nativeReplayPatchRegistry,
  nativeReplayStatusFromRegistry,
  NATIVE_REPLAY_REGISTRY_SCHEMA,
  stopForeignNativeReplayPatch,
  type NativeReplayDeps,
  type NativeReplayRegistry,
} from "../src/native-replay.ts";
import { parseQolSettings, type ModuleId, type QolSettings } from "../src/settings.ts";
import { createHarness, moduleContext, resetNativeReplay, TEST_RUNTIME_ID, type Harness } from "./host.ts";

const REGISTRY_KEY = Symbol.for("ruokee.omp-qol.native-replay.registry");
const STATE_KEY = "openai-responses:pro-20x";

type MapSet = (this: Map<unknown, unknown>, key: unknown, value: unknown) => Map<unknown, unknown>;

const NATIVE_SET = Map.prototype.set as unknown as MapSet;

function globalSlots(): Record<symbol, unknown> {
  return globalThis as unknown as Record<symbol, unknown>;
}

/** A provider session state the host builds before its first request. */
function responsesState(): Record<string, unknown> {
  return { nativeHistoryReplayWarmed: false };
}

function qolSettings(overrides: Record<string, unknown> = {}): QolSettings {
  const parsed = parseQolSettings(overrides);
  if (parsed.kind !== "loaded") throw new Error("expected loaded settings");
  return parsed.settings;
}

/** The prototype slot a test owns, standing in for `Map.prototype.set`. */
interface PrototypeSlot {
  deps: NativeReplayDeps;
  /** The function standing in for the process's own `set`. */
  native: MapSet;
  /** The function currently installed on the prototype. */
  current: () => MapSet;
  /** Install a function the way another extension would, without this module. */
  replace: (set: MapSet) => void;
  /** Keys the installed function forwarded to the replaced one. */
  forwarded: unknown[];
  /** How often the installer wrote the prototype. */
  installs: () => number;
  /** Enter one state through the installed function, as the host does. */
  store: (map: Map<unknown, unknown>, key: unknown, value: unknown) => Map<unknown, unknown>;
}

/**
 * A prototype slot, with the registry slot cleared the way a fresh process has
 * it. The installed function is reached through `store`, which resolves the
 * prototype at call time the way `map.set(...)` resolves it in the host.
 */
function prototypeSlot(): PrototypeSlot {
  globalSlots()[REGISTRY_KEY] = undefined;
  const forwarded: unknown[] = [];
  const native: MapSet = function recordedSet(this: Map<unknown, unknown>, key: unknown, value: unknown) {
    forwarded.push(key);
    return NATIVE_SET.call(this, key, value);
  };
  let current: MapSet = native;
  let installs = 0;
  return {
    deps: {
      currentSet: () => current,
      install: (set) => {
        current = set;
        installs += 1;
      },
    },
    native,
    current: () => current,
    replace: (set) => {
      current = set;
    },
    forwarded,
    installs: () => installs,
    store: (map, key, value) => current.call(map, key, value),
  };
}

interface InstallOptions {
  raw?: Record<string, unknown>;
  off?: ModuleOffReason;
  runtimeId?: string;
  cwd?: string;
}

interface Attempt {
  state: ModuleState;
  reports: string[];
  statuses: Array<{ id: ModuleId; status: ModuleState }>;
  harness: Harness;
}

/** Run one activation's install attempt against one prototype slot. */
function attempt(slot: PrototypeSlot, options: InstallOptions = {}): Attempt {
  const harness = createHarness();
  const reports: string[] = [];
  const statuses: Array<{ id: ModuleId; status: ModuleState }> = [];
  const context: ModuleContext = moduleContext({
    pi: harness.pi,
    ctx: harness.context({ cwd: options.cwd ?? "/tmp/omp-qol-project" }),
    settings: qolSettings(options.raw ?? {}),
    runtimeId: options.runtimeId,
    off: options.off,
    report: (key, message) => reports.push(`${key}: ${message}`),
    setStatus: (id, status) => statuses.push({ id, status }),
  });
  return { state: createNativeReplayInstaller(slot.deps)(context), reports, statuses, harness };
}

/** Install the shipped wrapper, then require the registry it published. */
function installWrapper(slot: PrototypeSlot, options: InstallOptions = {}): NativeReplayRegistry {
  const setup = attempt(slot, options);
  const registry = nativeReplayPatchRegistry();
  if (registry === undefined) throw new Error(`expected a wrapper registry, got ${JSON.stringify(setup.state)}`);
  return registry;
}

afterEach(resetNativeReplay);

describe("replay wrapper installation", () => {
  test("leaves the prototype alone while the module is off", () => {
    const slot = prototypeSlot();
    const setup = attempt(slot, { raw: { replayEnabled: false } });

    expect(setup.state).toEqual({ status: "disabled", reason: "replay-disabled" });
    expect(slot.current()).toBe(slot.native);
    expect(slot.installs()).toBe(0);
    expect(nativeReplayPatchRegistry()).toBeUndefined();
    expect(setup.reports).toEqual([]);
  });

  test("installs one wrapper and records the function it replaced", () => {
    const slot = prototypeSlot();
    const published = installWrapper(slot);
    const registry = nativeReplayPatchRegistry();

    expect(attempt(slot).state).toEqual({ status: "enabled", detail: "rewrites=0" });
    expect(registry?.schema).toBe(NATIVE_REPLAY_REGISTRY_SCHEMA);
    expect(registry?.runtimeId).toBe(TEST_RUNTIME_ID);
    expect(registry?.packageVersion).toBe(PACKAGE_VERSION);
    expect(registry?.cwd).toBe("/tmp/omp-qol-project");
    expect(registry?.original).toBe(slot.native);
    expect(slot.current()).toBe(published.wrapper);
    expect(slot.current()).not.toBe(slot.native);
    expect(slot.installs()).toBe(1);
  });

  test("gives the wrapper up when the runtime does not take it", () => {
    const slot = prototypeSlot();
    const refused: PrototypeSlot = { ...slot, deps: { currentSet: slot.deps.currentSet, install: () => undefined } };
    const setup = attempt(refused);

    expect(setup.state).toEqual({ status: "incompatible", reason: "install-failed" });
    expect(slot.current()).toBe(slot.native);
    expect(nativeReplayPatchRegistry()).toBeUndefined();
    expect(setup.reports.join("\n")).toContain("replay:install-failed");
  });
});

describe("replay wrapper behavior", () => {
  test("flags the host's own state write and forwards it", () => {
    const slot = prototypeSlot();
    const registry = installWrapper(slot);
    const map = new Map<unknown, unknown>();
    const state = responsesState();

    expect(slot.store(map, STATE_KEY, state)).toBe(map);
    expect(map.get(STATE_KEY)).toBe(state);
    expect(state.nativeHistoryReplayWarmed).toBe(true);
    expect(slot.forwarded).toEqual([STATE_KEY]);
    expect(nativeReplayPatchRegistry()?.rewrites).toBe(1);

    const second = responsesState();
    slot.store(map, "openai-responses:other", second);
    expect(second.nativeHistoryReplayWarmed).toBe(true);
    expect(nativeReplayPatchRegistry()?.rewrites).toBe(2);

    // A state the host already decided stays as it is.
    const warm = { nativeHistoryReplayWarmed: true };
    slot.store(map, STATE_KEY, warm);
    expect(warm.nativeHistoryReplayWarmed).toBe(true);
    expect(nativeReplayPatchRegistry()?.rewrites).toBe(2);
    expect(registry.rewrites).toBe(2);
  });

  test("forwards every other write unchanged", () => {
    const slot = prototypeSlot();
    installWrapper(slot);
    const map = new Map<unknown, unknown>();
    const symbolKey = Symbol("key");
    const others: Array<[unknown, unknown]> = [
      ["openai-codex-responses:pro-20x", responsesState()],
      ["anthropic-messages:claude", responsesState()],
      ["openai-completions:local", responsesState()],
      [7, responsesState()],
      [symbolKey, responsesState()],
    ];

    for (const [key, value] of others) slot.store(map, key, value);
    for (const [key, value] of others) expect(map.get(key)).toBe(value);

    // Values under the host's own key that are not an unwarmed state pass through.
    const shapes: unknown[] = [
      undefined,
      null,
      "state",
      [responsesState()],
      {},
      { nativeHistoryReplayWarmed: true },
      { nativeHistoryReplayWarmed: "false" },
    ];
    for (const value of shapes) {
      slot.store(map, STATE_KEY, value);
      expect(map.get(STATE_KEY)).toBe(value);
    }

    expect(nativeReplayPatchRegistry()?.rewrites).toBe(0);
    expect(slot.forwarded).toHaveLength(others.length + shapes.length);
    // A state written under another provider's key keeps its own decision.
    expect((others[0]?.[1] as Record<string, unknown>).nativeHistoryReplayWarmed).toBe(false);
  });

  test("stops rewriting when the wrapper is released but stays callable", () => {
    const slot = prototypeSlot();
    const registry = installWrapper(slot);
    const wrapper = registry.wrapper;
    const map = new Map<unknown, unknown>();

    attempt(slot, { raw: { replayEnabled: false } });
    expect(registry.disabledReason).toBe("replay-disabled");

    const state = responsesState();
    wrapper.call(map, STATE_KEY, state);

    expect(state.nativeHistoryReplayWarmed).toBe(false);
    expect(registry.rewrites).toBe(0);
    expect(map.get(STATE_KEY)).toBe(state);
  });
});

describe("replay wrapper ownership", () => {
  test("keeps one wrapper for a second activation of the same process", () => {
    const slot = prototypeSlot();
    const registry = installWrapper(slot);
    const map = new Map<unknown, unknown>();
    slot.store(map, STATE_KEY, responsesState());

    const second = attempt(slot, { runtimeId: "another-activation" });

    expect(second.state).toEqual({ status: "enabled", detail: "rewrites=1" });
    expect(slot.current()).toBe(registry.wrapper);
    expect(slot.installs()).toBe(1);
    expect(second.reports).toEqual([]);
  });

  test("releases the wrapper when a later activation's own switch is off", () => {
    const slot = prototypeSlot();
    const registry = installWrapper(slot);

    const second = attempt(slot, { raw: { replayEnabled: false }, runtimeId: "another-activation" });

    expect(second.state).toEqual({ status: "disabled", reason: "replay-disabled" });
    expect(slot.current()).toBe(registry.original);
    expect(registry.disabledReason).toBe("replay-disabled");
    expect(second.reports).toEqual([]);

    const state = responsesState();
    slot.store(new Map<unknown, unknown>(), STATE_KEY, state);
    expect(state.nativeHistoryReplayWarmed).toBe(false);
  });

  test("releases the wrapper for the master switch and for invalid settings", () => {
    const masterOff = prototypeSlot();
    const masterRegistry = installWrapper(masterOff);
    expect(attempt(masterOff, { off: "master-disabled" }).state).toEqual({
      status: "disabled",
      reason: "master-disabled",
    });
    expect(masterOff.current()).toBe(masterRegistry.original);

    const invalid = prototypeSlot();
    const invalidRegistry = installWrapper(invalid);
    expect(attempt(invalid, { off: "settings-invalid" }).state).toEqual({
      status: "invalid",
      reason: "settings-invalid",
    });
    expect(invalid.current()).toBe(invalidRegistry.original);
  });

  test("stops a wrapper another activation left when this activation has no settings", () => {
    const slot = prototypeSlot();
    const registry = installWrapper(slot);
    const statuses: ModuleState[] = [];
    registry.report = (reason) => statuses.push({ status: "incompatible", reason });

    const stopped = stopForeignNativeReplayPatch("another-activation", slot.deps);

    expect(stopped).toBe(registry);
    expect(slot.current()).toBe(registry.original);
    expect(registry.disabledReason).toBe("runtime-conflict");
    expect(statuses).toEqual([{ status: "incompatible", reason: "runtime-conflict" }]);
  });

  test("leaves the wrapper of its own runtime in place", () => {
    const slot = prototypeSlot();
    const registry = installWrapper(slot);

    expect(stopForeignNativeReplayPatch(TEST_RUNTIME_ID, slot.deps)).toBeUndefined();
    expect(slot.current()).toBe(registry.wrapper);
    expect(registry.disabledReason).toBeUndefined();
  });

  test("refuses a registry this version does not know", () => {
    const slot = prototypeSlot();
    globalSlots()[REGISTRY_KEY] = { schema: 99, runtimeId: "foreign", packageVersion: "0.1.0" };

    const setup = attempt(slot);

    expect(setup.state).toEqual({ status: "incompatible", reason: "registry-unrecognized" });
    expect(slot.current()).toBe(slot.native);
    expect(slot.installs()).toBe(0);
    expect(setup.reports.join("\n")).toContain("replay:registry-unrecognized");
  });

  test("reports a function another extension replaced instead of installing again", () => {
    const slot = prototypeSlot();
    const registry = installWrapper(slot);
    const foreign: MapSet = function foreignSet(this: Map<unknown, unknown>, key: unknown, value: unknown) {
      return NATIVE_SET.call(this, key, value);
    };
    slot.replace(foreign);

    const setup = attempt(slot, { runtimeId: "another-activation" });

    expect(setup.state).toEqual({ status: "incompatible", reason: "patch-overwritten" });
    expect(slot.current()).toBe(foreign);
    expect(slot.installs()).toBe(1);
    expect(registry.disabledReason).toBe("patch-overwritten");
    expect(setup.reports.join("\n")).toContain("replay:patch-overwritten");
  });
});

describe("replay status for /qol", () => {
  test("reports an installed wrapper as enabled with its rewrite count", () => {
    const slot = prototypeSlot();
    installWrapper(slot);
    const map = new Map<unknown, unknown>();
    slot.store(map, STATE_KEY, responsesState());
    slot.store(map, STATE_KEY, responsesState());

    expect(nativeReplayStatusFromRegistry({ status: "pending" }, slot.deps)).toEqual({
      status: "enabled",
      detail: "rewrites=2",
    });
  });

  test("keeps the recorded state when no wrapper of this version exists", () => {
    const slot = prototypeSlot();
    expect(nativeReplayStatusFromRegistry({ status: "disabled", reason: "replay-disabled" }, slot.deps)).toEqual({
      status: "disabled",
      reason: "replay-disabled",
    });

    globalSlots()[REGISTRY_KEY] = { schema: 99, runtimeId: "foreign", packageVersion: "0.1.0" };
    expect(nativeReplayStatusFromRegistry({ status: "enabled" }, slot.deps)).toEqual({ status: "enabled" });
  });

  test("reports the reason a stopped wrapper gives", () => {
    const slot = prototypeSlot();
    installWrapper(slot);
    stopForeignNativeReplayPatch("another-activation", slot.deps);

    expect(nativeReplayStatusFromRegistry({ status: "enabled" }, slot.deps)).toEqual({
      status: "incompatible",
      reason: "runtime-conflict",
    });
  });

  test("reports a wrapper that is no longer installed as overwritten", () => {
    const slot = prototypeSlot();
    installWrapper(slot);
    slot.replace(slot.native);

    expect(nativeReplayStatusFromRegistry({ status: "enabled" }, slot.deps)).toEqual({
      status: "incompatible",
      reason: "patch-overwritten",
    });
  });
});
