import { AgentSession, type ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { alignCompaction, digest, isObject, signalOwners, type JsonObject } from "./compaction-cache-core.ts";
import { PACKAGE_VERSION, type ModuleContext, type ModuleState } from "./extension.ts";

interface Reference {
  body: JsonObject;
  hash: string;
  state: string;
  sent: boolean;
}
interface Operation {
  reference: Reference;
  state: string;
  root: AbortSignal;
  active: boolean;
}
interface ManualRun {
  operation?: Operation;
}
interface CacheRegistry {
  schema: 1;
  runtimeId: string;
  version: string;
  provider: string;
  reason?: string;
  rewrites: number;
  lastSkip?: string;
  owned(): boolean;
  stop(reason: string): void;
}

const SLOT = Symbol.for("ruokee.omp-qol.compaction-cache.registry");
const slots = globalThis as typeof globalThis & { [key: symbol]: unknown };

function registry(): CacheRegistry | undefined {
  const value = slots[SLOT];
  if (
    !isObject(value) ||
    value.schema !== 1 ||
    typeof value.runtimeId !== "string" ||
    typeof value.version !== "string" ||
    typeof value.provider !== "string" ||
    typeof value.owned !== "function" ||
    typeof value.stop !== "function"
  )
    return undefined;
  return value as unknown as CacheRegistry;
}

export function stopForeignCompactionCache(runtimeId: string): void {
  const existing = registry();
  if (existing && existing.runtimeId !== runtimeId) existing.stop("settings-unusable");
}

export function compactionCacheStatus(runtimeId: string, recorded: ModuleState): ModuleState {
  const current = registry();
  if (!current) return recorded;
  if (!current.reason && !current.owned()) current.stop("patch-overwritten");
  if (recorded.status === "disabled" || recorded.status === "invalid") return recorded;
  if (current.reason) return { status: "incompatible", reason: current.reason };
  if (current.runtimeId !== runtimeId) return { status: "incompatible", reason: "patch-owned-elsewhere" };
  return {
    status: "enabled",
    detail: `rewrites=${current.rewrites} speculativeCompaction=disabled${current.lastSkip ? ` lastSkip=${current.lastSkip}` : ""}`,
  };
}

/** Reuse a confirmed online prefix without taking over native compaction. */
export function installCompactionCacheModule(module: ModuleContext): ModuleState {
  const { pi, ctx, runtimeId, report } = module;
  const settings = module.settings.cache;
  const disabled = module.off ?? (!settings.enabled ? "cache-disabled" : undefined);
  const existing = registry();
  if (slots[SLOT] !== undefined && !existing) return { status: "incompatible", reason: "registry-unrecognized" };
  if (existing) {
    if (disabled || existing.provider !== settings.provider || existing.version !== PACKAGE_VERSION) {
      existing.stop(disabled ?? "runtime-conflict");
    }
    if (!existing.reason && !existing.owned()) existing.stop("patch-overwritten");
    if (disabled) return { status: disabled === "settings-invalid" ? "invalid" : "disabled", reason: disabled };
    return { status: "incompatible", reason: existing.reason ?? "patch-owned-elsewhere" };
  }
  if (disabled) return { status: disabled === "settings-invalid" ? "invalid" : "disabled", reason: disabled };
  if (!settings.provider) return { status: "incompatible", reason: "provider-not-selected" };
  const isMain = (current: ExtensionContext): boolean =>
    "agent" in current && isObject(current.agent) && current.agent.kind === "main";
  if (!isMain(ctx)) return { status: "incompatible", reason: "main-session-only" };
  const supported = (current: ExtensionContext): boolean =>
    current.model?.provider === settings.provider && current.model.api === "openai-responses";
  if (!supported(ctx)) return { status: "incompatible", reason: "unsupported-model" };
  if (
    typeof globalThis.fetch !== "function" ||
    typeof AbortSignal.any !== "function" ||
    typeof AgentSession.prototype.compact !== "function"
  )
    return { status: "incompatible", reason: "host-interface" };

  let context = ctx;
  const session = ctx.sessionManager.getSessionId();
  let reference: Reference | undefined;
  let operation: Operation | undefined;
  let manual: ManualRun | undefined;
  const baseFetch = globalThis.fetch;
  const baseAny = AbortSignal.any;
  const baseCompact = AgentSession.prototype.compact;
  const lineage = signalOwners<Operation>(baseAny);
  const state = (current: ExtensionContext): string =>
    digest({
      session: current.sessionManager.getSessionId(),
      model: current.model,
      prompt: current.getSystemPrompt(),
      tools: pi.getAllTools(),
      active: pi.getActiveTools(),
      cwd: current.cwd,
    }).sha256;
  const ownSession = (current: ExtensionContext): boolean =>
    isMain(current) &&
    current.sessionManager === ctx.sessionManager &&
    current.sessionManager.getSessionId() === session;

  const wrappedCompact: typeof baseCompact = function (this: AgentSession, instructions, options) {
    if (owner.reason || slots[SLOT] !== owner || this.sessionManager !== ctx.sessionManager || manual) {
      return baseCompact.call(this, instructions, options);
    }
    const run: ManualRun = {};
    manual = run;
    const finish = (): void => {
      if (run.operation) run.operation.active = false;
      if (manual === run) manual = undefined;
    };
    // Settlement includes all native retries and method fallback. Keep the original promise.
    try {
      const result = baseCompact.call(this, instructions, options);
      void result.then(finish, finish);
      return result;
    } catch (error) {
      finish();
      throw error;
    }
  };

  const wrappedFetch = ((input: string | URL | Request, init?: RequestInit) => {
    let outgoing = init;
    try {
      if (!owner.reason && !owner.owned()) owner.stop("patch-overwritten");
      if (!owner.reason && supported(context) && ownSession(context)) {
        const model = context.model!;
        const baseUrl = model.baseUrl?.replace(/\/+$/, "");
        if (baseUrl) {
          const endpoint = baseUrl.endsWith("/responses")
            ? baseUrl
            : baseUrl.endsWith("/v1")
              ? `${baseUrl}/responses`
              : `${baseUrl}/v1/responses`;
          const remoteEndpoint =
            model.remoteCompaction?.v2Endpoint ?? model.remoteCompaction?.streamingEndpoint ?? endpoint;
          const url = input instanceof Request ? input.url : String(input);
          if (url === endpoint || url === remoteEndpoint) {
            if (input instanceof Request || init?.method?.toUpperCase() !== "POST" || typeof init.body !== "string") {
              owner.lastSkip = "unsupported-transport-shape";
            } else {
              const body: unknown = JSON.parse(init.body);
              if (!isObject(body)) throw new TypeError("Expected request object");
              const compaction = Array.isArray(body.input) && body.input.at(-1)?.type === "compaction_trigger";
              if (!compaction) {
                if (reference && reference.hash === digest(body).sha256 && reference.state === state(context))
                  reference.sent = true;
              } else {
                const op = init.signal ? lineage.get(init.signal) : undefined;
                const reason = !op
                  ? "unowned-signal"
                  : !op.active
                    ? "inactive-operation"
                    : op.root.aborted
                      ? "cancelled-operation"
                      : op.state !== state(context)
                        ? "changed-state"
                        : !op.reference.sent
                          ? "reference-not-sent"
                          : undefined;
                if (reason) owner.lastSkip = reason;
                else if (op) {
                  const alignment = alignCompaction(op.reference.body, body, context.cwd);
                  if (!alignment.ok) {
                    // Dynamic field names can contain private data; expose only the category.
                    owner.lastSkip = alignment.reason.split(":", 1)[0];
                  } else {
                    const text = JSON.stringify(alignment.body);
                    if (text !== init.body) {
                      outgoing = { ...init, body: text };
                      owner.rewrites += 1;
                    }
                    owner.lastSkip = undefined;
                  }
                }
              }
            }
          }
        }
      }
    } catch {
      outgoing = init;
      owner.lastSkip = "inspection-error";
    }
    return baseFetch(input, outgoing);
  }) as typeof fetch;
  Object.assign(wrappedFetch, baseFetch);

  const owner: CacheRegistry = {
    schema: 1,
    runtimeId,
    version: PACKAGE_VERSION,
    provider: settings.provider,
    rewrites: 0,
    owned: () =>
      slots[SLOT] === owner &&
      globalThis.fetch === wrappedFetch &&
      AbortSignal.any === lineage.any &&
      AgentSession.prototype.compact === wrappedCompact,
    stop(reason) {
      if (owner.reason) return;
      owner.reason = reason;
      reference = undefined;
      if (operation) operation.active = false;
      operation = undefined;
      if (globalThis.fetch === wrappedFetch) globalThis.fetch = baseFetch;
      if (AbortSignal.any === lineage.any) AbortSignal.any = baseAny;
      if (AgentSession.prototype.compact === wrappedCompact) AgentSession.prototype.compact = baseCompact;
      module.setStatus?.("cache", { status: "incompatible", reason });
      if (reason !== "owner-stopped") report(`cache:${reason}`, `compaction cache stopped rewriting: ${reason}`);
    },
  };

  // Register first so a host registration failure leaves no process patch installed.
  pi.on("before_provider_request", (event, current) => {
    if (owner.reason) return;
    if (!ownSession(current)) {
      owner.stop("different-session-request");
      return;
    }
    context = current;
    if (operation) operation.active = false;
    reference = undefined;
    if (!supported(current) || !isObject(event.payload)) return;
    try {
      const body = JSON.parse(JSON.stringify(event.payload)) as JsonObject;
      reference = { body, hash: digest(body).sha256, state: state(current), sent: false };
    } catch {
      owner.lastSkip = "reference-unavailable";
    }
  });
  pi.on("session_before_compact", (event, current) => {
    if (owner.reason) return;
    if (!ownSession(current)) {
      owner.stop("different-session-compaction");
      return;
    }
    context = current;
    try {
      if (!supported(current) || !reference?.sent || reference.state !== state(current)) {
        owner.lastSkip = "missing-or-stale-reference";
        return;
      }
      if (lineage.get(event.signal)?.active) return;
      if (operation?.active && !operation.root.aborted) {
        owner.stop("overlapping-compaction");
        return;
      }
      operation = { reference, state: state(current), root: event.signal, active: true };
      if (manual) manual.operation = operation;
      lineage.bind(event.signal, operation);
    } catch {
      owner.lastSkip = "binding-unavailable";
    }
  });
  pi.on("auto_compaction_end", () => {
    if (operation) operation.active = false;
  });
  pi.on("session_compact", () => {
    if (operation) operation.active = false;
    reference = undefined;
  });
  const stopForNavigation = (): void => owner.stop("session-navigation");
  pi.on("session_before_switch", stopForNavigation);
  pi.on("session_before_branch", stopForNavigation);
  pi.on("session_before_tree", stopForNavigation);
  pi.on("session_shutdown", () => owner.stop("owner-stopped"));

  slots[SLOT] = owner;
  try {
    globalThis.fetch = wrappedFetch;
    AbortSignal.any = lineage.any;
    AgentSession.prototype.compact = wrappedCompact;
    if (!owner.owned()) owner.stop("install-failed");
  } catch {
    owner.stop("install-failed");
  }
  return compactionCacheStatus(runtimeId, { status: "enabled" });
}
