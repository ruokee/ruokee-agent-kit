import { SpeculationMachine, resolveBand } from "../src/speculation.ts";
import type { CompactionSettingsShape } from "../src/snapshot-store.ts";
import { describe, test, expect } from "bun:test";

const model = { provider: "acme", id: "big-1", contextWindow: 200000 };
const compaction: CompactionSettingsShape = {
  enabled: true,
  asyncEnabled: true,
  methodOrder: ["remote"],
  remoteEndpoint: "https://api.example.com",
  thresholdTokens: 0,
  thresholdPercent: 0,
  reserveTokens: undefined,
};
const input = (tokens: number | undefined, over: Record<string, unknown> = {}) => ({
  usage: tokens === undefined ? undefined : { tokens, contextWindow: 200000 },
  model,
  compaction,
  ...over,
});

describe("resolveBand", () => {
  test("threshold and start follow the spec formula", () => {
    const band = resolveBand(input(0))!;
    expect(band.threshold).toBe(170000);
    expect(band.start).toBe(band.threshold - Math.min(32000, Math.max(8192, Math.floor(band.threshold * 0.125))));
    expect(band.method).toBe("remote");
  });

  test("hidden when compaction disabled", () => {
    expect(resolveBand(input(0, { compaction: { ...compaction, enabled: false } }))).toBeUndefined();
  });

  test("hidden when async disabled", () => {
    expect(resolveBand(input(0, { compaction: { ...compaction, asyncEnabled: false } }))).toBeUndefined();
  });

  test("hidden when no speculation-capable method", () => {
    expect(resolveBand(input(0, { compaction: { ...compaction, methodOrder: ["snapcompact"] } }))).toBeUndefined();
  });

  test("hidden without a usable context window", () => {
    expect(resolveBand({ usage: { tokens: 0, contextWindow: 0 }, model, compaction })).toBeUndefined();
  });
});

describe("SpeculationMachine", () => {
  test("first valid sample inside the band indicates", () => {
    const m = new SpeculationMachine();
    const band = resolveBand(input(0))!;
    expect(m.evaluate(input(band.start + 10))).toBe("indicating");
  });

  test("first sample below the band stays normal and arms entry", () => {
    const m = new SpeculationMachine();
    const band = resolveBand(input(0))!;
    expect(m.evaluate(input(band.start - 10))).toBe("normal");
    expect(m.evaluate(input(band.start + 10))).toBe("indicating");
  });

  test("first sample above the threshold never claims compaction", () => {
    const m = new SpeculationMachine();
    const band = resolveBand(input(0))!;
    expect(m.evaluate(input(band.threshold + 10))).toBe("normal");
  });

  test("latch holds while tokens rise, any drop exits", () => {
    const m = new SpeculationMachine();
    const band = resolveBand(input(0))!;
    m.evaluate(input(band.start + 10));
    expect(m.evaluate(input(band.threshold + 500))).toBe("indicating");
    expect(m.evaluate(input(band.threshold + 600))).toBe("indicating");
    expect(m.evaluate(input(band.threshold - 10))).toBe("normal");
    expect(m.evaluate(input(band.threshold - 20))).toBe("normal");
  });

  test("after a drop, re-entry requires falling below the band start", () => {
    const m = new SpeculationMachine();
    const band = resolveBand(input(0))!;
    m.evaluate(input(band.start + 10));
    m.evaluate(input(band.threshold - 10));
    expect(m.evaluate(input(band.threshold - 20))).toBe("normal");
    expect(m.evaluate(input(band.start + 30))).toBe("normal");
    expect(m.evaluate(input(band.start - 5))).toBe("normal");
    expect(m.evaluate(input(band.start + 5))).toBe("indicating");
  });

  test("a below-start sample exits the latch even through an unknown gap", () => {
    const m = new SpeculationMachine();
    const band = resolveBand(input(0))!;
    m.evaluate(input(band.start + 10));
    m.evaluate(input(undefined));
    expect(m.evaluate(input(band.start - 100))).toBe("normal");
  });

  test("unknown usage publishes hidden but keeps the latch", () => {
    const m = new SpeculationMachine();
    const band = resolveBand(input(0))!;
    m.evaluate(input(band.start + 10));
    expect(m.evaluate(input(undefined))).toBe("hidden");
    expect(m.evaluate(input(band.start + 20))).toBe("indicating");
  });

  test("condition loss hides, and re-enabling needs re-entry below start", () => {
    const m = new SpeculationMachine();
    const band = resolveBand(input(0))!;
    m.evaluate(input(band.start + 10));
    expect(m.evaluate(input(band.start + 10, { compaction: { ...compaction, enabled: false } }))).toBe("hidden");
    // Re-enabling is not a first sample: inside the band it stays normal.
    expect(m.evaluate(input(band.start + 10))).toBe("normal");
    // Re-entry requires a dip below the band start first.
    expect(m.evaluate(input(band.start - 5))).toBe("normal");
    expect(m.evaluate(input(band.start + 5))).toBe("indicating");
  });

  test("method loss hides; restoring the method re-arms without immediate indication", () => {
    const m = new SpeculationMachine();
    const band = resolveBand(input(0))!;
    m.evaluate(input(band.start + 10));
    expect(m.evaluate(input(band.start + 10, { compaction: { ...compaction, methodOrder: ["snapcompact"] } }))).toBe(
      "hidden",
    );
    expect(m.evaluate(input(band.start + 10))).toBe("normal");
    expect(m.evaluate(input(band.start - 5))).toBe("normal");
    expect(m.evaluate(input(band.start + 5))).toBe("indicating");
  });

  test("model change re-baselines without immediate indication", () => {
    const m = new SpeculationMachine();
    const band = resolveBand(input(0))!;
    m.evaluate(input(band.start + 10));
    const model2 = { provider: "acme", id: "big-2", contextWindow: 200000 };
    expect(m.evaluate({ usage: { tokens: band.start + 10, contextWindow: 200000 }, model: model2, compaction })).toBe(
      "normal",
    );
    // Re-arm path still works after the change.
    expect(m.evaluate({ usage: { tokens: band.start - 10, contextWindow: 200000 }, model: model2, compaction })).toBe(
      "normal",
    );
    expect(m.evaluate({ usage: { tokens: band.start + 5, contextWindow: 200000 }, model: model2, compaction })).toBe(
      "indicating",
    );
  });

  test("context window change re-baselines", () => {
    const m = new SpeculationMachine();
    const band = resolveBand(input(0))!;
    m.evaluate(input(band.start + 10));
    expect(m.evaluate({ usage: { tokens: band.start + 10, contextWindow: 100000 }, model, compaction })).toBe("normal");
  });

  test("threshold change re-baselines", () => {
    const m = new SpeculationMachine();
    const band = resolveBand(input(0))!;
    m.evaluate(input(band.start + 10));
    const c2 = { ...compaction, thresholdPercent: 90 };
    expect(m.evaluate({ usage: { tokens: band.start + 10, contextWindow: 200000 }, model, compaction: c2 })).toBe(
      "normal",
    );
  });

  test("reset clears everything", () => {
    const m = new SpeculationMachine();
    const band = resolveBand(input(0))!;
    m.evaluate(input(band.start + 10));
    m.reset();
    expect(m.state).toBe("hidden");
    // Fresh baseline after reset: first inside sample indicates again.
    expect(m.evaluate(input(band.start + 10))).toBe("indicating");
  });
});
