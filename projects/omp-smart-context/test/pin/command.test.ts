import { describe, expect, test } from "bun:test";
import { COMMAND_NAME, SESSION_CHANGED_TEXT, USAGE_TEXT } from "../../src/pin/command.ts";
import { OUTCOME_TYPE } from "../../src/pin/delivery.ts";
import { MAX_BRANCH_BYTES_LABEL } from "../../src/pin/limits.ts";
import { PERSISTENCE_NOTE, pendingText } from "../../src/pin/receipt.ts";
import { RECORD_SCHEMA_VERSION, RECORD_TYPE } from "../../src/pin/record.ts";
import { replay } from "../../src/pin/state.ts";
import { pinRows } from "../../src/pin/ui.ts";
import { visibleWidth } from "@oh-my-pi/pi-tui";

import { cancelRow, consume, endRun, pickRow, recordsOf, runAndConsume, runCommand } from "./drive.ts";
import { type FakeHost, enablePin, fakeContext, fakeHost, scriptedUI } from "./host.ts";

/** One stored record of a branch, as the journal holds it. */
function stored(entryId: number, body: string, id: string, operationId = entryId) {
  return {
    id,
    type: "custom",
    customType: RECORD_TYPE,
    data: {
      schemaVersion: RECORD_SCHEMA_VERSION,
      operationId,
      action: "create",
      entryId,
      revision: 1,
      body,
      source: "user",
    },
  };
}

/** Notifications other than the persistence note the command shows when it opens. */
function receipts(host: FakeHost) {
  return host.ui.notifies.filter((entry) => entry.message !== PERSISTENCE_NOTE);
}

describe("the ctx-pin command", () => {
  test("writes nothing when the first dialog is cancelled", async () => {
    const host = fakeHost({ ui: scriptedUI({ keys: [] }) });
    enablePin(host);

    await runCommand(host);

    expect(host.journal).toEqual([]);
    expect(host.sent).toEqual([]);
    // Opening the dialog states how pins are persisted, then reports nothing else.
    expect(host.ui.notifies).toEqual([{ kind: "info", message: PERSISTENCE_NOTE }]);
  });

  test("creates an entry from the editor and reports the receipt", async () => {
    const host = fakeHost({ ui: scriptedUI({ keys: [pickRow(0)], editor: ["maple"] }) });
    enablePin(host);

    await runCommand(host);

    // The confirmation submits a message: no record exists until the host runs it.
    expect(host.submitted).toHaveLength(1);
    expect(host.appended).toEqual([]);
    expect(receipts(host)[0]?.message).toBe(pendingText());
    expect(receipts(host)[0]?.kind).toBe("info");

    consume(host);

    expect(host.appended).toHaveLength(1);
    expect(host.appended[0]?.data).toMatchObject({ action: "create", source: "user", body: "maple" });
    expect(recordsOf(host)).toHaveLength(1);
    expect(receipts(host)[1]?.message).toContain("accepted");
    expect(receipts(host)[1]?.kind).toBe("info");
  });

  test("writes nothing when the create dialog is cancelled", async () => {
    const host = fakeHost({ ui: scriptedUI({ keys: [pickRow(0)], editor: [undefined] }) });
    enablePin(host);

    await runCommand(host);

    expect(host.journal).toEqual([]);
    expect(receipts(host)).toEqual([]);
  });

  test("shows one entry's body without changing anything", async () => {
    const host = fakeHost({ ui: scriptedUI({ keys: [pickRow(0)], editor: ["maple"] }) });
    enablePin(host);
    await runAndConsume(host);

    const host2 = fakeHost({
      journal: host.journal,
      ui: scriptedUI({ keys: [pickRow(1), cancelRow], select: ["View"] }),
    });
    enablePin(host2);
    await runCommand(host2);

    expect(recordsOf(host2)).toHaveLength(1);
    expect(host2.appended).toEqual([]);
    expect(receipts(host2)[0]?.message).toContain("maple");
  });

  test("replaces a body the user edits in the dialog", async () => {
    const host = fakeHost({ ui: scriptedUI({ keys: [pickRow(0)], editor: ["maple"] }) });
    enablePin(host);
    await runAndConsume(host);

    const host2 = fakeHost({
      journal: host.journal,
      ui: scriptedUI({ keys: [pickRow(1)], select: ["Edit"], editor: ["spruce"] }),
    });
    enablePin(host2);
    await runAndConsume(host2);

    expect(host2.appended).toHaveLength(1);
    expect(host2.appended[0]?.data).toMatchObject({ action: "update", body: "spruce", revision: 2, source: "user" });
    expect(receipts(host2)[0]?.message).toBe(pendingText());
    expect(receipts(host2)[1]?.message).toContain("accepted");
    expect(receipts(host2)[1]?.kind).toBe("info");
  });

  test("applies a body whose revision moved while the dialog was open", async () => {
    const host = fakeHost({ ui: scriptedUI({ keys: [pickRow(0)], editor: ["maple"] }) });
    enablePin(host);
    await runAndConsume(host);
    const created = host.appended[0]?.data;
    if (
      created === undefined ||
      created === null ||
      typeof created !== "object" ||
      !("entryId" in created) ||
      typeof created.entryId !== "number"
    ) {
      throw new Error("expected the created entry");
    }
    const entryId = created.entryId;

    const host2 = fakeHost({
      journal: host.journal,
      ui: scriptedUI({
        keys: [pickRow(1)],
        select: ["Edit"],
        editor: [
          () => {
            // Another writer advances the revision while the dialog is open.
            host2.journal.push({
              id: "j-other",
              type: "custom",
              customType: RECORD_TYPE,
              data: {
                schemaVersion: RECORD_SCHEMA_VERSION,
                operationId: 3,
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
    enablePin(host2);
    await runCommand(host2);

    // The dialog submits what it showed; the request applies it to the current
    // entry even though another write advanced the revision meanwhile.
    expect(host2.submitted).toHaveLength(1);
    consume(host2);

    expect(host2.appended).toHaveLength(1);
    expect(host2.appended[0]?.data).toMatchObject({
      action: "update",
      body: "spruce",
      revision: 3,
      source: "user",
    });
    expect(recordsOf(host2)).toHaveLength(3);
    expect(receipts(host2).at(-1)?.kind).toBe("info");
    expect(receipts(host2).at(-1)?.message).toContain("accepted");
  });

  test("leaves the journal untouched when the session changes under a dialog", async () => {
    let session = "session-1";
    const host = fakeHost({
      sessionId: () => session,
      ui: scriptedUI({
        keys: [pickRow(0)],
        editor: [
          () => {
            session = "session-2";
            return "maple";
          },
        ],
      }),
    });
    enablePin(host);

    await runCommand(host);

    expect(host.journal).toEqual([]);
    expect(host.sent).toEqual([]);
    expect(receipts(host)[0]).toEqual({ kind: "warning", message: SESSION_CHANGED_TEXT });
  });

  test("leaves the journal untouched when the entry leaves the branch", async () => {
    const host = fakeHost({ ui: scriptedUI({ keys: [pickRow(0)], editor: ["maple"] }) });
    enablePin(host);
    await runAndConsume(host);

    const moved = fakeHost({
      journal: host.journal,
      ui: scriptedUI({
        keys: [pickRow(0)],
        editor: [
          () => {
            // A branch switch replaces the entries the dialog started from.
            moved.journal.splice(0, moved.journal.length, { id: "j-other", type: "user_message", content: "hi" });
            return "spruce";
          },
        ],
      }),
    });
    enablePin(moved);

    await runCommand(moved);

    expect(moved.appended).toEqual([]);
    expect(moved.sent).toEqual([]);
    expect(receipts(moved)[0]).toEqual({ kind: "warning", message: SESSION_CHANGED_TEXT });
  });

  test("leaves the journal untouched when the branch moves under a dialog", async () => {
    const host = fakeHost({
      ui: scriptedUI({
        keys: [pickRow(0)],
        editor: [
          () => {
            // The user moves to another branch while the editor is open; the
            // branch still contains every entry the dialog started from.
            host.emit("session_branch", { type: "session_branch" });
            return "maple";
          },
        ],
      }),
    });
    enablePin(host);

    await runCommand(host);

    expect(host.journal).toEqual([]);
    expect(host.sent).toEqual([]);
    expect(receipts(host)[0]).toEqual({ kind: "warning", message: SESSION_CHANGED_TEXT });
  });

  test("leaves the journal untouched when the branch moves while the menu is open", async () => {
    let editorOpened = false;
    const host = fakeHost({
      ui: scriptedUI({
        keys: [
          () => {
            // The branch changes before the row is answered, so the answer must
            // not lead to a dialog or a write on the branch it named.
            host.emit("session_branch", { type: "session_branch" });
            return pickRow(0);
          },
        ],
        editor: [
          () => {
            editorOpened = true;
            return "maple";
          },
        ],
      }),
    });
    enablePin(host);

    await runCommand(host);

    expect(editorOpened).toBe(false);
    expect(host.journal).toEqual([]);
    expect(host.sent).toEqual([]);
    expect(receipts(host)[0]).toEqual({ kind: "warning", message: SESSION_CHANGED_TEXT });
  });

  test("does not apply a confirmed write after the user moves to another branch", async () => {
    // A branch with no entry leaves nothing to compare, so the branch counter
    // the extension records when the message is submitted is what tells the
    // consuming request that the branch changed.
    const host = fakeHost({ ui: scriptedUI({ keys: [pickRow(0)], editor: ["maple"] }) });
    enablePin(host);

    await runCommand(host);
    host.emit("session_branch", { type: "session_branch" });
    consume(host);

    expect(recordsOf(host)).toEqual([]);
    // The refusal is handed over when the run that read the message ends.
    endRun(host);
    expect(host.sent.map((entry) => entry.message.customType)).toEqual([OUTCOME_TYPE]);
    expect(String(receipts(host).at(-1)?.message)).toContain("another branch");
  });

  test("does not apply a confirmed write on a branch that still holds the recorded entry", async () => {
    // The branch the user moves to still holds the entry the draft recorded, so
    // that entry alone would accept the write; the branch counter does not.
    const host = fakeHost({
      ui: scriptedUI({
        keys: [pickRow(0), pickRow(0)],
        editor: ["maple", "spruce"],
      }),
    });
    enablePin(host);
    await runAndConsume(host);

    // The user confirms a second write, then moves on before the host runs it.
    await runCommand(host);
    const recorded = host.journal.at(-1)?.id;
    host.emit("session_branch", { type: "session_branch" });
    consume(host);

    expect(recordsOf(host)).toHaveLength(1);
    expect(recordsOf(host).at(-1)?.data).toMatchObject({ body: "maple" });
    expect(host.journal.some((entry) => entry.id === recorded)).toBe(true);
    expect(String(receipts(host).at(-1)?.message)).toContain("another branch");
  });

  test("unpins only after the confirmation", async () => {
    const host = fakeHost({ ui: scriptedUI({ keys: [pickRow(0)], editor: ["maple"] }) });
    enablePin(host);
    await runAndConsume(host);

    const cancelled = fakeHost({
      journal: [...host.journal],
      ui: scriptedUI({ keys: [pickRow(1)], select: ["Unpin"], confirm: [false] }),
    });
    enablePin(cancelled);
    await runCommand(cancelled);
    expect(cancelled.submitted).toEqual([]);
    expect(cancelled.appended).toEqual([]);

    const confirmed = fakeHost({
      journal: [...host.journal],
      ui: scriptedUI({ keys: [pickRow(1)], select: ["Unpin"], confirm: [true] }),
    });
    enablePin(confirmed);
    await runAndConsume(confirmed);
    expect(confirmed.appended).toHaveLength(1);
    expect(confirmed.appended[0]?.data).toMatchObject({ action: "delete", source: "user" });
  });

  test("reports an unusable range instead of offering to edit it", async () => {
    const host = fakeHost({ ui: scriptedUI({ keys: [pickRow(0)], editor: ["maple"] }) });
    enablePin(host);
    await runAndConsume(host);

    const damaged = fakeHost({ journal: host.journal, ui: scriptedUI({}) });
    damaged.journal.push({ id: "j-bad", type: "custom", customType: RECORD_TYPE, data: "not a record" });
    enablePin(damaged);
    await runCommand(damaged);

    expect(damaged.appended).toEqual([]);
    expect(receipts(damaged)[0]?.kind).toBe("error");
    expect(receipts(damaged)[0]?.message).toContain("unavailable");
  });

  test("says so when the host has no interactive interface", async () => {
    const host = fakeHost({ hasUI: false, ui: scriptedUI({ keys: [pickRow(0)] }) });
    enablePin(host);

    await runCommand(host);

    expect(host.journal).toEqual([]);
    expect(receipts(host)[0]?.kind).toBe("warning");
    expect(receipts(host)[0]?.message).toContain("interactive");
  });

  test("shows the current usage against the branch limit", async () => {
    const host = fakeHost({ ui: scriptedUI({ keys: [] }) });
    enablePin(host);

    await runCommand(host);

    expect(host.ui.listLines[0]).toContain(`0 of ${MAX_BRANCH_BYTES_LABEL} UTF-8 bytes`);
  });
});

describe("command registration", () => {
  test("numbers each row with the entry it names and folds its body", () => {
    const state = replay([stored(1, "  a   body\n\nwith  gaps  ", "j-1"), stored(2, "b", "j-2")]);

    expect(pinRows(state)).toEqual([
      { value: "add", label: "Add a new pin" },
      { value: "1", icon: "#1", label: "a body with gaps" },
      { value: "2", icon: "#2", label: "b" },
      { value: "close", label: "Close" },
    ]);
  });

  test("leaves the body of a row whole, for the width it is drawn at to cut", () => {
    const emoji = "🙂".repeat(80);
    const state = replay([stored(1, emoji, "j-1")]);
    const row = pinRows(state)[1];

    // Nothing is dropped before the row is drawn, so a wide terminal shows the
    // body that a narrow one cuts.
    expect(row?.label).toBe(emoji);
    expect(row?.icon).toBe("#1");
  });

  test("cuts the body to the width of the terminal it is drawn at", async () => {
    const body = "first body that runs past the narrow terminal and keeps running";
    const host = fakeHost({
      journal: [] as never[],
      ui: scriptedUI({ width: 24, keys: [pickRow(1), cancelRow] }),
    });
    enablePin(host);
    host.push(stored(1, body, "j-1") as never);

    await runCommand(host);

    // The title comes first, then the rows: creating, the entry, closing.
    const rows = host.ui.listLines;
    expect(rows[0]).toContain("Pinned text (");
    expect(rows[1]).toBe("     Add a new pin");
    expect(rows[2]?.startsWith("> #1 first body")).toBe(true);
    // The row is cut, not rearranged: what it shows is the start of the body.
    expect(rows[2]).not.toBe(`> #1 ${body}`);
    expect(rows[2]?.endsWith("…")).toBe(true);
    expect(rows[3]).toBe("     Close");
    // Every row fits the width it was rendered at.
    for (const line of rows) expect([...line].length).toBeLessThanOrEqual(24);
  });

  test("shows the whole body when the terminal is wide enough", async () => {
    const body = "first body that runs past the narrow terminal and keeps running";
    const host = fakeHost({
      journal: [] as never[],
      ui: scriptedUI({ width: 90, keys: [pickRow(1), cancelRow] }),
    });
    enablePin(host);
    host.push(stored(1, body, "j-1") as never);

    await runCommand(host);

    const rows = host.ui.listLines;
    expect(rows[0]).toContain(`of ${MAX_BRANCH_BYTES_LABEL} UTF-8 bytes`);
    expect(rows[1]).toBe("     Add a new pin");
    expect(rows[2]).toBe(`> #1 ${body}`);
  });

  test("shows more of the body when the terminal grows, keeping the number", async () => {
    const body = "a body long enough that a narrow terminal cuts it and a wide one shows it whole";
    const host = fakeHost({
      journal: [] as never[],
      ui: scriptedUI({ widths: [32, 120], keys: [cancelRow] }),
    });
    enablePin(host);
    host.push(stored(1, body, "j-1") as never);

    await runCommand(host);

    const narrow = host.ui.listRenders[0] ?? [];
    const wide = host.ui.listRenders[1] ?? [];
    const entryRow = (rows: string[]) => rows.find((row) => row.includes("a body long enough")) ?? "";

    // A narrow row shows the body prefix followed by the truncation marker.
    const narrowRow = entryRow(narrow);
    const narrowBody = narrowRow.slice("  #1 ".length);
    expect(narrowRow.startsWith("  #1 a body long enough")).toBe(true);
    expect(narrowBody.endsWith("…")).toBe(true);
    expect(body.startsWith(narrowBody.slice(0, -1))).toBe(true);
    expect(narrowBody.length).toBeLessThan(body.length);
    for (const line of narrow) expect(visibleWidth(line)).toBeLessThanOrEqual(32);
    // The next render is drawn at the width the terminal now has, and the same
    // body reads whole with the number still in front of it.
    expect(entryRow(wide)).toBe(`  #1 ${body}`);
    expect(host.ui.listWidths).toEqual([32, 120]);
  });

  test("cuts a wide body by the columns it is drawn in", async () => {
    const body = "报告使用简体中文，交付文件为中文材料，条目正文逐字保留";
    const host = fakeHost({
      journal: [] as never[],
      ui: scriptedUI({ width: 30, keys: [cancelRow] }),
    });
    enablePin(host);
    host.push(stored(1, body, "j-1") as never);

    await runCommand(host);

    const row = host.ui.listLines.find((line) => line.includes("报告")) ?? "";
    expect(row.startsWith("  #1 报告使用简体中文")).toBe(true);
    expect(visibleWidth(row)).toBeLessThanOrEqual(30);
    expect(row).not.toBe(`  #1 ${body}`);
  });

  test("aligns the numbers of entries that leave gaps", async () => {
    const host = fakeHost({
      journal: [] as never[],
      ui: scriptedUI({ width: 40, keys: [cancelRow] }),
    });
    enablePin(host);
    host.push(stored(1, "first body", "j-1") as never);
    host.push(stored(12, "twelfth body", "j-2") as never);

    await runCommand(host);

    const rows = host.ui.listLines;
    const first = rows.find((row) => row.includes("first body")) ?? "";
    const twelfth = rows.find((row) => row.includes("twelfth body")) ?? "";
    // The numbers stand in one column, so the bodies start together even though
    // the ids have different lengths.
    expect(first.indexOf("first body")).toBe(twelfth.indexOf("twelfth body"));
    expect(twelfth.startsWith("  #12 ")).toBe(true);
  });

  test("filters the list by what the user types and selects the entry it names", async () => {
    const host = fakeHost({
      journal: [] as never[],
      ui: scriptedUI({ width: 40, rows: 8, keys: [["spr", ...pickRow(0)]] }),
    });
    enablePin(host);
    host.push(stored(1, "maple body", "j-1") as never);
    host.push(stored(2, "spruce body", "j-2") as never);

    await runCommand(host);

    expect(host.ui.listLines.some((row) => row.includes("Search: spr"))).toBe(true);
    // The chosen row is the entry itself, addressed by its number.
    expect(host.ui.selectTitles.some((title) => title.startsWith("Entry #2"))).toBe(true);
  });
});

describe("the inline add form", () => {
  test("pins the text the user typed, without opening a dialog", async () => {
    const host = fakeHost();
    enablePin(host);

    await runCommand(host, "add maple");

    expect(host.ui.selectTitles).toEqual([]);
    expect(host.submitted).toHaveLength(1);
    // The message is the text the user confirmed, with nothing added to it.
    expect(host.submitted[0]?.content).toBe("maple");

    consume(host);

    expect(recordsOf(host)).toHaveLength(1);
    expect(host.appended[0]?.data).toMatchObject({ action: "create", source: "user", body: "maple" });
  });

  test("keeps the body exactly as it arrived", async () => {
    const host = fakeHost();
    enablePin(host);
    const body = "  two  spaces\n\nlast line  ";

    await runCommand(host, `add ${body}`);

    const sent = host.submitted[0]?.content ?? "";
    expect(sent).toBe(body);
    consume(host);
    expect(host.appended[0]?.data).toMatchObject({ body });
  });

  test("answers a missing body with usage and sends nothing", async () => {
    const host = fakeHost();
    enablePin(host);

    await runCommand(host, "add");

    expect(host.submitted).toEqual([]);
    expect(host.journal).toEqual([]);
    expect(receipts(host).at(-1)).toEqual({ kind: "warning", message: USAGE_TEXT });
  });

  test("answers a subcommand it does not have with usage and sends nothing", async () => {
    const host = fakeHost();
    enablePin(host);

    await runCommand(host, "remove 7");

    expect(host.submitted).toEqual([]);
    expect(host.journal).toEqual([]);
    expect(receipts(host).at(-1)).toEqual({ kind: "warning", message: USAGE_TEXT });
  });

  test("offers creating first, the entries in creation order, and closing last", async () => {
    const host = fakeHost({ journal: [] as never[] });
    enablePin(host);
    host.push(stored(2, "second body", "j-2") as never);
    host.push(stored(1, "first body", "j-1") as never);

    await runCommand(host);

    expect(pinRows(replay(host.journal)).map((row) => row.icon ?? row.label)).toEqual([
      "Add a new pin",
      "#2",
      "#1",
      "Close",
    ]);
  });
});
