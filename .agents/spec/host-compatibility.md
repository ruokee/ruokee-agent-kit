# Host compatibility

English | [中文](./host-compatibility.zh.md)

Spec for the maintenance lower bounds of repository components that load code into a host process. The [host maintenance decision](../adr/decision/2026/09/28-host-maintenance.md) records the complete rules and their reasons.

## Goals

- Maintain every OMP-facing component against one shared maintenance lower bound, OMP `18.5.0`. The OMP-facing components are `omp-context-pin`, `omp-qol`, `omp-smart-context`, `omp-status-bar`, and the OMP adapter of `tk`.
- Let each component state its own bound where its users read it.
- Keep components working on maintained hosts across host upgrades without carrying code for hosts outside the maintained range.

## Out of scope

- Using the bound as an installation, activation, or runtime gate. A host below the bound is not blocked, and a component may still work there without a maintenance commitment.
- A maintenance upper bound, a supported-version whitelist, or a public support matrix.
- A repository checker, compatibility manager, cross-component compatibility library, or supported-version table.
- Bounds for material distributed only as instructions or configuration, such as Skills and MCP configuration.

## Public surface

Each component's bound is declared in the compatibility section of its own README pair, and that section is authoritative:

- [projects/omp-context-pin/README.md](../../projects/omp-context-pin/README.md#compatibility)
- [projects/omp-qol/README.md](../../projects/omp-qol/README.md#compatibility)
- [projects/omp-smart-context/README.md](../../projects/omp-smart-context/README.md#compatibility)
- [projects/omp-status-bar/README.md](../../projects/omp-status-bar/README.md#compatibility)
- [projects/tk/omp/README.md](../../projects/tk/omp/README.md#compatibility) for the tk OMP adapter in `tools` mode
- [projects/tk/pi/README.md](../../projects/tk/pi/README.md#compatibility) for the tk Pi adapter in `tools` mode

The repository README summarizes the policy in [Component host maintenance](../../README.md#component-host-maintenance).

## Invariants

- Every OMP-facing component declares OMP `18.5.0` as its shared maintenance lower bound in both README languages, with no upper bound, and its `@oh-my-pi/*` development dependencies and check baselines follow that release.
- Host peer declarations keep naming the host packages a component uses without narrowing to the bound. No installation condition, custom metadata field, version check, or install, loading, registration, or diagnostic path carries the bound.
- Code that exists only for hosts below the bound is removed, while behavior introduced at or below the bound stays supported.
- Inside the bound, an update keeps the results older maintained hosts had, and capability or input structure selects an implementation, with a version only where shape cannot distinguish the cases and a semantic difference is documented.
- Failure stays local: an unavailable feature keeps native behavior or reports a bounded, locatable reason without claiming success, and verification strength follows actual behavioral impact.
- A component for another host derives its bound from the delivered component's load conditions, required capabilities, and behavior, and the gap is recorded instead of a guessed bound when evidence is insufficient.
- The shared OMP bound moves for every OMP-facing component together, and only through its own decision.

## Acceptance criteria

- Each OMP-facing component's README pair declares OMP `18.5.0` as its maintenance lower bound.
- Every `@oh-my-pi/*` development dependency in an OMP-facing component is `18.5.0`.
- No host peer declaration narrows to the bound or carries a maintenance upper bound, and no install, loading, registration, or diagnostic path compares the host version with the bound.
- Component source contains no branch conditioned on an OMP host earlier than `18.5.0`.

## Related ADRs

- [Host maintenance](../adr/decision/2026/09/28-host-maintenance.md)
- [Component self containment](../adr/decision/2026/08/24-component-self-containment.md)
- [OMP status bar](../adr/decision/2026/09/04-omp-status-bar.md)
- [OMP QoL](../adr/decision/2026/09/20-omp-qol.md)
- [Smart context](../adr/decision/2026/10/12-smart-cache.md)
- [Remote alignment](../adr/decision/2026/10/10-remote-alignment.md)
- [Handoff alignment](../adr/decision/2026/10/12-handoff-alignment.md)
