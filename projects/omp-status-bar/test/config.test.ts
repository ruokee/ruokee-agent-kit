import { describe, test, expect } from "bun:test";
import { formatTokenCount } from "../src/format.ts";
import { sanitizeFragment } from "../src/sanitize.ts";
import { parseStatusBarConfig } from "../src/config.ts";
import { BUILTIN_PROVIDERS } from "../src/providers/bundled.ts";

const parseConfig = (text: string) => {
  const result = parseStatusBarConfig(text);
  return result.kind === "loaded" ? result.config : undefined;
};

const parseProblems = (text: string) => {
  const result = parseStatusBarConfig(text);
  return result.kind === "loaded" ? result.problems : undefined;
};

const builtin = (id: string) => {
  const definition = BUILTIN_PROVIDERS.find((provider) => provider.id === id);
  if (definition === undefined) {
    throw new Error(`missing builtin provider ${id}`);
  }
  return definition;
};

describe("formatTokenCount", () => {
  test("spec boundary examples", () => {
    expect(formatTokenCount(0)).toBe("0");
    expect(formatTokenCount(999)).toBe("999");
    expect(formatTokenCount(1000)).toBe("1K");
    expect(formatTokenCount(1250)).toBe("1.3K");
    expect(formatTokenCount(15000)).toBe("15K");
    expect(formatTokenCount(999500)).toBe("1M");
    expect(formatTokenCount(1200000)).toBe("1.2M");
  });

  test("additional boundaries", () => {
    expect(formatTokenCount(99949)).toBe("99.9K");
    expect(formatTokenCount(99950)).toBe("100K");
    expect(formatTokenCount(-5)).toBe("0");
    expect(formatTokenCount(Number.NaN)).toBe("0");
    expect(formatTokenCount(Number.POSITIVE_INFINITY)).toBe("0");
    expect(formatTokenCount(995)).toBe("995");
    expect(formatTokenCount(1001)).toBe("1K");
    // The unit caps at `T` while the magnitude keeps counting: 1.2e15 is
    // 1200 trillion, not "1.2T".
    expect(formatTokenCount(1.2e15)).toBe("1200T");
    expect(formatTokenCount(1.2e16)).toBe("12000T");
    expect(formatTokenCount(1.2e18)).toBe("1200000T");
  });
});

describe("sanitize ordering", () => {
  test("escape sequences are removed entirely, not turned into spaces", () => {
    const result = sanitizeFragment({ spans: [{ text: "a\x1b[31mb" }] });
    expect(result.ok).toBe(true);
    expect(result.ok && result.fragment.spans[0]?.text).toBe("ab");
  });

  test("remaining C0 controls become spaces", () => {
    const result = sanitizeFragment({ spans: [{ text: "a\x01b" }] });
    expect(result.ok).toBe(true);
    expect(result.ok && result.fragment.spans[0]?.text).toBe("a b");
  });

  test("OSC payloads disappear without residue", () => {
    const result = sanitizeFragment({ spans: [{ text: "a\x1b]0;t\x07b" }] });
    expect(result.ok).toBe(true);
    expect(result.ok && result.fragment.spans[0]?.text).toBe("ab");
  });

  test("C1 string controls (DCS/SOS/PM/APC) disappear with their payloads", () => {
    // Each C1 string control runs from its introducer to ST (\x9c); the
    // whole sequence including the payload must go.
    for (const introducer of ["\x90", "\x98", "\x9e", "\x9f"]) {
      const result = sanitizeFragment({ spans: [{ text: `a${introducer}payload\x9cb` }] });
      expect(result.ok).toBe(true);
      expect(result.ok && result.fragment.spans[0]?.text, introducer).toBe("ab");
    }
    // 7-bit DCS form terminates on ESC backslash.
    const dcs = sanitizeFragment({ spans: [{ text: "a\x1bPpayload\x1b\\b" }] });
    expect(dcs.ok).toBe(true);
    expect(dcs.ok && dcs.fragment.spans[0]?.text).toBe("ab");
    // Terminators are introducer-agnostic: every string control accepts
    // both ST forms.
    const mixed: [string, string][] = [
      ["a\x1b]0;t\x9cb", "ab"], // 7-bit OSC + C1 ST
      ["a\x9d0;t\x1b\\b", "ab"], // C1 OSC + ESC backslash
      ["a\x9d0;t\x07b", "ab"], // C1 OSC + BEL
      ["a\x1bPp\x9cb", "ab"], // 7-bit DCS + C1 ST
      ["a\x90p\x1b\\b", "ab"], // C1 DCS + ESC backslash
    ];
    for (const [input, want] of mixed) {
      const result = sanitizeFragment({ spans: [{ text: input }] });
      expect(result.ok).toBe(true);
      expect(result.ok && result.fragment.spans[0]?.text, input).toBe(want);
    }
    // Adjacent sequences each remove only their own payload; text between
    // them survives, and a non-greedy match stops at the first ST.
    const adjacent = sanitizeFragment({ spans: [{ text: "a\x90p1\x9cMID\x90p2\x9cb" }] });
    expect(adjacent.ok).toBe(true);
    expect(adjacent.ok && adjacent.fragment.spans[0]?.text).toBe("aMIDb");
    const stops = sanitizeFragment({ spans: [{ text: "a\x9d0;t\x9cbKEEP" }] });
    expect(stops.ok).toBe(true);
    expect(stops.ok && stops.fragment.spans[0]?.text).toBe("abKEEP");
  });
});

describe("sanitizeFragment", () => {
  test("passes a plain fragment through", () => {
    const result = sanitizeFragment({ spans: [{ text: "T 120K", color: "#5fafaf" }] });
    expect(result).toEqual({ ok: true, fragment: { spans: [{ text: "T 120K", color: "#5fafaf" }] } });
  });

  test("rejects structurally invalid values", () => {
    expect(sanitizeFragment(undefined).ok).toBe(false);
    expect(sanitizeFragment(null).ok).toBe(false);
    expect(sanitizeFragment("text").ok).toBe(false);
    expect(sanitizeFragment({}).ok).toBe(false);
    expect(sanitizeFragment({ spans: "nope" }).ok).toBe(false);
    expect(sanitizeFragment({ spans: [{ text: 42 }] }).ok).toBe(false);
    expect(sanitizeFragment({ spans: [{ text: "a", color: "red" }] }).ok).toBe(false);
    expect(sanitizeFragment({ spans: [{ text: "a", dim: "yes" }] }).ok).toBe(false);
    expect(sanitizeFragment({ spans: [{ text: "a", color: "#12345" }] }).ok).toBe(false);
  });

  test("strips ANSI escape sequences", () => {
    const result = sanitizeFragment({ spans: [{ text: "\x1b[31mred\x1b[0m" }] });
    expect(result.ok).toBe(true);
    expect(result.ok && result.fragment.spans[0]?.text).toBe("red");
  });

  test("strips OSC, CSI, and C1 control characters", () => {
    const result = sanitizeFragment({ spans: [{ text: "\x1b]0;title\x07a\u0090b" }] });
    expect(result.ok).toBe(true);
    expect(result.ok && result.fragment.spans[0]?.text?.trim().length).toBeGreaterThan(0);
  });

  test("collapses runs of spaces", () => {
    const result = sanitizeFragment({ spans: [{ text: "a      b" }] });
    expect(result.ok).toBe(true);
    expect(result.ok && result.fragment.spans[0]?.text).toBe("a b");
  });

  test("drops empty spans and trims only fragment edges", () => {
    const result = sanitizeFragment({
      spans: [{ text: "  " }, { text: " left" }, { text: "mid dle" }, { text: "right " }, { text: "" }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fragment.spans.map((s) => s.text)).toEqual(["left", "mid dle", "right"]);
    }
  });

  test("normalizes hex color case", () => {
    const result = sanitizeFragment({ spans: [{ text: "x", color: "#5FAFAF" }] });
    expect(result.ok).toBe(true);
    expect(result.ok && result.fragment.spans[0]?.color).toBe("#5fafaf");
  });

  test("deep copies the result", () => {
    const spans = [{ text: "original" }];
    const result = sanitizeFragment({ spans });
    expect(result.ok).toBe(true);
    if (result.ok) {
      result.fragment.spans[0]!.text = "mutated";
      expect(spans[0]!.text).toBe("original");
    }
  });

  test("empty visible content produces empty spans", () => {
    const result = sanitizeFragment({ spans: [{ text: "   " }] });
    expect(result.ok).toBe(true);
    expect(result.ok && result.fragment.spans.length).toBe(0);
  });

  test("a throwing getter classifies as invalid instead of propagating", () => {
    // The Host's publish boundary relies on sanitizeFragment never throwing,
    // even when a hostile provider hands over getter-based objects.
    const malicious = {
      get spans() {
        throw new Error("getter boom");
      },
    };
    expect(sanitizeFragment(malicious).ok).toBe(false);
    const hostileSpan = {
      spans: [
        {
          get text() {
            throw new Error("text getter boom");
          },
        },
      ],
    };
    expect(sanitizeFragment(hostileSpan).ok).toBe(false);
    const hostileColor = {
      spans: [
        {
          text: "ok",
          get color() {
            throw new Error("color boom");
          },
        },
      ],
    };
    expect(sanitizeFragment(hostileColor).ok).toBe(false);
  });

  test("an alternating color getter cannot bypass validation (read exactly once)", () => {
    // The color getter validates as undefined on the first read, then
    // returns an illegal value on the second. Read-once semantics make the
    // illegal second value unreachable: no color may appear in the output.
    let colorReads = 0;
    const result = sanitizeFragment({
      spans: [
        {
          text: "ok",
          get color() {
            colorReads++;
            return colorReads === 1 ? undefined : "not-a-hex";
          },
        },
      ],
    });
    expect(colorReads).toBe(1);
    expect(result.ok).toBe(true);
    expect(result.ok && result.fragment.spans[0] && "color" in result.fragment.spans[0]).toBe(false);
  });

  test("an alternating text getter is read exactly once", () => {
    let textReads = 0;
    const result = sanitizeFragment({
      spans: [
        {
          get text() {
            textReads++;
            return textReads === 1 ? "first" : "\x1b[31minjected";
          },
        },
      ],
    });
    expect(textReads).toBe(1);
    expect(result.ok).toBe(true);
    expect(result.ok && result.fragment.spans[0]?.text).toBe("first");
  });
});

describe("parseConfig", () => {
  test("accepts a valid config with defaults", () => {
    const config = parseConfig("version: 1\nstatuses:\n  - id: total\n");
    expect(config).toEqual({
      version: 1,
      separator: "slash",
      tight: false,
      statuses: [{ id: "total", options: {}, sourceIndex: 0 }],
    });
  });

  test("accepts all four separators", () => {
    for (const separator of ["space", "slash", "dot", "pipe"]) {
      const config = parseConfig(`version: 1\nseparator: ${separator}\nstatuses: []\n`);
      expect("config" in { config } && (config as { separator?: string }).separator).toBe(separator);
    }
  });

  test("accepts tight booleans and rejects other values", () => {
    expect(parseConfig("version: 1\ntight: true\nstatuses: []\n")?.tight).toBe(true);
    expect(parseConfig("version: 1\ntight: false\nstatuses: []\n")?.tight).toBe(false);
    expect(parseConfig("version: 1\ntight: compact\nstatuses: []\n")).toBeUndefined();
  });

  test("rejects an unknown top-level field", () => {
    const config = parseConfig("version: 1\nextra: true\nstatuses: []\n");
    expect(config).toBeUndefined();
  });

  test("rejects a wrong schema version", () => {
    expect(parseConfig("version: 2\nstatuses: []\n")).toBeUndefined();
    expect(parseConfig("statuses: []\n")).toBeUndefined();
  });

  test("isolates invalid entries and keeps valid ones with original indexes", () => {
    const result = parseStatusBarConfig(
      'version: 1\nstatuses:\n  - id: total\n  - extra: 1\n  - id: ""\n  - 42\n  - id: cache\n',
    );
    expect(result.kind).toBe("loaded");
    if (result.kind !== "loaded") {
      return;
    }
    expect(result.config.statuses.map((entry) => entry.id)).toEqual(["total", "cache"]);
    expect(result.problems).toEqual([
      { index: 1, reason: 'unknown field "extra"' },
      { index: 2, reason: "`id` must be a non-empty string" },
      { index: 3, reason: "each entry must be a mapping with an `id`" },
    ]);
  });

  test("reports no problems for a fully valid config", () => {
    expect(parseProblems("version: 1\nstatuses:\n  - id: total\n")).toEqual([]);
  });

  test("reports problems with unknown-field reasons for each bad entry", () => {
    const problems = parseProblems("version: 1\nstatuses:\n  - id: total\n    refreshMs: 5\n");
    expect(problems?.length).toBe(1);
    expect(problems?.[0]?.index).toBe(0);
    expect(problems?.[0]?.reason).toContain("refreshMs");
  });

  test("builtin describe rejects unknown option keys", () => {
    const definition = builtin("total");
    expect(() => definition.describe({ refreshMs: 500 })).toThrow('unknown option "refreshMs"');
    const context = builtin("context");
    expect(() => context.describe({ label: "word" })).toThrow('unknown option "label"');
  });

  test("rejects an invalid separator", () => {
    expect(parseConfig("version: 1\nseparator: dash\nstatuses: []\n")).toBeUndefined();
  });

  test("builtin describe rejects invalid option values", () => {
    // Option value validation is provider-owned (describe); a bad value
    // skips only that entry at instance-creation time.
    const definition = builtin("total");
    expect(() => definition.describe({ label: "word" })).not.toThrow();
    expect(() => definition.describe({ label: "huge" })).toThrow("`label`");
    const context = builtin("context");
    expect(() => context.describe({ mode: "percent" })).not.toThrow();
    expect(() => context.describe({ mode: "wide" })).toThrow("`mode`");
  });
});
