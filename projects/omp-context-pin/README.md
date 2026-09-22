# omp-context-pin

[中文](./README.zh.md)

Keeps the text of the pinned entries present in every later ordinary model request on the current session branch. Entries are shown as `#<id>`, and their numbers are positive integers scoped to one session. An Agent write reaches the model through the explicit non-initiating delivery mode and starts no model turn; a confirmed user write is an ordinary user message that holds the body of the draft and nothing else. Compaction does not end a pin: after a committed compaction the bodies are rebuilt from the extension's own journal records.

## Usage

The user entry point is the `/ctx-pin` command.

- `/ctx-pin` opens the entry list of the current branch: the add item first, the entries next in creation order, and a close item last. Each row shows the entry as `#<id>` and the start of its body, so no stored label is needed.
- `/ctx-pin add <body>` pins the text that follows `add` and one separating space, without opening a dialog. The body keeps every character and all whitespace after that space: no shell-style splitting, quoting, unescaping or whitespace normalization.
- An unknown subcommand or a missing body reports brief usage text and sends no message. Inline view, edit and delete are not part of this version.

Listing, viewing a body and editing a draft are read only: they send no message, change no Pin state and do not interrupt a running turn, and an abandoned draft leaves nothing behind. A confirmed write closes the list.

The list draws its rows with the host's own selection component, so it follows the session theme and takes the width it is drawn at. Each row shows the entry as `#<id>` and its body with whitespace runs folded to one space, cut at the width the row has room for, with an ellipsis when the body does not fit. A body with no visible characters is shown as its id alone.

### Confirmed writes

A confirmed write is submitted as an ordinary user message through the host's public message API, and the message holds the body of the draft and nothing else:

```
<the body, verbatim>
```

The extension recognises that message by its text, because the text it writes is the text this process handed over. One submission is claimed by one message, and only while this process still holds the copy: the write is expressed by the message itself, and once the write is settled the text is ordinary text again. Text that repeats a draft the session still holds can be read as that draft, which is the price of a message the user can read and edit.

An operation becomes effective when the host consumes that message and the checks pass against the submission this process recorded: the text is exactly the text this process handed over, the session, pin period and branch are the ones the draft was written in, the addressed entry exists, and the revision still matches the one the draft was opened at. The text is what the user sees, so an edited message, a quoted draft, a message another process submitted, and a message a restored session hands back are ordinary text. The command reports the write as pending until the message is consumed.

The accepted set changes only then, and the request that consumed the message carries the outcome directly after the message that carried the operation: accepted, no change, or not applied with its reason, naming the entry it changed. One operation can be answered again with another reason, and each result is reported once; a branch or session change ends what the extension remembers reporting, so a result the request cannot read is reported again. The outcome repeats no body, starts no turn of its own, and adds no persistence guarantee. The same text is handed to the host as the operation is reported, in the host's non-initiating mode, so the host holds it for a later turn and appends it to the branch without starting a turn for it, and the user is shown the same text. The extension writes that result into every request directly after the message that carried its operation, whether or not the host already holds a copy further down the branch, so every request reads one copy of it at that position and with those bytes; a session or branch change ends what the request carries. When the host records no result, the extension keeps at most 16 results pending, giving up the oldest first.

An operation is applied once. The message that applies a submission is the one the host runs: the submission records the message count the session held when it was confirmed, and the first message at or after that point whose text matches takes it. Text that repeats earlier history is not read as an operation, and a submission whose text never runs is given up once the region holds a message that matches nothing pending. The message it came from stays in the branch, but a later request no longer reads it as an operation, so nothing is appended a second time and the same result is not reported again. An outcome that is final ends the operation for this process: a write refused for any reason, for example a mismatch of the session, the branch, the revision or the capacity, stays refused after the user returns to that branch or frees the capacity. An operation that could not be read is not final, and is applied when a later request reads the range.

The host records the user message in the branch in its own time. Until it does, the request that carries the message is the only place the write is expressed, so the extension neither writes the body again into that request nor queues a change message for it.

The Agent entry point is the `ctx_pin` tool with five actions:

| Action | Input | Effect |
| --- | --- | --- |
| `list` | none | the id, source, revision and size of every entry, without bodies |
| `get` | `id` | one complete body with its id, source, revision and UTF-8 byte size |
| `create` | `content` | pins a new body |
| `update` | `id`, `content`, `expectedRevision` | replaces a body |
| `delete` | `id`, `expectedRevision` | unpins an entry |

The `id` parameter takes the integer the list and the receipts show. It accepts no digit string, and no action performs an implicit upsert or a create by rename.

A write from `/ctx-pin` records the source `user`, a write from `ctx_pin` records the source `agent`. `list` and `get` report the source recorded when the entry was created, and `update` keeps it.

Every action of the tool declares the lowest approval class, `read`. With no explicit per-tool policy, `always-ask`, `write` and `yolo` do not prompt for a Pin operation; an explicit user policy that marks `ctx_pin` as `prompt` or `deny` still applies. The extension writes no user configuration and adds no authorization or confirmation of its own. The type, existence, revision, capacity and record-integrity checks stay: they keep an operation acting on the data it targeted.

An Agent `create`, `update` or `delete` appends the operation record and hands the host a change message for the model, in the same non-initiating mode, without an extra turn. The record is canonical; the change message is a projection, sent again after a session or pin period change when the journal still does not show it as published. The request expresses the accepted changes in journal order, so a change the request does not carry makes every later change part of the same gap: those changes are written again in order, and the messages that carried them leave the request. A change written again reads directly after the result of the call that produced it, when the request holds that call, and otherwise keeps the place the journal gives it, which is before the message that carries a later change; with neither, it goes to the end. An older body therefore never reads as the last one, and the message the user sent keeps its own place.

The extension pins text that a user or an Agent supplies. It does not read files, fetch URLs, watch content, or change an entry without an operation.

An empty body is refused, and an accepted body keeps every character and all whitespace exactly.

## Records and revisions

The operation records in the session journal are canonical state. Each record is one journal entry of the custom type `omp-context-pin` with this payload:

| Field | Value |
| --- | --- |
| `schemaVersion` | `2`, the payload version this component reads and writes |
| `operationId` | positive integer for one user submission or Agent write call, retained across its retries; internal, and no message, listing or result shows it |
| `action` | `create`, `update` or `delete` |
| `entryId` | positive integer assigned at creation and never reused in that session |
| `revision` | starts at 1, advances by one per accepted `update` or `delete` |
| `body` | the complete new text for `create` and `update`, absent for `delete` |
| `source` | `user` or `agent` |
| `toolCallId` | the host's tool call id of the Agent call that produced the record, kept to resolve its retries |

`list`, `get`, a refused write and a write that changes nothing append no record.

Change messages use the custom type `omp-context-pin-change`. Every read replays the records of the current branch, so a rebuilt context, a lost change message or a restart that still has the journal yields the same state. A request carries the changes of the current branch only: a copy that names an operation this branch never accepted leaves the request even when the entry it names is held and its revision matches one this branch accepted, because two paths of one session can reach the same revision number with different bodies. A copy of a change this branch accepted stays.

A confirmed user write is carried by the user message that requested it, so no change message is sent for it: the extension counts that message as showing the write, and the body reaches the model once. The result of the write is a message of the custom type `omp-context-pin-result`; it names the entry the write changed and holds no Pin state, replay ignores it, and the host holds it for a later turn in the same non-initiating mode, so it is appended to the branch without starting a turn. The extension writes that result into every request directly after the message that carried its operation, whether or not the host already holds a copy further down the branch, so every request reads one copy of it at that position and with those bytes; a session or branch change ends what the request carries. When the host records no result, the extension keeps at most 16 results pending, giving up the oldest first.

### Numbering

Entry ids are positive integers scoped to one session and are shown as `#<id>` wherever the session names an entry, and they only move forward. The identity a write is tracked under is internal and moves forward in the same way.

- An entry id is assigned at the first successful creation of that entry and is never reused in the session, not even after the entry is unpinned.
- An operation number is assigned per user submission and per new Agent write call. A retry of that submission or call reuses its number, so a repeated call or a repeated submission does not pin twice, and the numbers may leave gaps.
- The host's tool call id stays an internal idempotency key: the model neither generates it, fills it in, nor interprets it. An Agent retry resolves its accepted operation number from the persisted record through that id after checking that the call content matches.
- Numbers are restored from the whole session through the host's public session entries, including numbers reserved by submissions this process has not consumed yet and by the carriers and results the host already holds. That scan assigns numbers only: it never applies another branch's bodies, receipts or operations.
- A number that would leave the safe integer range, or an allocation state that cannot be established reliably, is reported as an explicit error instead of wrapping around or restarting from 1. A session whose entries the host cannot list is reported as a host that does not expose them, and the write is refused.

The `schemaVersion` is `2`, and the identities are integers. Records written by the earlier `0.4.x` candidate hold string identities; an active range that contains them is reported as an unsupported format instead of being mixed with integers, and the switch is clean: those records are not migrated, and the user starts a new session or resets the range.

Replaying a record with the same `operationId` under the same revision is a no-op. The same identity carrying other content is treated as damage rather than as a retry.

## Reset

A reset boundary ends the pin period of the branch:

- A successful `/clear` starts a new period, and the entries of the previous period stop being active. It does not lower the numbering: entry ids and operation numbers continue from where the session was.
- `/new` starts a separate session with its own entries and its own numbering.
- `/fresh` rotates the provider stream state and keeps the local history, so pins stay active.
- Switching branches or using `/tree` replays the period of the branch that becomes current.

An identity that a reset retired stays retired: an entry created before a reset is not restored afterwards, and a retry of an operation from before the reset is answered from the ledger instead of appending a second record.

A committed compaction boundary freezes the active bodies into one snapshot. The snapshot is placed after its matching host summary when the branch carries that summary; if no matching summary exists, the snapshot goes after the last summary message in the request, or at the head of the request when there is none. A compaction that produced no newer boundary leaves the previous snapshot in place. The extension removes only its own change messages from a request, so a user message the host keeps beside the summary can carry the same body as the snapshot.

When a record cannot be read, or a stored value does not match the version this component writes, the range stops being available: the extension sends no snapshot and no new change, and writes are refused with the reason. The first request of a session that meets this condition reports it once, as one warning in the host log, plus one notice through the extension UI when the host has a UI; further requests with the same range and reason stay silent. The records themselves are left untouched rather than repaired or dropped.

The active set is the range after the latest reset boundary, and damage is judged inside that range. A damaged record from a period the reset already replaced cannot stop the current range. The identities read before that record still count, so an entry created there stays retired and an accepted operation there answers a repeat; the identities past it are not known, so a repeat of one of those is treated as a new call. Damage inside the current range stops the range, as described above.

## Limits

One body may not exceed 16,384 UTF-8 bytes, and the active bodies on one branch may not exceed 65,536 UTF-8 bytes. A write that exceeds either limit changes nothing, and the refusal reports the limit, the current usage and the size the operation would reach.

## Persistence

Pins live in the session journal of the host. The extension can append records to that journal and read from it; it cannot create the session file or flush it. A session the host already writes to disk keeps its pins across processes. In the inspected host, the session file is written when a caller asks the host to write it, when the file is already on disk, or when the session already has an assistant reply; before that, a pin recorded there can be lost when the process exits, and a session the host never writes to disk keeps its pins only while the process runs. The `/ctx-pin` dialog states this limit when it opens, and the tool description carries it as well. A confirmed user write is applied when the host consumes the message it was submitted as, so an operation whose message the host never runs leaves the pins unchanged. A session start, a session switch or a session shutdown before the write is applied drops it, and, when a UI is available, the extension reports the drop as a notice that may no longer be shown once the host has begun shutting down.

## Cache behavior

- Reads and unchanged updates leave the canonical records and the published projections untouched. Their ordinary tool calls and results can still extend the host's history.
- An accepted write appears in the tail: an Agent write as the extension's projection, a user write as the message the user submitted. Messages that were already published keep their positions.
- The base snapshot changes only at a committed compaction boundary, where the host has already rebuilt the history.
- The tool definition, the tool list and the schema are independent of the current pin set, and the extension rewrites no earlier system, tool or history content outside the specified compaction folding and stale-queue filtering.

## Compatibility

The package declares the peer range `>=18.1.8 <19` in `package.json`. The automated type check and the test suite run against the host version `18.2.8`; the interactive runs of the component used `18.1.16`. The range is metadata: it carries no runtime check and no claim about every version in it. Before registering anything, each activation inspects the host's public version and API surface, including the user message API a confirmed write is submitted through, the session entries used to restore the numbering, and the schema builders the tool uses. An activation that finds a problem registers nothing and, when the host exposes a usable logger, logs one bounded warning that describes the problem; without a usable logger it registers nothing and cannot report the problem. A message the host restores is not read as an operation: only a submission this process recorded is applied.

## Installation

Clone the GitHub repository, install its locked dependencies, and install the package into OMP:

```bash
git clone https://github.com/ruokee/ruokee-agent-kit.git
cd ruokee-agent-kit/projects/omp-context-pin
bun install --frozen-lockfile
omp install "$(pwd)" --scope user
```

`omp install` is an alias of `omp plugin install`, and `omp plugin link "$(pwd)" --scope user` registers the same directory. OMP reads `omp.extensions` from `package.json` and loads `src/extension.ts`; no manual extension-path setting is required.

### Updating

The registration points at this checkout, so the installation keeps reading the package and its dependencies from that directory. Update it from the repository root:

```bash
cd /path/to/ruokee-agent-kit
git pull
cd projects/omp-context-pin
bun install --frozen-lockfile
```

Restart OMP afterwards: a running process keeps the extension code it loaded at startup, and starting another session in the same process does not reload it. Pins belong to the session journal of the host rather than to this checkout, so an update neither changes nor clears them.

## Development

```bash
bun install
bun run typecheck
bun test
```

## License

MIT.
