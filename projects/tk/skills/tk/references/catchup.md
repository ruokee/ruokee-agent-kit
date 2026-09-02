# Catch up on a Task

Use this reference when the user asks for catchup, handoff context, or a summary of an existing Task.

## Resolve first

A full UUIDv7 or exact Task path can be read directly. A name, UUID prefix, branch clue, text, regex, or material path must go through search. If several candidates remain plausible, show them and ask the user to choose.

Start with `view = "summary"`. Use metadata when only managed state matters. Use detailed only when the full body or bounded WAL is needed. Detailed reads use `wal_max_entries` and `wal_max_length`; report truncation rather than copying old WAL into `TASK.md`.

## Reconstruct current context

Report:

1. the objective;
2. current status and closed ancestors;
3. constraints and decisions that still apply;
4. dependencies and related work that affect the next action;
5. blockers and unresolved questions;
6. material entry points;
7. the next concrete action.

Treat `TASK.md` as current truth and WAL as historical evidence. A later correction overrides an earlier WAL entry. Do not treat volatile old plans as current merely because they were logged.

Read ordinary material incrementally from links in `TASK.md` or a directory README. Do not recursively enumerate the whole Task directory.

## Read-only boundary

Catchup itself does not create, update, log, rename, migrate, close, reopen, or edit files. Reading a closed Task is not authorization to reopen it.

If the user also requested follow-up work, complete the catchup and then continue under the normal creation, update, logging, and authorization rules.
