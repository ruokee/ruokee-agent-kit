# Specifications

Decision owner: Ruokee
Decision writer: OMP Claude Opus 5.5
Reverses: [Specifications](../../../archived/2026/10/04-r2-specifications.md)

English | [中文](./04-specifications.zh.md)

## Motivation

Maintain complete, implementation-independent bilingual specifications through the internal `maintain-spec` Skill.

A specification must let readers determine what functionality to build and what results establish conformance after the original implementation and its explanatory material are removed. The [predecessor](../../../archived/2026/10/04-r2-specifications.md) allowed repository links and delegated detailed requirements to component pages. That makes the target depend on those pages and cannot satisfy independent reconstruction.

Current decisions and their dated changes explain durable choices. Specifications contain the complete current requirements. Component guidance remains independently usable, design explains implementation, and validation records methods and evidence. Similar behavior may need expression for each audience; avoiding repeated wording must not remove necessary requirements.

The [earlier specification decision](../../../archived/2026/10/04-r1-specifications.md) assigned the full maintenance method to the spec README. The method remains in the Skill, while the README supplies project supplements and navigation.

## Decision

### Location

Specs live under `.agents/spec/`, beside ADRs and rules. Each component under `projects/`, including tk as a whole, has a complete specification set. Distributed Skills, repository conventions, and host compatibility also have specs. A coherent subject may use one file pair or several requirement topics; internal modules do not determine the split. The [non-spec index](../../../../spec/README.md) identifies each complete set and supplies both languages and related-decision navigation. Adding or removing a subject updates it in the same change.

[maintain-spec](../../../../skills/maintain-spec/SKILL.md) is an English internal project Skill under `.agents/skills/`. The repository spec covers it and the internal ADR maintenance Skill. The public Skill spec covers `skills/` and `variants/zh/skills/`; internal maintenance adds no public installation source or translation package.

### Target authority

A spec states the complete current purpose, required capabilities, input conditions, observable results, failures, boundaries, and acceptance. Preserve confirmed commands, parameters, settings, formats, file conventions, quantities, defaults, limits, and compatibility commitments when they affect the external contract. A technical identifier alone does not make a requirement an implementation detail.

A spec contains no description of the actual implementation's internal functions, algorithms, state containers, storage or build organization, or execution and validation records. For mixed content, retain the required behavior without imposing its mechanism. Different internal implementations may satisfy the same specification set.

The current target is edited in place, with no revision history, review notes, task records, session information, or ADR-like lifecycle. Authors read confirmed requirements, current decisions including `Changes`, and necessary documentation and implementation to recover facts and omissions. Those sources are not prerequisites for specification readers. Existing implementation alone does not approve a requirement. Archives explain history, not the current target.

A spec must not conflict with a current decision. Identify conflicting clauses and follow the ADR mechanism before changing the target. A change making no durable choice needs no ADR. A decision may link to a spec without replacing its own necessary contract. A target change updates the spec, component, and affected documentation together.

### Maintenance ownership

The Skill owns [structure](../../../../skills/maintain-spec/SKILL.md#write-the-current-target), [division of work](../../../../skills/maintain-spec/SKILL.md#division-of-work), and maintenance methods for creation, adjustment, removal, and boundary clarification. Applicable sections keep this order: goals, out of scope, public surface, invariants, host lower bound, acceptance criteria. Omit inapplicable sections. Related-decision navigation belongs outside the spec body.

Project supplements require same-directory English and Chinese pairs that describe the same complete target and change together. Their language links live in the non-spec index, not the spec bodies. Ordinary documentation retains reciprocal language links. Language and Git policy are project choices rather than universal Skill requirements.

Agent entry points and the Skill description identify applicable work before loading. Agents load it for spec maintenance or review and for feature work affecting long-lived targets. They read effective decisions and changes, relevant proposals, supplements, and necessary component sources, preserve unaffected requirements, and check the result. Read-only requests remain read-only.

Task Goals may supply confirmed requirements, but this Skill does not form, interview for, revise, rename, or save them or manage task lifecycle. An existing task file named `spec.md` remains task material. Use `maintain-adr` when the work needs that distinct responsibility.

### Reference direction

Spec bodies contain no repository-file links, including component files, source, documentation, other specs, ADRs, rules, or language counterparts. Bare paths, vague documented limits, and references to current implementation must not substitute for requirements. Paths that are themselves confirmed external interfaces may appear with their full required behavior. Non-spec indexes hold navigation, not omitted functional requirements.

Other repository documents may link to specs. Distributed components do not link to, name paths in, or depend on `.agents/spec/` for running, building, or distribution. Internal project Skills may read the project documents they maintain; this does not relax component self-containment.

Specs remain explanatory documentation handled by Markdown checks, without a dedicated checker or runtime consumer. Maintenance Skills use native project discovery, and their Markdown belongs to known documentation check scope. Unknown files and shared check inputs retain complete validation.

### Acceptance

Compare every affected topic with its confirmed requirements and effective decisions, including unlinked sources. Record requirement preservation, restored omissions, and removed implementation descriptions in the owning maintenance materials. Preserve quantities, conditions, exceptions, permissions, compatibility, and failure behavior. A conflict between original requirements and current decisions needs maintainer resolution, not an implementation-derived target.

Read the complete set without the implementation or explanatory material. A reader must be able to rebuild substantially the same functionality and judge conformance while choosing different internal methods. Reject both delegated requirements and implementation descriptions relabeled as targets. Check language equivalence, zero repository-file links, complete external navigation, inbound references, and fragments. Formatting alone establishes none of these semantic properties.

## Alternatives considered

Place each spec inside its component directory. This puts it beside the code but distributes maintainer material that users do not need. Distributed Skills and repository conventions also lack a single component directory for their collective specs.

Keep full maintenance rules in the spec README and use a Skill only for steps. This splits the method between procedure and rule sources; the selected ownership keeps the complete method in one Skill.

## Consequences

Readers have a complete current requirement set independent of the original implementation. Component users keep independently usable guidance. The Skill owns the maintenance method and the non-spec index owns navigation and local supplements.

Required behavior appears in specifications and user references for different purposes. A change reaching only one can produce conflicting instructions or acceptance, so affected documents must change together. A stale spec, omitted decision change, or historical rule treated as current authority can direct implementation toward the wrong target. Actual maintenance must establish correct loading, source use, requirement preservation, and document results; formatting cannot prove semantic agreement or successful Skill behavior.
