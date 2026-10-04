# ADR proposal: Add a specification layer

Draft owner: Ruokee
Draft writer: OMP Claude Opus 5.5

English | [中文](./2026-10-04-add-spec-layer.zh.md)

## Motivation

Add bilingual specifications under `.agents/spec/` that describe the current target state of each component and repository area, while ADRs continue to record decisions and their reasons.

The repository has no document type whose job is to state what each component should be as a whole. That information is spread across current decisions, their dated `Changes` entries, and component documentation. For example, the target of `omp-system-prompt` combines [the template-only decision](../decision/2026-10-04-use-system-prompt-template-only.md), [the model prompt rules decision](../decision/2026-09-14-add-model-prompt-rules.md), and the component README pair. A reader must merge these sources to learn the current target. The rules for the Skill system and for repository conventions are spread in the same way across current decisions, [AGENTS.md](../../../AGENTS.md), and the [repository README](../../../README.md).

ADRs are not meant to fill that role. The [ADR guide](../README.md) defines an ADR as the rationale and contract of a durable decision, and a successor decision "does not reproduce the component's implementation specification". Component documentation serves people who install and use the component, and the repository instructions and README serve contributors working in the repository. None of them gives maintainers and Agents one current statement of goals, boundaries, and acceptance for a component, the Skill system, or repository conventions.

## Analysis

The following current decisions bear on adding the layer. None of them conflicts with it, so the proposal reverses no decision.

- [Colocate English and Chinese public documentation](../decision/2026-09-07-colocate-bilingual-docs.md) requires same-directory `name.md` and `name.zh.md` pairs with reciprocal links for ordinary public pages, and `README.md` and `README.zh.md` for entry pages. Maintainer-only artifacts need translation only when their audience needs it. Specs are written for maintainers and Agents, and this proposal makes them bilingual, which that decision permits. Its rule that detailed commands, parameters, and normative behavior stay on their owning pages also applies to specs.
- [Clarify the ADR mechanism and content boundaries](../decision/2026-09-23-clarify-adr-content-boundaries.md) defines what an ADR must contain. It states that relocating a binding clause does not cancel it and that a link to changing current documentation cannot replace the historical contract. A spec changes directly and keeps no history, so it cannot replace the contract recorded in a decision. This proposal leaves ADR content rules, lifecycle, and glossary unchanged.
- [Keep distributable components self-contained](../decision/2026-08-24-keep-components-self-contained.md) forbids references from inside a component to files outside it and allows repository-wide documentation outside component directories to reference components. A spec under `.agents/spec/` is such documentation. Its `Changes` entry keeps each component's maintenance declaration inside the component.
- [Align tk usage patterns with shared Skill reference sources](../decision/2026-10-04-share-tk-skill-references.md) gives each tk behavior one primary owning page under `projects/tk/docs/`, including system boundaries, invariants, and validation. A tk spec that restated them would create a second owner, so a spec links to an owning page instead.
- [Establish a first-party Agent capability kit](../decision/2026-08-20-establish-first-party-capability-kit.md) adds new top-level structure only with a real component. `.agents/` already exists, so the layer adds no top-level area.

## Proposal

### Location and coverage

Specifications live in `.agents/spec/`, beside `.agents/adr/`. A README pair at that root states how specs are written and how specs, ADRs, and component documentation divide their work.

Each component under `projects/`, including `projects/tk` as a whole, has a spec. The Skill system, covering `skills/` and the Chinese variants under `variants/zh/skills/`, has a spec, and so do repository-wide conventions. The spec README owns the list of spec files. The first specs are derived from current decisions and component documentation. Archived decisions are not current authority and are not copied into a spec.

### Spec format

Each spec is one same-directory `name.md` and `name.zh.md` pair with reciprocal language links. Both languages are updated in the same change and describe the same target.

A spec uses these sections where they apply: goals, non-goals, public surface, invariants, host lower bound, acceptance criteria, and related ADRs. A section that does not apply to the subject, such as a host lower bound for repository conventions, is omitted.

A spec describes the current target state. It is edited in place and keeps no revision history, review notes, or task records.

### Division of work

A spec states what the subject should be. An ADR records a durable choice, its reasons, its alternatives, and its consequences. Component documentation tells users how to install and use the component.

A spec does not restate content that a component document or a current decision owns. It links to the owning page for command and parameter references, settings tables, file formats, and the component's maintenance declaration, and states only the context its readers need. Related ADRs are listed as links.

A spec must not conflict with a current decision. Changing a target in a way that conflicts with a current decision follows the ADR process before the spec changes. A spec change that alters no durable choice needs no ADR, and the existing rules decide when an ADR is required. ADRs keep their current content rules: a decision may link to a spec, but the link does not replace the contract the decision records.

When a change alters a component's target, it updates the spec together with the component and its documentation in the same change.

### Reference direction

References run one way. A spec may link to component files, component documentation, and ADRs. No file inside a distributable component links to, names a path in, or depends on `.agents/spec/`, so an installed component remains usable without the repository.

Specs are explanatory documentation. A distributable component does not depend on specs to run, build, or be distributed. Repository checks follow the current check rules, and this proposal adds no check or other consumer for specs.

### Repository entry points

The repository instructions and entry documents that direct readers to the ADR rules also name `.agents/spec/` and its purpose.

## Alternatives considered

**Keep target state in ADRs and existing documentation.** This is the current arrangement and adds no files to maintain. A reader still has to merge current decisions, their `Changes` entries, and component or repository documentation to learn the target of a component, the Skill system, or repository conventions.

**Place each spec inside its component directory.** This was considered when choosing the location. A spec would sit next to the code it describes, but it would ship in the distributed component and reach maintainer material that users do not need. The Skill system and repository conventions have no single component directory to hold their specs.

**Write specs in English only.** This was considered when weighing the translation cost of a new document set. It halves that cost, but Chinese review of targets would lose the paired, independently readable copy that other public documentation and ADRs provide.

**Replace the specification passages of current decisions with links to specs.** This was suggested during the requirement analysis as a way to remove duplicate content once specs exist. It conflicts with the rule in the ADR mechanism decision that a link to changing current documentation cannot replace a historical contract, and would require reversing that decision. The requirement for the layer does not call for it.

## Acceptance criteria

1. `.agents/spec/README.md` and `README.zh.md` exist with reciprocal links. They describe the location, the section convention, the division of work among specs, ADRs, and component documentation, and the one-way reference rule.
2. Each component under `projects/`, the Skill system, and the repository conventions has a spec pair with reciprocal language links, and each pair describes the same target in both languages.
3. No file inside a distributable component links to or names a path in `.agents/spec/`.
4. No spec conflicts with a current decision or cites an archived decision as current authority. Command and parameter references, settings tables, file formats, and maintenance declarations owned by component documentation are linked rather than copied.
5. The repository instructions and entry documents that point to the ADR rules also point to `.agents/spec/` and state its purpose.
6. A new decision records the specification layer, no current decision is reversed, and this proposal is removed.

## Risks

A spec, a current decision, and a component document can describe the same target. A later change that updates only one of them leaves the others stale, and a maintainer or Agent who follows the stale text builds toward the wrong target or reports a false conflict. Linking to owning pages narrows the overlap but does not remove it, and no mechanical check proves agreement.

The first specs are derived by reading many decisions and their `Changes` entries. A spec that omits a later change, or carries over a rule from an archived decision, states a target that no current decision supports, and work that follows it can remove behavior a current decision still requires.

The English and Chinese copies of a spec can drift. A reader of one language then works from a different target than a reader of the other.
