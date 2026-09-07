/**
 * YAML configuration for the Codex web access tools.
 *
 * The file lives in the active agent directory as `omp-codex-web-access.yml`
 * and is read once when the extension initializes; changes apply to new OMP
 * sessions. Top level allows exactly `model` (string selector) and `tools`
 * (per-tool `enabled` / `loadMode`). Validation is atomic: any unknown
 * field, malformed YAML, wrong type, or invalid value rejects the whole
 * document, and the extension then registers neither tool.
 *
 * Omitted parts fall back to defaults: a missing file, a missing `model`,
 * or a missing tool entry means both tools register with their default load
 * modes. An omitted or empty `model` only errors at tool-call time, when
 * the tools explain that no model is configured.
 */

import { isObject } from "./object-guard.ts";

/** File name resolved inside the active agent directory. */
export const CONFIG_FILE_NAME = "omp-codex-web-access.yml";

/** The two tool names this package owns. */
export const TOOL_NAMES = ["codex_web_search", "codex_web_fetch"] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

/** How an enabled tool is presented. Only OMP's extension load modes apply. */
export const LOAD_MODES = ["essential", "discoverable"] as const;
export type LoadMode = (typeof LOAD_MODES)[number];

/** Default presentation when a tool entry or its `loadMode` is omitted. */
export const DEFAULT_LOAD_MODES: Record<ToolName, LoadMode> = {
  codex_web_search: "essential",
  codex_web_fetch: "discoverable",
};

/** Per-tool registration settings. */
export interface ToolConfig {
  enabled: boolean;
  loadMode: LoadMode;
}

/** Fully resolved configuration. */
export interface CodexWebAccessConfig {
  /** Model selector (`provider/id`) or empty when the file omits it. */
  model: string;
  tools: Record<ToolName, ToolConfig>;
}

/** One configuration failure with the field it came from. */
export interface ConfigProblem {
  field: string;
  reason: string;
}

/** Parse result: a config or the full problem list for a rejected document. */
export type ConfigParseResult =
  { kind: "loaded"; config: CodexWebAccessConfig } | { kind: "invalid"; problems: ConfigProblem[] };

export function defaultTools(): Record<ToolName, ToolConfig> {
  return {
    codex_web_search: { enabled: true, loadMode: DEFAULT_LOAD_MODES.codex_web_search },
    codex_web_fetch: { enabled: true, loadMode: DEFAULT_LOAD_MODES.codex_web_fetch },
  };
}

/**
 * Parse one tool entry. Returns the entry or the problems that reject it.
 * A missing key (`undefined`) yields the tool's defaults; an explicit
 * `null` is a type error, not an omission.
 */
function parseToolEntry(name: ToolName, entry: unknown): { config: ToolConfig } | { problems: ConfigProblem[] } {
  if (entry === undefined) {
    return { config: { enabled: true, loadMode: DEFAULT_LOAD_MODES[name] } };
  }
  if (entry === null) {
    return { problems: [{ field: `tools.${name}`, reason: "must be a mapping when present" }] };
  }
  if (!isObject(entry)) {
    return { problems: [{ field: `tools.${name}`, reason: "must be a mapping when present" }] };
  }
  for (const key of Object.keys(entry)) {
    if (key !== "enabled" && key !== "loadMode") {
      return { problems: [{ field: `tools.${name}.${key}`, reason: "unknown field" }] };
    }
  }
  const enabled = entry.enabled;
  if (enabled !== undefined && typeof enabled !== "boolean") {
    return { problems: [{ field: `tools.${name}.enabled`, reason: "must be a boolean" }] };
  }
  const loadMode = entry.loadMode;
  if (
    loadMode !== undefined &&
    !(typeof loadMode === "string" && (LOAD_MODES as readonly string[]).includes(loadMode))
  ) {
    return {
      problems: [
        {
          field: `tools.${name}.loadMode`,
          reason: `must be one of ${LOAD_MODES.map((v) => JSON.stringify(v)).join(", ")}`,
        },
      ],
    };
  }
  return {
    config: {
      enabled: enabled ?? true,
      loadMode: (loadMode as LoadMode | undefined) ?? DEFAULT_LOAD_MODES[name],
    },
  };
}

/**
 * Validate the optional `tools` mapping. A missing key (`undefined`) keeps
 * both tools at their defaults; an explicit `null` is a type error.
 */
function parseTools(toolsRaw: unknown): { tools: Record<ToolName, ToolConfig> } | { problems: ConfigProblem[] } {
  if (toolsRaw === undefined) {
    return { tools: defaultTools() };
  }
  if (!isObject(toolsRaw)) {
    return { problems: [{ field: "tools", reason: "must be a mapping when present" }] };
  }
  const problems: ConfigProblem[] = [];
  for (const key of Object.keys(toolsRaw)) {
    if (!(TOOL_NAMES as readonly string[]).includes(key)) {
      problems.push({ field: `tools.${key}`, reason: "unknown tool name" });
    }
  }
  const search = parseToolEntry("codex_web_search", toolsRaw.codex_web_search);
  const fetch = parseToolEntry("codex_web_fetch", toolsRaw.codex_web_fetch);
  if ("problems" in search) problems.push(...search.problems);
  if ("problems" in fetch) problems.push(...fetch.problems);
  if (problems.length > 0) {
    return { problems };
  }
  return {
    tools: {
      codex_web_search: (search as { config: ToolConfig }).config,
      codex_web_fetch: (fetch as { config: ToolConfig }).config,
    },
  };
}

/**
 * Validate the optional top-level `model` selector. A missing key
 * (`undefined`) means no model is configured; an explicit `null` is a type
 * error, not an omission.
 */
function parseModel(modelRaw: unknown): { model: string } | { problems: ConfigProblem[] } {
  if (modelRaw === undefined) {
    return { model: "" };
  }
  if (modelRaw === null) {
    return { problems: [{ field: "model", reason: "must be a string" }] };
  }
  if (typeof modelRaw !== "string") {
    return { problems: [{ field: "model", reason: "must be a string" }] };
  }
  return { model: modelRaw.trim() };
}

/**
 * Parse configuration text. Returns every problem when the document is
 * rejected, so one message can list all failures.
 */
export function parseCodexWebAccessConfig(text: string, yaml: { parse(text: string): unknown }): ConfigParseResult {
  let parsed: unknown;
  try {
    parsed = yaml.parse(text);
  } catch (error) {
    return {
      kind: "invalid",
      problems: [
        { field: "(root)", reason: `YAML parse failed: ${error instanceof Error ? error.message : String(error)}` },
      ],
    };
  }
  // An empty document is a missing file's twin: everything defaults.
  if (parsed === null || parsed === undefined) {
    return { kind: "loaded", config: { model: "", tools: defaultTools() } };
  }
  if (!isObject(parsed)) {
    return { kind: "invalid", problems: [{ field: "(root)", reason: "must be a mapping at the document root" }] };
  }
  const problems: ConfigProblem[] = [];
  for (const key of Object.keys(parsed)) {
    if (key !== "model" && key !== "tools") {
      problems.push({ field: key, reason: "unknown top-level field" });
    }
  }
  const modelResult = parseModel(parsed.model);
  const toolsResult = parseTools(parsed.tools);
  if ("problems" in modelResult) problems.push(...modelResult.problems);
  if ("problems" in toolsResult) problems.push(...toolsResult.problems);
  if (problems.length > 0) {
    return { kind: "invalid", problems };
  }
  return {
    kind: "loaded",
    config: {
      model: (modelResult as { model: string }).model,
      tools: (toolsResult as { tools: Record<ToolName, ToolConfig> }).tools,
    },
  };
}
