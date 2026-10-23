# Compaction usage

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash
Archived: 2026-10-22
Reversed by: [Compaction usage](../../../decision/2026/10/13-compaction-usage.md)

English | [中文](./13-r1-compaction-usage.zh.md)

## Motivation

Record the token usage and cost of OMP's own compaction and handoff requests in the session journal, as one adjustment of [omp-qol](../../../../../projects/omp-qol/README.md), until a released OMP version records them itself.

OMP sends its own summarization requests when a session compacts: the `soft` method's summary, short-summary, and turn-prefix calls and the `handoff` method's request. The provider bills every one of them and reports the usage to the host, but the value ends at the summarization call. No `model_usage` entry is written, and the session statistics that read those entries miss it, so a session file understates what the session cost and every report, budget, or quota view built on those statistics is wrong by the number of compactions the session performed.

Upstream tracks the gap as [issue #15031](https://github.com/can1357/oh-my-pi/issues/15031) and fixes it in [pull request #15034](https://github.com/can1357/oh-my-pi/pull/15034).

## Analysis

The numbers the host needs are already flowing through its telemetry channel, and that channel is off in a default installation. Every local compaction and handoff request goes through one instrumented completion wrapper that starts a chat span, stamps that request's oneshot kind on it, and emits a chat-usage event carrying the usage snapshot and the response finish reasons. The compaction and handoff sites resolve the telemetry configuration from the agent before each call and find none unless the user configured telemetry, so a default installation produces neither span nor event. That channel is therefore the only public route to these numbers, and activating it changes host behavior: with a configuration present, the host creates a span and runs hook paths for model steps it otherwise skips.

Three properties of the channel shape the compensation. A cancelled or failed attempt still emits an event, with an all-zero snapshot and an error finish reason, so a writer without a filter records zero-usage noise. A usage snapshot is not enough to write an entry, because the journal also stores the api that ran, which only the session's model registry can resolve from the provider and served model the event names. And no route reaches the request itself, so an attempt that was retried away inside the wrapper cannot be recovered.

The retirement surface is runtime-visible. [Pull request #15034](https://github.com/can1357/oh-my-pi/pull/15034) records these requests in the host and exports `compactionRequestUsage` from `@oh-my-pi/pi-agent-core` for that purpose, and the package root re-exports it, so an adjustment can recognize such a host by reading that export rather than inferring it from a version number.

## Decision

### Public configuration

The component gains one adjustment, the sixth of [omp-qol](../09/20-r9-omp-qol.md). Its public contract is one native OMP setting, `compactionUsageEnabled`, boolean, defaulting to `true`, subordinate to the component's master switch. It is independently switchable, rejected or reported by the existing settings rules, and read in the same activation snapshot as every other key, so a change applies at the next OMP start.

Its effect: a completed compaction or handoff request appears in the session's usage entries and in the statistics the host derives from them.

### Where it attaches

The adjustment replaces the `telemetry` accessor on the host's `Agent` prototype, which is the value the compaction and handoff sites resolve before each call; the module owns that accessor for the process and restores it when it releases the patch, as the compaction deadline adjustment owns its own seam.

An existing user configuration is preserved: its tracer, its cost estimator, and its chat-usage hook keep serving every request they served, and the adjustment adds nothing to the export. With no configuration, the adjustment supplies an inert one, whose tracer creates the spans the host would create, records the three attributes this module reads, and exports nothing.

A request is identified by the oneshot kind the host stamps on the span of that request alone, obtained from the wrapper this module puts around the tracer. The adjustment reads nothing else from the span and never reaches into the request, the model, the cache key, the history, or the session file.

### What is recorded

Four oneshot kinds are in scope: the `soft` summarization kinds and `handoff`, mapped to the purposes `compaction:summary`, `compaction:short-summary`, `compaction:turn-prefix`, and `compaction:handoff`, which are the purposes the upstream fix resolves. The list is closed: `compaction_native` and `branch_summary` are requests of the same family that the fix does not record either, and every other kind the host labels belongs to a caller whose usage the host already accounts for.

One completed request writes one usage entry through the session manager's own API, on the branch of the session the request belonged to, with the resolved purpose, the api, provider, and model that ran, the provider's token counts, and the provider's per-component cost when the host carries it. The entry has the shape the host writes for its own side requests, which is what makes the session statistics count it.

An attempt that consumed no tokens writes nothing, so a cancelled or failed attempt adds no zero-usage noise. A request whose session is no longer live in this process, or whose api the process cannot resolve, writes nothing and is counted instead, because a guessed api or a missing entry is visible while a wrong one looks repaired; the provider's cost is never estimated by this component.

### Retirement

The adjustment is a compensation with a defined end. It reads the native recording export on activation and stays inactive with a reason on a host that records these requests itself, so a released fix stops the compensation instead of doubling its entries. The component documentation carries an upstream re-check section, like the one for [model prompt rules](../09/14-r3-model-prompt-rules.md), that names the surface to check. When a published OMP version records these requests itself, the adjustment's code, settings, documentation, and tests are removed, the component specification drops the capability, and a decision records the removal.

## Alternatives considered

None

## Consequences

- Attaching a telemetry configuration changes host behavior. With a configuration present, the host creates a chat span and runs hook paths for model steps it otherwise skips, adding work to every request and sending content attributes to the export the user already configured. The inert configuration and the tracer wrapper keep the export empty and read only the oneshot kind, and the accepted price is the wrapper's own work on the compaction and handoff requests that previously short-circuited.
- Usage can be attributed to the wrong request or the wrong branch. If an event's span is not the span whose kind was read, the tokens and cost written describe another request; if an entry does not land on the branch the request belonged to, it stays invisible to the statistics it was meant to correct. Either way the session total is wrong while `/qol` reports an active state, so the kind is read from the event's own span, an unknown span writes nothing, and the branch position is read at the write.
- Once the host records these requests itself, an adjustment left enabled records them a second time and inflates token counts and cost. The retirement check and the state `/qol` reports are the guard until the code is removed.
- The adjustment's entries sit before the compaction they belong to and are counted by the host's own active-window rule, so a future change to that rule can drop them from the totals without any error, which is why the real-CLI evidence records the host's own statistics delta and not only the written entries.
- Provider cost depends on a host field that arrived after the component's declared lower bound. A host that stops stamping the kind or hands the event a span this module did not see makes the adjustment write nothing. Component documentation records each unverified scenario rather than implying a continuous range of hosts.
