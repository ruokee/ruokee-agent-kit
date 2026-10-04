/**
 * Context-fragment composition tests, plus an integration check that the
 * shared sampler feeds the context provider.
 */
import { describe, test, expect } from "bun:test";
import { composeContextFragment } from "../src/context-fragment.ts";
import { composeLine } from "../src/widget.ts";
import { SnapshotStore, type SnapshotSources } from "../src/snapshot.ts";

const usage = (tokens: number) => ({ tokens, contextWindow: 200000, percent: (tokens / 200000) * 100 });

describe("context fragment composition", () => {
  test("percent mode puts the dimmed glyph and one plain space before the usage text", () => {
    const fragment = composeContextFragment(usage(24000), "percent")!;
    expect(fragment.spans).toEqual([
      { text: "\u{F0068}", color: "#5fafaf", dim: true },
      { text: " " },
      { text: "ctx 12%" },
    ]);
  });

  test("absolute mode puts the glyph before current tokens", () => {
    const fragment = composeContextFragment(usage(24000), "absolute")!;
    expect(fragment.spans.map((span) => span.text).join("")).toBe("\u{F0068} 24K");
  });

  test("the glyph does not change with usage", () => {
    const low = composeContextFragment(usage(1000), "percent")!;
    const high = composeContextFragment(usage(199000), "percent")!;
    expect(high.spans[0]).toEqual(low.spans[0]!);
  });

  test("no usage data or a non-positive window publishes nothing", () => {
    expect(composeContextFragment(undefined, "percent")).toBeUndefined();
    expect(composeContextFragment({ tokens: 10, contextWindow: 0, percent: 0 }, "percent")).toBeUndefined();
    expect(composeContextFragment({ tokens: 10, contextWindow: -1, percent: 0 }, "absolute")).toBeUndefined();
  });

  test("composing two fragments separates them with a dim slash", () => {
    const bar = composeLine(
      [composeContextFragment(usage(24000), "percent")!, { spans: [{ text: "T 5K" }] }],
      "slash",
      1,
    );
    const rendered = bar.spans.map((span) => span.text).join("");
    expect(rendered).toBe("\u{F0068} ctx 12% / T 5K");
  });
});

describe("snapshot integration", () => {
  test("sampler feeds the context provider with one context read per tick", () => {
    let contextCalls = 0;
    let statsCalls = 0;
    let tokens = 1000;
    const sources: SnapshotSources = {
      getConversationUsage: () => {
        statsCalls++;
        return { input: 1, cacheWrite: 0, cacheRead: 0, output: 1 };
      },
      getContextUsage: () => {
        contextCalls++;
        return usage(tokens);
      },
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
