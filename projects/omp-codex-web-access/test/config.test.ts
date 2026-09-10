/**
 * Native plugin settings validation tests.
 *
 * The parser receives the effective object returned by OMP's public settings
 * getter. Manifest defaults are mirrored for missing keys, while any explicit
 * null, unknown key, wrong type, or invalid enum rejects the whole object.
 */

import { describe, expect, test } from "bun:test";
import { DEFAULT_SETTINGS, parseCodexWebAccessSettings, type ConfigParseResult } from "../src/config.ts";

const parse = (settings: unknown): ConfigParseResult => parseCodexWebAccessSettings(settings);

function invalidProblems(settings: unknown) {
  const result = parse(settings);
  expect(result.kind).toBe("invalid");
  return result.kind === "invalid" ? result.problems : [];
}

describe("parseCodexWebAccessSettings", () => {
  test("defaults every missing setting", () => {
    const result = parse({});
    expect(result).toEqual({
      kind: "loaded",
      config: {
        model: DEFAULT_SETTINGS.model,
        tools: {
          codex_web_search: { enabled: DEFAULT_SETTINGS.searchEnabled, loadMode: DEFAULT_SETTINGS.searchLoadMode },
          codex_web_fetch: { enabled: DEFAULT_SETTINGS.fetchEnabled, loadMode: DEFAULT_SETTINGS.fetchLoadMode },
        },
      },
    });
  });

  test("keeps manifest fields, types, enum values, and defaults aligned with runtime", async () => {
    const packageJson = (await Bun.file(new URL("../package.json", import.meta.url)).json()) as {
      omp?: {
        settings?: Record<string, { type?: string; values?: unknown[]; default?: unknown }>;
      };
    };
    const settings = packageJson.omp?.settings ?? {};
    expect(Object.keys(settings).sort()).toEqual(
      ["model", "searchEnabled", "searchLoadMode", "fetchEnabled", "fetchLoadMode"].sort(),
    );
    expect(settings.model).toMatchObject({ type: "string", default: DEFAULT_SETTINGS.model });
    expect(settings.searchEnabled).toMatchObject({ type: "boolean", default: DEFAULT_SETTINGS.searchEnabled });
    expect(settings.searchLoadMode).toMatchObject({
      type: "enum",
      values: ["essential", "discoverable"],
      default: DEFAULT_SETTINGS.searchLoadMode,
    });
    expect(settings.fetchEnabled).toMatchObject({ type: "boolean", default: DEFAULT_SETTINGS.fetchEnabled });
    expect(settings.fetchLoadMode).toMatchObject({
      type: "enum",
      values: ["essential", "discoverable"],
      default: DEFAULT_SETTINGS.fetchLoadMode,
    });
    expect(settings.model?.default).toBe(DEFAULT_SETTINGS.model);
    expect(settings.searchEnabled?.default).toBe(DEFAULT_SETTINGS.searchEnabled);
    expect(settings.searchLoadMode?.default).toBe(DEFAULT_SETTINGS.searchLoadMode);
    expect(settings.fetchEnabled?.default).toBe(DEFAULT_SETTINGS.fetchEnabled);
    expect(settings.fetchLoadMode?.default).toBe(DEFAULT_SETTINGS.fetchLoadMode);
    expect(parse({})).toEqual({
      kind: "loaded",
      config: {
        model: DEFAULT_SETTINGS.model,
        tools: {
          codex_web_search: {
            enabled: DEFAULT_SETTINGS.searchEnabled,
            loadMode: DEFAULT_SETTINGS.searchLoadMode,
          },
          codex_web_fetch: {
            enabled: DEFAULT_SETTINGS.fetchEnabled,
            loadMode: DEFAULT_SETTINGS.fetchLoadMode,
          },
        },
      },
    });
  });

  test("maps all five native settings to the internal model/tools shape", () => {
    const result = parse({
      model: " provider/model-1 ",
      searchEnabled: false,
      searchLoadMode: "discoverable",
      fetchEnabled: true,
      fetchLoadMode: "essential",
    });
    expect(result).toEqual({
      kind: "loaded",
      config: {
        model: "provider/model-1",
        tools: {
          codex_web_search: { enabled: false, loadMode: "discoverable" },
          codex_web_fetch: { enabled: true, loadMode: "essential" },
        },
      },
    });
  });

  test("accepts both tools disabled while still validating their load modes", () => {
    const result = parse({
      searchEnabled: false,
      searchLoadMode: "essential",
      fetchEnabled: false,
      fetchLoadMode: "discoverable",
    });
    expect(result.kind).toBe("loaded");
    if (result.kind !== "loaded") return;
    expect(result.config.tools.codex_web_search.enabled).toBe(false);
    expect(result.config.tools.codex_web_fetch.enabled).toBe(false);
  });

  test("keeps an explicitly empty model valid for call-time failure", () => {
    const result = parse({ model: "" });
    expect(result.kind).toBe("loaded");
    if (result.kind !== "loaded") return;
    expect(result.config.model).toBe("");
  });

  test("rejects a non-object root atomically", () => {
    expect(invalidProblems(null)).toEqual([{ field: "(root)", reason: "must be a settings object" }]);
    expect(invalidProblems([])).toEqual([{ field: "(root)", reason: "must be a settings object" }]);
  });

  test("rejects unknown settings", () => {
    expect(invalidProblems({ model: "provider/model", extra: true })).toEqual([
      { field: "extra", reason: "unknown setting" },
    ]);
  });

  test("rejects explicit null for all five settings", () => {
    for (const field of ["model", "searchEnabled", "searchLoadMode", "fetchEnabled", "fetchLoadMode"]) {
      const problems = invalidProblems({ [field]: null });
      expect(problems.map((problem) => problem.field)).toEqual([field]);
    }
  });

  test("rejects a wrong type for all five settings", () => {
    const cases: Array<[string, unknown]> = [
      ["model", 42],
      ["searchEnabled", "false"],
      ["searchLoadMode", 42],
      ["fetchEnabled", "false"],
      ["fetchLoadMode", 42],
    ];
    for (const [field, value] of cases) {
      const problems = invalidProblems({ [field]: value });
      expect(problems.map((problem) => problem.field)).toEqual([field]);
    }
  });

  test("rejects invalid enum values even when that tool is disabled", () => {
    const problems = invalidProblems({ searchEnabled: false, searchLoadMode: "hidden" });
    expect(problems).toEqual([
      {
        field: "searchLoadMode",
        reason: 'must be one of "essential", "discoverable"',
      },
    ]);
  });

  test("collects multiple problems before rejecting the object", () => {
    const problems = invalidProblems({ model: 42, extra: true, fetchEnabled: "true" });
    expect(problems.map((problem) => problem.field).sort()).toEqual(["extra", "fetchEnabled", "model"]);
  });
});
