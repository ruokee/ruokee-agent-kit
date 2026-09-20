/**
 * The operation path shared by the command and the tool.
 *
 * Both entry points call these functions, so both get the same validation, the
 * same capacity rules, the same receipts and the same write sequence: read the
 * branch, plan against it, append one record, project that record to the model.
 * Everything here is synchronous, so a write cannot be interleaved with another
 * entry point between planning and appending.
 */

import { originKey, type PinRequest } from "./envelope.ts";
import type { IdentityAllocation } from "./identity.ts";
import { readJournal, type SessionReader } from "./journal.ts";
import type { PinRecord, PinSource } from "./record.ts";
import {
  acceptanceText,
  carriedOutcomeText,
  detailText,
  duplicateText,
  entryLabel,
  listingText,
  movedBranchText,
  noChangeText,
  refusalText,
  supersededText,
  unavailableText,
} from "./receipt.ts";
import {
  type MutationPlan,
  type PinState,
  findEntry,
  findOperationByCall,
  planCreate,
  planDelete,
  planUpdate,
  replay,
  summarize,
} from "./state.ts";

/** Host services an operation needs. */
/** One operation a request carried, with the result of applying it. */
export interface CarriedOperation {
  request: PinRequest;
  outcome: OperationOutcome;
}

export interface PinEnvironment {
  /** Session view used for every read. */
  reader: SessionReader;
  /** Append one accepted record to the session journal. */
  append(record: PinRecord): void;
  /** Send one accepted change to the model as a custom change message. */
  deliver(record: PinRecord): void;
  /**
   * Submit the text of a confirmed write as a user message.
   *
   * The host runs that message as an ordinary prompt when the session is idle
   * and as steering while a turn runs. The text is the write itself, without a
   * marker of any kind: the submission this process records is what makes that
   * text an operation. The extension applies the operation when a message with
   * that text reaches a request, so nothing is written before then. The binding
   * also records the branch the operation was confirmed on, so the request that
   * consumes the message can tell whether the branch changed while it waited.
   */
  submit(request: PinRequest): void;
  /**
   * Send the result of one consumed operation to the session.
   *
   * The message reports what happened to the operation and repeats no body; its
   * metadata names the operation, which the model does not read. The host
   * appends it to the branch beside the message that carried the operation, so
   * later requests keep carrying it until the host folds that part of the
   * conversation into a new base.
   */
  deliverOutcome(text: string, operationId: number): void;
  /**
   * Reserve one unused operation number.
   *
   * `callKey` is the host tool call of an Agent write: a call the host repeats
   * under the same key receives the number it was already given, so a retry of
   * one call stays one operation.
   */
  reserveOperation(callKey?: string): IdentityAllocation;
  /** Reserve one unused entry number for a new entry. */
  newEntryId(): IdentityAllocation;
  /** Identity of the session this environment reads and writes, when the host exposes one. */
  sessionId(): string | undefined;
  /**
   * Counter the host binding raises whenever the session or branch it serves
   * changes. A dialog compares it before writing, so an open dialog cannot
   * write into a branch the user has since left, even when that branch still
   * contains the entry it opened at. The request that consumes a submitted
   * message compares the value recorded when that message was submitted, so a
   * message confirmed on one branch is not applied on another. The pin period
   * is not part of this counter; the request's origin token covers it.
   */
  branchGeneration?(): number;
}

/**
 * What a write must still find unchanged.
 *
 * A dialog can stay open while the session moves on. Rereading the session id,
 * the reset period, the branch generation and the last entry the dialog opened
 * after separates "the user took time to type" from "the work under this dialog
 * was replaced".
 */
export interface SessionObservation {
  sessionId?: string;
  /** Journal entry that started the current pin period, when the branch has one. */
  resetEntryId?: string;
  /** Last entry of the branch when the dialog opened, when the branch was readable. */
  anchorEntryId?: string;
  /** Branch generation when the dialog opened, when the binding tracks one. */
  branchGeneration?: number;
}

/** Read what a later write has to match. */
export function observeSession(env: PinEnvironment): SessionObservation {
  const read = readJournal(env.reader);
  const observation: SessionObservation = { sessionId: env.sessionId() };
  if (env.branchGeneration !== undefined) observation.branchGeneration = env.branchGeneration();
  if (!read.ok) return observation;
  const state = replay(read.entries, env.sessionId());
  observation.resetEntryId = state.resetBoundaryEntryId;
  observation.anchorEntryId = read.entries.at(-1)?.id;
  return observation;
}

/** Whether the session still matches the observation. */
export function observationHolds(env: PinEnvironment, observed: SessionObservation): boolean {
  const read = readJournal(env.reader);
  if (env.sessionId() !== observed.sessionId) return false;
  if (observed.branchGeneration !== undefined) {
    // A branch that appears under the same session and pin period is a
    // different path even when it still contains the entry this dialog opened
    // at, so the observation records the generation rather than a node.
    if (env.branchGeneration === undefined) return false;
    if (env.branchGeneration() !== observed.branchGeneration) return false;
  }
  if (!read.ok) return false;
  const state = replay(read.entries, env.sessionId());
  if (state.resetBoundaryEntryId !== observed.resetEntryId) return false;
  if (observed.anchorEntryId === undefined) return true;
  // Any new entry on the same branch is fine; a switch to another branch is
  // not, because the entry this dialog started from is no longer in the path.
  return read.entries.some((entry) => entry.id === observed.anchorEntryId);
}

/** Result of one operation, already formatted for its entry point. */
export interface OperationOutcome {
  ok: boolean;
  /** Receipt or refusal shown to the user or the Agent. */
  text: string;
  code: "ok" | "duplicate" | "no-change" | "rejected" | "unavailable" | "unreadable";
  entryId?: number;
  revision?: number;
  /** State after an accepted write. */
  state?: PinState;
}

type Loaded = { usable: true; state: PinState } | { usable: false; text: string; code: "unavailable" | "unreadable" };

function load(env: PinEnvironment): Loaded {
  const read = readJournal(env.reader);
  if (!read.ok) {
    return { usable: false, text: `The session journal cannot be read: ${read.detail}`, code: "unreadable" };
  }
  const state = replay(read.entries, env.sessionId());
  if (!state.available) {
    return { usable: false, text: unavailableText(state.problem), code: "unavailable" };
  }
  return { usable: true, state };
}

function rejected(loaded: Extract<Loaded, { usable: false }>): OperationOutcome {
  return { ok: false, code: loaded.code, text: loaded.text };
}

/**
 * Plans and applies one write, returning its receipt.
 *
 * A write a user confirmed is carried by the user message that requested it,
 * so its change is already in the request and needs no second delivery. An
 * Agent write has no such carrier and is handed to the host here.
 */
function apply(env: PinEnvironment, plan: MutationPlan, carried = false): OperationOutcome {
  if (plan.kind === "reject") {
    return { ok: false, code: "rejected", text: refusalText(plan.error) };
  }
  if (plan.kind === "no-change") {
    return {
      ok: true,
      code: "no-change",
      text: noChangeText(plan.entry),
      entryId: plan.entry.entryId,
      revision: plan.entry.revision,
    };
  }
  if (plan.kind === "duplicate") {
    return {
      ok: true,
      code: "duplicate",
      text: duplicateText(plan.record),
      entryId: plan.record.entryId,
      revision: plan.record.revision,
    };
  }

  env.append(plan.record);
  if (!carried) env.deliver(plan.record);
  return {
    ok: true,
    code: "ok",
    text: acceptanceText(plan.record, plan.next),
    entryId: plan.record.entryId,
    revision: plan.record.revision,
    state: plan.next,
  };
}

export interface CreateRequest {
  body: string;
  source: PinSource;
  /** Accepted operation identity, so a retried message is not applied twice. */
  operationId?: number;
  /** Host tool call of an Agent write, which resolves the operation identity. */
  toolCallId?: string;
  entryId?: number;
  /**
   * Set when the user message carrying this write is in the request, so the
   * change needs no delivery of its own.
   */
  carried?: boolean;
}

/** Refusal for a session that cannot hand out an identity. */
function missingIdentity(detail: string): OperationOutcome {
  return {
    ok: false,
    code: "rejected",
    text: `No identity is available for this operation: ${detail}. Nothing was written.`,
  };
}

/** Reserve the entry number of a new entry. */
function allocatedEntry(env: PinEnvironment): number | OperationOutcome {
  const allocated = env.newEntryId();
  return allocated.ok ? allocated.id : missingIdentity(allocated.detail);
}

/**
 * Operation number of one write.
 *
 * A write the user confirmed carries the number it was reserved under when the
 * message was submitted. An Agent call resolves its number through its host
 * tool call: a call that was already accepted keeps the number of its accepted
 * record, so a retry is recognized as the same operation instead of reserving a
 * second number for the same work.
 */
function operationNumber(
  env: PinEnvironment,
  state: PinState,
  request: { operationId?: number; toolCallId?: string },
): number | OperationOutcome {
  if (request.operationId !== undefined) return request.operationId;
  const callKey = request.toolCallId;
  if (callKey !== undefined) {
    const accepted = findOperationByCall(state, callKey);
    if (accepted !== undefined) return accepted.operationId;
  }
  const allocated = env.reserveOperation(callKey);
  return allocated.ok ? allocated.id : missingIdentity(allocated.detail);
}

/** Pin a new body. */
export function createPin(env: PinEnvironment, request: CreateRequest): OperationOutcome {
  const loaded = load(env);
  if (!loaded.usable) return rejected(loaded);

  const operation = operationNumber(env, loaded.state, request);
  if (typeof operation !== "number") return operation;
  const entryId = request.entryId ?? allocatedEntry(env);
  if (typeof entryId !== "number") return entryId;

  return apply(
    env,
    planCreate(loaded.state, {
      operationId: operation,
      entryId,
      body: request.body,
      source: request.source,
      toolCallId: request.toolCallId,
    }),
    request.carried ?? false,
  );
}

export interface UpdateRequest {
  entryId: number;
  body: string;
  source: PinSource;
  expectedRevision: number;
  operationId?: number;
  /** Host tool call of an Agent write, which resolves the operation identity. */
  toolCallId?: string;
  /** Set when the user message carrying this write is in the request. */
  carried?: boolean;
}

/** Replace the body of an existing entry. */
export function updatePin(env: PinEnvironment, request: UpdateRequest): OperationOutcome {
  const loaded = load(env);
  if (!loaded.usable) return rejected(loaded);

  const operation = operationNumber(env, loaded.state, request);
  if (typeof operation !== "number") return operation;

  return apply(
    env,
    planUpdate(loaded.state, {
      operationId: operation,
      entryId: request.entryId,
      body: request.body,
      source: request.source,
      expectedRevision: request.expectedRevision,
      toolCallId: request.toolCallId,
    }),
    request.carried ?? false,
  );
}

export interface DeleteRequest {
  entryId: number;
  source: PinSource;
  expectedRevision: number;
  operationId?: number;
  /** Host tool call of an Agent write, which resolves the operation identity. */
  toolCallId?: string;
  /** Set when the user message carrying this write is in the request. */
  carried?: boolean;
}

/** Unpin an existing entry. */
export function deletePin(env: PinEnvironment, request: DeleteRequest): OperationOutcome {
  const loaded = load(env);
  if (!loaded.usable) return rejected(loaded);

  const operation = operationNumber(env, loaded.state, request);
  if (typeof operation !== "number") return operation;

  return apply(
    env,
    planDelete(loaded.state, {
      operationId: operation,
      entryId: request.entryId,
      source: request.source,
      expectedRevision: request.expectedRevision,
      toolCallId: request.toolCallId,
    }),
    request.carried ?? false,
  );
}

/**
 * Apply the operations one request carries.
 *
 * A confirmed write is submitted as a user message, and the host runs that
 * message as a request. The extension reads it here, checks it against the
 * state that exists at that moment, and appends the operation only when the
 * checks pass: the entry exists, the revision still matches, the message was
 * written in this session and pin period, and the branch it was confirmed on is
 * still the branch this request serves. A message carrying an operation that
 * was accepted earlier is a retry of it and appends nothing, and a refusal
 * leaves the journal alone. Each result is reported to the user and carried in
 * the request that consumed it.
 *
 * The caller reads the operations and passes the submissions this process made,
 * so only a message that answers a confirmation is applied here and text that
 * merely resembles one stays prose.
 */
export function acceptRequests(
  env: PinEnvironment,
  requests: readonly PinRequest[],
  /** Operations this process submitted, with the branch counter each was confirmed at. */
  submitted: ReadonlyMap<number, { generation: number }> = new Map(),
): CarriedOperation[] {
  if (requests.length === 0) return [];
  const read = readJournal(env.reader);
  // A range that cannot be read cannot answer a check either, so the operation
  // stays open with its reason instead of being refused as another branch.
  if (!read.ok) {
    const text = `This operation is not applied yet. The session journal cannot be read: ${read.detail}`;
    return requests.map((request) => ({ request, outcome: { ok: false, code: "unreadable", text } }));
  }
  const origin = originKey(env.sessionId(), replay(read.entries, env.sessionId()).resetBoundaryEntryId);
  return requests.map((request) => ({
    request,
    outcome: onRecordedBranch(submitted.get(request.operationId)?.generation, env)
      ? request.origin === origin
        ? acceptRequest(env, request)
        : { ok: false, code: "rejected", text: supersededText() }
      : { ok: false, code: "rejected", text: movedBranchText() },
  }));
}

/**
 * Whether the branch still is the one the operation was confirmed on.
 *
 * The counter the binding raises on a session or branch change identifies the
 * branch while the process that submitted the message lives: it differs after a
 * switch even when the branch has no entry to anchor to, and even when the
 * branch the user moved to still contains every entry of the one the draft was
 * written on. A counter the extension cannot compare, because either side of
 * the comparison is missing, refuses the operation instead of applying it to a
 * branch it may not belong to.
 */
function onRecordedBranch(recordedGeneration: number | undefined, env: PinEnvironment): boolean {
  const generation = env.branchGeneration?.();
  if (recordedGeneration === undefined || generation === undefined) return false;
  return recordedGeneration === generation;
}

/** Apply one operation a user message carried. */
function acceptRequest(env: PinEnvironment, request: PinRequest): OperationOutcome {
  if (request.action === "create") {
    return createPin(env, {
      body: request.body,
      source: "user",
      operationId: request.operationId,
      carried: true,
    });
  }
  if (request.action === "update") {
    return updatePin(env, {
      entryId: request.entryId,
      body: request.body,
      source: "user",
      expectedRevision: request.revision,
      operationId: request.operationId,
      carried: true,
    });
  }
  return deletePin(env, {
    entryId: request.entryId,
    source: "user",
    expectedRevision: request.revision,
    operationId: request.operationId,
    carried: true,
  });
}

/** Text the request and the user receive for one consumed operation. */
export function carriedOperationText(operation: CarriedOperation): string {
  return carriedOutcomeText(operation.outcome);
}

/** List the active entries of the current branch. */
export function listPins(env: PinEnvironment): OperationOutcome {
  const loaded = load(env);
  if (!loaded.usable) return rejected(loaded);
  return { ok: true, code: "ok", text: listingText(loaded.state), state: loaded.state };
}

/** Read one entry with its body. */
export function readPin(env: PinEnvironment, entryId: number): OperationOutcome {
  const loaded = load(env);
  if (!loaded.usable) return rejected(loaded);

  const entry = findEntry(loaded.state, entryId);
  if (entry === undefined) {
    return { ok: false, code: "rejected", text: `No active pin entry #${entryId}.`, entryId };
  }
  return { ok: true, code: "ok", text: detailText(entry), entryId: entry.entryId, revision: entry.revision };
}

/**
 * Rows one entry carries in a listing.
 *
 * The command draws its own list with the host component, so these rows serve
 * the text listings only.
 */
export function pinChoices(state: PinState): Array<{ entryId: number; label: string }> {
  return summarize(state).map((row) => ({ entryId: row.entryId, label: entryLabel(row) }));
}
