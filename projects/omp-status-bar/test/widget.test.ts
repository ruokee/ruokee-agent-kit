import { describe, test, expect, beforeEach } from "bun:test";
import {
  registerProvider,
  assertSupportedContractVersion,
  PROVIDER_CONTRACT_VERSION,
  type ProviderDefinition,
} from "../src/provider-api.ts";
import { getProviderRegistry, resetProviderRegistryForTests } from "../src/registry.ts";
import { renderSpan, composeLine, renderLine, renderRows, RowCache, createStatusBarWidget } from "../src/widget.ts";
import type { ProviderFragment } from "../src/provider.ts";

const definition = (id: string, over: Partial<ProviderDefinition> = {}): ProviderDefinition => ({
  id,
  contractVersion: 1,
  describe: () => ({}),
  create: () => ({ start: () => {}, stop: () => {} }),
  ...over,
});

beforeEach(() => {
  resetProviderRegistryForTests();
});

describe("registry", () => {
  test("registers and resolves definitions", () => {
    registerProvider(definition("a"));
    registerProvider(definition("b"));
    const registry = getProviderRegistry();
    expect(registry.has("a")).toBe(true);
    expect(registry.get("b")?.id).toBe("b");
    expect(registry.ids().sort()).toEqual(["a", "b"]);
    expect(registry.has("missing")).toBe(false);
  });

  test("rejects duplicate ids", () => {
    registerProvider(definition("dup"));
    expect(() => registerProvider(definition("dup"))).toThrow("already registered");
  });

  test("rejects empty or non-string ids", () => {
    expect(() => registerProvider(definition(""))).toThrow("non-empty");
    expect(() => registerProvider({ ...definition("x"), id: 42 as unknown as string })).toThrow("non-empty");
  });

  test("rejects unsupported contract versions at registration", () => {
    expect(() => registerProvider(definition("old", { contractVersion: 2 as never }))).toThrow(RangeError);
    expect(() => registerProvider(definition("old", { contractVersion: 0 as never }))).toThrow(RangeError);
  });

  test("assertSupportedContractVersion rejects old copies registered before upgrade", () => {
    // Simulate a definition that slipped past registration (older copy of
    // the module): instance creation must still reject it.
    const stale = definition("stale", { contractVersion: 0 as never });
    expect(() => assertSupportedContractVersion(stale)).toThrow(RangeError);
    const current = definition("current", { contractVersion: PROVIDER_CONTRACT_VERSION });
    expect(() => assertSupportedContractVersion(current)).not.toThrow();
  });
});

describe("widget composition and rendering", () => {
  const fragment = (text: string, color?: `#${string}`): ProviderFragment => ({
    spans: [{ text, ...(color ? { color } : {}) }],
  });

  test("renderSpan composes dim with truecolor", () => {
    expect(renderSpan({ text: "abc" })).toBe("abc");
    expect(renderSpan({ text: "abc", dim: true })).toBe("\x1b[2mabc\x1b[22m");
    expect(renderSpan({ text: "abc", color: "#5fafaf" })).toBe("\x1b[38;2;95;175;175mabc\x1b[39m");
    // Color and dim are independent attributes, not alternatives.
    expect(renderSpan({ text: "abc", color: "#5fafaf", dim: true })).toBe(
      "\x1b[2m\x1b[38;2;95;175;175mabc\x1b[39m\x1b[22m",
    );
  });

  test("composeLine embeds the theme-rendered separator verbatim", () => {
    // The Host passes the ANSI text the theme produced for the separator;
    // it must survive composition untouched (no re-dimming, no recoloring).
    const themed = "\x1b[2m / \x1b[22m";
    const line = composeLine([fragment("T 120K", "#5fafaf"), fragment("ctx 12%")], "slash", 7, themed);
    expect(line.revision).toBe(7);
    expect(line.spans).toEqual([
      { text: "T 120K", color: "#5fafaf" },
      { text: themed, dim: false, color: undefined, verbatim: true },
      { text: "ctx 12%" },
    ]);
    // No themed separator text: the plain dim fallback renders.
    const plain = composeLine([fragment("a"), fragment("b")], "slash", 1);
    expect(plain.spans[1]).toEqual({ text: " / ", dim: true, color: undefined });
  });

  test("composeLine joins fragments with the configured separator", () => {
    const line = composeLine([fragment("T 120K", "#5fafaf"), fragment("ctx 12%")], "slash", 7);
    expect(line.revision).toBe(7);
    expect(line.spans.map((span) => ({ text: span.text, dim: span.dim }))).toEqual([
      { text: "T 120K", dim: undefined },
      { text: " / ", dim: true },
      { text: "ctx 12%", dim: undefined },
    ]);
  });

  test("composeLine skips empty fragments without separator residue", () => {
    const line = composeLine([fragment(""), { spans: [] }, fragment("x")], "space", 1);
    expect(line.spans).toEqual([{ text: "x" }]);
  });

  test("composeLine separator texts", () => {
    for (const [separator, text] of [
      ["space", " "],
      ["slash", " / "],
      ["dot", " · "],
      ["pipe", " | "],
    ] as const) {
      const line = composeLine([fragment("a"), fragment("b")], separator, 1);
      expect(line.spans[1]?.text).toBe(text);
      expect(line.spans[1]?.dim).toBe(true);
    }
  });

  test("renderRows hides the bar entirely when no spans remain", () => {
    const line = composeLine([], "slash", 1);
    expect(renderRows(line, 80)).toEqual([]);
  });

  test("RowCache memoizes by revision and width only", () => {
    const cache = new RowCache();
    const line = composeLine([fragment("hello")], "slash", 1);
    const first = cache.get(line, 40);
    expect(cache.get(line, 40)).toBe(first);
    // Same content under a new revision recomputes.
    const next = cache.get({ ...line, revision: 2 }, 40);
    expect(next).toEqual(first);
    expect(cache.get({ ...line, revision: 2 }, 40)).toBe(next);
    // Width change recomputes.
    expect(cache.get({ ...line, revision: 2 }, 20)).not.toBe(next);
  });

  test("createStatusBarWidget caches until setLine", () => {
    const widget = createStatusBarWidget();
    expect(widget.render(40)).toEqual([]);
    const line = composeLine([fragment("hello")], "slash", 3);
    widget.setLine(line);
    const rows = widget.render(40);
    expect(rows).toEqual(["hello"]);
    expect(widget.render(40)).toBe(rows);
    widget.setLine(composeLine([fragment("world")], "slash", 4));
    expect(widget.render(40)).toEqual(["world"]);
  });

  test("widget truncates with ANSI-aware ellipsis", () => {
    const widget = createStatusBarWidget();
    const styled = composeLine([{ spans: [{ text: "0123456789", color: "#5fafaf" }] }], "slash", 1);
    widget.setLine(styled);
    const row = widget.render(4)[0] ?? "";
    // Visible width is exactly 4: escape sequences do not count, the cut
    // ends with one ellipsis cell, and the color survives.
    expect(row).toContain("\x1b[38;2;95;175;175m");
    expect(row.endsWith("…")).toBe(true);
    const wide = composeLine([{ spans: [{ text: "一二三四五六七八九十" }] }], "slash", 2);
    widget.setLine(wide);
    const wideRow = widget.render(9)[0] ?? "";
    expect(wideRow).toContain("…");
  });

  test("widget transitions from empty to visible rows", () => {
    const widget = createStatusBarWidget();
    expect(widget.render(80)).toEqual([]);
    widget.setLine(composeLine([fragment("hi")], "slash", 5));
    expect(widget.render(80)).toEqual(["hi"]);
  });
});
