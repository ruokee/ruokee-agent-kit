# ADR

English | [中文](./adr.zh.md) | [Dictionary](./README.md)

Chinese term: ADR

An **ADR** (Architecture Decision Record) is a bilingual record under `.agents/adr/` of a durable repository decision's rationale and contract. It is either a current decision or a replaced decision retained as an archive.

## Mechanism

Tasks hold discussion, approval, and pending execution. A formal decision preserves the adopted choice and its necessary public reasons, including material rejected alternatives. For a choice requiring implementation, the decision is integrated with it under the [project integration policy](../../.agents/adr/README.md#integration); a document-only choice may be integrated independently. Later changes either add non-conflicting content under `Changes` or create a successor decision and archive the old version. [maintain-adr](../../.agents/skills/maintain-adr/SKILL.md) owns the maintenance method.

## Example

A task records the discussion and approval of a new mechanism. Its implementation and the decision documenting the adopted rules enter `main` together after authorized integration.

## Avoid

Avoid "ADR" for a progress log, release note, temporary plan, or routine change summary.

## Decision

An ADR that records a complete adopted choice, its rationale, alternatives, boundaries, and consequences. The current decision is the durable mainline authority until an authorized replacement is integrated. A durable choice not to adopt an option may also be a decision.

## Update decision

Add non-conflicting content to a current decision under `Changes` without archiving it. Each update gets a dated level-three heading.

## Reverse decision

Create a complete successor from an old decision's still-effective rules and an approved choice identifying the conflict. Archive the replaced version under its identity date with the next revision number, record the actual archival date in `Archived: YYYY-MM-DD`, and keep the successor at the canonical current path.

## Archived version

A decision that took effect and was later replaced, kept under `.agents/adr/archived/` with its identity date and revision number. It stays available for historical context but is not current authority. Unadopted drafts are not archived versions.
