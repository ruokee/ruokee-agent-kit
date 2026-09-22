/**
 * Native-history replay module.
 *
 * OMP 18.2.8 answers "replay the provider items this session carries, or
 * re-encode the conversation locally" from one flag on the provider session
 * state of an `openai-responses` provider:
 * `packages/ai/src/providers/openai-responses.ts:1194` reads
 * `providerSessionState?.nativeHistoryReplayWarmed ?? true`. The state is built
 * with the flag false (`:237`), turns it true only after a successful request
 * that produced replayable items (`:899`), and lives in a map the session owns
 * (`packages/coding-agent/src/session/agent-session.ts:873`). Every new
 * process therefore sends its first request in the local re-encode form, while
 * the process that wrote the session ended with replayed native items: the two
 * forms differ from the first re-encoded item on, so a prompt cache over the
 * whole prompt cannot serve that first request.
 *
 * This module decides the flag as the host creates the state. It wraps the
 * `Map.prototype.set` the host stores that state with, recognizes the host's own
 * write by the state key prefix (`:168`, `:256`) and by the
 * flag on the value, and forwards every other call to the function it replaced,
 * including invalid input.
 *
 * One wrapper serves the process. Its effect does not depend on the session that
 * created a state, so a later activation keeps it and reports the module as
 * enabled instead of owning a second copy, and the wrapper stays installed when
 * the installing activation's session ends. It comes back out when an
 * activation's effective settings keep the module off, or when an activation
 * has no usable settings at all. A function that another extension replaced
 * under the wrapper is reported as `patch-overwritten` rather than installed a
 * second time.
 */

import { PACKAGE_VERSION, type ModuleContext, type ModuleState } from "./extension.ts";
import type { ReplaySettings } from "./settings.ts";

/** Component-owned slot holding the process-global wrapper registry. */
const REGISTRY_KEY = Symbol.for("ruokee.omp-qol.native-replay.registry");

/** Registry layout this component understands. */
export const NATIVE_REPLAY_REGISTRY_SCHEMA = 1;

/**
 * Provider session state keys the host writes for an `openai-responses`
 * provider. `packages/ai/src/providers/openai-responses.ts:256` builds the key
 * as this prefix plus the provider name, so the prefix is what identifies the
 * host's own write.
 */
export const RESPONSES_STATE_KEY_PREFIX = "openai-responses:";

/** Flag the host reads to choose between replaying native items and re-encoding. */
export const RESPONSES_REPLAY_FLAG = "nativeHistoryReplayWarmed";

/** The map write this module wraps. */
type MapSet = (this: Map<unknown, unknown>, key: unknown, value: unknown) => Map<unknown, unknown>;

/** Process-global state of the one installed wrapper. */
export interface NativeReplayRegistry {
  schema: number;
  /** Activation that installed the wrapper, for conflict diagnostics. */
  runtimeId: string;
  /** Package version that installed it, for conflict diagnostics. */
  packageVersion: string;
  /** Activation cwd, for conflict diagnostics. */
  cwd: string;
  /** Function replaced by this module. */
  original: MapSet;
  /** Function this module installed. */
  wrapper: MapSet;
  /** State writes the wrapper has rewritten, the local sign that the host shape still matches. */
  rewrites: number;
  /** Set once this module released the function; the reason stays for `/qol`. */
  disabledReason: string | undefined;
  report: (reason: string) => void;
}

/** `globalThis` seen as a symbol-keyed slot bag. */
type GlobalSlots = typeof globalThis & { [key: symbol]: unknown };

function slots(): GlobalSlots {
  return globalThis as GlobalSlots;
}

function isRegistry(value: unknown): value is NativeReplayRegistry {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<NativeReplayRegistry>;
  return (
    typeof candidate.schema === "number" &&
    typeof candidate.runtimeId === "string" &&
    typeof candidate.packageVersion === "string" &&
    typeof candidate.original === "function" &&
    typeof candidate.wrapper === "function" &&
    typeof candidate.rewrites === "number" &&
    typeof candidate.report === "function"
  );
}

/**
 * The installed wrapper, only when its registry layout is the one this version
 * writes. A slot that merely has the expected fields says nothing about how its
 * owner treats the host's writes, so no caller may describe it as this version's
 * wrapper; a caller with its own refusal keeps that refusal instead.
 */
function recognizedRegistry(): NativeReplayRegistry | undefined {
  const slot = slots()[REGISTRY_KEY];
  return isRegistry(slot) ? slot : undefined;
}

/** Whether one state write is the host storing an `openai-responses` state. */
function isWarmableState(key: unknown, value: unknown): boolean {
  if (typeof key !== "string" || !key.startsWith(RESPONSES_STATE_KEY_PREFIX)) return false;
  if (typeof value !== "object" || value === null) return false;
  return (value as Record<string, unknown>)[RESPONSES_REPLAY_FLAG] === false;
}

/**
 * Stop rewriting through one registry and put the replaced function back.
 *
 * The replaced function only comes back while the installed one is still this
 * module's own wrapper: a function another extension put in place is never
 * overwritten from here.
 */
function releaseWrapper(registry: NativeReplayRegistry, reason: string, deps: NativeReplayDeps): void {
  if (registry.disabledReason !== undefined) return;
  registry.disabledReason = reason;
  if (deps.currentSet() === registry.wrapper) deps.install(registry.original);
}

/** Release because this process holds a wrapper whose settings no longer apply. */
function disableWrapper(registry: NativeReplayRegistry, reason: string, deps: NativeReplayDeps): void {
  if (registry.disabledReason !== undefined) return;
  releaseWrapper(registry, reason, deps);
  registry.report(reason);
}

/** Replacement installed on `Map.prototype.set` while this module owns it. */
function createWrapper(readRegistry: () => NativeReplayRegistry): MapSet {
  return function nativeReplaySet(this: Map<unknown, unknown>, key: unknown, value: unknown): Map<unknown, unknown> {
    const registry = readRegistry();
    if (registry.disabledReason === undefined && isWarmableState(key, value)) {
      (value as Record<string, unknown>)[RESPONSES_REPLAY_FLAG] = true;
      registry.rewrites += 1;
    }
    return registry.original.call(this, key, value);
  };
}

/** Seams a host-free test replaces; the shipped installer uses the live global. */
export interface NativeReplayDeps {
  /** The function currently installed on `Map.prototype`. */
  currentSet: () => MapSet;
  /** Put a function on `Map.prototype`. */
  install: (set: MapSet) => void;
}

const REAL_DEPS: NativeReplayDeps = {
  currentSet: () => Map.prototype.set as unknown as MapSet,
  install: (set) => {
    Map.prototype.set = set as unknown as typeof Map.prototype.set;
  },
};

/** The process's wrapper registry, when this version wrote it. */
export function nativeReplayPatchRegistry(): NativeReplayRegistry | undefined {
  return recognizedRegistry();
}

/** Build the module installer; tests inject the prototype accessors. */
export function createNativeReplayInstaller(deps: NativeReplayDeps = REAL_DEPS) {
  return function installNativeReplayModule(context: ModuleContext): ModuleState {
    const settings: ReplaySettings = context.settings.replay;
    const cwd = typeof context.ctx.cwd === "string" ? context.ctx.cwd : "";
    const refuse = (reason: string, message: string): ModuleState => {
      context.report(`replay:${reason}`, `native replay stays inactive: ${message}`);
      return { status: "incompatible", reason };
    };
    /** State of an activation that must not install: switches, not conflicts. */
    const inactiveState = (): ModuleState => {
      if (context.off === "master-disabled") return { status: "disabled", reason: "master-disabled" };
      if (context.off === "settings-invalid") return { status: "invalid", reason: "settings-invalid" };
      return { status: "disabled", reason: "replay-disabled" };
    };

    const slot = slots()[REGISTRY_KEY];
    const existing = recognizedRegistry();
    if (slot !== undefined && existing === undefined) {
      // Somebody wrote this slot in a layout this version does not know; it is
      // never taken over, and no second wrapper is stacked on top of it.
      return refuse("registry-unrecognized", "the process wrapper registry was not written by this version");
    }

    if (existing !== undefined) {
      if (existing.disabledReason !== undefined) {
        if (context.off !== undefined) return inactiveState();
        return refuse(existing.disabledReason, "the wrapper stopped rewriting earlier in this process");
      }
      if (deps.currentSet() !== existing.wrapper) {
        // Another extension put its own function in place. The wrapper that is
        // gone is not reinstalled over it, and the reason stays for `/qol`.
        disableWrapper(existing, "patch-overwritten", deps);
        if (context.off !== undefined) return inactiveState();
        return refuse("patch-overwritten", "another extension replaced Map.prototype.set");
      }
      if (context.off !== undefined || !settings.enabled) {
        // This activation's own switches ask for the adjustment off: release the
        // wrapper without reporting a conflict.
        const state = inactiveState();
        releaseWrapper(existing, state.reason ?? "replay-disabled", deps);
        return state;
      }
      // One wrapper serves the process, and it does not depend on the session
      // that created a state: this activation keeps it instead of owning one.
      return { status: "enabled", detail: `rewrites=${existing.rewrites}` };
    }

    if (context.off !== undefined || !settings.enabled) return inactiveState();

    let registry: NativeReplayRegistry;
    const wrapper = createWrapper(() => registry);
    registry = {
      schema: NATIVE_REPLAY_REGISTRY_SCHEMA,
      runtimeId: context.runtimeId,
      packageVersion: PACKAGE_VERSION,
      cwd,
      original: deps.currentSet(),
      wrapper,
      rewrites: 0,
      disabledReason: undefined,
      report: (reason) => {
        context.report(`replay:${reason}`, `native replay stopped rewriting: ${reason}`);
        context.setStatus?.("replay", { status: "incompatible", reason });
      },
    };
    deps.install(wrapper);

    if (deps.currentSet() !== wrapper) {
      // The runtime did not take the wrapper, so no write can reach it. The
      // registry is not published either: the module reports that it is inactive
      // instead of leaving a wrapper other activations would describe as owned.
      return refuse("install-failed", "this runtime did not accept the wrapper on Map.prototype.set");
    }
    slots()[REGISTRY_KEY] = registry;

    return { status: "enabled", detail: `rewrites=${registry.rewrites}` };
  };
}

export const installNativeReplayModule = createNativeReplayInstaller();

/**
 * Replay state `/qol` reports when the command runs.
 *
 * A wrapper this version installed and can read decides the line, not the result
 * one activation recorded: a wrapper that stopped later in the process and a
 * function another extension replaced both show up here. Without such a wrapper
 * the recorded state stands, so an activation that installed nothing or refused
 * a foreign layout still explains itself.
 *
 * The wrapper serves every session of the process, so unlike the compaction
 * patch there is no owner to report: an installed wrapper is enabled for the
 * activation that reads it.
 */
export function nativeReplayStatusFromRegistry(recorded: ModuleState, deps: NativeReplayDeps = REAL_DEPS): ModuleState {
  const registry = recognizedRegistry();
  if (registry === undefined) return recorded;
  if (registry.disabledReason !== undefined) return { status: "incompatible", reason: registry.disabledReason };
  if (deps.currentSet() !== registry.wrapper) return { status: "incompatible", reason: "patch-overwritten" };
  return { status: "enabled", detail: `rewrites=${registry.rewrites}` };
}

/**
 * Stop the process wrapper another activation of this extension installed.
 *
 * An activation whose settings could not be read, or were rejected, installs
 * nothing and enables nothing, so it never owns the wrapper. It still must not
 * leave a wrapper from an earlier activation rewriting the host's writes under a
 * configuration it cannot account for. A registry this version cannot read is
 * never taken over and stays as it is.
 *
 * Returns the wrapper it stopped, for the caller's diagnostic.
 */
export function stopForeignNativeReplayPatch(
  runtimeId: string,
  deps: NativeReplayDeps = REAL_DEPS,
): NativeReplayRegistry | undefined {
  const registry = recognizedRegistry();
  if (registry === undefined || registry.runtimeId === runtimeId) return undefined;
  disableWrapper(registry, "runtime-conflict", deps);
  return registry;
}
