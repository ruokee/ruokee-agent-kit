# well-said

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash
Reverses: [well-said](../../../archived/2026/09/12-r4-well-said.md)

English | [中文](./12-well-said.zh.md)

## Motivation

Remove the well-said Skill from this repository.

The repository no longer distributes writing guidance. The documentation cleanup rule now uses the `wellsaid` Skill from rstack. The provenance, license, loading, and editing requirements in the replaced decision applied to the removed distribution, so they no longer impose requirements here.

## Decision

The `well-said` Skill and both language variants are removed from this repository. General-purpose writing guidance is maintained in [rstack](https://github.com/ruokee/rstack) under the `wellsaid` identity.

The documentation rules name that Skill for page cleanup. No component, rule, or check depends on the removed Skill. Capability indexes and installation cover only the remaining Skills.

## Alternatives considered

Keep a local copy of the writing guidance. Two sources would need reconciliation, and the installed version could differ from the local one.

Keep only the attribution and license text without the Skill. That text would describe material this repository no longer distributes.

## Consequences

Writing checks rely on the rstack Skill installed in the working environment. This repository's checks and documentation no longer validate its guidance.
