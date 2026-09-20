import { describe, expect, test } from "bun:test";
import { OUTCOME_TYPE, outcomeMessage } from "../src/delivery.ts";
import { IdentityAllocator, MAX_IDENTITY, scanIdentities } from "../src/identity.ts";
import { RECORD_SCHEMA_VERSION, RECORD_TYPE, type PinRecord, outcomeDetails } from "../src/record.ts";
import type { JournalEntry } from "../src/state.ts";

function record(overrides: Partial<PinRecord> = {}): PinRecord {
  return {
    schemaVersion: RECORD_SCHEMA_VERSION,
    operationId: 1,
    action: "create",
    entryId: 1,
    revision: 1,
    body: "maple",
    source: "user",
    ...overrides,
  };
}

function stored(value: unknown, id = "j-1"): JournalEntry {
  return { id, type: "custom", customType: RECORD_TYPE, data: value };
}

function result(operationId: number, id = "j-3"): JournalEntry {
  return {
    id,
    type: "custom_message",
    customType: OUTCOME_TYPE,
    content: `result of operation ${operationId}`,
    details: outcomeDetails(operationId),
  };
}

describe("scanIdentities", () => {
  test("reports no number for an empty session", () => {
    expect(scanIdentities([])).toEqual({ entryId: 0, operationId: 0 });
  });

  test("reads records and results", () => {
    const entries: JournalEntry[] = [
      stored(record({ entryId: 3, operationId: 5 })),
      result(12),
      { id: "j-text", type: "custom", customType: "other-extension", data: { operationId: 99 } },
      { id: "j-user", type: "message", message: { role: "user", content: "hello" } },
    ];

    expect(scanIdentities(entries)).toEqual({ entryId: 3, operationId: 12 });
  });

  test("keeps the highest number of a session", () => {
    const entries = [
      stored(record({ entryId: 7, operationId: 2 }), "j-a"),
      stored(record({ entryId: 2, operationId: 8 }), "j-b"),
    ];

    expect(scanIdentities(entries)).toEqual({ entryId: 7, operationId: 8 });
  });

  test("reads a number from a branch that was left", () => {
    // A session keeps every branch, so a number a branch used still counts.
    const entries = [
      stored(record({ entryId: 1, operationId: 1 }), "j-a"),
      stored(record({ operationId: 2, entryId: 2 }), "j-b"),
      stored(record({ operationId: 3, entryId: 3 }), "j-c"),
    ];

    expect(scanIdentities(entries)).toEqual({ entryId: 3, operationId: 3 });
  });

  test("counts a number a refused operation reserved", () => {
    // A result survives a refusal, so the number it names stays used.
    expect(scanIdentities([result(6)])).toEqual({ entryId: 0, operationId: 6 });
  });

  test("ignores a value it cannot read", () => {
    const entries: JournalEntry[] = [
      stored({ ...record(), schemaVersion: 1 }, "j-schema"),
      stored({ ...record(), operationId: "4" }, "j-string"),
      stored({ ...record(), entryId: -1 }, "j-negative"),
      { id: "j-empty", type: "custom", customType: RECORD_TYPE },
      { id: "j-broken", type: "custom_message", customType: OUTCOME_TYPE, details: { kind: "outcome" } },
      { id: "j-reset", type: "reset_boundary" },
    ];

    expect(scanIdentities(entries)).toEqual({ entryId: 0, operationId: 0 });
  });

  test("keeps the numbers it read beside a value it cannot read", () => {
    const entries = [
      stored(record({ entryId: 4, operationId: 4 }), "j-a"),
      stored({ ...record(), body: null }, "j-damaged"),
    ];

    expect(scanIdentities(entries)).toEqual({ entryId: 4, operationId: 4 });
  });
});

describe("IdentityAllocator", () => {
  test("hands out the number after the ones it read", () => {
    const allocator = new IdentityAllocator({ entryId: 3, operationId: 5 }, "session-1");

    expect(allocator.allocateEntry()).toEqual({ ok: true, id: 4 });
    expect(allocator.allocateOperation()).toEqual({ ok: true, id: 6 });
    expect(allocator.sessionId).toBe("session-1");
    expect(allocator.high).toEqual({ entryId: 4, operationId: 6 });
  });

  test("never lowers what it holds inside one session", () => {
    const allocator = new IdentityAllocator({ entryId: 3, operationId: 5 }, "session-1");
    allocator.allocateEntry();

    allocator.sync("session-1", { entryId: 1, operationId: 1 });
    expect(allocator.allocateEntry()).toEqual({ ok: true, id: 5 });
    expect(allocator.allocateOperation()).toEqual({ ok: true, id: 6 });
  });

  test("raises what it holds when a branch shows a higher number", () => {
    const allocator = new IdentityAllocator({ entryId: 1, operationId: 1 }, "session-1");
    allocator.sync("session-1", { entryId: 9, operationId: 2 });

    expect(allocator.allocateEntry()).toEqual({ ok: true, id: 10 });
    expect(allocator.allocateOperation()).toEqual({ ok: true, id: 3 });
  });

  test("starts again at one when the session changed", () => {
    const allocator = new IdentityAllocator({ entryId: 8, operationId: 8 }, "session-1");
    allocator.sync("session-2", { entryId: 0, operationId: 0 });

    expect(allocator.sessionId).toBe("session-2");
    expect(allocator.allocateEntry()).toEqual({ ok: true, id: 1 });
    expect(allocator.allocateOperation()).toEqual({ ok: true, id: 1 });
  });

  test("refuses a number it cannot add to any more", () => {
    const allocator = new IdentityAllocator({ entryId: MAX_IDENTITY, operationId: MAX_IDENTITY }, "session-1");

    expect(allocator.allocateEntry()).toEqual({ ok: false, detail: "every entry number of this session is used" });
    expect(allocator.allocateOperation()).toEqual({
      ok: false,
      detail: "every operation number of this session is used",
    });
  });

  test("keeps the last number it can name exactly", () => {
    expect(MAX_IDENTITY).toBe(Number.MAX_SAFE_INTEGER);
    const allocator = new IdentityAllocator({ entryId: MAX_IDENTITY - 1, operationId: 0 }, "session-1");

    expect(allocator.allocateEntry()).toEqual({ ok: true, id: MAX_IDENTITY });
    expect(allocator.allocateEntry().ok).toBe(false);
  });

  test("reads the numbers of a session the host reports", () => {
    const allocator = new IdentityAllocator();
    allocator.sync("session-1", scanIdentities([stored(record({ entryId: 2, operationId: 2 })), result(7)]));

    expect(allocator.sessionId).toBe("session-1");
    expect(allocator.allocateEntry()).toEqual({ ok: true, id: 3 });
    expect(allocator.allocateOperation()).toEqual({ ok: true, id: 8 });
  });
});
