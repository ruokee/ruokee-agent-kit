# Compaction usage

Draft owner: Ruokee
Draft writer: OMP gpt-6-astra

English | [中文](./22-compaction-usage.zh.md)

## Motivation

Move soft and Handoff usage compensation from QoL to smart-context.

The [current decision](../../../decision/2026/10/13-compaction-usage.md) assigns accounting to QoL under its master switch. Accounting belongs with the context capabilities, but it observes completed usage and does not rewrite requests or share the alignment coordinator.

## Proposal

Continue the `13-compaction-usage` identity. Replace QoL ownership, master-switch dependence, and `/qol` reporting with smart-context ownership, independent `compactionUsageEnabled`, and `/smart-context` status. Keep the boolean default `true`, activation-snapshot semantics, module-local validation, and separate process-wide telemetry ownership.

Preserve the four purposes `compaction:summary`, `compaction:short-summary`, `compaction:turn-prefix`, and `compaction:handoff`. Do not extend accounting to `compaction_native`, `branch_summary`, or other requests. Each completed in-scope request with token consumption appends one `model_usage` through its session manager, using its own span identity and actual resolved API, Provider, model, token counts, stop reason, and host-supplied Provider cost. Preserve existing missing-identity handling and counters; never invent an API, Provider, or price. Zero-token requests write nothing.

Preserve the user's telemetry tracer, estimator, and callback. With no user telemetry, keep the existing inert configuration, which exports nothing. Do not read or retain request bodies, summaries, or Handoff documents, or change request content, routing, or timing. Keep registration and accessor release independent of alignment wrappers.

Preserve activation-time detection of `compactionRequestUsage`, reporting native recording and disabling compensation to prevent duplicate entries. Merge of [upstream PR #15034](https://github.com/can1357/oh-my-pi/pull/15034) triggers a recheck of actual native recording and session statistics. Once native behavior replaces compensation, remove this module, its setting, status, documentation and checks, and update its own decision and the capability inventory. Do not remove alignment or historical usage records, and do not change the package contract merely because one module retires.

Migration removes the implementation and both user- and project-level `compactionUsageEnabled` keys from QoL. Preserve its former effective `enabled && compactionUsageEnabled` result at each configuration scope; the new default must not enable accounting previously disabled by QoL's master. Remaining QoL settings stay intact. No runtime fallback or automatic user configuration writes are added.

Use repository checks and a controlled request through actual host accounting for acceptance, including the statistics delta. Replace the inherited real-CLI evidence requirement as an integration gate; retain historical evidence and state the actual host and conditions exercised.

## Alternatives considered

None

## Acceptance criteria

- Only smart-context installs or stops compensation; accounting remains independent of request rewriting.
- In-scope token usage reaches the owning session and host statistics once; zero usage, excluded requests, and native recording cause no duplicate entries.
- Existing telemetry callbacks and Provider cost data remain intact.
- Migrated effective switches preserve user intent, and QoL retains all unrelated behavior after removed keys are cleared.

## Risks

Telemetry wrapping still adds host work, and an identity or branch error can produce plausible but incorrect totals. Keeping the module after native replacement can double-count usage unless detection remains effective. Leaving removed keys in QoL can reject its entire configuration.

The host's active-window accounting can change without rejecting journal records, causing totals to omit them. Provider cost remains conditional on the host carrying that field; if request kind or span identity is no longer available, compensation records nothing rather than guessing.
