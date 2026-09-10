/**
 * Validation and defaulting for the native OMP plugin settings.
 *
 * The public OMP settings getter supplies one effective settings object for an
 * extension activation. Missing keys receive the manifest defaults here;
 * explicit nulls, unknown keys, wrong types, and invalid enum values reject
 * the complete object. The returned shape keeps the internal model/tools
 * structure used by the tool registration code.
 */

import { isObject } from "./object-guard.ts";

/** The two tool names this package owns. */
export const TOOL_NAMES = ["codex_web_search", "codex_web_fetch"] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

/** How an enabled tool is presented. Only OMP's extension load modes apply. */
export const LOAD_MODES = ["essential", "discoverable"] as const;
export type LoadMode = (typeof LOAD_MODES)[number];

/** Manifest defaults mirrored by runtime validation. */
export const DEFAULT_SETTINGS = {
  model: "",
  searchEnabled: true,
  searchLoadMode: "essential" as LoadMode,
  fetchEnabled: true,
  fetchLoadMode: "discoverable" as LoadMode,
} as const;

/** Per-tool registration settings. */
export interface ToolConfig {
  enabled: boolean;
  loadMode: LoadMode;
}

/** Fully resolved configuration used by the registration and execution code. */
export interface CodexWebAccessConfig {
  /** Model selector (`provider/id`) or empty when no model is configured. */
  model: string;
  tools: Record<ToolName, ToolConfig>;
}

/** One configuration failure with the field it came from. */
export interface ConfigProblem {
  field: string;
  reason: string;
}

/** Parse result: a config or the full problem list for a rejected object. */
export type ConfigParseResult =
  { kind: "loaded"; config: CodexWebAccessConfig } | { kind: "invalid"; problems: ConfigProblem[] };

function isLoadMode(value: unknown): value is LoadMode {
  return LOAD_MODES.some((mode) => mode === value);
}

function invalidLoadMode(field: string): ConfigProblem {
  return {
    field,
    reason: `must be one of ${LOAD_MODES.map((value) => JSON.stringify(value)).join(", ")}`,
  };
}

/**
 * Validate one effective object returned by OMP's public settings getter.
 * Validation is atomic: any problem rejects the complete object.
 */
export function parseCodexWebAccessSettings(settings: unknown): ConfigParseResult {
  if (!isObject(settings)) {
    return { kind: "invalid", problems: [{ field: "(root)", reason: "must be a settings object" }] };
  }

  const problems: ConfigProblem[] = [];
  for (const key of Object.keys(settings)) {
    if (!Object.hasOwn(DEFAULT_SETTINGS, key)) {
      problems.push({ field: key, reason: "unknown setting" });
    }
  }

  const modelRaw = Object.hasOwn(settings, "model") ? settings.model : DEFAULT_SETTINGS.model;
  const model = typeof modelRaw === "string" ? modelRaw.trim() : "";
  if (typeof modelRaw !== "string") {
    problems.push({ field: "model", reason: "must be a string" });
  }

  const searchEnabledRaw = Object.hasOwn(settings, "searchEnabled")
    ? settings.searchEnabled
    : DEFAULT_SETTINGS.searchEnabled;
  const searchEnabled = typeof searchEnabledRaw === "boolean" ? searchEnabledRaw : false;
  if (typeof searchEnabledRaw !== "boolean") {
    problems.push({ field: "searchEnabled", reason: "must be a boolean" });
  }

  const searchLoadModeRaw = Object.hasOwn(settings, "searchLoadMode")
    ? settings.searchLoadMode
    : DEFAULT_SETTINGS.searchLoadMode;
  const searchLoadMode = isLoadMode(searchLoadModeRaw) ? searchLoadModeRaw : DEFAULT_SETTINGS.searchLoadMode;
  if (!isLoadMode(searchLoadModeRaw)) {
    problems.push(invalidLoadMode("searchLoadMode"));
  }

  const fetchEnabledRaw = Object.hasOwn(settings, "fetchEnabled")
    ? settings.fetchEnabled
    : DEFAULT_SETTINGS.fetchEnabled;
  const fetchEnabled = typeof fetchEnabledRaw === "boolean" ? fetchEnabledRaw : false;
  if (typeof fetchEnabledRaw !== "boolean") {
    problems.push({ field: "fetchEnabled", reason: "must be a boolean" });
  }

  const fetchLoadModeRaw = Object.hasOwn(settings, "fetchLoadMode")
    ? settings.fetchLoadMode
    : DEFAULT_SETTINGS.fetchLoadMode;
  const fetchLoadMode = isLoadMode(fetchLoadModeRaw) ? fetchLoadModeRaw : DEFAULT_SETTINGS.fetchLoadMode;
  if (!isLoadMode(fetchLoadModeRaw)) {
    problems.push(invalidLoadMode("fetchLoadMode"));
  }

  if (problems.length > 0) {
    return { kind: "invalid", problems };
  }

  return {
    kind: "loaded",
    config: {
      model,
      tools: {
        codex_web_search: {
          enabled: searchEnabled,
          loadMode: searchLoadMode,
        },
        codex_web_fetch: {
          enabled: fetchEnabled,
          loadMode: fetchLoadMode,
        },
      },
    },
  };
}
