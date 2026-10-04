# omp-qol

English | [中文](./omp-qol.zh.md)

Spec for [projects/omp-qol](../../projects/omp-qol/README.md).

## Goals

- Carry five independently switchable OMP adjustments in one package: continuing waits, continuing after an eligible transient model error, extending one compaction deadline, replaying native history in a resumed session, and aligning the remote compaction cache.
- Give them one installation, one configuration entry, and one set of checks, with a separate switch, availability state, and failure report for each adjustment.

## Non-goals

- Guards for external tools, and host behavior unrelated to these adjustments.
- Installing or migrating on the user's behalf, or modifying other extensions, user configuration, or installed host files.
- Message-only continuation, named-process waiting, or service-only continuation on the wait entry.
- Reducing the set of settings.

## Public surface

- Adjustments and defaults: [Adjustments](../../projects/omp-qol/README.md#adjustments).
- Settings, keys, defaults, and ranges: [Configuration](../../projects/omp-qol/README.md#configuration) and the `omp.settings` manifest in `package.json`.
- `/qol` status command: [Status](../../projects/omp-qol/README.md#status).
- Per-adjustment behavior, limits, and verification: [projects/omp-qol/docs/adjustments.md](../../projects/omp-qol/docs/adjustments.md).

## Invariants

- Every setting the manifest declared in `omp-qol` 0.5.0 remains, including the two cache settings `compactionCacheEnabled` and `compactionCacheProvider`, with unchanged keys, defaults, and ranges.
- `waitMessagesSeconds` and `waitProcessSeconds` have no effect on supported hosts. The English and Chinese documentation and the manifest setting descriptions say so.
- Wait continuation serves only the standalone `wait` entry. A missing, foreign, or unrecognized entry leaves native behavior in place and reports a bounded reason.
- The compaction deadline patch keeps its ownership checks. It refuses to coexist with a patch carrying the `Symbol.for("ruokee.omp.compaction-timeout.patched")` marker, and a later matching activation does not take over an existing owner.
- Configuration comes only from OMP plugin settings and is read once per activation.
- A fault in one adjustment does not disable the others. A rejected setting is named by key and rule without echoing its value.
- The component keeps no code path that exists only for hosts earlier than OMP 18.5.0, including the wait path that served only the builtin `hub` tool.

## Host lower bound

OMP `18.5.0`, declared in [Compatibility](../../projects/omp-qol/README.md#compatibility). The `@oh-my-pi/*` development dependencies are locked at `18.5.0`, and tests use that host's behavior as their baseline. The general rules are in [.agents/spec/host-compatibility.md](./host-compatibility.md).

## Acceptance criteria

- `bun run typecheck` and `bun test` pass in the component directory.
- The manifest matches the 0.5.0 manifest setting by setting: all settings, including both cache settings, keep their keys, defaults, and ranges.
- The descriptions of `waitMessagesSeconds` and `waitProcessSeconds` state that they have no effect.
- Each adjustment's real OMP CLI evidence is recorded under its verification section in [projects/omp-qol/docs/adjustments.md](../../projects/omp-qol/docs/adjustments.md), with unrun scenarios marked as not verified.

## Related ADRs

- [Maintain OMP quality-of-life adjustments on the standalone wait entry](../adr/decision/2026-10-04-use-standalone-qol-wait.md)
- [Use native plugin settings for Codex web access](../adr/decision/2026-09-10-use-codex-web-plugin-settings.md)
- [Maintain host components against a shared OMP floor](../adr/decision/2026-10-04-raise-omp-host-floor.md)
- [Keep distributable components self-contained](../adr/decision/2026-08-24-keep-components-self-contained.md)
