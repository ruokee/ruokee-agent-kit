# Adjustments

[中文](./adjustments.zh.md)

What each adjustment changes in OMP, why it is needed, where it attaches, what it costs, and which verification exists. The README carries a short index; this document keeps the evidence.

The development dependency baseline is OMP `18.13.3`, tag `v18.13.3` of [`can1357/oh-my-pi`](https://github.com/can1357/oh-my-pi) at commit [`413d278a87a69b453efabf8d1fedb9940385e8c6`](https://github.com/can1357/oh-my-pi/tree/413d278a87a69b453efabf8d1fedb9940385e8c6). Each adjustment retains its historical source and verification versions. Links carrying commit `5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c` point to OMP `18.2.8`.

## How a version note reads

Each adjustment ends with a version and verification note that separates three things:

- **Source baseline** — the OMP version and commit the mechanism was read against, with the source locations it depends on.
- **Automated checks** — the OMP version the type check and the test suite ran with, and what those tests actually exercise. A test that replaces the host does not prove host behavior.
- **Real OMP CLI** — the OMP version, model, and scenario of an interactive run. Items that have no such run are marked **not verified**; they are not inferred from the peer range, from reading the source, or from another adjustment passing.

Record each adjustment's real CLI or TUI observations in its verification section. Mark every unrun scenario as unverified, including exact-error reproduction, real shortcut delivery, and clipboard writing.

## Continuing waits

### Native behavior

The builtin [`wait`](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/tools/wait.ts) tool has an empty object parameter schema, and one native call is capped at 30 minutes. It returns when a watched job settles, a peer message arrives, a steering interruption occurs, a service reports, no work is waitable, or the native window ends. A window that still watches the session's own jobs has a nonempty `details.jobs` array; an empty array is shared by several other outcomes whose distinction exists only in model-facing text.

With the extension off, the model must issue another call after each native window that ends with the jobs still running.

### Why it is needed

Each empty return costs a model turn: the model reads a result with no new information, resends the conversation, and issues the same call. Native retry settings govern model requests rather than tool waiting, and the builtin entry exposes no configurable total wait deadline.

### Where it attaches

The module requires the builtin `wait` with the recognized empty object parameter structure, re-registers `wait`, and delegates through `ctx.invokeTool`. A missing entry, an entry already replaced by another extension, an unrecognized schema, or a missing host schema builder leaves native behavior in place and produces one bounded reason.

The definition keeps the native name, read approval, essential load mode, strict validation, and interruptibility. It adds one model-visible optional number, `timeout`, meaning the total deadline of that outer call in seconds. The accepted range is finite `(0, 3600]`. Delegated native calls always receive `{}`, so the added parameter is never forwarded to the parameterless builtin.

The definition also declares `handlesToolInterrupt`, matching the native receiver on OMP `18.13.3`. If the scheduler detects a message or background completion before execution, the native wait still receives the call and its interrupted signal. It consumes the available result itself; the extension does not drain a second inbox.

One total-deadline loop with a monotonic clock drives the delegation. It continues only a result marked useless whose details contain a nonempty job array in which every job is still `running`. Messages, settled or absent jobs, errors, interruptions, cancellations, unknown detail shapes, and service frames return after the first native call. The classifier never reads result text.

When the total deadline aborts an in-flight native call, a native result that still arrives wins and is returned unchanged. A rejection becomes a deadline result only after this call's own deadline has elapsed and the failure matches a recognized host abort: `ToolAbortError`, `AbortError`, or the exact `Operation aborted` message of the host's [`ToolAbortError`](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/tools/tool-errors.ts). An unrelated native rejection is thrown unchanged even if the timer has fired. Caller cancellation is checked first and keeps its own reason. Otherwise the wrapper returns the last certain continuation window plus a bounded deadline note, or a minimal note when no such window arrived. One timer exists per outer call and is cleared on every exit path.

### Settings

- `waitEnabled` and `waitContinueEmptyWindows` switch the module and its continuation.
- `waitJobsSeconds` is the default total deadline of one `wait` call; an explicit `timeout` overrides it.
- `waitMessagesSeconds` and `waitProcessSeconds` are retired. Remove them from user and project settings; either leftover rejects the whole QoL configuration as an unknown key. Restart OMP after editing the settings.
- `/qol` reports the effective default and marks message continuation, named-process waiting, and service continuation as `not-applicable` instead of printing unused configured values.

### Side effects

- The module repeats a read-only native call. It starts no background work, cancels no job or process, and consumes no message or result on its own.
- Reaching the deadline ends only the outer wait call. Background jobs and processes keep running. The deadline note points to another `wait` call and to `proc://`, which are routes the host exposes.
- A caller cancellation outranks the component deadline and keeps its reason. A terminal host result wins even when the deadline signal arrived first.

### Cancellation

- Set `waitEnabled` to `false` and restart OMP to restore the native entry directly.

### Limits

- The module does not merge message-only empty windows, provide named-process waits, or merge service-only waits across the native ceiling. It does not simulate them with status polling or host-text classification.
- The eligibility check depends on the builtin source and the empty object parameter structure. The continuation rule depends on `useless`, `details.op`, and the nonempty all-running `details.jobs` shape. A host change can make the module stay inactive or return a window early rather than guessing.
- The module depends on same-name extension precedence and `ctx.invokeTool` reaching the shadowed builtin. A host upgrade requires re-checking those contracts.

### Verification

- **Source baseline**: OMP `18.5.0`, using the [wait tool](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/tools/wait.ts), [job control](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/async/job-control.ts), [extension API](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/extensibility/extensions/types.ts), and [proc protocol](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/internal-urls/proc-protocol.ts).
- **Automated checks**: OMP `18.5.0`, `bun test` and `tsc --noEmit`, with a recording host. They cover the model-visible schema, `{}` delegation across running snapshots, default and explicit deadline selection, the structural continuation rule, terminal outcomes, cancellation, deadline/result races, and registration refusals.
- **Real OMP CLI**: OMP `18.5.1` with a real model and `waitJobsSeconds` `600`. A `wait` call whose input a scenario control fixed to `{}` returned the `600 s` deadline note while a `900 s` background job was still running. A `wait` call with `timeout` `3600` kept waiting across the 30 minute native window and returned the completed `1920 s` job in one call. Message interruption, steering, and cancellation were not rerun on `18.5.x`.
- **Real OMP CLI**: QoL `0.5.11` on OMP `18.12.3`, with a real model and isolated settings. An omitted timeout reached the configured `0.25 s` deadline, an explicit `0.5 s` timeout reached that deadline, and a `60 s` wait received the same background job after it completed in `20 s`. Each retired wait key separately rejected all six modules in `/qol`. A new session kept the activation snapshot; restarting read the changed `0.4 s` default and disabled continuation switch. The wait algorithm was unchanged; the earlier long-window evidence retains its original scope.
- **Controlled host integration**: QoL `0.5.12` on OMP `18.13.3`, using its production scheduler, registered-tool adapter, native wait, and job manager with a controlled model stream. A completed job detected after an earlier exclusive tool caused the old replacement wait to be skipped. With the interrupt-receiver declaration, wait returned the native completed-job payload, consumed it once, and did not replay it on the next call. This scenario made no external model request.
- **Native lifecycle checks**: the same OMP `18.13.3` setup returned a queued session-inbox message and woke on a job completion or a real IRC-bus message during execution. Direct adapter/native-wait checks preserved the caller's cancellation reason and left the job running after cancellation or the total deadline. Job watches and mailbox waiters were released. The queued inbox and model stream were controlled inputs, not a real CLI session.

## Continuing after a transient model error

### Native behavior

A failed provider request is retried inside the turn while the retry budget lasts: `retry.enabled` (default `true`), `retry.maxRetries` (default `10`), `retry.baseDelayMs` (default `500`), and `retry.maxDelayMs` (default `300000`), governed by the turn recovery module ([`packages/coding-agent/src/config/settings-schema.ts:1712`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/config/settings-schema.ts#L1712), budget use at [`packages/coding-agent/src/session/turn-recovery.ts:2203`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/turn-recovery.ts#L2203)). When the budget is exhausted, the turn ends, the assistant message keeps `stopReason: "error"`, and its message text becomes `Retry budget exhausted after N retries: …` ([`turn-recovery.ts:2406`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/turn-recovery.ts#L2406)).

From there the turn stays settled. There is no setting that continues the work after an error, and the host's own bounded turn recovery handles empty stops and unexpected stops, not this case. A user message or a new instruction is what moves the session forward.

The host offers one hook at that moment: before a main-agent turn settles it emits `session_stop` with `messages`, `turn_id`, `last_assistant_message`, `session_id`, `session_file`, `stop_hook_active`, and a `signal` ([`packages/coding-agent/src/extensibility/shared-events.ts:98`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/extensibility/shared-events.ts#L98)). A handler that returns `{continue: true, additionalContext}` queues one hidden continuation turn; the host caps non-`block` continuations at 8 per chain (`SESSION_STOP_CONTINUATION_CAP` at [`packages/coding-agent/src/session/agent-session.ts:399`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/agent-session.ts#L399), enforced at [`agent-session.ts:4274`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/agent-session.ts#L4274)), skips the hook entirely for subagents and when no handler is registered, and gives a handler 30 seconds ([`EXTENSION_HANDLER_TIMEOUT_MS`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/extensibility/extensions/runner.ts#L92)).

With the extension off, a transient failure that outlives the retry budget ends the turn and waits for a human.

### Why it is needed

A 502, a gateway that closes the stream early, or a provider timeout can outlast a retry budget. The work in flight then stops, and continuing costs the user a message and the model its place in the task. Not every such interruption carries a classifier verdict: a stream that dies after a tool call has begun streaming is recorded by the host as an interrupted turn, and some errors arrive with neither an HTTP status nor a phrase the classifier knows.

The information needed to decide is already in the host: it classifies errors with `classifyMessage` and flags such as `Transient` and `Timeout` ([`packages/ai/src/error/flags.ts:20`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/ai/src/error/flags.ts#L20), [`flags.ts:815`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/ai/src/error/flags.ts#L815)) and exposes a status predicate ([`packages/ai/src/error/retryable.ts:20`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/ai/src/error/retryable.ts#L20)). There is no setting and no other public entry point for a turn-level continuation after an error, so the adjustment uses the stop hook the host provides. The host's own salvage branches for a stream that closed early, stalled, or reset all require a retriable id, so an error marked `errorId: 0` stays outside them as well.

### Where it attaches

The extension registers a `session_stop` handler and an `agent_start` handler.

1. Return nothing when the settle signal is already aborted.
2. Take the last assistant message from `last_assistant_message`, or from the end of `messages`, and return nothing unless it is an assistant message with `stopReason: "error"`.
3. Classify a copy of that message with the host classifier and read the result. The module matches no error text itself; the copy keeps the host message untouched.
4. Decide by mode. `knownTransient` accepts errors carrying `Transient` or `Timeout`, an error the host marked as interrupted mid-stream (`stopDetails.type === "stream_interrupted_after_content"`), and an error that reports no HTTP status whose id is `0` or outside the host's class mask. `unclassified` also accepts an error whose id is `0` or outside the host's class mask.
5. Refuse the fixed exclusions in both modes: content blocked, user interrupt, abort, silent abort, authentication failure, OAuth expiry, usage limit, account policy, context overflow, payload rejected, grammar rejection, unsupported mode, thinking loop, stale responses item, deterministic tool JSON, and a client status in the 4xx range except 408 and 429.
6. Apply the chain rules: an event with `stop_hook_active === false` starts a fresh chain, so only the counters reset; a repeated event for the same `turn_id` inside the same agent run is ignored; a session switch ends the chain; a chain that reached `recoveryMaxAttempts` returns nothing.
7. End the chain on every pass that is not a recoverable error: a turn that settled on its own, an error outside the configured scope, a pass whose signal is already aborted, and a wait the signal cancels. Only a continuation this module requests keeps the chain alive, so a chain another stop hook continues starts from zero instead of inheriting a spent budget.
8. Claim the turn, then wait `min(base × 2^(attempt−1), max)` outside the handler's own settling, re-checking the signal, the chain generation, the agent run, and the session afterwards.
9. Return `{continue: true, additionalContext: <fixed text>}`. The attempt counter advances only for a returned continuation.

`agent_start` marks the boundary the stop hook cannot see. The host resets its turn counter there ([`agent-session.ts:4302`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/agent-session.ts#L4302)) and reports `turn_id` as that counter minus one ([`agent-session.ts:4258`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/agent-session.ts#L4258)), and both a submitted prompt and a continuation turn start an agent run ([`agent-loop.ts:611`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/agent/src/agent-loop.ts#L611), [`agent-loop.ts:674`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/agent/src/agent-loop.ts#L674)). Two runs that both fail on their first turn therefore both report `turn_id: 0`, so the dedup key pairs the turn id with the run, and the run counter advances on that hook. A run that starts while a delay is pending discards that delay. The continuation budget itself is never reset by a run boundary: it follows the host's `stop_hook_active` mark, so the host cap and `recoveryMaxAttempts` count a chain across runs.

The continuation text is fixed and states that an upstream error ended the previous turn and that the work should continue. It carries no provider body, no command, and no tool output.

### Settings

`recoveryEnabled`, `recoveryMode`, `recoveryMaxAttempts`, `recoveryBackoffBaseMs`, `recoveryBackoffMaxMs`, `recoveryNotify`; see the README for defaults and accepted values. `notify` prints one warning line per continuation with the attempt number and the delay, which is what makes the delay visible while it happens.

### Side effects

- The adjustment starts a model turn. It re-sends the conversation and spends provider quota.
- The failed turn is not undone. Tool calls that ran before the error keep their effects, and calls from that turn that never ran may run in the continuation.
- The continuation is a hidden custom message. History keeps the assistant error message as it was.
- The host cap of 8 continuations per chain applies independently of `recoveryMaxAttempts`, and the host counts a chain reset when a turn is not part of the active chain.
- Esc during the delay cancels it, and a cancelled delay is not counted as an attempt.
- A `session_stop` handler has 30 seconds. The validated delay range stops at 10 seconds for the doubling bound, so a default or configured delay stays well inside that budget.

### Cancellation

- Cancellation of the adjustment: set `recoveryEnabled` to `false` and restart OMP. The host then never sees a continuation request from this extension.

### Limits

- The module needs `session_stop` with `stop_hook_active`, `turn_id`, `last_assistant_message`, and the continuation result fields, plus the public error classifier. The host skips the hook for subagents, so recovery never applies there.
- Safety exclusions win over the configured mode. A refusal, a quota limit, or a user interrupt cannot be turned into a continuation by configuration.
- The adjustment depends on `stopReason: "error"` marking a failed turn, on the host classifier's verdict, and on two host details: the `stopDetails.type` mark for an interruption and the absence of an HTTP status. All are host behavior that can change. The tests read the classifier and the mark's shape from the installed package, and the mark is compared by value rather than imported, so a host release that renames it narrows the accepted set instead of breaking. A host upgrade needs a re-check.
- A continuation can repeat a side effect. Nothing in the host or this module makes a re-run idempotent.
- The adjustment becomes unnecessary when the host offers a setting that continues a turn after an eligible error, or when a stop hook can be registered with its own retry budget.

### Verification

Reproducing the exact error prose in a new real session is not a development prerequisite.

- **Source baseline**: OMP `18.2.8` at `5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c`. Sources listed above.
- **Automated checks**: OMP `18.5.0`, `bun test` and `tsc --noEmit`, with a recording host. They cover the classification matrix for both modes, the interruption mark with and without a status or a verdict, the statusless condition, the exclusions and the terminal status rule winning over the mark, the continuation of a marked turn, exclusion precedence, the chain and backoff arithmetic, duplicate events for one turn, consecutive runs that each fail on their first turn, a run starting while a delay is pending, a cancelled delay, session switching, the attempt cap across runs, the chain ending on a normal settle pass and on an unrecoverable error, a cancelled pass, the handled-turn marker surviving that end, the fixed continuation text, and no continuation when switches or settings keep recovery inactive. The error classifier is the installed `@oh-my-pi/pi-ai` code, not a stub.
- **QoL `0.5.2`**: a real OMP `18.5.1` TUI run of the complete package displayed `@ruokee/omp-qol 0.5.2` through `/qol`; its runtime matches the candidate labeled `0.6.0` used by the recovery evidence below, and that run did not exercise error recovery.
- **Real OMP CLI**: QoL `0.6.0`, OMP `18.5.1`, a real model, and default recovery settings (`knownTransient`, 8 attempts, 1000 ms base, 8000 ms cap, notifications on). The complete candidate package was loaded explicitly with extension discovery disabled; `/qol` confirmed its version and effective recovery settings. Native retries were not disabled or shortened. A test-only transport wrapper forwarded genuine upstream SSE frames, then closed each failing stream after its first text delta and before a terminal event. Four native failed runs ended with `OpenAI completions stream closed before a finish_reason was received`, `errorId: 135168`, no HTTP status, and no interruption mark. On `session_stop`, QoL displayed attempt 1 and 1000 ms, started the fifth run after 1004 ms without another user message, and received a normal response ending in `STREAM_RECOVERY_OK`. The marker proves continued model output, not exact reconstruction of all numbered lines requested by the test input.
- **Controls on OMP `18.5.1`**: with only `recoveryEnabled` changed to `false`, the same truncation ended after four native failed runs, without a recovery notice or continuation. In a real TUI run with recovery enabled, the attempt and 1000 ms delay were visible. A test driver sent the actual Esc key 202 ms after the notice; the settle signal aborted, and no fifth run or request occurred before session shutdown.
- **Not verified**: a new main-session fault followed by automatic continuation with the exact error `Upstream provider closed the connection before the response completed: stream ended without terminal event or completed response`. A saved subagent failure carried that error with `errorId: 0`, no HTTP status, and no interruption mark; classifying that shape accepts it as statusless unclassified, but saved history and classifier checks do not prove main-session continuation. Subagents remain outside this adjustment. The live runs also did not cover tool side effects, repeated QoL failures to the cap, other provider protocols, or session switching during a real wait.
- **Upstream history**: the stop hook and its continuation cap arrived with `c93774f892` (2026-06-17, "implement session stop hook semantics"); `/reset` semantics changed in `a418920ec1` (2026-08-03), which is why a chain reset after a reset relies on the host's `stop_hook_active` and not on counters alone. The current wording of a retry-exhausted error dates from `f6c5a43a1f` (2026-08-06); the module classifies the error instead of matching that wording.

## Extending one compaction deadline

### Native behavior

A remote compaction request carries a watchdog against the caller's signal: `withRequestTimeout` races the signal with `AbortSignal.timeout(timeoutMs)` ([`packages/agent/src/compaction/openai.ts:237`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/agent/src/compaction/openai.ts#L237), used at [`openai.ts:866`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/agent/src/compaction/openai.ts#L866)) with `REMOTE_COMPACTION_TIMEOUT_MS = 300_000` ([`openai.ts:74`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/agent/src/compaction/openai.ts#L74)), and the V2 streaming path does the same with `V2_COMPACTION_TIMEOUT_MS = 300_000` ([`packages/agent/src/compaction/compaction-v2-streaming.ts:48`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/agent/src/compaction/compaction-v2-streaming.ts#L48), [`compaction-v2-streaming.ts:252`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/agent/src/compaction/compaction-v2-streaming.ts#L252)). A timeout of zero or less disables the watchdog.

Five minutes is a constant. No compaction setting reaches it ([settings keys `compaction.*`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/config/settings-schema.ts#L2502)), and the caller does not choose it per request. A remote compaction slower than five minutes is aborted, and the run falls back instead of finishing that request.

OMP marks the same period for extensions: `auto_compaction_start` with `action: "remote"` ([`packages/coding-agent/src/session/session-maintenance.ts:4134`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/session-maintenance.ts#L4134), emitted at [`session-maintenance.ts:4155`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/session-maintenance.ts#L4155)), `session_before_compact` inside the auto path ([`session-maintenance.ts:4374`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/session-maintenance.ts#L4374)), in `compact()` ([`session-maintenance.ts:1163`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/session-maintenance.ts#L1163)), and in `#compactExperimentalContext()` ([`session-maintenance.ts:1501`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/session-maintenance.ts#L1501)), `session.compacting` when a handler exists ([`session-maintenance.ts:3338`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/session-maintenance.ts#L3338)), `auto_compaction_end`, and `session_compact` after the entry is committed.

With the extension off, the five minutes stand as they are. This is the default.

### Why it is needed

The watchdog exists so a hanging remote compaction does not hang the session, and the fix that added it did exactly that ([`8b8651529d`](https://github.com/can1357/oh-my-pi/commit/8b8651529d), 2026-06-13, "fixed hanging remote compaction requests with request timeouts"). Its cost is a hard cut at a length a slow provider or a large history can exceed, with no setting and no public hook to raise it for one request. The event stream does let an extension see when compaction is running; it does not let an extension change the deadline.

### Where it attaches

The extension replaces `AbortSignal.timeout` with a wrapper that keeps a reference to the native function.

- With no window open, the wrapper calls the native function with the arguments it received, so invalid input keeps its native `TypeError` and every caller behaves as before.
- Inside a window, a call whose `ms` is finite and satisfies `floorMs ≤ ms < timeoutMs` is passed to the native function with `timeoutMs` instead. Any other value passes through, including values above `timeoutMs` and values the native function rejects.
- A window opens on `auto_compaction_start` with `action: "remote"`, on `session_before_compact`, or on `session.compacting`, which also carries the session id the window belongs to.
- The first unaborted `session_before_compact` signal that arrives for the active window is bound to it, whether that window was just created or an auto round or `session.compacting` opened it earlier. A later signal is not bound over it, and the two rules below decide what happens. An already aborted signal closes that window instead of being ignored, and a signal that aborts later closes the window it was bound to. A listener left over from a closed window cannot close a later one, and binding a signal does not extend the guard lease.
- OMP `18.2.8` keeps one compaction operation on one controller: `compact()` uses the controller passed to it ([`session-maintenance.ts:1034`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/session-maintenance.ts#L1034)), emits `session_before_compact` where that method checks its handlers ([`session-maintenance.ts:1163`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/session-maintenance.ts#L1163)), and re-enters itself with the same controller when a method fails with nothing committed and the controller not aborted ([`session-maintenance.ts:1435`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/session-maintenance.ts#L1435)). The signal an extension receives therefore belongs to that operation, and the recursion for a failed method emits the event again with it.
- A repeated `session_before_compact` that carries the signal the window is already bound to is that same operation: a repeated event, or the next method of a serial fallback. The module keeps the window, its kind, session id, generation, guard lease, notice state, and cancel binding. It adds no timer and no second listener, re-binds nothing, and does not extend the guard lease.
- A window that is already bound to a live signal and then receives a different signal is two operations inside one window, and the module stops the experiment with `overlapping-round`. That holds for a window an auto round or `session.compacting` opened first as well.
- A window closes on `auto_compaction_end`, `session_compact`, a session switch, a session shutdown, a cancellation, or the guard timer `compactionWindowGuardMs`, whichever comes first.
- The install is process-wide through a registry held in a global symbol, and it records the activation that installed it, the package version, the activation cwd, and the settings snapshot. Only an install request from that same activation with that same snapshot is idempotent, and only an activation that matches the recorded version and snapshot keeps the patch without installing anything.
- The module refuses to install, with a reason reported through the log and `/qol`, when a marker from an earlier patch of the same host is present at the location this module reads (see the limits below), when the registry slot holds something this version cannot read, when the patch already stopped in this process, when the current `AbortSignal.timeout` is no longer the installed wrapper although the switch is on, when a second activation carries another package version or another settings snapshot, when the switch is off, or when the native function is missing. A refused window event registration restores the native function, reports `registration-error`, and leaves the process installing no patch afterwards.
- A second activation in the same process keeps the installed patch when it asks for the experiment and carries the same package version and the same settings snapshot. It installs no second wrapper, registers no window events, and reports `incompatible` with `patch-owned-elsewhere`: the window belongs to the activation that installed the patch, so only that activation's events open it. While that window is closed this session's compaction runs on the native deadline; while it is open every call in the process whose number matches the range, this session's compaction included, is extended. Keeping the patch is not a conflict and is not reported as one. A second activation with another package version or another snapshot, and one that the master switch, this module's switch, or its keys keep off, still stops the installed patch and reports the reason it stopped with; an activation that is off keeps its own switch state instead of reporting a conflict; that state describes this activation's install, while the `/qol` compaction line always follows the process registry.
- When the activation that installed the patch ends its session, `session_shutdown` closes the window and restores the native function while `AbortSignal.timeout` is still this module's wrapper. The registry keeps a bounded `owner-stopped` state, and the process installs no new patch afterwards: a later matching activation reports that state instead of installing one, so the adjustment returns only with a restarted OMP. A `session_switch` is the same activation serving a new session: it closes the current window and is not an activation exit.
- `/qol` resolves the compaction line from the process registry when the command runs, so a patch that stopped after a session started is reported in every session of the process, and a session never keeps showing `enabled` for a patch that is not rewriting. It explains only a registry this version can read: an unrecognised layout leaves the activation's own refusal standing.
- An activation whose settings could not be read, or were rejected, also stops a recognised patch another activation installed, without installing anything itself. Every module stays off on the values the failure produced; no module is turned on with a default to make that check possible. A registry this version cannot read, and a marker from an earlier patch of the same host, are left as they are.
- An install request from the installing activation with a different settings snapshot stops the installed patch with `config-conflict`, because settings are read once per activation and a changed snapshot means the effective settings are no longer the ones the patch was built from.
- Closing an off-switch restores the native function only if the current value is still this module's wrapper, and reports when it is not.
- Overlapping windows, a second live signal inside the window, a window for another session, or an event order the module does not recognize disable the experiment for the process and report the reason.

### Settings

`compactionTimeoutEnabled` (off by default), `compactionTimeoutMs`, `compactionTimeoutFloorMs`, `compactionWindowGuardMs`, `compactionTimeoutNotify`; see the README for defaults and accepted values. `notify` prints one line the first time a window rewrites a deadline, and never repeats it inside the same window.

### Side effects

- The patch is process-wide. Every caller of `AbortSignal.timeout` in the process whose argument falls in the rewritten range during a window gets the longer deadline, not only the compaction request. This is the accepted price of the experiment, and the reason the default is off. It is visible without compaction: a matching call from any other code in the process changes too while a window is open.
- It can only lengthen a deadline. A value below the floor and a value at or above `compactionTimeoutMs` are untouched, so the adjustment never shortens a wait.
- The floor is an expert setting. The inspected compaction paths pass exactly `300000` ms, so a floor above that value stops the compaction request itself from matching and the experiment no longer extends it; `/qol` states this when the effective floor is that high.
- The wrapper is installed while the patch is running and its owner has not exited, and is inert outside a window. A refused registration and the owner's exit both restore the native function. The guard bounds how long a window can stay armed when its closing event never arrives.
- The window is opened from events, so it can cover calls made by unrelated work during that period, for example a provider request that happens to use a matching timeout.
- Registering `session_before_compact` changes what the host does with its speculative compaction, because the host treats any handler of that event as an interceptor. In OMP `18.2.8` the handler's presence disables three things: a speculative run is not started ([`session-maintenance.ts:1982`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/session-maintenance.ts#L1982)), the threshold is not deferred to a speculation that is already running ([`session-maintenance.ts:2042`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/session-maintenance.ts#L2042)), and an armed speculation is not consumed ([`session-maintenance.ts:2251`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/session-maintenance.ts#L2251)). The host states its reason in the first of those places: a speculated result would bypass an interceptor's veto. The consequence for this adjustment is that enabling it gives up speculative compaction, so a compaction that would have been prepared in the background runs in the foreground and the session may wait for it. That is why the module registers the handler only while `compactionTimeoutEnabled` is on: with the default off, no handler is registered and the host's compaction scheduling is untouched. The module needs that hook because its `signal` is the cancellation entry point of a manual compaction.

### Cancellation

- Cancellation of the adjustment: set `compactionTimeoutEnabled` to `false` and restart OMP, or restart without the extension. Nothing is written to disk and nothing survives the process.

### Limits

- One process hosts one wrapper, owned by the activation that installed it, and only that activation's events open the window the wrapper rewrites in. A second activation with the same version and snapshot keeps the patch and reports `patch-owned-elsewhere` without driving the window; one that carries another snapshot stops the patch instead. Two sessions in one process therefore do not both drive the experiment.
- The module depends on `AbortSignal.timeout` being writable and configurable, on the native function throwing `TypeError` for invalid input, and on the compaction paths using `AbortSignal.timeout` for their watchdog. Rewriting those paths to build their own signal, or to configure the timeout another way, makes the patch ineffective. A host upgrade requires re-checking those contracts.
- Extension-visible events do not carry the request that will be timed, and a window is a period rather than a request. The module cannot promise that a rewritten call belongs to compaction, and it says so instead of guessing when events conflict.
- The experiment is unnecessary once the host exposes a request-level compaction timeout or passes the timeout down as a parameter.
- Values this module does not control: the deadline stays a single signal's deadline, not the total time of retries and fallbacks, and a compaction that needs more than the raised deadline is cut off as before. The module also does not control the host's speculative compaction, which the `session_before_compact` registration turns off.
- The earlier-patch refusal guards the marker this module reads, the one on `globalThis`. The legacy compaction extension written for older hosts puts that marker on `AbortSignal` instead, so a real legacy extension is not refused: with both loaded, this module installs its wrapper over the legacy one, and at shutdown it restores the legacy wrapper rather than the native function. Two adjustments stack where the refusal was meant to stop two of them sharing one global. Treat the protection against a real legacy extension as unverified: the automated checks cover only a stand-in that writes the marker where this version looks for it.

### Verification

- **Source baseline**: OMP `18.2.8` at `5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c`. Sources listed above.
- **Automated checks**: OMP `18.5.0`, `bun test` and `tsc --noEmit`, with a recording host and `AbortSignal.timeout` replaced by a recorder that delegates invalid input to the native function. They cover install order and every refusal reason (the earlier-patch marker case writes that marker where this version reads it; see the limits), idempotent install and release, a second activation keeping the installed patch (another cwd, no window events registered, the owner's window still rewriting deadlines, a call outside that window native and inside it extended, no conflict reported), a second activation stopping the installed patch (another snapshot, another package version, this module's switch off, the master switch off, invalid keys), a stopped patch staying stopped for a later matching activation, the owner's exit (window closed, the native function restored only while the global is still this module's wrapper, `owner-stopped` left in the registry, a later matching activation reporting it and installing nothing, a session switch closing only the window), `/qol` reporting the registry state after a later stop, a changed settings snapshot in the installing activation, a registry slot this version cannot read, a settings reader that throws, a settings root that is not an object, an unknown key, an invalid master switch, the rewrite range, `TypeError` behavior for invalid input, one notice per window, the process-level effect on a caller that is not compaction, one compaction operation whose methods fall back in series on one signal (window, kind, session id, guard lease and notice state kept, one listener, rewriting continuing until the commit, and a later operation starting fresh), the same for windows an auto round or `session.compacting` opened first, a different live signal inside one window, an auto round that starts again while one is open, window opening from each event, a before-compact signal bound to a window that was already open, a signal that already aborted, a stale listener, closing from guard, cancel, abort, switch, and shutdown, overlap and foreign-session refusal, restore-after-replacement, and the `/qol` report for a refused window registration and for a registry layout this version cannot read. A real OMP CLI run cannot replace these checks.
- **Real OMP CLI**: OMP `18.5.1` with a real model and `compactionTimeoutEnabled` on; `/qol` reported `compaction: enabled` with the configured deadline, floor, and guard values in two sessions. No compaction ran in those sessions, so a deadline rewrite and the fallback sequence are **not verified** on a supported host.
- **Upstream history**: the remote watchdog arrived with `8b8651529d` (2026-06-13), and V2 streaming compaction with `102d6d54ad` (2026-06-28), which duplicated the watchdog with its own constant. Both are older than the baseline; no commit changing the five minutes up to the baseline has been located.

## Replaying native history in a resumed session

QoL `0.5.13` retires this adjustment. OMP `18.13.3` initializes Responses replay from the model's `connectionBoundNativeHistory` policy and clears it on `close()` ([provider state](https://github.com/can1357/oh-my-pi/blob/413d278a87a69b453efabf8d1fedb9940385e8c6/packages/ai/src/providers/openai-responses.ts#L466-L496)). Ordinary models replay stored native items on their first resumed request. Connection-bound models start cold, and closed states rebuild generic assistant content. The host keeps its native exceptions for cold-replayable reasoning and user-owned compaction history.

QoL leaves those decisions and the session history to OMP. It installs no `Map.prototype.set` wrapper, changes no replay flag, and exposes no replay setting or status line. Remove `replayEnabled` from user and project settings and restart OMP; a leftover key rejects the whole QoL configuration under the existing unknown-key rule.

Controlled HTTP verification on official OMP `18.13.3` loaded QoL `0.5.13` into four SDK sessions restored from files. Eight requests covered ordinary and connection-bound first requests, warming after a successful response, independent sessions, and both model types after `close()`. Final HTTP bodies followed the native policy; closing one session left its neighbor unchanged, and original session entries stayed intact. The local endpoint supplies transport evidence, not a provider cache measurement.

### Historical evidence

The retired wrapper was based on OMP `18.2.8`, whose initial replay flag was always false. A paired real-model run on OMP `18.2.4` reported `17,920` cached and `2,971` uncached input tokens after rebuilding, compared with `19,968` cached and `1,002` uncached after replay. The replayed request retained the previous request's first four items byte for byte, including reasoning. With fewer than about `500` replayable tokens, both arms reported `17,920` cached tokens. These are measurements of the retired implementation on that host, not gains attributed to the native `18.13.3` policy.

The old automated checks used OMP `18.5.0`. A real OMP `18.5.1` CLI run observed `replay: enabled (rewrites=0)` only in new sessions; it did not measure resumed-session cache use. The retired wrapper did not validate official OpenAI storage and response chaining, Codex Responses, resume after `/clear`, interactive takeover, or post-compaction rebuilding.

## Task argument cleanup

### Native behavior

OMP 18.11.3 exposes `sourceSession` and `model` on every `task` item when the session advertises the `seance` agent. [`validateSeanceFields`](https://github.com/can1357/oh-my-pi/blob/v18.11.3/packages/coding-agent/src/task/seance.ts) rejects any present value when the resolved agent is not `seance`, because it compares against `undefined` rather than checking for a meaningful value. A model that treats optional fields as inputs can send `""`, `/dev/null`, or a model name and fail the whole call before dispatch. The host validates the batch before dispatch; with speculative task launch active, subagents already started from closed items are discarded.

The task schema depends on whether `seance` is available. Without `sourceSession`, `model` is an ordinary selector and must remain intact. OMP `18.5.0` supplied that shape; the capability check remains relevant on `18.13.3` and is not a version gate.

### Where it attaches

The module registers a `tool_call` handler for the built-in `task` tool and returns `{ input }` only when it changed the call. The host uses the returned input for display, persistence, and execution. The handler copies only changed items; the task schema, description, approval policy, dispatch path, and result rendering stay native.

OMP denies speculative task launch and experimental read speculation when an extension registers a `tool_call` handler. The module therefore makes `task.speculativeLaunch` ineffective while enabled, including for calls without the two fields. It does not change the host setting, and turning the module off restores the native behavior at the next activation.

Before installing the handler, the module reads the built-in task schema. It registers nothing when the schema does not expose `sourceSession`.

### Settings

`taskArgsEnabled` (on by default); see the README for the accepted values. The master switch must also be on. The module is active only when the built-in task schema exposes `sourceSession`.

### Cleanup rule

A flat call is one item; a `tasks` array is a batch. For each item whose `agent` is a string, trims non-empty, and is not `seance`, the handler deletes that item's own `sourceSession` and `model`, whatever their values. Items with a missing, empty, whitespace, non-string, or `seance` agent are unchanged. Batch-level fields, non-object items, and every other argument keep their value and structure. A batch that changes several items counts as one rewritten call; `/qol` reports the count for the current activation.

### Availability

The handler is installed only for a built-in `task` whose schema exposes `sourceSession`. A missing tool reports `unavailable`, a shadowed tool reports `incompatible`, the module switch off reports `disabled`, and the master switch off also reports `disabled`. A built-in task schema without `sourceSession` reports `unavailable` with `task-tool-without-seance-fields`, preserving the ordinary `model` selector and leaving speculative launch in place. An invalid `taskArgsEnabled` disables only this module. The module does not change the task schema or the host's validation; a call that remains invalid for another reason still fails.

### Limits

- The module only removes the two fields from properly identified non-seance items. It does not infer a default agent, repair a batch-level field, or add model-visible guidance. Calls with no usable agent and calls with batch-level fields keep native validation.
- The handler covers every `task` call in the session that registers it. While it is registered, every such call loses speculative launch, not only calls that carry the fields. This is the accepted cost; the module cannot enable launch for the calls it leaves untouched. A schema without `sourceSession` registers no handler, so that cost does not apply there. If the host later accepts the fields or stops exposing them, the handler still costs the same until disabled or retired.
- A host that exposes `sourceSession` while also giving ordinary agents a legitimate `model` selector would lose that choice; the current 18.11.3 seance schema does not. A schema with only the ordinary `model` selector is left unavailable and unchanged. A host that renames or re-scopes the fields requires a new review.
- When several extensions return `input` for one call, the host uses the last result; this module can overwrite or be overwritten by another revision.
- The module adds no session entry of its own and does not rewrite earlier history. The host persists the revised arguments in the current assistant message, so later requests and the session file observe them. It removes arguments, so a model's mistake can stay invisible except for the `/qol` counter.

### Verification

- **Source baseline**: OMP `18.11.3`, tag `v18.11.3`, commit `96894a6147d8cc64b7e00ad3a7d7178fd93b9531`. The OMP `18.5.0` pinned development types show the ordinary `model` selector and no `sourceSession`; that shape is covered by a test fixture.
- **Automated checks**: OMP `18.5.0` development types, `bun test` and `tsc --noEmit`. The tests cover a flat call, batch items, seance preservation, missing/empty/whitespace/non-string agents, absent target fields, abnormal task shapes, rewrite counting, the built-in guard, the flat and batch seance schema shapes, a model-only schema without `sourceSession`, disabled and incompatible states, and the off switch.
- **Real OMP CLI**: OMP `18.11.3` with `gpt-6-luna` and the `ds-flash` preset. A batch call whose only item named `agent: "ds-flash"` and carried `sourceSession` and `model` dispatched successfully after cleanup: the model's raw call kept both fields, the assistant message the host persisted dropped them, `/qol` reported `taskArgs: enabled (rewrites=2)`, and the child returned its output. The loss of speculative launch, a real seance item, a flat single call, and multi-item batches are **not verified**.

### Upstream recheck

Recheck when OMP accepts the fields for non-seance items or exposes a task-specific pre-validation hook. If the host fixes the contract, disable or retire the module rather than keep the speculation cost.

## Copy the last reply

### Native behavior

OMP 18.11.3 interactive mode's built-in clipboard actions copy the prompt (`alt+shift+c`) or the current input line (`alt+shift+l`), and it offers a mouse `Copy answer` action. A `/copy` command asks the user to pick text or code from the conversation. The installed keyboard action table has no shortcut for an assistant reply. The extension API exposes `registerShortcut` and the coding-agent package exports `copyToClipboard`, so an extension can add the keyboard action without changing the host.

### Where it attaches

The module registers one shortcut while the extension factory runs. OMP loads extension factories before it constructs interactive mode, and interactive mode reads the shortcut registry while setting up key handling; a `session_start` registration would happen after that. The key is fixed at `alt+shift+a`, and the module registers no `/copy` command.

The handler reads the activation snapshot. Before the first `session_start` the copy module is `pending`; when it is disabled or invalid, the handler returns without writing.

When the module is enabled and the agent is idle, the handler takes the current branch from `ctx.sessionManager`, scans backward for the last assistant message, joins that message's `text` blocks without a separator, trims the result, and writes it through `copyToClipboard`. An aborted message with no content is skipped. A last assistant message with no text, including one carrying only thinking or tool calls, produces no copy and does not fall back to an older reply. Thinking, tool calls, tool output, images, and other non-text blocks are never copied. The module adds no session entry and sends no request.

While the agent is not idle, the handler warns and copies nothing. When no reply exists, the handler warns that there is nothing to copy. The host's `copyToClipboard` is best-effort: it writes OSC 52, then tries native tools, and swallows write failures. The module therefore reports success after the helper resolves; the module cannot detect a failed write through the helper. A copy function that throws is caught and produces one error notification; the handler does not retry.

### Settings

`copyEnabled` (on by default); see the README for the accepted values. The master switch must also be on. The module switch off reports `disabled` with `copy-disabled`, the master switch off reports `disabled` with `master-disabled`, and an invalid `copyEnabled` disables this module only. Settings are read once per activation; restart OMP to apply.

### Limits

- The shortcut is registered at factory time, so `alt+shift+a` stays claimed for the lifetime of that extension binding, even when `copyEnabled` is off, the master switch is off, or the settings object was rejected. The handler does nothing in those states. The key cannot be released without unloading that extension binding or a host change.
- The key and behavior are fixed. The module adds no `/copy` command, no configurable key, no selection or range copy, and no option to include thinking or tool output.
- The handler copies only text blocks of the last assistant message on the context's current branch. A message with only non-text content yields no copy rather than an older reply or an empty clipboard write.
- A clipboard write depends on the host helper, which treats OSC 52 and the native fallback as best-effort and swallows failures. A real failed write is not reported, and the module does not fall back to a file or to a notification body. A copy function that throws is caught and reported once.
- The shortcut is registered when an extension factory binds, and each session binding creates its own registration. A session created later in the same process binds the factory again and gets its own handler; a session-journal switch inside one interactive session keeps the registration it already has.
- If another extension registers the same key, the host decides which registration wins; this module does not detect or resolve the conflict.
- Real OMP CLI key delivery and system clipboard writes are **not verified**. Tests inject the copy function and never touch the system clipboard.

### Verification

- **Source baseline**: OMP `18.5.0` development types at commit `9348320cc4a30a7195d36a1f05a6c11bcb701a17` for `ExtensionAPI.registerShortcut`, `ExtensionContext.isIdle`, `ReadonlySessionManager.getBranch`, and the `@oh-my-pi/pi-coding-agent/utils/clipboard` export. The installed `18.11.3` action table was read at tag `v18.11.3`, commit `96894a6147d8cc64b7e00ad3a7d7178fd93b9531`; it has the two prompt-copy actions and no reply-copy action.
- **Automated checks**: OMP `18.5.0` development types, `bun test` and `tsc --noEmit`. Tests cover last-assistant selection, text-block joining and trimming, thinking and tool-call exclusion, an empty aborted message, no fallback when the last message has no text, the inactive/streaming/no-text/clipboard-failure handler paths, factory-time registration, the `/qol` line, and copy-specific settings faults. The copy function is injected; no real clipboard is written.
- **Real OMP CLI**: **not verified**. Key delivery in a real TUI session and the host's clipboard write, including OSC 52 and the native fallback, have not been run.
