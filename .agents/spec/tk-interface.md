# tk CLI

## Goals

Expose tk domain behavior through the public CLI. Define exact inputs, defaults, results, errors, and process boundaries without requiring a particular implementation language.

## Public surface

### Context

The CLI form is `tk [global-options] <command> [command-options]`. Global `--cwd <path>` selects the project-discovery starting point; `--output <text|json>` defaults to `text`. `--actor` belongs only to update, log, and rename, not to global options.

Explicit `--cwd` takes precedence over the runtime process directory. Relative cwd resolves from that process directory. An absolute Task or material path may locate its own project.

An exact `task_ref` is a full canonical UUIDv7, absolute discovered Task directory, absolute managed carrier, or current-project-relative discovered Task path. Names, basenames, prefixes, substrings, regular expressions, and material paths are not exact references. Reads and modifications resolve exactly one Task; fuzzy input first needs search.

Actor is optional on update, log, and rename and defaults to `cli`. Agents explicitly supply available model or Harness identity where attribution matters. Actor is attribution, never proof of user confirmation. `--user-confirmed` defaults to true; callers must pass actual authorization rather than exploit the default.

JSON arguments require object roots and reject duplicate keys at every depth. Child Task items reject unknown fields. Command options below are optional unless marked required.

### Search

- Required `query`: non-empty string.
- `--regex`: boolean flag, default false. Regex uses Rust-compatible syntax.
- `--search-body`: boolean flag, default false. Only true includes body in text or regex matching; false does not read body.
- Repeatable `--status`: `planning`, `open`, or `closed`; omitted means all.
- `--extra`: object, default empty; top-level entries use AND and full-value comparison.
- `--limit`: integer from 1 to 100, default 20.

Interpret the query once, in this precedence: full UUID or explicit Task path; existing ordinary path as material path; regex when enabled; otherwise name text and, when enabled, body text. Do not fall back after classification. Hyphen-free hexadecimal UUID prefixes of at least eight digits are supported only by search.

Results sort by match class, then descending `created_at`, then ascending ID. Each item contains `id`, `name`, `status`, `created_at`, `task_dir`, string `match` equal to `uuid`, `path`, `regex`, or `string`, and `closed_ancestors`. IDs and discovered paths supply exact references. The result contains `items` and a `truncated` flag for bounded search results. Invalid marked carriers do not appear as Tasks. Necessary discovery failures fail the request, not return a partial graph.

### Read

- Required `task_ref`: exact reference.
- `--view`: `minimal`, `summary`, or `detailed`, default `summary`.
- `--wal-max-entries`: integer from 0 to 50.
- `--wal-max-length`: integer from 0 to 16000 bytes.

The result's `task` contains managed metadata and `task_dir`. `minimal` omits `body` and `wal` without reading either. `summary` returns the entire Task body in `body` and selected entries in `wal.entries`, each with `timestamp`, `actor`, and `message`. `detailed` additionally returns available entry `body` values. Non-empty `wal.warnings` contains read issues with `code`, `message`, and `path`; an empty warning list is omitted.

| View | Default WAL entries | Default WAL bytes |
| --- | ---: | ---: |
| summary | 5 | 4000 |
| detailed | 50 | 16000 |

Minimal does not use WAL budgets. For other views, measure each entry's compact JSON UTF-8 size after the view projection. Select complete entries from newest to oldest within both budgets, then return them in chronological order. Omitted history produces no truncation field, warning, or diagnostic. There is no pagination or full-history read mode; the complete persisted WAL remains readable as ordinary files.

### Create

`tk create task` requires non-empty `name`. It accepts `--status` as `planning` or `open`, default open; optional RFC3339 `--created-at`; repeatable `--depends-on` and `--related-to` same-root UUIDs, default empty; `--extra`, default empty object; and `--user-confirmed`, default true.

`tk create subtask` requires an exact `parent_ref` and 1 to 50 repeatable `--item` JSON objects. Each item requires `name` and accepts `status`, `created_at`, `depends_on`, `related_to`, and `extra` with the same types and defaults as top-level creation. It accepts `--user-confirmed`, default true. Neither command accepts body input, and child items reject `body`.

Creation results identify created Task references in `data.created` and whether changes committed. Partial child creation identifies completed and remaining items. Creation policy, lifecycle, retry matching, numbering, and initial body retain the shared data requirements.

### Update

Required `task_ref` selects the target. Optional inputs are:

- Repeatable `--depends-on-add`, `--depends-on-remove`, `--related-to-add`, `--related-to-remove`: non-empty exact relationship references.
- `--extra-set`: object; repeatable `--extra-remove`: top-level keys.
- `--start`: boolean flag, default false.
- `--close`: non-empty reason string.
- `--reopen`: non-empty reason string.
- `--force`: boolean flag, default false, valid only with close.
- `--user-confirmed`: boolean, default true.
- `--actor`: non-empty attribution string.

At most one lifecycle action may be requested. Close and reopen carry the reason as their option value. A no-op returns `changed:false`. Metadata commits before automatic WAL append; append failure is a warning, not a rollback.

### Log

Requires `task_ref` and a non-empty single-line `--message`. Accepts optional Markdown `--body` and non-empty `--actor`. It appends one WAL event to a non-closed Task without changing metadata.

### CLI commands

The following forms define the public options. Repeatable options are marked `...`. Ordinary project commands accept global options; component operations reject `--cwd`.

```text
tk search <query> [--regex] [--search-body]
  [--status <planning|open|closed>]... [--extra <object-json>] [--limit <n>]
tk read <task_ref> [--view <minimal|summary|detailed>]
  [--wal-max-entries <n>] [--wal-max-length <bytes>]
tk create task <name> [--status <planning|open>] [--created-at <rfc3339>]
  [--depends-on <uuid>]... [--related-to <uuid>]... [--extra <object-json>]
  [--user-confirmed <true|false>]
tk create subtask <parent_ref> --item <object-json> [--item <object-json>]...
  [--user-confirmed <true|false>]
tk update <task_ref>
  [--depends-on-add <uuid>]... [--depends-on-remove <uuid>]...
  [--related-to-add <uuid>]... [--related-to-remove <uuid>]...
  [--extra-set <object-json>] [--extra-remove <key>]...
  [--start | --close <reason> | --reopen <reason>]
  [--force] [--user-confirmed <true|false>] [--actor <text>]
tk log <task_ref> --message <text> [--body <markdown>] [--actor <text>]
tk init [--task-root <path>] [--subtasks-dir <path>]
  [--git-policy <track|ignore|none>] [--creation-policy <strict|permissive>]
  [--metadata-mode <split|embed>] [--force]
tk check
tk rename <task_ref> <name> [--dry-run] [--ignore-brokenlinks] [--actor <text>]
tk gc [--dry-run]
tk metadata migrate [--file <path>]... [--to <schema-version>] [--dry-run]
tk metadata switch --to <split|embed> [--dry-run]
tk install --harness <codex|claude|pi|omp>
  [--language <en|zh>] [--dry-run] [--output <text|json>]
tk install --skill-root <directory>
  [--language <en|zh>] [--dry-run] [--output <text|json>]
tk uninstall --harness <codex|claude|pi|omp> [--dry-run] [--output <text|json>]
tk uninstall --skill-root <directory> [--dry-run] [--output <text|json>]
tk [--output <text|json>] --version
tk --help
tk <command> --help
tk <command> <subcommand> --help
```

Create rejects `--body`. Unknown commands and options are errors. Help reports the current level's usage, arguments, defaults, and subcommands.

Metadata migrate selects every discovered current-project carrier when `--file` is absent. Explicit values must be managed `tk.toml` or embed `TASK.md` carriers in that project, not directories, IDs, material paths, or globs. The default target is the current supported schema. Switch selects the whole project.

Rename results include raw old name, resolved parent path when present, old path, normalized new name, absolute target path, and every old-path Markdown reference with its line. Dry-run text shows `Old path:`, `New name:`, and `Target path:`. Every execution result shows the target path; no-op text shows `No changes` and `Target path:`. Non-empty references append `References to the old path:` and every `path:line`; that section is absent when none exist.

### Results

Ordinary JSON success is `{"ok":true,"data":...}`. Expected failure is `{"ok":false,"error":{"code":...,"category":...,"message":...,"details":...}}`. A non-empty optional `warnings` array carries `code`, `message`, and optional `details`. Empty warnings are omitted. Human-readable message wording is not a machine-branching contract.

Mutation results report `changed`, `committed`, affected references or paths, and multi-target `completed` and `uncompleted` where applicable. `partial_commit` details include completed targets, uncompleted targets, and the original I/O error. They contain no rollback or resume token. Panics, killed processes, malformed output, and interrupted process I/O are not fabricated domain failures.

Text conveys the same facts as JSON, but its layout is not a machine contract except for the rename labels above. Diagnostics use stderr. Non-terminal output has no color. Version uses its own stdout payload rather than an ordinary result envelope.

| Exit | Category |
| --- | --- |
| 0 | Success, no change, or success with warnings |
| 2 | Request or syntax |
| 3 | Context, configuration, policy, resolution, managed data, invariant, conflict, compatibility |
| 4 | Storage, partial commit, internal |
| 5 | Required external executable |
| 130 | Cancellation before first persistent write |

Stable error categories and representative codes are:

| Category | Codes |
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

### Versions

Version works without a project and succeeds with exit 0. Its JSON reports the running executable's release as `runtime_version`, plus these independent contract versions:

| Field | Version |
| --- | ---: |
| `cli_contract_version` | 4 |
| `task_schema_version` | 1 |
| `component_format_version` | 5 |

Skill distribution declares runtime compatibility `>=0.1,<0.2`. Runtime releases change independently of these contract dimensions.

## Invariants

Subprocess stdout and stderr each have a 1,048,576-byte limit. Process failures, malformed output, output-limit failures, and cancellation remain distinct from valid domain failures.

## Acceptance criteria

- Current command names, options, defaults, JSON object roots, and child item fields are preserved. Unknown item fields, duplicate JSON keys, and unsupported options fail rather than disappearing.
- Search classification never falls back, default search includes all states, results have stable ordering and bounded count, and `search_body=false` does not read body.
- Read returns full body in summary and detailed, no body/WAL I/O in minimal, and whole projected WAL entries within the specified budgets without invented history diagnostics.
- Confirmation defaults to true while callers pass actual authorization. Actor appears only on supported WAL-writing operations.
- Domain errors remain inspectable results. Process, output-limit, and cancellation failures remain distinct.
- CLI output, exit classes, version dimensions, rename labels, dry-run behavior, and component selection defaults match the public contract.
