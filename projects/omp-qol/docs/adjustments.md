# Adjustments

[中文](./adjustments.zh.md)

What each adjustment changes in OMP, why it is needed, where it attaches, what it costs, and which verification exists. The README carries a short index; this document keeps the evidence.

The source baseline is OMP `18.2.4`, tag `v18.2.4` of [`can1357/oh-my-pi`](https://github.com/can1357/oh-my-pi) at commit [`1c0303b1f2ec515cbf4b44a9a49d68a029531aac`](https://github.com/can1357/oh-my-pi/tree/1c0303b1f2ec515cbf4b44a9a49d68a029531aac). Every source link and line reference below points at that commit; the release a file belongs to and the snapshot it was read from can differ, so each adjustment states its own baseline as well.

## How a version note reads

Each adjustment ends with a version and verification note that separates three things:

- **Source baseline** — the OMP version and commit the mechanism was read against, with the source locations it depends on.
- **Automated checks** — the OMP version the type check and the test suite ran with, and what those tests actually exercise. A test that replaces the host does not prove host behavior.
- **Real OMP CLI** — the OMP version, model, and scenario of an interactive run. Items that have no such run are marked **未验证 / not verified**; they are not inferred from the peer range, from reading the source, or from another adjustment passing.

A statement about a host version is a statement about that version only. Nothing here claims a continuous range of versions.

## Continuing hub waits

### Native behavior

The builtin `hub` tool has a `wait` operation. One call blocks for a single window taken from a fixed ladder of `5 s, 10 s, 30 s, 60 s, 300 s` ([`packages/coding-agent/src/async/job-manager.ts:51`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/async/job-manager.ts#L51), chosen by `nextPollWaitMs` at [`job-manager.ts:493`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/async/job-manager.ts#L493) and used for the race timer at [`packages/coding-agent/src/tools/hub/index.ts:467`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/tools/hub/index.ts#L467)). The ladder is a compile-time constant with no setting behind it; a job or message wait therefore cannot be asked to block longer than the current rung.

When the window elapses with nothing new, the tool returns a complete snapshot marked as carrying no information: `useless: true` with `op: "wait"`, built for a still-running job set at [`packages/coding-agent/src/tools/hub/jobs.ts:315`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/tools/hub/jobs.ts#L315) (predicate `isWaitingPollDetails` at [`jobs.ts:43`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/tools/hub/jobs.ts#L43)) or for a clean message timeout at [`packages/coding-agent/src/tools/hub/messaging.ts:402`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/tools/hub/messaging.ts#L402). The tool description states the rule and tells the model to re-issue: "the wait window elapsing (5s, lengthening with each back-to-back wait up to 5m)" ([`packages/coding-agent/src/prompts/tools/hub.md:12`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/prompts/tools/hub.md#L12)).

The `timeout` parameter of that tool is scoped to logs, stop, and named-process waits ([`packages/coding-agent/src/tools/hub/index.ts:124`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/tools/hub/index.ts#L124)); the job and message wait path never reads it.

With the extension off, that is exactly what happens: one window per call, an empty frame returned to the model, and the ladder advancing only when the model calls again.

### Why it is needed

Each empty frame costs a model turn. The model reads a result with nothing in it and issues the same call again, which re-sends the conversation and spends provider quota. A long build or test run is the ordinary case for this tool, and at the start of a run the model wakes every 5 seconds until the ladder climbs. The ladder lowers the number of turns but not their cost, and the rung cannot be chosen by the caller.

No native configuration reaches this: `retry.*` settings govern request retries, not this tool, and the ladder has no settings key.

### Where it attaches

The extension registers a tool named `hub`, which the host treats as a re-registration of the builtin of the same name ([`packages/coding-agent/src/extensibility/extensions/wrapper.ts:66`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/extensibility/extensions/wrapper.ts#L66)). Every call is forwarded to the native tool through `ctx.invokeTool`, which runs the shadowed builtin ([`packages/coding-agent/src/extensibility/extensions/runner.ts:573`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/extensibility/extensions/runner.ts#L573)).

- Non-`wait` operations and waits with `name` are delegated once, unchanged, except that a named-process wait with no `timeout` gets the configured default.
- For a job or message wait, `timeout` becomes the total deadline of the call and is not forwarded to the native window. A value that is not a finite number in `(0, 3600]` is refused as a parameter error with the accepted range in the message.
- The deadline is one timer for the whole call. While each delegated result is a certain empty window, the wrapper calls the native tool again inside the same call.
- A result that is anything else — a delivered message, a settled job, a report, an error, an empty `jobs` array — is returned unchanged. Text is never inspected to decide this; the decision reads `useless`, `details.op`, the detail key set, and the structure of `jobs` and `waited`.
- The tool keeps the native parameter schema, approval function, `strict`, `loadMode`, and the interruptible flag for waits and followed log reads.
- The description replaces the native wait-window sentence with the effective deadline and adds one paragraph stating the deadline, the routing, and the claim that a deadline ends the wait only.

The delegated call inherits the outer abort signal and progress callback, so an interrupted wait stops the native call, and native progress still streams while the wrapper is looping.

### Settings

`waitEnabled`, `waitContinueEmptyWindows`, `waitJobsSeconds`, `waitMessagesSeconds`, `waitProcessSeconds`; see the README for defaults and accepted values. Routing is fixed when the call starts: `name` is a process wait, non-empty `ids` is a job wait, `from` with a job snapshot that shows no running job is a message wait, anything else is a job wait.

### Side effects and cancellation

- The module repeats a read-only native call. It starts no background work, cancels nothing, and takes no message or job result of its own; the native tool remains the only owner of that state.
- Reaching the deadline leaves background jobs and processes running. The returned result says so, and it is either the last certain empty window with that note appended, or a minimal text result when no window arrived.
- An outer cancellation is rethrown with its own reason and is never reported as a deadline. A result that arrives while the deadline is aborting the in-flight window is still delivered.
- One timer exists per call and is cleared when the call ends through any path.
- Cancellation of the adjustment: set `waitEnabled` to `false` and restart OMP. The native tool is then used directly, with `waitContinueEmptyWindows` having no effect.

### Applicability and limits

- The wrapper registers only when the session exposes a `hub` tool whose source is `builtin`, whose description contains the native wait-window sentence, and whose parameters are a schema. Otherwise the module stays inactive and reports `hub-tool-absent`, `hub-tool-shadowed`, `hub-description-unrecognized`, or `hub-schema-unrecognized`.
- The description sentence is matched verbatim. A host release that rewords it disables the module rather than advertising two different deadlines.
- Empty-window recognition depends on the host continuing to mark certain-empty frames with `useless`, `op: "wait"`, and the detail shape above. A host change there turns continuation off for those frames; the wait then behaves like the native one.
- The module depends on extension-tool precedence over a builtin, its parameters being reusable as they are, and `ctx.invokeTool` reaching the shadowed builtin. Any of those changing makes the module inactive or wrong, so a host upgrade needs a re-check before this adjustment is trusted again.
- The adjustment becomes unnecessary when the host lets a caller choose the wait window, or the ladder is exposed as a setting.

### Version and verification

- **Source baseline**: OMP `18.2.4` at `1c0303b1f2ec515cbf4b44a9a49d68a029531aac`. Sources listed above.
- **Automated checks**: OMP `18.2.4`, `bun test` and `tsc --noEmit` in this component, with a recording host in place of the real one. They cover deadline construction and routing, continuation across a sequence of empty windows, early return on a real result, message wins, outer cancellation not being reported as a deadline, the deadline note, timer cleanup, the tool definition fields, and registration gating on the settings. The package boundary is real: the schema and description used in the tests come from the installed host package.
- **Real OMP CLI**: **未验证 / not verified**. Planned scenario: a CLI session with a finite background job, a wait that outlives the first native window, one outer call in the transcript, the first real result delivered at once, and an interrupt that leaves the job running; then message waits, a named-process wait, and a non-wait operation. Until that run exists, the user-visible behavior in a real session — including which tool the model is offered and how the wrapper's result renders — is unproven.
- **Upstream history**: the ladder arrived with `529950711a` (2026-06-14, "added smart adaptive poll wait mode for job polling") and the tool set was consolidated onto `xd://` devices and `hub` in `5ff277349c` (2026-07-15). Both predate the baseline; the current locations are the ones cited. No commit changing this behavior after the baseline has been located.

## Continuing after a transient model error

### Native behavior

A failed provider request is retried inside the turn while the retry budget lasts: `retry.enabled` (default `true`), `retry.maxRetries` (default `10`), `retry.baseDelayMs` (default `500`), and `retry.maxDelayMs` (default `300000`), governed by the turn recovery module ([`packages/coding-agent/src/config/settings-schema.ts:1902`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/config/settings-schema.ts#L1902), budget use at [`packages/coding-agent/src/session/turn-recovery.ts:2203`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/turn-recovery.ts#L2203)). When the budget is exhausted, the turn ends, the assistant message keeps `stopReason: "error"`, and its message text becomes `Retry budget exhausted after N retries: …` ([`turn-recovery.ts:2406`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/turn-recovery.ts#L2406)).

From there the turn stays settled. There is no setting that continues the work after an error, and the host's own bounded turn recovery handles empty stops and unexpected stops, not this case. A user message or a new instruction is what moves the session forward.

The host offers one hook at that moment: before a main-agent turn settles it emits `session_stop` with `messages`, `turn_id`, `last_assistant_message`, `session_id`, `session_file`, `stop_hook_active`, and a `signal` ([`packages/coding-agent/src/extensibility/shared-events.ts:97`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/extensibility/shared-events.ts#L97)). A handler that returns `{continue: true, additionalContext}` queues one hidden continuation turn; the host caps non-`block` continuations at 8 per chain (`SESSION_STOP_CONTINUATION_CAP` at [`packages/coding-agent/src/session/agent-session.ts:401`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/agent-session.ts#L401), enforced at [`agent-session.ts:4284`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/agent-session.ts#L4284)), skips the hook entirely for subagents and when no handler is registered, and gives a handler 30 seconds ([`EXTENSION_HANDLER_TIMEOUT_MS`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/extensibility/extensions/runner.ts#L92)).

With the extension off, a transient failure that outlives the retry budget ends the turn and waits for a human.

### Why it is needed

A 502, a gateway that closes the stream early, or a provider timeout can outlast a retry budget. The work in flight then stops, and continuing costs the user a message and the model its place in the task.

The information needed to decide is already in the host: it classifies errors with `classifyMessage` and flags such as `Transient` and `Timeout` ([`packages/ai/src/error/flags.ts:20`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/ai/src/error/flags.ts#L20), [`flags.ts:787`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/ai/src/error/flags.ts#L787)) and exposes a status predicate ([`packages/ai/src/error/retryable.ts:20`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/ai/src/error/retryable.ts#L20)). There is no setting and no other public entry point for a turn-level continuation after an error, so the adjustment uses the stop hook the host provides.

### Where it attaches

The extension registers a `session_stop` handler and an `agent_start` handler.

1. Return nothing when the settle signal is already aborted.
2. Take the last assistant message from `last_assistant_message`, or from the end of `messages`, and return nothing unless it is an assistant message with `stopReason: "error"`.
3. Classify a copy of that message with the host classifier and read the result. The module matches no error text itself; the copy keeps the host message untouched.
4. Decide by mode. `knownTransient` accepts errors carrying `Transient` or `Timeout`. `unclassified` also accepts an error whose id is `0` or outside the host's class mask.
5. Refuse the fixed exclusions in both modes: content blocked, user interrupt, abort, silent abort, authentication failure, OAuth expiry, usage limit, account policy, context overflow, payload rejected, grammar rejection, unsupported mode, thinking loop, stale responses item, deterministic tool JSON, and a client status in the 4xx range except 408 and 429.
6. Apply the chain rules: an event with `stop_hook_active === false` starts a fresh chain, so only the counters reset; a repeated event for the same `turn_id` inside the same agent run is ignored; a session switch ends the chain; a chain that reached `recoveryMaxAttempts` returns nothing.
7. End the chain on every pass that is not a recoverable error: a turn that settled on its own, an error outside the configured scope, a pass whose signal is already aborted, and a wait the signal cancels. Only a continuation this module requests keeps the chain alive, so a chain another stop hook continues starts from zero instead of inheriting a spent budget.
8. Claim the turn, then wait `min(base × 2^(attempt−1), max)` outside the handler's own settling, re-checking the signal, the chain generation, the agent run, and the session afterwards.
9. Return `{continue: true, additionalContext: <fixed text>}`. The attempt counter advances only for a returned continuation.

`agent_start` marks the boundary the stop hook cannot see. The host resets its turn counter there ([`agent-session.ts:4312`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/agent-session.ts#L4312)) and reports `turn_id` as that counter minus one ([`agent-session.ts:4268`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/agent-session.ts#L4268)), and both a submitted prompt and a continuation turn start an agent run ([`agent-loop.ts:610`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/agent/src/agent-loop.ts#L610), [`agent-loop.ts:673`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/agent/src/agent-loop.ts#L673)). Two runs that both fail on their first turn therefore both report `turn_id: 0`, so the dedup key pairs the turn id with the run, and the run counter advances on that hook. A run that starts while a delay is pending discards that delay. The continuation budget itself is never reset by a run boundary: it follows the host's `stop_hook_active` mark, so the host cap and `recoveryMaxAttempts` count a chain across runs.

The continuation text is fixed and states that an upstream error ended the previous turn and that the work should continue. It carries no provider body, no command, and no tool output.

### Settings

`recoveryEnabled`, `recoveryMode`, `recoveryMaxAttempts`, `recoveryBackoffBaseMs`, `recoveryBackoffMaxMs`, `recoveryNotify`; see the README for defaults and accepted values. `notify` prints one warning line per continuation with the attempt number and the delay, which is what makes the delay visible while it happens.

### Side effects and cancellation

- The adjustment starts a model turn. It re-sends the conversation and spends provider quota.
- The failed turn is not undone. Tool calls that ran before the error keep their effects, and calls from that turn that never ran may run in the continuation.
- The continuation is a hidden custom message. History keeps the assistant error message as it was.
- The host cap of 8 continuations per chain applies independently of `recoveryMaxAttempts`, and the host counts a chain reset when a turn is not part of the active chain.
- Esc during the delay cancels it, and a cancelled delay is not counted as an attempt.
- A `session_stop` handler has 30 seconds. The validated delay range stops at 10 seconds for the doubling bound, so a default or configured delay stays well inside that budget.
- Cancellation of the adjustment: set `recoveryEnabled` to `false` and restart OMP. The host then never sees a continuation request from this extension.

### Applicability and limits

- The module needs `session_stop` with `stop_hook_active`, `turn_id`, `last_assistant_message`, and the continuation result fields, plus the public error classifier. The host skips the hook for subagents, so recovery never applies there.
- Safety exclusions win over the configured mode. A refusal, a quota limit, or a user interrupt cannot be turned into a continuation by configuration.
- The adjustment depends on `stopReason: "error"` marking a failed turn and on the host classifier's verdict. Both are host behavior that can change; the tests read them from the installed package, and a host upgrade needs a re-check.
- A continuation can repeat a side effect. Nothing in the host or this module makes a re-run idempotent.
- The adjustment becomes unnecessary when the host offers a setting that continues a turn after an eligible error, or when a stop hook can be registered with its own retry budget.

### Version and verification

- **Source baseline**: OMP `18.2.4` at `1c0303b1f2ec515cbf4b44a9a49d68a029531aac`. Sources listed above.
- **Automated checks**: OMP `18.2.4`, `bun test` and `tsc --noEmit`, with a recording host. They cover the classification matrix for both modes, exclusion precedence, the chain and backoff arithmetic, duplicate events for one turn, consecutive runs that each fail on their first turn, a run starting while a delay is pending, a cancelled delay, session switching, the attempt cap across runs, the chain ending on a normal settle pass and on an unrecoverable error, a cancelled pass, the handled-turn marker surviving that end, the fixed continuation text, and registration gating on the settings. The error classifier is the installed `@oh-my-pi/pi-ai` code, not a stub.
- **Real OMP CLI**: **未验证 / not verified**. Planned scenario: a CLI session against a controlled failure injection on the model request path, where the turn ends with a stream error and the continuation, its delay, and its cap are observed in the transcript. Fault injection has not been set up, and there is no substitute for it: calling the handler directly is not evidence that a real turn recovers.
- **Upstream history**: the stop hook and its continuation cap arrived with `c93774f892` (2026-06-17, "implement session stop hook semantics"); `/reset` semantics changed in `a418920ec1` (2026-08-03), which is why a chain reset after a reset relies on the host's `stop_hook_active` and not on counters alone. The current wording of a retry-exhausted error dates from `f6c5a43a1f` (2026-08-06); the module classifies the error instead of matching that wording.

## Extending one compaction deadline

### Native behavior

A remote compaction request carries a watchdog against the caller's signal: `withRequestTimeout` races the signal with `AbortSignal.timeout(timeoutMs)` ([`packages/agent/src/compaction/openai.ts:239`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/agent/src/compaction/openai.ts#L239), used at [`openai.ts:868`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/agent/src/compaction/openai.ts#L868)) with `REMOTE_COMPACTION_TIMEOUT_MS = 300_000` ([`openai.ts:76`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/agent/src/compaction/openai.ts#L76)), and the V2 streaming path does the same with `V2_COMPACTION_TIMEOUT_MS = 300_000` ([`packages/agent/src/compaction/compaction-v2-streaming.ts:48`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/agent/src/compaction/compaction-v2-streaming.ts#L48), [`compaction-v2-streaming.ts:252`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/agent/src/compaction/compaction-v2-streaming.ts#L252)). A timeout of zero or less disables the watchdog.

Five minutes is a constant. No compaction setting reaches it ([settings keys `compaction.*`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/config/settings-schema.ts#L2712)), and the caller does not choose it per request. A remote compaction slower than five minutes is aborted, and the run falls back instead of finishing that request.

OMP marks the same period for extensions: `auto_compaction_start` with `action: "remote"` ([`packages/coding-agent/src/session/session-maintenance.ts:4119`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/session-maintenance.ts#L4119), emitted at [`session-maintenance.ts:4140`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/session-maintenance.ts#L4140)), `session_before_compact` inside the auto path ([`session-maintenance.ts:4359`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/session-maintenance.ts#L4359)), in `compact()` ([`session-maintenance.ts:1164`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/session-maintenance.ts#L1164)), and in `#compactExperimentalContext()` ([`session-maintenance.ts:1502`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/session-maintenance.ts#L1502)), `session.compacting` when a handler exists ([`session-maintenance.ts:3335`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/session-maintenance.ts#L3335)), `auto_compaction_end`, and `session_compact` after the entry is committed.

With the extension off, the five minutes stand as they are. This is the default.

### Why it is needed

The watchdog exists so a hanging remote compaction does not hang the session, and the fix that added it did exactly that ([`8b8651529d`](https://github.com/can1357/oh-my-pi/commit/8b8651529d), 2026-06-13, "fixed hanging remote compaction requests with request timeouts"). Its cost is a hard cut at a length a slow provider or a large history can exceed, with no setting and no public hook to raise it for one request. The event stream does let an extension see when compaction is running; it does not let an extension change the deadline.

### Where it attaches

The extension replaces `AbortSignal.timeout` with a wrapper that keeps a reference to the native function.

- With no window open, the wrapper calls the native function with the arguments it received, so invalid input keeps its native `TypeError` and every caller behaves as before.
- Inside a window, a call whose `ms` is finite and satisfies `floorMs ≤ ms < timeoutMs` is passed to the native function with `timeoutMs` instead. Any other value passes through, including values above `timeoutMs` and values the native function rejects.
- A window opens on `auto_compaction_start` with `action: "remote"`, on `session_before_compact`, or on `session.compacting`, which also carries the session id the window belongs to.
- Every `session_before_compact` signal is bound to the window that is current when the event arrives, whether that window was just created or an auto round or `session.compacting` opened it earlier. An already aborted signal closes that window instead of being ignored, and a signal that aborts later closes the window it was bound to. A listener left over from a closed window cannot close a later one, and binding a signal does not extend the guard lease.
- A window closes on `auto_compaction_end`, `session_compact`, a session switch, a session shutdown, a cancellation, or the guard timer `compactionWindowGuardMs`, whichever comes first.
- The install is process-wide through a registry held in a global symbol, and it records the activation that installed it, the package version, the activation cwd, and the settings snapshot. Only an install request from that same activation with that same snapshot is idempotent.
- The module refuses to install, with a reason reported through the log and `/qol`, when a marker from an earlier patch of the same host is present, when the registry slot holds something this version cannot read, when another activation owns the wrapper, when the current `AbortSignal.timeout` is no longer this module's wrapper although the switch is on, when the switch is off, or when the native function is missing.
- A second activation in the same process never shares the patch and is never silently controlled by it. It stops the installed patch: the open window closes, rewriting ends, and the original function returns when the current value is still this module's wrapper. The activation that installed it reports `incompatible` with `runtime-conflict`, and the new activation stays inactive for its own reason. This check runs even when the master switch, this module's switch, or its keys keep the new activation off; such an activation keeps its own switch state instead of reporting a conflict.
- An activation whose settings could not be read, or were rejected, also stops a recognised patch another activation installed, without installing anything itself. Every module stays off on the values the failure produced; no module is turned on with a default to make that check possible. A registry this version cannot read, and a marker from an earlier patch of the same host, are left as they are.
- An install request from the installing activation with a different settings snapshot stops the installed patch with `config-conflict`, because settings are read once per activation and a changed snapshot means the effective settings are no longer the ones the patch was built from.
- Closing an off-switch restores the native function only if the current value is still this module's wrapper, and reports when it is not.
- Overlapping windows, a window for another session, or an event order the module does not recognize disable the experiment for the process and report the reason.

### Settings

`compactionTimeoutEnabled` (off by default), `compactionTimeoutMs`, `compactionTimeoutFloorMs`, `compactionWindowGuardMs`, `compactionTimeoutNotify`; see the README for defaults and accepted values. `notify` prints one line the first time a window rewrites a deadline, and never repeats it inside the same window.

### Side effects and cancellation

- The patch is process-wide. Every caller of `AbortSignal.timeout` in the process whose argument falls in the rewritten range during a window gets the longer deadline, not only the compaction request. This is the accepted price of the experiment, and the reason the default is off. It is visible without compaction: a matching call from any other code in the process changes too while a window is open.
- It can only lengthen a deadline. A value below the floor and a value at or above `compactionTimeoutMs` are untouched, so the adjustment never shortens a wait.
- The floor is an expert setting. The inspected compaction paths pass exactly `300000` ms, so a floor above that value stops the compaction request itself from matching and the experiment no longer extends it; `/qol` states this when the effective floor is that high.
- The wrapper is installed for the lifetime of the process and is inert outside a window. The guard bounds how long a window can stay armed when its closing event never arrives.
- The window is opened from events, so it can cover calls made by unrelated work during that period, for example a provider request that happens to use a matching timeout.
- Registering `session_before_compact` changes what the host does with its speculative compaction, because the host treats any handler of that event as an interceptor. In OMP `18.2.4` the handler's presence disables three things: a speculative run is not started ([`session-maintenance.ts:1983`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/session-maintenance.ts#L1983)), the threshold is not deferred to a speculation that is already running ([`session-maintenance.ts:2043`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/session-maintenance.ts#L2043)), and an armed speculation is not consumed ([`session-maintenance.ts:2252`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/session-maintenance.ts#L2252)). The host states its reason in the first of those places: a speculated result would bypass an interceptor's veto. The consequence for this adjustment is that enabling it gives up speculative compaction, so a compaction that would have been prepared in the background runs in the foreground and the session may wait for it. That is why the module registers the handler only while `compactionTimeoutEnabled` is on: with the default off, no handler is registered and the host's compaction scheduling is untouched. The module needs that hook because its `signal` is the cancellation entry point of a manual compaction.
- Cancellation of the adjustment: set `compactionTimeoutEnabled` to `false` and restart OMP, or restart without the extension. Nothing is written to disk and nothing survives the process.

### Applicability and limits

- One process hosts one wrapper, owned by the activation that installed it. A second activation stops that patch and stays inactive with its own reason; the stopped activation reports `runtime-conflict`. Two sessions in one process therefore do not both carry the experiment.
- The module depends on `AbortSignal.timeout` being writable and configurable, on the native function throwing `TypeError` for invalid input, and on the compaction paths using `AbortSignal.timeout` for their watchdog. Rewriting those paths to build their own signal, or to configure the timeout another way, makes the patch ineffective.
- Extension-visible events do not carry the request that will be timed, and a window is a period rather than a request. The module cannot promise that a rewritten call belongs to compaction, and it says so instead of guessing when events conflict.
- The experiment is unnecessary once the host exposes a request-level compaction timeout or passes the timeout down as a parameter.
- Values this module does not control: the deadline stays a single signal's deadline, not the total time of retries and fallbacks, and a compaction that needs more than the raised deadline is cut off as before. The module also does not control the host's speculative compaction, which the `session_before_compact` registration turns off.

### Version and verification

- **Source baseline**: OMP `18.2.4` at `1c0303b1f2ec515cbf4b44a9a49d68a029531aac`. Sources listed above.
- **Automated checks**: OMP `18.2.4`, `bun test` and `tsc --noEmit`, with a recording host and `AbortSignal.timeout` replaced by a recorder that delegates invalid input to the native function. They cover install order and every refusal reason, idempotent install and release, a second activation stopping the installed patch (same cwd, another cwd, this module's switch off, the master switch off, invalid keys), a changed settings snapshot in the installing activation, a registry slot this version cannot read, a settings reader that throws, a settings root that is not an object, an unknown key, an invalid master switch, the rewrite range, `TypeError` behavior for invalid input, one notice per window, the process-level effect on a caller that is not compaction, window opening from each event, a before-compact signal bound to a window that was already open, a signal that already aborted, a stale listener, closing from guard, cancel, abort, switch, and shutdown, overlap and foreign-session refusal, and restore-after-replacement.
- **Real OMP CLI**: **未验证 / not verified**. The required evidence is a real remote request that runs longer than `300000 ms` and then succeeds, with the subsequent ordinary model request still working, plus the V1/V2 path, attempt count, elapsed time, cancel and fallback results, and the extension combination in use. A log line showing `900000` is not that evidence. Until such a run exists, the claim that the raised deadline lets a slow remote compaction finish is unproven, and the experiment stays off by default.
- **Upstream history**: the remote watchdog arrived with `8b8651529d` (2026-06-13), and V2 streaming compaction with `102d6d54ad` (2026-06-28), which duplicated the watchdog with its own constant. Both are older than the baseline; no commit changing the five minutes after the baseline has been located.

## Upstream references

| Commit | Date | Change | Adjustment it explains |
| --- | --- | --- | --- |
| [`529950711a`](https://github.com/can1357/oh-my-pi/commit/529950711a) | 2026-06-14 | Added the adaptive poll wait ladder for job polling. | Hub waits |
| [`5ff277349c`](https://github.com/can1357/oh-my-pi/commit/5ff277349c) | 2026-07-15 | Consolidated the tool surface onto `xd://` devices and `hub`. | Hub waits |
| [`c93774f892`](https://github.com/can1357/oh-my-pi/commit/c93774f892) | 2026-06-17 | Implemented the session stop hook semantics and its continuation cap. | Error recovery |
| [`a418920ec1`](https://github.com/can1357/oh-my-pi/commit/a418920ec1) | 2026-08-03 | Made `/reset` semantically different, adding a chain reset path. | Error recovery |
| [`f6c5a43a1f`](https://github.com/can1357/oh-my-pi/commit/f6c5a43a1f) | 2026-08-06 | Handled subscription-cap retry exhaustion and its message. | Error recovery |
| [`8b8651529d`](https://github.com/can1357/oh-my-pi/commit/8b8651529d) | 2026-06-13 | Fixed hanging remote compaction requests with a five-minute request timeout. | Compaction deadline |
| [`102d6d54ad`](https://github.com/can1357/oh-my-pi/commit/102d6d54ad) | 2026-06-28 | Implemented V2 streaming remote compaction with its own watchdog. | Compaction deadline |

Dates are commit dates. These commits were located by searching the file history of the current paths for the identifiers named above; where no commit is listed, none was found for that behavior.
