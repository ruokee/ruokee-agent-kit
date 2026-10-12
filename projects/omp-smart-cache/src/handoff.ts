import { isDeepStrictEqual as equal } from "node:util";
import { object } from "./reuse.ts";

/**
 * Handoff cache alignment, the second capability of this package.
 *
 * The host builds a handoff side request from the session's own history plus a base system prompt, so the
 * request repeats content the ordinary main-loop dispatch already sent. This file holds the pure part of the
 * capability: which side request is a candidate, which axis can be restored, and the fixed reasons for leaving
 * a request exactly as the host built it. Runtime wiring, counters, and lifecycle live in `runtime.ts`.
 */
export type HandoffState =
  "disabled" | "unavailable" | "awaiting-reference" | "already-aligned" | "rewritten" | "rejected";

export interface HandoffStatus {
  state: HandoffState;
  online: string;
  binding: string;
  candidate: string;
  sending: string;
  reference: number;
  operations: number;
  sends: number;
  retries: number;
  aligned: number;
  rewritten: number;
  rejected: number;
  axes: number;
  unprojected: number;
}

export function initialHandoff(reason: string, state: HandoffState = "awaiting-reference"): HandoffStatus {
  return {
    state,
    online: reason,
    binding: "not-bound",
    candidate: "not-checked",
    sending: "not-sent",
    reference: 0,
    operations: 0,
    sends: 0,
    retries: 0,
    aligned: 0,
    rewritten: 0,
    rejected: 0,
    axes: 0,
    unprojected: 0,
  };
}

/** A chat-completions request body as the host builds it for a handoff side request. */
export type ChatRequest = Record<string, unknown> & { messages?: unknown };

export interface ToolShape {
  readonly name: string;
  readonly description?: string;
  readonly parameters?: unknown;
}

/** Ownership captured next to a reference. A changed field refuses the operation instead of guessing. */
export interface Ownership {
  readonly provider?: string;
  readonly model?: string;
  readonly api?: string;
  readonly baseUrl?: string;
  readonly prompt: readonly string[];
  readonly thinkingLevel?: string;
  readonly disableReasoning?: boolean;
  readonly tools: readonly ToolShape[];
}

export interface Alignment {
  /** `rewritten`, `already-aligned`, `prefix-projection-changed`, or `unsupported-payload-shape`. */
  readonly reason: string;
  readonly body?: ChatRequest;
  readonly axes: number;
  readonly unprojected: number;
}

/** Cache-sensitive wire fields this capability observes but cannot project. */
const UNPROJECTED = ["thinkingBudgets", "thinking", "enable_thinking"] as const;

/**
 * The chat-completions serializer writes the system prompt fragments with role `developer` on models that
 * declare `supportsDeveloperRole`, and with role `system` elsewhere. Both are the online system prefix.
 */
const isSystem = (message: unknown): message is Record<string, unknown> =>
  object(message) && (message.role === "system" || message.role === "developer");

/**
 * Restore the three axes that make a side request repeat the ordinary send: the online system segments, the
 * online reasoning effort, and an online tool choice the reference never made explicit. The prefix checks keep
 * every other difference native, and an axis that cannot be restored is counted instead of abandoning the rest.
 */
export function align(reference: ChatRequest, side: ChatRequest): Alignment {
  if (!Array.isArray(reference.messages) || !Array.isArray(side.messages))
    return { reason: "unsupported-payload-shape", axes: 0, unprojected: 0 };
  const live = reference.messages,
    pending = side.messages;
  const liveSystem = live.filter(isSystem),
    sideSystem = pending.filter(isSystem),
    liveHistory = live.filter((message) => !isSystem(message)),
    sideHistory = pending.filter((message) => !isSystem(message));
  if (
    sideSystem.length > liveSystem.length ||
    !equal(sideSystem, liveSystem.slice(0, sideSystem.length)) ||
    sideHistory.length <= liveHistory.length ||
    !equal(liveHistory, sideHistory.slice(0, liveHistory.length))
  )
    return { reason: "prefix-projection-changed", axes: 0, unprojected: 0 };
  const candidate: ChatRequest = { ...side, messages: [...structuredClone(liveSystem), ...sideHistory] };
  let axes = 0,
    unprojected = 0;
  const liveEffort = reference.reasoning_effort,
    sideEffort = side.reasoning_effort;
  if (typeof liveEffort === "string" && liveEffort) {
    if (!equal(liveEffort, sideEffort)) candidate.reasoning_effort = liveEffort;
  } else if (sideEffort !== undefined) axes++;
  const liveChoice = reference.tool_choice,
    sideChoice = side.tool_choice;
  // The reference body is the wire evidence: an absent tool choice is removed from the side request, and a
  // recorded `auto` is repeated because that is what the online send carried. Any other recorded choice is
  // left native and counted, so the side request never gains a forced tool the host did not ask for.
  if (liveChoice === undefined || liveChoice === "auto") {
    if (!equal(liveChoice, sideChoice)) {
      if (liveChoice === undefined) delete candidate.tool_choice;
      else candidate.tool_choice = liveChoice;
    }
  } else if (!equal(liveChoice, sideChoice)) axes++;
  for (const key of UNPROJECTED) if (!equal(reference[key], side[key])) unprojected++;
  if (equal(candidate, side)) return { reason: "already-aligned", axes, unprojected };
  return { reason: "rewritten", body: candidate, axes, unprojected };
}
