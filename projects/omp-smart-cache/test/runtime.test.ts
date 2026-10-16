import { expect, test } from "bun:test";
import type { AgentSession } from "@oh-my-pi/pi-coding-agent";
import { AgentRegistry } from "@oh-my-pi/pi-coding-agent/registry/agent-registry";
import { register } from "../src/runtime.ts";
import { convertToLlm } from "@oh-my-pi/pi-coding-agent/session/messages";
import type { ApiKeyResolver, Model as NativeModel } from "@oh-my-pi/pi-ai";
import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import { encode } from "../src/proof.ts";
import type { Settings } from "../src/settings.ts";

type Model = {
  provider: string;
  id: string;
  api: string;
  baseUrl: string;
  compat?: object;
  identity?: { class: string };
};

const AGENT = "runtime-test-agent";

const handoffOnly: Settings = {
  remote: { ok: true, settings: { enabled: false, provider: "", mode: "hooks" } },
  handoff: { ok: true, settings: { enabled: true } },
};
const bothOff: Settings = {
  remote: { ok: true, settings: { enabled: false, provider: "", mode: "hooks" } },
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
  sessionManager: { getSessionId(): string; getBranch(): unknown[] };
  extensionRunner: { emitContext: (...args: unknown[]) => unknown; hasHandlers: (event: string) => boolean };
  convertMessagesToLlm: (...args: unknown[]) => unknown;
  prepareSimpleStreamOptions: (...args: unknown[]) => unknown;
  addDisposer: (dispose: () => void) => void;
  switchSession: () => unknown;
  branch: () => unknown;
  navigateTree: () => unknown;
  freshSession: () => unknown;
  newSession: () => unknown;
  fork: () => unknown;
}

/**
 * A session shaped like the seams this capability uses. The native stream writes the payload it received and
 * answers 200, which is exactly what the host does, so one dispatch drives capture, confirmation and binding.
 */
function fakeSession(model: Model = MODEL) {
  const hooks: ((signal?: AbortSignal) => void)[] = [];
  const session: FakeSession = {
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
    sessionManager: { getSessionId: () => "session-1", getBranch: () => [] },
    extensionRunner: { emitContext: (messages: unknown) => Promise.resolve(messages), hasHandlers: () => true },
    convertMessagesToLlm: (messages: unknown) => messages,
    prepareSimpleStreamOptions: (options: unknown) => options,
    addDisposer: () => {},
    switchSession: () => undefined,
    branch: () => undefined,
    navigateTree: () => undefined,
    freshSession: () => undefined,
    newSession: () => undefined,
    fork: () => undefined,
  };
  return { session, hooks };
}

function activate(settings: Settings, model: Model = MODEL, stream?: FakeAgent["streamFn"], native = true) {
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
  const registration = register(ctx as unknown as Parameters<typeof register>[0], settings, {
    confirms: () => native,
    release: () => {},
  });
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

const remoteOnly: Settings = {
  remote: { ok: true, settings: { enabled: true, provider: "test", mode: "hooks" } },
  handoff: { ok: true, settings: { enabled: false } },
};

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

test("a handoff side request repeats the confirmed online view and stays native without a reference", async () => {
  const { session, hooks, registration, registry } = activate(handoffOnly);
  const controller = new AbortController();
  await ordinaryDispatch(session, hooks, controller.signal);
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
  )({
    signal: handoff.signal,
    toolChoice: "none",
  });
  const side = { messages: [SYSTEM, TURN, instruction], tool_choice: "none", reasoning_effort: "low" };
  const rewritten = prepared.onPayload?.(side) as {
    messages: unknown[];
    tool_choice?: unknown;
    reasoning_effort?: unknown;
  };
  expect(rewritten.messages).toEqual([SYSTEM, TURN, instruction]);
  expect(rewritten.tool_choice).toBeUndefined();
  const status = registration.status();
  expect(status.handoff.state).toBe("rewritten");
  expect(status.handoff.aligned).toBe(1);
  expect(status.handoff.sends).toBe(1);
  expect(status.handoff.axes).toBe(1);
  registration.close();
  registry.unregister(AGENT);
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
  const cases: { message: AgentMessage; native: boolean; aligned: boolean }[] = [
    { message: projection, native: true, aligned: true },
    { message: projection, native: false, aligned: false },
    { message: { ...projection, attribution: "user" }, native: true, aligned: false },
    { message: { ...projection, customType: "other-context" }, native: true, aligned: false },
    { message: { role: "user", content: projection.content, timestamp: 2 }, native: true, aligned: false },
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
    const settings: Settings = {
      remote: { ok: true, settings: { enabled: true, provider: "test", mode: scenario.mode } },
      handoff: remoteOnly.handoff,
    };
    const { session, hooks, registration, registry, modelRegistry } = activate(
      settings,
      RESPONSES_MODEL,
      stream,
      scenario.native,
    );
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
