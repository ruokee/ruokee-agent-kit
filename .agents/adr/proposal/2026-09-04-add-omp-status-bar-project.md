# ADR proposal: Add a configurable OMP status bar project

Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol

English | [中文](./2026-09-04-add-omp-status-bar-project.zh.md)

## Motivation

Ruokee currently maintains an OMP fork for personal Harness changes. This capability no longer needs a core patch: upstream OMP extensions can publish keyed status text with `ctx.ui.setStatus()`, OMP renders that channel through the active Composer and statusline configuration, and an OMP Plugin Package can load and enable or disable the extension.

The status line needs more than one optional source. Users must be able to select statuses, order them, and configure each one. Keeping acquisition, configuration, lifecycle, composition, and OMP UI writes in one extension function would turn every new status into another branch in the same module.

The [first-party capability kit decision](../decision/2026-08-20-establish-first-party-capability-kit.md) permits a real capability to use `projects/`. The [self-contained component decision](../decision/2026-08-24-keep-components-self-contained.md) requires every distributable component to remain independent.

Current upstream `PluginSettingSchema` accepts only `string`, `number`, `boolean`, and `enum` values, and the public Extension API does not expose the runtime Plugin settings reader. That mechanism therefore cannot supply an ordered provider list with nested provider-specific options to the package.

## Proposal

### Keep one self-contained project and package

Create `projects/omp-status-bar/` as one first-party, self-contained OMP Plugin Package. Its `package.json` declares the native extension entry through `omp.extensions`. The package uses only public upstream OMP APIs and does not contain, patch, or require Ruokee's OMP fork.

Split the implementation into a status Host and registered status providers. Keep the Host and bundled first-party providers inside the package rather than publishing them as separate repository components. Publish provider registration as a supported package API so independently installed OMP extensions can register providers for custom statuses after the Host package is installed.

Expose a dedicated provider entry point through `package.json#exports`. A third-party extension imports that entry point and registers a provider during extension activation. Registration must be independent of extension load order before `session_start` and must work even when the provider resolves its own installed copy of the Host package. Do not rely on ordinary module singleton identity; use a versioned process-wide registry or an equivalent loader-stable mechanism.

The public contract registers a provider definition and instance factory. It covers provider identity, option validation, instance creation and lifecycle, fragment publication, and managed scheduling. The Host may create one instance for each configuration entry, including multiple entries that use the same provider ID with different options. Registry storage, configuration loading, composition, diagnostics, and OMP UI calls remain private. Treat the exported types and functions as a semantic-versioning contract. The Host rejects conflicting provider registrations and incompatible contract versions before creating instances.

Each provider instance owns one status source and its formatting. It validates its options, publishes a plain-text fragment through the Host context, and releases resources when stopped. Providers do not call `ctx.ui.setStatus()` or other OMP UI methods.

Ship the Host with at least one first-party provider that reads a real data source.

### Use native package enablement and package-owned configuration

OMP's native Plugin enable and disable state is the sole package-wide switch. The package defines no separate `enabled` field.

Store status configuration in `omp-status-bar.yml` under the active OMP agent directory returned by `getAgentDir()`, which `@oh-my-pi/pi-coding-agent` publicly re-exports. This keeps configuration profile-aware without adding keys to OMP's core settings schema.

The file starts with a schema version. Its `statuses` field is an ordered array, so one structure selects providers and defines their display order. Each entry contains a provider `id` and optional provider-owned `options`. Each entry creates an independent provider instance, so the same registered provider may appear more than once. A Host-level separator controls composition.

Keep the configuration declarative. The initial schema contains only the version, separator, ordered provider entries, and provider-owned options. The Host reads and validates the file during activation; the implementation documentation states when later file changes take effect without making a particular reload mechanism part of the architecture contract. A malformed top-level document prevents the Host from starting providers. An unavailable provider, incompatible contract version, or invalid options disables only that entry, while valid entries continue to run. Diagnostics are deduplicated and limited without hiding independent errors.

### Centralize rendering and lifecycle

Use one stable, package-qualified `setStatus()` key. The Host keeps the latest fragment for each configured entry, which corresponds to one provider instance, removes empty fragments, joins the remaining values in configured order, and writes the composed line only when its value changes. It clears the key when the line becomes empty and during session shutdown.

Run terminal UI behavior only when the Extension context has UI support. The Host owns session lifecycle handlers and backs the public provider scheduling context with OMP-managed timers through `ctx.setInterval()`, `ctx.setTimeout()`, and `ctx.clearTimer()`. Provider failures are contained and reported without leaving overlapping refreshes, unhandled rejections, raw timers, or resources that outlive the session.

### Work with every OMP appearance

The native extension-status channel does not depend on a specific `composer.shape` or `statusLine.preset`. Every built-in or extension-registered Composer shape and every statusline preset supported by the target OMP version is within scope. The Host uses the same rendering path for every appearance and leaves OMP appearance settings unchanged.

OMP owns the final placement and styling of its native extension-status channel. `statusLine.showHookStatus` and the custom preset's `status` segment control its visibility and placement. The package uses this channel without registering or replacing built-in statusline segments. Documentation records the native controls and observed placement.

### Keep implementation evidence with the project

Follow the [English and Chinese public documentation decision](../decision/2026-08-20-maintain-bilingual-public-documentation.md) with package-local usage documents and reciprocal language links. Document Host installation, enable and disable commands, the configuration schema, bundled provider IDs and options, per-entry failure behavior, native appearance controls, and the verified rendering matrix. Provider authoring documentation defines the public import path, registration phase, contract versioning, collision behavior, lifecycle context, and how to install and select an independently packaged provider.

Test top-level configuration failure, per-entry degradation, registry uniqueness, repeated provider instances, ordered composition, unchanged-output suppression, provider cleanup, and contained provider failures. A separately loaded fixture extension must register a provider through the public package entry point and render it when selected, without depending on extension load order or shared module identity. Automated rendering checks cover the cross-product of every built-in Composer shape and statusline preset in the target OMP version, plus an extension-registered shape and a custom preset. Actual OMP TUI smoke checks use structurally different appearance combinations and verify that the status remains available and clears on shutdown or disablement.

The implementation change creates a bilingual decision that records the delivered architecture, then removes this proposal. No current decision needs to be reversed.

## Alternatives considered

**Continue maintaining the OMP fork and register custom statusline segments.** This gives direct control over Composer internals and segment placement, but keeps Ruokee responsible for carrying a core patch across upstream changes. The public `setStatus()` contract already supports the required plain-text line, so the fork only adds maintenance.

**Put every status directly in one extension module.** This is smaller for one status. Selection, order, provider-specific options, refresh work, cleanup, and third-party registration already vary independently. A narrow Host and provider boundary keeps those differences out of Host internals.

**Publish each bundled first-party provider as a separate repository component.** This would allow independent installation, but each provider would depend on a compatible Host version. That dependency violates the repository rule that every distributable component is self-contained and adds separate release work. Bundling first-party providers does not affect third-party providers, which use the public registration API.

**Render the composed line as a below-editor widget.** Widgets avoid statusline preset controls, but they create a separate UI row whose placement no longer follows OMP's native status channel. `setStatus()` already carries extension status across Composer shapes and presets while preserving the user's appearance controls, so a widget is not required for this capability.

## Acceptance criteria

1. `projects/omp-status-bar/` is a self-contained OMP Plugin Package with an `omp.extensions` entry and no dependency on a local OMP checkout or fork.
2. OMP's native Plugin enable and disable state is the only package-wide switch. The project reads a versioned `omp-status-bar.yml` from the active OMP agent directory.
3. An ordered `statuses` array selects registered providers and their order. Each entry creates an independent instance, so one provider ID may appear more than once with different options. A malformed top-level document prevents the Host from starting providers, while unavailable or invalid entries are diagnosed and skipped without disabling valid entries.
4. `package.json#exports` exposes a documented provider registration entry point. An independently installed OMP extension can register a provider during extension activation, regardless of extension load order or duplicate package module instances.
5. The public contract covers provider identity, option validation, instance creation and lifecycle, fragment publication, and managed scheduling without exposing Host configuration, registry storage, composition, or UI internals.
6. One Host-owned registry and the provider contract keep configuration, lifecycle, data acquisition, formatting, and rendering separate. The Host rejects conflicting registrations, and provider definitions with incompatible contract versions cannot create instances. At least one useful first-party provider ships with the Host.
7. Only the Host writes one package-qualified `setStatus()` key. It suppresses unchanged writes and clears empty or shutdown state. Periodic and deferred work uses OMP-managed timers, and provider failures cannot terminate the OMP session or leave stale resources.
8. The status capability works with every built-in and extension-registered Composer shape and every statusline preset supported by the target OMP version. It respects OMP's native visibility and placement controls without requiring or changing a specific appearance configuration.
9. Behavioral tests cover configuration, partial failure, repeated instances, public registration from a separately loaded provider fixture, ordering, rendering, cleanup, version and ID conflicts, and failure containment. Rendering checks enumerate the cross-product of the target OMP version's built-in shapes and presets and include an extension-registered shape and custom preset. Actual OMP TUI smoke checks record representative rendered output.
10. Package-local English and Chinese documentation remains semantically aligned, links to each other, and explains Host usage, appearance behavior, and third-party provider authoring.
11. The implementation creates the corresponding bilingual decision, removes this proposal, and does not reverse an existing decision.

## Risks

The public provider registration API creates a compatibility obligation. Keep it limited to provider identity, option validation, instance creation and lifecycle, fragment publication, and managed scheduling. Version the contract, limit diagnostic output for incompatible providers, and keep registry mutation, configuration parsing, composition, and OMP UI details private.

OMP extensions run in the OMP process. An unhandled provider exception, raw timer, or overlapping refresh could terminate or degrade the entire Agent session. The Host must use managed timers, serialize provider refresh work where needed, contain errors, and release resources on shutdown.

OMP may change how its native extension-status channel is placed or styled. The package does not copy OMP layout logic or branch on appearance IDs. Each release verifies the target OMP version's built-in shapes and presets, includes an extension-defined shape in automated checks, documents native visibility controls, and records the tested OMP compatibility range.
