# omp-qol

## Goals

Provide six independently switchable OMP adjustments in one package: continued job waiting, main-session error recovery, an experimental compaction deadline extension, native-history replay on resume, task argument cleanup, and copying the last assistant reply. Share installation and configuration while exposing each adjustment's effective state, settings, and failure reason.

## Out of scope

- Installing or migrating for the user, modifying installed host files or other extensions, or changing unrelated host behavior.
- Message-only continuation, named-process waiting, service-only continuation, or polling to simulate them.
- Changing native in-turn retries, provider selection, the host error classifier, or subagent recovery.
- Matching provider error prose, recovering every error, exactly-once tool execution, rollback, or idempotent continuation.
- Remote request alignment, compaction usage, or model rules. These belong to `omp-smart-context`; QoL neither activates nor stops them.
- Selected-text copying, thinking, tool calls, tool output, images, a `/copy` command, configurable keys, or clipboard history.

## Public surface

### Configuration

Use OMP plugin settings for `@ruokee/omp-qol`, with project values overriding user values. Read the effective settings once per activation. Restart OMP to apply changes; creating another session in the same running process does not reload that snapshot.

All switches and notification fields are booleans. The following table gives every key and default:

| Key | Default |
| --- | --- |
| `enabled` | `true` |
| `waitEnabled` | `true` |
| `waitContinueEmptyWindows` | `true` |
| `waitJobsSeconds` | `1200` |
| `waitMessagesSeconds` | `1200` |
| `waitProcessSeconds` | `1200` |
| `recoveryEnabled` | `true` |
| `recoveryMode` | `knownTransient` |
| `recoveryMaxAttempts` | `8` |
| `recoveryBackoffBaseMs` | `1000` |
| `recoveryBackoffMaxMs` | `8000` |
| `recoveryNotify` | `true` |
| `compactionTimeoutEnabled` | `false` |
| `compactionTimeoutMs` | `900000` |
| `compactionTimeoutFloorMs` | `300000` |
| `compactionWindowGuardMs` | `3600000` |
| `compactionTimeoutNotify` | `true` |
| `replayEnabled` | `true` |
| `taskArgsEnabled` | `true` |
| `copyEnabled` | `true` |

Numeric and enum constraints are:

- The three wait settings accept finite numbers from `0.05` through `3600` seconds. `waitMessagesSeconds` and `waitProcessSeconds` remain validated but have no effect on supported hosts.
- `recoveryMode` accepts only `knownTransient` and `unclassified`. `recoveryMaxAttempts` is an integer from 1 through 8.
- `recoveryBackoffBaseMs` is an integer from 1 through 10000. `recoveryBackoffMaxMs` is an integer greater than the base and at most 10000.
- `compactionTimeoutFloorMs` is an integer from 300000 through 3599999. `compactionTimeoutMs` is an integer greater than that floor and at most 3600000.
- `compactionWindowGuardMs` is an integer from the effective timeout through 14400000.

An absent key takes its default. Explicit null, a wrong type, non-finite number, fraction for an integer field, out-of-range value, or unknown enum disables the owning module only. An unknown key, non-object settings root, settings-read failure, or invalid master `enabled` disables every module. Do not activate defaults after rejecting the settings object.

The absent keys `compactionCacheEnabled`, `compactionCacheProvider`, `compactionCacheMode`, `compactionUsageEnabled`, and `modelPromptsEnabled` are unknown keys and reject the whole configuration. There are no compatibility aliases. Migration removes those keys from both user and project scopes, preserves unrelated settings and effective enablement, and requires its own authorization.

Diagnostics name the rejected key and rule, never its value. Report a module reason once per activation through the host log and, when available, UI. The master switch gates all module action; the copy key remains claimed while its extension binding exists even when action is disabled.

### Status

`/qol` is read-only and starts no model turn. Show package identity and version, activation cwd, the restart refresh policy, settings validity, and all six module states with their effective configuration. Use `pending` before session start and distinguish `enabled`, `disabled`, `invalid`, `incompatible`, and `unavailable`, with bounded reason codes. List rejected keys for partial or total settings rejection without printing their values.

The wait line shows `entry=wait`, `effectiveDefaultSeconds`, and `messageContinuation`, `processWait`, and `serviceContinuation` as `not-applicable`. Recovery shows mode, attempt limit, base, cap, and notification setting. Compaction shows timeout, floor, guard, notification setting, and its actual process-wide state. Replay shows actual process-wide state and rewrite count. Task arguments show the activation's rewritten-call count. Copy shows the actual fixed key `alt+shift+a`.

### Continued waiting

Extend only the recognized standalone builtin `wait` entry. A missing, foreign, or unrecognized entry, or missing required host capability, leaves native behavior and reports a bounded reason. Preserve the native read approval, strict validation, interruptibility, and essential load behavior.

The public optional `timeout` is a finite number in `(0, 3600]` seconds and sets the total deadline of that call. Omission uses `waitJobsSeconds`. The tool parameter's lower bound is not the configuration's `0.05` lower bound.

With `waitContinueEmptyWindows=true`, continue within the same call only when the native result marks an empty window with a nonempty job list whose jobs are all still running. Judge the host's structured result, not its text. Messages, a settled job, absent jobs, errors, steering, cancellation, unknown result shapes, and service events return immediately. With the switch false, return the first native window.

The deadline ends only this wait call. It starts or cancels no job or process and does not consume messages or results outside native waiting. Caller cancellation takes precedence and retains its reason. A native result that arrives despite the deadline wins and is returned unchanged. Convert a rejection to a deadline result only after this call's own deadline and only for recognized host aborts, `ToolAbortError`, `AbortError`, or the exact message `Operation aborted`. Propagate other errors unchanged.

On a deadline without a terminal result, return the last certain all-running window with a bounded deadline note, or a minimal note if none arrived. The note identifies another `wait` call and `proc://` as available next actions. Release call-owned waiting resources on every exit.

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

### Compaction deadline

The timeout adjustment is an opt-in process-wide experiment. A window opens for remote automatic compaction, before manual compaction, or when the host reports an active compaction. During that window, a finite `AbortSignal.timeout(ms)` request satisfying `floor <= ms < timeout` receives the configured timeout. Other inputs retain native behavior, including native errors for invalid input. Outside the window all inputs retain native behavior.

The first un-aborted compaction cancellation signal belongs to that operation. An already-aborted signal closes the window; later cancellation closes its own window, never a subsequent one. Repeated notifications with the same signal, including serial fallback methods, continue the same window without renewing its guard deadline or duplicating notifications and resources. A different live signal, overlapping operation, another session's window, or unrecognized event order stops the experiment for the process and reports the reason, including `overlapping-round` for a second live operation.

Close the window at the earliest compaction end, committed compaction, session switch, shutdown, cancellation, or guard expiry. The guard runs from the original opening event. With notifications enabled, report only the first extended deadline in each window.

One activation owns the process-wide experiment. A later activation with the same package version and effective settings keeps it without taking ownership or opening windows, and reports `incompatible` with `patch-owned-elsewhere`. It still shares the process-wide effect while the owner's window is open. A different version or settings snapshot stops a recognizable existing experiment. A disabled or invalid activation also stops it without enabling any module; its own switch state remains distinct from the actual process state shown by `/qol`.

An owner ending its session stops the experiment and leaves `owner-stopped` as a terminal state for that process. Restart OMP to reactivate it. A session switch closes the window without ending the activation. Refuse coexistence with a recognized earlier compaction patch, unknown ownership state, an overwritten owned adjustment, missing required host capability, or a process in which the experiment has already stopped. Failed event registration reports `registration-error` and leaves no active experiment. Release only resources still owned by this component; never overwrite a replacement installed by another extension.

The accepted costs and limits are:

- The window covers a time period, not an isolated request or project. Every matching timeout in the process is extended, including unrelated callers and other sessions.
- It can only lengthen a newly created deadline. Closing a window cannot shorten signals already created. The deadline limits one signal, not the combined time of retries and fallbacks.
- Enabling the experiment gives up host speculative compaction. Do not start, defer the threshold to, or consume speculative compaction while interception applies. Compaction previously prepared in the background may therefore make the foreground wait.
- Native compaction uses 300000 ms. A floor above that value prevents the compaction request itself from matching; `/qol` states this explicitly.
- The process-level adjustment writes no persistent configuration or session state. Disabling it and restarting restores native behavior.

### Native-history replay

When enabled, the first `openai-responses` request after resuming a session uses the stored provider-native history, including replayable thinking signatures, as the host would in a warmed session. Do not rebuild, filter, or sanitize that history. Do not alter session files. A session without stored native items has nothing to replay. Other protocols, including `openai-codex-responses`, Anthropic, and completions, remain unchanged.

The effect applies process-wide. Another enabled activation shares it and its rewrite count rather than creating a second adjustment. It may remain active after its original activation ends. An off switch releases a recognizable owned adjustment; rejected settings stop it with `runtime-conflict` without enabling defaults. Unknown ownership reports `registry-unrecognized`, foreign replacement reports `patch-overwritten`, and inability to activate reports `install-failed`. A refusal leaves unrelated state untouched, and release never overwrites a foreign replacement. `/qol` reflects the live process state, not a stale activation result.

Replay assumes the endpoint accepts the stored native items. Rejection can fail the first request where native rebuilding might have succeeded. The amount of reusable prompt context varies; there is no cache-hit or cost-saving guarantee. This adjustment neither changes other provider protocols nor promises coverage of host histories rebuilt outside the recognized provider-state creation path.

### Task arguments

Act before host validation only for the builtin `task` whose schema exposes `sourceSession`. Missing tools report `unavailable`; shadowed tools report `incompatible`. A schema without that field reports `unavailable` with `task-tool-without-seance-fields`, preserving its ordinary `model` selector and speculative launch.

A flat call is one item; a `tasks` array is a batch. For each object whose `agent` is a string that trims nonempty and is not `seance`, remove only that object's own `sourceSession` and `model`, regardless of their values. Preserve missing, empty, whitespace-only, non-string, and `seance` agents, non-object entries, batch-level fields, and all other arguments. Infer no default agent. One changed call increments the counter once, even if several items change; an unchanged call does not increment it.

The host displays, executes, and persists the revised current assistant arguments. Later requests and the session file therefore see the cleaned call. Do not rewrite earlier history or add a session entry. Keep the native task schema, description, approvals, dispatch, background lifecycle, and result rendering. Calls invalid for another reason still fail. If multiple extensions revise an input, the host's last revision wins.

The accepted cost is disabling speculative task launch and experimental read speculation while cleanup is registered, including for calls it leaves unchanged. Do not change the host settings themselves. Disabling the module restores native behavior at the next activation. A schema lacking `sourceSession` incurs none of this cost. A host changing the meaning or scope of these fields requires re-evaluation; do not extend cleanup by guessing.

### Copying replies

Bind `alt+shift+a` before the interactive host reads extension shortcuts. Each extension binding owns its registration; a session-journal switch retains the existing binding. The key remains claimed for that binding's lifetime when pending, disabled, or invalid, but the handler does nothing. A conflicting extension key is resolved by the host, not this module.

When enabled and idle, select the current branch's last assistant message, skipping an aborted message with no content. Join that message's `text` blocks with no separator and trim the result. Copy a nonempty result through the host clipboard helper. A last message with only thinking, tool calls, or other non-text content yields no copy and no fallback to an earlier reply. Never write an empty string or copy non-text blocks.

While busy, warn and leave the clipboard unchanged. With no copyable reply, warn and write nothing. The host helper is best-effort, using OSC 52 and native clipboard tools, and swallows write failures. A resolved helper call is reported as success even when the underlying write failed. A thrown copy error is caught and reported once without retry, file fallback, or a notification containing the copied body. Copying adds no session entry and starts no request.

## Invariants

Each valid adjustment remains usable when another has a local configuration or availability failure. Unknown required host shapes preserve native behavior rather than guessing. Process-wide effects obey the ownership and teardown rules above. Settings names, defaults, ranges, absent-key rejection, and unrelated values remain consistent across declarations and both user-document languages.

## Host lower bound

The minimum maintained OMP version is `18.5.0`, without an upper maintenance bound. This is not an installation or runtime gate, nor proof that every later version works. Earlier hosts may run without being maintained. Host peers remain unrestricted; required host capabilities determine a module's availability. Do not retain paths solely for hosts below the maintenance floor.

## Acceptance criteria

- Check all settings defaults, type and range failures, module-local rejection, whole-object rejection, retired keys, restart semantics, and truthful read-only `/qol` output.
- Waiting covers explicit and default deadlines, the all-running continuation condition, every terminal outcome, caller cancellation, native-result races, unrelated errors, and refusal to replace an unrecognized entry. Background work continues after a wait deadline.
- A real maintained OMP CLI session demonstrates eligible stream-error continuation with default recovery settings, in the same main session and without an intervening user message. Native retries or an enabled status alone do not establish it. The same fault with recovery disabled produces no QoL continuation. A real TUI shows the attempt and delay; cancellation prevents continuation.
- Behavioral recovery checks cover the reported error's real host fields, both modes, marked and unmarked statusless errors, exclusion precedence, independent caps, backoff, cross-run chains, duplicate events, invalidated delays, switches, notifications, unchanged errors, and fixed context. Reproducing the exact error prose in a new real session is not a development prerequisite.
- Compaction checks cover interval boundaries, unchanged native errors, same-signal fallback, cancellation, guard expiry, overlapping operations, matching and conflicting activations, owner exit, foreign ownership, default-off behavior, and process-wide effects. Replay checks cover eligible resumed native history, unaffected protocols, sharing, release, and truthful counters.
- A real remote compaction longer than the native deadline completes successfully, and model requests remain usable afterwards. Host upgrades revalidate this behavior; changing a maintenance declaration does not replace that evidence.
- Task cleanup covers flat and batch calls, seance preservation, every excluded agent shape, absent target fields, malformed task shapes, one increment per changed call, builtin/schema guards, model-only schemas, missing or shadowed tools, and switches. Persisted current arguments reflect the result.
- Copy checks cover last-message selection, joining and trimming, empty aborted messages, non-text exclusion, no fallback, disabled and busy states, no-text and clipboard errors, early key availability, and the actual key in `/qol`.
- Record each adjustment's real CLI or TUI evidence in its validation material, separating source inspection, automated checks, and actual runtime observations. Mark unrun scenarios, including exact-error reproduction or real key delivery and clipboard writing, as unverified rather than inferring success.
