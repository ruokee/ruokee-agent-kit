# ADR proposal: Restore rename repair functionality

Decision owner: Ruokee
Draft writer: pro-20x/gpt-6-astra

English | [中文](./2026-09-08-repair-names-through-tk-rename.zh.md)

## Motivation

The original design assigned `rename` an additional repair responsibility alongside ordinary renaming: repairing existing Task names and their generated directory suffixes. This was part of the original requirements, not a capability introduced by this proposal. Subsequent implementation and contract documentation departed from that intent by making complete validation of the old Task a prerequisite for rename, blocking the very objects it was meant to repair.

In tk, the UUID is identity, the name is a mutable description, and the path is a locator. A name needing repair does not invalidate Task identity. Requiring users to edit managed data before invoking rename undermines runtime ownership of metadata and leaves split and embed with unequal recovery capabilities.

This proposal restores the original repair responsibility and corrects contracts that present broken functionality as a usage restriction. The old name need not already be valid; the repaired result and constraints outside the repair scope must remain valid.

## Proposal

### Restore the original repair responsibility

`tk rename <task_ref> <name>` performs both ordinary renaming and name repair, without `--repair`, `--force`, or a separate repair command. The new name remains subject to current normalization and complete validation.

For a unique Task that can be safely located and parsed in the current representation, the following defects fall within name repair:

- `name` is a string but is noncanonical, empty, empty after normalization, or exceeds the current display-width limit.
- A generated directory has recognizable structure but its nonempty suffix disagrees with the metadata name.
- Both conditions occur together.

Missing names, wrong field types, unparseable carriers, missing managed markers, unsupported schemas, damaged identity, and unsafe paths are outside this scope. rename does not infer missing metadata, migrate schemas, or repair damaged dates, sequences, or unrecognizable generated directory structures.

### Keep consistent entry points

split and embed provide the same repair capability. Full UUIDs, exact Task directories, and exact carrier paths can locate eligible repair targets without requiring them to appear as valid Tasks in ordinary discovery first.

Identity must be unique. A copy with a damaged name cannot be ignored to eliminate UUID ambiguity. Repair must preserve parent-child ownership and explicitly reject indeterminate structure. Do not add fuzzy name matching, ordinary-material path fallback, or cross-project lookup.

The CLI and existing `tk_exec rename` expose the same behavior. Add no argument, persistent field, metadata schema, or second result format.

### Preserve repair boundaries

- Change only the name and applicable generated directory, with the normal WAL append. Preserve identity, lifecycle, creation time, relationships, extra, the body, and existing WAL. Preserve embed body bytes exactly.
- Top-level and generated child Tasks retain their date, sequence, and parent location while changing the name suffix. Non-generated children keep their directory.
- Old-name defects within scope do not block the operation. The new name, other metadata, relationships, and final path must pass validation. Other commands retain ordinary validation rules.
- Closed-Task read-only rules, Git policy, active-operation protection, destination conflicts, and path safety remain effective. Name repair is not a permission bypass.
- `--dry-run` makes no persistent writes and reports the raw old name, normalized new name, old path, destination, parent, and references. A path-only repair also reports a change.
- Retain broken-reference protection and the existing meaning of `--ignore-brokenlinks`. rename does not rewrite ordinary Markdown automatically.
- Retain partial-commit reporting and replanning from current state, without adding an automatic rollback guarantee.

### Correct the current contracts

This proposal conflicts with the [data model decision](../decision/2026-09-03-define-tk-task-data-model.md) requirement that rename depend on valid discovery results. Reverse that constraint through the ADR process while retaining ordinary discovery, identity, and other maintenance rules. The reversal concerns a later restriction that departed from the original intent, not the original repair design.

The [runtime and CLI decision](../decision/2026-08-28-define-tk-runtime-and-cli.md) retains its public entry points and broken-reference rules, with restoration of the original repair responsibility to be recorded. Current decisions remain unchanged during the proposal stage.

## Alternatives considered

Keep strict old-name loading and require manual managed-name repair before rename. Existing maintenance guidance uses this route for some historical split names. Not selected because it perpetuates the departure from the original design, delegates rename's original repair responsibility to external editing, and leaves embed without an equivalent entry point. A manual workaround does not replace restoration of the original functionality.

## Acceptance criteria

1. Eligible Tasks can be previewed and repaired through existing rename entry points without being blocked by their old-name or suffix defects. split, embed, and exact reference forms behave consistently.
2. After repair, ordinary discovery and read accept the target. Its name and generated path satisfy current rules, while identity, body, and parent-child ownership remain unchanged.
3. When name defects coexist with other defects, other validation remains effective. Invalid new names, ambiguous identity, unsafe paths, and existing write protections cannot be bypassed through repair.
4. Dry-run, reference protection, conflict handling, and partial-commit reporting follow existing public contracts. No-change, success, and failure results accurately describe the actual state.
5. rename for ordinary valid Tasks does not regress, and other commands gain no permissive authority. Public contracts no longer require manual repair of old-name defects within rename's responsibility.

## Risks

- Treating name repair as general tolerance for damaged metadata could admit identity or relationship errors into normal writes and modify the wrong Task.
- Omitting candidates with damaged names from identity and structural checks could miss duplicate UUIDs or change child Task ownership.
- Generated-path repair can still break references or leave a partial state where the directory moved but metadata did not commit. Restoring repair capability does not eliminate these existing risks.
