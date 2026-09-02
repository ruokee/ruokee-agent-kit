# Maintenance

Use public commands for `check`, rename, schema migration, representation switching, and GC. These operations report current facts. They do not provide rollback or continuation tokens.

## Check

`tk check` is read-only. It validates project configuration, canonical Task carriers, schema, representation, paths, UUIDs, relationships, WAL, activity markers, and cleanup manifests.

A required I/O failure stops the scan and returns an incomplete result. Format or domain diagnostics found after all required reads produce a complete failed check. check does not repair files.

## Rename

```sh
tk rename <task_ref> <name> --dry-run
tk rename <task_ref> <name>
```

Rename normalizes the name, computes a non-overwriting target, reports Markdown references, moves the directory, updates metadata, and appends WAL. It never rewrites references. Repeating an already satisfied rename returns no change.

## Schema migration

```sh
tk metadata migrate [--file <carrier>]... [--to <version>] [--dry-run]
```

Migration moves released schemas forward through every adjacent converter. It rejects downgrade, missing versions, unknown versions, and missing converters. It prevalidates all selected carriers, preserves split and embed bodies, commits in deterministic order, and skips carriers already at the target.

## Representation switching

```sh
tk metadata switch --to split|embed [--dry-run]
```

Switch validates and plans every Task, commits Tasks in deterministic order, then updates project configuration. It does not append Task WAL.

## Partial failure

Migration, switching, rename, batch creation, and component lifecycle operations stop on the first ordinary I/O error or cancellation point. Inspect `completed`, `uncompleted`, and the original error. Read or check canonical state before issuing a new complete command. Do not assume rollback or preserved domain operation state.

## GC

```sh
tk gc --dry-run
tk gc
```

GC removes only tk temporary paths recorded by minimal cleanup manifests after their producer process has ended. It preserves active processes, escaping paths, symlinks, unknown manifests, and content it cannot prove belongs to tk.

GC does not continue, finish, roll back, or repair a Task, migration, rename, install, update, or uninstall. It does not modify Task metadata, body, WAL, project configuration, or Harness configuration.
