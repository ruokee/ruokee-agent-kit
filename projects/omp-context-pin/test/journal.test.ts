import { describe, expect, test } from "bun:test";
import { type RawEntry, orderBranch, readJournal, readSession } from "../src/journal.ts";

function entry(id: string, parentId?: string, extra: Record<string, unknown> = {}) {
  return { id, parentId, type: "custom", customType: "omp-context-pin", ...extra };
}

function ids(ordered: RawEntry[] | string): string[] | string {
  return typeof ordered === "string" ? ordered : ordered.map((item) => item.id);
}

describe("orderBranch", () => {
  test("keeps an already root-first branch", () => {
    const branch = [entry("a"), entry("b", "a"), entry("c", "b")];
    expect(ids(orderBranch(branch))).toEqual(["a", "b", "c"]);
  });

  test("reverses a leaf-first branch", () => {
    const branch = [entry("c", "b"), entry("b", "a"), entry("a")];
    expect(ids(orderBranch(branch))).toEqual(["a", "b", "c"]);
  });

  test("reports a fork instead of guessing a path through it", () => {
    const branch = [entry("a"), entry("b", "a"), entry("c", "a")];
    expect(ids(orderBranch(branch))).toBe("branch forks at a");
  });

  test("reports separate starting entries when the branch links them", () => {
    const branch = [entry("a"), entry("b", "a"), entry("c")];
    expect(ids(orderBranch(branch))).toBe("branch has 2 starting entries instead of one");
  });

  test("keeps the order of a branch that carries no links", () => {
    const branch = [entry("a"), entry("b"), entry("c")];
    expect(ids(orderBranch(branch))).toEqual(["a", "b", "c"]);
  });

  test("reports a repeated entry id", () => {
    const branch = [entry("a"), entry("a")];
    expect(ids(orderBranch(branch))).toBe("branch contains the entry id a twice");
  });

  test("reports a parent cycle", () => {
    const branch = [entry("a", "b"), entry("b", "a")];
    expect(typeof ids(orderBranch(branch))).toBe("string");
  });

  test("handles an empty or single-entry branch", () => {
    expect(orderBranch([])).toEqual([]);
    expect(ids(orderBranch([entry("a")]))).toEqual(["a"]);
  });
});

describe("readJournal", () => {
  test("carries the fields replay reads and drops unknown ones", () => {
    const reader = {
      getBranch: () => [entry("a", undefined, { data: { action: "create" }, extra: "ignored" })],
    };
    const read = readJournal(reader);
    expect(read.ok).toBe(true);
    if (!read.ok) throw new Error("expected a readable branch");
    expect(read.entries).toEqual([
      { id: "a", type: "custom", customType: "omp-context-pin", data: { action: "create" } },
    ]);
  });

  test("carries message content, because replay checks that a projection has text", () => {
    const read = readJournal({
      getBranch: () => [entry("a", undefined, { type: "custom_message", content: "pinned text" })],
    });
    expect(read.ok).toBe(true);
    if (!read.ok) throw new Error("expected a readable branch");
    expect(read.entries[0]?.content).toBe("pinned text");
  });

  test("reports a branch that cannot be read instead of an empty journal", () => {
    const read = readJournal({
      getBranch: () => {
        throw new Error("session closed");
      },
    });
    expect(read.ok).toBe(false);
    if (read.ok) throw new Error("expected a failure");
    expect(read.detail).toContain("session closed");
  });

  test("reports a host value that is not an array", () => {
    const read = readJournal({ getBranch: () => "nope" as unknown as readonly unknown[] });
    expect(read.ok).toBe(false);
  });

  test("reports a value that is not an entry instead of skipping it", () => {
    const read = readJournal({ getBranch: () => [entry("a"), null, 7, { type: "custom" }] });
    expect(read.ok).toBe(false);
    if (read.ok) throw new Error("expected a failure");
    expect(read.detail).toBe("entry 1 is not a session entry");
  });

  test("reports a branch that is not one path instead of replaying it", () => {
    const read = readJournal({ getBranch: () => [entry("a"), entry("b", "a"), entry("c", "a")] });
    expect(read.ok).toBe(false);
    if (read.ok) throw new Error("expected a failure");
    expect(read.detail).toBe("branch forks at a");
  });
});

describe("readSession", () => {
  test("reads every entry the host offers", () => {
    const read = readSession({ getBranch: () => [], getEntries: () => [entry("a"), entry("b")] });

    expect(read.ok).toBe(true);
    if (!read.ok) throw new Error("expected a successful read");
    expect(read.entries.map((item) => item.id)).toEqual(["a", "b"]);
  });

  test("keeps the host order, which need not be one branch", () => {
    const read = readSession({ getBranch: () => [], getEntries: () => [entry("b", "a"), entry("a")] });

    expect(read.ok).toBe(true);
    if (!read.ok) throw new Error("expected a successful read");
    expect(read.entries.map((item) => item.id)).toEqual(["b", "a"]);
  });

  test("reports a host that does not expose every entry", () => {
    const read = readSession({ getBranch: () => [] });

    expect(read.ok).toBe(false);
    if (read.ok) throw new Error("expected a failure");
    expect(read.detail).toBe("the host does not expose every session entry");
  });

  test("reports a session that cannot be read", () => {
    const read = readSession({
      getBranch: () => [],
      getEntries: () => {
        throw new Error("session closed");
      },
    });

    expect(read.ok).toBe(false);
    if (read.ok) throw new Error("expected a failure");
    expect(read.detail).toContain("session closed");
  });

  test("reports a host value that is not an array", () => {
    const read = readSession({ getBranch: () => [], getEntries: () => "nope" as unknown as readonly unknown[] });

    expect(read.ok).toBe(false);
    if (read.ok) throw new Error("expected a failure");
    expect(read.detail).toBe("getEntries did not return an array");
  });

  test("reports a value that is not an entry instead of skipping it", () => {
    const read = readSession({ getBranch: () => [], getEntries: () => [entry("a"), null] });

    expect(read.ok).toBe(false);
    if (read.ok) throw new Error("expected a failure");
    expect(read.detail).toBe("entry 1 is not a session entry");
  });
});
