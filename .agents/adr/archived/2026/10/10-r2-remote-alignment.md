# Remote alignment

Decision owner: Ruokee
Decision writer: OMP
Reverses: [Remote alignment](../../../archived/2026/10/10-r1-remote-alignment.md)
Archived: 2026-10-22
Reversed by: [Remote alignment](../../../decision/2026/10/10-remote-alignment.md)

English | [中文](./10-r2-remote-alignment.zh.md)

## Motivation

Move remote compaction cache alignment from QoL into the `@ruokee/omp-smart-cache` extension, serving main sessions, native child sessions, and same-process navigation.

The [previous QoL decision](../../../archived/2026/09/20-r8-omp-qol.md) assigns remote alignment to one main-session owner. A child activation cannot drive that owner's repair, and navigation releases eligibility without a same-process recovery path. Ordinary requests also finish transformations after context handlers return, while native V2 prepares its retained history separately. Comparing an intermediate context or requiring every request option to match can reject valid common-content repair.

Cache capabilities need an independent home without changing QoL's wait, recovery, deadline, replay, or model-rule behavior. Remote and Handoff repair have different protocols and evidence, so remote keeps its Responses V2 rules for remote requests and does not reuse them for Handoff.

## Analysis

A final sent result and its source range establish different facts. Seeing the final payload proves what was sent; it does not prove that part of a cross-range result can be reused after native trimming. If an ordinary request sent only an indivisible result `Y = F(U, T, s)` and V2 changes `T` to `T'`, there may be no independently sent result for `U`. Reusing all of `Y` retains a dependency on removed content; computing `F(U, T', s)` creates a new result and may repeat handler side effects. More provenance does not create an absent independently sent result.

The reuse boundary therefore supports complete retained ranges and independently reusable local results. It leaves indivisible dependency changes native and counts them as unaligned. It does not restrict handlers to one-to-one transformations, change native trimming, require a new handler protocol, or equate an unknown proof with proven impossibility. Client alignment, native usability, and Provider cache benefit remain separate claims.

## Decision

### Public configuration

Remote alignment is one capability of the [smart-cache extension](./12-r1-smart-cache.md), which records the package, its capability model, and the shared maintenance floor.

The remote public contract has native OMP settings `compactionCacheEnabled` defaulting to `false`, `compactionCacheProvider` defaulting to `""`, and `compactionCacheMode` defaulting to `"hooks"`. The mode accepts only `standard` and `hooks`; it does not enable the repair. A user explicitly selects one exact configured Provider name. No Provider list, extra mode, Handoff placeholder setting, or second configuration source is added.

The mode set is closed for this remote contract because the two modes preserve distinct preparation and reuse promises; extending it requires a new contract decision. Multi-Provider selection and Handoff interfaces are outside this change, not permanent prohibitions on separately specified capabilities. Native settings remain the sole source to preserve host-owned precedence and restart semantics.

OMP owns user values, project overrides, and parsing. Read and validate the effective settings as one activation snapshot. Repeated activation events do not duplicate registration. Changes require restarting OMP; creating or navigating a session does not refresh an existing snapshot. Children use their own actual model, API, tools, prompt, and identities, not the parent's model or a freshly hot-read configuration. Invalid settings or unavailable interfaces affect the corresponding capability or registration, never unrelated live sessions. Diagnostics name a key and fixed rule without echoing its value.

`/smart-cache` reports remote state without starting a model turn. Its states distinguish `disabled`, `unavailable`, `awaiting-reference`, `already-aligned`, `rewritten`, and `rejected`. Keep online confirmation, operation binding, candidate validation, and sending causes separately, so a later missing-reference result does not erase the original proof failure. Report logical operations separately from physical sends and retries; a rewrite, native result adoption, and a Provider cache hit are different outcomes. Diagnostics use bounded counters, local session and operation identifiers, and fixed reasons, with no request body, opaque content, credentials, raw endpoint, private path, or dynamic private key. Ship no body-sampling log, trial environment variable, sampling command, or special rate-limit abort policy.

### Target requests

Cover the selected Provider's non-Codex `openai-responses` native V2 requests in main sessions and native `task` and Eval children. Preserve first, subsequent, and process-restored compaction and the manual, automatic, in-turn, and speculative entry points the host supplies to each session class. An absent host entry point does not require a new extension entry point. Non-target Providers, models, APIs, Codex, V1, and unrecognized shapes remain native.

Both modes perform common alignment without context handlers and require final transport confirmation and complete candidate validation. `standard` retains recognized native repairs and does not acquire generic handler projection through the new observation path. `hooks` additionally reuses proved completed context handling, including insertion, reordering, restoration, and cross-range merging. Neither mode reruns handlers, recognizes a companion extension's text format, inspects its private state, or maintains a replacement Provider serializer.

Only an actual ordinary main-loop dispatch supplies a reference. Its source history, completed preparation, existing payload callbacks' final result, and actual transport must refer to the same dispatch and reach sending unchanged. Title, advisor, cache-warming, Handoff, and other side requests cannot become ordinary references. A new online candidate suspends future operation binding until it is confirmed; operations already bound keep their immutable old reference, including an explicitly missing reference. Observation failures stay local and do not swallow native callback, resolver, or transport exceptions. Ordinary and non-target requests remain byte-exact.

### Reuse units

A reuse unit is an independently extractable result already sent by that same ordinary request, with proved source correspondence, assembly boundaries, and all source dependencies retained unchanged in the native V2 range. The operation's captured reference and relevant processing conditions must remain valid. Matching output, array length, index, provenance alone, or apparent message independence is insufficient proof.

A complete retained source range can be one unit containing all its sent results, even when a lawful handler changes message count or order. Prefer that complete-range proof before local matching; lawful duplicate source messages or ambiguous local matches do not invalidate a proved complete range. When only part of the source remains, reuse units whose independence follows from native item-wise semantics or existing independent-result evidence that survives every subsequent transformation. Preserve native rewritten items instead of replacing them with their old originals.

If an indivisible unit's dependencies were trimmed or changed and no independent sent part exists, leave the entire target request native and report `projection-dependency-changed`. Unknown source, dependencies, or result boundaries leave the entire request native with `projection-unconfirmed`, a proof gap rather than a claim that the transformation is inherently unprojectable. These refusals pass only their safety boundary, not alignment. Known complete-range and independent local positive cases remain required; neither trimming nor black-box handling permits blanket rejection.

Validate the complete candidate before one atomic replacement. Preserve system content, date and cwd reminders, tool schema and descriptions, recognized reasoning/replay and default semantics, new ordinary/tool/image history, native tool-output trimming, call/result pairing, compaction-only tails, trigger, and opaque replacement history in their proper order. Do not expand or reconstruct opaque data, restore removed dependencies, recompute handler output, or trim based on transformed output instead of native source history.

Classify fields by their native meaning instead of requiring all online and V2 options to be equal. Keep V2's own `max_output_tokens` value or omission; never copy the online limit into V2. Its known legitimate difference must not block unrelated common-content alignment. An implicit native `tool_choice: auto` can be normalized only when its default origin and the absence of an explicit online choice are proved. Preserve explicit tool choice, model policy, authentication, routing, cache keys, Provider responses, and stored history; reject when their differences invalidate the reference. Every unclassified difference preserves the entire original request. An identical candidate is `already-aligned`, not a rewrite or a reason to reserialize it.

### Wrapper ownership

Use one process-wide set of transport and native signal-composition wrappers, one thin resolver wrapper per actual model registry, and independent registrations for each actual session. A compatible repeat registration is idempotent; a second session is not an ownership conflict. Distinguish persistent session identity from Provider session identity, and bind session, model, dispatch, native root, epoch, and coordinator generation explicitly. Model equality, endpoint, cache key, timing, or similar text cannot establish ownership. Native endpoint and V2 shape checks remain independently required.

Retain signal-parent relationships and resolve ownership when the signal is used, including derivation before resolver binding and multiple ordinary dispatches sharing a root. Distinct, unambiguously owned operations may coexist. Every native operation keeps its initially captured immutable reference across newer online work, handler-state advances, authentication refresh, and transport retries. A retry cannot acquire a newer reference. Unknown or conflicting identity, cancellation, invalidated epochs, old coordinator generations, or ambiguous reuse leaves that request native, without disabling other valid sessions.

Before switch, branch, or tree navigation, revoke that session's old epoch and references. During navigation it cannot confirm new references. After success, cancellation, or failure, verify that native transition state has settled and the current identities are valid; a new ordinary send restores eligibility without restarting the process. Do not depend exclusively on a success event or a timer, and never revive old operations. A child's finish, shutdown, cancellation, or replacement releases only its own registration; a revived child must obtain a new valid reference.

Restore only still-owned functions and their original property shapes. A lost session wrapper affects that registration; lost shared transport or signal ownership affects registrations that depend on it. Mixed versions, unreadable registries, and external overwrites are reported conflicts, not permission to seize or reinstall another party's wrappers. Release shared resources when the last registration ends; a later fresh registration may create a new coordinator generation while old operations stay invalid. Retain only the latest per-session reference and snapshots reachable through native operations, using shared immutable data rather than large copies on each retry. Keep no growing completed-operation history, and do not parse bodies when no active target registration needs them.

### Native responsibility

OMP retains preparation, triggering, speculative startup and waiting, cancellation, authentication and transport retries, model and method fallback, result validation and adoption, history commits, and continuation. Forward native arguments, receivers, credential results, promises, exceptions, signals, and cancellation reasons unchanged. Do not read credential material, add authentication or reference requests, wrap the public manual compaction method, or treat one credential resolution or transport settlement as operation completion. A non-V2 fallback remains native and is not reported as V2 success.

Do not register `session_before_compact`, keep it as a fallback, hide another handler, bypass a veto, or change another extension's settings. QoL's separately enabled deadline module and other extensions may still veto speculation under their own contracts. Remote alignment preserves the native speculative result's direct adoption, without a replacement request, but does not promise speculation is globally enabled.

Choose maintained behavior by capability and structure. Replace these adaptations when a maintained native interface provides equivalent results, configuration semantics, isolation, and failure behavior across the required paths, after behavioral verification rather than merely an upstream PR merge.

### Decision reversal

This decision and the [complete QoL successor](../09/20-r9-omp-qol.md) reverse [Maintain QoL model prompts](../../../archived/2026/09/20-r8-omp-qol.md). The conflicting choices are:

- Component and scope: QoL's module set, including remote alignment. Conflict: remote belongs to smart-cache; QoL retains wait, recovery, deadline, replay, and model rules. Both cannot own the same remote feature after cutover.
- Component configuration, opt-in model-rule preservation, and standalone-wait setting preservation: keep every pre-existing key, including cache keys. Conflict: remove the three remote keys from QoL in the cutover and declare them only in smart-cache. Preserve every unrelated key, default, range, and validation rule. Old cache keys cannot remain accepted compatibility paths.
- Remote scope: only the owning main session. Conflict: main, native task, and Eval sessions each use their own reference. The main-session-only exclusion is withdrawn.
- Remote equivalence and generic-context Changes: whole-request equality as a gate despite legitimate operation-option differences. Conflict: preserve complete atomic safety, but validate known fields by native semantics, retain V2 output options, and use proved complete or independent local sent units. Unknown differences still reject the whole candidate.
- Remote owner-bound registry and matching later activations that cannot drive the repair. Conflict: shared process dispatch and per-registry wrapping serve independent session registrations. Matching children are eligible, not non-owner observers.
- Remote conflicting or unusable activation stops module rewriting. Conflict: invalid or disabled session settings stop only that registration or capability; actual shared wrapper conflicts affect their dependent registrations.
- Remote shutdown/navigation terminal state and no new owner in the process. Conflict: release one registration locally, restore after settled navigation with a new send, and permit a new coordinator generation after final release. Old epochs and operations never regain eligibility.
- Remote status and effective mode belong to `/qol`. Conflict: `/smart-cache` owns remote state, modes, stage reasons, and counts; `/qol` retains only its remaining adjustments.

All non-conflicting rules remain binding. The [complete QoL successor](../09/20-r9-omp-qol.md) preserves standalone wait delegation and deadlines, recovery safety exclusions and bounded continuations, the experimental compaction-deadline module's single-owner windows and `owner-stopped` terminal state, replay's separate process-wide ownership and release rules, [model prompt rules](../09/14-r3-model-prompt-rules.md), native settings authority, module isolation, privacy, documentation evidence, and host-maintenance obligations. In particular, this decision's remote recovery does not relax the deadline module's terminal owner rule or migrate replay merely because it is cache-related.

This decision retains online confirmation, immutable root snapshots, native lifecycle, explicit-policy preservation, bounded retention, ownership-conditional restoration, no-veto, two-mode, privacy, and native-interface replacement together with the choices above. Other current decisions are not reversed.

### Direct cutover

Deliver remote directly in smart-cache, without a QoL multi-session interim release. Remove QoL's remote implementation, its settings consumption, and its public status entry. Keep no shim or runtime cross-component dependency. Preserve valid consumer-visible assertions and every unrelated QoL behavior.

The [Remote Spec](../../../../spec/omp-smart-context/remote.md) states this contract's acceptance criteria.

The user moves the settings; runtime code neither reads QoL settings as a fallback nor edits user configuration or migrates an installation. The move preserves the old effective Provider and mode, and enables the new repair only when the old effective QoL master `enabled` and `compactionCacheEnabled` were both valid and enabled. A default or an invalid setting must not turn a previously inactive repair on. Old remote keys become unknown QoL keys that can make the whole component reject its configuration, so the move and the restart happen before the changed source is loaded.

Switch by restarting affected processes, not by hot-transferring in-flight owners or references. Accidental coexistence with old QoL remote reports a conservative conflict and does not seize its wrapper. This decision does not reuse remote V2 rules for Handoff and adds no Handoff placeholder interface; [Handoff alignment](./12-r2-handoff-alignment.md) owns that capability.

Component documentation owns detailed settings and commands, applicability, side effects, native-off behavior, fixed source baselines, versions actually exercised, and native replacement conditions in both languages. Source inspection, real CLI coverage, client alignment, native adoption, and Provider measurements are labeled separately.

## Alternatives considered

- **Expand QoL first, then migrate.** It reduces the first installation change but adds an interim multi-session contract, release, configuration, and migration validation. Direct smart-cache delivery avoids that intermediate maintained path.
- **Introduce a frozen pure-projection cooperation protocol.** It can compute a new result after one stateful preparation, but requires cooperating handlers and proof of no side effects, changes the sent-result reuse contract, and gives no guarantee that the new result reuses old Provider cache. This decision adds no such protocol.

## Consequences

- Wrong source correspondence, lost unit boundaries, or concurrent attribution can insert another session's content, restore removed history, or break tool pairing. Complete and local proofs, explicit identities, immutable snapshots, and atomic refusal are required before replacement; conservative refusal alone still leaves required positive coverage incomplete.
- Host changes or competing process wrappers can make the adjustment unavailable; incorrect restoration can overwrite another extension. Capability checks, conditional restoration, and maintained-host behavioral evidence reduce that exposure without promising universal compatibility.
- Multiple live sessions and long-lived native operations can retain large payloads. Sharing immutable references and releasing unreachable operation state avoids retry copies and completed-history growth, but does not bound the host's number or lifetime of live operations.
- A user who updates linked QoL source before removing old keys can lose every QoL module through unknown-key rejection. Coordinated user and project migration preserves unrelated settings and avoids silently enabling an inactive repair.
- A correctly aligned request can still miss Provider cache, and indivisible dependency changes remain unaligned. The added maintenance may therefore produce insufficient overall benefit; real comparable repeated measurements with complete denominators are the release criterion, not a synthetic success count.
