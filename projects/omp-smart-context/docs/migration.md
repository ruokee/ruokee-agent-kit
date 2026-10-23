# Migrate context capabilities

[中文](./migration.zh.md)

`@ruokee/omp-smart-context` replaces `@ruokee/omp-smart-cache` and the compaction usage and model prompt modules of `@ruokee/omp-qol`. It reads only its own native plugin settings. Migration is an explicit configuration change, not a runtime compatibility path.

## Preserve effective settings

Before removing old settings, inspect both user configuration and each project's overrides.

1. Copy the smart-cache keys `compactionCacheEnabled`, `compactionCacheProvider`, `compactionCacheMode`, and `handoffCacheEnabled` into the new package's settings at their existing scopes. Preserve exact Provider names and modes. Missing keys retain the same defaults.
2. For user-level QoL settings, compute each migrated module's effective value as `enabled && moduleEnabled`. An absent QoL `enabled` is `true`; absent `compactionUsageEnabled` is `true`; absent `modelPromptsEnabled` is `false`. Write the two effective results under the new package. Do not copy QoL's master `enabled` key.
3. For each project, merge its old QoL overrides over the old user settings first. Compute the same two effective results and write any necessary new project overrides. A project override of the old master switch can change both results even when it contains neither module key. Preserve the resulting behavior, not merely the spelling of explicit keys.
4. Delete `compactionUsageEnabled` and `modelPromptsEnabled` from **both user and project QoL settings**. Either leftover key is unknown to QoL `0.5.10` and rejects its entire configuration. Keep all other QoL settings, including its master switch.

For example, user QoL settings with `enabled=false` make both migrated modules off, even when `compactionUsageEnabled=true`. A project overriding `enabled=true` and `modelPromptsEnabled=true` needs both new module switches on in that project's configuration.

Use OMP's native plugin configuration commands for the appropriate scope. `omp plugin config list @ruokee/omp-smart-context` displays the new component's settings. The new component has no master switch.

## Replace registrations

Install this component from its own directory with its locked dependencies. Remove the old smart-cache registration and any manual extension path that loads it. Update QoL to the version without the migrated implementations. Keep unrelated plugins and settings.

Restart OMP after changing registrations or settings. A running process retains its loaded code, activation snapshots, and process-wide wrappers. The new package refuses an old smart-cache alignment owner or an old QoL usage owner rather than taking over its state. Loading both old and new owners in one process is not a migration method.

Use `/smart-context` for context status and `/qol` for QoL's remaining capabilities. `/smart-cache` is not retained as an alias.

## Keep existing data

Leave session journals and `model_usage` entries intact. Rule files stay in the active profile's user agent `model-prompts` directory and the project's `.omp/model-prompts` directory, with the same names, frontmatter, and bodies. No conversion or copying of those files is required.

Disabling usage accounting stops future compensation; it does not remove prior entries. Disabling model rules stops reads, injection, and unused-file diagnostics. File edits take effect on the next covered turn; switch edits require restart.
