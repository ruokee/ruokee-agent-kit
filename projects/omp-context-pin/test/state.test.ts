import { describe, expect, test } from "bun:test";
import { MAX_BRANCH_BYTES, MAX_ENTRY_BYTES, byteLength } from "../src/limits.ts";
import { changeText } from "../src/projection.ts";
import { PROJECTION_TYPE, RECORD_SCHEMA_VERSION, RECORD_TYPE, type PinRecord } from "../src/record.ts";
import { type JournalEntry, planCreate, planDelete, planUpdate, replay, summarize } from "../src/state.ts";

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

function stored(value: PinRecord, id = `j-${value.operationId}`): JournalEntry {
  return { id, type: "custom", customType: RECORD_TYPE, data: value };
}

/** Projection of the create in the `record` fixture, unless overridden. */
function projection(
  operationId = 1,
  overrides: Record<string, unknown> = {},
  id = `p-${operationId}`,
  content: unknown = changeText(record()),
): JournalEntry {
  return {
    id,
    type: "custom_message",
    customType: PROJECTION_TYPE,
    content,
    details: {
      schemaVersion: RECORD_SCHEMA_VERSION,
      operationId,
      entryId: 1,
      revision: 1,
      action: "create",
      ...overrides,
    },
  };
}

function rawProjection(details: unknown, content: unknown = "forged", id = "p-forged"): JournalEntry {
  return { id, type: "custom_message", customType: PROJECTION_TYPE, details, content };
}

/** Operation identity of a change whose carrier the replay is asked about. */
const CARRIED_ID = 11;
const OTHER_ID = 12;

const boundary: JournalEntry = { id: "reset-1", type: "reset_boundary" };
const compaction: JournalEntry = { id: "compact-1", type: "compaction" };

function fresh() {
  return replay([]);
}

function withEntry(overrides: Partial<PinRecord> = {}) {
  return replay([stored(record(overrides))]);
}

describe("replay", () => {
  test("starts empty and available on an empty branch", () => {
    const state = fresh();
    expect(state.available).toBe(true);
    expect(state.entries).toEqual([]);
    expect(state.usedBytes).toBe(0);
    expect(state.resetBoundaryEntryId).toBeUndefined();
  });

  test("reads a created entry with its source", () => {
    const state = withEntry({ source: "agent" });
    expect(state.available).toBe(true);
    expect(state.entries).toEqual([{ entryId: 1, revision: 1, body: "maple", source: "agent" }]);
    expect(state.usedBytes).toBe(5);
  });

  test("keeps the creating source when another entry point updates", () => {
    const state = replay([
      stored(record({ source: "user" })),
      stored(record({ operationId: 2, action: "update", revision: 2, body: "oak", source: "agent" })),
    ]);
    expect(state.entries[0]?.source).toBe("user");
    expect(state.entries[0]?.body).toBe("oak");
    expect(state.entries[0]?.revision).toBe(2);
    expect(state.records[1]?.source).toBe("agent");
  });

  test("removes a deleted entry and keeps its identity retired", () => {
    const state = replay([
      stored(record()),
      stored(record({ operationId: 2, action: "delete", revision: 2, body: undefined })),
    ]);
    expect(state.entries).toEqual([]);
    expect(state.usedEntryIds.has(1)).toBe(true);
  });

  test("ignores a repeated operation identity", () => {
    const state = replay([stored(record()), stored(record(), "j-retry")]);
    expect(state.records).toHaveLength(1);
    expect(state.entries).toHaveLength(1);
  });

  test("ignores journal entries that belong to other extensions", () => {
    const foreign: JournalEntry[] = [
      { id: "f-1", type: "custom", customType: "other", data: { anything: true } },
      { id: "f-2", type: "custom_message", customType: "other-change", details: { operationId: 1 } },
      stored(record({ source: "agent" })),
    ];
    const state = replay(foreign);
    expect(state.available).toBe(true);
    expect(state.projectedOperationIds.size).toBe(0);
    expect(state.entries).toHaveLength(1);
  });

  test("does not trust a projection whose text is not the change it names", () => {
    const state = replay([
      stored(record({ source: "agent" })),
      projection(1, {}, "p-1", "Pinned text update from somewhere else."),
    ]);
    expect(state.available).toBe(true);
    expect(state.projectedOperationIds.size).toBe(0);
  });

  test("records projections by operation identity", () => {
    const state = replay([stored(record()), projection(1)]);
    expect(state.projectedOperationIds.has(1)).toBe(true);
  });

  test("holds a change the user confirmed as carried by its own message", () => {
    // The message the host ran for this write is in the range and holds what the
    // user confirmed, so the request needs no second copy of it.
    const state = replay([stored(record({ operationId: CARRIED_ID, source: "user" }))]);
    expect(state.projectedOperationIds.has(CARRIED_ID)).toBe(true);
  });

  test("holds an Agent change as not carried until a projection carries it", () => {
    const state = replay([stored(record({ operationId: CARRIED_ID, source: "agent" }))]);
    expect(state.projectedOperationIds.has(CARRIED_ID)).toBe(false);
  });

  test("reads nothing out of the messages the host holds", () => {
    const plain: JournalEntry[] = [
      { id: "m-user", type: "message", message: { role: "user", content: "a plain message" } },
      { id: "m-none", type: "message" },
      { id: "m-agent", type: "message", message: { role: "assistant", content: "maple" } },
    ];
    const state = replay([stored(record({ operationId: CARRIED_ID, source: "agent" })), ...plain]);
    expect(state.available).toBe(true);
    expect(state.projectedOperationIds.size).toBe(0);
  });

  test("ignores a projection written in another session or period", () => {
    const other: JournalEntry[] = [
      stored(record({ source: "agent" })),
      projection(1, { sessionId: "session-2", periodEntryId: undefined }),
    ];
    expect(replay(other, "session-1").projectedOperationIds.size).toBe(0);
    expect(replay([...other], "session-2").projectedOperationIds.size).toBe(1);

    const ended: JournalEntry[] = [
      stored(record({ source: "agent" })),
      projection(1, { sessionId: "session-1", periodEntryId: "reset-9" }),
    ];
    // The period in force is the boundary this journal reached, not one a
    // carrier names.
    expect(replay(ended, "session-1").projectedOperationIds.size).toBe(0);
  });

  test("keeps a projection written in this session and period", () => {
    const state = replay(
      [
        boundary,
        stored(record({ source: "agent" })),
        projection(1, { sessionId: "session-1", periodEntryId: "reset-1" }),
      ],
      "session-1",
    );
    expect(state.projectedOperationIds.has(1)).toBe(true);
  });

  test("does not trust a projection that names no accepted operation", () => {
    const state = replay([stored(record({ source: "agent" })), projection(3)]);
    expect(state.available).toBe(true);
    expect(state.projectedOperationIds.size).toBe(0);
  });

  test("does not trust a projection that disagrees with its record", () => {
    const cases = [
      projection(1, { entryId: 9 }),
      projection(1, { revision: 2 }),
      projection(1, { action: "delete" }),
      projection(1, { schemaVersion: RECORD_SCHEMA_VERSION + 1 }),
      rawProjection({ schemaVersion: RECORD_SCHEMA_VERSION, operationId: 1, entryId: 1, revision: 1 }),
      rawProjection({ operationId: 1, entryId: 1, revision: 1, action: "create" }),
      rawProjection({
        schemaVersion: RECORD_SCHEMA_VERSION,
        operationId: 1,
        entryId: 1,
        revision: 0,
        action: "create",
      }),
      projection(1, { kind: "bogus" }),
      projection(1, { kind: "change" }),
    ];
    for (const forged of cases) {
      const state = replay([stored(record({ source: "agent" })), forged]);
      expect(state.available).toBe(true);
      expect(state.projectedOperationIds.size).toBe(0);
    }
  });

  test("does not trust a projection that carries no text", () => {
    const details = projection(1).details;
    for (const content of ["", [], 7, null]) {
      const state = replay([stored(record({ source: "agent" })), rawProjection(details, content, "p-empty")]);
      expect(state.projectedOperationIds.size).toBe(0);
      expect(state.available).toBe(true);
    }
  });

  test("reports the same operation identity carrying other content", () => {
    const state = replay([stored(record()), stored(record({ body: "oak" }), "j-retry")]);
    expect(state.available).toBe(false);
    expect(state.problem?.kind).toBe("conflicting-operation");
    expect(state.problem?.detail).toContain("different content");
  });

  test("reports a conflicting reuse of an identity from before a reset", () => {
    const state = replay([stored(record()), boundary, stored(record({ body: "oak" }), "j-after")]);
    expect(state.available).toBe(false);
    expect(state.problem?.kind).toBe("conflicting-operation");
  });

  test("tracks the latest committed compaction boundary", () => {
    const state = replay([stored(record()), compaction, { id: "compact-2", type: "compaction" }]);
    expect(state.compactionBoundary?.entryId).toBe("compact-2");
  });

  test("captures the active set as of the committed boundary", () => {
    const state = replay([
      stored(record()),
      { id: "compact-1", type: "compaction", summary: "host summary" },
      stored(record({ operationId: 2, entryId: 2, body: "birch" }), "j-2"),
    ]);

    expect(state.compactionBoundary?.entryId).toBe("compact-1");
    expect(state.compactionBoundary?.entries.map((entry) => entry.entryId)).toEqual([1]);
    expect(state.compactionBoundary?.recordCount).toBe(1);
    expect(state.compactionBoundary?.summary).toBe("host summary");
    expect(state.entries.map((entry) => entry.entryId)).toEqual([1, 2]);
  });

  test("keeps the boundary set at the time of the commit", () => {
    const state = replay([
      stored(record()),
      { id: "compact-1", type: "compaction" },
      stored(record({ operationId: 2, action: "delete", revision: 2, body: undefined }), "j-2"),
    ]);

    expect(state.entries).toEqual([]);
    expect(state.compactionBoundary?.entries.map((entry) => entry.entryId)).toEqual([1]);
  });

  test("drops everything before a reset boundary", () => {
    const state = replay([
      stored(record()),
      projection(1),
      compaction,
      boundary,
      stored(record({ operationId: 9, entryId: 9, body: "second" }), "j-9"),
    ]);
    expect(state.entries.map((entry) => entry.entryId)).toEqual([9]);
    expect(state.records).toHaveLength(1);
    // The range before the boundary is gone, carried or not; the write of the
    // range after it is held by the message the host ran for it.
    expect(state.projectedOperationIds.has(1)).toBe(false);
    expect(state.projectedOperationIds.has(9)).toBe(true);
    expect(state.compactionBoundary?.entryId).toBeUndefined();
    expect(state.resetBoundaryEntryId).toBe("reset-1");
  });

  test("keeps accepted identities on the ledger across a reset", () => {
    const state = replay([stored(record()), boundary]);
    expect(state.entries).toEqual([]);
    expect(state.records).toEqual([]);
    expect(state.usedEntryIds.has(1)).toBe(true);
    expect(state.acceptedOperations.has(1)).toBe(true);
  });

  test("reads a repeat of a pre-reset operation as the same operation", () => {
    const state = replay([stored(record()), boundary, stored(record(), "j-after")]);
    expect(state.available).toBe(true);
    expect(state.entries).toEqual([]);
    expect(state.records).toEqual([]);
  });

  test("refuses a create that reuses an entry id from before a reset", () => {
    const state = replay([stored(record()), boundary, stored(record({ operationId: 2, body: "oak" }), "j-after")]);
    expect(state.available).toBe(false);
    expect(state.problem?.detail).toContain("reuses the retired entry #1");
  });

  test("reads the range a reset starts when the range before it is damaged", () => {
    const damaged: JournalEntry[] = [
      { id: "j-schema", type: "custom", customType: RECORD_TYPE, data: { ...record(), schemaVersion: 1 } },
      { id: "j-record", type: "custom", customType: RECORD_TYPE, data: { ...record(), operationId: "7" } },
      { id: "j-sequence", type: "custom", customType: RECORD_TYPE, data: record({ revision: 3 }) },
      {
        id: "j-unknown",
        type: "custom",
        customType: RECORD_TYPE,
        data: record({ operationId: 2, action: "delete", revision: 2, body: undefined }),
      },
      { id: "j-conflict", type: "custom", customType: RECORD_TYPE, data: record({ body: "oak" }) },
    ];

    for (const bad of damaged) {
      const state = replay([stored(record()), bad, boundary]);

      expect(state.available).toBe(true);
      expect(state.problem).toBeUndefined();
      expect(state.entries).toEqual([]);
      expect(state.records).toEqual([]);
      expect(state.resetBoundaryEntryId).toBe("reset-1");
      const plan = planCreate(state, { operationId: 3, entryId: 7, body: "birch", source: "user" });
      expect(plan.kind).toBe("append");
    }
  });

  test("keeps the identities it read before a damaged range and no more", () => {
    const state = replay([
      stored(record()),
      { id: "j-bad", type: "custom", customType: RECORD_TYPE, data: {} },
      stored(record({ operationId: 5, entryId: 5, body: "oak" }), "j-5"),
      boundary,
    ]);

    expect(state.available).toBe(true);
    expect(state.acceptedOperations.has(1)).toBe(true);
    expect(state.usedEntryIds.has(1)).toBe(true);
    expect(state.acceptedOperations.has(5)).toBe(false);
    expect(state.usedEntryIds.has(5)).toBe(false);
  });

  test("does not ledger an operation the range before a reset could not apply", () => {
    const gap = record({ operationId: 6, action: "update", revision: 3, body: "oak" });
    const unknown = record({
      operationId: 21,
      action: "delete",
      entryId: 9,
      revision: 2,
      body: undefined,
    });

    for (const bad of [gap, unknown]) {
      // A record the range before the reset could not apply never reaches the
      // ledger.
      const before = replay([stored(record()), stored(bad), boundary]);
      expect(before.available).toBe(true);
      expect(before.acceptedOperations.has(bad.operationId)).toBe(false);

      // The same identity after the reset is a new call, not a retry.
      const again = record({ operationId: bad.operationId, entryId: 2, body: "birch" });
      const state = replay([stored(record()), stored(bad), boundary, stored(again, "j-after")]);

      expect(state.available).toBe(true);
      expect(state.entries.map((entry) => entry.entryId)).toEqual([2]);
      expect(state.records).toEqual([again]);
    }
  });

  test("reports damage inside the range a reset started", () => {
    const state = replay([
      { id: "j-old", type: "custom", customType: RECORD_TYPE, data: { schemaVersion: 1 } },
      boundary,
      stored(record()),
      { id: "j-bad", type: "custom", customType: RECORD_TYPE, data: { ...record(), operationId: "7" } },
    ]);

    expect(state.available).toBe(false);
    expect(state.problem?.kind).toBe("damaged-record");
    expect(state.problem?.entryId).toBe("j-bad");
  });

  test("reads each branch on its own", () => {
    const left = replay([stored(record())]);
    const right = replay([stored(record()), stored(record({ operationId: 2, entryId: 2, body: "birch" }))]);
    expect(left.entries.map((entry) => entry.entryId)).toEqual([1]);
    expect(right.entries.map((entry) => entry.entryId)).toEqual([1, 2]);
  });

  test("reports an unsupported schema version as unavailable", () => {
    const state = replay([
      { id: "j-bad", type: "custom", customType: RECORD_TYPE, data: { ...record(), schemaVersion: 1 } },
    ]);
    expect(state.available).toBe(false);
    expect(state.problem).toEqual({
      kind: "unsupported-schema-version",
      entryId: "j-bad",
      detail: "schemaVersion: expected 2, got 1",
    });
  });

  test("reports a damaged record as unavailable", () => {
    const state = replay([
      stored(record()),
      { id: "j-bad", type: "custom", customType: RECORD_TYPE, data: { ...record(), operationId: "7" } },
    ]);
    expect(state.available).toBe(false);
    expect(state.problem?.kind).toBe("damaged-record");
    expect(state.problem?.entryId).toBe("j-bad");
  });

  test("refuses to skip a revision gap", () => {
    const state = replay([
      stored(record()),
      stored(record({ operationId: 2, action: "update", revision: 3, body: "oak" })),
    ]);
    expect(state.available).toBe(false);
    expect(state.problem?.kind).toBe("illegal-sequence");
    expect(state.problem?.detail).toContain("expected 2");
  });

  test("refuses an operation against an unknown identity", () => {
    const state = replay([
      stored(record({ operationId: 2, action: "delete", entryId: 9, revision: 2, body: undefined })),
    ]);
    expect(state.available).toBe(false);
    expect(state.problem?.kind).toBe("illegal-sequence");
  });

  test("refuses a create that reuses a retired identity", () => {
    const state = replay([
      stored(record()),
      stored(record({ operationId: 2, action: "delete", revision: 2, body: undefined })),
      stored(record({ operationId: 3, entryId: 1 }), "j-3"),
    ]);
    expect(state.available).toBe(false);
    expect(state.problem?.detail).toContain("reuses the retired entry #1");
  });

  test("keeps the accumulated state of a damaged range out of reach", () => {
    const state = replay([stored(record()), { id: "j-bad", type: "custom", customType: RECORD_TYPE, data: {} }]);
    expect(state.available).toBe(false);
    expect(state.entries).toHaveLength(1);
  });
});

describe("summarize", () => {
  test("reports entry identity, a body start, source, revision and bytes", () => {
    const state = replay([
      stored(record({ body: "  maple\n\ngrove  " })),
      stored(record({ operationId: 2, action: "update", revision: 2, body: "é" })),
    ]);
    expect(summarize(state)).toEqual([{ entryId: 1, summary: "é", source: "user", revision: 2, bytes: 2 }]);
  });
});

describe("planCreate", () => {
  test("appends revision 1 and reports the next state", () => {
    const plan = planCreate(fresh(), { operationId: 1, entryId: 1, body: "maple", source: "user" });
    expect(plan.kind).toBe("append");
    if (plan.kind !== "append") throw new Error("expected an append");
    expect(plan.record).toEqual({
      schemaVersion: RECORD_SCHEMA_VERSION,
      operationId: 1,
      action: "create",
      entryId: 1,
      revision: 1,
      body: "maple",
      source: "user",
    });
    expect(plan.next.entries).toHaveLength(1);
    expect(plan.next.records).toHaveLength(1);
  });

  test("creates an independent entry for identical text", () => {
    const state = withEntry();
    const plan = planCreate(state, { operationId: 2, entryId: 2, body: "maple", source: "user" });
    expect(plan.kind).toBe("append");
  });

  test("rejects an empty body", () => {
    const plan = planCreate(fresh(), { operationId: 1, entryId: 1, body: "", source: "user" });
    expect(plan).toEqual({
      kind: "reject",
      error: { code: "empty-body", message: "a pin body must not be empty" },
    });
  });

  test("keeps a whitespace-only body verbatim", () => {
    const plan = planCreate(fresh(), { operationId: 1, entryId: 1, body: "  \n ", source: "agent" });
    expect(plan.kind).toBe("append");
  });

  test("accepts a body of exactly the entry limit", () => {
    const body = "a".repeat(MAX_ENTRY_BYTES);
    const plan = planCreate(fresh(), { operationId: 1, entryId: 1, body, source: "user" });
    expect(plan.kind).toBe("append");
  });

  test("rejects one byte above the entry limit", () => {
    const body = "a".repeat(MAX_ENTRY_BYTES + 1);
    const plan = planCreate(fresh(), { operationId: 1, entryId: 1, body, source: "user" });
    expect(plan.kind).toBe("reject");
    if (plan.kind !== "reject") throw new Error("expected a rejection");
    expect(plan.error.code).toBe("capacity");
    expect(plan.error.capacity).toEqual({
      limit: "entry",
      limitBytes: MAX_ENTRY_BYTES,
      usedBytes: MAX_ENTRY_BYTES + 1,
      bodyBytes: MAX_ENTRY_BYTES + 1,
      currentBytes: 0,
    });
  });

  test("measures multi-byte bodies in UTF-8 bytes", () => {
    const char = "汉"; // three bytes each
    const exact = char.repeat(MAX_ENTRY_BYTES / 3) + "a";
    expect(byteLength(exact)).toBe(MAX_ENTRY_BYTES);
    expect(planCreate(fresh(), { operationId: 1, entryId: 1, body: exact, source: "user" }).kind).toBe("append");

    const over = `${exact}${char}`;
    const plan = planCreate(fresh(), { operationId: 2, entryId: 2, body: over, source: "user" });
    expect(plan.kind).toBe("reject");
  });

  test("rejects a body that overflows the branch total", () => {
    const body = "a".repeat(MAX_ENTRY_BYTES);
    let state = fresh();
    for (let index = 1; index <= MAX_BRANCH_BYTES / MAX_ENTRY_BYTES; index += 1) {
      const plan = planCreate(state, {
        operationId: index,
        entryId: index,
        body,
        source: "user",
      });
      if (plan.kind !== "append") throw new Error(`expected append for ${index}`);
      state = plan.next;
    }
    expect(state.usedBytes).toBe(MAX_BRANCH_BYTES);

    const overflow = planCreate(state, { operationId: 22, entryId: 21, body: "a", source: "user" });
    expect(overflow.kind).toBe("reject");
    if (overflow.kind !== "reject") throw new Error("expected a rejection");
    expect(overflow.error.capacity?.limit).toBe("branch");
    expect(overflow.error.capacity?.usedBytes).toBe(MAX_BRANCH_BYTES + 1);
  });

  test("returns the receipt of a retried operation", () => {
    const state = withEntry();
    const plan = planCreate(state, { operationId: 1, entryId: 1, body: "maple", source: "user" });
    expect(plan.kind).toBe("duplicate");
    if (plan.kind !== "duplicate") throw new Error("expected a duplicate");
    expect(plan.record.entryId).toBe(1);
  });

  test("refuses an identity that was accepted with other content", () => {
    const plan = planCreate(withEntry(), { operationId: 1, entryId: 2, body: "oak", source: "user" });
    expect(plan.kind).toBe("reject");
    if (plan.kind !== "reject") throw new Error("expected a rejection");
    expect(plan.error.code).toBe("conflicting-operation");
  });

  test("returns the receipt of an operation accepted before a reset", () => {
    const state = replay([stored(record()), boundary]);
    const plan = planCreate(state, { operationId: 1, entryId: 1, body: "maple", source: "user" });
    expect(plan.kind).toBe("duplicate");
  });

  test("refuses to reuse an entry identity", () => {
    const plan = planCreate(withEntry(), { operationId: 2, entryId: 1, body: "oak", source: "user" });
    expect(plan.kind).toBe("reject");
    if (plan.kind !== "reject") throw new Error("expected a rejection");
    expect(plan.error.code).toBe("duplicate-entry");
  });

  test("refuses any write while the range is unavailable", () => {
    const damaged = replay([
      { id: "j-bad", type: "custom", customType: RECORD_TYPE, data: { ...record(), source: "robot" } },
    ]);
    const plan = planCreate(damaged, { operationId: 2, entryId: 2, body: "oak", source: "user" });
    expect(plan.kind).toBe("reject");
    if (plan.kind !== "reject") throw new Error("expected a rejection");
    expect(plan.error.code).toBe("state-unavailable");
    expect(plan.error.message).toContain("damaged-record");
  });
});

describe("planUpdate", () => {
  test("returns the receipt of a retried update and refuses another revision from", () => {
    const first = planUpdate(withEntry(), {
      operationId: 2,
      entryId: 1,
      body: "oak",
      source: "user",
      expectedRevision: 1,
    });
    if (first.kind !== "append") throw new Error("expected an append");

    const retry = planUpdate(first.next, {
      operationId: 2,
      entryId: 1,
      body: "oak",
      source: "user",
      expectedRevision: 1,
    });
    expect(retry.kind).toBe("duplicate");

    // The same identity expecting a later revision is a different operation,
    // not a retry of the one this identity was accepted for.
    const other = planUpdate(first.next, {
      operationId: 2,
      entryId: 1,
      body: "oak",
      source: "user",
      expectedRevision: 2,
    });
    expect(other.kind).toBe("reject");
    if (other.kind !== "reject") throw new Error("expected a rejection");
    expect(other.error.code).toBe("conflicting-operation");
  });

  test("advances the revision and keeps the source", () => {
    const state = withEntry({ source: "agent" });
    const plan = planUpdate(state, {
      operationId: 2,
      entryId: 1,
      body: "oak",
      source: "user",
      expectedRevision: 1,
    });
    expect(plan.kind).toBe("append");
    if (plan.kind !== "append") throw new Error("expected an append");
    expect(plan.record.revision).toBe(2);
    expect(plan.record.source).toBe("user");
    expect(plan.next.entries[0]).toEqual({
      entryId: 1,
      revision: 2,
      body: "oak",
      source: "agent",
    });
    expect(plan.next.usedBytes).toBe(3);
  });

  test("reports a body that is already current without appending", () => {
    const state = withEntry();
    const plan = planUpdate(state, {
      operationId: 2,
      entryId: 1,
      body: "maple",
      source: "user",
      expectedRevision: 1,
    });
    expect(plan.kind).toBe("no-change");
  });

  test("rejects a stale revision and reports the current one", () => {
    const state = withEntry();
    const plan = planUpdate(state, {
      operationId: 2,
      entryId: 1,
      body: "oak",
      source: "user",
      expectedRevision: 3,
    });
    expect(plan.kind).toBe("reject");
    if (plan.kind !== "reject") throw new Error("expected a rejection");
    expect(plan.error.code).toBe("stale-revision");
    expect(plan.error.currentRevision).toBe(1);
  });

  test("rejects an unknown identity", () => {
    const plan = planUpdate(withEntry(), {
      operationId: 2,
      entryId: 9,
      body: "oak",
      source: "user",
      expectedRevision: 1,
    });
    expect(plan.kind).toBe("reject");
    if (plan.kind !== "reject") throw new Error("expected a rejection");
    expect(plan.error.code).toBe("unknown-entry");
  });

  test("checks identity and revision before deciding a no-op", () => {
    const state = withEntry();
    const plan = planUpdate(state, {
      operationId: 2,
      entryId: 9,
      body: "maple",
      source: "user",
      expectedRevision: 1,
    });
    expect(plan.kind).toBe("reject");
  });

  test("excludes the replaced body from the branch total", () => {
    const filler = "a".repeat(MAX_ENTRY_BYTES);
    let state = fresh();
    for (let index = 1; index <= 3; index += 1) {
      const plan = planCreate(state, {
        operationId: index,
        entryId: index,
        body: filler,
        source: "user",
      });
      if (plan.kind !== "append") throw new Error("expected an append");
      state = plan.next;
    }
    expect(state.usedBytes).toBe(3 * MAX_ENTRY_BYTES);

    const replaced = "b".repeat(MAX_ENTRY_BYTES);
    const plan = planUpdate(state, {
      operationId: 5,
      entryId: 1,
      body: replaced,
      source: "user",
      expectedRevision: 1,
    });
    expect(plan.kind).toBe("append");

    const tooBig = planUpdate(state, {
      operationId: 23,
      entryId: 1,
      body: "b".repeat(MAX_ENTRY_BYTES + 1),
      source: "user",
      expectedRevision: 1,
    });
    expect(tooBig.kind).toBe("reject");
  });
});

describe("planDelete", () => {
  test("removes the entry and advances the revision", () => {
    const state = withEntry();
    const plan = planDelete(state, { operationId: 2, entryId: 1, source: "agent", expectedRevision: 1 });
    expect(plan.kind).toBe("append");
    if (plan.kind !== "append") throw new Error("expected an append");
    expect(plan.record).toEqual({
      schemaVersion: RECORD_SCHEMA_VERSION,
      operationId: 2,
      action: "delete",
      entryId: 1,
      revision: 2,
      source: "agent",
    });
    expect(plan.next.entries).toEqual([]);
    expect(plan.next.usedBytes).toBe(0);
  });

  test("rejects a stale revision without changing the set", () => {
    const plan = planDelete(withEntry(), { operationId: 2, entryId: 1, source: "agent", expectedRevision: 2 });
    expect(plan.kind).toBe("reject");
    if (plan.kind !== "reject") throw new Error("expected a rejection");
    expect(plan.error.code).toBe("stale-revision");
  });

  test("rejects a second deletion of the same entry", () => {
    const state = withEntry();
    const first = planDelete(state, { operationId: 2, entryId: 1, source: "user", expectedRevision: 1 });
    if (first.kind !== "append") throw new Error("expected an append");
    const second = planDelete(first.next, {
      operationId: 3,
      entryId: 1,
      source: "user",
      expectedRevision: 1,
    });
    expect(second.kind).toBe("reject");
    if (second.kind !== "reject") throw new Error("expected a rejection");
    expect(second.error.code).toBe("unknown-entry");
  });
});
