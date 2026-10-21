# deep-research

Decision owner: Ruokee
Decision writer: OMP

English | [中文](./06-deep-research.zh.md)

## Motivation

Ship `deep-research` as a pure Skill with equivalent English and Chinese variants.

`deep-research` provides a structured, evidence-first research workflow for broad surveys and source-backed reports; its behavior is defined by research instructions and does not require a Plugin runtime.

## Decision

Provide `deep-research` as a pure Skill, following the [language variant packaging decision](../08/20-skill-variants.md) and [component boundary decision](../08/24-component-self-containment.md).

- Store the English instructions in [skills/deep-research/SKILL.md](../../../../../skills/deep-research/SKILL.md) and the Chinese translation in [variants/zh/skills/deep-research/SKILL.md](../../../../../variants/zh/skills/deep-research/SKILL.md).
- Keep the Skill identity `deep-research` in both variants. Install either variant at the normal `skills/deep-research/` host path, without the `variants/zh/` prefix.
- Cover question clarification, identifying research dimensions, broad exploration, targeted research, evidence validation, and synthesis. Capture sources, distinguish claim types, produce reports by default, and record unresolved gaps. Use sub-agents for parallel research within the environment's concurrency limit. Research has no fixed time or token limit; stop when the work within the requested scope and all deliverables are complete.
- Each language variant consists of one `SKILL.md` containing the research instructions.
- The [English repository README](../../../../../README.md) and [Chinese repository README](../../../../../README.zh.md) include the Skill in their capability indexes, each linking to both language variants.

## Alternatives considered

None

## Consequences

Either variant can be installed and used independently. Each component contains only its research instructions, without host-specific packaging to maintain.

Both variants use `name: deep-research`, with equivalent `description` fields describing when to use the Skill. Their research requirements remain semantically aligned.

Keep the capability-index links in both repository READMEs valid, and pass the repository check defined by the [repository check decision](./12-repository-checks.md).
