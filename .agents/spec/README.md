# Specifications

English | [中文](./README.zh.md)

Specifications state the current target of a component or repository area. Before creating, changing, removing, or reviewing one, or when feature work changes that target, load [maintain-spec](../skills/maintain-spec/SKILL.md). The Skill owns the main writing and maintenance method. This page supplies repository locations, language conventions, and navigation.

## Project supplements

- Keep long-lived specs under `.agents/spec/`. Each component under `projects/` has a spec named after its directory. Adding or removing a component or a repository area that needs its own spec updates the inventory below in the same change.
- Each spec is a same-directory `name.md` and `name.zh.md` pair with reciprocal language links immediately below the title. Both describe the same target and change together.
- Use the Skill's section order. The Chinese headings are `目标`, `非目标`, `公共面`, `不变量`, `宿主下限`, `验收标准`, and `相关 ADR`, corresponding to `Goals`, `Out of scope`, `Public surface`, `Invariants`, `Host lower bound`, `Acceptance criteria`, and `Related ADRs`.
- Follow the [documentation rules](../rule/documentation.md), [Git rules](../rule/git.md), and [development checks](../rule/development.md#checks). These are project policies, not requirements for other users of the maintenance method.
- For a durable decision change, use [maintain-adr](../skills/maintain-adr/SKILL.md) with the [ADR project supplements](../adr/README.md).

## Spec files

- [.agents/spec/repository.md](./repository.md) covers repository conventions and internal project maintenance Skills.
- [.agents/spec/host-compatibility.md](./host-compatibility.md) covers maintenance lower bounds for components that load code into a host process.
- [.agents/spec/skills.md](./skills.md) covers distributed Skills in `skills/` and `variants/zh/skills/`.
- [.agents/spec/tk.md](./tk.md) covers `projects/tk` as a whole.
- [.agents/spec/omp-context-pin.md](./omp-context-pin.md) covers `projects/omp-context-pin`.
- [.agents/spec/omp-qol.md](./omp-qol.md) covers `projects/omp-qol`.
- [.agents/spec/omp-smart-cache.md](./omp-smart-cache.md) covers `projects/omp-smart-cache`.
- [.agents/spec/omp-status-bar.md](./omp-status-bar.md) covers `projects/omp-status-bar`.
- [.agents/spec/workloop.md](./workloop.md) covers the instruction workflow in `projects/workloop`.

## Related ADRs

- [Specifications](../adr/decision/2026/10/04-specifications.md)
