/**
 * Fragment sanitization: the Host-side reliability boundary between what a
 * provider publishes and what reaches the terminal.
 *
 * Every span of every published fragment passes through `sanitizeFragment`:
 *
 * 1. `spans` must be an array and every item an object with string `text`.
 * 2. `color` must match `#RRGGBB` (case-insensitive); any other present
 *    value invalidates the fragment.
 * 3. `dim` defaults to false; any present non-boolean value invalidates the
 *    fragment.
 * 4. Text first has escape sequences removed entirely, then any remaining
 *    C0/C1 control characters become one space each; runs of ASCII spaces
 *    collapse. No separator is inserted between spans; providers keep
 *    their own spacing.
 * 5. Spans whose sanitized text is empty are removed. Only the fragment's
 *    outer edges are trimmed; single spaces at span boundaries stay.
 * 6. The result is deep-copied, so later edits by the provider cannot change
 *    the UI.
 *
 * A fragment with invalid structure or span attributes returns `{ ok: false }`;
 * the Host then clears the instance's previous content and records one bounded
 * diagnostic. A valid fragment that sanitizes to nothing returns
 * `{ ok: true, fragment: { spans: [] } }` (an empty fragment), which
 * withdraws the content.
 */

import type { ProviderFragment, ProviderSpan } from "./provider-api.ts";
import { isObject } from "./object-guard.ts";

export type SanitizeResult = { ok: true; fragment: ProviderFragment } | { ok: false };

/** Pattern removing the escape sequences terminals interpret. */
const ESCAPE_PATTERN = new RegExp(
  [
    "\\x1b\\[[0-?]*[ -/]*[@-~]", // 7-bit CSI sequences
    "\\x1b\\][\\s\\S]*?(?:\\x07|\\x1b\\\\|\\x9c)", // 7-bit OSC: BEL, ESC \, or C1 ST
    "\\x1b[PX^_][\\s\\S]*?(?:\\x1b\\\\|\\x9c)", // 7-bit DCS/SOS/PM/APC: ESC \ or C1 ST
    "\\x1b.", // remaining two-byte 7-bit escapes
    "\\x9b[0-?]*[ -/]*[@-~]", // C1 CSI
    "\\x9d[\\s\\S]*?(?:\\x07|\\x1b\\\\|\\x9c)", // C1 OSC: BEL, ESC \, or C1 ST
    "\\x90[\\s\\S]*?(?:\\x1b\\\\|\\x9c)", // C1 DCS
    "\\x98[\\s\\S]*?(?:\\x1b\\\\|\\x9c)", // C1 SOS
    "\\x9e[\\s\\S]*?(?:\\x1b\\\\|\\x9c)", // C1 PM
    "\\x9f[\\s\\S]*?(?:\\x1b\\\\|\\x9c)", // C1 APC
  ].join("|"),
  "g",
);

/** Remaining C0/C1 controls; a valid control becomes one space, not nothing. */
const CONTROL_PATTERN = /[\x00-\x1f\x7f-\x9f]/g;

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** Sanitize one span's text: escapes removed, then controls become spaces. */
function sanitizeText(text: string): string {
  return text.replace(ESCAPE_PATTERN, "").replace(CONTROL_PATTERN, " ").replace(/ {2,}/g, " ");
}

/**
 * Sanitize one published fragment. See the module comment for the rules.
 * Never throws and never returns provider-owned references.
 */
export function sanitizeFragment(value: unknown): SanitizeResult {
  try {
    return sanitizeLoose(value);
  } catch {
    // A hostile getter (on `spans`, `text`, `color`, ...) can throw during
    // any property read. The publish boundary must not propagate: classify
    // as an invalid fragment and let the Host clear the entry.
    return { ok: false };
  }
}

/** Unguarded implementation; only reachable through `sanitizeFragment`. */
function sanitizeLoose(value: unknown): SanitizeResult {
  // Every observable property is read exactly once into a local; all
  // validation and construction then uses the local. A getter that returns
  // different values on successive reads cannot smuggle an unvalidated
  // second value past this boundary (no TOCTOU).
  const rawSpans = isObject(value) ? value.spans : undefined;
  if (!Array.isArray(rawSpans)) {
    return { ok: false };
  }
  const spans: ProviderSpan[] = [];
  for (const raw of rawSpans) {
    if (!isObject(raw)) {
      return { ok: false };
    }
    const text = raw.text;
    const color = raw.color;
    const dim = raw.dim;
    if (typeof text !== "string") {
      return { ok: false };
    }
    if (color !== undefined && (typeof color !== "string" || !HEX_COLOR_PATTERN.test(color))) {
      return { ok: false };
    }
    if (dim !== undefined && typeof dim !== "boolean") {
      return { ok: false };
    }
    const cleaned = sanitizeText(text);
    if (cleaned.length === 0) {
      continue;
    }
    spans.push({
      text: cleaned,
      ...(color !== undefined ? { color: color.toLowerCase() as `#${string}` } : {}),
      ...(dim === true ? { dim: true } : {}),
    });
  }
  // Trim the fragment's outer edges only: leading spaces of the first
  // visible span and trailing spaces of the last. Interior boundaries are
  // untouched. Emptied edge spans are removed so the trim continues onto
  // the next span's edge.
  while (spans.length > 0) {
    const first = spans[0];
    if (first === undefined) {
      break;
    }
    if (first.text === "") {
      spans.shift();
      continue;
    }
    if (!first.text.startsWith(" ")) {
      break;
    }
    spans[0] = { ...first, text: first.text.slice(1) };
  }
  while (spans.length > 0) {
    const last = spans.at(-1);
    if (last === undefined) {
      break;
    }
    if (last.text === "") {
      spans.pop();
      continue;
    }
    if (!last.text.endsWith(" ")) {
      break;
    }
    spans[spans.length - 1] = { ...last, text: last.text.slice(0, -1) };
  }
  const visible = spans.filter((span) => span.text.length > 0);
  return { ok: true, fragment: { spans: visible } };
}
