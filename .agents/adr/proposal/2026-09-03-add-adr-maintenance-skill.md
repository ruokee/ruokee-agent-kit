# ADR proposal: Add an ADR maintenance Skill

Draft owner: Ruokee
Draft writer: Mind (OMP GPT-5.6 Sol)

English | [中文](./2026-09-03-add-adr-maintenance-skill.zh.md)

## Motivation

The [ADR mechanism decision](../decision/2026-09-02-establish-adr-mechanism.md) chose review, repository search, and Git history instead of a dedicated Skill while the mechanism was still changing through use.

Establishing the current mechanism and later refining its authoring rules both required judgment that mechanical checks cannot supply.

An Agent currently reconstructs the maintenance procedure from project instructions, the local ADR guide, current records, and sometimes Git history. A narrow Skill can provide that procedure while local policy remains authoritative and free to change.

## Proposal

### Capability and activation

Add a first-party, model-invoked Skill named `adr`. Its English component lives at `skills/adr/SKILL.md`, with a complete Chinese variant at `variants/zh/skills/adr/SKILL.md`.

Use the Skill when a task creates, reviews, updates, reverses, rejects, archives, or otherwise maintains an ADR or its local policy. Also use it before changing a durable decision when applicable project instructions require ADRs. Do not activate it for general architecture discussion, ordinary documentation editing, or work in a repository that has no ADR mechanism.

The Skill only maintains an already adopted ADR mechanism. Approval, rejection, archival, and the durable decision itself remain with the maintainer.

### Local authority and reading order

Read applicable project instructions first. Then locate and read the project's ADR guide, terminology rules, active proposals, and current decisions relevant to the requirement. Read rejected proposals when checking whether the same requirement was rejected before. Read archived decisions and Git history only when a relationship, stable identity, original authorship, or prior rationale requires them.

The Skill provides classification, maintenance, and review steps. It must not embed fixed paths, templates, section names, status values, filename rules, language requirements, or lifecycle transitions from this repository. When local policy differs from the Skill's general procedure, local policy wins.

### Maintenance procedure

Before editing, search the records required by local policy and classify the request under the local mechanism's create, update, or reverse procedure.

Derive the complete edit set before changing files. Include required language counterparts, relationship and lifecycle changes, policy references, and affected inbound links.

Treat required language counterparts as one logical record and compare their meaning. Report a conflict instead of choosing one version on the maintainer's behalf.

Apply the local authoring rules to alternatives, risks, and empty sections. The Skill must not substitute its own content rules.

Complete independent work before requesting approval for a maintainer-owned lifecycle action. Before delivery, check the local structural, link, and semantic requirements and run the repository's current validation entry point.

### Decision replacement and packaging

This proposal conflicts with the current ADR mechanism decision's choice not to add a dedicated ADR Skill. If accepted and implemented, it will reverse [Establish the ADR mechanism](../decision/2026-09-02-establish-adr-mechanism.md). The replacement decision must preserve all still-effective mechanism rules and add the Skill's role.

Keep the first release to one `SKILL.md` in each language component. The procedure is short and used as a whole, so no `agents/`, `workflows/`, `references/`, examples, or glossary are needed. Document the Skill in the English and Chinese capability indexes during implementation.

## Alternatives considered

**Continue with review, repository search, and Git history.** The current ADR mechanism selected this course while the rules were new. It adds no distributed capability, but each ADR task must reconstruct the same classification, authority, bilingual-maintenance, and review procedure from repository files.

**Add a checker before a Skill.** The current mechanism decision deferred both. A checker can enforce stable mechanical invariants, but the observed maintenance work depended on classifying changes, finding decision ownership, judging whether alternatives were real, and comparing bilingual meaning. Those are not established mechanical checks.

**Require manual invocation.** This would make ADR maintenance available only when a user explicitly names the Skill. Direct ADR operations and project rules that require ADR review provide narrower activation signals. Requiring users to remember a separate invocation would allow the maintenance procedure to be skipped when it is most relevant.

## Acceptance criteria

1. `skills/adr/SKILL.md` and `variants/zh/skills/adr/SKILL.md` provide complete, semantically aligned variants of one model-invoked Skill. Each component contains only its own `SKILL.md`.
2. Activation covers direct ADR work, ADR policy changes, and durable decisions for which applicable project instructions require ADRs. It excludes general architecture discussion, ordinary documentation editing, and repositories without an ADR mechanism.
3. The Skill reads project instructions and local ADR authority before acting. It does not embed fixed paths, templates, section names, status values, filename rules, language requirements, or lifecycle transitions from this repository.
4. The procedure searches active proposals and current decisions, classifies create, update, and reverse work, derives the complete edit set, preserves maintainer-owned lifecycle actions, handles required language counterparts, repairs affected links, and runs local validation.
5. The review procedure rejects invented alternatives and risks, reports semantic conflicts instead of resolving them without authority, and accepts the local policy's empty form when no entry qualifies.
6. Implementation archives the current ADR mechanism decision and creates a complete replacement decision that preserves its still-effective rules and adds the Skill's role.
7. The English and Chinese capability indexes describe the same scope and model-invoked behavior.

## Risks

The Skill's general classification procedure may lag behind ADR practices used by individual projects. An Agent could enter the wrong maintenance path before applying local rules, producing an unnecessary proposal or modifying the wrong current record.

If project instructions rely on model activation as the only ADR trigger, an indirect durable change that the model fails to classify can bypass decision review and conflict with an existing decision.
