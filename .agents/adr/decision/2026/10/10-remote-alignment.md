# Remote alignment

Decision owner: Ruokee
Decision writer: OMP
Reverses: [Remote alignment](../../../archived/2026/10/10-r2-remote-alignment.md)

English | [中文](./10-remote-alignment.zh.md)

## Motivation

Maintain remote compaction cache alignment in `@ruokee/omp-smart-context` for main sessions, native child sessions, and same-process navigation.

Ordinary requests finish transformations after context handlers return, while native V2 prepares its retained history separately. Comparing intermediate context or requiring every request option to match can reject valid common-content repair. Each session needs its own confirmed reference and a recovery path after navigation settles.

Remote and Handoff repair have different protocols and evidence. Remote keeps its Responses V2 rules for remote requests and does not reuse them for Handoff. Consolidating their package does not change either algorithm.

## Analysis

A final sent result and its source range establish different facts. Seeing the final payload proves what was sent; it does not prove that part of a cross-range result can be reused after native trimming. If an ordinary request sent only an indivisible result `Y = F(U, T, s)` and V2 changes `T` to `T'`, there may be no independently sent result for `U`. Reusing all of `Y` retains a dependency on removed content; computing `F(U, T', s)` creates a new result and may repeat handler side effects. More provenance does not create an absent independently sent result.

The reuse boundary therefore supports complete retained ranges and independently reusable local results. It leaves indivisible dependency changes native and counts them as unaligned. It does not restrict handlers to one-to-one transformations, change native trimming, require a new handler protocol, or equate an unknown proof with proven impossibility. Client alignment, native usability, and Provider cache benefit remain separate claims.

## Decision

### Public configuration

Remote alignment is one capability of the [smart-context extension](./12-smart-cache.md), which records the package, its capability model, and the shared maintenance floor.

The remote public contract has native OMP settings `compactionCacheEnabled` defaulting to `false`, `compactionCacheProviderFilter` defaulting to `""`, and `compactionCacheMode` defaulting to `"hooks"`. The mode accepts only `standard` and `hooks`; it does not enable the repair. The filter is one exact Provider name matched against the current session model's Provider. It controls repair eligibility without choosing a model, Provider, route, or compaction method. No Provider list, extra mode, Handoff placeholder setting, or second configuration source is added.

The mode set is closed for this remote contract because the two modes preserve distinct preparation and reuse promises; extending it requires a new contract decision. Multi-Provider filtering and Handoff interfaces are outside this change, not permanent prohibitions on separately specified capabilities. Native settings remain the sole source to preserve host-owned precedence and restart semantics.

OMP owns user values, project overrides, and parsing. Read and validate the effective settings as one activation snapshot. Repeated activation events do not duplicate registration. Changes require restarting OMP; creating or navigating a session does not refresh an existing snapshot. Children use their own actual model, API, tools, prompt, and identities, not the parent's model or a freshly hot-read configuration. Invalid settings or unavailable interfaces affect the corresponding capability or registration, never unrelated live sessions. Diagnostics name a key and fixed rule without echoing its value.

`/smart-context` reports remote state without starting a model turn. Its states distinguish `disabled`, `unavailable`, `awaiting-reference`, `already-aligned`, `rewritten`, and `rejected`. Keep online confirmation, operation binding, candidate validation, and sending causes separately, so a later missing-reference result does not erase the original proof failure. Report logical operations separately from physical sends and retries; a rewrite, native result adoption, and a Provider cache hit are different outcomes. Diagnostics use bounded counters, local session and operation identifiers, and fixed reasons, with no request body, opaque content, credentials, raw endpoint, private path, or dynamic private key. Ship no body-sampling log, trial environment variable, sampling command, or special rate-limit abort policy.

### Target requests

Cover non-Codex `openai-responses` native V2 requests when the current session model supports remote compaction, OMP selects Remote, and the model's Provider matches the enabled repair's filter. Preserve that model and its native route in main sessions and native `task` and Eval children. Preserve first, subsequent, and process-restored compaction and the manual, automatic, in-turn, and speculative entry points the host supplies to each session class. An absent host entry point does not require a new extension entry point. Non-target Providers, models, APIs, Codex, V1, and unrecognized shapes remain native.

Both modes perform common alignment without context handlers and require final transport confirmation and complete candidate validation. `standard` retains recognized native repairs and does not acquire generic handler projection through the new observation path. `hooks` additionally reuses proved completed context handling, including insertion, reordering, restoration, and cross-range merging. Neither mode reruns handlers, recognizes a companion extension's text format, inspects its private state, or maintains a replacement Provider serializer.

Only an actual ordinary main-loop dispatch supplies a reference. Its source history, completed preparation, existing payload callbacks' final result, and actual transport must refer to the same dispatch and reach sending unchanged. Title, advisor, cache-warming, Handoff, and other side requests cannot become ordinary references. A new online candidate suspends future operation binding until it is confirmed; operations already bound keep their immutable old reference, including an explicitly missing reference. Observation failures stay local and do not swallow native callback, resolver, or transport exceptions. Ordinary and non-target requests remain byte-exact.

### Reuse units

A reuse unit is an independently extractable result already sent by that same ordinary request, with proved source correspondence, assembly boundaries, and all source dependencies retained unchanged in the native V2 range. The operation's captured reference and relevant processing conditions must remain valid. Matching output, array length, index, provenance alone, or apparent message independence is insufficient proof.

A complete retained source range can be one unit containing all its sent results, even when a lawful handler changes message count or order. Prefer that complete-range proof before local matching; lawful duplicate source messages or ambiguous local matches do not invalidate a proved complete range. When only part of the source remains, reuse units whose independence follows from native item-wise semantics or existing independent-result evidence that survives every subsequent transformation. Preserve native rewritten items instead of replacing them with their old originals.

If an indivisible unit's dependencies were trimmed or changed and no independent sent part exists, leave the entire target request native and report `projection-dependency-changed`. Unknown source, dependencies, or result boundaries leave the entire request native with `projection-unconfirmed`, a proof gap rather than a claim that the transformation is inherently unprojectable. These refusals pass only their safety boundary, not alignment. Known complete-range and independent local positive cases remain required; neither trimming nor black-box handling permits blanket rejection.

Validate the complete candidate before one atomic replacement. Preserve system content, date and cwd reminders, tool schema and descriptions, recognized reasoning/replay and default semantics, new ordinary/tool/image history, native tool-output trimming, call/result pairing, compaction-only tails, trigger, and opaque replacement history in their proper order. Do not expand or reconstruct opaque data, restore removed dependencies, recompute handler output, or trim based on transformed output instead of native source history.

Classify fields by their native meaning instead of requiring all online and V2 options to be equal. Keep V2's own `max_output_tokens` value or omission; never copy the online limit into V2. Its known legitimate difference must not block unrelated common-content alignment. An implicit native `tool_choice: auto` can be normalized only when its default origin and the absence of an explicit online choice are proved. Preserve explicit tool choice, model policy, authentication, routing, cache keys, Provider responses, and stored history; reject when their differences invalidate the reference. Every unclassified difference preserves the entire original request. An identical candidate is `already-aligned`, not a rewrite or a reason to reserialize it.

### Wrapper ownership

Apply the [shared request-alignment contract](./22-request-alignment.md) without joining usage telemetry, model-rule state, or Pin journals to the coordinator. Do not inspect Pin private state or rebuild sent output from current rules.

Use one process-wide set of transport and native signal-composition wrappers, one thin resolver wrapper per actual model registry, and independent registrations for each actual session. A compatible repeat registration is idempotent; a second session is not an ownership conflict. Distinguish persistent session identity from Provider session identity, and bind session, model, dispatch, native root, epoch, and coordinator generation explicitly. Model equality, endpoint, cache key, timing, or similar text cannot establish ownership. Native endpoint and V2 shape checks remain independently required.

Retain signal-parent relationships and resolve ownership when the signal is used, including derivation before resolver binding and multiple ordinary dispatches sharing a root. Distinct, unambiguously owned operations may coexist. Every native operation keeps its initially captured immutable reference across newer online work, handler-state advances, authentication refresh, and transport retries. A retry cannot acquire a newer reference. Unknown or conflicting identity, cancellation, invalidated epochs, old coordinator generations, or ambiguous reuse leaves that request native, without disabling other valid sessions.

Before switch, branch, or tree navigation, revoke that session's old epoch and references. During navigation it cannot confirm new references. After success, cancellation, or failure, verify that native transition state has settled and the current identities are valid; a new ordinary send restores eligibility without restarting the process. Do not depend exclusively on a success event or a timer, and never revive old operations. A child's finish, shutdown, cancellation, or replacement releases only its own registration; a revived child must obtain a new valid reference.

Restore only still-owned functions and their original property shapes. A lost session wrapper affects that registration; lost shared transport or signal ownership affects registrations that depend on it. Mixed versions, unreadable registries, and external overwrites are reported conflicts, not permission to seize or reinstall another party's wrappers. Release shared resources when the last registration ends; a later fresh registration may create a new coordinator generation while old operations stay invalid. Retain only the latest per-session reference and snapshots reachable through native operations, using shared immutable data rather than large copies on each retry. Keep no growing completed-operation history, and do not parse bodies when no active target registration needs them.

### Native responsibility

OMP retains preparation, triggering, speculative startup and waiting, cancellation, authentication and transport retries, model and method fallback, result validation and adoption, history commits, and continuation. Forward native arguments, receivers, credential results, promises, exceptions, signals, and cancellation reasons unchanged. Do not read credential material, add authentication or reference requests, wrap the public manual compaction method, or treat one credential resolution or transport settlement as operation completion. A non-V2 fallback remains native and is not reported as V2 success.

Do not register `session_before_compact`, keep it as a fallback, hide another handler, bypass a veto, or change another extension's settings. QoL's separately enabled deadline module and other extensions may still veto speculation under their own contracts. Remote alignment preserves the native speculative result's direct adoption, without a replacement request, but does not promise speculation is globally enabled.

Choose maintained behavior by capability and structure. Replace these adaptations when a maintained native interface provides equivalent results, configuration semantics, isolation, and failure behavior across the required paths, after behavioral verification rather than merely an upstream PR merge.

### Decision reversal

The successor replaces smart-cache ownership and status with smart-context and `/smart-context`. Repository checks and controlled integration replace the required real-Provider benefit release gate. The source proofs, modes, session scope, native responsibilities, lifecycle, diagnostics, and native replacement conditions remain binding.

The earlier QoL cutover remains in the archived decision. QoL keeps its separate contracts, including the deadline owner's terminal `owner-stopped` state and replay ownership. Alignment's renewable coordinator does not relax either boundary.

### Direct cutover

Move existing smart-cache settings to smart-context at both user and project scope, preserving effective enablement, Provider filtering, mode, and overrides. Runtime code reads no old namespace and does not edit user settings or installations. Remove the old extension entry and restart affected processes, without hot-transferring in-flight owners or references. Coexisting old smart-cache or QoL remote owners report a conflict rather than authorizing takeover. Keep no alias, shim, or cross-component runtime dependency.

The [Remote Spec](../../../../spec/omp-smart-context/remote.md) states acceptance through repository checks and local controlled runs using the actual candidate and locked host libraries. Preserve positive and refusal cases in both modes, independent switches, native request semantics, and read-only status. Real-model calls, measured cache savings, and a full CLI/TUI matrix are not integration gates. Claims about Provider benefit require real comparable repeated measurements with complete denominators.

Component documentation explains settings, commands, applicability, side effects, and native-off behavior in both languages. The Remote Spec owns requirements and native replacement conditions. Maintenance evidence owns fixed source baselines and exercised versions, retaining historical conditions and distinguishing source inspection, controlled integration, real CLI coverage, client alignment, native adoption, and Provider measurements.

## Alternatives considered

- **Introduce a frozen pure-projection cooperation protocol.** It can compute a new result after one stateful preparation, but requires cooperating handlers and proof of no side effects, changes the sent-result reuse contract, and gives no guarantee that the new result reuses old Provider cache. This decision adds no such protocol.

## Consequences

- Wrong source correspondence, lost unit boundaries, or concurrent attribution can insert another session's content, restore removed history, or break tool pairing. Complete and local proofs, explicit identities, immutable snapshots, and atomic refusal are required before replacement; conservative refusal alone still leaves required positive coverage incomplete.
- Host changes or competing process wrappers can make the adjustment unavailable; incorrect restoration can overwrite another extension. Capability checks, conditional restoration, and maintained-host behavioral evidence reduce that exposure without promising universal compatibility.
- Multiple live sessions and long-lived native operations can retain large payloads. Sharing immutable references and releasing unreachable operation state avoids retry copies and completed-history growth, but does not bound the host's number or lifetime of live operations.
- Moving the namespace without both configuration scopes can disable a previously enabled repair or change project overrides. Explicit migration preserves effective settings and does not silently enable an inactive repair.
- A correctly aligned request can still miss Provider cache, and indivisible dependency changes remain unaligned. The added maintenance may produce insufficient benefit; controlled alignment success establishes mechanism behavior, while savings require separate real measurements.
