/**
 * Turn state tests: the branch counter, the change notification, and the
 * subscription that provider instances use.
 */

import { afterEach, describe, expect, test } from "bun:test";
import {
  countSuccessfulResponses,
  getTurnSample,
  resetTurnStateForTests,
  setTurnSample,
  subscribeTurn,
} from "../src/turn-state.ts";

afterEach(() => {
  resetTurnStateForTests();
});

describe("turn state", () => {
  test("counts only assistant responses that ended successfully", () => {
    const branch = [
      { type: "message", message: { role: "user" } },
      { type: "message", message: { role: "assistant", stopReason: "stop" } },
      { type: "message", message: { role: "assistant", stopReason: "toolUse" } },
      { type: "message", message: { role: "assistant", stopReason: "length" } },
      { type: "message", message: { role: "assistant", stopReason: "error" } },
      { type: "message", message: { role: "assistant", stopReason: "aborted" } },
      { type: "message", message: { role: "assistant", stopReason: "constructor" } },
      { type: "message", message: { role: "assistant" } },
      { type: "message" },
      { type: "compaction" },
      { type: "model_usage", message: { role: "assistant", stopReason: "stop" } },
    ];
    expect(countSuccessfulResponses(branch)).toBe(3);
    expect(countSuccessfulResponses([])).toBe(0);
  });

  test("notifies subscribers only when the state actually changed", () => {
    let notifications = 0;
    const release = subscribeTurn(() => notifications++);

    setTurnSample({ count: 3, active: false });
    expect(notifications).toBe(1);
    expect(getTurnSample()).toEqual({ count: 3, active: false });

    // Equal values are not a change: a re-publish would repaint for nothing.
    setTurnSample({ count: 3, active: false });
    expect(notifications).toBe(1);

    setTurnSample({ count: 3, active: true });
    expect(notifications).toBe(2);

    release();
    setTurnSample({ count: 4, active: false });
    expect(notifications).toBe(2);

    // Clearing an already cleared state is not a change either.
    setTurnSample(undefined);
    expect(notifications).toBe(2);
    setTurnSample(undefined);
    expect(notifications).toBe(2);
    expect(getTurnSample()).toBeUndefined();
  });
});
