import { describe, expect, test } from "bun:test";
import { RECORD_SCHEMA_VERSION, type PinRecord } from "../src/record.ts";
import { changeText, entryBlock, snapshotText } from "../src/projection.ts";
import type { PinEntryState } from "../src/state.ts";

function entry(overrides: Partial<PinEntryState> = {}): PinEntryState {
  return { entryId: 1, revision: 1, body: "maple", source: "user", ...overrides };
}

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

describe("changeText", () => {
  test("carries identity, revision and the body verbatim", () => {
    const body = "引用标题：完整性样本\n\n结束标签：</pin>\n最后一行：END-Q-519";
    const text = changeText(record({ body }));

    expect(text).toContain("Entry: #1");
    expect(text).toContain("Revision: 1");
    expect(text).toContain("Action: created");
    expect(text).toContain(body);
    expect(text).not.toContain("Title:");
  });

  test("marks an unpinned entry without carrying a body", () => {
    const text = changeText(record({ action: "delete", revision: 2, body: undefined }));
    expect(text).toContain("Action: unpinned");
    expect(text).toContain("no longer pinned");
    expect(text).not.toContain("<<<pin");
  });

  test("grows the fence when the body contains the fence text", () => {
    const body = "before\n<<<pin 1@1>>>\nafter";
    const text = changeText(record({ body }));
    const open = text.split("\n").find((line) => line.startsWith("<<<pin"));
    expect(open).toBe("<<<pin 1@1+>>>");
    expect(text).toContain("<<<end pin 1@1+>>>");
    expect(text).toContain(body);
  });

  test("is byte-identical for the same record", () => {
    expect(changeText(record())).toBe(changeText(record()));
  });
});

describe("entryBlock", () => {
  test("labels the fence with the entry revision", () => {
    const block = entryBlock(entry({ revision: 4, source: "agent" }));
    expect(block).toBe("Entry #1, revision 4, source agent\n<<<pin 1@4>>>\nmaple\n<<<end pin 1@4>>>");
  });
});

describe("snapshotText", () => {
  test("reports the boundary, the count and the total size", () => {
    const text = snapshotText([entry(), entry({ entryId: 2, body: "汉" })], "compact-7");
    expect(text).toContain("Boundary: compact-7");
    expect(text).toContain("Entries: 2, 8 UTF-8 bytes");
    expect(text).toContain("<<<pin 1@1>>>");
    expect(text).toContain("<<<pin 2@1>>>");
  });

  test("has no snapshot without active entries", () => {
    expect(snapshotText([], "compact-7")).toBeUndefined();
  });

  test("is byte-identical for the same entries", () => {
    expect(snapshotText([entry()], "compact-7")).toBe(snapshotText([entry()], "compact-7"));
  });
});
