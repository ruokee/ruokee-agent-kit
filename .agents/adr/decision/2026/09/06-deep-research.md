# deep-research

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash
Reverses: [deep-research](../../../archived/2026/09/06-r2-deep-research.md)

English | [中文](./06-deep-research.zh.md)

## Motivation

Remove the deep-research Skill from this repository.

The repository no longer distributes general-purpose research guidance. The packaging, capability-index, and complete-guidance requirements in the replaced decision applied to that distribution, so they no longer impose requirements here.

## Decision

The `deep-research` Skill and both language variants are removed from this repository. General-purpose research guidance is maintained in [rstack](https://github.com/ruokee/rstack).

No component, rule, or check in this repository depends on the Skill. Capability indexes and installation cover only the remaining Skills.

## Alternatives considered

Keep the Skill under a forwarding name. A stub would install as a real component, so users would receive an empty capability and two sources would still need alignment.

## Consequences

Users obtain research guidance from rstack. This repository's Skill checks and documentation no longer validate or describe it.
