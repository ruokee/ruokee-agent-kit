---
name: maintain-adr
description: Maintain or review ADRs and their adopted mechanism. Load before creating, repairing, updating, reversing, rejecting, archiving, or reviewing an ADR, and when feature work affects a durable decision. Not for ordinary reading, general architecture discussion, or routine changes with no durable choice.
metadata:
  version: "1.0.0"
---

# Maintain ADRs

An ADR records a durable choice, its rationale, and its necessary contract. Maintain the project's adopted mechanism, rather than replacing it with another system or manufacturing a decision for an ordinary edit.

## Read the basis

1. Resolve the request, working location, affected topic, and current authorization. Review and analysis stay read-only. Loading this Skill grants no editing, approval, rejection, archival, merge, or task-lifecycle permission.
2. Read the project's ADR supplements, terminology, and applicable documentation rules. In this repository, start with [ADR supplements](../../adr/README.md). They define local language, Git, and permission policy. Explicit project overrides govern their stated differences; the remaining method below still applies.
3. Read [Record rules](./references/records.md) and [Writing rules](./references/writing.md) before maintaining or reviewing an ADR. These files own the default structure, lifecycle, and content rules.
4. Search relevant active proposals and current decisions, including their `Changes`, before classifying the requirement. Read relevant current specs and necessary component documents. Read rejected proposals when checking a previous rejection. Read archives or Git history when identity, authorship, direct relationships, or historical rationale require them.

A proposal, an existing implementation, or a generated document is not by itself approval. Reuse effective authorization without adding a universal approval sequence. If a necessary source, semantic decision, or protected permission is missing, preserve that gap and finish unaffected authorized work.

## Classify the operation

Use an ADR when a choice has real alternatives and changes a long-lived boundary such as architecture, ownership, a public or host contract, persisted format, compatibility, or repository-wide development and release policy. Local bug fixes, mechanical refactors, routine documentation edits, status reports, and temporary plans need no ADR unless they change such a choice.

Distinguish these operations before editing:

- Create a proposal for a durable choice not yet recorded, or a decision after its required approval and implementation.
- Repair an evidenced fact, expression, name, or link without changing the recorded choice.
- Update a decision with non-conflicting content under dated `Changes`.
- Reverse a conflicting decision through a proposal and a complete successor preserving all still-effective clauses in that decision's scope.
- Reject a proposal or archive a replaced decision only under the project's lifecycle authority.

Code size, an added feature, another host dependency, or a renamed file alone does not establish a reversal. Do not disguise a conflicting choice as factual maintenance. Do not archive by age, length, or an arbitrary quota.

## Determine the edit set

List the logical records and their required language versions, metadata, lifecycle moves, direct relationships, current-authority and historical citations, project supplements, affected specs, inbound links, and heading fragments. Determine each identity and its next archive revision from actual records, not from today's date or an assumed shared ancestor.

Load `maintain-spec` when a durable choice changes long-lived targets or acceptance. Do not require both Skills for every operation. A related document does not expand the current write boundary, and neither Skill maintains task Goals.

## Maintain the records

Apply the applicable creation, repair, update, reversal, rejection, or archival procedure in [Record rules](./references/records.md). Preserve requirements, quantities, conditions, exceptions, permissions, original authorship, actual event dates, and historical capabilities. An authorized correction of an evidenced metadata error is a factual repair, not permission to replace the original writer during ordinary maintenance.

Use [Writing rules](./references/writing.md) for the complete record, including alternatives and risk-like claims in `Consequences`. Do not invent entries to fill sections. Keep unique contracts or necessary reasons even when removing an unsupported entry.

Project supplements determine languages and Git workflow. A single-language project does not acquire translations from this Skill. Maintain required language versions as one logical record; unresolved semantic conflicts need an authorized decision, not silent preference for one language. Follow effective project permission without imposing this repository's Git sequence on other projects.

## Check the result

Compare the result with the request, accepted choice, prior contract, current decisions and their changes, and project supplements. Confirm that each successor contains the still-effective clauses, each archive explains the historical choice, and no unchanged contract disappeared during relocation.

Check identity dates, continuous revision order, owner and writer fields, actual archival and change dates, direct predecessor and successor links, and the distinction between historical and current authority. Resolve language links, relative paths, inbound links, and heading fragments from each source's location. A stable current path does not make its fragments immutable.

Run the applicable project checks. Separately judge semantic agreement, language equivalence, and historical relationships; formatting does not prove them. For reviews, report actionable findings and evidence without changing the reviewed target. For maintenance, report actual changed records, preserved relationships, checks, and unresolved issues in the owning work materials. Keep task state, candidate identifiers, and verification logs out of the ADR.
