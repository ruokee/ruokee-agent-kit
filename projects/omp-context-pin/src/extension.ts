/**
 * OMP extension entry for context pin.
 *
 * The factory inspects the runtime before anything is registered, using public
 * API information only. An unsupported host keeps its session and receives one
 * bounded diagnostic instead of a half-registered extension, and peer metadata
 * alone is not treated as a runtime compatibility check.
 *
 * On a supported host the factory registers the `ctx_pin` tool, the `/ctx-pin`
 * command and the request hook. Reads and writes always use the newest session
 * the extension has seen, so a dialog left open across a session switch cannot
 * append to the wrong journal. Journal reads, replays and message rewriting all
 * run through the pure modules; this file only binds them to the host.
 */

import type { ContextEventResult, ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { COMMAND_NAME, registerPinCommand } from "./command.ts";
import { type PinRequest, submittedText, userMessageText } from "./envelope.ts";
import {
  type MessageLike,
  type PlacedOutcome,
  changeMessageText,
  expressOutcomes,
  outcomeKey,
  outcomeKeys,
  outcomeMessage,
  outcomeOperation,
  planProjection,
  projectMessages,
  unprojectedChanges,
} from "./delivery.ts";
import { classifyHostVersion } from "./host-version.ts";
import { IdentityAllocator, scanIdentities, type IdentityAllocation } from "./identity.ts";
import { type SessionReader, readJournal, readSession } from "./journal.ts";
import {
  type CarriedOperation,
  type OperationOutcome,
  type PinEnvironment,
  acceptRequests,
  carriedOperationText,
  observeSession,
} from "./operations.ts";
import { PENDING_LOST_TEXT, problemDetailText, requestProblemText } from "./receipt.ts";
import { type PinRecord, type ProjectionScope, PROJECTION_TYPE, RECORD_TYPE, projectionDetails } from "./record.ts";
import { replay } from "./state.ts";
import { TOOL_NAME, registerPinTool } from "./tool.ts";

export const PACKAGE_NAME = "@ruokee/omp-context-pin";

/** Public extension API functions this component requires before it registers anything. */
const REQUIRED_API_FUNCTIONS = [
  "on",
  "registerTool",
  "registerCommand",
  "appendEntry",
  "sendMessage",
  "sendUserMessage",
] as const;

/** Members of `pi.zod.z` the tool's parameter schema calls. */
const REQUIRED_ZOD_MEMBERS = ["object", "enum", "string", "number"] as const;

/** Longest host version string echoed in a diagnostic. */
const MAX_REPORTED_VERSION = 32;

/** Runtime condition that prevents registration. */
export interface RuntimeProblem {
  /** Missing public API members, in declaration order. */
  missing: string[];
  /** Host version outside the declared peer range, when the host reports one. */
  unsupportedVersion?: string;
}

interface RuntimeMembers {
  zod?: { z?: Record<string, unknown> };
  logger?: { warn?: unknown };
  pi?: { VERSION?: unknown };
}

interface Logger {
  warn(message: string): void;
}

/** Read a logger that can carry the diagnostic, if the host exposes one. */
function usableLogger(pi: unknown): Logger | undefined {
  const logger = (pi as RuntimeMembers | null | undefined)?.logger;
  return typeof logger?.warn === "function" ? (logger as Logger) : undefined;
}

/** Inspect the runtime through public API information only. */
export function inspectRuntime(pi: ExtensionAPI): RuntimeProblem | undefined {
  if (typeof pi !== "object" || pi === null) return { missing: ["pi"] };

  const api = pi as unknown as Record<string, unknown> & RuntimeMembers;
  const missing: string[] = REQUIRED_API_FUNCTIONS.filter((name) => typeof api[name] !== "function");
  // The tool builds its parameter schema from `pi.zod.z`, so those members are
  // what this activation needs before it registers anything.
  for (const name of REQUIRED_ZOD_MEMBERS) {
    if (typeof api.zod?.z?.[name] !== "function") missing.push(`zod.z.${name}`);
  }
  if (typeof api.logger?.warn !== "function") missing.push("logger.warn");

  const version = typeof api.pi?.VERSION === "string" ? api.pi.VERSION : undefined;
  const unsupportedVersion =
    version !== undefined && classifyHostVersion(version) === "unsupported"
      ? version.slice(0, MAX_REPORTED_VERSION)
      : undefined;

  if (missing.length === 0 && unsupportedVersion === undefined) return undefined;
  return unsupportedVersion === undefined ? { missing } : { missing, unsupportedVersion };
}

function describeProblem(problem: RuntimeProblem): string {
  const parts: string[] = [];
  if (problem.missing.length > 0) parts.push(`missing: ${problem.missing.join(", ")}`);
  if (problem.unsupportedVersion !== undefined) parts.push(`unsupported host version: ${problem.unsupportedVersion}`);
  return parts.join("; ");
}

/** Newest session context the extension has seen. */
interface RuntimeState {
  context?: ExtensionContext;
  /** Operation numbers already handed to the host for delivery. */
  queued: Set<number>;
  /** Session and reset period the queue belongs to. */
  queuePeriod?: string;
  /** Raised whenever a session or branch event arrives. */
  branchGeneration: number;
  /**
   * Operations this process submitted, with the text it handed the host.
   *
   * Only a message this process submitted is read as an operation, so this
   * record is what makes the text of a confirmed write an operation: the entry
   * and the revision the draft showed, and the session and period it belongs
   * to, come from here rather than from the message. The host reports no
   * identity for the message it runs, so a submission is claimed by the text
   * this process handed over, once, oldest submission first. Text the user
   * pasted, quoted or restored from another run matches no submission and stays
   * ordinary prose. An operation leaves the record once its outcome is final, so
   * a request that reviews the same message again applies nothing, and a refused
   * operation is not applied later because the capacity or the branch it needed
   * changed. A session the host restores starts with an empty record, because
   * its messages were submitted by a process that is gone.
   */
  submissions: Map<number, SubmittedOperation>;
  /**
   * Results this process reported that the branch does not hold yet.
   *
   * The host queues a message while a run is streaming and appends it later, so
   * a request built in the meantime would otherwise lose the result the user has
   * already read. Each result is written into every request of the branch it was
   * reported in until that request or the journal holds it, and forgotten when the
   * session or the branch changes. A result is keyed by its operation and its text,
   * because one operation can be answered again once the range that blocked it
   * reads.
   */
  pendingOutcomes: Map<string, PendingOutcome>;
  /**
   * Place each reported result was published at, by operation identity.
   *
   * The host appends a result to the branch beside the message it answers, and
   * a request built after that reads the copy where the host appended it. The
   * place is kept past the point the branch holds the result, so the copy is
   * read where the result was first published instead of at a tail that later
   * steps moved. A place is forgotten when the session or the branch changes,
   * because the messages it measures are not the ones that session reads.
   */
  outcomeAnchors: Map<number, OutcomeAnchor>;
  /**
   * Messages the request last read, when one was read.
   *
   * A message the host runs for a confirmation is appended after the
   * conversation the request held, so this count is what tells the message of a
   * confirmation from a message that was already there.
   */
  seenMessages?: number;
  /** Range and reason of the problem this session already reported. */
  reportedProblem?: string;
  /** Texts reported for an operation identity, so each is reported once until the branch changes. */
  reportedOutcomes: Map<number, Set<string>>;
  /** Operation numbers of Agent calls, so a repeated call reuses its number. */
  callOperations: Map<string, number>;
  /** Numbers this session already uses, restored from every branch of it. */
  identities?: IdentityAllocator;
  /** Why the session numbers could not be established, when that happened. */
  identityProblem?: string;
}

/** One operation this process handed to the host, and the text it sent. */
interface SubmittedOperation {
  /** The operation, with the fields its message does not carry. */
  request: PinRequest;
  /** Exact message text handed to the host. */
  text: string;
  /** Branch generation the operation was confirmed at. */
  generation: number;
  /**
   * Time the message was handed to the host.
   *
   * The host reports the time it took the message at, and it is later than this
   * one, so a user message of this text that the host reported at or after this
   * time is the message this submission produced and one the conversation
   * already held is history. The time is what tells the two apart when the
   * message the host ran is one this process never saw before it ran.
   */
  at: number;
  /**
   * Messages the last request held when the message was handed over.
   *
   * A host that reports no time for the messages it runs leaves the count as
   * the only measure: the host appends the message it runs after the
   * conversation it already holds, so a message of this text that stands at or
   * after this count is this submission's own. `undefined` when no request was
   * read yet, so nothing of the conversation is measured.
   */
  baseline?: number;
  /**
   * Time the host reported for the message it ran for this submission.
   *
   * The host reports every message it runs, so a run of this text is what shows
   * the confirmation was consumed rather than replaced. Two messages can carry
   * the same text, so the time the host reported tells this submission's
   * message from one the user typed.
   */
  ranAt?: number;
}

/** One result this process reported and the branch does not hold yet. */
interface PendingOutcome {
  operationId: number;
  /** Text of the message that carried the operation, so the result is read beside it. */
  carrier: string;
  /** Rank of that message among the request's messages carrying the same text. */
  ordinal?: number;
  text: string;
  /** Time the result was first written into a request. */
  at: number;
  /** Branch generation the result was reported in. */
  generation: number;
}

/** Where one result was published, so a request reads it in that place again. */
interface OutcomeAnchor {
  /** Text of the message that carried the operation. */
  carrier: string;
  /** Rank of that message among the request's messages carrying the same text. */
  ordinal?: number;
}

function liveContext(state: RuntimeState, fallback: ExtensionContext): ExtensionContext {
  return state.context ?? fallback;
}

/**
 * Allocator of the session this bind serves, restored from every branch of it.
 *
 * The numbers are read from the whole session the first time this bind is used
 * and again whenever the session changes. Within one session they only rise, so
 * leaving a branch and coming back, or clearing the current context, cannot
 * hand out a number that is already in use. A scan that cannot be completed
 * leaves no allocator: a number that cannot be placed against the session could
 * collide with one another branch holds, so the write is refused instead of
 * handing out a number that may be taken.
 */
function identitiesFor(
  state: RuntimeState,
  reader: SessionReader,
  sessionId: string | undefined,
): IdentityAllocator | undefined {
  if (state.identities !== undefined && state.identities.sessionId === sessionId) return state.identities;
  const read = readSession(reader);
  if (!read.ok) {
    state.identities = undefined;
    state.identityProblem = read.detail;
    return undefined;
  }
  state.identityProblem = undefined;
  const scanned = scanIdentities(read.entries);
  if (state.identities === undefined) state.identities = new IdentityAllocator(scanned, sessionId);
  else state.identities.sync(sessionId, scanned);
  return state.identities;
}

/** Why the session numbers cannot be established. */
function identityProblem(state: RuntimeState): string {
  return state.identityProblem ?? "the numbers of this session cannot be read";
}

/** Reserve one operation number, reusing the number of a repeated Agent call. */
function allocateOperation(
  state: RuntimeState,
  reader: SessionReader,
  sessionId: string | undefined,
  callKey?: string,
): IdentityAllocation {
  const allocator = identitiesFor(state, reader, sessionId);
  if (allocator === undefined) return { ok: false, detail: identityProblem(state) };
  if (callKey !== undefined) {
    const known = state.callOperations.get(callKey);
    if (known !== undefined) return { ok: true, id: known };
  }
  const allocated = allocator.allocateOperation();
  if (allocated.ok && callKey !== undefined) state.callOperations.set(callKey, allocated.id);
  return allocated;
}

/** Reserve one entry number for a new entry of this session. */
function allocateEntry(state: RuntimeState, reader: SessionReader, sessionId: string | undefined): IdentityAllocation {
  const allocator = identitiesFor(state, reader, sessionId);
  if (allocator === undefined) return { ok: false, detail: identityProblem(state) };
  return allocator.allocateEntry();
}

/** Identity of the session and pin period a delivery queue belongs to. */
function periodKey(environment: PinEnvironment): string {
  const observation = observeSession(environment);
  return `${observation.sessionId ?? ""}/${observation.resetEntryId ?? ""}`;
}

/**
 * Session and pin period one delivery belongs to.
 *
 * A message the host holds for a later request keeps this scope in its metadata,
 * so a request of another session or another period filters it out instead of
 * reading it as a change of its own range.
 */
function deliveryScope(environment: PinEnvironment): ProjectionScope {
  const observation = observeSession(environment);
  return { sessionId: observation.sessionId, periodEntryId: observation.resetEntryId };
}

/** Bind the shared operation path to this host and this session. */
export function pinEnvironment(pi: ExtensionAPI, state: RuntimeState, fallback: ExtensionContext): PinEnvironment {
  // A host that does not offer every entry keeps that member absent, so the
  // scan reports what this host is missing instead of a call that failed.
  const offersEntries = (): boolean => {
    try {
      return typeof liveContext(state, fallback).sessionManager.getEntries === "function";
    } catch {
      return false;
    }
  };
  const reader: SessionReader = {
    getBranch: () => liveContext(state, fallback).sessionManager.getBranch(),
    ...(offersEntries() ? { getEntries: () => liveContext(state, fallback).sessionManager.getEntries?.() ?? [] } : {}),
  };

  const currentSessionId = (): string | undefined => {
    try {
      return liveContext(state, fallback).sessionManager.getSessionId();
    } catch {
      return undefined;
    }
  };

  const environment: PinEnvironment = {
    reader,
    append: (record: PinRecord) => {
      pi.appendEntry(RECORD_TYPE, record);
    },
    deliver: (record: PinRecord) => {
      // One delivery per operation and period: the host queues a message while a
      // run is streaming and gives no acknowledgment, so a second request that
      // still misses the projection must not queue the same text again.
      if (state.queued.has(record.operationId)) return;
      state.queued.add(record.operationId);
      pi.sendMessage(
        {
          customType: PROJECTION_TYPE,
          content: changeMessageText(record),
          display: false,
          details: projectionDetails(record, deliveryScope(environment)),
        },
        // `nextTurn` keeps the change out of the editable pending queue and
        // `triggerTurn: false` schedules no continuation, so the host appends
        // the message without running a turn of its own.
        { deliverAs: "nextTurn", triggerTurn: false },
      );
    },
    submit: (request: PinRequest) => {
      const text = submittedText(request);
      state.submissions.set(request.operationId, {
        request,
        text,
        generation: state.branchGeneration,
        // The host takes the message after this, so its own report of the time
        // it took is what tells the message it runs from one the conversation
        // already held, and the count this process last read is what a host
        // that reports no time leaves to measure with.
        at: Date.now(),
        baseline: state.seenMessages,
      });
      pi.sendUserMessage(text);
    },
    deliverOutcome: (text: string, operationId: number) => {
      // The result is handed over while the request that consumes the operation
      // is being built. `nextTurn` keeps it out of the editable pending queue and
      // `triggerTurn: false` schedules no continuation, so the host holds it for
      // the next turn instead of running a turn for it, and a host that takes
      // nothing leaves it in the requests that follow.
      pi.sendMessage(outcomeMessage(text, operationId, Date.now()), {
        deliverAs: "nextTurn",
        triggerTurn: false,
      });
    },
    reserveOperation: (callKey?: string) => allocateOperation(state, reader, currentSessionId(), callKey),
    newEntryId: () => allocateEntry(state, reader, currentSessionId()),
    sessionId: currentSessionId,
    branchGeneration: () => state.branchGeneration,
  };
  return environment;
}

/** Activate the extension, or report one bounded diagnostic and register nothing. */
export function activate(pi: ExtensionAPI): void {
  const problem = inspectRuntime(pi);
  if (problem !== undefined) {
    const logger = usableLogger(pi);
    if (logger === undefined) return; // The host exposes no way to report the problem.
    logger.warn(`${PACKAGE_NAME}: unsupported OMP runtime, registering nothing (${describeProblem(problem)})`);
    return;
  }

  const state: RuntimeState = {
    queued: new Set(),
    branchGeneration: 0,
    callOperations: new Map(),
    submissions: new Map(),
    pendingOutcomes: new Map(),
    outcomeAnchors: new Map(),
    reportedOutcomes: new Map(),
  };

  registerPinTool(pi, (ctx) => {
    state.context = ctx;
    return pinEnvironment(pi, state, ctx);
  });

  registerPinCommand(pi, (ctx) => {
    state.context = ctx;
    return pinEnvironment(pi, state, ctx);
  });

  pi.on("context", (event, ctx) => {
    state.context = ctx;
    return expressPins(pi, state, ctx, event.messages);
  });

  // The host reports every message it runs, so a user message of this text is
  // what shows a confirmation was consumed, and one of another text is what
  // shows the host ran something else in its place.
  pi.on("message_start", (event, ctx) => {
    state.context = ctx;
    noteRanMessage(state, event);
  });

  const remember = (_event: unknown, ctx: ExtensionContext) => {
    state.context = ctx;
    state.queued = new Set();
    state.queuePeriod = undefined;
    state.reportedProblem = undefined;
    // The messages of one branch are not the messages of another, so what was
    // read of them, and the places the results of this branch were published
    // at, are forgotten with it.
    state.seenMessages = undefined;
    state.outcomeAnchors = new Map();
    // A result is reported in the branch it was given in, so this process
    // forgets what it reported there when the branch changes. A reason that
    // returns in another branch is reported again: a request that reads the
    // result back is not told again, and one that cannot read it is.
    state.reportedOutcomes = new Map();
    state.callOperations = new Map();
    state.branchGeneration += 1;
  };
  // A submitted operation belongs to the run that submitted it: a start, a
  // switch and a shutdown clear the record, so a message the host restores is
  // ordinary text rather than an operation waiting to be applied.
  const startSession = (event: unknown, ctx: ExtensionContext) => {
    remember(event, ctx);
    dropPendingWrites(state, ctx);
  };
  pi.on("session_start", startSession);
  pi.on("session_switch", startSession);
  pi.on("session_branch", remember);
  pi.on("session_tree", remember);
  pi.on("session_shutdown", (_event, ctx) => {
    state.context = undefined;
    state.queued = new Set();
    state.queuePeriod = undefined;
    state.reportedProblem = undefined;
    state.identities = undefined;
    state.identityProblem = undefined;
    state.seenMessages = undefined;
    state.outcomeAnchors = new Map();
    state.branchGeneration += 1;
    dropPendingWrites(state, ctx);
  });
}

/**
 * Note one message the host ran, for the confirmation it belongs to.
 *
 * A confirmation is submitted as a user message, and the message the host runs
 * is the one that carries it: the time the host reports for it is kept, so the
 * request that follows reads this submission's own message rather than another
 * message that reads the same text. A user message of other text is the host
 * running something in place of a message this process submitted, so a
 * confirmation still waiting for its message is left behind instead of applying
 * when the same text comes up again.
 */
function noteRanMessage(state: RuntimeState, event: unknown): void {
  if (state.submissions.size === 0) return;
  if (typeof event !== "object" || event === null || !("message" in event)) return;
  const message: unknown = event.message;
  const text = userMessageText(message);
  if (text === undefined) return;
  const time = messageTime(message);
  const confirmed = new Set([...state.submissions.values()].map((submitted) => submitted.text));
  for (const [operationId, submitted] of state.submissions) {
    if (submitted.ranAt !== undefined) continue;
    if (submitted.text === text) {
      if (time !== undefined) submitted.ranAt = time;
      continue;
    }
    if (confirmed.has(text)) continue;
    if (time === undefined || time < submitted.at) continue;
    state.submissions.delete(operationId);
  }
}

/**
 * Forget the writes this process confirmed, reporting any the host never read.
 *
 * A confirmed write is applied from the message the host consumes. A session
 * start, a switch or a shutdown takes that message away before it is read, and
 * the write is never applied; the user is told once, at the moment it is
 * dropped, so a confirmation that cannot take effect does not pass in silence.
 */
function dropPendingWrites(state: RuntimeState, ctx: ExtensionContext): void {
  const dropped = state.submissions.size > 0;
  state.submissions = new Map();
  state.callOperations = new Map();
  state.pendingOutcomes = new Map();
  state.outcomeAnchors = new Map();
  state.reportedOutcomes = new Map();
  if (dropped) ctx.ui.notify(PENDING_LOST_TEXT, "warning");
}

/**
 * Report a range that cannot be read, once per range and reason.
 *
 * A damaged range stays damaged on every request until the journal changes, so
 * the diagnostic is written to the log and shown to the user the first time
 * this session meets it and not again for the same range. A later session or a
 * different problem reports on its own, because the range is part of the
 * signature.
 */
function reportProblem(
  pi: ExtensionAPI,
  state: RuntimeState,
  ctx: ExtensionContext,
  environment: PinEnvironment,
  detail: string,
): void {
  const signature = `${environment.sessionId() ?? ""}|${detail}`;
  if (state.reportedProblem === signature) return;
  state.reportedProblem = signature;
  const text = requestProblemText(detail);
  usableLogger(pi)?.warn(`${PACKAGE_NAME}: ${text}`);
  ctx.ui.notify(text, "warning");
}

/** One submission this request consumed, with the message that carried it. */
interface ClaimedSubmission {
  submitted: SubmittedOperation;
  /** Position of the message that carries the operation. */
  at: number;
  /** Rank of that message among the request's messages carrying the same text. */
  ordinal: number;
}

/** The request's user messages, in order, with their texts. */
function userMessages(messages: readonly unknown[]): Array<{ index: number; text: string }> {
  const users: Array<{ index: number; text: string }> = [];
  for (let index = 0; index < messages.length; index += 1) {
    const text = userMessageText(messages[index]);
    if (text !== undefined) users.push({ index, text });
  }
  return users;
}

/**
 * Read the operations a request carries, in the order the request holds them.
 *
 * Only a submission this process made is read as an operation, and the message
 * that carries it has to be one the host ran for it rather than history that
 * happens to read the same: a message of the conversation the confirmation was
 * made in is not the confirmation, and a message the host reported running for
 * this text outranks one it did not. Each submission claims one message with
 * that text, oldest submission first, and a message that is already claimed
 * cannot claim a second operation. Text the user typed, pasted or restored from
 * another run matches no pending submission and stays prose.
 */
function collectRequests(
  messages: readonly unknown[],
  submissions: ReadonlyMap<number, SubmittedOperation>,
): ClaimedSubmission[] {
  if (submissions.size === 0) return [];
  const users = userMessages(messages);
  const claimed = new Set<number>();
  const claims: ClaimedSubmission[] = [];
  for (const submitted of submissions.values()) {
    const carrying = users.filter(
      (entry) => entry.text === submitted.text && !claimed.has(entry.index) && !predates(submitted, entry, messages),
    );
    if (carrying.length === 0) continue;
    // The host reports the time it took the message at, so the message it ran
    // for this text is the one this submission produced even when the same text
    // stands elsewhere in the request.
    const ran =
      submitted.ranAt === undefined
        ? undefined
        : carrying.find((entry) => messageTime(messages[entry.index]) === submitted.ranAt);
    const at = (ran ?? carrying[0])?.index;
    if (at === undefined) continue;
    claimed.add(at);
    claims.push({
      submitted,
      at,
      ordinal: 1 + users.filter((entry) => entry.text === submitted.text && entry.index < at).length,
    });
  }
  return claims;
}

/**
 * Whether one user message stood in the conversation before a submission.
 *
 * The host reports the time it took a message at, and a message it took before
 * the confirmation was handed over is history, however exactly its text reads:
 * text the user typed, pasted or restored that happens to read the same is not
 * the confirmation, and a message the user later retypes is not one either. A
 * host that reports no time leaves the count the last request read: a message
 * that stands before the conversation that request held is history too.
 */
function predates(
  submitted: SubmittedOperation,
  entry: { index: number; text: string },
  messages: readonly unknown[],
): boolean {
  const time = messageTime(messages[entry.index]);
  if (time !== undefined) return time < submitted.at;
  const baseline = submitted.baseline;
  if (baseline === undefined || baseline > messages.length) return false;
  return entry.index < baseline;
}

/** Time the host reported for one message, when it reports one. */
function messageTime(message: unknown): number | undefined {
  if (typeof message !== "object" || message === null || !("timestamp" in message)) return undefined;
  const time: unknown = message.timestamp;
  return typeof time === "number" ? time : undefined;
}

/**
 * Forget the confirmations whose message the host did not run.
 *
 * The host runs the message it holds for a confirmation, and the user can edit
 * or replace that message before it runs. The request that follows then carries
 * user text the host took after the confirmation was handed over, and the
 * confirmation has been left behind: it is dropped rather than kept for
 * whatever message repeats its text later, so a write the user edited away does
 * not take effect on ordinary prose. A confirmation the request still carries
 * keeps its place, because that message is the one it was submitted as.
 */
function expireSubmissions(state: RuntimeState, messages: readonly unknown[]): void {
  if (state.submissions.size === 0) return;
  const users = userMessages(messages);
  const confirmed = new Set([...state.submissions.values()].map((submitted) => submitted.text));
  for (const [operationId, submitted] of state.submissions) {
    if (users.some((entry) => entry.text === submitted.text)) continue;
    const overtaken = users.some((entry) => {
      if (confirmed.has(entry.text) || predates(submitted, entry, messages)) return false;
      return true;
    });
    if (overtaken) state.submissions.delete(operationId);
  }
}

/**
 * Report the outcome of each operation this request consumed.
 *
 * The user is told what happened to the operation, and the result is handed to
 * the host when the run that consumed it ends, so the host appends it to the
 * branch and a later request reads the result where it was published. An
 * operation whose outcome is final is forgotten, which is what keeps a refused
 * or superseded operation refused when the request reviews its message again. A
 * result is reported once per operation and text until the branch changes,
 * because one operation can be answered again with another reason for the same
 * operation.
 *
 * The result is also held until the journal carries it, so a request built
 * before the host takes the message, such as the one a retry starts from, reads
 * the same result at the same place instead of missing the answer an earlier
 * attempt received.
 */
function reportOutcomes(
  pi: ExtensionAPI,
  state: RuntimeState,
  ctx: ExtensionContext,
  environment: PinEnvironment,
  operations: readonly CarriedOperation[],
  claims: readonly ClaimedSubmission[],
  carried: ReadonlySet<string>,
): void {
  for (let index = 0; index < operations.length; index += 1) {
    const operation = operations[index];
    if (operation === undefined) continue;
    const claim = claims[index];
    const operationId = operation.request.operationId;
    const code = operation.outcome.code;
    if (settles(code)) {
      // The operation is final, so the message that carried it is no longer one
      // this process has to apply, refused or not. An unsettled one stays
      // recorded for the request that reviews it once the range is readable.
      state.submissions.delete(operationId);
    }
    // A record that already holds the operation means an earlier request
    // accepted it, so its result was reported then.
    if (code === "duplicate") continue;
    const text = carriedOperationText(operation);
    // One operation can be answered again, with another reason for the same
    // operation, so each text is reported once, and a text this request already
    // reads is not written into it a second time.
    const reported = state.reportedOutcomes.get(operationId) ?? new Set<string>();
    if (reported.has(text) || carried.has(outcomeKey(operationId, text))) continue;
    reported.add(text);
    state.reportedOutcomes.set(operationId, reported);
    // The result is held before the host is offered it, and offered only when
    // this run ends, so a host that takes nothing leaves the result in the
    // requests that follow. The message that carried the operation is the one
    // this request read it from, so the result is placed beside it.
    rememberOutcome(state, operationId, text, submittedText(operation.request), claim?.ordinal);
    ctx.ui.notify(text, operation.outcome.ok ? "info" : "error");
    environment.deliverOutcome(text, operationId);
  }
}

/**
 * Number of results one request keeps writing until the journal holds them.
 *
 * Once the bound is reached the oldest result is given up, so the results one
 * request carries stay bounded even when the journal never holds them.
 */
export const MAX_PENDING_OUTCOMES = 16;

/**
 * Hold one result for the requests that follow, up to that bound.
 *
 * The request that reported a result writes it again, so a request rebuilt
 * before the host appends the queued message still reads the answer the user
 * has already seen. A host that records nothing would otherwise add one result
 * per confirmation to every request, so the oldest results are given up first.
 */
function rememberOutcome(
  state: RuntimeState,
  operationId: number,
  text: string,
  carrier: string,
  ordinal?: number,
): void {
  state.pendingOutcomes.set(outcomeKey(operationId, text), {
    operationId,
    carrier,
    ordinal,
    text,
    at: Date.now(),
    generation: state.branchGeneration,
  });
  state.outcomeAnchors.set(operationId, { carrier, ordinal });
  while (state.pendingOutcomes.size > MAX_PENDING_OUTCOMES) {
    const oldest = state.pendingOutcomes.keys().next();
    if (oldest.done === true) break;
    state.pendingOutcomes.delete(oldest.value);
  }
  while (state.outcomeAnchors.size > MAX_OUTCOME_ANCHORS) {
    const oldest = state.outcomeAnchors.keys().next();
    if (oldest.done === true) break;
    state.outcomeAnchors.delete(oldest.value);
  }
}

/**
 * Number of places one session keeps for the results it published.
 *
 * A place is a text and a rank, and it is what tells a result's own message
 * from one that only reads the same. Once the bound is reached the oldest place
 * is given up: the result it belongs to stays where the host appended it
 * instead of moving, so a long session pays one line per result it keeps.
 */
export const MAX_OUTCOME_ANCHORS = 64;

/**
 * Forget the results one list of keys already holds.
 *
 * A result is compared by its operation and its text, so an earlier answer to
 * the same operation does not pass for the one this request reports.
 */
function forgetCarried(state: RuntimeState, keys: Iterable<string>): void {
  for (const key of keys) state.pendingOutcomes.delete(key);
}

/**
 * The results this request has to carry, and the place each was published at.
 *
 * A result reported before the host took it is held until the request or the
 * journal reads it, and a result the host has already appended is read from the
 * copy the request carries. Either way the result belongs beside the message
 * that carried its operation, so a request rebuilt after the host appended the
 * copy reads the answer where it was first published instead of at the tail the
 * host appended it to. A copy with no known place keeps the position it was
 * read at.
 */
function outcomePlacements(state: RuntimeState, messages: readonly unknown[]): PlacedOutcome[] {
  const placements: PlacedOutcome[] = [];
  for (const [key, outcome] of state.pendingOutcomes) {
    if (outcome.generation !== state.branchGeneration) {
      state.pendingOutcomes.delete(key);
      continue;
    }
    placements.push({
      carrier: outcome.carrier,
      message: outcomeMessage(outcome.text, outcome.operationId, outcome.at),
      operationId: outcome.operationId,
      ordinal: outcome.ordinal,
    });
  }
  for (const message of messages) {
    const operationId = outcomeOperation(message);
    if (operationId === undefined) continue;
    if (placements.some((placement) => placement.operationId === operationId)) continue;
    const anchor = state.outcomeAnchors.get(operationId);
    if (anchor === undefined) continue;
    placements.push({ carrier: anchor.carrier, message, operationId, ordinal: anchor.ordinal });
  }
  return placements;
}

/** Whether an outcome ends the operation, so it is not reviewed again. */
function settles(code: OperationOutcome["code"]): boolean {
  return code !== "unavailable" && code !== "unreadable";
}

/**
 * Express the effective pin set in one request.
 *
 * A confirmed write is submitted as a user message, so the request that
 * consumes it is reviewed first: a submission this process made is applied when
 * its checks pass, and this request then carries both the body the user sent and
 * the result of the operation. The same result is handed to the host when this
 * run ends, and the host appends it to the branch there, so later requests read
 * it where it was published; this request keeps writing it until the journal
 * holds it.
 *
 * Every accepted change the journal does not show as published is written into
 * the request itself, so the request that discovers a missing projection still
 * carries the change; the same change is handed to the host for delivery once
 * per session and reset period, and never for a change the request already
 * reads from the user's own message. The base snapshot replaces the projections
 * its boundary already covers. A range that cannot be read leaves the pin
 * state, the journal and the projected pin set alone and reports the reason
 * once; a result the same request carries is still reported, because it
 * describes the operation rather than the pin set.
 */
function expressPins(
  pi: ExtensionAPI,
  state: RuntimeState,
  ctx: ExtensionContext,
  messages: readonly unknown[],
): ContextEventResult | undefined {
  const environment = pinEnvironment(pi, state, ctx);
  // The request the host builds for a run is the conversation a confirmation
  // made now would be appended to, so the count is read before the claims of
  // this request are taken from it.
  state.seenMessages = messages.length;

  // A confirmation whose message the host did not run is left behind before
  // this request is read, so a later message that repeats its text is prose
  // rather than the confirmation.
  expireSubmissions(state, messages);

  // Only the messages this process submitted are operations, and an operation
  // whose outcome is final stops being one: the request reviews the message
  // that carried it on every later turn, and a draft that was accepted or
  // refused must not be applied again because the branch moved on.
  const claims = collectRequests(messages, state.submissions);
  const carried = acceptRequests(
    environment,
    claims.map((claim) => claim.submitted.request),
    state.submissions,
  );
  // A result this request already reads is forgotten before this request
  // reports its own, so an answer to the same operation that changed since the
  // branch recorded one is not read as the answer the branch already holds.
  const resultsHere = outcomeKeys(messages);
  forgetCarried(state, resultsHere);
  reportOutcomes(pi, state, ctx, environment, carried, claims, resultsHere);

  const read = readJournal(environment.reader);
  if (!read.ok) {
    reportProblem(pi, state, ctx, environment, read.detail);
    return withOutcomes(state, messages);
  }
  // The host appends a result to the branch when it accepts the message, and
  // the journal is what later requests read it from: a result the journal holds
  // is not written into the request a second time.
  forgetCarried(state, outcomeKeys(read.entries));

  // The session is what tells a projection of this range from one another
  // session queued here, so the range is replayed with the scope the request
  // belongs to. A range read without it would count every published change of
  // another session as unpublished and queue it again.
  const pinned = replay(read.entries, environment.sessionId());
  if (!pinned.available) {
    const problem = pinned.problem;
    reportProblem(pi, state, ctx, environment, problem === undefined ? "unknown damage" : problemDetailText(problem));
    return withOutcomes(state, messages);
  }
  // A readable range is the healthy answer: a later problem is a new one.
  state.reportedProblem = undefined;

  // A result this process reported stays in the request until the journal holds
  // it, so a request rebuilt before the host takes the message still reads the
  // answer at the place it was published.
  const answered = requestMessages(state, messages);
  // The plan carries the scope of this request, so its projections name the
  // session and period they belong to and another range's carriers are filtered.
  const plan = planProjection(pinned, {
    sessionId: environment.sessionId(),
    periodEntryId: pinned.resetBoundaryEntryId,
  });
  const period = periodKey(environment);
  // A session or pin period change starts a fresh delivery attempt; the first
  // observation of a period keeps what the entry points already queued.
  if (state.queuePeriod !== undefined && state.queuePeriod !== period) state.queued = new Set();
  state.queuePeriod = period;

  // A write the user confirmed is carried by the message the host ran, so the
  // request holds its body already and no copy of it is handed over.
  const pending = unprojectedChanges(plan);
  const operationIds = new Set(pending.map((record) => record.operationId));
  for (const operationId of state.queued) {
    if (!operationIds.has(operationId)) state.queued.delete(operationId);
  }
  for (const record of pending) environment.deliver(record);

  const projected = projectMessages(answered as readonly MessageLike[], plan, Date.now());
  if (projected !== undefined) return { messages: projected as unknown as ContextEventResult["messages"] };
  return answered === messages ? undefined : { messages: answered as ContextEventResult["messages"] };
}

/**
 * The messages one request sends, with the results this process reported.
 *
 * A result the journal or the request already reads is forgotten before this
 * runs, so each result is written once and keeps the place it was first
 * published at, directly after the message that carried its operation.
 */
function requestMessages(state: RuntimeState, messages: readonly unknown[]): readonly unknown[] {
  const outcomes = outcomePlacements(state, messages);
  if (outcomes.length === 0) return messages;
  return expressOutcomes(messages as readonly MessageLike[], outcomes);
}

/** The request the host sends when only the results this process reported changed. */
function withOutcomes(state: RuntimeState, messages: readonly unknown[]): ContextEventResult | undefined {
  const answered = requestMessages(state, messages);
  return answered === messages ? undefined : { messages: answered as ContextEventResult["messages"] };
}

export { TOOL_NAME, COMMAND_NAME };
export default activate;
