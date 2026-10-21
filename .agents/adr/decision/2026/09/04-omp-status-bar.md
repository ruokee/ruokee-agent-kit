# OMP status bar

Decision owner: Ruokee
Decision writer: OMP Claude Opus 5.5
Reverses: [OMP status bar](../../../archived/2026/09/04-r4-omp-status-bar.md)

English | [中文](./04-omp-status-bar.zh.md)

## Motivation

Maintain `@ruokee/omp-status-bar` as one self-contained package with a status Host and registered providers, with a static glyph marking the context window in place of the speculation band estimate.

The `@ruokee/omp-status-bar` package shows the current session's context usage, token readings, cache-hit rate, and the number of model requests it has answered on one persistent row below the editor. The current choice covers the persistent row it owns, the structured and sanitized provider fragments the Host composes, the ordered configuration in the agent directory, the builtin metric providers and their fixed colors, the answered-request count, the static context window glyph, and the documentation and evidence that ship with the package. The package declares its maintenance commitment in its README, and the commitment does not decide which hosts may install it.

The package used to pair the context reading with an estimate that the context had entered OMP's speculation band. The estimate read the host's compaction settings through `Settings.getGroup`, which hosts from 18.4.0 no longer expose, so the indicator stayed hidden on current hosts. Under [Maintain host components against a shared OMP floor](./28-host-maintenance.md) the OMP-facing components share the maintenance lower bound OMP 18.5.0, so no maintained host can serve the estimate, and the package has no other public way to read those settings.

OMP records out-of-band model calls in the same session ledger as the conversation and reports them through the same session-wide usage statistics. The Find tool's judgment cascade is one such caller: it records its own calls with `purpose: "find"`, and those records carry no cache reading, because the judgment path reports an input count, an output count, and a billed cost, and writes cache read and cache write as zero regardless of what the serving endpoint cached. A reading taken from the session statistics therefore counts traffic the conversation never sent, which inflates the input reading and depresses the cache-hit rate, and the amount grows with the files a search reads.

## Analysis

A host peer declaration states which host packages the package imports, and a numeric range there also decides installation for every host that resolves the dependency ([the shared OMP floor decision](./28-host-maintenance.md)). The maintenance bound therefore stays out of the peer declaration and is a statement in the component README, while the package's coupling to OMP stays a capability coupling to the public widget and context-usage APIs. The versions and scenarios actually verified are evidence in the component documentation, not the bound itself.

The [predecessor decision](../../../archived/2026/09/04-r1-omp-status-bar.md) admits no builtin ID beyond its fixed list, and the enumeration itself was not the protected boundary. The same section excludes amount, cost, and premium-request readings and the legacy `tokens` alias, and the package usage documentation already maintains the builtin IDs with their options and their colors. Stating the provider scope and linking that documentation as the owner of the inventory therefore keeps the boundary.

A reading derived from session activity can ship only as a builtin provider. The public provider contract gives an instance its options, its configuration, a publication call, and managed timers; it carries no session data and no events, and the Host binds session sources for builtin providers only. Adding such a channel to the public contract is a larger change than adding the reading, and the Host already reports each turn to the extension together with how the response ended.

The session-wide total has no per-purpose split and no per-entry breakdown, so no caller of that API can separate the conversation's usage from the rest, while the branch a session holds carries every entry with its parent chain. That branch is already the source of the answered-request count, so the two readings re-seed together on a tree rewind, on a new branch, and on a session switch. A `task` tool result reports the sub-agent's work as part of the conversation's request, so those tokens belong to the conversation and stay counted. Only finite counters are added, so an unexpected record contributes fewer tokens rather than a non-numeric reading.

## Decision

### Package

`projects/omp-status-bar/` is one first-party, self-contained OMP Plugin Package. The [first-party capability kit decision](../08/20-first-party-capabilities.md) permits a real capability to use `projects/`, and the [self-contained component decision](../08/24-component-self-containment.md) requires every distributable component to remain independent. The package uses only public upstream OMP APIs without containing, patching, or requiring a local fork.

The implementation splits into a status Host and registered status providers. The public contract covers provider identity, option validation, instance creation and lifecycle, fragment publication, and managed scheduling. Registry storage, configuration loading, composition, diagnostics, and OMP UI calls stay private. Each configuration entry creates an independent instance, so the same provider ID may appear more than once with different options.

Registration is a supported package API, and the [provider contract](../../../../../projects/omp-status-bar/docs/provider-contract.md) owns its rules: the exported types and the import path behind them, the process-wide registry key, the rejections at registration time, and the version check the Host repeats before creating an instance. An extension that resolves its own copy of the package therefore registers into the same registry, and registration does not depend on extension load order.

### Configuration

OMP's native plugin enable and disable state is the sole package-wide switch, and the package defines no separate `enabled` field.

Configuration lives in `omp-status-bar.yml` under the active OMP agent directory returned by the publicly re-exported `getAgentDir()`, which keeps configuration profile-aware without adding keys to OMP's core settings schema. The upstream plugin settings schema accepts only scalar and enum values, so an ordered provider list with nested options cannot come from it.

The file holds a schema version, an ordered `statuses` array that both selects providers and defines their display order, and a top-level separator setting. The [usage documentation](../../../../../projects/omp-status-bar/docs/usage.md#configuration) owns the file's fields, their accepted values and defaults, the separator glyphs, and the per-entry failure behavior. The Host renders separators dimmed, providers never emit them, and a session without UI support stays idle.

### Persistent widget

One widget stays mounted below the editor for the session, and it supplements the native statusline: the package registers no statusline segment and replaces none. The Host owns mounting, composition, and width handling, and the [usage documentation](../../../../../projects/omp-status-bar/docs/usage.md#persistent-widget) states those rules.

### Fragments

The publication contract is a structured fragment instead of a string. The [provider contract](../../../../../projects/omp-status-bar/docs/provider-contract.md#publishing) owns the fragment types, the normalization rules the Host applies, the deep copy that isolates a later provider mutation, and the treatment of an empty, withdrawn, or structurally invalid fragment.

Providers never call OMP UI methods, never obtain the widget or theme, and never emit separators.

### Builtin providers

The package ships builtin metric providers. [The package usage documentation](../../../../../projects/omp-status-bar/docs/usage.md) owns the current inventory: the builtin IDs, their options, their output forms, and the formulas behind their values. A later addition or removal of a builtin ID changes that inventory rather than reversing this decision.

The provider scope stays bounded: the package ships no amount, cost, or premium-request reading, and it neither reads, formats, nor configures those amounts. The legacy `tokens` ID disappears without an alias.

Colors follow the pi-moon palette and are not configurable. The label option selects a compact or a word form per instance, so one configuration may mix both forms, and a narrow terminal never changes a chosen form. The precision of the cache-hit percentage is the only other display option, and its accepted range lives in the same usage documentation.

The token metrics and the cache-hit ratio share one data scope taken from the conversation's own usage rather than the session aggregate: the assistant messages on the branch a session holds and the usage a `task` tool result reports, with out-of-band records contributing nothing. No reading depends on orchestration fields or amounts, and the usage documentation states that scope, the excluded records, the shared token formatter, and the formulas behind each reading.

The `context` provider reads the public context-usage API in a `percent` (default) or `absolute` mode, and `absolute` renders only the current token count with the shared formatter.

### Request count

The package ships one builtin provider, `turn`, that counts the model requests the current session answered successfully and publishes the count as a reading of its own. It derives no further metric from it, and its label, options, and display forms live in the usage documentation.

The value keeps its value when the session is resumed or switched, and it always reports the branch the session holds, so a tree rewind or a new branch re-seeds the count from the branch then in front.

Only a successful response advances the value. A failed request, an interrupted response, and a request stopped before the model call leave it unchanged.

The provider follows the session's turn lifecycle instead of the snapshot-backed metrics: it schedules no timer and leaves the sampling cadence to them.

### Context glyph

The `context` status always shows the Nerd Font glyph `U+F0068` to the left of its text, as a marker for the context window. The glyph and the text form one status fragment. The glyph does not blink, does not change with context usage, and does not show the window size. Terminals whose fonts lack the glyph see no fallback.

The package reads no compaction setting and does not estimate OMP's speculation band.

### Evidence

The [English and Chinese public documentation decision](../08/20-bilingual-docs.md) applies with package-local usage documents and reciprocal language links. Package documentation covers installation, enablement, the configuration schema, the builtin provider IDs and their options, per-entry failure behavior, the widget placement, the context window glyph, the meaning and the display of the answered-request count, and the host versions actually verified with the scenarios they cover. The component README compatibility section declares the maintenance lower bound and is that bound's authoritative statement: the package declares the shared OMP bound and no maintenance upper bound, keeps no supported-version whitelist, and blocks no host by its version alone. A host below the bound is not prevented from running the package and gains no maintenance commitment, and raising the bound follows [the shared OMP floor decision](./28-host-maintenance.md). Provider authoring documentation defines the public import path, registration phase, contract versioning, collision behavior, lifecycle context, and how to install and select an independently packaged provider.

The direct `@oh-my-pi/*` imports declare their host packages as peer dependencies without a version range, so the declaration names the host packages the package uses and carries no maintenance limit. Behavioral tests cover configuration parsing and per-entry degradation, fragment sanitization and invalid-fragment isolation, ordered composition and width truncation, the `context` fragment with its glyph, the answered-request counting rule with its display states and its session behavior, registration from a separately loaded extension without shared module identity, cleanup without residual timers or widgets, and the target version's built-in Composer shapes and statusline presets with an extension-registered shape, all through the same widget path. The automated suite is headless and cannot see the terminal: a real OMP TUI session that confirms the widget appears below the editor alongside the native statusline is a release requirement, run and reviewed per release commit before tagging, not inside the unit suite.

## Alternatives considered

**Keep plain-text metrics in the native statusline.** This keeps `setStatus()` viable, but leaves placement and visibility to `showHookStatus` and preset segments. It sacrifices the fixed metric colors, controlled truncation, and an independently persistent row.

## Consequences

The Host owns sanitization, composition, truncation, and the widget lifecycle, so providers stay small and cannot corrupt the row. Third-party extensions gain a stable, versioned contract for adding providers without touching the Host.

The package is coupled to OMP's public widget and context-usage APIs. It declares a maintenance lower bound and no maintenance upper bound, which states the maintenance commitment rather than a promise that every later release works, and the versions and scenarios actually verified stay in the component documentation beside that declaration. Every release runs its real TUI check on the host it targets before tagging, because the automated suite is headless and cannot see the terminal.

The row no longer indicates that the context has probably entered OMP's speculation band. A user who relied on the blink learns of compaction only from OMP's own interface, and on a host before 18.4.0 the indicator that still worked there becomes the static glyph.

The answered-request count follows the branch a session holds, so a rewind lowers it, and a session binding can show a value one below what the session recorded immediately before. Both outcomes are intended.

The package ships no compatibility layer for the plain-text contract, the `tokens` ID, cost display, or arbitrary separators.

The token readings and the cache-hit rate describe the conversation rather than the session. OMP's own statusline and any cost report still include out-of-band traffic, so the row and those readings differ by design, and the usage documentation states the scope and the excluded records beside the formulas.

A host that stops reporting `task` usage on the tool result, or that records conversation usage in another shape, leaves the readings under-counting.

Each sample walks the branch, so the work grows with the session's entry count on the sampling cadence. The walk reads only the fields it needs and runs at most once per tick for all five readings.
