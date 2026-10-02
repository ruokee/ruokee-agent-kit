/**
 * Conversation usage tests: which branch entries contribute the token
 * totals the status bar publishes, and how unexpected shapes are handled.
 */

import { describe, expect, test } from "bun:test";
import { sumConversationUsage, type ConversationEntryLike } from "../src/conversation-usage.ts";

describe("conversation usage", () => {
  test("counts assistant messages and task results, and skips every model_usage entry", () => {
    const branch = [
      {
        type: "message",
        message: { role: "assistant", usage: { input: 100, cacheWrite: 5, cacheRead: 900, output: 40 } },
      },
      { type: "message", message: { role: "user" } },
      { type: "message", message: { role: "toolResult", toolName: "read", usage: { input: 1, output: 1 } } },
      {
        type: "message",
        message: { role: "toolResult", toolName: "task", details: { usage: { input: 7, output: 3 } } },
      },
      { type: "custom" },
      { type: "model_usage" },
    ];
    expect(sumConversationUsage(branch)).toEqual({ input: 107, cacheWrite: 5, cacheRead: 900, output: 43 });
  });

  test("a Find judgment cascade does not enter the totals", () => {
    const branch = [
      {
        type: "message",
        message: { role: "assistant", usage: { input: 10, cacheWrite: 0, cacheRead: 90, output: 1 } },
      },
      ...Array.from({ length: 4 }, (_, index) => ({
        type: "model_usage",
        purpose: "find",
        usage: { input: 6400 + index, cacheWrite: 0, cacheRead: 0, output: 832 },
      })),
    ];
    expect(sumConversationUsage(branch as ConversationEntryLike[])).toEqual({
      input: 10,
      cacheWrite: 0,
      cacheRead: 90,
      output: 1,
    });
  });

  test("malformed entries and counters report fewer tokens instead of NaN", () => {
    const branch = [
      null,
      { type: "message", message: null },
      { type: "message", message: { role: "assistant", usage: null } },
      { type: "message", message: { role: "assistant", usage: "19" } },
      {
        type: "message",
        message: {
          role: "assistant",
          usage: { input: "12", cacheWrite: Number.NaN, cacheRead: 5, output: undefined },
        },
      },
      { type: "message", message: { role: "toolResult", toolName: "task" } },
      { type: "message", message: { role: "toolResult", toolName: "task", details: { usage: null } } },
    ] as unknown as ConversationEntryLike[];
    expect(sumConversationUsage(branch)).toEqual({ input: 0, cacheWrite: 0, cacheRead: 5, output: 0 });
  });

  test("an empty branch reports zero", () => {
    expect(sumConversationUsage([])).toEqual({ input: 0, cacheWrite: 0, cacheRead: 0, output: 0 });
  });
});
