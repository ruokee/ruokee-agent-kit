import { describe, expect, test } from "bun:test";
import { alignCompaction, signalOwners } from "../src/compaction-cache-core.ts";

const cwd = "/synthetic/repository";
const reminder = {
  type: "input_text",
  text: `<system-reminder>\nToday: 2026-10-03; current working directory: '${cwd}'. Do not repeat this information in your reply.\n</system-reminder>`,
};
function pair(repeated = false) {
  const online = {
    model: "synthetic-model",
    instructions: "identical prompt",
    store: false,
    stream: true,
    prompt_cache_key: "synthetic-cache",
    tools: [
      {
        type: "function",
        name: "read",
        description: "effective wire description",
        parameters: {
          type: "object",
          properties: { i: { type: "string" }, path: { type: "string" } },
          required: ["i", "path"],
        },
      },
    ],
    input: [
      ...(repeated ? [{ type: "compaction", encrypted_content: "opaque-bytes" }] : []),
      { role: "user", content: [reminder, { type: "input_text", text: "source task" }] },
      { type: "function_call", id: "fc_keep", call_id: "call_keep", name: "read", arguments: '{"path":"a"}' },
      { type: "function_call_output", call_id: "call_keep", output: "real output" },
    ],
  };
  const compact: any = structuredClone(online);
  compact.tools[0].description = "raw description";
  delete compact.tools[0].parameters.properties.i;
  compact.tools[0].parameters.required = ["path"];
  compact.input[repeated ? 1 : 0].content.shift();
  if (repeated) compact.input[0].id = "compact_remove";
  compact.input.push(
    { role: "assistant", content: [{ type: "output_text", text: "new output" }] },
    { type: "compaction_trigger" },
  );
  compact.tool_choice = "auto";
  return { online, compact };
}

describe("checked request alignment", () => {
  for (const repeated of [false, true])
    test(
      repeated
        ? "repeated compaction preserves opaque replay and required ids"
        : "first compaction reuses complete actual prefix and preserves tail",
      () => {
        const { online, compact } = pair(repeated);
        const original = structuredClone(compact);
        const result = alignCompaction(online, compact, cwd);
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error(result.reason);
        expect(result.body.input.slice(0, online.input.length)).toEqual(online.input);
        expect(result.body.tools).toEqual(online.tools);
        expect(result.body.input.slice(online.input.length)).toEqual(compact.input.slice(online.input.length));
        expect(result.body.tool_choice).toBeUndefined();
        expect(result.body.input.find((item: any) => item.type === "function_call").id).toBe("fc_keep");
        expect(result.changes.compactionIds).toEqual(repeated ? [0] : []);
        expect(compact).toEqual(original);
      },
    );
  test("mid-turn steering preserves the actual online envelope", () => {
    const { online, compact } = pair(true);
    const text = "new user instruction";
    const prefix =
      "<system-notice>\nUser interjection during work: priority; supersedes conflicting prior instructions. Re-read; ensure current work reflects user intent.\n</system-notice>\n";
    online.input.push({ role: "user", content: [{ type: "input_text", text: prefix + text }] });
    compact.input.splice(online.input.length - 1, 0, { role: "user", content: [{ type: "input_text", text }] });
    const result = alignCompaction(online, compact, cwd);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.body.input.slice(0, online.input.length)).toEqual(online.input);
    expect(result.changes.steering).toEqual([online.input.length - 1]);
    compact.input[online.input.length - 1].content[0].text = "different instruction";
    expect(alignCompaction(online, compact, cwd).ok).toBe(false);
  });
  test("string user reminders retain exactly the original content", () => {
    const { online, compact } = pair();
    online.input[0] = { role: "user", content: [{ type: "input_text", text: reminder.text + "\n\nsource task" }] };
    const result = alignCompaction(online, compact, cwd);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.body.input[0]).toEqual(online.input[0]);
  });
  test("unknown history, model, tool choice and tool set differences reject atomically", () => {
    for (const mutate of [
      (body: any) => {
        body.input[2].output = "different output";
      },
      (body: any) => {
        body.model = "other model";
      },
      (body: any) => {
        body.tool_choice = "required";
      },
      (body: any) => {
        body.tools[0].name = "write";
      },
      (body: any) => {
        body.input.pop();
      },
    ]) {
      const { online, compact } = pair();
      mutate(compact);
      const original = structuredClone(compact);
      expect(alignCompaction(online, compact, cwd).ok).toBe(false);
      expect(compact).toEqual(original);
    }
  });
  test("different cwd and changed opaque contents never get normalized away", () => {
    const { online, compact } = pair(true);
    expect(alignCompaction(online, compact, "/other/cwd").ok).toBe(false);
    compact.input[0].encrypted_content = "different-opaque";
    expect(alignCompaction(online, compact, cwd).ok).toBe(false);
  });
});

test("signal ownership survives nesting and cancellation but not conflict", () => {
  const roots = signalOwners<{ name: string }>(AbortSignal.any);
  const a = new AbortController();
  const b = new AbortController();
  const unknown = new AbortController();
  const ownerA = { name: "a" };
  roots.bind(a.signal, ownerA);
  roots.bind(b.signal, { name: "b" });
  const nested = roots.any.call(AbortSignal, [roots.any.call(AbortSignal, [unknown.signal, a.signal]), unknown.signal]);
  expect(roots.get(nested)).toBe(ownerA);
  const conflict = roots.any.call(AbortSignal, [a.signal, b.signal]);
  expect(roots.get(conflict)).toBeNull();
  expect(roots.get(roots.any.call(AbortSignal, [conflict, a.signal]))).toBeNull();
  expect(roots.get(roots.any.call(AbortSignal, [unknown.signal]))).toBeUndefined();
  const reason = new Error("caller abort");
  a.abort(reason);
  expect(nested.aborted).toBe(true);
  expect(nested.reason).toBe(reason);
});
