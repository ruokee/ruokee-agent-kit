# ADR proposal: Add QoL compaction hook modes

Draft owner: Ruokee
Draft writer: OMP

English | [中文](./2026-10-05-add-qol-compaction-hook-modes.zh.md)

## Motivation

Add a generic hook-aware mode to QoL's remote compaction cache alignment.

Ordinary requests use the host's completed context projection, while remote compaction can prepare its shared history without that projection. Legitimate insertions, reordering, and restored context can therefore make the current whole-request guard refuse alignment. The guard protects the request correctly, but the shared cache prefix remains different.

The [remote compaction cache decision](../decision/2026-10-04-use-standalone-qol-wait.md#remote-compaction-cache-alignment) requires confirmed online references, explicit ownership, immutable operation references, whole-request equivalence, and native speculative compaction. Hook support must extend that boundary rather than bypass it. The [component independence decision](../decision/2026-08-24-keep-components-self-contained.md) also rules out depending on another extension's files or private state.

## Proposal

### Expose two processing modes

Add `compactionCacheMode` to native OMP plugin settings with values `standard` and `hooks`, defaulting to `hooks`.

- `standard` retains the existing alignment and its recognized host differences. An unrecognized hook-induced difference leaves the complete request native.
- `hooks` additionally uses the host's completed context projection when its correspondence to the confirmed online request and the native shared history can be proved. It also performs the common alignment when no relevant hook is present; no companion extension is required.

Neither mode enables the cache module. Its disabled default, explicitly configured provider, supported owning-session API boundary, and other settings remain unchanged. Settings are read once per activation and take effect on restart. An invalid mode rejects only the cache module, with a diagnostic naming the key and rule without exposing its value. The effective mode participates in owner compatibility and is reported by `/qol`.

### Keep projection and request ownership together

Observe the owning host runner's raw context and completed result without re-running handlers or reading their private state. Accept a projection only after proving its native encoding corresponds to the actual online payload sent unchanged. The host remains the serializer; this component must not maintain a second serializer or recognize extensions by name, text prefix, or component files.

A native operation captures its confirmed reference and corresponding projection under explicit session, model, and root-signal ownership. New online work may advance the latest reference without changing an older operation's snapshot. Authentication and transport retries keep the original snapshot. Similar payloads, timing, cache keys, and routing identifiers do not establish ownership.

Before reusing the projected prefix, prove the native shared-history correspondence and validate the complete candidate request. Preserve new ordinary and tool history, the compaction-only tail and trigger, opaque data, explicit tool choice, cache key, routing, and model policy. Unknown correspondence or any unrecognized difference leaves the entire original request unchanged, not a partially repaired request.

### Preserve native lifecycle and component boundaries

Do not register `session_before_compact` for cache alignment, hide another handler, or bypass the host's veto. Native manual, automatic, and speculative preparation, waiting, retries, fallback, result validation, history replacement, and adoption remain host-owned. Other independently enabled modules retain their own hooks and settings.

Projection observations are scoped to the owning runner and native operation lifetime. Keep only the latest confirmed online reference and references reachable through live native operation signals, not an unbounded operation history. Cancellation, changed identity or context, conflicting activation, session navigation, lost wrappers, and unavailable interfaces prevent stale rewriting. Shutdown restores only still-owned functions and their original property shape.

Maintain the existing host maintenance floor and package boundaries described in [projects/omp-qol/README.md](../../../projects/omp-qol/README.md#compatibility). Source inspection is not runtime verification. Document actual host coverage separately from provider cache measurements. Prefer an equivalent maintained native preparation interface when one becomes available.

This is a compatible extension of the current remote compaction cache decision: its refusal and equivalence rules remain binding. No current decision needs reversal. Implementation should record the added mode and projection ownership under that decision's `Changes`, and update the component's specifications and bilingual public documentation without altering unrelated module contracts.

## Alternatives considered

- **Keep only the current alignment.** Considered when comparing the native shared history with a projected online request. It preserves safety but continues to refuse legitimate insertion, reordering, and restoration, so it does not provide the requested hook-aware behavior.
- **Re-run the public ordinary-message preparation path for compaction.** Considered while checking available host preparation interfaces. It can obtain a projection, but invokes handlers again and may read newer state than the operation's confirmed online reference. Observing the completed original projection avoids those additional side effects and stale-reference errors.
- **Wait for a maintained shared preparation interface.** Considered while assessing host-dependent observation. It avoids maintaining a wrapper over the current runner, but leaves the mismatch unresolved in the current host. Such an interface remains the replacement condition for the adaptation.

## Acceptance criteria

- Both modes and the default are observable through native plugin settings and `/qol`; invalid configuration remains isolated to the cache module.
- With no relevant hook, both modes retain the common alignment without adding messages or requiring another component.
- With generic insertion, reordering, and restored context, `standard` refuses unknown differences and `hooks` aligns only a proved shared prefix. New history and opaque content remain intact.
- A speculative operation retains its original projection through newer online work and native retries; a valid result is adopted through the native lifecycle without an extra replacement request.
- Unknown correspondence, missing transport confirmation, conflicting ownership, and stale or cancelled operations leave the complete request native. Lifecycle cleanup cannot overwrite another owner's functions.
- Real CLI evidence distinguishes request consistency and native compaction behavior from actual provider cache benefit; synthetic usage is not a cache measurement.

## Risks

- Host runner or encoding changes can invalidate the projection observation and leave alignment unavailable. Fail closed to native requests, report the bounded reason, and maintain version-specific runtime evidence rather than weakening equivalence.
- Incorrect correspondence or ownership could splice another operation's projected context into a request, losing history or disclosing unrelated context. Require explicit identity, transport confirmation, immutable operation references, and complete validation before replacing any bytes.
- Projected and raw context snapshots retain additional conversation data while an operation remains live. Bound retention to the latest online reference and native signal lifetimes, and release observations when ownership ends.
