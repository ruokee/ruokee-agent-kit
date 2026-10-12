import { expect, test } from "bun:test";
import { align, type ChatRequest } from "../src/handoff.ts";

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
