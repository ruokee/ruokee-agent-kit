# omp-status-bar

English | [中文](./omp-status-bar.zh.md)

Spec for [projects/omp-status-bar](../../projects/omp-status-bar/README.md).

## Goals

- Show one persistent status row below the OMP editor, built from providers in the order the user configures.
- Ship builtin providers for token counts, cache-hit rate, context usage, and answered-request count.
- Let other extensions add providers through the public provider contract.
- Mark the context window with a static glyph next to the context status.

## Non-goals

- Registering or replacing a native statusline segment.
- Amount, cost, or premium-request readings.
- A package-level `enabled` field. Enabling or disabling the OMP plugin is the only switch.
- Configuration hot reload.
- Reading compaction settings or estimating the speculative compaction band.

## Public surface

- Provider contract and registration: [projects/omp-status-bar/docs/provider-contract.md](../../projects/omp-status-bar/docs/provider-contract.md) and [projects/omp-status-bar/docs/provider-dev.md](../../projects/omp-status-bar/docs/provider-dev.md).
- Configuration file and fields: [Configuration](../../projects/omp-status-bar/docs/usage.md#configuration).
- Builtin providers, formulas, labels, and colors: [Builtin providers](../../projects/omp-status-bar/docs/usage.md#builtin-providers).
- `turn` and `context` providers: [Turn provider](../../projects/omp-status-bar/docs/usage.md#turn-provider) and [Context provider](../../projects/omp-status-bar/docs/usage.md#context-provider).
- Refresh and failure behavior: [Data refresh](../../projects/omp-status-bar/docs/usage.md#data-refresh) and [Failure behavior](../../projects/omp-status-bar/docs/usage.md#failure-behavior).

## Invariants

- The `context` status shows the Nerd Font glyph `U+F0068` to the left of its text as the context window marker. The glyph and the text form one status fragment, separated by one ordinary space, so a separator never falls between them.
- The glyph does not blink, does not change with context usage, and does not show the window size.
- The component reads no compaction setting and does not estimate a speculative compaction band. It has no state machine, sampling, diagnostics, documentation, or tests for such a band.
- The `context` status publishes nothing when usage data is missing or `contextWindow <= 0`.
- Token metrics and cache-hit rate count only the conversation's own usage on the current branch. Out-of-band model usage contributes nothing.
- Providers publish structured fragments. The host side of the component is the single place that sanitizes, styles, composes, and truncates them. An invalid fragment clears only that provider instance.
- Configuration is read once at session start. A malformed document starts nothing; an invalid entry is skipped while valid entries run.
- The component acts only when the extension context has UI support and stays idle in headless sessions.
- The component keeps no code path that exists only for hosts earlier than OMP 18.5.0, including reading compaction settings through `Settings.getGroup`.

## Host lower bound

OMP `18.5.0`, declared in [Compatibility](../../projects/omp-status-bar/README.md#compatibility). The `@oh-my-pi/*` development dependencies are locked at `18.5.0`, and tests use that host's behavior as their baseline. The general rules are in [.agents/spec/host-compatibility.md](./host-compatibility.md).

## Acceptance criteria

- `bun run typecheck` and `bun test` pass in the component directory.
- On OMP 18.5.0 or later, when context usage data exists, the `context` status shows the static `U+F0068` glyph to the left of its text.
- The component source contains no read of a compaction setting.
- The real terminal checks in [Release gate](../../projects/omp-status-bar/docs/usage.md#release-gate) pass before each release.

## Related ADRs

- [Maintain the OMP status bar with a static context glyph](../adr/decision/2026-10-04-show-static-context-glyph.md)
- [Maintain host components against a shared OMP floor](../adr/decision/2026-10-04-raise-omp-host-floor.md)
- [Keep distributable components self-contained](../adr/decision/2026-08-24-keep-components-self-contained.md)
