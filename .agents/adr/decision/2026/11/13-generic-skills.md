# Generic Skills

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash

English | [中文](./13-generic-skills.zh.md)

## Motivation

Keep general-purpose Skills in rstack and remove this repository's four copies.

`architect`, `code-quality`, `deep-research`, and `well-said` are general-purpose capabilities rather than parts of a component in this repository. rstack now maintains the same areas for daily work, so a local copy would need separate updates and could diverge from the version actually installed.

## Decision

This repository no longer distributes the four Skills or their Chinese variants. `skills/` and `variants/zh/skills/` keep the Skills used with this repository's own work, including `grill-me`, `python-engineering`, and `msgspec`.

General-purpose Skills are maintained in [rstack](https://github.com/ruokee/rstack). The repository README points readers there. The documentation cleanup rule uses the `wellsaid` Skill from rstack in place of the removed `well-said` Skill.

The replaced component decisions for `architect`, `deep-research`, and `well-said` are reversed by their successors. `code-quality` had no separate decision; this record covers its removal.

## Alternatives considered

Keep local copies of the four Skills. This would preserve one self-contained checkout but require maintaining the same guidance in two repositories; installed copies could then differ by source.

Remove only some of the four Skills. This would leave no stable criterion for which general-purpose capability belongs here, and the two sources would still require reconciliation.

## Consequences

Readers who need architecture, code review, research, or writing guidance install it from rstack. This repository's capability index, installation examples, and Skill checks cover only the remaining Skills.

The four capabilities leave this repository's release and validation scope. Fixes to them happen in rstack and reach users through that repository's releases.
