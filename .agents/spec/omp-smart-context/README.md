# omp-smart-context

## Goals

Provide the self-contained native OMP package `@ruokee/omp-smart-context`. Its independently switchable capabilities align Remote and Handoff requests with proved content from ordinary requests, supplement missing compaction usage, apply model-specific prompt rules, and retain explicitly pinned text across compaction.

This main specification covers package configuration, status, migration, isolation, and maintenance. The complete requirement set also covers shared request alignment, Remote, Handoff, usage, model prompt rules, and Pin as separate subjects.

Each migrated capability has one active owner. Replacing smart-cache, standalone context-pin, and QoL's usage and model-rule capabilities preserves their confirmed behavior. QoL's remaining adjustments retain their settings, defaults, validation, and behavior.

## Out of scope

- New compaction strategies, retries, models, observers, role instructions, or automatic Pin maintenance.
- Guaranteed Provider cache residency, hit rates, or savings.
- Automatic installation, user-configuration changes, journal rewriting, compatibility aliases, or cross-component runtime dependencies.
- Requiring real-model calls, Provider benefit measurements, or a complete CLI/TUI matrix for package integration.

## Public surface

### Configuration

OMP's native plugin manager loads the package and exposes its settings. There is no master switch or separate configuration file.

| Setting | Type or values | Default |
| --- | --- | --- |
| `compactionCacheEnabled` | boolean | `false` |
| `compactionCacheProviderFilter` | string | `""` |
| `compactionCacheMode` | `standard`, `hooks` | `hooks` |
| `handoffCacheEnabled` | boolean | `false` |
| `compactionUsageEnabled` | boolean | `true` |
| `modelPromptsEnabled` | boolean | `false` |
| `pinEnabled` | boolean | `false` |

The Provider filter exactly matches the current model's Provider identity. It determines eligibility for Remote repair, not model or route selection. An empty filter makes Remote alignment unavailable.

OMP project values override user values. Read and validate one effective activation snapshot; missing keys take defaults. Setting and registration changes require restarting OMP. Navigation or creating another session does not refresh an existing activation. Model-rule files refresh separately on each covered turn.

An invalid module key disables only its module. Unknown keys, a non-object settings root, or a failed settings read reject the entire component configuration. Report fixed reasons without echoing rejected values. Repeated activation does not duplicate behavior.

### Status

`/smart-context` is read-only, starts no model turn, does not reload settings, and does not repair ownership conflicts. Each capability reports its effective state and a fixed reason when inactive.

Remote and Handoff use these states:

- `disabled`, the capability is switched off.
- `unavailable`, invalid configuration, a missing required host interface, unconfirmed session identity, conflicting extension ownership, or another missing eligibility condition prevents use.
- `awaiting-reference`, no eligible ordinary reference is confirmed.
- `already-aligned`, the validated native request already has the required content.
- `rewritten`, a validated aligned request was sent.
- `rejected`, repair lacked the required proof and the complete native request was sent unchanged. This does not block, delay, or drop the request.

Separate `online`, `binding`, `candidate`, and `sending` to show availability, operation binding, candidate validation, and actual sending. Remote also reports `mode`. `dispatch`, `operation`, and `reference` are session-local counters, not model or Provider identifiers.

Report independent bounded counters for each alignment capability: `operations` counts logical operations; `sends` counts physical sends including retries; `retries` counts retry sends. `aligned` counts both already-aligned and successfully rewritten sends; `rewritten` is its body-changed subset. `rejected` counts sends left native after failed alignment validation, and these remain in the total denominator. Remote `reused` and `retained` describe only the latest send. Handoff `axes` and `unprojected` describe restored and unchanged dimensions. Count sends at actual transport, not at payload callbacks.

`compactionUsage`, `modelPrompts`, and `pin` report their own state and optional fixed reason, distinguishing enabled, disabled, invalid, and incompatible states. Before activation is ready, a pending state may be shown. Usage also reports the live process registration, entry count, missing-cost count, and unresolved-identity count. One inactive capability does not disable another.

Status exposes no bodies, opaque history, credentials, raw endpoints, private paths, rule text, or dynamic private identifiers. An aligned send, host adoption of a compaction result, and a Provider cache hit are different outcomes.

### Migration

Migration replaces old smart-cache and standalone Pin registrations, including manual extension paths, and restarts affected processes. It does not hot-transfer references or take over old or foreign ownership. Runtime configuration never falls back to old packages. `/smart-cache` has no alias; `/qol` continues to describe QoL's remaining adjustments.

Preserve smart-cache values and scope overrides. Rename `compactionCacheProvider` to `compactionCacheProviderFilter` and remove the old key from both user and project smart-context settings. The old key is unknown, not an alias.

For each migrated QoL capability, preserve its old effective `enabled && moduleEnabled` result. Resolve project overrides over old user values before calculating the project result. The old defaults are `enabled=true`, `compactionUsageEnabled=true`, and `modelPromptsEnabled=false`. Remove both migrated keys from user and project QoL settings; any leftover rejects the entire QoL configuration in versions without those modules. Keep unrelated keys, including the QoL master switch. Use a QoL version without duplicate migrated behavior.

Existing Pin users explicitly enable the new default-off switch. Existing rule locations, filenames, metadata, and bodies remain valid without conversion. Preserve session journals and `model_usage` entries. Supported Pin record version `2` and the identifiers `omp-context-pin`, `omp-context-pin-change`, and `omp-context-pin-result` retain their meanings. Entry ids, operation identities, revisions, and bodies replay unchanged; do not rename historical records.

Disabling Pin stops new retained-text messages without erasing records or ordinary history. Disabling usage stops future supplemental records without deleting past entries. Disabling model rules stops reading, injection, and unused-file diagnostics. Rule edits take effect at the next covered turn; switch changes require restart. The extension does not perform migration automatically.

## Invariants

The distributable component is independently installable and usable, with its own dependencies and documentation. Alignment, Pin, usage, and model rules retain independent state ownership and failure boundaries. No capability failure prevents unrelated valid capabilities from working.

OMP owns history, compaction scheduling, preparation, adoption, and continuation. Each physical request has at most one alignment writer. Rules and Pin do not appear twice through activation or integration, and usage is not double-counted. Cleanup releases only this component's owned resources and never takes over another extension's changes.

## Host lower bound

The minimum maintained OMP version is `18.5.0`, with no upper maintenance bound. This is a maintenance commitment, not an installation gate or runtime allowlist, and does not certify all later versions. Host dependencies are unrestricted peers. A missing capability interface disables only the affected capability.

## Acceptance criteria

- The actual package entry loads independently with native configuration. Each migrated capability has one owner; QoL neither activates nor stops it.
- Defaults, scope overrides, restart-only activation snapshots, local setting errors, and whole-configuration rejection satisfy the contract. Next-turn rule refresh remains distinct from settings refresh.
- A controlled run through the actual entry and maintained native libraries covers ordinary requests and native compaction preparation and serialization. It demonstrates single rule and Pin application, at most one alignment writer per physical request, no duplicate usage, and independent off states.
- After committed compaction, an ordinary continuation carries the latest Pin bodies verbatim, without an older revision placed after a newer body. Reading status produces no model request.
- Migration preserves opt-in intent, unrelated settings, supported records, and QoL's remaining behavior. The extension does not rewrite real user configuration or journals.
- Package declarations, paired documentation, specifications, and current decisions agree. The initial unpublished release is `0.1.0`.
- Validation material records the candidate, host version, inputs, observations, and limits. Historical evidence retains its original owner and conditions. Source inspection, controlled integration, real-host behavior, and Provider measurements remain distinct evidence.
