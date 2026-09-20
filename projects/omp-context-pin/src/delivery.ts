/**
 * Expressing the effective pin set in one request.
 *
 * A request carries the base snapshot of the latest committed compaction
 * boundary, followed by the tail messages of the changes accepted after that
 * boundary. Both are recomputed from the journal on every request, so a lost
 * callback, a detached notification or a restart after a compaction cannot lose
 * the state. A projection the snapshot already covers is dropped from the
 * request instead of applying twice.
 *
 * A change message not yet present in the journal is written into the request
 * itself, because the host copies the message array before the hook runs and a
 * `sendMessage` issued here reaches the session, and therefore the next
 * request, only after this one. A change is written at the place its journal
 * position gives it, and a copy the host appended elsewhere is dropped, so a
 * request rebuilt while a run grows reads the change where it was first
 * published. The copy the entry point hands to the host holds the change in
 * later requests for as long as the host keeps that session, and neither
 * `sendMessage` nor `appendEntry` reports that the host has saved it.
 *
 * An extension custom message is the carrier for both, a change and an outcome:
 * the host converts it through the same pipeline as every other custom message,
 * so the extension does not invent a message kind the provider has never seen.
 */

import {
  type ChangeProjectionDetails,
  PROJECTION_TYPE,
  RECORD_SCHEMA_VERSION,
  outcomeDetails,
  parseOutcomeDetails,
  parseProjectionDetails,
  projectionDetails,
  type PinRecord,
  type ProjectionDetails,
  type ProjectionScope,
} from "./record.ts";
import { changeText, snapshotText } from "./projection.ts";
import { messageText, userMessageText, writeText } from "./envelope.ts";
import type { PinState } from "./state.ts";

/**
 * Custom type of the message that reports one consumed user operation.
 *
 * The carrier is not a record and holds no Pin state: it repeats no body, and
 * replay ignores it, because replay reads records and change projections only.
 */
export const OUTCOME_TYPE = "omp-context-pin-result";

/** Message fields this module reads from a request. */
export interface MessageLike {
  role?: unknown;
  customType?: unknown;
  details?: unknown;
  content?: unknown;
  summary?: unknown;
  /** Call one tool result answers, which places the change the call produced. */
  toolCallId?: unknown;
}

/** One accepted change as the next request has to express it. */
export interface PlannedChange {
  record: PinRecord;
  /** Whether the journal already carries a projection of this change. */
  projected: boolean;
}

/** What one request must express, derived from the journal. */
export interface ProjectionPlan {
  /** Accepted changes after the base snapshot, in journal order. */
  changes: PlannedChange[];
  /** Operations whose published projection the base snapshot supersedes. */
  coveredOperationIds: Set<number>;
  /** Operations this range accepted, by operation identity. */
  acceptedOperations: Map<number, PinRecord>;
  /** Entries this range holds now. */
  liveEntryIds: Set<number>;
  /** Base snapshot to place after the host summary, when a boundary exists. */
  snapshot?: { boundaryEntryId: string; summary?: string; text: string };
  /** Session and pin period this plan belongs to. */
  scope: ProjectionScope;
}

/** Changes the journal does not carry a projection for, in journal order. */
export function unprojectedChanges(plan: ProjectionPlan): PinRecord[] {
  return plan.changes.filter((change) => !change.projected).map((change) => change.record);
}

/** Tail message text for one accepted change. */
export function changeMessageText(record: PinRecord): string {
  return changeText(record);
}

/**
 * Derive what the next request must express.
 *
 * `scope` is the session and pin period the request belongs to: the plan writes
 * it into the projections it builds, and it is what tells a carrier of this
 * range from one another session or period queued.
 */
export function planProjection(state: PinState, scope: ProjectionScope = {}): ProjectionPlan {
  const boundary = state.compactionBoundary;
  const coveredOperationIds = new Set<number>();
  let snapshot: ProjectionPlan["snapshot"];

  if (boundary !== undefined) {
    for (const record of state.records.slice(0, boundary.recordCount)) {
      coveredOperationIds.add(record.operationId);
    }
    const text = snapshotText(boundary.entries, boundary.entryId);
    if (text !== undefined) {
      snapshot = { boundaryEntryId: boundary.entryId, summary: boundary.summary, text };
    }
  }

  const changes: PlannedChange[] = state.records
    .filter((_record, index) => boundary === undefined || index >= boundary.recordCount)
    .map((record) => ({ record, projected: state.projectedOperationIds.has(record.operationId) }));

  // A projection of an operation this plan does not hold stays only when the
  // range accepted that operation. Neither the entry identity nor the revision
  // number can vouch for it: the sibling branches of one session share the
  // entry, and two paths can reach the same revision number with different
  // content.
  const liveEntryIds = new Set(state.entries.map((entry) => entry.entryId));

  return {
    changes,
    coveredOperationIds,
    acceptedOperations: state.acceptedOperations,
    liveEntryIds,
    snapshot,
    scope,
  };
}

/** One accepted change as a request carries it: its text and its metadata. */
interface ChangeForm {
  text: string;
  details: ChangeProjectionDetails;
  /** Body the accepted change pins, empty for a delete. */
  body: string;
}

/** The form one accepted record takes in a request. */
function changeForm(record: PinRecord, scope: ProjectionScope): ChangeForm {
  return {
    text: changeText(record),
    details: projectionDetails(record, scope),
    body: record.body ?? "",
  };
}

/** The plan's changes, keyed by operation identity. */
function changeForms(plan: ProjectionPlan): Map<number, ChangeForm> {
  return new Map(plan.changes.map((change) => [change.record.operationId, changeForm(change.record, plan.scope)]));
}

/** Whether a message carries one of the plan's changes exactly as it was accepted. */
function carriesChange(message: MessageLike, change: ChangeForm): boolean {
  const details = parseProjectionDetails(message.details);
  if (details === undefined || details.kind === "snapshot") return false;
  return (
    details.entryId === change.details.entryId &&
    details.revision === change.details.revision &&
    details.action === change.details.action &&
    message.content === change.text
  );
}

/**
 * Whether a message of this component's type has to leave the request.
 *
 * A message whose metadata does not read as a projection is not one this
 * component wrote, and neither is one written in another session or pin period:
 * that is a queued carrier the session moved on from. A message that names an
 * operation the plan holds has to carry that change exactly, and every copy of
 * a plan change the request carries as one of these messages leaves, so the
 * change is expressed once at the place the plan gives it. A message the base
 * snapshot covers goes as well. The base snapshot is rebuilt from the plan, so
 * every snapshot message leaves. A readable projection of an operation this
 * plan does not hold stays only while that operation is one this range
 * accepted, on an entry the range holds, carrying the revision, action and text
 * that record has. The entry identity and the revision number are shared with
 * the sibling branches of one session, so the accepted operations are what
 * keeps the earlier revisions this branch accepted readable and drops a delayed
 * copy from another path.
 */
function isForeignChange(
  message: MessageLike,
  plan: ProjectionPlan,
  changes: Map<number, ChangeForm>,
  reemit: Set<number>,
): boolean {
  if (message.role !== "custom" || message.customType !== PROJECTION_TYPE) return false;
  const details = parseProjectionDetails(message.details);
  if (details === undefined) return true;
  // The base snapshot is rebuilt from the plan, so it never stands in for one
  // of the plan's changes.
  if (details.kind === "snapshot") return true;
  if (details.sessionId !== plan.scope.sessionId || details.periodEntryId !== plan.scope.periodEntryId) return true;
  if (plan.coveredOperationIds.has(details.operationId)) return true;
  if (reemit.has(details.operationId)) return true;
  const change = changes.get(details.operationId);
  if (change !== undefined) return !carriesChange(message, change);
  // The plan expresses no change for this operation. The entry being live and
  // the revision named here prove nothing: two sibling branches can reach the
  // same revision number with different content. Only an operation this range
  // accepted lets the copy stay, and then only as the record it names.
  if (!plan.liveEntryIds.has(details.entryId)) return true;
  const accepted = plan.acceptedOperations.get(details.operationId);
  if (accepted === undefined) return true;
  return !carriesChange(message, changeForm(accepted, plan.scope));
}

/** Tail message describing one accepted change. */
export function changeMessage(record: PinRecord, timestamp: number, scope: ProjectionScope = {}) {
  return {
    role: "custom" as const,
    customType: PROJECTION_TYPE,
    content: changeText(record),
    display: false,
    details: projectionDetails(record, scope),
    timestamp,
  };
}

/**
 * Message reporting one operation a user message carried.
 *
 * The host holds this message for a later turn and starts none for it, and it
 * appends the message to the branch beside the message that carried the
 * operation. The request that reports the result reads it beside that message
 * until the branch holds it, and later requests read the copy the host saved.
 * Neither the message API nor `appendEntry` confirms that the host has saved
 * it. The text reports whether the operation was accepted, changed nothing or
 * was refused, and repeats no body; the metadata names the operation, which no
 * reader of the request sees.
 */
export function outcomeMessage(text: string, operationId: number, timestamp: number) {
  return {
    role: "custom" as const,
    customType: OUTCOME_TYPE,
    content: text,
    display: false,
    details: outcomeDetails(operationId),
    timestamp,
  };
}

/** One result waiting for the request that reports it. */
export interface PlacedOutcome {
  /** Text of the message that carried the operation, as it was submitted. */
  carrier: string;
  /** The result message itself. */
  message: unknown;
  /** Operation the result answers, so a copy of it is put back instead of written again. */
  operationId?: number;
  /** Rank of the carrying message among the request's messages carrying the same text. */
  ordinal?: number;
}

/** Positions of the messages carrying one text, in request order. */
function carrierMatches(messages: readonly MessageLike[], carrier: string): number[] {
  const matches: number[] = [];
  for (let position = 0; position < messages.length; position += 1) {
    const message = messages[position];
    if (message !== undefined && messageText(message.content) === carrier) matches.push(position);
  }
  return matches;
}

/** Operation one result message reports, when the value is one of this component's. */
export function outcomeOperation(value: unknown): number | undefined {
  const holder = asOutcomeHolder(value);
  if (holder === undefined || holder.customType !== OUTCOME_TYPE) return undefined;
  return parseOutcomeDetails(holder.details)?.operationId;
}

/**
 * Write the results this request carries beside the messages that carried their
 * operations.
 *
 * A result answers one operation, and the user message that carried that
 * operation stands in the request: the result is read directly after it, so a
 * request rebuilt as the run grows keeps reading the answer where it was first
 * published instead of at a tail that has moved. The host appends the copy it
 * holds to that tail, so a copy the request already carries leaves the place it
 * was read at and is written again beside the message it answers: the request
 * keeps the message object the host recorded, and one result is read once. The
 * message is found by the text this process handed the host, and by the rank of
 * that message among the messages carrying it, so a second message of the same
 * text does not take the place of the one the operation was consumed through. A
 * result whose message the request does not hold keeps to the tail in the order
 * it was reported.
 */
export function expressOutcomes<T extends MessageLike>(
  messages: readonly T[],
  outcomes: readonly PlacedOutcome[],
): T[] {
  if (outcomes.length === 0) return messages as T[];

  // The copies the host holds are taken out of the request here, so each is
  // written once at the place its operation was consumed.
  const writing = new Set<number>();
  for (const outcome of outcomes) {
    if (outcome.operationId !== undefined) writing.add(outcome.operationId);
  }
  const copies = new Map<number, unknown>();
  const kept: T[] = [];
  for (const message of messages) {
    const operationId = outcomeOperation(message);
    if (operationId === undefined || !writing.has(operationId)) {
      kept.push(message);
      continue;
    }
    if (!copies.has(operationId)) copies.set(operationId, message);
  }

  const placed = new Map<number, unknown[]>();
  const tail: unknown[] = [];
  for (const outcome of outcomes) {
    const copy = outcome.operationId === undefined ? undefined : copies.get(outcome.operationId);
    const message = copy ?? outcome.message;
    const matches = carrierMatches(kept, outcome.carrier);
    const at = outcome.ordinal === undefined ? matches[0] : matches[outcome.ordinal - 1];
    if (at === undefined) {
      tail.push(message);
      continue;
    }
    const group = placed.get(at + 1);
    if (group === undefined) placed.set(at + 1, [message]);
    else group.push(message);
  }
  const written: T[] = [];
  for (let position = 0; position <= kept.length; position += 1) {
    for (const outcome of placed.get(position) ?? []) written.push(outcome as T);
    if (position < kept.length) written.push(kept[position] as T);
  }
  for (const outcome of tail) written.push(outcome as T);
  return sameRequest(messages, written) ? (messages as T[]) : written;
}

/** Key of one result, so a result is told apart by its operation and its text. */
export function outcomeKey(operationId: number, text: string): string {
  return `${operationId}\u0000${text}`;
}

/** Message fields a result is read from, when the value is an object. */
interface OutcomeHolder {
  customType?: unknown;
  details?: unknown;
  content?: unknown;
}

function asOutcomeHolder(value: unknown): OutcomeHolder | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  return value as OutcomeHolder;
}

/**
 * Keys of the results one list of messages or entries holds.
 *
 * A value counts only when it carries this component's outcome type, readable
 * metadata naming an operation and the text of that result, so a message that
 * merely reuses the type reports nothing, and an earlier answer to the same
 * operation does not stand in for a later one. A string and a list of text
 * parts are both read as the text, so a message is recognized in either shape,
 * as long as the parts rejoin to the same text.
 */
export function outcomeKeys(values: readonly unknown[]): Set<string> {
  const keys = new Set<string>();
  for (const value of values) {
    const holder = asOutcomeHolder(value);
    if (holder === undefined) continue;
    if (holder.customType !== OUTCOME_TYPE) continue;
    const details = parseOutcomeDetails(holder.details);
    if (details === undefined) continue;
    const text = messageText(holder.content);
    if (text !== undefined) keys.add(outcomeKey(details.operationId, text));
  }
  return keys;
}

/** Synthetic message carrying the base snapshot, never written to the journal. */
export function snapshotMessage(text: string, boundaryEntryId: string, timestamp: number) {
  return {
    role: "custom" as const,
    customType: PROJECTION_TYPE,
    content: text,
    display: false,
    details: {
      schemaVersion: RECORD_SCHEMA_VERSION,
      kind: "snapshot",
      boundaryEntryId,
    },
    timestamp,
  };
}

/** Journal position of each of the plan's changes, by operation identity. */
function changeOrder(plan: ProjectionPlan): Map<number, number> {
  return new Map(plan.changes.map((change, index) => [change.record.operationId, index]));
}

/**
 * Journal position of the change one message carries, when it carries one.
 *
 * A projection that agrees with its record expresses that change; anything else
 * carries none, so it is not a place journal order can be measured from. A
 * change the user's own message carries is not read here: that message holds
 * the user's text, it never moves, and no change is written before it. The
 * projection is read from its metadata and its text, not from a record of who
 * submitted it, and reading it here changes no state.
 */
function carriedChangeIndex(
  message: MessageLike,
  forms: Map<number, ChangeForm>,
  order: Map<number, number>,
): number | undefined {
  if (message.role !== "custom" || message.customType !== PROJECTION_TYPE) return undefined;
  const details = parseProjectionDetails(message.details);
  if (details === undefined || details.kind === "snapshot") return undefined;
  const change = forms.get(details.operationId);
  if (change === undefined || !carriesChange(message, change)) return undefined;
  return order.get(details.operationId);
}

/**
 * Journal position of the change each message carries, by request position.
 *
 * A projection that agrees with its record carries that change, and so does the
 * message the user sent for one of their own writes. Either way the message is a
 * place journal order can be measured from, so a change is never written after a
 * later change the request already carries.
 */
function changeCarriers(
  messages: readonly MessageLike[],
  plan: ProjectionPlan,
  forms: Map<number, ChangeForm>,
  order: Map<number, number>,
): Map<number, number> {
  const carriers = new Map<number, number>();
  for (let position = 0; position < messages.length; position += 1) {
    const message = messages[position] as MessageLike;
    const projected = carriedChangeIndex(message, forms, order);
    if (projected !== undefined) {
      carriers.set(position, projected);
      continue;
    }
    const text = userMessageText(message);
    if (text === undefined) continue;
    for (const change of plan.changes) {
      if (change.record.source !== "user") continue;
      if (writeText(change.record.action, change.record.entryId, change.record.body) !== text) continue;
      const index = order.get(change.record.operationId);
      if (index !== undefined) carriers.set(position, index);
      break;
    }
  }
  return carriers;
}

/**
 * Position of the message that completes the call one change came from.
 *
 * A tool call and its result stand in the request, and the change belongs
 * directly after the result: a request rebuilt as the run takes further tool
 * steps keeps reading the change where it was first published, instead of
 * following the tail the new steps moved. `undefined` when the request does not
 * hold that call.
 */
function callAnchor(kept: readonly MessageLike[], toolCallId: unknown): number | undefined {
  if (typeof toolCallId !== "string" || toolCallId === "") return undefined;
  for (let position = 0; position < kept.length; position += 1) {
    const message = kept[position] as MessageLike;
    if (message.role === "toolResult" && message.toolCallId === toolCallId) return position + 1;
  }
  return undefined;
}

/**
 * Place every change the request has to express again, in journal order.
 *
 * A change is written directly after the result of the call that produced it,
 * when the request holds that call, and otherwise just before the first message
 * of the request that already carries a later change. That message belongs to a
 * later operation, so the request reads in the order the journal holds: an
 * older revision is never expressed after the revision that replaced it. A
 * change the request already carries a later change after keeps to that earlier
 * place even when its own call stands later. Changes with neither keep to the
 * tail, in journal order among themselves.
 */
function tailPlacements(
  kept: readonly MessageLike[],
  tails: readonly PlannedChange[],
  plan: ProjectionPlan,
  forms: Map<number, ChangeForm>,
  order: Map<number, number>,
): Map<number, PlannedChange[]> {
  const placements = new Map<number, PlannedChange[]>();
  const carriers = changeCarriers(kept, plan, forms, order);
  for (const change of tails) {
    const index = order.get(change.record.operationId);
    let bound = kept.length;
    for (const [position, carried] of carriers) {
      if (index !== undefined && carried > index) {
        bound = position;
        break;
      }
    }
    const own = callAnchor(kept, change.record.toolCallId);
    const at = own === undefined ? bound : Math.min(own, bound);
    const group = placements.get(at);
    if (group === undefined) placements.set(at, [change]);
    else group.push(change);
  }
  return placements;
}

/**
 * Apply one plan to the messages about to be sent.
 *
 * Returns a replacement array, or `undefined` when the request already
 * expresses the plan. A projection the snapshot covers, a projection written in
 * another session or pin period, and a message of this type that is not readable
 * as the change it names are left out, so the journal contributes one projection
 * per change. The user's own messages stay where the user sent them: one of them
 * can carry the same body as the base snapshot when the host keeps it beside the
 * summary.
 *
 * The snapshot is placed after the summary message of its own boundary: matched
 * by summary text, then after the last summary message, and otherwise at the
 * head so the pinned text still reaches the model.
 *
 * Changes follow in journal order. A change the request does not carry after the
 * changes it does carry would read as the later operation of a sequence whose
 * earlier operation never arrived, so every change from the first missing one
 * onward is expressed again in journal order. A change the request carries as one
 * of this component's own messages is dropped and written again at the place the
 * plan gives it, so a request rebuilt after the host appended the copy reads the
 * change where it was first published. A change the user's own message carries is
 * never written again: that message keeps the place the user sent it from, so the
 * body reaches the model once.
 */
export function projectMessages<T extends MessageLike>(
  messages: readonly T[],
  plan: ProjectionPlan,
  timestamp: number,
): T[] | undefined {
  const forms = changeForms(plan);
  const order = changeOrder(plan);
  // Every accepted change is expressed at the place the plan gives it, and the
  // copy the request already carries leaves first, so a request rebuilt while a
  // run grows reads the change where it was first published instead of where the
  // host appended its copy. A write the user confirmed is carried by the message
  // the host ran, which stays where the user sent it, so it is written only when
  // that message is no longer in the request.
  const tails = plan.changes.filter(
    (change) => change.record.source !== "user" || !requestCarries(messages, change.record),
  );
  const reemit = new Set(tails.map((change) => change.record.operationId));
  const copies = carriedCopies(messages, plan, forms, reemit);

  const kept = messages.filter((message) => !isForeignChange(message, plan, forms, reemit)) as T[];
  const placements = tailPlacements(kept, tails, plan, forms, order);
  const snapshotAt = plan.snapshot === undefined ? -1 : snapshotIndex(kept, plan.snapshot.summary);
  const written: T[] = [];
  for (let position = 0; position <= kept.length; position += 1) {
    if (position === snapshotAt && plan.snapshot !== undefined) {
      written.push(snapshotMessage(plan.snapshot.text, plan.snapshot.boundaryEntryId, timestamp) as unknown as T);
    }
    for (const change of placements.get(position) ?? []) {
      // A copy the request already carries is put back where the plan puts it,
      // so the request keeps the message object it had.
      const copy = copies.get(change.record.operationId);
      written.push((copy ?? changeMessage(change.record, timestamp, plan.scope)) as unknown as T);
    }
    if (position < kept.length) written.push(kept[position] as T);
  }
  return sameRequest(messages, written) ? undefined : written;
}

/**
 * The message each change the plan writes is already carried by, by identity.
 *
 * A copy is read here and put back at the place the plan gives it, so a request
 * keeps the message object it already had instead of receiving an equal one, and
 * a host that appended the copy elsewhere finds the request rebuilt around the
 * message it holds. A copy of another scope, one the snapshot covers and one
 * that disagrees with its change are left out.
 */
function carriedCopies(
  messages: readonly MessageLike[],
  plan: ProjectionPlan,
  forms: Map<number, ChangeForm>,
  reemit: Set<number>,
): Map<number, MessageLike> {
  const copies = new Map<number, MessageLike>();
  for (const message of messages) {
    if (message.role !== "custom" || message.customType !== PROJECTION_TYPE) continue;
    const details = parseProjectionDetails(message.details);
    if (details === undefined || details.kind === "snapshot") continue;
    if (details.sessionId !== plan.scope.sessionId || details.periodEntryId !== plan.scope.periodEntryId) continue;
    if (plan.coveredOperationIds.has(details.operationId)) continue;
    if (!reemit.has(details.operationId) || copies.has(details.operationId)) continue;
    const change = forms.get(details.operationId);
    if (change === undefined || !carriesChange(message, change)) continue;
    copies.set(details.operationId, message);
  }
  return copies;
}

/**
 * Whether the request holds the message one write was submitted as.
 *
 * The message is the user's own text, so the write reaches the model through it
 * and needs no second copy of it. A request that no longer holds that message,
 * because a boundary kept the write and replaced the message, gets the write
 * expressed as a change like any other.
 */
function requestCarries(messages: readonly MessageLike[], record: PinRecord): boolean {
  const text = writeText(record.action, record.entryId, record.body);
  return messages.some((message) => userMessageText(message) === text);
}

/**
 * Whether a rebuilt request carries exactly what the incoming one does.
 *
 * The messages this component writes are compared by the metadata and the text
 * they carry rather than by identity, because the host hands back its own copy
 * of a message the extension queued. Any other value counts only when it is the
 * same one.
 */
function sameRequest(left: readonly unknown[], right: readonly unknown[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (!sameMessage(left[index], right[index])) return false;
  }
  return true;
}

/** Whether two values are the same message, or the same one of this component's. */
function sameMessage(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  const one = asMessageHolder(left);
  const two = asMessageHolder(right);
  if (one === undefined || two === undefined) return false;
  if (one.role !== "custom" || two.role !== "custom") return false;
  if (one.customType !== two.customType || one.content !== two.content) return false;
  const leftProjection = parseProjectionDetails(one.details);
  const rightProjection = parseProjectionDetails(two.details);
  if (leftProjection !== undefined || rightProjection !== undefined) {
    return textual(leftProjection) === textual(rightProjection);
  }
  const leftOutcome = parseOutcomeDetails(one.details);
  const rightOutcome = parseOutcomeDetails(two.details);
  if (leftOutcome !== undefined || rightOutcome !== undefined) {
    return textual(leftOutcome) === textual(rightOutcome);
  }
  return false;
}

/** Fields one message is read from, when the value is an object. */
interface MessageHolder {
  role?: unknown;
  customType?: unknown;
  content?: unknown;
  details?: unknown;
}

function asMessageHolder(value: unknown): MessageHolder | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  return value as MessageHolder;
}

/** Text of a parsed value, so two parsed objects compare by their content. */
function textual(value: unknown): string {
  return JSON.stringify(value) ?? "undefined";
}

function snapshotIndex(messages: readonly MessageLike[], summary: string | undefined): number {
  const summaries: number[] = [];
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message?.role !== "compactionSummary") continue;
    if (summary !== undefined && message.summary === summary) return index + 1;
    summaries.push(index);
  }
  const last = summaries.at(-1);
  return last === undefined ? 0 : last + 1;
}
