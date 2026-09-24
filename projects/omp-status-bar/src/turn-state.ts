/**
 * Module-level turn state for the bundled `turn` provider.
 *
 * The extension keeps this state from the turn lifecycle of the UI session:
 * how many model requests the session answered successfully, and whether a
 * turn is in flight. The provider subscribes and publishes; nothing here
 * samples, reads session sources, or schedules a timer, so a session that
 * configures only `turn` never starts the shared sampling interval.
 *
 * The count is session-cumulative but always reflects the branch the session
 * currently holds. Binding a session seeds it from that branch's recorded
 * history, and navigating the session tree or branching re-seeds it from the
 * branch that is now in front. Every successful response in between advances
 * it, so a resumed or switched session continues the same number instead of
 * restarting at zero.
 */

/** One published state: successful responses so far, and whether a turn is running. */
export interface TurnSample {
  readonly count: number;
  readonly active: boolean;
}

/**
 * Response endings that count as a successful model response. Errors and
 * interruptions are absent on purpose: only an answered request counts.
 */
export const SUCCESSFUL_STOP_REASONS: Readonly<Record<string, true>> = {
  stop: true,
  length: true,
  toolUse: true,
};

/** Structural view of one session entry; keeps this module free of OMP types. */
export interface BranchEntryLike {
  readonly type: string;
  readonly message?: { readonly role?: string; readonly stopReason?: string } | undefined;
}

/**
 * Count the assistant responses that ended successfully along one branch.
 * Every entry type other than a message is ignored, as is a message that is
 * not an assistant response or that ended without a successful stop reason.
 */
export function countSuccessfulResponses(branch: readonly BranchEntryLike[]): number {
  let count = 0;
  for (const entry of branch) {
    if (entry.type !== "message") continue;
    const message = entry.message;
    if (message?.role !== "assistant") continue;
    if (SUCCESSFUL_STOP_REASONS[message.stopReason ?? ""] === true) count++;
  }
  return count;
}

/** The one session-scoped state; undefined while no session is bound. */
let sample: TurnSample | undefined;

/** Provider instances that publish this state. */
const listeners = new Set<() => void>();

/** Current state, or undefined when no session is bound. */
export function getTurnSample(): TurnSample | undefined {
  return sample;
}

/**
 * Replace the state and notify subscribers when it changed. Binding a
 * session seeds the count through this function; clearing the binding passes
 * `undefined`, which withdraws the provider's content.
 */
export function setTurnSample(next: TurnSample | undefined): void {
  const current = sample;
  if (current === undefined && next === undefined) return;
  if (current !== undefined && next !== undefined && current.count === next.count && current.active === next.active) {
    return;
  }
  sample = next === undefined ? undefined : Object.freeze({ count: next.count, active: next.active });
  for (const listener of listeners) {
    listener();
  }
}

/** Subscribe one provider instance; the returned function unsubscribes it. */
export function subscribeTurn(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Reset the state and the subscriptions; tests only. */
export function resetTurnStateForTests(): void {
  sample = undefined;
  listeners.clear();
}
