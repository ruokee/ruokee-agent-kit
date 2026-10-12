import { expect, test } from "bun:test";
import type { AgentSession } from "@oh-my-pi/pi-coding-agent";
import { AgentRegistry } from "@oh-my-pi/pi-coding-agent/registry/agent-registry";
import { register } from "../src/runtime.ts";
import type { Settings } from "../src/settings.ts";

type Model = { provider: string; id: string; api: string; baseUrl: string };

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
const RESPONSES_MODEL: Model = {
  provider: "test",
  id: "test-responses",
  api: "openai-responses",
  baseUrl: "https://example.invalid",
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
  extensionRunner: { emitContext: (...args: unknown[]) => unknown };
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
    extensionRunner: { emitContext: () => Promise.resolve([]) },
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

function activate(settings: Settings, model: Model = MODEL) {
  const registry = AgentRegistry.global();
  const { session, hooks } = fakeSession(model);
  if (!registry.get(AGENT))
    registry.register({ id: AGENT, displayName: AGENT, kind: "main", session: null, status: "idle" });
  registry.attachSession(AGENT, session as unknown as AgentSession);
  const ctx = {
    agent: { id: AGENT },
    modelRegistry: { resolver: () => undefined },
    sessionManager: session.sessionManager,
    cwd: "/tmp",
  };
  const registration = register(ctx as unknown as Parameters<typeof register>[0], settings, {
    confirms: () => true,
    release: () => {},
  });
  return { session, hooks, registration, registry };
}

/** The host adds the operation signal before the request and reads the context with the same signal. */
function ordinaryDispatch(
  session: FakeSession,
  hooks: ((signal?: AbortSignal) => void)[],
  signal: AbortSignal,
  tools: unknown[] = [TOOL],
) {
  for (const hook of hooks) hook(signal);
  const native = session.agent.streamFn as (model: unknown, prepared: unknown, options: unknown) => Promise<unknown>;
  const sent = native(session.model, { messages: [SYSTEM, TURN], tools }, { signal });
  void (session.extensionRunner.emitContext as (messages: unknown[], signal?: AbortSignal) => unknown)(
    [SYSTEM, TURN],
    signal,
  );
  return sent;
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

test("a remote-targeted session keeps its own capture path", async () => {
  const { session, hooks, registration, registry } = activate(remoteOnly, RESPONSES_MODEL);
  const controller = new AbortController();
  await ordinaryDispatch(session, hooks, controller.signal);
  await Promise.resolve();
  const status = registration.status();
  // The fake host supplies neither the runner's handler list nor transport, so the remote section reports its
  // own failure reason after the wrapper reached it. The two assertions exclude the switched-off session and
  // the untargeted one, which is what the session's targeting is pinned by here.
  expect(status.remote.state).not.toBe("disabled");
  expect(status.remote.online).not.toBe("reference-not-sent");
  expect(status.remote.online).not.toBe("model-not-targeted");
  expect(status.handoff.state).toBe("disabled");
  registration.close();
  registry.unregister(AGENT);
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
