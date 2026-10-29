import { expect, test } from "bun:test";
import { streamSimple } from "@oh-my-pi/pi-ai";
import { wrapFetchForCch } from "@oh-my-pi/pi-ai/providers/anthropic";
import type { Context, FetchImpl, SimpleStreamOptions } from "@oh-my-pi/pi-ai";
import type { AgentSession } from "@oh-my-pi/pi-coding-agent";
import { AgentRegistry } from "@oh-my-pi/pi-coding-agent/registry/agent-registry";
import { register, type Registration } from "../src/runtime.ts";
import { convertToLlm } from "@oh-my-pi/pi-coding-agent/session/messages";
import type { ApiKeyResolver, Model as NativeModel } from "@oh-my-pi/pi-ai";
import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import { encode } from "../src/proof.ts";
import type { AlignmentSettings } from "../src/settings.ts";

type Model = {
  provider: string;
  id: string;
  api: string;
  baseUrl: string;
  compat?: object;
  identity?: { class: string };
};

const AGENT = "runtime-test-agent";

const handoffOnly: AlignmentSettings = {
  remote: { ok: true, settings: { enabled: false, providerFilter: "", mode: "hooks" } },
  handoff: { ok: true, settings: { enabled: true } },
};
const bothOff: AlignmentSettings = {
  remote: { ok: true, settings: { enabled: false, providerFilter: "", mode: "hooks" } },
  handoff: { ok: true, settings: { enabled: false } },
};

const SYSTEM = { role: "system", content: "base" };
const TURN = { role: "user", content: "ask" };
const TOOL = { name: "read", description: "read", parameters: { type: "object", properties: {} } };
const MODEL: Model = {
  provider: "test",
  id: "test-model",
  api: "openai-completions",
  baseUrl: "https://example.invalid",
};
/** A model whose API is the one remote alignment targets, so its own capture path runs. */
const RESPONSES_MODEL: NativeModel<"openai-responses"> = {
  provider: "test",
  id: "test-responses",
  name: "Runtime proof model",
  api: "openai-responses",
  baseUrl: "https://example.invalid",
  identity: { class: "unknown" },
  reasoning: false,
  input: ["text"],
  contextWindow: 40000,
  maxTokens: 1000,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  compat: { strictResponsesPairing: true } as NativeModel<"openai-responses">["compat"],
};

interface StreamOptions {
  signal?: AbortSignal;
  onPayload?: (payload: unknown) => unknown;
  onResponse?: (response: unknown) => unknown;
}
interface SideOptions extends StreamOptions {
  toolChoice?: string;
  fetch?: FetchImpl;
}
interface FakeAgent {
  state: {
    messages: unknown[];
    model: Model;
    tools: (typeof TOOL)[];
    systemPrompt: string[];
    thinkingLevel: string;
    disableReasoning: boolean;
  };
  streamFn: (...args: unknown[]) => unknown;
  addBeforeModelCallHook: (hook: (signal?: AbortSignal) => void) => () => void;
  intentTracing: boolean;
  pruneToolDescriptions: boolean;
}

interface FakeSession {
  agent: FakeAgent;
  sessionId: string;
  isSessionTransitioning: boolean;
  isGeneratingHandoff: boolean;
  model: Model;
  sessionManager: {
    getSessionId(): string;
    getBranch(): unknown[];
    buildSessionContext(): { messages: AgentMessage[] };
  };
  extensionRunner: { emitContext: (...args: unknown[]) => unknown; hasHandlers: (event: string) => boolean };
  convertMessagesToLlm: (messages: unknown[], signal?: AbortSignal) => unknown;
  prepareSimpleStreamOptions: (options: SideOptions) => SideOptions;
  addDisposer: (dispose: () => void) => void;
  switchSession: () => unknown;
  branch: () => unknown;
  navigateTree: () => unknown;
  freshSession: () => unknown;
  newSession: () => unknown;
  fork: () => unknown;
}

class FakeHandoff {
  convertMessagesToLlm(messages: unknown[], _signal?: AbortSignal): unknown {
    return messages;
  }
  prepareSimpleStreamOptions(options: SideOptions): SideOptions {
    return options;
  }
}

/**
 * A session shaped like the seams this capability uses. The native stream writes the payload it received and
 * answers 200, which is exactly what the host does, so one dispatch drives capture, confirmation and binding.
 */
function fakeSession(model: Model = MODEL) {
  const hooks: ((signal?: AbortSignal) => void)[] = [];
  const session: FakeSession = Object.assign(new FakeHandoff(), {
    agent: {
      state: {
        messages: [],
        model,
        tools: [TOOL],
        systemPrompt: ["base"],
        thinkingLevel: "low",
        disableReasoning: false,
      },
      streamFn: (model: unknown, prepared: unknown, options: unknown) => {
        const settings = options as {
          onPayload?: (payload: unknown) => unknown;
          onResponse?: (response: unknown) => unknown;
        };
        const payload = (prepared as { messages: unknown[] }).messages.length
          ? { messages: (prepared as { messages: unknown[] }).messages }
          : { messages: [] };
        void settings.onPayload?.(payload);
        void settings.onResponse?.({ status: 200 });
        return Promise.resolve([]);
      },
      addBeforeModelCallHook: (hook) => {
        hooks.push(hook);
        return () => hooks.splice(hooks.indexOf(hook), 1);
      },
      intentTracing: false,
      pruneToolDescriptions: false,
    },
    sessionId: "session-1",
    isSessionTransitioning: false,
    isGeneratingHandoff: false,
    model,
    sessionManager: {
      getSessionId: () => "session-1",
      getBranch: () => [],
      buildSessionContext: () => ({ messages: [] }),
    },
    extensionRunner: { emitContext: (messages: unknown) => Promise.resolve(messages), hasHandlers: () => true },
    addDisposer: () => {},
    switchSession: () => undefined,
    branch: () => undefined,
    navigateTree: () => undefined,
    freshSession: () => undefined,
    newSession: () => undefined,
    fork: () => undefined,
  } satisfies Omit<FakeSession, "convertMessagesToLlm" | "prepareSimpleStreamOptions">);
  return { session, hooks };
}

function activate(
  settings: AlignmentSettings,
  model: Model = MODEL,
  stream?: FakeAgent["streamFn"],
  beforeRegister?: (session: FakeSession) => void,
) {
  const registry = AgentRegistry.global();
  const { session, hooks } = fakeSession(model);
  if (stream) session.agent.streamFn = stream;
  if (!registry.get(AGENT))
    registry.register({ id: AGENT, displayName: AGENT, kind: "main", session: null, status: "idle" });
  registry.attachSession(AGENT, session as unknown as AgentSession);
  const ctx = {
    agent: { id: AGENT },
    modelRegistry: {
      resolver:
        (_model: Model, _provider: string): ApiKeyResolver =>
        () =>
          "fixture-key",
    },
    sessionManager: session.sessionManager,
    cwd: "/tmp",
  };
  Object.assign(session.sessionManager, { getCwd: () => "/tmp" });
  beforeRegister?.(session);
  const registration = register(ctx as unknown as Parameters<typeof register>[0], settings);
  return { session, hooks, registration, registry, modelRegistry: ctx.modelRegistry };
}

/** The host adds the operation signal before the request and reads the context with the same signal. */
async function ordinaryDispatch(
  session: FakeSession,
  hooks: ((signal?: AbortSignal) => void)[],
  signal: AbortSignal,
  tools: unknown[] = [TOOL],
) {
  for (const hook of hooks) hook(signal);
  await (session.extensionRunner.emitContext as (messages: unknown[], signal?: AbortSignal) => unknown)(
    [SYSTEM, TURN],
    signal,
  );
  return session.agent.streamFn(session.model, { messages: [SYSTEM, TURN], tools }, { signal });
}

test("a handoff-only session keeps the remote section switched off across a dispatch", async () => {
  const { session, hooks, registration, registry } = activate(handoffOnly);
  expect(registration.status()).toEqual({
    remote: expect.objectContaining({ state: "disabled" }),
    handoff: expect.objectContaining({ state: "awaiting-reference" }),
  });
  const controller = new AbortController();
  await ordinaryDispatch(session, hooks, controller.signal);
  await Promise.resolve();
  const status = registration.status();
  expect(status.remote.state).toBe("disabled");
  expect(status.handoff.online).toBe("ordinary-send-confirmed");
  expect(status.handoff.reference).toBeGreaterThan(0);
  registration.close();
  registry.unregister(AGENT);
});

test("a switched-off handoff session reports no dispatch bookkeeping at all", async () => {
  const { session, hooks, registration, registry } = activate(bothOff);
  const controller = new AbortController();
  await ordinaryDispatch(session, hooks, controller.signal);
  const status = registration.status();
  expect(status.remote.state).toBe("disabled");
  expect(status.handoff.state).toBe("disabled");
  expect(status.handoff.reference).toBe(0);
  expect(status.handoff.sends).toBe(0);
  registration.close();
  registry.unregister(AGENT);
});

const remoteOnly: AlignmentSettings = {
  remote: { ok: true, settings: { enabled: true, providerFilter: "test", mode: "hooks" } },
  handoff: { ok: true, settings: { enabled: false } },
};

test("an ordinary context during navigation reports the unsettled session without a reference", async () => {
  const { session, hooks, registration, registry } = activate(remoteOnly, RESPONSES_MODEL);
  try {
    session.isSessionTransitioning = true;
    const signal = new AbortController().signal;
    for (const hook of hooks) hook(signal);
    await session.extensionRunner.emitContext([SYSTEM, TURN], signal);
    const status = registration.status().remote;
    expect(status.online).toBe("navigation-unsettled");
    expect(status.reference).toBe(0);
    expect(status.dispatch).toBe(0);
  } finally {
    registration.close();
    registry.unregister(AGENT);
  }
});

test("a dispatch without a tool set never supplies a reference", async () => {
  const { session, hooks, registration, registry } = activate(handoffOnly);
  const controller = new AbortController();
  await ordinaryDispatch(session, hooks, controller.signal, []);
  await Promise.resolve();
  expect(registration.status().handoff.reference).toBe(0);
  expect(registration.status().handoff.state).toBe("awaiting-reference");
  const handoff = new AbortController();
  const instruction = { role: "user", content: "write a handoff document", attribution: "agent" };
  session.agent.state.messages = [SYSTEM, TURN];
  session.isGeneratingHandoff = true;
  (session.convertMessagesToLlm as (messages: unknown[], signal?: AbortSignal) => unknown)(
    [SYSTEM, TURN, instruction],
    handoff.signal,
  );
  const prepared = (
    session.prepareSimpleStreamOptions as (options: unknown) => { onPayload?: (payload: unknown) => unknown }
  )({ signal: handoff.signal, toolChoice: "none" });
  expect(prepared.onPayload).toBeUndefined();
  const status = registration.status();
  expect(status.handoff.state).toBe("awaiting-reference");
  expect(status.handoff.aligned).toBe(0);
  expect(status.handoff.sends).toBe(0);
  expect(status.handoff.rejected).toBe(0);
  registration.close();
  registry.unregister(AGENT);
});

test("startup transport composition preserves handoff sends and permanent invalidation", async () => {
  const originalFetch = globalThis.fetch;
  const wires: unknown[] = [];
  const transport = (async (_input: unknown, init?: RequestInit) => {
    wires.push(JSON.parse(String(init?.body)));
    return new Response("ok");
  }) as typeof fetch;
  Object.defineProperties(transport, Object.getOwnPropertyDescriptors(originalFetch));
  const { session, hooks, registration, registry } = activate(handoffOnly);
  try {
    globalThis.fetch = transport;
    expect(registration.status().handoff.state).toBe("awaiting-reference");
    await ordinaryDispatch(session, hooks, new AbortController().signal);
    const signal = new AbortController().signal;
    const instruction = { role: "user", content: "write a handoff document", attribution: "agent" };
    session.agent.state.messages = [SYSTEM, TURN];
    session.isGeneratingHandoff = true;
    session.convertMessagesToLlm([SYSTEM, TURN, instruction], signal);
    const prepared = session.prepareSimpleStreamOptions({ signal, toolChoice: "none" });
    const native = { messages: [SYSTEM, TURN, instruction], tool_choice: "none", reasoning_effort: "low" };
    const candidate = (await prepared.onPayload?.(native)) ?? native;
    expect(registration.status().handoff.sends).toBe(0);
    const send = () =>
      fetch(`${MODEL.baseUrl}/chat/completions`, {
        method: "POST",
        body: JSON.stringify(candidate),
        signal: AbortSignal.any([signal]),
      });
    await send();
    expect(wires.at(-1)).toEqual({ messages: native.messages, reasoning_effort: "low" });
    await send();
    expect(registration.status().handoff).toEqual(
      expect.objectContaining({ operations: 1, sends: 2, retries: 1, aligned: 2 }),
    );
    session.agent.state.tools = [];
    await send();
    expect(wires.at(-1)).toEqual(native);
    session.agent.state.tools = [TOOL];
    await send();
    expect(wires.at(-1)).toEqual(native);
    const ownedFetch = globalThis.fetch;
    globalThis.fetch = transport;
    expect(registration.status().handoff.online).toBe("transport-wrapper-lost");
    globalThis.fetch = ownedFetch;
    await ordinaryDispatch(session, hooks, new AbortController().signal);
    expect(registration.status().handoff.state).toBe("unavailable");
    registration.close();
    expect(globalThis.fetch).toBe(transport);
  } finally {
    registration.close();
    registry.unregister(AGENT);
    globalThis.fetch = originalFetch;
  }
});

test("late ordinary responses cannot revive invalidated handoff references", async () => {
  const mutations: ((session: FakeSession, registration: Registration, controller: AbortController) => void)[] = [
    (_session, registration) => registration.invalidate("native-history-committed"),
    (_session, _registration, controller) => controller.abort(),
    (session) => {
      session.agent.state.tools = [];
    },
    (session) => {
      session.agent.state.systemPrompt = ["changed"];
    },
    (session) => {
      session.agent.state.thinkingLevel = "high";
    },
    (session) => {
      session.sessionId = "another-session";
    },
  ];
  for (const mutate of mutations) {
    let respond: StreamOptions["onResponse"];
    const stream: FakeAgent["streamFn"] = (_model, _prepared, options) => {
      const settings = options as StreamOptions;
      settings.onPayload?.({ messages: [SYSTEM, TURN] });
      respond = settings.onResponse;
      return Promise.resolve([]);
    };
    const { session, hooks, registration, registry } = activate(handoffOnly, MODEL, stream);
    try {
      const controller = new AbortController();
      await ordinaryDispatch(session, hooks, controller.signal);
      mutate(session, registration, controller);
      respond?.({ status: 200 });
      expect(registration.status().handoff.reference).toBe(0);
    } finally {
      registration.close();
      registry.unregister(AGENT);
    }
  }
});

test("preinstalled handoff wrappers remain untouched while remote stays available", () => {
  for (const name of ["convertMessagesToLlm", "prepareSimpleStreamOptions"] as const) {
    let foreign!: FakeSession[typeof name];
    const { session, registration, registry } = activate(
      { ...remoteOnly, handoff: handoffOnly.handoff },
      RESPONSES_MODEL,
      undefined,
      (session) => {
        const original = session[name];
        foreign = function (this: FakeSession, ...args: unknown[]) {
          return Reflect.apply(original, this, args);
        };
        Object.defineProperty(session, name, { value: foreign, configurable: true, writable: true });
      },
    );
    try {
      expect(session[name]).toBe(foreign);
      expect(registration.status().handoff.state).toBe("unavailable");
      expect(registration.status().remote.state).toBe("awaiting-reference");
      registration.close();
      expect(session[name]).toBe(foreign);
    } finally {
      registration.close();
      registry.unregister(AGENT);
    }
  }
});

test("handoff release preserves a later foreign wrapper", () => {
  const { session, registration, registry } = activate(handoffOnly);
  const foreign: FakeSession["convertMessagesToLlm"] = (messages) => messages;
  session.convertMessagesToLlm = foreign;
  try {
    registration.close();
    expect(session.convertMessagesToLlm).toBe(foreign);
  } finally {
    registry.unregister(AGENT);
  }
});

test("ordinary tool continuation restores a reference after compaction without reviving old operations", async () => {
  const originalFetch = globalThis.fetch;
  const wires: { input: unknown[]; [key: string]: unknown }[] = [];
  const transport = (async (_input: unknown, init?: RequestInit) => {
    wires.push(JSON.parse(init!.body as string));
    return new Response("ok");
  }) as typeof fetch;
  Object.defineProperties(transport, Object.getOwnPropertyDescriptors(originalFetch));
  globalThis.fetch = transport;
  let label = "first";
  const endpoint = "https://example.invalid/v1/responses";
  const stream = async (_model: unknown, _prepared: unknown, options: unknown) => {
    const { signal, onPayload } = options as { signal: AbortSignal; onPayload(payload: unknown): unknown };
    const body = {
      model: RESPONSES_MODEL.id,
      instructions: "base",
      store: false,
      stream: true,
      tools: [],
      input: [{ role: "user", content: [{ type: "input_text", text: `sent ${label}` }] }],
    };
    await onPayload(body);
    await fetch(endpoint, { method: "POST", body: JSON.stringify(body), signal: AbortSignal.any([signal]) });
  };
  const { session, hooks, registration, registry, modelRegistry } = activate(remoteOnly, RESPONSES_MODEL, stream);
  session.agent.state.tools = [];
  const signal = new AbortController();
  const source: AgentMessage[] = [{ role: "user", content: "retained source", timestamp: 1 }];
  const resolve = async (root: AbortSignal) => {
    const resolver = modelRegistry.resolver(session.model, session.sessionId);
    await resolver({ signal: root, lastChance: false, error: undefined });
  };
  const ordinary = async () => {
    for (const hook of hooks) hook(signal.signal);
    await session.extensionRunner.emitContext(source, signal.signal);
    await resolve(signal.signal);
    await session.agent.streamFn(session.model, { messages: source, tools: [] }, { signal: signal.signal });
  };
  const compactBody = {
    model: RESPONSES_MODEL.id,
    instructions: "base",
    store: false,
    stream: true,
    tools: [],
    input: [...encode(RESPONSES_MODEL as unknown as NativeModel, source), { type: "compaction_trigger" }],
  };
  const compact = (root: AbortSignal) =>
    fetch(endpoint, {
      method: "POST",
      body: JSON.stringify(compactBody),
      signal: AbortSignal.any([root]),
    });
  try {
    await ordinary();
    const first = wires.at(-1)!.input;
    const oldOperation = new AbortController();
    await resolve(oldOperation.signal);
    label = "newer before commit";
    await ordinary();
    await compact(oldOperation.signal);
    expect(wires.at(-1)!.input).toEqual([...first, { type: "compaction_trigger" }]);

    registration.invalidate("native-history-committed");
    label = "after commit";
    await ordinary();
    const fresh = wires.at(-1)!.input;
    expect(registration.status().remote.online).toBe("ordinary-send-confirmed");
    const nextOperation = new AbortController();
    await resolve(nextOperation.signal);
    await compact(nextOperation.signal);
    expect(wires.at(-1)!.input).toEqual([...fresh, { type: "compaction_trigger" }]);

    await compact(oldOperation.signal);
    expect(wires.at(-1)).toEqual(compactBody);
    signal.abort();
    await ordinary();
    expect(registration.status().remote.reference).toBe(0);
  } finally {
    registration.close();
    registry.unregister(AGENT);
    globalThis.fetch = originalFetch;
  }
});

test("native display-only Eval context is a prepared projection, not a deleted history dependency", async () => {
  const projection: AgentMessage = {
    role: "custom",
    customType: "eval-state-context",
    content: "Eval runtime state is host-retained, not reconstructed from transcript text.",
    attribution: "agent",
    display: false,
    timestamp: 2,
  };
  const cases: { message: AgentMessage; persisted: boolean; aligned: boolean }[] = [
    { message: projection, persisted: false, aligned: true },
    { message: projection, persisted: true, aligned: false },
    { message: { ...projection, attribution: "user" }, persisted: false, aligned: false },
    { message: { ...projection, customType: "other-context" }, persisted: false, aligned: false },
    { message: { ...projection, display: true }, persisted: false, aligned: false },
    { message: { role: "user", content: projection.content, timestamp: 2 }, persisted: false, aligned: false },
  ];
  const originalFetch = globalThis.fetch;
  const endpoint = "https://example.invalid/v1/responses";
  for (const scenario of cases.flatMap((value) =>
    (["hooks", "standard"] as const).map((mode) => ({ ...value, mode })),
  )) {
    const wires: { input: unknown[]; [key: string]: unknown }[] = [];
    const transport = (async (_input: unknown, init?: RequestInit) => {
      wires.push(JSON.parse(init!.body as string));
      return new Response("ok");
    }) as typeof fetch;
    Object.defineProperties(transport, Object.getOwnPropertyDescriptors(originalFetch));
    globalThis.fetch = transport;
    const history: AgentMessage[] = [
      {
        role: "user",
        content: [],
        timestamp: 1,
        providerPayload: {
          type: "openaiResponsesHistory",
          provider: RESPONSES_MODEL.provider,
          items: [{ type: "compaction", id: "persisted-opaque", encrypted_content: "opaque-bytes" }],
        },
      },
    ];
    const raw = [...history, scenario.message];
    const stream = async (_model: unknown, _prepared: unknown, options: unknown) => {
      const { signal, onPayload } = options as { signal: AbortSignal; onPayload(payload: unknown): unknown };
      const messages = convertToLlm(raw);
      const body = {
        model: RESPONSES_MODEL.id,
        instructions: "base",
        store: false,
        stream: true,
        tools: [],
        input: encode(RESPONSES_MODEL, messages, true),
      };
      await onPayload(body);
      await fetch(endpoint, { method: "POST", body: JSON.stringify(body), signal: AbortSignal.any([signal]) });
    };
    const settings: AlignmentSettings = {
      remote: { ok: true, settings: { enabled: true, providerFilter: "test", mode: scenario.mode } },
      handoff: remoteOnly.handoff,
    };
    const { session, hooks, registration, registry, modelRegistry } = activate(settings, RESPONSES_MODEL, stream);
    session.sessionManager.buildSessionContext = () => ({
      messages: structuredClone(scenario.persisted ? raw : history),
    });
    session.agent.state.tools = [];
    const resolve = async (signal: AbortSignal) => {
      await modelRegistry.resolver(session.model, session.sessionId)({ signal, lastChance: false, error: undefined });
    };
    try {
      const ordinary = new AbortController();
      for (const hook of hooks) hook(ordinary.signal);
      await session.extensionRunner.emitContext(raw, ordinary.signal);
      await resolve(ordinary.signal);
      await session.agent.streamFn(session.model, { messages: raw, tools: [] }, { signal: ordinary.signal });
      const sent = wires.at(-1)!;
      const tail = { role: "user", content: [{ type: "input_text", text: "new retained tail" }] };
      const trigger = { type: "compaction_trigger" };
      const native = {
        model: RESPONSES_MODEL.id,
        instructions: "base",
        store: false,
        stream: true,
        tools: [],
        input: [...encode(RESPONSES_MODEL, history), tail, trigger],
      };
      const compaction = new AbortController();
      await resolve(compaction.signal);
      await fetch(endpoint, {
        method: "POST",
        body: JSON.stringify(native),
        signal: AbortSignal.any([compaction.signal]),
      });
      expect(wires.at(-1)).toEqual(scenario.aligned ? { ...native, input: [...sent.input, tail, trigger] } : native);
    } finally {
      registration.close();
      registry.unregister(AGENT);
      globalThis.fetch = originalFetch;
    }
  }
});

test("Responses Handoff confirms its own ordinary dispatch independently of remote selection and mode", async () => {
  const originalFetch = globalThis.fetch;
  const endpoint = "https://example.invalid/v1/responses";
  const assistant = { role: "assistant", content: [{ type: "text", text: "retained reply" }], timestamp: 2 };
  const source = [{ role: "user", content: "retained source", timestamp: 1 }, assistant];
  const input = [
    { role: "user", content: [{ type: "input_text", text: "prepared source" }] },
    { role: "assistant", content: [{ type: "output_text", text: "retained reply" }] },
  ];
  const ordinaryBody = {
    model: RESPONSES_MODEL.id,
    instructions: "base\n\nplan",
    input,
    tools: [{ type: "function", name: "read", parameters: TOOL.parameters }],
    reasoning: { effort: "low" },
  };
  const selections: AlignmentSettings[] = [
    handoffOnly,
    {
      remote: { ok: true, settings: { enabled: true, providerFilter: "another-provider", mode: "standard" } },
      handoff: handoffOnly.handoff,
    },
    {
      remote: { ok: true, settings: { enabled: true, providerFilter: "test", mode: "hooks" } },
      handoff: handoffOnly.handoff,
    },
  ];
  for (const selection of selections) {
    const wires: unknown[] = [];
    const transport = (async (_url: unknown, init?: RequestInit) => {
      wires.push(JSON.parse(String(init?.body)));
      return new Response("ok");
    }) as typeof fetch;
    Object.defineProperties(transport, Object.getOwnPropertyDescriptors(originalFetch));
    globalThis.fetch = transport;
    const stream: FakeAgent["streamFn"] = async (_model, _prepared, options) => {
      const settings = options as StreamOptions;
      await settings.onPayload?.(ordinaryBody);
      const response = await fetch(endpoint, {
        method: "POST",
        body: JSON.stringify(ordinaryBody),
        signal: AbortSignal.any([settings.signal!]),
      });
      settings.onResponse?.(response);
    };
    const { session, hooks, registration, registry, modelRegistry } = activate(selection, RESPONSES_MODEL, stream);
    session.agent.state.messages = [];
    session.agent.state.systemPrompt = ["base", "plan"];
    try {
      const root = new AbortController().signal;
      for (const hook of hooks) hook(root);
      await session.extensionRunner.emitContext(source, root);
      await modelRegistry.resolver(
        session.model,
        session.sessionId,
      )({ signal: root, lastChance: false, error: undefined });
      await session.agent.streamFn(
        session.model,
        { systemPrompt: ["base", "plan"], messages: source, tools: [TOOL] },
        { signal: root },
      );
      expect(registration.status().handoff.online).toBe("ordinary-send-confirmed");
      expect(wires[0]).toEqual(ordinaryBody);
      Object.assign(assistant, { completedAt: 3, contextSnapshot: { promptTokens: 100, nonMessageTokens: 10 } });
      session.agent.state.messages = source;
      const signal = new AbortController().signal;
      const instruction = { role: "user", content: "preserve handoff focus", attribution: "agent" };
      session.isGeneratingHandoff = true;
      await session.convertMessagesToLlm([...source, instruction], signal);
      const options = session.prepareSimpleStreamOptions({ signal, toolChoice: "none" });
      const native = {
        ...ordinaryBody,
        instructions: "base",
        input: [...input, { role: "user", content: "preserve handoff focus" }],
        tool_choice: "none",
      };
      await options.onPayload?.(native);
      expect(registration.status().handoff.sends).toBe(0);
      const send = () =>
        fetch(endpoint, { method: "POST", body: JSON.stringify(native), signal: AbortSignal.any([signal]) });
      await send();
      expect(wires.at(-1)).toEqual({ ...native, instructions: ordinaryBody.instructions });
      session.agent.state.tools = [];
      await send();
      expect(wires.at(-1)).toEqual(native);
      session.agent.state.tools = [TOOL];
      await send();
      expect(wires.at(-1)).toEqual(native);
    } finally {
      registration.close();
      registry.unregister(AGENT);
      globalThis.fetch = originalFetch;
    }
  }
});

const ANTHROPIC_MODEL: NativeModel<"anthropic-messages"> = {
  ...RESPONSES_MODEL,
  api: "anthropic-messages",
  id: "anthropic-proof",
  remoteCompaction: undefined,
  compat: {} as NativeModel<"anthropic-messages">["compat"],
};
type AnthropicBody = Record<string, unknown> & { system: Record<string, unknown>[] };

/** Real Anthropic SSE input, with a controlled provider response rather than a serializer substitute. */
function anthropicResponse(text: string): Response {
  const events = [
    {
      type: "message_start",
      message: {
        id: "controlled",
        type: "message",
        role: "assistant",
        model: "anthropic-proof",
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 20, output_tokens: 0 },
      },
    },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 4 } },
    { type: "message_stop" },
  ];
  return new Response(events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""), {
    headers: { "content-type": "text/event-stream" },
  });
}

test("Anthropic validates native API-key and OAuth sends and revokes retries without changing generation", async () => {
  const originalFetch = globalThis.fetch;
  for (const oauth of [false, true]) {
    const wires: { raw: string; body: AnthropicBody; signal: AbortSignal | null | undefined }[] = [];
    let response: Response;
    const transport: FetchImpl = async (_input, init) => {
      const raw = typeof init?.body === "string" ? init.body : new TextDecoder().decode(init?.body as Uint8Array);
      wires.push({ raw, body: JSON.parse(raw) as AnthropicBody, signal: init?.signal });
      response = anthropicResponse("Native document");
      return response;
    };
    globalThis.fetch = transport as typeof fetch;
    const apiKey = oauth ? "sk-ant-oat01-controlled" : "controlled-key";
    const stream: FakeAgent["streamFn"] = (model, prepared, options) =>
      streamSimple(model as NativeModel, prepared as Context, {
        ...(options as SimpleStreamOptions),
        apiKey,
        cacheRetention: "short",
      }).result();
    const { session, hooks, registration, registry } = activate(handoffOnly, ANTHROPIC_MODEL, stream);
    try {
      const source = [{ role: "user" as const, content: "ask", timestamp: 1 }];
      const ordinary = new AbortController().signal;
      for (const hook of hooks) hook(ordinary);
      await session.extensionRunner.emitContext(source, ordinary);
      session.agent.state.systemPrompt = ["base", "per-turn rule"];
      const reply = await session.agent.streamFn(
        ANTHROPIC_MODEL,
        { systemPrompt: session.agent.state.systemPrompt, messages: source, tools: [TOOL] },
        { signal: ordinary },
      );
      expect(registration.status().handoff.online).toBe("ordinary-send-confirmed");
      expect(wires[0]!.signal).not.toBe(ordinary);
      const sourceSnapshot = [...source, reply];
      session.agent.state.messages = sourceSnapshot;
      session.isGeneratingHandoff = true;
      const instruction = { role: "user" as const, content: "handoff focus", attribution: "agent", timestamp: 3 };
      const signal = new AbortController().signal;
      await session.convertMessagesToLlm([...sourceSnapshot, instruction], signal);
      let nativeSide: AnthropicBody | undefined;
      const options = session.prepareSimpleStreamOptions({
        signal,
        toolChoice: "none",
        onPayload: (value) => {
          nativeSide = structuredClone(value) as AnthropicBody;
        },
      });
      const context = { systemPrompt: ["base"], messages: [...sourceSnapshot, instruction], tools: [TOOL] } as Context;
      const send = () =>
        streamSimple(ANTHROPIC_MODEL, context, {
          ...(options as SimpleStreamOptions),
          apiKey,
          cacheRetention: "short",
        }).result();
      expect((await send()).stopReason).toBe("stop");
      const offset = oauth ? 2 : 0;
      const candidate = {
        ...nativeSide,
        system: [...nativeSide!.system.slice(0, offset), ...wires[0]!.body.system.slice(offset)],
      };
      let expected = JSON.stringify(candidate);
      if (oauth)
        await wrapFetchForCch(async (_input, init) => {
          expected = new TextDecoder().decode(init!.body as Uint8Array);
          return response!;
        })("https://example.invalid/v1/messages?beta=true", { body: expected });
      expect(wires[1]!.raw === expected).toBe(true);
      expect(wires[1]!.body.tool_choice).toEqual({ type: "none" });
      expect(registration.status().handoff).toEqual(expect.objectContaining({ operations: 1, sends: 1, rewritten: 1 }));
      const foreignWires: string[] = [];
      const foreign: FetchImpl = async (_input, init) => {
        foreignWires.push(
          typeof init?.body === "string" ? init.body : new TextDecoder().decode(init?.body as Uint8Array),
        );
        return anthropicResponse("Caller-owned transport");
      };
      const foreignOptions = session.prepareSimpleStreamOptions({
        signal,
        toolChoice: "none",
        fetch: foreign,
        onPayload: (value) => {
          nativeSide = structuredClone(value) as AnthropicBody;
        },
      });
      const foreignResult = await streamSimple(ANTHROPIC_MODEL, context, {
        ...(foreignOptions as SimpleStreamOptions),
        apiKey,
        cacheRetention: "short",
      }).result();
      let foreignNative = JSON.stringify(nativeSide);
      if (oauth)
        await wrapFetchForCch(async (_input, init) => {
          foreignNative = new TextDecoder().decode(init!.body as Uint8Array);
          return response!;
        })("https://example.invalid/v1/messages?beta=true", { body: foreignNative });
      expect(foreignResult.content).toEqual([{ type: "text", text: "Caller-owned transport" }]);
      expect(foreignWires).toEqual([foreignNative]);
      expect(registration.status().handoff.sends).toBe(1);
      await send();
      expect(registration.status().handoff.retries).toBe(1);
      registration.invalidate("native-history-committed");
      await send();
      let native = JSON.stringify(nativeSide);
      if (oauth)
        await wrapFetchForCch(async (_input, init) => {
          native = new TextDecoder().decode(init!.body as Uint8Array);
          return response!;
        })("https://example.invalid/v1/messages?beta=true", { body: native });
      expect(wires.at(-1)!.raw === native).toBe(true);
      expect(registration.status().handoff.candidate).toBe("operation-invalidated");
      expect(registration.status().handoff.sends).toBe(3);
      expect(registration.status().remote.state).toBe("disabled");
    } finally {
      registration.close();
      registry.unregister(AGENT);
      globalThis.fetch = originalFetch;
    }
  }
});

test("a newer Anthropic dispatch prevents a late 2xx from republishing an older reference", async () => {
  const originalFetch = globalThis.fetch;
  const entered = Promise.withResolvers<void>();
  const first = Promise.withResolvers<Response>();
  let calls = 0;
  globalThis.fetch = Object.assign(
    async () => {
      if (++calls === 1) {
        entered.resolve();
        return first.promise;
      }
      return anthropicResponse("New ordinary response");
    },
    { preconnect: originalFetch.preconnect },
  );
  const stream: FakeAgent["streamFn"] = (model, prepared, options) =>
    streamSimple(model as NativeModel, prepared as Context, {
      ...(options as SimpleStreamOptions),
      apiKey: "controlled-key",
      cacheRetention: "short",
    }).result();
  const { session, hooks, registration, registry } = activate(handoffOnly, ANTHROPIC_MODEL, stream);
  const dispatch = async (text: string) => {
    const signal = new AbortController().signal;
    const source = [{ role: "user", content: text, timestamp: 1 }];
    for (const hook of hooks) hook(signal);
    await session.extensionRunner.emitContext(source, signal);
    return session.agent.streamFn(
      ANTHROPIC_MODEL,
      { systemPrompt: ["base"], messages: source, tools: [TOOL] },
      { signal },
    );
  };
  try {
    const older = dispatch("older");
    await entered.promise;
    await dispatch("newer");
    const confirmed = registration.status().handoff.reference;
    expect(confirmed).toBeGreaterThan(0);
    first.resolve(anthropicResponse("Old ordinary response"));
    await older;
    expect(registration.status().handoff.reference).toBe(confirmed);
    expect(registration.status().handoff.online).toBe("ordinary-send-confirmed");
  } finally {
    first.resolve(anthropicResponse("Released response"));
    registration.close();
    registry.unregister(AGENT);
    globalThis.fetch = originalFetch;
  }
});

for (const kind of ["no-tools", "foreign-fetch"] as const) {
  test(`Anthropic ordinary ${kind} reports why no reference was confirmed`, async () => {
    const originalFetch = globalThis.fetch;
    const transport: FetchImpl = async () => anthropicResponse("Unaligned ordinary response");
    globalThis.fetch = Object.assign(transport, { preconnect: originalFetch.preconnect });
    const stream: FakeAgent["streamFn"] = (model, prepared, options) =>
      streamSimple(model as NativeModel, prepared as Context, {
        ...(options as SimpleStreamOptions),
        apiKey: "controlled-key",
        cacheRetention: "short",
      }).result();
    const { session, hooks, registration, registry } = activate(handoffOnly, ANTHROPIC_MODEL, stream);
    try {
      const signal = new AbortController().signal;
      const source = [{ role: "user", content: "ordinary request", timestamp: 1 }];
      for (const hook of hooks) hook(signal);
      await session.extensionRunner.emitContext(source, signal);
      const reply = await session.agent.streamFn(
        ANTHROPIC_MODEL,
        { systemPrompt: ["base"], messages: source, tools: kind === "no-tools" ? [] : [TOOL] },
        { signal, ...(kind === "foreign-fetch" ? { fetch: transport } : {}) },
      );
      expect(reply).toEqual(
        expect.objectContaining({ content: [{ type: "text", text: "Unaligned ordinary response" }] }),
      );
      expect(registration.status().handoff).toEqual(
        expect.objectContaining({
          reference: 0,
          state: "awaiting-reference",
          online: kind === "no-tools" ? "reference-not-sent" : "final-send-unconfirmed",
        }),
      );
    } finally {
      registration.close();
      registry.unregister(AGENT);
      globalThis.fetch = originalFetch;
    }
  });
}
