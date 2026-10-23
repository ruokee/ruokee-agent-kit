# Migrate context capabilities

[中文](./migration.zh.md)

`@ruokee/omp-smart-context` replaces smart-cache, standalone context-pin, and QoL's compaction usage and model prompt modules. It reads only its own native settings. Migration requires explicit configuration changes; the extension does not edit them for you.

## Preserve effective settings

Inspect old user settings and each project's overrides before deleting anything.

### Remote settings

Copy `compactionCacheEnabled`, `compactionCacheMode`, and `handoffCacheEnabled` from smart-cache to the new package at the same scopes. Store `compactionCacheProvider` under the new name `compactionCacheProviderFilter`. Keep values and override relationships; missing keys keep the same defaults.

If the new package already has `compactionCacheProvider`, move its value and remove that key from both user and project settings. It is not an alias: leaving it rejects the whole new configuration. The filter does not select a model, route, or compaction method.

### QoL settings

1. Read old user values. The defaults are `enabled=true`, `compactionUsageEnabled=true`, and `modelPromptsEnabled=false`.
2. For each migrated module, calculate `enabled && moduleEnabled`. Write those two results to the new package. Do not copy QoL's master `enabled` key.
3. For each project, first merge its old QoL overrides over the old user values. Calculate the same results, then write necessary new project overrides. A project master-switch override can change both modules even without explicit module keys.
4. Remove `compactionUsageEnabled` and `modelPromptsEnabled` from both user and project QoL settings. Either leftover rejects the whole QoL `0.5.10` configuration. Keep all unrelated keys, including QoL's master switch.

For example, user QoL `enabled=false` makes both migrated modules off, even with `compactionUsageEnabled=true`. A project overriding `enabled=true` and `modelPromptsEnabled=true` needs both new module switches on.

### Pin settings

Existing standalone Pin users must explicitly set `pinEnabled=true` in each scope where it is wanted. The new default is `false`; installation alone exposes no Pin tool or command. Leave it off elsewhere.

Use OMP native plugin configuration commands for each scope. `omp plugin config list @ruokee/omp-smart-context` shows the new settings. There is no master switch.

## Replace registrations

1. Install this component from its directory with locked dependencies.
2. Remove old smart-cache and standalone Pin registrations, including manual extension paths loading either package.
3. Update QoL to the version without the migrated implementations. Keep unrelated plugins and settings.
4. Restart OMP after registration and setting changes.

A running process keeps its loaded code and settings. The new package refuses conflicting old smart-cache or QoL interfaces instead of inheriting them. Loading old and new implementations together is not a migration method.

Use `/smart-context` for context status and `/qol` for QoL's remaining capabilities. `/smart-cache` has no alias. Enabled Pin keeps `/ctx-pin` and `ctx_pin`.

## Keep existing data

Leave session journals and `model_usage` entries intact. Rule files stay in the active profile's user agent `model-prompts` directory and the project's `.omp/model-prompts`, with unchanged filenames, metadata, and bodies. No conversion or copying is needed.

Pin retains record type `omp-context-pin`, message types `omp-context-pin-change` and `omp-context-pin-result`, and record version `2`. These persisted names are not dependencies on the retired package. Supported entry ids, operation identities, revisions, and bodies replay unchanged. Do not rewrite journals to rename them.

Turning Pin off stops new retained-text messages without erasing records or history; re-enabling resumes replay. Turning usage off preserves historical entries. Turning model rules off stops reads, injection, and unused-file diagnostics. Rule-file edits apply next covered ordinary turn; switch changes require restart.
