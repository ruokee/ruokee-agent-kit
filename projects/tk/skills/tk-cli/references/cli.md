# CLI

The CLI supports terminal use and scripts. Commands write results to standard output and diagnostics to standard error.

## Invocation

Ordinary commands use one entry point:

```text
tk [--cwd <path>] [--output <text|json>] <command> ...
```

- `--cwd` starts project discovery at the specified directory. The runtime process directory is the default.
- `--output text|json` selects human-readable text or structured JSON. The default is `text`.
- `--actor` is not global. It belongs only to `update`, `log`, and `rename`.

Terminal users normally use `text`. Programs and Agents should use `json` and handle failures through stable error fields.

## Output

With `--output json`, ordinary success and expected failure use a common result shape:

```json
{
  "ok": true,
  "data": {}
}
```

```json
{
  "ok": false,
  "error": {
    "code": "invalid_args",
    "category": "request",
    "message": "...",
    "details": {}
  }
}
```

Text output communicates the same facts, but its formatting is not a machine interface. Programs should read `error.code`, `error.category`, and `details` instead of parsing the human-readable `message`.

`--version` has its own version payload instead of the ordinary result shape. Diagnostics go to standard error. Non-terminal output has no color.

## Exit statuses

|Status|Meaning|
|-:|-|
|`0`|Success, including no change and success with non-fatal warnings|
|`2`|Invalid CLI syntax, option, JSON, range, or request field|
|`3`|Rejected context, configuration, policy, resolution, managed file, invariant, conflict, or compatibility|
|`4`|Storage failure, partial commit, protocol startup failure, or internal failure|
|`5`|A required external executable is missing, non-executable, or cannot start|
|`130`|Cancellation before the first persistent write|

Exit status identifies only the error class. Automation should still read stable JSON error fields.

## `tk search`

Search Tasks:

```text
tk search <query>
  [--regex] [--search-body]
  [--status <planning|open|closed>]...
  [--extra <object-json>] [--limit <n>]
  [--cwd <path>] [--output <text|json>]
```

|Argument|Default|Behavior|
|-|-|-|
|`<query>`|Required|UUID, Task path, material path, name, or text|
|`--regex`|`false`|Interpret ordinary text explicitly as a Rust regular expression|
|`--search-body`|`false`|Include the Task body for text or regular-expression matching|
|`--status`|All statuses|Repeatable; a non-empty set narrows results|
|`--extra`|`{}`|JSON object with top-level conditions joined by `AND`|
|`--limit`|`20`|Range `1..100`|

Search determines the query type first and does not fall back to another interpretation after one fails. It may return zero, one, or several candidates. Choose one target before modifying a Task.

## `tk read`

Read one Task:

```text
tk read <task_ref>
  [--view <metadata|summary|detailed>]
  [--wal-max-entries <n>] [--wal-max-length <bytes>]
  [--cwd <path>] [--output <text|json>]
```

The default view is `summary`:

- `metadata` returns managed metadata;
- `summary` returns common status and a body summary;
- `detailed` returns fuller context and includes WAL within the requested budgets.

`--wal-max-entries` and `--wal-max-length` apply only to `detailed` and limit WAL entries and bytes.

`task_ref` should be a complete UUIDv7 or exact path. Send fuzzy names to `tk search` first.

## `tk create task`

Create a top-level Task:

```text
tk create task <name>
  [--body <markdown>] [--status <planning|open>]
  [--created-at <rfc3339>]
  [--depends-on <uuid>]... [--related-to <uuid>]...
  [--extra <object-json>]
  [--user-confirmed <true|false>]
  [--cwd <path>] [--output <text|json>]
```

- `<name>` is required.
- `--body` sets the initial `TASK.md` body.
- `--status` accepts only `planning` or `open` and defaults to `open`.
- `--created-at` preserves a reliable historical creation time. Omit it for ordinary creation.
- `--depends-on` and `--related-to` are repeatable and accept complete UUIDs for existing Tasks in the same Task root.
- `--extra` accepts a JSON object.
- Direct CLI creation represents the current user's request, so `--user-confirmed` defaults to `true`. Other invocation entries must not borrow this default to fabricate confirmation.

See [Task concepts](./task-concept.md) and [Project storage](./project-storage.md) for naming, authorization, and Task-field rules.

## `tk create subtask`

Create several subtasks below one parent:

```text
tk create subtask <parent_ref>
  --item <object-json> [--item <object-json>]...
  [--user-confirmed <true|false>]
  [--cwd <path>] [--output <text|json>]
```

Each `--item` is a JSON object with required `name` and optional `body`, `status`, `created_at`, relationships, and `extra`. One request accepts 1 to 50 items.

The runtime preflights the complete batch, then creates in input order. CLI `--user-confirmed` defaults to `true`; other invocation entries must pass the real authorization state. Creating a `planning` subtask requires confirmation.

See [Subtasks](./subtask.md) for placement, numbering, discovery, and retry rules.

## `tk update`

Update relationships, extension fields, or lifecycle:

```text
tk update <task_ref>
  [--depends-on-add <uuid>]... [--depends-on-remove <uuid>]...
  [--related-to-add <uuid>]... [--related-to-remove <uuid>]...
  [--extra-set <object-json>] [--extra-remove <key>]...
  [--start | --close <reason> | --reopen <reason>]
  [--force] [--user-confirmed <true|false>]
  [--actor <text>]
  [--cwd <path>] [--output <text|json>]
```

- Relationship options add or remove values incrementally. They do not replace the whole set.
- `--extra-set` merges a JSON object by top-level key; `--extra-remove` removes repeatable top-level keys.
- One invocation selects at most one of `--start`, `--close`, or `--reopen`.
- The values of `--close` and `--reopen` are the required non-empty reasons.
- `--force` is valid only with `--close` and skips only the open-descendant and open-dependency checks.
- CLI `--user-confirmed` defaults to `true` for close and reopen.
- `--actor` defaults to `cli`.

An empty update or a net no-op returns no change and does not write duplicate content.

## `tk log`

Append one Task WAL entry:

```text
tk log <task_ref> --message <text>
  [--body <markdown>] [--actor <text>]
  [--cwd <path>] [--output <text|json>]
```

`--message` must be non-empty single-line text. `--body` stores longer supporting content. `--actor` defaults to `cli`.

`log` does not change managed metadata. A `closed` Task rejects WAL append. Reopen first when work must continue. See [Task concepts](./task-concept.md) for WAL boundaries.

## `tk init`

Initialize a project:

```text
tk init
  [--task-root <path>] [--subtasks-dir <path>]
  [--git-policy <track|ignore|none>]
  [--creation-policy <strict|permissive>]
  [--metadata-mode <split|embed>]
  [--force]
  [--cwd <path>] [--output <text|json>]
```

Ordinary initialization rejects an existing project. With no non-default configuration, it creates only the default `.tk/` and does not create a redundant configuration file.

`--force` rewrites sparse project configuration from this invocation's explicit values and defaults, even when the old configuration cannot be parsed. It does not read, migrate, move, delete, or rewrite Task data. See [Project storage](./project-storage.md) for complete initialization behavior.

## `tk check`

Check managed project data:

```text
tk check [--cwd <path>] [--output <text|json>]
```

A complete scan with no findings exits `0`. A complete scan with blocking diagnostics returns `check_failed` and exits `3`. A required I/O failure stops immediately with `check_incomplete` and exit `4`.

`check` does not repair files. Manually repair a damaged `tk.toml` only when tk cannot express the repair, an Agent has stated the exact edit, and the user explicitly authorizes it in the current context. Run `check` again afterward and record WAL when the Task becomes readable.

## `tk rename`

Rename a Task:

```text
tk rename <task_ref> <name>
  [--dry-run] [--actor <text>]
  [--cwd <path>] [--output <text|json>]
```

`--dry-run` returns a plan without writing. Execution changes only the target Task and reports Markdown references it finds without rewriting them. A name and path already in canonical form return no change. `--actor` defaults to `cli`.

## `tk gc`

Remove stale tk temporary data:

```text
tk gc [--dry-run]
  [--cwd <path>] [--output <text|json>]
```

GC removes only tk temporary paths and active-operation markers left by operation processes that have exited. It does not continue, roll back, or finish Tasks, migrations, renames, or component operations.

`--dry-run` lists removable entries without deleting them. An I/O error during deletion stops immediately and lists deleted and undeleted paths.

## `tk metadata migrate`

Migrate Task schemas:

```text
tk metadata migrate
  [--file <path>]...
  [--to <schema-version>] [--dry-run]
  [--cwd <path>] [--output <text|json>]
```

- Without `--file`, the command selects every valid managed carrier in the current project.
- `--file` is repeatable. Each value must be a valid `tk.toml` or embedded `TASK.md` in the current project. Directories, Task IDs, ordinary material paths, and globs are rejected.
- `--to` selects the target schema version.
- `--dry-run` returns the plan only.

Migration applies only published forward conversions, one version at a time. After complete preflight, it commits in deterministic order. A failure lists completed and uncompleted files. There is no downgrade, automatic rollback, or continuation state.

## `tk metadata switch`

Switch project metadata mode:

```text
tk metadata switch --to <split|embed>
  [--dry-run]
  [--cwd <path>] [--output <text|json>]
```

The command applies to the whole project and cannot switch only some Tasks. It preflights every Task, commits in deterministic order, and updates project configuration last. A failure lists completed and uncompleted Tasks.

Mode switching does not replace schema migration. See [Project storage](./project-storage.md) for carrier rules and operation order.

## `tk install`

Install tk Harness components:

```text
tk install --harness <codex|claude|pi|omp>
  [--mode <tools|cli>] [--language <en|zh>]
  [--dry-run] [--output <text|json>]
```

- `--harness` is required.
- `--mode` defaults to `tools`.
- `--language` defaults to `en`.
- The four resolved Skills are `tk`, `tk-zh`, `tk-cli`, and `tk-cli-zh`.
- `--dry-run` returns a plan without writing.

Installation uses only components embedded in the current executable. It does not access the network or accept a local archive. A changed target, registration, mode, language, or Skill is updated directly, and known residual Skill targets are removed.

The action is `would_install`, `installed`, `updated`, or `no_change`. Cross-file failures follow the completed and uncompleted contract.

## `tk uninstall`

Uninstall tk Harness components:

```text
tk uninstall --harness <codex|claude|pi|omp>
  [--dry-run] [--output <text|json>]
```

Uninstall does not accept mode or language options. It removes the current component, every known residual tk Skill variant for that Harness, and tk registration while preserving unrelated content.

The action is `would_uninstall`, `uninstalled`, or `no_change`, with planned or actual changes listed.

## `tk --version`

Print the current version:

```text
tk [--output <text|json>] --version
tk -V
```

The JSON payload contains:

```json
{
  "runtime_version": "0.1.2",
  "cli_contract_version": 1,
  "task_schema_version": 1,
  "component_format_version": 2
}
```

Version values in the example change with releases. This command does not require a project and exits `0` on success.

## `tk --help`

Print usage, options, defaults, and subcommands for the current command level:

```text
tk --help
tk -h
tk <command> --help
tk <command> <subcommand> --help
```

Help text is for people and is not a stable machine interface.

## Multi-target failures

Batch creation, migration, mode switching, and component operations may commit only some targets before failure. In that case:

- successful targets remain committed;
- the failure lists `completed`, `uncompleted`, and the original error;
- the runtime does not roll back automatically or create a continuation token;
- the caller should read current state and submit a new complete command.
