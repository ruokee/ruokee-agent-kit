# Work activity log

## Purpose

WAL is an ordinary append-only Markdown activity log. It records durable events that are not the Task's current state. It is not a transaction log, lock, duplicate detector, authorization record, or domain recovery system.

Each Task stores daily files under `wal/YYYY-MM-DD.md` with entries shaped like:

```markdown
## 2026-08-31T12:34:56+08:00 · actor

Message

Optional body
```

Only a complete RFC 3339 timestamp, separator, and actor line starts an entry. Ordinary H2 text belongs to the preceding body. The format has no escaping or length prefix for body text that happens to look like a complete entry header.

## What to log

Log immediately after a fact becomes durable and before starting another independent branch:

- user decisions and corrections;
- verified findings;
- recoverable milestones;
- validation results;
- verified collaboration results;
- blockers that change what can proceed.

Do not log routine reads, command transcripts, temporary todos, percentages, unverified guesses, or lifecycle events already recorded by the runtime.

Use a non-empty single-line message. Put details in the Markdown body. Keep facts formed at different times in separate entries.

## actor

actor is single-line attribution, not identity, authentication, authorization, or assignment. Only update, log, and rename requests accept it. Prefer the most specific available model or Harness value.

## Failure handling

Metadata commits before an automatic WAL append. If append fails, the metadata stays committed and the result contains a warning.

Read the Task and WAL before retrying. Append only the missing event. Do not repeat the metadata update. Closed Tasks reject new WAL entries.

Detailed reads apply both entry and byte budgets. Treat truncation as a read boundary, not a reason to copy old history into `TASK.md`.
