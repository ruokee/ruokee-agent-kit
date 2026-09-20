/**
 * Receipts and listings shared by both entry points.
 *
 * The same helpers format the tool result and the command output, so a user and
 * the Agent read the same identities, revisions, sources and byte counts. A
 * receipt reports what the journal now holds; it does not promise that the host
 * has written the session file.
 */

import { MAX_BRANCH_BYTES_LABEL, MAX_ENTRY_BYTES_LABEL, byteLength } from "./limits.ts";
import type { PinRecord } from "./record.ts";
import type { EntrySummary, MutationError, PinEntryState, PinState, RangeProblem } from "./state.ts";
import type { OperationOutcome } from "./operations.ts";
import { summarize } from "./state.ts";

/** Capacity sentence used by listings, refusals and the tool description. */
export const LIMITS_SENTENCE = `one body: ${MAX_ENTRY_BYTES_LABEL} UTF-8 bytes; active bodies per branch: ${MAX_BRANCH_BYTES_LABEL} UTF-8 bytes`;

/** Persistence sentence used by both entry points. */
export const PERSISTENCE_NOTE =
  "Pins are read from this session's journal: in the host this component was inspected against, OMP writes the file when a caller asks it to, when the file is already on disk, or when the session already has an assistant reply; before that, a pin recorded there can be lost when the process exits, and a session the host does not persist keeps pins only while the process runs.";

/** Notice that a confirmed write was dropped because the session moved on. */
export const PENDING_LOST_TEXT =
  "A confirmed write was not applied: the host had not applied the message that carried it when the session changed.";

/** Size of one body as written in listings and receipts. */
function size(bytes: number): string {
  return `${bytes} UTF-8 bytes`;
}

/**
 * Short row for a selection list.
 *
 * The number is what the entry is addressed by later, and the body start is
 * shown beside it, so an entry needs no separate label. An empty body shows the
 * number alone.
 */
export function entryLabel(row: EntrySummary): string {
  return `#${row.entryId}${row.summary === "" ? "" : ` ${row.summary}`}`;
}

/** Full listing with the current branch total. */
export function listingText(state: PinState): string {
  if (state.entries.length === 0) {
    return `No pinned text on this branch (0 of ${MAX_BRANCH_BYTES_LABEL} UTF-8 bytes).`;
  }
  const rows = summarize(state).map(detailLine);
  return [
    `${state.entries.length} pinned ${state.entries.length === 1 ? "entry" : "entries"}, ${size(state.usedBytes)} active of ${MAX_BRANCH_BYTES_LABEL} UTF-8 bytes:`,
    ...rows,
  ].join("\n");
}

function detailLine(row: EntrySummary): string {
  const name = `#${row.entryId}${row.summary === "" ? "" : ` ${row.summary}`}`;
  return `- ${name}: revision ${row.revision}, source ${row.source}, ${size(row.bytes)}`;
}

/** One entry with its body verbatim. */
export function detailText(entry: PinEntryState): string {
  return [
    `Entry: #${entry.entryId}`,
    `Revision: ${entry.revision}`,
    `Source: ${entry.source}`,
    `Size: ${size(byteLength(entry.body))}`,
    "Body:",
    entry.body,
  ].join("\n");
}

/** Receipt for an appended operation. */
export function acceptanceText(record: PinRecord, state: PinState): string {
  const total = `branch now ${size(state.usedBytes)} active of ${MAX_BRANCH_BYTES_LABEL} UTF-8 bytes`;
  if (record.action === "delete") {
    return `Unpinned #${record.entryId} at revision ${record.revision} (${total}).`;
  }
  const body = record.body ?? "";
  const verb = record.action === "create" ? "Pinned" : "Updated";
  return `${verb} #${record.entryId} at revision ${record.revision} (${size(byteLength(body))}; ${total}).`;
}

/** Receipt for a call whose operation identity was already accepted. */
export function duplicateText(record: PinRecord): string {
  return `Already accepted as ${record.action} of #${record.entryId} at revision ${record.revision}; nothing was appended.`;
}

/** Receipt for an update that carries the current body. */
export function noChangeText(entry: PinEntryState): string {
  return `Entry #${entry.entryId} already has that body at revision ${entry.revision}; nothing was appended.`;
}

/** Refusal text, reporting the declared limit and the current usage. */
export function refusalText(error: MutationError): string {
  const lines = [error.message];
  const capacity = error.capacity;
  if (capacity !== undefined) {
    if (capacity.limit === "entry") {
      lines.push(
        `Limit: ${MAX_ENTRY_BYTES_LABEL} UTF-8 bytes per body. This body: ${size(capacity.bodyBytes)}; other active bodies on this branch: ${size(capacity.currentBytes)}.`,
      );
    } else {
      lines.push(
        `Limit: ${MAX_BRANCH_BYTES_LABEL} UTF-8 bytes of active bodies per branch. Other active bodies: ${size(capacity.currentBytes)}; with this body the branch would hold ${size(capacity.usedBytes)}.`,
      );
    }
  }
  if (error.currentRevision !== undefined) {
    lines.push(`Current revision: ${error.currentRevision}.`);
  }
  return lines.join("\n");
}

/** Report for a range that cannot be read. */
export function unavailableText(problem: RangeProblem | undefined): string {
  const detail = problem === undefined ? "unknown damage" : `${problem.kind} at journal entry ${problem.entryId}`;
  return [
    `The pinned text of this branch is unavailable: ${detail}.`,
    problem === undefined ? undefined : `Detail: ${problem.detail}`,
    "Records are kept as they are, and writes, snapshots and change messages stay frozen for this range.",
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n");
}

/** Longest reason a request diagnostic repeats. */
export const MAX_DIAGNOSTIC_DETAIL = 200;

/** Short reason a range cannot be read, naming the record that stopped it. */
export function problemDetailText(problem: RangeProblem): string {
  return `${problem.kind} at journal entry ${problem.entryId}: ${problem.detail}`;
}

/** One diagnostic for a request that cannot express the pin set. */
export function requestProblemText(detail: string): string {
  const reason = detail.length > MAX_DIAGNOSTIC_DETAIL ? detail.slice(0, MAX_DIAGNOSTIC_DETAIL) : detail;
  return `The pinned text of this branch cannot reach this request: ${reason}. Writes, snapshots and change messages stay frozen for this range; run /ctx-pin for the current state.`;
}

/** Report shown once a confirmed write was handed to the session. */
export function pendingText(): string {
  return "Submitted to the session as a user message. The operation is applied when the host runs that message; until then the pins are unchanged.";
}

/** Refusal for an operation written on another branch. */
export function movedBranchText(): string {
  return [
    "This operation belongs to another branch. Nothing was pinned here.",
    "Confirm the change again on this branch to apply it there.",
  ].join(" ");
}

/** Refusal for an operation written in another session or pin period. */
export function supersededText(): string {
  return [
    "This operation belongs to another session or pin period. Nothing was pinned here.",
    "Confirm the change again in this session to apply it there.",
  ].join(" ");
}

/**
 * Result of one operation a user message carried.
 *
 * The text says what happened in the words the entry points use, so a reader
 * gets the receipt of the operation the message above it carried, and it repeats
 * no body and no operation number: the entry number is the only number a reader
 * follows, and the metadata of the message, which no reader sees, names the
 * operation this result answers. The request that consumes the operation carries
 * this text, and the user sees the same text.
 */
export function carriedOutcomeText(outcome: OperationOutcome): string {
  const status = outcome.ok
    ? outcome.code === "ok"
      ? "accepted"
      : outcome.code === "duplicate"
        ? "already applied"
        : "made no change"
    : "not applied";
  // The reason is a sentence fragment, so the result names the outcome and then
  // gives the reason after a colon rather than starting a sentence with it.
  const lines = [`omp-context-pin ${status}: ${outcome.text}`];
  lines.push(
    outcome.ok
      ? "No further ctx_pin call is needed for this write."
      : "This write changed nothing; the rest of this message is unaffected.",
  );
  return lines.join("\n");
}
