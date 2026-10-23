# Context Pin

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash
Reverses: [omp-context-pin](../../../archived/2026/09/15-r2-omp-context-pin.md)

English | [中文](./15-omp-context-pin.zh.md)

## Motivation

Maintain Context Pin as an opt-in capability of the self-contained `@ruokee/omp-smart-context` extension.

Users who install other context capabilities must not receive an extra model tool automatically. Existing Pin users need their accepted text, journal identities, and lifecycle behavior to survive the package cutover.

## Decision

The smart-context package owns Pin without a separate Pin package or runtime dependency. Independent `pinEnabled` defaults to `false` and comes from the package's native activation snapshot. An invalid Pin setting disables only Pin, leaving other valid capabilities available.

Disabled Pin registers no `ctx_pin` tool, `/ctx-pin` command, or Pin projection handler. Existing journal records and ordinary history remain intact. Enabled Pin registers once and initializes from the current session event context rather than waiting for a newly added handler to receive that event again. The host retains `/pin` for its own use.

The session journal remains authoritative. Supported `omp-context-pin`, `omp-context-pin-change`, and `omp-context-pin-result` data identifiers and schema version 2 remain unchanged, as do integer identities, revisions, retry identities, and replay. No user log is rewritten and no separate store is introduced. The existing reset, navigation, branching, restart, and compaction semantics remain in force.

The [tool contract](../10/17-context-pin-tool-contract.md) owns the six actions, current-entry writes, retry recognition before lookup, complete `show`, and source labels. Read operations do not write. User submission retains confirmation, and Agent changes use non-active delivery. All tool actions declare approval level `read`; Pin adds no authorization or source-admission gate and writes no user configuration. Retained text gains no instruction authority, restores no revoked permission, and reopens no completed work.

The [Pin Spec](../../../../spec/omp-smart-context/pin.md) owns usage, records, numbering, resets, persistence, cache behavior, and tunable byte limits. Limits constrain individual and total active bodies. Rejected writes change no state; entries remain readable over capacity and unpinning remains available. The [main Spec](../../../../spec/omp-smart-context/README.md) owns common goals, invariants, the host lower bound, and combined acceptance. The [Pin guide](../../../../../projects/omp-smart-context/docs/pin.md) explains user operations and limits.

Repository checks and local controlled runs of the actual journal and projection path establish acceptance. The final request after a committed compaction contains the latest effective text verbatim, without reviving an older revision after it. Combined requests do not repeat Pin projection or model rules, and each request has at most one alignment writer. Controlled responses establish these mechanisms, not model-generated summary quality, real Provider savings, or TUI behavior. Historical evidence retains its original conditions.

Migration requires explicitly enabling `pinEnabled`, removing the old extension, and restarting. The package does not install itself or migrate configuration automatically.

## Alternatives considered

- Enable Pin by default. Existing users would need no new switch, but users who install only for other capabilities would receive an extra model tool. Default-off preserves that choice at the cost of an explicit migration setting.

## Consequences

- Existing users who omit `pinEnabled` receive no new projection until they enable it. Journal data remains available for replay.
- Accepted user drafts can overwrite newer entry bodies under the current-entry contract. Old tail messages and opaque history may retain earlier text after an update.
- Active-body byte limits bound neither tokens, metadata, nor accumulated revisions, so a complete request can still overflow. Their values remain a component choice rather than an ADR constant.
- Canonical records and model projections are separate. Recovery across restarts, queuing, and compaction can omit a projection or deliver duplicate or stale revisions. A wrong boundary can lose accepted changes, and another extension or the final Provider transformation can alter message order. Acceptance therefore checks the final request of the tested combination.
- Provider-native remote compaction keeps some history opaque. Pin preserves that payload without claiming to deduplicate it.
- Retained text can be mistaken for permission, and session-scoped integers can collide across sessions or be recovered from the wrong range. Source labels, the note's wording, and the session-level high-water mark address these risks; the final Provider role is checked rather than assumed.
- Non-active delivery can defer changes to the next ordinary prompt. The current request derives its own changes from the canonical record. A user submission is identified by the text handed to the host and claimed once while that text is held.
- Request capture can leak credentials. Capture excludes sensitive transport fields before writing and does not change the actual request.
