# Relations and lifecycle

## Relationships

`depends_on` and `related_to` contain UUIDs from the same Task root. The runtime sorts and deduplicates them.

A Task cannot reference itself. `depends_on` must remain acyclic. `related_to` has no dependency ordering semantics.

Use update fields to add or remove relationships. Do not edit carriers directly.

## Lifecycle states

- `planning` preserves an idea, investigation, or plan that is still forming.
- `open` means the effort is being handled.
- `closed` means the effort ended. It may be completed, abandoned, infeasible, or superseded.

Status is not priority.

## Start

`planning` may move to `open`. The runtime appends the lifecycle WAL event.

## Close

Closing planning or open work requires:

- a non-empty reason;
- current explicit user confirmation;
- all descendants closed;
- all dependency targets closed.

Before asking, verify that the work ended, `TASK.md` states the current result, and durable evidence has been logged.

Force close bypasses only descendant and dependency checks. It does not bypass authorization, reason, schema, path, Git, or relationship validation. Use it only when the user explicitly requests that bypass.

## Reopen

Reopening requires a non-empty reason, current explicit confirmation, and no closed ancestor. Do not reopen because a session ended or new related work appeared. New work normally belongs in a related open Task outside the closed tree.

Closed Tasks remain readable through read, search, and check, but reject ordinary modification and WAL logging.

Lifecycle operations append their own mechanical WAL events. Do not duplicate those events with log.
