/**
 * Turn provider tests: the published fragment for each state, and the option
 * contract (the provider accepts no options at all).
 */

import { afterEach, describe, expect, test } from "bun:test";
import { BUILTIN_PROVIDERS } from "../src/providers/bundled.ts";
import type { ProviderFragment } from "../src/provider-api.ts";
import { resetTurnStateForTests, setTurnSample } from "../src/turn-state.ts";

const turn = BUILTIN_PROVIDERS.find((definition) => definition.id === "turn")!;

afterEach(() => {
  resetTurnStateForTests();
});

describe("turn provider", () => {
  test("renders the label and value, dimmed whenever no turn is running", async () => {
    for (const [active, expected] of [
      [true, { text: "Turn 12", color: "#87d7af" }],
      [false, { text: "Turn 12", color: "#87d7af", dim: true }],
    ] as const) {
      setTurnSample({ count: 12, active });
      const published: ProviderFragment[] = [];
      const options = {};
      const instance = turn.create({
        options,
        config: turn.describe(options),
        publish: (fragment) => published.push(fragment),
        setInterval: () => 1,
        setTimeout: () => 2,
        clearTimer: () => {},
      });
      try {
        await instance.start();
        expect(published).toHaveLength(1);
        expect(published[0]?.spans).toEqual([expected]);
      } finally {
        await instance.stop();
      }
    }
  });

  test("publishes nothing while the count is zero or no session is bound", async () => {
    setTurnSample({ count: 0, active: true });
    const published: ProviderFragment[] = [];
    const options = {};
    const instance = turn.create({
      options,
      config: turn.describe(options),
      publish: (fragment) => published.push(fragment),
      setInterval: () => 1,
      setTimeout: () => 2,
      clearTimer: () => {},
    });
    try {
      await instance.start();
      expect(published[0]?.spans).toEqual([]);

      setTurnSample({ count: 1, active: true });
      expect(published[1]?.spans?.[0]?.text).toBe("Turn 1");

      setTurnSample(undefined);
      expect(published[2]?.spans).toEqual([]);
    } finally {
      await instance.stop();
    }

    // A stopped instance is unsubscribed: late state changes publish nothing.
    setTurnSample({ count: 7, active: false });
    expect(published).toHaveLength(3);
  });

  test("rejects every option key", () => {
    expect(turn.describe({})).toEqual({});
    expect(() => turn.describe({ label: "word" })).toThrow(/unknown option/);
    expect(() => turn.describe({ anything: 1 })).toThrow(/unknown option/);
  });
});
