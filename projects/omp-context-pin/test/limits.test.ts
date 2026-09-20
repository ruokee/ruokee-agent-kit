import { describe, expect, test } from "bun:test";
import { MAX_BRANCH_BYTES, MAX_ENTRY_BYTES, byteLength, checkCapacity } from "../src/limits.ts";

describe("byteLength", () => {
  test("counts UTF-8 bytes, not characters", () => {
    expect(byteLength("abc")).toBe(3);
    expect(byteLength("中")).toBe(3);
    expect(byteLength("é")).toBe(2);
    expect(byteLength("🙂")).toBe(4);
  });
});

describe("checkCapacity", () => {
  test("declares the documented limits", () => {
    expect(MAX_ENTRY_BYTES).toBe(16_384);
    expect(MAX_BRANCH_BYTES).toBe(65_536);
  });

  test("accepts bodies inside both limits", () => {
    expect(checkCapacity("a".repeat(MAX_ENTRY_BYTES), 0)).toBeUndefined();
    expect(checkCapacity("a".repeat(MAX_ENTRY_BYTES), MAX_BRANCH_BYTES - MAX_ENTRY_BYTES)).toBeUndefined();
  });

  test("reports one byte over the entry limit before the branch limit", () => {
    expect(checkCapacity("a".repeat(MAX_ENTRY_BYTES + 1), 10)).toEqual({
      limit: "entry",
      limitBytes: MAX_ENTRY_BYTES,
      usedBytes: MAX_ENTRY_BYTES + 1,
      bodyBytes: MAX_ENTRY_BYTES + 1,
      currentBytes: 10,
    });
  });

  test("reports the branch limit with the projected total and the current usage", () => {
    const body = "a".repeat(100);
    expect(checkCapacity(body, MAX_BRANCH_BYTES - 99)).toEqual({
      limit: "branch",
      limitBytes: MAX_BRANCH_BYTES,
      usedBytes: MAX_BRANCH_BYTES + 1,
      bodyBytes: 100,
      currentBytes: MAX_BRANCH_BYTES - 99,
    });
  });

  test("measures multi-byte bodies in bytes", () => {
    const body = "中".repeat(MAX_ENTRY_BYTES / 3 + 1);
    const bodyBytes = byteLength(body);
    expect(bodyBytes).toBeGreaterThan(MAX_ENTRY_BYTES);
    expect(checkCapacity(body, 0)).toMatchObject({ limit: "entry", usedBytes: bodyBytes });
  });
});
