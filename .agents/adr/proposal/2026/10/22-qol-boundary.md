# QoL boundary

Draft owner: Ruokee
Draft writer: OMP gpt-6-astra

English | [中文](./22-qol-boundary.zh.md)

## Motivation

Remove usage compensation and model prompt rules from QoL when smart-context takes ownership.

The [QoL decision](../../../decision/2026/09/20-omp-qol.md), [usage decision](../../../decision/2026/10/13-compaction-usage.md), and [model-rule decision](../../../decision/2026/09/14-model-prompt-rules.md) assign the migrated modules to QoL. Keeping their old registration or settings after cutover would leave duplicate behavior and conflicting configuration authorities.

## Proposal

Continue the `20-omp-qol` identity. Reverse only the ownership of usage compensation and model prompt rules and the obligation to preserve their QoL settings. Their complete successors are the [usage proposal](./22-compaction-usage.md) and [model-rule proposal](./22-model-prompt-rules.md). Remote alignment remains outside QoL under its own successor.

Remove the two module implementations, registration and stop paths, settings declarations and parsing, status sections, and dependencies used only by them. QoL neither reads their old keys nor forwards them to another package. Preserve the master switch and every unrelated key, default, range, validation rule, status, and failure boundary.

Keep continuing standalone waits, bounded error recovery, the opt-in compaction deadline experiment, native history replay, task-parameter cleanup, and copying the last reply. Preserve wait delegation and total deadlines; recovery exclusions and continuation bounds; the deadline module's process-wide matching and single-owner windows, matching-activation reuse, and terminal `owner-stopped`; and replay's independent ownership and conditional restoration. Do not move replay merely because it is cache-related or apply alignment's renewable coordinator lifecycle to QoL's deadline owner.

Preserve native settings authority, shared host floor, module-local errors, privacy, host recheck obligations, and evidence requirements for unchanged QoL behavior. The integrated capabilities' controlled acceptance does not silently weaken an unrelated QoL feature's own contract.

Migration instructions must clear `compactionUsageEnabled` and `modelPromptsEnabled` from both user and project QoL settings while preserving all other values. Fold the old effective master switch into each moved module switch in smart-context, separately accounting for project overrides. Remaining removed keys retain unknown-key rejection and can reject the whole QoL configuration; no compatibility exception or second source is added. Restart after removing old extension entries and updating settings. Do not edit real user configuration automatically.

## Alternatives considered

None

## Acceptance criteria

- QoL no longer installs, stops, or reports either migrated module, and contains no cross-component runtime dependency.
- After removed keys are cleared, all remaining adjustments retain their settings and observable behavior.
- Unknown removed keys are rejected under the existing configuration contract, and migration instructions explain that consequence.
- Current decisions and bilingual documentation identify one owner per migrated capability and preserve unchanged QoL obligations.

## Risks

Updating linked QoL source before clearing removed keys can disable every QoL module through unknown-key rejection. Copying module values without the old master-switch result can unexpectedly enable migrated behavior. The migration therefore needs both configuration scopes and a restart boundary.
