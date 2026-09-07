/**
 * Configuration parse tests.
 *
 * Covers the observable configuration contract: defaults for an empty
 * document and omitted fields, independent per-tool enablement and load
 * modes, and atomic rejection (whole document invalid, zero tools
 * registered downstream) for malformed YAML, unknown fields, wrong types,
 * and invalid values. File-level behavior (missing file, unreadable file)
 * is covered by the extension entry tests, which drive the real read path.
 */

import { describe, expect, test } from "bun:test";
import { YAML } from "bun";
import { DEFAULT_LOAD_MODES, parseCodexWebAccessConfig, type ConfigParseResult } from "../src/config.ts";

const parse = (text: string): ConfigParseResult => parseCodexWebAccessConfig(text, YAML);

/** Assert the document is rejected and return the problems. */
const invalidProblems = (text: string) => {
  const result = parse(text);
  expect(result.kind).toBe("invalid");
  return result.kind === "invalid" ? result.problems : [];
};

describe("parseCodexWebAccessConfig", () => {
  test("defaults when the document is empty", () => {
    const result = parse("");
    expect(result.kind).toBe("loaded");
    if (result.kind !== "loaded") return;
    expect(result.config.model).toBe("");
    expect(result.config.tools.codex_web_search).toEqual({ enabled: true, loadMode: "essential" });
    expect(result.config.tools.codex_web_fetch).toEqual({ enabled: true, loadMode: "discoverable" });
  });

  test("full explicit config round-trips", () => {
    const result = parse(
      "model: provider/model-1\ntools:\n  codex_web_search:\n    enabled: false\n    loadMode: discoverable\n  codex_web_fetch:\n    enabled: true\n    loadMode: essential\n",
    );
    expect(result.kind).toBe("loaded");
    if (result.kind !== "loaded") return;
    expect(result.config).toEqual({
      model: "provider/model-1",
      tools: {
        codex_web_search: { enabled: false, loadMode: "discoverable" },
        codex_web_fetch: { enabled: true, loadMode: "essential" },
      },
    });
  });

  test("omitted loadMode uses each tool's default, disabled omits it from effect", () => {
    const result = parse("model: provider/model-1\ntools:\n  codex_web_search:\n    enabled: false\n");
    expect(result.kind).toBe("loaded");
    if (result.kind !== "loaded") return;
    expect(result.config.tools.codex_web_search).toEqual({
      enabled: false,
      loadMode: DEFAULT_LOAD_MODES.codex_web_search,
    });
    expect(result.config.tools.codex_web_fetch).toEqual({
      enabled: true,
      loadMode: DEFAULT_LOAD_MODES.codex_web_fetch,
    });
  });

  test("empty quoted model parses; a blank value is YAML null and invalid", () => {
    // `model: ""` is a present, empty selector: it parses here and errors at
    // tool-call time. A blank value collapses to YAML null, a type error.
    const result = parse('model: ""\n');
    expect(result.kind).toBe("loaded");
    if (result.kind !== "loaded") return;
    expect(result.config.model).toBe("");
    expect(invalidProblems("model:  \n").map((problem) => problem.field)).toEqual(["model"]);
  });

  test("rejects malformed YAML atomically", () => {
    const problems = invalidProblems("model: [unclosed\n  bad: : yaml\n");
    expect(problems.length).toBeGreaterThan(0);
  });

  test("rejects an unknown top-level field and lists it", () => {
    const problems = invalidProblems("model: provider/m\nversion: 2\n");
    expect(problems).toEqual([{ field: "version", reason: "unknown top-level field" }]);
  });

  test("rejects a non-string model", () => {
    const problems = invalidProblems("model: 42\n");
    expect(problems).toEqual([{ field: "model", reason: "must be a string" }]);
  });

  test("rejects a non-mapping tools block", () => {
    const problems = invalidProblems("tools: [1]\n");
    expect(problems).toEqual([{ field: "tools", reason: "must be a mapping when present" }]);
  });

  test("rejects an unknown tool name", () => {
    const problems = invalidProblems("tools:\n  web_search:\n    enabled: true\n");
    expect(problems).toEqual([{ field: "tools.web_search", reason: "unknown tool name" }]);
  });

  test("rejects unknown fields inside a tool entry", () => {
    const problems = invalidProblems("tools:\n  codex_web_search:\n    enabled: true\n    hidden: true\n");
    expect(problems).toEqual([{ field: "tools.codex_web_search.hidden", reason: "unknown field" }]);
  });

  test("rejects a non-boolean enabled", () => {
    const problems = invalidProblems("tools:\n  codex_web_search:\n    enabled: yes-please\n");
    expect(problems).toEqual([{ field: "tools.codex_web_search.enabled", reason: "must be a boolean" }]);
  });

  test("rejects a loadMode outside essential/discoverable", () => {
    const problems = invalidProblems("tools:\n  codex_web_fetch:\n    loadMode: hidden\n");
    expect(problems[0]?.field).toBe("tools.codex_web_fetch.loadMode");
    expect(problems[0]?.reason).toContain("essential");
  });

  test("collects multiple problems in one document", () => {
    const problems = invalidProblems('model: 42\nextra: 1\ntools:\n  codex_web_fetch:\n    enabled: "true"\n');
    expect(problems.map((problem) => problem.field).sort()).toEqual([
      "extra",
      "model",
      "tools.codex_web_fetch.enabled",
    ]);
  });

  test("rejects explicit null in place of a string, mapping, or boolean", () => {
    // `field: null` is a type error, not the omission semantics that a
    // missing key gets.
    expect(invalidProblems("model: null\n").map((problem) => problem.field)).toEqual(["model"]);
    expect(invalidProblems("tools: null\n").map((problem) => problem.field)).toEqual(["tools"]);
    expect(invalidProblems("tools:\n  codex_web_search: null\n").map((problem) => problem.field)).toEqual([
      "tools.codex_web_search",
    ]);
    expect(invalidProblems("tools:\n  codex_web_search:\n    enabled: null\n").map((problem) => problem.field)).toEqual(
      ["tools.codex_web_search.enabled"],
    );
  });
});
