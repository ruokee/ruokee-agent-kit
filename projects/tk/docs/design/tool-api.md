# Tool API

[简体中文](./tool-api.zh.md)

This document defines the six logical tools, their MCP and native names, request fields, result structures, and stable errors. CLI spellings and exit codes are defined in the [CLI reference](./cli-reference.md).

## Tool names

| Logical operation | MCP name | Pi and OMP native name |
| --- | --- | --- |
| Search | `search` | `tk_search` |
| Read | `read` | `tk_read` |
| Create | `create` | `tk_create` |
| Update | `update` | `tk_update` |
| Log | `log` | `tk_log` |
| Run an administrative command | `exec` | `tk_exec` |

The MCP server uses the `tk` namespace. Protocol tool names do not repeat the namespace.

Rust generates the MCP and native schema from the same request types. A Harness must not add fields, change defaults, or duplicate domain validation.

## Common context

The following fields appear as required by each tool:

| Field | Type | Contract |
| --- | --- | --- |
| `cwd` | Optional path | Starting point for project discovery; relative values resolve against the runtime process directory |
| `harness` | Optional enum | Diagnostic context; not persisted |
| Cancellation | Transport signal | Honored before the first write and between multi-target commit points |

actor is not a common context field. It appears only in update, log, and exec rename requests that append to the WAL.

cwd selection follows this order: an explicit request value, the Harness session directory, then the runtime process directory. A full absolute Task path or absolute material path can locate its own project.

## Exact Task references

`task_ref` accepts only:

- A full canonical UUIDv7;
- An absolute discovered Task directory;
- An absolute managed `tk.toml` or `TASK.md` carrier;
- A relative discovered Task path in the current project.

Names, directory basenames, UUID prefixes, substrings, regular expressions, and material paths are not exact references. Reads and modifications must resolve to exactly one Task.

## Unified results

Success:

```json
{"ok":true,"data":{}}
```

Success with warnings:

```json
{
  "ok": true,
  "data": {"changed": true, "committed": true},
  "warnings": [
    {
      "code": "wal_append_failed",
      "message": "Metadata was committed, but the WAL append failed",
      "details": {"task_ref": "019..."}
    }
  ]
}
```

Failure:

```json
{
  "ok": false,
  "error": {
    "code": "task_not_found",
    "category": "resolution",
    "message": "Task not found",
    "details": {"task_ref": "..."}
  }
}
```

The stable fields are `ok`, `data`, `warnings`, `error`, `code`, `category`, `message`, and `details`. Empty warnings are omitted. `message` is for humans and is not a machine-branching contract.

Modification results include the following as needed:

- `changed`: Whether the canonical result changed;
- `committed`: Whether the single change requested by the request was committed;
- `completed`: Targets completed by a multi-target operation;
- `uncompleted`: Targets not completed by a multi-target operation;
- Affected Task references or paths.

The runtime does not fabricate domain error results for panics, transport interruptions, malformed stdout, or killed processes.

## Error categories and stable codes

| Category | Typical error codes |
| --- | --- |
| `request` | `invalid_request`, `invalid_regex` |
| `context` | `project_not_found`, `path_outside_project` |
| `environment` | `runtime_not_installed`, `runtime_not_executable`, `process_start_failed` |
| `configuration` | `invalid_configuration`, `project_not_initialized` |
| `policy` | `authorization_required`, `git_policy_refused` |
| `resolution` | `task_not_found`, `task_ref_ambiguous`, `duplicate_task_id` |
| `managed_file` | `invalid_managed_file`, `unsupported_schema`, `representation_mismatch` |
| `invariant` | `dependency_cycle`, `closed_task_read_only`, `active_descendant`, `active_dependency`, `closed_ancestor` |
| `conflict` | `target_exists`, `operation_in_progress` |
| `storage` | `check_incomplete`, `task_discovery_limit_exceeded`, `wal_append_failed`, `partial_commit` |
| `compatibility` | `runtime_incompatible`, `component_incompatible` |
| `internal` | `internal_error` |

The `details` for `partial_commit` must include `completed`, `uncompleted`, and the original I/O error. It does not provide a rollback or resume token.

## Search

Request:

| Field | Type | Default | Contract |
| --- | --- | --- | --- |
| `query` | Non-empty string | Required | UUID, Task path, material path, name, or text |
| `regex` | Boolean | `false` | Explicitly interpret plain text as a Rust regular expression |
| `search_body` | Boolean | `false` | Include the Task body in string or regular expression matching |
| `status` | Status array | All statuses | A non-empty array narrows results to the specified statuses |
| `extra` | Object | Empty | Top-level values are combined with AND and compared by full value |
| `limit` | Integer | 20 | 1 to 100 |
| `cwd` | Path | Common default | Starting point for project discovery |

The query type is determined once in this order:

1. A full UUID or explicit Task path;
2. An existing ordinary path, treated as a material path;
3. `regex=true`, treated as a regular expression;
4. Otherwise, a name and, when `search_body=true`, Task body text.

There is no fallback after the type is determined. Hyphen-free hexadecimal UUID prefixes of at least 8 digits are used only for search.

Results are sorted first by match class, then within each class by `created_at` descending and ID ascending. Each item includes a Task summary, `match`, `closed_ancestors`, and an exact Task reference. `match` is at least one of `uuid`, `path`, `regex`, or `string`.

The discovery graph may contain every valid Task in the project. Search retains at most the first 100 result items. Invalid marked carriers and similar-looking ordinary files are not returned as Tasks. A required discovery I/O failure or resource-limit error fails the search instead of returning a partial graph.

## Read

Request:

| Field | Default | Contract |
| --- | --- | --- |
| `task_ref` | Required | Exact reference |
| `view` | `summary` | `minimal`, `summary`, or `detailed` |
| `wal_max_entries` | 5 for summary; 50 for detailed | 0 to 50; unused by minimal |
| `wal_max_length` | 4000 for summary; 16000 for detailed | 0 to 16000 bytes; unused by minimal |
| `cwd` | Common default | Project resolution |

`minimal` returns metadata and managed paths without reading the Task body or WAL. `summary` returns the complete current body and recent WAL entries containing `timestamp`, `actor`, and `message`. `detailed` returns the same Task information and adds each available WAL `body`.

The runtime projects entries for the selected view before measuring their compact JSON UTF-8 size. It selects complete entries from newest to oldest within both budgets, then returns them in chronological order. Entries outside the budgets are silently omitted without a truncation field, warning, or diagnostic. `tk read` has no pagination or full-history mode; read `wal/YYYY-MM-DD.md` directly when complete history is required.

## Create

create uses `oneOf` to distinguish a top-level Task from a batch of child Tasks.

Like every tool input schema, the create union declares `type: "object"` at its root. Each `oneOf` branch keeps its own allowed fields and required discriminator.

Top-level branch:

| Field | Default | Contract |
| --- | --- | --- |
| `type` | Required | `task` |
| `name` | Required | Canonicalizable name |
| `status` | `open` | `planning` or `open` |
| `created_at` | Current time | Provide explicitly only when the original time is known |
| `depends_on` | Empty | Set of same-root UUIDs |
| `related_to` | Empty | Set of same-root UUIDs |
| `extra` | Empty | Structured additional values |
| `user_confirmed` | `false` | Whether the current conversation explicitly authorizes top-level creation |
| `cwd` | Common default | Project resolution |

strict projects require `user_confirmed=true`. permissive projects allow work worth persisting to be created when it is `false`. The calling Agent selects planning or open based on context and reports the creation result.

The runtime automatically generates `# <normalized-name>` as the initial `TASK.md` body when it creates a Task, and it accepts no body input on any create request. Callers write `TASK.md` with ordinary file operations after creation.

Child Task branch:

| Field | Contract |
| --- | --- |
| `type` | `subtasks` |
| `parent_ref` | Exact, non-closed parent Task |
| `subtasks` | 1 to 50 items, each carrying `name`, optional `status` (default `open`), optional `created_at`, `depends_on`, `related_to`, and `extra`; items accept no body field |
| `user_confirmed` | Current conversation authorization for planning child Tasks; defaults to `false` |
| `cwd` | Project resolution |

Open child Tasks do not require new top-level authorization. A batch containing a planning child requires `user_confirmed=true`. All validation completes before the first write in the batch. New children use `NN--slug` under the configured creation directory. Numbering uses all discovered direct children with generated leaf names, takes the largest sequence without filling gaps, and stops at `99`. If creation partially fails, the result returns the created and uncreated items. A retry matches discovered direct children only against the request fields create owns (`name`, `status`, `created_at` when supplied, `depends_on`, `related_to`, `extra`); the body never participates in matching.

## Update

update modifies relationships, `extra`, and at most one lifecycle action:

| Field group | Contract |
| --- | --- |
| Target | `task_ref`, `cwd` |
| Relationships | `depends_on_add/remove`, `related_to_add/remove` |
| extra | `extra_set`, `extra_remove`, processing top-level keys only |
| Lifecycle | At most one of `start`, `close`, or `reopen` |
| Lifecycle parameters | close/reopen require a non-empty `reason` and `user_confirmed=true`; close may use `force` |
| WAL | Optional `actor`, defaulting to the actor of the calling channel |

An empty request or a request with no net result change returns `changed:false`. The runtime automatically appends to the WAL after committing metadata. An append failure is returned as a warning.

## Log

A log request contains `task_ref`, a non-empty single-line `message`, an optional Markdown `body`, an optional `actor`, and `cwd`. It appends one WAL event only to a non-closed Task and does not modify metadata.

## Exec

exec is a low-frequency administrative entry point:

| Field | Contract |
| --- | --- |
| `argv` | Non-empty string array whose first item may only be `--version`, `init`, `check`, or `rename` |
| `cwd` | Command context |
| `actor` | Allowed only when the first item is `rename` |

exec invokes the public command parser directly from argv without using a shell. It rejects search, read, create, update, log, mcp, schema, metadata, gc, install, uninstall, and any other first item.

rename results include the raw old name, the resolved parent Task path when one exists, the old path, the normalized new name, the target path, and every Markdown reference with its line. Full UUIDs, exact Task directories, and exact managed carriers can locate an eligible candidate whose old string name or recognizable generated suffix needs repair. Other validation remains strict. Non-generated child directories remain in place; generated child and top-level paths keep their sequence and update the slug.

The exec rename path follows the same broken-reference behavior as the CLI. An execution that would move the Task path stops with a conflict error before the first write when references to the old path exist. Pass `--ignore-brokenlinks` in argv to move anyway; reference files stay unchanged, and the result still reports them. Dry-run always succeeds after a valid plan is built.

## Transport

After MCP initialize, the server exposes six protocol tools. stdout carries only JSON-RPC, and logs go to stderr. Cancellation maps to the runtime cancellation signal.

Pi and OMP use the generated native schema. The adapter starts the public `tk` process for each call, decodes the unified result, and keeps transport failures separate from domain failures.
