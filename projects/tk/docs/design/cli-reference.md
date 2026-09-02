# CLI reference

[简体中文](./cli-reference.zh.md)

This page is the single source of truth for public CLI spellings, defaults, options, and exit statuses. For detailed data semantics, see [Data model and persistence](./data-model.md). For logical JSON requests, see [Tool API](./tool-api.md).

## Invocation rules

```text
tk [global-options] <command> [command-options]
```

Global options:

| Option | Default | Contract |
| --- | --- | --- |
| `--cwd <path>` | Process directory | Starting point for project discovery |
| `--output <text|json>` | `text` | Result encoding for ordinary commands |

`--actor` is not a global option. It belongs only to update, log, and rename.

## Command tree

```text
tk search
tk read
tk create task
tk create subtask
tk update
tk log
tk init
tk check
tk rename
tk gc
tk schema generate
tk metadata migrate
tk metadata switch
tk mcp
tk install
tk uninstall
tk --version
```

## Output

For ordinary successes or expected failures, `--output json` writes a [unified result](./tool-api.md#unified-results) to stdout. Text output conveys the same facts, but its layout is not a machine contract.

The stdout of schema generate, MCP, and version is the command's own payload and does not use the ordinary result structure. Diagnostics go to stderr. Non-terminal output contains no color.

## Exit statuses

The current mapping is:

| Status | Meaning |
| ---: | --- |
| 0 | Success, including no change and success with non-fatal warnings |
| 2 | Invalid CLI syntax, option, JSON, range, or request field |
| 3 | Rejected because of context, configuration, policy, parsing, managed files, invariants, conflicts, or compatibility |
| 4 | Storage failure, partial commit, protocol startup failure, or internal failure |
| 5 | A required external executable is missing, not executable, or cannot be started |
| 130 | Canceled before the first persistent write |

Automation must inspect JSON `error.code` and `error.category` to distinguish specific causes. Numeric exit codes are not a fine-grained error contract.

## `tk search`

```text
tk search <query>
  [--regex] [--search-body]
  [--status <planning|open|closed>]...
  [--extra <object-json>] [--limit <n>]
  [global-options]
```

| Argument | Default | Contract |
| --- | --- | --- |
| `<query>` | Required | UUID, Task path, material path, name, or text |
| `--regex` | false | Explicitly interpret plain text as a Rust regular expression |
| `--search-body` | false | Include the Task body in text or regular-expression matching |
| `--status` | All statuses | Repeatable; a non-empty set narrows the results |
| `--extra` | `{}` | JSON object whose top-level entries are combined with AND |
| `--limit` | 20 | 1 to 100 |

For query interpretation, UUID prefixes, ordering, and the `match` field, see [Tool API search](./tool-api.md#search).

```text
tk search architecture
tk search 0192aabb --status closed
tk search /work/project/.tk/2026/08/27-01--tk-architecture/notes.md
tk search 'api|cli' --regex --search-body --output json
```

## `tk read`

```text
tk read <task_ref>
  [--view <metadata|summary|detailed>]
  [--wal-max-entries <n>] [--wal-max-length <bytes>]
  [global-options]
```

The default view is summary. WAL budgets apply only to detailed. For exact reference rules, see [Tool API](./tool-api.md#exact-task-references).

## `tk create task`

```text
tk create task <name>
  [--body <markdown>] [--status <planning|open>]
  [--created-at <rfc3339>]
  [--depends-on <uuid>]... [--related-to <uuid>]...
  [--extra <object-json>]
  [--user-confirmed <true|false>]
  [global-options]
```

The default status is open. Direct CLI creation represents an explicit current user request, so `--user-confirmed` defaults to true. Callers must not use this default to fabricate user confirmation from another transport.

## `tk create subtask`

```text
tk create subtask <parent_ref>
  --item <object-json> [--item <object-json>]...
  [--user-confirmed <true|false>]
  [global-options]
```

Each item contains `name` and optional `body`, `status`, `created_at`, relationships, and `extra`. A request accepts 1 to 50 items. After preflighting the entire batch, it creates the items in input order. Direct CLI creation defaults `--user-confirmed` to true. Other transports must pass the current authorization state, and planning children require confirmation.


## `tk update`

```text
tk update <task_ref>
  [--depends-on-add <uuid>]... [--depends-on-remove <uuid>]...
  [--related-to-add <uuid>]... [--related-to-remove <uuid>]...
  [--extra-set <object-json>] [--extra-remove <key>]...
  [--start | --close <reason> | --reopen <reason>]
  [--force] [--user-confirmed <true|false>]
  [--actor <text>]
  [global-options]
```

close and reopen require current confirmation. The CLI default is true. `--force` is valid only with close. actor defaults to `cli`.

## `tk log`

```text
tk log <task_ref> --message <text>
  [--body <markdown>] [--actor <text>]
  [global-options]
```

message must be non-empty, single-line text. actor defaults to `cli`. A closed Task rejects log writes.

## `tk init`

```text
tk init
  [--task-root <path>] [--subtasks-dir <path>]
  [--git-policy <track|ignore|none>]
  [--creation-policy <strict|permissive>]
  [--metadata-mode <split|embed>]
  [--force] [global-options]
```

Normal init rejects an already initialized project. `--force` rewrites sparse project configuration using explicit values and defaults, even if the existing configuration cannot be parsed. It does not read or modify Task data.

## `tk check`

```text
tk check [global-options]
```

The command exits 0 when it finds no issues. If a complete read finds blocking diagnostics, it returns `check_failed` and exits 3. If required I/O fails, it immediately returns `check_incomplete`, exits 4, and stops scanning.

check does not repair files. A corrupted `tk.toml` may be repaired manually only when tk cannot express the repair, the Agent has explained the exact edit, and the user has explicitly authorized it in the current context. After the repair, run check again and record the action in the WAL when a Task is available.

## `tk rename`

```text
tk rename <task_ref> <name>
  [--dry-run] [--actor <text>]
  [global-options]
```

rename modifies only the Task itself. Both dry-run and execution return the list of Markdown references found and do not rewrite them automatically. Repeating the command when the name and path are already correct returns no change. actor defaults to `cli`.

## `tk gc`

```text
tk gc [--dry-run] [global-options]
```

GC removes tk temporary paths and activity markers left by production processes that have exited. It does not resume, roll back, or complete Task, migration, rename, or component operations. If deletion encounters an I/O error, it stops and lists the deleted and undeleted paths.

## `tk schema generate`

```text
tk schema generate --type <mcp|native>
  [--harness <pi|omp>]
```

`mcp` does not accept a Harness. `native` requires pi or omp. The command writes the generated six-tool contract directly to stdout.

## `tk metadata migrate`

```text
tk metadata migrate
  [--file <path>]...
  [--to <schema-version>] [--dry-run]
  [global-options]
```

When no file is specified, the command selects all canonical carriers in the current project. Each specified value must be a canonical `tk.toml` or embed `TASK.md` in the current project. Directories, Task IDs, material paths, and globs are not accepted.

Migration only applies officially released forward transformations one version at a time. After preflighting all targets, it commits them in deterministic order. A failure result lists completed and incomplete files. It provides no downgrade, rollback, or resume state.

## `tk metadata switch`

```text
tk metadata switch --to <split|embed>
  [--dry-run] [global-options]
```

The command switches the entire project. After preflighting every Task, it commits them in deterministic order and updates the project configuration last. A failure result lists completed and incomplete Tasks.

## `tk mcp`

```text
tk mcp
```

The command starts a single-connection stdio MCP server. It does not accept cwd, actor, or output because each tool request provides cwd and stdout carries only JSON-RPC.

## `tk install`

```text
tk install --harness <codex|claude|pi|omp>
  [--dry-run] [--output <text|json>]
```

install uses only components embedded in the current executable. It performs an update when an existing tk component has a different version or its content must be replaced.

The result action is `would_install`, `installed`, `updated`, or `no_change`, and the result lists planned or actual changes. On failure, it follows the completed and incomplete item contract for cross-file operations.

## `tk uninstall`

```text
tk uninstall --harness <codex|claude|pi|omp>
  [--dry-run] [--output <text|json>]
```

uninstall removes all tk-specific writes and registrations, restoring the Harness to the state it would have had if tk had never been installed while preserving unrelated content.

The result action is `would_uninstall`, `uninstalled`, or `no_change`, and the result lists planned or actual changes.

## Version and help

```text
tk [--output <text|json>] --version
tk --help
tk <command> --help
tk <command> <subcommand> --help
```

Version JSON is:

```json
{
  "runtime_version": "0.1.1",
  "cli_contract_version": 1,
  "task_schema_version": 1,
  "component_format_version": 1
}
```

version does not require a project and exits 0 on success. help displays usage, arguments, defaults, and subcommands for the current level.
