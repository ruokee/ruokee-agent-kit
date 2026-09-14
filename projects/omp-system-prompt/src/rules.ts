/**
 * Model-scoped prompt rules read from Markdown documents.
 *
 * Each covered turn reads `model-prompts` under the user agent directory and
 * under the project agent directory. A rule document opens with a `---`
 * frontmatter block whose single required key `match` holds the model
 * conditions; the body after the closing delimiter is appended to the turn's
 * system prompt byte-for-byte.
 *
 * Everything here fails open per file. A document that cannot be read, parsed,
 * or validated is skipped with a bounded reason and a scope-relative source;
 * sibling files, the other directory, and the rest of the prompt stay
 * unaffected. Files are read one at a time in name order, so read completion
 * never changes the appended order.
 */

import { YAML } from "bun";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/** Directory under each agent directory that holds rule documents. */
export const RULE_DIR_NAME = "model-prompts";

/** Rule directory scopes; user documents append before project documents. */
export type RuleScope = "user" | "project";

export const RULE_SCOPES: readonly RuleScope[] = ["user", "project"] as const;

/** Resolved rule directory per scope. */
export interface RuleRoots {
  user: string;
  project: string;
}

/** Matching condition keys; every entry carries exactly one. */
export type RuleConditionKey = "exact" | "model" | "contains" | "regex";

const CONDITION_KEYS: readonly RuleConditionKey[] = ["exact", "model", "contains", "regex"] as const;

/** One validated matching condition; `pattern` carries the compiled `regex` form. */
export interface RuleCondition {
  key: RuleConditionKey;
  value: string;
  pattern?: RegExp;
}

/** One parsed rule document. */
export interface RuleDocument {
  conditions: readonly RuleCondition[];
  body: string;
}

/** Bounded reasons for skipping one rule document. */
export type RuleRejectReason =
  | "frontmatter-missing"
  | "frontmatter-invalid"
  | "match-missing"
  | "match-empty"
  | "entry-shape"
  | "entry-key"
  | "entry-value"
  | "regex-invalid"
  | "body-blank";

/** Bounded reasons for skipping a directory or file read. */
export type RuleReadReason = "directory-unreadable" | "file-unreadable";

/** One skipped source, as a bounded reason plus a locatable scope-relative name. */
export interface RuleDiagnostic {
  reason: RuleRejectReason | RuleReadReason;
  source: string;
}

/** Matching bodies in append order plus every skipped source of the turn. */
export interface RuleCollection {
  bodies: string[];
  diagnostics: RuleDiagnostic[];
}

/** Runtime model identity used for matching. */
export interface RuleModel {
  id: string;
  provider: string;
}

/** Direct-child directory entry the discovery step needs. */
export interface RuleDirectoryEntry {
  name: string;
  isFile(): boolean;
}

/** File access the loader needs; tests substitute their own. */
export interface RuleFileSystem {
  readDirectory(path: string): Promise<readonly RuleDirectoryEntry[]>;
  readFile(path: string): Promise<string>;
  isMissing(error: unknown): boolean;
}

const BOM = "\uFEFF";
/** A delimiter line is exactly `---`, with an optional CRLF carriage return. */
const DELIMITER = "---";
const DELIMITER_CR = "---\r";

/** Production file access: a missing or non-directory path reads as an empty set. */
export const nodeRuleFileSystem: RuleFileSystem = {
  readDirectory: async (path) => readdir(path, { withFileTypes: true }),
  readFile: async (path) => readFile(path, "utf8"),
  isMissing: (error) => {
    const code = (error as { code?: unknown } | null)?.code;
    return code === "ENOENT" || code === "ENOTDIR";
  },
};

/**
 * Split a rule document at its frontmatter delimiters.
 *
 * The opening delimiter must be the first line and the closing delimiter the
 * first later line whose only content is `---`. The body starts after that
 * line's terminator and keeps every remaining byte, including CRLF, blank
 * lines, and a trailing newline. Returns null when either delimiter is absent
 * or a longer run such as `----` claims the boundary.
 */
function splitDocument(text: string): { metadata: string; body: string } | null {
  const source = text.startsWith(BOM) ? text.slice(1) : text;
  const openingBreak = source.indexOf("\n");
  if (openingBreak === -1) return null;
  const opening = source.slice(0, openingBreak);
  if (opening !== DELIMITER && opening !== DELIMITER_CR) return null;
  let cursor = openingBreak + 1;
  while (cursor <= source.length) {
    const breakAt = source.indexOf("\n", cursor);
    const end = breakAt === -1 ? source.length : breakAt;
    const line = source.slice(cursor, end);
    if (line === DELIMITER || line === DELIMITER_CR) {
      return {
        metadata: source.slice(openingBreak + 1, cursor),
        body: breakAt === -1 ? "" : source.slice(breakAt + 1),
      };
    }
    if (breakAt === -1) return null;
    cursor = breakAt + 1;
  }
  return null;
}

/** One frontmatter entry as a validated condition, or the reason it is unusable. */
function parseCondition(
  entry: unknown,
): { ok: true; condition: RuleCondition } | { ok: false; reason: RuleRejectReason } {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    return { ok: false, reason: "entry-shape" };
  }
  const keys = Object.keys(entry as Record<string, unknown>);
  if (keys.length !== 1) return { ok: false, reason: "entry-shape" };
  const key = keys[0];
  if (key === undefined || !CONDITION_KEYS.includes(key as RuleConditionKey)) {
    return { ok: false, reason: "entry-key" };
  }
  const value = (entry as Record<string, unknown>)[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    return { ok: false, reason: "entry-value" };
  }
  if (key !== "regex") return { ok: true, condition: { key: key as RuleConditionKey, value } };
  try {
    return { ok: true, condition: { key: "regex", value, pattern: new RegExp(value) } };
  } catch {
    return { ok: false, reason: "regex-invalid" };
  }
}

/**
 * Parse and validate one rule document.
 *
 * The first failure wins, so a document is reported once with the reason that
 * stopped it. Unknown keys, several keys in one entry, an empty `match` array,
 * non-string or blank values, an uncompilable regular expression, a missing or
 * malformed delimiter pair, and a blank body are all invalid.
 */
export function parseRuleDocument(
  text: string,
): { ok: true; document: RuleDocument } | { ok: false; reason: RuleRejectReason } {
  const split = splitDocument(text);
  if (split === null) return { ok: false, reason: "frontmatter-missing" };

  let metadata: unknown;
  try {
    metadata = YAML.parse(split.metadata);
  } catch {
    return { ok: false, reason: "frontmatter-invalid" };
  }
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { ok: false, reason: "match-missing" };
  }
  const entries = (metadata as Record<string, unknown>).match;
  if (!Array.isArray(entries)) return { ok: false, reason: "match-missing" };
  if (entries.length === 0) return { ok: false, reason: "match-empty" };

  const conditions: RuleCondition[] = [];
  for (const entry of entries) {
    const parsed = parseCondition(entry);
    if (!parsed.ok) return { ok: false, reason: parsed.reason };
    conditions.push(parsed.condition);
  }

  if (split.body.trim().length === 0) return { ok: false, reason: "body-blank" };
  return { ok: true, document: { conditions, body: split.body } };
}

/**
 * True when any condition matches the model.
 *
 * Entries are alternatives: `exact` and `contains` and `regex` compare
 * `provider/id`, `model` compares the bare id, and matching is case-sensitive
 * and textual with no alias, role, family, or thinking-level resolution.
 */
export function matchesModel(document: RuleDocument, model: RuleModel): boolean {
  const spec = `${model.provider}/${model.id}`;
  return document.conditions.some((condition) => {
    switch (condition.key) {
      case "exact":
        return condition.value === spec;
      case "model":
        return condition.value === model.id;
      case "contains":
        return spec.includes(condition.value);
      case "regex":
        return condition.pattern !== undefined && condition.pattern.test(spec);
    }
  });
}

/**
 * Read both rule directories and return the bodies matching the model.
 *
 * A directory contributes its direct-child rule files in name order; user
 * bodies precede project bodies. A missing directory is an empty set, a read
 * failure reports one bounded diagnostic and skips only that source, and a
 * blank or invalid document never removes or replaces another file's text.
 */
export async function collectRuleBodies(
  roots: RuleRoots,
  model: RuleModel,
  fileSystem: RuleFileSystem = nodeRuleFileSystem,
): Promise<RuleCollection> {
  const bodies: string[] = [];
  const diagnostics: RuleDiagnostic[] = [];

  for (const scope of RULE_SCOPES) {
    const directory = roots[scope];
    let names: string[];
    try {
      const entries = await fileSystem.readDirectory(directory);
      names = entries
        // Direct-child Markdown files; a leading dot marks a hidden file.
        .filter((entry) => entry.isFile() && entry.name.length > 3 && entry.name.endsWith(".md"))
        .filter((entry) => !entry.name.startsWith("."))
        .map((entry) => entry.name)
        // JavaScript string order, so `10-` sorts before `2-`.
        .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
    } catch (error) {
      if (!fileSystem.isMissing(error)) diagnostics.push({ reason: "directory-unreadable", source: scope });
      continue;
    }

    for (const name of names) {
      const source = `${scope}/${name}`;
      let text: string;
      try {
        text = await fileSystem.readFile(join(directory, name));
      } catch {
        diagnostics.push({ reason: "file-unreadable", source });
        continue;
      }
      const parsed = parseRuleDocument(text);
      if (!parsed.ok) {
        diagnostics.push({ reason: parsed.reason, source });
        continue;
      }
      if (matchesModel(parsed.document, model)) bodies.push(parsed.document.body);
    }
  }

  return { bodies, diagnostics };
}
