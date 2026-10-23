# omp-context-pin

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash
Reverses: [omp-context-pin](../../../archived/2026/09/15-r1-omp-context-pin.md)
Archived: 2026-10-22
Reversed by: [Context Pin](../../../decision/2026/09/15-omp-context-pin.md)

English | [中文](./15-r2-omp-context-pin.zh.md)

## Motivation

Maintain the omp-context-pin extension as a first-party host component whose pinned text stays verbatim across compaction, and keep its capacity values with the component rather than with this decision.

The component exists, and its public surface is documented in the component README while the [component specification](../../../../spec/omp-smart-context/README.md) states its goals, invariants, and acceptance criteria.

## Decision

The host keeps `/pin` for its own use, so the component registers its own `/ctx-pin` command and `ctx_pin` tool.

Every action declares the lowest approval level, `read`. The component adds no authorization, confirmation, or source-admission check of its own, and it writes no user configuration.

The byte limits are the component's own defaults rather than values this decision fixes, so adjusting them is a component change.

The complete usage, record, numbering, reset, limit, persistence, and cache details are available in the [Pin specification](../../../../spec/omp-smart-context/pin.md), and the goals, invariants, host lower bound, and acceptance criteria in the [main specification](../../../../spec/omp-smart-context/README.md).

## Alternatives considered

None

## Consequences

- Pinned text and accumulated revisions consume context. The byte limits constrain active bodies only, so they bound neither tokens, metadata, nor older tail messages, and a full request can still overflow after compaction.
- The component README is the single documented source of the limits, and a component change that adjusts them conflicts with nothing recorded here.
- A branch whose active bodies exceed the current limit keeps its entries readable and refuses new writes until the total drops below the limit; unpinning is not capacity-checked, so such a branch can return under the limit on its own.
- The canonical record and its model projection are separate: a record can exist while its projection is missing, and recovery can deliver a duplicate or an older revision after the snapshot. Recovery across restarts, queuing, and compaction stays in the acceptance scope.
- Choosing the wrong boundary loses accepted changes or revives a superseded revision. Another extension can insert messages around a host summary or drop a snapshot, and the final provider transformation can change an order that looked right in a hook, so acceptance checks the final request of the tested combination.
- Provider-native remote compaction keeps part of the history opaque. The component keeps that payload as it is and does not claim to deduplicate it.
- Retained context can be read as granting permission, and session-scoped integers can collide across sessions or be recovered from the wrong range. Source labels, the wording of the note, and the session-level high-water mark are the controls, and the final role at the provider boundary is checked rather than assumed.
- Non-active delivery can defer a change to the next ordinary prompt, so the current request derives its own changes from the canonical record.
- A submission is identified by the text the extension handed the host, and a message with the same text is claimed once while that submission is held.
- Request capture can leak credentials. Capture excludes sensitive transport fields before writing and does not change the request sent to the model.
- The component's checks are part of the repository check entry point. They do not replace acceptance on a real host.
