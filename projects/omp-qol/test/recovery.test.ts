/**
 * Recovery module tests (matrix R01-R04): message classification, chain
 * bookkeeping, and the stop hook as the host registers it.
 *
 * Classification runs against the real `@oh-my-pi/pi-ai/error` package, so the
 * flag names and classifier behavior are the shipped ones. Waits are injected,
 * never real timers.
 */

import { describe, expect, test } from "bun:test";
import { create, Flag } from "@oh-my-pi/pi-ai/error";
import type { SessionStopEvent, SessionStopEventResult } from "@oh-my-pi/pi-coding-agent";
import { activate } from "../src/extension.ts";
import {
  cancellableSleep,
  createRecoveryController,
  evaluateRecoveryMessage,
  finalErrorMessage,
  RECOVERY_CONTINUATION_CONTEXT,
  recoveryDelayMs,
  type RecoveryController,
  type RecoveryErrorInput,
} from "../src/recovery.ts";
import { SETTINGS_DEFAULTS, type RecoverySettings } from "../src/settings.ts";
import { createHarness, type Harness } from "./host.ts";

const RECOVERY: RecoverySettings = {
  enabled: true,
  mode: "knownTransient",
  maxAttempts: 8,
  backoffBaseMs: 1000,
  backoffMaxMs: 8000,
  notify: true,
};

/** A final assistant error, in the shape the host records it. */
function assistantMessage(overrides: Partial<RecoveryErrorInput> = {}): RecoveryErrorInput {
  return { api: "anthropic", provider: "anthropic", model: "test-model", ...overrides };
}

const TRANSIENT_ERROR: RecoveryErrorInput = { errorStatus: 502, errorMessage: "502 Bad Gateway" };

interface StopOverrides {
  /** Assistant message; `null` ends the pass on something else. */
  error?: RecoveryErrorInput | null;
  stopReason?: string;
  turnId?: number;
  sessionId?: string;
  stopHookActive?: boolean;
  signal?: AbortSignal;
  /** Append a later user turn, so the host hint points past the error. */
  trailingUser?: boolean;
  /** Drop the host's `last_assistant_message` hint. */
  omitHint?: boolean;
}

function stopEvent(overrides: StopOverrides = {}): SessionStopEvent {
  const message: Record<string, unknown> =
    overrides.error === null
      ? { role: "user", content: "hi" }
      : { ...assistantMessage(TRANSIENT_ERROR), ...overrides.error, role: "assistant" };
  if (overrides.error !== null) message.stopReason = overrides.stopReason ?? "error";
  const messages: unknown[] = overrides.trailingUser === true ? [message, { role: "user", content: "hi" }] : [message];
  return {
    type: "session_stop",
    messages,
    turn_id: overrides.turnId ?? 1,
    last_assistant_message: overrides.omitHint === true ? undefined : message,
    session_id: overrides.sessionId ?? "session-a",
    stop_hook_active: overrides.stopHookActive ?? false,
    signal: overrides.signal ?? new AbortController().signal,
  } as unknown as SessionStopEvent;
}

interface RecoveryHelper {
  controller: RecoveryController;
  sleeps: number[];
  notes: string[];
}

/** A controller whose waits are recorded and settled by the test. */
function controllableRecovery(
  settings: Partial<RecoverySettings> = {},
  sleep?: (ms: number, signal: AbortSignal | undefined, controller: RecoveryController) => Promise<void>,
): RecoveryHelper {
  const sleeps: number[] = [];
  const notes: string[] = [];
  const controller: RecoveryController = createRecoveryController({
    settings: { ...RECOVERY, ...settings },
    sleep: async (ms, signal) => {
      sleeps.push(ms);
      await sleep?.(ms, signal, controller);
    },
  });
  return { controller, sleeps, notes };
}

async function handle(
  helper: RecoveryHelper,
  overrides: StopOverrides = {},
): Promise<SessionStopEventResult | undefined> {
  return await helper.controller.handleStop(stopEvent(overrides), (message) => helper.notes.push(message));
}

describe("recovery classification", () => {
  test("recovers classified transient, timeout, and stream-drop errors in both modes", () => {
    const cases: Array<{ name: string; message: RecoveryErrorInput; reason: string }> = [
      { name: "transient flag", message: assistantMessage({ errorId: create(Flag.Transient) }), reason: "transient" },
      { name: "timeout flag", message: assistantMessage({ errorId: create(Flag.Timeout) }), reason: "timeout" },
      {
        name: "timeout text",
        message: assistantMessage({ errorStatus: 408, errorMessage: "408 Request Timeout" }),
        reason: "transient",
      },
      {
        name: "gateway text",
        message: assistantMessage({ errorStatus: 502, errorMessage: "502 Bad Gateway" }),
        reason: "transient",
      },
      {
        name: "stream drop text",
        message: assistantMessage({ errorMessage: "stream ended before completion: unexpected EOF" }),
        reason: "transient",
      },
    ];
    for (const entry of cases) {
      expect([entry.name, evaluateRecoveryMessage(entry.message, "knownTransient")]).toEqual([
        entry.name,
        { retry: true, reason: entry.reason },
      ]);
      expect([entry.name, evaluateRecoveryMessage(entry.message, "unclassified").retry]).toEqual([entry.name, true]);
    }
  });

  test("stays native for a status-carrying error with no verdict", () => {
    const unparsed = assistantMessage({ errorStatus: 500, errorMessage: "boom" });
    expect(evaluateRecoveryMessage(unparsed, "knownTransient")).toEqual({
      retry: false,
      reason: "not-known-transient",
    });
    expect(evaluateRecoveryMessage(unparsed, "unclassified")).toEqual({ retry: true, reason: "unclassified" });
  });

  test("recovers a statusless error with no verdict in the default scope", () => {
    const silent = assistantMessage({});
    const textOnly = assistantMessage({ errorMessage: "relay closed the stream" });
    for (const message of [silent, textOnly]) {
      expect(evaluateRecoveryMessage(message, "knownTransient")).toEqual({
        retry: true,
        reason: "statusless-unclassified",
      });
      expect(evaluateRecoveryMessage(message, "unclassified")).toEqual({ retry: true, reason: "unclassified" });
    }
  });

  test("recovers a turn the host marked as interrupted mid-stream", () => {
    // The shape OMP 18.2.4 recorded for a relay whose websocket closed with code
    // 1012 while a tool call was streaming: no status, no verdict, the mark.
    const interrupted = assistantMessage({
      api: "openai-responses",
      provider: "relay",
      errorId: 0,
      errorMessage: "1012: websocket closed before terminal event (code 1012)",
      stopDetails: {
        type: "stream_interrupted_after_content",
        category: null,
        explanation: "1012: websocket closed before terminal event (code 1012)",
      },
    });
    expect(evaluateRecoveryMessage(interrupted, "knownTransient")).toEqual({
      retry: true,
      reason: "stream-interrupted",
    });
    expect(evaluateRecoveryMessage(interrupted, "unclassified")).toEqual({ retry: true, reason: "unclassified" });

    // The mark alone carries the case: a status or a verdict does not remove it.
    const withStatus = assistantMessage({
      errorStatus: 500,
      errorMessage: "relay closed the stream",
      stopDetails: { type: "stream_interrupted_after_content" },
    });
    expect(evaluateRecoveryMessage(withStatus, "knownTransient")).toEqual({
      retry: true,
      reason: "stream-interrupted",
    });

    const withVerdict = assistantMessage({
      errorId: create(Flag.EmptyResponse),
      stopDetails: { type: "stream_interrupted_after_content" },
    });
    expect(evaluateRecoveryMessage(withVerdict, "knownTransient")).toEqual({
      retry: true,
      reason: "stream-interrupted",
    });
    // `unclassified` keeps its own definition and gains nothing from the mark.
    expect(evaluateRecoveryMessage(withVerdict, "unclassified").retry).toBe(false);
  });

  test("keeps the exclusion list and the terminal status rule ahead of the mark", () => {
    const marked = (overrides: Partial<RecoveryErrorInput>): RecoveryErrorInput =>
      assistantMessage({ stopDetails: { type: "stream_interrupted_after_content" }, ...overrides });

    expect(evaluateRecoveryMessage(marked({ errorId: create(Flag.UsageLimit) }), "knownTransient")).toEqual({
      retry: false,
      reason: "usage-limit",
    });
    expect(
      evaluateRecoveryMessage(marked({ errorId: create(Flag.Transient | Flag.UserInterrupt) }), "knownTransient"),
    ).toEqual({ retry: false, reason: "user-interrupt" });
    expect(
      evaluateRecoveryMessage(marked({ errorStatus: 404, errorMessage: "404 not found" }), "knownTransient"),
    ).toEqual({ retry: false, reason: "terminal-client-status" });
  });

  test("never recovers a terminal client status, even with transient wording", () => {
    const cases: RecoveryErrorInput[] = [
      assistantMessage({ errorStatus: 404, errorMessage: "404 not found" }),
      assistantMessage({ errorStatus: 400, errorMessage: "400 unexpected EOF" }),
      assistantMessage({ errorStatus: 422, errorMessage: "unprocessable entity" }),
      assistantMessage({ errorId: 404 }),
    ];
    for (const message of cases) {
      expect(evaluateRecoveryMessage(message, "knownTransient")).toEqual({
        retry: false,
        reason: "terminal-client-status",
      });
      expect(evaluateRecoveryMessage(message, "unclassified").retry).toBe(false);
    }
  });

  test("leaves credential and quota failures to the flows that own them", () => {
    expect(
      evaluateRecoveryMessage(
        assistantMessage({ errorStatus: 401, errorMessage: "401 unauthorized" }),
        "knownTransient",
      ),
    ).toEqual({ retry: false, reason: "auth-failed" });
    const quota = assistantMessage({ errorId: create(Flag.UsageLimit), errorMessage: "rate limit exceeded" });
    expect(evaluateRecoveryMessage(quota, "knownTransient")).toEqual({ retry: false, reason: "usage-limit" });
    expect(evaluateRecoveryMessage(quota, "unclassified").retry).toBe(false);
  });

  test("applies the exclusion list before any transient evidence", () => {
    const cases: Array<[Flag, string]> = [
      [Flag.ContentBlocked, "content-blocked"],
      [Flag.UserInterrupt, "user-interrupt"],
      [Flag.Abort, "abort"],
      [Flag.SilentAbort, "silent-abort"],
      [Flag.AuthFailed, "auth-failed"],
      [Flag.OAuthExpiry, "oauth-expiry"],
      [Flag.UsageLimit, "usage-limit"],
      [Flag.AccountPolicy, "account-policy"],
      [Flag.ContextOverflow, "context-overflow"],
      [Flag.PayloadRejected, "payload-rejected"],
      [Flag.Grammar, "grammar-rejected"],
      [Flag.FastModeUnsupported, "unsupported-mode"],
      [Flag.ThinkingLoop, "thinking-loop"],
      [Flag.StaleResponsesItem, "stale-responses-item"],
      [Flag.MalformedFunctionCall, "deterministic-tool-json"],
    ];
    for (const [flag, reason] of cases) {
      const message = assistantMessage({ errorId: create(Flag.Transient | flag) });
      expect([reason, evaluateRecoveryMessage(message, "knownTransient")]).toEqual([reason, { retry: false, reason }]);
      expect([reason, evaluateRecoveryMessage(message, "unclassified").retry]).toEqual([reason, false]);
    }
  });

  test("unclassified recovery never widens to a classified kind", () => {
    const cases: Array<[string, Flag]> = [
      ["empty response", Flag.EmptyResponse],
      ["provider finish error", Flag.ProviderFinishError],
      ["usage limit", Flag.UsageLimit],
      ["context overflow", Flag.ContextOverflow],
    ];
    for (const [name, flag] of cases) {
      const message = assistantMessage({ errorId: create(flag) });
      expect([name, evaluateRecoveryMessage(message, "unclassified").retry]).toEqual([name, false]);
    }
  });

  test("classifies a copy and leaves the host message untouched", () => {
    const original = assistantMessage({ errorMessage: "502 Bad Gateway" });
    expect(original.errorId).toBeUndefined();
    expect(evaluateRecoveryMessage(original, "knownTransient").retry).toBe(true);
    expect(original.errorId).toBeUndefined();

    const classified = assistantMessage({ errorId: create(Flag.Transient) });
    evaluateRecoveryMessage(classified, "knownTransient");
    expect(classified.errorId).toBe(create(Flag.Transient));
  });
});

describe("recovery event selection", () => {
  test("reads only a final assistant error", () => {
    expect(finalErrorMessage(stopEvent({ error: null }))).toBeUndefined();
    expect(finalErrorMessage(stopEvent({ stopReason: "stop" }))).toBeUndefined();
    expect(finalErrorMessage(stopEvent({ stopReason: "length" }))).toBeUndefined();
    expect(finalErrorMessage(stopEvent({ stopReason: "aborted" }))).toBeUndefined();

    const event = stopEvent();
    expect(finalErrorMessage(event)).toBe(event.last_assistant_message as RecoveryErrorInput);
  });

  test("prefers the host hint and never digs past a later turn", () => {
    const hinted = stopEvent({ trailingUser: true });
    expect(finalErrorMessage(hinted)).toBe(hinted.last_assistant_message as RecoveryErrorInput);

    expect(finalErrorMessage(stopEvent({ omitHint: true, trailingUser: true }))).toBeUndefined();

    const fallback = stopEvent({ omitHint: true });
    expect(finalErrorMessage(fallback)).toBe(fallback.messages[0] as RecoveryErrorInput);
  });
});

describe("recovery chain", () => {
  test("waits with a doubling backoff and returns the fixed continuation", async () => {
    const helper = controllableRecovery({ backoffBaseMs: 100, backoffMaxMs: 300 });
    const first = await handle(helper, { turnId: 1 });
    expect(first).toEqual({ continue: true, additionalContext: RECOVERY_CONTINUATION_CONTEXT });
    expect(helper.sleeps).toEqual([100]);
    expect(helper.notes).toEqual(["Recovering after an upstream error: attempt 1, waiting 100 ms"]);

    await handle(helper, { turnId: 2, stopHookActive: true });
    await handle(helper, { turnId: 3, stopHookActive: true });
    await handle(helper, { turnId: 4, stopHookActive: true });
    expect(helper.sleeps).toEqual([100, 200, 300, 300]);
    expect(helper.controller.chain.attempts).toBe(4);
  });

  test("counts a continuation only when the wait was not cancelled", async () => {
    const abort = new AbortController();
    const helper = controllableRecovery({ backoffBaseMs: 100 }, async () => {
      abort.abort();
    });
    expect(await handle(helper, { turnId: 1, signal: abort.signal })).toBeUndefined();
    expect(helper.controller.chain.attempts).toBe(0);
    expect(helper.controller.chain.handledTurn).toEqual({ run: 0, turnId: 1 });
  });

  test("drops a wait invalidated by a chain reset or a session switch", async () => {
    const resetting = controllableRecovery({ backoffBaseMs: 100 }, async (_ms, _signal, controller) => {
      controller.reset();
    });
    expect(await handle(resetting, { turnId: 1 })).toBeUndefined();
    expect(resetting.controller.chain.attempts).toBe(0);

    const switched = controllableRecovery({ backoffBaseMs: 100 }, async (_ms, _signal, controller) => {
      controller.chain.sessionId = "session-b";
    });
    expect(await handle(switched, { turnId: 1 })).toBeUndefined();
    expect(switched.controller.chain.attempts).toBe(0);
  });

  test("continues a turn the host marked as interrupted mid-stream", async () => {
    const helper = controllableRecovery({ backoffBaseMs: 100 });
    const result = await handle(helper, {
      error: assistantMessage({
        errorId: 0,
        errorMessage: "1012: websocket closed before terminal event (code 1012)",
        stopDetails: { type: "stream_interrupted_after_content" },
      }),
    });
    expect(result).toEqual({ continue: true, additionalContext: RECOVERY_CONTINUATION_CONTEXT });
    expect(helper.sleeps).toEqual([100]);
    expect(helper.notes).toEqual(["Recovering after an upstream error: attempt 1, waiting 100 ms"]);
  });

  test("stays native when the settle pass is already aborted", async () => {
    const abort = new AbortController();
    abort.abort();
    const helper = controllableRecovery();
    expect(await handle(helper, { turnId: 1, signal: abort.signal })).toBeUndefined();
    expect(helper.sleeps).toEqual([]);
    expect(helper.notes).toEqual([]);
  });

  test("does not wait twice for one turn", async () => {
    const helper = controllableRecovery({ backoffBaseMs: 100 });
    expect((await handle(helper, { turnId: 7 }))?.continue).toBe(true);
    expect(await handle(helper, { turnId: 7, stopHookActive: true })).toBeUndefined();
    expect(await handle(helper, { turnId: 7 })).toBeUndefined();
    expect(helper.sleeps).toEqual([100]);
    expect(helper.controller.chain.attempts).toBe(1);
  });

  test("enforces the attempt cap and starts over on a fresh cycle", async () => {
    const helper = controllableRecovery({ backoffBaseMs: 10, backoffMaxMs: 10, maxAttempts: 2 });
    expect((await handle(helper, { turnId: 1 }))?.continue).toBe(true);
    expect((await handle(helper, { turnId: 2, stopHookActive: true }))?.continue).toBe(true);
    expect(await handle(helper, { turnId: 3, stopHookActive: true })).toBeUndefined();
    expect(helper.controller.chain.attempts).toBe(2);

    // A new stop cycle, marked by a cleared `stop_hook_active`, restores budget.
    expect((await handle(helper, { turnId: 4 }))?.continue).toBe(true);
    expect(helper.controller.chain.attempts).toBe(1);
    expect(helper.sleeps).toEqual([10, 10, 10]);
  });

  test("starts a new chain for another session", async () => {
    const helper = controllableRecovery({ backoffBaseMs: 10, backoffMaxMs: 10, maxAttempts: 1 });
    expect((await handle(helper, { turnId: 1, sessionId: "session-a" }))?.continue).toBe(true);
    expect(await handle(helper, { turnId: 2, sessionId: "session-a", stopHookActive: true })).toBeUndefined();
    expect((await handle(helper, { turnId: 1, sessionId: "session-b" }))?.continue).toBe(true);
  });

  test("skips the notice when notifications are off and stays silent when refused", async () => {
    const quiet = controllableRecovery({ notify: false });
    expect((await handle(quiet, { turnId: 1 }))?.continue).toBe(true);
    expect(quiet.notes).toEqual([]);

    const refused = controllableRecovery();
    const result = await handle(refused, {
      error: assistantMessage({ errorStatus: 400, errorMessage: "400 bad request" }),
    });
    expect(result).toBeUndefined();
    expect(refused.notes).toEqual([]);
    expect(refused.sleeps).toEqual([]);
  });

  test("computes the capped backoff and survives an absurd attempt count", () => {
    const recovery: RecoverySettings = { ...RECOVERY, backoffBaseMs: 1000, backoffMaxMs: 8000 };
    expect(recoveryDelayMs(1, recovery)).toBe(1000);
    expect(recoveryDelayMs(2, recovery)).toBe(2000);
    expect(recoveryDelayMs(4, recovery)).toBe(8000);
    expect(recoveryDelayMs(40, recovery)).toBe(8000);
    expect(recoveryDelayMs(0, recovery)).toBe(1000);
  });
});

describe("recovery across agent runs", () => {
  test("recovers every run that fails on its first turn", async () => {
    // The host resets its turn counter at every `agent_start`, so consecutive
    // failures on the first turn all report `turn_id = 0`.
    const helper = controllableRecovery({ backoffBaseMs: 10, backoffMaxMs: 10 });
    helper.controller.startRun();
    expect((await handle(helper, { turnId: 0 }))?.continue).toBe(true);

    helper.controller.startRun();
    expect((await handle(helper, { turnId: 0, stopHookActive: true }))?.continue).toBe(true);

    helper.controller.startRun();
    expect((await handle(helper, { turnId: 0 }))?.continue).toBe(true);
    expect(helper.sleeps).toEqual([10, 10, 10]);
    expect(helper.notes).toEqual([
      "Recovering after an upstream error: attempt 1, waiting 10 ms",
      "Recovering after an upstream error: attempt 2, waiting 10 ms",
      "Recovering after an upstream error: attempt 1, waiting 10 ms",
    ]);
  });

  test("keeps the attempt budget across runs and stops at the host cap", async () => {
    const helper = controllableRecovery({ backoffBaseMs: 10, backoffMaxMs: 10 });
    const results: boolean[] = [];
    for (let index = 1; index <= 9; index++) {
      helper.controller.startRun();
      const result = await handle(helper, { turnId: 0, stopHookActive: index > 1 });
      results.push(result?.continue === true);
    }
    // The host stops its own chain at eight continuations; this module counts
    // every one of them instead of starting over per run.
    expect(results).toEqual([true, true, true, true, true, true, true, true, false]);
    expect(helper.controller.chain.attempts).toBe(8);
  });

  test("honours the configured attempt cap across runs", async () => {
    const helper = controllableRecovery({ backoffBaseMs: 10, backoffMaxMs: 10, maxAttempts: 2 });
    helper.controller.startRun();
    expect((await handle(helper, { turnId: 0 }))?.continue).toBe(true);
    helper.controller.startRun();
    expect((await handle(helper, { turnId: 0, stopHookActive: true }))?.continue).toBe(true);
    helper.controller.startRun();
    expect(await handle(helper, { turnId: 0, stopHookActive: true })).toBeUndefined();
    expect(helper.controller.chain.attempts).toBe(2);
  });

  test("ignores a repeated callback inside one run", async () => {
    const helper = controllableRecovery({ backoffBaseMs: 10, backoffMaxMs: 10 });
    helper.controller.startRun();
    expect((await handle(helper, { turnId: 0 }))?.continue).toBe(true);
    expect(await handle(helper, { turnId: 0, stopHookActive: true })).toBeUndefined();
    expect(await handle(helper, { turnId: 0 })).toBeUndefined();
    expect(helper.sleeps).toEqual([10]);
    expect(helper.controller.chain.attempts).toBe(1);
  });

  test("recovers again after a new user input starts a fresh chain", async () => {
    const helper = controllableRecovery({ backoffBaseMs: 10, backoffMaxMs: 10, maxAttempts: 1 });
    helper.controller.startRun();
    expect((await handle(helper, { turnId: 0 }))?.continue).toBe(true);
    helper.controller.startRun();
    expect(await handle(helper, { turnId: 0, stopHookActive: true })).toBeUndefined();

    // The host clears `stop_hook_active` for a settle pass that is not a
    // continuation, which is how a fresh prompt's chain starts over.
    helper.controller.startRun();
    expect((await handle(helper, { turnId: 0 }))?.continue).toBe(true);
    expect(helper.controller.chain.attempts).toBe(1);
  });

  test("drops a wait invalidated by a run that started meanwhile", async () => {
    const helper = controllableRecovery({ backoffBaseMs: 100 }, async (_ms, _signal, controller) => {
      controller.startRun();
    });
    expect(await handle(helper, { turnId: 0 })).toBeUndefined();
    expect(helper.controller.chain.attempts).toBe(0);
    expect(helper.controller.chain.run).toBe(1);
  });
});

describe("recovery chain endings", () => {
  const fast = { backoffBaseMs: 10, backoffMaxMs: 10 } as const;

  test("ends the chain when a turn settles on its own", async () => {
    // The budget is spent, but the host cycle this module extended is over. A
    // chain another stop hook continues starts from zero instead of inheriting
    // the spent budget.
    const helper = controllableRecovery({ ...fast, maxAttempts: 1 });
    helper.controller.startRun();
    expect((await handle(helper, { turnId: 0 }))?.continue).toBe(true);
    expect(helper.controller.chain.attempts).toBe(1);

    helper.controller.startRun();
    expect(await handle(helper, { turnId: 0, stopHookActive: true, error: null })).toBeUndefined();
    expect(helper.controller.chain.attempts).toBe(0);

    helper.controller.startRun();
    expect((await handle(helper, { turnId: 0, stopHookActive: true }))?.continue).toBe(true);
    expect(helper.controller.chain.attempts).toBe(1);
    expect(helper.sleeps).toEqual([10, 10]);
  });

  test("ends the chain on an error it never recovers", async () => {
    const helper = controllableRecovery({ ...fast, maxAttempts: 1 });
    helper.controller.startRun();
    expect((await handle(helper, { turnId: 0 }))?.continue).toBe(true);

    helper.controller.startRun();
    const refused = await handle(helper, {
      turnId: 0,
      stopHookActive: true,
      error: assistantMessage({ errorStatus: 400, errorMessage: "400 bad request" }),
    });
    expect(refused).toBeUndefined();
    expect(helper.controller.chain.attempts).toBe(0);

    helper.controller.startRun();
    expect((await handle(helper, { turnId: 0, stopHookActive: true }))?.continue).toBe(true);
    expect(helper.sleeps).toEqual([10, 10]);
  });

  test("keeps the handled turn marked after another pass ended the chain", async () => {
    // Ending a chain must not forget the turn already handled: the host can
    // repeat that callback, and a repeat neither waits nor spends budget.
    const helper = controllableRecovery(fast);
    helper.controller.startRun();
    expect((await handle(helper, { turnId: 3 }))?.continue).toBe(true);

    expect(await handle(helper, { turnId: 4, error: null })).toBeUndefined();
    expect(helper.controller.chain.attempts).toBe(0);

    expect(await handle(helper, { turnId: 3 })).toBeUndefined();
    expect(helper.sleeps).toEqual([10]);
    expect(helper.notes).toHaveLength(1);
  });

  test("ends the chain when a pass is cancelled before it decides", async () => {
    const cancelled = new AbortController();
    cancelled.abort();
    const helper = controllableRecovery({ ...fast, maxAttempts: 1 });
    helper.controller.startRun();
    expect((await handle(helper, { turnId: 0 }))?.continue).toBe(true);

    helper.controller.startRun();
    expect(await handle(helper, { turnId: 0, stopHookActive: true, signal: cancelled.signal })).toBeUndefined();
    expect(helper.controller.chain.attempts).toBe(0);

    helper.controller.startRun();
    expect((await handle(helper, { turnId: 0, stopHookActive: true }))?.continue).toBe(true);
  });

  test("ends the chain when a wait is cancelled", async () => {
    const gate = new AbortController();
    const helper = controllableRecovery({ ...fast, maxAttempts: 1 }, async () => {
      gate.abort();
    });
    helper.controller.startRun();
    expect(await handle(helper, { turnId: 0, signal: gate.signal })).toBeUndefined();
    expect(helper.controller.chain.attempts).toBe(0);

    helper.controller.startRun();
    expect((await handle(helper, { turnId: 0, stopHookActive: true }))?.continue).toBe(true);
  });
});

describe("cancellable sleep", () => {
  test("skips the timer for a zero delay or an aborted signal", async () => {
    let timers = 0;
    const abort = new AbortController();
    abort.abort();
    await cancellableSleep(0, undefined, () => {
      timers += 1;
      return () => undefined;
    });
    await cancellableSleep(50, abort.signal, () => {
      timers += 1;
      return () => undefined;
    });
    expect(timers).toBe(0);
  });

  test("settles once and cancels the timer, whichever side fires first", async () => {
    const timerCallbacks: Array<() => void> = [];
    let cancels = 0;
    const setTimer = (callback: () => void): (() => void) => {
      timerCallbacks.push(callback);
      return () => {
        cancels += 1;
      };
    };

    const abort = new AbortController();
    const aborted = cancellableSleep(50, abort.signal, setTimer);
    abort.abort();
    await aborted;
    expect(cancels).toBe(1);

    const fired = cancellableSleep(50, undefined, setTimer);
    timerCallbacks.at(-1)?.();
    await fired;
    expect(cancels).toBe(2);
    // A late abort after the timer already fired must not cancel twice.
    abort.abort();
    expect(cancels).toBe(2);
  });
});

describe("recovery wiring", () => {
  const fast = { recoveryBackoffBaseMs: 1, recoveryBackoffMaxMs: 1 };
  const NOTICE_PREFIX = "Recovering after an upstream error:";

  async function activated(rawSettings: Record<string, unknown>): Promise<Harness> {
    const harness = createHarness();
    activate(harness.pi, async () => rawSettings);
    await harness.emit("session_start", { type: "session_start" }, harness.context());
    return harness;
  }

  /** Notices this module shows, ignoring other modules' diagnostics. */
  function recoveryNotices(harness: Harness): Array<{ message: string; level: string }> {
    return harness.notifications.filter((entry) => entry.message.startsWith(NOTICE_PREFIX));
  }

  async function emitStop(
    harness: Harness,
    overrides: StopOverrides = {},
  ): Promise<SessionStopEventResult | undefined> {
    const results = await harness.emit(
      "session_stop",
      stopEvent({ error: assistantMessage(TRANSIENT_ERROR), ...overrides }),
      harness.context(),
    );
    return results.at(-1) as SessionStopEventResult | undefined;
  }

  test("registers the stop hook when enabled and reports one attempt", async () => {
    const harness = await activated(fast);
    expect(harness.handlers.get("session_stop")).toHaveLength(1);
    expect(harness.handlers.get("agent_start")).toHaveLength(1);
    expect(harness.handlers.get("session_shutdown")).toHaveLength(1);
    expect(harness.handlers.get("session_switch")).toHaveLength(1);

    const result = await emitStop(harness);
    expect(result).toEqual({ continue: true, additionalContext: RECOVERY_CONTINUATION_CONTEXT });
    expect(recoveryNotices(harness)).toEqual([
      { message: "Recovering after an upstream error: attempt 1, waiting 1 ms", level: "info" },
    ]);
  });

  test("recovers consecutive runs that each fail on their first turn", async () => {
    // Exactly what the host does: `agent_start` per run, turn ids restarting at 0.
    const harness = await activated(fast);
    const results: boolean[] = [];
    for (let index = 1; index <= 3; index++) {
      await harness.emit("agent_start", { type: "agent_start" }, harness.context());
      const result = await emitStop(harness, { turnId: 0, stopHookActive: index > 1 });
      results.push(result?.continue === true);
    }
    expect(results).toEqual([true, true, true]);
    expect(recoveryNotices(harness)).toHaveLength(3);
  });

  test("registers nothing when the module switch, master switch, or keys are off", async () => {
    const disabled = await activated({ ...fast, recoveryEnabled: false });
    expect(disabled.handlers.get("session_stop")).toBeUndefined();
    expect(disabled.handlers.get("agent_start")).toBeUndefined();
    expect(await emitStop(disabled)).toBeUndefined();

    const master = await activated({ ...fast, enabled: false });
    expect(master.handlers.get("session_stop")).toBeUndefined();

    const invalid = await activated({ ...fast, recoveryMaxAttempts: 0 });
    expect(invalid.handlers.get("session_stop")).toBeUndefined();
    expect(invalid.warnings.filter((warning) => warning.includes("recovery stays inactive"))).toHaveLength(1);
  });

  test("counts a host-marked continuation chain up to the cap", async () => {
    const harness = await activated({ ...fast, recoveryMaxAttempts: 2 });
    expect((await emitStop(harness))?.continue).toBe(true);
    expect((await emitStop(harness, { turnId: 2, stopHookActive: true }))?.continue).toBe(true);
    expect(await emitStop(harness, { turnId: 3, stopHookActive: true })).toBeUndefined();
    expect(recoveryNotices(harness).map((entry) => entry.message)).toEqual([
      "Recovering after an upstream error: attempt 1, waiting 1 ms",
      "Recovering after an upstream error: attempt 2, waiting 1 ms",
    ]);
  });

  test("ends its chain when the host reports a normal settle pass", async () => {
    // Another stop hook can continue the same host cycle. This module must not
    // carry the spent budget into the next error it sees.
    const harness = await activated({ ...fast, recoveryMaxAttempts: 1 });
    expect((await emitStop(harness, { turnId: 0 }))?.continue).toBe(true);

    const settled = await harness.emit(
      "session_stop",
      stopEvent({ turnId: 1, stopHookActive: true, error: null }),
      harness.context(),
    );
    expect(settled.at(-1)).toBeUndefined();

    await harness.emit("agent_start", { type: "agent_start" }, harness.context());
    expect((await emitStop(harness, { turnId: 0, stopHookActive: true }))?.continue).toBe(true);
    expect(recoveryNotices(harness)).toHaveLength(2);
  });

  test("stays native for an error the configured mode does not recover", async () => {
    const harness = await activated({ ...fast, recoveryMode: "knownTransient" });
    const results = await harness.emit(
      "session_stop",
      stopEvent({ error: assistantMessage({ errorStatus: 500, errorMessage: "boom" }) }),
      harness.context(),
    );
    expect(results.at(-1)).toBeUndefined();
    expect(recoveryNotices(harness)).toEqual([]);
  });

  test("defaults match the shipped manifest", () => {
    expect(SETTINGS_DEFAULTS.recoveryEnabled).toBe(true);
    expect(SETTINGS_DEFAULTS.recoveryMode).toBe("knownTransient");
    expect(SETTINGS_DEFAULTS.recoveryMaxAttempts).toBe(8);
    expect(SETTINGS_DEFAULTS.recoveryBackoffBaseMs).toBe(1000);
    expect(SETTINGS_DEFAULTS.recoveryBackoffMaxMs).toBe(8000);
    expect(SETTINGS_DEFAULTS.recoveryNotify).toBe(true);
  });
});
