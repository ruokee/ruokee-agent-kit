# Specifications

Decision owner: Ruokee
Decision writer: OMP Claude Opus 5.5
Archived: 2026-10-22
Reversed by: [Specifications](../../../decision/2026/10/04-specifications.md)

English | [中文](./04-r1-specifications.zh.md)

## Motivation

Keep bilingual specifications under `.agents/spec/` that describe the current target state of each component and repository area, while ADRs continue to record decisions and their reasons.

The repository had no document type whose job is to state what each component should be as a whole. That information was spread across current decisions, their dated `Changes` entries, and component documentation. For example, the target of a component removed since combined [the template-only decision](../../../archived/2026/09/07-r4-omp-system-prompt.md), [the model prompt rules decision](../../../archived/2026/09/14-r1-model-prompt-rules.md), and the component README pair. A reader had to merge these sources to learn the current target. The rules for the Skill system and for repository conventions were spread in the same way across current decisions, `AGENTS.md`, and the [repository README](../../../../../README.md).

ADRs are not meant to fill that role. The [historical ADR contract](../08/22-r6-adr-mechanism.md#authoring-the-record) defines an ADR as the rationale and contract of a durable decision, and a successor decision "does not reproduce the component's implementation specification". Component documentation serves people who install and use the component, and the repository instructions and README serve contributors working in the repository. None of them gives maintainers and Agents one current statement of goals, boundaries, and acceptance for a component, the Skill system, or repository conventions.

## Analysis

The following decisions supported the specification layer. None conflicted with it, so this decision reversed no decision. Historical references identify the contracts retained by this version.

- [Colocate bilingual public documentation](../../../decision/2026/08/20-bilingual-docs.md) requires same-directory `name.md` and `name.zh.md` pairs with reciprocal links for ordinary public pages, and `README.md` and `README.zh.md` for entry pages. Maintainer-only artifacts need translation only when their audience needs it. Specs are written for maintainers and Agents, and making them bilingual is within that decision. Its rule that detailed commands, parameters, and normative behavior stay on their owning pages also applies to specs.
- [Clarify the ADR content boundaries](../08/22-r6-adr-mechanism.md) defines what an ADR must contain. It states that relocating a binding clause does not cancel it and that a link to changing current documentation cannot replace the historical contract. A spec changes directly and keeps no history, so it cannot replace the contract recorded in a decision. ADR content rules and lifecycle stay unchanged.
- [Keep distributable components self contained](../08/24-r2-component-self-containment.md) forbids references from inside a component to files outside it and allows repository-wide documentation outside component directories to reference components. A spec under `.agents/spec/` is such documentation. Its `Changes` entry keeps each component's maintenance declaration inside the component.
- [Align tk usage patterns with shared Skill reference sources](../../../decision/2026/08/29-tk-documentation.md) gives each tk behavior one primary owning page under `projects/tk/docs/`, including system boundaries, invariants, and validation. A tk spec that restated them would create a second owner, so a spec links to an owning page instead.
- [Establish a first party Agent capability kit](../../../decision/2026/08/20-first-party-capabilities.md) adds new top-level structure only with a real component. `.agents/` already exists, so the layer adds no top-level area.

## Decision

### Location

Specifications live in `.agents/spec/`, beside `.agents/adr/`. A README pair at that root states how specs are written and how specs, ADRs, and component documentation divide their work.

Each component under `projects/`, including `projects/tk` as a whole, has a spec. The Skill system, covering `skills/` and the Chinese variants under `variants/zh/skills/`, has a spec, and so do repository-wide conventions and the host compatibility policy. The spec README owns the list of spec files. Specs are derived from current decisions and component documentation. Archived decisions are not current authority and are not copied into a spec.

### Spec format

The spec layer's README owns the writing contract. Each spec is a same-directory `name.md` and `name.zh.md` pair with reciprocal language links immediately below the title, describing the same target and changing together. Applicable sections appear in this order: `Goals`, `Out of scope`, `Public surface`, `Invariants`, `Host lower bound`, `Acceptance criteria`, and `Related ADRs`. Chinese counterparts are `目标`, `非目标`, `公共面`, `不变量`, `宿主下限`, `验收标准`, and `相关 ADR`. Omit inapplicable sections; repository conventions have no host lower bound.

A spec states the current target and is edited in place without revision history, review notes, task records, or session information. Its content comes from current decisions including `Changes` and component documentation. It neither cites nor copies archived decisions as current authority. Link owning pages instead of restating commands, parameters, settings tables, file formats, and maintenance declarations. Add only needed context, list related ADRs as links, and follow document-relative link rules.

### Division of work

The spec layer's README defines the division: a spec states what its subject should be; an ADR records a durable choice, reasons, alternatives, and consequences; a rule constrains an action; component documentation explains installation and use; repository documentation and README guide contributors; `AGENTS.md` supplies navigation and non-trivial rules. A spec must not conflict with a current decision. Conflicting target changes follow the ADR process before the spec changes. A spec edit that changes no durable choice needs no ADR; ADR rules determine when one is needed. A decision may link a spec without replacing its own contract. A change to a component target updates the spec, component, and component documentation in the same change.

### Reference direction

The spec layer's README defines one-way references. A spec may link component files, component documentation, ADRs, and rules. No file inside a distributable component links to, names a path in, or depends on `.agents/spec/`, keeping installed components independent of the repository. Specs are explanatory documentation; components do not depend on them to run, build, or be distributed. Existing Markdown checks handle them without a new check or other consumer for the layer.

### Repository entry points

The repository instructions and entry documents that direct readers to the ADR rules also name `.agents/spec/` and its purpose.

## Alternatives considered

**Place each spec inside its component directory.** A spec would sit next to the code it describes, but it would ship in the distributed component and reach maintainer material that users do not need. The Skill system and repository conventions have no single component directory to hold their specs.

## Consequences

Maintainers and Agents find one current statement of goals, boundaries, invariants, and acceptance for each component, the Skill system, repository conventions, and the host compatibility policy, with links to the decisions and documents that own the details.

A spec, a current decision, and a component document can describe the same target. A later change that updates only one of them leaves the others stale, and a maintainer or Agent who follows the stale text builds toward the wrong target or reports a false conflict. Linking to owning pages narrows the overlap but does not remove it, and no mechanical check proves agreement. Changes that alter a target therefore update the spec in the same change.

A spec that omits a later decision change, or carries over a rule from an archived decision, states a target that no current decision supports, and work that follows it can remove behavior a current decision still requires. A current decision wins over a spec that disagrees with it, and the spec is corrected.

Adding or removing a component, or a repository area that needs its own spec, also updates the spec list in the spec README.
