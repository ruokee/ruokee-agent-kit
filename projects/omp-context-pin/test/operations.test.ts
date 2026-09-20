import { describe, expect, test } from "bun:test";
import { MAX_BRANCH_BYTES_LABEL, MAX_ENTRY_BYTES, MAX_ENTRY_BYTES_LABEL } from "../src/limits.ts";
import type { PinRequest } from "../src/envelope.ts";
import { RECORD_SCHEMA_VERSION, RECORD_TYPE, type PinRecord } from "../src/record.ts";
import { createPin, deletePin, listPins, readPin, updatePin, type PinEnvironment } from "../src/operations.ts";
import type { JournalEntry } from "../src/state.ts";

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

function damage(journal: JournalEntry[], data: unknown) {
  journal.push({ id: "j-bad", type: "custom", customType: RECORD_TYPE, data });
}

describe("createPin", () => {
  test("appends one record, projects it, and reports the entry", () => {
    const { env, journal, delivered } = environment();
    const outcome = createPin(env, { body: "maple", source: "user" });

    expect(outcome.ok).toBe(true);
    expect(outcome.code).toBe("ok");
    expect(outcome.revision).toBe(1);
    expect(outcome.text).toContain("Pinned");
    expect(outcome.text).toContain("5 UTF-8 bytes");
    expect(journal).toHaveLength(1);
    expect(delivered).toHaveLength(1);
    expect(delivered[0]?.body).toBe("maple");
    expect(journal[0]?.data).toEqual({
      schemaVersion: RECORD_SCHEMA_VERSION,
      operationId: 1,
      action: "create",
      entryId: 1,
      revision: 1,
      body: "maple",
      source: "user",
    });
  });

  test("returns the receipt of a retried invocation without appending twice", () => {
    const { env, journal, delivered } = environment();
    const first = createPin(env, { body: "maple", source: "user", operationId: 1 });
    const retry = createPin(env, { body: "maple", source: "user", operationId: 1 });

    expect(first.code).toBe("ok");
    expect(retry.code).toBe("duplicate");
    expect(retry.ok).toBe(true);
    expect(journal).toHaveLength(1);
    expect(delivered).toHaveLength(1);
  });

  test("refuses an empty body without touching the journal", () => {
    const { env, journal, delivered } = environment();
    const outcome = createPin(env, { body: "", source: "user" });

    expect(outcome.ok).toBe(false);
    expect(outcome.code).toBe("rejected");
    expect(outcome.text).toContain("must not be empty");
    expect(journal).toEqual([]);
    expect(delivered).toEqual([]);
  });

  test("reports both limits when a body is over capacity", () => {
    const { env, journal } = environment();
    const outcome = createPin(env, { body: "a".repeat(MAX_ENTRY_BYTES + 1), source: "agent" });

    expect(outcome.code).toBe("rejected");
    expect(outcome.text).toContain(`Limit: ${MAX_ENTRY_BYTES_LABEL} UTF-8 bytes per body.`);
    expect(outcome.text).toContain(
      `This body: ${MAX_ENTRY_BYTES + 1} UTF-8 bytes; other active bodies on this branch: 0 UTF-8 bytes.`,
    );
    expect(journal).toEqual([]);
  });
});

describe("updatePin", () => {
  test("measures a branch overflow against the bodies the operation keeps", () => {
    const { env, journal } = environment();
    const full = "a".repeat(MAX_ENTRY_BYTES);
    for (let index = 1; index <= 3; index += 1) createPin(env, { body: full, source: "user" });
    createPin(env, { body: "b", source: "user" });
    const replaced = createPin(env, { body: "c", source: "user" });
    // 3 * 16,384 + 1 + 1 bytes are active; replacing the last 1-byte body with
    // a full one would reach 65,537 bytes.
    const outcome = updatePin(env, {
      entryId: replaced.entryId ?? 0,
      body: full,
      source: "user",
      expectedRevision: 1,
    });

    expect(outcome.code).toBe("rejected");
    expect(outcome.text).toContain(`Limit: ${MAX_BRANCH_BYTES_LABEL} UTF-8 bytes of active bodies per branch.`);
    expect(outcome.text).toContain(
      `Other active bodies: ${3 * MAX_ENTRY_BYTES + 1} UTF-8 bytes; with this body the branch would hold ${3 * MAX_ENTRY_BYTES + MAX_ENTRY_BYTES + 1} UTF-8 bytes.`,
    );
    // The five creates above; the refused replacement appends nothing.
    expect(journal).toHaveLength(5);
  });

  test("replaces the body and keeps the creating source", () => {
    const { env, journal } = environment();
    const created = createPin(env, { body: "maple", source: "user" });
    const updated = updatePin(env, {
      entryId: created.entryId ?? 0,
      body: "oak",
      source: "agent",
      expectedRevision: 1,
    });

    expect(updated.code).toBe("ok");
    expect(updated.revision).toBe(2);
    expect(journal).toHaveLength(2);

    const listing = listPins(env);
    expect(listing.text).toContain("source user");
    expect(listing.text).toContain("revision 2");
    expect(listing.text).toContain("3 UTF-8 bytes");
  });

  test("reports a body that is already current without appending", () => {
    const { env, journal } = environment();
    const created = createPin(env, { body: "maple", source: "user" });
    const again = updatePin(env, {
      entryId: created.entryId ?? 0,
      body: "maple",
      source: "user",
      expectedRevision: 1,
    });

    expect(again.code).toBe("no-change");
    expect(again.ok).toBe(true);
    expect(journal).toHaveLength(1);
  });

  test("refuses a stale revision and names the current one", () => {
    const { env, journal } = environment();
    const created = createPin(env, { body: "maple", source: "user" });
    const stale = updatePin(env, {
      entryId: created.entryId ?? 0,
      body: "oak",
      source: "user",
      expectedRevision: 4,
    });

    expect(stale.code).toBe("rejected");
    expect(stale.text).toContain("Current revision: 1");
    expect(journal).toHaveLength(1);
  });

  test("refuses an unknown identity", () => {
    const { env } = environment();
    const outcome = updatePin(env, { entryId: 404, body: "oak", source: "agent", expectedRevision: 1 });
    expect(outcome.text).toContain("no active pin entry");
  });
});

describe("deletePin", () => {
  test("removes the entry and reports the new revision", () => {
    const { env, journal, delivered } = environment();
    const created = createPin(env, { body: "maple", source: "user" });
    const removed = deletePin(env, { entryId: created.entryId ?? 0, source: "user", expectedRevision: 1 });

    expect(removed.code).toBe("ok");
    expect(removed.text).toContain("Unpinned");
    expect(journal).toHaveLength(2);
    expect(delivered[1]?.action).toBe("delete");
    expect(listPins(env).text).toContain("No pinned text");
  });

  test("refuses a second deletion of the same entry", () => {
    const { env, journal } = environment();
    const created = createPin(env, { body: "maple", source: "user" });
    deletePin(env, { entryId: created.entryId ?? 0, source: "user", expectedRevision: 1 });
    const again = deletePin(env, { entryId: created.entryId ?? 0, source: "user", expectedRevision: 2 });

    expect(again.code).toBe("rejected");
    expect(journal).toHaveLength(2);
  });
});

describe("reads", () => {
  test("lists nothing for an empty branch", () => {
    const { env } = environment();
    expect(listPins(env).text).toBe(`No pinned text on this branch (0 of 65,536 UTF-8 bytes).`);
  });

  test("returns the body verbatim with its metadata", () => {
    const { env } = environment();
    const body = "引用标题：完整性样本\n\n结束标签：</pin>";
    const created = createPin(env, { body, source: "user" });
    const read = readPin(env, created.entryId ?? 0);

    expect(read.ok).toBe(true);
    expect(read.text).toContain(body);
    expect(read.text).toContain(`Entry: #${created.entryId}`);
  });

  test("refuses an unknown identity", () => {
    const { env } = environment();
    const read = readPin(env, 404);
    expect(read.ok).toBe(false);
    expect(read.text).toContain("No active pin entry");
  });
});

describe("damaged and unreadable ranges", () => {
  test("refuses writes and reads once a record is damaged", () => {
    const { env, journal, delivered } = environment();
    createPin(env, { body: "maple", source: "user" });
    damage(journal, null);

    for (const outcome of [
      createPin(env, { body: "oak", source: "user" }),
      updatePin(env, { entryId: 2, body: "oak", source: "user", expectedRevision: 1 }),
      deletePin(env, { entryId: 2, source: "user", expectedRevision: 1 }),
      listPins(env),
      readPin(env, 2),
    ]) {
      expect(outcome.ok).toBe(false);
      expect(outcome.code).toBe("unavailable");
      expect(outcome.text).toContain("unavailable");
    }
    expect(journal).toHaveLength(2);
    expect(delivered).toHaveLength(1);
  });

  test("reports an unreadable journal", () => {
    const { env } = environment({
      reader: {
        getBranch: () => {
          throw new Error("session closed");
        },
      },
    });
    const outcome = listPins(env);
    expect(outcome.code).toBe("unreadable");
    expect(outcome.text).toContain("session closed");
  });

  test("does not revive an entry whose deletion record is damaged", () => {
    const { env, journal } = environment();
    const created = createPin(env, { body: "maple", source: "user" });
    deletePin(env, { entryId: created.entryId ?? 0, source: "user", expectedRevision: 1 });
    const record = journal[1]?.data as PinRecord;
    journal[1] = { id: "j-2", type: "custom", customType: RECORD_TYPE, data: { ...record, revision: 9 } };

    const outcome = readPin(env, created.entryId ?? 0);
    expect(outcome.ok).toBe(false);
    expect(outcome.code).toBe("unavailable");
  });
});
