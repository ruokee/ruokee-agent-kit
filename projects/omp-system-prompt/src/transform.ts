import { getTemplateVariants, SLOT_NAMES, type SlotName } from "./template.ts";

/**
 * Segment-level transform of the OMP 18.1.11 default system prompt.
 *
 * Input is the ordered block array delivered by `before_agent_start`. The
 * transformer recognizes one supported default main block and one unique
 * PROJECT footer block, replaces fixed policy text in each, and leaves
 * every other block untouched. Structural recognition is atomic. A Skill
 * metadata failure is narrower: the isolated catalog stays byte-for-byte
 * unchanged while the rest of the owned prompt is still applied.
 *
 * Recognition model: the 18.1.11 default main block is a fixed sequence
 * of sections emitted by the host template, plus optional conditional
 * sections that appear in a fixed order. The transformer walks that
 * sequence with a cursor; each step may only look at the next structure set
 * allowed at that point in the host template:
 *
 *  - Required headings must appear at line start at (or after blanks at)
 *    the cursor; anything non-blank before them is unexpected content.
 *  - Optional sections are recognized only when their heading is at the
 *    cursor; every region up to a candidate next structure is either
 *    verified fixed text, a dynamic container, or a dropped fixed-policy span.
 *  - Dynamic containers enumerate line-start close and next-section
 *    candidates, then validate the complete remaining grammar. Structural
 *    lookalikes inside opaque data stay in that data when exactly one
 *    complete parse remains; multiple complete parses are rejected as
 *    ambiguous.
 *  - Retained spans are inserted verbatim into their semantic slot after
 *    stripping only leading/trailing newline runs; interiors keep every
 *    byte. Nothing is appended to the end of the owned prompt, and one
 *    owned slot is never refilled twice.
 *
 * Structural failure leaves the input array unchanged; Skill formatting
 * skips are reported on a successful result.
 */

/** Bounded reason for leaving the incoming prompt unchanged. */
export type RejectReason =
  | "empty-input"
  | "main-block-not-found"
  | "project-block-not-found"
  | "unknown-section"
  | "ambiguous-boundary"
  | "owned-output-invalid";

/** Reason for keeping the Skill catalog unchanged inside an applied prompt. */
export type SkillFormattingSkipReason = "skill-metadata-unavailable" | "skill-metadata-mismatch";

/** Recognition or replacement outcome for one turn's input. */
export type TransformResult =
  | { ok: true; blocks: string[]; changed: boolean; skillFormattingSkipped?: SkillFormattingSkipReason }
  | { ok: false; reason: RejectReason };

/**
 * Minimal Skill command metadata used only to establish catalog description
 * boundaries. `name` carries no `skill:` prefix; descriptions are compared
 * after whitespace normalization, while the event catalog stays authoritative.
 */
export interface SkillCommandMetadata {
  name: string;
  description: string;
}

/** Runtime content retained for one owned template slot. */
export type SlotValues = Record<SlotName, string>;

/** The host's fixed three-instruction critical tail, tags included. */
export const PROJECT_CRITICAL_EXACT = [
  "<critical>",
  "- Each response MUST advance the task; completion only stopping condition.",
  "- MUST default to informed action; do not ask for confirmation when tools or repo context can answer.",
  "- Before yielding, MUST verify significant behavioral changes: run the specific test, command, or scenario covering the change.",
  "</critical>",
].join("\n");
// The rendered block ends at the close tag; any bytes after it (the blank
// separator and the additional prompt) survive as the project remainder.
const PROJECT_CRITICAL_BLOCK = PROJECT_CRITICAL_EXACT;

/** Throw a bounded failure; `transformSystemPrompt` converts it to a result. */
class WalkFailure extends Error {
  constructor(readonly reason: RejectReason) {
    super(reason);
  }
}

function fail(reason: RejectReason): never {
  throw new WalkFailure(reason);
}

// ---------------------------------------------------------------------------
// Byte-level helpers
// ---------------------------------------------------------------------------

/** First line-start index of `needle` at or after `from`, or -1. */
function findLineStart(text: string, from: number, needle: string): number {
  let at = text.indexOf(needle, from);
  while (at !== -1 && at !== 0 && text[at - 1] !== "\n") at = text.indexOf(needle, at + 1);
  return at;
}

/** Count line-start occurrences of `needle` in [from, to). */
function countLineStart(text: string, from: number, to: number, needle: string): number {
  let count = 0;
  let at = findLineStart(text, from, needle);
  while (at !== -1 && at < to) {
    count += 1;
    at = findLineStart(text, at + needle.length, needle);
  }
  return count;
}

/** True when [from, to) holds only blank lines. */
function isBlankSpan(text: string, from: number, to: number): boolean {
  for (let i = from; i < to; i++) {
    const c = text.charCodeAt(i);
    if (c !== 10 && c !== 13 && c !== 32 && c !== 9) return false;
  }
  return true;
}

/** Advance over blank lines; returns the first non-blank position. */
function skipBlankLines(text: string, from: number): number {
  let i = from;
  while (i < text.length) {
    if (text[i] === "\n") i += 1;
    else if (text[i] === "\r" && text[i + 1] === "\n") i += 2;
    else break;
  }
  return i;
}

/** Strip only leading and trailing newline runs; interiors stay verbatim. */
function edgeTrimNewlines(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && (text[start] === "\n" || text[start] === "\r")) start += 1;
  while (end > start && (text[end - 1] === "\n" || text[end - 1] === "\r")) end -= 1;
  return text.slice(start, end);
}

/** Every distinct line-start position for the supplied markers, in source order. */
function lineStartCandidates(text: string, from: number, markers: readonly string[]): number[] {
  const positions = new Set<number>();
  for (const marker of markers) {
    let at = findLineStart(text, from, marker);
    while (at !== -1) {
      positions.add(at);
      at = findLineStart(text, at + marker.length, marker);
    }
  }
  return [...positions].sort((left, right) => left - right);
}

/** Try every structural candidate and keep only complete downstream parses. */
function chooseBoundary<T>(
  candidates: readonly number[],
  attempt: (candidate: number) => T,
  fallback: RejectReason,
): T {
  let successes = 0;
  let result: T | undefined;
  let lastFailure: WalkFailure | undefined;
  for (const candidate of candidates) {
    try {
      result = attempt(candidate);
      successes += 1;
      if (successes > 1) fail("ambiguous-boundary");
    } catch (error) {
      if (!(error instanceof WalkFailure)) throw error;
      if (error.reason === "ambiguous-boundary") throw error;
      lastFailure = error;
    }
  }
  if (successes === 1) return result as T;
  if (lastFailure !== undefined) throw lastFailure;
  fail(fallback);
}

/**
 * Fill markers found in the original template exactly once. The cursor never
 * scans inserted values, so marker-shaped runtime data remains byte-for-byte.
 */
function renderSlots(template: string, values: Record<SlotName, string>): string {
  const markerRe = /%%([a-z-]+)%%/g;
  const seen = new Set<SlotName>();
  const parts: string[] = [];
  let cursor = 0;
  for (const match of template.matchAll(markerRe)) {
    const name = match[1] as SlotName | undefined;
    const at = match.index;
    if (name === undefined || at === undefined || !SLOT_NAMES.includes(name) || seen.has(name)) {
      fail("unknown-section");
    }
    seen.add(name);
    parts.push(template.slice(cursor, at), values[name]);
    cursor = at + match[0].length;
    if (values[name].length === 0 && template.startsWith("\n\n", cursor)) cursor += 2;
  }
  if (seen.size !== SLOT_NAMES.length) fail("unknown-section");
  parts.push(template.slice(cursor));
  return parts.join("");
}

// ---------------------------------------------------------------------------
// Main block recognition
// ---------------------------------------------------------------------------

const ROLE_HEADING = "§ Role\n";
const ROLE_IDENTITY_LINE = "Helpful, trusted assistant for load-bearing changes in Oh My Pi coding harness.\n";
const ENGINEERING_HEADING = "# Engineering\n";
const RUNTIME_HEADING = "§ Runtime\n";
const SKILLS_HEADING = "# Skills & Rules\n";
const SKILL_MATCH_LINE = "Matching skill → MUST read `skill://<name>` first.\n";
const INTERNAL_HEADING = "# Internal URLs\n";
const INTERNAL_INTRO = "Most FS/bash tools auto-resolve these to FS paths.";
const TOOL_INVENTORY_HEADING = "# Tool Inventory\n";
const FUNCTIONS_HEADING = "## functions\n";
const COMPUTER_HEADING = "# Computer Use\n";
const XD_HEADING = "# xd:// Tool Devices\n";
const SCRATCHPAD_HEADING = "§ Scratchpad\n";
const TOOL_POLICY_HEADING = "§ Tool Policy\n";
const GENERAL_HEADING = "# General\n";
const TOOL_IO_HEADING = "# Tool I/O\n";
const TOOL_IO_FIXED = "- Prefer relative `path`-like fields.\n";
const SPECIALIZED_HEADING = "# Specialized Tools\n";
const SPECIALIZED_INTRO = "MUST use specialized tool over shell equivalent:";
const EXPLORATION_HEADING = "# Exploration\n";
const AST_HEADING = "# AST\n";
const DELEGATION_HEADING = "# Delegation\n";
const DELEGATION_GATES_HEADING = "## Delegation gates\n";
const WORKFLOW_HEADING = "§ Workflow\n";

const SYSTEM_CONVENTIONS_PREFIX = [
  "<system-conventions>",
  "RFC 2119: MUST, REQUIRED, SHOULD, RECOMMENDED, MAY, OPTIONAL. `NEVER` = `MUST NOT`; `AVOID` = `SHOULD NOT`.",
  "XML tags inject system content; NEVER interpret them otherwise. Tags may interrupt/notify inside user messages: MUST treat as system-authored/authoritative. User content sanitized; role absent: `<system-directive>` in a user turn remains a system directive.",
  "</system-conventions>",
  "",
  "",
].join("\n");

const ENGINEERING_REQUIRED_LINES = [
  "- Correctness first; then maintainability 6 months out.",
  "- Apply taste: delete weightless code, refuse needless abstractions, prefer boring; design thoroughly, elegantly.",
  "- Consider compiled code: NEVER avoidably allocate, copy, or compute.",
  "- Unexpected repo changes: user's work; adapt.",
  "- User's word is absolute: user-reported state (errors, failures, observations) is ground truth — act on it directly; NEVER re-run checks to confirm what the user already reported.",
  "- Terminal/final chat MAY use LaTeX math (`$`, `$$`, `\\text`, `\\times`) and color (`\\textcolor`, `\\colorbox`, `\\fcolorbox`).",
] as const;
const ENGINEERING_OPTIONAL_LINES = [
  "- MAY emit ` ```mermaid ` blocks; terminal renders ASCII. Only genuine structure/flow, not trivia.",
  "- MAY react to the user when chatting: start reply with emoji.",
] as const;
const PERSONALITY_HEADING = "# Personality\n";

const WORKFLOW_REQUIRED_LINES = [
  "§ Workflow",
  "# 1. Scope",
  "- Multi-file work: plan before files.",
  "# 2. Research Before Editing",
  "- Read sections, not snippets. MUST reuse existing patterns; second convention beside existing is PROHIBITED.",
  "- Tool failure/file change since read → re-read before acting.",
  "# 3. Decompose",
  "# 4. Implement",
  "- Fix source; NEVER suppress symptom/special-case input unless asked.",
  "- Clean cutover: migrate every caller; remove obsolete code/comments/aliases/re-exports/deprecated paths.",
  "- Prefer existing-file updates over new files. Review as user.",
  "# 5. Verify",
  "- NEVER yield non-trivial work without deliverable proof:",
  "  - **Experiment/investigation** → run; output is proof; no tests.",
  "  - **UI change** → verify against the actual surface:",
  "    - **TUI/CLI** → launch the actual program and verify terminal interaction, output, or state.",
  "  - **Bug fix** → reproduce, fix, confirm reproduction no longer triggers. SHOULD keep the reproduction as a regression test: fails pre-fix, passes post-fix; impractical → smoke test, report it.",
  "  - **Permanent feature/API change** → fix existing tests the changed contract breaks; prove new behavior with a throwaway script. New test ONLY for a genuinely uncertain edge case, or on user request.",
  "- Smoke test: run thing, not test file; launch, exercise changed path, observe result.",
  "- Tests: permanent load, not proof of work. A test earns its place ONLY where a plausible bug would fail it.",
  "  - Each MUST defend observable contract/fail on plausible bug.",
  "  - Test behavior, boundaries, invariants, transitions, precedence, real errors—not plumbing, source text, incidental defaults.",
  "  - Match conventions; deterministic, isolated, full-suite-safe.",
  '  - NEVER write a test so the change "has tests" → throwaway script.',
  "  - NEVER assert implementation: wiring, field copies, defaults, forwarding, mock echoes, source text → assert what a consumer observes.",
  "  - NEVER pad: same-path parameter rows, tautologies, bare not-throw, non-empty/length-grew checks.",
  "  - Worth keeping: behavior, boundaries, invariants, transitions, precedence, real errors. Match conventions; deterministic, isolated, full-suite-safe.",
  "  - Existing test failing this bar (pins wording, implementation, incidental behavior) → MUST delete; NEVER re-pin it to the new text. In scope regardless of author.",
  "# 6. Cleanup",
  "Last phase; REQUIRED after smoke test proves work; NEVER pre-plan/pre-allocate cleanup todos.",
  "- Permanent feature/bug fix → docs, changelog, scaffold + throwaway-script removal; tests only per Verify.",
  "- Experiment/one-off investigation → no cleanup tests/docs.",
  "§ Delivery",
  "<contract>",
  "Inviolable.",
  "- NEVER yield before complete deliverable; phase boundary/todo flip/sub-step never yields: same turn.",
  "- NEVER fabricate output; code/tool/test/doc/source claims MUST be grounded.",
  "- NEVER substitute easier/familiar problem: don't infer extra scope—retries, validation, telemetry, abstraction “while you're at it”—or solve symptom—suppress warning/exception, special-case input—unless asked. Real ask only.",
  "- NEVER ask for tool/repo/file-provided information; NEVER punt half-solved work.",
  "- Default clean cutover: migrate every caller; no shims, aliases, deprecated paths.",
  "</contract>",
  "<completeness>",
  "- “Done”: specified end-to-end behavior plus every named acceptance criterion; not compiling scaffold, narrowed test, plausible subset.",
  "- Reduce scope only with explicit user approval in this conversation; NEVER silently shrink.",
  "- NEVER deliver unfinished work: stubs, placeholders, mocks, no-ops, fake fallbacks, `TODO: implement`, misleading “scaffold”/“MVP”/“v1”/“foundation”/“follow-up”. Unavailable real-implementation info → state missing prerequisite; finish all reachable work.",
  "</completeness>",
  "<evidence-and-output>",
  "- Format MUST match ask; prose brief; evidence, verification, blocking details complete.",
  "- Code/tool/test/doc/source claims MUST be grounded; unobserved claims `[INFERENCE]`.",
  "- Verification claims exactly match exercised work.",
  "</evidence-and-output>",
  "<yielding>",
  "Before yielding: all affected callsites/tests/docs updated or intentionally unchanged; output/evidence requirements satisfied.",
  "Before blocked: ensure info unreachable via tools/context; one failed check ≠ blocked. Finish reachable work; state exactly missing and tried.",
  "</yielding>",
  "§ Critical",
  "<critical>",
  "- NEVER yield while actionable work remains; phase boundary/todo flip/sub-step never stops: same turn.",
  "- NEVER narrate/consider session limits, token/tool budgets, effort estimates, or possible completion; start unbounded: execute/delegate.",
  "- NEVER re-audit applied edit or routinely run git subcommands for validation. Tool results are verification.",
  "</critical>",
] as const;

const WORKFLOW_SCOPE_LINES = new Set([
  "- Read relevant skills first.",
  "- Read relevant skills and rules first.",
  "- Read relevant rules first.",
]);
const WORKFLOW_ASK_LINES = new Set([
  "- Ask before destructive commands/deleting unrelated code you didn't write; code the cutover obsoletes is in scope.",
  "- NEVER run destructive git commands/delete unrelated code you didn't write; code the cutover obsoletes is in scope.",
]);
const WORKFLOW_BROWSER_LINE =
  "    - **Web UI** → use `browser.open` to get a tab handle, its direct helpers for common actions, `tab.run` for custom JavaScript, and `tab.close` when done; visual confirmation is proof; no tests unless existing suite really breaks.";
const WORKFLOW_COMPUTER_LINE =
  "    - **Native desktop UI** → use the `computer` helpers from JavaScript or Python eval; ground every claim in fresh screenshot or accessibility evidence.";
const WORKFLOW_FALLBACK_LINE =
  "    - No suitable runtime capability for the changed surface → verify with a throwaway script or smoke test; explicitly report when visual verification cannot be performed.";
const WORKFLOW_TODO_SECOND =
  "- Todo calls NEVER alone: batch each with turn's real calls (`init` with first reads/edits; `done` with next action/final verification). Todo-only assistant turn wastes round trip.";
const WORKFLOW_LSP_RE =
  /^  - Before exported-symbol modification, MUST run `[^`]+ references`; missed callsites are bugs\.$/;
const WORKFLOW_TODO_LINE = "- Update todos; skip trivial requests.";

/** Fixed Computer Use section bytes from the 18.1.11 template. */
const COMPUTER_USE_FIXED = [
  "# Computer Use",
  "The `computer` eval prelude is enabled.",
  "- Direct helpers from JavaScript or Python Eval: `computer.window(…)`, `win.screenshot()`, `win.ax()`, `el.press()`, …; `computer.run(fnOrCode, options)` for multi-step sequences. Use `computer.capabilities()` and `computer.close()` as needed.",
  "- For host-desktop requests, NEVER substitute Browser, Bash, AppleScript, accessibility commands, or `screencapture` unless user requests that mechanism or it errors.",
  "- After UI change, gather fresh accessibility or screenshot evidence before acting.",
].join("\n");

const XD_INTRO_PREFIX = "Write JSON args as `content` to `xd://<tool>` via `";
const XD_INTRO_SUFFIX = "`. Invalid args return schema in error → fix/retry.";

const SCRATCHPAD_LINE_RE =
  /^`[^`]+`: private scratchpad; not shown to user\. MUST use for planning; other tools become callable when it completes\.$/;

const TOOL_IO_INTENT_PREFIX = "- Most tools take `";
const TOOL_IO_SECRETS_PREFIX = "- `$$HASH$$";

const AST_INTRO = "SHOULD use syntax-aware tools before text hacks:";
/** OMP sections retained in the owned runtime-modes slot. */
const OMP_RUNTIME_MODE_HEADINGS = [
  COMPUTER_HEADING,
  SCRATCHPAD_HEADING,
  TOOL_IO_HEADING,
  SPECIALIZED_HEADING,
  AST_HEADING,
] as const;

/** Keep each retained OMP section's heading/body boundary at exactly two LFs. */
function retainOmpRuntimeMode(heading: (typeof OMP_RUNTIME_MODE_HEADINGS)[number], body: string): string {
  return `${heading.trimEnd()}\n\n${body}`;
}

/** Remove every known extra blank between adjacent Specialized Tools items. */
function removeSpecializedListGap(body: string): string {
  const lines = body.split("\n");
  for (let index = 1; index < lines.length - 1;) {
    if (lines[index] === "" && lines[index - 1]?.startsWith("- ") && lines[index + 1]?.startsWith("- ")) {
      lines.splice(index, 1);
      continue;
    }
    index++;
  }
  return lines.join("\n");
}

/** Host-rendered concurrency cap line: recognized as known, never retained. */
const DELEGATION_CAP_LINE =
  /^- \*\*Cap:\*\* At most \d+ subagents? concurrently; excess queues\. (?:`tasks\[\]` batch|Parallel `task` calls) > \d+ delays results: stay within cap\.$/;

const DELEGATION_LINE_PATTERNS = [
  /^# Delegation$/,
  /^No subagents unless user or applicable AGENTS\.md\/skill explicitly requests subagents, delegation, or parallel agent work\.$/,
  /^Proactive multi-agent delegation active;/,
  /^Delegation default\. Once design settles,/,
  /^Delegation preferred\. Once design settles,/,
  /^Inline first\. Fan out only when /,
  /^- Map unknown code via `[^`]+`, not reading file after file yourself\./,
  /^- NEVER open with a scout\./,
  /^- NEVER delegate one slice\./,
  /^- NEVER babysit\./,
  /^## Delegation gates$/,
  /^- \*\*Own decomposition\.\*\* Before spawning:/,
  /^- \*\*Real concurrency\.\*\* Fan exactly to genuine decomposition/,
  /^- \*\*User intent\.\*\* Subagents lack conversation;/,
  DELEGATION_CAP_LINE,
  /^- \*\*Dependencies only\.\*\* A before B only if B strictly needs A;/,
] as const;

/** Skill catalog container; handled separately for metadata correspondence. */
const SKILLS_OPEN = "<skills>\n";
const SKILLS_CLOSE = "</skills>";

/** Containers whose content fills a slot verbatim; consumed whole. */
const SLOT_CONTAINERS = [
  { open: "<generic-rules>\n", close: "</generic-rules>", slot: "always-apply-rules" },
  { open: "<domain-rules>\n", close: "</domain-rules>", slot: "domain-rules" },
] as const;

/** Allowed first structures after the Internal URLs section. */
const INTERNAL_URLS_TERMINATORS = [
  TOOL_INVENTORY_HEADING,
  FUNCTIONS_HEADING,
  COMPUTER_HEADING,
  XD_HEADING,
  SCRATCHPAD_HEADING,
  TOOL_POLICY_HEADING,
] as const;

/** Allowed structures after the tool catalog (list entries or inline blob). */
const TOOLS_TERMINATORS = [COMPUTER_HEADING, XD_HEADING, SCRATCHPAD_HEADING, TOOL_POLICY_HEADING] as const;

/** Allowed structures after the Computer Use section. */
const COMPUTER_TERMINATORS = [XD_HEADING, SCRATCHPAD_HEADING, TOOL_POLICY_HEADING] as const;

/** Allowed structures after the xd:// devices section. */
const XD_TERMINATORS = [SCRATCHPAD_HEADING, TOOL_POLICY_HEADING] as const;

/** Allowed structures after the Scratchpad section. */
const SCRATCHPAD_TERMINATORS = [TOOL_POLICY_HEADING] as const;

/** Allowed structures after the Exploration section. */
const EXPLORATION_TERMINATORS = [AST_HEADING, DELEGATION_HEADING, WORKFLOW_HEADING] as const;

/** Allowed structures after the AST section. */
const AST_TERMINATORS = [DELEGATION_HEADING, WORKFLOW_HEADING] as const;

/** The one structure after the Delegation section. */
const DELEGATION_TERMINATORS = [WORKFLOW_HEADING] as const;

interface ParsedMain {
  slots: SlotValues;
  skillFormattingSkipped?: SkillFormattingSkipReason;
}

/** Collapse every whitespace run to one ASCII space and trim the edges. */
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

/** Result of attempting to normalize one structurally isolated Skill catalog. */
type SkillCatalogResult = {
  text: string;
  skipped?: SkillFormattingSkipReason;
};

type SkillMatch = { name: string; description: string };

/**
 * Normalize Skill catalog description whitespace using ordered command
 * metadata as candidates for the complete event directory. Metadata may
 * contain unused hidden commands; only a unique candidate subsequence that
 * covers the whole rendered directory is accepted.
 */
function normalizeSkillCatalog(catalog: string, metadata: readonly SkillCommandMetadata[]): SkillCatalogResult {
  const inner = catalog.slice(SKILLS_OPEN.length, catalog.length - SKILLS_CLOSE.length);
  if (normalizeWhitespace(inner).length === 0) return { text: catalog };
  if (metadata.length === 0) return { text: catalog, skipped: "skill-metadata-unavailable" };

  const candidates = metadata.map((entry) => {
    if (entry.name.length === 0 || /[\r\n]/u.test(entry.name)) return null;
    return {
      name: entry.name,
      description: normalizeWhitespace(entry.description),
      prefix: `- ${entry.name}:`,
    };
  });
  if (candidates.some((candidate) => candidate === null)) {
    return { text: catalog, skipped: "skill-metadata-mismatch" };
  }

  const memo = new Map<string, SkillMatch[][]>();
  const matchExact = (cursor: number, index: number): SkillMatch[][] => {
    const key = `${cursor}:${index}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    const candidate = candidates[index];
    if (candidate === null || candidate === undefined || !inner.startsWith(candidate.prefix, cursor)) {
      memo.set(key, []);
      return [];
    }

    const spanStart = cursor + candidate.prefix.length + (inner[cursor + candidate.prefix.length] === " " ? 1 : 0);
    const solutions: SkillMatch[][] = [];
    const add = (solution: SkillMatch[]): void => {
      if (solutions.length < 2) solutions.push(solution);
    };
    const current = { name: candidate.name, description: candidate.description };

    if (normalizeWhitespace(inner.slice(spanStart)) === candidate.description) {
      add([current]);
    }

    for (let nextIndex = index + 1; nextIndex < candidates.length && solutions.length < 2; nextIndex++) {
      const next = candidates[nextIndex];
      if (next === null || next === undefined) continue;
      let boundary = findLineStart(inner, spanStart, next.prefix);
      while (boundary !== -1 && solutions.length < 2) {
        if (normalizeWhitespace(inner.slice(spanStart, boundary)) === candidate.description) {
          for (const suffix of matchExact(boundary, nextIndex)) {
            add([current, ...suffix]);
            if (solutions.length >= 2) break;
          }
        }
        boundary = findLineStart(inner, boundary + next.prefix.length, next.prefix);
      }
    }

    memo.set(key, solutions);
    return solutions;
  };

  const solutions: SkillMatch[][] = [];
  for (let firstIndex = 0; firstIndex < candidates.length && solutions.length < 2; firstIndex++) {
    for (const solution of matchExact(0, firstIndex)) {
      solutions.push(solution);
      if (solutions.length >= 2) break;
    }
  }

  if (solutions.length !== 1) return { text: catalog, skipped: "skill-metadata-mismatch" };
  const entries = solutions[0];
  if (entries === undefined) return { text: catalog, skipped: "skill-metadata-mismatch" };
  return {
    text: `${SKILLS_OPEN}${entries.map((entry) => `- ${entry.name}:${entry.description.length > 0 ? ` ${entry.description}` : ""}`).join("\n")}\n${SKILLS_CLOSE}`,
  };
}

/** True when the block carries the host's fixed § Role identity lines. */
function isDefaultMainBlock(block: string): boolean {
  const at = findLineStart(block, 0, ROLE_HEADING);
  return at !== -1 && block.startsWith(ROLE_IDENTITY_LINE, at + ROLE_HEADING.length);
}

/** First line-start index at which a required heading must sit, blank gap checked. */
function takeHeading(text: string, from: number, heading: string): number {
  const at = findLineStart(text, from, heading);
  if (at === -1) fail("main-block-not-found");
  if (!isBlankSpan(text, from, at)) fail("unknown-section");
  return at + heading.length;
}

/** Validate fixed Engineering lines before a chosen structural boundary. */
function validateEngineeringSpan(block: string, from: number, to: number): void {
  const lines = edgeTrimNewlines(block.slice(from, to)).split("\n");
  if (lines.length < ENGINEERING_REQUIRED_LINES.length) fail("unknown-section");
  for (let i = 0; i < ENGINEERING_REQUIRED_LINES.length; i++) {
    if (lines[i] !== ENGINEERING_REQUIRED_LINES[i]) fail("unknown-section");
  }
  let optionalIndex = 0;
  for (const line of lines.slice(ENGINEERING_REQUIRED_LINES.length)) {
    while (optionalIndex < ENGINEERING_OPTIONAL_LINES.length && line !== ENGINEERING_OPTIONAL_LINES[optionalIndex]) {
      optionalIndex += 1;
    }
    if (optionalIndex === ENGINEERING_OPTIONAL_LINES.length) fail("unknown-section");
    optionalIndex += 1;
  }
}

/** Accept either no Personality section or one complete section before Runtime. */
function validateEngineeringChoice(block: string, from: number, runtimeAt: number): void {
  let directFailure: WalkFailure | undefined;
  try {
    validateEngineeringSpan(block, from, runtimeAt);
    return;
  } catch (error) {
    if (!(error instanceof WalkFailure)) throw error;
    directFailure = error;
  }

  const personalityCandidates = lineStartCandidates(block, from, [PERSONALITY_HEADING]).filter(
    (candidate) => candidate < runtimeAt,
  );
  if (personalityCandidates.length === 0) {
    if (directFailure !== undefined) throw directFailure;
    fail("unknown-section");
  }
  chooseBoundary(
    personalityCandidates,
    (personalityAt) => {
      validateEngineeringSpan(block, from, personalityAt);
      if (edgeTrimNewlines(block.slice(personalityAt + PERSONALITY_HEADING.length, runtimeAt)).length === 0) {
        fail("unknown-section");
      }
      return true;
    },
    "unknown-section",
  );
}

/** Validate the rendered 18.1.11 Workflow, Delivery, and Critical grammar. */
function validateWorkflowTail(tail: string): void {
  const lines = edgeTrimNewlines(tail)
    .split("\n")
    .filter((line) => line.trim().length > 0);
  let cursor = 0;
  const take = (expected: string): void => {
    if (lines[cursor] !== expected) fail("unknown-section");
    cursor += 1;
  };
  const takeRequired = (index: number): void => {
    const expected = WORKFLOW_REQUIRED_LINES[index];
    if (expected === undefined) fail("unknown-section");
    take(expected);
  };

  takeRequired(0); // § Workflow
  takeRequired(1); // Scope
  if (WORKFLOW_SCOPE_LINES.has(lines[cursor] ?? "")) cursor += 1;
  takeRequired(2);

  takeRequired(3); // Research Before Editing
  takeRequired(4);
  if (WORKFLOW_LSP_RE.test(lines[cursor] ?? "")) cursor += 1;
  takeRequired(5);

  takeRequired(6); // Decompose
  if (lines[cursor] === WORKFLOW_TODO_LINE) {
    cursor += 1;
    take(WORKFLOW_TODO_SECOND);
  }

  takeRequired(7); // Implement
  takeRequired(8);
  takeRequired(9);
  takeRequired(10);
  if (!WORKFLOW_ASK_LINES.has(lines[cursor] ?? "")) fail("unknown-section");
  cursor += 1;

  takeRequired(11); // Verify
  takeRequired(12);
  takeRequired(13);
  takeRequired(14);
  const browser = lines[cursor] === WORKFLOW_BROWSER_LINE;
  if (browser) cursor += 1;
  const computer = lines[cursor] === WORKFLOW_COMPUTER_LINE;
  if (computer) cursor += 1;
  takeRequired(15); // TUI/CLI
  if (!browser || !computer) take(WORKFLOW_FALLBACK_LINE);

  for (let index = 16; index < WORKFLOW_REQUIRED_LINES.length; index++) takeRequired(index);
  if (cursor !== lines.length) fail("unknown-section");
}

/** Walk the default main block and keep only structurally complete parses. */
function parseMainBlock(block: string, skillMetadata: readonly SkillCommandMetadata[]): ParsedMain {
  type MainState = { cursor: number; slots: SlotValues; modes: string[] };

  const roleAt = findLineStart(block, 0, ROLE_HEADING);
  if (roleAt === -1) fail("main-block-not-found");
  if (roleAt !== SYSTEM_CONVENTIONS_PREFIX.length || block.slice(0, roleAt) !== SYSTEM_CONVENTIONS_PREFIX) {
    fail("unknown-section");
  }
  let cursor = roleAt + ROLE_HEADING.length;
  if (!block.startsWith(ROLE_IDENTITY_LINE, cursor)) fail("main-block-not-found");
  cursor += ROLE_IDENTITY_LINE.length;
  cursor = takeHeading(block, cursor, ENGINEERING_HEADING);

  const initial: MainState = {
    cursor,
    slots: {
      tools: "",
      devices: "",
      "internal-urls": "",
      skills: "",
      "always-apply-rules": "",
      "domain-rules": "",
      "runtime-modes": "",
    },
    modes: [],
  };

  const advance = (state: MainState, nextCursor: number): MainState => ({
    cursor: nextCursor,
    slots: { ...state.slots },
    modes: [...state.modes],
  });
  const withSlot = (state: MainState, slot: SlotName, value: string, nextCursor: number): MainState => ({
    cursor: nextCursor,
    slots: { ...state.slots, [slot]: value },
    modes: [...state.modes],
  });
  const withMode = (state: MainState, mode: string, nextCursor: number): MainState => ({
    cursor: nextCursor,
    slots: { ...state.slots },
    modes: [...state.modes, mode],
  });

  function isValidComputerAt(at: number): boolean {
    return block.startsWith(COMPUTER_USE_FIXED, at);
  }

  function isValidDevicesAt(at: number): boolean {
    const ends = lineStartCandidates(block, at + XD_HEADING.length, XD_TERMINATORS);
    return ends.some((end) => {
      const [head] = edgeTrimNewlines(block.slice(at + XD_HEADING.length, end)).split("\n");
      return head !== undefined && head.startsWith(XD_INTRO_PREFIX) && head.endsWith(XD_INTRO_SUFFIX);
    });
  }

  function isValidScratchpadAt(at: number): boolean {
    const ends = lineStartCandidates(block, at, SCRATCHPAD_TERMINATORS);
    return ends.some((end) => {
      const lines = edgeTrimNewlines(block.slice(at, end)).split("\n");
      return lines.length === 2 && lines[1] !== undefined && SCRATCHPAD_LINE_RE.test(lines[1]);
    });
  }

  function hasValidOptionalBefore(from: number, to: number, kind: "computer" | "devices" | "scratchpad"): boolean {
    const marker = kind === "computer" ? COMPUTER_HEADING : kind === "devices" ? XD_HEADING : SCRATCHPAD_HEADING;
    const valid = kind === "computer" ? isValidComputerAt : kind === "devices" ? isValidDevicesAt : isValidScratchpadAt;
    return lineStartCandidates(block, from, [marker]).some((at) => at < to && valid(at));
  }

  function parseAfterEngineering(state: MainState): MainState {
    const runtimeCandidates = lineStartCandidates(block, state.cursor, [RUNTIME_HEADING]);
    return chooseBoundary(
      runtimeCandidates,
      (runtimeAt) => {
        validateEngineeringChoice(block, state.cursor, runtimeAt);
        return parseAfterRuntime(advance(state, runtimeAt + RUNTIME_HEADING.length));
      },
      "main-block-not-found",
    );
  }

  function parseContainers(state: MainState, index: number): MainState {
    if (index === SLOT_CONTAINERS.length) return parseInternalUrls(state);
    const container = SLOT_CONTAINERS[index];
    if (container === undefined) fail("main-block-not-found");
    const from = skipBlankLines(block, state.cursor);
    if (!block.startsWith(container.open, from)) return parseContainers(advance(state, from), index + 1);
    const closeCandidates = lineStartCandidates(block, from + container.open.length, [container.close]);
    return chooseBoundary(
      closeCandidates,
      (closeAt) => {
        const end = closeAt + container.close.length;
        return parseContainers(
          withSlot(state, container.slot, block.slice(from, end), skipBlankLines(block, end)),
          index + 1,
        );
      },
      "main-block-not-found",
    );
  }

  function parseSkillContainer(state: MainState): MainState {
    const from = skipBlankLines(block, state.cursor);
    if (!block.startsWith(SKILLS_OPEN, from)) return parseContainers(advance(state, from), 0);
    const closeCandidates = lineStartCandidates(block, from + SKILLS_OPEN.length, [SKILLS_CLOSE]);
    return chooseBoundary(
      closeCandidates,
      (closeAt) => {
        const end = closeAt + SKILLS_CLOSE.length;
        return parseContainers(withSlot(state, "skills", block.slice(from, end), skipBlankLines(block, end)), 0);
      },
      "main-block-not-found",
    );
  }

  function parseInternalUrls(state: MainState): MainState {
    const start = takeHeading(block, state.cursor, INTERNAL_HEADING);
    const ends = lineStartCandidates(block, start, INTERNAL_URLS_TERMINATORS);
    return chooseBoundary(
      ends,
      (end) => {
        const fill = edgeTrimNewlines(block.slice(start, end));
        const lines = fill.split("\n");
        const head = lines.shift()?.trimEnd() ?? "";
        if (head !== INTERNAL_INTRO) fail("unknown-section");
        for (const line of lines) {
          if (line.trim().length > 0 && !line.startsWith("- `")) fail("unknown-section");
        }
        return parseTools(withSlot(state, "internal-urls", edgeTrimNewlines(lines.join("\n")), end));
      },
      "main-block-not-found",
    );
  }

  function parseTools(state: MainState): MainState {
    if (block.startsWith(TOOL_INVENTORY_HEADING, state.cursor)) {
      const bodyStart = state.cursor + TOOL_INVENTORY_HEADING.length;
      const ends = lineStartCandidates(block, bodyStart, TOOLS_TERMINATORS);
      return chooseBoundary(
        ends,
        (end) => {
          if (
            hasValidOptionalBefore(bodyStart, end, "computer") ||
            hasValidOptionalBefore(bodyStart, end, "devices") ||
            hasValidOptionalBefore(bodyStart, end, "scratchpad")
          ) {
            fail("unknown-section");
          }
          const fill = edgeTrimNewlines(block.slice(bodyStart, end));
          if (fill.length === 0) fail("unknown-section");
          for (const line of fill.split("\n")) {
            if (line.trim().length > 0 && !line.startsWith("- ")) fail("unknown-section");
          }
          return parseComputer(withSlot(state, "tools", fill, end));
        },
        "main-block-not-found",
      );
    }
    if (block.startsWith(FUNCTIONS_HEADING, state.cursor)) {
      const ends = lineStartCandidates(block, state.cursor, TOOLS_TERMINATORS);
      return chooseBoundary(
        ends,
        (end) => {
          if (
            hasValidOptionalBefore(state.cursor, end, "computer") ||
            hasValidOptionalBefore(state.cursor, end, "devices") ||
            hasValidOptionalBefore(state.cursor, end, "scratchpad")
          ) {
            fail("unknown-section");
          }
          return parseComputer(withSlot(state, "tools", edgeTrimNewlines(block.slice(state.cursor, end)), end));
        },
        "main-block-not-found",
      );
    }
    return parseComputer(state);
  }

  function parseComputer(state: MainState): MainState {
    if (!block.startsWith(COMPUTER_HEADING, state.cursor)) return parseDevices(state);
    const bodyStart = state.cursor + COMPUTER_HEADING.length;
    const ends = lineStartCandidates(block, bodyStart, COMPUTER_TERMINATORS);
    return chooseBoundary(
      ends,
      (end) => {
        if (hasValidOptionalBefore(bodyStart, end, "devices") || hasValidOptionalBefore(bodyStart, end, "scratchpad")) {
          fail("unknown-section");
        }
        const fill = edgeTrimNewlines(block.slice(state.cursor, end));
        if (fill !== COMPUTER_USE_FIXED) fail("unknown-section");
        return parseDevices(
          withMode(state, retainOmpRuntimeMode(COMPUTER_HEADING, fill.slice(COMPUTER_HEADING.length)), end),
        );
      },
      "main-block-not-found",
    );
  }

  function parseDevices(state: MainState): MainState {
    if (!block.startsWith(XD_HEADING, state.cursor)) return parseScratchpad(state);
    const bodyStart = state.cursor + XD_HEADING.length;
    const ends = lineStartCandidates(block, bodyStart, XD_TERMINATORS);
    return chooseBoundary(
      ends,
      (end) => {
        if (hasValidOptionalBefore(bodyStart, end, "scratchpad")) fail("unknown-section");
        const fill = edgeTrimNewlines(block.slice(bodyStart, end));
        const [head, ...docs] = fill.split("\n");
        if (head === undefined || !head.startsWith(XD_INTRO_PREFIX) || !head.endsWith(XD_INTRO_SUFFIX)) {
          fail("unknown-section");
        }
        return parseScratchpad(withSlot(state, "devices", edgeTrimNewlines(docs.join("\n")), end));
      },
      "main-block-not-found",
    );
  }

  function parseScratchpad(state: MainState): MainState {
    if (!block.startsWith(SCRATCHPAD_HEADING, state.cursor)) return parseToolPolicy(state);
    const ends = lineStartCandidates(block, state.cursor, SCRATCHPAD_TERMINATORS);
    return chooseBoundary(
      ends,
      (end) => {
        const fill = edgeTrimNewlines(block.slice(state.cursor, end));
        const lines = fill.split("\n");
        if (lines.length !== 2 || lines[1] === undefined || !SCRATCHPAD_LINE_RE.test(lines[1])) {
          fail("unknown-section");
        }
        return parseToolPolicy(
          withMode(state, retainOmpRuntimeMode(SCRATCHPAD_HEADING, fill.slice(SCRATCHPAD_HEADING.length)), end),
        );
      },
      "main-block-not-found",
    );
  }

  function parseToolPolicy(state: MainState): MainState {
    if (!block.startsWith(TOOL_POLICY_HEADING, state.cursor)) fail("main-block-not-found");
    const bodyStart = state.cursor + TOOL_POLICY_HEADING.length;
    const ends = lineStartCandidates(block, bodyStart, [TOOL_IO_HEADING]);
    return chooseBoundary(
      ends,
      (toolIoAt) => {
        const generals = countLineStart(block, bodyStart, toolIoAt, GENERAL_HEADING);
        if (generals === 0) fail("main-block-not-found");
        if (generals > 1) fail("ambiguous-boundary");
        const policyLines = block.slice(bodyStart, toolIoAt).split("\n");
        if (policyLines[0] !== GENERAL_HEADING.slice(0, -1)) fail("unknown-section");
        const body = policyLines.slice(1).filter((line) => line.trim().length > 0);
        const fixed: string[] = [
          "Use tools when they improve correctness, completeness, or grounding.",
          "- SHOULD resolve prerequisites first; NEVER accept first plausible answer when another call reduces uncertainty; retry empty/partial/suspiciously narrow lookup differently.",
          "- SHOULD parallelize independent calls.",
        ];
        const parallelBullet =
          "- User says `parallel` or `parallelize` → MUST use `task` subagents; parallel tool calls insufficient.";
        if (body.length !== fixed.length && body.length !== fixed.length + 1) fail("unknown-section");
        for (let i = 0; i < fixed.length; i++) if (body[i] !== fixed[i]) fail("unknown-section");
        if (body.length === fixed.length + 1 && body[body.length - 1] !== parallelBullet) fail("unknown-section");
        return parseToolIo(advance(state, toolIoAt));
      },
      "main-block-not-found",
    );
  }

  function parseToolIo(state: MainState): MainState {
    let cursor = state.cursor + TOOL_IO_HEADING.length;
    if (!block.startsWith(TOOL_IO_FIXED, cursor)) fail("main-block-not-found");
    cursor += TOOL_IO_FIXED.length;
    const ends = lineStartCandidates(block, cursor, [SPECIALIZED_HEADING]);
    return chooseBoundary(
      ends,
      (specializedAt) => {
        const dynamicLines: string[] = [];
        let lineStart = cursor;
        while (lineStart < specializedAt) {
          const nl = block.indexOf("\n", lineStart);
          const lineEnd = nl === -1 ? specializedAt : nl;
          const line = block.slice(lineStart, lineEnd);
          if (line.trim().length > 0) {
            if (line.startsWith(TOOL_IO_INTENT_PREFIX) || line.startsWith(TOOL_IO_SECRETS_PREFIX)) {
              dynamicLines.push(line);
            } else {
              fail("unknown-section");
            }
          }
          lineStart = lineEnd + 1;
        }
        const nextModes =
          dynamicLines.length > 0
            ? [...state.modes, retainOmpRuntimeMode(TOOL_IO_HEADING, dynamicLines.join("\n"))]
            : [...state.modes];
        return parseSpecialized({ cursor: specializedAt, slots: { ...state.slots }, modes: nextModes });
      },
      "main-block-not-found",
    );
  }

  function parseSpecialized(state: MainState): MainState {
    if (!block.startsWith(SPECIALIZED_HEADING, state.cursor)) fail("main-block-not-found");
    const bodyStart = state.cursor + SPECIALIZED_HEADING.length;
    const ends = lineStartCandidates(block, bodyStart, [EXPLORATION_HEADING]);
    return chooseBoundary(
      ends,
      (explorationAt) => {
        const body = removeSpecializedListGap(edgeTrimNewlines(block.slice(bodyStart, explorationAt)));
        const lines = body.split("\n");
        if (lines[0] !== SPECIALIZED_INTRO) fail("unknown-section");
        for (const line of lines.slice(1)) {
          if (line.trim().length === 0) continue;
          if (line.startsWith("- ") || line === "<critical>" || line === "</critical>" || line.startsWith("`"))
            continue;
          fail("unknown-section");
        }
        return parseExploration(withMode(state, retainOmpRuntimeMode(SPECIALIZED_HEADING, body), explorationAt));
      },
      "main-block-not-found",
    );
  }

  function parseExploration(state: MainState): MainState {
    if (!block.startsWith(EXPLORATION_HEADING, state.cursor)) fail("main-block-not-found");
    const ends = lineStartCandidates(block, state.cursor + EXPLORATION_HEADING.length, EXPLORATION_TERMINATORS);
    const end = ends[0];
    if (end === undefined) fail("main-block-not-found");
    return parseAstOrDelegation(advance(state, end));
  }

  function parseAstOrDelegation(state: MainState): MainState {
    if (!block.startsWith(AST_HEADING, state.cursor)) return parseDelegationOrWorkflow(state);
    const ends = lineStartCandidates(block, state.cursor, AST_TERMINATORS);
    const end = ends[0];
    if (end === undefined) fail("main-block-not-found");
    const fill = edgeTrimNewlines(block.slice(state.cursor, end));
    if (fill.split("\n")[1] !== AST_INTRO) fail("unknown-section");
    return parseDelegationOrWorkflow(
      withMode(state, retainOmpRuntimeMode(AST_HEADING, fill.slice(AST_HEADING.length)), end),
    );
  }

  function parseDelegationOrWorkflow(state: MainState): MainState {
    if (!block.startsWith(DELEGATION_HEADING, state.cursor)) return parseWorkflow(state);
    const ends = lineStartCandidates(block, state.cursor, DELEGATION_TERMINATORS);
    return chooseBoundary(
      ends,
      (end) => {
        const gates = countLineStart(block, state.cursor, end, DELEGATION_GATES_HEADING);
        if (gates === 0) fail("main-block-not-found");
        if (gates > 1) fail("ambiguous-boundary");
        let lineStart = state.cursor;
        while (lineStart < end) {
          const nl = block.indexOf("\n", lineStart);
          const lineEnd = nl === -1 ? end : nl;
          const line = block.slice(lineStart, lineEnd);
          if (line.trim().length > 0 && !DELEGATION_LINE_PATTERNS.some((pattern) => pattern.test(line))) {
            fail("unknown-section");
          }
          lineStart = lineEnd + 1;
        }
        return parseWorkflow(advance(state, end));
      },
      "main-block-not-found",
    );
  }

  function parseWorkflow(state: MainState): MainState {
    if (!block.startsWith(WORKFLOW_HEADING, state.cursor)) fail("main-block-not-found");
    validateWorkflowTail(block.slice(state.cursor));
    return state;
  }

  function parseAfterRuntime(state: MainState): MainState {
    state = advance(state, takeHeading(block, state.cursor, SKILLS_HEADING));
    if (block.startsWith(SKILL_MATCH_LINE, state.cursor))
      state = advance(state, state.cursor + SKILL_MATCH_LINE.length);
    return parseSkillContainer(state);
  }

  const parsed = parseAfterEngineering(initial);
  parsed.slots["runtime-modes"] = parsed.modes.join("\n\n");
  const skills = normalizeSkillCatalog(parsed.slots.skills, skillMetadata);
  parsed.slots.skills = skills.text;
  return { slots: parsed.slots, skillFormattingSkipped: skills.skipped };
}

// ---------------------------------------------------------------------------
// PROJECT footer rewrite
// ---------------------------------------------------------------------------

const PROJECT_INPUT_HEADER = "PROJECT\n";
const PROJECT_SNAPSHOT_HEADER = "# Project snapshot\n";
const WORKSTATION_OPEN = "<workstation>\n";
const WORKSTATION_CLOSE = "</workstation>";
const REPO_RULES_OPEN = "<repo-rules>\n";
const REPO_RULES_CLOSE = "</repo-rules>";
const DIR_CONTEXT_OPEN = "<dir-context>\n";
const DIR_CONTEXT_CLOSE = "</dir-context>";
const WORKSPACE_TREE_OPEN = "<workspace-tree>\n";
const WORKSPACE_TREE_CLOSE = "</workspace-tree>";
const WORKSPACE_ROOTS_OPEN = "<workspace-roots>\n";
const WORKSPACE_ROOTS_CLOSE = "</workspace-roots>";

/** Host outer load-instruction lines, replaced only when fully confirmed. */
const REPO_RULES_INTRO = "MUST follow these context files for all tasks:\n";
const AUTO_LOADED_LINE =
  "Context files above auto-loaded. NEVER `grep`/`glob` for `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, or similar agent/context files: relevant files already in context; others noise.\n";

/** Owned replacements; bodies, paths, trees, roots, and append stay verbatim. */
const OWNED_REPO_RULES_INTRO = "The context file bodies in this block are already loaded.\n";
const OWNED_AUTOLOADED_WITH_BODIES =
  "The context file bodies above are loaded; do not reread them as a loading step.\n";
const OWNED_AUTOLOADED_DIRS_ONLY =
  "The directory rule paths above are listed, not loaded; fetch applicable rules before dependent work.\n";
const OWNED_AUTO_LOADED_LINES = [OWNED_AUTOLOADED_WITH_BODIES, OWNED_AUTOLOADED_DIRS_ONLY] as const;

/** True when a block is the host PROJECT footer. */
function isProjectBlock(block: string): boolean {
  return block.startsWith(PROJECT_INPUT_HEADER);
}

/**
 * True when a block is a structurally complete output of this extension's
 * PROJECT rewrite. Recognition claims the block only when the snapshot
 * heading, the required workstation container, the owned loading lines, the
 * optional containers, and the append tail line up exactly. A corrupt or
 * third-party block that merely starts with the heading is not claimed.
 */
function isOwnedProjectBlock(block: string): boolean {
  if (!block.startsWith(PROJECT_SNAPSHOT_HEADER)) return false;

  type OwnedProjectState = { cursor: number; hasContext: boolean; hasDirs: boolean };
  const consume = (
    state: OwnedProjectState,
    open: string,
    close: string,
    boundCandidates: readonly string[],
    continuation: (next: OwnedProjectState) => OwnedProjectState[],
  ): OwnedProjectState[] => {
    if (!block.startsWith(open, state.cursor)) return [];
    const openEnd = state.cursor + open.length;
    const closeAt = lineStartCandidates(block, openEnd, [close])[0];
    if (closeAt === undefined) return [];
    const nextBoundary = lineStartCandidates(block, openEnd, boundCandidates)[0];
    const duplicate = lineStartCandidates(block, closeAt + close.length, [close])[0];
    if (nextBoundary !== undefined && duplicate !== undefined && duplicate < nextBoundary) return [];
    return continuation({ ...state, cursor: skipBlankLines(block, closeAt + close.length) });
  };

  function finish(state: OwnedProjectState): OwnedProjectState[] {
    return [state];
  }

  function parseWorkspaceRoots(state: OwnedProjectState): OwnedProjectState[] {
    if (!block.startsWith(WORKSPACE_ROOTS_OPEN, state.cursor)) return finish(state);
    return consume(state, WORKSPACE_ROOTS_OPEN, WORKSPACE_ROOTS_CLOSE, [], finish);
  }

  function parseWorkspaceTree(state: OwnedProjectState): OwnedProjectState[] {
    if (!block.startsWith(WORKSPACE_TREE_OPEN, state.cursor)) return parseWorkspaceRoots(state);
    return consume(state, WORKSPACE_TREE_OPEN, WORKSPACE_TREE_CLOSE, [WORKSPACE_ROOTS_OPEN], parseWorkspaceRoots);
  }

  function parseAutoLoaded(state: OwnedProjectState): OwnedProjectState[] {
    if (state.hasContext || state.hasDirs) {
      const expected = state.hasContext ? OWNED_AUTOLOADED_WITH_BODIES : OWNED_AUTOLOADED_DIRS_ONLY;
      if (!block.startsWith(expected, state.cursor)) return [];
      return parseWorkspaceTree({ ...state, cursor: skipBlankLines(block, state.cursor + expected.length) });
    }
    return parseWorkspaceTree(state);
  }

  function parseDirContext(state: OwnedProjectState): OwnedProjectState[] {
    if (!block.startsWith(DIR_CONTEXT_OPEN, state.cursor)) return parseAutoLoaded(state);
    return consume(
      state,
      DIR_CONTEXT_OPEN,
      DIR_CONTEXT_CLOSE,
      [...OWNED_AUTO_LOADED_LINES, WORKSPACE_TREE_OPEN, WORKSPACE_ROOTS_OPEN],
      (next) => parseAutoLoaded({ ...next, hasDirs: true }),
    );
  }

  function parseRepoRules(state: OwnedProjectState): OwnedProjectState[] {
    if (!block.startsWith(REPO_RULES_OPEN, state.cursor)) return parseDirContext(state);
    const openEnd = state.cursor + REPO_RULES_OPEN.length;
    if (!block.startsWith(OWNED_REPO_RULES_INTRO, openEnd)) return [];
    return consume(
      state,
      REPO_RULES_OPEN,
      REPO_RULES_CLOSE,
      [DIR_CONTEXT_OPEN, ...OWNED_AUTO_LOADED_LINES, WORKSPACE_TREE_OPEN, WORKSPACE_ROOTS_OPEN],
      (next) => parseDirContext({ ...next, hasContext: true }),
    );
  }

  const states = consume(
    { cursor: skipBlankLines(block, PROJECT_SNAPSHOT_HEADER.length), hasContext: false, hasDirs: false },
    WORKSTATION_OPEN,
    WORKSTATION_CLOSE,
    [REPO_RULES_OPEN, DIR_CONTEXT_OPEN, ...OWNED_AUTO_LOADED_LINES, WORKSPACE_TREE_OPEN, WORKSPACE_ROOTS_OPEN],
    parseRepoRules,
  );
  return states.length === 1;
}

/** Rewrite the PROJECT footer after a complete structural parse. */
function parseProjectBlock(project: string): string {
  type ProjectState = {
    cursor: number;
    introAt: number;
    introEnd: number;
    autoAt: number;
    autoEnd: number;
    hasContext: boolean;
    hasDirs: boolean;
  };

  const initial: ProjectState = {
    cursor: skipBlankLines(project, PROJECT_INPUT_HEADER.length),
    introAt: -1,
    introEnd: -1,
    autoAt: -1,
    autoEnd: -1,
    hasContext: false,
    hasDirs: false,
  };

  function finish(state: ProjectState): string {
    if (!project.startsWith(PROJECT_CRITICAL_BLOCK, state.cursor)) fail("project-block-not-found");
    const criticalEnd = state.cursor + PROJECT_CRITICAL_BLOCK.length;
    const parts: string[] = [PROJECT_SNAPSHOT_HEADER];
    let position = PROJECT_INPUT_HEADER.length;
    const edits: Array<[number, number, string]> = [];
    if (state.introAt !== -1) edits.push([state.introAt, state.introEnd, OWNED_REPO_RULES_INTRO]);
    if (state.autoAt !== -1) {
      edits.push([
        state.autoAt,
        state.autoEnd,
        state.hasContext ? OWNED_AUTOLOADED_WITH_BODIES : OWNED_AUTOLOADED_DIRS_ONLY,
      ]);
    }
    for (const [from, to, replacement] of edits) {
      parts.push(project.slice(position, from), replacement);
      position = to;
    }
    parts.push(project.slice(position, state.cursor));
    return parts.join("") + project.slice(criticalEnd);
  }

  function chooseContainer<T>(
    state: ProjectState,
    open: string,
    close: string,
    continuation: (next: ProjectState) => T,
  ): T {
    if (!project.startsWith(open, state.cursor)) fail("project-block-not-found");
    const closeCandidates = lineStartCandidates(project, state.cursor + open.length, [close]);
    return chooseBoundary(
      closeCandidates,
      (closeAt) =>
        continuation({
          ...state,
          cursor: skipBlankLines(project, closeAt + close.length),
        }),
      "project-block-not-found",
    );
  }

  function parseWorkstation(state: ProjectState): string {
    return chooseContainer(state, WORKSTATION_OPEN, WORKSTATION_CLOSE, parseRepoRules);
  }

  function parseRepoRules(state: ProjectState): string {
    if (!project.startsWith(REPO_RULES_OPEN, state.cursor)) return parseDirContext(state);
    const openEnd = state.cursor + REPO_RULES_OPEN.length;
    if (!project.startsWith(REPO_RULES_INTRO, openEnd)) fail("project-block-not-found");
    return chooseContainer(state, REPO_RULES_OPEN, REPO_RULES_CLOSE, (next) =>
      parseDirContext({
        ...next,
        introAt: openEnd,
        introEnd: openEnd + REPO_RULES_INTRO.length,
        hasContext: true,
      }),
    );
  }

  function parseDirContext(state: ProjectState): string {
    if (!project.startsWith(DIR_CONTEXT_OPEN, state.cursor)) return parseAutoLoaded(state);
    return chooseContainer(state, DIR_CONTEXT_OPEN, DIR_CONTEXT_CLOSE, (next) =>
      parseAutoLoaded({ ...next, hasDirs: true }),
    );
  }

  function parseAutoLoaded(state: ProjectState): string {
    if (state.hasContext || state.hasDirs) {
      if (!project.startsWith(AUTO_LOADED_LINE, state.cursor)) fail("project-block-not-found");
      return parseWorkspaceTree({
        ...state,
        cursor: skipBlankLines(project, state.cursor + AUTO_LOADED_LINE.length),
        autoAt: state.cursor,
        autoEnd: state.cursor + AUTO_LOADED_LINE.length,
      });
    }
    return parseWorkspaceTree(state);
  }

  function parseWorkspaceTree(state: ProjectState): string {
    if (!project.startsWith(WORKSPACE_TREE_OPEN, state.cursor)) return parseWorkspaceRoots(state);
    return chooseContainer(state, WORKSPACE_TREE_OPEN, WORKSPACE_TREE_CLOSE, parseWorkspaceRoots);
  }

  function parseWorkspaceRoots(state: ProjectState): string {
    if (!project.startsWith(WORKSPACE_ROOTS_OPEN, state.cursor)) return finish(state);
    return chooseContainer(state, WORKSPACE_ROOTS_OPEN, WORKSPACE_ROOTS_CLOSE, finish);
  }

  return parseWorkstation(initial);
}

// ---------------------------------------------------------------------------
// Owned output recognition
// ---------------------------------------------------------------------------

const OWNED_SLOT_RE = /%%([a-z-]+)%%/g;

/** Static fragments, slot order, and the owned identity line. */
interface OwnedStructure {
  fragments: string[];
  slots: SlotName[];
  identity: string;
}
interface OwnedVariant {
  renderDelivery: boolean;
  template: string;
  structure: OwnedStructure;
}

interface OwnedMatch {
  variant: OwnedVariant;
  slots: SlotValues;
}

/**
 * Split the owned template into the static fragments around its slot
 * markers. Returns null unless every known slot appears once in template
 * order, which is the same shape `loadTemplate` accepts.
 */
function ownedStructure(template: string): OwnedStructure | null {
  const fragments: string[] = [];
  const slots: SlotName[] = [];
  let last = 0;
  for (const match of template.matchAll(OWNED_SLOT_RE)) {
    const name = match[1];
    const index = match.index;
    if (name === undefined || index === undefined) return null;
    fragments.push(template.slice(last, index));
    slots.push(name as SlotName);
    last = index + match[0].length;
  }
  fragments.push(template.slice(last));
  if (slots.length !== SLOT_NAMES.length) return null;
  for (let index = 0; index < SLOT_NAMES.length; index++) {
    if (slots[index] !== SLOT_NAMES[index]) return null;
  }
  const identity = `${template.split("\n")[0] ?? ""}\n`;
  if (identity.trim().length === 0) return null;
  return { fragments, slots, identity };
}

/**
 * Slot grammars of the owned output. Container slots must keep the shape
 * the transformer emits; `devices` and `runtime-modes` carry opaque host
 * text and stay unconstrained beyond their fragment bounds.
 */
function isValidOwnedSlot(slot: SlotName, value: string): boolean {
  switch (slot) {
    case "tools":
      if (value.length === 0) return false;
      if (value.startsWith(FUNCTIONS_HEADING)) return true;
      return value.split("\n").every((line) => line.trim().length === 0 || line.startsWith("- "));
    case "internal-urls":
      return value.split("\n").every((line) => line.trim().length === 0 || line.startsWith("- `"));
    case "skills":
      return value.length === 0 || (value.startsWith(SKILLS_OPEN) && value.endsWith(`\n${SKILLS_CLOSE}`));
    case "always-apply-rules":
      return value.length === 0 || (value.startsWith("<generic-rules>\n") && value.endsWith("</generic-rules>"));
    case "domain-rules":
      return value.length === 0 || (value.startsWith("<domain-rules>\n") && value.endsWith("</domain-rules>"));
    default:
      return true;
  }
}

/**
 * Match a block against the owned template with each slot as a wildcard.
 * Every static fragment must appear in template order, the final fragment
 * must end the block, and each captured slot must satisfy its grammar.
 * Returns the captured slots, or null when no split is valid.
 */
function matchOwnedSlots(block: string, structure: OwnedStructure): SlotValues | null {
  const { fragments, slots } = structure;
  const first = fragments[0];
  if (first === undefined || !block.startsWith(first)) return null;
  const occurrenceCache = new Map<number, number[]>();
  const occurrencesOf = (fragmentIndex: number): number[] => {
    const cached = occurrenceCache.get(fragmentIndex);
    if (cached !== undefined) return cached;
    const fragment = fragments[fragmentIndex];
    const found: number[] = [];
    if (fragment !== undefined && fragment.length > 0) {
      let at = block.indexOf(fragment);
      while (at !== -1) {
        found.push(at);
        at = block.indexOf(fragment, at + 1);
      }
    }
    occurrenceCache.set(fragmentIndex, found);
    return found;
  };
  const memo = new Map<string, SlotValues | null>();
  const walk = (slotIndex: number, from: number): SlotValues | null => {
    const slotName = slots[slotIndex];
    const next = fragments[slotIndex + 1];
    if (slotName === undefined || next === undefined) return null;
    const key = `${slotIndex}:${from}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const last = slotIndex === slots.length - 1;
    const finish = (value: string, end: number): SlotValues | null => {
      if (last) return end === block.length ? ({ [slotName]: value } as SlotValues) : null;
      const rest = walk(slotIndex + 1, end);
      return rest === null ? null : ({ ...rest, [slotName]: value } as SlotValues);
    };

    // `renderSlots` drops the blank separator after an empty slot, so an
    // empty value pairs with the following fragment minus its leading `\n\n`.
    if (isValidOwnedSlot(slotName, "")) {
      const stripped = next.startsWith("\n\n") ? next.slice(2) : next;
      if (block.startsWith(stripped, from)) {
        const empty = finish("", from + stripped.length);
        if (empty !== null) {
          memo.set(key, empty);
          return empty;
        }
      }
    }

    for (const at of occurrencesOf(slotIndex + 1)) {
      if (at <= from) continue;
      const value = block.slice(from, at);
      if (!isValidOwnedSlot(slotName, value)) continue;
      const matched = finish(value, at + next.length);
      if (matched !== null) {
        memo.set(key, matched);
        return matched;
      }
    }
    memo.set(key, null);
    return null;
  };
  return walk(0, first.length);
}

/** Match a block against every valid owned Delivery shape. */
function matchOwnedVariants(block: string, variants: readonly OwnedVariant[]): OwnedMatch[] {
  const matches: OwnedMatch[] = [];
  for (const variant of variants) {
    const slots = matchOwnedSlots(block, variant.structure);
    if (slots !== null) matches.push({ variant, slots });
  }
  return matches;
}

/** True when a block claims the owned identity but may be corrupt or forged. */
function looksOwnedMainBlock(block: string, variants: readonly OwnedVariant[]): boolean {
  return variants.some(({ structure }) => block.startsWith(structure.identity));
}

// ---------------------------------------------------------------------------
// Transform entry
// ---------------------------------------------------------------------------

/**
 * Transform one turn's block array.
 *
 * Recognition requires the exact section sequence of the 18.1.11 default
 * main block plus a unique PROJECT footer with the exact fixed critical at
 * its structural tail. A unique, structurally valid output of this
 * extension is a no-op. Anything else (custom prompts, other versions,
 * unexpected sections, extra candidates) returns the input unchanged with
 * a bounded reason. The replacement is built only after all checks pass;
 * `changed` is false when nothing differs.
 */
export function transformSystemPrompt(
  blocks: readonly string[],
  template: string | null,
  skillMetadata: readonly SkillCommandMetadata[] = [],
  renderDelivery = true,
): TransformResult {
  if (blocks.length === 0) {
    return { ok: true, blocks: [], changed: false };
  }
  if (template === null) {
    return { ok: false, reason: "unknown-section" };
  }

  const templateVariants = getTemplateVariants(template);
  if (templateVariants === null) return { ok: false, reason: "unknown-section" };
  const withDeliveryStructure = ownedStructure(templateVariants.withDelivery);
  const withoutDeliveryStructure = ownedStructure(templateVariants.withoutDelivery);
  if (withDeliveryStructure === null || withoutDeliveryStructure === null) {
    return { ok: false, reason: "unknown-section" };
  }
  const ownedVariants: OwnedVariant[] = [
    { renderDelivery: true, template: templateVariants.withDelivery, structure: withDeliveryStructure },
    { renderDelivery: false, template: templateVariants.withoutDelivery, structure: withoutDeliveryStructure },
  ];
  const targetVariant = ownedVariants.find((variant) => variant.renderDelivery === renderDelivery);
  if (targetVariant === undefined) return { ok: false, reason: "unknown-section" };

  let mainIndex = -1;
  let projectIndex = -1;
  let ownedMainIndex = -1;
  let ownedProjectIndex = -1;
  let ownedMain: OwnedMatch | undefined;
  let corruptOwned = false;
  for (const [index, block] of blocks.entries()) {
    if (isDefaultMainBlock(block)) {
      if (mainIndex !== -1) return { ok: false, reason: "ambiguous-boundary" };
      mainIndex = index;
    } else if (isProjectBlock(block)) {
      if (projectIndex !== -1) return { ok: false, reason: "ambiguous-boundary" };
      projectIndex = index;
    } else {
      const ownedMatches = matchOwnedVariants(block, ownedVariants);
      if (ownedMatches.length > 1) return { ok: false, reason: "ambiguous-boundary" };
      const ownedMatch = ownedMatches[0];
      if (ownedMatch !== undefined) {
        if (ownedMainIndex !== -1) return { ok: false, reason: "ambiguous-boundary" };
        ownedMainIndex = index;
        ownedMain = ownedMatch;
      } else if (isOwnedProjectBlock(block)) {
        if (ownedProjectIndex !== -1) return { ok: false, reason: "ambiguous-boundary" };
        ownedProjectIndex = index;
      } else if (looksOwnedMainBlock(block, ownedVariants) || block.startsWith(PROJECT_SNAPSHOT_HEADER)) {
        // Claims the owned identity or snapshot heading but failed the strict
        // structural checks: corrupted, duplicated, or third-party content.
        corruptOwned = true;
      }
    }
  }
  if (corruptOwned) return { ok: false, reason: "owned-output-invalid" };

  // Already-transformed input keeps all captured runtime slots and other
  // blocks. A setting change only switches the Delivery chapter shape; it
  // never reparses Skill metadata or fetches a host default block again.
  if (ownedMain !== undefined && ownedProjectIndex !== -1 && mainIndex === -1 && projectIndex === -1) {
    const replacementMain = renderSlots(targetVariant.template, ownedMain.slots);
    if (replacementMain === blocks[ownedMainIndex]) {
      return { ok: true, blocks: [...blocks], changed: false };
    }
    const out = [...blocks];
    out[ownedMainIndex] = replacementMain;
    return { ok: true, blocks: out, changed: true };
  }
  if (ownedMainIndex !== -1 || ownedProjectIndex !== -1) {
    return { ok: false, reason: "main-block-not-found" };
  }

  if (mainIndex === -1) return { ok: false, reason: "main-block-not-found" };
  if (projectIndex === -1) return { ok: false, reason: "project-block-not-found" };
  const main = blocks[mainIndex];
  const project = blocks[projectIndex];
  if (main === undefined || project === undefined) {
    return { ok: false, reason: "main-block-not-found" };
  }

  let parsed: ParsedMain;
  let replacementMain: string;
  let strippedProject: string;
  try {
    parsed = parseMainBlock(main, skillMetadata);
    replacementMain = renderSlots(targetVariant.template, parsed.slots);
    strippedProject = parseProjectBlock(project);
  } catch (error) {
    if (error instanceof WalkFailure) return { ok: false, reason: error.reason };
    throw error;
  }

  const out: string[] = [];
  let changed = false;
  for (const [index, block] of blocks.entries()) {
    if (index === mainIndex) {
      out.push(replacementMain);
      if (replacementMain !== main) changed = true;
    } else if (index === projectIndex) {
      out.push(strippedProject);
      if (strippedProject !== project) changed = true;
    } else {
      out.push(block);
    }
  }
  if (parsed.skillFormattingSkipped === undefined) return { ok: true, blocks: out, changed };
  return { ok: true, blocks: out, changed, skillFormattingSkipped: parsed.skillFormattingSkipped };
}
