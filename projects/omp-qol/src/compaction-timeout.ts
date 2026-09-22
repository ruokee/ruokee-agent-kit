/**
 * Experimental compaction-deadline module.
 *
 * OMP 18.2.8 creates the deadline of one compaction request through a global
 * call, `AbortSignal.timeout(300_000)`. Two constants carry that value:
 * `packages/agent/src/compaction/compaction-v2-streaming.ts:48` for the
 * streaming path and `packages/agent/src/compaction/openai.ts:74` for the
 * remote path, and each passes it to `AbortSignal.timeout` at its own call site
 * (`:254` and `:239`). While a compaction window is open, this module replaces
 * that global function so one compaction request may run longer than the
 * built-in five minutes. The native compaction protocol, results, retries,
 * fallbacks, and cancellation stay in place; only the deadline number changes.
 *
 * One activation owns the process patch. A later activation that asks for the
 * same package version and the same settings keeps it and reports
 * `patch-owned-elsewhere`; it registers no window events, so the window stays
 * with the activation that installed it. A second activation that contradicts
 * those settings stops the patch instead. When the owning activation's session
 * ends, the patch is released and the registry keeps an `owner-stopped`
 * terminal state that no later activation installs over; the adjustment returns
 * with a restarted OMP. An activation whose window registrations the runtime
 * refuses gives the patch up the same way: the native function comes back and
 * the refusal is what later activations and `/qol` report.
 *
 * The rewrite is a process-level numeric match, not a request-level hook. While
 * a window is open, any other call whose deadline falls in
 * `[floorMs, timeoutMs)` is extended too — a tool or transport timeout that
 * happens to use the same value included. That is why the module ships
 * disabled by default; `docs/adjustments.md` states the limitation for users.
 */

import type {
  AutoCompactionStartEvent,
  SessionBeforeCompactEvent,
  SessionCompactingEvent,
} from "@oh-my-pi/pi-coding-agent";
import { PACKAGE_NAME, PACKAGE_VERSION, type ModuleContext, type ModuleState } from "./extension.ts";
import type { CompactionSettings } from "./settings.ts";

/** Component-owned slot holding the process-global patch registry. */
const REGISTRY_KEY = Symbol.for("ruokee.omp-qol.compaction-timeout.registry");

/** Marker of a known earlier compaction patch this module refuses to share a process with. */
const LEGACY_PATCH_KEY = Symbol.for("ruokee.omp.compaction-timeout.patched");

/** Registry layout this component understands. */
export const COMPACTION_REGISTRY_SCHEMA = 2;

/**
 * Request deadline the inspected OMP compaction paths pass to
 * `AbortSignal.timeout`. A floor above it stops the compaction request itself
 * from matching the rewrite range, which `/qol` states.
 */
export const NATIVE_COMPACTION_TIMEOUT_MS = 300_000;

type TimeoutFn = (milliseconds: number) => AbortSignal;

/** How a compaction window was opened. */
type WindowKind = "auto" | "manual" | "compacting";

/** One open compaction window. */
interface CompactionWindow {
  kind: WindowKind;
  /** Also guards against a guard timer that fires after its window is gone. */
  generation: number;
  /** Session that owns the window, when a source reports one. */
  sessionId: string | undefined;
  /** Wall-clock deadline of the window's guard lease. */
  guardDeadline: number;
  /** One notice per window. */
  notified: boolean;
  /**
   * The live `session_before_compact` signal this window is bound to. The host
   * re-emits that event on the same controller when one compaction method fails
   * and the next one runs, so the signal object identifies one operation.
   */
  signal: AbortSignal | undefined;
}

/** Process-global state of the one installed patch. */
export interface CompactionPatchRegistry {
  schema: number;
  /** Activation that installed the patch; only its events open windows. */
  runtimeId: string;
  /** Package version that installed it, for conflict diagnostics. */
  packageVersion: string;
  /** Activation cwd, for conflict diagnostics. */
  cwd: string;
  /** Function replaced by this module. */
  original: TimeoutFn;
  /** Function this module installed. */
  wrapper: TimeoutFn;
  /** Settings snapshot the installed patch was built from. */
  settings: CompactionSettings;
  window: CompactionWindow | undefined;
  /**
   * Set once this module stopped rewriting, including the `owner-stopped`
   * terminal state the owner leaves behind; the reason stays for `/qol`.
   */
  disabledReason: string | undefined;
  /** Releases the guard timer and the window's abort listener. */
  cleanup: (() => void) | undefined;
  now: () => number;
  notify: (message: string) => void;
  report: (reason: string) => void;
}

/** `globalThis` seen as a symbol-keyed slot bag. */
type GlobalSlots = typeof globalThis & { [key: symbol]: unknown };

function slots(): GlobalSlots {
  return globalThis as GlobalSlots;
}

function isRegistry(value: unknown): value is CompactionPatchRegistry {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<CompactionPatchRegistry>;
  return (
    typeof candidate.schema === "number" &&
    typeof candidate.runtimeId === "string" &&
    typeof candidate.packageVersion === "string" &&
    typeof candidate.original === "function" &&
    typeof candidate.wrapper === "function" &&
    typeof candidate.now === "function"
  );
}

/** Whether one activation installed the patch with exactly these settings. */
function sameCompactionSettings(left: CompactionSettings, right: CompactionSettings): boolean {
  return (
    left.enabled === right.enabled &&
    left.timeoutMs === right.timeoutMs &&
    left.floorMs === right.floorMs &&
    left.guardMs === right.guardMs &&
    left.notify === right.notify
  );
}

/**
 * Whether an activation that did not install the patch may keep it.
 *
 * The adjustment it asks for must be the installed one: the master switch and
 * this module's switches usable, the same package version, the same settings
 * snapshot, and a patch that is still this module's own and rewriting. The
 * recorded cwd stays diagnostic, because a subagent may run in another
 * directory under the same settings.
 */
function keepsInstalledPatch(
  context: ModuleContext,
  settings: CompactionSettings,
  existing: CompactionPatchRegistry,
): boolean {
  return (
    context.off === undefined &&
    settings.enabled &&
    existing.packageVersion === PACKAGE_VERSION &&
    existing.disabledReason === undefined &&
    currentTimeout() === existing.wrapper &&
    sameCompactionSettings(existing.settings, settings)
  );
}

/** The installed patch, or undefined when this process has none. */
export function compactionPatchRegistry(): CompactionPatchRegistry | undefined {
  const value = slots()[REGISTRY_KEY];
  return isRegistry(value) ? value : undefined;
}

/**
 * The installed patch, only when its registry layout is the one this version
 * writes.
 *
 * Recognition stops at the same boundary as the install path. A slot that
 * merely has the expected fields says nothing about how its owner treats
 * windows, deadlines, or settings, so no caller may describe it as this
 * version's patch; a caller with its own refusal keeps that refusal instead.
 */
function recognizedRegistry(): CompactionPatchRegistry | undefined {
  const registry = compactionPatchRegistry();
  return registry !== undefined && registry.schema === COMPACTION_REGISTRY_SCHEMA ? registry : undefined;
}

function currentTimeout(): TimeoutFn {
  return AbortSignal.timeout;
}

function legacyPatchPresent(): boolean {
  return slots()[LEGACY_PATCH_KEY] !== undefined;
}

/** Whether one deadline falls in the rewrite range. */
function inRewriteRange(milliseconds: unknown, settings: CompactionSettings): milliseconds is number {
  return (
    typeof milliseconds === "number" &&
    Number.isFinite(milliseconds) &&
    milliseconds >= settings.floorMs &&
    milliseconds < settings.timeoutMs
  );
}

/** Release the guard timer and listener of the open window. */
function closeWindow(registry: CompactionPatchRegistry): void {
  const cleanup = registry.cleanup;
  registry.window = undefined;
  registry.cleanup = undefined;
  cleanup?.();
}

/** The open window, or undefined once its guard lease has run out. */
function liveWindow(registry: CompactionPatchRegistry): CompactionWindow | undefined {
  const window = registry.window;
  if (window === undefined) return undefined;
  if (registry.now() >= window.guardDeadline) {
    closeWindow(registry);
    return undefined;
  }
  return window;
}

/** Stop rewriting and restore the original, without reporting a conflict. */
function releasePatch(registry: CompactionPatchRegistry, reason: string): void {
  if (registry.disabledReason !== undefined) return;
  closeWindow(registry);
  registry.disabledReason = reason;
  if (currentTimeout() === registry.wrapper) AbortSignal.timeout = registry.original;
}

/**
 * Stop rewriting because this process holds a conflicting compaction state.
 *
 * The installed patch belongs to another activation or to a settings snapshot
 * that no longer applies, so it stops and reports; its wrapper is only restored
 * while the installed function is still this module's own.
 */
function disablePatch(registry: CompactionPatchRegistry, reason: string): void {
  if (registry.disabledReason !== undefined) return;
  releasePatch(registry, reason);
  registry.report(reason);
}

/**
 * Stop the process patch a second activation of this extension installed.
 *
 * An activation whose settings could not be read, or were rejected, installs
 * nothing and enables nothing, so it never becomes the owner of the process
 * patch. It still must not leave a patch from an earlier activation rewriting
 * deadlines under a configuration it cannot account for. A registry this
 * version cannot read is never taken over and stays as it is.
 *
 * Returns the patch it stopped, for the caller's diagnostic.
 */
export function stopForeignCompactionPatch(runtimeId: string): CompactionPatchRegistry | undefined {
  const slot = recognizedRegistry();
  if (slot === undefined || slot.runtimeId === runtimeId) return undefined;
  disablePatch(slot, "runtime-conflict");
  return slot;
}

/** The process's own implementation, kept for calls made outside any window. */
const nativeTimeout: TimeoutFn = AbortSignal.timeout.bind(AbortSignal);

/** Replacement installed on `AbortSignal.timeout` while this module owns it. */
function createWrapper(): TimeoutFn {
  return function compactionAwareTimeout(milliseconds: number): AbortSignal {
    const registry = recognizedRegistry();
    if (registry === undefined || registry.disabledReason !== undefined) return nativeTimeout(milliseconds);
    const passThrough = (value: number): AbortSignal => registry.original.call(AbortSignal, value);
    if (liveWindow(registry) === undefined) return passThrough(milliseconds);
    if (!inRewriteRange(milliseconds, registry.settings)) return passThrough(milliseconds);
    if (registry.settings.notify && registry.window?.notified === false) {
      registry.window.notified = true;
      registry.notify(
        `${PACKAGE_NAME}: extended one deadline to ${registry.settings.timeoutMs} ms inside a compaction window; ` +
          `matching timeouts in that window change too`,
      );
    }
    return passThrough(registry.settings.timeoutMs);
  };
}

/** Seams a host-free test replaces; the shipped installer uses the real clock and timers. */
export interface CompactionPatchDeps {
  now: () => number;
  setTimer: (callback: () => void, milliseconds: number) => () => void;
}

const REAL_DEPS: CompactionPatchDeps = {
  now: () => Date.now(),
  setTimer: (callback, milliseconds) => {
    const timer = setTimeout(callback, milliseconds);
    timer.unref?.();
    return () => clearTimeout(timer);
  },
};

/** Build the module installer; tests inject the clock and the guard timer. */
export function createCompactionInstaller(deps: CompactionPatchDeps = REAL_DEPS) {
  return function installCompactionModule(context: ModuleContext): ModuleState {
    const settings = context.settings.compaction;
    const cwd = typeof context.ctx.cwd === "string" ? context.ctx.cwd : "";
    const refuse = (reason: string, message: string): ModuleState => {
      context.report(`compaction:${reason}`, `compaction patch stays inactive: ${message}`);
      return { status: "incompatible", reason };
    };
    /** State of an activation that must not install: switches, not conflicts. */
    const inactiveState = (): ModuleState => {
      if (context.off === "master-disabled") return { status: "disabled", reason: "master-disabled" };
      if (context.off === "settings-invalid") return { status: "invalid", reason: "settings-invalid" };
      return { status: "disabled", reason: "compaction-disabled" };
    };

    // Conflicting patches are refused whatever this instance's own switch says:
    // a disabled second runtime must not be silently controlled by the first.
    if (legacyPatchPresent()) {
      return refuse("legacy-patch", "another compaction deadline patch already replaced AbortSignal.timeout");
    }
    const slot = slots()[REGISTRY_KEY];
    const existing = recognizedRegistry();
    if (slot !== undefined && existing === undefined) {
      // Somebody wrote this slot in a layout this version does not know; it is
      // never taken over, and no second wrapper is stacked on top of it.
      return refuse("registry-unrecognized", "the process patch registry was not written by this version");
    }
    if (existing !== undefined) {
      if (existing.runtimeId !== context.runtimeId) {
        // A patch that already stopped keeps its reason: there is nothing left to
        // stop, and that reason is what later activations and `/qol` report.
        if (existing.disabledReason !== undefined && context.off === undefined) {
          return refuse(existing.disabledReason, "the patch stopped rewriting earlier in this process");
        }
        // A second activation that asks for the installed adjustment keeps the
        // patch. The window stays with the activation whose events open it, so
        // this one reports ownership instead of a state it cannot drive.
        if (keepsInstalledPatch(context, settings, existing)) {
          return { status: "incompatible", reason: "patch-owned-elsewhere" };
        }
        // Every other second activation stops the patch rather than sharing or
        // overriding it, and reports the reasons this module already reports.
        disablePatch(existing, "runtime-conflict");
        const conflict = `another omp-qol runtime (${existing.packageVersion} at ${existing.cwd}) owned the process patch; it stopped rewriting`;
        if (context.off !== undefined) {
          context.report("compaction:runtime-conflict", `compaction patch stays inactive: ${conflict}`);
          return inactiveState();
        }
        return refuse("runtime-conflict", conflict);
      }
      if (existing.disabledReason !== undefined) {
        if (context.off !== undefined) return inactiveState();
        return refuse(existing.disabledReason, "the patch stopped rewriting earlier in this process");
      }
      if (currentTimeout() !== existing.wrapper) {
        if (context.off !== undefined) return inactiveState();
        return refuse("patch-overwritten", "another extension replaced the patched AbortSignal.timeout");
      }
      if (context.off !== undefined || !settings.enabled) {
        // This activation's own switches ask for the patch off: release it
        // without reporting a conflict.
        const state = inactiveState();
        releasePatch(existing, state.reason ?? "compaction-disabled");
        return state;
      }
      if (!sameCompactionSettings(existing.settings, settings)) {
        // One activation installs once. A different snapshot means the installed
        // patch no longer matches the effective settings, so it stops.
        disablePatch(existing, "config-conflict");
        return refuse("config-conflict", "the installed patch used a different settings snapshot");
      }
      // Same activation and same snapshot: one patch per process, never a second wrapper.
      return { status: "enabled" };
    }

    if (context.off !== undefined || !settings.enabled) return inactiveState();
    if (typeof currentTimeout() !== "function") {
      return refuse("host-unavailable", "this runtime has no AbortSignal.timeout");
    }

    let windowGeneration = 0;
    const registry: CompactionPatchRegistry = {
      schema: COMPACTION_REGISTRY_SCHEMA,
      runtimeId: context.runtimeId,
      packageVersion: PACKAGE_VERSION,
      cwd,
      original: currentTimeout(),
      wrapper: createWrapper(),
      settings,
      window: undefined,
      disabledReason: undefined,
      cleanup: undefined,
      now: deps.now,
      notify: (message) => {
        try {
          context.ctx.ui.notify(message, "info");
        } catch {
          // A notice is best effort and must never affect the request path.
        }
      },
      report: (reason) => {
        context.report(`compaction:${reason}`, `compaction patch stopped rewriting: ${reason}`);
        context.setStatus?.("compaction", { status: "incompatible", reason });
      },
    };

    /** Open a window, or refine the open one without extending its lease. */
    const openWindow = (kind: WindowKind, sessionId?: string): CompactionWindow | undefined => {
      if (registry.disabledReason !== undefined) return undefined;
      const open = liveWindow(registry);
      if (open === undefined) {
        windowGeneration += 1;
        const generation = windowGeneration;
        const guardDeadline = registry.now() + settings.guardMs;
        registry.window = { kind, generation, sessionId, guardDeadline, notified: false, signal: undefined };
        const cancelTimer = deps.setTimer(() => {
          if (registry.window?.generation === generation) closeWindow(registry);
        }, settings.guardMs);
        registry.cleanup = cancelTimer;
        return registry.window;
      }
      if (kind === "compacting") {
        if (sessionId === undefined) return open;
        if (open.sessionId === undefined) {
          open.sessionId = sessionId;
          return open;
        }
        if (open.sessionId !== sessionId) disablePatch(registry, "overlapping-session");
        return open;
      }
      if (kind === open.kind) {
        // A second start of the same kind without an end: two rounds overlap.
        disablePatch(registry, "overlapping-round");
        return undefined;
      }
      // A `session_before_compact` inside an auto round belongs to that round;
      // an auto round starting inside a manual one does not. `session.compacting`
      // only ever refines a window: it does not prove which method runs.
      if (kind === "manual") return open;
      disablePatch(registry, "unrecognized-order");
      return undefined;
    };

    /**
     * Bind a `session_before_compact` signal to the window it belongs to.
     *
     * The window may already be open, for example because an auto round or
     * `session.compacting` opened it, so the signal is attached to whatever
     * window is current instead of only to a freshly created one. One window
     * holds one binding: a later event carrying the same signal never reaches
     * this function. A listener left over from an earlier window must never
     * close a later one, hence the generation check inside the abort handler.
     */
    const bindWindowSignal = (signal: AbortSignal): void => {
      const window = registry.window;
      if (window === undefined) return;
      window.signal = signal;
      const generation = window.generation;
      const previousCleanup = registry.cleanup;
      const onAbort = (): void => {
        if (registry.window?.generation === generation) closeWindow(registry);
      };
      signal.addEventListener("abort", onAbort, { once: true });
      registry.cleanup = (): void => {
        signal.removeEventListener("abort", onAbort);
        previousCleanup?.();
      };
    };

    const openManualWindow = (event: SessionBeforeCompactEvent): void => {
      if (registry.disabledReason !== undefined) return;
      if (event.signal.aborted) {
        // A cancelled before-compact hook ends the window that is open, whether
        // this event created it or an earlier one did.
        closeWindow(registry);
        return;
      }
      const bound = liveWindow(registry)?.signal;
      if (bound !== undefined) {
        // The window already belongs to one compaction operation. The same
        // signal is that operation again: a repeated event, or the next method
        // of a serial fallback. It keeps the window, its kind, generation,
        // guard lease, notice state, and cancel binding. A different live
        // signal is a second operation inside one window.
        if (bound !== event.signal) disablePatch(registry, "overlapping-round");
        return;
      }
      openWindow("manual");
      bindWindowSignal(event.signal);
    };

    slots()[REGISTRY_KEY] = registry;
    AbortSignal.timeout = registry.wrapper;

    try {
      context.pi.on("auto_compaction_start", (event: AutoCompactionStartEvent) => {
        if (event.action === "remote") openWindow("auto");
      });
      context.pi.on("auto_compaction_end", () => {
        closeWindow(registry);
      });
      context.pi.on("session_before_compact", (event: SessionBeforeCompactEvent) => {
        openManualWindow(event);
      });
      context.pi.on("session.compacting", (event: SessionCompactingEvent) => {
        openWindow("compacting", event.sessionId);
      });
      context.pi.on("session_compact", () => {
        closeWindow(registry);
      });
      context.pi.on("session_switch", () => {
        closeWindow(registry);
      });
      context.pi.on("session_shutdown", () => {
        // The owner leaving ends the process patch. The window closes, the native
        // function comes back while the global is still this module's wrapper, and
        // the registry keeps a bounded `owner-stopped` terminal state. Later
        // activations install no new patch, so the adjustment returns only with a
        // restarted OMP. A session that merely keeps the patch never reaches this
        // handler: it registered no window events and no release.
        releasePatch(registry, "owner-stopped");
      });
    } catch {
      // Registration is part of the installation: without it nothing opens a
      // window and nothing releases the patch. The patch is given up rather
      // than reported as enabled, so the native function comes back and the
      // registry keeps the failure for later activations and `/qol`.
      releasePatch(registry, "registration-error");
      return refuse("registration-error", "the runtime rejected a window event registration");
    }

    return { status: "enabled" };
  };
}

export const installCompactionModule = createCompactionInstaller();

/**
 * Compaction state `/qol` reports when the command runs.
 *
 * A patch this version installed and can read decides the line, not the result
 * one activation recorded: a patch another activation owns, a patch that
 * stopped later in the process, and a wrapper another extension replaced all
 * show up here. Without such a patch the recorded state stands, so an
 * activation that installed nothing, refused a foreign layout, or failed while
 * registering its window events still explains itself.
 */
export function compactionStatusFromRegistry(runtimeId: string, recorded: ModuleState): ModuleState {
  const registry = recognizedRegistry();
  if (registry === undefined) return recorded;
  if (registry.disabledReason !== undefined) return { status: "incompatible", reason: registry.disabledReason };
  if (currentTimeout() !== registry.wrapper) return { status: "incompatible", reason: "patch-overwritten" };
  return registry.runtimeId === runtimeId
    ? { status: "enabled" }
    : { status: "incompatible", reason: "patch-owned-elsewhere" };
}
