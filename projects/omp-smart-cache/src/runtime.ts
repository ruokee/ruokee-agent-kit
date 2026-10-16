import { AsyncLocalStorage } from "node:async_hooks";
import { isDeepStrictEqual as equal } from "node:util";
import { normalizeTools, type AgentMessage, type StreamFn } from "@oh-my-pi/pi-agent-core";
import {
  toolWireSchema,
  type ApiKeyResolver,
  type Context,
  type Model,
  type SimpleStreamOptions,
} from "@oh-my-pi/pi-ai";
import { convertTools } from "@oh-my-pi/pi-ai/providers/openai-responses";
import type { AgentSession, ExtensionContext, ModelRegistry } from "@oh-my-pi/pi-coding-agent";
import { AgentRegistry } from "@oh-my-pi/pi-coding-agent/registry/agent-registry";
import { align, initialHandoff, type ChatRequest, type HandoffStatus, type Ownership } from "./handoff.ts";
import { body, nativeV2, object, reuse, type Body, type Reference } from "./reuse.ts";
import { copy, encode, nativeIndependent, payload, standardResult, units } from "./proof.ts";
import type { HandoffResult, RemoteResult, RemoteSettings, Settings } from "./settings.ts";
import type { Construction } from "./construction.ts";

const SLOT = Symbol.for("ruokee.omp-smart-cache.remote.coordinator");
const OLD_QOL = Symbol.for("ruokee.omp-qol.compaction-cache.registry");
const VERSION = "0.1.4";
const slots = globalThis as typeof globalThis & { [key: symbol]: unknown };
const increment = (value: number): number => Math.min(Number.MAX_SAFE_INTEGER, value + 1);
const nativeEvalProjection = (message: AgentMessage): boolean =>
  message.role === "custom" &&
  message.customType === "eval-state-context" &&
  message.attribution === "agent" &&
  message.display === false;

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
/** One command reports each capability in its own section. */
export interface Snapshot {
  readonly remote: Readonly<Status>;
  readonly handoff: Readonly<HandoffStatus>;
}
export interface Registration {
  status(): Snapshot;
  invalidate(reason: string): void;
  close(): void;
}
interface RemoteSelection {
  readonly active: boolean;
  readonly reason: string;
  readonly state: Status["state"];
  readonly settings?: RemoteSettings;
}
interface HandoffSelection {
  readonly enabled: boolean;
  readonly reason: string;
  readonly state: HandoffStatus["state"];
}
interface Selection {
  readonly remote: RemoteSelection;
  readonly handoff: HandoffSelection;
}
interface State {
  readonly id: number;
  readonly agentId: string;
  readonly session: AgentSession;
  readonly agent: AgentSession["agent"];
  readonly manager: AgentSession["sessionManager"];
  readonly runner: NonNullable<AgentSession["extensionRunner"]>;
  readonly registry: ModelRegistry;
  readonly selection: Selection;
  readonly nativeSource: boolean;
  readonly nativeSide: boolean;
  readonly status: Status;
  readonly handoff: HandoffSession;
  readonly raw: WeakMap<AbortSignal, Observation>;
  readonly restores: (() => void)[];
  readonly owned: (() => boolean)[];
  readonly remoteOwned: (() => boolean)[];
  readonly sideOwned: (() => boolean)[];
  active: boolean;
  epoch: number;
  reference?: Reference;
  persistent: string;
  provider: string;
  unavailable?: string;
  sourceFailure?: string;
}
interface HandoffSession {
  readonly enabled: boolean;
  readonly status: HandoffStatus;
  readonly operations: WeakMap<AbortSignal, SideOperation>;
  reference?: SideReference;
  unavailable?: string;
}
interface SideReference {
  readonly id: number;
  readonly body: ChatRequest;
  readonly owner: Ownership;
}
interface SideOperation {
  readonly id: number;
  readonly state: State;
  readonly epoch: number;
  readonly root: AbortSignal;
  readonly model: Model;
  readonly persistent: string;
  readonly provider: string;
  readonly reference: SideReference;
  sends: number;
  revoked?: boolean;
  prepared?: boolean;
  memo?: { native: string; sent: ChatRequest; reason: string };
}
interface SidePending {
  readonly id: number;
  readonly state: State;
  readonly owner: Ownership;
  readonly epoch: number;
  readonly persistent: string;
  readonly provider: string;
  readonly signal: AbortSignal;
  body?: ChatRequest;
  failed?: string;
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
  standardSource?: Reference["source"];
  payload?: Body;
  reference?: Reference;
  credential?: Operation;
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
/** Host payload and response hooks, named here so this module never publishes a `ReturnType` contract. */
type PayloadHook = NonNullable<SimpleStreamOptions["onPayload"]>;
type ResponseHook = NonNullable<SimpleStreamOptions["onResponse"]>;
type PayloadArgs = Parameters<PayloadHook>;

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
/** Remote alignment needs a selected Provider and the Responses V2 request shape. */
function remoteTarget(state: State, model: Model | undefined): boolean {
  const settings = state.selection.remote.settings;
  return (
    !!settings &&
    settings.enabled &&
    model !== undefined &&
    model.provider === settings.provider &&
    model.api === "openai-responses"
  );
}
/** The ownership a reference was captured with; one changed field refuses the operation. */
function ownerSnapshot(state: State): Ownership {
  const agent = state.agent,
    model: Model | undefined = agent.state.model;
  return {
    provider: model?.provider,
    model: model?.id,
    api: model?.api,
    baseUrl: model?.baseUrl,
    prompt: copy(agent.state.systemPrompt),
    thinkingLevel: agent.state.thinkingLevel,
    disableReasoning: agent.state.disableReasoning,
    tools: agent.state.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: copy(toolWireSchema(tool)),
    })),
  };
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
function remoteSelection(result: RemoteResult): RemoteSelection {
  if (!result.ok) return { active: false, reason: result.reason, state: "unavailable" };
  if (!result.settings.enabled) return { active: false, reason: "disabled", state: "disabled" };
  if (!result.settings.provider) return { active: false, reason: "provider-not-selected", state: "unavailable" };
  return { active: true, reason: "reference-not-sent", state: "awaiting-reference", settings: result.settings };
}
function handoffSelection(result: HandoffResult): HandoffSelection {
  if (!result.ok) return { enabled: false, reason: result.reason, state: "unavailable" };
  if (!result.settings.enabled) return { enabled: false, reason: "handoff-disabled", state: "disabled" };
  return { enabled: true, reason: "reference-not-sent", state: "awaiting-reference" };
}

class Coordinator {
  readonly protocol = 1;
  readonly version = VERSION;
  readonly states = new Map<AgentSession, State>();
  readonly registries = new Map<ModelRegistry, RegistryPatch>();
  readonly parents = new WeakMap<AbortSignal, readonly AbortSignal[]>();
  readonly roots = new WeakMap<AbortSignal, Operation | null>();
  readonly sideRoots = new WeakMap<AbortSignal, SideOperation | null>();
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
  sideOwner(signal?: AbortSignal): SideOperation | null | undefined {
    let owner: SideOperation | undefined;
    for (const parent of this.ancestors(signal)) {
      const op = this.sideRoots.get(parent);
      if (op === null || (owner && op && owner !== op)) return null;
      if (op) owner = op;
    }
    return owner;
  }
  valid(state: State): boolean {
    if (!state.active || this.closed || !state.selection.remote.active) return false;
    if (slots[OLD_QOL] !== undefined) return this.unavailable(state, "mixed-qol-owner");
    if (this.transport.some((installed) => !installed.owned()))
      return this.unavailable(state, "transport-wrapper-lost");
    if (state.owned.some((owned) => !owned()) || state.remoteOwned.some((owned) => !owned()))
      return this.unavailable(state, "session-wrapper-lost");
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
  /** Handoff uses its session seams and the coordinator's single final transport boundary. */
  validSide(state: State): boolean {
    if (!state.active || this.closed || !state.handoff.enabled) return false;
    if (slots[OLD_QOL] !== undefined) return this.unavailableSide(state, "mixed-qol-owner");
    if (this.transport.some((installed) => !installed.owned()))
      return this.unavailableSide(state, "transport-wrapper-lost");
    if (state.handoff.unavailable) {
      state.handoff.status.state = "unavailable";
      return false;
    }
    if (state.owned.some((owned) => !owned()) || state.sideOwned.some((owned) => !owned()))
      return this.unavailableSide(state, "session-wrapper-lost");
    if (
      AgentRegistry.global().get(state.agentId)?.session !== state.session ||
      state.session.agent !== state.agent ||
      state.session.sessionManager !== state.manager ||
      state.session.extensionRunner !== state.runner
    )
      return this.unavailableSide(state, "session-identity-lost");
    return true;
  }
  unavailable(state: State, reason: string): false {
    if (!state.unavailable) {
      state.unavailable = reason;
      this.invalidate(state, reason);
    }
    state.status.state = "unavailable";
    return false;
  }
  unavailableSide(state: State, reason: string): false {
    const handoff = state.handoff;
    if (!handoff.unavailable) {
      handoff.unavailable = reason;
      handoff.reference = undefined;
      handoff.status.reference = 0;
      handoff.status.online = reason;
    }
    handoff.status.state = "unavailable";
    return false;
  }
  invalidate(state: State, reason: string): void {
    state.epoch = increment(state.epoch);
    state.reference = undefined;
    state.status.reference = 0;
    if (state.selection.remote.active) {
      state.status.online = state.unavailable ?? state.sourceFailure ?? reason;
      if (!state.unavailable) state.status.state = "awaiting-reference";
    }
    const handoff = state.handoff;
    handoff.reference = undefined;
    handoff.status.reference = 0;
    if (handoff.enabled) {
      handoff.status.online = handoff.unavailable ?? reason;
      if (!handoff.unavailable) handoff.status.state = "awaiting-reference";
    }
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
  sideOperationValid(op: SideOperation): boolean {
    const state = op.state;
    if (
      op.epoch !== state.epoch ||
      op.root.aborted ||
      state.manager.getSessionId() !== op.persistent ||
      state.session.sessionId !== op.provider ||
      !modelMatches(op.model, state.session.model) ||
      !this.sideOwnershipConfirmed(state, op.reference) ||
      !this.validSide(state) ||
      state.session.isSessionTransitioning
    )
      op.revoked = true;
    return !op.revoked;
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
            remoteTarget(state, state.session.model) &&
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
      const dispatch = snapshot?.state.status.dispatch;
      return function (this: unknown, ...resolveArgs: Parameters<ApiKeyResolver>) {
        try {
          const root = resolveArgs[0]?.signal;
          if (root instanceof AbortSignal) {
            let known = coordinator.roots.get(root);
            if (!coordinator.roots.has(root)) {
              const operation = snapshot ? { ...snapshot, id: coordinator.next(), root, sends: 0 } : null;
              coordinator.roots.set(root, (known = operation));
              if (operation) {
                operation.state.status.operation = operation.id;
                operation.state.status.binding = operation.reference ? "reference-bound" : "missing-reference-bound";
              }
            }
            if (
              known &&
              snapshot &&
              snapshot.state === known.state &&
              snapshot.persistent === known.persistent &&
              snapshot.provider === known.provider &&
              modelMatches(snapshot.model, known.model)
            ) {
              // Mid-turn compaction can advance the epoch without replacing the ordinary run signal.
              // Revoke its old operation permanently; a new dispatch proves its own credential binding.
              if (snapshot.epoch !== known.epoch) known.revoked = true;
              const matches = new Set(
                coordinator
                  .ancestors(root)
                  .map((parent) => snapshot.state.raw.get(parent))
                  .filter(
                    (value): value is Observation => !!value && value.id === dispatch && value.epoch === snapshot.epoch,
                  ),
              );
              if (matches.size === 1) {
                const observation = [...matches][0]!;
                observation.credential ??=
                  known.epoch === snapshot.epoch && !known.revoked
                    ? known
                    : { ...snapshot, id: coordinator.next(), root, sends: 0 };
              }
            } else if (known) {
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
    const side = this.sideOwner(init?.signal ?? undefined);
    if (side) return this.inspectSide(side, input, init);
    const signal = init?.signal ?? undefined;
    const op = this.owner(signal);
    const inherited = this.dispatch.getStore();
    const observation =
      inherited && this.ancestors(signal).some((parent) => inherited.state.raw.get(parent) === inherited)
        ? inherited
        : undefined;
    const state = op?.state ?? observation?.state;
    if (!state || !remoteTarget(state, op?.model ?? observation?.model) || !state.active) return init;
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
      const credential = observation.credential;
      if (
        op === null ||
        !credential ||
        credential.state !== observation.state ||
        !this.ancestors(signal).includes(credential.root) ||
        !this.operationValid(credential, signal) ||
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
      const result = reuse(op.reference, value, state.selection.remote.settings!.mode);
      reason = result.reason;
      reused = result.reused;
      retained = result.retained;
      if (result.changed) outgoing = { ...init, body: JSON.stringify(result.body) };
    }
    op.memo = { native: init.body, sent: outgoing.body as string, reason, reused, retained };
    this.record(op, reason, reused, retained);
    return outgoing;
  }

  inspectSide(op: SideOperation, input: string | URL | Request, init?: RequestInit): RequestInit | undefined {
    const url = input instanceof Request ? input.url : String(input);
    const endpoint = `${op.model.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    if (url !== endpoint) return init;
    if (input instanceof Request || init?.method?.toUpperCase() !== "POST" || typeof init.body !== "string") {
      op.state.handoff.status.sending = "unsupported-transport-shape";
      return init;
    }
    const value: unknown = JSON.parse(init.body);
    if (!op.prepared) {
      this.sideRecord(op, "payload-proof-unconfirmed", 0, 0);
      return init;
    }
    const candidate = this.sideRewrite(op, value);
    return candidate === value ? init : { ...init, body: JSON.stringify(candidate) };
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

  sideRecord(op: SideOperation, reason: string, axes: number, unprojected: number): void {
    const { status } = op.state.handoff;
    const first = op.sends === 0;
    op.sends = increment(op.sends);
    status.sends = increment(status.sends);
    if (first) status.operations = increment(status.operations);
    else status.retries = increment(status.retries);
    status.axes = Math.min(Number.MAX_SAFE_INTEGER, status.axes + axes);
    status.unprojected = Math.min(Number.MAX_SAFE_INTEGER, status.unprojected + unprojected);
    status.candidate = reason;
    status.sending = reason === "rewritten" ? "rewritten-delegated" : "native-delegated";
    if (reason === "rewritten" || reason === "already-aligned") {
      status.state = reason;
      if (first) {
        status.aligned = increment(status.aligned);
        if (reason === "rewritten") status.rewritten = increment(status.rewritten);
      }
    } else {
      status.state = op.state.handoff.unavailable ? "unavailable" : "rejected";
      if (first) status.rejected = increment(status.rejected);
    }
  }

  /** A new ordinary dispatch is pending; only its confirmed 2xx response replaces the session's reference. */
  sidePending(state: State, signal?: AbortSignal): SidePending | undefined {
    const handoff = state.handoff;
    if (!signal) {
      handoff.status.online = "dispatch-signal-unconfirmed";
      return undefined;
    }
    let owner: Ownership;
    try {
      owner = ownerSnapshot(state);
    } catch {
      handoff.status.online = "source-observation-failed";
      return undefined;
    }
    handoff.status.online = "ordinary-dispatch-pending";
    if (!handoff.unavailable) handoff.status.state = "awaiting-reference";
    return {
      id: this.next(),
      state,
      owner,
      epoch: state.epoch,
      persistent: state.manager.getSessionId(),
      provider: state.session.sessionId,
      signal,
    };
  }
  sideCapture(pending: SidePending, returned: unknown, args: unknown[]): void {
    const value = returned ?? args[0];
    if (!object(value)) {
      this.sideFailure(pending, "payload-proof-unconfirmed");
      return;
    }
    if (pending.body !== undefined) {
      // A retry must resend the same body; a changed payload invalidates the pending reference.
      if (!equal(pending.body, value)) {
        this.sideFailure(pending, "payload-retry-changed");
        pending.body = undefined;
      }
      return;
    }
    pending.body = copy(value) as ChatRequest;
  }
  sideFailure(pending: SidePending, reason: string): void {
    pending.failed = reason;
    pending.state.handoff.status.online = reason;
  }
  sideConfirm(pending: SidePending, response: unknown): void {
    const handoff = pending.state.handoff;
    if (pending.failed || pending.body === undefined) return;
    if (!object(response) || typeof response.status !== "number" || response.status < 200 || response.status >= 300)
      return;
    const state = pending.state;
    if (
      pending.epoch !== state.epoch ||
      pending.signal.aborted ||
      pending.persistent !== state.manager.getSessionId() ||
      pending.provider !== state.session.sessionId ||
      state.session.isSessionTransitioning ||
      !this.validSide(state) ||
      !this.sideOwnershipConfirmed(state, pending)
    ) {
      this.sideFailure(pending, "dispatch-invalidated");
      return;
    }
    if (!Array.isArray(pending.body.messages)) {
      handoff.status.online = "unsupported-payload-shape";
      return;
    }
    handoff.reference = { id: pending.id, body: pending.body, owner: pending.owner };
    handoff.status.reference = pending.id;
    handoff.status.online = "ordinary-send-confirmed";
    if (!handoff.unavailable) handoff.status.state = "awaiting-reference";
  }
  sideOwnershipConfirmed(state: State, reference: Pick<SideReference, "owner">): boolean {
    try {
      return equal(reference.owner, ownerSnapshot(state));
    } catch {
      return false;
    }
  }
  /** Bind the native handoff snapshot to its own operation signal, never to a shared or newer reference. */
  sideBind(state: State, messages: AgentMessage[], signal?: AbortSignal): void {
    const handoff = state.handoff;
    if (!handoff.enabled || !signal || !state.session.isGeneratingHandoff || state.session.isSessionTransitioning)
      return;
    const tail: unknown = messages[messages.length - 1];
    if (!object(tail) || tail.role !== "user" || tail.attribution !== "agent") return;
    if (
      messages.length !== state.agent.state.messages.length + 1 ||
      !equal(messages.slice(0, -1), state.agent.state.messages)
    )
      return;
    const reference = handoff.reference;
    if (!reference) {
      handoff.status.binding = "live-reference-unconfirmed";
      return;
    }
    if (!this.sideOwnershipConfirmed(state, reference)) {
      handoff.status.binding = "reference-owner-changed";
      return;
    }
    if (this.sideRoots.has(signal)) {
      handoff.status.binding = "operation-already-bound";
      return;
    }
    const operation: SideOperation = {
      id: this.next(),
      state,
      epoch: state.epoch,
      root: signal,
      model: copy(state.session.model!) as Model,
      persistent: state.manager.getSessionId(),
      provider: state.session.sessionId,
      reference,
      sends: 0,
    };
    handoff.operations.set(signal, operation);
    this.sideRoots.set(signal, operation);
    handoff.status.binding = "reference-bound";
  }
  /** Project only the final physical body; callbacks never count a send or publish a rewrite. */
  sideRewrite(op: SideOperation, value: unknown): unknown {
    if (!object(value)) {
      this.sideRecord(op, "unsupported-payload-shape", 0, 0);
      return value;
    }
    const side = value as ChatRequest;
    if (!this.sideOperationValid(op)) {
      this.sideRecord(op, op.state.handoff.unavailable ?? "operation-invalidated", 0, 0);
      return side;
    }
    const native = JSON.stringify(side);
    const memo = op.memo;
    if (memo && memo.native === native) {
      this.sideRecord(op, memo.reason, 0, 0);
      return memo.reason === "rewritten" ? memo.sent : side;
    }
    const alignment = align(op.reference.body, side);
    const outgoing = alignment.body ?? side;
    op.memo = { native, sent: outgoing, reason: alignment.reason };
    this.sideRecord(op, alignment.reason, alignment.axes, alignment.unprojected);
    return outgoing;
  }

  register(
    ctx: ExtensionContext,
    selection: Selection,
    construction: Construction,
    session: AgentSession,
  ): Registration {
    const known = this.states.get(session);
    if (known) {
      if (!equal(known.selection, selection))
        return inactive("activation-conflict", "unavailable", "activation-conflict", "unavailable");
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
      selection,
      nativeSource: construction.confirms(session),
      nativeSide: construction.confirmsSide(session),
      status: selection.remote.active
        ? initial("reference-not-sent")
        : initial(selection.remote.reason, selection.remote.state),
      handoff: {
        enabled: selection.handoff.enabled,
        status: selection.handoff.enabled
          ? initialHandoff("reference-not-sent")
          : initialHandoff(selection.handoff.reason, selection.handoff.state),
        operations: new WeakMap(),
      },
      raw: new WeakMap(),
      restores: [],
      owned: [],
      remoteOwned: [],
      sideOwned: [],
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
      this.unavailableSide(state, "host-interface");
      this.close(state);
      return inactive("host-interface", "unavailable", "host-interface", "unavailable");
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
          // The remote section reports only its own capability while remote is not active.
          if (state.selection.remote.active) {
            state.reference = undefined;
            state.sourceFailure = undefined;
            state.status.reference = 0;
            state.status.dispatch = 0;
            state.status.online = "ordinary-dispatch-pending";
            if (!state.unavailable) state.status.state = "awaiting-reference";
            if (coordinator.valid(state) && remoteTarget(state, session.model) && !session.isSessionTransitioning) {
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
                  convertTools(
                    normalized,
                    model.compat.supportsStrictMode !== false,
                    model as Model<"openai-responses">,
                  ),
                ),
                independent: state.nativeSource && nativeIndependent(session, messages),
              };
              state.raw.set(signal, observation);
              state.status.dispatch = observation.id;
            } else if (!state.unavailable)
              state.status.online = session.isSessionTransitioning ? "navigation-unsettled" : "model-not-targeted";
          }
        }
      } catch {
        if (state.selection.remote.active) state.sourceFailure = state.status.online = "source-observation-failed";
      }
      const result: Promise<AgentMessage[]> = Reflect.apply(context, this, [messages, signal]);
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
    state.remoteOwned.push(contextPatch.owned);
    const stream = session.agent.streamFn;
    const wrappedStream: StreamFn = function (this: AgentSession["agent"], model, prepared, options) {
      if (model?.api === "openai-completions") {
        // Only an ordinary main-loop dispatch with tools supplies a reference: never a handoff window,
        // never a dispatch without a tool set to bind the reference to.
        if (!coordinator.validSide(state) || state.session.isGeneratingHandoff || !prepared.tools?.length)
          return Reflect.apply(stream, this, [model, prepared, options]);
        const observed = coordinator.sidePending(state, options?.signal);
        if (!observed) return Reflect.apply(stream, this, [model, prepared, options]);
        const prior = options?.onPayload,
          priorResponse = options?.onResponse;
        const onPayload: PayloadHook = function (this: unknown, ...args) {
          const returned = prior ? Reflect.apply(prior, this, args) : undefined;
          // Containment: a throw here would break the host's own request pipeline.
          const capture = (value: unknown) => {
            try {
              coordinator.sideCapture(observed, value, args);
            } catch {
              coordinator.sideFailure(observed, "source-observation-failed");
            }
          };
          if (returned instanceof Promise)
            void returned.then(capture, () => coordinator.sideFailure(observed, "native-payload-rejected"));
          else capture(returned);
          return returned;
        };
        const onResponse: ResponseHook = function (this: unknown, ...args) {
          const settled = priorResponse ? Reflect.apply(priorResponse, this, args) : undefined;
          coordinator.sideConfirm(observed, args[0]);
          return settled;
        };
        return Reflect.apply(stream, this, [model, prepared, { ...options, onPayload, onResponse }]);
      }
      if (!remoteTarget(state, model)) return Reflect.apply(stream, this, [model, prepared, options]);
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
          const projected = state.nativeSource && observation.raw.some(nativeEvalProjection);
          if (projected && state.selection.remote.settings?.mode === "standard")
            observation.standardSource = copy(encode(model, observation.raw));
          // Display-derived Eval context is not part of the journal used by native compaction.
          const source = projected
            ? observation.raw.filter((message) => !nativeEvalProjection(message))
            : observation.raw;
          observation.source = copy(encode(model, source));
        } else state.status.online = "dispatch-unconfirmed";
      } catch {
        if (observation) coordinator.failure(observation, "source-encoding-unconfirmed");
        else state.sourceFailure = state.status.online = "source-encoding-unconfirmed";
      }
      if (!observation?.source) return Reflect.apply(stream, this, [model, prepared, options]);
      const observed = observation;
      const prior = options?.onPayload;
      const capture = (returned: unknown, args: PayloadArgs): void => {
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
            standard: standardResult(observed.standardSource ?? observed.source, sent.input, state.manager.getCwd()),
          };
        } catch {
          coordinator.failure(observed, "payload-proof-unconfirmed");
        }
      };
      const onPayload: PayloadHook = function (this: unknown, ...args) {
        const returned: unknown = prior ? Reflect.apply(prior, this, args) : undefined;
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
    if (state.handoff.enabled) {
      // A handoff seam this host does not expose leaves the handoff capability unavailable only.
      try {
        this.observeSide(state);
      } catch {
        this.unavailableSide(state, "host-interface");
      }
    }
  }
  /** The two handoff-only seams. A missing interface leaves this capability unavailable, not the session. */
  observeSide(state: State): void {
    const { session } = state;
    if (
      typeof session.convertMessagesToLlm !== "function" ||
      typeof session.prepareSimpleStreamOptions !== "function" ||
      typeof session.isGeneratingHandoff !== "boolean"
    ) {
      this.unavailableSide(state, "session-interface");
      return;
    }
    if (!state.nativeSide) {
      this.unavailableSide(state, "session-construction-unconfirmed");
      return;
    }
    const convert = session.convertMessagesToLlm;
    const coordinator = this;
    const wrappedConvert: typeof convert = function (this: AgentSession, messages, signal) {
      try {
        coordinator.sideBind(state, messages, signal);
      } catch {
        state.handoff.status.binding = "binding-inspection-failed";
      }
      return Reflect.apply(convert, this, [messages, signal]);
    };
    const convertPatch = patch(session, "convertMessagesToLlm", wrappedConvert);
    state.restores.push(convertPatch.restore);
    state.sideOwned.push(convertPatch.owned);
    const prepare = session.prepareSimpleStreamOptions;
    const wrappedPrepare: typeof prepare = function (this: AgentSession, options, provider) {
      const operation = options?.signal ? state.handoff.operations.get(options.signal) : undefined;
      if (!operation) return Reflect.apply(prepare, this, [options, provider]);
      const prior = options.onPayload;
      const onPayload: PayloadHook = function (this: unknown, ...args) {
        const returned = prior ? Reflect.apply(prior, this, args) : undefined;
        const prepared = (value: unknown) => {
          operation.prepared = object(value ?? args[0]);
          return value;
        };
        return returned instanceof Promise ? returned.then(prepared) : prepared(returned);
      };
      return Reflect.apply(prepare, this, [{ ...options, onPayload }, provider]);
    };
    const preparePatch = patch(session, "prepareSimpleStreamOptions", wrappedPrepare);
    state.restores.push(preparePatch.restore);
    state.sideOwned.push(preparePatch.owned);
  }
  handle(state: State): Registration {
    return {
      status: () => {
        this.valid(state);
        this.validSide(state);
        return { remote: { ...state.status }, handoff: { ...state.handoff.status } };
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
    state.remoteOwned.length = 0;
    state.sideOwned.length = 0;
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
function inactive(
  remoteReason: string,
  remoteState: Status["state"] = "disabled",
  handoffReason = remoteReason,
  handoffState: HandoffStatus["state"] = "disabled",
): Registration {
  const remote = initial(remoteReason, remoteState);
  const handoff = initialHandoff(handoffReason, handoffState);
  return {
    status: () => ({ remote: { ...remote }, handoff: { ...handoff } }),
    invalidate: () => {},
    close: () => {},
  };
}
export function register(ctx: ExtensionContext, settings: Settings, construction: Construction): Registration {
  const remote = remoteSelection(settings.remote);
  const handoff = handoffSelection(settings.handoff);
  // Only a capability that is active reports a shared conflict as its own state.
  const refuse = (reason: string): Registration =>
    inactive(
      remote.active ? reason : remote.reason,
      remote.active ? "unavailable" : remote.state,
      handoff.enabled ? reason : handoff.reason,
      handoff.enabled ? "unavailable" : handoff.state,
    );
  if (!remote.active && !handoff.enabled) return inactive(remote.reason, remote.state, handoff.reason, handoff.state);
  if (slots[OLD_QOL] !== undefined) return refuse("mixed-qol-owner");
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
    return refuse("coordinator-conflict");
  try {
    const session = AgentRegistry.global().get(ctx.agent.id)?.session;
    if (!session || session.sessionManager !== ctx.sessionManager || !session.extensionRunner)
      return refuse("session-interface");
    let coordinator = present as Coordinator | undefined;
    if (coordinator?.closed && coordinator.retiredConflict) return refuse("transport-wrapper-lost");
    if (!coordinator || coordinator.closed) {
      // Retaining weak ancestry/root knowledge prevents a new generation from rebinding old roots.
      const previous = coordinator;
      coordinator = new Coordinator();
      if (previous) {
        Object.defineProperties(coordinator, {
          roots: { value: previous.roots },
          parents: { value: previous.parents },
          sideRoots: { value: previous.sideRoots },
        });
      }
      slots[SLOT] = coordinator;
    }
    return coordinator.register(ctx, { remote, handoff }, construction, session);
  } catch {
    return refuse("host-interface");
  }
}
