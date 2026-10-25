# WAL

Read this file when deciding what to record, reading older history, correcting an activity record, or handling a WAL append warning.

## Purpose

WAL records facts about Task activity. It is not current state, chat history, or a command transcript. `TASK.md` states current facts; WAL preserves the order in which facts formed.

Record user decisions and corrections, meaningful external edits, findings from exploration or analysis, verified conclusions, recoverable milestones, verification results, verified collaboration results, problems found during execution, and blockers that change the next step. Do not record routine reads, command transcripts, temporary plans, progress, drafts, unverified guesses, or lifecycle events already written by the runtime.

## Format

WAL is runtime-owned, append-only Markdown. An entry has a timezone-aware RFC 3339 timestamp, actor, and non-empty single-line message, followed by an optional body. Callers do not append directly, rewrite, sort, or delete entries.

Actor is single-line attribution. It is not identity, authentication, ownership, or authorization. Use the most specific current model or invocation-channel information available. Use a stable channel-level value when no reliable detail exists.

## Reading

`minimal`, `summary`, and `detailed` are `tk read` views. `minimal` does not read WAL. `summary` returns recent WAL entries without their bodies. `detailed` includes bodies within its selected entry and byte budgets.

Bounded reads silently omit older entries. Read daily WAL files directly when older or complete history is required. Do not read all history by default for completeness, and do not recursively read related Tasks' WAL.

## Automatic entries

Updates, lifecycle transitions, and rename append WAL after metadata commits. Do not add a synonymous manual entry when the automatic entry already describes the event.

If metadata commits but WAL append fails, the result includes a `wal_append_failed` warning and does not roll back metadata.

Recovery:

1. Read the Task and confirm whether metadata changed.
2. Check recent WAL for the same event.
3. Append one concise repair entry only when the event is missing.
4. Do not repeat the update, rename, or lifecycle operation.

A `closed` Task rejects new WAL. If a repair event can be established only after closure, record it in a related open Task or an external maintenance record. Do not reopen only to write a log entry.
