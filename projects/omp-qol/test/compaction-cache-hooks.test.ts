import { afterEach, expect, test } from "bun:test";
import type { Model } from "@oh-my-pi/pi-ai/types";
import { buildResponsesInput } from "@oh-my-pi/pi-ai/providers/openai-shared";
import type { ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { AgentRegistry } from "@oh-my-pi/pi-coding-agent/registry/agent-registry";
import type { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { convertToLlm } from "@oh-my-pi/pi-coding-agent/session/messages";
import { installCompactionCacheModule } from "../src/compaction-cache.ts";
import { parseQolSettings } from "../src/settings.ts";
import type { CompactionCacheMode } from "../src/settings.ts";
import { createHarness, moduleContext } from "./host.ts";

type Messages = Parameters<typeof convertToLlm>[0];
const nativeFetch = globalThis.fetch;
const nativeAny = AbortSignal.any;
const slot = Symbol.for("ruokee.omp-qol.compaction-cache.registry");
const slots = globalThis as typeof globalThis & { [key: symbol]: any };
const agentId = "cache-hooks-test";
afterEach(() => {
  slots[slot]?.stop("owner-stopped");
  delete slots[slot];
  AgentRegistry.global().unregister(agentId);
  globalThis.fetch = nativeFetch;
  AbortSignal.any = nativeAny;
});

function setup(mode?: CompactionCacheMode, inPlace = false) {
  const harness = createHarness();
  harness.pi.getActiveTools = () => [];
  const model = {
    id: "synthetic",
    provider: "synthetic",
    api: "openai-responses",
    baseUrl: "https://synthetic.invalid/v1",
    identity: { class: "unknown" },
    input: ["text"],
    compat: { strictResponsesPairing: true, supportsImageDetailOriginal: false },
  } as Model<"openai-responses">;
  class Registry {
    resolver() {
      return (_context: { signal?: AbortSignal }) => "synthetic-key";
    }
  }
  const registry = new Registry();
  let hookState = "A";
  class Runner {
    emitContext(messages: Messages, _signal?: AbortSignal): Promise<Messages> {
      const projected: Messages = [
        { role: "user", content: `arbitrary ${hookState}`, timestamp: 1 },
        ...[...messages].reverse(),
      ];
      if (inPlace) {
        messages.splice(0, messages.length, ...projected);
        return Promise.resolve(messages);
      }
      return Promise.resolve(projected);
    }
  }
  const runner = new Runner();
  const ctx = harness.context({
    model,
    modelRegistry: registry,
    agent: { id: agentId, kind: "main" },
    sessionManager: { getSessionId: () => "owner" },
    getSystemPrompt: () => "stable",
  } as unknown as Partial<ExtensionContext>);
  AgentRegistry.global().register({
    id: agentId,
    displayName: agentId,
    kind: "main",
    session: { sessionManager: ctx.sessionManager, extensionRunner: runner } as unknown as AgentSession,
  });
  const captures: any[] = [];
  globalThis.fetch = ((_url: unknown, init: RequestInit) => {
    captures.push(JSON.parse(init.body as string));
    return Promise.resolve(new Response("synthetic"));
  }) as typeof fetch;
  const parsed = parseQolSettings({
    compactionCacheEnabled: true,
    compactionCacheProvider: "synthetic",
    ...(mode ? { compactionCacheMode: mode } : {}),
  });
  if (parsed.kind !== "loaded") throw new Error("Invalid fixture settings");
  const module = moduleContext({ pi: harness.pi, ctx, settings: parsed.settings });
  expect(installCompactionCacheModule(module).status).toBe("enabled");
  const encode = (messages: Messages) =>
    buildResponsesInput({
      model,
      context: { messages: convertToLlm(messages) },
      nativeHistory: { replay: true, filterReasoning: false },
      strictResponsesPairing: true,
      supportsImageDetailOriginal: false,
      includeThinkingSignatures: true,
      repairOrphanOutputs: true,
    });
  const raw: Messages = [
    { role: "user", content: "first", timestamp: 2 },
    { role: "user", content: "second", timestamp: 3 },
  ];
  const nativeRaw = structuredClone(raw);
  const body = (input: unknown[]) => ({
    model: model.id,
    instructions: "stable",
    stream: true,
    store: false,
    tools: [],
    input,
  });
  const send = (value: unknown, signal: AbortSignal) =>
    globalThis.fetch(`${model.baseUrl}/responses`, { method: "POST", body: JSON.stringify(value), signal });
  const bind = (signal: AbortSignal) => Reflect.apply(registry.resolver, registry, [model, "owner"])({ signal });
  const online = async (observed = true, confirmed = true, truncate = false) => {
    const root = new AbortController();
    const result = observed ? await runner.emitContext(raw, root.signal) : raw;
    bind(root.signal);
    const wire = body(encode(result));
    if (truncate) wire.input.pop();
    await harness.emit("before_provider_request", { payload: wire }, ctx);
    if (confirmed) await send(wire, root.signal);
    return wire;
  };
  const compact = () => ({
    ...body([
      ...encode(nativeRaw),
      { role: "user", content: [{ type: "input_text", text: "new native tail" }] },
      { type: "compaction_trigger" },
    ]),
    tool_choice: "auto",
  });
  return {
    harness,
    module,
    ctx,
    runner,
    captures,
    send,
    bind,
    online,
    compact,
    advance: () => {
      hookState = "B";
    },
  };
}

for (const mode of [undefined, "hooks", "standard"] as const)
  test(`generic projections use only proved context in ${mode ?? "default"} mode`, async () => {
    const h = setup(mode);
    const live = await h.online();
    const root = new AbortController();
    h.bind(root.signal);
    const original = h.compact();
    await h.send(original, root.signal);
    const sent = h.captures.at(-1);
    if (mode === "standard") expect(sent).toEqual(original);
    else {
      expect(sent.input).toEqual([...live.input, ...original.input.slice(2)]);
      expect(sent.tool_choice).toBeUndefined();
    }
  });

test("in-place context transformations retain distinct raw and completed snapshots", async () => {
  const h = setup(undefined, true);
  const live = await h.online();
  const root = new AbortController();
  h.bind(root.signal);
  const original = h.compact();
  await h.send(original, root.signal);
  expect(h.captures.at(-1).input).toEqual([...live.input, ...original.input.slice(2)]);
});

test("new context cannot replace an old operation's projection on retry", async () => {
  const h = setup();
  const first = await h.online();
  const old = new AbortController();
  h.bind(old.signal);
  h.advance();
  const second = await h.online();
  const fresh = new AbortController();
  h.bind(fresh.signal);
  for (const [root, expected] of [
    [old, first],
    [fresh, second],
    [old, first],
  ] as const) {
    h.bind(root.signal);
    await h.send(h.compact(), AbortSignal.any([root.signal, new AbortController().signal]));
    expect(h.captures.at(-1).input.slice(0, expected.input.length)).toEqual(expected.input);
  }
});

for (const [observed, confirmed] of [
  [false, true],
  [true, false],
] as const)
  test(`missing observation ${observed} or confirmation ${confirmed} preserves the native request`, async () => {
    const h = setup();
    await h.online(observed, confirmed);
    const root = new AbortController();
    h.bind(root.signal);
    const original = h.compact();
    await h.send(original, root.signal);
    expect(h.captures.at(-1)).toEqual(original);
  });

test("a projected item absent from confirmed online input cannot enter compaction", async () => {
  const h = setup();
  await h.online(true, true, true);
  const root = new AbortController();
  h.bind(root.signal);
  const original = h.compact();
  await h.send(original, root.signal);
  expect(h.captures.at(-1)).toEqual(original);
});

test("an unconfirmed newer context cannot seed future operations or alter old retries", async () => {
  const h = setup();
  const first = await h.online();
  const old = new AbortController();
  h.bind(old.signal);
  h.advance();
  await h.online(false);
  const fresh = new AbortController();
  h.bind(fresh.signal);
  const original = h.compact();
  await h.send(original, fresh.signal);
  expect(h.captures.at(-1)).toEqual(original);
  await h.send(original, old.signal);
  expect(h.captures.at(-1).input.slice(0, first.input.length)).toEqual(first.input);
});

test("a conflicting mode stops the old owner without installing a replacement", async () => {
  const h = setup();
  await h.online();
  const root = new AbortController();
  h.bind(root.signal);
  const changed = {
    ...h.module,
    runtimeId: "other",
    settings: { ...h.module.settings, cache: { ...h.module.settings.cache, mode: "standard" as const } },
  };
  expect(installCompactionCacheModule(changed).reason).toBe("runtime-conflict");
  const original = h.compact();
  await h.send(original, root.signal);
  expect(h.captures.at(-1)).toEqual(original);
  expect(Object.hasOwn(h.runner, "emitContext")).toBe(false);
});

test("a replaced context observer is not overwritten by shutdown", async () => {
  const h = setup();
  await h.online();
  const root = new AbortController();
  h.bind(root.signal);
  const replacement = (messages: Messages) => Promise.resolve(messages);
  h.runner.emitContext = replacement;
  const original = h.compact();
  await h.send(original, root.signal);
  expect(h.captures.at(-1)).toEqual(original);
  await h.harness.emit("session_shutdown", {}, h.ctx);
  expect(h.runner.emitContext).toBe(replacement);
  expect(AbortSignal.any).toBe(nativeAny);
});
