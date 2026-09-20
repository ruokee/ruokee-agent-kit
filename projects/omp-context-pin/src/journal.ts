/**
 * Reading the current branch as the input of replay.
 *
 * The host hands back a path of session entries in its own order. This module
 * rebuilds the root-to-leaf order from the `parentId` links so replay does not
 * depend on that order, and it narrows every entry to the fields replay reads.
 * A branch that cannot be read reports failure instead of an empty journal,
 * because an empty journal would look like an empty pin set.
 */

import type { JournalEntry } from "./state.ts";

/** Minimal read-only view of the host session the extension needs. */
export interface SessionReader {
  getBranch(fromId?: string): readonly unknown[];
  /**
   * Every entry of the session, across all its branches.
   *
   * Identity allocation reads this: entry and operation numbers are session
   * wide, so a bind to allocate them has to see the entries of branches this
   * request does not hold.
   */
  getEntries?(): readonly unknown[];
}

export type JournalRead = { ok: true; entries: JournalEntry[] } | { ok: false; detail: string };

/** Session entry as it arrives from the host, before narrowing. */
export interface RawEntry {
  id: string;
  parentId?: string;
  type: string;
  customType?: unknown;
  data?: unknown;
  details?: unknown;
  content?: unknown;
  summary?: unknown;
  /** Payload of a `message` entry, which is how a submitted operation is read. */
  message?: unknown;
}

function asRawEntry(value: unknown): RawEntry | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || raw.id.length === 0) return undefined;
  if (typeof raw.type !== "string" || raw.type.length === 0) return undefined;
  const entry: RawEntry = { id: raw.id, type: raw.type };
  if (typeof raw.parentId === "string" && raw.parentId.length > 0) entry.parentId = raw.parentId;
  if (raw.customType !== undefined) entry.customType = raw.customType;
  if (raw.data !== undefined) entry.data = raw.data;
  if (raw.details !== undefined) entry.details = raw.details;
  if (raw.content !== undefined) entry.content = raw.content;
  if (raw.summary !== undefined) entry.summary = raw.summary;
  if (raw.message !== undefined) entry.message = raw.message;
  return entry;
}

/**
 * Order a branch root first.
 *
 * The host may return either direction; walking `parentId` links gives one
 * order for both. A branch that links its entries but is not a single path
 * describes the wrong history for replay, so it is reported instead of guessed
 * at; a branch that carries no links at all is already the host's own order and
 * is kept as it arrived.
 */
export function orderBranch(entries: readonly RawEntry[]): RawEntry[] | string {
  if (entries.length === 0) return [];
  const known = new Set<string>();
  for (const entry of entries) {
    if (known.has(entry.id)) return `branch contains the entry id ${entry.id} twice`;
    known.add(entry.id);
  }

  const children = new Map<string, RawEntry[]>();
  let heads = 0;
  let linked = 0;
  for (const entry of entries) {
    const parent = entry.parentId;
    if (parent === undefined || !known.has(parent)) {
      heads += 1;
      continue;
    }
    linked += 1;
    const siblings = children.get(parent);
    if (siblings === undefined) children.set(parent, [entry]);
    else siblings.push(entry);
  }
  if (linked === 0) return [...entries];
  if (heads !== 1) return `branch has ${heads} starting entries instead of one`;

  for (const [id, siblings] of children) {
    if (siblings.length > 1) return `branch forks at ${id}`;
  }

  const head = entries.find((entry) => entry.parentId === undefined || !known.has(entry.parentId));
  const ordered: RawEntry[] = [];
  let current: RawEntry | undefined = head;
  while (current !== undefined) {
    ordered.push(current);
    if (ordered.length > entries.length) return "branch contains a parent cycle";
    current = children.get(current.id)?.[0];
  }
  if (ordered.length !== entries.length) return "branch is not one connected path";
  return ordered;
}

/**
 * Read every entry of the session, across branches, as identity-scan input.
 *
 * The host order is kept: the scan reads numbers, not a sequence of
 * operations, so the order of the values does not matter.
 */
export function readSession(reader: SessionReader): JournalRead {
  const source = reader.getEntries;
  if (typeof source !== "function") {
    return { ok: false, detail: "the host does not expose every session entry" };
  }
  let session: readonly unknown[];
  try {
    session = source.call(reader);
  } catch (error) {
    return { ok: false, detail: `getEntries failed: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!Array.isArray(session)) return { ok: false, detail: "getEntries did not return an array" };

  const entries: RawEntry[] = [];
  for (const [position, value] of session.entries()) {
    const entry = asRawEntry(value);
    if (entry === undefined) return { ok: false, detail: `entry ${position} is not a session entry` };
    entries.push(entry);
  }
  return { ok: true, entries };
}

/** Read the current branch of a session as replay input. */
export function readJournal(reader: SessionReader): JournalRead {
  let branch: readonly unknown[];
  try {
    branch = reader.getBranch();
  } catch (error) {
    return { ok: false, detail: `getBranch failed: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!Array.isArray(branch)) return { ok: false, detail: "getBranch did not return an array" };

  const entries: RawEntry[] = [];
  for (const [position, value] of branch.entries()) {
    const entry = asRawEntry(value);
    if (entry === undefined) return { ok: false, detail: `entry ${position} is not a session entry` };
    entries.push(entry);
  }

  const ordered = orderBranch(entries);
  if (typeof ordered === "string") return { ok: false, detail: ordered };
  return { ok: true, entries: ordered };
}
