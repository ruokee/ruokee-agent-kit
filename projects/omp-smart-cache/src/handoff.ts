import { isDeepStrictEqual as equal } from "node:util";
import { object } from "./reuse.ts";
import { z } from "zod";

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

export type ResponsesRequest = Record<string, unknown> & { input?: unknown };
export interface ResponsesSource {
  readonly system: readonly string[];
  readonly source: readonly unknown[];
}
export interface ResponsesProof extends ResponsesSource {
  readonly snapshot: readonly unknown[];
}

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

const configurationUpdate = z
  .object({
    type: z.literal("configuration_update"),
    reasoning: z.object({ effort: z.string() }).strict(),
  })
  .strict();
const isConfigurationUpdate = (item: unknown): boolean =>
  object(item) && item.type === "configuration_update" && configurationUpdate.safeParse(item).success;

/** Restore only the proved system expression. Native history, effort controls, and generation policy stay native. */
export function alignResponses(reference: ResponsesRequest, side: ResponsesRequest, proof: ResponsesProof): Alignment {
  const refused = (reason: string): Alignment => ({ reason, axes: 0, unprojected: 0 });
  if (!Array.isArray(reference.input) || !Array.isArray(side.input)) return refused("unsupported-payload-shape");
  if (
    !proof.source.length ||
    proof.snapshot.length <= proof.source.length ||
    !equal(proof.source, proof.snapshot.slice(0, proof.source.length))
  )
    return refused("source-prefix-unconfirmed");
  if (!equal(reference.tools, side.tools)) return refused("tool-projection-changed");
  if (side.tool_choice !== "none" && side.tool_choice !== "auto") return refused("generation-policy-conflict");
  const system = proof.system.map((content) => ({ role: "developer", content }));
  const history = (items: unknown[]) => items.filter((item) => !isConfigurationUpdate(item));
  const pending = history(side.input);
  const sharesHistory = (live: unknown[], offset: number): boolean =>
    live.length > 0 &&
    pending.length > offset + live.length &&
    equal(live, pending.slice(offset, offset + live.length));
  let candidate: ResponsesRequest;
  if (typeof reference.instructions === "string") {
    if (
      !proof.system.length ||
      reference.instructions !== proof.system.join("\n\n") ||
      typeof side.instructions !== "string" ||
      !reference.instructions.startsWith(side.instructions)
    )
      return refused("system-prefix-unconfirmed");
    if (!sharesHistory(history(reference.input), 0)) return refused("prefix-projection-changed");
    candidate = { ...side, instructions: reference.instructions };
  } else {
    if (side.instructions !== undefined || !system.length || !equal(reference.input.slice(0, system.length), system))
      return refused("system-prefix-unconfirmed");
    const live = history(reference.input.slice(system.length));
    const boundaries: number[] = [];
    for (let count = 0; count <= system.length; count++) {
      const prefix = side.input.slice(0, count);
      const systemPrefix = prefix.every((item, index) => {
        const known = system[index]!;
        return (
          equal(item, known) ||
          (index === count - 1 &&
            object(item) &&
            typeof item.content === "string" &&
            known.content.startsWith(item.content) &&
            equal(item, { ...known, content: item.content }))
        );
      });
      if (systemPrefix && sharesHistory(live, count)) boundaries.push(count);
    }
    if (boundaries.length !== 1) return refused("prefix-projection-changed");
    candidate = { ...side, input: [...structuredClone(system), ...side.input.slice(boundaries[0]!)] };
  }
  const axes = Number(!equal(reference.reasoning, side.reasoning));
  const unprojected =
    Number(!equal(reference.tool_choice, side.tool_choice)) +
    Number(!equal(reference.input.filter(isConfigurationUpdate), side.input.filter(isConfigurationUpdate)));
  return equal(candidate, side)
    ? { reason: "already-aligned", axes, unprojected }
    : { reason: "rewritten", body: candidate, axes, unprojected };
}
