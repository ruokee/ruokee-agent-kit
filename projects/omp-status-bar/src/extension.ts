/**
 * OMP extension entry: binds the live session to the status bar Host.
 *
 * Flow on activation: register the six builtin providers into the
 * process-level registry. Registration is preflighted atomically, so a
 * second activation of this package (or a third party that already owns a
 * builtin id) cannot leave a partial batch.
 *
 * Flow on `session_start`:
 * 1. Bind the data sources (usage statistics, context usage, model,
 *    compaction settings) to the shared snapshot store.
 * 2. Create the Host with an environment backed by this extension context.
 * 3. Start the Host (config read + provider creation + widget mount).
 *
 * On `session_shutdown` the Host stops first: providers stop, the shared
 * sampler interval is cleared, and the widget unmounts; only then are the
 * data sources unbound. A `finally` guarantees the unbind even if a stop
 * throws.
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
  pi.on("session_start", (_event, ctx: ExtensionContext) => {
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
  });

  pi.on("session_shutdown", async () => {
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
    } else {
      unbindSessionSources();
    }
  });
}
