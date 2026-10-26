# Specifications

English | [中文](./README.zh.md)

This page is a non-spec index and project supplement. It navigates the complete specification sets and their language counterparts; it does not hold functional requirements omitted from them. Specifications state complete current requirements independent of the original implementation and its explanatory material.

Before creating, changing, removing, or reviewing a spec, or when feature work changes its target, load [maintain-spec](../skills/maintain-spec/SKILL.md). The Skill owns the maintenance method.

## Project supplements

- Keep long-lived specs under `.agents/spec/`. Each component under `projects/` has a complete set identified below. Use a named main file pair with coherent topic pairs, or a directory with a main README pair and topic pairs. Split by requirement area, not internal modules. Adding or removing a subject updates this index in the same change.
- Each spec is a same-directory `name.md` and `name.zh.md` pair. Both describe the same complete target and change together. Spec bodies have no repository-file links, including language, topic, ADR, rule, source, or component links. This index supplies navigation. A path that is itself an external interface may remain when its behavior is fully stated, not delegated.
- Use the Skill's applicable section order: `Goals`, `Out of scope`, `Public surface`, `Invariants`, `Host lower bound`, `Acceptance criteria`. Chinese equivalents are `目标`, `非目标`, `公共面`, `不变量`, `宿主下限`, `验收标准`. Omit inapplicable sections; no related-ADR section belongs in a spec body.
- Only this root README pair is the non-spec navigation exception. A component's main README inside the spec area, including smart-context's main specification, is a spec body and follows the same independence and link rules.
- Follow [documentation rules](../rule/documentation.md), [Git rules](../rule/git.md), and [development checks](../rule/development.md#checks). These are project policies, not requirements for every user of the maintenance method.
- For a durable choice change, use [maintain-adr](../skills/maintain-adr/SKILL.md) with [ADR project supplements](../adr/README.md). Relevant decisions are authoring evidence; readers do not need them to complete specification requirements.

## Spec files

### Repository

- Repository conventions and internal maintenance Skills: [English](./repository.md), [中文](./repository.zh.md).
- Host maintenance compatibility: [English](./host-compatibility.md), [中文](./host-compatibility.zh.md).
- Distributed Skills: [English](./skills.md), [中文](./skills.zh.md).

### tk

The following topics together specify tk:

- Product scope: [English](./tk.md), [中文](./tk.zh.md).
- Persistent data, discovery, lifecycle, and shared writes: [English](./tk-data.md), [中文](./tk-data.zh.md).
- Migration, rename, integrity checking, and cleanup: [English](./tk-maintenance.md), [中文](./tk-maintenance.zh.md).
- CLI commands and results: [English](./tk-interface.md), [中文](./tk-interface.zh.md).
- CLI Skill distribution: [English](./tk-distribution.md), [中文](./tk-distribution.zh.md).
- Agent behavior and material patterns: [English](./tk-agent.md), [中文](./tk-agent.zh.md).

### OMP QoL

The following topics together specify QoL:

- Component scope, shared configuration, and status: [English](./omp-qol.md), [中文](./omp-qol.zh.md).
- Continued waiting: [English](./omp-qol-waiting.md), [中文](./omp-qol-waiting.zh.md).
- Main-session error recovery: [English](./omp-qol-recovery.md), [中文](./omp-qol-recovery.zh.md).
- Compaction deadline: [English](./omp-qol-compaction.md), [中文](./omp-qol-compaction.zh.md).
- Native-history replay: [English](./omp-qol-replay.md), [中文](./omp-qol-replay.zh.md).
- Task arguments: [English](./omp-qol-task-arguments.md), [中文](./omp-qol-task-arguments.zh.md).
- Reply copying: [English](./omp-qol-copy.md), [中文](./omp-qol-copy.zh.md).

### OMP Smart Context

The following topics together specify smart-context:

- Main specification, settings, status, and migration: [English](./omp-smart-context/README.md), [中文](./omp-smart-context/README.zh.md).
- Shared request alignment: [English](./omp-smart-context/request-alignment.md), [中文](./omp-smart-context/request-alignment.zh.md).
- Remote alignment: [English](./omp-smart-context/remote.md), [中文](./omp-smart-context/remote.zh.md).
- Handoff alignment: [English](./omp-smart-context/handoff.md), [中文](./omp-smart-context/handoff.zh.md).
- Compaction usage: [English](./omp-smart-context/usage.md), [中文](./omp-smart-context/usage.zh.md).
- Model prompt rules: [English](./omp-smart-context/model-prompts.md), [中文](./omp-smart-context/model-prompts.zh.md).
- Context Pin: [English](./omp-smart-context/pin.md), [中文](./omp-smart-context/pin.zh.md).

### OMP Status Bar

The complete status-bar specification: [English](./omp-status-bar.md), [中文](./omp-status-bar.zh.md).

### workloop

The complete instruction-workflow specification: [English](./workloop.md), [中文](./workloop.zh.md).

## Related ADRs

### Repository decisions

- [Specifications](../adr/decision/2026/10/04-specifications.md).
- [Repository rules](../adr/decision/2026/10/12-repository-rules.md).
- [Repository dictionary](../adr/decision/2026/10/17-repository-dictionary.md).
- [Community conduct](../adr/decision/2026/10/26-community-conduct.md).
- [First-party capabilities](../adr/decision/2026/08/20-first-party-capabilities.md).
- [Component self-containment](../adr/decision/2026/08/24-component-self-containment.md).
- [Bilingual documentation](../adr/decision/2026/08/20-bilingual-docs.md) and [relative links](../adr/decision/2026/08/24-relative-links.md).
- [Skill variants](../adr/decision/2026/08/20-skill-variants.md).
- [Trunk development](../adr/decision/2026/08/20-trunk-development.md), [commit messages](../adr/decision/2026/09/17-commit-messages.md), [Markdown formatting](../adr/decision/2026/09/02-markdown-formatting.md), and [repository checks](../adr/decision/2026/09/12-repository-checks.md).
- [ADR mechanism](../adr/decision/2026/08/22-adr-mechanism.md) and [host maintenance](../adr/decision/2026/09/28-host-maintenance.md).

### tk decisions

- [Architecture](../adr/decision/2026/08/21-tk-architecture.md).
- [Runtime](../adr/decision/2026/08/28-tk-runtime.md).
- [Task data](../adr/decision/2026/08/28-tk-data.md).
- [Harness integration](../adr/decision/2026/08/28-tk-harness.md).
- [CLI access](../adr/decision/2026/09/02-tk-cli-mode.md).
- [Skill language](../adr/decision/2026/09/02-tk-language.md).
- [Distribution](../adr/decision/2026/08/28-tk-distribution.md).
- [Documentation](../adr/decision/2026/08/29-tk-documentation.md).

### OMP decisions

- [QoL](../adr/decision/2026/09/20-omp-qol.md), [Task argument cleanup](../adr/decision/2026/10/17-task-argument-cleanup.md), and [copy last reply](../adr/decision/2026/10/18-copy-last-reply.md).
- [Smart-context](../adr/decision/2026/10/12-smart-cache.md) and [shared request alignment](../adr/decision/2026/10/22-request-alignment.md).
- [Remote alignment](../adr/decision/2026/10/10-remote-alignment.md) and [handoff alignment](../adr/decision/2026/10/12-handoff-alignment.md).
- [Compaction usage](../adr/decision/2026/10/13-compaction-usage.md) and [model prompt rules](../adr/decision/2026/09/14-model-prompt-rules.md).
- [Context Pin](../adr/decision/2026/09/15-omp-context-pin.md) and [Pin tool contract](../adr/decision/2026/10/17-context-pin-tool-contract.md).
- [Status bar](../adr/decision/2026/09/04-omp-status-bar.md).

### Workflow decision

- [workloop](../adr/decision/2026/10/22-workloop.md).
