# omp-smart-context

English | [中文](./README.zh.md)

## Goals

Maintain the self-contained native OMP package `@ruokee/omp-smart-context` under `projects/omp-smart-context`. Provide independently switchable context capabilities while preserving their scope, state ownership, failure boundaries, and native host behavior.

Replace smart-cache, standalone context-pin, and QoL's migrated usage and model-rule implementations. Keep one implementation owner per migrated capability. QoL's remaining adjustments retain their behavior, settings, defaults, and validation.

## Out of scope

- New compaction strategies, strategy frameworks, retries, models, observers, role instructions, or automatic Pin maintenance.
- Guaranteed Provider cache residency, hit rates, or savings.
- Automatic installation, user-configuration changes, rewriting existing journals, compatibility aliases, or cross-component runtime dependencies.
- Real-model calls, Provider benefit measurements, or a complete CLI/TUI matrix as integration prerequisites.

## Public surface

Use one native extension entry and OMP-native package settings, without a master switch or a separate configuration file. The settings are:

- `compactionCacheEnabled`: boolean, default `false`.
- `compactionCacheProviderFilter`: string, default `""`, an exact eligibility filter for the current model's Provider, not a model or route selector.
- `compactionCacheMode`: `standard` or `hooks`, default `hooks`.
- `handoffCacheEnabled`: boolean, default `false`.
- `compactionUsageEnabled`: boolean, default `true`.
- `modelPromptsEnabled`: boolean, default `false`.
- `pinEnabled`: boolean, default `false`.

`/smart-context` is read only and starts no model turn. Report each capability's effective state and fixed inactive reason. Alignment reports independent stages and bounded counts for logical operations, physical sends, retries, aligned sends, rewrites, and refusals; refused requests remain in the denominator. Separate reference confirmation, operation binding, candidate validation, and actual sending. Identifiers used in these reports are session-local counters. Usage reports live registry state, entry count, missing-cost count, and unresolved-identity count. Model rules and Pin report enabled, disabled, invalid, or incompatible state.

Reports expose no bodies, opaque history, credentials, raw endpoints, private paths, rule text, or dynamic private identifiers.

### Capability specifications

- [Request alignment](./request-alignment.md) owns ordinary references, session isolation, coordination, invalidation, and release.
- [Remote](./remote.md) owns Remote applicability, filtering, modes, and reuse requirements.
- [Handoff](./handoff.md) owns the two supported API contracts.
- [Usage](./usage.md) owns request identity, accounting, costs, and native replacement.
- [Model prompt rules](./model-prompts.md) owns discovery, input format, matching, refresh, injection, and diagnostics.
- [Pin](./pin.md) owns user and tool behavior, records, identity, capacity, projection, and persistence.

Each sub-specification owns its invariants and acceptance. User guides explain operation; they are not normative dependencies of this specification set. Source investigations and candidate validation records belong in maintenance materials, not specifications or user instructions.

## Invariants

### Configuration

OMP merges project overrides over user values. Read and validate one effective activation snapshot. Missing keys take defaults. Restart applies setting changes; navigation and new sessions do not refresh an existing activation. Rule files refresh separately on each covered turn.

A module-key error disables only that module. Unknown keys, a non-object settings root, or a failed settings getter reject the whole component configuration. Report fixed reasons without rejected values. Repeated activation does not duplicate registration.

### Ownership

Code, manifest, dependencies, checks, and paired user documentation remain inside the distributable component. Host peers are direct and unrestricted. Maintain independent state and failure boundaries, without a shared context store or general module framework. The request-alignment coordinator does not own Pin, usage, or model-rule state.

OMP retains history and compaction scheduling, preparation, adoption, and continuation. A failed or unavailable capability leaves unrelated valid capabilities usable. Adding a capability without changing common invariants does not require reversing unrelated decisions.

### Migration

Replace old smart-cache and standalone Pin registrations, including manual extension paths, then restart affected processes. Do not hot-transfer references or take over an old or foreign owner. Never read old package settings as a fallback.

Preserve smart-cache values and scope overrides. Move `compactionCacheProvider` to `compactionCacheProviderFilter` and remove the old key from both user and project smart-context settings; it is an unknown key, not an alias.

For each migrated QoL module, preserve the old effective `enabled && moduleEnabled` result. Resolve project overrides over old user settings before calculating project results. The old defaults are `enabled=true`, `compactionUsageEnabled=true`, and `modelPromptsEnabled=false`. Remove both migrated keys from user and project QoL settings; a leftover rejects the whole QoL configuration. Keep unrelated settings. Existing Pin users explicitly opt in to the new default-off switch. Existing rule files and supported records remain valid without conversion.

## Host lower bound

Maintain against OMP `18.5.0` with no upper maintenance bound. Lock development host dependencies to that floor and declare `@oh-my-pi/pi-agent-core`, `@oh-my-pi/pi-ai`, `@oh-my-pi/pi-coding-agent`, `@oh-my-pi/pi-tui`, and `@oh-my-pi/pi-utils` as peers with `*`. The floor is a maintenance commitment, not a runtime allowlist or installation gate. Missing capability interfaces disable their owner rather than unrelated modules.

## Acceptance criteria

- The actual entry loads using only its own dependencies and native configuration. Migrated capabilities have one owner; QoL neither installs nor stops their wrappers or injects their rules.
- Configuration overrides, defaults, activation snapshots, local errors, and whole-component rejection follow the requirements above. Restart-only settings and next-turn rule edits remain distinct.
- A controlled run through the actual entry and locked native libraries drives ordinary requests and native compaction preparation and serialization with deterministic local transport. Rules and Pin occur once, each physical request has at most one alignment writer, usage is not doubled, and each independent off state leaves other capabilities working.
- After committed compaction, ordinary continuation carries the latest Pin body verbatim, with no older revision placed after it. Direct invocation of the registered status handler causes no model request.
- Migration preserves effective opt-in intent, unrelated settings, supported records, and QoL's remaining behavior. No real user configuration or journal is rewritten by the extension.
- Manifest, version, component inventory, check selector, aggregate, bilingual documents, specifications, and effective ADRs agree. The unpublished first addition uses `0.1.0` throughout revisions.
- Record each exercised candidate, host version, inputs, observations, and limits. Keep historical evidence with its original owner and conditions. Source inspection, controlled integration, real-host behavior, and Provider measurements remain distinct evidence.

## Related ADRs

- [Context package](../../adr/decision/2026/10/12-smart-cache.md)
- [Request alignment](../../adr/decision/2026/10/22-request-alignment.md)
- [QoL boundary](../../adr/decision/2026/09/20-omp-qol.md)
- [Host maintenance](../../adr/decision/2026/09/28-host-maintenance.md)
- [Self-contained components](../../adr/decision/2026/08/24-component-self-containment.md)
