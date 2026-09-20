/**
 * Provider-facing text for pin projections.
 *
 * A projection carries the pinned bodies verbatim, so the text separates that
 * reference data from the management line above it and labels each fence with
 * the entry identity and revision. The fences grow until the body cannot
 * contain them, which keeps a body that looks like a delimiter from closing its
 * own block.
 *
 * Nothing here depends on the current time, request counters or estimates: the
 * same state produces byte-identical text.
 */

import { byteLength } from "./limits.ts";
import type { PinRecord } from "./record.ts";
import type { PinEntryState } from "./state.ts";

/** Header of a change sent as a tail message. */
const CHANGE_HEADER = "Pinned text update from omp-context-pin.";

/** Header of the base snapshot restored after a committed compaction. */
const SNAPSHOT_HEADER = "Pinned text restored by omp-context-pin after a committed compaction.";

/**
 * Standing note attached to every projection.
 *
 * Pinned text is context the session keeps, not a message that loses its
 * meaning by being pinned, and not one that gains authority either: the note
 * says both, so a requirement pinned as background still holds while being
 * pinned is not itself proof that its work is outstanding.
 */
const REFERENCE_NOTE =
  "The fenced text below is session context kept verbatim. Its facts and the requirements that still apply remain in force; being pinned gives it no further authority and does not mean the task that produced it runs again.";

function fence(label: string, body: string): { open: string; close: string } {
  let suffix = "";
  let open = `<<<pin ${label}>>>`;
  let close = `<<<end pin ${label}>>>`;
  while (body.includes(open) || body.includes(close)) {
    suffix += "+";
    open = `<<<pin ${label}${suffix}>>>`;
    close = `<<<end pin ${label}${suffix}>>>`;
  }
  return { open, close };
}

/** One fenced body with its entry header. */
export function entryBlock(entry: PinEntryState): string {
  const label = `${entry.entryId}@${entry.revision}`;
  const { open, close } = fence(label, entry.body);
  return `Entry #${entry.entryId}, revision ${entry.revision}, source ${entry.source}\n${open}\n${entry.body}\n${close}`;
}

/** Tail message describing one accepted change. */
export function changeText(record: PinRecord): string {
  const action = record.action === "create" ? "created" : record.action === "update" ? "updated" : "unpinned";
  const lines = [CHANGE_HEADER, `Entry: #${record.entryId}`, `Revision: ${record.revision}`, `Action: ${action}`];

  if (record.action === "delete") {
    lines.push(
      "This entry is no longer pinned. An older copy may stay in history until the next committed compaction.",
    );
    return `${lines.join("\n")}\n`;
  }

  const body = record.body ?? "";
  const { open, close } = fence(`${record.entryId}@${record.revision}`, body);
  lines.push(REFERENCE_NOTE, open, body, close);
  return `${lines.join("\n")}\n`;
}

/** Base snapshot for the committed compaction boundary that covers these entries. */
export function snapshotText(entries: readonly PinEntryState[], boundaryEntryId: string): string | undefined {
  if (entries.length === 0) return undefined;
  const total = entries.reduce((sum, entry) => sum + byteLength(entry.body), 0);
  const header = [
    SNAPSHOT_HEADER,
    `Boundary: ${boundaryEntryId}`,
    `Entries: ${entries.length}, ${total} UTF-8 bytes`,
    REFERENCE_NOTE,
  ];
  return `${header.join("\n")}\n\n${entries.map((entry) => entryBlock(entry)).join("\n\n")}\n`;
}
