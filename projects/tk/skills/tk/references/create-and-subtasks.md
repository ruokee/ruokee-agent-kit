# Create Tasks and subtasks

## Choose status and authorization

A strict project requires current explicit user confirmation before creating a top-level Task.

A permissive project allows creation for work worth preserving without treating creation as an execution commitment:

- use `planning` only when the user clearly wants to preserve an idea, investigation, or plan that is still forming;
- use `open` when the work is being handled.

Report the created name, status, and path in the same response. Set `user_confirmed` to the current conversation fact, never to the outcome you want.

## Name and body

Use a short name that describes the whole effort. Keep dates, filenames, Harness names, implementation detail, and acceptance steps in `TASK.md` or ordinary material.

If body is omitted, the runtime creates a heading. Supply `created_at` only for historical work with a known timezone-aware original timestamp.

Relationships use UUIDs in the same Task root. `extra` must be representable without loss in JSON and TOML.

## Child Tasks

Create child Tasks only under a non-closed parent. Do not reopen a parent implicitly.

A batch contains 1 to 50 independent real work units under one parent. Validate names, status, relationships, paths, and conflicts before the first write. The runtime commits in input order.

If an error or cancellation occurs after some children are created, inspect `completed` and `uncompleted`. The runtime does not roll back or issue a continuation token. A new identical request may skip children that already exist with matching content.

## CLI forms

```sh
tk create task <name> [--status planning|open]
tk create subtask <parent_ref> --item '<json>' [--item '<json>']... [--user-confirmed true|false]
```

Direct CLI creation defaults `--user-confirmed` to true because running the command is the user's explicit action. MCP and native callers must pass the actual authorization state.
