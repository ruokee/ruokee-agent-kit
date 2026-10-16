# omp-qol

English | [中文](./omp-qol.zh.md)

Spec for [projects/omp-qol](../../projects/omp-qol/README.md).

## Goals

- Carry independently switchable OMP adjustments in one package.
- Give them one installation, one configuration entry, and one set of checks, with a separate switch, availability state, and failure report for each adjustment.
- Continue interrupted work in the same main session automatically after an eligible stream closure.
- Provide user-authored model rules from this component directly.
- Record the compaction and handoff request usage a host does not journal itself, until a host does.

## Out of scope

- Guards for external tools, and host behavior unrelated to these adjustments.
- Installing or migrating on the user's behalf, or modifying other extensions, user configuration, or installed host files.
- Message-only continuation, named-process waiting, or service-only continuation on the wait entry.
- Recording usage for request kinds outside the compaction and handoff ones, or inventing an api, price, or branch this component cannot read.
- Reducing unrelated settings during the remote cutover.
- Changing native in-turn retries, the host classifier, provider selection, or subagent recovery.
- Matching provider error text, adding recovery settings, or recovering every error.
- Exactly-once tool execution, rollback, or idempotent continuation.
- Template strategy, Delivery insertion, footer rewriting, automatic installation or extension reordering, new matching dimensions or search paths, rule caching, configuration hot refresh, per-provider-request refresh, and history-message injection for model rules.

## Public surface

- Adjustments and defaults: [Adjustments](../../projects/omp-qol/README.md#adjustments).
- Settings, keys, defaults, and ranges: [Configuration](../../projects/omp-qol/README.md#configuration) and the `omp.settings` manifest in `package.json`.
- `/qol` status command: [Status](../../projects/omp-qol/README.md#status).
- Per-adjustment behavior, limits, and verification: [projects/omp-qol/docs/adjustments.md](../../projects/omp-qol/docs/adjustments.md).
- Rule discovery, format, matching, trust, and refresh: [Model prompt rules](../../projects/omp-qol/README.md#model-prompt-rules).

### Error recovery

Recovery applies to main-session runs that end with an assistant error, including errors that remain after the host's native retries finish. Recovery keys off the run's stop reason, so a successful stop keeps its normal handling whatever text it contains.

With the master and recovery switches enabled, the default `knownTransient` mode must continue after this assistant error unless cancellation, either continuation cap, a safety exclusion, or a terminal client status prevents it:

```text
Error: Upstream provider closed the connection before the response completed: stream ended without terminal event or completed response
```

The default mode accepts host-classified transient or timeout errors, the host's `stream_interrupted_after_content` stop-detail mark, and an error with neither an HTTP status nor a classifier verdict. A statusless unclassified error needs no interruption mark. The broader `unclassified` mode accepts transient or timeout errors and all unclassified errors after the same safety checks, but gains no additional scope from the interruption mark.

This is a native session-stop continuation, not an exact replay of the failed request. Settings and the complete exclusion list remain owned by [the recovery behavior documentation](../../projects/omp-qol/docs/adjustments.md#continuing-after-a-transient-model-error).

### Compaction request usage

- The native boolean `compactionUsageEnabled` defaults to `true` and is subordinate to `enabled`. An invalid value disables this adjustment alone. Settings use the existing global/project precedence and activation snapshot; restarting OMP applies changes, switching sessions does not.
- The adjustment replaces the `telemetry` accessor on the host's `Agent` prototype, because that is the value the host's compaction and handoff call sites resolve. It keeps a configuration the user already set, hooks it without adding an export of its own, and supplies an inert configuration when there is none. No request is delayed, retried, rerouted, or rewritten, and no request content, summary, or handoff document is read or stored.
- One completed request writes one `model_usage` entry through the session manager's own API: the resolved purpose, the api, provider, and model that ran, the provider's token counts in the journal's shape, the provider's per-component cost when the host carries it, the stop reason read from that request's span, and the branch position of the request's session. The request's identity is a provider together with a model id, resolved through the session's model registry: the provider id the estimator path reports before telemetry normalization when the host reports one, and otherwise only a catalog that offers this model id under exactly one provider. The event's provider is a telemetry label that several provider ids can normalize to, so it is never accepted as an identity by itself, and the provider written is the resolved provider id. A resolution that names another provider, that picks one of two providers serving the same model id, or that rests on a label matching a registered provider, is rejected rather than written.
- Four purposes are in scope: `compaction:summary`, `compaction:short-summary`, `compaction:turn-prefix`, and `compaction:handoff`, resolved from the oneshot kind the host stamps on the request's own span. The list is closed; `compaction_native`, `branch_summary`, and every non-compaction kind write nothing.
- An attempt that consumed no token writes nothing. A request whose session is not live in this process, or whose identity this process cannot resolve to that request's own model, writes nothing and is counted in `/qol` rather than given a guessed api. A request whose provider cost never reached the estimator path is written with a zero cost and counted; this component never estimates a price of its own.
- The patch is process-wide and held in one registry slot. One installer owns it; a later activation of this runtime or another registers its own session with the installed patch and installs nothing. A session that switches its journal keeps its place: the target follows the session manager's current id, and the id it left is dropped. An activation whose settings could not be read or were rejected stops a patch another activation installed and installs nothing itself.
- A host that exports `compactionRequestUsage` from `@oh-my-pi/pi-agent-core` records these requests itself. The adjustment reads that export on activation and stays inactive with `host-records-usage`, so a released fix stops the compensation instead of doubling its entries. Removing this capability follows the upstream re-check in the adjustments documentation and a decision that records the removal.

### Model prompt rules

The model prompt module is a switch-gated adjustment: the native boolean `modelPromptsEnabled`, defaulting to `false` and subordinate to `enabled`, governs rule reads, appends, and unused-file diagnostics, and an invalid value disables that module alone while a rejected settings object follows the component-wide rule.

A covered turn resolves the user and project `model-prompts` directories, applies the documented rule-file format and matching semantics, and appends each match as an independent block after the incoming blocks without mutating the input. Rules and the effective model are read anew each turn, and no model, no rules, or no match leaves the prompt unchanged.

A file failure affects one file and a directory failure one directory; a rule diagnostic carries a fixed reason and a scope-relative source, deduplicated by session, source, and reason, and discloses no body, absolute path, raw parser error, regex source, or conversation content.

Ordinary main and child turns that run `before_agent_start` are covered, children matching their own effective model and keeping their roles, and project rules may become system instructions without a trust gate, security isolation, regex sandbox, or body size limit. When OMP offers model-scoped instructions, the capability is re-checked before it is retained, narrowed, or removed.

[projects/omp-qol/README.md](../../projects/omp-qol/README.md#model-prompt-rules) states the complete rules, the switch and settings behavior, and the diagnostics.

## Invariants

- Preserve every unrelated setting's key, default, range, and validation. The three remote settings `compactionCacheEnabled`, `compactionCacheProvider`, and `compactionCacheMode` are absent and rejected as unknown keys; no runtime compatibility path remains.
- `waitMessagesSeconds` and `waitProcessSeconds` have no effect on supported hosts. The English and Chinese documentation and the manifest setting descriptions say so.
- Wait continuation serves only the standalone `wait` entry. A missing, foreign, or unrecognized entry leaves native behavior in place and reports a bounded reason.
- The compaction deadline patch keeps its ownership checks. It refuses to coexist with a patch carrying the `Symbol.for("ruokee.omp.compaction-timeout.patched")` marker, and a later matching activation does not take over an existing owner.
- The compaction usage adjustment writes only the four in-scope purposes, only for requests that consumed tokens, and only with an api its session's registry resolved. Compaction and handoff requests keep their own timing, routing, and content.
- A `model_usage` entry written by this component carries the same shape the host writes for its own side requests, so the host's session statistics count it on the active branch; appends follow the session the request belonged to.
- The compaction usage patch keeps its ownership checks: one registry slot, one installer, a refusal for a slot this version cannot read or an accessor another extension replaced, and a release that restores the accessor it replaced.
- A host that records these requests itself leaves the adjustment inactive and reports the bounded reason. Retirement of the capability waits for verified native recording, and then removes its code, settings, documentation, and tests.
- Configuration comes only from OMP plugin settings and is read once per activation.
- A fault in one adjustment does not disable the others. A rejected setting is named by key and rule without echoing its value.
- Every code path the component keeps serves OMP 18.5.0 and later, including the wait path for the standalone `wait` entry.
- Recovery acts only on a main-session assistant error. Successful output that quotes an error does not trigger it; disabled switches or missing required host interfaces retain native behavior.
- Safety exclusions and the terminal 4xx rule take precedence over both modes and the interruption mark. The recovery module classifies a copy without changing the original assistant error.
- The existing per-chain continuation budget and doubling backoff apply across model runs. Only returned continuations consume budget; duplicate stop events for the same run and turn schedule no extra wait or continuation. The host cap applies independently.
- Normal completion, an out-of-scope error, or cancellation ends the chain. A later independent chain starts with fresh budget. A session switch, shutdown, new run, or invalidated chain prevents an old pending wait from continuing.
- Recovery uses the existing fixed continuation text, asks the model to check completed work and side effects, and includes no provider error body, command, or tool output. OMP retains ownership of history, tool scheduling, and approvals.
- Recovery notifications follow the existing switch and show the attempt and delay. `/qol` reports effective state and settings without starting a model run.

## Host lower bound

OMP `18.5.0`, declared in [Compatibility](../../projects/omp-qol/README.md#compatibility). The `@oh-my-pi/*` development dependencies are locked at `18.5.0`, and tests use that host's behavior as their baseline. The general rules are in [.agents/spec/host-compatibility.md](./host-compatibility.md).

## Acceptance criteria

- `bun run typecheck` and `bun test` pass in the component directory.
- Unrelated settings retain their keys, defaults, ranges, and validation. All three retired remote keys trigger the existing unknown-key rejection rather than configuring an adjustment.
- The descriptions of `waitMessagesSeconds` and `waitProcessSeconds` state that they have no effect.
- A real maintained-host CLI session that compacts through `soft` writes one entry per summarization request that run issued, and a session that performs a handoff writes one for its request, each carrying the provider's tokens, per-component cost, api, provider, and model; the host's own session statistics include those entries with a delta equal to what was written. Requests the run did not issue produce no entry. A session that compacts after switching its journal, through `/new` or a resume, keeps writing entries, in the journal it switched to.
- Behavioral checks cover the purpose table, the zero-token and non-compaction skips, the single-use cost claim, every refusal reason, preservation of a user tracer and the user's own hooks, the inert tracer, the registry's accessor identity, the identity resolution of a request's own model, the provider written for a request, a session that switches its journal, and the `/qol` line. A cancelled, failed, or zero-token attempt produces no entry, and an off switch installs no configuration and writes nothing.
- Each adjustment's real OMP CLI evidence is recorded under its verification section in [projects/omp-qol/docs/adjustments.md](../../projects/omp-qol/docs/adjustments.md), with unrun scenarios marked as not verified.
- A real OMP CLI run on a maintained host demonstrates automatic continuation after an eligible upstream stream closure in the same main session, with default recovery settings and no intervening user message. Native retries alone or an enabled `/qol` line do not prove this behavior.
- Behavioral checks cover the reported error's authentic host fields under the default mode. Reproducing its exact wording in a new real session is not a development prerequisite; an unrun exact-error scenario remains documented as not verified.
- The same fault with recovery disabled yields no QoL continuation. A real TUI run shows the attempt and delay, and cancellation during that wait prevents continuation.
- Behavioral checks cover both modes, marked and unmarked statusless errors, safety precedence, independent caps, backoff, cross-run chains, duplicate events, invalidated waits, switches, notifications, and the unchanged error and fixed-context boundaries.
- Real maintained-host CLI requests prove QoL alone injects matching bodies after explicit enablement, with default/master/module-off runs showing no injected rules or unused-file diagnostics. Behavioral checks prove zero reads in those states and unchanged independently enabled modules.
- Behavioral checks cover every matching key, case sensitivity, complete ids containing `/`, OR-once semantics, ignored top-level metadata, strict entry keys, discovery filters, user/project ordering, same-name sources, and identical bodies retained independently.
- Real request observations and behavioral checks preserve incoming blocks, tools, dynamic content, BOM exclusion, and byte-exact bodies. Continuous turns, file additions/edits/deletions/repairs, a model switch, and a native mid-turn rebuild satisfy refresh and no-accumulation/no-duplication.
- Checks cover missing model/no match, invalid files, file/directory read failures, unexpected handler errors, diagnostic privacy and session/context deduplication, module-local and global settings rejection, restart-only settings, and next-turn file changes. Actual `/qol` TUI shows default-off and enabled state without a model run.
- Ordinary child Provider-facing requests retain the child's own model, role, and independent blocks. Unrun bypasses remain explicitly unverified.
- Component descriptions, manifests, root guidance, paired documentation, and current project Specs agree on ownership and approaching deprecation. Preserve all remaining adjustments and every unrelated valid requirement.

## Related ADRs

- [OMP QoL](../adr/decision/2026/09/20-omp-qol.md)
- [Model prompt rules](../adr/decision/2026/09/14-model-prompt-rules.md)
- [Compaction usage](../adr/decision/2026/10/13-compaction-usage.md)
- [Host maintenance](../adr/decision/2026/09/28-host-maintenance.md)
- [Component self containment](../adr/decision/2026/08/24-component-self-containment.md)
