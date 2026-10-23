# omp-qol

## Goals

Provide six independently switchable OMP adjustments in one package: continued job waiting, main-session error recovery, an experimental compaction deadline extension, native-history replay on resume, task argument cleanup, and copying the last assistant reply. Share installation and configuration while exposing each adjustment's effective state, settings, and failure reason.

The complete specification set comprises this component specification and the waiting, error recovery, compaction deadline, native-history replay, task arguments, and reply copying topics. The component-wide configuration, activation, status, isolation, and host requirements apply to all six adjustments; each topic defines its own behavior and acceptance.

## Out of scope

- Installing or migrating for the user, modifying installed host files or other extensions, or changing unrelated host behavior.
- Remote request alignment, compaction usage, or model rules. These belong to `omp-smart-context`; QoL neither activates nor stops them.

## Public surface

### Configuration

Use OMP plugin settings for `@ruokee/omp-qol`, with project values overriding user values. Read the effective settings once per activation. Restart OMP to apply changes; creating another session in the same running process does not reload that snapshot.

All switches and notification fields are booleans. The master switch is:

| Key | Default |
| --- | --- |
| `enabled` | `true` |

An absent key takes its default. Explicit null, a wrong type, non-finite number, fraction for an integer field, out-of-range value, or unknown enum disables the owning module only. An unknown key, non-object settings root, settings-read failure, or invalid master `enabled` disables every module. Do not activate defaults after rejecting the settings object.

The absent keys `compactionCacheEnabled`, `compactionCacheProvider`, `compactionCacheMode`, `compactionUsageEnabled`, and `modelPromptsEnabled` are unknown keys and reject the whole configuration. There are no compatibility aliases. Migration removes those keys from both user and project scopes, preserves unrelated settings and effective enablement, and requires its own authorization.

Diagnostics name the rejected key and rule, never its value. Report a module reason once per activation through the host log and, when available, UI. The master switch gates all module action; the copy key remains claimed while its extension binding exists even when action is disabled.

### Status

`/qol` is read-only and starts no model turn. Show package identity and version, activation cwd, the restart refresh policy, settings validity, and all six module states with their effective configuration. Use `pending` before session start and distinguish `enabled`, `disabled`, `invalid`, `incompatible`, and `unavailable`, with bounded reason codes. List rejected keys for partial or total settings rejection without printing their values.

## Invariants

Each valid adjustment remains usable when another has a local configuration or availability failure. Unknown required host shapes preserve native behavior rather than guessing. Process-wide effects obey their adjustment's ownership and teardown rules. Settings names, defaults, ranges, absent-key rejection, and unrelated values remain consistent across declarations and both user-document languages.

## Host lower bound

The minimum maintained OMP version is `18.5.0`, without an upper maintenance bound. This is not an installation or runtime gate, nor proof that every later version works. Earlier hosts may run without being maintained. Host peers remain unrestricted; required host capabilities determine a module's availability. Do not retain paths solely for hosts below the maintenance floor.

## Acceptance criteria

- Check all settings defaults, type and range failures, module-local rejection, whole-object rejection, retired keys, restart semantics, and truthful read-only `/qol` output.
- Record each adjustment's real CLI or TUI evidence in its validation material, separating source inspection, automated checks, and actual runtime observations. Mark unrun scenarios, including exact-error reproduction or real key delivery and clipboard writing, as unverified rather than inferring success.
