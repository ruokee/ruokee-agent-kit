# Pin

English | [中文](./pin.zh.md)

## Goals

Carry accepted text verbatim in later ordinary requests on the current session branch, across committed compaction, until update, deletion, or reset. Retained text gains no instruction authority, restores no revoked permission, and reopens no completed work.

## Out of scope

Reading files or URLs for the caller, watching content, parsing arbitrary prose into operations, automatic Pin maintenance, migrating unsupported formats, a second store, private host save methods, saving through another session, or an extra model turn to force persistence.

## Public surface

`pinEnabled` is an independent boolean, default `false`, using the [package activation snapshot](./README.md#configuration). Disabled or invalid Pin registers no tool, command, or projection handler and preserves existing journal and ordinary history. Enabled Pin installs once and initializes from the current session context. Re-enabling replays supported records without conversion. OMP retains its own `/pin` command.

### User command

`/ctx-pin` opens the current branch's themed, width-aware host selection list: add item, entries in creation order, then close. Rows show `#<id>` and a whitespace-folded body prefix, truncated with an ellipsis to available width. An invisible body displays only its id. Viewing or editing drafts is read only, sends no message, changes no state, and does not interrupt a running turn. Abandoning a draft has no effect. Confirmation closes the list.

`/ctx-pin add <body>` preserves every character after `add` and one separating space. Perform no shell splitting, quote handling, unescaping, or whitespace normalization. Missing body or unknown subcommand reports usage and sends nothing.

### Agent tool

`ctx_pin` has six actions:

- `list`: no action-specific input; return every entry's id, creation source, revision, and UTF-8 size, without bodies.
- `get`: integer `id`; return one complete body and its metadata.
- `show`: no action-specific input; return every complete active body and metadata, plus entry count, total active bytes, and branch limit. Empty state reports zero.
- `create`: `content`; create a new entry.
- `update`: integer `id` and `content`; replace the current entry body.
- `delete`: integer `id`; unpin the current entry.

`content` must be a non-empty string and is kept exactly.

Accept positive integer ids, not digit strings. No implicit upsert, rename-to-create, revision parameter, or revision admission check. Displayed revisions remain informative; an old draft can overwrite a newer body. User-created entries have source `user`, tool-created entries source `agent`; updates preserve creation source.

All actions declare approval level `read`. With no explicit per-tool policy, `always-ask`, `write`, and `yolo` do not prompt. Explicit `prompt` or `deny` policy still applies. Add no authorization gate or configuration write. Retain type, existence, capacity, and record-integrity checks.

## Invariants

### Canonical records

The current branch's host journal is authoritative. Use custom type `omp-context-pin`, schema version `2`, and these payload fields:

- `schemaVersion`: `2`.
- `operationId`: positive integer per user submission or new Agent write, reused across retries, internal and absent from public listings/messages/results.
- `action`: `create`, `update`, or `delete`.
- `entryId`: positive session-wide integer allocated on first successful create, never reused.
- `revision`: starts at 1; increments once per accepted update or delete.
- `body`: complete new text for create/update, absent for delete.
- `source`: `user` or `agent`.
- `toolCallId`: host call identity for an Agent operation's retry recognition.

Reads, refusals, and unchanged updates append no record or new projection. Resolve an accepted retry before current-entry lookup, return its original result, and do not repeat the write or restore an old body. Conflicting reuse of operation identity is damage, not a retry. The same operation under the same revision is a replay no-op.

Restore allocation high-water marks from the whole session's public entries, including pending reservations and host-held carriers/results. This scan allocates numbers only; never apply another branch's bodies, receipts, or operations. Entry and operation ids move forward, may have gaps, and remain retired after deletion or reset. Unreliable allocation, unreadable entries, or safe-integer overflow is an explicit error, never restart or wraparound. Keep no pre-18.5.0 member probes, `getEntries` capability probe, or timestamp-free message-count fallback.

### User submission

A confirmed write submits an ordinary user message containing only the draft body verbatim. It is pending until the host consumes the message and validates its recorded submission: matching text, session, Pin period, branch, and existing addressed entry. Only this process's held submission is eligible; edited messages, quotations, other processes, restored history, and previously consumed text are ordinary text.

Claim one message per submission and at most one submission per message. Record confirmation time; a matching message consumed before it is ineligible. Prefer the host-reported consumption timestamp when available. Equal text repeated while a draft is still held can be claimed as that draft, an accepted cost of a readable user message.

After a later post-confirmation user message matches no pending submission, abandon submissions whose text never ran. A session start, switch, or shutdown drops unapplied work and reports a UI notice when possible. A final refusal stays final after returning to a branch or freeing capacity. An unreadable range is not a final result and can be applied when later readable. Once settled, the original text becomes ordinary history and is not applied twice.

Apply the accepted state only when consumed. Until the host journals the user message, express the body in that request alone: do not repeat it or queue an Agent change projection. A consumed user write gets one body-free result immediately after its operation message, reporting accepted, unchanged, or not applied with reason and entry id. Deliver the same result in the host's non-initiating mode, with no new turn or persistence claim. Position one byte-identical result there in every applicable request, even if a later branch copy exists. Report each operation/outcome once until branch or session changes; a new reason can produce a new result. Keep at most 16 unpersisted pending results, dropping the oldest first.

### Agent delivery

Agent writes append a canonical record and queue `omp-context-pin-change` through non-initiating host delivery, without a model turn. Each request replays current branch records. Republish changes not shown as published after navigation or period changes. A projection for an operation not accepted on this branch is removed even when entry and revision numbers happen to match. Accepted branch copies stay.

Preserve journal change order. A missing change creates a gap encompassing later changes; project that suffix again in order and remove superseded carriers. Place a restored change after its producing tool result when present, otherwise in journal position before a later change carrier, otherwise at the tail. Never place an old revision after the latest body. Keep user messages in their native positions. User writes use their own message rather than a duplicate change message. Results use `omp-context-pin-result`, carry no Pin state, and are ignored by state replay.

### Capacity

Both one body and all active bodies on one branch are limited to `16,384` UTF-8 bytes. Enforce before mutation at both entry points. A refusal changes nothing. Total-capacity refusal reports branch total, replaced-body bytes or zero for create, proposed-body bytes, attempted total, and excess. Per-entry refusal reports body size, entry limit, and excess. Both require reviewing the whole active set; splitting identical text does not reduce total bytes. Reads and deletion remain available when over capacity.

### Lifecycle

`/new` creates an independent session and numbering. Successful `/clear` ends the branch's Pin period without lowering session-wide numbering. `/fresh` rotates Provider stream state but retains local history and pins. Switch, branch navigation, `/tree`, and restart replay the current branch's period. A retry from a reset period returns its recorded outcome, not a new operation.

Only a committed compaction boundary creates a base snapshot from active bodies. Place it after its matching summary, otherwise after the last summary, otherwise at request head. Without a newer boundary retain the existing snapshot. Unchanged effective state produces byte-identical snapshot text. Remove only this extension's change messages; native user messages or opaque history can still contain the same or earlier body. Tool definitions and schemas do not depend on current entries. Reads and unchanged updates leave records and published projections alone, though ordinary tool calls/results still extend history.

Unknown, damaged, or invalid records make the affected active range unavailable. Preserve the records, refuse writes and new snapshots/changes, and report the first range/reason once in host logs and UI when present. String-identity records are unsupported, not converted. Reset excludes damage in an earlier period from current bodies; identities recovered before the damaged point remain retired and accepted retries remain known. Identities after that point are unknown, so an unrecognized repeat is treated as new. Damage in the active period stops that range. Recovery is a new session or reset, not silent repair.

### Persistence

The host owns session-file creation and flushing. Appending a record is not confirmation of disk persistence. On the maintained 18.5.0 host, writing occurs when explicitly requested, when the file already exists, or after an assistant reply exists; a newly unsaved session can lose pins on exit. A journal the host saves supports cross-process replay; an in-memory-only journal does not. State this risk in the dialog and tool description. Never force a save or claim one without host confirmation.

## Acceptance criteria

- Default-off, explicit-off, and invalid settings expose no Pin tool, command, or new projection, preserve records/history, and leave other capabilities working.
- Six actions, user confirmation, source retention, current-entry updates, retry-before-lookup, complete reads, numbering, refusal details, and unchanged-state behavior match the contract.
- Pending, cancelled, edited, restored, repeated, and branch-switched user messages apply only when eligible. Agent writes start no turn; accepted retries append nothing and cannot restore stale state.
- Reset, branch replay, supported V2 records, damage, capacity, and persistence limits remain intact. Final requests after committed compaction carry the latest body verbatim without stale ordering or duplicate projections.

## Related ADRs

- [Context Pin](../../adr/decision/2026/09/15-omp-context-pin.md)
- [Pin tool contract](../../adr/decision/2026/10/17-context-pin-tool-contract.md)
- [Context package](../../adr/decision/2026/10/12-smart-cache.md)
