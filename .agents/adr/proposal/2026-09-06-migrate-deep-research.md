# ADR proposal: Add the deep-research Skill

Decision owner: Ruokee
Draft writer: OMP

English | [中文](./2026-09-06-migrate-deep-research.zh.md)

## Motivation

`deep-research` provides a structured, evidence-first research workflow for broad surveys and source-backed reports. Its behavior is defined by research instructions and does not require a Plugin runtime.

Ruokee Agent Kit needs this capability as a self-contained Skill with equivalent English and Chinese variants.

## Proposal

Provide `deep-research` as a pure Skill, following the [language variant packaging decision](../decision/2026-08-20-package-self-contained-skill-variants.md) and [component boundary decision](../decision/2026-08-24-keep-components-self-contained.md).

- Store the English instructions in `skills/deep-research/SKILL.md` and the Chinese translation in `variants/zh/skills/deep-research/SKILL.md`.
- Keep the Skill identity `deep-research` in both variants. Install either variant at the normal `skills/deep-research/` host path, without the `variants/zh/` prefix.
- Cover question clarification, identifying research dimensions, broad exploration, targeted research, evidence validation, and synthesis. Capture sources, distinguish claim types, produce reports by default, and record unresolved gaps. Use sub-agents for parallel research within the environment's concurrency limit. Research has no fixed time or token limit; stop when the work within the requested scope and all deliverables are complete.
- Each language variant consists of one `SKILL.md` containing the research instructions.
- Add the capability to the [English Skill index](../../../docs/en/skills.md) and [Chinese Skill index](../../../docs/zh/skills.md), linking each index to its corresponding variant.

## Alternatives considered

Distribute the capability as a Plugin for Claude Code and Codex. This would require host-specific packaging and distribution entry points. A pure Skill provides the research instructions without that additional maintenance.

## Acceptance criteria

- Both target `SKILL.md` files use `name: deep-research`, with equivalent `description` fields describing when to use the Skill.
- Both variants cover the research requirements in this proposal and are semantically aligned.
- Each component contains only its `SKILL.md` and is usable independently.
- Both Skill indexes link to the corresponding language variant.
- Repository checks pass with `pnpm check`.

## Risks

An incomplete translation could omit an evidence requirement or change when research stops, producing different research behavior between variants. Review the English and Chinese instructions together to check their semantic equivalence.
