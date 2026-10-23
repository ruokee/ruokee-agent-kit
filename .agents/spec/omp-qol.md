# omp-qol

English | [中文](./omp-qol.zh.md)

Spec for [projects/omp-qol](../../projects/omp-qol/README.md).

## Goals

- Carry independently switchable OMP adjustments in one package.
- Give them one installation, one configuration entry, and one set of checks, with a separate switch, availability state, and failure report for each adjustment.
- Continue interrupted work in the same main session automatically after an eligible stream closure.
- Remove seance-only task fields from non-seance task items before host validation.
- Copy the text of the last assistant reply from one fixed keyboard shortcut.

## Out of scope

- Guards for external tools, and host behavior unrelated to these adjustments.
- Installing or migrating on the user's behalf, or modifying other extensions, user configuration, or installed host files.
- Message-only continuation, named-process waiting, or service-only continuation on the wait entry.
- Reducing unrelated settings during the remote cutover.
- Changing native in-turn retries, the host classifier, provider selection, or subagent recovery.
- Matching provider error text, adding recovery settings, or recovering every error.
- Exactly-once tool execution, rollback, or idempotent continuation.
- Copying selected text, thinking blocks, tool calls, tool output, or images; a `/copy` command, a configurable shortcut, or clipboard history.

## Public surface

- Adjustments and defaults: [Adjustments](../../projects/omp-qol/README.md#adjustments).
- Settings, keys, defaults, and ranges: [Configuration](../../projects/omp-qol/README.md#configuration) and the `omp.settings` manifest in `package.json`.
- `/qol` status command: [Status](../../projects/omp-qol/README.md#status).
- Per-adjustment behavior, limits, and verification: [projects/omp-qol/docs/adjustments.md](../../projects/omp-qol/docs/adjustments.md).

### Error recovery

Recovery applies to main-session runs that end with an assistant error, including errors that remain after the host's native retries finish. Recovery keys off the run's stop reason, so a successful stop keeps its normal handling whatever text it contains.

With the master and recovery switches enabled, the default `knownTransient` mode must continue after this assistant error unless cancellation, either continuation cap, a safety exclusion, or a terminal client status prevents it:

```text
Error: Upstream provider closed the connection before the response completed: stream ended without terminal event or completed response
```

The default mode accepts host-classified transient or timeout errors, the host's `stream_interrupted_after_content` stop-detail mark, and an error with neither an HTTP status nor a classifier verdict. A statusless unclassified error needs no interruption mark. The broader `unclassified` mode accepts transient or timeout errors and all unclassified errors after the same safety checks, but gains no additional scope from the interruption mark.

This is a native session-stop continuation, not an exact replay of the failed request. Settings and the complete exclusion list remain owned by [the recovery behavior documentation](../../projects/omp-qol/docs/adjustments.md#continuing-after-a-transient-model-error).

### Task argument cleanup

The task argument module is a switch-gated adjustment: the native boolean `taskArgsEnabled`, defaulting to `true` and subordinate to `enabled`, installs one `tool_call` handler for the built-in `task` tool. It installs the handler only when the built-in task schema exposes `sourceSession`; a schema with only the ordinary `model` selector leaves the module unavailable and unchanged. An invalid value disables that module alone; a rejected settings object follows the component-wide rule.

A flat call is one item and a `tasks` array is a batch. For every item whose `agent` is a string, trims non-empty, and is not `seance`, the handler removes that item's own `sourceSession` and `model` and copies only changed objects. Items with a missing, empty, whitespace, non-string, or `seance` agent, non-object items, batch-level fields, and every other argument are unchanged. It returns a revised input only when something changed; one changed call increments one counter.

The cleanup does not change the task schema, description, approval policy, dispatch, background lifecycle, or result rendering. The host persists the revised arguments in the current assistant message, so later requests and the session file observe them. Registering the handler disables OMP's speculative task launch and experimental read speculation while the module is enabled; the module does not change the host setting, and turning it off restores the native behavior at the next activation. The module is installed only for a built-in `task` whose schema exposes `sourceSession`; a missing or shadowed tool, or a built-in schema without that field, leaves native behavior and reports a bounded reason.

[Task argument cleanup](../../projects/omp-qol/docs/adjustments.md#task-argument-cleanup) states the complete rule, accepted speculation cost, limits, and verification.

### Copy the last reply

The copy module is a switch-gated adjustment: the native boolean `copyEnabled`, defaulting to `true` and subordinate to `enabled`, governs the handler. `alt+shift+a` is registered during the extension factory, before interactive mode reads the shortcut registry; the module registers no `/copy` command and has no configurable key. The key remains claimed for the lifetime of that extension binding while the module is disabled or its settings are rejected, and the handler then does nothing. An invalid `copyEnabled` disables that module alone; a rejected settings object follows the component-wide rule.

When enabled and idle, the handler selects the last assistant message on the current branch, joins its `text` blocks without a separator, trims the result, and writes it through the host's clipboard helper. An aborted message with no content is skipped. A last assistant message with no text, including one with only thinking or tool calls, copies nothing and does not fall back to an older reply. Thinking, tool calls, tool output, images, and other non-text blocks are excluded, and the module adds no session entry or request. While the agent is not idle, the handler warns and copies nothing; the host clipboard helper is best-effort and swallows write failures, so a real failed write is not reported, while a copy function that throws is caught and produces one error notification without retrying.

[Copy the last reply](../../projects/omp-qol/docs/adjustments.md#copy-the-last-reply) states the complete behavior, the key-claim limit, and verification.

## Invariants

- Preserve every unrelated setting's key, default, range, and validation. Remote alignment, compaction usage, and model rules belong to `omp-smart-context`. The keys `compactionCacheEnabled`, `compactionCacheProvider`, `compactionCacheMode`, `compactionUsageEnabled`, and `modelPromptsEnabled` are absent and rejected as unknown keys; no runtime compatibility path remains. QoL neither installs nor stops the migrated modules.
- `waitMessagesSeconds` and `waitProcessSeconds` have no effect on supported hosts. The English and Chinese documentation and the manifest setting descriptions say so.
- Wait continuation serves only the standalone `wait` entry. A missing, foreign, or unrecognized entry leaves native behavior in place and reports a bounded reason.
- The compaction deadline patch keeps its ownership checks. It refuses to coexist with a patch carrying the `Symbol.for("ruokee.omp.compaction-timeout.patched")` marker, and a later matching activation does not take over an existing owner.
- Configuration comes only from OMP plugin settings and is read once per activation.
- A fault in one adjustment does not disable the others. A rejected setting is named by key and rule without echoing its value.
- Every code path the component keeps serves OMP 18.5.0 and later, including the wait path for the standalone `wait` entry.
- Recovery acts only on a main-session assistant error. Successful output that quotes an error does not trigger it; disabled switches or missing required host interfaces retain native behavior.
- Safety exclusions and the terminal 4xx rule take precedence over both modes and the interruption mark. The recovery module classifies a copy without changing the original assistant error.
- The existing per-chain continuation budget and doubling backoff apply across model runs. Only returned continuations consume budget; duplicate stop events for the same run and turn schedule no extra wait or continuation. The host cap applies independently.
- Normal completion, an out-of-scope error, or cancellation ends the chain. A later independent chain starts with fresh budget. A session switch, shutdown, new run, or invalidated chain prevents an old pending wait from continuing.
- Recovery uses the existing fixed continuation text, asks the model to check completed work and side effects, and includes no provider error body, command, or tool output. OMP retains ownership of history, tool scheduling, and approvals.
- Recovery notifications follow the existing switch and show the attempt and delay. `/qol` reports effective state and settings without starting a model run.
- Task argument cleanup removes only `sourceSession` and `model` from items whose `agent` is a non-empty, non-seance string. Missing, empty, whitespace, non-string, and `seance` agents, non-object items, batch-level fields, and every other argument remain unchanged.
- The handler is registered only for a built-in `task` whose schema exposes `sourceSession`; a missing or shadowed tool, or a schema with only the ordinary `model` selector, leaves native behavior, preserves `model`, and reports a bounded reason. While it is registered, speculative task launch and experimental read speculation are denied; the module does not change host settings.
- The module changes the event input. The host persists the revised arguments in the current assistant message, so later requests and the session file observe them. It does not change the task schema, description, approval, dispatch, or result rendering; a call that remains invalid for another reason still fails.
- An invalid `taskArgsEnabled` disables only the task argument module. Turning off its switch or the master switch restores native arguments and behavior at the next activation.
- The copy shortcut is registered during factory execution, not on `session_start`; its handler reads the activation snapshot and copies only while the module is enabled.
- The copy handler writes only `text` blocks of the last assistant message, skips an empty aborted message, and does not fall back to an earlier reply or write an empty string. Thinking, tool calls, tool output, images, and other non-text blocks are excluded.
- The copy handler copies nothing while the agent is not idle. The host clipboard helper swallows write failures, so a real failed write is not reported; a copy function that throws is caught and reported without escaping the handler.
- The copy module registers no `/copy` command and no configurable key. The fixed key stays claimed while the module is disabled, the master switch is off, or settings are rejected; the handler then does nothing.
- An invalid `copyEnabled` disables only the copy module. Turning off its switch or the master switch leaves native behavior at the next activation.

## Host lower bound

OMP `18.5.0`, declared in [Compatibility](../../projects/omp-qol/README.md#compatibility). The `@oh-my-pi/*` development dependencies are locked at `18.5.0`, and tests use that host's behavior as their baseline. The general rules are in [.agents/spec/host-compatibility.md](./host-compatibility.md).

## Acceptance criteria

- `bun run typecheck` and `bun test` pass in the component directory.
- Unrelated settings retain their keys, defaults, ranges, and validation. Retired remote keys and the migrated usage/rule keys trigger whole-configuration unknown-key rejection. Migration removes migrated keys at both user and project scopes, preserving effective enablement and unrelated settings.
- The descriptions of `waitMessagesSeconds` and `waitProcessSeconds` state that they have no effect.
- Each adjustment's real OMP CLI evidence is recorded under its verification section in [projects/omp-qol/docs/adjustments.md](../../projects/omp-qol/docs/adjustments.md), with unrun scenarios marked as not verified.
- A real OMP CLI run on a maintained host demonstrates automatic continuation after an eligible upstream stream closure in the same main session, with default recovery settings and no intervening user message. Native retries alone or an enabled `/qol` line do not prove this behavior.
- Behavioral checks cover the reported error's authentic host fields under the default mode. Reproducing its exact wording in a new real session is not a development prerequisite; an unrun exact-error scenario remains documented as not verified.
- The same fault with recovery disabled yields no QoL continuation. A real TUI run shows the attempt and delay, and cancellation during that wait prevents continuation.
- Behavioral checks cover both modes, marked and unmarked statusless errors, safety precedence, independent caps, backoff, cross-run chains, duplicate events, invalidated waits, switches, notifications, and the unchanged error and fixed-context boundaries.
- Component descriptions, manifests, root guidance, paired documentation, and current project Specs agree on ownership and approaching deprecation. Preserve all remaining adjustments and every unrelated valid requirement.
- Task argument cleanup checks cover a flat call, batch items, seance preservation, missing/empty/whitespace/non-string agents, absent target fields, abnormal task shapes, one rewrite per changed call, the built-in guard, flat and batch seance schemas, a model-only schema without `sourceSession`, missing and shadowed tools, disabled and incompatible states, and the off switch. Its real CLI evidence is recorded under the adjustment's verification section or marked not verified.
- Copy checks cover last-assistant selection, text-block joining and trimming, thinking and tool-call exclusion, an empty aborted message, no fallback when the last message has no text, the inactive/streaming/no-text/clipboard-failure handler paths, factory-time registration, the `/qol` line with the actual key, and copy-specific setting faults. Real CLI key delivery and a system clipboard write are recorded under the adjustment's verification section or marked not verified.

## Related ADRs

- [OMP QoL](../adr/decision/2026/09/20-omp-qol.md)
- [Host maintenance](../adr/decision/2026/09/28-host-maintenance.md)
- [Component self containment](../adr/decision/2026/08/24-component-self-containment.md)
- [Task argument cleanup](../adr/decision/2026/10/17-task-argument-cleanup.md)
- [Copy the last reply](../adr/decision/2026/10/18-copy-last-reply.md)
