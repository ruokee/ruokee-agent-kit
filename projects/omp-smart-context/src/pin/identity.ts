/**
 * Session-wide allocation of entry and operation numbers.
 *
 * Entry and operation identities are positive integers assigned once per
 * session. An entry number is retired when its entry is deleted, and an
 * operation number is retired when its operation is accepted; neither is handed
 * out again, so an integer names one entry or one operation for the life of the
 * session and a retry can be recognized by the number it already carries.
 *
 * The numbers are restored from the whole session rather than the current
 * branch: a branch switch must not hand out a number another branch already
 * used, and `/clear` must not lower a counter. The scan reads every form a
 * number appears in: the record of an operation and the result of one. A result
 * reserves its number even when the operation was refused, so a rejected
 * confirmation cannot collide with a later operation. A submission this process
 * has not consumed holds its number in memory, and a session the host restores
 * starts from the numbers its records and results carry, because the message of
 * a write no process is running is ordinary text.
 */
import { OUTCOME_TYPE } from "./delivery.ts";
import { RECORD_TYPE, parseOutcomeDetails, parseRecord } from "./record.ts";
import type { JournalEntry } from "./state.ts";

/** Largest number that can still be handed out without losing exactness. */
export const MAX_IDENTITY = Number.MAX_SAFE_INTEGER;

/** Numbers already used in one session, as a high-water mark. */
export interface IdentityHighWater {
  entryId: number;
  operationId: number;
}

/** Allocation result: a fresh number, or why none can be handed out. */
export type IdentityAllocation = { ok: true; id: number } | { ok: false; detail: string };

const EMPTY: IdentityHighWater = { entryId: 0, operationId: 0 };

function highest(current: number, candidate: number | undefined): number {
  if (candidate === undefined || !Number.isSafeInteger(candidate) || candidate < 1) return current;
  return candidate > current ? candidate : current;
}

/**
 * Numbers already used anywhere in this session.
 *
 * A value that cannot be read as a record or a result contributes nothing: an
 * unreadable value names no number this component handed out, and guessing one
 * would reserve a number that is still free.
 */
export function scanIdentities(entries: readonly JournalEntry[]): IdentityHighWater {
  let high = EMPTY;
  for (const entry of entries) {
    if (entry.type === "custom" && entry.customType === RECORD_TYPE) {
      const parsed = parseRecord(entry.data);
      if (!parsed.ok) continue;
      high = {
        entryId: highest(high.entryId, parsed.record.entryId),
        operationId: highest(high.operationId, parsed.record.operationId),
      };
      continue;
    }
    if (entry.type === "custom_message" && entry.customType === OUTCOME_TYPE) {
      const details = parseOutcomeDetails(entry.details);
      if (details !== undefined) high = { ...high, operationId: highest(high.operationId, details.operationId) };
    }
  }
  return high;
}

/**
 * Allocates numbers for one session.
 *
 * `sync` is called with the numbers a session already uses. The first call for
 * a session, and every call after the session changed, replaces what is held;
 * later calls within the same session only raise it, so a branch that shows
 * fewer numbers than another branch cannot hand out one of them again.
 */
export class IdentityAllocator {
  #high: IdentityHighWater;
  #sessionId: string | undefined;

  constructor(high: IdentityHighWater = EMPTY, sessionId?: string) {
    this.#high = high;
    this.#sessionId = sessionId;
  }

  /** Session these numbers belong to, as the host reports it. */
  get sessionId(): string | undefined {
    return this.#sessionId;
  }

  /** Numbers this allocator has handed out or restored. */
  get high(): IdentityHighWater {
    return this.#high;
  }

  /** Record the numbers one session already uses. */
  sync(sessionId: string | undefined, high: IdentityHighWater): void {
    if (sessionId !== this.#sessionId) {
      this.#sessionId = sessionId;
      this.#high = high;
      return;
    }
    this.#high = {
      entryId: Math.max(this.#high.entryId, high.entryId),
      operationId: Math.max(this.#high.operationId, high.operationId),
    };
  }

  /** Reserve one unused entry number. */
  allocateEntry(): IdentityAllocation {
    const next = this.#high.entryId + 1;
    if (!Number.isSafeInteger(next)) {
      return { ok: false, detail: "every entry number of this session is used" };
    }
    this.#high = { ...this.#high, entryId: next };
    return { ok: true, id: next };
  }

  /** Reserve one unused operation number. */
  allocateOperation(): IdentityAllocation {
    const next = this.#high.operationId + 1;
    if (!Number.isSafeInteger(next)) {
      return { ok: false, detail: "every operation number of this session is used" };
    }
    this.#high = { ...this.#high, operationId: next };
    return { ok: true, id: next };
  }
}
