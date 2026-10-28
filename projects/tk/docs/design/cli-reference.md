# CLI reference

[简体中文](./cli-reference.zh.md)

This page provides public CLI spellings, defaults, options, results, and exit statuses. Detailed data semantics are in [Data model](./data-model.md).

## Invocation rules

```text
tk [global-options] <command> [command-options]
```

Global options:

- `--cwd <path>` defaults to the process directory and names the starting point for project discovery.
- `--output <text|json>` defaults to `text` and selects the result encoding for ordinary commands.

`--actor` is not a global option. It belongs only to update, log, and rename.

JSON arguments require object roots and reject duplicate keys at every depth. Structured subtask items reject unknown fields. Agents must supply their actual authorization and may set `--actor` to an available model or Harness identity; attribution never proves permission.

## Exact Task references

`task_ref` accepts a full canonical UUIDv7, an absolute discovered Task directory, an absolute managed `tk.toml` or `TASK.md` carrier, or a discovered Task path relative to the current project. Names, basenames, UUID prefixes, substrings, regular expressions, and material paths are search inputs, not exact references. Reads and modifications must resolve exactly one Task. A complete absolute Task or material path can locate its own project.

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
tk metadata migrate
tk metadata switch
tk install
tk uninstall
tk --version
```

## Output

Ordinary JSON success is `{"ok":true,"data":...}`. Expected failure is `{"ok":false,"error":{"code":...,"category":...,"message":...,"details":...}}`. Non-empty `warnings` contain `code`, `message`, and optional `details`; empty warnings are omitted. Human-readable messages are not a machine-branching contract.

Mutation results report `changed`, `committed`, affected Task references or paths, and `completed` and `uncompleted` for multi-target operations. `partial_commit` details include completed targets, uncompleted targets, and the original I/O error, without rollback or resume tokens. Panics, killed processes, and malformed output are not fabricated domain failures.

Text conveys the same facts as JSON. Its layout is not a machine contract except for the documented rename labels. Version writes its own JSON payload without an ordinary envelope. Diagnostics use stderr. Non-terminal output contains no color.

## Exit statuses

The current mapping is:

- `0`: success, including no change and success with non-fatal warnings.
- `2`: invalid CLI syntax, option, JSON, range, or request field.
- `3`: rejected because of context, configuration, policy, parsing, managed files, invariants, conflicts, or compatibility.
- `4`: storage failure, partial commit, or internal failure.
- `5`: a required external executable is missing, not executable, or cannot be started.
- `130`: canceled before the first persistent write.

Automation must inspect JSON `error.code` and `error.category` to distinguish specific causes. Numeric exit codes are not a fine-grained error contract.

## Error codes

| Category | Typical error codes |
| --- | --- |
| `request` | `invalid_request`, `invalid_search_regex` |
| `context` | `project_not_found`, `path_outside_project` |
| `environment` | `runtime_not_installed`, `runtime_not_executable`, `process_start_failed` |
| `configuration` | `invalid_configuration`, `project_not_initialized` |
| `policy` | `authorization_required`, `git_policy_refused` |
| `resolution` | `task_not_found`, `task_ref_ambiguous`, `duplicate_task_id` |
| `managed_file` | `invalid_managed_file`, `unsupported_schema`, `representation_mismatch` |
| `invariant` | `dependency_cycle`, `closed_task_read_only`, `active_descendant`, `active_dependency`, `closed_ancestor` |
| `conflict` | `target_exists`, `operation_in_progress`, `broken_reference_conflict` |
| `storage` | `check_incomplete`, `task_discovery_limit_exceeded`, `reference_scan_limit_exceeded`, `wal_append_failed`, `partial_commit` |
| `compatibility` | `runtime_incompatible`, `component_incompatible` |
| `internal` | `internal_error` |

## `tk search`

```text
tk search <query>
  [--regex] [--search-body]
  [--status <planning|open|closed>]...
  [--extra <object-json>] [--limit <n>]
  [global-options]
```

- `<query>`: required. A UUID, Task path, material path, name, or text.
- `--regex`: default `false`. Explicitly interpret plain text as a Rust regular expression.
- `--search-body`: default `false`. Include the Task body in text or regular-expression matching.
- `--status`: default all statuses. Repeatable; a non-empty set narrows the results.
- `--extra`: default `{}`. A JSON object whose top-level entries are combined with AND.
- `--limit`: default `20`. Accepts 1 to 100.

Interpret the query once, in this order: a full UUID or explicit Task path; an existing ordinary path as a material path; a regular expression when enabled; otherwise name text and, when enabled, body text. There is no fallback after classification. Hyphen-free hexadecimal UUID prefixes of at least eight digits are supported only by search.

Results sort by match class, then descending `created_at`, then ascending ID. Each item contains `id`, `name`, `status`, `created_at`, `task_dir`, string `match` equal to `uuid`, `path`, `regex`, or `string`, and `closed_ancestors`. The result contains `items` and a `truncated` flag. Invalid marked carriers do not become Tasks; necessary discovery failures fail the search rather than return a partial graph. Extra filters compare full top-level values with AND.

```text
tk search architecture
tk search 0192aabb --status closed
tk search /work/project/.tk/2026/08/27-01--tk-architecture/notes.md
tk search 'api|cli' --regex --search-body --output json
```

## `tk read`

```text
tk read <task_ref>
  [--view <minimal|summary|detailed>]
  [--wal-max-entries <n>] [--wal-max-length <bytes>]
  [global-options]
```

The default view is `summary`. `minimal` returns metadata and managed paths without reading Task body or WAL. `summary` returns the complete Task body and recent WAL entries without their bodies. `detailed` adds WAL entry bodies.

WAL budgets apply to `summary` and `detailed`. Defaults are 5 entries and 4000 bytes for summary, 50 entries and 16000 bytes for detailed. Explicit ranges are 0–50 entries and 0–16000 bytes. Measure each entry's compact JSON UTF-8 size after view projection, select complete entries from newest to oldest within both budgets, then return them chronologically. Omitted entries cause no truncation field, warning, or diagnostic. There is no pagination or full-history mode; complete history remains in ordinary daily WAL files. See [Exact Task references](#exact-task-references) for accepted references.

## `tk create task`

```text
tk create task <name>
  [--status <planning|open>]
  [--created-at <rfc3339>]
  [--depends-on <uuid>]... [--related-to <uuid>]...
  [--extra <object-json>]
  [--user-confirmed <true|false>]
  [global-options]
```

The default status is open, and `--user-confirmed` defaults to true. Agents must pass the actual authorization state instead of relying on that default. Results list created Task references in `data.created`.

The create command accepts no body input; the [creation body](./data-model.md#creation-body) rules cover the generated heading.

## `tk create subtask`

```text
tk create subtask <parent_ref>
  --item <object-json> [--item <object-json>]...
  [--user-confirmed <true|false>]
  [global-options]
```

Each item contains `name` and optional `status`, `created_at`, relationships, and `extra`. Items do not accept a body. A request accepts 1 to 50 items. After preflighting the entire batch, it creates the items in input order. CLI creation defaults `--user-confirmed` to true. Agents must pass the actual authorization state instead of relying on that default. Planning children require confirmation.

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

check does not repair files; the [manual repair procedure](./skill.md#manually-repairing-task-metadata) holds the conditions for editing a corrupted `tk.toml` by hand.

## `tk rename`

```text
tk rename <task_ref> <name>
  [--dry-run] [--ignore-brokenlinks] [--actor <text>]
  [global-options]
```

rename modifies only the Task itself, accepts closed Tasks, and keeps their status. It also repairs an invalid, empty, or over-wide string name and a recognizable generated suffix that fails the [Task-name rules](./data-model.md#task-names). Full UUIDs, exact Task directories, and exact managed carriers can locate eligible repair targets even when ordinary discovery rejects the old name. Other metadata, identity, path, lifecycle, policy, and conflict checks remain strict. Generated child and top-level directories move when their slug changes, while non-generated child directories stay in place. Dry-run and execution return the raw old name, resolved parent, and Markdown references without rewriting them. Only a saved name and applicable path that exactly match the normalized target return no change. actor defaults to `cli`.

Formatting correspondence does not complete an explicit rename. For example, renaming saved name `AI 学习` at suffix `AI学习` to `AI 学习` targets name and suffix `AI-学习`. The [rename contract](./data-model.md#rename) also retains exact precommit checks and partial-failure retry behavior.

Dry-run text shows `Old path:`, the normalized name as `New name:`, and the absolute destination as `Target path:`. Every execution result shows the target path, and a no-op result prints `No changes` followed by `Target path:`. When references to the old path exist, the text appends a `References to the old path:` list with every reference as `path:line`; the section is absent when there are none. Dry-run always succeeds after a valid plan is built. An execution that would move the Task path stops with the stable error code `broken_reference_conflict` (category `conflict`, exit status 3) before the first write when references to the old path exist; the error shows the target path and every reference with its line. `--ignore-brokenlinks` lets that move proceed. Reference files stay unchanged, and the result still reports them.

## `tk gc`

```text
tk gc [--dry-run] [global-options]
```

GC removes tk temporary paths and activity markers left by production processes that have exited. It does not resume, roll back, or complete Task, migration, rename, or component operations. If deletion encounters an I/O error, it stops and lists the deleted and undeleted paths.

## `tk metadata migrate`

```text
tk metadata migrate
  [--file <path>]...
  [--to <schema-version>] [--dry-run]
  [global-options]
```

When no file is specified, the command selects every discovered carrier in the current project. Each specified value must be a managed `tk.toml` or embed `TASK.md` belonging to a discovered Task in the current project. Directories, Task IDs, material paths, and globs are not accepted.

Migration only applies officially released forward transformations one version at a time. After preflighting all targets, it commits them in deterministic order. A failure result lists completed and incomplete files. It provides no downgrade, rollback, or resume state.

## `tk metadata switch`

```text
tk metadata switch --to <split|embed>
  [--dry-run] [global-options]
```

The command switches every discovered Task in the project. After preflighting all Tasks, it commits them in deterministic order and updates the project configuration last. A failure result lists completed and incomplete Tasks.

## `tk install`

```text
tk install --harness <codex|claude|pi|omp>
  [--language <en|zh>]
  [--dry-run] [--output <text|json>]

tk install --skill-root <directory>
  [--language <en|zh>] [--dry-run] [--output <text|json>]
```

Exactly one of `--harness` and `--skill-root` is required. `--language` defaults to `en`, selecting `tk-cli`; `zh` selects `tk-cli-zh`.

Harness selection maps to an ordinary Skill root: Codex uses `$CODEX_HOME/skills`, defaulting to `~/.codex/skills`; Claude Code uses `~/.claude/skills`; Pi uses `~/.pi/agent/skills`; OMP uses `~/.omp/agent/skills`. A custom root resolves from process cwd. Installation writes the selected Skill and removes the other language variant. Both target types manage only these two direct children, preserve other content, and do not read Harness configuration or invoke Harness commands. Component operations reject global `--cwd`.

Install uses only payloads embedded in the current executable. It does not access the network or accept a local archive.

The result action is `would_install`, `installed`, `updated`, or `no_change`. Text and JSON results contain exactly one target field, `harness` or absolute `skill_root`, plus `language`, `skill`, and planned or actual changes. Failures follow the multi-target completed and uncompleted contract.

## `tk uninstall`

```text
tk uninstall --harness <codex|claude|pi|omp>
  [--dry-run] [--output <text|json>]

tk uninstall --skill-root <directory>
  [--dry-run] [--output <text|json>]
```

Exactly one target option is required. Uninstall takes no language selector. It removes both `tk-cli` and `tk-cli-zh` below the selected root, including modified or extra content inside those targets. The root and every other child remain unchanged.

The result action is `would_uninstall`, `uninstalled`, or `no_change`. Results contain exactly one target field and list planned or actual changes. They omit `language` and `skill` because both identities are removed.

## Runtime information

```text
tk [--output <text|json>] --version
tk --help
tk <command> --help
tk <command> <subcommand> --help
```

Version JSON is:

```json
{
  "runtime_version": "0.1.15",
  "cli_contract_version": 4,
  "task_schema_version": 1,
  "component_format_version": 5
}
```

`runtime_version` is the package version of the running executable and changes with releases; the other values are the version dimensions defined in [Runtime architecture](./runtime.md#version-dimensions).

version does not require a project and exits 0 on success. help displays usage, arguments, defaults, and subcommands for the current level.
