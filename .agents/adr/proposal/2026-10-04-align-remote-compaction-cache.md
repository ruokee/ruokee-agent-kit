# ADR proposal: Align remote compaction with the online request cache

Draft owner: Ruokee
Draft writer: pro-20x/gpt-6-astra

English | [中文](./2026-10-04-align-remote-compaction-cache.zh.md)

## Motivation

Add an opt-in remote compaction cache adjustment to `@ruokee/omp-qol`.

OMP's non-Codex Responses V2 compaction constructs its request separately from the preceding online request. Tool descriptions, user-message envelopes, default tool choice, and replayed compaction identifiers can differ even where the conversation has a shared prefix. Those differences can prevent reuse of a provider prompt cache. The host still owns the compaction request, its response, and the resulting history.

## Analysis

On OMP 18.5.1, a local experiment reused the actual preceding online request after checking request identity and the shared prefix. Two successful baseline compactions had a weighted cached-input ratio of 4.25%; two successful adjusted compactions had 98.31%. The conversations were not identical, and the sample does not isolate individual fields or establish a durable provider guarantee. The provider decides whether matching input is cached.

A public pre-compaction event supplies an operation signal, but the outgoing request uses derived signals. Tracking native signal composition preserves ownership without choosing the most recent request by timing. Manual compaction also needs cleanup on settlement of the public compaction promise, because a terminal failure need not abort its signal or emit a committed-compaction event.

The pre-compaction hook disables speculative compaction on the inspected host. This is an accepted cost of enabling the adjustment, including when a later request cannot be aligned. The existing timeout adjustment has the same hook side effect, documented in [projects/omp-qol/docs/adjustments.md](../../../projects/omp-qol/docs/adjustments.md#extending-one-compaction-deadline).

## Proposal

### Component boundary

Reverse [the current QoL decision](../decision/2026-09-28-maintain-omp-qol.md). Its component scope limits the package to four behavior adjustments; adding a fifth cannot retain that closed scope. The successor preserves its other module contracts, ownership rules, native settings authority, maintenance bound, and per-adjustment evidence requirements, including the subsequent standalone wait change.

Add an independently switchable cache module using native OMP plugin settings. It is off by default and requires an explicitly selected provider name. The provider selection is user configuration, not a checked-in endpoint, credential, or machine profile. The maintained behavior covers that provider's non-Codex `openai-responses` V2 requests in the owning main session. Other APIs, providers, sessions, and unrecognized request shapes keep native behavior.

The module retains one preceding provider payload in memory and confirms that it reached the actual online transport unchanged. It may reuse tool definitions and a proven shared input prefix, including recognized host envelopes and replay identifier differences, while preserving the compaction-only tail, trigger, opaque data, explicit tool choice, cache key, routing, and model policy. Any unrecognized difference leaves the complete request unchanged. It never invents a second serializer or modifies the provider response or stored history.

### Ownership and lifecycle

Use one process-owned set of wrappers over `fetch`, native signal composition, and the public manual compaction method. An operation belongs to the session identified by the event and its signal lineage, not to a time window. Preserve original signals, reasons, return values, promise identity, native retries, and fallback. Clear manual ownership only when the native operation settles; a failed transport attempt is not the end of that operation.

A matching later activation keeps the existing owner without installing or driving another wrapper and reports that it is not the owner. Conflicting settings or an unusable activation stop this module's rewriting. Owner shutdown, session navigation, overlapping operations, and overwritten wrappers stop rewriting and report a bounded reason. Restore only functions still owned by this module; no activation takes over a released owner during the same process lifetime.

Enabling the module accepts the loss of speculative compaction in its owning session. Turning the setting off takes effect after restarting OMP and avoids registering the hook. `/qol` reports the effective switch, ownership or refusal reason, and rewrite count. No request-body logging, trial environment variables, sampling commands, or special rate-limit abort policy ships with the module.

## Alternatives considered

- Keep the accepted local experiment without installing it. Considered when choosing between a trial result and a reusable QoL feature. It avoids adding a maintained host adaptation but does not make the repair available to ordinary projects.
- Wait for an upstream request-preparation fix. Considered while assessing whether public extension events alone could preserve the online prefix. It avoids process-wide wrappers and the speculative-compaction cost, but leaves the mismatch in the current host. An equivalent maintained native interface should replace the wrappers when available.

## Acceptance criteria

- The package installs and exposes the adjustment through its existing settings and `/qol` command, with the other adjustments retaining their behavior.
- An eligible V2 request reuses the confirmed online prefix and preserves native compaction-only content. Unknown differences, ownership, or state leave the request unchanged.
- Manual success, terminal failure, cancellation, retries, and subsequent compactions do not leak operation ownership or change native outcomes.
- Matching secondary activations cannot rewrite their own traffic through the owner's state. Conflicts, navigation, shutdown, and replacement of a wrapped function leave no active rewriting under stale ownership.
- The public documentation explains provider selection, the speculative-compaction cost, process-wide interception, observed evidence, and untested combinations without promising a cache hit rate.

## Risks

- Host changes can alter request envelopes, signal composition, or lifecycle events. A recognized subset may stop matching; an undetected change could reuse the wrong prefix and change model input.
- Disabling speculative compaction can increase visible waiting time at the compaction threshold, even when the provider gives no cache benefit.
- Process-wide wrappers can interact with another extension's wrappers. Identity checks and ownership-conditional restoration avoid overwriting another extension but can leave this adjustment inactive until restart.
- Keeping the preceding request consumes memory proportional to the conversation and tool payload. It remains in process memory only and is released with the reference or owner.
