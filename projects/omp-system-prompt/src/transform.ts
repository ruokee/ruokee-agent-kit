import { buildHostTemplate, isHostTemplateRender } from "./host-template.ts";
import { getDeliveryChapter } from "./template.ts";

/**
 * Host-template route of the OMP system prompt.
 *
 * Input is the ordered block array delivered by `before_agent_start`. The
 * component acts only when a user selected its generated template and the
 * host rendered it into one block: that block stays as the host rendered it,
 * the owned Delivery chapter becomes its own block right after it, and the
 * host `<project-context>` footer is corrected in place. Recognition needs the
 * owned template's own static text, so an unknown template, `SYSTEM.md`, a
 * `--system-prompt` value, or the host default prompt is never claimed and
 * stays unchanged.
 *
 * Each step that cannot confirm its boundary leaves its input alone and is
 * reported as a note on a successful result.
 */

/** Bounded reason for leaving a recognized template render unchanged. */
export type RejectReason = "ambiguous-boundary";

/** Bounded reason for leaving one host-template step alone. */
export type StepSkipReason = "delivery-block-conflict" | "project-footer-ambiguous" | "project-footer-not-recognized";

/**
 * One host-template step that did not change this turn's input. The main
 * block stays active; the note names the step and why it left the input as
 * it found it.
 */
export interface StepNote {
  step: "delivery" | "project-footer";
  reason: StepSkipReason;
}

/** Outcome for one turn whose input carries a render of the owned template. */
export type TransformResult =
  { ok: true; blocks: string[]; changed: boolean; notes?: readonly StepNote[] } | { ok: false; reason: RejectReason };

/** Recognition material derived once from the owned template source. */
export interface OwnedTemplate {
  /** Static skeleton of the generated host template, in order. */
  anchors: readonly string[];
  /** The owned Delivery chapter as a standalone block. */
  chapter: string;
}

/** Derive the recognition material, or `null` when the source cannot bind. */
export function prepareTemplate(source: string): OwnedTemplate | null {
  const built = buildHostTemplate(source);
  const chapter = getDeliveryChapter(source);
  if (built === null || chapter === null) return null;
  return { anchors: built.anchors, chapter };
}

/** The host's fixed three-instruction critical tail, tags included. */
const PROJECT_CRITICAL_BLOCK = [
  "<critical>",
  "- Each response MUST advance the task; completion only stopping condition.",
  "- MUST default to informed action; do not ask for confirmation when tools or repo context can answer.",
  "- Before yielding, MUST verify significant behavioral changes: run the specific test, command, or scenario covering the change.",
  "</critical>",
].join("\n");
const SUBAGENT_PROJECT_CRITICAL_BLOCK = [
  "<critical>",
  "- Each response MUST advance the task; completion only stopping condition.",
  "- MUST default to informed action; do not ask for confirmation when tools or repo context can answer.",
  "- Changes complete → yield; verification is main agent's job. NEVER run it yourself unless your assignment explicitly instructs it.",
  "</critical>",
].join("\n");

/** First line-start index of `needle` at or after `from`, or -1. */
function findLineStart(text: string, from: number, needle: string): number {
  let at = text.indexOf(needle, from);
  while (at !== -1 && at !== 0 && text[at - 1] !== "\n") at = text.indexOf(needle, at + 1);
  return at;
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

// ---------------------------------------------------------------------------
// Project footer
// ---------------------------------------------------------------------------

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

const PROJECT_CONTEXT_OPEN = "<project-context>\n";
const PROJECT_CONTEXT_CLOSE = "</project-context>";
const OWNED_PROJECT_CONTEXT_MARKER = "<!-- omp-system-prompt:project-context -->";
const ACTIVE_REPO_OPEN = "<active-repo-context>\n";
const ACTIVE_REPO_CLOSE = "</active-repo-context>";

/** Containers the new footer may carry after the loading instructions. */
const FOOTER_TAIL_CONTAINERS = [
  [WORKSPACE_TREE_OPEN, WORKSPACE_TREE_CLOSE],
  [WORKSPACE_ROOTS_OPEN, WORKSPACE_ROOTS_CLOSE],
  [ACTIVE_REPO_OPEN, ACTIVE_REPO_CLOSE],
] as const;

const DELIVERY_HEADING = "# Delivery\n";

/** Bounded failure while parsing the new footer. */
class FooterFailure extends Error {
  constructor(readonly reason: Exclude<StepSkipReason, "delivery-block-conflict">) {
    super(reason);
  }
}

function failFooter(reason: Exclude<StepSkipReason, "delivery-block-conflict">): never {
  throw new FooterFailure(reason);
}

type FooterSkipReason = Exclude<StepSkipReason, "delivery-block-conflict">;

/** Rewritten footer text, or the reason it was left alone. */
type FooterOutcome = { kind: "rewritten"; text: string } | { kind: "unchanged"; reason: FooterSkipReason };

interface ContainerSpan {
  /** First byte of the container's content. */
  bodyAt: number;
  /** First byte after the close marker. */
  end: number;
}

/**
 * Locate one `<tag>…</tag>` container at `from`.
 *
 * The close marker must be a line start and must occur once in the remaining
 * block, so a rule body or the append text that mentions the same marker is
 * rejected instead of being cut apart. `null` means the open tag is absent; a
 * missing or repeated close marker fails the whole footer parse.
 */
function containerSpan(block: string, from: number, open: string, close: string): ContainerSpan | null {
  if (!block.startsWith(open, from)) return null;
  const openEnd = from + open.length;
  const closeAt = findLineStart(block, openEnd, close);
  if (closeAt === -1) failFooter("project-footer-not-recognized");
  if (findLineStart(block, closeAt + close.length, close) !== -1) failFooter("project-footer-ambiguous");
  return { bodyAt: openEnd, end: closeAt + close.length };
}

/**
 * Rewrite the new host's `<project-context>` footer.
 *
 * The owned strategy replaces the outer loading instructions and fixed
 * critical tail. A footer without loading instructions gets an ownership
 * marker after the workstation only when removing its fixed tail exposes a
 * complete known critical block at the append start. The `<project-context>`
 * markers, workstation, context bodies, directory paths, workspace data,
 * active-repo text, and append stay byte-for-byte. An already-owned footer
 * parses to itself; an ambiguous boundary fails instead of cutting content.
 */
function parseProjectContext(block: string): string {
  const outer = containerSpan(block, 0, PROJECT_CONTEXT_OPEN, PROJECT_CONTEXT_CLOSE);
  if (outer === null) failFooter("project-footer-not-recognized");
  const workstation = containerSpan(
    block,
    skipBlankLines(block, PROJECT_CONTEXT_OPEN.length),
    WORKSTATION_OPEN,
    WORKSTATION_CLOSE,
  );
  if (workstation === null) failFooter("project-footer-not-recognized");

  const edits: Array<[number, number, string]> = [];
  let cursor = skipBlankLines(block, workstation.end);
  let ownedFooter = false;
  if (block.startsWith(OWNED_PROJECT_CONTEXT_MARKER, cursor)) {
    ownedFooter = true;
    cursor = skipBlankLines(block, cursor + OWNED_PROJECT_CONTEXT_MARKER.length);
  }
  let hasContext = false;
  let hasDirs = false;

  const repoRules = containerSpan(block, cursor, REPO_RULES_OPEN, REPO_RULES_CLOSE);
  if (repoRules !== null) {
    const hostIntro = block.startsWith(REPO_RULES_INTRO, repoRules.bodyAt);
    if (hostIntro) edits.push([repoRules.bodyAt, repoRules.bodyAt + REPO_RULES_INTRO.length, OWNED_REPO_RULES_INTRO]);
    else if (!block.startsWith(OWNED_REPO_RULES_INTRO, repoRules.bodyAt)) {
      failFooter("project-footer-not-recognized");
    }
    hasContext = true;
    cursor = skipBlankLines(block, repoRules.end);
  }

  const dirContext = containerSpan(block, cursor, DIR_CONTEXT_OPEN, DIR_CONTEXT_CLOSE);
  if (dirContext !== null) {
    hasDirs = true;
    cursor = skipBlankLines(block, dirContext.end);
  }

  if (hasContext || hasDirs) {
    const owned = OWNED_AUTO_LOADED_LINES.find((line) => block.startsWith(line, cursor));
    if (block.startsWith(AUTO_LOADED_LINE, cursor)) {
      edits.push([
        cursor,
        cursor + AUTO_LOADED_LINE.length,
        hasContext ? OWNED_AUTOLOADED_WITH_BODIES : OWNED_AUTOLOADED_DIRS_ONLY,
      ]);
      cursor = skipBlankLines(block, cursor + AUTO_LOADED_LINE.length);
    } else if (owned !== undefined) {
      ownedFooter = true;
      cursor = skipBlankLines(block, cursor + owned.length);
    } else {
      failFooter("project-footer-not-recognized");
    }
  }

  for (const [open, close] of FOOTER_TAIL_CONTAINERS) {
    const span = containerSpan(block, cursor, open, close);
    if (span !== null) cursor = skipBlankLines(block, span.end);
  }
  if (cursor !== outer.end - PROJECT_CONTEXT_CLOSE.length) failFooter("project-footer-not-recognized");

  // The fixed critical tail the owned closing policy replaces; anything after
  // it is the session's append text and survives verbatim. The blank line that
  // separated the tail from `</project-context>` goes with it, so the append
  // keeps a single separating blank line.
  const criticalAt = skipBlankLines(block, outer.end);
  const critical = ownedFooter
    ? null
    : block.startsWith(PROJECT_CRITICAL_BLOCK, criticalAt)
      ? PROJECT_CRITICAL_BLOCK
      : block.startsWith(SUBAGENT_PROJECT_CRITICAL_BLOCK, criticalAt)
        ? SUBAGENT_PROJECT_CRITICAL_BLOCK
        : null;
  if (critical !== null && !hasContext && !hasDirs) {
    const appendAt = skipBlankLines(block, criticalAt + critical.length);
    if (
      block.startsWith(PROJECT_CRITICAL_BLOCK, appendAt) ||
      block.startsWith(SUBAGENT_PROJECT_CRITICAL_BLOCK, appendAt)
    ) {
      edits.push([workstation.end, workstation.end, `\n\n${OWNED_PROJECT_CONTEXT_MARKER}`]);
    }
  }
  const tailAt = criticalAt >= 2 && block.slice(criticalAt - 2, criticalAt) === "\n\n" ? criticalAt - 2 : criticalAt;
  const parts: string[] = [];
  let position = 0;
  for (const [from, to, replacement] of edits) {
    parts.push(block.slice(position, from), replacement);
    position = to;
  }
  parts.push(block.slice(position, critical === null ? block.length : tailAt));
  if (critical !== null) parts.push(block.slice(criticalAt + critical.length));
  return parts.join("");
}

/** Rewrite the host `<project-context>` footer, or report why it stayed. */
function rewriteProjectFooter(block: string): FooterOutcome {
  try {
    return { kind: "rewritten", text: parseProjectContext(block) };
  } catch (error) {
    if (error instanceof FooterFailure) return { kind: "unchanged", reason: error.reason };
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Transform entry
// ---------------------------------------------------------------------------

/**
 * Transform one turn's blocks when the host rendered the component's own
 * template.
 *
 * Returns `undefined` when no block is such a render: the input is not the
 * component's to change and nothing is reported. Two renders in one turn are
 * an ambiguous boundary. Otherwise the main block is kept as the host rendered
 * it, the owned Delivery chapter follows it as its own block, and the footer
 * is corrected in place.
 */
export function transformSystemPrompt(
  blocks: readonly string[],
  owned: OwnedTemplate,
  renderDelivery = true,
): TransformResult | undefined {
  const { anchors, chapter } = owned;
  let mainIndex = -1;
  for (const [index, block] of blocks.entries()) {
    if (!isHostTemplateRender(block, anchors)) continue;
    if (mainIndex !== -1) return { ok: false, reason: "ambiguous-boundary" };
    mainIndex = index;
  }
  if (mainIndex === -1) return undefined;

  const notes: StepNote[] = [];
  const neighbor = blocks[mainIndex + 1];
  let insertDelivery = false;
  let removeDelivery = false;
  if (renderDelivery) {
    if (neighbor !== chapter) {
      if (neighbor !== undefined && neighbor.startsWith(DELIVERY_HEADING)) {
        // Another writer owns the Delivery slot this turn; the component does
        // not overwrite it, and reports why its own chapter stayed out.
        notes.push({ step: "delivery", reason: "delivery-block-conflict" });
      } else {
        insertDelivery = true;
      }
    }
  } else if (neighbor === chapter) {
    removeDelivery = true;
  }

  const footers = blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block, index }) => index !== mainIndex && block.startsWith(PROJECT_CONTEXT_OPEN));
  let footerIndex = -1;
  let footerText: string | null = null;
  if (footers.length > 1) {
    notes.push({ step: "project-footer", reason: "project-footer-ambiguous" });
  } else {
    const footer = footers[0];
    if (footer !== undefined) {
      footerIndex = footer.index;
      const outcome = rewriteProjectFooter(footer.block);
      if (outcome.kind === "rewritten") footerText = outcome.text;
      else notes.push({ step: "project-footer", reason: outcome.reason });
    }
  }

  const out: string[] = [];
  for (const [index, block] of blocks.entries()) {
    if (index === mainIndex) {
      out.push(block);
      if (insertDelivery) out.push(chapter);
      continue;
    }
    if (removeDelivery && index === mainIndex + 1) continue;
    if (index === footerIndex && footerText !== null) {
      out.push(footerText);
      continue;
    }
    out.push(block);
  }
  const changed = out.length !== blocks.length || out.some((block, index) => block !== blocks[index]);
  const result: TransformResult = { ok: true, blocks: out, changed };
  return notes.length === 0 ? result : { ...result, notes };
}
