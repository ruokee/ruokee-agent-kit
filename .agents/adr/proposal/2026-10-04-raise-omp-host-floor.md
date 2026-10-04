# ADR proposal: Raise the OMP host floor to 18.5.0

Draft owner: Ruokee
Draft writer: OMP Claude Opus 5.5

English | [中文](./2026-10-04-raise-omp-host-floor.zh.md)

## Motivation

Raise the maintenance lower bound of every OMP-facing component to OMP 18.5.0, remove the code that only serves earlier hosts, and replace the two features that no longer work on current hosts.

The OMP-facing components are `omp-context-pin`, `omp-system-prompt`, `omp-qol`, `omp-status-bar`, `omp-codex-web-access`, and the OMP adapter of `tk`. Their README files declare bounds between 18.1.8 and 18.2.8, while their development and real-host checks have moved to 18.4.x and 18.5.x. Each component keeps code for the hosts at the bottom of that range. Two features no longer work on current hosts, and the existing system prompt decision and status bar usage guide record both limits:

- The default-block route of `omp-system-prompt` recognizes only the identity lines OMP used before 18.3.0. On 18.3.0 and later it finds no main block, reports a failure on every turn, and leaves the host prompt unchanged. Users without a selected template get no strategy text and one diagnostic per session.
- The speculation band indicator of `omp-status-bar` reads the compaction settings through `Settings.getGroup`, which current hosts no longer expose. The indicator stays hidden on those hosts.

[Adapt first-party host components to host upgrades](../decision/2026-09-28-adapt-components-to-host-upgrades.md) raises a bound only for one component at a time, and only when that component cannot serve both hosts or would need a large rewrite. It requires rereading host sources and verifying by impact at each upgrade, and the limits above were recorded that way. Under the same rule the bounds drift apart and stay well below the host the components are developed against, and each component keeps paths that only older hosts use, such as the default-block route and the speculation band estimate. This proposal trades support for those older hosts for a smaller maintained surface: it removes the paths that serve only hosts before 18.5.0 and maintains every component against one chosen shared baseline.

## Analysis

The evidence comes from the published OMP sources at the release tags named below.

- **System prompt identity.** The [18.5.0 system prompt](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/prompts/system/system-prompt.md) opens with `RFC 2119 keywords:` and the identity line `You are omp's trusted coding assistant.`. That identity line first appears in 18.3.0; the two identity lines the default-block route recognizes come from earlier releases.
- **Project footer.** From 18.4.1 the host renders the project footer as a `<project-context>` block; 18.4.0 still renders the older `PROJECT` footer. 18.5.0 adds a subagent branch to the critical tail that follows `<project-context>` in the footer block, which the template route already recognizes.
- **Host prompt selection.** In 18.5.0, [`discoverSystemPromptOverride`](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/system-prompt.ts) looks at the project level before the user level, and within one level a literal `SYSTEM.md` wins over `SYSTEM_TEMPLATE.md`. An explicit command-line template or prompt overrides discovery. A selected `SYSTEM.md` is wrapped by the host's custom-prompt template, and the `<project-context>` block is still appended.
- **Compaction settings.** The 18.5.0 [`Settings`](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/config/settings.ts) class has no `getGroup` method; the method exists through 18.3.x and is gone from 18.4.0. Its remaining readers take a setting handle, and a handle created by an extension comes from the extension's own module copy, so the status bar has no public way to read the host's compaction settings.
- **Wait entry.** The builtin [`hub` tool](https://github.com/can1357/oh-my-pi/tree/v18.2.11/packages/coding-agent/src/tools/hub) is present at the 18.1.20 and 18.2.11 tags and absent from 18.3.0. The standalone [`wait` tool](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/tools/wait.ts) exists from 18.3.0. `omp-qol` uses `waitMessagesSeconds` and `waitProcessSeconds` only on the `hub` path; on standalone `wait` they are already reported as not applicable.
- **Context pin probes.** The host members `omp-context-pin` checks before activation, the members behind its `getEntries` probe, and the required `timestamp` field on user messages all exist in 18.1.8, the component's current bound. Those checks and the count fallback for a missing timestamp only guard hosts below the current bound.

Nothing in this evidence depends on a host later than 18.5.0.

## Proposal

### One maintenance lower bound for OMP-facing components

Every OMP-facing component declares OMP 18.5.0 as its maintenance lower bound in its `README.md` and `README.zh.md` compatibility section. For `tk`, the bound covers the host-side code of the OMP adapter in `tools` mode; the `cli` mode component and the Pi adapter keep their own statements.

The bound is a shared maintenance baseline: the OMP release the components are developed and verified against. It is chosen for all OMP-facing components together rather than derived for each component from the oldest host it could still serve. A later raise moves every OMP-facing component's bound together through one decision.

Where a component has development dependencies on `@oh-my-pi/*`, they move to 18.5.0, and test fixtures and real-host checks use 18.5.0 host behavior as their baseline.

These rules stay as they are: the README section is the authoritative statement of the bound, there is no upper maintenance bound, host peer declarations stay unrestricted, and no installation condition, activation check, or runtime version comparison carries the bound. A host below the bound is not blocked, but it gets no maintenance commitment and may lose behavior the removed code provided.

Code paths, probes, fixtures, tests, and documentation sections that exist only for hosts before 18.5.0 are removed. Host behavior introduced in 18.5.0, such as the subagent footer tail, stays supported.

| Component | Current bound | Proposed bound |
| --- | --- | --- |
| `omp-context-pin` | 18.1.8 | 18.5.0 |
| `omp-system-prompt` | 18.1.21 | 18.5.0 |
| `omp-qol` | 18.2.8 | 18.5.0 |
| `omp-status-bar` | 18.2.8 | 18.5.0 |
| `omp-codex-web-access` | 18.2.8 | 18.5.0 |
| `tk` OMP adapter | 18.2.8 | 18.5.0 |

### Host support users lose

Hosts before 18.5.0 no longer receive a maintenance commitment from any OMP-facing component. Three behaviors that still work on some of those hosts are removed:

- On hosts before 18.3.0, the `omp-system-prompt` default-block route still replaces the host's default block with the component's strategy text. After this change those hosts keep the host prompt unless the user selects the template, and the component reports nothing.
- On hosts with the builtin `hub` tool, which include 18.2.8 through 18.2.11 within the current `omp-qol` maintenance range, the `omp-qol` total-deadline wait applies to `hub`. After this change the wait adjustment finds no standalone `wait` entry there and leaves native behavior in place with its existing bounded reason.
- On hosts before 18.4.0, where `Settings.getGroup` still exists, the `omp-status-bar` speculation band indicator still estimates the band and blinks. After this change those hosts show the static glyph only.

`omp-context-pin`, `omp-codex-web-access`, and the `tk` OMP adapter remove no behavior that a host from their current bound up to 18.5.0 uses. Their users on those hosts lose the maintenance commitment only.

### omp-system-prompt: the template is an optional example

The component keeps one route: the host renders the component's own template.

- The component ships `host-template.hbs`, generated from its own template source. The English and Chinese README installation guides list it as an optional step and describe both ways to enable it: pass `--system-prompt-template <path to host-template.hbs>` for one run, or place the file as a project-level or user-level `SYSTEM_TEMPLATE.md`.
- The guides state the host's selection order: a command-line argument wins over discovered files, the project level wins over the user level, and within one level `SYSTEM.md` wins over `SYSTEM_TEMPLATE.md`. An installed template therefore has no effect while a higher-priority `SYSTEM.md` exists.
- The component does not write, copy, or select a template file, and it does not modify or delete any of the user's system prompt inputs.
- When the current turn's main block is a render of the component's template, the existing template route applies unchanged, including the Delivery chapter, the `<project-context>` footer correction, and their per-step diagnostics.
- When the main block is not recognized as a render of the component's template, the component changes no block, including the `<project-context>` footer, and reports no diagnostic. This covers a session with no template, `SYSTEM.md`, `--system-prompt`, and any other template. The host's default logic applies.
- The component no longer recognizes or rewrites the structure of the host's default system prompt. The default-block route, the route precedence between the two routes, the older `PROJECT` footer handling, and the skill-description single-lining that only the default-block route performed are removed.
- Appending model-scoped rule documents does not depend on the template and keeps its behavior.

### omp-status-bar: a static context window glyph

The `context` status always shows the Nerd Font glyph `U+F0068` to the left of its text, as a marker for the context window. The glyph and the text form one status fragment joined by a plain space. The glyph does not blink, does not change with context usage, and does not show the window size.

The component reads no compaction setting and no longer estimates the speculation band. The speculation state machine, its sampling, its diagnostics, its documentation, and its tests are removed. The `context` status still publishes nothing when usage data is missing or `contextWindow <= 0`.

### omp-qol: standalone wait only

The wait module serves the standalone `wait` entry only, and the `hub` wait path is removed. Every setting declared by the `omp-qol` 0.5.0 manifest stays, compared setting by setting: all 20 keep their keys, defaults, and ranges, and none is added or removed. The 20 include `compactionCacheEnabled` and `compactionCacheProvider`, which [the current QoL decision](../decision/2026-10-04-align-remote-compaction-cache.md) added with remote compaction cache alignment to the 18 settings declared before it. `waitMessagesSeconds` and `waitProcessSeconds` have no effect on supported hosts, and the English and Chinese documentation and the setting descriptions in the manifest say so.

The ownership checks of the compaction deadline patch stay unchanged, including the refusal to coexist with a patch marked by `Symbol.for("ruokee.omp.compaction-timeout.patched")`.

### Other OMP-facing components

`omp-context-pin` removes its pre-activation member checks, its `getEntries` capability probe, and its count fallback for messages without a timestamp. Record integrity, entry identity, branch scope, delivery, and persistence ownership keep their rules.

`omp-codex-web-access` changes its declaration, development dependencies, and test baseline. The `tk` OMP adapter, which declares only an unrestricted host peer, changes its declaration and verification baseline. The `tk` runtime protocol, its `runtime_compat` check, the preflight validation, and the zero-registration result of a failed preflight are not host maintenance rules and do not change.

### Decisions to reverse

**[Adapt first-party host components to host upgrades](../decision/2026-09-28-adapt-components-to-host-upgrades.md).** Effective clauses: "The lower bound follows the delivered component's load conditions, required capabilities, and behavior" and "Development dependency versions and the latest tested version cannot simply become the lower bound"; a raise "becomes possible when the component genuinely cannot serve both host versions, or when serving both would need a large rewrite while a substantially smaller change raises the bound"; and "One component's raise does not move another component's bound." Proposed choice: one shared bound for all OMP-facing components, set at the development target and raised together. Both cannot hold: `omp-context-pin`, `omp-codex-web-access`, and the `tk` OMP adapter can serve their current bounds without a conflict or a rewrite, and this proposal moves their bounds together with the others. The successor keeps the decision's other rules: the README as the authoritative statement, no upper bound, unrestricted peers and no version gate, keeping the behavior maintained hosts need, adapter isolation, capability-based selection, local loading and failure boundaries, verification matched to the change, and raising a bound only through a decision.

**[Render the system prompt strategy from a host template](../decision/2026-09-30-render-system-prompt-from-host-template.md).** Effective clauses: the two recognized instruction blocks, the default-block route and the template route; the route precedence between them; "Any other shape … leaves the input unchanged with one bounded reason"; "Description single-lining stays on the older path"; and, in the 2026-10-03 change, "The strict older `PROJECT` path is unchanged." The compatibility boundary also states that the component "raises no maintenance bound" and keeps its maintenance declaration as recorded under the host upgrade decision. Proposed choice: the template route only, with no change and no diagnostic for any main block that is not a recognized render of the component's template. Both cannot hold: the decision requires the default-block route and a bounded diagnostic for every unmatched turn, and this proposal removes the route and the diagnostic. The successor states the shared 18.5.0 bound and keeps the template route contract, the user's own choice of template, the rule that the component writes no prompt file, the unrestricted peer, and the absence of host version reads.

**[Maintain the OMP status bar across OMP host upgrades](../decision/2026-10-02-scope-token-metrics-to-conversation.md).** Effective clauses: the section "Estimate the speculation band from public data", including the three indicator states and the compaction settings group as an input; the `context` provider joining its text with the speculation glyph; the coupling to compaction-resolution APIs; and the documentation and tests of the speculation estimate. Proposed choice: a static `U+F0068` glyph with no compaction reads. Both cannot hold: the decision requires an estimate computed from the compaction settings, and this proposal forbids reading them. The successor keeps the widget, the provider contract, the builtin inventory, the answered-request count, and the real TUI check before each release tag.

**[Maintain OMP quality-of-life adjustments with remote compaction cache alignment](../decision/2026-10-04-align-remote-compaction-cache.md).** Effective clause: the 2026-09-29 change "Select the wait entry by capability", which states "A builtin `hub` keeps the established behavior unchanged" and gives both entries one shared deadline mechanism. Proposed choice: standalone `wait` only. Both cannot hold: the decision keeps the `hub` behavior, and this proposal removes it. The successor keeps the standalone `wait` contract, the setting keys, the error recovery, the compaction deadline experiment with its ownership rules, native replay, and cache alignment.

### Decisions to update without reversal

- [Add the omp-context-pin extension](../decision/2026-09-15-add-omp-context-pin.md) records no version gate or probe. A `Changes` entry records the new bound and the removed checks; activation still uses the host's public API, and the safety boundaries keep their rules.
- [Add model-scoped prompt rules to the system prompt extension](../decision/2026-09-14-add-model-prompt-rules.md) runs the append step after the replacement step. A `Changes` entry records that a turn without the template is a no-op for the replacement step rather than a failure, that the append step still extends the host array, and that the inherited host contract now comes from the system prompt successor decision.
- [Integrate tk tools with Harnesses](../decision/2026-09-02-integrate-tk-tools-with-harnesses.md) keeps its runtime protocol. A `Changes` entry records the OMP adapter's new bound.
- [Keep distributable components self-contained](../decision/2026-08-24-keep-components-self-contained.md) keeps the maintenance declaration inside each component. A `Changes` entry points that rule to the successor of the host upgrade decision.

Every current decision that cites a reversed decision as current authority, including the updated decisions above, links to its successor instead. [Use native plugin settings for Codex web access](../decision/2026-09-10-use-codex-web-plugin-settings.md) records no bound and cites none of the reversed decisions, so it needs no change.

## Alternatives considered

**Raise each component's bound only when it cannot serve both hosts.** This is the current rule. It keeps hosts down to each component's current bound wherever the code still serves them, but it leaves the six components on different bounds below the development host, and the components keep maintaining the default-block route and the speculation band estimate, which work only on older hosts.

**Have `omp-system-prompt` ship a default template that applies without user action.** This was the first direction for replacing the default-block route. It would restore the strategy for users who select nothing, but the component would have to write or select a host prompt file, which the system prompt decision excludes and which would override a choice the host leaves to the user.

**Keep the diagnostic when no template render is recognized.** This is the current behavior. It tells a user whose template failed to match, but a user of `SYSTEM.md`, `--system-prompt`, or no template gets a failure report for a path the component does not serve.

**Keep the bound value in a component specification and raise it as an ordinary specification change.** This was suggested while analyzing why the bounds drifted. It removes the decision step from each raise, but it depends on a specification layer the repository does not have. This proposal keeps raises as decisions.

## Acceptance criteria

1. Each OMP-facing component's `README.md` and `README.zh.md` declare 18.5.0 as the maintenance lower bound, and every `@oh-my-pi/*` development dependency in those components is 18.5.0. Host peers stay unrestricted, and no component compares host versions at runtime.
2. No code path, probe, fixture, test, or documentation section that exists only for hosts before 18.5.0 remains, including the `omp-system-prompt` default-block route, its older `PROJECT` footer handling and 18.1.21 fixture, the `omp-qol` `hub` wait path, the `omp-status-bar` compaction settings read, and the `omp-context-pin` checks listed above. The 18.5.0 subagent footer tail is still recognized.
3. On OMP 18.5.0 or later, after the user selects `host-template.hbs` as the README describes, the main agent's system prompt is rendered from that template and processed by the template route. Without a template, or with `SYSTEM.md` or `--system-prompt`, the system prompt is byte-for-byte the host's input apart from appended model-rule documents, and the session shows no diagnostic from the component. The user's system prompt files are unchanged after the component runs.
4. The `omp-system-prompt` README pair lists the template as optional, describes both ways to enable it, and states the host's selection order.
5. On OMP 18.5.0 or later, when context usage data exists, the `context` status shows a static `U+F0068` to the left of its text. The `omp-status-bar` source reads no compaction setting, and no speculation estimate code, documentation, or test remains.
6. The `omp-qol` manifest matches the `omp-qol` 0.5.0 manifest setting by setting: all 20 settings, including `compactionCacheEnabled` and `compactionCacheProvider`, keep their keys, defaults, and ranges, and no setting is added or removed. The descriptions of `waitMessagesSeconds` and `waitProcessSeconds` state that they have no effect, and compaction patch ownership, including the refusal to coexist with the marked foreign patch, behaves as before.
7. The four reversed decisions are archived with complete successors linked by `Reverses` and `Reversed by`, the four updated decisions carry `Changes` entries, and this proposal is removed.

## Risks

A user who keeps an OMP release before 18.5.0 and updates a component loses the removed behavior without a warning. On a host before 18.3.0 the system prompt strategy stops applying unless the user selects the template, and the component reports nothing because an unrecognized prompt no longer produces a diagnostic. On a `hub` host the total-deadline wait stops applying, and on a host before 18.4.0 the speculation band indicator is replaced by the static glyph.

A template that does not apply is silent. A user whose template is shadowed by a higher-priority `SYSTEM.md`, or whose copy of `host-template.hbs` is outdated or edited outside its dynamic slots, gets the host prompt with no diagnostic and may believe the strategy is in effect.
