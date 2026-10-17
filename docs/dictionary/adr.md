# ADR

English | [中文](./adr.zh.md) | [Dictionary](./README.md)

Chinese term: ADR

A bilingual record under `.agents/adr/` of a durable repository decision's rationale and contract, as a proposal or a decision.

## Mechanism

A proposal is reviewed and merged before implementation. After implementation, the decision records the agreed contract. Later changes either add non-conflicting content under `Changes` or create a successor decision and archive the old version.

## Example

A proposal records a new mechanism; after implementation, the decision records the agreed rules and the proposal is removed.

## Avoid

Avoid "ADR" for a progress log, release note, temporary plan, or routine change summary.

## Proposal

An ADR that describes a change for review before implementation and before any resulting decision is created or reversed. A proposal uses its own first proposal date and short canonical topic name. After approval, it merges to `main` as a dedicated change before implementation begins.

## Decision

An ADR that records a complete current choice, its rationale, alternatives, boundaries, and consequences. The decision is the durable authority; implementation follows it.

## Update decision

Add non-conflicting content to a current decision under `Changes` without archiving it. Each update gets a dated level-three heading.

## Reverse decision

Create a complete successor from an old decision's still-effective rules and an accepted proposal naming the conflict. The replaced version is archived with its actual archival date and a revision number; the successor keeps the original identity date and canonical path.

## Archived version

A replaced decision kept under `.agents/adr/archived/` with its identity date and revision number. It stays available for historical context but is not current authority.
