import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { getPluginSettings } from "@oh-my-pi/pi-coding-agent/extensibility/plugins/loader";
import { AgentRegistry, type AgentRef } from "@oh-my-pi/pi-coding-agent/registry/agent-registry";
import { register, type Registration, type Snapshot } from "./runtime.ts";
import { parseSettings, rejectedSettings, type ModuleState, type Settings } from "./settings.ts";
import { object } from "./reuse.ts";
import { observeConstruction } from "./construction.ts";
import { installModelPromptsModule } from "./model-prompts.ts";
import { installUsageCompensationModule, usageStatusFromRegistry } from "./usage-compensation.ts";
import { PACKAGE_NAME, PACKAGE_VERSION } from "./version.ts";

const SNAPSHOTS = Symbol.for("ruokee.omp-smart-context.settings");
const globals = globalThis as typeof globalThis & { [key: symbol]: unknown };
interface Activation {
  readonly cwd: string;
  readonly version: string;
  readonly result: Promise<Settings>;
}

/** Same-version children inherit the activation snapshot only for the same cwd. */
function ownsActivation(value: unknown): value is Activation {
  if (!object(value)) return false;
  return typeof value.cwd === "string" && value.version === PACKAGE_VERSION && value.result instanceof Promise;
}

function settingsSnapshot(id: string, cwd: string): Promise<Settings> {
  let snapshots = globals[SNAPSHOTS];
  if (snapshots === undefined) globals[SNAPSHOTS] = snapshots = new WeakMap<AgentRef, Activation>();
  if (!(snapshots instanceof WeakMap)) return Promise.resolve(rejectedSettings("activation-snapshot-conflict"));
  const registry = AgentRegistry.global(),
    current = registry.get(id);
  if (!current) return Promise.resolve(rejectedSettings("session-interface"));
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
  const result = getPluginSettings(PACKAGE_NAME, cwd).then(parseSettings, () =>
    rejectedSettings("settings-reader-failed"),
  );
  snapshots.set(current, { cwd, version: PACKAGE_VERSION, result });
  return result;
}

export function describe(snapshot: Readonly<Snapshot>, mode: string): string {
  const remote = snapshot.remote,
    handoff = snapshot.handoff;
  return [
    `omp-smart-context ${PACKAGE_VERSION} remote=${remote.state} mode=${mode}`,
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

function describeModule(name: string, state: ModuleState): string {
  return `${name}=${state.status}${state.reason ? ` reason=${state.reason}` : ""}${state.detail ? ` ${state.detail}` : ""}`;
}

/** Native settings are read once; navigation does not refresh the activation. */
export default function extension(pi: ExtensionAPI): void {
  const construction = observeConstruction();
  const runtimeId = crypto.randomUUID();
  const reported = new Set<string>();
  let activationEvent = 0;
  let activation: Promise<Settings> | undefined;
  let registration: Registration | undefined;
  let modulesInstalled = false;
  let usage: ModuleState = { status: "pending" };
  let prompts: ModuleState = { status: "pending" };
  let mode = "unknown";
  const report = (ctx: ExtensionContext, key: string): void => {
    if (reported.has(key)) return;
    reported.add(key);
    try {
      const message = `${PACKAGE_NAME}: ${key}`;
      if (ctx.hasUI) ctx.ui.notify(message, "warning");
      else pi.logger.warn(message);
    } catch {
      // A diagnostic must not interrupt activation or a native request.
    }
  };

  pi.on("session_start", async (_event, ctx) => {
    const event = ++activationEvent;
    try {
      activation ??= settingsSnapshot(ctx.agent.id, ctx.cwd);
      const settings = await activation;
      if (event !== activationEvent) return;
      if (settings.remote.ok) mode = settings.remote.settings.mode;
      registration ??= register(ctx, settings, construction);
      if (modulesInstalled) return;
      modulesInstalled = true;
      try {
        usage = installUsageCompensationModule({
          pi,
          ctx,
          settings: settings.compactionUsage.ok ? settings.compactionUsage.settings : { enabled: false },
          runtimeId,
          off: settings.compactionUsage.ok ? undefined : "settings-invalid",
          report: (key) => report(ctx, key),
          setStatus: (state) => {
            usage = state;
          },
        });
        if (!settings.compactionUsage.ok) usage = { status: "invalid", reason: settings.compactionUsage.reason };
      } catch {
        usage = { status: "incompatible", reason: "registration-error" };
        report(ctx, "compactionUsage:registration-error");
      }
      try {
        prompts = installModelPromptsModule(pi, settings.modelPrompts);
      } catch {
        prompts = { status: "incompatible", reason: "registration-error" };
        report(ctx, "modelPrompts:registration-error");
      }
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
  pi.registerCommand("smart-context", {
    description: "Show context capability states and bounded counters without a model turn",
    handler: async (_args, ctx) => {
      ctx.ui.notify(
        [
          registration
            ? describe(registration.status(), mode)
            : `omp-smart-context ${PACKAGE_VERSION} remote=unavailable reason=not-activated handoff=unavailable reason=not-activated`,
          describeModule("compactionUsage", usageStatusFromRegistry(usage)),
          describeModule("modelPrompts", prompts),
        ].join("\n"),
        "info",
      );
    },
  });
}
