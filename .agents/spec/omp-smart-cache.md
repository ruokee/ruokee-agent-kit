# omp-smart-cache

English | [中文](./omp-smart-cache.zh.md)

## Goals

Maintain one self-contained native OMP package, `@ruokee/omp-smart-cache`, under `projects/omp-smart-cache`, avoiding unexpected cache misses in OMP requests while the ordinary and native request paths stay unchanged. It carries remote alignment and Handoff alignment as two independent capabilities, each with its own switch, state, and acceptance. Reuse already-sent ordinary results to align the selected Provider's non-Codex Responses V2 remote compaction, including main, native task, and Eval sessions, and align Handoff side requests with the ordinary request that was already sent. Keep client alignment, native usability, and real Provider benefit as separate outcomes.

## Out of scope

Do not modify the host or Provider, replace native maintenance, or add a conversion cooperation protocol. Cache residency, fixed hit rates, and guaranteed savings are outside the contract.

## Public surface

The native manifest exposes the remote opt-in switch, one exact Provider name, two closed modes, and one Handoff opt-in switch, `handoffCacheEnabled`, defaulting to `false`. Defaults and configuration commands are owned by [projects/omp-smart-cache/README.md](../../projects/omp-smart-cache/README.md#configuration).

Native OMP user settings and project overrides are the only configuration source. Validate one activation snapshot; changes require restart. A mode does not enable the capability, and an empty Provider remains inactive. Missing keys use defaults; nulls, wrong types, unknown keys, and invalid modes fail with fixed private-value-free reasons. Configuration comes from this component's settings alone: QoL settings fallback, hot reads, a second reader, a Provider list, and a Handoff Provider key or mode are out of scope. The Handoff switch enables that capability alone, adds no Provider list or mode, and is read in the same activation snapshot as the remote settings.

`standard` covers recognized native repairs only. `hooks` also reuses proved completed handling, including lawful insertion, reordering, restoration, cross-range merging, images, and post-payload transformations. Both retain common native alignment when no handler changes context. Each mode calls handlers once and reads only this component's own names and format.

## Invariants

1. Only a confirmed ordinary main-loop dispatch supplies a reference, and title, advisor, warming, and Handoff requests cannot; ordinary and non-target requests stay unchanged, and a prepared request without a tool set supplies no Handoff reference.
2. Each actual AgentSession keeps its own registration, reference, actual model, tools, prompt, persistent and Provider identity, epoch, and dispatch; model equality, endpoint, cache key, timing, and text do not establish identity. One process dispatcher and one wrapper per actual model registry serve concurrent sessions.
3. A reference is immutable for the operation it belongs to, including a missing one, and no later online work, handler state, refresh, retry, or late signal ancestry upgrades it or restores an invalidated, cancelled, or ambiguous operation. Switch, branch, and tree navigation, compaction commits, and session release clear it and invalidate that session's epoch; a fresh ordinary send restores eligibility after the navigation settles, without a restart or a timer, and a replacement session obtains its own new reference.
4. Reuse prefers a complete retained-range proof before local matching, duplicate source messages do not defeat it, and a complete result may change count or order. A partial result needs independently extractable already-sent units with all dependencies and relevant processing conditions retained; equal output, length, index, or provenance alone is not independence. A changed dependency preserves the whole request with `projection-dependency-changed`, an unknown source or unit boundary with `projection-unconfirmed`, and a refusal never satisfies a positive alignment criterion.
5. Native rewritten tool output, deleted history, new ordinary, tool, and image tails, call/result pairing, opaque replacement data, and trigger keep their native boundaries, and nothing reconstructs opaque data, restores removed dependencies, recomputes results, or changes the native trimming basis.
6. One validated candidate replaces the request atomically, V2 keeps its own `max_output_tokens` or omission, an implicit `auto` is normalized only with proof that no explicit online choice exists, and any unclassified or conflicting difference leaves the entire request native; an identical candidate reports `already-aligned` without reserialization.
7. Handoff rewrites only within a proved common boundary, after complete operation ownership, system-prefix, source-history, tool, and new-tail proof, and replaces the candidate atomically after the native payload hooks and the validation at each actual send. Chat Completions restores system, `reasoning_effort`, and existing `tool_choice` axis by axis; Responses restores only source-proved missing system content and keeps native `none`, the existing compatibility retry, nested reasoning, and native configuration updates instead of restoring ordinary auto. A request outside the boundary is sent unchanged with a fixed reason, `rejected` means no rewrite, and no request is blocked, delayed, or dropped. Side instructions, new history, cache keys, routing, side session, cancellation, and other options stay unchanged.
8. Wrappers preserve native arguments, receivers, promises, credential results, exceptions, signals, and cancellation reasons, and restore only still-owned functions and property shapes; a foreign overwrite or mixed version authorizes no takeover. Failure stays local, last-registration cleanup releases shared resources, and only current references and snapshots reachable through live operations are retained.
9. Handoff supports `openai-completions` and `openai-responses` without a Provider inventory, and dispatches a Responses session by the proved actual request kind; other APIs use neither capability. At most one capability rewrites a physical request, the switches are independent, and each capability proves eligibility independently without sharing protocol rules, payload-shape rules, reason codes, or benefit evidence, so a refusal or a missing interface in one leaves the other working.
10. OMP keeps scheduling, preparation, speculation, waiting, retries, model and method fallback, adoption, commits, continuation, and document generation, and neither capability adds an entry point, registers `session_before_compact`, vetoes a request, replaces manual compaction, requests an extra credential, fabricates a summary, adds a retry, or mutates a setting. A non-V2 fallback and the host's own failure semantics stay native and never count as success.
11. `/smart-cache` runs no model turn and reports each capability's own states, staged reasons, and bounded counters, with no body, opaque bytes, credentials, endpoint, private path, or private dynamic key.
12. The package has its own source, native manifest, checks, paired documentation, and unrestricted host peers, follows the shared `18.5.0` maintenance floor in its development dependencies, checks interfaces by capability rather than a version whitelist, and imports no other component's runtime or settings reader.

The [remote alignment](../adr/decision/2026/10/10-remote-alignment.md) and [Handoff alignment](../adr/decision/2026/10/12-handoff-alignment.md) decisions state the complete rules behind the remote and Handoff properties and their reasons.

## Host lower bound

Use the shared maintenance floor and the component's [host compatibility declaration](../../projects/omp-smart-cache/README.md#compatibility). Missing interfaces preserve the native path.

## Acceptance criteria

- Native plugin discovery confirms one source/version and actual defaults, both modes, off/empty behavior, invalid values, user/project precedence, unchanged running activation, and restart behavior.
- Actual native outgoing requests prove complete and independently reusable local positives, duplicate-source priority, stateful handler non-repetition, images, existing later transforms, trimming, tool schemas, reminders, replay, implicit defaults, no-tools, and legitimate output-limit differences. Indivisible dependency changes and unknown proof gaps preserve the entire request with distinct attribution.
- First, repeated, and separately restored-process V2 commits preserve opaque history and permit normal continuation. Manual, automatic, in-turn, and speculative paths supplied by each host/session class retain native scheduling and direct result adoption. Newer online work and authentication/transport retries preserve the old operation snapshot.
- Main, task, and Eval coverage includes parallel siblings, parent interleaving, same-model different histories, different target models, non-target neighbors, finish, cancellation, revive, and all switch/branch/tree success/cancel/failure outcomes. In-flight old epochs remain invalid.
- Missing reference, unknown fields/transforms, explicit tool choice, identity ambiguity, tool/model mismatch, mixed owners, wrapper loss, old generations, cancellation, exit, native errors, and fallback preserve native behavior. Ordinary and non-target bodies are unchanged; final cleanup does not overwrite foreign functions.
- Real TUI commands expose accurate per-session stages without model requests or sensitive values. Native migration removes all three old QoL keys from every applicable user/project layer, preserves effective opt-in and unrelated settings, and leaves one owner. Accidental old QoL coexistence refuses safely; remaining QoL modules and other installed extensions do not regress.
- Component checks, complete aggregate, changed selector mapping, regression selection, paired public documents, current Specs, and successor ADRs agree. Native CLI/TUI and final wire evidence are required at the floor and current maintained host. Source inspection and synthetic usage cover the mechanism only.
- Separately authorized comparable real Provider runs repeatedly reduce uncached input while preserving correctness/usability. Report target, aligned, and unaligned groups, including refusals, by session class and applicable lifecycle; distinguish logical operations and physical requests. For each group include requests, valid usage samples, total/cached/uncached input, zero-hit fraction, and token-weighted hit rate. Failures, cancellation, 429, fallback, and missing usage remain explicit. Do not promise fixed hit rates, residency, or savings.
- With the switch off, all requests stay native. With it on, the actual final Handoff body carries API-specific restored common system content after the host's payload hooks. Chat Completions retains existing reasoning and tool-choice restoration. Responses correctly handles instructions or source-proved leading developer segments, keeps historical developer messages in place, and preserves native none, reasoning, configuration updates, and compatibility retry. Missing required proof preserves the complete native send. Consecutive Handoffs use their own confirmed ordinary references.
- Handoff requests outside the boundary are sent unchanged with a fixed reason, unrelated field differences still complete the axes that can be restored, no request is blocked, delayed, or dropped, and two consecutive Handoffs do not reuse the previous side request body.
- `/smart-cache` reports the Handoff section's own states, staged reasons, and bounded counters without starting a model turn, and missing or invalid Handoff settings leave every request native.
- The local trial extension is replaced and disabled after this capability passes its own acceptance and an installation authorization follows; while it is still auto-discovered the package reports a conservative wrapper conflict instead of seizing a wrapper, and the cutover restarts affected processes.

## Related ADRs

- [smart-cache](../adr/decision/2026/10/12-smart-cache.md)
- [Remote ownership and reuse contract](../adr/decision/2026/10/10-remote-alignment.md)
- [Handoff alignment contract](../adr/decision/2026/10/12-handoff-alignment.md)
- [Preserved QoL contract](../adr/decision/2026/09/20-omp-qol.md)
- [Shared OMP maintenance floor](../adr/decision/2026/09/28-host-maintenance.md)
- [Self-contained components](../adr/decision/2026/08/24-component-self-containment.md)

The installed component's usage and compatibility declaration are in [projects/omp-smart-cache/README.md](../../projects/omp-smart-cache/README.md).
