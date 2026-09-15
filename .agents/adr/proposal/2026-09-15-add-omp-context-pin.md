# ADR proposal: Add the omp-context-pin extension

Decision owner: Ruokee
Draft writer: deepseek/deepseek-v4.1-flash

English | [中文](./2026-09-15-add-omp-context-pin.zh.md)

## Motivation

Sessions that run long enough to compact need a small set of details kept word for word: an agreed interface, a file map, a command whose exact form matters. Compaction summarizes history, and a summary can shorten or reword that material. Asking the model to reproduce text after the fact is unreliable in the same way.

OMP's experimental `context_notes` keeps one note body per branch and restores it along the current path. It provides whole-note replacement rather than per-entry operations, and context building injects the newest note at the start of the message array. Editing that block changes an early part of the request and shortens its reusable prefix. Entry-level Pin operations need a different placement strategy.

The repository already distributes first-party OMP extension packages. This proposal uses that component format and targets public extension APIs. The host behavior described here was inspected in [OMP 18.1.16 at a fixed source revision](https://github.com/can1357/oh-my-pi/tree/61b1b8aef634334eaf1412afd003a763e1d1b9c1), including [context notes](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/tools/context-notes.ts) and [session context construction](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/session/session-context.ts). Source inspection establishes the persistence obstacle below; it does not establish real-machine acceptance.

## Proposal

### Component and scope

Add the first-party package `projects/omp-context-pin/`, named `@ruokee/omp-context-pin`, under the [first-party capability boundary](../decision/2026-08-20-establish-first-party-capability-kit.md) and the [self-contained component contract](../decision/2026-08-24-keep-components-self-contained.md). The package declares its extension entry through `omp.extensions` metadata in `package.json`, keeps its runtime, checks, and bilingual `README.md` and `README.zh.md` inside the component directory, and uses only public OMP extension APIs. It does not import private host modules, patch upstream source or installed binaries, or require files from another repository component.

The package registers exactly one slash command, `/ctx-pin`, and exactly one native tool, `ctx_pin`. `/pin` is a reserved built-in command name used for session pinning in the resume list, and OMP filters extension commands that reuse a reserved name while logging a conflict warning, so this extension uses a distinct name.

`/ctx-pin` opens the entry list for the current branch with create, view, edit, and delete. Multi-line bodies use the host's editor dialog. `ctx_pin` dispatches on an `action` parameter:

| action | purpose | main input |
| --- | --- | --- |
| `list` | list current entries with id, title, source, revision, and size | none |
| `get` | return one complete body and its id, source, revision, and size | `id` |
| `create` | pin a new text body | `content`, optional `title` |
| `update` | replace an existing body | `id`, `content`, `expectedRevision` |
| `delete` | unpin an entry | `id`, `expectedRevision` |

The schema is stable and never enumerates current entries. The tool uses `loadMode: "essential"` so an enabled `ctx_pin` remains in the top-level tool list. Pin operations do not change its definition. `update` and `delete` require an existing `id` and the revision observed by the caller. An unknown id or revision mismatch fails without writing. No action performs an implicit upsert or a create by rename. An empty body is rejected; accepted bodies retain their whitespace and characters without trimming or normalization.

Pin means the entry body stays present, verbatim, in every ordinary model request on the current session branch until it is updated, unpinned, or the branch's context is reset. Compaction does not end a pin; the body is restored from the extension's own records after each committed compaction.

Updates and deletions change the effective set immediately. Published older bodies can remain in earlier history until compaction folds them into a new base snapshot. Entry ids, revisions, and delete records express which contents remain effective. The next snapshot contains only the latest active bodies and excludes deleted entries.

The first version pins text bodies supplied by the user or the Agent. It does not read files, fetch URLs, watch pinned content for changes, or pin anything whose body changes without an operation.

### Canonical state

Canonical state is an append-only operation log in the session journal, written with `appendEntry` under the custom type `omp-context-pin`. Each accepted write appends one record:

| field | meaning |
| --- | --- |
| `schemaVersion` | payload version of the record |
| `operationId` | stable identity of one invocation, retained across its retries and used to match its projection |
| `action` | `create`, `update`, or `delete` |
| `entryId` | entry identity, assigned once at creation and never reused |
| `revision` | starts at 1; each accepted update or deletion advances it by 1 |
| `body` | complete new text for `create` and `update` |
| `source` | `user` or `agent`, recording which entry point authored the operation |
| `title` | optional creation label for the list view, retained across body updates |

The effective set is computed by replaying the current branch chronologically after its latest `reset_boundary`, using `getBranch()`. The creation record determines the source reported for an entry; later operation authors do not change it. `list`, `get`, an `update` whose body is unchanged, a rejected operation, and a failed capacity check append nothing. Identity and revision validation precede the no-op check.

One UI submission or host tool-call identity keeps one `operationId`. Retrying an accepted invocation returns its receipt without appending a second operation. A fresh `create` invocation creates a distinct entry even if its body matches another entry. Delivery retries reuse the accepted operation's identity.

An accepted operation is present in the host's in-memory branch journal. Public `appendEntry` returns no result and does not acknowledge persistence. Branch replay remains authoritative across requests, session changes, and recovery; tool results are receipts, not state storage. A receipt must not claim disk durability that the host has not confirmed. Non-persistent sessions retain Pins only for their in-process lifetime and must expose that limit to both entry points.

### Host persistence prerequisite

In the inspected OMP source, an initial fresh session with no assistant message does not create a session file when only operation entries and ordinary custom messages are appended. Normal shutdown closes existing writes but does not create that missing file. Explicit `/new` is a separate path that creates the file before returning. These behaviors follow from the [lazy persistence gate](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/session/session-manager.ts#L965-L987), [new-session creation](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/session/session-manager.ts#L1480-L1489), [exit handling](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/session/agent-session.ts#L2399-L2408), and [session close](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/session/session-manager.ts#L1869-L1884).

The built-in [context-notes write path](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/tools/context-notes.ts#L120-L142) calls `ensureOnDisk()` and `flush()`. The public [ReadonlySessionManager](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/session/session-manager.ts#L376-L400) exposes neither method. Thus this source version does not provide the public persistence operations needed to establish idle-save recovery for an initial fresh session.

The requirement remains idle save followed by normal exit and restore, without an extra model turn. Supporting that case requires a verified public host mechanism to create the session file and confirm the write. Its absence blocks implementation acceptance on this host baseline. The extension must not silently create a different session, write host journal files directly, call private methods, or start a model turn to bypass the limitation. Initial fresh sessions, explicit `/new`, existing persisted sessions, and non-persistent sessions require separate checks.

### Tail changes

Ordinary changes reach the model as session-journal custom messages with a dedicated custom type and `details.operationId`. A `create` or `update` message contains the entry id, revision, and complete new body; a `delete` message records which entry was unpinned. The host retains their appended positions and rebuilds their custom type and details, so the extension can recognize its projections without matching body text or array position. Their survival across process exit is subject to the host persistence prerequisite.

A projection separates the quoted body from any management text and presents the body as reference data with its entry id and revision. OMP converts ordinary custom messages through a shared converter that can produce developer-role messages, so the final role at the provider boundary is verified rather than assumed.

Recording a change must not start a model turn. Ordinary idle `sendMessage` with `triggerTurn: false` appends without starting one in the inspected source. The extension must reconcile canonical records with its own visible projections because `sendMessage` returns no delivery acknowledgment. At the next safe request boundary, an uncovered operation missing its projection is delivered in journal order. An operation already represented by the base snapshot needs no separate tail delivery. Queued projections outside the active branch or reset period, or already covered by the snapshot, stay out of the request. Recovery and deduplication are extension responsibilities and require real-request validation.

### Compaction boundary

At request preparation, the extension finds the latest compaction entry actually committed after the current branch's active reset boundary. It reconstructs the pin set through that committed entry as the period's base snapshot. It places the snapshot immediately after the corresponding host compaction summary and filters only its own projections covered by that snapshot. Changes accepted after the boundary stay in the tail.

Boundary selection uses the committed branch entry. It does not use the pre-compaction notification or depend on the post-compaction callback having run. Operations accepted before the commit are folded into the snapshot; operations accepted after it stay in the tail. Discarded, failed, and cancelled speculative compactions do not advance the boundary. Provider-native remote compaction keeps its opaque payload unmodified; the extension's snapshot must follow the corresponding replay in the effective provider input. A context-hook insertion alone does not prove the final placement: conversion, normalization, and later handlers must be checked on actual requests.

Without a committed compaction boundary the extension creates no base snapshot, and the tail messages alone express the current set.

The snapshot carries the boundary identity and the pin contents, and no current time, request counter, random value, or per-request estimate, so unchanged state produces a byte-identical projection. Because the projection is recomputed from the branch on each request, a lost callback, a detached notification, or a restart after the compaction does not lose the base.

### Cache behavior

- Reads and unchanged updates leave canonical Pin state and published Pin projections untouched. Their ordinary tool calls and results can still extend host history.
- `create`, `update`, and `delete` append to the tail; messages that were already published keep their positions and earlier instructions are not rewritten.
- The base snapshot changes only at a committed compaction boundary, where the host has already rebuilt the history.
- Tool definitions, the tool list, and their schema are independent of the current pin set.
- Outside the specified compaction folding and stale-queue filtering, the extension rewrites no earlier system, tool, or history content.

Verification compares provider-facing effective context, including the preceding requests when the host sends chained deltas. Attribute host-originated changes separately and check whether Pin introduces an avoidable prefix rewrite.

### Capacity and reset

- An operation written through `/ctx-pin` has `source: user`; one written through `ctx_pin` has `source: agent`. `list` and `get` report the source recorded at creation.
- Capacity is measured in UTF-8 bytes and enforced by both entry points before any state change: 16,384 bytes per entry body, and 65,536 bytes across the active entries of a branch. An operation that would exceed either limit is rejected, changes nothing, and reports the limit and the current usage. Both limits are declared constants documented in the component README.
- A successful `/clear` appends a host `reset_boundary` and ends the active Pin set. State replay, compaction selection, and queued-message filtering all use the period after that boundary. `/new` starts a separate session with its own empty set. `/fresh` resets provider stream state without clearing local history, so it does not clear Pins. Navigating back to another branch reconstructs that branch's own period.
- Validation and append use one shared synchronous path. Before writing, both entry points compare the observed session, branch, reset period, and entry revision with current state. The UI retains the revision shown when editing began; the tool supplies `expectedRevision`. Re-check after any await and reject a stale operation rather than overwriting an intervening edit. Cancellation before acceptance writes nothing; cancellation after acceptance does not roll back the operation or produce a second write.
- An unknown `schemaVersion`, damaged record, or invalid operation sequence in the active replay range makes the effective state unavailable. Disable writes and new snapshot or recovery projections for that range, preserve existing journal records and published messages, and emit a bounded diagnostic. Reads report the unavailable state rather than a complete-looking partial or empty set. Do not skip a damaged update or deletion and present an older revision as current. Re-evaluate the condition when the active branch or reset period changes.

## Alternatives considered

- Keep the host's `context_notes` as the mechanism. Considered when choosing whether a new component is needed. It gives one whole-note body per branch with branch-aware restore, but it has no entry-level operations, each write replaces the whole note, and the newest note is injected at the start of the message array, which moves previously stable bytes on every edit. Enabling the experimental mode also changes automatic context maintenance.
- Republish the complete pin set at the front of the request after each change. Considered when choosing where a change goes. It is the simplest way to keep the full text visible and was kept as a comparison baseline, but each edit then shortens the reusable prefix of the request.
- Append tail messages only, without a base snapshot. Considered when choosing how pinned text survives compaction. Tail appends alone leave the pinned text at the mercy of compaction, and only the log would still hold bodies that the model can no longer see.
- Adopt a broader context-management extension. Considered while comparing retrieval, archive search, history folding, and full context planning with entry-level Pin requirements. Those additional responsibilities exceed this component's scope. Importing an existing third-party capability into this repository would also conflict with its first-party ownership boundary.
- Replace the host's compaction. Considered when deciding how much control the extension needs over summaries. It would let the extension compose the summary, but native remote, snapcompact, handoff, soft, and shake paths each have their own semantics, and the extension reads the committed boundary instead.

## Acceptance criteria

1. The package installs, activates, and uninstalls through native OMP mechanisms on an unmodified supported runtime, and declares the peer version range verified in practice. Runtime checks use public host version and capability information before registration; peer metadata alone is not a runtime compatibility check. An unsupported runtime registers no tools or commands, emits a bounded diagnostic, and does not terminate the session. A compatible runtime must satisfy the host persistence prerequisite.
2. With the extension and tool enabled, its only provider-facing Agent entry point is `ctx_pin`, with a schema independent of Pin state. `/ctx-pin` is discoverable, built-in `/pin` still performs session pinning, and no command conflict warning is logged.
3. State: each accepted logical operation appears once in the current branch journal; reads and unchanged updates add nothing. Branch switching, `/tree`, restore, and reload reproduce the expected entries, sources, and revisions. `/clear`, `/new`, and `/fresh` follow their distinct contracts. Unknown ids, stale revisions, submissions cancelled before acceptance, and rejected writes leave state unchanged. Retrying an accepted invocation does not append another operation.
4. Delivery: the base snapshot and uncovered tail jointly express the effective set without duplicate application or revival of superseded revisions. A snapshot-covered operation does not require an individual tail projection. Already published historical revisions may remain until compaction; they must not become effective again. An idle write starts no model request and appears at the next safe request boundary. Restore between a recoverable canonical write and its projection preserves the operation; stale queued projections stay out of the active request. Separately verify idle save, normal exit, and restore for an initial fresh session with no assistant output and for an explicit `/new` session. A pass in one does not replace the other.
5. Cache: unchanged published Pin content retains its bytes and position across ordinary history growth. Creates, updates, and deletions preserve the preceding system, tool, and history content until a host compaction or reset changes that period. Compare consecutive effective requests within matched runs with the extension, without it, and with a front-rewrite baseline. Record each first differing message and field and its cause. Reconstruct effective input across `previous_response_id` deltas; Pin must not add a full replay beyond the host's own context change.
6. Exercise and report each maintenance subcase on real requests: repeated manual compaction, automatic threshold and mid-turn compaction, overflow recovery, adopted, discarded, failed, and cancelled speculative compaction, handoff, snapcompact, provider remote compaction, shake and tool-result pruning, `/tree` to an earlier boundary, and a request before the post-compaction callback completes. Cover changes accepted during compaction and delayed queue delivery. Effective pinned bodies remain verbatim and ordered, their revisions resolve correctly, and opaque remote payloads remain unmodified. Run core maintenance paths through both user-created and Agent-created entries.
7. Capacity and failure: byte limits are enforced before state changes; rejection changes neither the log nor projection. Test multi-byte limits, unknown schema versions, damaged records, interrupted receipts, concurrent edits, non-persistent sessions, and a dialog left open across session, branch, or revision changes. Test cross-entry management in both directions, including source preservation after a UI edit. A damaged deletion must not revive an older entry as valid state.
8. Evidence: use the real interactive OMP CLI with dedicated test configuration, sessions, and synthetic workspace. User cases operate the actual command, editor, and list. Record the exact host version, candidate hash, effective configuration, resolved models, driver version, and process/session/branch/input associations. Verify driver readiness and completion handling before functional cases; use bounded, paginated observation without blind input retries. For every relevant request, including failures and retries, correlate inputs, calls, canonical records, context-hook output, and final provider-facing payload. Verify the observation point covers serialization and chained requests. Remove credentials, Cookie headers, and private connection details before capture reaches disk, without changing the sent payload. Preserve the captured evidence and exact exports without formatting; do not supply test answers or history exports to the subject as business material. Missing key evidence blocks a pass.
9. Autonomy: pre-register three independent trajectories on the final candidate. Each starts from a fresh test session and covers autonomous selection and creation, update, removal of expired information, use after real compaction, and avoiding unnecessary writes. Judge each stage of each trajectory. The Agent chooses actions and ids from business context and normal tool guidance, without manual calls, copied successful state, step-by-step instructions, or re-supplied answers. Any behavioral failure fails that candidate's trajectory set; additional successful runs do not erase it. After a fix, rerun all three on the new candidate. Separately test recovery from real tool errors.
10. All required cases and their parameterized subcases pass with evidence for the final candidate. Preserve failures and associate fixes with new candidate and run records; keep candidate, configuration, driver, and criteria fixed during each run. Repeat affected cases and core user, Agent, prefix, compaction, and restore paths after fixes. Unavailable triggers, missing observation, and unexecuted mandatory paths block acceptance; only the maintainer may approve a scope exception. Distinguish driver completion, evidence completeness, and functional success. Validate reload and coexistence with the actual context-extension combination as well as the fixed test configuration.
11. `pnpm check` passes, with the component's checks included in the root aggregate. The component README documents command and tool usage, invocation and revision rules, record format, limits, reset rules, persistence conditions, and verified host versions. Automated checks do not substitute for real-machine acceptance.

## Risks

A canonical record can exist without its model projection, causing pinned text to disappear from the request. Recovery can also deliver it twice or deliver an older revision after a snapshot. The extension must reconcile operation identities and snapshot coverage across restart, queueing, and compaction; the restore cases must exercise those failure paths.

Selecting the wrong compaction boundary publishes a snapshot for a compaction that never took effect, or skips one that did, so changes are dropped or an older version reappears. The boundary comes from the committed branch entry, and speculative results that were discarded must not advance it.

Other extensions can insert messages around the host's compaction summary or drop the snapshot in a later handler. Final provider conversion can also change the apparent hook-level order. These failures can omit pinned text or apply changes in the wrong order, so acceptance must inspect the final request for the tested extension combination.

Provider-native remote compaction keeps part of history opaque. Pinned text may remain inside that payload as well as in an explicit snapshot. Editing the opaque payload could corrupt replay; incorrectly ordering the explicit snapshot and tail could reinstate superseded constraints. Verify preservation and effective ordering on actual requests without claiming to deduplicate opaque contents.

Pinned bodies and accumulated revisions consume context. Limits on active body bytes do not bound token use, metadata, or older tail messages, so the full request can still overflow after compaction. Acceptance must measure full-request size and verify native overflow recovery without truncating active Pin bodies or repeatedly triggering recovery without progress.

Pinned text can be interpreted as instructions, especially when its host-defined role is developer. Delimit bodies as reference data, separate management text, and check escaping and the final role, including text that resembles a closing delimiter.

Request captures can leak credentials or unrelated private content. The inspected host's [request debug writer](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/ai/src/utils/request-debug.ts#L56-L78) includes request headers; synthetic prompts and repository exclusion alone do not make those files safe. Use capture that excludes sensitive transport fields before writing and does not mutate the request sent to the model.

The inspected host cannot establish the initial-fresh-session persistence requirement through the public extension interface described above. Shipping despite that gap could lose a user's idle save on normal exit. The persistence prerequisite and final-request recovery and placement checks remain release gates, not completed validation.
