import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { getPluginSettings } from "@oh-my-pi/pi-coding-agent/extensibility/plugins/loader";
import { AgentRegistry, type AgentRef } from "@oh-my-pi/pi-coding-agent/registry/agent-registry";
import { register, type Registration, type Status } from "./runtime.ts";
import { parseSettings, type SettingsResult } from "./settings.ts";
import { observeConstruction } from "./construction.ts";

const PACKAGE = "@ruokee/omp-smart-cache";
const SNAPSHOTS = Symbol.for("ruokee.omp-smart-cache.remote.settings");
const globals = globalThis as typeof globalThis & { [key: symbol]: unknown };
interface Snapshot {
  readonly cwd: string;
  readonly result: Promise<SettingsResult>;
}
function settingsSnapshot(id: string, cwd: string): Promise<SettingsResult> {
  let snapshots = globals[SNAPSHOTS];
  if (snapshots === undefined) globals[SNAPSHOTS] = snapshots = new WeakMap<AgentRef, Snapshot>();
  if (!(snapshots instanceof WeakMap)) return Promise.resolve({ ok: false, reason: "activation-snapshot-conflict" });
  const registry = AgentRegistry.global(),
    current = registry.get(id);
  if (!current) return Promise.resolve({ ok: false, reason: "session-interface" });
  const retained = snapshots.get(current) as Snapshot | undefined;
  if (retained) return retained.result;
  const seen = new Set<AgentRef>();
  for (
    let parent = current.parentId ? registry.get(current.parentId) : undefined;
    parent && !seen.has(parent);
    parent = parent.parentId ? registry.get(parent.parentId) : undefined
  ) {
    seen.add(parent);
    const inherited = snapshots.get(parent) as Snapshot | undefined;
    if (inherited?.cwd === cwd) {
      snapshots.set(current, inherited);
      return inherited.result;
    }
  }
  const result = getPluginSettings(PACKAGE, cwd).then(parseSettings, () => ({
    ok: false as const,
    reason: "settings-reader-failed",
  }));
  snapshots.set(current, { cwd, result });
  return result;
}

export function describe(status: Readonly<Status>, mode: string): string {
  return [
    `omp-smart-cache 0.0.2 remote=${status.state} mode=${mode}`,
    `online=${status.online} binding=${status.binding} candidate=${status.candidate} sending=${status.sending}`,
    `dispatch=${status.dispatch} operation=${status.operation} reference=${status.reference}`,
    `operations=${status.operations} sends=${status.sends} retries=${status.retries} aligned=${status.aligned} rewritten=${status.rewritten} rejected=${status.rejected}`,
    `reused=${status.reused} retained=${status.retained}`,
    "Alignment is not native adoption or a Provider cache hit. Rejected operations remain in the total.",
  ].join("\n");
}

/** Native settings are read once for this activation; session navigation does not refresh them. */
export default function extension(pi: ExtensionAPI): void {
  const construction = observeConstruction();
  let activationEvent = 0;
  let activation: Promise<SettingsResult> | undefined;
  let registration: Registration | undefined;
  let mode = "hooks";
  let unavailable = "not-activated";
  pi.on("session_start", async (_event, ctx) => {
    const event = ++activationEvent;
    try {
      activation ??= settingsSnapshot(ctx.agent.id, ctx.cwd);
      const result = await activation;
      if (event !== activationEvent) return;
      if (!result.ok) {
        unavailable = result.reason;
        return;
      }
      mode = result.settings.mode;
      registration ??= register(ctx, result.settings, construction);
    } finally {
      construction.release();
    }
  });
  pi.on("session_before_switch", () => {
    registration?.invalidate("navigation-switch");
  });
  pi.on("session_before_branch", () => {
    registration?.invalidate("navigation-branch");
  });
  pi.on("session_before_tree", () => {
    registration?.invalidate("navigation-tree");
  });
  pi.on("session_compact", () => {
    registration?.invalidate("native-history-committed");
  });
  pi.on("session_shutdown", () => {
    activationEvent++;
    construction.release();
    registration?.close();
    registration = undefined;
  });
  pi.registerCommand("smart-cache", {
    description: "Show this session's remote alignment stages and bounded counts without a model turn",
    handler: async (_args, ctx) => {
      ctx.ui.notify(
        registration
          ? describe(registration.status(), mode)
          : `omp-smart-cache 0.0.2 remote=unavailable reason=${unavailable}`,
        "info",
      );
    },
  });
}
