import { isDeepStrictEqual as equal } from "node:util";
import { claudeCodeSystemInstruction } from "@oh-my-pi/pi-ai/providers/claude-code-fingerprint";
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
export interface AnthropicSource extends ResponsesSource {
  readonly oauth: boolean;
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

/** Session bookkeeping can be filled after dispatch; every other source field remains part of the proof. */
function sameSource(source: unknown, snapshot: unknown): boolean {
  if (equal(source, snapshot)) return true;
  if (!object(source) || !object(snapshot) || source.role !== "assistant" || snapshot.role !== "assistant")
    return false;
  const { completedAt: _sourceCompletedAt, contextSnapshot: _sourceContext, ...sourceInput } = source;
  const { completedAt: _snapshotCompletedAt, contextSnapshot: _snapshotContext, ...snapshotInput } = snapshot;
  return equal(sourceInput, snapshotInput);
}

/** Restore only the proved system expression. Native history, effort controls, and generation policy stay native. */
export function alignResponses(reference: ResponsesRequest, side: ResponsesRequest, proof: ResponsesProof): Alignment {
  const refused = (reason: string): Alignment => ({ reason, axes: 0, unprojected: 0 });
  if (!Array.isArray(reference.input) || !Array.isArray(side.input)) return refused("unsupported-payload-shape");
  if (
    !proof.source.length ||
    proof.snapshot.length <= proof.source.length ||
    !proof.source.every((message, index) => sameSource(message, proof.snapshot[index]))
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

const cacheControl = z.object({ type: z.literal("ephemeral"), ttl: z.enum(["5m", "1h"]).optional() }).strict();
const anthropicToolChoice = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }).strict(),
  z.object({ type: z.literal("auto"), disable_parallel_tool_use: z.boolean().optional() }).strict(),
]);
const cacheableBlocks: Record<string, true> = {
  text: true,
  image: true,
  document: true,
  tool_use: true,
  tool_result: true,
  server_tool_use: true,
};

/** Normalize only native content-block cache decorations, never tool inputs or opaque replay data. */
function anthropicContent(content: unknown): unknown {
  if (typeof content === "string") return [{ type: "text", text: content }];
  if (!Array.isArray(content)) return content;
  return content.map((block: unknown) => {
    if (!object(block) || cacheableBlocks[String(block.type)] !== true || !Object.hasOwn(block, "cache_control"))
      return block;
    const { cache_control: _cache, ...value } = block;
    return value;
  });
}

/** Provider cache order is tools, system, then messages; longer TTLs must precede shorter ones. */
function anthropicCache(request: ChatRequest): { lifetimes: number[]; system: number[] } | undefined {
  if (request.cache_control !== undefined) return undefined;
  const tools = Array.isArray(request.tools) ? request.tools : [];
  const system = Array.isArray(request.system) ? request.system : [];
  const blocks: unknown[] = [...tools, ...system];
  if (Array.isArray(request.messages)) {
    for (const message of request.messages) {
      if (!object(message) || !Array.isArray(message.content)) continue;
      for (const block of message.content) {
        if (object(block) && block.cache_control !== undefined && cacheableBlocks[String(block.type)] !== true)
          return undefined;
        blocks.push(block);
      }
    }
  }
  const lifetimes: number[] = [],
    systemLifetimes: number[] = [];
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    if (!object(block) || block.cache_control === undefined) continue;
    const parsed = cacheControl.safeParse(block.cache_control);
    if (!parsed.success) return undefined;
    const ttl = parsed.data.ttl === "1h" ? 60 : 5;
    if (lifetimes.length && ttl > lifetimes[lifetimes.length - 1]!) return undefined;
    lifetimes.push(ttl);
    if (index >= tools.length && index < tools.length + system.length) systemLifetimes.push(ttl);
  }
  return lifetimes.length <= 4 ? { lifetimes, system: systemLifetimes } : undefined;
}

/** Preserve native Anthropic generation and history; restore only a proved system prefix. */
export function alignAnthropic(
  reference: ChatRequest,
  side: ChatRequest,
  proof: ResponsesProof & { readonly oauth: boolean },
): Alignment {
  const refused = (reason: string): Alignment => ({ reason, axes: 0, unprojected: 0 });
  if (
    !Array.isArray(reference.messages) ||
    !Array.isArray(side.messages) ||
    !Array.isArray(reference.system) ||
    !Array.isArray(side.system)
  )
    return refused("unsupported-payload-shape");
  if (
    !proof.source.length ||
    proof.snapshot.length <= proof.source.length ||
    !proof.source.every((message, index) => sameSource(message, proof.snapshot[index]))
  )
    return refused("source-prefix-unconfirmed");
  if (!equal(reference.tools, side.tools)) return refused("tool-projection-changed");
  if (!anthropicToolChoice.safeParse(side.tool_choice).success) return refused("generation-policy-conflict");
  const live = reference.system,
    pending = side.system;
  const textBlock = (block: unknown): block is Record<string, unknown> & { text: string } =>
    object(block) &&
    block.type === "text" &&
    typeof block.text === "string" &&
    Object.keys(block).every((key) => ["type", "text", "cache_control"].includes(key));
  if (!live.every(textBlock) || !pending.every(textBlock) || !proof.system.length)
    return refused("system-prefix-unconfirmed");
  const offset = live.length - proof.system.length;
  if (offset !== 0 && (offset !== 2 || !proof.oauth)) return refused("system-prefix-unconfirmed");
  if (offset === 2) {
    const billing = /^x-anthropic-billing-header: cc_version=[^;]+; cc_entrypoint=cli; cch=00000;$/;
    if (
      pending.length < 2 ||
      !billing.test(live[0]!.text) ||
      !billing.test(pending[0]!.text) ||
      live[1]!.text !== claudeCodeSystemInstruction ||
      pending[1]!.text !== claudeCodeSystemInstruction
    )
      return refused("system-prefix-unconfirmed");
  }
  if (
    proof.system.some((text) => text.startsWith("x-anthropic-billing-header:")) ||
    !equal(
      live.slice(offset).map((block) => block.text),
      proof.system,
    ) ||
    pending.length > live.length ||
    !pending
      .slice(offset)
      .every((block, index, prefix) =>
        index === prefix.length - 1 ? proof.system[index]!.startsWith(block.text) : proof.system[index] === block.text,
      )
  )
    return refused("system-prefix-unconfirmed");
  const sideMessages = side.messages;
  if (
    !reference.messages.length ||
    side.messages.length <= reference.messages.length ||
    !reference.messages.every((message: unknown, index: number) => {
      const other: unknown = sideMessages[index];
      return (
        object(message) &&
        object(other) &&
        equal(
          { ...message, content: anthropicContent(message.content) },
          { ...other, content: anthropicContent(other.content) },
        )
      );
    })
  )
    return refused("prefix-projection-changed");
  const liveCache = anthropicCache(reference),
    sideCache = anthropicCache(side);
  if (
    !liveCache?.lifetimes.length ||
    !sideCache?.lifetimes.length ||
    !equal(new Set(liveCache.lifetimes), new Set(sideCache.lifetimes)) ||
    !equal(liveCache.system, sideCache.system) ||
    pending.some((block, index) => {
      const before = block.cache_control,
        after = live[index]?.cache_control;
      return object(before) && object(after) && (before.ttl ?? "5m") !== (after.ttl ?? "5m");
    })
  )
    return refused("cache-policy-unconfirmed");
  const candidate = { ...side, system: [...pending.slice(0, offset), ...live.slice(offset)] };
  if (!anthropicCache(candidate)) return refused("cache-policy-unconfirmed");
  const axes = Number(!equal(reference.thinking, side.thinking));
  const unprojected = ["tool_choice", "output_config", "context_management"].reduce(
    (count, key) => count + Number(!equal(reference[key], side[key])),
    0,
  );
  return equal(candidate, side)
    ? { reason: "already-aligned", axes, unprojected }
    : { reason: "rewritten", body: candidate, axes, unprojected };
}
