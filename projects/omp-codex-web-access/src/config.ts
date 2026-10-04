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

/** The settings the manifest declares, with the types runtime validation accepts. */
export interface CodexWebAccessSettings {
  model: string;
  searchEnabled: boolean;
  searchLoadMode: LoadMode;
  fetchEnabled: boolean;
  fetchLoadMode: LoadMode;
}

type SettingKey = keyof CodexWebAccessSettings;

/** Manifest defaults mirrored by runtime validation. */
export const DEFAULT_SETTINGS: Readonly<CodexWebAccessSettings> = {
  model: "",
  searchEnabled: true,
  searchLoadMode: "essential",
  fetchEnabled: true,
  fetchLoadMode: "discoverable",
};

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

/** The accepted value type of one setting and the reason reported for any other. */
interface SettingRule<T> {
  accepts: (value: unknown) => value is T;
  reason: string;
}

const STRING_RULE: SettingRule<string> = {
  accepts: (value): value is string => typeof value === "string",
  reason: "must be a string",
};

const BOOLEAN_RULE: SettingRule<boolean> = {
  accepts: (value): value is boolean => typeof value === "boolean",
  reason: "must be a boolean",
};

const LOAD_MODE_RULE: SettingRule<LoadMode> = {
  accepts: (value): value is LoadMode => LOAD_MODES.some((mode) => mode === value),
  reason: `must be one of ${LOAD_MODES.map((value) => JSON.stringify(value)).join(", ")}`,
};

/** Validation rule of every setting, in the order problems are reported. */
const SETTING_RULES: { [K in SettingKey]: SettingRule<CodexWebAccessSettings[K]> } = {
  model: STRING_RULE,
  searchEnabled: BOOLEAN_RULE,
  searchLoadMode: LOAD_MODE_RULE,
  fetchEnabled: BOOLEAN_RULE,
  fetchLoadMode: LOAD_MODE_RULE,
};

/**
 * The effective value of one setting: the supplied value, or the manifest
 * default when the key is absent. A value of the wrong type is recorded as a
 * problem, and the default stands in so the remaining settings still validate.
 */
function readSetting<K extends SettingKey>(
  settings: Record<string, unknown>,
  key: K,
  problems: ConfigProblem[],
): CodexWebAccessSettings[K] {
  const value = Object.hasOwn(settings, key) ? settings[key] : DEFAULT_SETTINGS[key];
  const rule: SettingRule<CodexWebAccessSettings[K]> = SETTING_RULES[key];
  if (rule.accepts(value)) return value;
  problems.push({ field: key, reason: rule.reason });
  return DEFAULT_SETTINGS[key];
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

  const model = readSetting(settings, "model", problems).trim();
  const searchEnabled = readSetting(settings, "searchEnabled", problems);
  const searchLoadMode = readSetting(settings, "searchLoadMode", problems);
  const fetchEnabled = readSetting(settings, "fetchEnabled", problems);
  const fetchLoadMode = readSetting(settings, "fetchLoadMode", problems);

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
