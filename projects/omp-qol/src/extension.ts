/**
 * Extension entry: one activation snapshot, four independently controlled
 * modules, and the read-only `/qol` status command.
 *
 * The factory registers lifecycle handlers and the command; it writes no global
 * object of its own. The first `session_start` reads and validates the effective
 * settings through the public OMP getter behind a cached promise, so repeated
 * and concurrent events share one snapshot and register nothing twice. Ordinary
 * session switches do not reread settings; restarting OMP is the refresh.
 *
 * A settings read that fails, a root that is not an object, an unknown key, or a
 * wrong master-switch type keeps every module on native behavior; no module is
 * installed with a default value. Such an activation still stops the compaction
 * patch and the native-replay wrapper another activation left in the process,
 * because both own process-wide state that the unusable settings cannot account
 * for. A fault inside one module's keys disables that module only, and a module
 * that cannot register reports `incompatible` without touching its siblings.
 *
 * The `/qol` compaction and replay lines are resolved from their process
 * registries when the command runs, so a patch or wrapper that stops after this
 * activation is reflected in every session of the process.
 */

import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { getPluginSettings as getPublicPluginSettings } from "@oh-my-pi/pi-coding-agent/extensibility/plugins";
import {
  compactionStatusFromRegistry,
  installCompactionModule,
  NATIVE_COMPACTION_TIMEOUT_MS,
  stopForeignCompactionPatch,
} from "./compaction-timeout.ts";
import { installRecoveryModule } from "./recovery.ts";
import {
  installNativeReplayModule,
  nativeReplayStatusFromRegistry,
  stopForeignNativeReplayPatch,
} from "./native-replay.ts";
import {
  describeProblems,
  MODULE_IDS,
  parseQolSettings,
  type FieldProblem,
  type ModuleId,
  type QolSettings,
} from "./settings.ts";
import { installWaitModule } from "./wait.ts";

export const PACKAGE_NAME = "@ruokee/omp-qol";
export const PACKAGE_VERSION = "0.3.0";
export const COMMAND_NAME = "qol";

let activationSequence = 0;

/**
 * Identity of one activation. Two activations in the same process never share
 * it, so a two-session host can tell "this activation installs again" from
 * "another activation wants the same process-wide resource".
 */
function createRuntimeId(): string {
  activationSequence += 1;
  return `${PACKAGE_NAME}#${PACKAGE_VERSION}#${Date.now().toString(36)}#${activationSequence}#${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/** Why an activation holds a module back before its installer runs. */
export type ModuleOffReason = "master-disabled" | "settings-invalid";

/** Public settings seam used by activation and replaced by tests. */
export type PluginSettingsReader = (packageName: string, cwd: string) => Promise<Record<string, unknown>>;

/**
 * Lifecycle of one module inside the current activation.
 *
 * `pending` means no `session_start` has run yet, `disabled` means a switch is
 * off, `invalid` means this module's keys failed validation, `incompatible`
 * means the host did not offer the interface the module needs, and
 * `unavailable` means the module is not part of this build yet.
 */
export type ModuleStatus = "pending" | "enabled" | "disabled" | "invalid" | "incompatible" | "unavailable";

/** Module status with a bounded reason code and an optional measured detail. */
export interface ModuleState {
  status: ModuleStatus;
  reason?: string;
  /** One measured value of the installed adjustment, such as a rewrite count. */
  detail?: string;
}

/** Everything `/qol` reports and every module reads. */
export interface QolState {
  cwd: string | undefined;
  /** Validated snapshot; undefined when the object was rejected. */
  settings: QolSettings | undefined;
  /** Rejected keys, named without their values. */
  problems: FieldProblem[];
  global: { status: "ok" | "error"; reason?: string };
  modules: Record<ModuleId, ModuleState>;
}

/** Handle returned by {@link activate}; tests and the command read it. */
export interface QolRuntime {
  state: QolState;
  /** The cached activation promise, or undefined before the first `session_start`. */
  activated(): Promise<void> | undefined;
  /** The text `/qol` prints. */
  describe(): string;
}

/** Context handed to a module installer. */
export interface ModuleContext {
  pi: ExtensionAPI;
  ctx: ExtensionContext;
  settings: QolSettings;
  /** Identity of this activation, distinct from every other activation in the process. */
  runtimeId: string;
  /**
   * Set when the master switch or this module's keys keep the module from
   * installing. An installer that guards a process-wide resource is still
   * consulted in that state, so it can stop a conflicting resource.
   */
  off: ModuleOffReason | undefined;
  /** Report one bounded diagnostic per activation, module, and reason. */
  report: (key: string, message: string) => void;
  /**
   * Replace one module's reported status after registration, for a module that
   * can stop working later in the process. Host-free unit tests omit it.
   */
  setStatus?: (id: ModuleId, status: ModuleState) => void;
}

function createInitialState(): QolState {
  const modules = {} as Record<ModuleId, ModuleState>;
  for (const id of MODULE_IDS) modules[id] = { status: "pending" };
  return { cwd: undefined, settings: undefined, problems: [], global: { status: "ok" }, modules };
}

/**
 * Modules consulted even while the master switch or their own keys keep them
 * off. The compaction experiment and the native-replay adjustment each own a
 * process-wide patch, so every activation must be able to see and stop one that
 * its own configuration contradicts.
 */
const CONSULTED_WHILE_OFF: ReadonlySet<ModuleId> = new Set<ModuleId>(["compaction", "replay"]);

/** One line per module: status, reason, and the effective values of that module. */
function describeModule(id: ModuleId, state: ModuleState, settings: QolSettings | undefined): string {
  const detail = state.detail === undefined ? "" : ` (${state.detail})`;
  const head = `${id}: ${state.status}${state.reason === undefined ? "" : ` (${state.reason})`}${detail}`;
  if (settings === undefined) return head;
  if (id === "wait") {
    const wait = settings.wait;
    return `${head} — enabled=${wait.enabled} continueEmptyWindows=${wait.continueEmptyWindows} jobsSeconds=${wait.jobsSeconds} messagesSeconds=${wait.messagesSeconds} processSeconds=${wait.processSeconds}`;
  }
  if (id === "recovery") {
    const recovery = settings.recovery;
    return `${head} — enabled=${recovery.enabled} mode=${recovery.mode} maxAttempts=${recovery.maxAttempts} backoffBaseMs=${recovery.backoffBaseMs} backoffMaxMs=${recovery.backoffMaxMs} notify=${recovery.notify}`;
  }
  if (id === "replay") {
    const replay = settings.replay;
    return `${head} — enabled=${replay.enabled}`;
  }
  const compaction = settings.compaction;
  const floorNote =
    compaction.floorMs > NATIVE_COMPACTION_TIMEOUT_MS
      ? ` — note: floorMs is above the native ${NATIVE_COMPACTION_TIMEOUT_MS} ms request deadline, so the compaction request itself no longer matches`
      : "";
  return `${head} — enabled=${compaction.enabled} timeoutMs=${compaction.timeoutMs} floorMs=${compaction.floorMs} windowGuardMs=${compaction.guardMs} notify=${compaction.notify}${floorNote}`;
}

/**
 * Render the read-only status text. It never lists values outside the settings
 * schema. `resolveModule` may replace a recorded module state with one read from
 * the process when the text is built.
 */
export function describeState(
  state: QolState,
  version = PACKAGE_VERSION,
  resolveModule?: (id: ModuleId, recorded: ModuleState) => ModuleState,
): string {
  const lines: string[] = [`${PACKAGE_NAME} ${version}`];
  lines.push(`activation cwd: ${state.cwd ?? "not activated in this process"}`);
  lines.push(`refresh: restart OMP; settings are read once per activation`);
  lines.push(
    state.global.status === "ok"
      ? `settings: ok`
      : `settings: rejected${state.global.reason === undefined ? "" : ` (${state.global.reason})`}; every module keeps native behavior`,
  );
  for (const id of MODULE_IDS) {
    const recorded = state.modules[id];
    lines.push(describeModule(id, resolveModule?.(id, recorded) ?? recorded, state.settings));
  }
  if (state.problems.length > 0) {
    const scopes = ["global", ...MODULE_IDS] as const;
    const rendered = scopes
      .flatMap((scope) =>
        state.problems
          .filter((problem) => problem.module === scope)
          .map((problem) => `${scope}.${problem.key}=${problem.rule}`),
      )
      .join(" ");
    lines.push(`problems: ${rendered}`);
  }
  return lines.join("\n");
}

/**
 * Install the extension: settings activation, `/qol`, and the module handlers.
 *
 * `readSettings` defaults to the public OMP getter and is replaced in tests.
 */
export function activate(pi: ExtensionAPI, readSettings: PluginSettingsReader = getPublicPluginSettings): QolRuntime {
  const state = createInitialState();
  const reported = new Set<string>();
  const runtimeId = createRuntimeId();
  let sessionCtx: ExtensionContext | undefined;
  let activation: Promise<void> | undefined;

  /** One bounded diagnostic per activation, module, and reason. */
  const report = (key: string, message: string): void => {
    if (reported.has(key)) return;
    reported.add(key);
    try {
      pi.logger?.warn?.(`${PACKAGE_NAME}: ${message}`);
    } catch {
      // Logging must never affect activation.
    }
    try {
      sessionCtx?.ui?.notify?.(`${PACKAGE_NAME}: ${message}`, "warning");
    } catch {
      // UI notifications are best effort.
    }
  };

  /**
   * Stop a patch another activation left in the process when this activation
   * cannot become active at all.
   *
   * The settings failures below install no module and turn none on, so nothing
   * runs with a default-enabled value. They still must not leave a patch from an
   * earlier activation rewriting deadlines, or a wrapper rewriting provider
   * state, under settings this activation could not read: those own process-wide
   * state, and this activation is the one that now knows the settings are
   * unusable.
   */
  const stopPatchFromUnusableSettings = (): void => {
    const stopped = stopForeignCompactionPatch(runtimeId);
    if (stopped !== undefined) {
      report(
        "compaction:runtime-conflict",
        `compaction patch stopped rewriting: this activation has no usable settings and stopped the patch of another omp-qol runtime (${stopped.packageVersion} at ${stopped.cwd})`,
      );
    }
    const stoppedReplay = stopForeignNativeReplayPatch(runtimeId);
    if (stoppedReplay !== undefined) {
      report(
        "replay:runtime-conflict",
        `native replay stopped rewriting: this activation has no usable settings and stopped the wrapper of another omp-qol runtime (${stoppedReplay.packageVersion} at ${stoppedReplay.cwd})`,
      );
    }
  };

  const installModule = (id: ModuleId, install: (context: ModuleContext) => ModuleState): ModuleState => {
    if (sessionCtx === undefined || state.settings === undefined) return { status: "pending" };
    const off: ModuleOffReason | undefined = !state.settings.enabled
      ? "master-disabled"
      : state.problems.some((problem) => problem.module === id)
        ? "settings-invalid"
        : undefined;
    if (off === "settings-invalid") {
      report(`${id}:settings-invalid`, `${id} stays inactive: ${describeProblems(state.problems, id)}`);
    }
    if (off !== undefined && !CONSULTED_WHILE_OFF.has(id)) {
      return off === "master-disabled"
        ? { status: "disabled", reason: "master-disabled" }
        : { status: "invalid", reason: "settings-invalid" };
    }
    try {
      return install({
        pi,
        ctx: sessionCtx,
        settings: state.settings,
        runtimeId,
        off,
        report,
        setStatus: (id, status) => {
          state.modules[id] = status;
        },
      });
    } catch {
      report(`${id}:registration-error`, `${id} could not register and stays inactive`);
      return { status: "incompatible", reason: "registration-error" };
    }
  };

  const runActivation = async (ctx: ExtensionContext): Promise<void> => {
    const cwd = typeof ctx.cwd === "string" ? ctx.cwd : undefined;
    let raw: unknown;
    try {
      raw = await readSettings(PACKAGE_NAME, cwd ?? "");
    } catch {
      state.global = { status: "error", reason: "settings-reader-failed" };
      for (const id of MODULE_IDS) state.modules[id] = { status: "disabled", reason: "settings-reader-failed" };
      report("global:settings-reader-failed", "settings could not be read; every module stays on native behavior");
      stopPatchFromUnusableSettings();
      return;
    }

    const parsed = parseQolSettings(raw);
    if (parsed.kind === "global-error") {
      state.problems = parsed.problems;
      const rootProblem = parsed.problems.some((problem) => problem.rule === "root");
      state.global = { status: "error", reason: rootProblem ? "settings-root-invalid" : "settings-rejected" };
      for (const id of MODULE_IDS) state.modules[id] = { status: "disabled", reason: state.global.reason };
      report(
        "global:settings-rejected",
        `settings were rejected (${parsed.problems.map((problem) => `${problem.key}=${problem.rule}`).join(" ")}); every module stays on native behavior`,
      );
      stopPatchFromUnusableSettings();
      return;
    }

    state.settings = parsed.settings;
    state.problems = parsed.problems;
    for (const id of MODULE_IDS) {
      const text = describeProblems(parsed.problems, id);
      if (text.length > 0) report(`${id}:settings-invalid`, `${id} stays inactive: ${text}`);
    }

    state.modules.wait = installModule("wait", installWaitModule);
    state.modules.recovery = installModule("recovery", installRecoveryModule);
    state.modules.compaction = installModule("compaction", installCompactionModule);
    state.modules.replay = installModule("replay", installNativeReplayModule);
  };

  pi.on("session_start", async (_event, ctx) => {
    sessionCtx = ctx;
    state.cwd ??= typeof ctx.cwd === "string" ? ctx.cwd : undefined;
    activation ??= runActivation(ctx);
    await activation;
  });

  /**
   * Render the status text. The compaction and replay lines are read from the
   * process registries here, so a stop that another activation caused, or that
   * this one caused after activation, shows up in every session of the process.
   */
  const renderState = (): string =>
    describeState(state, PACKAGE_VERSION, (id, recorded) => {
      if (id === "compaction") return compactionStatusFromRegistry(runtimeId, recorded);
      if (id === "replay") return nativeReplayStatusFromRegistry(recorded);
      return recorded;
    });

  pi.registerCommand(COMMAND_NAME, {
    description: "Show the effective omp-qol module states and values (read-only)",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      ctx.ui.notify(renderState(), "info");
    },
  });

  return {
    state,
    activated: () => activation,
    describe: renderState,
  };
}

/** Module installers, filled in by the wait, recovery, compaction, and replay modules. */
export default function ompQolExtension(pi: ExtensionAPI): void {
  activate(pi);
}
