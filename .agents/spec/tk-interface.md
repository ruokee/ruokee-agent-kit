# tk interfaces

## Goals

Expose the same tk domain behavior through the public CLI, stdio MCP, and Pi and OMP native tools. Define exact inputs, defaults, result semantics, errors, and transport boundaries without requiring a particular implementation language.

## Public surface

### Context

The CLI form is `tk [global-options] <command> [command-options]`. Global `--cwd <path>` selects the project-discovery starting point; `--output <text|json>` defaults to `text`. `--actor` belongs only to update, log, and rename, not to global options.

Logical requests use an optional `cwd`. Selection order is explicit request value, Harness session directory, then runtime process directory. Relative cwd resolves from the runtime process directory. An absolute Task or material path may locate its own project.

An exact `task_ref` is a full canonical UUIDv7, absolute discovered Task directory, absolute managed carrier, or current-project-relative discovered Task path. Names, basenames, prefixes, substrings, regular expressions, and material paths are not exact references. Reads and modifications resolve exactly one Task; fuzzy input first needs search.

Actor is optional on update, log, and exec rename. Direct CLI defaults to `cli`; native calls use the current model identity when available, otherwise the Harness identity. Actor is attribution, never proof of user confirmation. Direct CLI `user_confirmed` defaults to true; logical tool inputs default to false. Callers must pass actual authorization and must not exploit channel defaults to fabricate it.

### Logical operations

MCP namespace is `tk`. Protocol tool names do not repeat that namespace.

| Operation | MCP name | Native name |
| --- | --- | --- |
| Search | `search` | `tk_search` |
| Read | `read` | `tk_read` |
| Create | `create` | `tk_create` |
| Update | `update` | `tk_update` |
| Log | `log` | `tk_log` |
| Administration | `exec` | `tk_exec` |

Each tool input schema declares an object root and rejects unknown fields. Create retains its discriminated `oneOf`; a host must not flatten it or change its semantics. All request fields below are optional unless stated as required.

### Search

- Required `query`: non-empty string.
- `regex`: boolean, default false. Plain-text regex queries use Rust-compatible regular-expression syntax.
- `search_body`: boolean, default false. Only true includes body in text or regex matching; false does not read body.
- `status`: array of `planning`, `open`, and `closed`; omitted or empty means all.
- `extra`: object, default empty; top-level entries use AND and full-value comparison.
- `limit`: integer from 1 to 100, default 20.
- `cwd`: project context.

Interpret the query once, in this precedence: full UUID or explicit Task path; existing ordinary path as material path; regex when enabled; otherwise name text and, when enabled, body text. Do not fall back after classification. Hyphen-free hexadecimal UUID prefixes of at least eight digits are supported only by search.

Results sort by match class, then descending `created_at`, then ascending ID. Each item contains `id`, `name`, `status`, `created_at`, `task_dir`, string `match` equal to `uuid`, `path`, `regex`, or `string`, and `closed_ancestors`. IDs and discovered paths supply exact references. The result contains `items` and a `truncated` flag for bounded search results. Invalid marked carriers do not appear as Tasks. Necessary discovery failures fail the request, not return a partial graph.

### Read

- Required `task_ref`: exact reference.
- `view`: `minimal`, `summary`, or `detailed`, default `summary`.
- `wal_max_entries`: integer from 0 to 50.
- `wal_max_length`: integer from 0 to 16000 bytes.
- `cwd`: project context.

The result's `task` contains managed metadata and `task_dir`. `minimal` omits `body` and `wal` without reading either. `summary` returns the entire Task body in `body` and selected entries in `wal.entries`, each with `timestamp`, `actor`, and `message`. `detailed` additionally returns available entry `body` values. Non-empty `wal.warnings` contains read issues with `code`, `message`, and `path`; an empty warning list is omitted.

| View | Default WAL entries | Default WAL bytes |
| --- | ---: | ---: |
| summary | 5 | 4000 |
| detailed | 50 | 16000 |

Minimal does not use WAL budgets. For other views, measure each entry's compact JSON UTF-8 size after the view projection. Select complete entries from newest to oldest within both budgets, then return them in chronological order. Omitted history produces no truncation field, warning, or diagnostic. There is no pagination or full-history read mode; the complete persisted WAL remains readable as ordinary files.

### Create

The top-level branch requires `type:"task"` and non-empty `name`. It accepts `status` as `planning` or `open`, default open; optional `created_at`; `depends_on` and `related_to` arrays of same-root UUIDs, default empty; `extra`, default empty object; `user_confirmed`, default false; and `cwd`.

The child branch requires `type:"subtasks"`, non-empty `parent_ref`, and `subtasks` containing 1 to 50 objects. Each item requires `name` and accepts the same status, timestamp, relationships, and extra fields. The branch accepts `user_confirmed`, default false, and `cwd`. Neither branch nor child item accepts `body`.

Creation results identify created Tasks and whether changes committed. A partial child operation identifies completed and remaining items. Data requirements govern policy, lifecycle, retry matching, numbering, and initial body.

### Update

Required `task_ref` selects the target. Optional fields are:

- `depends_on_add`, `depends_on_remove`, `related_to_add`, `related_to_remove`: arrays of non-empty exact relationship references.
- `extra_set`: object; `extra_remove`: array of top-level keys.
- `start`: boolean, default false.
- `close`: non-empty reason string.
- `reopen`: non-empty reason string.
- `force`: boolean, default false, valid only with close.
- `user_confirmed`: boolean, default false.
- `actor`: non-empty attribution string.
- `cwd`: project context.

At most one lifecycle action may be requested. Close and reopen carry the reason in their own string field, not in a separate `reason` field. A no-op returns `changed:false`. Metadata commits before automatic WAL append; append failure is a warning, not a rollback.

### Log

Requires `task_ref` and non-empty single-line `message`. Accepts optional Markdown `body`, non-empty `actor`, and `cwd`. It appends one WAL event to a non-closed Task without changing metadata.

### Exec

Requires non-empty string array `argv`, with every element non-empty. The first element is exactly one of `--version`, `init`, `check`, or `rename`. Optional context is `cwd`; `actor` is accepted only for rename. Invocation uses argv directly, without a shell. Other first elements are rejected, including domain operations that already have logical tools and unsupported administrative commands.

Exec returns the raw UTF-8 `stdout` and `stderr` strings and `exit_code`, without decoding administrative output into a domain envelope. MCP success returns these three fields directly. Native success returns `{"ok":true,"data":{"exit_code":0,"stdout":...,"stderr":...}}` in text content and structured `details`.

A nonzero exit is a failed Exec call. MCP reports `exec_command_failed` with `exit_code`, `stdout`, and `stderr` in error details; `exit_code` is null when termination supplies no code. Native Exec throws an exception carrying `code`, `stdout`, and `stderr`. Output beyond either stream's 1,048,576-byte limit, process failure, and cancellation do not become successful raw results. MCP also rejects non-UTF-8 output. Rename follows the same exact-target, repair, reference-reporting, and broken-reference rules as direct CLI.

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
tk schema generate --type <mcp|native> [--harness <pi|omp>]
tk mcp
tk install --harness <codex|claude|pi|omp>
  [--mode <tools|cli>] [--language <en|zh>] [--dry-run] [--output <text|json>]
tk install --mode cli --skill-root <directory>
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

Schema generation writes the six-tool contract directly. Type `mcp` rejects a Harness; `native` requires pi or omp. MCP starts a single-connection stdio server, accepts no cwd, actor, or output option, and supports initialization, tool listing, calls, cancellation, and clean shutdown.

Rename results include raw old name, resolved parent path when present, old path, normalized new name, absolute target path, and every old-path Markdown reference with its line. Dry-run text shows `Old path:`, `New name:`, and `Target path:`. Every execution result shows the target path; no-op text shows `No changes` and `Target path:`. Non-empty references append `References to the old path:` and every `path:line`; that section is absent when none exist.

### Results

Ordinary JSON success is `{"ok":true,"data":...}`. Expected failure is `{"ok":false,"error":{"code":...,"category":...,"message":...,"details":...}}`. A non-empty optional `warnings` array carries `code`, `message`, and optional `details`. Empty warnings are omitted. Human-readable message wording is not a machine-branching contract.

Mutation results report `changed`, `committed`, affected references or paths, and multi-target `completed` and `uncompleted` where applicable. `partial_commit` details include completed targets, uncompleted targets, and the original I/O error. They contain no rollback or resume token. Panics, killed processes, malformed output, and transport interruptions are not fabricated domain failures.

Text conveys the same facts as JSON, but its layout is not a machine contract except for the rename labels above. Diagnostics use stderr. Non-terminal output has no color. Schema generation, MCP, and version use their own stdout payloads, not ordinary result envelopes.

| Exit | Category |
| --- | --- |
| 0 | Success, no change, or success with warnings |
| 2 | Request or syntax |
| 3 | Context, configuration, policy, resolution, managed data, invariant, conflict, compatibility |
| 4 | Storage, partial commit, protocol startup, internal |
| 5 | Required external executable |
| 130 | Cancellation before first persistent write |

Stable error categories and representative codes are:

| Category | Codes |
| --- | --- |
| `request` | `invalid_request`, `invalid_regex` |
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
| `cli_contract_version` | 3 |
| `task_schema_version` | 1 |
| `component_format_version` | 4 |

Native contract version is `3`; component-driver contract version is `1`. Native/component runtime compatibility is `>=0.1,<0.2`. Runtime releases change independently of these contract dimensions and host maintenance lower bounds.

## Invariants

MCP stdout contains only JSON-RPC and logs use stderr. Each MCP JSON payload and each subprocess stdout or stderr stream is limited to 1,048,576 bytes. Exceeding a transport limit is a transport failure; no partial frame is sent as a valid result.

Native operations invoke the fixed public runtime directly without a shell and honor cancellation. Ordinary native success and valid domain failure envelopes are returned verbatim in text content and structured `details`. A domain failure's nonzero exit does not turn it into an exception. Malformed envelopes, unexpected exits, process failures, and adapter cancellation remain transport exceptions.

## Acceptance criteria

- All six tools preserve names, fields, defaults, object-root schemas, create union semantics, and Harness-specific fields. Unknown request fields and unsupported CLI options fail rather than disappearing.
- Search classification never falls back, default search includes all states, results have stable ordering and bounded count, and `search_body=false` does not read body.
- Read returns full body in summary and detailed, no body/WAL I/O in minimal, and whole projected WAL entries within the specified budgets without invented history diagnostics.
- Direct CLI and logical tools preserve their distinct confirmation defaults while applying identical domain rules. Actor appears only on supported WAL-writing operations.
- Native domain errors remain inspectable results. Process, output-limit, cancellation, and protocol failures stay distinct. MCP maintains protocol-only stdout and clean shutdown.
- CLI output, exit classes, version dimensions, rename labels, dry-run behavior, and component selection defaults match the public contract.
