/**
 * Compaction request usage module.
 *
 * OMP sends its own summarization requests when a session compacts, and the
 * provider reports usage for each one, but that usage never reaches the session
 * journal: `model_usage` entries and the session statistics that read them omit
 * the `soft` method's summary, short-summary, and turn-prefix calls and the
 * `handoff` request, so a session file understates what the session cost.
 * Upstream tracks the gap as issue #15031 and fixes it in pull request #15034;
 * until a released host records these requests itself, this module supplies the
 * step the host skips.
 *
 * The host already collects the usage on its telemetry channel: each of these
 * requests runs through one instrumented completion wrapper that emits a
 * chat-usage event carrying the provider's token and cost data. That channel is
 * off in a default installation, because the agent has no telemetry
 * configuration and the wrapper then creates no span and emits no event. The
 * module therefore replaces the `telemetry` accessor on the host's `Agent`
 * prototype and hands back a configuration that is the user's own when there is
 * one, extended by the three hooks this module needs. The request is identified
 * by the oneshot kind the host stamps on the span of that request alone, read
 * from the wrapper this module puts around the tracer and the spans it returns.
 *
 * One completed request becomes one usage entry, written through the session
 * manager's own entry API with the purpose upstream will use, so the host's own
 * statistics count it in its session totals and the totals stay comparable with
 * the released fix. Requests outside that kind list and attempts that consumed
 * no tokens write nothing and are not counted. A session the module never saw
 * start, or a model it cannot resolve, also writes nothing and is counted for
 * `/qol` instead.
 *
 * The patch is process-wide, so it serves every session in the process and
 * outlives the activation that installed it: one registry slot holds it, an
 * activation that cannot read its settings stops a foreign one, and `/qol`
 * reads the live state rather than the result one activation recorded.
 */

import * as agentCore from "@oh-my-pi/pi-agent-core";
import { PACKAGE_VERSION, type ModuleContext, type ModuleState } from "./extension.ts";

/** Component-owned slot holding the process-global patch registry. */
const REGISTRY_KEY = Symbol.for("ruokee.omp-qol.usage-compensation.registry");

/** Registry layout this component understands. */
export const USAGE_REGISTRY_SCHEMA = 1;

/** How many sessions and unclaimed requests one process keeps at most. */
export const MAX_REGISTERED_SESSIONS = 32;
export const MAX_PENDING_REQUESTS = 64;

/**
 * Oneshot kinds that describe a compaction or handoff request, mapped to the
 * purpose upstream records for that request.
 *
 * The list is closed on purpose: `compaction_native` and `branch_summary` are
 * requests of the same family that the released fix does not record either, and
 * every other kind the host labels (evaluation completions, skill descriptions,
 * image questions) belongs to a caller whose usage the host already accounts
 * for. See `packages/agent/src/compaction/compaction.ts` and `session-handoff.ts`.
 */
export const COMPACTION_PURPOSES: ReadonlyMap<string, string> = new Map([
  ["compaction_summary", "compaction:summary"],
  ["compaction_short_summary", "compaction:short-summary"],
  ["compaction_turn_prefix", "compaction:turn-prefix"],
  ["handoff", "compaction:handoff"],
]);

/** Span attribute carrying the oneshot kind of the request that owns the span. */
export const ONESHOT_KIND_ATTRIBUTE = "omp.gen_ai.oneshot.kind";
/** Span attribute carrying the response finish reasons. */
export const FINISH_REASONS_ATTRIBUTE = "gen_ai.response.finish_reasons";

/** Token buckets one chat step reported, as the usage event carries them. */
export interface UsageSnapshotLike {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  cacheWriteTokens?: number;
}

/** Provider-computed per-component cost of one request, as the host persists it. */
export interface UsageCostLike {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
}

/** Token usage and cost of one request, in the shape the session journal stores. */
export interface WrittenUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: UsageCostLike;
}

/** Stop reason values the session journal accepts. */
export type WrittenStopReason = "stop" | "length" | "toolUse" | "error" | "aborted";

/** The usage entry this module writes, matching the host's own journal shape. */
export interface ModelUsageWrite {
  purpose: string;
  api: string;
  provider: string;
  model: string;
  usage: WrittenUsage;
  stopReason: WrittenStopReason;
}

/** Session journal surface the entry is written through. */
export interface UsageLedger {
  getSessionId(): string;
  getLeafId(): string | null;
  appendModelUsage(usage: ModelUsageWrite, owner: { sessionId: string; parentId: string | null }): string | undefined;
}

/** One model as the session's own registry describes it. */
export interface ModelIdentity {
  id: string;
  provider: string;
  api: string;
}

/**
 * The model registry of one session, as far as request identity needs it.
 *
 * The session's current model is deliberately not part of this: it names the
 * model the session runs on, which for another request's model role can be a
 * different model that happens to share an id.
 */
export interface ModelQuery {
  /** Resolve one model spec the way the host's own selection resolves it. */
  resolve(spec: string): ModelIdentity | undefined;
  /** Every model this session may use, when the host exposes its catalog. */
  list?(): readonly ModelIdentity[] | undefined;
}

/** Session journal and model query of one live session. */
export interface UsageSessionTarget {
  ledger: UsageLedger;
  models: ModelQuery | undefined;
}

/** The telemetry accessor this module replaces on the host's agent prototype. */
export interface TelemetryAccessor {
  get(this: unknown): unknown;
  enumerable: boolean;
  configurable: boolean;
}

/** Process-global state of the one installed patch. */
export interface UsageRegistry {
  schema: number;
  /** Activation that installed the patch, for conflict diagnostics. */
  runtimeId: string;
  /** Package version that installed it, for conflict diagnostics. */
  packageVersion: string;
  /** Activation cwd, for conflict diagnostics. */
  cwd: string;
  /** Accessor replaced by this module. */
  original: TelemetryAccessor;
  /** Accessor this module installed. */
  installed: TelemetryAccessor;
  /** Sessions that started while the patch was installed, by session id. */
  sessions: Map<string, UsageSessionTarget>;
  /** Attributes read from the spans this module handed out. */
  readings: WeakMap<object, Record<string, unknown>>;
  /** Requests priced on the estimator path, until their usage event claims them. */
  pending: Map<string, PendingRequest>;
  /** Usage entries written so far, the local sign that the host shape still matches. */
  entries: number;
  /** Entries written without a provider-computed cost. */
  costMissing: number;
  /** Requests that produced usage but were not recorded, with the last reason. */
  unrecorded: number;
  unrecordedReason: string | undefined;
  /** Set once this module released the accessor; the reason stays for `/qol`. */
  disabledReason: string | undefined;
  report: (reason: string, detail?: string) => void;
}

/** `globalThis` seen as a symbol-keyed slot bag. */
type GlobalSlots = typeof globalThis & { [key: symbol]: unknown };

function slots(): GlobalSlots {
  return globalThis as GlobalSlots;
}

function isAccessor(value: unknown): value is TelemetryAccessor {
  if (typeof value !== "object" || value === null) return false;
  return typeof (value as Partial<TelemetryAccessor>).get === "function";
}

/**
 * Whether the accessor a read returned is the accessor under test.
 *
 * The read returns a fresh object every time, so the getter it carries is the
 * identity that matters, and the host's own getter and this module's wrapper are
 * distinct functions.
 */
function isCurrentAccessor(current: TelemetryAccessor | undefined, expected: TelemetryAccessor): boolean {
  return current?.get === expected.get;
}

function isLedger(value: unknown): value is UsageLedger {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<UsageLedger>;
  return (
    typeof candidate.getSessionId === "function" &&
    typeof candidate.getLeafId === "function" &&
    typeof candidate.appendModelUsage === "function"
  );
}

function isRegistry(value: unknown): value is UsageRegistry {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<UsageRegistry>;
  return (
    candidate.schema === USAGE_REGISTRY_SCHEMA &&
    typeof candidate.runtimeId === "string" &&
    typeof candidate.packageVersion === "string" &&
    isAccessor(candidate.original) &&
    isAccessor(candidate.installed) &&
    candidate.sessions instanceof Map &&
    typeof candidate.entries === "number" &&
    typeof candidate.report === "function"
  );
}

/**
 * The installed patch, only when its registry layout is the one this version
 * writes. A slot that merely has the expected fields says nothing about how its
 * owner treats the host's accessor, so no caller may describe it as this
 * version's patch; a caller with its own refusal keeps that refusal instead.
 */
function recognizedRegistry(): UsageRegistry | undefined {
  const slot = slots()[REGISTRY_KEY];
  return isRegistry(slot) ? slot : undefined;
}

/** Put the replaced accessor back, while the installed one is still this module's own. */
function releaseAccessor(registry: UsageRegistry, reason: string, deps: UsageCompensationDeps): void {
  if (registry.disabledReason !== undefined) return;
  registry.disabledReason = reason;
  if (isCurrentAccessor(deps.readAccessor(), registry.installed)) deps.installAccessor(registry.original);
}

/** Release because this process holds a patch whose settings no longer apply. */
function disablePatch(registry: UsageRegistry, reason: string, deps: UsageCompensationDeps): void {
  if (registry.disabledReason !== undefined) return;
  releaseAccessor(registry, reason, deps);
  registry.report(reason);
}

/**
 * Record one attribute of a span this module handed out.
 *
 * Only the two keys the decision needs are kept. Every other attribute the
 * host sets, including captured request and response content, is dropped, so the
 * module never holds model content, prompt text, headers, or cost data it does
 * not write to the journal.
 */
function noteReading(readings: Record<string, unknown>, key: unknown, value: unknown): void {
  if (key !== ONESHOT_KIND_ATTRIBUTE && key !== FINISH_REASONS_ATTRIBUTE) return;
  readings[key] = value;
}

/** Every span method the host calls, forwarded to the span this module wraps. */
const SPAN_METHODS = [
  "spanContext",
  "addEvent",
  "addLink",
  "addLinks",
  "setStatus",
  "updateName",
  "end",
  "isRecording",
  "recordException",
] as const;

/**
 * The span the host receives, forwarding every call to the host's own span and
 * remembering the attributes the decision reads. Forwarding is explicit per
 * method: the host's span keeps receiving its own `this`, and a span class with
 * private fields stays usable.
 */
function wrapSpan(span: unknown, registry: UsageRegistry): unknown {
  if (typeof span !== "object" || span === null) return span;
  const target = span as Record<string, unknown>;
  const readings: Record<string, unknown> = {};
  const call = (method: string, args: unknown[]): unknown => {
    const member = target[method];
    if (typeof member !== "function") return undefined;
    return (member as (...inner: unknown[]) => unknown).apply(target, args);
  };
  const wrapper: Record<string, unknown> = {
    setAttribute: (key: unknown, value?: unknown) => {
      noteReading(readings, key, value);
      return call("setAttribute", [key, value]);
    },
    setAttributes: (attributes: unknown) => {
      if (typeof attributes === "object" && attributes !== null) {
        for (const [key, value] of Object.entries(attributes)) noteReading(readings, key, value);
      }
      return call("setAttributes", [attributes]);
    },
  };
  for (const method of SPAN_METHODS) {
    wrapper[method] = (...args: unknown[]) => call(method, args);
  }
  registry.readings.set(wrapper, readings);
  return wrapper;
}

/** The tracer the host receives: the same spans, with the attributes this module reads. */
function wrapTracer(tracer: unknown, registry: UsageRegistry): unknown {
  if (typeof tracer !== "object" || tracer === null) return tracer;
  const target = tracer as Record<string, unknown>;
  const forward = (method: string, args: unknown[]): unknown => {
    const member = target[method];
    if (typeof member !== "function") return undefined;
    return (member as (...inner: unknown[]) => unknown).apply(target, args);
  };
  return {
    startSpan: (...args: unknown[]) => wrapSpan(forward("startSpan", args), registry),
    startActiveSpan: (...args: unknown[]) => {
      const callbackIndex = args.findIndex((argument) => typeof argument === "function");
      const forwarded = [...args];
      if (callbackIndex >= 0) {
        const callback = forwarded[callbackIndex] as (span: unknown) => unknown;
        forwarded[callbackIndex] = (span: unknown) => callback(wrapSpan(span, registry));
      }
      return forward("startActiveSpan", forwarded);
    },
  };
}

/**
 * A tracer that produces the spans this module reads and exports nothing.
 *
 * The host creates a span for every model step once a telemetry configuration
 * exists. Without one it created none, so the compensation must not introduce a
 * trace of its own: this tracer answers the span interface with a no-op context
 * and a recording flag of `false`, and the wrapper above still sees the oneshot
 * kind the host stamps on it.
 */
function inertTracer(registry: UsageRegistry): unknown {
  const startSpan = (): Record<string, unknown> => {
    const readings: Record<string, unknown> = {};
    const wrapper: Record<string, unknown> = {
      setAttribute: (key: unknown, value?: unknown) => {
        noteReading(readings, key, value);
        return wrapper;
      },
      setAttributes: (attributes: unknown) => {
        if (typeof attributes === "object" && attributes !== null) {
          for (const [key, value] of Object.entries(attributes)) noteReading(readings, key, value);
        }
        return wrapper;
      },
      spanContext: () => ({ traceId: "0".repeat(32), spanId: "0".repeat(16), traceFlags: 0 }),
      isRecording: () => false,
    };
    for (const method of SPAN_METHODS) {
      if (wrapper[method] === undefined) wrapper[method] = () => wrapper;
    }
    wrapper.end = () => undefined;
    wrapper.recordException = () => undefined;
    registry.readings.set(wrapper, readings);
    return wrapper;
  };
  return {
    startSpan: () => startSpan(),
    startActiveSpan: (...args: unknown[]) => {
      const callback = args.find((argument) => typeof argument === "function");
      return typeof callback === "function" ? (callback as (span: unknown) => unknown)(startSpan()) : undefined;
    },
  };
}

/** Key that pairs the cost seen on the estimator path with the event that claims it. */
function usageKey(provider: unknown, model: unknown, usage: unknown): string {
  const snapshot = typeof usage === "object" && usage !== null ? (usage as Record<string, unknown>) : {};
  return [
    typeof provider === "string" ? provider : "",
    typeof model === "string" ? model : "",
    String(snapshot.inputTokens ?? 0),
    String(snapshot.cachedInputTokens ?? 0),
    String(snapshot.cacheWriteTokens ?? 0),
    String(snapshot.outputTokens ?? 0),
  ].join("\u0000");
}

/** What one estimator call reported about the request it priced. */
export interface PendingRequest {
  /** Cost the provider computed for the request, when the host exposes it. */
  cost: UsageCostLike | undefined;
  /** Provider id before the host normalizes it for telemetry, when it exposes one. */
  providerId: string | undefined;
  /** Requested model id, when the caller's host exposes one. */
  modelId: string | undefined;
}

/** Remember what one estimator call reported, until the request's usage event claims it. */
function noteRequest(registry: UsageRegistry, context: unknown): void {
  if (typeof context !== "object" || context === null) return;
  const call = context as Record<string, unknown>;
  const reported =
    typeof call.usageCost === "object" && call.usageCost !== null
      ? (call.usageCost as Record<string, unknown>)
      : undefined;
  const providerId = typeof call.providerId === "string" ? call.providerId : undefined;
  const modelId = typeof call.modelId === "string" ? call.modelId : undefined;
  if (reported === undefined && providerId === undefined && modelId === undefined) return;
  const key = usageKey(call.provider, call.model, call.usage);
  registry.pending.delete(key);
  registry.pending.set(key, {
    cost:
      reported === undefined
        ? undefined
        : {
            input: Number(reported.input ?? 0),
            output: Number(reported.output ?? 0),
            cacheRead: Number(reported.cacheRead ?? 0),
            cacheWrite: Number(reported.cacheWrite ?? 0),
            total: Number(reported.total ?? 0),
          },
    providerId,
    modelId,
  });
  while (registry.pending.size > MAX_PENDING_REQUESTS) {
    const oldest = registry.pending.keys().next();
    if (oldest.done === true) break;
    registry.pending.delete(oldest.value);
  }
}

/** Claim what one completed request reported, if this event's request is the one that reported it. */
function claimRequest(
  registry: UsageRegistry,
  provider: unknown,
  model: unknown,
  usage: unknown,
): PendingRequest | undefined {
  const key = usageKey(provider, model, usage);
  const pending = registry.pending.get(key);
  if (pending === undefined) return undefined;
  registry.pending.delete(key);
  return pending;
}

/** Whether one request consumed any token at all. */
export function hasTokens(usage: UsageSnapshotLike | undefined): boolean {
  if (usage === undefined) return false;
  return (
    (usage.inputTokens ?? 0) +
      (usage.outputTokens ?? 0) +
      (usage.cachedInputTokens ?? 0) +
      (usage.cacheWriteTokens ?? 0) >
    0
  );
}

/**
 * Rebuild the journal's usage shape from the event.
 *
 * The host's snapshot counts cached and cache-write tokens inside its input
 * total, while the journal stores them in their own fields and keeps
 * `totalTokens` as the host reported it. A request whose provider-computed cost
 * never reached the estimator path is written with a zero cost and counted,
 * never with an estimate this module cannot support.
 */
export function buildUsage(snapshot: UsageSnapshotLike, cost: UsageCostLike | undefined): WrittenUsage {
  const cacheRead = snapshot.cachedInputTokens ?? 0;
  const cacheWrite = snapshot.cacheWriteTokens ?? 0;
  const input = Math.max(0, (snapshot.inputTokens ?? 0) - cacheRead - cacheWrite);
  const output = snapshot.outputTokens ?? 0;
  return {
    input,
    output,
    cacheRead,
    cacheWrite,
    totalTokens: snapshot.totalTokens ?? input + cacheRead + cacheWrite + output,
    cost: cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

/**
 * Stop reason of one request, from the finish reasons the host stamped on its span.
 *
 * The instrumentation collapses `aborted` into the finish reason `error`, and
 * the terminal status that carries the original value is written after the
 * usage event this module reads. An aborted attempt that still reported tokens
 * is therefore recorded with the finish reason that was readable then, `error`.
 * A request that produced tokens but carries no readable reason is recorded as
 * `stop`: it completed far enough to be billed, and the journal has no field for
 * an unknown reason.
 */
export function readStopReason(readings: Record<string, unknown> | undefined): WrittenStopReason {
  const reasons = readings?.[FINISH_REASONS_ATTRIBUTE];
  const first = Array.isArray(reasons) ? reasons[0] : reasons;
  switch (first) {
    case "length":
      return "length";
    case "tool_calls":
    case "tool_use":
      return "toolUse";
    case "error":
      return "error";
    default:
      return "stop";
  }
}

/** Model identity the session journal records for one request. */
export interface ResolvedRequestModel {
  /** Provider id as the journal stores it, which is not the telemetry label. */
  provider: string;
  /** Api id the request ran over. */
  api: string;
}

/**
 * The model query resolves the identity the journal stores for a request.
 *
 * The api a request ran over and the provider id behind it are only reachable
 * through the session's own model registry, and the provider the event carries
 * is a telemetry label. A label is not an identity: it is a normalized name that
 * several provider ids map onto (`openai-codex` reports as `openai` by default,
 * and a host may install any mapping), so a label that matches a registered
 * provider does not prove the request ran under it. The provider id the
 * estimator path reports before that normalization is used when the host
 * reports one, and otherwise the request is resolved only when the session's
 * catalog offers its model under exactly one provider. Anything else leaves the
 * request unrecorded instead of written with a guessed provider and api.
 */
export function resolveRequestModel(
  models: ModelQuery | undefined,
  model: string,
  providerId: string | undefined,
  modelId: string | undefined,
): ResolvedRequestModel | undefined {
  if (models === undefined) return undefined;
  const wanted = [modelId, model].filter((name): name is string => name !== undefined && name.length > 0);
  if (wanted.length === 0) return undefined;
  if (providerId !== undefined && providerId.length > 0) return registeredIdentity(models, wanted, providerId);
  return soleIdentity(models, wanted);
}

/** The identity of one model, taken only from the provider that has to own it. */
function registeredIdentity(
  models: ModelQuery,
  wanted: readonly string[],
  provider: string,
): ResolvedRequestModel | undefined {
  for (const entry of models.list?.() ?? []) {
    if (entry.provider !== provider || !wanted.includes(entry.id) || typeof entry.api !== "string") continue;
    return { provider: entry.provider, api: entry.api };
  }
  for (const name of new Set(wanted)) {
    const resolved = models.resolve(`${provider}/${name}`);
    if (resolved === undefined || typeof resolved.api !== "string") continue;
    if (resolved.provider !== provider || !wanted.includes(resolved.id)) continue;
    return { provider: resolved.provider, api: resolved.api };
  }
  return undefined;
}

/** The identity of one model that the session's catalog offers exactly once. */
function soleIdentity(models: ModelQuery, wanted: readonly string[]): ResolvedRequestModel | undefined {
  const listed = models.list?.();
  if (listed === undefined) return undefined;
  const found = new Map<string, ResolvedRequestModel>();
  for (const entry of listed) {
    if (!wanted.includes(entry.id) || typeof entry.api !== "string") continue;
    found.set(`${entry.provider}\u0000${entry.api}`, { provider: entry.provider, api: entry.api });
  }
  if (found.size !== 1) return undefined;
  return found.values().next().value;
}

/** Session id of the agent that owns one request, when the host stamped one. */
function readAgentSessionId(agent: unknown): string | undefined {
  if (typeof agent !== "object" || agent === null) return undefined;
  const value = (agent as Record<string, unknown>).sessionId;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * The configuration the host receives in place of its own.
 *
 * An existing configuration keeps every field it had, its hooks included: the
 * compensation chains the two hooks it needs and leaves the user's tracer,
 * attributes, content capture, and export untouched. The tracer is the user's
 * own, the host's default when the user's configuration names none, and an inert
 * one when the agent had no configuration at all.
 */
function wrapTelemetryConfig(
  config: unknown,
  registry: UsageRegistry,
  agent: unknown,
  deps: UsageCompensationDeps,
): Record<string, unknown> {
  const base = typeof config === "object" && config !== null ? (config as Record<string, unknown>) : {};
  const owned = !(typeof config === "object" && config !== null);
  const sessionId = readAgentSessionId(agent);
  const userTracer = base.tracer;
  const userCostEstimator = base.costEstimator;
  const userOnChatUsage = base.onChatUsage;
  // Only these spans carry the oneshot kind, so every tracer the host can use
  // goes through the wrapper: the user's own when the configuration names one,
  // the host's default when it does not. The inert tracer records the kind
  // itself, which is why it is the one case that is used as it is.
  const tracer =
    userTracer !== undefined
      ? wrapTracer(userTracer, registry)
      : owned
        ? inertTracer(registry)
        : wrapTracer(deps.defaultTracer(base, sessionId), registry);
  return {
    ...base,
    ...(typeof tracer === "object" && tracer !== null ? { tracer } : {}),
    costEstimator: (context: unknown) => {
      noteRequest(registry, context);
      return typeof userCostEstimator === "function"
        ? (userCostEstimator as (inner: unknown) => unknown)(context)
        : undefined;
    },
    onChatUsage: (event: unknown) => {
      recordRequestUsage(registry, event, sessionId);
      return typeof userOnChatUsage === "function"
        ? (userOnChatUsage as (inner: unknown) => unknown)(event)
        : undefined;
    },
  };
}

/**
 * Write one usage entry for a completed compaction or handoff request.
 *
 * Called for every chat step the host reports. A step that is not one of the
 * compaction requests of this list, or an attempt without tokens, is passed
 * over. A request whose session or model this module cannot name, and one the
 * journal refuses, are counted for `/qol`: a wrong number in the session journal
 * is worse than a missing entry, because the statistics that read it look
 * repaired.
 */
function recordRequestUsage(registry: UsageRegistry, event: unknown, agentSessionId: string | undefined): void {
  if (registry.disabledReason !== undefined) return;
  if (typeof event !== "object" || event === null) return;
  const reported = event as Record<string, unknown>;
  const usage =
    typeof reported.usage === "object" && reported.usage !== null ? (reported.usage as UsageSnapshotLike) : undefined;
  const provider = typeof reported.provider === "string" ? reported.provider : undefined;
  const model = typeof reported.model === "string" ? reported.model : "";
  const readings =
    typeof reported.span === "object" && reported.span !== null ? registry.readings.get(reported.span) : undefined;
  const kind = readings?.[ONESHOT_KIND_ATTRIBUTE];
  const purpose = typeof kind === "string" ? COMPACTION_PURPOSES.get(kind) : undefined;
  if (purpose === undefined) return;
  if (!hasTokens(usage)) return;
  // Every model step of every session reaches these hooks, so what the request
  // reported is claimed only once the request is one this module records.
  const pending = claimRequest(registry, provider, model, reported.usage);

  const conversationId = typeof reported.conversationId === "string" ? reported.conversationId : undefined;
  const target =
    (conversationId === undefined ? undefined : registry.sessions.get(conversationId)) ??
    (agentSessionId === undefined ? undefined : registry.sessions.get(agentSessionId));
  if (target === undefined) {
    registry.unrecorded += 1;
    registry.unrecordedReason = "session-unregistered";
    registry.report("session-unregistered", `no live session matched ${String(kind)}; its usage stays unrecorded`);
    return;
  }
  const identity = resolveRequestModel(
    target.models,
    model,
    pending?.providerId ?? (typeof reported.providerId === "string" ? reported.providerId : undefined),
    pending?.modelId ?? (typeof reported.modelId === "string" ? reported.modelId : undefined),
  );
  if (identity === undefined) {
    registry.unrecorded += 1;
    registry.unrecordedReason = "api-unresolved";
    registry.report("api-unresolved", `no registered model matched ${provider ?? "?"}/${model}`);
    return;
  }
  let written: string | undefined;
  try {
    written = target.ledger.appendModelUsage(
      {
        purpose,
        api: identity.api,
        provider: identity.provider,
        model,
        usage: buildUsage(usage ?? {}, pending?.cost),
        stopReason: readStopReason(readings),
      },
      { sessionId: target.ledger.getSessionId(), parentId: target.ledger.getLeafId() },
    );
  } catch {
    written = undefined;
  }
  if (written === undefined) {
    // The journal answers with the entry's id, or with nothing when it kept no
    // entry at all; an entry that was not kept is not counted as written.
    registry.unrecorded += 1;
    registry.unrecordedReason = "write-failed";
    registry.report("write-failed", `${String(kind)} usage could not be written to the session journal`);
    return;
  }
  registry.entries += 1;
  if (pending?.cost === undefined) registry.costMissing += 1;
}

/** Seams a host-free test replaces; the shipped installer uses the live host. */
export interface UsageCompensationDeps {
  /** Read the accessor currently installed on the host's agent prototype. */
  readAccessor: () => TelemetryAccessor | undefined;
  /** Install an accessor in its place. */
  installAccessor: (accessor: TelemetryAccessor) => void;
  /** The tracer the host itself would use for a configuration that names none. */
  defaultTracer: (config: unknown, sessionId: string | undefined) => unknown;
  /** Whether this host already records these requests itself. */
  hostRecordsCompactionUsage: () => boolean;
}

/** The host's agent prototype, when this host has one in the shape this module needs. */
function hostAgentPrototype(): object | undefined {
  const Agent = (agentCore as Record<string, unknown>).Agent;
  if (typeof Agent !== "function") return undefined;
  const prototype = (Agent as { prototype?: unknown }).prototype;
  return typeof prototype === "object" && prototype !== null ? prototype : undefined;
}

const REAL_DEPS: UsageCompensationDeps = {
  readAccessor: () => {
    const prototype = hostAgentPrototype();
    if (prototype === undefined) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "telemetry");
    if (descriptor === undefined || typeof descriptor.get !== "function") return undefined;
    const get = descriptor.get as (this: unknown) => unknown;
    // The descriptor's own getter is what a later read must find again, so it is
    // returned as it is rather than wrapped in a fresh closure.
    return {
      get,
      enumerable: descriptor.enumerable === true,
      configurable: descriptor.configurable !== false,
    };
  },
  installAccessor: (accessor) => {
    const prototype = hostAgentPrototype();
    if (prototype === undefined) return;
    // The accessor's own getter becomes the property's getter: a property getter
    // already receives the agent instance as `this`, and the descriptor then
    // carries the exact function a later read compares against.
    Object.defineProperty(prototype, "telemetry", {
      configurable: true,
      enumerable: accessor.enumerable,
      get: accessor.get,
    });
  },
  defaultTracer: (config, sessionId) => {
    const resolve = (agentCore as Record<string, unknown>).resolveTelemetry;
    if (typeof resolve !== "function") return undefined;
    const handle = (resolve as (inner: unknown, id: string | undefined) => { tracer?: unknown } | undefined)(
      config,
      sessionId,
    );
    return handle?.tracer;
  },
  hostRecordsCompactionUsage: () => typeof (agentCore as Record<string, unknown>).compactionRequestUsage === "function",
};

/** The process's patch registry, when this version wrote it. */
export function usagePatchRegistry(): UsageRegistry | undefined {
  return recognizedRegistry();
}

/**
 * Add one session to the shared patch, or re-point it after a session switch.
 *
 * The patch serves every session of the process, so every activation registers
 * its session: the wrapper has to route an event to the journal the request
 * belongs to rather than to the session that happened to install it.
 *
 * A session changes its journal without a new activation: `/new`, `/resume`, and
 * a fork all move the session on the manager this patch already serves, so the
 * target follows the manager's current id. Entries this manager registered under
 * an earlier id are dropped, so a request that still names the old conversation
 * finds no session instead of writing into the new one.
 */
function registerSession(registry: UsageRegistry, ctx: ModuleContext["ctx"]): void {
  const manager = ctx.sessionManager as unknown;
  if (!isLedger(manager)) return;
  for (const [id, target] of registry.sessions) if (target.ledger === manager) registry.sessions.delete(id);
  registry.sessions.set(manager.getSessionId(), {
    ledger: manager,
    models: ctx.models as unknown as ModelQuery,
  });
  while (registry.sessions.size > MAX_REGISTERED_SESSIONS) {
    const oldest = registry.sessions.keys().next();
    if (oldest.done === true) break;
    registry.sessions.delete(oldest.value);
  }
}

/** Build the module installer; tests inject the prototype accessor. */
export function createUsageCompensationInstaller(deps: UsageCompensationDeps = REAL_DEPS) {
  return function installUsageCompensationModule(context: ModuleContext): ModuleState {
    const settings: { enabled: boolean } = context.settings.compactionUsage;
    const cwd = typeof context.ctx.cwd === "string" ? context.ctx.cwd : "";
    const refuse = (reason: string, message: string): ModuleState => {
      context.report(`compactionUsage:${reason}`, `request usage stays unrecorded: ${message}`);
      return { status: "incompatible", reason };
    };
    /** State of an activation that must not install: switches, not conflicts. */
    const inactiveState = (): ModuleState => {
      if (context.off === "master-disabled") return { status: "disabled", reason: "master-disabled" };
      if (context.off === "settings-invalid") return { status: "invalid", reason: "settings-invalid" };
      return { status: "disabled", reason: "compactionUsage-disabled" };
    };

    /**
     * Keep the patch pointed at sessions that switched their journal.
     *
     * `/new`, `/resume`, and a fork keep the session manager but move it to
     * another journal, and the host runs an activation once: without this, the
     * switched session's requests would find no registered session. The registry
     * is read at event time, so a patch that stopped later in the process is not
     * written to.
     */
    const followSessionSwitches = (): void => {
      context.pi.on("session_switch", (_event: unknown, ctx: ModuleContext["ctx"]) => {
        const registry = recognizedRegistry();
        if (registry === undefined || registry.disabledReason !== undefined) return;
        registerSession(registry, ctx);
      });
    };

    const slot = slots()[REGISTRY_KEY];
    const existing = recognizedRegistry();
    if (slot !== undefined && existing === undefined) {
      // Somebody wrote this slot in a layout this version does not know; it is
      // never taken over, and no second accessor is stacked on top of it.
      return refuse("registry-unrecognized", "the process patch registry was not written by this version");
    }

    if (existing !== undefined) {
      registerSession(existing, context.ctx);
      if (existing.disabledReason !== undefined) {
        if (context.off !== undefined) return inactiveState();
        return refuse(existing.disabledReason, "the compensation stopped earlier in this process");
      }
      if (!isCurrentAccessor(deps.readAccessor(), existing.installed)) {
        // Another extension put its own accessor in place. The accessor that is
        // gone is not reinstalled over it, and the reason stays for `/qol`.
        disablePatch(existing, "patch-overwritten", deps);
        if (context.off !== undefined) return inactiveState();
        return refuse("patch-overwritten", "another extension replaced the agent telemetry accessor");
      }
      if (context.off !== undefined || !settings.enabled) {
        // This activation's own switches ask for the compensation off: release
        // the accessor without reporting a conflict.
        const state = inactiveState();
        releaseAccessor(existing, state.reason ?? "compactionUsage-disabled", deps);
        return state;
      }
      // One patch serves the process: this activation keeps it instead of
      // owning a second one, and follows its own session's later switches.
      followSessionSwitches();
      return usageStatusFromRegistry({ status: "enabled" }, existing);
    }

    if (context.off !== undefined || !settings.enabled) return inactiveState();

    if (deps.hostRecordsCompactionUsage()) {
      // A host that records these requests itself already reaches the journal.
      // The compensation stays out of the way instead of writing a second entry.
      return refuse("host-records-usage", "this host records these requests itself");
    }

    const original = deps.readAccessor();
    if (original === undefined) return refuse("accessor-absent", "this host has no agent telemetry accessor to extend");
    if (!isLedger(context.ctx.sessionManager as unknown)) {
      return refuse("writer-absent", "this host's session manager does not accept usage entries");
    }

    let registry: UsageRegistry;
    const installed: TelemetryAccessor = {
      enumerable: original.enumerable,
      configurable: true,
      get(this: unknown) {
        return wrapTelemetryConfig(original.get.call(this), registry, this, deps);
      },
    };
    registry = {
      schema: USAGE_REGISTRY_SCHEMA,
      runtimeId: context.runtimeId,
      packageVersion: PACKAGE_VERSION,
      cwd,
      original,
      installed,
      sessions: new Map(),
      readings: new WeakMap(),
      pending: new Map(),
      entries: 0,
      costMissing: 0,
      unrecorded: 0,
      unrecordedReason: undefined,
      disabledReason: undefined,
      report: (reason, detail) => {
        context.report(`compactionUsage:${reason}`, `request usage stopped being recorded: ${detail ?? reason}`);
        context.setStatus?.("compactionUsage", { status: "incompatible", reason });
      },
    };
    registerSession(registry, context.ctx);
    deps.installAccessor(installed);

    if (!isCurrentAccessor(deps.readAccessor(), installed)) {
      // The runtime did not take the accessor, so no read can reach it. The
      // registry is not published either: the module reports that it is inactive
      // instead of leaving an accessor other activations would describe as owned.
      return refuse("install-failed", "this runtime did not accept the agent telemetry accessor");
    }
    slots()[REGISTRY_KEY] = registry;
    followSessionSwitches();

    return usageStatusFromRegistry({ status: "enabled" }, registry);
  };
}

export const installUsageCompensationModule = createUsageCompensationInstaller();

/**
 * Compensation state `/qol` reports when the command runs.
 *
 * A patch this version installed and can read decides the line, not the result
 * one activation recorded: a patch that stopped later in the process and an
 * accessor another extension replaced both show up here. Without such a patch
 * the recorded state stands, so an activation that installed nothing or refused
 * a foreign layout still explains itself.
 */
export function usageStatusFromRegistry(recorded: ModuleState, registry = recognizedRegistry()): ModuleState {
  if (registry === undefined) return recorded;
  if (registry.disabledReason !== undefined) return { status: "incompatible", reason: registry.disabledReason };
  const parts = [`entries=${registry.entries}`];
  if (registry.costMissing > 0) parts.push(`costMissing=${registry.costMissing}`);
  if (registry.unrecorded > 0)
    parts.push(`unrecorded=${registry.unrecorded}(${registry.unrecordedReason ?? "unknown"})`);
  return { status: "enabled", detail: parts.join(" ") };
}

/**
 * Stop the process patch another activation of this extension installed.
 *
 * An activation whose settings could not be read, or were rejected, installs
 * nothing and enables nothing, so it never owns the patch. It still must not
 * leave a patch from an earlier activation recording usage under a configuration
 * it cannot account for. A registry this version cannot read is never taken over
 * and stays as it is.
 *
 * Returns the patch it stopped, for the caller's diagnostic.
 */
export function stopForeignUsagePatch(
  runtimeId: string,
  deps: UsageCompensationDeps = REAL_DEPS,
): UsageRegistry | undefined {
  const registry = recognizedRegistry();
  if (registry === undefined || registry.runtimeId === runtimeId) return undefined;
  if (registry.disabledReason !== undefined) return undefined;
  disablePatch(registry, "runtime-conflict", deps);
  return registry;
}
