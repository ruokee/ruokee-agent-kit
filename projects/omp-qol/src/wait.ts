/**
 * hub wait module.
 *
 * Registers a `hub` tool that owns the same name as the native built-in and
 * delegates every call back to it through `ctx.invokeTool`. Non-wait operations
 * are untouched. A `wait` gets a total deadline: while a native window is
 * certain to carry nothing new, the wrapper keeps waiting inside the same call
 * instead of handing the model an empty frame.
 *
 * The wrapper never manages jobs, messages, or processes itself. Ownership of
 * background work, message consumption, and result delivery stays with the
 * native hub.
 */

import type {
  AgentToolResult,
  AgentToolUpdateCallback,
  ExtensionContext,
  ToolDefinition,
  ToolInfo,
} from "@oh-my-pi/pi-coding-agent";
import type { ModuleContext, ModuleState } from "./extension.ts";
import type { WaitSettings } from "./settings.ts";

export const HUB_TOOL_NAME = "hub";
export const HUB_TOOL_LABEL = "Hub";

/**
 * The native wait-window sentence this module replaces. Recognized verbatim
 * from the `18.2.4` tool description; an unrecognized description disables the
 * wrapper instead of advertising two different deadlines.
 */
export const NATIVE_WAIT_WINDOW_SENTENCE =
  "the wait window elapsing (5s, lengthening with each back-to-back wait up to 5m)";

/** `timeout` is the QoL total deadline for job and message waits. */
export const WAIT_TIMEOUT_MAX_SECONDS = 3600;

/** Where a wait spends its deadline. Fixed when the call starts. */
export type WaitRoute = "process" | "jobs" | "messages";

/**
 * Argument subset the wrapper inspects. Unknown keys pass through untouched,
 * and the native schema keeps validating the whole call before `execute` runs.
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

/** Result details the wrapper reads back; the native hub owns the full shape. */
export type HubWaitDetails = { op?: string } & Record<string, unknown>;

/** Delegation function taken from the tool call context. */
export type ToolInvoker = (
  params: Record<string, unknown>,
  options?: { signal?: AbortSignal; onUpdate?: AgentToolUpdateCallback },
) => Promise<AgentToolResult>;

/**
 * The host forwards `interruptible` from a registered definition to the agent
 * tool it adapts, but `ToolDefinition` does not declare the field. This is the
 * only place the gap is expressed.
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

/** Every native wait-window result and nothing else sets this key set. */
const EMPTY_WINDOW_KEYS = new Set(["op", "meta", "jobs", "agents", "from", "waited"]);

/**
 * Whether a delegated result is a window carrying nothing new: still-running
 * jobs, or a clean message timeout. Structural: text is never inspected, and an
 * empty `jobs` array (nothing matched, nothing to wait for) is not a window.
 */
export function isEmptyWaitWindow(result: AgentToolResult): boolean {
  if (result.isError === true) return false;
  if (result.useless !== true) return false;
  const details = result.details;
  if (typeof details !== "object" || details === null || Array.isArray(details)) return false;
  for (const key of Object.keys(details)) {
    if (!EMPTY_WINDOW_KEYS.has(key)) return false;
  }
  const window = details as Record<string, unknown>;
  if (window.op !== "wait") return false;
  const jobs = window.jobs;
  if (Array.isArray(jobs) && jobs.length > 0 && jobs.every((job) => isRunningJob(job))) return true;
  return window.waited === null && typeof window.from === "string" && window.from.length > 0;
}

function isRunningJob(job: unknown): boolean {
  if (typeof job !== "object" || job === null) return false;
  return (job as { status?: unknown }).status === "running";
}

/** Replace the native wait-window claim with the effective QoL deadline. */
export function rewriteWaitWindowText(description: string, wait: WaitSettings): string | null {
  if (!description.includes(NATIVE_WAIT_WINDOW_SENTENCE)) return null;
  const replacement =
    `the total wait deadline elapsing (default ${wait.jobsSeconds}s for job and mixed waits, ` +
    `${wait.messagesSeconds}s for a message-only wait, or an explicit \`timeout\` in seconds)`;
  return `${description.replace(NATIVE_WAIT_WINDOW_SENTENCE, replacement)}\n\n${deadlineParagraph(wait)}`;
}

function deadlineParagraph(wait: WaitSettings): string {
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

/** Where this call spends its deadline. */
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
  if (typeof snapshot !== "object" || snapshot === null) return false;
  const running = (snapshot as { running?: unknown }).running;
  return Array.isArray(running) && running.length === 0;
}

/** Deadline decision for one wait call. */
export type WaitDeadline = { kind: "deadline"; seconds: number } | { kind: "invalid"; text: string };

/**
 * An explicit `timeout` wins over the configured default. It must be a finite
 * number of seconds within the accepted range; out-of-range values are a
 * parameter error, never a silent clamp.
 */
export function resolveWaitDeadline(params: HubWaitParams, route: WaitRoute, wait: WaitSettings): WaitDeadline {
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
        `\`timeout\` for a hub wait must be a finite number of seconds in (0, ${WAIT_TIMEOUT_MAX_SECONDS}], ` +
        `and it is the total wait deadline. Omit \`timeout\` to use the configured default (${fallback}s).`,
    };
  }
  return { kind: "deadline", seconds: explicit };
}

/** Clock and scheduling seams of the deadline loop. */
export interface WaitLoopDeps {
  invoke: ToolInvoker;
  /** Arguments for every native window; the QoL deadline is not forwarded. */
  forward: Record<string, unknown>;
  deadlineSeconds: number;
  continueEmptyWindows: boolean;
  signal: AbortSignal | undefined;
  onUpdate: AgentToolUpdateCallback | undefined;
  now: () => number;
  /** Run `callback` once after `ms`, returning a cancel function. */
  schedule: (ms: number, callback: () => void) => () => void;
}

/**
 * Delegate native windows until one carries real information or the deadline
 * passes. The deadline aborts only the in-flight window; a result that arrives
 * anyway is delivered unchanged, and an outer cancellation is never reported as
 * a deadline.
 */
export async function runWaitLoop(deps: WaitLoopDeps): Promise<AgentToolResult> {
  const deadlineAt = deps.now() + deps.deadlineSeconds * 1000;
  const controller = new AbortController();
  const composite = deps.signal ? AbortSignal.any([deps.signal, controller.signal]) : controller.signal;
  let deadlineElapsed = false;
  const cancelTimer = deps.schedule(Math.max(0, deadlineAt - deps.now()), () => {
    deadlineElapsed = true;
    controller.abort(new Error("omp-qol wait deadline"));
  });

  let lastEmpty: AgentToolResult | undefined;
  try {
    for (;;) {
      let result: AgentToolResult | undefined;
      let failure: unknown;
      try {
        result = await deps.invoke(deps.forward, { signal: composite, onUpdate: deps.onUpdate });
      } catch (error) {
        failure = error;
      }
      if (result !== undefined && !isEmptyWaitWindow(result)) return result;
      if (result !== undefined) lastEmpty = result;

      // An outer cancellation outranks the QoL deadline and keeps its own reason.
      if (deps.signal?.aborted === true) throw abortReason(deps.signal);
      if (deadlineElapsed || deps.now() >= deadlineAt) return waitDeadlineResult(lastEmpty, deps.deadlineSeconds);
      if (result === undefined) throw failure;
      if (!deps.continueEmptyWindows) return result;
    }
  } finally {
    cancelTimer();
  }
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason instanceof Error ? signal.reason : new Error("hub wait aborted");
}

/** Last certain empty window plus the deadline note, or a minimal text result when none existed. */
export function waitDeadlineResult(lastEmpty: AgentToolResult | undefined, deadlineSeconds: number): AgentToolResult {
  const text =
    `Wait deadline reached after ${deadlineSeconds}s without new information. ` +
    "Background jobs and processes keep running; re-issue `wait` or read `jobs` to check them.";
  if (lastEmpty === undefined) return { content: [{ type: "text", text }], details: { op: "wait" } };
  return { ...lastEmpty, content: [...lastEmpty.content, { type: "text", text }] };
}

/** Native approval tiers: messaging, jobs, and inspection are read-only; process mutation is exec. */
export function hubApproval(params: unknown): "read" | "exec" {
  if (typeof params !== "object" || params === null || !("op" in params)) return "exec";
  const op = (params as { op?: unknown }).op;
  switch (op) {
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
      const name = (params as { name?: unknown }).name;
      const to = (params as { to?: unknown }).to;
      return typeof name === "string" && name.length > 0 && !to ? "exec" : "read";
    }
    default:
      return "exec";
  }
}

/** Waits and followed log reads stay interruptible, exactly as the native tool declares. */
export function hubInterruptible(params: Partial<HubWaitParams>): boolean {
  if (params.op === "wait") return true;
  return params.op === "logs" && params.follow === true;
}

/** The tool description is model-facing text and carries no user data. */
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
      executeWait(toolCallId, params, signal, onUpdate, ctx, wait),
  };
}

function errorResult(text: string, details: HubWaitDetails): AgentToolResult {
  return { content: [{ type: "text", text }], details, isError: true };
}

async function executeWait(
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
    // Process waits keep the native behavior; only a missing timeout is filled.
    const forwarded = params.timeout === undefined ? { ...params, timeout: wait.processSeconds } : { ...params };
    return invoke(forwarded, { signal, onUpdate });
  }

  const route = resolveWaitRoute(params, () => readSnapshot(ctx));
  const deadline = resolveWaitDeadline(params, route, wait);
  if (deadline.kind === "invalid") return errorResult(deadline.text, { op: "wait" });

  // `timeout` is the QoL deadline here, so the native window keeps its own
  // adaptive ladder instead of interpreting the parameter.
  const { timeout: _deadline, ...forward } = params;
  return runWaitLoop({
    invoke,
    forward,
    deadlineSeconds: deadline.seconds,
    continueEmptyWindows: wait.continueEmptyWindows,
    signal,
    onUpdate,
    now: () => Date.now(),
    schedule: (ms, callback) => {
      const timer = setTimeout(callback, ms);
      return () => clearTimeout(timer);
    },
  });
}

/** Read-only job snapshot; unknown shapes leave the wait on the jobs route. */
function readSnapshot(ctx: ExtensionContext): unknown {
  try {
    return ctx.getAsyncJobSnapshot();
  } catch {
    return undefined;
  }
}

/**
 * Register the wrapper when the native hub is intact, and report the one reason
 * it stays inactive otherwise.
 */
export function installWaitModule(context: ModuleContext): ModuleState {
  const { pi, settings, report } = context;
  const wait = settings.wait;
  if (!wait.enabled) return { status: "disabled", reason: "wait-disabled" };

  const native = pi.getAllTools().find((tool) => tool.name === HUB_TOOL_NAME);
  if (native === undefined) {
    report("wait:hub-tool-absent", "hub wait stays inactive: this session exposes no built-in `hub` tool");
    return { status: "unavailable", reason: "hub-tool-absent" };
  }
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
  return { status: "enabled" };
}

/** The native parameter schema is reused as it is; a non-schema value means a foreign hub. */
function isReusableSchema(value: unknown): boolean {
  if (typeof value === "function") return true;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return (
    typeof (value as { properties?: unknown }).properties === "object" &&
    (value as { properties?: unknown }).properties !== null
  );
}
