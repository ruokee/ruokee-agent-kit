import { AsyncLocalStorage } from "node:async_hooks";
import { isDeepStrictEqual as equal } from "node:util";
import { normalizeTools, type AgentMessage, type StreamFn } from "@oh-my-pi/pi-agent-core";
import { type ApiKeyResolver, type Context, type Model } from "@oh-my-pi/pi-ai";
import { convertTools } from "@oh-my-pi/pi-ai/providers/openai-responses";
import type { AgentSession, ExtensionContext, ModelRegistry } from "@oh-my-pi/pi-coding-agent";
import { AgentRegistry } from "@oh-my-pi/pi-coding-agent/registry/agent-registry";
import { body, nativeV2, object, reuse, type Body, type Reference } from "./reuse.ts";
import { copy, encode, nativeIndependent, payload, standardResult, units } from "./proof.ts";
import type { Settings } from "./settings.ts";
import type { Construction } from "./construction.ts";

const SLOT = Symbol.for("ruokee.omp-smart-cache.remote.coordinator");
const OLD_QOL = Symbol.for("ruokee.omp-qol.compaction-cache.registry");
const VERSION = "0.0.2";
const slots = globalThis as typeof globalThis & { [key: symbol]: unknown };
const increment = (value: number): number => Math.min(Number.MAX_SAFE_INTEGER, value + 1);

export interface Status {
  state: "disabled" | "unavailable" | "awaiting-reference" | "already-aligned" | "rewritten" | "rejected";
  online: string;
  binding: string;
  candidate: string;
  sending: string;
  dispatch: number;
  operation: number;
  reference: number;
  operations: number;
  sends: number;
  retries: number;
  aligned: number;
  rewritten: number;
  rejected: number;
  reused: number;
  retained: number;
}
export interface Registration {
  status(): Readonly<Status>;
  invalidate(reason: string): void;
  close(): void;
}
interface State {
  readonly id: number;
  readonly agentId: string;
  readonly session: AgentSession;
  readonly agent: AgentSession["agent"];
  readonly manager: AgentSession["sessionManager"];
  readonly runner: NonNullable<AgentSession["extensionRunner"]>;
  readonly registry: ModelRegistry;
  readonly settings: Settings;
  readonly nativeSource: boolean;
  readonly status: Status;
  readonly raw: WeakMap<AbortSignal, Observation>;
  readonly restores: (() => void)[];
  readonly owned: (() => boolean)[];
  active: boolean;
  epoch: number;
  reference?: Reference;
  persistent: string;
  provider: string;
  unavailable?: string;
  sourceFailure?: string;
}
interface Observation {
  readonly id: number;
  readonly state: State;
  readonly epoch: number;
  readonly model: Model;
  readonly raw: AgentMessage[];
  readonly sourceTools: unknown;
  readonly expectedTools: unknown;
  readonly independent: boolean;
  hooks?: AgentMessage[];
  prepared?: Pick<Context, "messages">;
  preparedTools?: unknown;
  source?: Reference["source"];
  payload?: Body;
  reference?: Reference;
  failed?: string;
}
interface Operation {
  readonly id: number;
  readonly state: State;
  readonly epoch: number;
  readonly root: AbortSignal;
  readonly model: Model;
  readonly persistent: string;
  readonly provider: string;
  readonly reference: Reference | undefined;
  sends: number;
  revoked?: boolean;
  memo?: { native: string; sent: string; reason: string; reused: number; retained: number };
}
interface RegistryPatch {
  readonly states: Set<State>;
  readonly owned: () => boolean;
  readonly restore: () => void;
}
interface Patch {
  readonly owned: () => boolean;
  readonly restore: () => void;
}

/** Preserve inherited properties and restore only wrappers still owned by this registration. */
function patch<T extends object, K extends keyof T>(target: T, key: K, value: T[K]): Patch {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (descriptor ? !("value" in descriptor) || !descriptor.writable : !Object.isExtensible(target))
    throw new Error("host-interface");
  Object.defineProperty(
    target,
    key,
    descriptor ? { ...descriptor, value } : { value, writable: true, configurable: true, enumerable: true },
  );
  const owned = () => target[key] === value;
  return {
    owned,
    restore: () => {
      if (!owned()) return;
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else Reflect.deleteProperty(target, key);
    },
  };
}
function initial(reason: string, state: Status["state"] = "awaiting-reference"): Status {
  return {
    state,
    online: reason,
    binding: "not-bound",
    candidate: "not-checked",
    sending: "not-sent",
    dispatch: 0,
    operation: 0,
    reference: 0,
    operations: 0,
    sends: 0,
    retries: 0,
    aligned: 0,
    rewritten: 0,
    rejected: 0,
    reused: 0,
    retained: 0,
  };
}
function target(settings: Settings, model: Model | undefined): boolean {
  return model?.provider === settings.provider && model.api === "openai-responses";
}
function modelMatches(left: unknown, right: Model | undefined): boolean {
  return (
    object(left) &&
    !!right &&
    left.id === right.id &&
    left.provider === right.provider &&
    left.api === right.api &&
    left.baseUrl === right.baseUrl
  );
}
function endpoints(model: Model): [string, string] {
  const base = model.baseUrl.replace(/\/+$/, "");
  const online = base.endsWith("/responses")
    ? base
    : base.endsWith("/v1")
      ? `${base}/responses`
      : `${base}/v1/responses`;
  return [online, model.remoteCompaction?.v2Endpoint ?? model.remoteCompaction?.streamingEndpoint ?? online];
}

class Coordinator {
  readonly protocol = 1;
  readonly version = VERSION;
  readonly states = new Map<AgentSession, State>();
  readonly registries = new Map<ModelRegistry, RegistryPatch>();
  readonly parents = new WeakMap<AbortSignal, readonly AbortSignal[]>();
  readonly roots = new WeakMap<AbortSignal, Operation | null>();
  readonly dispatch = new AsyncLocalStorage<Observation>();
  readonly transport: Patch[] = [];
  sequence = 0;
  closed = false;
  retiredConflict = false;

  constructor() {
    const originalAny = AbortSignal.any;
    const coordinator = this;
    const wrappedAny: typeof AbortSignal.any = function (this: typeof AbortSignal, signals) {
      const result = Reflect.apply(originalAny, this, [signals]);
      try {
        coordinator.parents.set(result, [...signals]);
      } catch {
        /* Observation cannot change cancellation. */
      }
      return result;
    };
    const originalFetch = globalThis.fetch;
    const wrappedFetch = function (this: unknown, input: string | URL | Request, init?: RequestInit) {
      let outgoing = init;
      try {
        outgoing = coordinator.inspect(input, init);
      } catch {
        const inherited = coordinator.dispatch.getStore();
        if (inherited) inherited.state.status.sending = "send-inspection-failed";
      }
      // Native exceptions and Promise identity remain outside observer containment.
      return Reflect.apply(originalFetch, this, [input, outgoing]);
    } as typeof fetch;
    // Bun's preconnect property remains available without changing its receiver or descriptor.
    Object.defineProperties(wrappedFetch, Object.getOwnPropertyDescriptors(originalFetch));
    try {
      this.transport.push(patch(AbortSignal, "any", wrappedAny));
      this.transport.push(patch(globalThis, "fetch", wrappedFetch));
    } catch (error) {
      for (let index = this.transport.length - 1; index >= 0; index--) this.transport[index]!.restore();
      throw error;
    }
  }

  next(): number {
    return (this.sequence = increment(this.sequence));
  }
  ancestors(signal?: AbortSignal): AbortSignal[] {
    const found: AbortSignal[] = [],
      seen = new Set<AbortSignal>(),
      queue = signal ? [signal] : [];
    for (let item; (item = queue.pop());) {
      if (seen.has(item)) continue;
      seen.add(item);
      found.push(item);
      queue.push(...(this.parents.get(item) ?? []));
    }
    return found;
  }
  owner(signal?: AbortSignal): Operation | null | undefined {
    let owner: Operation | undefined;
    for (const parent of this.ancestors(signal)) {
      const op = this.roots.get(parent);
      if (op === null || (owner && op && owner !== op)) return null;
      if (op) owner = op;
    }
    return owner;
  }
  valid(state: State): boolean {
    if (!state.active || this.closed) return false;
    if (slots[OLD_QOL] !== undefined) return this.unavailable(state, "mixed-qol-owner");
    if (this.transport.some((installed) => !installed.owned()))
      return this.unavailable(state, "transport-wrapper-lost");
    if (state.owned.some((owned) => !owned())) return this.unavailable(state, "session-wrapper-lost");
    const registry = this.registries.get(state.registry);
    if (!registry?.owned()) return this.unavailable(state, "registry-wrapper-lost");
    if (
      AgentRegistry.global().get(state.agentId)?.session !== state.session ||
      state.session.agent !== state.agent ||
      state.session.sessionManager !== state.manager ||
      state.session.extensionRunner !== state.runner
    )
      return this.unavailable(state, "session-identity-lost");
    return !state.unavailable;
  }
  unavailable(state: State, reason: string): false {
    if (!state.unavailable) {
      state.unavailable = reason;
      this.invalidate(state, reason);
    }
    state.status.state = "unavailable";
    return false;
  }
  invalidate(state: State, reason: string): void {
    state.epoch = increment(state.epoch);
    state.reference = undefined;
    state.status.reference = 0;
    state.status.online = state.unavailable ?? state.sourceFailure ?? reason;
    if (!state.unavailable) state.status.state = "awaiting-reference";
  }
  failure(observation: Observation, reason: string): void {
    observation.failed = reason;
    if (observation.state.status.dispatch === observation.id) {
      observation.state.sourceFailure = reason;
      observation.state.status.online = reason;
    }
  }
  operationValid(op: Operation, signal?: AbortSignal): boolean {
    const state = op.state;
    if (
      op.epoch !== state.epoch ||
      op.root.aborted ||
      state.manager.getSessionId() !== op.persistent ||
      state.session.sessionId !== op.provider ||
      !modelMatches(op.model, state.session.model)
    )
      op.revoked = true;
    return !op.revoked && this.valid(state) && !signal?.aborted && !state.session.isSessionTransitioning;
  }
  registry(registry: ModelRegistry): RegistryPatch {
    const known = this.registries.get(registry);
    if (known) return known;
    const original = registry.resolver;
    const coordinator = this;
    const users = new Set<State>();
    const wrapped = function (this: ModelRegistry, ...args: Parameters<ModelRegistry["resolver"]>): ApiKeyResolver {
      const resolver = Reflect.apply(original, this, args) as ApiKeyResolver;
      if (typeof resolver !== "function") return resolver;
      let snapshot: Omit<Operation, "id" | "root" | "sends"> | undefined;
      try {
        const [model, provider] = args;
        const matches = [...users].filter(
          (state) =>
            coordinator.valid(state) &&
            target(state.settings, state.session.model) &&
            modelMatches(model, state.session.model) &&
            state.session.sessionId === provider,
        );
        if (this === registry && matches.length === 1) {
          const state = matches[0]!;
          snapshot = {
            state,
            epoch: state.epoch,
            model: copy(state.session.model!),
            persistent: state.manager.getSessionId(),
            provider: state.session.sessionId,
            reference: state.reference,
          };
        } else for (const state of matches) state.status.binding = "identity-ambiguous";
      } catch {
        for (const state of users) state.status.binding = "binding-inspection-failed";
      }
      return function (this: unknown, ...resolveArgs: Parameters<ApiKeyResolver>) {
        try {
          const root = resolveArgs[0]?.signal;
          if (root instanceof AbortSignal) {
            const known = coordinator.roots.get(root);
            if (!coordinator.roots.has(root)) {
              const operation = snapshot ? { ...snapshot, id: coordinator.next(), root, sends: 0 } : null;
              coordinator.roots.set(root, operation);
              if (operation) {
                operation.state.status.operation = operation.id;
                operation.state.status.binding = operation.reference ? "reference-bound" : "missing-reference-bound";
              }
            } else if (
              known &&
              (!snapshot ||
                snapshot.state !== known.state ||
                snapshot.epoch !== known.epoch ||
                snapshot.persistent !== known.persistent ||
                snapshot.provider !== known.provider ||
                !modelMatches(snapshot.model, known.model))
            ) {
              coordinator.roots.set(root, null);
              known.state.status.binding = "root-identity-conflict";
            }
          }
        } catch {
          if (snapshot) snapshot.state.status.binding = "binding-inspection-failed";
        }
        return Reflect.apply(resolver, this, resolveArgs);
      };
    } as ModelRegistry["resolver"];
    const installed = patch(registry, "resolver", wrapped);
    const entry = { ...installed, states: users };
    this.registries.set(registry, entry);
    return entry;
  }

  inspect(input: string | URL | Request, init?: RequestInit): RequestInit | undefined {
    const signal = init?.signal ?? undefined;
    const op = this.owner(signal);
    const inherited = this.dispatch.getStore();
    const observation =
      inherited && this.ancestors(signal).some((parent) => inherited.state.raw.get(parent) === inherited)
        ? inherited
        : undefined;
    const state = op?.state ?? observation?.state;
    if (!state || !target(state.settings, op?.model ?? observation?.model) || !state.active) return init;
    const [online, remote] = endpoints(op?.model ?? observation!.model);
    const url = input instanceof Request ? input.url : String(input);
    if (url !== online && url !== remote) return init;
    if (input instanceof Request || init?.method?.toUpperCase() !== "POST" || typeof init.body !== "string") {
      state.status.sending = "unsupported-transport-shape";
      return init;
    }
    if (op?.memo && op.memo.native === init.body && this.operationValid(op, signal)) {
      this.record(op, op.memo.reason, op.memo.reused, op.memo.retained);
      return op.memo.sent === init.body ? init : { ...init, body: op.memo.sent };
    }
    const value: unknown = JSON.parse(init.body);
    if (!body(value)) {
      state.status.sending = "unsupported-payload-shape";
      return init;
    }
    if (!nativeV2(value)) {
      if (!observation || url !== online) return init;
      if (state.status.dispatch !== observation.id) return init;
      if (
        !op ||
        op.state !== observation.state ||
        !this.operationValid(op, signal) ||
        observation.epoch !== state.epoch
      ) {
        this.failure(observation, "dispatch-identity-unconfirmed");
        return init;
      }
      if (observation.failed || !observation.reference || !equal(observation.payload, value)) {
        this.failure(observation, observation.failed ?? "final-payload-unconfirmed");
        return init;
      }
      state.reference = observation.reference;
      state.status.reference = observation.reference.id;
      state.status.online = "ordinary-send-confirmed";
      state.status.state = "awaiting-reference";
      return init;
    }
    if (!op) {
      state.status.binding = "identity-unconfirmed";
      return init;
    }
    let reason: string,
      reused = 0,
      retained = value.input.length;
    let outgoing = init;
    if (!this.operationValid(op, signal)) reason = state.unavailable ?? "operation-invalidated";
    else if (!op.reference) reason = "reference-not-sent";
    else {
      const result = reuse(op.reference, value, state.settings.mode);
      reason = result.reason;
      reused = result.reused;
      retained = result.retained;
      if (result.changed) outgoing = { ...init, body: JSON.stringify(result.body) };
    }
    op.memo = { native: init.body, sent: outgoing.body as string, reason, reused, retained };
    this.record(op, reason, reused, retained);
    return outgoing;
  }

  record(op: Operation, reason: string, reused: number, retained: number): void {
    const { status } = op.state;
    const first = op.sends === 0;
    op.sends = increment(op.sends);
    status.sends = increment(status.sends);
    if (first) status.operations = increment(status.operations);
    else status.retries = increment(status.retries);
    status.reused = reused;
    status.retained = retained;
    status.candidate = reason;
    status.sending = reason === "rewritten" ? "rewritten-delegated" : "native-delegated";
    if (reason === "rewritten" || reason === "already-aligned") {
      status.state = reason;
      if (first) {
        status.aligned = increment(status.aligned);
        if (reason === "rewritten") status.rewritten = increment(status.rewritten);
      }
    } else {
      status.state = op.state.unavailable ? "unavailable" : "rejected";
      if (first) status.rejected = increment(status.rejected);
    }
  }

  register(ctx: ExtensionContext, settings: Settings, construction: Construction, session: AgentSession): Registration {
    const known = this.states.get(session);
    if (known) {
      if (!equal(known.settings, settings)) return inactive("activation-conflict", "unavailable");
      return this.handle(known);
    }
    const state: State = {
      id: this.next(),
      agentId: ctx.agent.id,
      session,
      agent: session.agent,
      manager: session.sessionManager,
      runner: session.extensionRunner!,
      registry: ctx.modelRegistry,
      settings,
      nativeSource: construction.confirms(session),
      status: initial("reference-not-sent"),
      raw: new WeakMap(),
      restores: [],
      owned: [],
      active: true,
      epoch: 0,
      persistent: session.sessionManager.getSessionId(),
      provider: session.sessionId,
    };
    this.states.set(session, state);
    try {
      const registry = this.registry(state.registry);
      registry.states.add(state);
      this.observe(state);
      session.addDisposer(() => this.close(state));
    } catch {
      this.unavailable(state, "host-interface");
      this.close(state);
      return inactive("host-interface", "unavailable");
    }
    return this.handle(state);
  }

  observe(state: State): void {
    const { session, runner } = state;
    if (
      typeof session.isSessionTransitioning !== "boolean" ||
      typeof session.agent.addBeforeModelCallHook !== "function" ||
      typeof session.addDisposer !== "function"
    )
      throw new Error("host-interface");
    const pending = new WeakSet<AbortSignal>();
    state.restores.push(
      session.agent.addBeforeModelCallHook((signal) => {
        if (signal) pending.add(signal);
      }),
    );
    const context = runner.emitContext;
    const coordinator = this;
    const wrappedContext: typeof context = function (this: typeof runner, messages, signal) {
      let observation: Observation | undefined;
      try {
        if (signal && pending.delete(signal)) {
          state.reference = undefined;
          state.sourceFailure = undefined;
          state.status.reference = 0;
          state.status.dispatch = 0;
          state.status.online = "ordinary-dispatch-pending";
          if (!state.unavailable) state.status.state = "awaiting-reference";
          if (coordinator.valid(state) && target(state.settings, session.model) && !session.isSessionTransitioning) {
            state.persistent = state.manager.getSessionId();
            state.provider = session.sessionId;
            const sourceTools = session.agent.state.tools;
            const normalized =
              normalizeTools(session.agent.state.tools, {
                injectIntent: session.agent.intentTracing,
                pruneDescriptions: session.agent.pruneToolDescriptions,
              }) ?? [];
            const model = copy(session.model!) as Model<"openai-responses">;
            observation = {
              id: coordinator.next(),
              state,
              epoch: state.epoch,
              model,
              raw: copy(messages),
              sourceTools: copy(
                convertTools(sourceTools, model.compat.supportsStrictMode, model as Model<"openai-responses">),
              ),
              expectedTools: copy(
                convertTools(normalized, model.compat.supportsStrictMode !== false, model as Model<"openai-responses">),
              ),
              independent: state.nativeSource && nativeIndependent(session, messages),
            };
            state.raw.set(signal, observation);
            state.status.dispatch = observation.id;
          } else if (!state.unavailable)
            state.status.online = session.isSessionTransitioning ? "navigation-unsettled" : "model-not-targeted";
        }
      } catch {
        state.sourceFailure = state.status.online = "source-observation-failed";
      }
      const result = Reflect.apply(context, this, [messages, signal]) as ReturnType<typeof context>;
      if (observation) {
        const observed = observation;
        void result.then(
          (messages) => {
            try {
              observed.hooks = copy(messages);
            } catch {
              coordinator.failure(observed, "hook-observation-failed");
            }
          },
          () => {
            coordinator.failure(observed, "native-preparation-rejected");
          },
        );
      }
      return result;
    };
    const contextPatch = patch(runner, "emitContext", wrappedContext);
    state.restores.push(contextPatch.restore);
    state.owned.push(contextPatch.owned);
    const stream = session.agent.streamFn;
    const wrappedStream: StreamFn = function (this: AgentSession["agent"], model, prepared, options) {
      if (!target(state.settings, model)) return Reflect.apply(stream, this, [model, prepared, options]);
      let observation: Observation | undefined;
      try {
        const matches = new Set(
          coordinator
            .ancestors(options?.signal)
            .map((signal) => state.raw.get(signal))
            .filter((value): value is Observation => !!value),
        );
        if (matches.size === 1 && coordinator.valid(state)) {
          observation = [...matches][0]!;
          observation.prepared = { messages: copy(prepared.messages) };
          observation.preparedTools = copy(
            convertTools(
              prepared.tools ?? [],
              (model as Model<"openai-responses">).compat.supportsStrictMode !== false,
              model as Model<"openai-responses">,
            ),
          );
          observation.source = copy(encode(model, observation.raw));
        } else state.status.online = "dispatch-unconfirmed";
      } catch {
        if (observation) coordinator.failure(observation, "source-encoding-unconfirmed");
        else state.sourceFailure = state.status.online = "source-encoding-unconfirmed";
      }
      if (!observation?.source) return Reflect.apply(stream, this, [model, prepared, options]);
      const observed = observation;
      const prior = options?.onPayload;
      const capture = (returned: unknown, args: Parameters<NonNullable<typeof prior>>): void => {
        try {
          if (observed.payload) {
            if (!equal(observed.payload, payload(returned ?? args[0]))) {
              coordinator.failure(observed, "payload-retry-changed");
              observed.reference = undefined;
            }
            return;
          }
          const sent = payload(returned ?? args[0]);
          if (!sent || !observed.hooks || !observed.prepared || !observed.source) {
            coordinator.failure(observed, "payload-proof-unconfirmed");
            return;
          }
          observed.payload = sent;
          const model = observed.model as Model<"openai-responses">;
          observed.reference = {
            id: observed.id,
            source: observed.source,
            body: sent,
            localUnconfirmed: !state.nativeSource,
            units: units(
              model,
              observed.raw,
              observed.prepared.messages,
              [...observed.source],
              sent,
              observed.independent,
              state.manager.getCwd(),
            ),
            sourceTools: observed.sourceTools,
            expectedTools: observed.expectedTools,
            preparedTools: observed.preparedTools,
            implicitToolChoice: !object(options) || options.toolChoice === undefined,
            standard: standardResult(observed.source, sent.input, state.manager.getCwd()),
          };
        } catch {
          coordinator.failure(observed, "payload-proof-unconfirmed");
        }
      };
      const onPayload: NonNullable<typeof prior> = function (this: unknown, ...args) {
        const returned = prior
          ? (Reflect.apply(prior, this, args) as ReturnType<NonNullable<typeof prior>>)
          : undefined;
        if (returned instanceof Promise) {
          void returned.then(
            (value) => capture(value, args),
            () => {
              coordinator.failure(observed, "native-payload-rejected");
            },
          );
        } else capture(returned, args);
        return returned;
      };
      return coordinator.dispatch.run(observed, () =>
        Reflect.apply(stream, this, [model, prepared, { ...options, onPayload }]),
      );
    };
    const streamPatch = patch(session.agent, "streamFn", wrappedStream);
    state.restores.push(streamPatch.restore);
    state.owned.push(streamPatch.owned);
    for (const name of ["switchSession", "branch", "navigateTree", "freshSession", "newSession", "fork"] as const) {
      const original = session[name];
      if (typeof original !== "function") continue;
      const wrapped = function (this: AgentSession, ...args: unknown[]) {
        coordinator.invalidate(state, `navigation-${name}`);
        return Reflect.apply(original, this, args);
      } as typeof original;
      const installed = patch(session, name, wrapped);
      state.restores.push(installed.restore);
      state.owned.push(installed.owned);
    }
  }
  handle(state: State): Registration {
    return {
      status: () => {
        this.valid(state);
        return { ...state.status };
      },
      invalidate: (reason) => this.invalidate(state, reason),
      close: () => this.close(state),
    };
  }
  close(state: State): void {
    if (!state.active) return;
    this.invalidate(state, "session-released");
    state.active = false;
    for (let index = state.restores.length - 1; index >= 0; index--) {
      try {
        state.restores[index]!();
      } catch {
        /* Never seize a foreign wrapper. */
      }
    }
    state.restores.length = 0;
    state.owned.length = 0;
    this.states.delete(state.session);
    const registry = this.registries.get(state.registry);
    registry?.states.delete(state);
    if (registry && !registry.states.size) {
      registry.restore();
      this.registries.delete(state.registry);
    }
    if (!this.states.size) {
      this.closed = true;
      this.retiredConflict = this.transport.some((installed) => !installed.owned());
      for (let index = this.transport.length - 1; index >= 0; index--) this.transport[index]!.restore();
      this.transport.length = 0;
      this.dispatch.disable();
    }
  }
}
function inactive(reason: string, state: Status["state"] = "disabled"): Registration {
  const value = initial(reason, state);
  return { status: () => ({ ...value }), invalidate: () => {}, close: () => {} };
}
export function register(ctx: ExtensionContext, settings: Settings, construction: Construction): Registration {
  if (!settings.enabled) return inactive("disabled");
  if (!settings.provider) return inactive("provider-not-selected", "unavailable");
  if (slots[OLD_QOL] !== undefined) return inactive("mixed-qol-owner", "unavailable");
  const present = slots[SLOT];
  if (
    present !== undefined &&
    (!object(present) ||
      present.protocol !== 1 ||
      present.version !== VERSION ||
      typeof present.register !== "function" ||
      typeof present.closed !== "boolean" ||
      !(present.states instanceof Map) ||
      !(present.roots instanceof WeakMap) ||
      !(present.parents instanceof WeakMap))
  )
    return inactive("coordinator-conflict", "unavailable");
  try {
    const session = AgentRegistry.global().get(ctx.agent.id)?.session;
    if (!session || session.sessionManager !== ctx.sessionManager || !session.extensionRunner)
      return inactive("session-interface", "unavailable");
    let coordinator = present as Coordinator | undefined;
    if (coordinator?.closed && coordinator.retiredConflict) return inactive("transport-wrapper-lost", "unavailable");
    if (!coordinator || coordinator.closed) {
      // Retaining weak ancestry/root knowledge prevents a new generation from rebinding old roots.
      const previous = coordinator;
      coordinator = new Coordinator();
      if (previous) {
        Object.defineProperties(coordinator, {
          roots: { value: previous.roots },
          parents: { value: previous.parents },
        });
      }
      slots[SLOT] = coordinator;
    }
    return coordinator.register(ctx, settings, construction, session);
  } catch {
    return inactive("host-interface", "unavailable");
  }
}
