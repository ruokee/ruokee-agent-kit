/**
 * OMP extension entry: binds the live session to the status bar Host.
 *
 * Flow on activation: register the builtin providers into the
 * process-level registry. Registration is preflighted atomically, so a third
 * party that already owns a builtin id cannot leave a partial batch. Ids this
 * package registered earlier in the process are its own: a later activation,
 * including one from another copy of this package, keeps those definitions and
 * registers nothing.
 *
 * Flow on `session_start` and `session_switch`, after the previous Host stops:
 * 1. Return immediately when the session has no UI: it can mount no widget, and
 *    the bound sources and turn state belong to the UI session that shares this
 *    process.
 * 2. Seed the turn state from the branch the session now holds, and bind the
 *    data sources (usage statistics, context usage, model, compaction settings)
 *    to the shared snapshot store.
 * 3. Create the Host with an environment backed by this extension context, and
 *    start it (config read + provider creation + widget mount).
 *
 * The turn lifecycle of the UI session writes the turn state: `turn_start`
 * marks a turn in flight, `turn_end` advances the count when the response
 * ended successfully and clears the mark otherwise, and `agent_end` clears the
 * mark for a run that never reached `turn_end`. `session_tree` and
 * `session_branch` replace the branch the session holds without replacing the
 * session manager, so both re-seed the count from the branch now in front.
 * Events from a session without UI are ignored: a child session in the same
 * process runs this extension too, and its turns must not move the UI
 * session's value.
 *
 * On `session_shutdown` the Host stops first: providers stop, the shared
 * sampler interval is cleared, and the widget unmounts; only then are the
 * data sources unbound and the turn state cleared. A `finally` guarantees the
 * teardown even if a stop throws. Teardown touches only what this activation
 * bound, so a session that never bound sources leaves the store and the widget
 * of the UI session alone.
 *
 * One process holds one bound source set, and `session_start` rebinds it for
 * the session that is now in front. OMP binds this extension per session and
 * calls the factory again; some paths reuse a prepared factory instead of
 * loading the module again, so a later activation may run without a fresh
 * module evaluation.
 */

import { join as joinPath } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { StatusBarHost, type HostEnvironment } from "./host.ts";
import { registerBuiltinProviders } from "./providers/bundled.ts";
import { bindSessionSources, unbindSessionSources, type CompactionSettingsShape } from "./snapshot-store.ts";
import { countSuccessfulResponses, getTurnSample, setTurnSample, SUCCESSFUL_STOP_REASONS } from "./turn-state.ts";
import { getAgentDir } from "./agent-dir.ts";

/** Live Settings instance that still exposes its groups directly (`getGroup`). */
interface GroupReader {
  getGroup(prefix: string): unknown;
}

/** True when the host still exposes setting groups on the Settings singleton itself. */
function hasGroupReader(value: unknown): value is GroupReader {
  return typeof value === "object" && value !== null && typeof Reflect.get(value, "getGroup") === "function";
}

/**
 * Bounded reasons the live settings read can fail while the context provider
 * asks for the compaction group. Each names the cause and stays free of
 * configuration values; a session reports one of them at most once, so a
 * 600 ms sampler cannot flood the log.
 */
const NO_GROUP_READER_DIAGNOSTIC =
  "omp-status-bar: the host Settings exposes no getGroup, so this session has no readable compaction group and keeps the speculation indicator hidden";
const SETTINGS_READ_FAILED_DIAGNOSTIC =
  "omp-status-bar: reading the compaction settings failed, so this session keeps the speculation indicator hidden";

/**
 * Seed the turn state from the branch the session holds now. The session
 * manager object survives tree navigation and branching, so a later event
 * reads the branch in front through the context it receives.
 */
function reseedTurnCount(ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;
  setTurnSample({ count: countSuccessfulResponses(ctx.sessionManager.getBranch()), active: false });
}

export default function statusBarController(pi: ExtensionAPI): void {
  registerBuiltinProviders();

  /** One Host per extension module per session. */
  let host: StatusBarHost | undefined;
  // A timed-out event may still be finishing its teardown. Keep later
  // mounts behind it so old cleanup cannot unbind a successor's sources.
  let lifecycle = Promise.resolve();
  let generation = 0;
  /**
   * Whether this session already reported why the settings read is
   * unavailable. The sampler asks for the group on every tick, so the report
   * is sent once per bound session instead of once per sample.
   */
  let settingsReadReported = false;

  /** Report one bounded reason for an unavailable settings read. */
  function reportSettingsReadUnavailable(message: string): void {
    if (settingsReadReported) return;
    settingsReadReported = true;
    pi.logger.warn(message);
  }
  function transition(ctx?: ExtensionContext): Promise<void> {
    const requested = ++generation;
    // Stop eagerly so a provider still starting can observe shutdown.
    const pending = Promise.all([lifecycle, stopSession()]).then(async () => {
      if (ctx !== undefined && generation === requested) await startSession(ctx);
    });
    lifecycle = pending.catch(() => {});
    return pending;
  }

  /**
   * Read the live compaction settings group; undefined when the host exposes
   * no usable read, which leaves the speculation estimate hidden rather than
   * guessed, and reports the bounded reason once per session. Hosts that
   * removed the group reader moved settings onto registry handles owned by
   * the host module instance: a handle from this package's copy resolves
   * other settings' values against the host instance, so it is not an
   * equivalent read.
   */
  function readCompactionSettings(): Partial<CompactionSettingsShape> | undefined {
    try {
      // Read through the host-injected namespace: this is the active OMP
      // runtime's Settings singleton.
      const settings = pi.pi.Settings.instance;
      if (!hasGroupReader(settings)) {
        // The context provider asks for this group only while it has
        // subscribers, so a missing reader is why this session has no
        // estimate, not a configuration that turned compaction off.
        reportSettingsReadUnavailable(NO_GROUP_READER_DIAGNOSTIC);
        return undefined;
      }
      const group: unknown = settings.getGroup("compaction");
      return typeof group === "object" && group !== null ? (group as Partial<CompactionSettingsShape>) : undefined;
    } catch {
      reportSettingsReadUnavailable(SETTINGS_READ_FAILED_DIAGNOSTIC);
      return undefined;
    }
  }

  async function startSession(ctx: ExtensionContext): Promise<void> {
    // A session without UI mounts nothing and owns no teardown state. Binding
    // here would replace the sources of the UI session that shares this
    // process, and this activation's later shutdown would then unbind them.
    if (!ctx.hasUI) return;
    // Each bound session gets its own bounded report: the previous session's
    // reason says nothing about the host this one runs against.
    settingsReadReported = false;
    // The count follows the branch this session holds: seed it before the
    // Host starts, so the first publish shows the history of that branch
    // instead of an empty row.
    reseedTurnCount(ctx);
    bindSessionSources({
      getUsageStatistics: () => ctx.sessionManager.getUsageStatistics(),
      getContextUsage: () => ctx.getContextUsage(),
      getModel: () => ctx.model,
      getCompactionSettings: readCompactionSettings,
    });
    const environment: HostEnvironment = {
      hasUI: ctx.hasUI,
      setWidget(key, factory, options) {
        // Pass the factory through: OMP calls it with the live TUI and
        // theme exactly once at mount. The Host captures the TUI from the
        // factory arguments and drives component-scoped repaints on it.
        ctx.ui.setWidget(key, (tui, theme) => factory(tui, theme), options);
      },
      unsetWidget(key) {
        ctx.ui.setWidget(key, undefined);
      },
      setInterval: (callback, ms) => ctx.setInterval(callback, ms),
      setTimeout: (callback, ms) => ctx.setTimeout(callback, ms),
      clearTimer: (timer) => ctx.clearTimer(timer as Parameters<typeof ctx.clearTimer>[0]),
    };
    const next = new StatusBarHost({
      environment,
      getAgentDir,
      joinPath,
      onDiagnostic: (message) => {
        pi.logger.warn(message);
      },
      configReader: undefined,
    });
    host = next;
    return next.start();
  }

  async function stopSession(): Promise<void> {
    const current = host;
    host = undefined;
    // Contract order: stop providers / clear the shared sampler timer /
    // unmount the widget first; unbind the sources last. unbind still runs
    // when a stop throws.
    if (current !== undefined) {
      try {
        await current.shutdown();
      } finally {
        unbindSessionSources();
        setTurnSample(undefined);
      }
    }
  }

  // Turn lifecycle of the UI session. A turn counts once, at `turn_end`, and
  // only when the response ended successfully; `agent_end` covers a run that
  // stopped before any `turn_end` so a stale in-flight mark cannot dim the
  // value forever.
  pi.on("turn_start", (_event, ctx) => {
    if (!ctx.hasUI) return;
    setTurnSample({ count: getTurnSample()?.count ?? 0, active: true });
  });
  pi.on("turn_end", (event, ctx) => {
    if (!ctx.hasUI) return;
    const message = event.message;
    const count = getTurnSample()?.count ?? 0;
    const answered = message.role === "assistant" && SUCCESSFUL_STOP_REASONS[message.stopReason] === true;
    setTurnSample({ count: answered ? count + 1 : count, active: false });
  });
  pi.on("agent_end", (_event, ctx) => {
    if (!ctx.hasUI) return;
    const current = getTurnSample();
    if (current?.active) setTurnSample({ count: current.count, active: false });
  });
  pi.on("session_start", (_event, ctx) => transition(ctx));
  pi.on("session_switch", (_event, ctx) => transition(ctx));
  // Navigating the session tree or branching replaces the branch under the
  // same session manager: the count follows the branch now in front instead of
  // keeping the total of the one it replaced. The Host and its sources stay
  // bound, because the session manager they read through is unchanged.
  pi.on("session_tree", (_event, ctx) => reseedTurnCount(ctx));
  pi.on("session_branch", (_event, ctx) => reseedTurnCount(ctx));
  pi.on("session_shutdown", () => transition());
}
