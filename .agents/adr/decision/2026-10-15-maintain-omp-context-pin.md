# Maintain the omp-context-pin extension

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash
Reverses: [Add omp-context-pin extension](../archived/2026-09-15-add-omp-context-pin.md)

English | [中文](./2026-10-15-maintain-omp-context-pin.zh.md)

## Motivation

Maintain the omp-context-pin extension as a first-party host component whose pinned text stays verbatim across compaction, and keep its capacity values with the component rather than with this decision.

The component exists, and its public surface is documented in the component README while the [component specification](../../spec/omp-context-pin.md) states its goals, invariants, and acceptance criteria. This decision carries forward the rules that still hold and records one change: the capacity values leave the decision and become component defaults. The archived record holds the earlier analysis, the original alternatives, and the values as they stood.

## Decision

### Component scope

- The first-party package `@ruokee/omp-context-pin` lives in `projects/omp-context-pin/`, declares its extension entry through the `omp.extensions` metadata in `package.json`, and uses only the public OMP extension API. It imports no host private module, patches no upstream source, and depends on no other repository component.
- The package registers exactly one slash command, `/ctx-pin`, and one native tool, `ctx_pin`. The host keeps `/pin` for its own use, so the component uses a different name.
- The tool dispatches on an `action` parameter for listing, reading, creating, updating, and deleting. Its schema stays stable and does not enumerate the current entries, and the tool definition does not change with the pin set. Updating and deleting require the existing entry id and the revision the caller observed; an unknown id, a stale revision, and an empty body are refused. No action performs an implicit upsert or a rename-style create.
- Entry ids and operation ids are positive integers within one session. An entry id is assigned on the first successful create and is never reused. An operation id is assigned per user submission or per new Agent write call and is reused when that submission or call is retried, so gaps are allowed.
- Every action declares the lowest approval level, `read`. The component writes no user configuration and adds no authorization, confirmation, or source-admission check of its own; type, existence, revision, capacity, and record-integrity checks remain, because they make an operation act on the right data rather than restrict who may call it.

### Interaction

- `/ctx-pin` opens the current branch's entry list with create, view, edit, and delete. `/ctx-pin add <body>` submits a create directly, because issuing the command is the confirmation. Listing, viewing, and drafting are read-only: they send no message, change no pin state, and interrupt no running turn.
- A confirmed write becomes an ordinary user message whose text is the body being pinned, with no added marker. The extension matches the consumed message against the text it handed the host, so the message stays readable and editable, and it claims an unrelated message with the same text once while that submission is held. Matching is limited to the submission this process holds and to the current session, branch, and reset period; identity is never inferred from a timestamp, an array position, or the input source.
- A write takes effect when the host consumes the message and the extension validates it. The entry point then reports accepted, no change, or not applied with the reason, states the result separately from the body, and starts no turn of its own.
- The Agent manages pins through `ctx_pin` during a turn it already runs, and the tool result is its receipt. A user may also ask for a pin operation in an ordinary message, where the Agent is expected to call the tool like any other tool the request needs; the extension does not turn natural language into pin operations, and neither path promises that the model picks the right tool, arguments, or moment.
- The entry point decides the source: a write through `/ctx-pin` is recorded as `user`, a write through `ctx_pin` as `agent`, and an entry keeps its creation source.

### Canonical state

- The canonical record is an append-only operation log in the session journal, appended through the host's public entry API under the component's own custom type. Each accepted write appends one record carrying the record version, the operation id, the action, the entry id, the revision, the body, and the source.
- The active set is computed by reading the current branch and replaying its records after its latest reset boundary, in time order. Records of other branches are not applied to the current one.
- An accepted operation is one that has reached the host's in-memory branch log. The public append call returns no value and confirms no persistence, so a receipt states what the extension submitted or accepted and never claims that the host saved it.
- Numbering reads the whole session to restore both high-water marks, including numbers reserved by submissions this process still holds. That scan allocates identities only; it does not apply another branch's bodies, receipts, or operations. A reload rebuilds allocation state, and an ordinary tree jump or `/clear` does not lower the counts.
- A number beyond the safe integer range, or an allocation state that cannot be established, produces an explicit error rather than a wrap or a silent restart from one. Records written by an earlier candidate in a string-identity format are reported as unsupported and are not read as integers; no migration runs, and a session or reset period started after that point begins the new numbering.
- When the effective replay range holds an unknown record version, a damaged record, or an invalid operation sequence, that range becomes unavailable: writes and new snapshots are refused, existing records and published messages are kept, and a bounded diagnostic is reported. Reads report the state and never return a partial or empty set that looks complete, and a damaged record from a period a reset already replaced cannot stop the current range.
- The component keeps no persistence of its own. It does not create the session file, write journal files, call private methods, create a second session, or start a turn to force a save. Session files, their writes, their save on exit, their recovery, and their copying belong to the host. A session the host does not persist keeps its pins only while the process runs, and both entry points state that limit rather than implying durable storage.

### Tail changes

- An accepted change reaches the model as a custom message in the session log, under its own custom type and with its operation id in the details. A user-confirmed write travels as the message the user submitted; the projection carries an Agent write and re-expresses a change the request would otherwise miss. Whether a projection survives a process exit depends on the host's session saving and recovery.
- An Agent write never starts a model turn: it is delivered through the public non-active delivery mode, which appends when the session is idle and queues without scheduling a continuation while a turn runs. A user-confirmed write travels the ordinary user path, where the host starts the turn when the session is idle and treats it as steering while a turn runs.
- Positions stay stable. A receipt binds to its user message, an Agent change binds to the completion position of its tool call, and a host-appended copy with the same identity is deduplicated instead of being appended to a new tail position. When a carrier disappears through compaction or pruning, the position is restored from the snapshot and the log order, never from an array index.
- A projection and a recovered body separate the quoted text from its administrative note and label the entry id, the revision, and the source. Recovered text is retained session context: its facts and the user requirements that still apply stay in force, and being pinned gives it no authority it did not already have and does not mean the task that produced it runs again. An Agent-written body gains no user or system instruction authority by being pinned. The host may deliver a custom message as a developer-role message through its shared converter, so the final role is checked at the provider boundary rather than assumed.

### Compaction boundary

- Request preparation takes the latest committed compaction entry after the branch's effective reset boundary. Replaying the records up to that entry forms the base snapshot for the period. The snapshot is inserted next to its matching host summary, and only the component's own covered projections are filtered; changes accepted after the boundary stay in the tail.
- The boundary comes from committed entries on the branch, not from a pre-compaction notice or from whether a post-compaction callback has run. A discarded, failed, or cancelled speculative compaction does not advance it. A provider-native remote payload stays opaque, and the snapshot is ordered after the matching replay.
- A snapshot carries the boundary identity and the pinned content, and no current time, request count, random value, or per-request estimate, so it is byte-identical while the pinned state is unchanged. Because the projection is recomputed from the branch on every request, a lost callback, a detached notice, or a restart after compaction loses no base.
- Without a committed boundary the component produces no snapshot, and the tail messages alone express the current set.

### Cache behavior

- Reads and updates that leave a body unchanged change neither the canonical state nor the published projections. Their ordinary tool calls and results can still extend the host history.
- An accepted write appears in the tail: an Agent write as the component's projection, a user write as the message the user submitted. Messages already published keep their positions, so earlier instructions are not rewritten.
- The base snapshot changes only at a committed compaction boundary, where the host has already rebuilt the history.
- The tool definition, the tool list, and the schema are independent of the current pin set.
- Outside the specified compaction folding and stale-queue filtering, the extension rewrites no earlier system, tool, or history content.
- Verification compares the provider-visible effective context and includes preceding requests when the host sends chained deltas. A host-side change is attributed separately, and the check looks for avoidable prefix rewrites caused by the pin.

### Capacity

- Both entry points check the per-entry and per-branch limits in UTF-8 bytes before any state change. An operation that would exceed either limit is refused, changes nothing, and reports the limit, the current usage, and the size the operation would reach.
- The current values are the component's own defaults, documented in the component README. Adjusting them is a component change, and this decision does not fix them.
- After a successful `/clear` the host appends a reset boundary and the current pin set ends there; replay, boundary selection, and queued-message filtering then follow the period after that boundary. `/new` starts an independent session with its own empty set. `/fresh` resets provider stream state without clearing local history, so it clears no pin. Jumping to another branch rebuilds that branch's own period.
- Validation and append run through one synchronous path. The tool path validates before accepting, and `/ctx-pin` validates when the host consumes the confirmation message. Both compare the observed session, branch, reset period, and entry revision with the current state, and re-check after any await, refusing rather than overwriting an edit that happened meanwhile. A draft that is edited, dropped, or cancelled before consumption writes nothing; cancelling after acceptance rolls nothing back and produces no second write.

### Host maintenance

- The component is maintained against OMP 18.5.0 as a lower bound and no upper maintenance bound, declared in the compatibility section of the component README, which is the authority for that bound. The bound gates neither installation nor activation, and the component keeps no code path that exists only for an earlier host.
- The component's checks run under the repository check entry point. Automated checks do not establish real runtime behavior.

## Alternatives considered

The archived record holds the alternatives considered when the component's earlier choices were made. The reversal itself had these options.

- Keep the capacity values in this decision and reverse it whenever a value changes. Considered while deciding where the values belong. Each adjustment would carry a proposal, a successor decision, and an archive of the previous decision, which is more record than a usage-dependent default justifies.
- Remove the values by appending a `## Changes` entry to the previous decision. Considered as the lighter mechanism. An update is allowed only when the added content does not conflict with the decision, and an entry that withdraws the binding force of an existing clause conflicts with it, so this route is closed.
- State the values in the specification layer instead. Considered while checking which layer owns them. The component specification states goals, invariants, and acceptance criteria and points to the component README for the size limits. Repeating tunable values there adds a second place to keep in sync.

## Consequences

- Pinned text and accumulated revisions consume context. The byte limits constrain active bodies only, so they bound neither tokens, metadata, nor older tail messages, and a full request can still overflow after compaction.
- The limits no longer appear in this decision, so the component README is their single documented source, and a component change that adjusts them conflicts with nothing recorded here.
- A branch whose active bodies exceed the current limit keeps its entries readable and refuses new writes until the total drops below the limit; unpinning is not capacity-checked, so such a branch can return under the limit on its own.
- The canonical record and its model projection are separate: a record can exist while its projection is missing, and recovery can deliver a duplicate or an older revision after the snapshot. Recovery across restarts, queuing, and compaction stays in the acceptance scope.
- Choosing the wrong boundary loses accepted changes or revives a superseded revision. Another extension can insert messages around a host summary or drop a snapshot, and the final provider transformation can change an order that looked right in a hook, so acceptance checks the final request of the tested combination.
- Provider-native remote compaction keeps part of the history opaque. The component keeps that payload as it is and does not claim to deduplicate it.
- Retained context can be read as granting permission, and session-scoped integers can collide across sessions or be recovered from the wrong range. Source labels, the wording of the note, and the session-level high-water mark are the controls, and the final role at the provider boundary is checked rather than assumed.
- Non-active delivery can defer a change to the next ordinary prompt, so the current request derives its own changes from the canonical record.
- A submission is identified by the text the extension handed the host, and a message with the same text is claimed once while that submission is held.
- Request capture can leak credentials. Capture excludes sensitive transport fields before writing and does not change the request sent to the model.
- The component's checks are part of the repository check entry point. They do not replace acceptance on a real host.
