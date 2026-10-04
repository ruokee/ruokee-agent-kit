# omp-context-pin

English | [中文](./omp-context-pin.zh.md)

Spec for [projects/omp-context-pin](../../projects/omp-context-pin/README.md).

## Goals

- Keep pinned text available, verbatim, in every later ordinary model request on the current session branch until it is updated, unpinned, or the branch context is reset. Compaction does not end a pin.
- Give the user the `/ctx-pin` command and the Agent the `ctx_pin` tool as the two entry points.
- Keep the canonical record of pins in the session journal; change messages and tool results are projections of it.

## Non-goals

- Reading files, fetching URLs, watching pinned content, or changing an entry without an operation.
- Turning natural language into pin operations.
- Writing journal files, calling private host methods, creating a second session, or starting a turn to force a save. Persistence stays with the host.
- Migrating records written in an earlier unsupported format.

## Public surface

- Command, tool actions, and confirmed writes: [Usage](../../projects/omp-context-pin/README.md#usage).
- Record format, revisions, and numbering: [Records and revisions](../../projects/omp-context-pin/README.md#records-and-revisions).
- Reset behavior: [Reset](../../projects/omp-context-pin/README.md#reset).
- Size limits: [Limits](../../projects/omp-context-pin/README.md#limits).
- Persistence and cache behavior: [Persistence](../../projects/omp-context-pin/README.md#persistence) and [Cache behavior](../../projects/omp-context-pin/README.md#cache-behavior).

## Invariants

- The component registers exactly one slash command, `/ctx-pin`, and one tool, `ctx_pin`.
- The entry point decides the source: `/ctx-pin` writes user entries, `ctx_pin` writes Agent entries, and an entry keeps its creation source.
- Entry ids are positive integers within one session and are never reused.
- Both entry points check the per-entry and per-branch size limits before any state change.
- Agent writes are delivered for the next turn and never start a model turn.
- After a committed compaction the pinned snapshot is rebuilt from the branch's own records, byte-identical when the pinned state is unchanged. Without a committed boundary no snapshot is produced.
- Unknown, damaged, or invalid records make the affected range unavailable: reads report that state, writes are refused, and records are kept.
- The component claims no persistence that the host has not confirmed.
- The component keeps no code path that exists only for hosts earlier than OMP 18.5.0. This includes pre-activation host member checks, the `getEntries` capability probe, and the count fallback for user messages without `timestamp`.

## Host lower bound

OMP `18.5.0`, declared in [Compatibility](../../projects/omp-context-pin/README.md#compatibility). The `@oh-my-pi/*` development dependencies are locked at `18.5.0`, and tests use that host's behavior as their baseline. The general rules are in [.agents/spec/host-compatibility.md](./host-compatibility.md).

## Acceptance criteria

- `bun run typecheck` and `bun test` pass in the component directory.
- In a real OMP CLI session with a real model, the extension loads, creates, updates, and deletes pins through the tool, and a remaining pin stays in effect after manual compaction.
- No source branch is conditioned on a host earlier than OMP 18.5.0.

## Related ADRs

- [Add the omp-context-pin extension](../adr/decision/2026-09-15-add-omp-context-pin.md)
- [Maintain host components against a shared OMP floor](../adr/decision/2026-10-04-raise-omp-host-floor.md)
- [Keep distributable components self-contained](../adr/decision/2026-08-24-keep-components-self-contained.md)
