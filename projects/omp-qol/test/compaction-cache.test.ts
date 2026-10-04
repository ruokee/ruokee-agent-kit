import { afterEach, expect, test } from "bun:test";
import type { ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { compactionCacheStatus, installCompactionCacheModule } from "../src/compaction-cache.ts";
import { parseQolSettings } from "../src/settings.ts";
import { createHarness, moduleContext } from "./host.ts";

const nativeFetch = globalThis.fetch;
const nativeAny = AbortSignal.any;
const slot = Symbol.for("ruokee.omp-qol.compaction-cache.registry");
const slots = globalThis as typeof globalThis & { [key: symbol]: any };

afterEach(() => {
  slots[slot]?.stop("owner-stopped");
  delete slots[slot];
  globalThis.fetch = nativeFetch;
  AbortSignal.any = nativeAny;
});

function setup() {
  const harness = createHarness();
  harness.pi.getActiveTools = () => ["read"];
  const model = {
    id: "synthetic",
    provider: "synthetic",
    api: "openai-responses",
    baseUrl: "https://synthetic.invalid/v1",
  };
  class Registry {
    resolver(_model: unknown, _session?: string) {
      return (_context: { signal?: AbortSignal }) => "synthetic-key";
    }
  }
  const registry = new Registry();
  let prompt = "stable prompt";
  const ctx = harness.context({
    model,
    modelRegistry: registry,
    agent: { kind: "main" },
    sessionManager: { getSessionId: () => "owner" },
    getSystemPrompt: () => prompt,
  } as unknown as Partial<ExtensionContext>);
  const captures: any[] = [];
  globalThis.fetch = ((_url: unknown, init: RequestInit) => {
    captures.push(JSON.parse(init.body as string));
    return Promise.resolve(new Response("synthetic"));
  }) as typeof fetch;
  const settings = parseQolSettings({ compactionCacheEnabled: true, compactionCacheProvider: "synthetic" });
  if (settings.kind !== "loaded") throw new Error("Invalid test settings");
  const installed = installCompactionCacheModule(moduleContext({ pi: harness.pi, ctx, settings: settings.settings }));
  expect(installed.status).toBe("enabled");
  const send = (body: unknown, signal?: AbortSignal) =>
    globalThis.fetch(`${model.baseUrl}/responses`, {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    });
  const resolve = (root: AbortSignal, session = "owner", target = model) =>
    registry.resolver(target, session)({ signal: root });
  const online = async (text: string, confirmed = true) => {
    const root = new AbortController();
    resolve(root.signal);
    const body = {
      model: model.id,
      instructions: "stable prompt",
      stream: true,
      store: false,
      tools: [{ type: "function", name: "read", description: `wire ${text}` }],
      input: [{ role: "user", content: [{ type: "input_text", text }] }],
    };
    await harness.emit("before_provider_request", { payload: body }, ctx);
    if (confirmed) await send(body, AbortSignal.any([root.signal, new AbortController().signal]));
    return body;
  };
  const compact = (body: any) => ({
    ...body,
    tools: [{ type: "function", name: "read", description: "raw description" }],
    input: [
      ...body.input,
      { role: "assistant", content: [{ type: "output_text", text: "tail" }] },
      { type: "compaction_trigger" },
    ],
    tool_choice: "auto",
  });
  return {
    harness,
    ctx,
    registry,
    model,
    captures,
    send,
    resolve,
    online,
    compact,
    changePrompt: () => {
      prompt = "changed prompt";
    },
  };
}

test("concurrent compaction roots keep their confirmed prefixes as online work advances", async () => {
  const h = setup();
  const first = await h.online("first");
  const rootA = new AbortController();
  h.resolve(rootA.signal);
  const second = await h.online("second");
  const rootB = new AbortController();
  h.resolve(rootB.signal);
  for (const [root, reference] of [
    [rootA, first],
    [rootB, second],
    [rootA, first],
  ] as const) {
    await h.send(h.compact(reference), AbortSignal.any([root.signal, new AbortController().signal]));
    expect(h.captures.at(-1).tools).toEqual(reference.tools);
    expect(h.captures.at(-1).input).toEqual(h.compact(reference).input);
    expect(h.captures.at(-1).tool_choice).toBeUndefined();
  }
});

test("unknown, foreign and conflicting roots cannot rewrite even an identical request", async () => {
  const h = setup();
  const live = await h.online("same");
  const owned = new AbortController();
  const foreign = new AbortController();
  h.resolve(owned.signal);
  h.resolve(foreign.signal, "another-session");
  const body = h.compact(live);
  for (const signal of [
    undefined,
    new AbortController().signal,
    foreign.signal,
    AbortSignal.any([owned.signal, foreign.signal]),
  ]) {
    await h.send(body, signal);
    expect(h.captures.at(-1)).toEqual(body);
  }
});

test("unconfirmed payloads cannot be promoted by another session's matching transport", async () => {
  const h = setup();
  const live = await h.online("unsent", false);
  const foreign = new AbortController();
  h.resolve(foreign.signal, "another-session");
  await h.send(live, foreign.signal);
  const root = new AbortController();
  h.resolve(root.signal);
  const body = h.compact(live);
  await h.send(body, root.signal);
  expect(h.captures.at(-1)).toEqual(body);
});

test("cancelled roots and changed context reject an already-bound compaction", async () => {
  const h = setup();
  const live = await h.online("old");
  const root = new AbortController();
  h.resolve(root.signal);
  const derived = AbortSignal.any([root.signal, new AbortController().signal]);
  root.abort(new Error("caller cancellation"));
  const body = h.compact(live);
  await h.send(body, derived);
  expect(h.captures.at(-1)).toEqual(body);
  const next = new AbortController();
  h.resolve(next.signal);
  h.changePrompt();
  await h.send(body, next.signal);
  expect(h.captures.at(-1)).toEqual(body);
});

test("a reused root with a different identity poisons existing descendants", async () => {
  const h = setup();
  const live = await h.online("owner");
  const root = new AbortController();
  h.resolve(root.signal);
  const derived = AbortSignal.any([root.signal, new AbortController().signal]);
  h.resolve(root.signal, "another-session");
  const body = h.compact(live);
  await h.send(body, derived);
  expect(h.captures.at(-1)).toEqual(body);
});

test("native commit discards old bindings without transferring them to a new operation", async () => {
  const h = setup();
  const live = await h.online("before commit");
  const root = new AbortController();
  h.resolve(root.signal);
  const derived = AbortSignal.any([root.signal, new AbortController().signal]);
  await h.harness.emit("session_compact", {}, h.ctx);
  await h.online("after commit");
  h.resolve(root.signal);
  const body = h.compact(live);
  await h.send(body, derived);
  expect(h.captures.at(-1)).toEqual(body);
});

test("navigation restores the registry property and makes captured resolvers inert", async () => {
  const h = setup();
  const live = await h.online("before navigation");
  const resolve = h.registry.resolver(h.model, "owner");
  await h.harness.emit("session_before_switch", {}, h.ctx);
  expect(Object.hasOwn(h.registry, "resolver")).toBe(false);
  const root = new AbortController();
  resolve({ signal: root.signal });
  const body = h.compact(live);
  await h.send(body, root.signal);
  expect(h.captures.at(-1)).toEqual(body);
  expect(compactionCacheStatus("other", { status: "enabled" }).reason).toBe("session-navigation");
});

test("a root without a confirmed reference cannot acquire one during a later retry", async () => {
  const h = setup();
  const root = new AbortController();
  h.resolve(root.signal);
  const live = await h.online("newer");
  h.resolve(root.signal);
  const body = h.compact(live);
  await h.send(body, root.signal);
  expect(h.captures.at(-1)).toEqual(body);
});

test("a replaced registry method stops rewriting without overwriting its replacement", async () => {
  const h = setup();
  const live = await h.online("before replacement");
  const root = new AbortController();
  h.resolve(root.signal);
  const replacement = () => () => "replacement-key";
  h.registry.resolver = replacement;
  const body = h.compact(live);
  await h.send(body, root.signal);
  expect(h.captures.at(-1)).toEqual(body);
  expect(h.registry.resolver).toBe(replacement);
  expect(AbortSignal.any).toBe(nativeAny);
  expect(compactionCacheStatus("other", { status: "enabled" }).reason).toBe("patch-overwritten");
});

test("another-model side request cannot invalidate active or future main-session references", async () => {
  const h = setup();
  const live = await h.online("main conversation");
  const root = new AbortController();
  h.resolve(root.signal);
  const sideModel = { ...h.ctx.model!, provider: "side-provider", id: "side-model" };
  const sideRoot = new AbortController();
  h.resolve(sideRoot.signal, "owner", sideModel);
  await h.harness.emit(
    "before_provider_request",
    { payload: { ...live, model: sideModel.id } },
    { ...h.ctx, model: sideModel },
  );
  const next = new AbortController();
  h.resolve(next.signal);
  for (const signal of [root.signal, next.signal]) {
    await h.send(h.compact(live), signal);
    expect(h.captures.at(-1).tools).toEqual(live.tools);
    expect(h.captures.at(-1).tool_choice).toBeUndefined();
  }
});

test("a live main-model change rejects an old root before another payload hook", async () => {
  const h = setup();
  const live = await h.online("old model");
  const root = new AbortController();
  h.resolve(root.signal);
  const fixedRequestContext = { ...h.ctx };
  await h.harness.emit("before_provider_request", { payload: live }, fixedRequestContext);
  Object.defineProperty(h.ctx, "model", { value: { ...h.model, id: "new-main-model" } });
  const body = h.compact(live);
  await h.send(body, root.signal);
  expect(h.captures.at(-1)).toEqual(body);
});
