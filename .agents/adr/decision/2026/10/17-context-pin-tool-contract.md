# Context Pin tool contract

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash

English | [中文](./17-context-pin-tool-contract.zh.md)

## Motivation

Callers should address the current Context Pin entry without supplying its revision and should be able to read the complete active set in one call.

The previous public contract required `expectedRevision` for `update` and `delete`, so a caller had to read before every write and a revision change refused the write. The tool also exposed only summary lists and single-entry reads, so a caller that needed the whole active set had to combine calls or rely on an older view. Those requirements added work and encouraged edits without reviewing other active entries.

## Decision

The `ctx_pin` tool exposes six actions: `list`, `get`, `show`, `create`, `update`, and `delete`.

`update` and `delete` address an active entry by id and act on the entry current at execution time. The public schema accepts no `expectedRevision`. Revision remains an internal record, a display value, and replay material.

Retries keep their operation identity. A retry of an accepted operation returns the original result, appends no record, and leaves the active set and later writes unchanged. Retry recognition precedes the current-entry lookup, so an accepted `delete` retry still returns its original result after the entry is gone. A reused identity carrying a different action, entry target, source, or body is a conflict; revision is not compared.

`show` is read only. It returns every active entry with its id, source, revision, UTF-8 size, and complete body, plus the entry count, total active bytes, and branch limit. On an empty branch it states that no body is pinned and reports zero total active bytes and the branch limit. It appends no record and changes no revision, active usage, or projection.

A branch capacity refusal reports the total active bytes on the branch, the body being replaced (zero for a create), the proposed body, the attempted total, and the excess. A single-entry refusal reports the body size, the entry limit, and the entry excess. Both refusals write nothing, leave the active set unchanged, and ask the caller to review the whole active set. Neither presents splitting as a way to reduce active bytes.

A confirmed user edit or delete acts on the current entry. The revision shown when the dialog opened is display information, not an admission condition. An older draft can therefore overwrite a body changed while the dialog was open.

Existing supported journal records replay unchanged; entry ids, operation identities, and revisions are not renumbered or migrated.

The [component README](../../../../../projects/omp-context-pin/README.md) and its [Chinese edition](../../../../../projects/omp-context-pin/README.zh.md) are the public contract for the action list and observable behavior. The [component specification](../../../../spec/omp-context-pin.md) states the goals and invariants. The [current component decision](../09/15-omp-context-pin.md) remains in force; this decision extends it without changing its ownership, its `read` approval level, or its delegation of tunable limits to the component.

## Alternatives considered

- Keep `expectedRevision` required. Considered because it detects concurrent changes. It keeps read-before-write work and refuses a write after an unrelated update, so it does not satisfy the requirement that revision not be a caller condition.
- Make `expectedRevision` optional. Considered as a compatibility middle ground. It leaves two write modes with different concurrency behavior and keeps the old read-before-write path as the normal path.
- Keep `get` as the only full read. Considered to avoid a new action. Reading several entries requires several calls and can mix revisions from different moments.
- Give `show` an id parameter. Considered for symmetry with `get`. It would duplicate `get` and lose the single-call view of the complete active set.
- Keep the previous capacity text. Considered because it already reported the limit and attempted size. It did not direct attention to other active entries or explain why splitting does not reduce active bytes.

## Consequences

- An older user draft can overwrite a body changed while the dialog was open. The user confirms the write, but the dialog no longer protects against a concurrent change.
- An Agent that edits from an older view can overwrite a newer body. Removing the revision gate removes the refusal that made this visible.
- `show` can return a large body set and consume context. It is an explicit read, not a default action.
- A caller may ignore the whole-set capacity guidance and keep shortening one body. The guidance changes the message, not the model's behavior.
- Existing callers that still send `expectedRevision` may fail if the host rejects unknown fields. The public documentation and schema change together.
- The component README, component specification, and tool description can drift. They change in the same implementation, and this decision links the public surfaces.
