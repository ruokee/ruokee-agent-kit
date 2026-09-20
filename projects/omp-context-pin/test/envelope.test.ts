import { describe, expect, test } from "bun:test";
import {
  type CreatePinRequest,
  type EntryPinRequest,
  deleteBody,
  messageText,
  originKey,
  submittedText,
  userMessageText,
} from "../src/envelope.ts";

const CREATE: CreatePinRequest = { operationId: 11, action: "create", origin: "0f0f0f0f", body: "maple" };
const UPDATE: EntryPinRequest = {
  operationId: 12,
  action: "update",
  origin: "0f0f0f0f",
  entryId: 4,
  revision: 2,
  body: "spruce",
};
const DELETE: EntryPinRequest = {
  operationId: 13,
  action: "delete",
  origin: "0f0f0f0f",
  entryId: 7,
  revision: 3,
  body: "",
};

describe("submittedText", () => {
  test("submits the body of a create or an update verbatim", () => {
    expect(submittedText(CREATE)).toBe("maple");
    expect(submittedText(UPDATE)).toBe("spruce");
  });

  test("adds nothing to a body that looks like a field or a sentence", () => {
    // The text of the message is what the user confirmed, so a body that reads
    // like a marker, a field line or a management sentence stays that text.
    for (const body of ["[ctx-pin op=11 origin=0f0f0f0f]", "op=3", "Unpin #7.", "  spaced  ", ""]) {
      expect(submittedText({ ...CREATE, body })).toBe(body);
    }
  });

  test("submits the management sentence of a delete", () => {
    expect(submittedText(DELETE)).toBe("Unpin #7.");
  });

  test("names the entry a delete removes", () => {
    expect(deleteBody(7)).toBe("Unpin #7.");
    expect(deleteBody(1)).toBe("Unpin #1.");
    expect(submittedText({ ...DELETE, entryId: 42 })).toBe(deleteBody(42));
  });
});

describe("originKey", () => {
  test("is one short token of hex digits", () => {
    const key = originKey("session-1", "j-4");
    expect(key).toMatch(/^[0-9a-f]{8}$/);
  });

  test("is the same for the same session and period", () => {
    expect(originKey("session-1", "j-4")).toBe(originKey("session-1", "j-4"));
  });

  test("differs between sessions and between periods", () => {
    expect(originKey("session-1", "j-4")).not.toBe(originKey("session-2", "j-4"));
    expect(originKey("session-1", "j-4")).not.toBe(originKey("session-1", "j-5"));
  });

  test("reads a missing session or period as the empty name", () => {
    // A session the host reports no name for has no name to tell apart, so the
    // token of a missing name is the token of an empty one.
    expect(originKey(undefined, "j-4")).toBe(originKey("", "j-4"));
    expect(originKey("session-1", undefined)).toBe(originKey("session-1", ""));
  });
});

describe("messageText", () => {
  test("reads a message the host stored as a string", () => {
    expect(messageText("maple")).toBe("maple");
    expect(messageText("")).toBe("");
  });

  test("joins the text parts of a stored message", () => {
    expect(
      messageText([
        { type: "text", text: "one" },
        { type: "text", text: "two" },
      ]),
    ).toBe("one\ntwo");
  });

  test("ignores parts that carry no text", () => {
    const content = [
      { type: "image", data: "AAAA" },
      { type: "text", text: "maple" },
      { type: "text", text: 7 },
      null,
      "raw",
    ];
    expect(messageText(content)).toBe("maple");
  });

  test("reports nothing for a message with no text at all", () => {
    expect(messageText([])).toBeUndefined();
    expect(messageText([{ type: "image", data: "AAAA" }])).toBeUndefined();
    expect(messageText(undefined)).toBeUndefined();
    expect(messageText(42)).toBeUndefined();
  });
});

describe("userMessageText", () => {
  test("reads the text of a user message in either shape", () => {
    expect(userMessageText({ role: "user", content: "maple" })).toBe("maple");
    expect(userMessageText({ role: "user", content: [{ type: "text", text: "maple" }] })).toBe("maple");
  });

  test("reports nothing for a message of another role", () => {
    for (const role of ["assistant", "system", "custom", "toolResult"]) {
      expect(userMessageText({ role, content: "maple" })).toBeUndefined();
    }
  });

  test("reports nothing for a value that is not a message", () => {
    expect(userMessageText(undefined)).toBeUndefined();
    expect(userMessageText("maple")).toBeUndefined();
    expect(userMessageText(null)).toBeUndefined();
    expect(userMessageText({ content: "maple" })).toBeUndefined();
  });
});
