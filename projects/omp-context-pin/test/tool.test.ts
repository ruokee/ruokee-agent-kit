import { describe, expect, test } from "bun:test";
import { resolveApproval } from "@oh-my-pi/pi-coding-agent/tools/approval";
import { MAX_ENTRY_BYTES } from "../src/limits.ts";
import type { PinRequest } from "../src/envelope.ts";
import type { PinEnvironment } from "../src/operations.ts";
import { RECORD_SCHEMA_VERSION, RECORD_TYPE, type PinRecord } from "../src/record.ts";
import type { JournalEntry } from "../src/state.ts";
import { activate } from "../src/extension.ts";
import { TOOL_NAME, runAction } from "../src/tool.ts";
import { fakeContext, fakeHost } from "./host.ts";

function environment(overrides: Partial<PinEnvironment> = {}) {
  const journal: JournalEntry[] = [];
  const delivered: PinRecord[] = [];
  const submitted: PinRequest[] = [];
  const outcomes: string[] = [];
  let operationCounter = 0;
  let entryCounter = 0;
  const env: PinEnvironment = {
    reader: { getBranch: () => journal },
    append: (record) => {
      journal.push({ id: `j-${journal.length + 1}`, type: "custom", customType: RECORD_TYPE, data: record });
    },
    deliver: (record) => delivered.push(record),
    reserveOperation: () => ({ ok: true, id: (operationCounter += 1) }),
    newEntryId: () => ({ ok: true, id: (entryCounter += 1) }),
    sessionId: () => "session-1",
    submit: (request) => submitted.push(request),
    deliverOutcome: (text) => outcomes.push(text),
    ...overrides,
  };
  return { env, journal, delivered, submitted, outcomes };
}

describe("runAction", () => {
  test("creates an entry from the tool call and reports its identity", () => {
    const { env, journal, delivered } = environment();
    const outcome = runAction(env, { action: "create", content: "maple" }, "call-1");

    expect(outcome.ok).toBe(true);
    expect(outcome.entryId).toBe(1);
    expect(outcome.revision).toBe(1);
    expect(journal).toHaveLength(1);
    expect(delivered).toHaveLength(1);
    expect(journal[0]?.data).toMatchObject({
      schemaVersion: RECORD_SCHEMA_VERSION,
      operationId: 1,
      action: "create",
      entryId: 1,
      revision: 1,
      source: "agent",
      body: "maple",
      toolCallId: "call-1",
    });
  });

  test("treats a retried tool call as the same operation", () => {
    const { env, journal, delivered } = environment();
    runAction(env, { action: "create", content: "maple" }, "call-1");
    const again = runAction(env, { action: "create", content: "maple" }, "call-1");

    expect(again.code).toBe("duplicate");
    expect(again.ok).toBe(true);
    expect(journal).toHaveLength(1);
    expect(delivered).toHaveLength(1);
  });

  test("lists entries without bodies and reads one body on request", () => {
    const { env } = environment();
    const body = `maple ${"x".repeat(200)}`;
    runAction(env, { action: "create", content: body }, "call-1");

    const listing = runAction(env, { action: "list" }, "call-2");
    expect(listing.ok).toBe(true);
    // A row shows where the body starts and how large it is, not the body.
    expect(listing.text).toContain("maple x");
    expect(listing.text).toContain("UTF-8 bytes");
    expect(listing.text).not.toContain(body);

    const detail = runAction(env, { action: "get", id: 1 }, "call-3");
    expect(detail.ok).toBe(true);
    expect(detail.text).toContain("maple");

    const missing = runAction(env, { action: "get", id: 9 }, "call-4");
    expect(missing.ok).toBe(false);
    expect(missing.code).toBe("rejected");
  });

  test("replaces a body when the caller holds the current revision", () => {
    const { env, journal } = environment();
    runAction(env, { action: "create", content: "maple" }, "call-1");
    const outcome = runAction(env, { action: "update", id: 1, content: "spruce", expectedRevision: 1 }, "call-2");

    expect(outcome.ok).toBe(true);
    expect(outcome.revision).toBe(2);
    expect(journal).toHaveLength(2);
    expect(journal[1]?.data).toMatchObject({ action: "update", body: "spruce", source: "agent", revision: 2 });
  });

  test("refuses a stale revision without writing", () => {
    const { env, journal } = environment();
    runAction(env, { action: "create", content: "maple" }, "call-1");
    runAction(env, { action: "update", id: 1, content: "spruce", expectedRevision: 1 }, "call-2");
    const outcome = runAction(env, { action: "update", id: 1, content: "cedar", expectedRevision: 1 }, "call-3");

    expect(outcome.ok).toBe(false);
    expect(outcome.code).toBe("rejected");
    expect(outcome.text).toContain("Current revision: 2.");
    expect(journal).toHaveLength(2);
  });

  test("unpins an entry and keeps its identity retired", () => {
    const { env, journal } = environment();
    runAction(env, { action: "create", content: "maple" }, "call-1");
    const outcome = runAction(env, { action: "delete", id: 1, expectedRevision: 1 }, "call-2");

    expect(outcome.ok).toBe(true);
    expect(journal).toHaveLength(2);
    expect(journal[1]?.data).toMatchObject({ action: "delete", entryId: 1 });
    expect(runAction(env, { action: "list" }, "call-3").text).toContain("No pinned text");
  });

  test("refuses an empty or oversized body before anything is written", () => {
    for (const content of ["", "x".repeat(MAX_ENTRY_BYTES + 1)]) {
      const { env, journal } = environment();
      const outcome = runAction(env, { action: "create", content }, "call-1");
      expect(outcome.ok).toBe(false);
      expect(outcome.code).toBe("rejected");
      expect(journal).toEqual([]);
    }
  });

  test("refuses an incomplete request instead of guessing defaults", () => {
    const incomplete = [
      { action: "get" as const },
      { action: "create" as const },
      { action: "update" as const, id: 1, content: "maple" },
      { action: "update" as const, id: 1, expectedRevision: 1 },
      { action: "update" as const, content: "maple", expectedRevision: 1 },
      { action: "delete" as const },
      { action: "delete" as const, id: 1 },
    ];
    for (const request of incomplete) {
      const { env, journal, delivered } = environment();
      const outcome = runAction(env, request, "call-1");
      expect(outcome.ok).toBe(false);
      expect(outcome.code).toBe("rejected");
      expect(outcome.text).toContain("needs");
      expect(journal).toEqual([]);
      expect(delivered).toEqual([]);
    }
  });

  test("reports an unavailable range instead of writing into it", () => {
    const { env, journal } = environment();
    journal.push({ id: "j-bad", type: "custom", customType: RECORD_TYPE, data: { schemaVersion: 99 } });
    const outcome = runAction(env, { action: "create", content: "maple" }, "call-1");

    expect(outcome.ok).toBe(false);
    expect(outcome.code).toBe("unavailable");
    expect(journal).toHaveLength(1);
  });
});

describe("tool registration", () => {
  test("registers one essential tool whose schema does not depend on pin state", () => {
    const host = fakeHost();
    activate(host.pi);

    const tool = host.tools.get(TOOL_NAME);
    expect(tool).toBeDefined();
    expect(tool?.loadMode).toBe("essential");
    const parameters = tool?.parameters as { parse: (value: unknown) => unknown };
    expect(parameters.parse({ action: "list" })).toEqual({ action: "list" });
    // An entry is labelled by its number and its body start, so the tool takes
    // no separate label: a title is not part of the schema and is dropped.
    expect(parameters.parse({ action: "create", content: "maple", title: "plan" })).toEqual({
      action: "create",
      content: "maple",
    });
  });

  test("declares every action at the read tier", () => {
    // No approval mode asks the user to confirm a pin: the declaration is one
    // tier for the whole tool, and an explicit per-tool override still applies.
    const host = fakeHost();
    activate(host.pi);

    expect(host.tools.get(TOOL_NAME)?.approval).toBe("read");
  });

  test("is allowed by every default approval mode, and still yields to a user policy", () => {
    const host = fakeHost();
    activate(host.pi);
    const tool = host.tools.get(TOOL_NAME) as { name: string; approval: unknown };
    const actions = ["list", "get", "create", "update", "delete"];

    for (const mode of ["always-ask", "write", "yolo"] as const) {
      for (const action of actions) {
        const resolved = resolveApproval(tool as never, { action, content: "maple" }, mode);
        expect(`${mode} ${action}: ${resolved.policy}`).toBe(`${mode} ${action}: allow`);
      }
    }
    // The tier bounds what the tool's own declaration can mean, and a user
    // policy for this tool is authoritative in every mode.
    expect(resolveApproval(tool as never, { action: "create" }, "yolo", { [TOOL_NAME]: "deny" }).policy).toBe("deny");
    expect(resolveApproval(tool as never, { action: "list" }, "always-ask", { [TOOL_NAME]: "prompt" }).policy).toBe(
      "prompt",
    );
  });

  test("accepts one action request per call and reports the result text", async () => {
    const host = fakeHost();
    activate(host.pi);
    const tool = host.tools.get(TOOL_NAME) as {
      execute: (
        id: string,
        params: unknown,
        signal: unknown,
        onUpdate: unknown,
        ctx: unknown,
      ) => Promise<{ content: Array<{ text: string }>; details: { code: string }; isError?: boolean }>;
    };

    const outcome = await tool.execute(
      "call-1",
      { action: "create", content: "maple" },
      undefined,
      undefined,
      fakeContext({ journal: host.journal }),
    );

    expect(outcome.isError).toBeUndefined();
    expect(outcome.details.code).toBe("ok");
    expect(outcome.content[0]?.text).toContain("Pinned");
    expect(host.appended).toHaveLength(1);
    expect(host.sent).toHaveLength(1);
    expect(host.sent[0]?.options).toEqual({ deliverAs: "nextTurn", triggerTurn: false });
  });

  test("writes nothing when the call was cancelled before it ran", async () => {
    const host = fakeHost();
    activate(host.pi);
    const tool = host.tools.get(TOOL_NAME) as {
      execute: (
        id: string,
        params: unknown,
        signal: unknown,
        onUpdate: unknown,
        ctx: unknown,
      ) => Promise<{ content: Array<{ text: string }>; details: { code: string }; isError?: boolean }>;
    };

    const outcome = await tool.execute(
      "call-1",
      { action: "create", content: "maple" },
      { aborted: true },
      undefined,
      fakeContext({ journal: host.journal }),
    );

    expect(outcome.details.code).toBe("rejected");
    expect(outcome.content[0]?.text).toContain("cancelled");
    expect(host.journal).toEqual([]);
    expect(host.sent).toEqual([]);
  });
});
