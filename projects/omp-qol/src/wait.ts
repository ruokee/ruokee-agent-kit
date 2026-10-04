/**
 * Wait deadline module.
 *
 * The host's waiting capability is the parameterless built-in `wait`. The
 * extension replaces that entry with a compatible tool that adds one optional
 * total-deadline parameter and delegates every native wait window through
 * `ctx.invokeTool`; job ownership, message consumption, process state, and
 * result delivery remain native.
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

export const WAIT_TOOL_NAME = "wait";
export const WAIT_TOOL_LABEL = "Wait";

/** `timeout` is the QoL total deadline of one `wait` call. */
export const WAIT_TIMEOUT_MAX_SECONDS = 3600;

/** Arguments added to the parameterless native `wait` entry. */
export type NativeWaitParams = { timeout?: number };

/** Delegation function taken from the tool call context. */
export type ToolInvoker = (
  params: Record<string, unknown>,
  options?: { signal?: AbortSignal; onUpdate?: AgentToolUpdateCallback },
) => Promise<AgentToolResult>;

/**
 * Definition of the parameterized `wait` entry. The host forwards
 * `interruptible` from a registered definition to the agent tool it adapts,
 * but the baseline `ToolDefinition` does not declare the field.
 */
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

/** Native `wait` running snapshots may carry only source metadata beside jobs. */
const RUNNING_JOB_WINDOW_KEYS: Record<string, true> = { op: true, meta: true, jobs: true };

/**
 * The only result eligible for an internal continuation: a nonempty snapshot
 * containing exclusively still-running jobs. Messages, empty job lists,
 * interruptions, cancellations, errors, and service events therefore return
 * after one native call without relying on model-facing text.
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

/** Append the entry's exact deadline and continuation contract. */
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

/** Deadline decision for one wait call. */
export type WaitDeadline = { kind: "deadline"; seconds: number } | { kind: "invalid"; text: string };

/**
 * An explicit `timeout` wins over `waitJobsSeconds`. It must be a finite number
 * of seconds within the accepted range; out-of-range values are a parameter
 * error, never a silent clamp.
 */
export function resolveWaitDeadline(params: NativeWaitParams, wait: WaitSettings): WaitDeadline {
  const explicit = params.timeout;
  if (explicit === undefined) return { kind: "deadline", seconds: wait.jobsSeconds };
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
        `and it is the total wait deadline. Omit \`timeout\` to use the configured default (${wait.jobsSeconds}s).`,
    };
  }
  return { kind: "deadline", seconds: explicit };
}

/** Clock and scheduling seams of the deadline loop. */
export interface WaitLoopDeps {
  invoke: ToolInvoker;
  deadlineSeconds: number;
  continueEmptyWindows: boolean;
  signal: AbortSignal | undefined;
  onUpdate: AgentToolUpdateCallback | undefined;
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
  // The delegated host boundary normalizes ToolAbortError to this reserved Error message.
  return "message" in failure && failure.message === "Operation aborted";
}

/**
 * Delegate native windows with `{}` until one carries real information or the
 * deadline passes. The deadline aborts only the in-flight window; a result
 * that arrives anyway is delivered unchanged, and an outer cancellation keeps
 * its reason.
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
        result = await deps.invoke({}, { signal: composite, onUpdate: deps.onUpdate });
      } catch (error) {
        failure = error;
      }
      if (result !== undefined && !isRunningJobWaitWindow(result)) return result;
      if (result !== undefined) lastWindow = result;

      // An outer cancellation outranks the QoL deadline and keeps its own reason.
      if (deps.signal?.aborted === true) {
        const reason = deps.signal.reason instanceof Error ? deps.signal.reason : new Error("wait aborted");
        throw reason;
      }
      if (result === undefined) {
        if (deadlineElapsed && isDeadlineAbortFailure(failure, deadlineReason)) {
          return nativeWaitDeadlineResult(lastWindow, deps.deadlineSeconds);
        }
        throw failure;
      }
      if (deadlineElapsed || deps.now() >= deadlineAt)
        return nativeWaitDeadlineResult(lastWindow, deps.deadlineSeconds);
      if (!deps.continueEmptyWindows) return result;
    }
  } finally {
    cancelTimer();
  }
}

/** Deadline output: the last running snapshot, if any, plus one note. */
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

/** Build the parameterized wait definition from the host's schema namespace. */
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

function errorResult(text: string): AgentToolResult {
  return { content: [{ type: "text", text }], details: { op: "wait", jobs: [] }, isError: true };
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
    );
  }
  const deadline = resolveWaitDeadline(params, wait);
  if (deadline.kind === "invalid") return errorResult(deadline.text);
  return runWaitLoop({
    invoke,
    deadlineSeconds: deadline.seconds,
    continueEmptyWindows: wait.continueEmptyWindows,
    signal,
    onUpdate,
    now: () => performance.now(),
    schedule: (ms, callback) => {
      const timer = setTimeout(callback, ms);
      return () => clearTimeout(timer);
    },
  });
}

/** Re-register the recognized built-in `wait` with the optional total deadline. */
export function installWaitModule(context: ModuleContext): ModuleState {
  const { pi, settings, report } = context;
  const wait = settings.wait;
  if (!wait.enabled) return { status: "disabled", reason: "wait-disabled" };

  const nativeWait = pi.getAllTools().find((tool) => tool.name === WAIT_TOOL_NAME);
  if (nativeWait === undefined) {
    report("wait:wait-tool-absent", "wait stays inactive: this session exposes no built-in `wait`");
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

/** Recognize the parameterless object schema of the built-in wait tool. */
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
