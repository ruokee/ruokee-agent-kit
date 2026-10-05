import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

export type JsonObject = Record<string, any>;
export function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function digest(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? null);
  return { sha256: createHash("sha256").update(text).digest("hex"), utf8Bytes: Buffer.byteLength(text) };
}
// Unknown inputs add no identity. Conflicting known roots poison descendants.
export function signalOwners<T extends object>(base: typeof AbortSignal.any) {
  let owners = new WeakMap<AbortSignal, T | null>();
  function any(this: typeof AbortSignal, signals: AbortSignal[]): AbortSignal {
    const combined = Reflect.apply(base, this, [signals]);
    if (!Array.isArray(signals)) return combined;
    let owner: T | null | undefined;
    for (const signal of signals) {
      const known = owners.get(signal);
      if (known === undefined) continue;
      if (known === null || (owner !== undefined && owner !== known)) {
        owner = null;
        break;
      }
      owner = known;
    }
    if (owner !== undefined) owners.set(combined, owner);
    return combined;
  }
  return {
    any,
    bind: (signal: AbortSignal, owner: T | null) => owners.set(signal, owner),
    get: (signal: AbortSignal) => owners.get(signal),
    clear: () => {
      owners = new WeakMap();
    },
  };
}

export type Alignment =
  | { ok: false; reason: string }
  | {
      ok: true;
      body: JsonObject;
      changes: {
        tools: boolean;
        reminders: number[];
        steering: number[];
        compactionIds: number[];
        toolChoice: boolean;
      };
      sharedItems: number;
      appendedItems: number;
    };

function hasReminder(part: unknown, cwd: string): boolean {
  if (!isObject(part) || part.type !== "input_text" || typeof part.text !== "string") return false;
  const match = part.text.match(
    /^<system-reminder>\nToday: (\d{4}-\d{2}-\d{2}); current working directory: '([^\n]*)'\. Do not repeat this information in your reply\.\n<\/system-reminder>$/,
  );
  return match !== null && match[2] === cwd.replace(/\\/g, "/");
}

// Host 18.5.1 prompts/steering/user-interjection.md. Unknown envelopes reject.
const STEERING_PREFIX =
  "<system-notice>\nUser interjection during work: priority; supersedes conflicting prior instructions. Re-read; ensure current work reflects user intent.\n</system-notice>\n";

// This is a checked reuse of an actual online request, not a second serializer.
// Every validation finishes before a replacement body is returned.
export function alignCompaction(live: JsonObject, request: JsonObject, cwd: string): Alignment {
  const fail = (reason: string): Alignment => ({ ok: false, reason });
  if (!Array.isArray(live.input) || !Array.isArray(request.input)) return fail("input-shape");
  if (!isDeepStrictEqual(request.input.at(-1), { type: "compaction_trigger" })) return fail("not-native-v2");
  if (request.store !== false || request.stream !== true) return fail("native-v2-flags");
  if (live.input.length === 0 || request.input.length <= live.input.length) return fail("history-prefix-length");
  for (const key of new Set([...Object.keys(live), ...Object.keys(request)])) {
    if (["input", "tools", "tool_choice"].includes(key)) continue;
    if (!isDeepStrictEqual(live[key], request[key])) return fail(`top-level:${key}`);
  }
  if (!Array.isArray(live.tools) || !Array.isArray(request.tools) || live.tools.length !== request.tools.length)
    return fail("tool-set");
  for (let i = 0; i < live.tools.length; i++) {
    if (live.tools[i]?.type !== request.tools[i]?.type || live.tools[i]?.name !== request.tools[i]?.name)
      return fail("tool-identity");
  }
  const changes = {
    tools: !isDeepStrictEqual(live.tools, request.tools),
    reminders: [] as number[],
    steering: [] as number[],
    compactionIds: [] as number[],
    toolChoice: false,
  };
  if (live.tool_choice === undefined && request.tool_choice === "auto") changes.toolChoice = true;
  else if (!isDeepStrictEqual(live.tool_choice, request.tool_choice)) return fail("explicit-tool-choice");
  for (let i = 0; i < live.input.length; i++) {
    const before = request.input[i];
    const expected = live.input[i];
    if (isDeepStrictEqual(before, expected)) continue;
    if (!isObject(before) || !isObject(expected)) return fail(`input-shape:${i}`);
    if (
      before.type === "compaction" &&
      expected.type === "compaction" &&
      !Object.hasOwn(expected, "id") &&
      typeof before.id === "string"
    ) {
      const { id: _id, ...replay } = before;
      if (isDeepStrictEqual(replay, expected)) {
        changes.compactionIds.push(i);
        continue;
      }
    }
    if (
      before.role === "user" &&
      expected.role === "user" &&
      Array.isArray(before.content) &&
      Array.isArray(expected.content)
    ) {
      let content = expected.content;
      let reminder = false;
      let steering = false;
      if (hasReminder(content[0], cwd)) {
        content = content.slice(1);
        reminder = true;
      }
      const first = content[0];
      if (isObject(first) && first.type === "input_text" && typeof first.text === "string") {
        let text = first.text;
        const split = text.indexOf("\n\n");
        if (split !== -1 && hasReminder({ ...first, text: text.slice(0, split) }, cwd)) {
          text = text.slice(split + 2);
          reminder = true;
        }
        if (text.startsWith(STEERING_PREFIX)) {
          text = text.slice(STEERING_PREFIX.length);
          steering = true;
        }
        if (text !== first.text) content = [{ ...first, text }, ...content.slice(1)];
      }
      if ((reminder || steering) && isDeepStrictEqual(before, { ...expected, content })) {
        if (reminder) changes.reminders.push(i);
        if (steering) changes.steering.push(i);
        continue;
      }
    }
    return fail(`shared-input:${i}`);
  }
  const body = { ...request };
  if (changes.tools) body.tools = live.tools;
  if (changes.toolChoice) delete body.tool_choice;
  if (changes.reminders.length || changes.steering.length || changes.compactionIds.length) {
    body.input = request.input.slice();
    for (const i of [...changes.reminders, ...changes.steering, ...changes.compactionIds])
      body.input[i] = live.input[i];
  }
  return {
    ok: true,
    body,
    changes,
    sharedItems: live.input.length,
    appendedItems: request.input.length - live.input.length - 1,
  };
}

/** Prove the raw history boundary before splicing its completed host projection. */
export function alignProjectedCompaction(
  live: JsonObject,
  request: JsonObject,
  projection: { raw: unknown[]; result: unknown[] },
  cwd: string,
): Alignment {
  const raw = alignCompaction({ ...request, input: projection.raw }, request, cwd);
  if (!raw.ok) return { ok: false, reason: "raw-prefix-unproven" };
  return alignCompaction(
    live,
    {
      ...request,
      input: [...projection.result, ...request.input.slice(projection.raw.length)],
    },
    cwd,
  );
}
