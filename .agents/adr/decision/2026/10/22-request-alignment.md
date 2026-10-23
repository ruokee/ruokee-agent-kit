# Request alignment

Decision owner: Ruokee
Decision writer: OMP gpt-6-astra
Reverses: [smart-cache](../../../archived/2026/10/12-r1-smart-cache.md)

English | [中文](./22-request-alignment.zh.md)

## Motivation

Maintain request-alignment coordination separately from the package's other state owners.

The package contains capabilities that do not rewrite the same requests. Applying the alignment coordinator to journals, accounting, or model rules would join unrelated lifecycles. This independent topic extracts the shared mechanism from the archived smart-cache decision while the [package successor](./12-smart-cache.md) retains the component identity.

## Decision

### Shared ownership

Use one process coordinator, independent per-session registrations, immutable observations of one confirmed ordinary dispatch, and one owned wrapper per native method. Each alignment capability interprets those facts and proves its own eligibility under its own protocol. At most one capability rewrites a physical request. Refusal or an unavailable interface in one capability leaves unrelated valid capabilities and sessions working.

Preserve factory-time construction observation before session activation. Explicitly bind the actual session, model, dispatch, signal ancestry, epoch, and coordinator generation. Similar text, timing, model names, endpoints, or cache keys do not establish ownership. Every native operation captures an immutable reference, including a missing reference. Retries and late responses cannot upgrade or revive an invalidated operation.

### Lifecycle

Navigation, compaction commits, cancellation, and release invalidate references under the capability contracts. Restore only still-owned functions and their original property shapes. Release shared resources after the last registration; a fresh registration may create a new coordinator generation, without reviving old operations. Keep only current references and snapshots reachable from live operations. Do not take over foreign wrappers or retain a growing completed-operation history.

### Native boundary

Ordinary requests remain unchanged. Reuse only proved sent results of the same ordinary dispatch. Never rerun context handlers, rebuild old output from current rules or Pins, or implement a replacement serializer. OMP retains scheduling, preparation, credentials, retries, fallback, result adoption, history commits, and continuation.

Alignment registers no `session_before_compact`, replaces no manual compaction entry, and neither vetoes a request nor bypasses another extension's veto. It adds no credential request or retry, fabricates no summary, and changes no other extension's settings. These restrictions govern request alignment, not unrelated context modules.

### Capability boundaries

[Remote](./10-remote-alignment.md) and [Handoff](./12-handoff-alignment.md) retain their algorithms, settings, reason codes, and benefit evidence. They share no protocol or payload-shape rules. Pin journals, usage telemetry, and model-rule state are outside this mechanism. Do not add a general strategy registry or a new capability through this shared contract.

The [component Spec](../../../../spec/omp-smart-context.md) owns acceptance. Existing positive and refusal cases retain their independent switches and protocol behavior. Controlled integration must establish separate session references, at most one rewrite per request, no repeated context handler, irreversible operation invalidation, and ownership-conditional release.

## Alternatives considered

None

## Consequences

A shared wrapper or identity error can affect several alignment capabilities or attribute another session's content. Immutable per-session references and atomic candidate proof remain necessary even when the package contains other context features.
