# Request alignment

Draft owner: Ruokee
Draft writer: OMP gpt-6-astra

English | [中文](./22-request-alignment.zh.md)

## Motivation

Give the existing request-alignment coordination rules their own decision.

The [smart-cache decision](../../../decision/2026/10/12-smart-cache.md#capability-model) applies a shared coordinator to every package capability. Context management also contains journals, accounting, and prompt rules that do not rewrite the same requests. Applying alignment ownership to those states would join unrelated lifecycles.

## Proposal

Extract an independent topic from smart-cache while its [package successor](./22-smart-context.md) keeps the original component identity. Record the source relationship to the replaced smart-cache version when implemented; this topic has its own identity date and archive sequence.

Preserve the existing shared process coordinator, per-session registrations, immutable observations of one confirmed ordinary dispatch, and one owned wrapper per native method. Each alignment capability proves its own eligibility and interprets shared observations under its own protocol. No physical request has more than one rewriting capability. A refusal or unavailable interface in one capability leaves unrelated valid capabilities and sessions working.

Preserve factory-time construction observation before session activation. Bind actual session, model, dispatch, signal ancestry, epoch, and coordinator generation. Similar text, timing, model names, endpoints, or cache keys do not establish ownership. Each native operation captures an immutable reference, including a missing reference. Retries and late responses cannot upgrade or revive an invalidated operation.

Navigation, compaction commits, cancellation, and release invalidate references under the capability contracts. Restore only still-owned functions and original property shapes, release shared resources after the last registration, and retain only current references and snapshots reachable from live operations. Do not take over foreign wrappers or keep a growing completed-operation history.

Ordinary requests remain unchanged. Reuse only the same ordinary dispatch's proved sent result; never rerun context handlers, rebuild old output from current rules or Pins, or implement a replacement serializer. Native OMP retains scheduling, preparation, credentials, retries, fallback, result adoption, history commits, and continuation.

Alignment registers no `session_before_compact`, replaces no manual compaction entry, and neither vetoes a request nor bypasses another extension's veto. It adds no credential request or retry, fabricates no summary, and changes no other extension's settings. These constraints govern request alignment, not unrelated context modules.

[Remote](./22-remote-alignment.md) and [Handoff](./22-handoff-alignment.md) keep their own algorithms, settings, reason codes, and benefit evidence. This shared mechanism does not include Pin journals, usage telemetry, or model-rule state and adds no general strategy registry or new capability.

## Alternatives considered

None

## Acceptance criteria

- Existing positive and refusal cases retain their capability-specific behavior and independent switches.
- Multiple sessions keep separate references; one request is rewritten at most once, without repeating a context handler.
- Invalidated operations stay invalid, and final release restores only owned resources.
- Shared mechanism changes do not redefine either protocol or join unrelated state owners.

## Risks

A shared wrapper or identity error can affect several alignment capabilities or attribute another session's content. Immutable per-session references and atomic candidate proof remain necessary even when the package contains other context features.
