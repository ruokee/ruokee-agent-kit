import { describe, expect, test } from "bun:test";
import {
  RECORD_SCHEMA_VERSION,
  RECORD_TYPE,
  outcomeDetails,
  parseOutcomeDetails,
  parseRecord,
  type PinRecord,
} from "../src/record.ts";

const BASE: PinRecord = {
  schemaVersion: RECORD_SCHEMA_VERSION,
  operationId: 1,
  action: "create",
  entryId: 1,
  revision: 1,
  body: "keep this verbatim",
  source: "user",
};

describe("parseRecord", () => {
  test("reads a create, an update, and a delete", () => {
    // A field this version does not write is ignored, so a record an older
    // version wrote is still read.
    expect(parseRecord({ ...BASE, title: "interface" })).toEqual({ ok: true, record: { ...BASE } });
    expect(parseRecord({ ...BASE, action: "update", revision: 2 })).toEqual({
      ok: true,
      record: { ...BASE, action: "update", revision: 2 },
    });
    const deleteRecord: PinRecord = { ...BASE, action: "delete", revision: 3 };
    delete deleteRecord.body;
    expect(parseRecord(deleteRecord)).toMatchObject({
      ok: true,
      record: { action: "delete", entryId: 1, revision: 3, body: undefined },
    });
  });

  test("keeps body characters and whitespace unchanged", () => {
    const body = "  line one\n\tline two  \n";
    const parsed = parseRecord({ ...BASE, body });
    expect(parsed.ok && parsed.record.body).toBe(body);
  });

  test("accepts an empty stored body", () => {
    expect(parseRecord({ ...BASE, body: "" }).ok).toBe(true);
  });

  test("ignores fields it does not write", () => {
    expect(parseRecord({ ...BASE, futureField: 42 }).ok).toBe(true);
  });

  test("reports a value that is not an object", () => {
    for (const value of [null, undefined, "record", 7, []]) {
      expect(parseRecord(value)).toMatchObject({ ok: false, problem: "not-an-object", field: "record" });
    }
  });

  test("reports an unsupported payload version", () => {
    for (const schemaVersion of [undefined, 0, 1, "2"]) {
      expect(parseRecord({ ...BASE, schemaVersion })).toMatchObject({
        ok: false,
        problem: "unsupported-schema-version",
        field: "schemaVersion",
      });
    }
  });

  test("reports an invalid field with its name", () => {
    const cases: [string, Record<string, unknown>][] = [
      ["operationId", { operationId: 0 }],
      ["operationId", { operationId: "7" }],
      ["entryId", { entryId: "1" }],
      ["revision", { revision: 0 }],
      ["revision", { revision: 1.5 }],
      ["revision", { revision: "2" }],
      ["revision", { revision: Number.MAX_SAFE_INTEGER + 1 }],
      ["revision", { revision: Number.NaN }],
      ["revision", { revision: Number.POSITIVE_INFINITY }],
      ["action", { action: "upsert" }],
      ["action", { action: "constructor" }],
      ["action", { action: "__proto__" }],
      ["source", { source: "extension" }],
      ["source", { source: "toString" }],
      ["source", { source: "valueOf" }],
      ["body", { body: null }],
      ["body", { body: 0 }],
    ];
    for (const [field, override] of cases) {
      expect(parseRecord({ ...BASE, ...override })).toMatchObject({ ok: false, problem: "invalid-field", field });
    }
  });

  test("does not read inherited keys as actions or sources", () => {
    for (const key of ["constructor", "toString", "hasOwnProperty", "__proto__"]) {
      expect(parseRecord({ ...BASE, action: key })).toMatchObject({ ok: false, field: "action" });
      expect(parseRecord({ ...BASE, source: key })).toMatchObject({ ok: false, field: "source" });
    }
  });

  test("requires a body for writes and forbids one for deletes", () => {
    const withoutBody = { ...BASE };
    delete (withoutBody as { body?: string }).body;
    expect(parseRecord(withoutBody)).toMatchObject({ ok: false, problem: "invalid-field", field: "body" });

    expect(parseRecord({ ...BASE, action: "delete" })).toMatchObject({
      ok: false,
      problem: "invalid-field",
      field: "body",
    });
  });

  test("keeps a bounded diagnostic for long values", () => {
    const failure = parseRecord({ ...BASE, action: "x".repeat(5000) });
    expect(failure).toMatchObject({ ok: false, problem: "invalid-field", field: "action" });
    expect(failure.ok === false && failure.detail).toContain("5000-character string");

    const functionFailure = parseRecord({ ...BASE, action: () => undefined });
    expect(functionFailure.ok === false && functionFailure.detail).toContain("a function");
  });
});

describe("record constants", () => {
  test("use the documented journal type and version", () => {
    expect(RECORD_TYPE).toBe("omp-context-pin");
    expect(RECORD_SCHEMA_VERSION).toBe(2);
  });
});

describe("outcome metadata", () => {
  test("round-trips through the reader this component writes with", () => {
    expect(parseOutcomeDetails(outcomeDetails(1))).toEqual({
      schemaVersion: RECORD_SCHEMA_VERSION,
      kind: "outcome",
      operationId: 1,
    });
  });

  test("refuses anything else this component did not write", () => {
    expect(parseOutcomeDetails(undefined)).toBeUndefined();
    expect(parseOutcomeDetails("outcome")).toBeUndefined();
    expect(parseOutcomeDetails({ ...outcomeDetails(1), schemaVersion: 1 })).toBeUndefined();
    // A change projection and the base snapshot carry their own kind.
    expect(parseOutcomeDetails({ schemaVersion: 1, operationId: 1, entryId: 1 })).toBeUndefined();
    expect(parseOutcomeDetails({ schemaVersion: 1, operationId: 1, kind: "snapshot" })).toBeUndefined();
    expect(parseOutcomeDetails({ ...outcomeDetails(1), operationId: 0 })).toBeUndefined();
  });
});
