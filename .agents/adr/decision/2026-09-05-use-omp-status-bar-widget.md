# ADR decision: Use a persistent widget for the OMP status bar

Decision owner: Ruokee
Draft writer: OMP GLM-5.3 Flash

English | [中文](./2026-09-05-use-omp-status-bar-widget.zh.md)

## Motivation

The earlier `2026-09-04-add-omp-status-bar-project` proposal chose the native `ctx.ui.setStatus()` extension-status channel with plain-text provider fragments, and appearance control through OMP's native statusline settings. The confirmed metric design no longer fits that channel. The built-in metrics carry fixed per-metric colors, the context metric adds a dimmed glyph that blinks while the context is inside the speculation band, and the composed line must truncate at the terminal width without cutting color sequences. The public `setStatus()` contract accepts only a string per key and provides no theme, no structured spans, and no `render(width)` lifecycle. Raw ANSI sequences plus repeated `setStatus()` updates could approximate part of this, but they would turn styling into an escape-sequence protocol between the Host and providers, and width truncation would have to parse arbitrary provider output.

The confirmed product scope also changed. The generic `tokens` metric splits into independent per-metric providers, a cache-hit ratio joins them, the context metric gains a speculation-band estimate, and the separator becomes a closed four-value set. Cost display is excluded as an explicit product boundary. This exclusion covers amount-related features only; it does not mean that every metric overlapping a native OMP feature must be removed.

The earlier proposal's still-valid architecture carries over: one self-contained package, a Host and provider split, a versioned process-wide registry, agent-directory YAML configuration, OMP's native plugin enablement, and the lifecycle and failure-containment boundaries. Only the earlier choices about the rendering channel, the plain-text fragment contract, the built-in metric set, and the separator rule change. No current repository decision records the status bar architecture, so this decision replaces a proposal, not a decision, and does not use `Reverses`.

## Decision

### Keep one self-contained package with a Host and providers

`projects/omp-status-bar/` is one first-party, self-contained OMP Plugin Package. The [first-party capability kit decision](./2026-08-20-establish-first-party-capability-kit.md) permits a real capability to use `projects/`, and the [self-contained component decision](./2026-08-24-keep-components-self-contained.md) requires every distributable component to remain independent. The `package.json` declares the native extension entry through `omp.extensions`, and the package uses only public upstream OMP APIs without containing, patching, or requiring a local fork.

The implementation splits into a status Host and registered status providers. Provider registration is a supported package API through the `package.json#exports` entry `@ruokee/omp-status-bar/provider`. Registration uses a versioned process-wide registry keyed through `Symbol.for()`, so an extension that resolves its own copy of the package still registers into the same registry, and registration does not depend on extension load order. The registry rejects duplicate provider IDs and incompatible contract versions at registration time. Before creating each instance, the Host resolves the configured ID from the registry and validates its contract version again.

The public contract covers provider identity, option validation, instance creation and lifecycle, fragment publication, and managed scheduling. Registry storage, configuration loading, composition, diagnostics, and OMP UI calls stay private. Each configuration entry creates an independent instance, so the same provider ID may appear more than once with different options.

### Use native enablement and agent-directory configuration

OMP's native plugin enable and disable state is the sole package-wide switch, and the package defines no separate `enabled` field.

Configuration lives in `omp-status-bar.yml` under the active OMP agent directory returned by the publicly re-exported `getAgentDir()`, which keeps configuration profile-aware without adding keys to OMP's core settings schema. Current upstream `PluginSettingSchema` accepts only `string`, `number`, `boolean`, and `enum` values, so an ordered provider list with nested options cannot come from plugin settings.

The file starts with a schema version, and its ordered `statuses` array both selects providers and defines their display order. Each entry contains a non-empty provider `id` and optional provider-owned `options`; unknown fields invalidate the entry. Configuration is read once at session start, later file edits are not hot-reloaded, and a new configuration applies in the next session. A missing file displays nothing. A malformed top-level document starts no providers and records one bounded diagnostic. An entry with an unknown provider, an incompatible contract version, or invalid options is skipped while valid entries run. An empty `statuses` array is valid but mounts nothing. The Host performs these session behaviors only when the Extension context has UI support, and stays idle headless.

The top-level `separator` accepts `space`, `slash`, `dot`, and `pipe`, with `slash` as the default. The Host renders separators in a dimmed style, and providers never emit separators.

### Mount one persistent belowEditor widget

After configuration loads and at least one provider starts, the Host mounts one component factory under one stable package-qualified key through `ctx.ui.setWidget(key, factory, { placement: "belowEditor" })`. This happens once per session. Provider updates only replace the fragments the Host stores and request a component render; they never call `setWidget()` again. On shutdown the Host stops providers, clears timers, and unmounts through `setWidget(key, undefined)`.

The widget renders one line, composed strictly in `statuses` order. Empty fragments contribute nothing and produce no separators. When nothing is visible, the widget renders zero rows but stays mounted so later data can reappear.

The Host colors the composed line first, then truncates it from the right to the terminal width with a single trailing ellipsis using ANSI-aware width measuring, so leading entries survive. A narrow terminal never reorders entries, drops entries, or downgrades `word` labels to `compact`.

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

The Host sanitizes every span: it strips ANSI and VT escape sequences, replaces control characters with spaces, collapses runs of spaces, accepts only `#RRGGBB` colors, drops empty spans, trims the fragment edges, and deep-copies the result so later edits by the provider cannot change the UI. An empty fragment, or one that sanitizes to nothing, withdraws that instance's content. A structurally invalid fragment clears that instance's previous content and records a bounded diagnostic while other providers keep running.

Providers never call OMP UI methods, never obtain the widget or theme, and never emit separators.

### Ship the built-in metric providers

The built-in IDs are exactly `total`, `input`, `cache`, `output`, `cache-hit`, and `context`. The earlier `tokens` ID disappears without an alias. There is no `cost` provider: amounts are excluded from the package scope by product decision, and the package reads, formats, and configures no cost, subscription, or premium-request amounts.

Each of `total`, `input`, `cache`, `output`, and `cache-hit` accepts `options.label` with the values `compact` and `word`, `compact` being the default. `compact` shows the letters `T`, `I`, `C`, `O`, and `H`; `word` shows `Total`, `Input`, `Cache`, `Output`, and `Hit`. The label applies per instance, so configurations may mix both forms, and a narrow terminal never changes a chosen form. Every metric carries its fixed color, following the pi-moon palette; colors are not configurable.

The token metrics share one data scope derived from the session usage statistics: `I` is input plus cache write, `C` is cache read, `O` is output, and `T` is `I + C + O`. The metrics read no orchestration fields and no amounts. Token counts use one shared decimal formatter with `K`, `M`, `G`, and `T` units. When the session has not yet consumed tokens, the token metrics publish nothing instead of a row of zeros. The cache-hit ratio is `C / (I + C)`, displayed as a rounded percentage and hidden while its denominator is zero.

The `context` provider accepts `options.mode` with the values `percent` (default) and `absolute`, reading the public context-usage API. It joins the context text and the speculation-band glyph into one fragment with a plain space, bypassing the configured separator.

### Estimate the speculation band from public data

The context provider pairs its text with a glyph indicating that the context has probably entered OMP's speculation band. The glyph uses the same Nerd Font codepoint as OMP's own compaction icon; terminals whose fonts lack the glyph see no fallback. The estimate reads only public data: context usage, the active model, and the compaction settings group, and reuses OMP's publicly exported threshold, lead-token, and method-resolution functions instead of copying their logic.

The indicator shows three states. `hidden`: automatic or asynchronous compaction is off, no speculation-capable method resolves, or the threshold data is unusable. `normal`: the glyph is solid in a dimmed style. `indicating`: the glyph blinks between emphasis and dim on a 600 ms cadence.

The indication is explicitly approximate. The extension cannot observe whether OMP is actually compacting, whether a handoff is being generated, or whether a session hook blocked the speculation task, and OMP may raise its internal token estimate above what the public context-usage API reports. The indicator therefore means only that the context is probably inside the band; the UI and documentation must not claim that compaction is running or finished. Once inside the band the blink latches, even past the threshold, until the observed token count drops, the compaction settings or resolved method change, the model or its context window changes, or the session ends. After a drop the state machine requires the token count to fall back below the band start before it may indicate again.

### Keep implementation evidence with the project

The [English and Chinese public documentation decision](./2026-08-20-maintain-bilingual-public-documentation.md) applies with package-local usage documents and reciprocal language links. Package documentation covers installation, enablement, the configuration schema, the built-in provider IDs and options, per-entry failure behavior, the widget placement, the speculation estimate and its limits, and the verified OMP compatibility range. Provider authoring documentation defines the public import path, registration phase, contract versioning, collision behavior, lifecycle context, and how to install and select an independently packaged provider.

The direct `@oh-my-pi/*` imports declare peer dependencies with the range `>=18.1.8 <19`; the package targets OMP 18.x and records the verified versions. Behavioral tests cover configuration parsing and per-entry degradation, fragment sanitization and invalid-fragment containment, ordered composition, width truncation, the speculation state machine with a controllable clock, registration from a separately loaded fixture extension without shared module identity, and cleanup without residual timers or widgets. Rendering checks enumerate the target version's built-in Composer shapes and statusline presets and include an extension-registered shape, all through the same widget path. The automated suite is headless and cannot see the terminal: a real OMP TUI session that confirms the widget appears below the editor alongside the native statusline is a release requirement, run and reviewed per release commit before tagging, not inside the unit suite.

## Alternatives considered

**Keep `setStatus()` with per-metric styled plain text.** The `setStatus()` channel accepts any string, so a provider could embed raw ANSI sequences. The Host could still parse and selectively allow them, but that turns styling into a complex, fragile escape-sequence protocol between Host and providers; width truncation would have to parse arbitrary provider output, and a blink would require each provider to swap strings on its own timer. With structured spans the Host stays the single point that sanitizes, styles, composes, and truncates.

**Publish each metric as plain text without the speculation glyph.** This keeps `setStatus()` viable, since the remaining content is one uncolored string. It sacrifices the blink indication, the fixed metric colors, and controlled truncation that the confirmed design requires.

**Render metrics inside the native statusline through the `setStatus()` channel or custom segments.** The native statusline is user-configured; `showHookStatus` and preset segments control placement and visibility, so the package could not guarantee a stable row, and segment registration would replace user-visible native components. A persistent widget row makes the capability independent of the user's statusline configuration.

**Use one provider with display toggles instead of independent metric providers.** A single `tokens` provider with per-metric switches would duplicate the selection and ordering that `statuses` already provides, and the two mechanisms could disagree about which metrics show and in what order. Independent providers let one structure both select and order.

## Consequences

The Host owns sanitization, composition, truncation, and the widget lifecycle, so providers stay small and cannot corrupt the row. Third-party extensions gain a stable, versioned contract for adding providers without touching the Host.

The package is coupled to OMP's public widget, context-usage, and compaction-resolution APIs for the 18.x range. Every release verifies that range with real TUI checks before tagging.

The speculation indicator is an estimate, not an observation; users see an approximation whose limits the documentation states explicitly.

The implementation removes both the earlier status bar proposal pair and this decision's source proposal pair, replacing the superseded choices in place, without compatibility layers for the plain-text contract, the `tokens` ID, cost display, or arbitrary separators.

## Changes

### 2026-09-05

The `context` provider's `absolute` mode renders only the current token count with the shared formatter. The context window remains an internal input for validation and speculation-band calculation, but the widget does not display it.
