import { describe, expect, test } from "bun:test";
import {
  MAX_BRANCH_BYTES,
  MAX_BRANCH_BYTES_LABEL,
  MAX_ENTRY_BYTES,
  MAX_ENTRY_BYTES_LABEL,
  byteLength,
} from "../src/limits.ts";
import type { PinRequest } from "../src/envelope.ts";
import { RECORD_SCHEMA_VERSION, RECORD_TYPE, type PinRecord } from "../src/record.ts";
import {
  createPin,
  deletePin,
  listPins,
  readPin,
  showPins,
  updatePin,
  type PinEnvironment,
} from "../src/operations.ts";
import type { JournalEntry } from "../src/state.ts";

function environment(overrides: Partial<PinEnvironment> = {}) {
  const journal: JournalEntry[] = [];
  const delivered: PinRecord[] = [];
  const submitted: PinRequest[] = [];
  const outcomes: string[] = [];
  let operationCounter = 0;
  let entryCounter = 0;
  const env: PinEnvironment = {
    reader: { getBranch: () => journal, getEntries: () => journal },
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

  test("reports the entry limit with the body size and excess", () => {
    const { env, journal } = environment();
    const outcome = createPin(env, { body: "a".repeat(MAX_ENTRY_BYTES + 1), source: "agent" });

    expect(outcome.code).toBe("rejected");
    expect(outcome.text).toContain(`exceeding the ${MAX_ENTRY_BYTES_LABEL}-byte entry limit by 1 B`);
    expect(outcome.text).toContain("Nothing was written.");
    expect(outcome.text).toContain(`The branch limit of ${MAX_BRANCH_BYTES_LABEL} UTF-8 bytes still applies.`);
    expect(outcome.text).toContain("Splitting the same text across entries does not reduce branch usage.");
    expect(journal).toEqual([]);
  });

  test("reports a new body that would overflow the branch", () => {
    const { env, journal } = environment();
    const half = "a".repeat(MAX_ENTRY_BYTES / 2);
    createPin(env, { body: half, source: "user" });
    createPin(env, { body: half, source: "user" });
    const outcome = createPin(env, { body: "b".repeat(MAX_ENTRY_BYTES), source: "agent" });

    expect(outcome.code).toBe("rejected");
    expect(outcome.text).toContain(
      `Current branch: ${MAX_BRANCH_BYTES} B; new entry: 0 B; proposed body: ${MAX_ENTRY_BYTES} B.`,
    );
    expect(outcome.text).toContain(`exceeding the branch limit by ${MAX_ENTRY_BYTES} B`);
    expect(outcome.text).toContain("Nothing was written.");
    expect(outcome.text).toContain("Review the whole active pin set.");
    expect(outcome.text).toContain("Moving text between entries does not reduce active bytes.");
    expect(journal).toHaveLength(2);
  });
});

describe("updatePin", () => {
  test("measures a branch overflow against the bodies the operation keeps", () => {
    const { env, journal } = environment();
    const half = "a".repeat(MAX_ENTRY_BYTES / 2);
    createPin(env, { body: half, source: "user" });
    const replaced = createPin(env, { body: half, source: "user" });
    // The two half bodies fill the branch; replacing the last one with a full
    // body stays inside the entry limit and still overflows the branch.
    const outcome = updatePin(env, {
      entryId: replaced.entryId ?? 0,
      body: "a".repeat(MAX_ENTRY_BYTES),
      source: "user",
    });

    expect(outcome.code).toBe("rejected");
    expect(outcome.text).toContain(
      `Current branch: ${MAX_BRANCH_BYTES} B; replacing #${replaced.entryId}: ${MAX_ENTRY_BYTES / 2} B; proposed body: ${MAX_ENTRY_BYTES} B.`,
    );
    expect(outcome.text).toContain(`exceeding the branch limit by ${MAX_ENTRY_BYTES / 2} B`);
    expect(outcome.text).toContain("Nothing was written.");
    expect(outcome.text).toContain("Review the whole active pin set.");
    expect(outcome.text).toContain("Moving text between entries does not reduce active bytes.");
    // The two creates above; the refused replacement appends nothing.
    expect(journal).toHaveLength(2);
  });

  test("replaces the body and keeps the creating source", () => {
    const { env, journal } = environment();
    const created = createPin(env, { body: "maple", source: "user" });
    const updated = updatePin(env, {
      entryId: created.entryId ?? 0,
      body: "oak",
      source: "agent",
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
    });

    expect(again.code).toBe("no-change");
    expect(again.ok).toBe(true);
    expect(journal).toHaveLength(1);
  });

  test("updates the current entry after another write advances its revision", () => {
    const { env, journal } = environment();
    const created = createPin(env, { body: "maple", source: "user", operationId: 1 });
    const first = updatePin(env, {
      entryId: created.entryId ?? 0,
      body: "spruce",
      source: "agent",
      operationId: 2,
    });
    const current = updatePin(env, {
      entryId: created.entryId ?? 0,
      body: "cedar",
      source: "user",
      operationId: 3,
    });

    expect(first.revision).toBe(2);
    expect(current.revision).toBe(3);
    expect(journal).toHaveLength(3);
    expect(journal.at(-1)?.data).toMatchObject({ body: "cedar" });
  });

  test("returns the accepted update after a later update without appending", () => {
    const { env, journal, delivered } = environment();
    const created = createPin(env, { body: "maple", source: "user", operationId: 1 });
    updatePin(env, { entryId: created.entryId ?? 0, body: "oak", source: "agent", operationId: 2 });
    updatePin(env, { entryId: created.entryId ?? 0, body: "cedar", source: "agent", operationId: 3 });
    const retry = updatePin(env, {
      entryId: created.entryId ?? 0,
      body: "oak",
      source: "agent",
      operationId: 2,
    });

    expect(retry.code).toBe("duplicate");
    expect(journal).toHaveLength(3);
    expect(delivered).toHaveLength(3);
    expect(listPins(env).text).toContain("cedar");
  });

  test("rejects the same operation identity with a different body", () => {
    const { env, journal } = environment();
    const created = createPin(env, { body: "maple", source: "user", operationId: 1 });
    updatePin(env, { entryId: created.entryId ?? 0, body: "oak", source: "agent", operationId: 2 });
    const conflict = updatePin(env, {
      entryId: created.entryId ?? 0,
      body: "cedar",
      source: "agent",
      operationId: 2,
    });

    expect(conflict.code).toBe("rejected");
    expect(conflict.text).toContain("already accepted");
    expect(journal).toHaveLength(2);
  });

  test("refuses an unknown identity", () => {
    const { env } = environment();
    const outcome = updatePin(env, { entryId: 404, body: "oak", source: "agent" });
    expect(outcome.text).toContain("no active pin entry");
  });
});

describe("deletePin", () => {
  test("removes the entry and reports the new revision", () => {
    const { env, journal, delivered } = environment();
    const created = createPin(env, { body: "maple", source: "user" });
    const removed = deletePin(env, { entryId: created.entryId ?? 0, source: "user" });

    expect(removed.code).toBe("ok");
    expect(removed.text).toContain("Unpinned");
    expect(journal).toHaveLength(2);
    expect(delivered[1]?.action).toBe("delete");
    expect(listPins(env).text).toContain("No pinned text");
  });

  test("removes the current entry after another write advances its revision", () => {
    const { env, journal } = environment();
    const created = createPin(env, { body: "maple", source: "user", operationId: 1 });
    updatePin(env, { entryId: created.entryId ?? 0, body: "oak", source: "agent", operationId: 2 });
    const removed = deletePin(env, { entryId: created.entryId ?? 0, source: "user", operationId: 3 });

    expect(removed.code).toBe("ok");
    expect(removed.revision).toBe(3);
    expect(journal).toHaveLength(3);
  });

  test("returns an accepted delete retry after the entry is gone", () => {
    const { env, journal, delivered } = environment();
    const created = createPin(env, { body: "maple", source: "user", operationId: 1 });
    deletePin(env, { entryId: created.entryId ?? 0, source: "user", operationId: 2 });
    const retry = deletePin(env, { entryId: created.entryId ?? 0, source: "user", operationId: 2 });

    expect(retry.code).toBe("duplicate");
    expect(retry.ok).toBe(true);
    expect(journal).toHaveLength(2);
    expect(delivered).toHaveLength(2);
  });

  test("refuses a second deletion of the same entry with a new identity", () => {
    const { env, journal } = environment();
    const created = createPin(env, { body: "maple", source: "user", operationId: 1 });
    deletePin(env, { entryId: created.entryId ?? 0, source: "user", operationId: 2 });
    const again = deletePin(env, { entryId: created.entryId ?? 0, source: "user", operationId: 3 });

    expect(again.code).toBe("rejected");
    expect(journal).toHaveLength(2);
  });
});

describe("reads", () => {
  test("lists nothing for an empty branch", () => {
    const { env } = environment();
    expect(listPins(env).text).toBe(`No pinned text on this branch (0 of ${MAX_BRANCH_BYTES_LABEL} UTF-8 bytes).`);
  });

  test("shows every active body without changing the journal or delivery", () => {
    const { env, journal, delivered } = environment();
    const first = "first\nbody";
    const second = "second\n<<<pin 1@1>>>";
    createPin(env, { body: first, source: "user", operationId: 1 });
    createPin(env, { body: second, source: "agent", operationId: 2 });
    const journalLength = journal.length;
    const deliveredLength = delivered.length;

    const shown = showPins(env);

    expect(shown.ok).toBe(true);
    expect(shown.text).toContain("2 pinned entries");
    expect(shown.text).toContain(
      `${byteLength(first) + byteLength(second)} UTF-8 bytes active of ${MAX_BRANCH_BYTES_LABEL}`,
    );
    expect(shown.text).toContain(first);
    expect(shown.text).toContain(second);
    expect(shown.text).toContain("Entry #1, revision 1, source user");
    expect(shown.text).toContain("Entry #2, revision 1, source agent");
    expect(shown.text).toContain(`Size: ${byteLength(first)} UTF-8 bytes`);
    expect(journal).toHaveLength(journalLength);
    expect(delivered).toHaveLength(deliveredLength);
  });

  test("shows the empty branch state", () => {
    const { env } = environment();
    expect(showPins(env).text).toBe(`No pinned text on this branch (0 of ${MAX_BRANCH_BYTES_LABEL} UTF-8 bytes).`);
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
      updatePin(env, { entryId: 2, body: "oak", source: "user" }),
      deletePin(env, { entryId: 2, source: "user" }),
      listPins(env),
      showPins(env),
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
        getEntries: () => [],
      },
    });
    const outcome = listPins(env);
    expect(outcome.code).toBe("unreadable");
    expect(outcome.text).toContain("session closed");
  });

  test("does not revive an entry whose deletion record is damaged", () => {
    const { env, journal } = environment();
    const created = createPin(env, { body: "maple", source: "user" });
    deletePin(env, { entryId: created.entryId ?? 0, source: "user" });
    const record = journal[1]?.data as PinRecord;
    journal[1] = { id: "j-2", type: "custom", customType: RECORD_TYPE, data: { ...record, revision: 9 } };

    const outcome = readPin(env, created.entryId ?? 0);
    expect(outcome.ok).toBe(false);
    expect(outcome.code).toBe("unavailable");
  });
});
