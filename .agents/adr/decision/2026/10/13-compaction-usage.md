# Compaction usage

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash
Reverses: [Compaction usage](../../../archived/2026/10/13-r1-compaction-usage.md)

English | [中文](./13-compaction-usage.zh.md)

## Motivation

Record OMP's soft compaction and Handoff usage in the session journal through [smart-context](./12-smart-cache.md) until verified native recording replaces the compensation.

OMP sends its own summarization requests when a session compacts: the `soft` method's summary, short-summary, and turn-prefix calls and the `handoff` method's request. The provider bills every one of them and reports the usage to the host, but the value ends at the summarization call. No `model_usage` entry is written, and the session statistics that read those entries miss it, so a session file understates what the session cost and every report, budget, or quota view built on those statistics is wrong by the number of compactions the session performed.

Upstream tracks the gap as [issue #15031](https://github.com/can1357/oh-my-pi/issues/15031) and fixes it in [pull request #15034](https://github.com/can1357/oh-my-pi/pull/15034).

## Analysis

The numbers the host needs are already flowing through its telemetry channel, and that channel is off in a default installation. Every local compaction and handoff request goes through one instrumented completion wrapper that starts a chat span, stamps that request's oneshot kind on it, and emits a chat-usage event carrying the usage snapshot and the response finish reasons. The compaction and handoff sites resolve the telemetry configuration from the agent before each call and find none unless the user configured telemetry, so a default installation produces neither span nor event. That channel is therefore the only public route to these numbers, and activating it changes host behavior: with a configuration present, the host creates a span and runs hook paths for model steps it otherwise skips.

Three properties of the channel shape the compensation. A cancelled or failed attempt still emits an event, with an all-zero snapshot and an error finish reason, so a writer without a filter records zero-usage noise. A usage snapshot is not enough to write an entry, because the journal also stores the api that ran, which only the session's model registry can resolve from the provider and served model the event names. And no route reaches the request itself, so an attempt that was retried away inside the wrapper cannot be recovered.

The retirement surface is runtime-visible. [Pull request #15034](https://github.com/can1357/oh-my-pi/pull/15034) records these requests in the host and exports `compactionRequestUsage` from `@oh-my-pi/pi-agent-core` for that purpose, and the package root re-exports it, so an adjustment can recognize such a host by reading that export rather than inferring it from a version number.

## Decision

### Public configuration

`compactionUsageEnabled` is an independent native boolean setting in smart-context, defaulting to `true`, with no master switch. Read it in the package's activation snapshot; changes apply at the next OMP start. Invalid module settings disable only this capability. `/smart-context` reports its effective state and fixed reasons without starting a model turn or exposing request content.

Its effect: a completed compaction or handoff request appears in the session's usage entries and in the statistics the host derives from them.

### Where it attaches

The adjustment replaces the `telemetry` accessor on the host's `Agent` prototype, which the compaction and handoff sites resolve before each call. Its process-wide registration and ownership-conditional accessor release remain independent of alignment wrappers, journals, and model-rule state.

An existing user configuration is preserved: its tracer, its cost estimator, and its chat-usage hook keep serving every request they served, and the adjustment adds nothing to the export. With no configuration, the adjustment supplies an inert one, whose tracer creates the spans the host would create, records the three attributes this module reads, and exports nothing.

A request is identified by the oneshot kind the host stamps on the span of that request alone, obtained from the wrapper this module puts around the tracer. The adjustment reads nothing else from the span and never reaches into the request, the model, the cache key, the history, or the session file.

### What is recorded

Four oneshot kinds are in scope: the `soft` summarization kinds and `handoff`, mapped to the purposes `compaction:summary`, `compaction:short-summary`, `compaction:turn-prefix`, and `compaction:handoff`, which are the purposes the upstream fix resolves. The list is closed: `compaction_native` and `branch_summary` are requests of the same family that the fix does not record either, and every other kind the host labels belongs to a caller whose usage the host already accounts for.

One completed request writes one `model_usage` entry through the session manager's own API, on the branch of the session the request belonged to, with the resolved purpose, actual api, provider, model and stop reason, the provider's token counts, and the provider's per-component cost when the host carries it. The entry has the shape the host writes for its own side requests, which makes the session statistics count it. Do not invent an API, Provider, or price.

An attempt that consumed no tokens writes nothing, so a cancelled or failed attempt adds no zero-usage noise. A request whose session is no longer live in this process, or whose api the process cannot resolve, writes nothing and is counted instead, because a guessed api or a missing entry is visible while a wrong one looks repaired; the provider's cost is never estimated by this component.

### Retirement

Read the native `compactionRequestUsage` export on activation and stay inactive with a reason when the host records these requests itself, preventing duplicate entries. The [usage Spec](../../../../spec/omp-smart-context/usage.md#native-replacement) owns the native recording and statistics behavior to verify. Merge of PR #15034 triggers that recheck; it is not proof that a particular installed host records usage correctly.

Once verified published native behavior replaces compensation, remove this module's code, setting, status, documentation, and checks, update its decision and the capability inventory, and retain historical journal entries. Do not remove request alignment or reverse the package contract solely because this capability retires.

### Migration

Remove the QoL implementation, registration, stop path, status, and `compactionUsageEnabled` setting. Clear that key from both user and project QoL settings. Preserve the old effective `enabled && compactionUsageEnabled` result in smart-context, resolving project overrides before calculating it. The new default must not enable accounting previously disabled by QoL's master switch. Preserve unrelated settings and restart; add no fallback reader or automatic configuration edits.

### Acceptance

Use repository checks and controlled requests through the actual candidate and locked host accounting. Verify one entry per in-scope token-consuming request, correct session identity, preserved user telemetry, supplied Provider cost, excluded and zero-token requests, native auto-disablement, and the host's statistics delta. Preserve historical real-CLI evidence with its actual conditions; it is not an integration gate. This replaces QoL ownership, master-switch dependence, and the inherited real-CLI gate without changing the four-purpose or data contract.

## Alternatives considered

None

## Consequences

- Attaching a telemetry configuration changes host behavior. With a configuration present, the host creates a chat span and runs hook paths for model steps it otherwise skips, adding work to every request and sending content attributes to the export the user already configured. The inert configuration and the tracer wrapper keep the export empty and read only the oneshot kind, and the accepted price is the wrapper's own work on the compaction and handoff requests that previously short-circuited.
- Usage can be attributed to the wrong request or branch. If an event's span differs from the span whose kind was read, the entry describes another request; if it lands on another branch, the intended statistics miss it. Totals can therefore be wrong while `/smart-context` reports an active state. Read the kind from the event's own span, skip unknown spans, and resolve branch position when writing.
- Once the host records these requests itself, compensation left enabled inflates tokens and cost. Native detection and `/smart-context` state guard against duplication until removal.
- Entries precede their compaction and depend on the host's active-window accounting. A host change can omit them from totals without rejecting the journal entries, so controlled acceptance observes the host's statistics delta as well as the records.
- Provider cost depends on a host field that arrived after the component's declared lower bound. A host that stops stamping the kind or hands the event a span this module did not see makes the adjustment write nothing. Maintenance evidence records each unverified scenario rather than implying a continuous range of hosts.
- Leaving removed keys in either QoL settings scope rejects its whole configuration. Copying module values without the former master-switch result can unexpectedly enable accounting.
