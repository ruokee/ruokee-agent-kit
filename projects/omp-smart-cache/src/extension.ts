import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { getPluginSettings } from "@oh-my-pi/pi-coding-agent/extensibility/plugins/loader";
import { AgentRegistry, type AgentRef } from "@oh-my-pi/pi-coding-agent/registry/agent-registry";
import { register, type Registration, type Snapshot } from "./runtime.ts";
import { parseSettings, type Settings } from "./settings.ts";
import { object } from "./reuse.ts";
import { observeConstruction } from "./construction.ts";

const PACKAGE = "@ruokee/omp-smart-cache";
const VERSION = "0.1.4";
const SNAPSHOTS = Symbol.for("ruokee.omp-smart-cache.settings");
const globals = globalThis as typeof globalThis & { [key: symbol]: unknown };
const FAILED: Settings = {
  remote: { ok: false, reason: "settings-reader-failed" },
  handoff: { ok: false, reason: "settings-reader-failed" },
};
interface Activation {
  readonly cwd: string;
  readonly version: string;
  readonly result: Promise<Settings>;
}

/**
 * The activation cache lives on a process-global symbol of its own, so a copy of another version never reads
 * this activation's entry and this activation never reuses one written by a different version. Entries of
 * this version are reused across parent sessions that share the same working directory.
 */
function ownsActivation(value: unknown): value is Activation {
  if (!object(value)) return false;
  return typeof value.cwd === "string" && value.version === VERSION && value.result instanceof Promise;
}

function settingsSnapshot(id: string, cwd: string): Promise<Settings> {
  let snapshots = globals[SNAPSHOTS];
  if (snapshots === undefined) globals[SNAPSHOTS] = snapshots = new WeakMap<AgentRef, Activation>();
  if (!(snapshots instanceof WeakMap))
    return Promise.resolve({
      remote: { ok: false, reason: "activation-snapshot-conflict" },
      handoff: { ok: false, reason: "activation-snapshot-conflict" },
    });
  const registry = AgentRegistry.global(),
    current = registry.get(id);
  if (!current)
    return Promise.resolve({
      remote: { ok: false, reason: "session-interface" },
      handoff: { ok: false, reason: "session-interface" },
    });
  const retained = snapshots.get(current);
  if (ownsActivation(retained)) return retained.result;
  const seen = new Set<AgentRef>();
  for (
    let parent = current.parentId ? registry.get(current.parentId) : undefined;
    parent && !seen.has(parent);
    parent = parent.parentId ? registry.get(parent.parentId) : undefined
  ) {
    seen.add(parent);
    const inherited = snapshots.get(parent);
    if (ownsActivation(inherited) && inherited.cwd === cwd) {
      snapshots.set(current, inherited);
      return inherited.result;
    }
  }
  const result = getPluginSettings(PACKAGE, cwd).then(parseSettings, () => FAILED);
  snapshots.set(current, { cwd, version: VERSION, result });
  return result;
}

export function describe(snapshot: Readonly<Snapshot>, mode: string): string {
  const remote = snapshot.remote,
    handoff = snapshot.handoff;
  return [
    `omp-smart-cache ${VERSION} remote=${remote.state} mode=${mode}`,
    `online=${remote.online} binding=${remote.binding} candidate=${remote.candidate} sending=${remote.sending}`,
    `dispatch=${remote.dispatch} operation=${remote.operation} reference=${remote.reference}`,
    `operations=${remote.operations} sends=${remote.sends} retries=${remote.retries} aligned=${remote.aligned} rewritten=${remote.rewritten} rejected=${remote.rejected}`,
    `reused=${remote.reused} retained=${remote.retained}`,
    "Alignment is not native adoption or a Provider cache hit. Rejected operations remain in the total.",
    `handoff=${handoff.state} online=${handoff.online} binding=${handoff.binding} candidate=${handoff.candidate} sending=${handoff.sending}`,
    `reference=${handoff.reference} operations=${handoff.operations} sends=${handoff.sends} retries=${handoff.retries} aligned=${handoff.aligned} rewritten=${handoff.rewritten} rejected=${handoff.rejected}`,
    `axes=${handoff.axes} unprojected=${handoff.unprojected}`,
  ].join("\n");
}

/** Native settings are read once for this activation; session navigation does not refresh them. */
export default function extension(pi: ExtensionAPI): void {
  const construction = observeConstruction();
  let activationEvent = 0;
  let activation: Promise<Settings> | undefined;
  let registration: Registration | undefined;
  let mode = "unknown";
  let pending = "not-activated";
  pi.on("session_start", async (_event, ctx) => {
    const event = ++activationEvent;
    try {
      activation ??= settingsSnapshot(ctx.agent.id, ctx.cwd);
      const settings = await activation;
      if (event !== activationEvent) return;
      if (settings.remote.ok) mode = settings.remote.settings.mode;
      registration ??= register(ctx, settings, construction);
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
    description: "Show this session's remote and handoff alignment stages and bounded counts without a model turn",
    handler: async (_args, ctx) => {
      ctx.ui.notify(
        registration
          ? describe(registration.status(), mode)
          : `omp-smart-cache ${VERSION} remote=unavailable reason=${pending} handoff=unavailable reason=${pending}`,
        "info",
      );
    },
  });
}
