# ADR proposal: Use a persistent widget for the OMP status bar

Decision owner: Ruokee
Draft writer: OMP GLM-5.3 Flash

English | [中文](./2026-09-05-use-omp-status-bar-widget.zh.md)

## Motivation

The [configurable OMP status bar proposal](./2026-09-04-add-omp-status-bar-project.md) chose the native `ctx.ui.setStatus()` extension-status channel with plain-text provider fragments, and appearance control through OMP's native statusline settings. The confirmed metric design no longer fits that channel. The built-in metrics carry fixed per-metric colors, the context metric adds a dimmed glyph that blinks while the context is inside the speculation band, and the composed line must truncate at the terminal width without cutting color sequences. The public `setStatus()` contract accepts only a string per key and provides no theme, no structured spans, and no `render(width)` lifecycle. Raw ANSI sequences and repeated `setStatus()` updates can approximate part of that, but they turn sanitizing, styling, and width handling into a fragile string protocol.

The confirmed product scope also changed. The generic `tokens` metric splits into independent per-metric providers, a cache-hit ratio joins them, the context metric gains a speculation-band estimate, and the separator becomes a closed four-value set. Cost display is excluded as an explicit product boundary. This exclusion covers amount-related features only; it does not mean that every metric overlapping a native OMP feature must be removed.

This proposal keeps the earlier proposal's still-valid architecture: one self-contained package, a Host and provider split, a versioned process-wide registry, agent-directory YAML configuration, OMP's native plugin enablement, and the lifecycle and failure-containment boundaries. It replaces only the earlier choices about the rendering channel, the plain-text fragment contract, the built-in metric set, and the separator rule. No current repository decision records the status bar architecture, so this proposal replaces a proposal, not a decision, and does not use `Reverses`. If the maintainer approves this proposal, the implementation change creates the new bilingual decision and removes both the earlier status bar proposal pair, whose implementation was not delivered to main, and this proposal pair.

## Proposal

### Keep one self-contained package with a Host and providers

Create `projects/omp-status-bar/` as one first-party, self-contained OMP Plugin Package. The [first-party capability kit decision](../decision/2026-08-20-establish-first-party-capability-kit.md) permits a real capability to use `projects/`, and the [self-contained component decision](../decision/2026-08-24-keep-components-self-contained.md) requires every distributable component to remain independent. The `package.json` declares the native extension entry through `omp.extensions`, and the package uses only public upstream OMP APIs without containing, patching, or requiring a local fork.

Split the implementation into a status Host and registered status providers. Publish provider registration as a supported package API through the `package.json#exports` entry `@ruokee/omp-status-bar/provider`. Registration uses a versioned process-wide registry keyed through `Symbol.for()`, so an extension that resolves its own copy of the package still registers into the same registry, and registration does not depend on extension load order. The registry rejects duplicate provider IDs and incompatible contract versions at registration time, and the Host validates both again before creating instances.

The public contract covers provider identity, option validation, instance creation and lifecycle, fragment publication, and managed scheduling. Registry storage, configuration loading, composition, diagnostics, and OMP UI calls stay private, and the exported types and functions are a semantic-versioning contract. Each configuration entry creates an independent instance, so the same provider ID may appear more than once with different options.

### Use native enablement and agent-directory configuration

OMP's native plugin enable and disable state is the sole package-wide switch, and the package defines no separate `enabled` field.

Store configuration in `omp-status-bar.yml` under the active OMP agent directory returned by the publicly re-exported `getAgentDir()`, which keeps configuration profile-aware without adding keys to OMP's core settings schema. Current upstream `PluginSettingSchema` accepts only `string`, `number`, `boolean`, and `enum` values and does not expose a runtime settings reader, so an ordered provider list with nested options cannot come from plugin settings.

The file starts with a schema version, and its ordered `statuses` array both selects providers and defines their display order. Each entry contains a non-empty provider `id` and optional provider-owned `options`; unknown fields invalidate the entry. Configuration is read once at session start, later file edits are not hot-reloaded, and a new configuration applies in the next session. A missing file displays nothing. A malformed top-level document starts no providers and records one bounded diagnostic. An entry with an unknown provider, an incompatible contract version, or invalid options is skipped while valid entries run. An empty `statuses` array is valid but mounts nothing. The Host performs these session behaviors only when the Extension context has UI support (`ctx.hasUI` is true): a headless session reads no configuration, starts no providers, and mounts no widget. The gate limits Host session behavior only; provider registration during extension activation does not depend on UI support.

The top-level `separator` accepts `space`, `slash`, `dot`, and `pipe`, with `slash` as the default. The Host renders separators in a dimmed theme color, and providers never emit separators.

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

The indication is explicitly approximate. The extension cannot observe whether OMP is actually compacting, whether a handoff is being generated, or whether a session hook blocked the speculation task, and OMP may raise its internal token estimate above what the public context-usage API reports. The indicator therefore means only that the context is probably inside the band; the UI and documentation must not claim that compaction is running or finished. Once inside the band the blink latches, even past the threshold, until the observed token count drops, the compaction settings or resolved method change, the model or its context window changes, or the session ends. After a drop the state machine requires the token count to fall back below the band start before the next cycle may indicate again, because a drop can also come from branch switches or history trimming rather than an actual compaction.

### Keep implementation evidence with the project

Follow the [English and Chinese public documentation decision](../decision/2026-08-20-maintain-bilingual-public-documentation.md) with package-local usage documents and reciprocal language links. Document installation, enablement, the configuration schema, the built-in provider IDs and options, per-entry failure behavior, the widget placement, the speculation estimate and its limits, and the verified OMP compatibility range. Provider authoring documentation defines the public import path, registration phase, contract versioning, collision behavior, lifecycle context, and how to install and select an independently packaged provider.

The direct `@oh-my-pi/*` imports declare peer dependencies with the range `>=18.1.8 <19`; the package targets OMP 18.x and records the verified versions. Behavioral tests cover configuration parsing and per-entry degradation, fragment sanitization and invalid-fragment containment, ordered composition, width truncation, the speculation state machine with a controllable clock, registration from a separately loaded fixture extension without shared module identity, and cleanup without residual timers or widgets. Rendering checks enumerate the target version's built-in Composer shapes and statusline presets and include an extension-registered shape, all through the same widget path. Real OMP TUI smoke checks confirm that the widget appears below the editor alongside the native statusline and leaves no residue after shutdown.

After approval, the implementation change creates a bilingual decision that records the delivered architecture and removes both the earlier status bar proposal pair and this proposal pair. It replaces the superseded choices in place, without compatibility layers for the plain-text contract, the `tokens` ID, cost display, or arbitrary separators.

## Alternatives considered

**Keep `setStatus()` with per-metric styled plain text.** The `setStatus()` channel accepts any string, so a provider could embed raw ANSI sequences. The Host could still parse and selectively allow them, but that turns styling into a complex, fragile escape-sequence protocol between Host and providers; width truncation would have to parse arbitrary provider output, and a blink would require each provider to swap strings on its own timer. With structured spans the Host stays the single point that sanitizes, styles, composes, and truncates.

**Publish each metric as plain text without the speculation glyph.** This keeps `setStatus()` viable, since the remaining content is one uncolored string. It sacrifices the blink indication, the fixed metric colors, and controlled truncation that the confirmed design requires.

**Render metrics inside the native statusline through the `setStatus()` channel or custom segments.** The native statusline is user-configured; `showHookStatus` and preset segments control placement and visibility, so the package could not guarantee a stable row, and segment registration would replace user-visible native components. A persistent widget row makes the capability independent of the user's statusline configuration.

**Use one provider with display toggles instead of independent metric providers.** A single `tokens` provider with per-metric switches would duplicate the selection and ordering that `statuses` already provides, and the two mechanisms could disagree about which metrics show and in what order. Independent providers let one structure both select and order.

## Acceptance criteria

1. `projects/omp-status-bar/` is a self-contained OMP Plugin Package with an `omp.extensions` entry and no dependency on a local OMP checkout or fork.
2. OMP's native plugin enable and disable state is the only package-wide switch. The package reads a versioned `omp-status-bar.yml` from the active OMP agent directory, once per session, without hot reload.
3. The ordered `statuses` array selects registered providers and defines order. Each entry creates an independent instance. A malformed top-level document starts no providers; unavailable or invalid entries are diagnosed and skipped without disabling valid entries; an empty array mounts nothing. The top-level `separator` accepts only `space`, `slash`, `dot`, and `pipe`, defaulting to `slash`.
4. The Host mounts one `belowEditor` widget under a stable key once per session, renders one composed line in `statuses` order, truncates from the right with ANSI awareness, and never reorders, drops, or relabels entries on narrow terminals. Provider updates never re-mount the widget, and shutdown unmounts it without residue.
5. The publication contract is the structured `ProviderFragment` with sanitized spans. The Host strips escapes and control characters, accepts only `#RRGGBB` colors, deep-copies published fragments, withdraws empty content, contains invalid fragments per instance, and keeps separator output out of provider scope.
6. The public registration entry point rejects duplicate IDs and incompatible contract versions at registration and again before instance creation, works regardless of extension load order or duplicate package module instances, and keeps registry storage, configuration, composition, and UI internals private.
7. The built-in IDs are exactly `total`, `input`, `cache`, `output`, `cache-hit`, and `context`. Token metrics follow the confirmed scope, the cache-hit ratio hides at a zero denominator, `label` accepts `compact` and `word` per instance with `compact` as default, `context` accepts `percent` and `absolute`, and colors are fixed, not configurable.
8. The speculation indicator reads only public data and OMP's exported resolution functions, exposes `hidden`, `normal`, and `indicating` states, latches while inside the band, exits on token drop, condition loss, model change, or session end, requires a reset below the band start before re-indicating, and never claims that compaction is running or finished.
9. The package declares peer dependencies on the directly imported `@oh-my-pi/*` packages for the OMP 18.x range, records the verified versions, and works with every built-in Composer shape of the target version through the same belowEditor mount point, independent of `statusLine.showHookStatus` and custom preset `status` segments.
10. Behavioral tests cover configuration, partial failure, sanitization, ordered composition, truncation, the speculation state machine under a controllable clock, public registration from a separately loaded fixture, headless sessions, cleanup, and shutdown races. Rendering checks enumerate the target version's built-in Composer shapes and statusline presets plus an extension-registered shape through the widget path. Real OMP TUI smoke checks record representative output and confirm no residual state.
11. Package-local English and Chinese documentation remains semantically aligned, links to each other, and explains usage, widget placement, the speculation estimate and its limits, and third-party provider authoring.
12. The implementation creates the corresponding bilingual decision and removes both the earlier status bar proposal pair and this proposal pair, replacing superseded choices in place without compatibility layers.

## Risks

OMP owns the widget API and the belowEditor placement. If a future OMP version changes or removes them, the widget disappears or misrenders until the package adapts, and a release that silently targets an incompatible version would fail at rendering time rather than at install time. Each release verifies the recorded OMP range with real TUI checks, and the peer dependency range keeps unsupported versions from installing cleanly.

The speculation estimate reads public data through exported resolution functions. If OMP changes those functions' signatures or their placement among the public exports, the package fails to load or builds its band from wrong inputs, showing the indicator at wrong times. The package pins the import paths to the verified OMP range and re-verifies them in each release's TUI checks.

The structured publication contract is a public compatibility obligation. A structurally valid fragment whose text contains escape sequences or control characters would corrupt the widget row if it reached the terminal; the Host's sanitizer strips such content before rendering, and a sanitizer gap would let it through and garble the output. The sanitizer is a reliability boundary, not a sandbox: third-party extensions are executable code in the OMP process and can bypass the contract by writing to the terminal directly. The sanitizer runs on every published span, and its rules are part of the tested contract.

The glyph depends on the terminal font. On a terminal whose font lacks the Nerd Font codepoint, the indicator shows nothing useful or a placeholder box; the package accepts that as out of scope rather than shipping a fallback character, and documents it.
