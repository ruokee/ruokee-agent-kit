/**
 * Canonical pin state.
 *
 * The append-only operation log inside the current branch is authoritative:
 * entries and tail messages are projections of it. This module replays a branch
 * so that both entry points share one set of rules for the active entries,
 * revision numbers, capacity, damage and the operations that still lack a
 * projection.
 *
 * Replay is total and does not throw. A range that cannot be read stays
 * unavailable instead of degrading into a plausible-looking subset, and the
 * caller freezes writes, snapshots and recovery projections for it.
 */

import { checkCapacity, byteLength, type CapacityOverflow } from "./limits.ts";
import { changeText } from "./projection.ts";
import {
  PROJECTION_TYPE,
  RECORD_SCHEMA_VERSION,
  RECORD_TYPE,
  type PinRecord,
  type PinSource,
  parseProjectionDetails,
  parseRecord,
  sameOperation,
} from "./record.ts";

/** Host journal entry, reduced to the fields replay reads. */
export interface JournalEntry {
  /** Host entry identity. */
  id: string;
  /** Host entry type, such as `custom`, `custom_message`, `compaction` or `reset_boundary`. */
  type: string;
  /** Custom type of a `custom` or `custom_message` entry. */
  customType?: unknown;
  /** Payload of a `custom` entry. */
  data?: unknown;
  /** Details of a `custom_message` entry. */
  details?: unknown;
  /** Content of a `custom_message` entry. */
  content?: unknown;
  /** Summary text of a `compaction` entry. */
  summary?: unknown;
  /** Payload of a `message` entry, the carrier of a submitted operation. */
  message?: unknown;
}

/** One entry of the active set. */
export interface PinEntryState {
  entryId: number;
  revision: number;
  body: string;
  /** Entry point that created the entry; later authors do not change it. */
  source: PinSource;
}

/** Why a range is unavailable. */
export type RangeProblemKind =
  "unsupported-schema-version" | "damaged-record" | "illegal-sequence" | "conflicting-operation";

/** Damage that makes the current range unreadable. */
export interface RangeProblem {
  kind: RangeProblemKind;
  /** Journal entry that caused the problem. */
  entryId: string;
  detail: string;
}

/** Active set as of the latest committed compaction in this range. */
export interface CompactionBoundary {
  /** Journal entry of the compaction that committed this boundary. */
  entryId: string;
  /** Entries that were active when the compaction committed. */
  entries: PinEntryState[];
  /** Accepted records at or before the boundary. */
  recordCount: number;
  /** Host summary text of that compaction, used to place the base snapshot. */
  summary?: string;
}

/** Replayed state of one branch. */
export interface PinState {
  /** Whether the range can be read, written and projected. */
  available: boolean;
  problem?: RangeProblem;
  /** Active entries, in creation order. */
  entries: PinEntryState[];
  /** UTF-8 size of all active bodies. */
  usedBytes: number;
  /** Accepted records of this range, in journal order. */
  records: PinRecord[];
  /**
   * Accepted operation identity to its canonical record, for the whole
   * session; a reset ends the active set without retiring an identity, so a
   * retried invocation is still recognized after one.
   */
  acceptedOperations: Map<number, PinRecord>;
  /** Entry numbers used in this session, including deleted and pre-reset ones. */
  usedEntryIds: Set<number>;
  /**
   * Operation identities whose change a projection in this range carries as
   * readable text. The projection must name an accepted operation and repeat
   * that operation's own text; anything else leaves the change undelivered so
   * the next request carries it.
   */
  projectedOperationIds: Set<number>;
  /** Journal entry that started this range, when the branch has a reset boundary. */
  resetBoundaryEntryId?: string;
  /** Latest committed compaction in this range, when the branch has one. */
  compactionBoundary?: CompactionBoundary;
}

/** Listing row shared by both entry points. */
export interface EntrySummary {
  entryId: number;
  /** Start of the body, for display only. */
  summary: string;
  source: PinSource;
  revision: number;
  bytes: number;
}

/** Longest preview of one body in a listing, in code points. */
export const MAX_SUMMARY_POINTS = 60;

/**
 * One body as a single display line.
 *
 * Runs of whitespace fold into one space. Nothing is cut here: a row that has to
 * fit a width is cut where it is drawn, so the same body shows as much as the
 * row has room for. The body itself is unchanged.
 */
export function foldBody(body: string): string {
  return body.replace(/\s+/gu, " ").trim();
}

/**
 * Preview of one body in a listing.
 *
 * The folded line is cut after `MAX_SUMMARY_POINTS` code points so a listing
 * stays small and a body is read whole with a `get`, and the cut never splits a
 * surrogate pair. A row the user picks from is drawn by the host component
 * instead, and that one is cut to the width it is drawn at.
 */
export function entrySummary(body: string): string {
  const folded = foldBody(body);
  const points = [...folded];
  if (points.length <= MAX_SUMMARY_POINTS) return folded;
  return `${points.slice(0, MAX_SUMMARY_POINTS).join("")}…`;
}

function totalBytes(entries: readonly PinEntryState[]): number {
  let total = 0;
  for (const entry of entries) total += byteLength(entry.body);
  return total;
}

/**
 * Apply one accepted record to the active entries.
 *
 * Returns the next active set, or a description of the structural violation
 * that makes the range unusable. Revision gaps and writes to unknown or reused
 * identities are not repaired: skipping them would revive an older revision.
 */
export function applyRecord(entries: readonly PinEntryState[], record: PinRecord): PinEntryState[] | string {
  const index = entries.findIndex((entry) => entry.entryId === record.entryId);

  if (record.action === "create") {
    if (record.revision !== 1) {
      return `create of ${record.entryId} carries revision ${record.revision} instead of 1`;
    }
    if (index >= 0) return `create reuses the active entry #${record.entryId}`;
    return [
      ...entries,
      {
        entryId: record.entryId,
        revision: 1,
        body: record.body ?? "",
        source: record.source,
      },
    ];
  }

  if (index < 0) return `${record.action} of ${record.entryId} has no active entry`;
  const current = entries[index]!;
  if (record.revision !== current.revision + 1) {
    return `${record.action} of ${record.entryId} carries revision ${record.revision}, expected ${current.revision + 1}`;
  }

  if (record.action === "update") {
    const next = [...entries];
    next[index] = {
      entryId: current.entryId,
      revision: record.revision,
      body: record.body ?? "",
      source: current.source,
    };
    return next;
  }

  return entries.filter((_, position) => position !== index);
}

/**
 * Replay one branch, oldest entry first.
 *
 * `sessionId` is the session the host reports for this journal, and it is what
 * tells a projection of this range from one another session queued here.
 *
 * A reset ends the active set, so the range after the latest reset boundary is
 * what this branch holds now. Damage recorded before that boundary cannot reach
 * the range the reset started, and the identities read before the damage still
 * count as retired. Damage inside the current range still makes it unreadable:
 * skipping it would revive an older revision.
 */
export function replay(journal: readonly JournalEntry[], sessionId?: string): PinState {
  let entries: PinEntryState[] = [];
  let records: PinRecord[] = [];
  const acceptedOperations = new Map<number, PinRecord>();
  const usedEntryIds = new Set<number>();
  let projectedOperationIds = new Set<number>();
  let resetBoundaryEntryId: string | undefined;
  let compactionBoundary: CompactionBoundary | undefined;
  let problem: RangeProblem | undefined;

  const snapshot = (available: boolean, problem?: RangeProblem): PinState => ({
    available,
    problem,
    entries,
    usedBytes: totalBytes(entries),
    records,
    acceptedOperations,
    usedEntryIds,
    projectedOperationIds,
    resetBoundaryEntryId,
    compactionBoundary,
  });

  for (const entry of journal) {
    if (entry.type === "reset_boundary") {
      // A reset ends the active set and everything the range before it found,
      // including its damage. Operation and entry identities stay on the
      // ledger: an invocation accepted before the reset is still the same
      // invocation, and a retired entry id is still retired.
      entries = [];
      records = [];
      projectedOperationIds = new Set();
      compactionBoundary = undefined;
      resetBoundaryEntryId = entry.id;
      problem = undefined;
      continue;
    }

    // The first damage of the range stops the range. The records after it
    // cannot be read against a state that is already in question, so they are
    // left to a later reset instead of being applied to a partial state, and
    // the ledger stops there as well.
    if (problem !== undefined) continue;

    if (entry.type === "compaction") {
      compactionBoundary = {
        entryId: entry.id,
        entries: [...entries],
        recordCount: records.length,
        summary: typeof entry.summary === "string" ? entry.summary : undefined,
      };
      continue;
    }

    if (entry.type === "custom_message" && entry.customType === PROJECTION_TYPE) {
      const details = parseProjectionDetails(entry.details);
      if (details === undefined || details.kind === "snapshot") continue;
      // A projection written in another session or another pin period is a
      // carrier that session moved on from: it does not count as published
      // here, so the change it names is written into the request instead.
      if (details.sessionId !== sessionId || details.periodEntryId !== resetBoundaryEntryId) continue;
      const record = acceptedOperations.get(details.operationId);
      // A projection counts as published only when it names an accepted
      // operation, agrees with it, and carries the text that record produces.
      // Anything else is ignored, so the change it claims to carry is written
      // into the next request instead.
      if (record === undefined) continue;
      if (record.entryId !== details.entryId || record.revision !== details.revision) continue;
      if (record.action !== details.action) continue;
      if (typeof entry.content !== "string" || entry.content !== changeText(record)) continue;
      projectedOperationIds.add(details.operationId);
      continue;
    }

    if (entry.type !== "custom" || entry.customType !== RECORD_TYPE) continue;

    const parsed = parseRecord(entry.data);
    if (!parsed.ok) {
      problem = {
        kind: parsed.problem === "unsupported-schema-version" ? "unsupported-schema-version" : "damaged-record",
        entryId: entry.id,
        detail: `${parsed.field}: ${parsed.detail}`,
      };
      continue;
    }

    const record = parsed.record;
    const accepted = acceptedOperations.get(record.operationId);
    if (accepted !== undefined) {
      // A retry of an accepted call is the same operation, not a second one;
      // the same identity carrying other content cannot be read as a retry.
      if (sameOperation(accepted, record)) continue;
      problem = {
        kind: "conflicting-operation",
        entryId: entry.id,
        detail: "the same operation was accepted earlier with different content",
      };
      continue;
    }
    if (record.action === "create" && usedEntryIds.has(record.entryId)) {
      problem = {
        kind: "illegal-sequence",
        entryId: entry.id,
        detail: `create reuses the retired entry #${record.entryId}`,
      };
      continue;
    }

    const next = applyRecord(entries, record);
    if (typeof next === "string") {
      problem = { kind: "illegal-sequence", entryId: entry.id, detail: next };
      continue;
    }

    entries = next;
    records.push(record);
    acceptedOperations.set(record.operationId, record);
    usedEntryIds.add(record.entryId);
  }

  // A write the user confirmed is carried by the message the host ran, and
  // that message holds the accepted body: the range already expresses the
  // change, so no copy of it is written for the request. An Agent write has no
  // such carrier, so it counts as published only through a projection.
  for (const record of records) {
    if (record.source === "user") projectedOperationIds.add(record.operationId);
  }

  return problem === undefined ? snapshot(true) : snapshot(false, problem);
}

/** Active entry with this identity, when it exists. */
export function findEntry(state: PinState, entryId: number): PinEntryState | undefined {
  return state.entries.find((entry) => entry.entryId === entryId);
}

/** Accepted record with this operation identity, when it exists. */
export function findRecord(state: PinState, operationId: number): PinRecord | undefined {
  return state.acceptedOperations.get(operationId);
}

/**
 * Accepted operation of one Agent tool call, when this call was accepted.
 *
 * The host repeats the call id of a retried call, so this is what lets a retry
 * reuse the operation number its earlier attempt was accepted with.
 */
export function findOperationByCall(state: PinState, toolCallId: string): PinRecord | undefined {
  for (const record of state.acceptedOperations.values()) {
    if (record.toolCallId === toolCallId) return record;
  }
  return undefined;
}

/** Branch bytes that an update of this entry would keep, or the current total. */
export function retainedBytes(state: PinState, entryId?: number): number {
  if (entryId === undefined) return state.usedBytes;
  const entry = findEntry(state, entryId);
  return entry === undefined ? state.usedBytes : state.usedBytes - byteLength(entry.body);
}

/** Rows for `list`, in creation order. */
export function summarize(state: PinState): EntrySummary[] {
  return state.entries.map((entry) => ({
    entryId: entry.entryId,
    summary: entrySummary(entry.body),
    source: entry.source,
    revision: entry.revision,
    bytes: byteLength(entry.body),
  }));
}

/** Reason a planned operation cannot be accepted. */
export type MutationErrorCode =
  | "state-unavailable"
  | "empty-body"
  | "capacity"
  | "unknown-entry"
  | "stale-revision"
  | "duplicate-entry"
  | "conflicting-operation"
  | "no-change";

/** Rejected operation, with everything the caller needs to report it. */
export interface MutationError {
  code: MutationErrorCode;
  message: string;
  /** Declared limit, the current size and the size the operation would reach. */
  capacity?: CapacityOverflow;
  /** Current revision of the addressed entry, when the caller can retry. */
  currentRevision?: number;
}

/** Result of planning one write. */
export type MutationPlan =
  | { kind: "append"; record: PinRecord; next: PinState }
  | { kind: "duplicate"; record: PinRecord }
  | { kind: "no-change"; entry: PinEntryState }
  | { kind: "reject"; error: MutationError };

export interface CreateInput {
  operationId: number;
  entryId: number;
  body: string;
  source: PinSource;
  /** Host tool call of an Agent write, kept as its internal idempotency key. */
  toolCallId?: string;
}

export interface UpdateInput {
  operationId: number;
  entryId: number;
  body: string;
  source: PinSource;
  expectedRevision: number;
  toolCallId?: string;
}

export interface DeleteInput {
  operationId: number;
  entryId: number;
  source: PinSource;
  expectedRevision: number;
  toolCallId?: string;
}

function reject(code: MutationErrorCode, message: string, extra: Partial<MutationError> = {}): MutationPlan {
  return { kind: "reject", error: { code, message, ...extra } };
}

function unavailablePlan(state: PinState): MutationPlan | undefined {
  if (state.available) return undefined;
  const problem = state.problem;
  const detail = problem === undefined ? "unknown damage" : `${problem.kind} at ${problem.entryId} (${problem.detail})`;
  return reject("state-unavailable", `the current pin range is unavailable: ${detail}`);
}

/**
 * Whether an accepted record already answers this intended operation.
 *
 * A create allocates its entry identity at write time, so a retry carries the
 * same text under a fresh candidate identity; the accepted record decides what
 * that invocation created. An update or a delete addresses an entry that
 * already exists, so it also has to agree on the revision it expected: the same
 * identity and body expecting a later revision is another operation, not a
 * retry of the accepted one.
 */
function sameInvocation(accepted: PinRecord, record: PinRecord): boolean {
  if (accepted.action !== record.action || accepted.body !== record.body) return false;
  if (accepted.source !== record.source) return false;
  // One tool call is one operation: the same call id carrying other content is
  // another operation, not a retry of the accepted one.
  if (accepted.toolCallId !== record.toolCallId) return false;
  if (accepted.action === "create") return true;
  return accepted.entryId === record.entryId && accepted.revision === record.revision;
}

function duplicatePlan(state: PinState, record: PinRecord): MutationPlan | undefined {
  const accepted = findRecord(state, record.operationId);
  if (accepted === undefined) return undefined;
  // One identity carries one operation: a retry is the same operation, and the
  // same identity carrying other content or another expected revision is a
  // conflict, not a retry.
  return sameInvocation(accepted, record)
    ? { kind: "duplicate", record: accepted }
    : reject("conflicting-operation", `this write was already accepted as ${accepted.action} of #${accepted.entryId}`);
}

function capacityPlan(overflow: CapacityOverflow): MutationPlan {
  const scope = overflow.limit === "entry" ? "one body" : "the branch";
  return reject(
    "capacity",
    `${scope} would reach ${overflow.usedBytes} UTF-8 bytes, above the ${overflow.limitBytes} UTF-8 byte limit`,
    { capacity: overflow },
  );
}

/** State as it would be after an accepted record, used for receipts. */
function stateAfter(state: PinState, record: PinRecord): PinState {
  const entries = applyRecord(state.entries, record);
  if (typeof entries === "string") return state;
  return {
    ...state,
    entries,
    usedBytes: totalBytes(entries),
    records: [...state.records, record],
    acceptedOperations: new Map(state.acceptedOperations).set(record.operationId, record),
    usedEntryIds: new Set([...state.usedEntryIds, record.entryId]),
  };
}

/** Plan a new entry. */
export function planCreate(state: PinState, input: CreateInput): MutationPlan {
  const blocked = unavailablePlan(state);
  if (blocked !== undefined) return blocked;

  const record: PinRecord = {
    schemaVersion: RECORD_SCHEMA_VERSION,
    operationId: input.operationId,
    action: "create",
    entryId: input.entryId,
    revision: 1,
    body: input.body,
    source: input.source,
    toolCallId: input.toolCallId,
  };

  const duplicate = duplicatePlan(state, record);
  if (duplicate !== undefined) return duplicate;
  if (input.body.length === 0) return reject("empty-body", "a pin body must not be empty");
  if (state.usedEntryIds.has(input.entryId)) {
    return reject("duplicate-entry", `entry #${input.entryId} was already used on this branch`);
  }

  const overflow = checkCapacity(input.body, retainedBytes(state));
  if (overflow !== undefined) return capacityPlan(overflow);

  return { kind: "append", record, next: stateAfter(state, record) };
}

/** Plan a replacement of an existing body. */
export function planUpdate(state: PinState, input: UpdateInput): MutationPlan {
  const blocked = unavailablePlan(state);
  if (blocked !== undefined) return blocked;

  const candidate: PinRecord = {
    schemaVersion: RECORD_SCHEMA_VERSION,
    operationId: input.operationId,
    action: "update",
    entryId: input.entryId,
    revision: input.expectedRevision + 1,
    body: input.body,
    source: input.source,
    toolCallId: input.toolCallId,
  };

  const duplicate = duplicatePlan(state, candidate);
  if (duplicate !== undefined) return duplicate;

  const entry = findEntry(state, input.entryId);
  if (entry === undefined) {
    return reject("unknown-entry", `no active pin entry #${input.entryId}`);
  }
  if (input.expectedRevision !== entry.revision) {
    return reject(
      "stale-revision",
      `entry #${input.entryId} is at revision ${entry.revision}, not ${input.expectedRevision}`,
      { currentRevision: entry.revision },
    );
  }
  if (input.body.length === 0) return reject("empty-body", "a pin body must not be empty");
  if (input.body === entry.body) return { kind: "no-change", entry };

  const overflow = checkCapacity(input.body, retainedBytes(state, input.entryId));
  if (overflow !== undefined) return capacityPlan(overflow);

  return { kind: "append", record: candidate, next: stateAfter(state, candidate) };
}

/** Plan a deletion of an existing entry. */
export function planDelete(state: PinState, input: DeleteInput): MutationPlan {
  const blocked = unavailablePlan(state);
  if (blocked !== undefined) return blocked;

  const candidate: PinRecord = {
    schemaVersion: RECORD_SCHEMA_VERSION,
    operationId: input.operationId,
    action: "delete",
    entryId: input.entryId,
    revision: input.expectedRevision + 1,
    source: input.source,
    toolCallId: input.toolCallId,
  };

  const duplicate = duplicatePlan(state, candidate);
  if (duplicate !== undefined) return duplicate;

  const entry = findEntry(state, input.entryId);
  if (entry === undefined) {
    return reject("unknown-entry", `no active pin entry #${input.entryId}`);
  }
  if (input.expectedRevision !== entry.revision) {
    return reject(
      "stale-revision",
      `entry #${input.entryId} is at revision ${entry.revision}, not ${input.expectedRevision}`,
      { currentRevision: entry.revision },
    );
  }

  return { kind: "append", record: candidate, next: stateAfter(state, candidate) };
}
