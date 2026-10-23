# Specifications

Decision owner: Ruokee
Decision writer: OMP Claude Opus 5.5
Reverses: [Specifications](../../../archived/2026/10/04-r1-specifications.md)
Archived: 2026-10-23
Reversed by: [Specifications](../../../decision/2026/10/04-specifications.md)

English | [中文](./04-r2-specifications.zh.md)

## Motivation

Maintain bilingual current-target specifications through the internal `maintain-spec` Skill.

A spec gives maintainers and Agents one statement of what a component or repository area should be, its boundaries, and observable acceptance. Current decisions and their dated changes explain the reasons; component documentation owns the detailed user contract. None of those roles replaces the others.

The [predecessor](../../../archived/2026/10/04-r1-specifications.md) assigned writing, maintenance, and division-of-work rules to the spec README. Giving those rules to the Skill makes the complete method available on demand, while the README keeps the project inventory and supplements instead of a duplicate full guide.

## Decision

### Location

Specs live under `.agents/spec/`, beside ADRs and rules. Each component under `projects/`, including tk as a whole, has a spec. Distributed Skills, repository conventions, and host compatibility have specs. The [spec README](../../../../spec/README.md) owns the inventory and project supplements; adding or removing a component or a repository area needing a spec updates that inventory in the same change.

[maintain-spec](../../../../skills/maintain-spec/SKILL.md) is an English internal project Skill under `.agents/skills/`. The repository spec covers it and the internal ADR maintenance Skill. The public Skill spec continues to cover `skills/` and `variants/zh/skills/`; internal maintenance adds no public installation source or translation package.

### Target authority

A spec is a current target edited in place, with no revision history, review notes, task records, or session information. Derive it from confirmed requirements, current decisions including `Changes`, and owning component documentation. Archived decisions are not current authority and must not be cited or copied into a current spec. Existing implementation is not by itself approval of the target.

A spec must not conflict with a current decision. Identify conflicting clauses and follow the ADR mechanism before changing the target. A change that makes no durable choice needs no ADR. A decision can link a spec without replacing the decision's own contract. A change to a component target updates the spec, component, and component documentation together.

### Maintenance ownership

The Skill owns [structure](../../../../skills/maintain-spec/SKILL.md#write-the-current-target), [division of work](../../../../skills/maintain-spec/SKILL.md#division-of-work), and the maintenance method for creation, adjustment, removal, and boundary clarification. Applicable sections retain their order: goals, out of scope, public surface, invariants, host lower bound, acceptance criteria, and related ADRs. Inapplicable sections are omitted. Detailed commands, parameters, settings, formats, and maintenance declarations stay on their owning pages; a spec links them and supplies only needed context.

The project supplement owns same-directory English and Chinese pairs with reciprocal links immediately below the title and same-change semantic alignment. Language and Git policies are project choices, not universal requirements imposed by the Skill.

Agent entry points and the Skill description identify applicable work before loading. Agents load it for spec maintenance or review and when feature work affects a long-lived target. They read effective decisions and their changes, proposals, supplements, and necessary component sources, preserve unaffected requirements, and verify the resulting documents. Read-only requests remain read-only.

Task Goals can supply confirmed requirements, but the Skill does not form, interview for, revise, rename, or save them, or manage task lifecycle. An existing task file named `spec.md` remains task material. Use `maintain-adr` only when the work requires its distinct responsibility.

### Reference direction

Specs may link component files, component documentation, ADRs, and rules. Distributed components do not link to, name paths in, or depend on `.agents/spec/` for running, building, or distribution. Internal project Skills can read their maintained project documents; this does not relax public component self-containment.

Specs remain explanatory documentation handled by Markdown checks, without a dedicated checker or runtime consumer for the layer. The maintenance Skills themselves use native project discovery; their Markdown belongs to the known documentation check scope. Unknown files and shared check inputs retain complete validation.

## Alternatives considered

Place each spec inside its component directory. This puts it beside the code, but distributes maintainer material that reaches repository sources users do not need. Distributed Skills and repository conventions also lack a single component directory for their collective specs.

Keep full maintenance rules in the spec README and use a Skill only for steps. This preserves the old ownership, but splits the method across a procedure and a full rule source; the chosen ownership requires migrating effective clauses and references once.

## Consequences

Maintainers and Agents have one current statement of goals, boundaries, invariants, and acceptance per subject, with links to the decisions and documents that own details. The Skill and project supplement each have one responsibility.

A stale spec, omitted decision change, or imported historical rule can direct implementation toward the wrong target or remove required behavior. Current decisions govern conflicts, and target changes synchronize affected documents. Formatting cannot prove semantic agreement or successful use of the Skill. Actual maintenance sessions must show applicable loading, correct reading, and correct document results against confirmed requirements.
