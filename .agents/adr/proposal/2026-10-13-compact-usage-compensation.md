# ADR proposal: Compensate compaction request usage in QoL

Draft owner: Ruokee
Draft writer: OMP DeepSeek V4.1 Flash

English | [中文](./2026-10-13-compact-usage-compensation.zh.md)

## Motivation

Add a switchable adjustment to [omp-qol](../../../projects/omp-qol/README.md) that records the token usage and cost of the host's compaction requests until OMP records them itself.

OMP sends its own summarization requests when a session compacts: the `soft` method's summary, short-summary, and turn-prefix calls, and the `handoff` method's request. The provider reports usage for every one of these requests, but the value ends at the summarization call. The session's `model_usage` entries and the session statistics that read them miss compaction requests entirely, so a session file understates what the session cost, and any report, budget, or quota view built on those statistics is wrong by the number of compactions the session performed.

Upstream tracks the gap as [issue #15031](https://github.com/can1357/oh-my-pi/issues/15031) and fixes it in [pull request #15034](https://github.com/can1357/oh-my-pi/pull/15034). On 2026-10-13 that pull request is open and unmerged, and the newest published `@oh-my-pi/pi-coding-agent`, 18.10.3, does not contain the fix.

## Analysis

The host exposes the usage through its telemetry channel, and the channel is off in a default installation.

Verified in the host source at `18.5.0`, the component's declared lower bound, and again on the installed `18.8.3`: every local compaction and handoff request goes through one instrumented completion wrapper in `@oh-my-pi/pi-agent-core` that starts a chat span, marks it with that request's oneshot kind, and emits a chat-usage event carrying the usage snapshot and the response finish reasons. The compaction sites in the coding agent and the handoff site resolve the telemetry configuration from the agent before each call, and that configuration is `undefined` unless the user configured telemetry, so a default installation produces no span and no event. The session manager already owns an entry type for a model call that does not belong in the conversation transcript, and the host's own session statistics count such an entry when it is written on the active branch before the compaction entry lands.

Verified on a real `18.8.3` CLI with a stub provider that reports unique token counts: a soft compaction and a handoff each produced a usage event carrying the expected kind, the provider's prompt, cached, and completion tokens could be reconstructed from the snapshot, the provider's per-component cost was available, and entries written from those events were counted by the host's session statistics with a delta equal to the entry.

Three constraints shape the adjustment. A cancelled or failed attempt still emits an event, with an all-zero snapshot and an error finish reason, so a writer without a filter records zero-usage noise. The host creates a span for every model step as soon as a telemetry configuration exists, so the injected configuration has to stay inert. And no route reaches the request itself: no event or hook carries the usage, the request function is a private per-instance field captured at construction, and the module-level completion symbol cannot be rewritten, so an attempt retried away inside the wrapper cannot be recovered.

## Proposal

### One adjustment

The component gains one adjustment, `compactionUsageEnabled`, default on, independently switchable under the existing master switch and rejected or reported by the existing settings rules. Its effect: completed compaction and handoff requests appear in the session's usage entries and in the statistics the host derives from them.

### Where it attaches

The adjustment installs a telemetry configuration where the host reads the agent's, and preserves whatever is already there: an existing exporter configuration keeps its tracer, its hooks, and its output, and the adjustment adds nothing to an export. When no configuration exists, the adjustment supplies an inert one. To identify a request, the adjustment observes the oneshot kind that the host writes on the request's own span; it reads nothing else from that span and never reaches into the request, the model, the cache key, the history, or the session file.

### What is recorded

For each completed compaction or handoff request, the adjustment writes one usage entry through the session manager's existing usage entry API, with the resolved purpose for that kind, the api, provider, and model that ran, the provider's token counts, the provider's per-component cost, and the branch position that makes the entry part of the session the request belonged to. Compaction and handoff kinds are an explicit allowlist; the other oneshot kinds the host labels, such as evaluation completions, skill descriptions, and image questions, are out of scope.

An attempt that produced no tokens, ended in an error, or was cancelled writes nothing. A request the host has already recorded natively writes nothing. No request is delayed, retried, rerouted, or rewritten, and no model content is read or stored.

### Retirement

The adjustment is a compensation with a defined end. It detects the host's native recording of these requests and keeps itself inactive with a reason on such a host, and the component documentation carries an upstream re-check section, like the one for model prompt rules, that states the checked surface. When a published OMP version records compaction and handoff usage itself, the adjustment's code, settings, documentation, and tests are removed, the component specification drops the capability, and a decision records the removal.

### Documentation, specification, and version

The implementation change adds the adjustment to the [adjustments documentation](../../../projects/omp-qol/docs/adjustments.md), the README adjustment and settings tables, the `/qol` status report, and the `package.json` settings manifest, and updates the [component specification](../../spec/omp-qol.md) goals, public surface, invariants, and acceptance criteria. The component's `Z` version increases with the change.

## Alternatives considered

None

## Acceptance criteria

1. With the adjustment on against a maintained host, a real OMP CLI session that compacts through the `soft` method and one that performs a handoff each produce a usage entry for every completed summarization request, carrying the provider's token counts and per-component cost, and the host's own session statistics include those entries with a delta equal to what was written.
2. An attempt that was cancelled, failed, or reported zero tokens produces no usage entry, so a session whose summarization requests all fail gains no entries.
3. With the adjustment off, no telemetry configuration is installed, no usage entry is written, and no additional span is created.
4. An existing telemetry configuration keeps its tracer, hooks, and exported output, and the adjustment adds no exported span or event of its own.
5. `/qol` reports the adjustment's effective state and, when it is inactive, a bounded reason; settings validation of every other key is unchanged, and an unknown key, a wrong type, or an out-of-range value behaves as it does today.
6. Behavioral checks cover the request kinds in scope, ignored kinds, all-zero and error attempts, a missing host surface, and preservation of an existing telemetry configuration. The adjustment's real CLI evidence is recorded under its version and verification section in the adjustments documentation, with unrun scenarios marked as not verified.
7. The README tables, the settings manifest, the adjustments documentation, and the component specification agree on the adjustment's key, default, scope, limits, and retirement condition, and the specification keeps the existing host lower bound.
8. The upstream re-check section names the host surface that retires the adjustment and what the next check looks for.
9. `bun run typecheck` and `bun test` pass in the component directory, the proposal is removed from `proposal/`, the resulting decision is created, and every inbound link resolves.

## Risks

- Attaching a telemetry configuration changes host behavior: with a configuration present, the host creates a chat span and runs hook paths for model steps it otherwise skips, adding work to every request and sending content attributes to the export the user already configured. The adjustment supplies an inert configuration of its own, adds nothing to an existing export, and keeps only the oneshot kind of the request it needs.
- Usage can be attributed to the wrong request or the wrong branch. If an event's span is not the span whose kind was read, the tokens and cost written describe another request; if the entry does not land on the branch the request belonged to, it stays invisible to the statistics it was meant to correct. Either way the session total is wrong while the adjustment reports an active state, so the kind is read from the event's own span, an unknown span writes nothing, and the branch position is read at the write.
- Once the host records these requests itself, an adjustment left enabled records them a second time and inflates token counts and cost. Retirement detection and the state `/qol` reports are the guard until the code is removed.
- A temporary compensation can outlive its condition: kept across host releases, it can attach to surfaces that have moved, fail silently, and report an inactive state while the user believes their session accounting is complete. The version note, the bounded reasons in `/qol`, and the upstream re-check section keep that overlap visible.
