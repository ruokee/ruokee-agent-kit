import { describe, expect, test } from "bun:test";
import { reuse, standardResult, type Body, type Item, type Reference, type Unit } from "../src/reuse.ts";

type FixtureReference = { -readonly [Key in keyof Reference]: Reference[Key] };

const user = (text: string): Item => ({ role: "user", content: [{ type: "input_text", text }] });
const trigger = { type: "compaction_trigger" };
const cwd = "/synthetic/repository";
const reminder = `<system-reminder>\nToday: 2026-10-03; current working directory: '${cwd}'. Do not repeat this information in your reply.\n</system-reminder>`;
function fixture(
  source: Item[] = [user("source")],
  sent: Item[] = [user(`${reminder}\n\nsource`)],
  local: Unit[] = [],
) {
  const sourceTools = [
    {
      type: "function",
      name: "read",
      description: "source schema",
      parameters: { type: "object", properties: { path: { type: "string" } } },
    },
  ];
  const preparedTools = [
    {
      ...sourceTools[0],
      description: "native wire schema",
      parameters: { type: "object", properties: { i: { type: "string" }, path: { type: "string" } } },
    },
  ];
  const body: Body = {
    model: "synthetic-model",
    instructions: "unchanged system",
    prompt_cache_key: "synthetic-key",
    stream: true,
    store: false,
    tools: preparedTools,
    input: sent,
  };
  const reference: FixtureReference = {
    id: 1,
    source,
    body,
    units: [{ source, sent, proof: "complete-context" }, ...local],
    sourceTools,
    preparedTools,
    expectedTools: preparedTools,
    implicitToolChoice: true,
    standard: standardResult(source, sent, cwd),
  };
  const request: Body = {
    ...body,
    tools: sourceTools,
    tool_choice: "auto",
    input: [...structuredClone(source), user("native new tail"), trigger],
  };
  return { reference, request };
}

describe("atomic already-sent reuse", () => {
  test("complete duplicate source wins over ambiguous independent matches", () => {
    const source = [user("duplicate"), user("duplicate"), user("retained")];
    const sent = [user("already sent indivisible result")];
    const { reference, request } = fixture(
      source,
      sent,
      source.map((item) => ({ source: [item], sent: [item], proof: "native-independent" })),
    );
    const before = structuredClone(request);
    const result = reuse(reference, request, "hooks");
    expect(result.reason).toBe("rewritten");
    expect(result.body.input).toEqual([...sent, user("native new tail"), trigger]);
    expect(result.reused).toBe(3);
    expect(request).toEqual(before);
  });

  test("opaque source, insertion, reordering and new paired tool tails retain exact native boundaries", () => {
    const opaque = { type: "compaction", id: "persisted-id", encrypted_content: "opaque-bytes" };
    const source = [opaque, user("source A"), user("source B")];
    const sent = [{ type: "compaction", encrypted_content: "opaque-bytes" }, user("inserted"), source[2]!, source[1]!];
    const { reference, request } = fixture(source, sent);
    const tail = [
      { type: "function_call", call_id: "new_call", name: "read", arguments: "{}" },
      { type: "function_call_output", call_id: "new_call", output: "new native result" },
      trigger,
    ];
    request.input.splice(source.length, request.input.length - source.length, ...tail);
    const result = reuse(reference, request, "hooks");
    expect(result.body.input).toEqual([...sent, ...tail]);
    expect(result.body.tools).toEqual(reference.preparedTools);
    expect(result.body.tool_choice).toBeUndefined();
    expect(result.body.prompt_cache_key).toBe(request.prompt_cache_key);
    expect(reuse(reference, request, "standard").body).toBe(request);
  });

  test("independent retained result aligns without restoring a trimmed tool output", () => {
    const source = [
      user("stable"),
      { type: "function_call", call_id: "old_call", name: "read", arguments: "{}" },
      { type: "function_call_output", call_id: "old_call", output: "original large output" },
    ];
    const sent = [user("completed stable transformation"), source[1]!, source[2]!];
    const local: Unit[] = [
      { source: source.slice(0, 1), sent: sent.slice(0, 1), proof: "native-independent" },
      { source: source.slice(1), sent: sent.slice(1), proof: "native-independent" },
    ];
    const { reference, request } = fixture(source, sent, local);
    request.input[2] = { ...source[2], output: "native trimmed result" };
    const result = reuse(reference, request, "hooks");
    expect(result.body.input).toEqual([sent[0]!, source[1]!, request.input[2]!, user("native new tail"), trigger]);
    expect(result.reused).toBe(1);
    expect(result.body.input.some((item) => item.output === "original large output")).toBe(false);
  });

  test("indivisible changed dependencies and absent proof remain separate complete refusals", () => {
    const { reference, request } = fixture([user("stable"), user("changed dependency")], [user("indivisible hash")]);
    request.input[1] = user("native rewritten dependency");
    expect(reuse(reference, request, "hooks").reason).toBe("projection-dependency-changed");
    expect(reuse(reference, request, "hooks").body).toBe(request);
    reference.units = [];
    expect(reuse(reference, request, "hooks").reason).toBe("projection-unconfirmed");
    expect(reuse(reference, request, "hooks").body).toBe(request);
  });

  test("ambiguous local source cannot select arbitrary repeated output", () => {
    const source = [user("stable"), user("removed")];
    const local: Unit[] = [{ source: [source[0]!], sent: [user("independent result")], proof: "native-independent" }];
    const { reference, request } = fixture(source, [user("complete result")], local);
    request.input = [source[0]!, source[0]!, trigger];
    expect(reuse(reference, request, "hooks").reason).toBe("projection-unconfirmed");
    expect(reuse(reference, request, "hooks").body).toBe(request);
  });

  test("unknown fields, explicit policies and unproved schemas refuse without partial edits", () => {
    for (const change of [
      (request: Body) => {
        request.model = "other-model";
      },
      (request: Body) => {
        request.routing = "unknown policy";
      },
      (request: Body) => {
        request.tool_choice = "required";
      },
      (request: Body) => {
        request.tools = [{ type: "function", name: "write" }];
      },
      (request: Body) => {
        request.input = request.input.slice(0, -1);
      },
    ]) {
      const { reference, request } = fixture();
      change(request);
      const before = structuredClone(request);
      const result = reuse(reference, request, "hooks");
      expect(result.changed).toBe(false);
      expect(result.body).toBe(request);
      expect(request).toEqual(before);
    }
    const { reference, request } = fixture();
    reference.expectedTools = [{ type: "function", name: "unproved" }];
    expect(reuse(reference, request, "hooks").reason).toBe("tool-proof-unconfirmed");
  });

  test("output limits retain V2 omission or valid value instead of copying ordinary limits", () => {
    for (const limit of [undefined, 64, 4096]) {
      const { reference, request } = fixture();
      reference.body.max_output_tokens = 1000;
      if (limit !== undefined) request.max_output_tokens = limit;
      const result = reuse(reference, request, "hooks");
      expect(result.reason).toBe("rewritten");
      expect(result.body.max_output_tokens).toBe(limit);
    }
    for (const limit of [0, -1, 1.5, "1000", Infinity]) {
      const { reference, request } = fixture();
      request.max_output_tokens = limit;
      expect(reuse(reference, request, "hooks").reason).toBe("output-limit-unconfirmed");
    }
  });

  test("implicit auto requires actual policy proof and unchanged input does not reserialize", () => {
    const { reference, request } = fixture([user("source")], [user("source")]);
    reference.sourceTools = [];
    reference.preparedTools = [];
    reference.expectedTools = [];
    reference.body.tools = [];
    request.tools = undefined;
    reference.implicitToolChoice = false;
    expect(reuse(reference, request, "hooks").reason).toBe("explicit-tool-choice");
    reference.implicitToolChoice = true;
    const first = reuse(reference, request, "hooks");
    const aligned = reuse(reference, first.body, "hooks");
    expect(aligned.reason).toBe("already-aligned");
    expect(aligned.body).toBe(first.body);
  });
});
