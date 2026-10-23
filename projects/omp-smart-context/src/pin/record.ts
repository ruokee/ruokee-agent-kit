/**
 * Canonical operation records.
 *
 * Records are appended to the session journal under {@link RECORD_TYPE} and are
 * the only authoritative pin state; entries and tail messages are projections of
 * them. Parsing is strict about the documented fields, so a value that cannot be
 * read as one of the three actions makes the affected range unavailable instead
 * of quietly changing the pin set. Unknown extra fields are ignored: a payload
 * change that matters carries a different `schemaVersion`.
 */

/** Journal entry type holding these records. */
export const RECORD_TYPE = "omp-context-pin";

/** Custom message type carrying a change to the model. */
export const PROJECTION_TYPE = "omp-context-pin-change";

/** Payload version written by this component. */
export const RECORD_SCHEMA_VERSION = 2;

/** Operations that change pin state. */
export type PinAction = "create" | "update" | "delete";

/** Entry point that authored an operation. */
export type PinSource = "user" | "agent";

/** One accepted pin operation, as stored in the journal. */
export interface PinRecord {
  schemaVersion: number;
  /** Identity of one invocation, retained across its retries. */
  operationId: number;
  action: PinAction;
  /** Entry number, assigned at creation and never reused in this session. */
  entryId: number;
  /** Starts at 1 and advances by one on each accepted update or deletion. */
  revision: number;
  /** Complete new text for `create` and `update`; absent for `delete`. */
  body?: string;
  source: PinSource;
  /**
   * Host tool call that produced an Agent operation, kept as the internal
   * idempotency key of that call. A retry arrives under the same call id and
   * finds its accepted operation through this field, so the call reuses the
   * operation number it was accepted with instead of reserving another one.
   */
  toolCallId?: string;
}

/**
 * Metadata carried by a change projection.
 *
 * `kind` is absent for a change and `snapshot` for the base snapshot, which
 * carries no entry of its own. The fields repeat what the canonical record
 * holds, so replay can tell its own projection from a value that merely reuses
 * the custom type. The scope says which session and pin period the projection
 * belongs to: a projection is a carrier the host may hold for a later request,
 * so a session or period that moved on filters it out instead of reading it as
 * a change of its own range.
 */
/** Session and pin period one projection belongs to. */
export interface ProjectionScope {
  /** Session identity the host reports, when it reports one. */
  sessionId?: string;
  /** Journal entry that started the pin period, when the branch has one. */
  periodEntryId?: string;
}

/** Change projection of one accepted record. */
export interface ChangeProjectionDetails extends ProjectionScope {
  schemaVersion: number;
  kind?: undefined;
  operationId: number;
  entryId: number;
  revision: number;
  action: PinAction;
}

/** Base snapshot of one committed compaction boundary. */
export interface SnapshotProjectionDetails {
  schemaVersion: number;
  kind: "snapshot";
  boundaryEntryId?: string;
}

/** Metadata carried by a change projection or by the base snapshot. */
export type ProjectionDetails = ChangeProjectionDetails | SnapshotProjectionDetails;

/** Why a stored value is not a usable record. */
export type RecordProblem = "not-an-object" | "unsupported-schema-version" | "invalid-field";

/** A stored value that cannot be read as a record. */
export interface RecordFailure {
  ok: false;
  problem: RecordProblem;
  /** Field that failed, or `record` for the value as a whole. */
  field: string;
  detail: string;
}

/** A stored value read as a record. */
export interface RecordSuccess {
  ok: true;
  record: PinRecord;
}

export type RecordParse = RecordSuccess | RecordFailure;

const ACTION_BY_NAME: Record<string, PinAction> = { create: "create", update: "update", delete: "delete" };
const SOURCE_BY_NAME: Record<string, PinSource> = { user: "user", agent: "agent" };

const MAX_DESCRIBED_LENGTH = 60;

function describe(value: unknown): string {
  if (typeof value === "string") {
    return value.length <= MAX_DESCRIBED_LENGTH ? JSON.stringify(value) : `a ${value.length}-character string`;
  }
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  if (typeof value === "object") return "an object";
  if (typeof value === "function") return "a function";
  return String(value);
}

function fail(problem: RecordProblem, field: string, detail: string): RecordFailure {
  return { ok: false, problem, field, detail };
}

function requireText(value: unknown, field: string): string | RecordFailure {
  if (typeof value !== "string" || value.length === 0) {
    return fail("invalid-field", field, `expected a non-empty string, got ${describe(value)}`);
  }
  return value;
}

function requirePositiveInteger(value: unknown, field: string): number | RecordFailure {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    return fail("invalid-field", field, `expected a positive integer, got ${describe(value)}`);
  }
  return value;
}

/**
 * Read one stored value as a record.
 *
 * An empty `body` is accepted here: entry points reject an empty body before
 * appending, and a stored empty string is not damage to the log. This is
 * deliberately laxer than the entry-point rule so that as little as possible
 * can make a range unavailable.
 */
export function parseRecord(data: unknown): RecordParse {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return fail("not-an-object", "record", `expected an object, got ${describe(data)}`);
  }
  const raw = data as Record<string, unknown>;

  if (raw.schemaVersion !== RECORD_SCHEMA_VERSION) {
    return fail(
      "unsupported-schema-version",
      "schemaVersion",
      `expected ${RECORD_SCHEMA_VERSION}, got ${describe(raw.schemaVersion)}`,
    );
  }

  const operationId = requirePositiveInteger(raw.operationId, "operationId");
  if (typeof operationId !== "number") return operationId;

  const entryId = requirePositiveInteger(raw.entryId, "entryId");
  if (typeof entryId !== "number") return entryId;

  const revision = requirePositiveInteger(raw.revision, "revision");
  if (typeof revision !== "number") return revision;

  const action =
    typeof raw.action === "string" && Object.hasOwn(ACTION_BY_NAME, raw.action)
      ? ACTION_BY_NAME[raw.action]
      : undefined;
  if (action === undefined) {
    return fail("invalid-field", "action", `expected create, update, or delete, got ${describe(raw.action)}`);
  }

  const source =
    typeof raw.source === "string" && Object.hasOwn(SOURCE_BY_NAME, raw.source)
      ? SOURCE_BY_NAME[raw.source]
      : undefined;
  if (source === undefined) {
    return fail("invalid-field", "source", `expected user or agent, got ${describe(raw.source)}`);
  }

  let body: string | undefined;
  if (action === "delete") {
    if (raw.body !== undefined) {
      return fail("invalid-field", "body", "a delete record carries no body");
    }
  } else {
    if (typeof raw.body !== "string") {
      return fail("invalid-field", "body", `expected a string, got ${describe(raw.body)}`);
    }
    body = raw.body;
  }

  let toolCallId: string | undefined;
  if (raw.toolCallId !== undefined) {
    const parsed = requireText(raw.toolCallId, "toolCallId");
    if (typeof parsed !== "string") return parsed;
    toolCallId = parsed;
  }

  return {
    ok: true,
    record: {
      schemaVersion: RECORD_SCHEMA_VERSION,
      operationId,
      action,
      entryId,
      revision,
      body,
      source,
      toolCallId,
    },
  };
}

/** Metadata for the change projection of one accepted record. */
export function projectionDetails(record: PinRecord, scope: ProjectionScope = {}): ChangeProjectionDetails {
  return {
    schemaVersion: RECORD_SCHEMA_VERSION,
    operationId: record.operationId,
    entryId: record.entryId,
    revision: record.revision,
    action: record.action,
    sessionId: scope.sessionId,
    periodEntryId: scope.periodEntryId,
  };
}

/**
 * Read projection metadata, or `undefined` when the value is not one this
 * component wrote.
 *
 * Replay trusts a projection only through this reader: a value that misses a
 * field, carries another schema version, or names an operation the journal does
 * not hold stays unrecognized, so the change it claims to carry is delivered
 * again instead of being counted as published. The scope is read when it is
 * there and left out otherwise, so a carrier from a session or period without
 * one still reads as a projection of its own range.
 */
export function parseProjectionDetails(value: unknown): ProjectionDetails | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== RECORD_SCHEMA_VERSION) return undefined;

  // Only the base snapshot names a kind. Any other value is metadata this
  // component did not write, so it must not stand in for a change the request
  // is missing.
  if (raw.kind === "snapshot") {
    const boundaryEntryId = typeof raw.boundaryEntryId === "string" ? raw.boundaryEntryId : undefined;
    return { schemaVersion: RECORD_SCHEMA_VERSION, kind: "snapshot", boundaryEntryId };
  }
  if (raw.kind !== undefined) return undefined;

  const operationId = requirePositiveInteger(raw.operationId, "operationId");
  if (typeof operationId !== "number") return undefined;

  const entryId = requirePositiveInteger(raw.entryId, "entryId");
  if (typeof entryId !== "number") return undefined;

  const revision = requirePositiveInteger(raw.revision, "revision");
  if (typeof revision !== "number") return undefined;

  const action =
    typeof raw.action === "string" && Object.hasOwn(ACTION_BY_NAME, raw.action)
      ? ACTION_BY_NAME[raw.action]
      : undefined;
  if (action === undefined) return undefined;

  const details: ChangeProjectionDetails = {
    schemaVersion: RECORD_SCHEMA_VERSION,
    operationId,
    entryId,
    revision,
    action,
  };
  if (typeof raw.sessionId === "string") details.sessionId = raw.sessionId;
  if (typeof raw.periodEntryId === "string") details.periodEntryId = raw.periodEntryId;
  return details;
}

/**
 * Metadata carried by an outcome message.
 *
 * An outcome reports one operation and repeats no body, so it names the
 * identity it belongs to and nothing else. A change projection is read through
 * `parseProjectionDetails`, which refuses this kind, so an outcome can never
 * stand in for a change a request is missing.
 */
export interface OutcomeDetails {
  schemaVersion: number;
  kind: "outcome";
  operationId: number;
}

/** Metadata for the outcome message of one operation. */
export function outcomeDetails(operationId: number): OutcomeDetails {
  return { schemaVersion: RECORD_SCHEMA_VERSION, kind: "outcome", operationId };
}

/** Read outcome metadata, or `undefined` when the value is not one this component wrote. */
export function parseOutcomeDetails(value: unknown): OutcomeDetails | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== RECORD_SCHEMA_VERSION) return undefined;
  if (raw.kind !== "outcome") return undefined;
  const operationId = requirePositiveInteger(raw.operationId, "operationId");
  if (typeof operationId !== "number") return undefined;
  return { schemaVersion: RECORD_SCHEMA_VERSION, kind: "outcome", operationId };
}

/** Whether two records describe the same operation, field by field. */
export function sameOperation(left: PinRecord, right: PinRecord): boolean {
  return (
    left.operationId === right.operationId &&
    left.action === right.action &&
    left.entryId === right.entryId &&
    left.revision === right.revision &&
    left.body === right.body &&
    left.source === right.source &&
    left.toolCallId === right.toolCallId
  );
}
