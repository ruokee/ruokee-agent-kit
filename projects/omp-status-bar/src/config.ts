/**
 * Versioned YAML configuration for the status bar Host.
 *
 * Configuration lives at `<agentDir>/omp-status-bar.yml`, where `agentDir`
 * is the active OMP agent directory from `getAgentDir()`, so configuration
 * is profile-aware. The file is data only: no expressions, templates, or
 * script execution.
 *
 * Schema version 1:
 *
 *   version: 1
 *   separator: slash          # space | slash | dot | pipe, default slash
 *   statuses:
 *     - id: total
 *       options: { ... }      # provider-owned, validated by the provider
 *
 * `statuses` selects providers and defines display order in one structure.
 * Every entry creates an independent provider instance, so the same
 * provider id may appear multiple times with different options.
 *
 * The package has no `enabled` field: OMP's native plugin enable/disable
 * state is the only package-wide switch.
 */

import { isObject } from "./object-guard.ts";

/** Configuration schema version this module parses. */
export const CONFIG_SCHEMA_VERSION = 1;

/** File name resolved inside the active agent directory. */
export const CONFIG_FILE_NAME = "omp-status-bar.yml";

/** The four separator enum values. */
export const SEPARATOR_VALUES = ["space", "slash", "dot", "pipe"] as const;
export type SeparatorValue = (typeof SEPARATOR_VALUES)[number];

/** Exact text each separator value renders. */
export const SEPARATOR_TEXT: Record<SeparatorValue, string> = {
  space: " ",
  slash: " / ",
  dot: " · ",
  pipe: " | ",
};

/** Default separator value. */
export const DEFAULT_SEPARATOR: SeparatorValue = "slash";

/** One configured status entry. */
export interface StatusEntryConfig {
  /** Provider id; must be registered before the Host creates instances. */
  id: string;
  /** Provider-owned options, validated by the provider's `describe`. */
  options: Record<string, unknown>;
  /**
   * Original index in the `statuses` list of the configuration file. All
   * diagnostics for this entry use it, even though failed entries are
   * filtered out of the parsed list before the Host sees them.
   */
  sourceIndex: number;
}

/** Parsed top-level configuration. */
export interface StatusBarConfig {
  version: number;
  separator: SeparatorValue;
  statuses: StatusEntryConfig[];
}

/** One per-entry problem, reported with the original `statuses[index]`. */
export interface StatusEntryProblem {
  index: number;
  reason: string;
}

export type ConfigParseResult =
  { kind: "loaded"; config: StatusBarConfig; problems: StatusEntryProblem[] } | { kind: "invalid"; reason: string };

interface YamlLike {
  parse(text: string): unknown;
}

/**
 * Parse YAML through Bun's built-in parser. The Host runs inside Bun (OMP's
 * runtime), so this stays dependency-free.
 */
function parseYamlText(text: string): unknown {
  const bunGlobal = globalThis as typeof globalThis & { Bun?: { YAML?: YamlLike } };
  const yaml = bunGlobal.Bun?.YAML;
  if (!yaml) {
    throw new Error("YAML parser unavailable: Bun.YAML is required to read the status bar configuration");
  }
  return yaml.parse(text);
}

/**
 * Parse configuration text. A malformed top-level document returns
 * `kind: "invalid"` and the Host starts no providers. Per-entry problems
 * (unknown provider, invalid options) are not top-level failures; they are
 * handled during instance creation.
 */
export function parseStatusBarConfig(text: string): ConfigParseResult {
  let parsed: unknown;
  try {
    parsed = parseYamlText(text);
  } catch (error) {
    return { kind: "invalid", reason: `YAML parse failed: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!isObject(parsed)) {
    return { kind: "invalid", reason: "Configuration must be a mapping at the document root" };
  }
  for (const key of Object.keys(parsed)) {
    if (key !== "version" && key !== "separator" && key !== "statuses") {
      return { kind: "invalid", reason: `Unknown top-level field ${JSON.stringify(key)}` };
    }
  }
  if (parsed.version !== CONFIG_SCHEMA_VERSION) {
    return {
      kind: "invalid",
      reason: `Unsupported schema version ${JSON.stringify(parsed.version)}; expected ${CONFIG_SCHEMA_VERSION}`,
    };
  }
  const separatorRaw = parsed.separator;
  if (separatorRaw !== undefined && !SEPARATOR_VALUES.includes(separatorRaw as SeparatorValue)) {
    return {
      kind: "invalid",
      reason: `\`separator\` must be one of ${SEPARATOR_VALUES.map((value) => JSON.stringify(value)).join(", ")}`,
    };
  }
  const statusesRaw = parsed.statuses;
  if (!Array.isArray(statusesRaw)) {
    return { kind: "invalid", reason: "`statuses` must be an array" };
  }
  const statuses: StatusEntryConfig[] = [];
  const problems: StatusEntryProblem[] = [];
  for (const [index, entry] of statusesRaw.entries()) {
    // Per-entry problems skip only that entry; valid entries keep their
    // order and run. The diagnostic carries the original `statuses[index]`.
    if (!isObject(entry)) {
      problems.push({ index, reason: "each entry must be a mapping with an `id`" });
      continue;
    }
    const unknownKey = Object.keys(entry).find((key) => key !== "id" && key !== "options");
    if (unknownKey !== undefined) {
      problems.push({ index, reason: `unknown field ${JSON.stringify(unknownKey)}` });
      continue;
    }
    if (typeof entry.id !== "string" || entry.id.length === 0) {
      problems.push({ index, reason: "`id` must be a non-empty string" });
      continue;
    }
    if (entry.options !== undefined && !isObject(entry.options)) {
      problems.push({ index, reason: "`options` must be a mapping when present" });
      continue;
    }
    statuses.push({ id: entry.id, options: entry.options ?? {}, sourceIndex: index });
  }
  return {
    kind: "loaded",
    config: {
      version: CONFIG_SCHEMA_VERSION,
      separator: (separatorRaw as SeparatorValue | undefined) ?? DEFAULT_SEPARATOR,
      statuses,
    },
    problems,
  };
}

/**
 * Fold a raw parse result into the final outcome: a config plus per-entry
 * problems, or one failure string. The Host treats a failure as "start
 * nothing" and per-entry problems as "skip that entry".
 */
export function resolveConfigText(
  text: string,
): { config: StatusBarConfig; problems: StatusEntryProblem[] } | { failure: string } {
  const result = parseStatusBarConfig(text);
  if (result.kind === "invalid") {
    return { failure: result.reason };
  }
  return { config: result.config, problems: result.problems };
}

/**
 * Read and parse the configuration file. A missing file means "no statuses
 * configured"; the Host stays disabled for this session.
 */
export async function readConfigFile(
  path: string,
): Promise<{ config: StatusBarConfig; problems: StatusEntryProblem[] } | { failure: string } | { missing: true }> {
  let text: string;
  try {
    text = await Bun.file(path).text();
  } catch (error) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return { missing: true };
    }
    return { failure: `Cannot read ${path}: ${error instanceof Error ? error.message : String(error)}` };
  }
  return resolveConfigText(text);
}
