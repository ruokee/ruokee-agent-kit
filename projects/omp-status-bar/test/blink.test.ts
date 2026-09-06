/**
 * Context-fragment composition and blink phase tests, plus an integration
 * check that the shared sampler feeds the context provider.
 */
import { describe, test, expect } from "bun:test";
import { composeContextFragment } from "../src/context-fragment.ts";
import { composeLine } from "../src/widget.ts";
import { SnapshotStore, type SnapshotSources } from "../src/snapshot.ts";

const usage = (tokens: number) => ({ tokens, contextWindow: 200000, percent: (tokens / 200000) * 100 });

const model = { provider: "acme", id: "big-1", contextWindow: 200000, input: ["text"] };

describe("blink composition", () => {
  test("indicating first frame is emphasized, second frame dims", () => {
    const lit = composeContextFragment(usage(1000), "percent", "indicating", true)!;
    const glyph = lit.spans.at(-1)!;
    expect(glyph.color).toBe("#5fafaf");
    expect(glyph.dim).toBeUndefined();
    const dim = composeContextFragment(usage(1000), "percent", "indicating", false)!;
    expect(dim.spans.at(-1)!.dim).toBe(true);
  });

  test("hidden state contributes no glyph spans", () => {
    const fragment = composeContextFragment(usage(24000), "percent", "hidden")!;
    // Usage span only; the glyph and its spacing span are absent.
    expect(fragment.spans.map((span) => span.text)).toEqual(["ctx 12%"]);
  });

  test("normal state renders the dimmed glyph", () => {
    const fragment = composeContextFragment(usage(24000), "percent", "normal")!;
    expect(fragment.spans.map((span) => span.text)).toEqual(["ctx 12%", " ", "󰁨"]);
    expect(fragment.spans.at(-1)!.dim).toBe(true);
  });

  test("absolute mode renders only current tokens", () => {
    const fragment = composeContextFragment(usage(24000), "absolute", "hidden")!;
    expect(fragment.spans[0]?.text).toBe("24K");
  });

  test("composing two fragments separates them with a dim slash", () => {
    const bar = composeLine(
      [composeContextFragment(usage(24000), "percent", "indicating", true)!, { spans: [{ text: "T 5K" }] }],
      "slash",
      1,
    );
    const rendered = bar.spans.map((span) => span.text).join("");
    expect(rendered).toContain("ctx 12%");
    expect(rendered).toContain("T 5K");
    expect(rendered).toContain(" / ");
  });
});

describe("snapshot integration", () => {
  test("sampler feeds the context provider with one context read per tick", () => {
    let contextCalls = 0;
    let statsCalls = 0;
    let tokens = 1000;
    const sources: SnapshotSources = {
      getUsageStatistics: () => {
        statsCalls++;
        return { input: 1, cacheWrite: 0, cacheRead: 0, output: 1 };
      },
      getContextUsage: () => {
        contextCalls++;
        return usage(tokens);
      },
      getModel: () => model,
      getCompactionSettings: () => undefined,
    };
    const store = new SnapshotStore();
    store.bind(sources);
    store.attachTimers({
      setInterval: () => 1,
      clearTimeout: () => {},
    });
    const noop = (): void => {};
    store.retainContext(noop);
    store.retainContext(noop);
    // One immediate read on the first retention; the second retention
    // re-reads because sample() was called again manually.
    const first = store.sample();
    expect(contextCalls).toBe(2);
    // Equal content keeps the revision stable.
    const second = store.sample();
    expect(second.revision).toBe(first.revision);
    expect(contextCalls).toBe(3);
    // Token change bumps the revision and lands in the snapshot.
    tokens = 24000;
    const third = store.sample();
    expect(contextCalls).toBe(4);
    expect(third.revision).toBeGreaterThan(first.revision);
    expect(third.context?.usage?.tokens).toBe(24000);
  });
});
