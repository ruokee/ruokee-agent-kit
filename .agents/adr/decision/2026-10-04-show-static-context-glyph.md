# ADR decision: Maintain the OMP status bar with a static context glyph

Decision owner: Ruokee
Decision writer: OMP Claude Opus 5.5
Reverses: [Maintain the OMP status bar across OMP host upgrades](../archived/2026-10-02-scope-token-metrics-to-conversation.md)

English | [中文](./2026-10-04-show-static-context-glyph.zh.md)

## Motivation

Maintain `@ruokee/omp-status-bar` as one self-contained package with a status Host and registered providers, with a static glyph marking the context window in place of the speculation band estimate.

The `@ruokee/omp-status-bar` package shows the current session's context usage, token readings, cache-hit rate, and the number of model requests it has answered on one persistent row below the editor. The current choice covers the persistent row it owns, the structured and sanitized provider fragments the Host composes, the ordered configuration in the agent directory, the builtin metric providers and their fixed colors, the answered-request count, the static context window glyph, and the documentation and evidence that ship with the package. The package declares its maintenance commitment in its README, and the commitment does not decide which hosts may install it.

The package used to pair the context reading with an estimate that the context had entered OMP's speculation band. The estimate read the host's compaction settings through `Settings.getGroup`, which hosts from 18.4.0 no longer expose, so the indicator stayed hidden on current hosts. Under [Maintain host components against a shared OMP floor](./2026-10-04-raise-omp-host-floor.md) the OMP-facing components share the maintenance lower bound OMP 18.5.0, so no maintained host can serve the estimate, and the package has no other public way to read those settings.

OMP records out-of-band model calls in the same session ledger as the conversation and reports them through the same session-wide usage statistics. The Find tool's judgment cascade is one such caller: it records its own calls with `purpose: "find"`, and those records carry no cache reading, because the judgment path reports an input count, an output count, and a billed cost, and writes cache read and cache write as zero regardless of what the serving endpoint cached. A reading taken from the session statistics therefore counts traffic the conversation never sent, which inflates the input reading and depresses the cache-hit rate, and the amount grows with the files a search reads. In the validation run recorded when the readings moved to the conversation scope, one Find call over a large repository added 68K input tokens and no cache read, moving the reading from 43.5% to 8.9%.

## Analysis

A host peer declaration states which host packages the package imports, and a numeric range there also decides installation for every host that resolves the dependency ([the shared OMP floor decision](./2026-10-04-raise-omp-host-floor.md)). The maintenance bound therefore stays out of the peer declaration and is a statement in the component README, while the package's coupling to OMP stays a capability coupling to the public widget and context-usage APIs. The versions and scenarios actually verified are evidence in the component documentation, not the bound itself.

The [predecessor decision](../archived/2026-09-05-use-omp-status-bar-widget.md) admits no builtin ID beyond its fixed list, and the enumeration itself was not the protected boundary. The same section excludes amount, cost, and premium-request readings and the legacy `tokens` alias, and the package usage documentation already maintains the builtin IDs with their options and their colors. Stating the provider scope and linking that documentation as the owner of the inventory therefore keeps the boundary.

A reading derived from session activity can ship only as a builtin provider. The public provider contract gives an instance its options, its configuration, a publication call, and managed timers; it carries no session data and no events, and the Host binds session sources for builtin providers only. Adding such a channel to the public contract is a larger change than adding the reading, and the Host already reports each turn to the extension together with how the response ended.

The session-wide total has no per-purpose split and no per-entry breakdown, so no caller of that API can separate the conversation's usage from the rest, while the branch a session holds carries every entry with its parent chain. That branch is already the source of the answered-request count, so the two readings re-seed together on a tree rewind, on a new branch, and on a session switch. A `task` tool result reports the sub-agent's work as part of the conversation's request, so those tokens belong to the conversation and stay counted. Only finite counters are added, so an unexpected record contributes fewer tokens rather than a non-numeric reading.

## Decision

### Keep one self-contained package with a Host and providers

`projects/omp-status-bar/` is one first-party, self-contained OMP Plugin Package. The [first-party capability kit decision](./2026-08-20-establish-first-party-capability-kit.md) permits a real capability to use `projects/`, and the [self-contained component decision](./2026-08-24-keep-components-self-contained.md) requires every distributable component to remain independent. The `package.json` declares the native extension entry through `omp.extensions`, and the package uses only public upstream OMP APIs without containing, patching, or requiring a local fork.

The implementation splits into a status Host and registered status providers. Provider registration is a supported package API through the `package.json#exports` entry `@ruokee/omp-status-bar/provider`. Registration uses a versioned process-wide registry keyed through `Symbol.for()`, so an extension that resolves its own copy of the package still registers into the same registry, and registration does not depend on extension load order. The registry rejects duplicate provider IDs and incompatible contract versions at registration time, and the Host resolves the configured ID from the registry and validates its contract version again before creating each instance.

The public contract covers provider identity, option validation, instance creation and lifecycle, fragment publication, and managed scheduling. Registry storage, configuration loading, composition, diagnostics, and OMP UI calls stay private. Each configuration entry creates an independent instance, so the same provider ID may appear more than once with different options.

### Use native enablement and agent-directory configuration

OMP's native plugin enable and disable state is the sole package-wide switch, and the package defines no separate `enabled` field.

Configuration lives in `omp-status-bar.yml` under the active OMP agent directory returned by the publicly re-exported `getAgentDir()`, which keeps configuration profile-aware without adding keys to OMP's core settings schema. The upstream plugin settings schema accepts only scalar and enum values, so an ordered provider list with nested options cannot come from it.

The file starts with a schema version, and its ordered `statuses` array both selects providers and defines their display order. The entry schema lives in the package usage documentation. Configuration is read once at session start, later file edits are not hot-reloaded, and a new configuration applies in the next session. A missing file displays nothing. A malformed top-level document starts no providers and records one bounded diagnostic. An entry with an unknown provider, an incompatible contract version, or invalid options is skipped while valid entries run. An empty `statuses` array is valid but mounts nothing. The Host performs these session behaviors only when the Extension context has UI support, and stays idle headless.

A top-level separator setting selects the glyph between entries, with its accepted values and default in the usage documentation. The Host renders separators in a dimmed style, and providers never emit separators.

### Mount one persistent belowEditor widget

After configuration loads and at least one provider starts, the Host mounts one component factory below the editor under one stable package-qualified key, once per session. Provider updates only replace the fragments the Host stores and request a component render; they never mount the widget again. On shutdown the Host stops providers, clears timers, and unmounts the widget.

The widget renders one line, composed strictly in `statuses` order. Empty fragments contribute nothing and produce no separators. When nothing is visible, the widget renders zero rows but stays mounted so later data can reappear.

The Host colors the composed line first, then truncates it from the right to the terminal width with a single trailing ellipsis using ANSI-aware width measuring, so leading entries survive. A narrow terminal never reorders entries, drops entries, or changes a `word` label to a compact one.

The widget supplements the native statusline: the package registers no statusline segment and replaces none. Widget visibility depends on neither `statusLine.showHookStatus` nor a custom preset's `status` segment. Every built-in Composer shape of the target OMP version uses the same belowEditor mount point.

### Publish structured and sanitized fragments

The publication contract is a structured fragment instead of a string:

```ts
interface ProviderSpan {
  text: string;
  color?: `#${string}`;
  dim?: boolean;
}

interface ProviderFragment {
  spans: readonly ProviderSpan[];
}
```

The Host sanitizes every span and deep-copies the result, so a later edit by the provider cannot change the UI; the accepted colors and the escape and control-character handling live in the provider contract. An empty fragment, or one that sanitizes to nothing, withdraws that instance's content. A structurally invalid fragment clears that instance's previous content and records a bounded diagnostic while other providers keep running.

Providers never call OMP UI methods, never obtain the widget or theme, and never emit separators.

### Ship the builtin metric providers

The package ships builtin metric providers. [The package usage documentation](../../../projects/omp-status-bar/docs/usage.md) owns the current inventory: the builtin IDs, their options, their output forms, and the formulas behind their values. A later addition or removal of a builtin ID changes that inventory rather than reversing this decision.

The provider scope stays bounded: the package ships no amount, cost, or premium-request reading, and it neither reads, formats, nor configures those amounts. The legacy `tokens` ID disappears without an alias.

Every builtin metric carries its own fixed color, following the pi-moon palette; colors are not configurable. The label option selects a compact or a word form per instance, so one configuration may mix both forms, and a narrow terminal never changes a chosen form. The precision of the cache-hit percentage is the only other display option, and its accepted range lives in the same usage documentation.

The token metrics and the cache-hit ratio share one data scope taken from the conversation's own usage: the assistant messages on the branch a session holds, and the usage a `task` tool result reports. Out-of-band records contribute nothing, including the judgment cascade's `model_usage` entries whatever purpose they carry; an entry of another type or a message of another role contributes nothing; and within a usage that counts, only finite counters are added, so an invalid counter is left out while the remaining counters still count. `I` is input plus cache write, `C` is cache read, `O` is output, `T` is `I + C + O`, and the ratio is `C / (I + C)`. They read no orchestration fields and no amounts. Token counts use one shared decimal formatter with `K`, `M`, `G`, and `T` units, and a metric publishes nothing while its own data is absent instead of rendering a zero.

The `context` provider reads the public context-usage API in a `percent` (default) or `absolute` mode. `absolute` renders only the current token count with the shared formatter; the context window stays an internal input for validation. The provider joins the context window glyph and the context text into one fragment with a plain space, bypassing the configured separator.

### Count the model requests a session answers

The package ships one builtin provider, `turn`, that counts the model requests the current session answered successfully and publishes the count as a reading of its own. It derives no further metric from it, and its label, options, and display forms live in the usage documentation.

The value is session-cumulative: it grows across prompts and across agent runs without restarting, and it keeps its value when the session is resumed or switched. It always reports the branch the session holds, so a tree rewind or a new branch re-seeds the count from the branch then in front.

Only a successful response advances the value. A failed request, an interrupted response, and a request stopped before the model call leave it unchanged.

The provider follows the session's turn lifecycle instead of the snapshot-backed metrics: it schedules no timer and leaves the sampling cadence to them.

### Mark the context window with a static glyph

The `context` status always shows the Nerd Font glyph `U+F0068` to the left of its text, as a marker for the context window. The glyph and the text form one status fragment. The glyph does not blink, does not change with context usage, and does not show the window size. Terminals whose fonts lack the glyph see no fallback.

The package reads no compaction setting and does not estimate OMP's speculation band. The `context` status still publishes nothing when usage data is missing or `contextWindow <= 0`.

### Keep implementation evidence with the project

The [English and Chinese public documentation decision](./2026-09-07-colocate-bilingual-docs.md) applies with package-local usage documents and reciprocal language links. Package documentation covers installation, enablement, the configuration schema, the builtin provider IDs and their options, per-entry failure behavior, the widget placement, the context window glyph, the meaning and the display of the answered-request count, and the host versions actually verified with the scenarios they cover. The component README compatibility section declares the maintenance lower bound and is that bound's authoritative statement: the package declares the shared OMP bound and no maintenance upper bound, keeps no supported-version whitelist, and blocks no host by its version alone. A host below the bound is not prevented from running the package and gains no maintenance commitment, and raising the bound follows [the shared OMP floor decision](./2026-10-04-raise-omp-host-floor.md). Provider authoring documentation defines the public import path, registration phase, contract versioning, collision behavior, lifecycle context, and how to install and select an independently packaged provider.

The direct `@oh-my-pi/*` imports declare their host packages as peer dependencies without a version range, so the declaration names the host packages the package uses and carries no maintenance limit. Behavioral tests cover configuration parsing and per-entry degradation, fragment sanitization and invalid-fragment isolation, ordered composition and width truncation, the `context` fragment with its glyph, the answered-request counting rule with its display states and its session behavior, registration from a separately loaded extension without shared module identity, cleanup without residual timers or widgets, and the target version's built-in Composer shapes and statusline presets with an extension-registered shape, all through the same widget path. The automated suite is headless and cannot see the terminal: a real OMP TUI session that confirms the widget appears below the editor alongside the native statusline is a release requirement, run and reviewed per release commit before tagging, not inside the unit suite.

## Alternatives considered

**Keep `setStatus()` with per-metric styled plain text.** The `setStatus()` channel accepts any string, so a provider could embed raw ANSI sequences. The Host could still parse and selectively allow them, but that turns styling into a complex, fragile escape-sequence protocol between Host and providers, and width truncation would have to parse arbitrary provider output. With structured spans the Host stays the single point that sanitizes, styles, composes, and truncates.

**Publish each metric as plain text.** This keeps `setStatus()` viable, since the content is one uncolored string. It sacrifices the fixed metric colors and controlled truncation.

**Render metrics inside the native statusline through the `setStatus()` channel or custom segments.** The native statusline is user-configured; `showHookStatus` and preset segments control placement and visibility, so the package could not guarantee a stable row, and segment registration would replace user-visible native components. A persistent widget row makes the capability independent of the user's statusline configuration.

**Use one provider with display toggles instead of independent metric providers.** A single provider with per-metric switches would duplicate the selection and ordering that `statuses` already provides, and the two mechanisms could disagree about which metrics show and in what order. Independent providers let one structure both select and order.

**Subtract the out-of-band records from the session aggregate.** This keeps the session statistics as the base. The aggregate exposes no per-purpose split, so the subtraction would have to walk the same branch and classify the same records the direct sum reads, then subtract them from a total that already contains them. The result would rest on two sides that must keep agreeing, the aggregate that sets the base and the classification that sets the correction, and a host change to either side would leave a residual the package cannot account for.

**Keep the session statistics and add a reading for out-of-band traffic.** This keeps every existing number and reports the excluded amount beside it. It leaves the readings a reader compares against the conversation's own cost distorted, and it asks the reader to subtract one reading from another to recover the conversation's usage.

**Make the corrected scope depend on an upstream change.** OMP could report the judgment calls' real cache fields, or expose a per-purpose split. Both are outside the package's control and neither is promised, so the readings would stay distorted for an unknown period.

## Consequences

The Host owns sanitization, composition, truncation, and the widget lifecycle, so providers stay small and cannot corrupt the row. Third-party extensions gain a stable, versioned contract for adding providers without touching the Host.

The package is coupled to OMP's public widget and context-usage APIs. It declares a maintenance lower bound and no maintenance upper bound, which states the maintenance commitment rather than a promise that every later release works, and the versions and scenarios actually verified stay in the component documentation beside that declaration. Every release runs its real TUI check on the host it targets before tagging, because the automated suite is headless and cannot see the terminal.

The builtin inventory now lives in the package usage documentation. The code and that documentation must change together, and a metric added to one without the other leaves the published inventory wrong.

The row no longer indicates that the context has probably entered OMP's speculation band. A user who relied on the blink learns of compaction only from OMP's own interface, and on a host before 18.4.0 the indicator that still worked there becomes the static glyph.

The answered-request count follows the branch a session holds, so a rewind lowers it, and a session binding can show a value one below what the session recorded immediately before. Both outcomes are intended.

The package ships no compatibility layer for the plain-text contract, the `tokens` ID, cost display, or arbitrary separators.

The token readings and the cache-hit rate describe the conversation rather than the session. OMP's own statusline and any cost report still include out-of-band traffic, so the row and those readings differ by design, and the usage documentation states the scope and the excluded records beside the formulas.

A host that stops reporting `task` usage on the tool result, or that records conversation usage in another shape, leaves the readings under-counting without any test noticing it, because the tests pin the shapes read today. Such a change reaches the package as readings that no longer match the conversation, through a user report or through the release TUI check on a real ledger.

Each sample walks the branch, so the work grows with the session's entry count on the sampling cadence. The walk reads only the fields it needs and runs at most once per tick for all five readings.
