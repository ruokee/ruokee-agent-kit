# Tool API

[简体中文](./tool-api.zh.md)

This document defines the six logical tools, their MCP and native names, request fields, result structures, and stable errors. CLI spellings and exit codes are defined in the [CLI reference](./cli-reference.md).

## Tool names

|Logical operation|MCP name|Pi and OMP native name|
|-|-|-|
|Search|`search`|`tk_search`|
|Read|`read`|`tk_read`|
|Create|`create`|`tk_create`|
|Update|`update`|`tk_update`|
|Log|`log`|`tk_log`|
|Run an administrative command|`exec`|`tk_exec`|

The MCP server uses the `tk` namespace. Protocol tool names do not repeat the namespace.

Rust generates the MCP and native schema from the same request types. A Harness must not add fields, change defaults, or duplicate domain validation.

## Common context

The following fields appear as required by each tool:

|Field|Type|Contract|
|-|-|-|
|`cwd`|Optional path|Starting point for project discovery; relative values resolve against the runtime process directory|
|`harness`|Optional enum|Diagnostic context; not persisted|
|Cancellation|Transport signal|Honored before the first write and between multi-target commit points|

actor is not a common context field. It appears only in update, log, and exec rename requests that append to the WAL.

cwd selection follows this order: an explicit request value, the Harness session directory, then the runtime process directory. A full absolute Task path or absolute material path can locate its own project.

## Exact Task references

`task_ref` accepts only:

- A full canonical UUIDv7;
- An absolute Task directory;
- An absolute canonical `tk.toml`;
- An absolute canonical `TASK.md`;
- A relative Task path in the current project.

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

|Category|Typical error codes|
|-|-|
|`request`|`invalid_request`, `invalid_regex`|
|`context`|`project_not_found`, `path_outside_project`|
|`environment`|`runtime_not_installed`, `runtime_not_executable`, `process_start_failed`|
|`configuration`|`invalid_configuration`, `project_not_initialized`|
|`policy`|`authorization_required`, `git_policy_refused`|
|`resolution`|`task_not_found`, `task_ref_ambiguous`, `duplicate_task_id`|
|`managed_file`|`invalid_managed_file`, `unsupported_schema`, `representation_mismatch`|
|`invariant`|`dependency_cycle`, `closed_task_read_only`, `active_descendant`, `active_dependency`, `closed_ancestor`|
|`conflict`|`target_exists`, `operation_in_progress`|
|`storage`|`check_incomplete`, `wal_append_failed`, `partial_commit`|
|`compatibility`|`runtime_incompatible`, `component_incompatible`|
|`internal`|`internal_error`|

The `details` for `partial_commit` must include `completed`, `uncompleted`, and the original I/O error. It does not provide a rollback or resume token.

## Search

Request:

|Field|Type|Default|Contract|
|-|-|-|-|
|`query`|Non-empty string|Required|UUID, Task path, material path, name, or text|
|`regex`|Boolean|`false`|Explicitly interpret plain text as a Rust regular expression|
|`search_body`|Boolean|`false`|Include the Task body in string or regular expression matching|
|`status`|Status array|All statuses|A non-empty array narrows results to the specified statuses|
|`extra`|Object|Empty|Top-level values are combined with AND and compared by full value|
|`limit`|Integer|20|1 to 100|
|`cwd`|Path|Common default|Starting point for project discovery|

The query type is determined once in this order:

1. A full UUID or explicit Task path;
2. An existing ordinary path, treated as a material path;
3. `regex=true`, treated as a regular expression;
4. Otherwise, a name and, when `search_body=true`, Task body text.

There is no fallback after the type is determined. Hyphen-free hexadecimal UUID prefixes of at least 8 digits are used only for search.

Results are sorted first by match class, then within each class by `created_at` descending and ID ascending. Each item includes a Task summary, `match`, `closed_ancestors`, and the canonical Task reference. `match` is at least one of `uuid`, `path`, `regex`, or `string`.

The runtime retains only the bounded candidate set needed to produce the first 100 items. Invalid and similar-looking ordinary files are ignored and are not returned as fabricated Tasks.

## Read

Request:

|Field|Default|Contract|
|-|-|-|
|`task_ref`|Required|Exact reference|
|`view`|`summary`|`metadata`, `summary`, or `detailed`|
|`wal_max_entries`|20|0 to 1000; used only for detailed|
|`wal_max_length`|16384|0 to 1048576 bytes; used only for detailed|
|`cwd`|Common default|Project resolution|

metadata returns metadata and canonical paths. summary adds a body summary, relationship summary, and recent WAL summary. detailed returns the full body and a budget-limited WAL.

## Create

create uses `oneOf` to distinguish a top-level Task from a batch of child Tasks.

Like every tool input schema, the create union declares `type: "object"` at its root. Each `oneOf` branch keeps its own allowed fields and required discriminator.

Top-level branch:

|Field|Default|Contract|
|-|-|-|
|`type`|Required|`task`|
|`name`|Required|Canonicalizable name|
|`body`|Generated heading|UTF-8 Markdown|
|`status`|`open`|`planning` or `open`|
|`created_at`|Current time|Provide explicitly only when the original time is known|
|`depends_on`|Empty|Set of same-root UUIDs|
|`related_to`|Empty|Set of same-root UUIDs|
|`extra`|Empty|Structured additional values|
|`user_confirmed`|`false`|Whether the current conversation explicitly authorizes top-level creation|
|`cwd`|Common default|Project resolution|

strict projects require `user_confirmed=true`. permissive projects allow work worth persisting to be created when it is `false`. The calling Agent selects planning or open based on context and reports the creation result.

Child Task branch:

|Field|Contract|
|-|-|
|`type`|`subtasks`|
|`parent_ref`|Exact, non-closed parent Task|
|`subtasks`|1 to 50 items, each using the Task content fields from the top-level branch|
|`user_confirmed`|Current conversation authorization for planning child Tasks; defaults to `false`|
|`cwd`|Project resolution|

Open child Tasks do not require new top-level authorization. A batch containing a planning child requires `user_confirmed=true`. All validation completes before the first write in the batch. If creation partially fails, the result returns the created and uncreated items. A retry skips child Tasks that already exist with matching content.

## Update

update modifies relationships, `extra`, and at most one lifecycle action:

|Field group|Contract|
|-|-|
|Target|`task_ref`, `cwd`|
|Relationships|`depends_on_add/remove`, `related_to_add/remove`|
|extra|`extra_set`, `extra_remove`, processing top-level keys only|
|Lifecycle|At most one of `start`, `close`, or `reopen`|
|Lifecycle parameters|close/reopen require a non-empty `reason` and `user_confirmed=true`; close may use `force`|
|WAL|Optional `actor`, defaulting to the actor of the calling channel|

An empty request or a request with no net result change returns `changed:false`. The runtime automatically appends to the WAL after committing metadata. An append failure is returned as a warning.

## Log

A log request contains `task_ref`, a non-empty single-line `message`, an optional Markdown `body`, an optional `actor`, and `cwd`. It appends one WAL event only to a non-closed Task and does not modify metadata.

## Exec

exec is a low-frequency administrative entry point:

|Field|Contract|
|-|-|
|`argv`|Non-empty string array whose first item may only be `--version`, `init`, `check`, or `rename`|
|`cwd`|Command context|
|`actor`|Allowed only when the first item is `rename`|

exec invokes the public command parser directly from argv without using a shell. It rejects search, read, create, update, log, mcp, schema, metadata, gc, install, uninstall, and any other first item.

## Transport

After MCP initialize, the server exposes six protocol tools. stdout carries only JSON-RPC, and logs go to stderr. Cancellation maps to the runtime cancellation signal.

Pi and OMP use the generated native schema. The adapter starts the public `tk` process for each call, decodes the unified result, and keeps transport failures separate from domain failures.
