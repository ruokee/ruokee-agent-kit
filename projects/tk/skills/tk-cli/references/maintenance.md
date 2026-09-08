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

Run every rename with `--dry-run` first. Confirm the raw old name, normalized new name, resolved parent, target path, conflicts, and reported Markdown references. rename can repair an existing string name that is noncanonical, empty, empty after normalization, or too wide, and a recognizable generated suffix that disagrees with metadata. The runtime changes only the Task's own name, its generated directory when applicable, and metadata. It does not rewrite references in ordinary materials.

A path-moving rename that finds references to the old path stops with exit status 3 before the first write. One option is to update the reported references and run the rename again. To proceed while accepting broken links, pass `--ignore-brokenlinks`; the reference files stay unchanged, and the result still reports them.

A requested name and its applicable generated path that already match return no change. Do not bypass a target conflict, damage outside rename's name-repair scope, or a failed reference scan with an alias, copied directory, or direct metadata edit.

A commit-stage failure may leave only part of the name, generated directory, or WAL update complete. Run `check` immediately, then decide from current managed state whether to rerun rename or enter manual repair.

## GC

GC removes only tk temporary paths, minimal cleanup manifests, and active-operation markers left by operation processes that have exited. It does not recover, continue, roll back, or finish Tasks, migrations, metadata mode switches, renames, or component operations.

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

## Transport failures

A process that cannot start, invalid JSON output, a damaged protocol frame, or a killed process may produce no domain error result. Preserve the original failure, inspect current state, do not invent an error code, and do not change invocation modes to bypass the same operation.
