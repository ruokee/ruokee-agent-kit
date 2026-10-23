import { describe, expect, test } from "bun:test";
import { MAX_BRANCH_BYTES, MAX_ENTRY_BYTES, byteLength, checkCapacity } from "../../src/pin/limits.ts";

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
    expect(MAX_BRANCH_BYTES).toBe(16_384);
  });

  test("accepts bodies inside both limits", () => {
    expect(checkCapacity("a".repeat(MAX_ENTRY_BYTES), 0, 0)).toBeUndefined();
    expect(checkCapacity("a".repeat(MAX_ENTRY_BYTES), MAX_BRANCH_BYTES, MAX_ENTRY_BYTES)).toBeUndefined();
  });

  test("reports one byte over the entry limit before the branch limit", () => {
    expect(checkCapacity("a".repeat(MAX_ENTRY_BYTES + 1), 10, 4)).toEqual({
      limit: "entry",
      limitBytes: MAX_ENTRY_BYTES,
      currentBytes: 10,
      replacedBytes: 4,
      bodyBytes: MAX_ENTRY_BYTES + 1,
      attemptedBytes: 10 - 4 + MAX_ENTRY_BYTES + 1,
      excessBytes: 1,
    });
  });

  test("reports the branch limit with the current branch and the attempted total", () => {
    const body = "a".repeat(100);
    expect(checkCapacity(body, MAX_BRANCH_BYTES - 99, 0)).toEqual({
      limit: "branch",
      limitBytes: MAX_BRANCH_BYTES,
      currentBytes: MAX_BRANCH_BYTES - 99,
      replacedBytes: 0,
      bodyBytes: 100,
      attemptedBytes: MAX_BRANCH_BYTES + 1,
      excessBytes: 1,
    });
  });

  test("subtracts the replaced body from the branch attempt", () => {
    const current = MAX_BRANCH_BYTES;
    const replaced = 100;
    expect(checkCapacity("a".repeat(replaced), current, replaced)).toBeUndefined();
    expect(checkCapacity("a".repeat(replaced + 1), current, replaced)).toMatchObject({
      limit: "branch",
      currentBytes: current,
      replacedBytes: replaced,
      bodyBytes: replaced + 1,
      attemptedBytes: MAX_BRANCH_BYTES + 1,
      excessBytes: 1,
    });
  });

  test("measures multi-byte bodies in bytes", () => {
    const body = "中".repeat(MAX_ENTRY_BYTES / 3 + 1);
    const bodyBytes = byteLength(body);
    expect(bodyBytes).toBeGreaterThan(MAX_ENTRY_BYTES);
    expect(checkCapacity(body, 0, 0)).toMatchObject({
      limit: "entry",
      bodyBytes,
      excessBytes: bodyBytes - MAX_ENTRY_BYTES,
    });
  });
});
