import { expect, test } from "bun:test";
import { align, alignResponses, type ChatRequest } from "../src/handoff.ts";

const BASE = { role: "system", content: "base" },
  PLAN = { role: "system", content: "plan" },
  ASK = { role: "user", content: "ask" },
  TAIL = { role: "user", content: "handoff-instruction" };

test("restores the online system segments and keeps the side history native", () => {
  const reference: ChatRequest = { messages: [BASE, PLAN, ASK] };
  const side: ChatRequest = { messages: [BASE, ASK, TAIL], tool_choice: "none" };
  const result = align(reference, side);
  expect(result).toEqual({
    reason: "rewritten",
    body: { messages: [BASE, PLAN, ASK, TAIL] },
    axes: 0,
    unprojected: 0,
  });
  expect(side.tool_choice).toBe("none");
});

test("restores the online reasoning effort over the side value", () => {
  const result = align(
    { messages: [BASE, ASK], reasoning_effort: "high" },
    { messages: [BASE, ASK, TAIL], reasoning_effort: "low" },
  );
  expect(result).toEqual({
    reason: "rewritten",
    body: { messages: [BASE, ASK, TAIL], reasoning_effort: "high" },
    axes: 0,
    unprojected: 0,
  });
});

test("counts an axis the reference never made explicit instead of guessing a value", () => {
  const side: ChatRequest = { messages: [BASE, ASK, TAIL], reasoning_effort: "low" };
  expect(align({ messages: [BASE, ASK] }, side)).toEqual({ reason: "already-aligned", axes: 1, unprojected: 0 });
  expect(side.reasoning_effort).toBe("low");
});

test("counts an unprojectable tool choice instead of rewriting it", () => {
  expect(
    align({ messages: [BASE, ASK], tool_choice: "required" }, { messages: [BASE, ASK, TAIL], tool_choice: "none" }),
  ).toEqual({ reason: "already-aligned", axes: 1, unprojected: 0 });
});

test("leaves a side system prefix that does not match the online segments", () => {
  expect(
    align({ messages: [BASE, PLAN, ASK] }, { messages: [{ role: "system", content: "other" }, ASK, TAIL] }),
  ).toEqual({
    reason: "prefix-projection-changed",
    axes: 0,
    unprojected: 0,
  });
});

test("leaves a side history that did not keep the online prefix", () => {
  expect(align({ messages: [BASE, ASK] }, { messages: [BASE, { role: "user", content: "different" }, TAIL] })).toEqual({
    reason: "prefix-projection-changed",
    axes: 0,
    unprojected: 0,
  });
  expect(align({ messages: [BASE, ASK] }, { messages: [BASE, ASK] })).toEqual({
    reason: "prefix-projection-changed",
    axes: 0,
    unprojected: 0,
  });
});

test("refuses a payload whose messages are not a list", () => {
  expect(align({}, { messages: [BASE] })).toEqual({ reason: "unsupported-payload-shape", axes: 0, unprojected: 0 });
  expect(align({ messages: [BASE] }, { messages: "private" })).toEqual({
    reason: "unsupported-payload-shape",
    axes: 0,
    unprojected: 0,
  });
});

test("counts cache-sensitive fields it cannot project without abandoning the projection", () => {
  const result = align(
    { messages: [BASE, PLAN, ASK], thinking: { type: "enabled", budget_tokens: 4096 } },
    { messages: [BASE, ASK, TAIL] },
  );
  expect(result).toEqual({
    reason: "rewritten",
    body: { messages: [BASE, PLAN, ASK, TAIL] },
    axes: 0,
    unprojected: 1,
  });
  expect(align({ messages: [BASE, ASK], thinking: { type: "enabled" } }, { messages: [BASE, ASK, TAIL] })).toEqual({
    reason: "already-aligned",
    axes: 0,
    unprojected: 1,
  });
});

test("a difference outside the observed axes is not a gate", () => {
  expect(
    align(
      { messages: [BASE, ASK], stream: false, temperature: 0.1 },
      { messages: [BASE, ASK, TAIL], stream: true, temperature: 0.9 },
    ),
  ).toEqual({ reason: "already-aligned", axes: 0, unprojected: 0 });
});

const SOURCE = [{ role: "user", content: "source history" }];
const RESPONSES_PROOF = { system: ["base", "plan"], source: SOURCE, snapshot: [...SOURCE, TAIL] };

test("Responses restores instructions without changing native generation or replay semantics", () => {
  const history = [
    { type: "reasoning", id: "reasoning-id", encrypted_content: "opaque" },
    {
      role: "user",
      content: [
        { type: "input_text", text: "ask" },
        { type: "input_image", image_url: "data:image/png;base64,fixture" },
      ],
    },
  ];
  const tools = [{ type: "function", name: "read", parameters: { type: "object", properties: {} } }];
  const reference = {
    instructions: "base\n\nplan",
    input: history,
    tools,
    reasoning: { effort: "medium" },
    prompt_cache_key: "cache",
  };
  const side = {
    instructions: "base",
    input: [...history, TAIL],
    tools,
    reasoning: { effort: "medium" },
    tool_choice: "none",
    prompt_cache_key: "cache",
    session_id: "independent-side",
    max_output_tokens: 4096,
  };
  expect(alignResponses(reference, side, RESPONSES_PROOF)).toEqual({
    reason: "rewritten",
    body: { ...side, instructions: reference.instructions },
    axes: 0,
    unprojected: 1,
  });
  expect(side.instructions).toBe("base");
});

test("Responses developer projection retains historical developer messages in their history positions", () => {
  const system = [
    { role: "developer", content: "base" },
    { role: "developer", content: "plan" },
  ];
  const history = [
    ASK,
    { role: "developer", content: "historical developer instruction" },
    { type: "function_call", call_id: "call", name: "read", arguments: "{}" },
    { type: "function_call_output", call_id: "call", output: "result" },
  ];
  const reference = { input: [...system, ...history], tools: [] };
  const side = { input: [system[0], ...history, TAIL], tools: [], tool_choice: "none" };
  expect(alignResponses(reference, side, RESPONSES_PROOF)).toEqual({
    reason: "rewritten",
    body: { ...side, input: [...system, ...history, TAIL] },
    axes: 0,
    unprojected: 1,
  });
});

test("Responses keeps native configuration updates and effective reasoning instead of copying a request baseline", () => {
  const update = { type: "configuration_update", reasoning: { effort: "high" } };
  const reference = { instructions: "base\n\nplan", input: [ASK, update], reasoning: { effort: "low" }, tools: [] };
  const side = {
    instructions: "base",
    input: [ASK, TAIL],
    reasoning: { effort: "high" },
    tools: [],
    tool_choice: "none",
  };
  const result = alignResponses(reference, side, RESPONSES_PROOF);
  expect(result.body).toEqual({ ...side, instructions: reference.instructions });
  expect(result.axes).toBe(1);
  expect(result.unprojected).toBe(2);
});

test("Responses refuses missing source proof, changed common content, and explicit generation conflicts", () => {
  const reference = { instructions: "base\n\nplan", input: [ASK], tools: [] };
  const side = { instructions: "base", input: [ASK, TAIL], tools: [], tool_choice: "none" };
  expect(
    alignResponses(reference, side, {
      ...RESPONSES_PROOF,
      snapshot: [{ role: "user", content: "different source" }, TAIL],
    }).reason,
  ).toBe("source-prefix-unconfirmed");
  expect(
    alignResponses(reference, { ...side, input: [{ role: "user", content: "changed" }, TAIL] }, RESPONSES_PROOF).reason,
  ).toBe("prefix-projection-changed");
  expect(alignResponses(reference, { ...side, instructions: "different base" }, RESPONSES_PROOF).reason).toBe(
    "system-prefix-unconfirmed",
  );
  expect(
    alignResponses(reference, { ...side, tools: [{ type: "function", name: "other" }] }, RESPONSES_PROOF).reason,
  ).toBe("tool-projection-changed");
  expect(alignResponses(reference, { ...side, tool_choice: "required" }, RESPONSES_PROOF).reason).toBe(
    "generation-policy-conflict",
  );
});

test("Responses restores a missing suffix inside a native system segment in either expression", () => {
  const proof = { ...RESPONSES_PROOF, system: ["base\nper-turn rule"] };
  const historical = { role: "developer", content: "historical developer instruction" };
  const history = [ASK, historical];
  const instructions = { instructions: "base", input: [...history, TAIL], tool_choice: "none" };
  expect(alignResponses({ instructions: proof.system[0], input: history }, instructions, proof).body).toEqual({
    ...instructions,
    instructions: proof.system[0],
  });
  const system = { role: "developer", content: proof.system[0] };
  const developer = { input: [{ role: "developer", content: "base" }, ...history, TAIL], tool_choice: "none" };
  expect(alignResponses({ input: [system, ...history] }, developer, proof).body).toEqual({
    ...developer,
    input: [system, ...history, TAIL],
  });
});

test("Responses permits native assistant bookkeeping without weakening source proof", () => {
  const assistant = {
    role: "assistant",
    content: [{ type: "text", text: "retained reply" }],
    providerPayload: { items: [{ type: "reasoning", encrypted_content: "opaque-source" }] },
    timestamp: 1,
  };
  const settled = { ...assistant, completedAt: 2, contextSnapshot: { promptTokens: 100, nonMessageTokens: 10 } };
  const reference = { instructions: "base\n\nplan", input: [ASK], tools: [] };
  const side = { instructions: "base", input: [ASK, TAIL], tools: [], tool_choice: "none" };
  const proof = { ...RESPONSES_PROOF, source: [assistant], snapshot: [settled, TAIL] };
  expect(alignResponses(reference, side, proof).body).toEqual({ ...side, instructions: reference.instructions });
  for (const changed of [
    { ...settled, content: [{ type: "text", text: "changed reply" }] },
    { ...settled, providerPayload: { items: [{ type: "reasoning", encrypted_content: "changed-opaque" }] } },
    { ...settled, futureInput: "unconfirmed" },
  ]) {
    expect(alignResponses(reference, side, { ...proof, snapshot: [changed, TAIL] }).reason).toBe(
      "source-prefix-unconfirmed",
    );
  }
  expect(
    alignResponses(reference, side, {
      ...RESPONSES_PROOF,
      snapshot: [{ ...SOURCE[0], completedAt: 2, contextSnapshot: settled.contextSnapshot }, TAIL],
    }).reason,
  ).toBe("source-prefix-unconfirmed");
  expect(
    alignResponses(reference, { ...side, input: [{ role: "user", content: "changed wire" }, TAIL] }, proof).reason,
  ).toBe("prefix-projection-changed");
});
