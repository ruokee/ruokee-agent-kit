/**
 * Host-template route material.
 *
 * `prompt-template.md` stays the single source of the owned strategy. This
 * module turns that source into the Handlebars template the host renders for
 * the component's own instruction block: every owned slot marker becomes a
 * binding to the data the host already filtered, so tools, Skills, rules,
 * devices, and URI catalogs stay dynamic and no user resource is read here.
 *
 * The runtime sections mirror the host's own field-driven lines for those
 * sections; a host rewording or field change there needs a binding update.
 * Nothing else of the host's bundled template is copied, and the owned
 * sections keep the component's own text.
 *
 * The generated file is committed beside the component and selected through
 * the host's own template mechanism; a check keeps artifact and source in
 * step. The extension derives its recognition anchors from the same source,
 * so the artifact is never the runtime input of the component itself.
 */

import { getTemplateVariants, splitTemplateSlots, SLOT_NAMES, type SlotName } from "./template.ts";

/** Committed artifact, next to the component entry. */
export const HOST_TEMPLATE_FILE_NAME = "host-template.hbs";

/** Provenance line; the renderer drops the whole line. */
const PROVENANCE = "{{! Generated from src/prompt-template.md by src/host-template.ts; do not edit. }}\n\n";

/**
 * Host data that gates one slot's binding. A slot renders only when its data
 * is present, so an absent section leaves the boundary around it intact.
 * `runtime-modes` gates on the tool list because the host always supplies it.
 */
const SLOT_CONDITIONS: Record<SlotName, string> = {
  tools: "toolInfo.length",
  devices: "xdevDocs",
  "internal-urls": "internalUrls.length",
  skills: "skills.length",
  "always-apply-rules": "alwaysApplyRules.length",
  "domain-rules": "rules.length",
  "runtime-modes": "tools.length",
};

/**
 * Sections the owned strategy keeps from the host's bundled template, bound
 * to the host's own fields. `# Computer Use` is absent because the host
 * appends the enabled preludes as their own blocks.
 *
 * Every binding opens and closes on its own line, so an absent section adds
 * nothing at all: the host renderer drops a tag-only line together with its
 * newline, while a line that carries text keeps its newline even when its
 * condition is false. Blank lines that belong to a section live inside its
 * binding, which keeps one blank line between sections in every combination
 * and lets the renderer's blank-line compaction leave the boundaries alone.
 */
const RUNTIME_MODE_SECTIONS = [
  '{{#has tools "think"}}',
  "§ Scratchpad",
  "",
  "`{{toolRefs.think}}`: private scratchpad; not shown to user. MUST use for planning; other tools become callable when it completes.",
  "",
  "{{/has}}",
  // The owned strategy keeps the dynamic lines of this section; the host's
  // fixed line is not part of it, and neither is the heading without them.
  "{{#ifAny intentTracing secretsEnabled}}",
  "# Tool I/O",
  "",
  "{{#if intentTracing}}",
  '- Most tools take `{{intentField}}`: capitalized 2–6-word present-participle intent (e.g. "Reading model role settings").',
  "{{/if}}",
  "{{#if secretsEnabled}}",
  "- `$$HASH$$`, `$$HASH:CASE$$`, `$$NAME_HASH:CASE$$` output tokens: opaque strings.",
  "{{/if}}",
  "",
  "{{/ifAny}}",
  "# Specialized Tools",
  "",
  "MUST use specialized tool over shell equivalent:",
  '{{#has tools "read"}}',
  "- File/directory reads: `{{toolRefs.read}}` (directory lists entries).",
  "{{/has}}",
  '{{#has tools "edit"}}',
  "- Surgical edits: `{{toolRefs.edit}}`.",
  "{{/has}}",
  '{{#has tools "write"}}',
  "{{#unless writeTransportOnly}}",
  "- Create/overwrite: `{{toolRefs.write}}`.",
  "{{/unless}}",
  "{{/has}}",
  '{{#has tools "lsp"}}',
  "- Language server available: MUST use `{{toolRefs.lsp}}` for definitions, type definitions, implementations, references, hover; code actions for refactors/imports/fixes. NEVER text-search/edit for code intelligence.",
  "{{/has}}",
  '{{#has tools "find"}}',
  "- Unknown behavior/location: descriptive `{{toolRefs.find}}` FIRST; NEVER guess `grep`/`glob` targets.",
  "{{/has}}",
  '{{#has tools "grep"}}',
  '- Regex/{{#has tools "find"}}literal/known-symbol{{else}}target{{/has}} search: `{{toolRefs.grep}}`, NEVER shell `grep`/`rg`/`awk`.',
  "{{/has}}",
  '{{#has tools "glob"}}',
  "- File structure/names: `{{toolRefs.glob}}`, NEVER `ls **/*.ext`/`fd`.",
  "{{/has}}",
  '{{#has tools "bash"}}',
  "- `{{toolRefs.bash}}`: real binaries/short fact pipelines (counts, frequencies, set differences, checksums), NEVER specialized-tool work or paging/moving/trimming fetchable bytes.",
  "{{/has}}",
  '{{#has tools "edit"}}',
  "<critical>",
  "NEVER use `sed`|`perl`|`python` via `{{toolRefs.bash}}` to issue individual edits; MUST use `{{toolRefs.edit}}`.",
  "</critical>",
  "{{/has}}",
  "{{#if autoQaEnabled}}",
  '{{#has tools "write"}}',
  "",
  "<critical>",
  "`{{toolRefs.write}} xd://report_issue`: automated QA. Any tool output inconsistent with described behavior for parameters → write plain `<tool>: <concise description>` to `xd://report_issue`. False positives fine.",
  "</critical>",
  "{{/has}}",
  "{{/if}}",
  '{{#ifAny (includes tools "ast_grep") (includes tools "ast_edit")}}',
  "",
  "# AST",
  "",
  "SHOULD use syntax-aware tools before text hacks:",
  '{{#has tools "ast_grep"}}',
  "- Structural discovery → `{{toolRefs.ast_grep}}`.",
  "{{/has}}",
  '{{#has tools "ast_edit"}}',
  "- Codemods → `{{toolRefs.ast_edit}}`.",
  "{{/has}}",
  "{{/ifAny}}",
].join("\n");

/** Handlebars expression replacing one owned slot marker. */
const SLOT_BINDINGS: Record<SlotName, string> = {
  tools:
    '{{#if toolListMode}}{{#list toolInfo prefix="- " join="\\n"}}{{#if label}}{{label}}: `{{name}}`{{else}}`{{name}}`{{/if}}{{/list}}{{else}}{{toolInventory}}{{/if}}',
  devices: "{{xdevDocs}}",
  "internal-urls": '{{#list internalUrls prefix="- " join="\\n"}}{{this}}{{/list}}',
  skills: '<skills>\n{{#list skills prefix="- " join="\\n"}}{{name}}: {{description}}{{/list}}\n</skills>',
  "always-apply-rules": "<generic-rules>\n{{#each alwaysApplyRules}}{{content}}\n{{/each}}</generic-rules>",
  "domain-rules":
    '<domain-rules>\n{{#each rules}}- {{name}} ({{#list globs join=", "}}{{this}}{{/list}}): {{description}}\n{{/each}}</domain-rules>',
  "runtime-modes": RUNTIME_MODE_SECTIONS,
};

export interface HostTemplate {
  /** Artifact text: the owned strategy with each slot bound to host data. */
  text: string;
  /**
   * Static fragments of the generated render, trimmed and in order. The
   * first one opens the block and the last one closes it.
   */
  anchors: readonly string[];
}

/**
 * Generate the host template, or `null` when the owned source does not carry
 * the shape this route binds: unknown, duplicated, or reordered slots, or a
 * slot marker that is not separated from the next fragment by a blank line.
 */
export function buildHostTemplate(source: string): HostTemplate | null {
  const variants = getTemplateVariants(source);
  if (variants === null) return null;
  const split = splitTemplateSlots(variants.withoutDelivery);
  if (split === null || split.slots.length !== SLOT_NAMES.length) return null;

  const anchors: string[] = [];
  const parts: string[] = [PROVENANCE];
  for (let index = 0; index <= split.slots.length; index++) {
    const fragment = split.fragments[index];
    if (fragment === undefined) return null;
    // The blank line that separates a slot from the fragment after it belongs
    // to the binding, so an absent slot leaves that boundary untouched.
    if (index > 0 && !fragment.startsWith("\n\n")) return null;
    const literal = index === 0 ? fragment : fragment.slice(2);
    const anchor = literal.trim();
    if (anchor.length > 0) anchors.push(anchor);
    parts.push(literal);
    const name = split.slots[index];
    if (name === undefined) break;
    const binding = SLOT_BINDINGS[name];
    const condition = SLOT_CONDITIONS[name];
    // Both tags sit alone on their lines: the renderer drops each line with
    // its newline, so an absent slot adds nothing, and two adjacent slots do
    // not share a line.
    parts.push(`{{#if ${condition}}}\n${binding}\n\n{{/if}}\n`);
  }
  return { text: `${parts.join("")}\n`, anchors };
}

/**
 * True when a block is a render of the generated template.
 *
 * Recognition rests on the owned static skeleton only: the block starts with
 * the first anchor, ends with the last, and contains the remaining anchors in
 * order. Dynamic slot bodies take no part in source recognition, so a template
 * whose skeleton diverges from the owned one stays unrecognized, while a
 * template that reproduces the whole skeleton and replaces only the dynamic
 * bindings is recognized.
 */
export function isHostTemplateRender(block: string, anchors: readonly string[]): boolean {
  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  if (first === undefined || last === undefined) return false;
  const text = block.trimEnd();
  if (!text.startsWith(first) || !text.endsWith(last)) return false;
  let cursor = first.length;
  for (const anchor of anchors.slice(1, -1)) {
    const at = text.indexOf(anchor, cursor);
    if (at === -1) return false;
    cursor = at + anchor.length;
  }
  return true;
}
