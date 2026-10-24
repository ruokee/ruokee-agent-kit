# deep-research

Decision owner: Ruokee
Decision writer: OMP
Reverses: [deep-research](../../../archived/2026/09/06-r1-deep-research.md)

English | [中文](./06-deep-research.zh.md)

## Motivation

Ship complete bilingual `deep-research` guidance as a pure Skill whose internal files are maintained by the component.

Research behavior comes from instructions, not a Plugin runtime. The predecessor fixed each language to one file, making an internal organization choice a public constraint without adding a research capability or installation guarantee.

## Decision

Provide `deep-research` under the [Skill packaging](../08/20-skill-variants.md) and [component boundary](../08/24-component-self-containment.md) contracts. The [English entry](../../../../../skills/deep-research/SKILL.md) and [Chinese entry](../../../../../variants/zh/skills/deep-research/SKILL.md) use the same `deep-research` identity, equivalent descriptions, corresponding file sets, and semantically equivalent instructions. Either language installs independently at the normal `skills/deep-research/` host path without source-only prefixes.

Cover question clarification, research dimensions, broad exploration, targeted research, evidence validation, and synthesis. Capture sources, distinguish claim types, produce reports by default, and record unresolved gaps. Use sub-agents for parallel research within the environment's concurrency limit. Research has no fixed time or token limit; stop when the requested scope and all deliverables are complete.

Each language's `SKILL.md` is the discoverable entry to complete, self-contained research guidance. The component owns its internal material organization without a fixed file count. It contains research instructions, not host-specific packaging or a Plugin runtime.

Both repository README language versions include the Skill in their capability indexes and link both language entries. Keep these links valid and apply the [repository checks](./12-repository-checks.md).

## Alternatives considered

Require one instruction file per language. This gives a predictable source shape but makes reference organization a repository decision even when research behavior and installation stay unchanged.

## Consequences

Each language remains independently installable and usable. Internal organization changes preserve complete research guidance, matching language file sets, and installed references without changing the public research contract.
