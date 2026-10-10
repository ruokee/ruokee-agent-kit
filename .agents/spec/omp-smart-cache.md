# omp-smart-cache specification

[中文](./omp-smart-cache.zh.md)

## Goals

Maintain one self-contained native OMP package, `@ruokee/omp-smart-cache`, under `projects/omp-smart-cache`. Reuse already-sent ordinary results to align the selected Provider's non-Codex Responses V2 remote compaction, including main, native task, and Eval sessions. Keep client alignment, native usability, and real Provider benefit as separate outcomes. Handoff is outside this contract.

## Non-goals

Do not modify the host or Provider, replace native maintenance, add a conversion cooperation protocol, or integrate Handoff. Cache residency, fixed hit rates, and guaranteed savings are outside the contract.

## Public surface

The native manifest exposes one opt-in switch, one exact Provider name, and two closed modes. Defaults and configuration commands are owned by [projects/omp-smart-cache/README.md](../../projects/omp-smart-cache/README.md#configuration).

Native OMP user settings and project overrides are the only configuration source. Validate one activation snapshot; changes require restart. A mode does not enable the capability, and an empty Provider remains inactive. Missing keys use defaults; nulls, wrong types, unknown keys, and invalid modes fail with fixed private-value-free reasons. No QoL settings fallback, hot read, second reader, Provider list, or Handoff placeholder is provided.

`standard` supports recognized native repairs without general handler projection. `hooks` also reuses proved completed handling, including lawful insertion, reordering, restoration, cross-range merging, images, and post-payload transformations. Both retain common native alignment when no handler changes context. Neither repeats handlers or recognizes another component's names or private format.

## Invariants

1. Only a confirmed ordinary main-loop dispatch supplies a reference. Raw history, preparation, existing callback result, and actual outgoing payload belong to the same dispatch and reach transport unchanged. Title, advisor, warming, and Handoff requests cannot become references. Ordinary and non-target requests remain unchanged.
2. Each actual AgentSession has its own registration, actual model/tools/prompt, persistent identity, Provider identity, epoch, and dispatch. One process dispatcher and one wrapper per actual model registry serve concurrent sessions without using model equality, endpoint, cache key, timing, or text as identity.
3. Each native root binds an immutable initial snapshot, including a missing reference. Later online work, handler state, authentication refresh, transport retries, and late signal ancestry never upgrade an old operation. Cancellation, invalidated epochs, ambiguous roots, and old generations cannot regain eligibility.
4. Prefer complete retained-range proof before local matching. Duplicate source messages do not defeat a complete proof. Complete results may change count/order; partial results require independently extractable already-sent units with all dependencies and relevant processing conditions retained. Equal output, length, index, or provenance alone is not independence.
5. Native rewritten tool output, deleted history, new ordinary/tool/image tails, call/result pairing, opaque replacement data, and trigger retain their native boundaries. Do not reconstruct opaque data, restore removed dependencies, recompute results, or change the native trimming basis.
6. Changed dependencies of an indivisible result preserve the whole request with `projection-dependency-changed`. Unknown sources or unit boundaries preserve it with `projection-unconfirmed`. Refusals remain in total and unaligned denominators and do not satisfy positive alignment criteria.
7. Validate system/reminders, native tool schemas, reasoning/replay, default semantics, policy, and complete candidate before one atomic replacement. V2 retains its own `max_output_tokens` or omission. Normalize implicit `auto` only with proved absence of an explicit online choice. Unknown differences, explicit policy, model/tool mismatch, missing proof, or unrecognized transport leave the entire request native. Identical candidates report `already-aligned` without reserialization.
8. Revoke a session's old epoch before switch, branch, or tree. After success, cancellation, or failure settles, a fresh ordinary send restores eligibility without restarting or using a timer. Children finishing, cancelling, or reviving do not stop valid neighbors; replacement sessions obtain their own new references.
9. Wrappers preserve native arguments, receivers, promises, credential results, exceptions, signals, and cancellation reasons. Restore only still-owned functions and property shapes. Foreign overwrite and mixed versions do not authorize takeover. Last-registration cleanup releases shared resources; retained payloads are limited to current references and snapshots reachable through live operations.
10. OMP owns scheduling, preparation, speculation, waiting, retries, model/method fallback, adoption, commits, and continuation. No `session_before_compact` handler, hidden veto, manual-compaction replacement, extra credential request, or settings mutation is allowed. Non-V2 fallback is not V2 success.
11. `/smart-cache` runs no model turn and distinguishes disabled, unavailable, awaiting-reference, already-aligned, rewritten, and rejected. Online, binding, candidate, and sending reasons remain separate. Logical operations, physical sends, retries, alignment, and refusals have bounded distinct counters. Output includes no body, opaque bytes, credentials, endpoint, private path, or private dynamic key.
12. The package has its own source, native manifest, checks, paired documentation, and unrestricted host peers. Development dependencies follow the shared `18.5.0` maintenance floor. Interfaces are checked by capability, not a version whitelist. It neither imports another component nor replaces a Handoff prototype.

## Host lower bound

Use the shared maintenance floor and the component's [host compatibility declaration](../../projects/omp-smart-cache/README.md#host-compatibility-and-source-baseline). Missing interfaces preserve the native path rather than enabling a guessed adaptation.

## Acceptance criteria

- Native plugin discovery confirms one source/version and actual defaults, both modes, off/empty behavior, invalid values, user/project precedence, unchanged running activation, and restart behavior.
- Actual native outgoing requests prove complete and independently reusable local positives, duplicate-source priority, stateful handler non-repetition, images, existing later transforms, trimming, tool schemas, reminders, replay, implicit defaults, no-tools, and legitimate output-limit differences. Indivisible dependency changes and unknown proof gaps preserve the entire request with distinct attribution.
- First, repeated, and separately restored-process V2 commits preserve opaque history and permit normal continuation. Manual, automatic, in-turn, and speculative paths supplied by each host/session class retain native scheduling and direct result adoption. Newer online work and authentication/transport retries preserve the old operation snapshot.
- Main, task, and Eval coverage includes parallel siblings, parent interleaving, same-model different histories, different target models, non-target neighbors, finish, cancellation, revive, and all switch/branch/tree success/cancel/failure outcomes. In-flight old epochs remain invalid.
- Missing reference, unknown fields/transforms, explicit tool choice, identity ambiguity, tool/model mismatch, mixed owners, wrapper loss, old generations, cancellation, exit, native errors, and fallback preserve native behavior. Ordinary and non-target bodies are unchanged; final cleanup does not overwrite foreign functions.
- Real TUI commands expose accurate per-session stages without model requests or sensitive values. Native migration removes all three old QoL keys from every applicable user/project layer, preserves effective opt-in and unrelated settings, and leaves one owner. Accidental old QoL coexistence refuses safely; remaining QoL modules and other installed extensions do not regress.
- Component checks, complete aggregate, changed selector mapping, regression selection, paired public documents, current Specs, and successor ADRs agree. Native CLI/TUI and final wire evidence are required at the floor and current maintained host. Source inspection and synthetic usage are not real-service proof.
- Separately authorized comparable real Provider runs repeatedly reduce uncached input while preserving correctness/usability. Report target, aligned, and unaligned groups, including refusals, by session class and applicable lifecycle; distinguish logical operations and physical requests. For each group include requests, valid usage samples, total/cached/uncached input, zero-hit fraction, and token-weighted hit rate. Failures, cancellation, 429, fallback, and missing usage remain explicit. Do not promise fixed hit rates, residency, or savings.

## Related ADRs

- [Remote ownership and reuse contract](../adr/decision/2026-10-10-use-smart-cache-remote.md)
- [Preserved QoL contract](../adr/decision/2026-10-10-maintain-qol-without-remote.md)
- [Shared OMP maintenance floor](../adr/decision/2026-10-04-raise-omp-host-floor.md)
- [Self-contained components](../adr/decision/2026-08-24-keep-components-self-contained.md)

The installed component's usage and compatibility declaration are in [projects/omp-smart-cache/README.md](../../projects/omp-smart-cache/README.md).
