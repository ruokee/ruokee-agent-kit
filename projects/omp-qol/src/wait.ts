/**
 * Wait deadline module.
 *
 * On hosts that expose the legacy built-in `hub`, the extension preserves the
 * existing hub wrapper and its behavior. On hosts whose waiting capability is
 * the parameterless built-in `wait`, the extension replaces that entry with a
 * compatible tool that adds one optional total-deadline parameter. Both paths
 * delegate every native wait window through `ctx.invokeTool`; job ownership,
 * message consumption, process state, and result delivery remain native.
 */

import type {
  AgentToolResult,
  AgentToolUpdateCallback,
  ExtensionAPI,
  ExtensionContext,
  ToolDefinition,
  ToolInfo,
} from "@oh-my-pi/pi-coding-agent";
import type { ModuleContext, ModuleState } from "./extension.ts";
import type { WaitSettings } from "./settings.ts";

export const HUB_TOOL_NAME = "hub";
export const HUB_TOOL_LABEL = "Hub";
export const WAIT_TOOL_NAME = "wait";
export const WAIT_TOOL_LABEL = "Wait";

/**
 * The native wait-window sentence this module replaces. Recognized verbatim
 * from the `18.2.4` tool description; an unrecognized description disables the
 * legacy wrapper instead of advertising two different deadlines.
 */
export const NATIVE_WAIT_WINDOW_SENTENCE =
  "the wait window elapsing (5s, lengthening with each back-to-back wait up to 5m)";

/** `timeout` is the QoL total deadline for job and message waits. */
export const WAIT_TIMEOUT_MAX_SECONDS = 3600;

/** Where a legacy hub wait spends its deadline. Fixed when the call starts. */
export type WaitRoute = "process" | "jobs" | "messages";

/**
 * Argument subset the legacy wrapper inspects. Unknown keys pass through
 * untouched, and the native schema validates the whole call before `execute`.
 */
export type HubWaitParams = {
  op?: string;
  name?: string;
  from?: string;
  ids?: string[];
  follow?: boolean;
  timeout?: number;
  [key: string]: unknown;
};

/** Arguments added to the parameterless native `wait` entry. */
export type NativeWaitParams = { timeout?: number };

/** Result details the wrapper reads back; the native tool owns the full shape. */
export type HubWaitDetails = { op?: string } & Record<string, unknown>;

/** Delegation function taken from the tool call context. */
export type ToolInvoker = (
  params: Record<string, unknown>,
  options?: { signal?: AbortSignal; onUpdate?: AgentToolUpdateCallback },
) => Promise<AgentToolResult>;

/**
 * The host forwards `interruptible` from a registered definition to the agent
 * tool it adapts, but the baseline `ToolDefinition` does not declare the field.
 */
export interface HubWaitToolDefinition extends ToolDefinition {
  parameters: ToolInfo["parameters"];
  execute(
    toolCallId: string,
    params: HubWaitParams,
    signal: AbortSignal | undefined,
    onUpdate: AgentToolUpdateCallback | undefined,
    ctx: ExtensionContext,
  ): Promise<AgentToolResult>;
  interruptible?: boolean | ((params: Partial<HubWaitParams>) => boolean);
}

/** Definition of the new parameterized `wait` entry. */
export interface NativeWaitToolDefinition extends ToolDefinition {
  parameters: ToolInfo["parameters"];
  execute(
    toolCallId: string,
    params: NativeWaitParams,
    signal: AbortSignal | undefined,
    onUpdate: AgentToolUpdateCallback | undefined,
    ctx: ExtensionContext,
  ): Promise<AgentToolResult>;
  interruptible?: boolean;
}

/** Every legacy empty wait-window result and nothing else sets this key set. */
const EMPTY_WINDOW_KEYS: Record<string, true> = {
  op: true,
  meta: true,
  jobs: true,
  agents: true,
  from: true,
  waited: true,
};

/** Native `wait` running snapshots may carry only source metadata beside jobs. */
const RUNNING_JOB_WINDOW_KEYS: Record<string, true> = { op: true, meta: true, jobs: true };

/**
 * Whether a legacy delegated result is a window carrying nothing new:
 * still-running jobs, or a clean message timeout. Structural: text is never
 * inspected, and an empty `jobs` array is not a continuation window.
 */
export function isEmptyWaitWindow(result: AgentToolResult): boolean {
  if (result.isError === true) return false;
  if (result.useless !== true) return false;
  const details = result.details;
  if (typeof details !== "object" || details === null || Array.isArray(details)) return false;
  const fields = details as Record<string, unknown>;
  for (const key of Object.keys(fields)) {
    if (EMPTY_WINDOW_KEYS[key] !== true) return false;
  }
  if (fields.op !== "wait") return false;
  const jobs = fields.jobs;
  if (Array.isArray(jobs) && jobs.length > 0 && jobs.every((job) => isRunningJob(job))) return true;
  return fields.waited === null && typeof fields.from === "string" && fields.from.length > 0;
}

/**
 * The only new-host result eligible for an internal continuation: a nonempty
 * snapshot containing exclusively still-running jobs. Messages, empty job
 * lists, interruptions, cancellations, errors, and service events therefore
 * return after one native call without relying on model-facing text.
 */
export function isRunningJobWaitWindow(result: AgentToolResult): boolean {
  if (result.isError === true || result.useless !== true) return false;
  const details = result.details;
  if (typeof details !== "object" || details === null || Array.isArray(details)) return false;
  const fields = details as Record<string, unknown>;
  for (const key of Object.keys(fields)) {
    if (RUNNING_JOB_WINDOW_KEYS[key] !== true) return false;
  }
  const jobs = fields.jobs;
  return fields.op === "wait" && Array.isArray(jobs) && jobs.length > 0 && jobs.every((job) => isRunningJob(job));
}

function isRunningJob(job: unknown): boolean {
  return typeof job === "object" && job !== null && !Array.isArray(job) && "status" in job && job.status === "running";
}

/** Replace the legacy native wait-window claim with the effective QoL deadline. */
export function rewriteWaitWindowText(description: string, wait: WaitSettings): string | null {
  if (!description.includes(NATIVE_WAIT_WINDOW_SENTENCE)) return null;
  const replacement =
    `the total wait deadline elapsing (default ${wait.jobsSeconds}s for job and mixed waits, ` +
    `${wait.messagesSeconds}s for a message-only wait, or an explicit \`timeout\` in seconds)`;
  return `${description.replace(NATIVE_WAIT_WINDOW_SENTENCE, replacement)}\n\n${hubDeadlineParagraph(wait)}`;
}

function hubDeadlineParagraph(wait: WaitSettings): string {
  return [
    "Wait deadline (omp-qol): one `wait` call keeps waiting while the native window carries nothing new,",
    `up to ${wait.jobsSeconds}s for a job or mixed wait, ${wait.messagesSeconds}s for a message-only wait,`,
    `and ${wait.continueEmptyWindows ? "continuing" : "stopping"} on a certain empty window`,
    `(\`waitContinueEmptyWindows\` is ${wait.continueEmptyWindows}). An explicit \`timeout\` sets the total deadline in seconds,`,
    `must be a finite number in (0, ${WAIT_TIMEOUT_MAX_SECONDS}], and applies to job and message waits.`,
    "Reaching the deadline ends the wait only: it never cancels background jobs or processes,",
    "and a delivered message or settled job is returned as it is.",
    `A wait with \`name\` keeps the native process wait and only fills the default \`timeout\` (${wait.processSeconds}s).`,
  ].join(" ");
}

/** Append the new entry's exact deadline and continuation contract. */
export function rewriteNativeWaitDescription(description: string, wait: WaitSettings): string {
  return `${description}\n\n${[
    `Wait deadline (omp-qol): this \`wait\` entry accepts an optional \`timeout\` total deadline in seconds; omit it to use ${wait.jobsSeconds}s.`,
    `The value must be finite and in (0, ${WAIT_TIMEOUT_MAX_SECONDS}].`,
    `When \`waitContinueEmptyWindows\` is ${wait.continueEmptyWindows}, a native window containing only still-running jobs is ${wait.continueEmptyWindows ? "continued inside this call" : "returned immediately"}.`,
    "Messages, settled or absent jobs, interruptions, cancellations, errors, and service events return as the native tool reports them.",
    "Reaching the deadline ends this call only; background activity keeps running, and a result that already arrived wins.",
    "Message-only empty-window merging, named-process waits, and service-only cross-window waits are not provided by this entry; call `wait` again or read `proc://` when applicable.",
  ].join(" ")}`;
}

/** Where a legacy hub call spends its deadline. */
export function resolveWaitRoute(params: HubWaitParams, runningJobs: () => unknown): WaitRoute {
  if (isNonEmptyString(params.name)) return "process";
  if (Array.isArray(params.ids) && params.ids.length > 0) return "jobs";
  if (isNonEmptyString(params.from) && hasNoRunningJobs(runningJobs())) return "messages";
  return "jobs";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** A read-only snapshot confirms a message-only route; anything unknown stays on jobs. */
function hasNoRunningJobs(snapshot: unknown): boolean {
  if (typeof snapshot !== "object" || snapshot === null || Array.isArray(snapshot) || !("running" in snapshot)) {
    return false;
  }
  return Array.isArray(snapshot.running) && snapshot.running.length === 0;
}

/** Deadline decision for one wait call. */
export type WaitDeadline = { kind: "deadline"; seconds: number } | { kind: "invalid"; text: string };

/**
 * An explicit `timeout` wins over the configured default. It must be a finite
 * number of seconds within the accepted range; out-of-range values are a
 * parameter error, never a silent clamp.
 */
export function resolveWaitDeadline(params: NativeWaitParams, route: WaitRoute, wait: WaitSettings): WaitDeadline {
  const fallback =
    route === "messages" ? wait.messagesSeconds : route === "process" ? wait.processSeconds : wait.jobsSeconds;
  const explicit = params.timeout;
  if (explicit === undefined) return { kind: "deadline", seconds: fallback };
  if (
    typeof explicit !== "number" ||
    !Number.isFinite(explicit) ||
    explicit <= 0 ||
    explicit > WAIT_TIMEOUT_MAX_SECONDS
  ) {
    return {
      kind: "invalid",
      text:
        `\`timeout\` for a wait must be a finite number of seconds in (0, ${WAIT_TIMEOUT_MAX_SECONDS}], ` +
        `and it is the total wait deadline. Omit \`timeout\` to use the configured default (${fallback}s).`,
    };
  }
  return { kind: "deadline", seconds: explicit };
}

/** Clock, classification, rendering, and scheduling seams of the deadline loop. */
export interface WaitLoopDeps {
  invoke: ToolInvoker;
  /** Arguments for every native window; the QoL deadline is not forwarded. */
  forward: Record<string, unknown>;
  deadlineSeconds: number;
  continueEmptyWindows: boolean;
  signal: AbortSignal | undefined;
  onUpdate: AgentToolUpdateCallback | undefined;
  isContinuationWindow: (result: AgentToolResult) => boolean;
  deadlineResult: (lastWindow: AgentToolResult | undefined, deadlineSeconds: number) => AgentToolResult;
  /** Monotonic milliseconds. */
  now: () => number;
  /** Run `callback` once after `ms`, returning a cancel function. */
  schedule: (ms: number, callback: () => void) => () => void;
}

/** Whether the native host classified its rejection as an abort from this expired window. */
function isDeadlineAbortFailure(failure: unknown, deadlineReason: Error): boolean {
  if (failure === deadlineReason) return true;
  if (typeof failure !== "object" || failure === null) return false;
  if ("name" in failure && (failure.name === "ToolAbortError" || failure.name === "AbortError")) return true;
  // The delegated 18.4.3 host boundary normalizes ToolAbortError to this reserved Error message.
  return "message" in failure && failure.message === "Operation aborted";
}

/**
 * Delegate native windows until one carries real information or the deadline
 * passes. The deadline aborts only the in-flight window; a result that arrives
 * anyway is delivered unchanged, and an outer cancellation keeps its reason.
 */
export async function runWaitLoop(deps: WaitLoopDeps): Promise<AgentToolResult> {
  const deadlineAt = deps.now() + deps.deadlineSeconds * 1000;
  const deadlineReason = new Error("omp-qol wait deadline");
  const controller = new AbortController();
  const composite = deps.signal ? AbortSignal.any([deps.signal, controller.signal]) : controller.signal;
  let deadlineElapsed = false;
  const cancelTimer = deps.schedule(Math.max(0, deadlineAt - deps.now()), () => {
    deadlineElapsed = true;
    controller.abort(deadlineReason);
  });

  let lastWindow: AgentToolResult | undefined;
  try {
    for (;;) {
      let result: AgentToolResult | undefined;
      let failure: unknown;
      try {
        result = await deps.invoke(deps.forward, { signal: composite, onUpdate: deps.onUpdate });
      } catch (error) {
        failure = error;
      }
      if (result !== undefined && !deps.isContinuationWindow(result)) return result;
      if (result !== undefined) lastWindow = result;

      // An outer cancellation outranks the QoL deadline and keeps its own reason.
      if (deps.signal?.aborted === true) {
        const reason = deps.signal.reason instanceof Error ? deps.signal.reason : new Error("wait aborted");
        throw reason;
      }
      if (result === undefined) {
        if (deadlineElapsed && isDeadlineAbortFailure(failure, deadlineReason)) {
          return deps.deadlineResult(lastWindow, deps.deadlineSeconds);
        }
        throw failure;
      }
      if (deadlineElapsed || deps.now() >= deadlineAt) return deps.deadlineResult(lastWindow, deps.deadlineSeconds);
      if (!deps.continueEmptyWindows) return result;
    }
  } finally {
    cancelTimer();
  }
}

/** Legacy deadline output, preserved for the hub entry. */
export function waitDeadlineResult(lastWindow: AgentToolResult | undefined, deadlineSeconds: number): AgentToolResult {
  const text =
    `Wait deadline reached after ${deadlineSeconds}s without new information. ` +
    "Background jobs and processes keep running; re-issue `wait` or read `jobs` to check them.";
  if (lastWindow === undefined) return { content: [{ type: "text", text }], details: { op: "wait" } };
  return { ...lastWindow, content: [...lastWindow.content, { type: "text", text }] };
}

/** Deadline output for the standalone `wait` entry and its available status routes. */
export function nativeWaitDeadlineResult(
  lastWindow: AgentToolResult | undefined,
  deadlineSeconds: number,
): AgentToolResult {
  const text =
    `Wait deadline reached after ${deadlineSeconds}s without new information. ` +
    "Background jobs and processes keep running; call `wait` again or read `proc://` for status.";
  if (lastWindow === undefined) return { content: [{ type: "text", text }], details: { op: "wait", jobs: [] } };
  const { useless: _useless, ...base } = lastWindow;
  return { ...base, content: [...lastWindow.content, { type: "text", text }] };
}

/** Native approval tiers for the legacy hub tool. */
export function hubApproval(params: unknown): "read" | "exec" {
  if (typeof params !== "object" || params === null || Array.isArray(params) || !("op" in params)) return "exec";
  switch (params.op) {
    case "wait":
    case "inbox":
    case "list":
    case "jobs":
    case "cancel":
    case "ps":
    case "logs":
    case "describe":
      return "read";
    case "send": {
      const name = "name" in params ? params.name : undefined;
      const to = "to" in params ? params.to : undefined;
      return typeof name === "string" && name.length > 0 && !to ? "exec" : "read";
    }
    default:
      return "exec";
  }
}

/** Legacy waits and followed log reads stay interruptible. */
export function hubInterruptible(params: Partial<HubWaitParams>): boolean {
  if (params.op === "wait") return true;
  return params.op === "logs" && params.follow === true;
}

/** The legacy tool description is model-facing text and carries no user data. */
export function createWaitDefinition(native: ToolInfo, description: string, wait: WaitSettings): HubWaitToolDefinition {
  return {
    name: HUB_TOOL_NAME,
    label: HUB_TOOL_LABEL,
    description,
    parameters: native.parameters,
    approval: hubApproval,
    strict: true,
    loadMode: "essential",
    interruptible: hubInterruptible,
    execute: (toolCallId, params, signal, onUpdate, ctx) =>
      executeHubWait(toolCallId, params, signal, onUpdate, ctx, wait),
  };
}

/** Build the parameterized standalone wait definition from the host's schema namespace. */
export function createNativeWaitDefinition(
  pi: ExtensionAPI,
  description: string,
  wait: WaitSettings,
): NativeWaitToolDefinition {
  const { z } = pi.zod;
  const parameters = z
    .object({
      timeout: z
        .number()
        .positive()
        .max(WAIT_TIMEOUT_MAX_SECONDS)
        .optional()
        .describe(`Total wait deadline in seconds. Omit to use ${wait.jobsSeconds}s.`),
    })
    .strict();
  return {
    name: WAIT_TOOL_NAME,
    label: WAIT_TOOL_LABEL,
    description,
    parameters: parameters as unknown as ToolInfo["parameters"],
    approval: "read",
    strict: true,
    loadMode: "essential",
    interruptible: true,
    execute: (toolCallId, params, signal, onUpdate, ctx) =>
      executeNativeWait(toolCallId, params, signal, onUpdate, ctx, wait),
  };
}

function errorResult(text: string, details: HubWaitDetails): AgentToolResult {
  return { content: [{ type: "text", text }], details, isError: true };
}

async function executeHubWait(
  _toolCallId: string,
  params: HubWaitParams,
  signal: AbortSignal | undefined,
  onUpdate: AgentToolUpdateCallback | undefined,
  ctx: ExtensionContext,
  wait: WaitSettings,
): Promise<AgentToolResult> {
  const invoke: ToolInvoker | undefined = ctx.invokeTool;
  if (typeof invoke !== "function") {
    return errorResult(
      "hub wait could not run: this host does not expose ctx.invokeTool for an extension tool that replaces a built-in.",
      { op: "wait" },
    );
  }

  if (params.op !== "wait") return invoke({ ...params }, { signal, onUpdate });

  if (isNonEmptyString(params.name)) {
    const forwarded = params.timeout === undefined ? { ...params, timeout: wait.processSeconds } : { ...params };
    return invoke(forwarded, { signal, onUpdate });
  }

  const route = resolveWaitRoute(params, () => readSnapshot(ctx));
  const deadline = resolveWaitDeadline(params, route, wait);
  if (deadline.kind === "invalid") return errorResult(deadline.text, { op: "wait" });

  const { timeout: _deadline, ...forward } = params;
  return runWaitLoop({
    invoke,
    forward,
    deadlineSeconds: deadline.seconds,
    continueEmptyWindows: wait.continueEmptyWindows,
    signal,
    onUpdate,
    isContinuationWindow: isEmptyWaitWindow,
    deadlineResult: waitDeadlineResult,
    now: () => performance.now(),
    schedule: (ms, callback) => {
      const timer = setTimeout(callback, ms);
      return () => clearTimeout(timer);
    },
  });
}

async function executeNativeWait(
  _toolCallId: string,
  params: NativeWaitParams,
  signal: AbortSignal | undefined,
  onUpdate: AgentToolUpdateCallback | undefined,
  ctx: ExtensionContext,
  wait: WaitSettings,
): Promise<AgentToolResult> {
  const invoke: ToolInvoker | undefined = ctx.invokeTool;
  if (typeof invoke !== "function") {
    return errorResult(
      "wait could not run: this host does not expose ctx.invokeTool for an extension tool that replaces a built-in.",
      { op: "wait", jobs: [] },
    );
  }
  const deadline = resolveWaitDeadline(params, "jobs", wait);
  if (deadline.kind === "invalid") return errorResult(deadline.text, { op: "wait", jobs: [] });
  return runWaitLoop({
    invoke,
    forward: {},
    deadlineSeconds: deadline.seconds,
    continueEmptyWindows: wait.continueEmptyWindows,
    signal,
    onUpdate,
    isContinuationWindow: isRunningJobWaitWindow,
    deadlineResult: nativeWaitDeadlineResult,
    now: () => performance.now(),
    schedule: (ms, callback) => {
      const timer = setTimeout(callback, ms);
      return () => clearTimeout(timer);
    },
  });
}

/** Read-only legacy job snapshot; unknown shapes leave the wait on the jobs route. */
function readSnapshot(ctx: ExtensionContext): unknown {
  try {
    return ctx.getAsyncJobSnapshot();
  } catch {
    return undefined;
  }
}

/** Register the legacy hub wrapper, or the standalone wait wrapper when hub is absent. */
export function installWaitModule(context: ModuleContext): ModuleState {
  const { pi, settings, report } = context;
  const wait = settings.wait;
  if (!wait.enabled) return { status: "disabled", reason: "wait-disabled" };

  const tools = pi.getAllTools();
  const nativeHub = tools.find((tool) => tool.name === HUB_TOOL_NAME);
  if (nativeHub !== undefined) return installHubWait(pi, nativeHub, wait, report);

  const nativeWait = tools.find((tool) => tool.name === WAIT_TOOL_NAME);
  if (nativeWait === undefined) {
    report("wait:wait-tool-absent", "wait stays inactive: this session exposes neither built-in `hub` nor `wait`");
    return { status: "unavailable", reason: "wait-tool-absent" };
  }
  if (nativeWait.sourceInfo.source !== "builtin") {
    report("wait:wait-tool-shadowed", "wait stays inactive: another extension already replaced the `wait` tool");
    return { status: "incompatible", reason: "wait-tool-shadowed" };
  }
  if (!isNativeEmptyWaitSchema(nativeWait.parameters)) {
    report(
      "wait:wait-schema-unrecognized",
      "wait stays inactive: the built-in `wait` parameters are not the expected empty object schema",
    );
    return { status: "incompatible", reason: "wait-schema-unrecognized" };
  }
  if (!hasNativeWaitSchemaBuilder(pi)) {
    report(
      "wait:wait-schema-builder-absent",
      "wait stays inactive: this host exposes no usable `pi.zod` schema builder",
    );
    return { status: "incompatible", reason: "wait-schema-builder-absent" };
  }

  pi.registerTool(createNativeWaitDefinition(pi, rewriteNativeWaitDescription(nativeWait.description, wait), wait));
  return {
    status: "enabled",
    detail:
      `entry=wait effectiveDefaultSeconds=${wait.jobsSeconds} ` +
      "messageContinuation=not-applicable processWait=not-applicable serviceContinuation=not-applicable",
  };
}

function installHubWait(
  pi: ExtensionAPI,
  native: ToolInfo,
  wait: WaitSettings,
  report: (key: string, message: string) => void,
): ModuleState {
  if (native.sourceInfo.source !== "builtin") {
    report("wait:hub-tool-shadowed", "hub wait stays inactive: another extension already replaced the `hub` tool");
    return { status: "incompatible", reason: "hub-tool-shadowed" };
  }
  const description = rewriteWaitWindowText(native.description, wait);
  if (description === null) {
    report(
      "wait:hub-description-unrecognized",
      "hub wait stays inactive: the native `hub` description has no recognizable wait-window text",
    );
    return { status: "unavailable", reason: "hub-description-unrecognized" };
  }
  if (!isReusableSchema(native.parameters)) {
    report("wait:hub-schema-unrecognized", "hub wait stays inactive: the native `hub` parameters are not a schema");
    return { status: "incompatible", reason: "hub-schema-unrecognized" };
  }

  pi.registerTool(createWaitDefinition(native, description, wait));
  return { status: "enabled", detail: "entry=hub" };
}

/** Recognize the parameterless object schema of the 18.4.3 built-in wait tool. */
export function isNativeEmptyWaitSchema(value: unknown): boolean {
  if (typeof value !== "function" || !("ir" in value)) return false;
  const ir = value.ir;
  if (typeof ir !== "object" || ir === null || Array.isArray(ir)) return false;
  const fields = ir as Record<string, unknown>;
  return (
    fields.k === "object" &&
    Array.isArray(fields.props) &&
    fields.props.length === 0 &&
    fields.index === undefined &&
    fields.symbolIndex === undefined &&
    fields.patternIndexes === undefined
  );
}

function hasNativeWaitSchemaBuilder(pi: ExtensionAPI): boolean {
  // The baseline host type omits the runtime schema namespace used by extensions.
  const runtime = pi as unknown as { zod?: { z?: Record<string, unknown> } };
  const z = runtime.zod?.z;
  return typeof z?.object === "function" && typeof z.number === "function";
}

/** The legacy native parameter schema is reused unchanged. */
function isReusableSchema(value: unknown): boolean {
  if (typeof value === "function") return true;
  if (typeof value !== "object" || value === null || Array.isArray(value) || !("properties" in value)) return false;
  return typeof value.properties === "object" && value.properties !== null && !Array.isArray(value.properties);
}
