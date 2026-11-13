# architect

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash
Reverses: [architect](../../../archived/2026/08/22-r3-architect.md)

English | [中文](./22-architect.zh.md)

## Motivation

Remove the architect Skill from this repository.

The repository no longer distributes general-purpose architecture guidance. The activation contract, knowledge structure, evidence rules, and source adaptation in the replaced decision described that distribution, so they no longer impose requirements here.

## Decision

The `architect` Skill and both language variants are removed from this repository. General-purpose architecture guidance is maintained in [rstack](https://github.com/ruokee/rstack).

No component, rule, or check in this repository depends on the Skill. Capability indexes and installation cover only the remaining Skills.

## Alternatives considered

Keep the Skill under a forwarding name. A stub would install as a real component, so users would receive an empty capability and two sources would still need alignment.

## Consequences

Users obtain architecture guidance from rstack. This repository's Skill checks and documentation no longer validate or describe it.
