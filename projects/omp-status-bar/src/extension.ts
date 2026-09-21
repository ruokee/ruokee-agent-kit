/**
 * OMP extension entry: binds the live session to the status bar Host.
 *
 * Flow on activation: register the six builtin providers into the
 * process-level registry. Registration is preflighted atomically, so a third
 * party that already owns a builtin id cannot leave a partial batch. Ids this
 * package registered earlier in the process are its own: a later activation,
 * including one from another copy of this package, keeps those definitions and
 * registers nothing.
 *
 * Flow on `session_start` and `session_switch`, after the previous Host stops:
 * 1. Return immediately when the session has no UI: it can mount no widget, and
 *    the bound sources belong to the UI session that shares this process.
 * 2. Bind the data sources (usage statistics, context usage, model,
 *    compaction settings) to the shared snapshot store.
 * 3. Create the Host with an environment backed by this extension context, and
 *    start it (config read + provider creation + widget mount).
 *
 * On `session_shutdown` the Host stops first: providers stop, the shared
 * sampler interval is cleared, and the widget unmounts; only then are the
 * data sources unbound. A `finally` guarantees the unbind even if a stop
 * throws. Teardown touches only what this activation bound, so a session that
 * never bound sources leaves the store and the widget of the UI session alone.
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
import { getAgentDir } from "./agent-dir.ts";

export default function statusBarController(pi: ExtensionAPI): void {
  registerBuiltinProviders();

  /** One Host per extension module per session. */
  let host: StatusBarHost | undefined;
  // A timed-out event may still be finishing its teardown. Keep later
  // mounts behind it so old cleanup cannot unbind a successor's sources.
  let lifecycle = Promise.resolve();
  let generation = 0;
  function transition(ctx?: ExtensionContext): Promise<void> {
    const requested = ++generation;
    // Stop eagerly so a provider still starting can observe shutdown.
    const pending = Promise.all([lifecycle, stopSession()]).then(async () => {
      if (ctx !== undefined && generation === requested) await startSession(ctx);
    });
    lifecycle = pending.catch(() => {});
    return pending;
  }

  /** Read the compaction settings group; undefined when Settings is unavailable. */
  function readCompactionSettings(): CompactionSettingsShape | undefined {
    try {
      // Read through the host-injected namespace: this is the active OMP
      // runtime's Settings singleton.
      return pi.pi.Settings.instance.getGroup("compaction");
    } catch {
      return undefined;
    }
  }
  async function startSession(ctx: ExtensionContext): Promise<void> {
    // A session without UI mounts nothing and owns no teardown state. Binding
    // here would replace the sources of the UI session that shares this
    // process, and this activation's later shutdown would then unbind them.
    if (!ctx.hasUI) return;
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
      }
    }
  }

  pi.on("session_start", (_event, ctx) => transition(ctx));
  pi.on("session_switch", (_event, ctx) => transition(ctx));
  pi.on("session_shutdown", () => transition());
}
