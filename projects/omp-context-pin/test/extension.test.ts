import { describe, expect, test } from "bun:test";
import { COMMAND_NAME } from "../src/command.ts";
import { PACKAGE_NAME, activate } from "../src/extension.ts";
import { MAX_DIAGNOSTIC_DETAIL } from "../src/receipt.ts";
import { PROJECTION_TYPE, RECORD_SCHEMA_VERSION, RECORD_TYPE } from "../src/record.ts";
import { TOOL_NAME } from "../src/tool.ts";
import { callTool, recordsOf } from "./drive.ts";
import { fakeHost } from "./host.ts";

interface FakeTool {
  execute: (
    id: string,
    params: unknown,
    signal: unknown,
    onUpdate: unknown,
    ctx: unknown,
  ) => Promise<{ content: Array<{ text: string }>; details: { code: string }; isError?: boolean }>;
}

describe("activate on a supported host", () => {
  test("registers the tool, the command and the handlers it needs", () => {
    const host = fakeHost();
    activate(host.pi);

    expect(host.tools.has(TOOL_NAME)).toBe(true);
    expect(host.commands.has(COMMAND_NAME)).toBe(true);
    expect(host.handlers.get("context")).toHaveLength(1);
    expect(host.handlers.get("session_start")).toHaveLength(1);
    expect(host.handlers.get("session_switch")).toHaveLength(1);
    expect(host.handlers.get("session_shutdown")).toHaveLength(1);
    expect(host.warnings).toEqual([]);
  });

  test("carries one change from the tool to the journal and to the model", async () => {
    const host = fakeHost();
    activate(host.pi);

    const outcome = await (host.tools.get(TOOL_NAME) as unknown as FakeTool).execute(
      "call-1",
      { action: "create", content: "maple" },
      undefined,
      undefined,
      host.ctx,
    );

    expect(outcome.details.code).toBe("ok");
    expect(host.appended).toHaveLength(1);
    expect(host.sent).toHaveLength(1);
    expect(String(host.sent[0]?.message.content)).toContain("maple");
    expect(host.sent[0]?.options).toEqual({ deliverAs: "nextTurn", triggerTurn: false });
    // The change is not handed over as a steering message, which the host would
    // run as a further turn.
    expect(host.steering).toEqual([]);
    // The host holds the projection for a later turn and records it there.
    host.drain();
    expect(host.journal.filter((entry) => entry.type === "custom_message")).toHaveLength(1);
  });

  test("leaves a request that already expresses the change untouched", async () => {
    const host = fakeHost();
    activate(host.pi);
    await (host.tools.get(TOOL_NAME) as unknown as FakeTool).execute(
      "call-1",
      { action: "create", content: "maple" },
      undefined,
      undefined,
      host.ctx,
    );
    host.drain();

    const delivered = host.journal.find((entry) => entry.type === "custom_message");
    if (delivered === undefined) throw new Error("expected a delivered projection");
    const messages = [
      { role: "user" },
      { role: "custom", customType: PROJECTION_TYPE, details: delivered.details, content: delivered.content },
    ];
    const result = host.emit("context", { type: "context", messages });

    expect(result).toBeUndefined();
    expect(host.sent).toHaveLength(1);
  });

  test("writes a change whose projection never reached the journal into the request", async () => {
    const host = fakeHost({ persistDeliveries: false });
    activate(host.pi);
    await (host.tools.get(TOOL_NAME) as unknown as FakeTool).execute(
      "call-1",
      { action: "create", content: "maple" },
      undefined,
      undefined,
      host.ctx,
    );
    // The delivery is queued, so the journal does not carry the projection yet.
    expect(host.journal.filter((entry) => entry.type === "custom_message")).toHaveLength(0);
    const messages = [{ role: "user" }];

    const result = host.emit("context", { type: "context", messages }) as { messages: Array<Record<string, unknown>> };

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toBe(messages[0]);
    expect(result.messages[1]?.customType).toBe(PROJECTION_TYPE);
    expect(String(result.messages[1]?.content)).toContain("maple");
    // The same change is handed to the host once, not once per request.
    expect(host.sent).toHaveLength(1);

    host.emit("context", { type: "context", messages: [{ role: "user" }] });
    expect(host.sent).toHaveLength(1);

    host.drain();
    host.emit("context", { type: "context", messages: [{ role: "user" }] });
    expect(host.sent).toHaveLength(1);
  });

  test("carries a change whose delivery never reached the journal, without queueing it twice", async () => {
    const host = fakeHost({ persistDeliveries: false });
    activate(host.pi);
    await (host.tools.get(TOOL_NAME) as unknown as FakeTool).execute(
      "call-1",
      { action: "create", content: "maple" },
      undefined,
      undefined,
      host.ctx,
    );
    // A detached or failed delivery leaves the record without its projection.
    const messages = [{ role: "user" }];

    const result = host.emit("context", { type: "context", messages }) as { messages: Array<Record<string, unknown>> };

    expect(String(result.messages[1]?.content)).toContain("maple");
    expect(host.sent).toHaveLength(1);
    expect(host.journal.filter((entry) => entry.type === "custom_message")).toHaveLength(0);

    // A new period starts a fresh delivery attempt for the same change.
    host.emit("session_switch", { type: "session_switch", reason: "resume" });
    const again = host.emit("context", { type: "context", messages: [{ role: "user" }] }) as {
      messages: Array<Record<string, unknown>>;
    };

    expect(host.sent).toHaveLength(2);
    // The change is written into the request again, and the extension queues no
    // copy of its own for the journal the host never wrote.
    expect(String(again.messages[1]?.content)).toContain("maple");
    expect(host.journal.filter((entry) => entry.type === "custom_message")).toHaveLength(0);
  });

  test("restores the pinned text after a committed compaction", async () => {
    const host = fakeHost();
    activate(host.pi);
    await (host.tools.get(TOOL_NAME) as unknown as FakeTool).execute(
      "call-1",
      { action: "create", content: "maple" },
      undefined,
      undefined,
      host.ctx,
    );
    host.push({ id: "j-compact", type: "compaction", summary: "earlier turns" });
    host.drain();

    const delivered = host.journal.find((entry) => entry.type === "custom_message");
    if (delivered === undefined) throw new Error("expected a delivered projection");
    const messages = [
      { role: "user" },
      { role: "compactionSummary", summary: "earlier turns" },
      { role: "custom", customType: PROJECTION_TYPE, details: delivered.details, content: delivered.content },
      { role: "assistant" },
    ];
    const result = host.emit("context", { type: "context", messages }) as { messages: Array<Record<string, unknown>> };

    expect(result.messages).toHaveLength(4);
    expect(result.messages[0]).toBe(messages[0]);
    expect(result.messages[1]).toBe(messages[1]);
    expect(result.messages[3]).toBe(messages[3]);
    expect(result.messages[2]?.customType).toBe(PROJECTION_TYPE);
    expect(result.messages[2]?.role).toBe("custom");
    expect(result.messages[2]?.display).toBe(false);
    expect(String(result.messages[2]?.content)).toContain("maple");
  });

  test("expresses a change whose delivery was refused before the ones the request shows", async () => {
    const host = fakeHost();
    activate(host.pi);
    const send = host.pi.sendMessage as (message: unknown, options: unknown) => void;
    let refuse = true;
    (host.pi as unknown as { sendMessage: unknown }).sendMessage = (message: unknown, options: unknown) => {
      if (refuse) {
        refuse = false;
        throw new Error("the host refused the message");
      }
      send(message, options);
    };
    const tool = host.tools.get(TOOL_NAME) as unknown as FakeTool;

    // The first change is accepted in the journal while its delivery never
    // reaches the host; the second change is delivered and persisted.
    await expect(
      tool.execute("call-1", { action: "create", content: "maple" }, undefined, undefined, host.ctx),
    ).rejects.toThrow();
    await tool.execute("call-2", { action: "create", content: "spruce" }, undefined, undefined, host.ctx);
    const persisted = host.journal
      .filter((entry) => entry.type === "custom_message")
      .map((entry) => ({
        role: "custom",
        customType: entry.customType,
        details: entry.details,
        content: entry.content,
      }));

    const result = host.emit("context", { type: "context", messages: [{ role: "user" }, ...persisted] }) as {
      messages: Array<{ details?: Record<string, unknown>; content?: unknown }>;
    };

    expect(result.messages.map((message) => message.details?.operationId ?? "user")).toEqual(["user", 1, 2]);
    expect(String(result.messages[1]?.content)).toContain("maple");
    expect(String(result.messages[2]?.content)).toContain("spruce");
  });

  test("keeps the request and the journal alone when the range is damaged", async () => {
    const host = fakeHost();
    activate(host.pi);
    await (host.tools.get(TOOL_NAME) as unknown as FakeTool).execute(
      "call-1",
      { action: "create", content: "maple" },
      undefined,
      undefined,
      host.ctx,
    );
    const before = host.journal.length;
    host.push({ id: "j-bad", type: "custom", customType: RECORD_TYPE, data: { schemaVersion: 99 } });

    const result = host.emit("context", { type: "context", messages: [{ role: "user" }] });

    expect(result).toBeUndefined();
    expect(host.journal).toHaveLength(before + 1);
  });

  test("reports a damaged range once from the request hook", async () => {
    const host = fakeHost();
    activate(host.pi);
    await (host.tools.get(TOOL_NAME) as unknown as FakeTool).execute(
      "call-1",
      { action: "create", content: "maple" },
      undefined,
      undefined,
      host.ctx,
    );
    const before = host.journal.length;
    host.push({ id: "j-bad", type: "custom", customType: RECORD_TYPE, data: { schemaVersion: 99 } });

    const first = host.emit("context", { type: "context", messages: [{ role: "user" }] });
    const second = host.emit("context", { type: "context", messages: [{ role: "user" }] });

    expect(first).toBeUndefined();
    expect(second).toBeUndefined();
    expect(host.journal).toHaveLength(before + 1);
    expect(host.warnings).toHaveLength(1);
    expect(host.warnings[0]).toContain(PACKAGE_NAME);
    expect(host.warnings[0]).toContain("j-bad");
    expect(host.ui.notifies).toHaveLength(1);
    expect(host.ui.notifies[0]?.kind).toBe("warning");
    expect(host.ui.notifies[0]?.message).toContain("j-bad");
  });

  test("reports the next damaged range after a reset made one readable", () => {
    const host = fakeHost();
    activate(host.pi);
    host.push({ id: "j-bad", type: "custom", customType: RECORD_TYPE, data: {} });

    host.emit("context", { type: "context", messages: [{ role: "user" }] });
    expect(host.warnings).toHaveLength(1);

    // The reset starts an empty range, so this request reads the pin set and
    // the problem behind it is not reported again.
    host.push({ id: "reset-1", type: "reset_boundary" });
    expect(host.emit("context", { type: "context", messages: [] })).toBeUndefined();
    expect(host.warnings).toHaveLength(1);

    host.push({ id: "j-bad-2", type: "custom", customType: RECORD_TYPE, data: {} });
    host.emit("context", { type: "context", messages: [{ role: "user" }] });

    expect(host.warnings).toHaveLength(2);
    expect(host.warnings[1]).toContain("j-bad-2");
    expect(host.ui.notifies).toHaveLength(2);
  });

  test("bounds the reason a request diagnostic repeats", () => {
    const host = fakeHost();
    activate(host.pi);
    // Two entries under one id are not a path, and the id is what the reason
    // repeats, so a long id would otherwise reach the user in full.
    const long = "x".repeat(MAX_DIAGNOSTIC_DETAIL * 2);
    host.push({ id: long, type: "custom", customType: RECORD_TYPE, data: {} });
    host.push({ id: long, type: "custom", customType: RECORD_TYPE, data: {} });

    host.emit("context", { type: "context", messages: [{ role: "user" }] });

    const shown = host.ui.notifies[0]?.message ?? "";
    expect(host.warnings).toHaveLength(1);
    // The long id is cut, so the reason the user reads stays bounded.
    expect(shown).not.toContain("x".repeat(MAX_DIAGNOSTIC_DETAIL));
    expect(shown.length).toBeLessThan(long.length);
  });
});

describe("session numbers", () => {
  test("reads the numbers of every branch, not only the branch it is on", async () => {
    const elsewhere = {
      id: "j-elsewhere",
      type: "custom",
      customType: RECORD_TYPE,
      data: {
        schemaVersion: RECORD_SCHEMA_VERSION,
        operationId: 4,
        action: "create",
        entryId: 4,
        revision: 1,
        body: "another branch",
        source: "user",
      },
    };
    const host = fakeHost({ sessionEntries: [elsewhere] });
    activate(host.pi);

    const outcome = await callTool(host, "call-1", { action: "create", content: "maple" });

    expect(outcome.details.code).toBe("ok");
    const written = recordsOf(host)[0]?.data as { entryId: number; operationId: number };
    expect(written.entryId).toBe(5);
    expect(written.operationId).toBe(5);
  });

  test("keeps the numbers of the period it cleared", async () => {
    const before = {
      id: "j-before",
      type: "custom",
      customType: RECORD_TYPE,
      data: {
        schemaVersion: RECORD_SCHEMA_VERSION,
        operationId: 3,
        action: "create",
        entryId: 3,
        revision: 1,
        body: "before the clear",
        source: "user",
      },
    };
    const host = fakeHost({
      journal: [{ id: "reset-1", type: "reset_boundary" }],
      sessionEntries: [before, { id: "reset-1", type: "reset_boundary" }],
    });
    activate(host.pi);

    const outcome = await callTool(host, "call-1", { action: "create", content: "maple" });

    expect(outcome.details.code).toBe("ok");
    const written = recordsOf(host)[0]?.data as { entryId: number; operationId: number };
    expect(written.entryId).toBe(4);
    expect(written.operationId).toBe(4);
  });

  test("reserves one number for a call the host repeats", async () => {
    const host = fakeHost();
    activate(host.pi);

    await callTool(host, "call-1", { action: "create", content: "maple" });
    const again = await callTool(host, "call-1", { action: "create", content: "maple" });
    await callTool(host, "call-2", { action: "create", content: "oak" });
    const second = await callTool(host, "call-2", { action: "create", content: "oak" });

    expect(again.details.code).toBe("duplicate");
    expect(second.details.code).toBe("duplicate");
    expect(recordsOf(host).map((entry) => (entry.data as { operationId: number }).operationId)).toEqual([1, 2]);
  });
});
