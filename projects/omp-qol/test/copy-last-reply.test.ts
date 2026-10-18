/** Copy-last-reply extraction, activation, and handler behavior. */

import { describe, expect, test } from "bun:test";
import { activate } from "../src/extension.ts";
import { COPY_SHORTCUT, createCopyHandler, lastAssistantText } from "../src/copy-last-reply.ts";
import { createHarness } from "./host.ts";

type Block = Record<string, unknown>;

function message(role: "user" | "assistant", content: Block[], stopReason = "stop") {
  return { type: "message", message: { role, content, stopReason } };
}

function branch(entries: unknown[]) {
  return { getBranch: () => entries } as never;
}

function text(value: string): Block {
  return { type: "text", text: value };
}

describe("lastAssistantText", () => {
  test("returns the last assistant message and ignores thinking and tool calls", () => {
    const entries = [
      message("user", [text("question")]),
      message("assistant", [text(" old ")]),
      message("assistant", [{ type: "thinking", thinking: "hidden" }, text("answer"), { type: "toolCall" }]),
    ];
    expect(lastAssistantText(branch(entries))).toBe("answer");
  });

  test("joins text blocks without a separator", () => {
    expect(lastAssistantText(branch([message("assistant", [text("a"), text("b")])]))).toBe("ab");
  });

  test("trims surrounding whitespace", () => {
    expect(lastAssistantText(branch([message("assistant", [text("  answer  ")])]))).toBe("answer");
  });

  test("skips an aborted message with no content", () => {
    const entries = [message("assistant", [text("kept")]), message("assistant", [], "aborted")];
    expect(lastAssistantText(branch(entries))).toBe("kept");
  });

  test("does not fall back when the last assistant message has no text", () => {
    const entries = [message("assistant", [text("earlier")]), message("assistant", [{ type: "toolCall" }])];
    expect(lastAssistantText(branch(entries))).toBeUndefined();
  });

  test("returns undefined without an assistant message", () => {
    expect(lastAssistantText(branch([message("user", [text("question")])]))).toBeUndefined();
  });
});

describe("copy handler", () => {
  function setup(options: { active?: boolean; idle?: boolean; entries?: unknown[] }) {
    const harness = createHarness();
    const copied: string[] = [];
    const handler = createCopyHandler(
      () => options.active ?? true,
      async (value) => {
        copied.push(value);
      },
    );
    const ctx = harness.context({
      isIdle: () => options.idle ?? true,
      sessionManager: branch(options.entries ?? [message("assistant", [text("answer")])]),
    });
    return { harness, copied, handler, ctx };
  }

  test("copies the last reply and reports success", async () => {
    const { harness, copied, handler, ctx } = setup({});
    await handler(ctx);
    expect(copied).toEqual(["answer"]);
    expect(harness.notifications.at(-1)).toEqual({ message: "Copied the last reply.", level: "info" });
  });

  test("does nothing when the module is not active", async () => {
    const { harness, copied, handler, ctx } = setup({ active: false });
    await handler(ctx);
    expect(copied).toEqual([]);
    expect(harness.notifications).toEqual([]);
  });

  test("does not copy an earlier reply while streaming", async () => {
    const { harness, copied, handler, ctx } = setup({ idle: false });
    await handler(ctx);
    expect(copied).toEqual([]);
    expect(harness.notifications.at(-1)?.level).toBe("warning");
    expect(harness.notifications.at(-1)?.message).toContain("streaming");
  });

  test("reports no reply when the last message has no text", async () => {
    const { harness, copied, handler, ctx } = setup({ entries: [] });
    await handler(ctx);
    expect(copied).toEqual([]);
    expect(harness.notifications.at(-1)?.level).toBe("warning");
    expect(harness.notifications.at(-1)?.message).toContain("No reply");
  });

  test("reports a clipboard failure without throwing", async () => {
    const harness = createHarness();
    const handler = createCopyHandler(
      () => true,
      async () => {
        throw new Error("clipboard unavailable");
      },
    );
    const ctx = harness.context({
      isIdle: () => true,
      sessionManager: branch([message("assistant", [text("answer")])]),
    });
    await handler(ctx);
    expect(harness.notifications.at(-1)?.level).toBe("error");
    expect(harness.notifications.at(-1)?.message).toContain("Failed");
  });
});

describe("activation", () => {
  test("registers the shortcut before session_start and adds no copy command", () => {
    const harness = createHarness();
    activate(harness.pi, async () => ({}));
    expect(harness.shortcuts[COPY_SHORTCUT]?.description).toContain("last");
    expect(harness.commands.has("copy")).toBe(false);
  });
});
