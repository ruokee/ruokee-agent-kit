# omp-smart-context

English | [中文](./omp-smart-context.zh.md)

## Goals

Maintain one self-contained native OMP package, `@ruokee/omp-smart-context`, under `projects/omp-smart-context`. Provide existing remote and Handoff alignment, compaction request usage accounting, and opt-in model prompt rules through independently switchable modules. Preserve each capability's scope, ownership, state, and failure boundary. OMP owns session history and maintenance execution.

Replace the standalone smart-cache component and QoL's migrated implementations without proxies, duplicate owners, or cross-component runtime dependencies. QoL's remaining adjustments retain their behavior, settings, defaults, and validation.

## Out of scope

- New compaction strategies, a strategy framework, new retries, or changes to native scheduling and adoption.
- Additional models, observers, role instructions, or automatic context-maintenance policies.
- Guaranteed cache residency, hit rates, or Provider savings.
- Usage accounting outside the four existing soft/Handoff purposes, inferred request identity, or locally invented prices.
- Replacing host templates, adding rule match dimensions or search paths, caching rules, per-request or intra-turn fallback refresh, or new side-request injection routes.
- Automatic installation, modification of user configuration, or rewriting existing session journals.

## Public surface

[Configuration](../../projects/omp-smart-context/README.md#configuration) and the native manifest own setting keys, defaults, and commands. Remote alignment defaults off, with an empty exact Provider and `hooks` mode; Handoff defaults off; usage compensation defaults on; model rules default off. There is no master switch.

Read one OMP-native activation snapshot using user settings and project overrides. Missing keys take defaults. Module-key errors disable only that module; an unknown key, non-object root, or failed getter rejects the whole component configuration. Restart applies setting changes. Rule files refresh independently on the next covered turn. Old-package settings are never a configuration source.

`/smart-context` reports the independent alignment stages and counters, live usage state, and model-rule state without starting a model turn or disclosing bodies, opaque data, credentials, raw endpoints, private paths, or private dynamic identifiers.

- [Alignment design](../../projects/omp-smart-context/docs/design.md) owns reference capture, proof, request rewriting, and invalidation details.
- [Usage accounting](../../projects/omp-smart-context/docs/usage.md) owns request identity, telemetry, session attribution, cost handling, and upstream retirement.
- [Model prompt rules](../../projects/omp-smart-context/README.md#model-prompt-rules) owns file discovery, format, matching, ordering, diagnostics, refresh, and trust.
- [Migration](../../projects/omp-smart-context/docs/migration.md) owns registration replacement and preservation of effective configuration.

## Invariants

### Request alignment

1. A confirmed ordinary main-loop dispatch is the only reference source. Ordinary and non-target requests remain unchanged. Title, advisor, warming, and Handoff requests do not establish ordinary references; a prepared request without tools cannot establish a Handoff reference.
2. Each actual session retains its own model, tools, prompt, persistent and Provider identity, epoch, dispatch, reference, and counters. Equal text, models, endpoints, cache keys, or timing do not establish ownership. Main, native task, and Eval sessions retain their existing coverage and isolation.
3. Operation references are immutable, including missing references. Navigation, branch changes, model/tool/history changes, cancellation, compaction commits, and release invalidate references under the existing contracts. Late responses, retries, or restored old values cannot revive invalid operations. Fresh confirmed ordinary work restores eligibility when its dependencies permit.
4. Complete retained-source proof takes precedence over local matching. Partial reuse requires independently extractable already-sent units with retained dependencies and processing conditions. Equal output or provenance alone is insufficient. No handler runs twice to reconstruct proof; opaque data, trimming, deleted history, call pairing, and new tails keep native boundaries.
5. Remote alignment targets the exact configured Provider's non-Codex `openai-responses` V2 requests. `standard` handles recognized native repairs; `hooks` additionally reuses proved completed handling. Neither changes native output limits or invents explicit tool choices.
6. Handoff independently supports `openai-completions` and `openai-responses`. Chat Completions restores the existing system, reasoning, and tool-choice axes. Responses restores source-proved missing system content while preserving native none, reasoning, configuration changes, and compatibility retry. Side instructions, history, cache keys, routing, side session, and cancellation stay native.
7. A physical request has at most one rewriting module. Each complete candidate is validated at final transport and replaced atomically. An identical candidate is already aligned; insufficient proof preserves the whole native request with a fixed reason, without blocking, delaying, or dropping it. Failure in one alignment capability does not disable the other.
8. OMP owns triggering, preparation, trimming, speculation, credentials, retries, fallback, adoption, commits, and continuation. Alignment adds no compaction entry point or `session_before_compact` handler. Wrappers preserve native arguments, receivers, results, exceptions, signals, and still-owned property shapes; foreign wrappers and old owners are not taken over.

### Usage accounting

- Only `compaction:summary`, `compaction:short-summary`, `compaction:turn-prefix`, and `compaction:handoff` are recorded. A completed in-scope request reporting tokens writes one native `model_usage` entry to its live session branch, and host statistics include it. Zero-token requests and other purposes write none.
- Record the actual resolved api, Provider, model, Provider tokens, stop reason, and supplied per-component cost. Keep existing identity-resolution and missing-data behavior: unresolved identity skips the entry, missing cost records zero and a count, and neither identity nor prices are guessed.
- Preserve user telemetry configuration, tracer behavior, callbacks, and child inheritance without duplicate wrapping. Do not read or retain request bodies, summaries, or handoff documents, or alter requests, timing, or routing.
- One process owner serves registered sessions; journal switches remove old session identities. Rejected configuration, stopped owners, foreign accessors, and native `compactionRequestUsage` retain their documented refusal and release behavior. Native recording disables compensation to prevent duplicate entries.
- Recheck native recording and session statistics after upstream PR #15034 merges. Remove compensation only when verified native behavior replaces it. Retirement does not remove either alignment capability or historical usage entries.

### Model prompt rules

- Disabled rules register no injection handler, read no directories or files, and diagnose no unused files. The switch is independent of alignment and usage.
- On each covered turn, discover direct non-hidden lowercase `.md` regular files from the current profile's user agent directory and current project `.omp/model-prompts`. Preserve exact/model/contains/regex case-sensitive matching and OR-once behavior.
- Append each matching file as its own block, user directory before project, filename order within each. Preserve incoming blocks and body bytes and order; exclude frontmatter and the opening BOM. Do not wrap, trim, render, rewrite history, or accumulate earlier turn bodies.
- Match the current effective model for ordinary main and child turns that run `before_agent_start`. Children keep their own model and role. Handoff, plan-mode children, titles, classification, and other bypasses gain no injection entry.
- File and directory errors remain local; absent model, rules, or matches keep input unchanged. Unexpected handler errors preserve incoming blocks and earlier handler results. Fixed, session-deduplicated diagnostics disclose no private body or path.

### Component ownership

Keep code, manifest, checks, and paired documentation inside the component. Use native host peers without a narrowed version range. Keep independent state and failure boundaries rather than a shared context store or module framework. Capability ADRs own their own contracts; adding or removing a capability without changing shared contracts does not require reversing the package ADR or unrelated capability decisions.

Migration removes the old package and QoL's two migrated keys from both user and project configuration. Preserve each old `enabled && moduleEnabled` result and every unrelated setting. Leftover migrated keys reject the whole QoL configuration; there is no compatibility exception. Existing rule files and session records remain valid.

## Host lower bound

Use the shared `18.5.0` maintenance floor and [compatibility declaration](../../projects/omp-smart-context/README.md#compatibility). Development dependencies are locked to that floor; host peers remain `*`. Check capability interfaces, not version allowlists. No upper bound or new installation gate is added.

## Acceptance criteria

- The actual candidate entry loads using its own dependencies and native configuration. Migrated capabilities have one owner; QoL does not install, stop, or inject them.
- Existing behavior checks retain positive and refused alignment, API-specific fields, ordinary-request preservation, operation ownership, invalidation, session isolation, local proof, and non-repeated handlers. Both independent off states preserve native requests.
- Usage checks cover all four purposes, request identity and session attribution, zero-token and out-of-scope skips, costs and missing data, user telemetry, inheritance, journal switching, and native retirement. Statistics match recorded usage without double counting.
- Rule checks cover defaults and zero-access shutdown, discovery, matching, byte fidelity, ordering, refresh, failure isolation, diagnostics, child context, and no accumulation.
- A local controlled run loads the candidate and locked host libraries, reads actual native settings, drives ordinary requests and native compaction preparation/serialization, and observes combined alignment, usage, and rule behavior with deterministic transport responses. Direct invocation of the registered status handler proves read-only behavior without claiming TUI rendering.
- User/project overrides and activation snapshots preserve restart-only settings while rule files refresh. Module-local errors leave unrelated capabilities usable. Migration preserves QoL's remaining behavior and effective opt-in intent.
- Component checks, changed selector, full aggregate, bilingual public documentation, current Specs, and successor ADRs agree. Record candidate, conditions, observations, and limits. Automated checks and controlled native-library runs are the acceptance boundary; real models, Provider benefit measurements, and a complete CLI/TUI matrix are not prerequisites. Keep historical evidence under its original candidate and scope.

## Related ADRs

- [Context package](../adr/decision/2026/10/12-smart-cache.md)
- [Request alignment](../adr/decision/2026/10/22-request-alignment.md)
- [Remote alignment](../adr/decision/2026/10/10-remote-alignment.md)
- [Handoff alignment](../adr/decision/2026/10/12-handoff-alignment.md)
- [Compaction usage](../adr/decision/2026/10/13-compaction-usage.md)
- [Model prompt rules](../adr/decision/2026/09/14-model-prompt-rules.md)
- [QoL boundary](../adr/decision/2026/09/20-omp-qol.md)
- [Host maintenance](../adr/decision/2026/09/28-host-maintenance.md)
- [Self-contained components](../adr/decision/2026/08/24-component-self-containment.md)
