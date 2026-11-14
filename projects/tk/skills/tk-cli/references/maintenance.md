# Maintenance

Read this file after an operation fails, when state may be partially committed, when managed data is invalid, or before using `check`, `rename`, GC, or manual repair.

## Establish current state

Read the stable error `code`, `category`, and `details` first. Do not parse the human-readable `message`, and do not assume one failure means nothing was written.

For multi-target errors, inspect `completed`, `uncompleted`, `original_error`, and any `cleanup_error`. Read the target or run `check` before deciding on a new complete operation. Do not assume rollback, a continuation token, or background progress.

A WAL warning means metadata may already be committed. Follow [WAL](./wal.md) and add only a missing event. Do not repeat the original modification.

## Check

`check` is read-only. It validates project configuration, Task topology, carriers and schema, UUIDs, names and paths, sibling numbering, relationships and dependency cycles, WAL, active-operation markers, and cleanup manifests.

A complete scan that finds problems returns `check_failed`. If a required directory or file cannot be read, it returns `check_incomplete` and stops. An incomplete scan cannot establish that the rest of the project is valid.

`check` does not repair files or authorize manual edits. Preserve the exact code and path before repair. Run `check` again and read each affected Task afterward.

## Rename

Run rename with `--dry-run` first and open `report_path`. Confirm the raw old name, normalized new name, Task mapping, and references. rename repairs eligible invalid, empty, or over-wide string names and recognizable generated suffix defects. Valid formatting differences in [Task concepts](./task-concept.md) need no repair. Explicit rename reaches its normalized name and applicable path even when source formatting is valid.

References keep their content by default. Use `--update-references` for explicit rewriting and `--extend-scan` for additional Markdown files or directories.

A requested name and its applicable generated path that already match return no change. Do not bypass a target conflict, damage outside rename's name-repair scope, or a failed reference scan with an alias, copied directory, or direct metadata edit.

A commit-stage failure may leave only part of the name, generated directory, or WAL update complete. Run `check` immediately, then decide from current managed state whether to rerun rename or enter manual repair.

## References

rename and layout commands scan the current Task root by default. Under `git_policy=track`, they scan project Markdown and other known Task roots. WAL, `.git`, and `.tk-tmp` are excluded. Symbolic links retain the existing skip rules. Required I/O failures and resource limits stop planning explicitly. Embed scans cover body content only.

Use repeatable `--exclude-scan <path>` to omit literal files or directory subtrees from reference scanning and its precommit recheck. Relative paths resolve from the project root; absolute paths can cover external extension roots. Paths are lexically normalized, sorted, and deduplicated. Nonexistent and out-of-scope exclusions are allowed. Exclusion matches whole path components and takes precedence over default and extension inputs before inspecting or reading an excluded target. Other inputs retain their existing failure rules. This controls reference scanning only; Task discovery and managed changes retain their own rules. Excluded references keep their content.

Explicit updates cover Markdown links, images, definitions, full-path wikilinks containing the real Task-root path, and complete path text. Labels, titles, aliases, query, fragments, and bytes outside edited intervals are preserved. Filename-only wikilinks keep their text. Relative links use the moved source file's new parent and the moved target's new location. Subtree-local links retain their original text when it still resolves correctly.

Open the immutable JSON report under `<task_root>/.tk-tmp/reports` for full Task mappings, references, scan scope, and diagnostics. Dry-run, no-change, and planning failures in a valid project also save reports. `scan_complete=false` identifies an interrupted or failed scan. Report storage failure stops managed writes. Reports are scan snapshots, not execution logs or replay plans.

With explicit exclusions, `excluded_paths` records their absolute normalized paths, including on business planning failure. Without exclusions, the field is omitted. Read `scan_complete` against `scan_roots` minus built-in and explicit exclusions; an entirely excluded scope can be complete. Inspect that scope before approving a reference update.

## Layout failure

Use `completed`, `uncompleted`, `original_error`, `report_path`, and configuration state from the error. Layout commits directory moves, optional reference replacements, and finally switch configuration. migrate preserves configuration. rename commits movement, references, metadata, and WAL in that order. Pending references, carriers, targets, and configuration are rechecked before managed writes.

A partial switch retains the source layout configuration until the final configuration write. Already moved Tasks may temporarily disappear from ordinary reads. Resolve the reported blocker and run a new plan for the remaining source directories. Use the previous report to review references for earlier moves. Each call saves a new report. The runtime does not roll back automatically.

## GC

GC removes only tk temporary paths, minimal cleanup manifests, and active-operation markers left by operation processes that have exited. It does not recover, continue, roll back, or finish Tasks, migrations, metadata mode switches, renames, or component operations.

The project-level real `.tk-tmp/reports` directory is retained. User-level component temporary directories keep their existing cleanup semantics.

Use `--dry-run` for unfamiliar residue. Preserve and report an item when an operation process is still active, process identity cannot prove it ended, or the path does not satisfy the cleanup contract.

If deletion fails, read the deleted and undeleted path lists. Fix the filesystem error and rerun the complete GC. Do not edit a cleanup manifest manually to make a check pass.

## Manual repair threshold

Routine changes must use public tk operations. Manual repair is allowed only when managed data is already damaged and no public operation can express the repair.

Before editing:

1. Resolve the affected Task and managed carrier uniquely.
2. State the exact fields, final contents, and path changes.
3. Obtain the user's current explicit authorization.
4. Confirm that no tk writer is active.
5. Change only the stated minimum area.
6. Run `check` and read the Task again.
7. Record the repair event after the Task is readable.

Manual repair cannot bypass authorization, Git, lifecycle, relationship, conflict, or compatibility rejection.

## Name repair

Use `tk rename` with a full UUID, exact Task directory, or exact managed carrier for eligible old-name damage in split or embed. Name repair does not tolerate missing or incorrectly typed names, unparseable carriers, missing markers, unsupported schema, damaged identity, unsafe paths, invalid relationships or `extra`, or unrecognizable generated directory structures.

After repair, run `tk check` and read the Task. Use manual repair only when the damage remains outside the public operation's scope.

## Process failures

A process that cannot start, invalid JSON output, or a killed process may produce no domain error result. Preserve the original failure, inspect current state, and do not invent an error code.
