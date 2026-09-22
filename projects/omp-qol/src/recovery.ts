/**
 * Error-recovery module.
 *
 * When a main-agent turn settles with an assistant error that is a known
 * transient transport or timeout failure, the module asks the host for one more
 * model turn with a fixed continuation context. Two further cases count as
 * interrupted work in the default scope: the host's own mark for a stream that
 * died with a tool call in flight, and an error that carries neither an HTTP
 * status nor a classifier verdict. The module never resends a request, re-runs
 * a tool, edits the journal, or switches providers: it only asks for a turn,
 * and the host's own continuation cap still applies.
 */

import type { Api } from "@oh-my-pi/pi-ai";
import { classifyMessage, Flag, is, isTransientStatus } from "@oh-my-pi/pi-ai/error";
import type { SessionStopEvent, SessionStopEventResult } from "@oh-my-pi/pi-coding-agent";
import type { ModuleContext, ModuleState } from "./extension.ts";
import type { RecoveryMode, RecoverySettings } from "./settings.ts";

/** Fixed continuation text: no error body, no command, no tool output. */
export const RECOVERY_CONTINUATION_CONTEXT =
  "The previous turn was interrupted by an upstream transport error, so its work may be incomplete. " +
  "Check what already exists and what side effects already happened, then continue the task from there. " +
  "Do not redo work that is already done.";

/** Fixed exclusions: none of these is recovered in either mode. */
const SAFETY_EXCLUSIONS: ReadonlyArray<readonly [Flag, string]> = [
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

/**
 * Value the host writes into `stopDetails.type` when a provider error cut a
 * turn short after content or tool arguments had already streamed
 * (`STREAM_INTERRUPTED_AFTER_CONTENT_STOP_DETAIL` in `@oh-my-pi/pi-agent-core`).
 * The value is compared rather than imported, so a host that renames or drops
 * it simply matches nothing and the error keeps its native outcome.
 */
const STREAM_INTERRUPTED_AFTER_CONTENT = "stream_interrupted_after_content";

/**
 * The stop details the host attaches to a settled message. The module reads the
 * `type` only; the host owns the vocabulary.
 */
export interface RecoveryStopDetails {
  type?: string;
  category?: string | null;
  explanation?: string | null;
}

/** The assistant-error fields a recovery decision reads. */
export interface RecoveryErrorInput {
  api?: Api;
  provider?: string;
  model?: string;
  errorId?: number;
  errorMessage?: string;
  errorClassificationMessage?: string;
  errorStatus?: number;
  stopDetails?: RecoveryStopDetails | null;
}

/** Outcome of classifying one final assistant error. */
export interface RecoveryDecision {
  retry: boolean;
  /** Bounded reason code; never contains provider text. */
  reason: string;
}

/** One session's recovery chain. */
export interface RecoveryChain {
  sessionId: string | undefined;
  /** Continuations this module actually returned in the current chain. */
  attempts: number;
  /**
   * Turn already handled in this session, together with the agent run that
   * produced it. The host resets its turn counter at every `agent_start`, so a
   * bare turn id cannot tell a repeated callback from the first turn of the
   * next run: run `n` and run `n + 1` both report `turn_id = 0`.
   */
  handledTurn: { run: number; turnId: number } | undefined;
  /** Agent runs seen in this session; every `agent_start` advances it. */
  run: number;
  /** Bumped whenever a chain resets; invalidates waits already in flight. */
  generation: number;
}

export function createRecoveryChain(): RecoveryChain {
  return { sessionId: undefined, attempts: 0, handledTurn: undefined, run: 0, generation: 0 };
}

/**
 * The assistant message one settle pass ended on, or undefined when that turn
 * did not end in an error. A settle pass whose last message is anything else
 * (a tool result, a user turn, a healthy assistant turn) is left native.
 */
export function finalErrorMessage(event: SessionStopEvent): RecoveryErrorInput | undefined {
  const candidate = event.last_assistant_message ?? event.messages.at(-1);
  if (candidate === undefined || candidate.role !== "assistant") return undefined;
  if (candidate.stopReason !== "error") return undefined;
  return candidate;
}

/**
 * Whether one final assistant error is worth a continuation turn.
 *
 * The host's own retry layer recovers other classes too; this module does not
 * reuse that set, so quota, thinking loops, and stale Responses state stay with
 * the flows that own them.
 */
export function evaluateRecoveryMessage(message: RecoveryErrorInput, mode: RecoveryMode): RecoveryDecision {
  // `classifyMessage` writes `errorId` into the object it is given, so classify a copy.
  const copy = { ...message };
  const id = classifyMessage(copy);
  for (const [flag, reason] of SAFETY_EXCLUSIONS) {
    if (is(id, flag)) return { retry: false, reason };
  }

  const status = numericStatus(copy, id);
  if (status !== undefined && status >= 400 && status < 500 && !isTransientStatus(status)) {
    return { retry: false, reason: "terminal-client-status" };
  }

  if (is(id, Flag.Transient)) return { retry: true, reason: "transient" };
  if (is(id, Flag.Timeout)) return { retry: true, reason: "timeout" };

  // Stream-drop wording needs no separate text check: the classifier that owns
  // it sets `Flag.Transient` for exactly the phrases this module would match.
  //
  // Two interruptions the classifier leaves unmarked count as interrupted work
  // in the default scope: the host's own mark for a stream that died with a
  // tool call in flight, and an error carrying neither a status nor a verdict.
  // Both read host structure, never provider text, and the exclusions and the
  // terminal-status rule above still win over either. `unclassified` keeps its
  // own definition and gains nothing here.
  if (mode === "knownTransient") {
    if (message.stopDetails?.type === STREAM_INTERRUPTED_AFTER_CONTENT) {
      return { retry: true, reason: "stream-interrupted" };
    }
    if (status === undefined && (id === 0 || !is(id, Flag.Class))) {
      return { retry: true, reason: "statusless-unclassified" };
    }
  }

  // `unclassified` widens to errors carrying no classification at all — an
  // unparsed status or no signal whatsoever — and never to a classified kind.
  if (mode === "unclassified" && (id === 0 || !is(id, Flag.Class))) {
    return { retry: true, reason: "unclassified" };
  }

  return { retry: false, reason: "not-known-transient" };
}

function numericStatus(message: RecoveryErrorInput, id: number): number | undefined {
  if (typeof message.errorStatus === "number") return message.errorStatus;
  return id !== 0 && !is(id, Flag.Class) ? id : undefined;
}

/** Attempt `n` waits `min(baseMs * 2 ** (n - 1), maxMs)`. */
export function recoveryDelayMs(attempt: number, recovery: RecoverySettings): number {
  if (attempt <= 1) return Math.min(recovery.backoffBaseMs, recovery.backoffMaxMs);
  const grown = recovery.backoffBaseMs * 2 ** (attempt - 1);
  return Math.min(Number.isFinite(grown) ? grown : recovery.backoffMaxMs, recovery.backoffMaxMs);
}

/** A cancellable wait; an aborted signal settles it immediately. */
export function cancellableSleep(
  ms: number,
  signal: AbortSignal | undefined,
  setTimer: (callback: () => void, ms: number) => () => void,
): Promise<void> {
  if (signal?.aborted === true || ms <= 0) return Promise.resolve();
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      cancel();
      signal?.removeEventListener("abort", finish);
      resolve();
    };
    const cancel = setTimer(finish, ms);
    signal?.addEventListener("abort", finish, { once: true });
  });
}

/** Seams the recovery chain needs from the host. */
export interface RecoveryDeps {
  settings: RecoverySettings;
  /** Resolve after `ms` or when `signal` aborts, whichever comes first. */
  sleep: (ms: number, signal: AbortSignal | undefined) => Promise<void>;
}

/** One recovery chain's decisions and bookkeeping. */
export interface RecoveryController {
  chain: RecoveryChain;
  /**
   * Start of a new agent run, as the host reports it through `agent_start`.
   *
   * The chain's attempt budget survives: the host's own continuation cap and
   * this module's `recoveryMaxAttempts` count continuations across runs. What
   * the new run does invalidate is the handled-turn marker of the previous run
   * and any wait that has not returned yet.
   */
  startRun(): void;
  /** Decide one settle pass; undefined means "stay native". */
  handleStop(event: SessionStopEvent, notify?: (message: string) => void): Promise<SessionStopEventResult | undefined>;
  /** Drop everything: session switch or shutdown. */
  reset(): void;
}

export function createRecoveryController(deps: RecoveryDeps): RecoveryController {
  const chain = createRecoveryChain();

  /** End the current continuation chain, keeping the handled-turn guard. */
  const endChain = (): void => {
    chain.attempts = 0;
    chain.generation += 1;
  };

  const reset = (): void => {
    chain.sessionId = undefined;
    chain.handledTurn = undefined;
    endChain();
  };

  return {
    chain,
    reset,

    startRun(): void {
      chain.run += 1;
      // A wait for a settle pass of the previous run is stale.
      chain.generation += 1;
    },

    async handleStop(event, notify): Promise<SessionStopEventResult | undefined> {
      // A settle pass the host cancelled ends the chain: no continuation this
      // module requested is still in flight.
      if (event.signal.aborted) {
        endChain();
        return undefined;
      }
      const message = finalErrorMessage(event);
      const decision = message === undefined ? undefined : evaluateRecoveryMessage(message, deps.settings.mode);

      // A different session starts over; so does a fresh stop cycle, which the
      // host marks by clearing `stop_hook_active` after a chain ends.
      if (chain.sessionId !== event.session_id) {
        chain.sessionId = event.session_id;
        chain.handledTurn = undefined;
        endChain();
      }
      // Only a continuation this module requested keeps the chain alive. A turn
      // that settled on its own, and an error this module never recovers, both
      // end it, so a chain another stop hook continues starts from zero.
      if (message === undefined || decision?.retry !== true) {
        endChain();
        return undefined;
      }
      // A repeated callback for a turn already handled in this same run changes
      // nothing. The run is part of the key because turn ids restart at zero.
      if (chain.handledTurn?.run === chain.run && chain.handledTurn.turnId === event.turn_id) return undefined;
      if (event.stop_hook_active === false) endChain();
      if (chain.attempts >= deps.settings.maxAttempts) return undefined;

      const attempt = chain.attempts + 1;
      const delayMs = recoveryDelayMs(attempt, deps.settings);
      const generation = chain.generation;
      const run = chain.run;
      const sessionId = event.session_id;
      // Claim the turn before waiting: a repeated callback for this turn must
      // neither wait again nor consume budget.
      chain.handledTurn = { run, turnId: event.turn_id };
      if (deps.settings.notify) {
        notify?.(`Recovering after an upstream error: attempt ${attempt}, waiting ${delayMs} ms`);
      }

      if (delayMs > 0) {
        await deps.sleep(delayMs, event.signal);
        if (event.signal.aborted) {
          endChain();
          return undefined;
        }
        if (chain.generation !== generation || chain.run !== run || chain.sessionId !== sessionId) return undefined;
      }

      // Only a returned continuation counts.
      chain.attempts = attempt;
      return { continue: true, additionalContext: RECOVERY_CONTINUATION_CONTEXT };
    },
  };
}

/** Register the stop hook when recovery is enabled. */
export function installRecoveryModule(context: ModuleContext): ModuleState {
  const recovery = context.settings.recovery;
  if (!recovery.enabled) return { status: "disabled", reason: "recovery-disabled" };

  const controller = createRecoveryController({
    settings: recovery,
    sleep: (ms, signal) =>
      cancellableSleep(ms, signal, (callback, delay) => {
        const timer = setTimeout(callback, delay);
        return () => clearTimeout(timer);
      }),
  });

  // The host resets its turn counter at every `agent_start`, so this hook is
  // what tells a repeated stop callback from the first turn of the next run.
  context.pi.on("agent_start", () => {
    controller.startRun();
  });
  context.pi.on("session_stop", async (event, ctx) => {
    return await controller.handleStop(event, (message) => {
      try {
        ctx.ui.notify(message, "info");
      } catch {
        // A notice is best effort and must never affect the stop hook.
      }
    });
  });
  context.pi.on("session_shutdown", () => {
    controller.reset();
  });
  context.pi.on("session_switch", () => {
    controller.reset();
  });

  return { status: "enabled" };
}
