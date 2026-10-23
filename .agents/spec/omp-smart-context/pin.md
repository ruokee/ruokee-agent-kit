# Pin

## Goals

Carry accepted text verbatim in later ordinary requests on the current session branch, across committed compaction, until update, deletion, or reset. Retained text gains no instruction authority, restores no revoked permission, and reopens no completed work.

## Out of scope

Reading files or URLs for the caller, watching content, parsing arbitrary prose into operations, automatic Pin maintenance, migrating unsupported formats, a second store, private host save methods, saving through another session, or an extra model turn to force persistence.

## Public surface

`pinEnabled` is an independent boolean, default `false`. OMP project settings override user settings; changes require restart. Disabled or invalid Pin exposes no tool or command and adds no retained-text projection, while preserving the journal and ordinary history. Enabled Pin acts once from the current session context. Re-enabling restores supported records without conversion. OMP retains its separate `/pin` command. `/smart-context` reports Pin's effective state and fixed inactive reason.

### User command

`/ctx-pin` opens the current branch's themed, width-aware host selection list: add item, entries in creation order, then close. Rows show `#<id>` and a whitespace-folded body prefix, truncated with an ellipsis to available width. An invisible body displays only its id. Viewing or editing drafts is read only, sends no message, changes no state, and does not interrupt a running turn. Abandoning a draft has no effect. Confirmation closes the list.

An existing entry offers viewing, editing, unpinning, and returning to the list. Editing replaces the current body only on confirmation; unpinning also requires confirmation. A headless invocation explains that the interactive OMP interface is required, without changing state.

`/ctx-pin add <body>` preserves every character after `add` and one separating space. Perform no shell splitting, quote handling, unescaping, or whitespace normalization. Missing body or unknown subcommand reports usage and sends nothing.

### Agent tool

`ctx_pin` has six actions:

- `list`: no action-specific input; return every entry's id, creation source, revision, and UTF-8 size, without bodies.
- `get`: integer `id`; return one complete body and its metadata.
- `show`: no action-specific input; return every complete active body with id, source, revision, and UTF-8 size, plus entry count, total active bytes, and branch limit. An empty branch states that no body is pinned and reports zero active bytes and the branch limit.
- `create`: `content`; create a new entry.
- `update`: integer `id` and `content`; replace the current entry body.
- `delete`: integer `id`; unpin the current entry.

`content` must be a non-empty string and is kept exactly.

Accept positive integer ids, not digit strings. No implicit upsert, rename-to-create, revision parameter, or revision admission check. Displayed revisions remain informative; an old draft can overwrite a newer body. User-created entries have source `user`, tool-created entries source `agent`; updates preserve creation source.

All actions declare approval level `read`. With no explicit per-tool policy, `always-ask`, `write`, and `yolo` do not prompt. Explicit `prompt` or `deny` policy still applies. Add no authorization gate or configuration write. Retain type, existence, capacity, and record-integrity checks.

### Agent guidance

The tool description directs the Agent to pin information proactively when its loss would change later action, while honoring explicit pinning requirements. Judge content by its current use rather than its format. Keep recovery pointers and completion facts that prevent repeated work. Skip easily recovered or short-lived facts unless explicitly required.

Relevant information includes decisions, permissions, restrictions, roles, destinations, recovery pointers, conclusions, and blockers. Separate independently changing topics; update an existing topic instead of duplicating it, including user-confirmed pins.

Use `update` for a still-useful topic whose facts change, preserving valid content while removing obsolete parts. Use `delete` for a wholly obsolete, superseded, or duplicate entry, rather than retain a summary of irrelevant history. The extension leaves these choices to the Agent and adds no automatic maintenance or content-based rejection.

Updates replace the complete body. Preserve still-valid facts, conditions, sequence, negation, exceptions, uncertainty, obligations, and protected quotations. A new candidate grants no permission and settles no unresolved condition. Correct revoked permissions and invalid destinations before acting; retain recovery-relevant state before waiting or yielding. Routine reads, unchanged state, or compaction alone require no write. References are recovery pointers, not automatic file reads.

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

Reads, refusals, and unchanged updates append no record or new projection. An accepted retry returns its original result even if the entry was later deleted; it neither repeats a write nor restores an old body. Reuse of an operation identity with another action, entry target, source, or body is a conflict, not a retry. Public retry recognition does not compare revisions. Replaying an identical canonical record has no effect.

Entry and operation ids are positive safe integers, increase across the whole session, may have gaps, and are never reused after deletion, reset, branch changes, or restoration. Pending reservations and host-held records count toward already-used identities. Another branch's identities reserve numbers but do not apply its bodies, receipts, or operations to the current branch. Unreliable allocation, unreadable identity evidence, or safe-integer overflow is an explicit error, never a numbering restart or wraparound.

### User submission

A confirmed write submits an ordinary user message containing only the draft body verbatim. It is pending until the host consumes the message and validates its recorded submission: matching text, session, Pin period, branch, and existing addressed entry. Only this process's held submission is eligible; edited messages, quotations, other processes, restored history, and previously consumed text are ordinary text.

One submission applies to one message, and a message to at most one submission. A matching message consumed before confirmation is ineligible; host-reported consumption time takes precedence when available. Equal text repeated while a draft is still pending can count as that draft, an accepted cost of a readable user message.

After a later post-confirmation user message matches no pending submission, abandon submissions whose text never ran. A session start, switch, or shutdown drops unapplied work and reports a UI notice when possible. A final refusal stays final after returning to a branch or freeing capacity. An unreadable range is not a final result and can be applied when later readable. Once settled, the original text becomes ordinary history and is not applied twice.

Apply the accepted state only when consumed. Until the host journals the user message, express the body in that request alone: do not repeat it or queue an Agent change projection. A consumed user write gets one body-free result immediately after its operation message, reporting accepted, unchanged, or not applied with reason and entry id. Deliver the same result in the host's non-initiating mode, with no new turn or persistence claim. Position one byte-identical result there in every applicable request, even if a later branch copy exists. Report each operation/outcome once until branch or session changes; a new reason can produce a new result. Keep at most 16 unpersisted pending results, dropping the oldest first.

### Agent delivery

An accepted Agent write adds its canonical record and delivers `omp-context-pin-change` through the host's non-initiating mode without starting a model turn. Every ordinary request reflects the current branch's accepted state. After navigation or a period change, accepted changes not yet represented must become visible again. Exclude projections of operations never accepted on this branch even when entry and revision numbers match. Preserve accepted branch copies.

Projected changes preserve journal order, including when an earlier change is missing and later changes are already present. Each missing or reordered suffix appears once, without superseded duplicate carriers. A restored change follows its producing tool result when present; otherwise it occupies its journal position before a later change carrier, or the tail when neither exists. Never place an old revision after the latest body. User messages retain their native positions and are not duplicated as Agent change messages. `omp-context-pin-result` messages contain no Pin state and do not affect replay.

### Capacity

Both one body and all active bodies on one branch are limited to `16,384` UTF-8 bytes. Enforce before mutation at both entry points. A refusal changes nothing. Total-capacity refusal reports branch total, replaced-body bytes or zero for create, proposed-body bytes, attempted total, and excess. Per-entry refusal reports body size, entry limit, and excess. Both require reviewing the whole active set; splitting identical text does not reduce total bytes. Reads and deletion remain available when over capacity.

The limits count bytes, not characters or tokens. Metadata, tool history, and old revisions are outside the active-body limit, so the complete model request can still exceed its own capacity.

Refusals include no active-entry previews. Entry-limit guidance requires shortening that body, not deleting other entries. Branch-limit guidance requires deleting obsolete entries, removing obsolete parts from still-useful entries, and condensing redundant text before retrying. Both preserve valid facts, requirements, and required verbatim text. When necessary content cannot fit without loss, explain the capacity conflict and stop that write rather than discard it. Guidance must not invite repeated shortening without whole-set review.

### Lifecycle

`/new` creates an independent session and numbering. Successful `/clear` ends the branch's Pin period without lowering session-wide numbering. `/fresh` rotates Provider stream state but retains local history and pins. Switch, branch navigation, `/tree`, and restart replay the current branch's period. A retry from a reset period returns its recorded outcome, not a new operation.

Only committed compaction adds a base snapshot of the current active bodies. It appears after the matching summary, otherwise after the last summary, otherwise at request head. Without a new committed boundary, retain the existing snapshot. Unchanged effective state yields byte-identical snapshot text. Remove only this extension's superseded change messages; native user messages and opaque history may still contain identical or older text. Tool definitions and schemas do not vary with entries. Reads and unchanged updates leave records and published projections alone, though their ordinary tool calls and results still extend history.

Unknown, damaged, or invalid records make the affected active range unavailable. Preserve the records, refuse writes and new snapshots/changes, and report the first range/reason once in host logs and UI when present. String-identity records are unsupported, not converted. Reset excludes damage in an earlier period from current bodies; identities recovered before the damaged point remain retired and accepted retries remain known. Identities after that point are unknown, so an unrecognized repeat is treated as new. Damage in the active period stops that range. Recovery is a new session or reset, not silent repair.

### Persistence

The host owns session-file creation and flushing. Appending a record is not confirmation of disk persistence. On the maintained 18.5.0 host, writing occurs when explicitly requested, when the file already exists, or after an assistant reply exists; a newly unsaved session can lose pins on exit. A journal the host saves supports cross-process replay; an in-memory-only journal does not. State this risk in the dialog and tool description. Never force a save or claim one without host confirmation.

## Acceptance criteria

- Default-off, explicit-off, and invalid settings expose no Pin tool, command, or new projection, preserve records/history, and leave other capabilities working.
- Six actions, user confirmation, source retention, current-entry updates, retry-before-lookup, complete reads, numbering, refusal details, and unchanged-state behavior match the contract.
- The tool description distinguishes proactive pinning, updates, deletion, and correct non-action by information use. Capacity guidance addresses the actual limit without sacrificing valid information or repeating active-entry previews.
- Pending, cancelled, edited, restored, repeated, and branch-switched user messages apply only when eligible. Agent writes start no turn; accepted retries append nothing and cannot restore stale state.
- Reset, branch replay, supported V2 records, damage, capacity, and persistence limits remain intact. Final requests after committed compaction carry the latest body verbatim without stale ordering or duplicate projections.
