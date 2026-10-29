# Context Pin

[中文](./pin.zh.md)

Keep selected text in every later ordinary model request on the current session branch, including after compaction. Text stays active until updated, unpinned, or reset. Pinning gives text no extra instruction authority, restores no revoked permission, and does not restart completed work.

## Enable

Set `pinEnabled=true` through [native configuration](../README.md#configuration), then restart OMP. It defaults to `false`. When off, neither `/ctx-pin` nor `ctx_pin` is available and no new Pin text is added. Existing records and history remain; re-enabling restores supported records.

Remove the old standalone Pin registration and any manual path loading it before enabling this capability. See [Migration](./migration.md). OMP's own `/pin` command is separate.

## User command

- `/ctx-pin` opens the current branch's entry list. Choose add, an existing entry, or close. Rows show `#<id>` and a shortened body preview in the host theme.
- `/ctx-pin add <body>` submits the text after `add` and one separating space. All following whitespace and characters are preserved; no shell quoting or unescaping is performed.
- An unknown subcommand or missing body displays usage without sending a message.

Viewing entries and editing drafts are read only. They do not send a message, change Pin state, or interrupt a running turn. Abandoning a draft has no effect; confirmation closes the list.

### Confirmation

A confirmed write sends an ordinary user message containing only the draft body. The write stays pending until OMP consumes that message and the target session, branch, and entry still match. A result reports whether it was accepted, unchanged, or not applied, with the affected entry and reason.

Editing the submitted message makes it ordinary text rather than a Pin operation. Quoted drafts, restored messages, and messages submitted by another process are also ordinary text. While a confirmed draft is still pending, repeating its exact text can be treated as that draft. Switching sessions, restarting, or shutting down before application drops pending work. A write refused after consumption does not later apply when capacity or branch state changes.

## Agent tool

`ctx_pin` provides:

- `list`: read every complete active body with its id, creation source, revision, and UTF-8 size, plus entry count, total active bytes, and branch limit. An empty set reports zero.
- `get`: supply integer `id` to read one complete body and metadata.
- `show`: read every complete active body and metadata, with entry count, total bytes, and branch limit. An empty set reports zero.
- `create`: supply `content` to pin a new body.
- `update`: supply integer `id` and complete replacement `content`.
- `delete`: supply integer `id` to unpin an entry.

`content` must be a non-empty string and is kept exactly.

`get`, `list`, and `show` preserve all whitespace, newlines, and long bodies without truncation. Only the interactive selection labels use shortened previews.

Ids are positive session-wide integers, displayed as `#<id>` and never reused. Digit strings are not accepted. Updates and deletes act on the current entry, with no revision parameter. A displayed revision is informative, so an old draft can overwrite a newer body. Updates preserve the original `user` or `agent` creation source.

Reads and unchanged updates do not change records or active state. Agent writes start no model turn; OMP carries the accepted change into ordinary work. Retrying an already accepted call returns its original result without another write or a stale-body rollback. No action implicitly creates a missing entry.

Every action uses approval level `read`. Without an explicit per-tool policy, `always-ask`, `write`, and `yolo` do not prompt for Pin. Explicit `prompt` or `deny` policy still applies. Pin does not edit user configuration or add a separate authorization check.

### Agent practice

Proactively pin information whose loss would change later action, without waiting for a reminder. Follow explicit pinning requirements; otherwise skip easily recovered facts. Judge information by its use, not its format. Current facts, recovery pointers, and completion reminders belong in Pin while they guide later action or prevent repeated work.

Separate topics that change independently. Update an existing topic rather than create a duplicate. Send the complete replacement body, preserving every still-valid condition, negation, exception, uncertainty, obligation, and protected quotation. A new candidate does not expand permissions or settle an unresolved condition.

Use `update` when a topic remains useful but its facts change or part of the body becomes obsolete. Use `delete` when the whole entry is obsolete, superseded, or duplicated. Do not retain a summary of history that no longer affects later action, or discard useful information along with obsolete parts.

Correct revoked permissions and invalid destinations before acting. Combine ordinary changes within a turn and retain recovery-relevant state before waiting or yielding. Unchanged reads, routine commands, a new request, or compaction alone do not require another write. Do not repeat an accepted user write. References are recovery pointers; the tool does not read them automatically.

## Capacity

One body and all active bodies on one branch each have a `16,384` UTF-8 byte limit. These limits count bytes, not characters or tokens. Splitting text across entries does not reduce total usage.

An over-limit write changes nothing. A single-entry refusal reports the body size, entry limit, and excess. A branch refusal reports current total bytes, replaced-body bytes or zero for a create, proposed-body bytes, attempted total, limit, and excess. Neither includes active-entry previews.

Review the whole active set before retrying; `list` reads every active body. For an entry-limit refusal, shorten that body. Deleting other entries cannot fix its size. For a branch-limit refusal, delete obsolete entries and update mixed entries to remove obsolete parts, then condense redundant text. Do not repeatedly shorten the proposed body without reviewing the other entries.

Preserve still-valid facts, requirements, and required verbatim text. If all content is needed, explain the capacity conflict and condense only without loss; stop the write if it still cannot fit. Reads and deletion remain available over capacity. Metadata, tool history, and old revisions are not bounded by the active-body limit, so a whole request can still be too large.

## Reset

- Successful `/clear` ends the branch's current Pin period. Old entries stop being active; numbering does not restart.
- `/new` starts a separate session with its own pins and numbering.
- `/fresh` keeps local history and pins while rotating Provider stream state.
- Branch changes and `/tree` load the selected branch's pins. Restart restores records the host saved.

Compaction itself does not unpin text. After a committed compaction, the current bodies are restored beside the host summary. Native user messages and opaque history may still contain earlier or duplicate text; Pin does not rewrite those parts of history.

## Persistence

Pins are stored in the host session journal. Pin can append records but cannot create the session file or force it to disk. On OMP `18.13.3`, the host writes when explicitly requested, when the session file already exists, or after an assistant reply exists. Pins in a new unsaved session can be lost on process exit. The dialog and tool description warn about this limit.

A confirmed user write whose message OMP never consumes does not change pins. A successful operation is not a separate disk-save confirmation. Disabling or removing the capability does not erase journals or historical text.

## Damaged records

Supported records use version `2` and integer identities. Unsupported or damaged active records make Pin unavailable for that range: new writes and new retained-text messages stop, and the first affected request reports a warning. The extension leaves the records untouched.

Start a new session or use `/clear` to reset the affected period. Earlier-period damage does not invalidate the new active set. Do not edit or convert the journal to rename old `omp-context-pin` data types.
