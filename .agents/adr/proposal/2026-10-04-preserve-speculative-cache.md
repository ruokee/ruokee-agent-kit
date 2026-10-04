# ADR proposal: Preserve speculative compaction during cache alignment

Draft owner: Ruokee
Draft writer: pro-20x/gpt-6-astra

English | [中文](./2026-10-04-preserve-speculative-cache.zh.md)

## Motivation

Preserve native speculative compaction while aligning remote compaction requests with a confirmed online prefix.

The cache module in `@ruokee/omp-qol` 0.5.0 binds request ownership through `session_before_compact`. OMP treats any handler for that event as a possible cancellation or replacement of compaction, so it refuses speculative work rather than bypass an extension's veto. A read-only handler triggers the same restriction. The cache adjustment therefore removes native background preparation and can increase visible waiting at the compaction threshold.

The [current decision](../decision/2026-10-04-align-remote-compaction-cache.md#remote-compaction-cache-alignment) accepts that loss and requires event-based ownership, a wrapper over public manual compaction, one preceding payload, and stopping on overlapping operations. Preserving speculation requires a different ownership source and operation-local references. Documenting the existing restriction does not satisfy that requirement.

## Analysis

OMP 18.5.1 at `d0cc52397dc2a68d39cba49b0009b9e50ffd643e` exposes a source-backed alternative. Its [model registry](https://github.com/can1357/oh-my-pi/blob/d0cc52397dc2a68d39cba49b0009b9e50ffd643e/packages/coding-agent/src/config/model-registry.ts#L3006-L3025) creates a resolver from explicit model and session identity. [Manual compaction](https://github.com/can1357/oh-my-pi/blob/d0cc52397dc2a68d39cba49b0009b9e50ffd643e/packages/coding-agent/src/session/session-maintenance.ts#L3396-L3440), [speculative compaction](https://github.com/can1357/oh-my-pi/blob/d0cc52397dc2a68d39cba49b0009b9e50ffd643e/packages/coding-agent/src/session/session-maintenance.ts#L2182-L2255), and [ordinary automatic compaction](https://github.com/can1357/oh-my-pi/blob/d0cc52397dc2a68d39cba49b0009b9e50ffd643e/packages/coding-agent/src/session/session-maintenance.ts#L4794-L4815) supply that resolver and their root cancellation signal to native compaction.

The [V2 builder](https://github.com/can1357/oh-my-pi/blob/d0cc52397dc2a68d39cba49b0009b9e50ffd643e/packages/agent/src/compaction/compaction.ts#L1753-L1775) passes the same signal to authentication and transport. The [authentication driver](https://github.com/can1357/oh-my-pi/blob/d0cc52397dc2a68d39cba49b0009b9e50ffd643e/packages/ai/src/auth-retry.ts#L153-L169) supplies it to the resolver. Observing that call can bind a root signal to explicit session and model identity without reading credentials or registering the [hook that vetoes speculation](https://github.com/can1357/oh-my-pi/blob/d0cc52397dc2a68d39cba49b0009b9e50ffd643e/packages/coding-agent/src/session/session-maintenance.ts#L2050-L2064).

This is source evidence, not runtime validation of the proposed wrapper. Registry sharing, resolver creation order, concurrent snapshots, and cancellation lifetimes still need execution evidence. Ordinary online requests can also use a resolver, so identity alone does not identify a compaction request. A final request must independently match the expected endpoint and V2 shape.

## Proposal

### Ownership without a compaction veto

Replace the cache module's compaction-event and public-manual-method wrappers with a thin wrapper on the owning context's model registry instance and the resolvers it returns. Retain process-owned wrappers for final transport and native signal composition. Bind only explicit owning-session and model identity to the resolver's root signal, then follow native signal derivation to the outgoing request. Do not infer ownership from time, payload similarity, a cache key, or a routing identifier.

Do not register `session_before_compact` for cache alignment, retain it as a fallback, hide another handler, or alter the host's veto checks. This module must not disable speculative startup, waiting, or result use. Other extensions, including the separately enabled QoL compaction deadline module, retain their own hooks and may still cause OMP to disable speculation. The cache module must not change their settings or claim that speculation is globally enabled.

The wrappers forward native arguments, receivers, credential results, returned promises, errors, signals, and cancellation reasons unchanged. Observing the resolver must not read or modify credential material, add authentication calls, or own credential refresh and rotation. OMP continues to own retries, model and method fallback, speculative result validation, and history commits.

### References and lifecycle

Keep the latest confirmed online payload available for future operations. Once a root signal has an eligible reference, that operation keeps the same reference across native attempts. A later online request updates future eligibility without invalidating an already-bound speculative operation. Distinct, unambiguously owned roots may coexist; mere overlap is not a reason to stop the module.

Only an online payload confirmed to have reached its actual transport unchanged can supply a reference. Keep the existing whole-request equivalence boundary: reuse only recognized tool definitions and a proven shared prefix, preserving the compaction tail, trigger, opaque data, explicit tool choice, cache key, routing, model policy, response, and stored history. A speculative snapshot that does not match a confirmed reference stays native; never graft newer online input into an older snapshot.

Unknown or conflicting root identity, stale context, missing confirmation, or any unrecognized request difference leaves the complete request unchanged. A retry cannot acquire a newer reference, and a later operation cannot inherit an earlier operation's reference through ambiguous root reuse. Authentication resolution and individual transport settlement are not operation-completion signals. Retain references only while needed by the latest online candidate or live native signal ownership, without an unbounded history of completed operations.

Keep the existing single process owner and matching-activation behavior. Conflicting settings, unusable activation, owner shutdown, session navigation, and overwritten wrappers stop rewriting with a bounded reason. Relevant model or context changes prevent stale bindings from rewriting. Restore only still-owned functions, including the registry method's original property shape; no activation takes over a released owner during the same process lifetime. If the required interface cannot be safely observed, leave native requests unchanged and report the unavailable adjustment rather than disable speculation.

### Scope and decision replacement

Reverse [the current QoL decision](../decision/2026-10-04-align-remote-compaction-cache.md). The conflicting clauses are its single preceding-payload ownership rule, event and manual-method ownership source, stop-on-overlap rule, and acceptance of speculative-compaction loss. These cannot remain effective alongside operation-local references, resolver-based identity, and concurrent native speculation.

The successor decision must preserve all still-effective rules for the five modules, configuration authority, owner conflicts, host responsibilities, and documentation. Cache alignment remains default-off for an explicitly selected provider's non-Codex `openai-responses` V2 requests in the owning main session. No new setting, serializer, logging facility, trial control, or automatic installation/configuration change is added. The maintenance lower bound does not change through this proposal.

Update the component version and bilingual behavior documentation with the implementation. Status must report availability, ownership or refusal reason, and rewrite count without implying that this module controls other extensions' speculation vetoes. Keep source analysis, actual runtime evidence, and provider cache measurements distinct. Use an equivalent maintained native request-preparation interface when one becomes available.

## Alternatives considered

- **Keep the compaction-event binding.** This is the deployed approach and gives a native root signal, but even a read-only handler triggers the host veto. It cannot meet the requirement to preserve speculation.
- **Use `session.compacting` alone.** Considered while looking for an event that also runs during speculation. It names the session and messages but carries no root signal, so it cannot attribute concurrent transport requests on its own.
- **Wait for a native request-preparation interface.** Considered during the cache investigation. Direct native request preparation would avoid these wrappers, but the examined extension API does not connect an extension-supplied transport to all three maintenance paths. This proposal keeps the host unchanged and requires migration when an equivalent maintained interface exists.

## Acceptance criteria

1. With native speculation enabled and no other vetoing handler, enabling cache alignment does not prevent speculative startup, preparation, or use of a valid result. A matching speculative V2 request can be aligned while an online turn advances.
2. Manual, ordinary automatic, and speculative V2 requests use explicit session/model and root-signal ownership. Unrelated sessions and unrecognized requests keep their original complete requests.
3. A confirmed reference remains fixed across native authentication and transport retries despite newer online requests. Concurrent roots do not exchange references; cancellation, navigation, changed context, or ambiguous root reuse cannot authorize stale rewriting.
4. Authentication results and failures, native return values and promises, cancellation reasons, retries, fallback, speculative validation, and history commits preserve native semantics. A failed attempt neither ends an otherwise live native operation nor authorizes later unrelated work.
5. Wrapper conflicts or unavailable interfaces leave native behavior in place with accurate bounded status. Stopping restores only still-owned wrappers and does not overwrite another extension or leave a completed-operation history retaining request bodies.
6. Default settings, provider/API boundaries, strict equivalence checks, and the other four modules retain their contracts. Bilingual documentation and the successor decision describe the new ownership and speculation behavior, with actual runtime coverage and cache-benefit limits stated separately.

## Risks

- A host change in resolver creation, registry sharing, or signal composition could break attribution or authentication delegation. Incorrect attribution could modify another operation's input; conservative refusal can instead make cache alignment unavailable until the adaptation is repaired.
- Concurrent native operations retain separate online references. A long-lived signal or incorrect release rule can retain large conversation and tool payloads longer than the single-reference implementation.
- A stale or mismatched snapshot paired with a permissive equivalence check could change the model's input. Keeping the complete-request refusal boundary may skip more background requests when online work has advanced, reducing the adjustment's cache benefit.
- Another extension can replace an observed function or retain a compaction veto. The cache adjustment may remain inactive until restart, or speculation may remain disabled for that independent reason; inaccurate status would conceal which behavior is available.
