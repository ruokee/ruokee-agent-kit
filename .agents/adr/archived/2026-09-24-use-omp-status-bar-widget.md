# ADR decision: Use a persistent widget for the OMP status bar

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash
Reverses: [Use a persistent widget for the OMP status bar](../archived/2026-09-05-use-omp-status-bar-widget.md)
Archived: 2026-09-28
Reversed by: [Maintain the OMP status bar across OMP host upgrades](../decision/2026-09-28-maintain-omp-status-bar.md)

English | [中文](./2026-09-24-use-omp-status-bar-widget.zh.md)

## Motivation

The `@ruokee/omp-status-bar` package must show how many model requests the session has answered, a reading it does not have yet and that a user reads against the token totals to judge the token efficiency of a session and to notice a call that consumed far more than the rest. The predecessor decision fixed the builtin provider IDs at exactly six, so the reading cannot be recorded as an update to it, and this decision records the whole row: one persistent line the package owns, every metric in its own fixed color, the composed line truncated at the terminal width without cutting a color sequence, and the dimmed context glyph that blinks while the context is inside the speculation band. The plain-text extension-status channel cannot carry that.

## Analysis

The [predecessor decision](../archived/2026-09-05-use-omp-status-bar-widget.md) admits no builtin ID beyond its fixed list, and the enumeration itself was not the protected boundary. The same section excludes amount, cost, and premium-request readings and the legacy `tokens` alias, and the package usage documentation already maintains the builtin IDs with their options and their colors. Stating the provider scope and linking that documentation as the owner of the inventory therefore keeps the boundary.

A reading derived from session activity can ship only as a builtin provider. The public provider contract gives an instance its options, its configuration, a publication call, and managed timers; it carries no session data and no events, and the Host binds session sources for builtin providers only. Adding such a channel to the public contract is a larger change than adding the reading, and the Host already reports each turn to the extension together with how the response ended.

## Decision

### Keep one self-contained package with a Host and providers

`projects/omp-status-bar/` is one first-party, self-contained OMP Plugin Package. The [first-party capability kit decision](../decision/2026-08-20-establish-first-party-capability-kit.md) permits a real capability to use `projects/`, and the [self-contained component decision](../decision/2026-08-24-keep-components-self-contained.md) requires every distributable component to remain independent. The `package.json` declares the native extension entry through `omp.extensions`, and the package uses only public upstream OMP APIs without containing, patching, or requiring a local fork.

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

The token metrics and the cache-hit ratio share one data scope derived from the session usage statistics: `I` is input plus cache write, `C` is cache read, `O` is output, `T` is `I + C + O`, and the ratio is `C / (I + C)`. They read no orchestration fields and no amounts. Token counts use one shared decimal formatter with `K`, `M`, `G`, and `T` units, and a metric publishes nothing while its own data is absent instead of rendering a zero.

The `context` provider reads the public context-usage API in a `percent` (default) or `absolute` mode. `absolute` renders only the current token count with the shared formatter; the context window stays an internal input for validation and for the speculation-band calculation. The provider joins the context text and the speculation glyph into one fragment with a plain space, bypassing the configured separator.

### Count the model requests a session answers

The package ships one builtin provider, `turn`, that counts the model requests the current session answered successfully and publishes the count as a reading of its own. It derives no further metric from it, and its label, options, and display forms live in the usage documentation.

The value is session-cumulative: it grows across prompts and across agent runs without restarting, and it keeps its value when the session is resumed or switched. It always reports the branch the session holds, so a tree rewind or a new branch re-seeds the count from the branch then in front.

Only a successful response advances the value. A failed request, an interrupted response, and a request stopped before the model call leave it unchanged.

The provider follows the session's turn lifecycle instead of the snapshot-backed metrics: it schedules no timer and leaves the sampling cadence to them.

### Estimate the speculation band from public data

The context provider pairs its text with a glyph indicating that the context has probably entered OMP's speculation band. The glyph uses the same Nerd Font codepoint as OMP's own compaction icon; terminals whose fonts lack the glyph see no fallback. The estimate reads only public data, meaning context usage, the active model, and the compaction settings group, and it reuses OMP's publicly exported threshold, lead-token, and method-resolution functions instead of copying their logic.

The indicator shows three states. `hidden`: automatic or asynchronous compaction is off, no speculation-capable method resolves, or the threshold data is unusable. `normal`: the glyph is solid in a dimmed style. `indicating`: the glyph blinks between emphasis and dim on a `600 ms` cadence.

The indication is explicitly approximate. The extension cannot observe whether OMP is actually compacting, whether a handoff is being generated, or whether a session hook blocked the speculation task, and OMP may raise its internal token estimate above what the public context-usage API reports. The indicator therefore means only that the context is probably inside the band, and neither the UI nor the documentation may claim that compaction is running or finished. Once inside the band the blink latches, even past the threshold, until the observed token count drops, the compaction settings or the resolved method change, the model or its context window changes, or the session ends. After a drop the state machine requires the token count to fall back below the band start before it may indicate again.

### Keep implementation evidence with the project

The [English and Chinese public documentation decision](../decision/2026-09-07-colocate-bilingual-docs.md) applies with package-local usage documents and reciprocal language links. Package documentation covers installation, enablement, the configuration schema, the builtin provider IDs and their options, per-entry failure behavior, the widget placement, the speculation estimate and its limits, the meaning and the display of the answered-request count, and the verified OMP compatibility range. Provider authoring documentation defines the public import path, registration phase, contract versioning, collision behavior, lifecycle context, and how to install and select an independently packaged provider.

The direct `@oh-my-pi/*` imports declare peer dependencies with the range `>=18.1.8 <19`; the package targets OMP 18.x and records the verified versions. Behavioral tests cover configuration parsing and per-entry degradation, fragment sanitization and invalid-fragment isolation, ordered composition and width truncation, the speculation state machine's timing, the answered-request counting rule with its display states and its session behavior, registration from a separately loaded extension without shared module identity, cleanup without residual timers or widgets, and the target version's built-in Composer shapes and statusline presets with an extension-registered shape, all through the same widget path. The automated suite is headless and cannot see the terminal: a real OMP TUI session that confirms the widget appears below the editor alongside the native statusline is a release requirement, run and reviewed per release commit before tagging, not inside the unit suite.

## Alternatives considered

**Keep `setStatus()` with per-metric styled plain text.** The `setStatus()` channel accepts any string, so a provider could embed raw ANSI sequences. The Host could still parse and selectively allow them, but that turns styling into a complex, fragile escape-sequence protocol between Host and providers; width truncation would have to parse arbitrary provider output, and a blink would require each provider to swap strings on its own timer. With structured spans the Host stays the single point that sanitizes, styles, composes, and truncates.

**Publish each metric as plain text without the speculation glyph.** This keeps `setStatus()` viable, since the remaining content is one uncolored string. It sacrifices the blink indication, the fixed metric colors, and controlled truncation.

**Render metrics inside the native statusline through the `setStatus()` channel or custom segments.** The native statusline is user-configured; `showHookStatus` and preset segments control placement and visibility, so the package could not guarantee a stable row, and segment registration would replace user-visible native components. A persistent widget row makes the capability independent of the user's statusline configuration.

**Use one provider with display toggles instead of independent metric providers.** A single provider with per-metric switches would duplicate the selection and ordering that `statuses` already provides, and the two mechanisms could disagree about which metrics show and in what order. Independent providers let one structure both select and order.

## Consequences

The Host owns sanitization, composition, truncation, and the widget lifecycle, so providers stay small and cannot corrupt the row. Third-party extensions gain a stable, versioned contract for adding providers without touching the Host.

The package is coupled to OMP's public widget, context-usage, and compaction-resolution APIs for the 18.x range. Every release verifies that range with real TUI checks before tagging, because the automated suite is headless and cannot see the terminal.

The builtin inventory now lives in the package usage documentation. The code and that documentation must change together, and a metric added to one without the other leaves the published inventory wrong.

The speculation indicator is an estimate, not an observation; users see an approximation whose limits the documentation states explicitly.

The answered-request count follows the branch a session holds, so a rewind lowers it, and a session binding can show a value one below what the session recorded immediately before. Both outcomes are intended.

The package ships no compatibility layer for the plain-text contract, the `tokens` ID, cost display, or arbitrary separators.
