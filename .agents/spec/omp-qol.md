# omp-qol

English | [中文](./omp-qol.zh.md)

Spec for [projects/omp-qol](../../projects/omp-qol/README.md).

## Goals

- Carry five independently switchable OMP adjustments in one package: continuing waits, continuing after an eligible transient model error, extending one compaction deadline, replaying native history in a resumed session, and aligning the remote compaction cache.
- Give them one installation, one configuration entry, and one set of checks, with a separate switch, availability state, and failure report for each adjustment.
- Continue interrupted work in the same main session after an eligible stream closure, without requiring another user message.
- Align proved shared context in remote compaction, including generic hook insertion, reordering, and restored context, without requiring another component.

## Non-goals

- Guards for external tools, and host behavior unrelated to these adjustments.
- Installing or migrating on the user's behalf, or modifying other extensions, user configuration, or installed host files.
- Message-only continuation, named-process waiting, or service-only continuation on the wait entry.
- Reducing the set of settings.
- Changing native in-turn retries, the host classifier, provider selection, or subagent recovery.
- Matching provider error text, adding recovery settings, or recovering every error.
- Exactly-once tool execution, rollback, or idempotent continuation.

## Public surface

- Adjustments and defaults: [Adjustments](../../projects/omp-qol/README.md#adjustments).
- Settings, keys, defaults, and ranges: [Configuration](../../projects/omp-qol/README.md#configuration) and the `omp.settings` manifest in `package.json`.
- `/qol` status command: [Status](../../projects/omp-qol/README.md#status).
- Per-adjustment behavior, limits, and verification: [projects/omp-qol/docs/adjustments.md](../../projects/omp-qol/docs/adjustments.md).

### Error recovery

Recovery applies to main-session runs that end with an assistant error, including errors that remain after the host's native retries finish. A successful or non-error stop does not trigger recovery because its text mentions the same error.

With the master and recovery switches enabled, the default `knownTransient` mode must continue after this assistant error unless cancellation, either continuation cap, a safety exclusion, or a terminal client status prevents it:

```text
Error: Upstream provider closed the connection before the response completed: stream ended without terminal event or completed response
```

The default mode accepts host-classified transient or timeout errors, the host's `stream_interrupted_after_content` stop-detail mark, and an error with neither an HTTP status nor a classifier verdict. A statusless unclassified error needs no interruption mark. The broader `unclassified` mode accepts transient or timeout errors and all unclassified errors after the same safety checks, but gains no additional scope from the interruption mark.

This is a native session-stop continuation, not an exact replay of the failed request. Settings and the complete exclusion list remain owned by [the recovery behavior documentation](../../projects/omp-qol/docs/adjustments.md#continuing-after-a-transient-model-error).

## Invariants

- Every setting the manifest declared in `omp-qol` 0.5.0 remains, including the two cache settings `compactionCacheEnabled` and `compactionCacheProvider`, with unchanged keys, defaults, and ranges.
- `waitMessagesSeconds` and `waitProcessSeconds` have no effect on supported hosts. The English and Chinese documentation and the manifest setting descriptions say so.
- Wait continuation serves only the standalone `wait` entry. A missing, foreign, or unrecognized entry leaves native behavior in place and reports a bounded reason.
- The compaction deadline patch keeps its ownership checks. It refuses to coexist with a patch carrying the `Symbol.for("ruokee.omp.compaction-timeout.patched")` marker, and a later matching activation does not take over an existing owner.
- Configuration comes only from OMP plugin settings and is read once per activation.
- A fault in one adjustment does not disable the others. A rejected setting is named by key and rule without echoing its value.
- The component keeps no code path that exists only for hosts earlier than OMP 18.5.0, including the wait path that served only the builtin `hub` tool.
- Recovery acts only on a main-session assistant error. Successful output that quotes an error does not trigger it; disabled switches or missing required host interfaces retain native behavior.
- Safety exclusions and the terminal 4xx rule take precedence over both modes and the interruption mark. The recovery module classifies a copy without changing the original assistant error.
- The existing per-chain continuation budget and doubling backoff apply across model runs. Only returned continuations consume budget; duplicate stop events for the same run and turn schedule no extra wait or continuation. The host cap applies independently.
- Normal completion, an out-of-scope error, or cancellation ends the chain. A later independent chain starts with fresh budget. A session switch, shutdown, new run, or invalidated chain prevents an old pending wait from continuing.
- Recovery uses the existing fixed continuation text, asks the model to check completed work and side effects, and includes no provider error body, command, or tool output. OMP retains ownership of history, tool scheduling, and approvals.
- Recovery notifications follow the existing switch and show the attempt and delay. `/qol` reports effective state and settings without starting a model run.
- Cache processing offers `standard` and `hooks`, defaulting to `hooks`, without changing the disabled cache default or the explicit provider requirement. Invalid mode configuration rejects only cache; effective mode participates in owner compatibility and `/qol`.
- Hook observations belong to the owning session runner and explicit session/model/root-signal operation. Reuse only a completed host projection whose native encoding matches an online request confirmed unchanged at transport. Never re-run handlers, read extension private state, recognize a component's text format, or maintain another serializer.
- Before replacing a projected prefix, prove the raw shared-history boundary and validate the complete candidate. Preserve new ordinary and tool history, opaque data, trigger, explicit tool choice, cache keys, routing, and model policy. Unknown correspondence or difference leaves the entire original request unchanged.
- New online references cannot alter older operations or their retries. Retention is bounded to the latest reference and native operation lifetimes. Cancellation, stale identity, navigation, conflicts, and overwritten wrappers prevent stale rewriting; shutdown restores only still-owned functions and original property shapes.
- Cache does not register `session_before_compact`, hide handlers, or bypass the native veto. Manual, automatic, and speculative preparation, waiting, retries, fallback, result adoption, and history replacement remain host-owned. Independently enabled modules retain their own behavior.

## Host lower bound

OMP `18.5.0`, declared in [Compatibility](../../projects/omp-qol/README.md#compatibility). The `@oh-my-pi/*` development dependencies are locked at `18.5.0`, and tests use that host's behavior as their baseline. The general rules are in [.agents/spec/host-compatibility.md](./host-compatibility.md).

## Acceptance criteria

- `bun run typecheck` and `bun test` pass in the component directory.
- Every setting present in the 0.5.0 manifest, including both existing cache settings, retains its key, default, and range. The added cache processing mode follows its current native manifest contract.
- The descriptions of `waitMessagesSeconds` and `waitProcessSeconds` state that they have no effect.
- Each adjustment's real OMP CLI evidence is recorded under its verification section in [projects/omp-qol/docs/adjustments.md](../../projects/omp-qol/docs/adjustments.md), with unrun scenarios marked as not verified.
- A real OMP CLI run on a maintained host demonstrates automatic continuation after an eligible upstream stream closure in the same main session, with default recovery settings and no intervening user message. Native retries alone or an enabled `/qol` line do not prove this behavior.
- Behavioral checks cover the reported error's authentic host fields under the default mode. Reproducing its exact wording in a new real session is not a development prerequisite; an unrun exact-error scenario remains documented as not verified.
- The same fault with recovery disabled yields no QoL continuation. A real TUI run shows the attempt and delay, and cancellation during that wait prevents continuation.
- Behavioral checks cover both modes, marked and unmarked statusless errors, safety precedence, independent caps, backoff, cross-run chains, duplicate events, invalidated waits, switches, notifications, and the unchanged error and fixed-context boundaries.
- Native configuration and `/qol` show the default and both explicit cache modes, activation-only reads, module-local invalid configuration, and unchanged disabled/empty-provider behavior.
- With no relevant hook, both modes perform common alignment. Generic insertion, reordering, and restoration are refused by `standard` and aligned by `hooks` only when proved; new history and opaque content remain intact through first, subsequent, and resumed-session compaction.
- Real CLI evidence demonstrates immutable speculative projections during newer online work and native retries, native adoption without a replacement request, cancellation and later recovery, and ownership-safe refusal and cleanup. Request consistency and native usability are reported separately from provider cache measurements; synthetic usage proves no provider benefit.

## Related ADRs

- [Maintain OMP quality-of-life adjustments on the standalone wait entry](../adr/decision/2026-10-04-use-standalone-qol-wait.md)
- [Use native plugin settings for Codex web access](../adr/decision/2026-09-10-use-codex-web-plugin-settings.md)
- [Maintain host components against a shared OMP floor](../adr/decision/2026-10-04-raise-omp-host-floor.md)
- [Keep distributable components self-contained](../adr/decision/2026-08-24-keep-components-self-contained.md)
