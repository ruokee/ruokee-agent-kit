# Context Pin tool contract

Draft owner: Ruokee
Draft writer: OMP DeepSeek V4.1 Flash

English | [中文](./17-context-pin-tool-contract.zh.md)

## Motivation

Change the Context Pin tool contract so callers address the current entry without supplying its revision and can read the full active set in one call.

The tool currently requires `expectedRevision` for `update` and `delete`. A caller must obtain the latest revision before each write, and a revision change between reading and writing is refused. The component also exposes only summary lists and single-entry reads, so a caller that needs the whole active set must combine several calls or rely on an older view. These requirements add read-before-write work and encourage local edits without reviewing other active entries.

## Proposal

- `update` and `delete` address an active entry by `id` and act on the entry current at execution time. The public schema no longer accepts `expectedRevision`; revision remains an internal record, a display value, and replay material.
- A new read-only `show` action returns every active entry on the branch, each with id, source, revision, UTF-8 size, and complete body, plus the entry count, total active bytes, and branch limit. On an empty branch, `show` states that the branch has no pinned bodies and reports zero total active bytes and the branch limit. `list` remains a summary; `get` remains a single-entry read.
- A branch capacity refusal reports the total active bytes on the branch, the body being replaced (zero for a `create`), the proposed body, the attempted total, and the excess. A single-entry refusal reports the body size, the entry limit, and the entry excess. Both refusals write nothing, leave the active set unchanged, and ask the caller to review the whole active set. Neither refusal presents splitting as a way to reduce active bytes.
- Retries keep their existing operation identity. A retry of an accepted operation returns the original result, appends no record, and leaves the active set and later writes unchanged. A reused identity carrying a different action, entry target, source, or body is a conflict; revision is not compared. Retry recognition precedes the current-entry lookup, so an accepted `delete` retry still returns its original result after the entry is gone. Only a new call for an unknown entry fails.
- A confirmed user edit or delete acts on the current entry. The revision shown when the dialog opened is display information, not an admission condition. An older draft can therefore overwrite a body changed while the dialog was open.

The [component README](../../../../../projects/omp-context-pin/README.md) and its [Chinese edition](../../../../../projects/omp-context-pin/README.zh.md) are the public contract for the action list and observable behavior. The [component specification](../../../../spec/omp-context-pin.md) states the goals and invariants. The [current component decision](../../../decision/2026/09/15-omp-context-pin.md) remains in force; this proposal extends it without changing its ownership, its `read` approval level, or its delegation of tunable limits to the component.

## Alternatives considered

- Keep `expectedRevision` required. Considered because it detects concurrent changes. It keeps read-before-write work and refuses a write after an unrelated update, so it does not satisfy the requirement that revision not be a caller condition.
- Make `expectedRevision` optional. Considered as a compatibility middle ground. It leaves two write modes with different concurrency behavior and keeps the old read-before-write path as the normal path.
- Keep `get` as the only full read. Considered to avoid a new action. Reading several entries requires several calls and can mix revisions from different moments.
- Give `show` an `id` parameter. Considered for symmetry with `get`. It would duplicate `get` and lose the single-call view of the complete active set.
- Keep the current capacity text. Considered because it already reports the limit and attempted size. It does not direct attention to other active entries or explain why splitting does not reduce active bytes.

## Acceptance criteria

- The tool exposes six actions: `list`, `get`, `show`, `create`, `update`, and `delete`.
- `update` and `delete` succeed without `expectedRevision` and act on the current entry. A new call for an unknown entry still fails; an accepted retry is answered before this lookup, so a `delete` retry still returns its original result after the entry is gone.
- An accepted operation retried with the same identity returns the accepted result without appending, and the active set and later writes remain unchanged. A reused identity with a different action, entry target, source, or body fails as a conflict; revision is not compared.
- `show` returns every active entry with its complete body and metadata, the entry count, total active bytes, and the branch limit. On an empty branch, it states that the branch has no pinned bodies and reports zero total active bytes and the branch limit. It does not write a record, change a revision, or change active usage.
- A branch capacity refusal reports the total active bytes on the branch, the body being replaced (zero for a `create`), the proposed body, the attempted total, and the excess. A single-entry refusal reports the body size, the entry limit, and the entry excess. Both refusals write nothing, leave the active set unchanged, ask for a review of the whole active set, and do not present splitting as a capacity remedy.
- Existing supported journal records replay unchanged; entry ids, operation identities, and revisions are not renumbered or migrated.
- The component README, component specification, tool description, and version change with the tool behavior.
- The implementation creates the decision record and removes this proposal.

## Risks

- An older user draft can overwrite a body changed while the dialog was open. The user confirms the write, but the dialog no longer protects against a concurrent change.
- An Agent that edits from an older view can overwrite a newer body. Removing the revision gate removes the refusal that made this visible.
- `show` can return a large body set and consume context. It is an explicit read, not a default action.
- A caller may ignore the whole-set capacity guidance and keep shortening one body. The guidance changes the message, not the model's behavior.
- Existing callers that still send `expectedRevision` may fail if the host rejects unknown fields. The public documentation and schema change together.
- The README, specification, and tool description can drift. They change in the same implementation and the decision links the public surfaces.
