# Specifications

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash
Reverses: [Specifications](../../../archived/2026/10/04-r3-specifications.md)

English | [中文](./04-specifications.zh.md)

## Motivation

Remove the specification layer and the internal Skill that maintained it.

Specifications duplicated requirements that component documentation and repository rules already had to state for their readers. Maintaining a second complete requirement set required every change to align multiple authorities, and a stale specification could direct implementation toward the wrong target. Component readers need goals, boundaries, and acceptance beside the component; repository contributors need conventions in the repository entry and rule layer.

## Decision

The repository no longer maintains a specification layer or its internal maintenance Skill.

Component goals, boundaries, public surfaces, invariants, host lower bounds, and acceptance live in the component `README.md` and the design and validation pages under its `docs/`. Repository layout, documentation conventions, checks, and merge workflow live in `AGENTS.md`, the root `README.md`, and `.agents/rule/`.

Current decisions record durable choices, their reasons, and necessary contracts. They do not carry complete requirement inventories, and they must not delegate requirements to a specification layer.

Bilingual pairing, component self-containment, language links, and repository file links remain governed by their existing decisions. Distributed components do not depend on maintainer-only repository documents at runtime, build time, or distribution time.

## Alternatives considered

None

## Consequences

Component changes update requirements in the documents their readers use, without a second complete requirement set to reconcile. Repository conventions have one layer. A requirement that no component document or rule states has no specification set to recover it, so affected documents must change with the behavior.
