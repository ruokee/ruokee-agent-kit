# Host compatibility

English | [中文](./host-compatibility.zh.md)

Spec for the maintenance lower bounds of repository components that load code into a host process. The [host maintenance decision](../adr/decision/2026-10-04-raise-omp-host-floor.md) records the complete rules and their reasons.

## Goals

- Maintain every OMP-facing component against one shared maintenance lower bound, OMP `18.5.0`. The OMP-facing components are `omp-context-pin`, `omp-system-prompt`, `omp-qol`, `omp-status-bar`, `omp-codex-web-access`, and the OMP adapter of `tk`.
- Let each component state its own bound where its users read it.
- Keep components working on maintained hosts across host upgrades without carrying code for hosts outside the maintained range.

## Non-goals

- Using the bound as an installation, activation, or runtime gate. A host below the bound is not blocked, and a component may still work there without a maintenance commitment.
- A maintenance upper bound, a supported-version whitelist, or a public support matrix.
- A repository checker, compatibility manager, cross-component compatibility library, or supported-version table.
- Bounds for material distributed only as instructions or configuration, such as Skills and MCP configuration.

## Public surface

Each component's bound is declared in the compatibility section of its own README pair, and that section is authoritative:

- [projects/omp-context-pin/README.md](../../projects/omp-context-pin/README.md#compatibility)
- [projects/omp-system-prompt/README.md](../../projects/omp-system-prompt/README.md#compatibility)
- [projects/omp-qol/README.md](../../projects/omp-qol/README.md#compatibility)
- [projects/omp-status-bar/README.md](../../projects/omp-status-bar/README.md#compatibility)
- [projects/omp-codex-web-access/README.md](../../projects/omp-codex-web-access/README.md#compatibility)
- [projects/tk/omp/README.md](../../projects/tk/omp/README.md#compatibility) for the tk OMP adapter in `tools` mode
- [projects/tk/pi/README.md](../../projects/tk/pi/README.md#compatibility) for the tk Pi adapter in `tools` mode

The repository README summarizes the policy in [Component host maintenance](../../README.md#component-host-maintenance).

## Invariants

- Every OMP-facing component declares OMP `18.5.0` as its maintenance lower bound in both README languages, with no upper bound.
- Where a component has `@oh-my-pi/*` development dependencies, they are locked at `18.5.0`, and test fixtures and real-host checks use that release's host behavior as their baseline.
- Host peer declarations keep naming the host packages a component uses. Their ranges do not narrow to the bound or add a maintenance upper bound, and an unrestricted `*` declaration keeps that form. No installation condition, custom metadata field, or runtime version check carries the bound.
- Code paths, probes, fixtures, tests, and documentation sections that exist only for OMP hosts below `18.5.0` are removed. Host behavior introduced at or below the bound, such as the 18.5.0 subagent footer tail, stays supported.
- A component for another host derives its bound from the delivered component's load conditions, required capabilities, and behavior. When evidence is insufficient, the gap is recorded instead of a guessed bound.
- Inside the bound, an update keeps the results older maintained hosts had. Implementations are selected by capability or input structure, and by version only where shape cannot tell the cases apart and a semantic difference is documented.
- Failure stays local: an unavailable feature keeps native behavior or reports a bounded, locatable reason through the existing diagnostic channel without claiming success.
- Verification strength follows actual behavioral impact. Records state the evidence type, versions, scenarios, and uncovered areas.
- The shared OMP bound moves for every OMP-facing component together, and only through its own decision.

## Acceptance criteria

- Each OMP-facing component's README pair declares OMP `18.5.0` as its maintenance lower bound.
- Every `@oh-my-pi/*` development dependency in an OMP-facing component is `18.5.0`.
- No host peer declaration narrows to the bound or carries a maintenance upper bound, and no install, loading, registration, or diagnostic path compares the host version with the bound.
- Component source contains no branch conditioned on an OMP host earlier than `18.5.0`.

## Related ADRs

- [Maintain host components against a shared OMP floor](../adr/decision/2026-10-04-raise-omp-host-floor.md)
- [Keep distributable components self-contained](../adr/decision/2026-08-24-keep-components-self-contained.md)
- [Retain the approaching-deprecation extension's template functionality](../adr/decision/2026-10-07-retain-system-prompt-template.md)
- [Maintain the OMP status bar with a static context glyph](../adr/decision/2026-10-04-show-static-context-glyph.md)
- [Maintain QoL model prompts and existing quality-of-life adjustments](../adr/decision/2026-10-07-maintain-qol-model-prompts.md)
