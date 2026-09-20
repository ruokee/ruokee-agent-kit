import { describe, expect, test } from "bun:test";
import { OUTCOME_TYPE, changeMessage } from "../src/delivery.ts";
import { deleteBody, messageText, originKey, submittedText } from "../src/envelope.ts";
import { MAX_PENDING_OUTCOMES, activate } from "../src/extension.ts";
import { MAX_BRANCH_BYTES, MAX_ENTRY_BYTES } from "../src/limits.ts";
import { RECORD_SCHEMA_VERSION, RECORD_TYPE } from "../src/record.ts";
import { PENDING_LOST_TEXT } from "../src/receipt.ts";
import { replay } from "../src/state.ts";
import {
  callTool,
  cancelRow,
  consume,
  endRun,
  pickRow,
  recordsOf,
  replacementOf,
  resultsOf,
  runAndConsume,
  runCommand,
} from "./drive.ts";
import { type FakeHost, fakeHost, scriptedUI } from "./host.ts";

/** A host whose dialogs confirm one create of this body and then close. */
function creatingHost(body: string): FakeHost {
  return fakeHost({ ui: scriptedUI({ keys: [pickRow(0)], editor: [body] }) });
}

/** Messages whose text carries one body, in whichever shape the host stores it. */
function carrying(messages: readonly Record<string, unknown>[], text: string) {
  return messages.filter((message) => (messageText(message.content) ?? "").includes(text));
}

/** Position of the first message whose text carries one body. */
function positionOf(messages: readonly Record<string, unknown>[], text: string): number {
  return messages.findIndex((message) => (messageText(message.content) ?? "").includes(text));
}

/** Edit the text of the submitted message in the branch, as another writer would. */
function replaceText(host: FakeHost, search: string | RegExp, replacement: string): void {
  const message = host.journal.find((entry) => entry.type === "message");
  if (message === undefined) throw new Error("expected the submitted message");
  const parts = (message.message as { content: Array<{ type: string; text: string }> }).content;
  const first = parts[0];
  if (first === undefined) throw new Error("expected one text part");
  parts[0] = { ...first, text: first.text.replace(search, replacement) };
}

describe("a request that consumes a user operation", () => {
  test("applies a create the command submitted, and publishes its result", async () => {
    const host = creatingHost("maple");
    activate(host.pi);

    await runCommand(host);

    // The confirmation submitted a message; nothing is written before the host runs it.
    expect(host.submitted).toHaveLength(1);
    expect(recordsOf(host)).toEqual([]);

    const messages = consume(host);

    expect(host.appended).toHaveLength(1);
    expect(host.appended[0]?.data).toMatchObject({ action: "create", body: "maple", source: "user" });
    // The body reaches the model once, through the message the user sent.
    expect(carrying(messages, "maple")).toHaveLength(1);
    // The result names the operation and repeats no body.
    const results = resultsOf(messages);
    expect(results).toHaveLength(1);
    expect(String(results[0]?.content)).toContain("accepted");
    expect(String(results[0]?.content)).not.toContain("maple");
    expect(results[0]?.display).toBe(false);
    // The result is handed over in the host's non-initiating mode as soon as
    // the request reports it, so the host holds it for a later turn and starts
    // no turn for it.
    expect(host.sent).toHaveLength(1);
    expect(host.sent[0]?.message.customType).toBe(OUTCOME_TYPE);
    expect(host.sent[0]?.options).toEqual({ deliverAs: "nextTurn", triggerTurn: false });
    // The result never reaches the host as a steering message, which would run
    // a further model turn.
    expect(host.steering).toEqual([]);
    expect(host.ui.notifies.at(-1)?.kind).toBe("info");
    // A request that reports no new result hands nothing further over.
    consume(host);
    expect(host.sent).toHaveLength(1);
  });

  test("hands the result over as the request reports it, and starts no turn for it", async () => {
    // The host holds a message handed over in its non-initiating mode for a
    // later turn, and `triggerTurn: false` schedules none, so a result reaches
    // the branch without the run continuing for it.
    const host = creatingHost("maple");
    activate(host.pi);
    await runCommand(host);

    const messages = consume(host);

    expect(resultsOf(messages)).toHaveLength(1);
    expect(host.sent).toHaveLength(1);
    expect(host.sent[0]?.message.customType).toBe(OUTCOME_TYPE);
    expect(host.sent[0]?.options).toEqual({ deliverAs: "nextTurn", triggerTurn: false });

    // The result is handed over once, and a request that reports no new result
    // adds none.
    consume(host);
    expect(host.sent).toHaveLength(1);
  });

  test("keeps the result the host has appended where it was written", async () => {
    const host = creatingHost("maple");
    activate(host.pi);
    await runAndConsume(host);

    // A later request reads the result the host appended to the branch.
    const retry = consume(host);
    expect(resultsOf(retry)).toHaveLength(1);

    host.push({
      id: "j-answer",
      type: "message",
      message: { role: "assistant", content: [{ type: "text", text: "Any time." }] },
    });
    host.push({
      id: "j-next",
      type: "message",
      message: { role: "user", content: [{ type: "text", text: "Continue." }] },
    });
    const next = consume(host);

    expect(resultsOf(next)).toHaveLength(1);
    // The ordinary turn appended to the request; no earlier message moved.
    expect(next.slice(0, retry.length)).toEqual(retry);
    expect(next).toHaveLength(retry.length + 2);
  });

  test("keeps the result of a run the host has not appended yet", async () => {
    // The extension hands the message over and the host holds it until a later
    // turn, so a request rebuilt before that, as a retry after an interrupted
    // run is, reads the result the user has already seen.
    const host = fakeHost({
      persistDeliveries: false,
      ui: scriptedUI({ keys: [pickRow(0)], editor: ["maple"] }),
    });
    activate(host.pi);
    await runCommand(host);

    const messages = consume(host);
    const first = resultsOf(messages);
    expect(first).toHaveLength(1);

    // The result was handed over as this request reported it.
    expect(host.sent).toHaveLength(1);
    expect(host.sent[0]?.options).toEqual({ deliverAs: "nextTurn", triggerTurn: false });

    const retry = consume(host);
    const second = resultsOf(retry);
    expect(second).toHaveLength(1);
    expect(second[0]).toEqual(first[0]);
    // The result keeps the place it was published at, and is not queued twice.
    expect(retry).toEqual(messages);
    expect(host.sent).toHaveLength(1);

    // Once the host records it, the request reads the copy the journal holds.
    host.drain();
    const recorded = consume(host);
    expect(resultsOf(recorded)).toHaveLength(1);
    expect(host.sent).toHaveLength(1);
  });

  test("keeps an answer that changes after the branch recorded the first one", async () => {
    // A range that cannot be read answers the operation with "not applied", the
    // host holds that message, and once the range reads the same operation is
    // accepted. Both answers belong to the branch, and the later one has to
    // reach the model in this request.
    const host = fakeHost({
      persistDeliveries: false,
      ui: scriptedUI({ keys: [pickRow(0)], editor: ["maple"] }),
    });
    activate(host.pi);
    await runCommand(host);
    const damaged = { id: "j-bad", type: "custom", customType: RECORD_TYPE, data: { schemaVersion: 99 } };
    host.push(damaged);

    const refused = consume(host);

    expect(String(resultsOf(refused).at(-1)?.content)).toContain("unavailable");

    // The damaged record is gone, so the message this process submitted is a
    // readable operation again.
    host.journal.splice(host.journal.indexOf(damaged), 1);
    const applied = consume(host);

    expect(host.appended).toHaveLength(1);
    const results = resultsOf(applied);
    expect(results).toHaveLength(2);
    expect(String(results[1]?.content)).toContain("accepted");
  });

  test("reports another reason of the same kind", async () => {
    // Two damaged records answer the same operation with the same code and
    // different reasons, and the user is told the reason that holds now.
    const host = creatingHost("maple");
    activate(host.pi);
    await runCommand(host);
    const first = { id: "j-bad-a", type: "custom", customType: RECORD_TYPE, data: { schemaVersion: 99 } };
    host.push(first);

    const refused = consume(host);

    expect(String(resultsOf(refused).at(-1)?.content)).toContain("j-bad-a");

    host.journal.splice(host.journal.indexOf(first), 1);
    host.push({ id: "j-bad-b", type: "custom", customType: RECORD_TYPE, data: { schemaVersion: 1, kind: "record" } });
    const again = consume(host);

    const results = resultsOf(again);
    expect(results).toHaveLength(2);
    expect(String(results[1]?.content)).toContain("j-bad-b");
  });

  test("reports a new answer beside the answer the branch already holds", async () => {
    // The host recorded the first answer, so this request reads it from the
    // branch. The operation is answered again once the range reads, and the new
    // answer has to reach the model beside the old one.
    const host = creatingHost("maple");
    activate(host.pi);
    await runCommand(host);
    const damaged = { id: "j-bad", type: "custom", customType: RECORD_TYPE, data: { schemaVersion: 99 } };
    host.push(damaged);
    consume(host);

    host.journal.splice(host.journal.indexOf(damaged), 1);
    const replaced = replacementOf(host);

    // The extension rebuilt the request instead of leaving the branch alone.
    const results = resultsOf(replaced ?? []);
    expect(results).toHaveLength(2);
    expect(String(results[0]?.content)).toContain("unavailable");
    expect(String(results[1]?.content)).toContain("accepted");
  });

  test("reads a result the host stored as text parts", async () => {
    // The host holds the result and wrote it as parts: the request reads it
    // there instead of writing the same text a second time.
    const host = fakeHost({
      persistDeliveries: false,
      ui: scriptedUI({ keys: [pickRow(0)], editor: ["maple"] }),
    });
    activate(host.pi);
    await runCommand(host);
    consume(host);
    host.drain();
    for (const entry of host.journal) {
      if (entry.type === "custom_message" && entry.content !== undefined) {
        entry.content = [{ type: "text", text: String(entry.content) }];
      }
    }

    const messages = consume(host);

    expect(resultsOf(messages)).toHaveLength(1);
  });

  test("does not write a reason the branch already holds", async () => {
    // Two damaged records answer the operation one after the other, and then
    // the first reason returns. The branch holds it, so it is written once.
    const host = creatingHost("maple");
    activate(host.pi);
    await runCommand(host);
    const first = { id: "j-bad-a", type: "custom", customType: RECORD_TYPE, data: { schemaVersion: 99 } };
    host.push(first);
    consume(host);
    endRun(host);
    host.journal.splice(host.journal.indexOf(first), 1);
    const second = {
      id: "j-bad-b",
      type: "custom",
      customType: RECORD_TYPE,
      data: { schemaVersion: 1, kind: "record" },
    };
    host.push(second);
    consume(host);
    endRun(host);
    host.journal.splice(host.journal.indexOf(second), 1);
    host.push(first);

    const texts = resultsOf(consume(host)).map((message) => String(message.content));

    expect(texts).toHaveLength(2);
    expect(new Set(texts).size).toBe(2);
    // The reason is delivered and told once, so the branch gains no copy and
    // the user is not warned twice about the same one.
    expect(host.sent).toHaveLength(2);
    expect(host.ui.notifies.filter((notice) => notice.message.startsWith("omp-context-pin "))).toHaveLength(2);
  });

  test("reports a reason again for the branch it comes back to", async () => {
    // The journal cannot be read, and another branch came between the two
    // requests. The reason is the one this process reported before, and the
    // request reads no result, so the operation is answered here again.
    const host = fakeHost({
      persistDeliveries: false,
      ui: scriptedUI({ keys: [pickRow(0)], editor: ["maple"] }),
    });
    activate(host.pi);
    await runCommand(host);
    host.push({ id: "j-dup", type: "custom", customType: RECORD_TYPE });
    host.push({ id: "j-dup", type: "custom", customType: RECORD_TYPE });

    expect(resultsOf(consume(host))).toHaveLength(1);

    host.emit("session_branch", {});

    expect(resultsOf(consume(host))).toHaveLength(1);
  });

  test("tells the user about a reason once", async () => {
    // The host records no result and the journal stays unreadable, so the
    // request reads no result of its own: the reason is written into the request
    // and told to the user once, not once per request.
    const host = fakeHost({
      persistDeliveries: false,
      ui: scriptedUI({ keys: [pickRow(0)], editor: ["maple"] }),
    });
    activate(host.pi);
    await runCommand(host);
    host.push({ id: "j-dup", type: "custom", customType: RECORD_TYPE });
    host.push({ id: "j-dup", type: "custom", customType: RECORD_TYPE });

    expect(resultsOf(consume(host))).toHaveLength(1);
    endRun(host);
    expect(resultsOf(consume(host))).toHaveLength(1);

    expect(host.sent).toHaveLength(1);
    expect(host.ui.notifies.filter((notice) => notice.message.startsWith("omp-context-pin "))).toHaveLength(1);
  });

  test("does not write a reason the branch it returns to reads", async () => {
    // The branch holds the result and another branch came between the two
    // requests: the request reads the copy it has, and writes no second one.
    const host = creatingHost("maple");
    activate(host.pi);
    await runCommand(host);
    host.push({ id: "j-dup", type: "custom", customType: RECORD_TYPE });
    host.push({ id: "j-dup", type: "custom", customType: RECORD_TYPE });
    consume(host);

    host.emit("session_branch", {});

    expect(resultsOf(consume(host))).toHaveLength(1);
  });

  test("stops writing a result once the branch holds it", async () => {
    // The host records the delivered message but does not offer custom messages
    // to the model, so only the extension keeps the answer in the request, and
    // only until the branch holds it.
    const host = fakeHost({
      offerDeliveredMessages: false,
      ui: scriptedUI({ keys: [pickRow(0)], editor: ["maple"] }),
    });
    activate(host.pi);

    await runCommand(host);
    const first = consume(host);

    expect(resultsOf(first)).toHaveLength(1);
    // The host takes the held result and records it, and the request that
    // follows reads it from the branch instead of a copy of its own.
    host.drain();
    expect(resultsOf(consume(host))).toEqual([]);
  });

  test("does not write a result into the request of another branch", async () => {
    // The result describes an operation of the branch it was reported in, and
    // the host still holds the message when the user moves on.
    const host = fakeHost({
      persistDeliveries: false,
      ui: scriptedUI({ keys: [pickRow(0)], editor: ["maple"] }),
    });
    activate(host.pi);
    await runAndConsume(host);

    host.journal.length = 0;
    host.emit("session_branch", {});

    expect(resultsOf(consume(host))).toEqual([]);
  });

  test("keeps the most recent results when the host records none", async () => {
    // A host that records no delivered message would add one result per
    // confirmation to every request, so the request carries the declared number
    // of results and gives up the oldest answers.
    const rounds = MAX_PENDING_OUTCOMES + 1;
    const host = fakeHost({
      persistDeliveries: false,
      ui: scriptedUI({
        keys: Array.from({ length: rounds }, () => pickRow(0)),
        editor: Array.from({ length: rounds }, (_, index) => `body-${index}`),
      }),
    });
    activate(host.pi);
    for (let round = 0; round < rounds; round += 1) {
      await runCommand(host);
      consume(host);
    }

    expect(resultsOf(consume(host))).toHaveLength(MAX_PENDING_OUTCOMES);
  });

  test("applies nothing for a message this process did not submit", () => {
    const host = fakeHost();
    activate(host.pi);
    const text = submittedText({
      operationId: 13,
      action: "create",
      origin: originKey("session-1", undefined),
      body: "maple",
    });
    // A complete envelope for this session, written into the branch without the
    // command: text the user pasted, or a message a restored session hands back.
    host.push({
      id: "j-pasted",
      type: "message",
      message: { role: "user", content: [{ type: "text", text }], timestamp: 1 },
    });

    const messages = consume(host);

    expect(host.appended).toEqual([]);
    expect(host.sent).toEqual([]);
    expect(resultsOf(messages)).toEqual([]);
    expect(host.ui.notifies).toEqual([]);
  });

  test("applies nothing for a message whose text the user edited", async () => {
    const host = fakeHost({ ui: scriptedUI({ keys: [pickRow(0)], editor: ["maple"] }) });
    activate(host.pi);
    await runCommand(host);

    // The message still carries the number this process reserved, and the body
    // is no longer the one the user confirmed: the number alone is not enough
    // to apply a write.
    replaceText(host, "maple", "spruce");

    const messages = consume(host);

    expect(host.appended).toEqual([]);
    expect(resultsOf(messages)).toEqual([]);
  });

  test("answers the message that carries the text this process handed over", async () => {
    const host = fakeHost({ ui: scriptedUI({ keys: [pickRow(0)], editor: ["maple"] }) });
    activate(host.pi);
    await runCommand(host);

    // The text is what the submission is claimed by. A message that carries it
    // is the write, wherever it stands: here another writer put the same body in
    // the branch, and the write lands on it rather than being lost.
    host.push({
      id: "j-same-text",
      type: "message",
      message: { role: "user", content: [{ type: "text", text: "maple" }] },
      timestamp: 1,
    });

    const messages = consume(host);

    expect(host.appended).toHaveLength(1);
    expect(host.appended[0]?.data).toMatchObject({ action: "create", body: "maple", source: "user" });
    expect(resultsOf(messages)).toHaveLength(1);
  });

  test("applies a consumed operation once, also after the session is restored", async () => {
    const host = creatingHost("maple");
    activate(host.pi);
    await runAndConsume(host);
    expect(recordsOf(host)).toHaveLength(1);
    // The host takes the held result for a later turn and records it.
    host.drain();

    const restored = fakeHost({ journal: structuredClone(host.journal) });
    activate(restored.pi);
    const messages = consume(restored);

    expect(restored.appended).toEqual([]);
    expect(recordsOf(restored)).toHaveLength(1);
    expect(replay(restored.journal).entries).toHaveLength(1);
    // The result is read from the journal, exactly as it was published.
    expect(resultsOf(messages)).toHaveLength(1);
    expect(String(resultsOf(messages)[0]?.content)).toContain("accepted");
  });

  test("does not queue a second copy of a write its own request carries", async () => {
    // The host runs a submitted message before it records the entry that stands
    // for it, so that request is the only place the write appears.
    const host = fakeHost({
      persistSubmissions: false,
      ui: scriptedUI({ keys: [pickRow(0)], editor: ["maple"] }),
    });
    activate(host.pi);

    await runCommand(host);
    const messages = consume(host);

    expect(host.appended).toHaveLength(1);
    expect(carrying(messages, "maple")).toHaveLength(1);
    // The body was not delivered twice, and the result went to the host once in
    // the non-initiating mode as this request reported it.
    expect(host.sent.map((entry) => entry.message.customType)).toEqual([OUTCOME_TYPE]);
    expect(host.sent[0]?.options).toEqual({ deliverAs: "nextTurn", triggerTurn: false });

    // The host builds the next request of the same turn before it records the
    // message, so that request carries the write without the branch holding it.
    const sameTurn = consume(host);
    expect(carrying(sameTurn, "maple")).toHaveLength(1);
    expect(resultsOf(sameTurn)).toHaveLength(1);
    expect(host.sent.map((entry) => entry.message.customType)).toEqual([OUTCOME_TYPE]);

    host.drainSubmissions();
    const next = consume(host);

    expect(carrying(next, "maple")).toHaveLength(1);
    expect(resultsOf(next)).toHaveLength(1);
    expect(host.sent.map((entry) => entry.message.customType)).toEqual([OUTCOME_TYPE]);
  });

  test("keeps a published change and result in place through later tool steps", async () => {
    // A run takes several tool steps, and the host records the messages it was
    // handed only when the turn ends. Both what the extension published and the
    // steps that follow keep to the places they were read at, so the request
    // prefix does not move as the run grows.
    const host = fakeHost({
      persistDeliveries: false,
      ui: scriptedUI({ keys: [pickRow(0)], editor: ["maple"] }),
    });
    activate(host.pi);
    await runCommand(host);
    host.push({
      id: "j-result-call",
      type: "message",
      message: {
        role: "toolResult",
        toolCallId: "call-1",
        content: [{ type: "text", text: "Pinned." }],
      },
    });
    const first = consume(host);

    expect(resultsOf(first)).toHaveLength(1);
    expect(first[1]?.customType).toBe(OUTCOME_TYPE);

    await callTool(host, "call-2", { action: "update", id: 1, content: "oak", expectedRevision: 1 });
    host.push({
      id: "j-result-call-2",
      type: "message",
      message: {
        role: "toolResult",
        toolCallId: "call-2",
        content: [{ type: "text", text: "Updated." }],
      },
    });
    const next = consume(host);

    // The result keeps the place it was first read at, and the steps that
    // followed are appended after it.
    expect(next.slice(0, first.length)).toEqual(first);
    // The change of the second call reads directly after its own result, not at
    // the tail a further step would move.
    expect(next.at(-2)?.toolCallId).toBe("call-2");
    expect(next.at(-1)?.details).toMatchObject({ operationId: 2 });
    // Only a user operation is answered by a result.
    expect(
      resultsOf(next).map((message) => String((message.details as { operationId?: number })?.operationId)),
    ).toEqual(["1"]);
  });

  test("reports a confirmed write a session change drops", async () => {
    const host = creatingHost("maple");
    activate(host.pi);
    await runCommand(host);

    // The host never runs the message the confirmation submitted: the session
    // moves on first, and the write cannot be applied from another run.
    host.emit("session_switch", {});

    expect(host.appended).toEqual([]);
    expect(host.ui.notifies.at(-1)).toEqual({ message: PENDING_LOST_TEXT, kind: "warning" });

    const messages = consume(host);

    expect(host.appended).toEqual([]);
    expect(resultsOf(messages)).toEqual([]);
  });

  test("applies the operations of one request in the order its messages hold them", async () => {
    const host = fakeHost({
      ui: scriptedUI({ keys: [pickRow(0), pickRow(0)], editor: ["maple", "spruce"] }),
    });
    activate(host.pi);
    await runCommand(host);
    await runCommand(host);

    const messages = consume(host);

    expect(host.appended.map((entry) => (entry.data as { body: string }).body)).toEqual(["maple", "spruce"]);
    expect(replay(host.journal).entries).toHaveLength(2);
    expect(carrying(messages, "maple")).toHaveLength(1);
    expect(carrying(messages, "spruce")).toHaveLength(1);
    // One result per operation, each naming its own identity.
    const results = resultsOf(messages);
    expect(results).toHaveLength(2);
    expect(String(results[0]?.content)).not.toContain(String(results[1]?.content));
  });

  test("refuses an update whose revision moved while the dialog was open", async () => {
    let host: FakeHost;
    let entryId = 0;
    host = fakeHost({
      ui: scriptedUI({
        keys: [pickRow(0), pickRow(1)],
        select: ["Edit"],
        editor: [
          "maple",
          () => {
            // Another writer advances the revision while the dialog is open.
            host.push({
              id: "j-other",
              type: "custom",
              customType: RECORD_TYPE,
              data: {
                schemaVersion: RECORD_SCHEMA_VERSION,
                operationId: 15,
                action: "update",
                entryId,
                revision: 2,
                body: "cedar",
                source: "agent",
              },
            });
            return "spruce";
          },
        ],
      }),
    });
    activate(host.pi);
    await runAndConsume(host);
    entryId = (replay(host.journal).entries[0] as { entryId: number }).entryId;

    await runCommand(host);
    const messages = consume(host);

    // Only the create was accepted; the revision the dialog showed is gone.
    expect(host.appended).toHaveLength(1);
    expect(String(resultsOf(messages).at(-1)?.content)).toContain("Current revision: 2.");
    expect(host.ui.notifies.at(-1)?.kind).toBe("error");
  });

  test("refuses an operation written in another session or pin period", async () => {
    let session = "session-1";
    const host = fakeHost({
      sessionId: () => session,
      ui: scriptedUI({ keys: [pickRow(0)], editor: ["maple"] }),
    });
    activate(host.pi);
    await runCommand(host);

    // The session moves on between the confirmation and the request that runs it.
    session = "session-2";
    const messages = consume(host);

    expect(host.appended).toEqual([]);
    expect(recordsOf(host)).toEqual([]);
    expect(String(resultsOf(messages).at(-1)?.content)).toContain("another session or pin period");
    expect(host.ui.notifies.at(-1)?.kind).toBe("error");

    // The message stays in the branch, and its refusal is not published again.
    expect(resultsOf(consume(host))).toHaveLength(1);
    expect(resultsOf(consume(host))).toHaveLength(1);
  });

  test("keeps a write pending while its range cannot be read, then applies it", async () => {
    const host = creatingHost("maple");
    activate(host.pi);
    await runCommand(host);
    // A record the extension cannot read appears while the message is on its way.
    const damaged = { id: "j-bad", type: "custom", customType: RECORD_TYPE, data: { schemaVersion: 99 } };
    host.push(damaged);

    const refused = consume(host);

    expect(host.appended).toEqual([]);
    // The reason is the damaged range: the state the operation would change
    // cannot be read, so nothing is checked yet.
    expect(String(resultsOf(refused).at(-1)?.content)).toContain("not applied");
    expect(String(resultsOf(refused).at(-1)?.content)).toContain("unavailable");

    // A readable range lets the same message be seen as the operation it is.
    host.journal.splice(host.journal.indexOf(damaged), 1);
    const applied = consume(host);

    expect(host.appended).toHaveLength(1);
    expect(String(resultsOf(applied).at(-1)?.content)).toContain("accepted");
  });

  test("keeps a write pending while the session journal cannot be read", async () => {
    const host = creatingHost("maple");
    activate(host.pi);
    await runCommand(host);
    // The same entry id twice in one branch is a journal the host cannot read.
    host.push({ id: "j-dup", type: "message", message: { role: "user", content: [{ type: "text", text: "hello" }] } });
    host.push({ id: "j-dup", type: "message", message: { role: "user", content: [{ type: "text", text: "again" }] } });

    const refused = consume(host);

    expect(host.appended).toEqual([]);
    expect(String(resultsOf(refused).at(-1)?.content)).toContain("not applied");
    expect(String(resultsOf(refused).at(-1)?.content)).toContain("cannot be read");
  });

  test("refuses an update whose entry was unpinned before the request ran", async () => {
    let host: FakeHost;
    let entryId = 0;
    host = fakeHost({
      ui: scriptedUI({
        keys: [pickRow(0), pickRow(1)],
        select: ["Edit"],
        editor: ["maple", "spruce"],
      }),
    });
    activate(host.pi);
    await runAndConsume(host);
    entryId = (replay(host.journal).entries[0] as { entryId: number }).entryId;

    await runCommand(host);
    // Another writer unpins the entry while the message is on its way.
    host.push({
      id: "j-other-delete",
      type: "custom",
      customType: RECORD_TYPE,
      data: {
        schemaVersion: RECORD_SCHEMA_VERSION,
        operationId: 16,
        action: "delete",
        entryId,
        revision: 2,
        source: "agent",
      },
    });
    const messages = consume(host);

    expect(host.appended).toHaveLength(1);
    expect(String(resultsOf(messages).at(-1)?.content)).toContain(`no active pin entry #${entryId}`);
    // The body the user sent still reaches the model, once.
    expect(carrying(messages, "spruce")).toHaveLength(1);
  });
});

describe("an operation that was refused", () => {
  test("is not applied when the capacity it needed is released and the session is restored", async () => {
    const host = creatingHost("previously-refused-body");
    activate(host.pi);
    const full = "a".repeat(MAX_ENTRY_BYTES);
    for (let index = 0; index < MAX_BRANCH_BYTES / MAX_ENTRY_BYTES; index += 1) {
      await callTool(host, `capacity-${index}`, { action: "create", content: full });
    }
    host.drain();

    await runCommand(host);
    const refused = consume(host);

    expect(recordsOf(host)).toHaveLength(4);
    expect(String(resultsOf(refused).at(-1)?.content)).toContain("not applied");

    // The user frees capacity, and the refused message is still in the branch.
    const oldest = replay(host.journal).entries[0] as { entryId: number; revision: number };
    await callTool(host, "free-capacity", {
      action: "delete",
      id: oldest.entryId,
      expectedRevision: oldest.revision,
    });
    consume(host);

    expect(recordsOf(host)).toHaveLength(5);
    expect(replay(host.journal).entries.some((entry) => entry.body === "previously-refused-body")).toBe(false);

    const restored = fakeHost({ journal: structuredClone(host.journal) });
    activate(restored.pi);
    consume(restored);

    // No new confirmation was given, so nothing was pinned for the old draft.
    expect(restored.submitted).toEqual([]);
    expect(restored.appended).toEqual([]);
    expect(recordsOf(restored)).toHaveLength(5);
    expect(replay(restored.journal).entries.some((entry) => entry.body === "previously-refused-body")).toBe(false);
  });

  test("is not applied when the branch it was confirmed on comes back", async () => {
    const host = creatingHost("maple");
    activate(host.pi);
    await runCommand(host);
    host.emit("session_branch", { type: "session_branch" });

    const refused = consume(host);
    expect(String(resultsOf(refused).at(-1)?.content)).toContain("another branch");
    // The host takes that answer for a later turn and records it beside the
    // message it refused.
    host.drain();

    // The user returns to that branch; the refused message is still in the path.
    host.emit("session_branch", { type: "session_branch" });
    const messages = consume(host);

    expect(host.appended).toEqual([]);
    expect(recordsOf(host)).toEqual([]);
    expect(resultsOf(messages)).toHaveLength(1);
    expect(String(resultsOf(messages)[0]?.content)).toContain("another branch");
  });

  test("stays a no-op when the session is restored", async () => {
    let host: FakeHost;
    host = fakeHost({
      ui: scriptedUI({
        keys: [pickRow(0), pickRow(1)],
        select: ["Edit"],
        editor: ["maple", "maple"],
      }),
    });
    activate(host.pi);
    await runAndConsume(host);

    await runCommand(host);
    const messages = consume(host);

    expect(host.appended).toHaveLength(1);
    expect(String(resultsOf(messages).at(-1)?.content)).toContain("already has that body");

    const restored = fakeHost({ journal: structuredClone(host.journal) });
    activate(restored.pi);
    consume(restored);

    expect(restored.appended).toEqual([]);
    expect(recordsOf(restored)).toHaveLength(1);
  });
});

describe("the message one confirmation is consumed by", () => {
  /** Run one request the host builds, without the message it holds for the extension. */
  function runRequest(host: FakeHost, messages: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    const result = host.emit("context", { type: "context", messages }) as
      { messages: Array<Record<string, unknown>> } | undefined;
    return result?.messages ?? messages;
  }

  test("is not a message the conversation already held", async () => {
    // Text the branch already carries reads exactly like the write the command
    // submits, and a request that takes no new message cannot consume the
    // confirmation: nothing is applied and nothing is reported.
    const host = fakeHost({ persistSubmissions: false, ui: scriptedUI({ keys: [pickRow(0)], editor: ["maple"] }) });
    activate(host.pi);
    host.push({
      id: "j-history",
      type: "message",
      message: {
        role: "user",
        content: [{ type: "text", text: "maple" }],
        timestamp: Date.now() - 60_000,
      },
    });

    await runCommand(host);
    const messages = runRequest(host, [
      { role: "user", content: [{ type: "text", text: "maple" }], timestamp: Date.now() - 60_000 },
      { role: "assistant", content: [{ type: "text", text: "acknowledged earlier" }], timestamp: Date.now() - 59_000 },
      { role: "user", content: [{ type: "text", text: "unrelated task" }], timestamp: Date.now() - 58_000 },
    ]);

    expect(host.appended).toEqual([]);
    expect(recordsOf(host)).toEqual([]);
    expect(resultsOf(messages)).toEqual([]);
  });

  test("is not an ordinary message that reads the same text later", async () => {
    // The host runs other text in the place of the confirmation, so the
    // confirmation is left behind: a message the user types later, however
    // exactly it reads, is not the operation the user confirmed.
    const host = fakeHost({ ui: scriptedUI({ keys: [pickRow(0)], editor: ["old draft"] }) });
    activate(host.pi);
    await runCommand(host);

    // The user edits the message the host holds before it runs.
    replaceText(host, "old draft", "replacement prose");
    const edited = consume(host);

    expect(recordsOf(host)).toEqual([]);
    expect(resultsOf(edited)).toEqual([]);

    host.push({
      id: "j-later",
      type: "message",
      message: { role: "user", content: [{ type: "text", text: "old draft" }], timestamp: Date.now() },
    });
    const later = consume(host);

    expect(recordsOf(host)).toEqual([]);
    expect(replay(host.journal).entries).toEqual([]);
    expect(resultsOf(later)).toEqual([]);
  });

  test("keeps the result where it was published once the host appends its copy", async () => {
    // The host appends the result it was handed to the end of the branch, and
    // the request built after that reads the answer where the operation was
    // consumed rather than at the tail the host moved it to.
    const host = fakeHost({
      persistDeliveries: false,
      ui: scriptedUI({ keys: [pickRow(0)], editor: ["maple"] }),
    });
    activate(host.pi);
    await runCommand(host);
    const first = consume(host);
    const published = resultsOf(first)[0];
    expect(published).toBeDefined();

    // The run ends and the host takes the message it was handed, then the turn
    // goes on: the branch grows before the host records that message, so its
    // copy lands after the steps that followed the operation.
    endRun(host);
    host.push({
      id: "j-note",
      type: "message",
      message: { role: "assistant", content: [{ type: "text", text: "working" }], timestamp: Date.now() },
    });
    host.push({
      id: "j-next",
      type: "message",
      message: { role: "user", content: [{ type: "text", text: "continue" }], timestamp: Date.now() },
    });
    host.drain();

    const next = consume(host);

    // One result, at the place it was first published, reading exactly what the
    // request published, with the messages before it unchanged. The host stamps
    // its own time on the copy it records, so the message is read by what this
    // component writes into it and by where it stands.
    expect(resultsOf(next)).toHaveLength(1);
    const placedAt = next.indexOf(resultsOf(next)[0] as Record<string, unknown>);
    expect(placedAt).toBe(first.indexOf(published as Record<string, unknown>));
    expect(resultsOf(next)[0]?.content).toEqual(published?.content);
    expect(resultsOf(next)[0]?.details).toEqual(published?.details);
    expect(next.slice(0, placedAt)).toEqual(first.slice(0, placedAt));
  });

  test("does not queue a published Agent change again after the tree moves", async () => {
    // The change was published once and the branch holds it, so a tree event
    // that clears what this process remembers of the run must not queue it
    // again: the range is replayed in the session it belongs to.
    const host = fakeHost({ persistDeliveries: false });
    activate(host.pi);
    await callTool(host, "call-1", { action: "create", content: "agent text" });
    host.push({ id: "j-tool", type: "message", message: { role: "toolResult", toolCallId: "call-1", content: [] } });
    consume(host);
    host.drain();
    consume(host);
    const sent = host.sent.length;

    host.emit("session_tree", { type: "session_tree" });
    const after = consume(host);

    expect(host.sent).toHaveLength(sent);
    expect(replay(host.journal).entries).toHaveLength(1);
    expect(positionOf(after, "agent text")).toBeGreaterThanOrEqual(0);
  });

  test("drops a sibling branch's change that names the revision this branch reached", async () => {
    // Two paths of one session can update the same entry to the same revision
    // number with different content, so the revision a queued copy names does
    // not show which path it belongs to. This range accepted operations 1 and 3
    // and never operation 2, so the copy the other path queued is not its
    // context, whatever revision it names.
    const host = fakeHost({ persistDeliveries: false });
    const common = {
      schemaVersion: RECORD_SCHEMA_VERSION,
      operationId: 1,
      action: "create",
      entryId: 1,
      revision: 1,
      source: "agent",
      body: "common-body",
    } as const;
    host.push({ id: "j-common", type: "custom", customType: RECORD_TYPE, data: common });
    host.push({
      id: "j-current",
      type: "custom",
      customType: RECORD_TYPE,
      data: { ...common, operationId: 3, action: "update", revision: 2, body: "current-body" },
    });
    activate(host.pi);
    host.emit("session_tree", { type: "session_tree" });

    const sibling = changeMessage(
      { ...common, operationId: 2, action: "update", revision: 2, body: "sibling-body" },
      2,
      { sessionId: host.ctx.sessionManager.getSessionId() },
    );
    host.push({
      id: "j-sibling",
      type: "custom_message",
      customType: sibling.customType,
      content: sibling.content,
      details: sibling.details,
    });
    host.push({
      id: "j-user",
      type: "message",
      message: { role: "user", content: [{ type: "text", text: "continue" }] },
    });

    const messages = consume(host);

    expect(replay(host.journal).records.map((record) => record.operationId)).toEqual([1, 3]);
    expect(messages.some((message) => messageText(message.content) === sibling.content)).toBe(false);
    expect(positionOf(messages, "sibling-body")).toBe(-1);
    expect(positionOf(messages, "current-body")).toBeGreaterThanOrEqual(0);
  });
});

describe("the order one request expresses the changes in", () => {
  test("writes the change an earlier operation missed before the update that supersedes it", async () => {
    let host: FakeHost;
    host = fakeHost({ ui: scriptedUI({ keys: [pickRow(1), cancelRow], select: ["Edit"], editor: ["new-body"] }) });
    activate(host.pi);

    // The Agent's create is accepted while its change message never arrives.
    const send = host.pi.sendMessage.bind(host.pi);
    let refuse = true;
    (host.pi as unknown as { sendMessage: unknown }).sendMessage = (message: unknown, options: unknown) => {
      if (refuse) {
        refuse = false;
        throw new Error("the host refused the message");
      }
      send(message as never, options as never);
    };
    await expect(callTool(host, "call-1", { action: "create", content: "old-body" })).rejects.toThrow();
    expect(recordsOf(host)).toHaveLength(1);

    await runCommand(host);
    const messages = consume(host);

    // The journal holds create then update, so the request reads them in that
    // order, and the older body is never the one that comes last.
    expect(recordsOf(host).map((entry) => (entry.data as { action: string }).action)).toEqual(["create", "update"]);
    expect(replay(host.journal).entries[0]?.revision).toBe(2);
    expect(positionOf(messages, "old-body")).toBeGreaterThanOrEqual(0);
    expect(positionOf(messages, "old-body")).toBeLessThan(positionOf(messages, "new-body"));
    // The body the user sent reaches the model once, message and envelope.
    expect(carrying(messages, "new-body")).toHaveLength(1);
  });

  test("writes a missed create before the delete message the user sent for it", async () => {
    let host: FakeHost;
    host = fakeHost({ ui: scriptedUI({ keys: [pickRow(1)], select: ["Unpin"], confirm: [true] }) });
    activate(host.pi);

    // The Agent's create is accepted while its change message never arrives.
    const send = host.pi.sendMessage.bind(host.pi);
    let refuse = true;
    (host.pi as unknown as { sendMessage: unknown }).sendMessage = (message: unknown, options: unknown) => {
      if (refuse) {
        refuse = false;
        throw new Error("the host refused the message");
      }
      send(message as never, options as never);
    };
    await expect(callTool(host, "call-1", { action: "create", content: "old-body" })).rejects.toThrow();

    await runCommand(host);
    const messages = consume(host);

    expect(recordsOf(host).map((entry) => (entry.data as { action: string }).action)).toEqual(["create", "delete"]);
    expect(replay(host.journal).entries).toEqual([]);
    // The create this request missed is written before the delete that unpinned it,
    // so the request never reads a pin after the entry that removed it.
    expect(positionOf(messages, "old-body")).toBeGreaterThanOrEqual(0);
    expect(positionOf(messages, "old-body")).toBeLessThan(positionOf(messages, deleteBody(1)));
  });
});
