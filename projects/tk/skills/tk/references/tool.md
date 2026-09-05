# Tools

Read this file for exact tool names, request fields, results, cancellation, routing, or tools-mode component commands.

## Logical tools

| Operation | Pi or OMP name | Main input |
| --- | --- | --- |
| `search` | `tk_search` | `query`, `regex`, `search_body`, `status`, `extra`, `limit`, `cwd` |
| `read` | `tk_read` | `task_ref`, `view`, WAL budgets, `cwd` |
| `create` | `tk_create` | Tagged union for a top-level Task or 1..50 subtasks |
| `update` | `tk_update` | Relationship deltas, `extra`, and at most one lifecycle action |
| `log` | `tk_log` | `task_ref`, single-line `message`, optional `body` and `actor` |
| `exec` | `tk_exec` | `argv`, `cwd`, and optional `actor` for `rename` |

MCP uses the same logical names under a service namespace. A Harness must not add fields, change defaults, or duplicate domain validation.

`cwd` selection order is the explicit request value, Harness session directory, then runtime process directory. A relative `cwd` resolves from the runtime directory. `harness` is diagnostic only and is not persisted.

## Common requests

`search` requires a non-empty `query`. `regex` and `search_body` default to `false`; `status` defaults to every status; top-level `extra` conditions use `AND`; `limit` defaults to 20 and allows `1..100`.

`read` defaults to `summary`. `minimal` returns metadata and managed paths without reading body or WAL. `summary` returns the complete Task body and recent WAL entries without bodies, defaulting to 5 entries and 4000 bytes. `detailed` adds WAL bodies and defaults to 50 entries and 16000 bytes. Explicit budgets may range from 0 to the shared maximum of 50 entries and 16000 bytes. Entries outside the budgets are silently omitted.

`create` uses `type=task` or `type=subtasks`. The tool entry point defaults `user_confirmed` to `false`; it must reflect current authorization. `close` and `reopen` updates require a non-empty `reason` and current confirmation. `force` applies only to `close`. An empty update or a net no-op returns `changed=false`.

`log` appends one WAL entry to a Task that is not `closed` and does not change metadata.

## Task names

When the user has not supplied a name, choose one that states the purpose clearly. Prefer a short imperative, phrase, or noun. Do not combine independent work with conjunctions such as `and`.

## Restricted entry point

`exec` does not invoke a shell. The first `argv` item must be one of:

```text
--version
init
check
rename
```

It rejects `search`, `read`, `create`, `update`, `log`, `mcp`, `schema`, `metadata`, `gc`, `install`, `uninstall`, and every other first item. `actor` is accepted only for `rename`.

High-frequency operations with logical tools must use those tools. Use the public CLI for migration, metadata mode switching, GC, `schema generate`, component lifecycle, `help`, and MCP startup.

Do not retry the same operation through the CLI when a logical tool is missing, rejects the request, or fails. Do not modify Harness registration, adapter state, component manifests, or managed data to bypass the failure.

## Results

Success:

```json
{"ok":true,"data":{}}
```

Expected failure:

```json
{"ok":false,"error":{"code":"...","category":"...","message":"...","details":{}}}
```

Stable fields are `ok`, `data`, `warnings`, `error`, `code`, `category`, `message`, and `details`. Mutation results may include `changed`, `committed`, `created`, `completed`, and `uncompleted`. `message` is for people; machines read `code` and `details`.

`ok:true` may include `warnings`. `wal_append_failed` means metadata may already be committed. A panic, killed process, invalid `stdout`, or damaged protocol is a transport failure; the runtime does not fabricate a domain result.

## Cancellation

Cancellation before the first persistent write leaves state unchanged. Once a single-file atomic replacement starts, it finishes that replacement. A multi-target operation observes cancellation between commit points.

Cancellation after a commit returns a partial result with `completed` and `uncompleted`. It does not roll back automatically.

## Components

Components depend on the fixed runtime path `$HOME/.local/bin/tk`. Installation uses only payloads embedded in the executable. It does not use the network or accept a local archive.

```text
tk install --harness <codex|claude|pi|omp>
  [--mode <tools|cli>] [--language <en|zh>]
  [--dry-run] [--output <text|json>]

tk install --mode cli --skill-root <directory>
  [--language <en|zh>] [--dry-run] [--output <text|json>]

tk uninstall --harness <codex|claude|pi|omp>
  [--dry-run] [--output <text|json>]

tk uninstall --skill-root <directory>
  [--dry-run] [--output <text|json>]
```

Exactly one target option is required. Harness install defaults to `tools` and `en`. Custom-root install requires explicit CLI mode and manages only `tk-cli` and `tk-cli-zh` below the supplied root. Uninstall takes no mode or language selector. Use `--dry-run` in an unfamiliar environment. After a partial commit, inspect `completed` and `uncompleted` to establish current state.
