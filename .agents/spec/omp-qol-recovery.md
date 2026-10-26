# QoL error recovery

## Goals

Continue eligible interrupted main-session work without a new user message. This adjustment follows the component-wide configuration, activation, status, and isolation requirements.

## Out of scope

- Changing native in-turn retries, provider selection, the host error classifier, or subagent recovery.
- Matching provider error prose, recovering every error, exactly-once tool execution, rollback, or idempotent continuation.

## Public surface

### Configuration

| Key | Default |
| --- | --- |
| `recoveryEnabled` | `true` |
| `recoveryMode` | `knownTransient` |
| `recoveryMaxAttempts` | `8` |
| `recoveryBackoffBaseMs` | `1000` |
| `recoveryBackoffMaxMs` | `8000` |
| `recoveryNotify` | `true` |

`recoveryMode` accepts only `knownTransient` and `unclassified`. `recoveryMaxAttempts` is an integer from 1 through 8.

`recoveryBackoffBaseMs` is an integer from 1 through 10000. `recoveryBackoffMaxMs` is an integer greater than the base and at most 10000.

### Status

The `/qol` recovery line shows mode, attempt limit, base, cap, and notification setting.

### Error recovery

Recover only a main-session run whose last assistant message has `stopReason: "error"`, including errors remaining after native retries. Successful output quoting an error is ordinary output. Missing required recovery interfaces or disabled switches preserve native behavior. Do not alter the original assistant error.

`knownTransient` accepts host-classified `Transient` or `Timeout` errors, `stopDetails.type` equal to `stream_interrupted_after_content`, and errors with neither HTTP status nor a classification. Unclassified means host error id zero or outside its class mask. A statusless unclassified error needs no interruption mark. `unclassified` accepts transient or timeout errors and all unclassified errors, subject to the same exclusions; an interruption mark does not broaden that mode.

Both modes exclude content blocked, user interrupt, abort, silent abort, authentication failure, OAuth expiry, usage limit, account policy, context overflow, payload rejected, grammar rejection, unsupported mode, thinking loop, stale responses item, and deterministic tool JSON. HTTP 4xx statuses except 408 and 429 are terminal. Exclusions and terminal statuses win over modes and interruption marks.

With default switches and mode, the following assistant error is eligible through its host fields unless cancellation, an exclusion, a terminal status, or either cap prevents continuation:

```text
Error: Upstream provider closed the connection before the response completed: stream ended without terminal event or completed response
```

Continue in the same main session without a new user message. For attempt numbers starting at 1, wait `min(base × 2^(attempt - 1), max)` milliseconds. The per-chain budget and backoff survive model-run boundaries. The host's independent cap of 8 continuations still applies. Only a continuation actually requested by this module consumes an attempt. Duplicate stop events for the same run and turn add neither a delay nor a continuation.

Normal completion, an out-of-scope error, or cancellation ends the chain. A later independent chain starts with a fresh budget. Another stop hook's continuation does not inherit this module's exhausted budget. A new run, session switch, shutdown, or invalidated chain prevents an old delayed continuation. Esc during the delay cancels it without consuming an attempt. Enabled notifications show one warning with the attempt and delay for each continuation.

Use this fixed continuation text, without provider error bodies, commands, or tool output:

```text
The previous turn was interrupted by an upstream transport error, so its work may be incomplete. Check what already exists and what side effects already happened, then continue the task from there. Do not redo work that is already done.
```

This is a new continuation turn, not byte-for-byte replay of the failed request. It re-sends conversation context and consumes provider quota. Completed side effects remain and may be repeated; previously unexecuted calls may run. OMP continues to own history, scheduling, and approvals. Keep the original error in history and use the host's hidden continuation context rather than adding a user request.

## Acceptance criteria

- A real maintained OMP CLI session demonstrates eligible stream-error continuation with default recovery settings, in the same main session and without an intervening user message. Native retries or an enabled status alone do not establish it. The same fault with recovery disabled produces no QoL continuation. A real TUI shows the attempt and delay; cancellation prevents continuation.
- Both modes decide eligibility from the error's host fields, with exclusions and terminal statuses taking precedence. Marked and unmarked statusless errors follow their mode's eligibility without matching error prose.
- Continuations obey the independent caps and configured backoff across runs in one chain. Duplicate events add no delay or continuation, and a later independent chain receives a fresh budget.
- Disabled recovery and invalidated delays produce no continuation. Enabled notifications report the attempt and delay; continuation preserves the original error and uses only the fixed context above.
