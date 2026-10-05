import { isDeepStrictEqual } from "node:util";
import type { ApiKeyResolver } from "@oh-my-pi/pi-ai";
import type { Model } from "@oh-my-pi/pi-ai/types";
import type { ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { AgentRegistry } from "@oh-my-pi/pi-coding-agent/registry/agent-registry";
import { convertToLlm } from "@oh-my-pi/pi-coding-agent/session/messages";
import { buildResponsesInput } from "@oh-my-pi/pi-ai/providers/openai-shared";
import {
  alignCompaction,
  alignProjectedCompaction,
  digest,
  isObject,
  signalOwners,
  type JsonObject,
} from "./compaction-cache-core.ts";
import { PACKAGE_VERSION, type ModuleContext, type ModuleState } from "./extension.ts";
import type { CompactionCacheMode } from "./settings.ts";

type Messages = Parameters<typeof convertToLlm>[0];
interface Projection {
  raw: Messages;
  result: Messages;
}

interface Reference {
  body: JsonObject;
  hash: string;
  state: string;
  sent: boolean;
  projection?: { raw: unknown[]; result: unknown[] };
}
interface Operation {
  reference?: Reference;
  state: string;
  root: AbortSignal;
  generation: number;
  valid: boolean;
  online: boolean;
  projection?: Projection;
}
interface CacheRegistry {
  schema: 1;
  runtimeId: string;
  version: string;
  provider: string;
  mode: CompactionCacheMode;
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
    detail: `rewrites=${current.rewrites}${current.lastSkip ? ` lastSkip=${current.lastSkip}` : ""}`,
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
    if (
      disabled ||
      existing.provider !== settings.provider ||
      existing.mode !== settings.mode ||
      existing.version !== PACKAGE_VERSION
    ) {
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
    typeof ctx.modelRegistry?.resolver !== "function"
  )
    return { status: "incompatible", reason: "host-interface" };

  const context = ctx;
  let cwd = ctx.cwd;
  const session = ctx.sessionManager.getSessionId();
  let reference: Reference | undefined;
  let pending: Reference | undefined;
  let generation = 0;
  const baseFetch = globalThis.fetch;
  const baseAny = AbortSignal.any;
  const modelRegistry = ctx.modelRegistry;
  const baseResolver = modelRegistry.resolver;
  const descriptor = Object.getOwnPropertyDescriptor(modelRegistry, "resolver");
  if (descriptor && (!("value" in descriptor) || !descriptor.writable))
    return { status: "incompatible", reason: "host-interface" };
  if (!descriptor && !Object.isExtensible(modelRegistry)) return { status: "incompatible", reason: "host-interface" };
  const hostSession = settings.mode === "hooks" ? AgentRegistry.global().get(ctx.agent.id)?.session : undefined;
  const runner = hostSession?.extensionRunner;
  if (settings.mode === "hooks" && (!runner || hostSession?.sessionManager !== ctx.sessionManager))
    return { status: "incompatible", reason: "context-interface" };
  const baseContext = runner?.emitContext;
  const contextDescriptor = runner ? Object.getOwnPropertyDescriptor(runner, "emitContext") : undefined;
  if (
    runner &&
    (typeof baseContext !== "function" ||
      (contextDescriptor
        ? !("value" in contextDescriptor) || !contextDescriptor.writable
        : !Object.isExtensible(runner)))
  )
    return { status: "incompatible", reason: "context-interface" };
  let projections = new WeakMap<AbortSignal, Projection>();
  const lineage = signalOwners<Operation>(baseAny);
  const state = (current: ExtensionContext): string =>
    digest({
      session: current.sessionManager.getSessionId(),
      model: current.model,
      prompt: current.getSystemPrompt(),
      tools: pi.getAllTools(),
      active: pi.getActiveTools(),
      cwd,
    }).sha256;
  const ownSession = (current: ExtensionContext): boolean =>
    isMain(current) &&
    current.sessionManager === ctx.sessionManager &&
    current.sessionManager.getSessionId() === session;
  const ownRunner = (): boolean =>
    !runner ||
    (AgentRegistry.global().get(ctx.agent.id)?.session === hostSession && hostSession?.extensionRunner === runner);
  const wrappedContext: typeof baseContext =
    baseContext &&
    function (this: typeof runner, messages, signal) {
      let observation: { raw: Messages; state: string; generation: number } | undefined;
      try {
        if (!owner.reason && !owner.owned()) owner.stop("patch-overwritten");
        if (
          !owner.reason &&
          this === runner &&
          ownRunner() &&
          ownSession(context) &&
          supported(context) &&
          signal &&
          !signal.aborted
        )
          observation = { raw: structuredClone(messages), state: state(context), generation };
      } catch {
        owner.lastSkip = "projection-unavailable";
      }
      // Preserve the host promise and its rejection; observation has no handler side effects.
      const result = Reflect.apply(baseContext, this, [messages, signal]) as Promise<Messages>;
      if (observation && signal) {
        const saved = observation;
        void result.then(
          (completed) => {
            try {
              if (
                !owner.reason &&
                owner.owned() &&
                !signal.aborted &&
                saved.generation === generation &&
                saved.state === state(context)
              )
                projections.set(signal, {
                  raw: saved.raw,
                  result: isDeepStrictEqual(saved.raw, completed) ? saved.raw : structuredClone(completed),
                });
            } catch {
              owner.lastSkip = "projection-unavailable";
            }
          },
          () => {},
        );
      }
      return result;
    };
  const encode = (messages: Messages): unknown[] => {
    const model = context.model as Model<"openai-responses">;
    return buildResponsesInput({
      model,
      context: { messages: convertToLlm(messages) },
      nativeHistory: { replay: true, filterReasoning: false },
      strictResponsesPairing: model.compat.strictResponsesPairing,
      supportsImageDetailOriginal: model.compat.supportsImageDetailOriginal,
      includeThinkingSignatures: true,
      repairOrphanOutputs: true,
    });
  };
  // Payload contexts can override model for an auxiliary request; keep the live owner getter.
  const matchesModel = (target: unknown): boolean =>
    isObject(target) &&
    !!context.model &&
    target.provider === context.model.provider &&
    target.id === context.model.id &&
    target.baseUrl === context.model.baseUrl &&
    (target.api === undefined || target.api === context.model.api);

  const wrappedResolver: typeof baseResolver = function (this: typeof modelRegistry, ...args: unknown[]) {
    // Delegate outside inspection: credential errors and promise identity belong to the host.
    const resolve = Reflect.apply(baseResolver, this, args) as ApiKeyResolver;
    if (typeof resolve !== "function") return resolve;
    let snapshot: { reference?: Reference; state: string; generation: number } | undefined;
    try {
      if (!owner.reason && !owner.owned()) owner.stop("patch-overwritten");
      const [target, sessionId] = args;
      if (
        !owner.reason &&
        this === modelRegistry &&
        ownSession(context) &&
        supported(context) &&
        sessionId === session &&
        matchesModel(target)
      ) {
        const currentState = state(context);
        snapshot = {
          reference: reference?.state === currentState ? reference : undefined,
          state: currentState,
          generation,
        };
      }
    } catch {
      owner.lastSkip = "binding-unavailable";
    }
    return function (this: unknown, ...resolveArgs: Parameters<typeof resolve>) {
      try {
        if (!owner.reason && !owner.owned()) owner.stop("patch-overwritten");
        const root = resolveArgs[0]?.signal;
        if (!owner.reason && root instanceof AbortSignal) {
          const known = lineage.get(root);
          if (
            !snapshot ||
            root.aborted ||
            snapshot.generation !== generation ||
            !ownSession(context) ||
            snapshot.state !== state(context)
          ) {
            if (known) known.valid = false;
            lineage.bind(root, null);
          } else if (known === undefined) {
            lineage.bind(root, { ...snapshot, root, valid: true, online: false, projection: projections.get(root) });
            projections.delete(root);
          } else if (
            known &&
            (known.root !== root || known.state !== snapshot.state || known.generation !== generation)
          ) {
            known.valid = false;
            lineage.bind(root, null);
          }
          // Existing roots keep their first reference, including a missing one, across retries.
        }
      } catch {
        owner.stop("binding-unavailable");
      }
      return Reflect.apply(resolve, this, resolveArgs);
    };
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
              const op = init.signal ? lineage.get(init.signal) : undefined;
              const currentState = state(context);
              const liveRoot =
                op &&
                op.valid &&
                !op.root.aborted &&
                !init.signal?.aborted &&
                op.generation === generation &&
                op.state === currentState;
              if (!compaction) {
                if (liveRoot && op) {
                  op.online = true;
                  if (
                    url === endpoint &&
                    pending &&
                    pending.state === currentState &&
                    pending.hash === digest(body).sha256
                  ) {
                    if (settings.mode === "hooks") {
                      if (!op.projection) owner.lastSkip = "projection-unavailable";
                      else {
                        const raw = encode(op.projection.raw);
                        const result = op.projection.raw === op.projection.result ? raw : encode(op.projection.result);
                        const confirmed =
                          Array.isArray(body.input) &&
                          body.input.length === result.length &&
                          alignCompaction(body, { ...body, input: [...result, { type: "compaction_trigger" }] }, cwd)
                            .ok;
                        if (!confirmed) owner.lastSkip = "projection-unconfirmed";
                        else {
                          pending.projection = { raw, result };
                          pending.sent = true;
                          reference = pending;
                          owner.lastSkip = undefined;
                        }
                      }
                      op.projection = undefined;
                    } else {
                      pending.sent = true;
                      reference = pending;
                    }
                    pending = undefined;
                  }
                }
              } else {
                const reason = !op
                  ? "unowned-signal"
                  : !liveRoot || op.online
                    ? "inactive-operation"
                    : !op.reference?.sent
                      ? "reference-not-sent"
                      : undefined;
                if (reason) owner.lastSkip = reason;
                else if (op?.reference) {
                  const alignment =
                    settings.mode === "hooks"
                      ? op.reference.projection
                        ? alignProjectedCompaction(op.reference.body, body, op.reference.projection, cwd)
                        : { ok: false as const, reason: "projection-unavailable" }
                      : alignCompaction(op.reference.body, body, cwd);
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
    mode: settings.mode,
    rewrites: 0,
    owned: () =>
      slots[SLOT] === owner &&
      globalThis.fetch === wrappedFetch &&
      AbortSignal.any === lineage.any &&
      modelRegistry.resolver === wrappedResolver &&
      ownRunner() &&
      (!runner || runner.emitContext === wrappedContext),
    stop(reason) {
      if (owner.reason) return;
      owner.reason = reason;
      reference = undefined;
      pending = undefined;
      generation += 1;
      lineage.clear();
      projections = new WeakMap();
      if (runner && runner.emitContext === wrappedContext) {
        if (contextDescriptor) Object.defineProperty(runner, "emitContext", contextDescriptor);
        else Reflect.deleteProperty(runner, "emitContext");
      }
      if (globalThis.fetch === wrappedFetch) globalThis.fetch = baseFetch;
      if (AbortSignal.any === lineage.any) AbortSignal.any = baseAny;
      if (modelRegistry.resolver === wrappedResolver) {
        if (descriptor) Object.defineProperty(modelRegistry, "resolver", descriptor);
        else Reflect.deleteProperty(modelRegistry, "resolver");
      }
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
    if (!matchesModel(current.model)) return;
    cwd = current.cwd;
    pending = undefined;
    if (!supported(context) || !isObject(event.payload)) {
      reference = undefined;
      generation += 1;
      return;
    }
    try {
      const body = JSON.parse(JSON.stringify(event.payload)) as JsonObject;
      const currentState = state(context);
      if (reference && reference.state !== currentState) {
        reference = undefined;
        generation += 1;
      }
      // Old roots retain their snapshot; future roots require this online request's proof.
      if (settings.mode === "hooks") reference = undefined;
      pending = { body, hash: digest(body).sha256, state: currentState, sent: false };
    } catch {
      owner.lastSkip = "reference-unavailable";
    }
  });
  pi.on("session_compact", () => {
    generation += 1;
    pending = undefined;
    reference = undefined;
    projections = new WeakMap();
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
    Object.defineProperty(
      modelRegistry,
      "resolver",
      descriptor
        ? { ...descriptor, value: wrappedResolver }
        : { value: wrappedResolver, writable: true, configurable: true },
    );
    if (runner)
      Object.defineProperty(
        runner,
        "emitContext",
        contextDescriptor
          ? { ...contextDescriptor, value: wrappedContext }
          : { value: wrappedContext, writable: true, configurable: true },
      );
    if (!owner.owned()) owner.stop("install-failed");
  } catch {
    owner.stop("install-failed");
  }
  return compactionCacheStatus(runtimeId, { status: "enabled" });
}
