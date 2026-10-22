# Document maintenance

Draft owner: Ruokee
Draft writer: OMP GPT-6-Astra

English | [中文](./03-document-maintenance.zh.md)

## Motivation

Adopt two internal Skills to maintain the repository's long-lived specifications and ADRs.

The repository's [spec guide](../../../../spec/README.md) and [ADR guide](../../../README.md) hold established maintenance contracts. Agents must apply those contracts when ordinary feature work changes a target or a durable choice. A Skill can make that method available on demand, with a description and project entry point that identify when to load it.

The Skills should own the main maintenance content. Keeping complete rules in the guides as well would leave two authorities to update. Project supplements remain necessary for language policy, Git workflow, and maintainer permissions.

## Proposal

### Internal scope

Adopt `maintain-spec` and `maintain-adr` under `.agents/skills/`, with an English `SKILL.md` entry in each directory. Each Skill owns the corresponding structure, maintenance rules, lifecycle, and operations. Split internal references when reading needs warrant it, without fixing a file count or adding a shared framework.

Use the project's existing mechanisms as the baseline. The spec and ADR README pairs keep project overrides, supplements, and navigation, rather than another complete rule set. Internal Skills are project maintenance material, not publicly distributed components. Their project-file references do not relax the self-containment contract for distributed Skills, extensions, plugins, or packages.

Public distribution, additional project or host adaptations, and initialization for projects without an adopted mechanism require a separate scope. This pilot adds no public installation source, language distribution copy, maintenance CLI, translation sidecar, archive manifest, or archive-by-age policy.

### Activation

Agents load the applicable Skill before creating, changing, or reviewing its documents, including when feature work affects long-lived targets or durable decisions. Project entry points state these triggers before the Skill is loaded. Ordinary reading, mentioning a document type, and maintaining a task Goal do not by themselves require either Skill.

Use native project Skill discovery and invocation. Loading one Skill does not always require the other: load both only when the maintenance crosses their responsibilities. Loading provides instructions, not permission to edit, approve, reject, archive, merge, or manage a task's lifecycle.

### Maintenance basis

Read applicable project instructions and supplements, relevant specifications, current decisions including their dated `Changes`, active proposals, and necessary component documentation. Read rejected proposals when checking a prior rejection, and archives or Git history when identity, authorship, relationships, or historical rationale require them. A proposal or existing implementation does not by itself approve a target change.

Before editing, identify the affected requirements and complete document set, including required language counterparts, lifecycle relationships, current-authority and historical citations, inbound links, and heading fragments. Preserve unaffected requirements, quantities, conditions, exceptions, permissions, and historical contracts. Read-only analysis and review return findings without modifying the reviewed documents.

Project supplements determine language policy and Git workflow. This project retains its bilingual requirements and existing integration rules. A project that permits an Agent to integrate a proposal without a separate approval does not acquire an additional approval gate from these Skills. Required language versions remain semantically aligned; an unresolved conflict is reported rather than resolved by silently preferring one version.

### Specification maintenance

`maintain-spec` maintains the current target of a component or repository area. It covers creation, adjustment, removal, and boundary clarification. It reads effective decisions and their changes, retains unchanged requirements, and distinguishes a changed target from an omission, implementation drift, or an editorial repair. A conflict with a durable decision requires the applicable ADR process; changing the spec must not conceal that conflict.

Specifications remain current documents edited in place. Their goals, boundaries, public surface, invariants, host lower bound where applicable, acceptance criteria, and related ADRs retain their existing meanings. Detailed commands and normative reference material stay on their owning pages. Task Goals may supply confirmed requirements, but their creation, interview, revision, and saving remain outside this Skill. A historical task file named `spec.md` is not thereby a long-lived project specification.

### ADR maintenance

`maintain-adr` covers creation, factual repair, non-conflicting updates, reversals, rejection, and archival under the adopted mechanism. It searches before classifying the change and does not create an ADR for an ordinary modification that changes no durable choice.

Preserve original authorship, first-proposal identity dates, stable current paths, each decision's continuous archive revision sequence, actual event dates, direct predecessor and successor relationships, and the distinction between current authority and a particular historical version. A successor contains every still-effective clause within its scope. Archived contracts retain enough detail to explain the choice at that time; a link to a changing Skill cannot replace them.

The Skill owns the existing content rules, including grounded alternatives, material consequences, credible risks, and valid empty sections. Project supplements retain maintainer-owned approval, rejection, and archival. Existing authority to perform an operation is reused; the Skill neither grants missing authority nor introduces a universal Git approval sequence.

### Decision succession

Three current decisions contain clauses incompatible with this ownership and scope:

- [ADR mechanism](../../../decision/2026/08/22-adr-mechanism.md#maintenance) chooses review, search, and Git history rather than a dedicated ADR Skill, and gives detailed formats and operations to the ADR guide. Adopt the Skill and move that main ownership to it. Its complete successor retains the other terminology, identity, sequence, authoring, bilingual, lifecycle, permission, history, and synchronization contracts. Review, search, and Git history remain part of maintenance. The exclusions of a classification system, translation sidecar, archive manifest, index, and permanent maintenance script remain effective. A mechanical check still requires repeated maintenance or an observed failure to identify a concrete invariant.
- [Specifications](../../../decision/2026/10/04-specifications.md#location) gives the spec README the main writing and division-of-work contract, with further ownership in `Spec format`, `Division of work`, and `Reference direction`. Transfer the main maintenance content to `maintain-spec`, leaving the project inventory and supplements in the README. Its complete successor retains current-target semantics, current-decision authority including `Changes`, bilingual documentation, reference direction for distributed components, and same-change synchronization.
- [Component self containment](../../../decision/2026/08/24-component-self-containment.md#decision) calls every Skill a distributable component, while its reference restriction applies to distributable components. Replace the broad classification with the distinction between public components and internal project Skills. Its complete successor retains all public file-reference restrictions, explicit prerequisites, independent language components, and component-local maintenance declarations. This corrects applicability rather than creating an exception to public self-containment.

The [repository rules decision](../../../decision/2026/10/12-repository-rules.md#ownership) keeps its one-owner principle. Repair affected ownership references and record non-conflicting clarification of the Skill and project-supplement responsibilities under `Changes`; a link repair does not reverse that decision.

After approval and implementation, preserve each reversed decision's identity and next unused archive revision, complete its bilingual successor, repair direct relationships and references according to their meaning, and remove the consumed proposal. Unchanged decisions and historical contracts are not rewritten merely to adopt the Skills.

## Alternatives considered

Keep the complete maintenance rules in project README files and let the Skills supply only a general procedure. This leaves the existing ownership in place, but an Agent must assemble the method from the procedure and a separate complete rule source on every maintenance task. Giving each Skill the main rules and operations makes that method available together; the cost is migrating ownership and preserving every effective clause and historical reference.

## Acceptance criteria

1. Both internal Skills provide complete maintenance methods, with discoverable triggers, accessible internal references, project supplements, and permission boundaries. Neither requires users to name it for each applicable maintenance task.
2. Skill rules and project supplements have one main owner per statement. Migration preserves effective conditions, exceptions, identity, authorship, lifecycle, language, and history contracts without retaining duplicate complete guides.
3. Project documentation consistently distinguishes internal Skills from distributed components. Public installation sources and self-containment requirements remain unchanged, and internal Skill Markdown belongs to the known documentation check scope while unknown or shared check inputs retain complete validation.
4. Long-lived specifications, current decisions, Skill instructions, project entry points, and both languages describe consistent responsibilities. The three conflicting decisions have complete successors with correct archives and direct relationships; the repository rules decision retains its non-conflicting choice.
5. Actual project maintenance sessions show applicable Skills loaded before the relevant operations without per-task prompting, effective sources read, and affected documents maintained correctly against confirmed requirements. Evidence covers each Skill's applicable behavior and identifies the files used and the resulting documents. Discovery, manual loading, file migration, and formatting alone do not establish this result.
6. Maintenance respects read-only requests, project language policy, and effective lifecycle permissions. Ordinary changes do not manufacture ADRs, and task Goal maintenance remains outside both Skills.

## Risks

Moving the full method into on-demand Skills makes correct maintenance depend on loading them. If an Agent follows an incomplete trigger or skips the Skill, the shortened project guide no longer supplies the omitted rules, so a spec update can lose requirements or an ADR change can corrupt historical relationships. Project-level triggers and actual maintenance evidence address this dependency; file discovery alone cannot establish correct use.
