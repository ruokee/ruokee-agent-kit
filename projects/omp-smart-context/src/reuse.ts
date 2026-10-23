import { isDeepStrictEqual as equal } from "node:util";
import type { Mode } from "./settings.ts";

export type Item = Record<string, unknown>;
export type Body = Record<string, unknown> & { input: Item[] };
export interface Unit {
  readonly source: readonly Item[];
  readonly sent: readonly Item[];
  readonly proof: "complete-context" | "native-independent";
}
export interface Reference {
  readonly id: number;
  readonly source: readonly Item[];
  readonly body: Body;
  readonly units: readonly Unit[];
  readonly sourceTools: unknown;
  readonly preparedTools: unknown;
  readonly expectedTools: unknown;
  readonly implicitToolChoice: boolean;
  readonly standard: boolean;
  readonly localUnconfirmed?: boolean;
}
export interface Decision {
  readonly reason: string;
  readonly body: Body;
  readonly reused: number;
  readonly retained: number;
  readonly changed: boolean;
}
export function object(value: unknown): value is Item {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function body(value: unknown): value is Body {
  return object(value) && Array.isArray(value.input) && value.input.every(object);
}
export function nativeV2(value: Body): boolean {
  return equal(value.input.at(-1), { type: "compaction_trigger" }) && value.store === false && value.stream === true;
}
function segment(values: readonly Item[], at: number, expected: readonly Item[]): boolean {
  if (!expected.length || at + expected.length > values.length) return false;
  for (let index = 0; index < expected.length; index++) if (!equal(values[at + index], expected[index])) return false;
  return true;
}
function firstKey(item: Item): unknown {
  const part = Array.isArray(item.content) ? item.content[0] : undefined;
  if (object(part) && typeof part.text === "string") return part.text;
  return item.output ?? item.call_id ?? item.encrypted_content ?? item.id ?? item.type ?? item.role;
}

/** Native source retention and independently proved sent units precede every replacement. */
export function reuse(reference: Reference, request: Body, mode: Mode): Decision {
  const fail = (reason: string): Decision => ({
    reason,
    body: request,
    reused: 0,
    retained: request.input.length,
    changed: false,
  });
  if (!nativeV2(request)) return fail("not-native-v2");
  const live = reference.body;
  for (const key of new Set([...Object.keys(live), ...Object.keys(request)])) {
    if (["input", "tools", "tool_choice", "max_output_tokens"].includes(key)) continue;
    if (!equal(live[key], request[key])) return fail("unclassified-field-difference");
  }
  for (const limit of [live.max_output_tokens, request.max_output_tokens]) {
    if (limit !== undefined && (!Number.isSafeInteger(limit) || (limit as number) <= 0))
      return fail("output-limit-unconfirmed");
  }
  const normalizeChoice =
    reference.implicitToolChoice && live.tool_choice === undefined && request.tool_choice === "auto";
  if (!normalizeChoice && !equal(live.tool_choice, request.tool_choice)) return fail("explicit-tool-choice");
  const emptyTools = equal(reference.sourceTools, []) && equal(live.tools, []) && request.tools === undefined;
  if (
    !equal(reference.expectedTools, reference.preparedTools) ||
    !equal(reference.preparedTools, live.tools) ||
    (!emptyTools && !equal(reference.sourceTools, request.tools))
  )
    return fail("tool-proof-unconfirmed");
  if (mode === "standard" && !reference.standard) return fail("projection-unconfirmed");
  const complete = reference.units.find((unit) => unit.proof === "complete-context");
  const historyLength = request.input.length - 1;
  let input: Item[];
  let reused = 0;
  let retained = 0;
  // A complete-range proof survives duplicate messages and ambiguous local matches.
  if (complete && reference.source.length <= historyLength && segment(request.input, 0, reference.source)) {
    input = [...complete.sent, ...request.input.slice(reference.source.length)];
    reused = reference.source.length;
    retained = historyLength - reused;
  } else {
    const independent = reference.units.filter((unit) => unit.proof === "native-independent");
    if (!independent.length)
      return fail(complete && !reference.localUnconfirmed ? "projection-dependency-changed" : "projection-unconfirmed");
    const positions = new Map<unknown, number[]>();
    for (let index = 0; index < historyLength; index++) {
      const key = firstKey(request.input[index]!);
      const found = positions.get(key);
      if (found) found.push(index);
      else positions.set(key, [index]);
    }
    const matches = new Map<number, Unit>();
    let cursor = 0;
    for (const unit of independent) {
      if (!unit.source.length) continue;
      let match: number | undefined;
      for (const at of positions.get(firstKey(unit.source[0]!)) ?? []) {
        if (at < cursor || at + unit.source.length > historyLength || !segment(request.input, at, unit.source))
          continue;
        if (match !== undefined) return fail("projection-unconfirmed");
        match = at;
      }
      if (match !== undefined) {
        matches.set(match, unit);
        cursor = match + unit.source.length;
      }
    }
    input = [];
    for (let index = 0; index < historyLength;) {
      const unit = matches.get(index);
      if (unit) {
        input.push(...unit.sent);
        reused += unit.source.length;
        index += unit.source.length;
      } else {
        input.push(request.input[index++]!);
        retained++;
      }
    }
    input.push(request.input[historyLength]!);
    if (!reused) return fail("projection-unconfirmed");
  }
  const calls = new Set<unknown>();
  for (const item of input) {
    if (item.type === "function_call") calls.add(item.call_id);
    if (item.type === "function_call_output" && !calls.has(item.call_id)) return fail("tool-pairing-unconfirmed");
  }
  const candidate: Body = { ...request, input };
  if (!equal(request.tools, live.tools)) candidate.tools = live.tools;
  if (normalizeChoice) delete candidate.tool_choice;
  const changed = !equal(candidate, request);
  return {
    reason: changed ? "rewritten" : "already-aligned",
    body: changed ? candidate : request,
    reused,
    retained,
    changed,
  };
}

const STEERING =
  "<system-notice>\nUser interjection during work: priority; supersedes conflicting prior instructions. Re-read; ensure current work reflects user intent.\n</system-notice>\n";
function reminder(text: unknown, cwd: string): boolean {
  if (typeof text !== "string") return false;
  const match = text.match(
    /^<system-reminder>\nToday: (\d{4}-\d{2}-\d{2}); current working directory: '([^\n]*)'\. Do not repeat this information in your reply\.\n<\/system-reminder>$/,
  );
  return match !== null && match[2] === cwd.replace(/\\/g, "/");
}
/** Recognize maintained native repairs; this does not authorize arbitrary standard-mode projections. */
export function standardResult(
  source: readonly Item[],
  sent: readonly Item[],
  cwd: string,
  allowReminder = true,
): boolean {
  if (source.length !== sent.length) return false;
  for (let index = 0; index < source.length; index++) {
    const before = source[index]!,
      after = sent[index]!;
    if (equal(before, after)) continue;
    if (
      before.type === "compaction" &&
      after.type === "compaction" &&
      typeof before.id === "string" &&
      !Object.hasOwn(after, "id")
    ) {
      const { id: _id, ...rest } = before;
      if (equal(rest, after)) continue;
    }
    if (
      before.role !== "user" ||
      after.role !== "user" ||
      !Array.isArray(before.content) ||
      !Array.isArray(after.content)
    )
      return false;
    let content = after.content;
    if (allowReminder && object(content[0]) && content[0].type === "input_text" && reminder(content[0].text, cwd))
      content = content.slice(1);
    const first = content[0];
    if (object(first) && first.type === "input_text" && typeof first.text === "string") {
      let text = first.text;
      const split = text.indexOf("\n\n");
      if (allowReminder && split !== -1 && reminder(text.slice(0, split), cwd)) text = text.slice(split + 2);
      if (text.startsWith(STEERING)) text = text.slice(STEERING.length);
      if (text !== first.text) content = [{ ...first, text }, ...content.slice(1)];
    }
    if (!equal(before, { ...after, content })) return false;
  }
  return true;
}
