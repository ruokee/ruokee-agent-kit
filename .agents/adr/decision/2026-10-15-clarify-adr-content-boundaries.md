# Clarify the ADR content boundaries

Decision owner: Ruokee
Decision writer: OMP
Reverses: [Clarify the ADR content boundaries](../archived/2026-09-23-clarify-adr-content-boundaries.md)

English | [中文](./2026-10-15-clarify-adr-content-boundaries.zh.md)

## Motivation

Define the ADR mechanism: its terminology, document types and locations, content boundaries, and when a record is updated or reversed.

The repository keeps long-lived choices in bilingual ADR proposals and decisions, which state the reason, the necessary contract, the lifecycle, and the grounds for reversal.

The problem is inside individual records: a reader cannot always identify the choice or its reason from the record alone, revisions carry implementation material that belongs in component documentation or code, and ordinary growth has been handled by reversing a broad decision because an earlier record fixed a document count, an internal mechanism, or a temporary omission as a permanent constraint.

## Analysis

The existing rules already exclude progress logs and copied implementation inventories, and the [tk documentation decision](./2026-10-04-share-tk-skill-references.md) assigns detailed contracts to their owning pages. They do not explain when a technical detail is essential to a decision, or require the opening to identify the work without its title.

Following the current reversal rules can still leave an unnecessarily narrow promise in place. The archived QoL decisions ([2026-09-20](../archived/2026-09-20-add-omp-qol.md), [2026-09-21](../archived/2026-09-21-reuse-a-matching-compaction-patch.md)) show one record stopping a process-wide adjustment whenever another owner was registered, and its successor allowing a matching activation to preserve the installed patch. That successor changed an explicit rule, so a reversal was warranted. The tk documentation successor instead treated a single fixed translation as the conflict that required restating a whole documentation policy, which made the reversal broader than the changed term.

The cleanup that produced this decision removes the type prefix from every ADR title and clears the punctuation the heading rule forbids from titles and subheadings, so it also edits archived pairs. Rewording those titles and subheadings keeps every recorded choice, reason, constraint, uncertainty, historical capability scope, authorship, date, and reversal relationship intact.

The relevant questions are whether the new choice contradicts an accepted rule, and whether that rule belongs at that level of detail. Fewer reversals alone do not make a decision better, and existing explicit constraints remain binding until deliberately changed.

## Decision

### Terminology

Use **ADR** as the primary term for an architecture decision record. This repository uses `.agents/adr` as its ADR root.

Use `proposal` and `decision` as the two document types. `proposal/` contains active proposals, `rejected/` contains rejected proposals, `decision/` contains current decisions, and `archived/` contains archived decisions. The directory expresses type and state, so ADR headers do not contain `Status`.

Use `Create decision`, `Update decision`, and `Reverse decision` as action phrases. `Reverse decision` is a verb phrase rather than a noun label. New decisions use `Reverses` in the header metadata block to link archived decisions, and archived decisions use `Reversed by` in the same block to link back.

Maintain `glossary.md` and `glossary.zh.md` at the ADR root. The initial glossary contains exactly ADR, proposal, decision, `Update decision`, and `Reverse decision`. Each entry has one concise definition that names the corresponding term in the other language. New entries require the maintainer to establish their meaning explicitly.

### Proposal workflow

Search active proposals and current decisions before planning a new requirement. Determine whether the requirement adds an unrelated capability, extends a current decision without conflict, or conflicts with a current decision.

Create one proposal for a requirement unless the maintainer requests another split. One proposal may create several decisions, reverse several decisions, or do both.

Merge an approved proposal to `main` as a dedicated change before implementation begins. Start implementation from that updated `main` on a new short-lived branch. After implementation, create the new decisions, update decisions that do not conflict, reverse conflicting decisions, and remove the consumed proposal in the implementation change. Git history preserves the independently merged proposal.

### Record format

Each ADR is one same-directory English and Chinese pair with reciprocal language links. Both files are semantically authoritative and move together. A semantic conflict blocks merge until the maintainer resolves it.

A proposal title carries the topic alone, `# <title>` in English and `# <标题>` in Chinese, because the directory states the type and state. Its body contains `Motivation`, `Proposal`, `Alternatives considered`, `Acceptance criteria`, and `Risks`, with an optional `Analysis` section between `Motivation` and `Proposal`. A rejected proposal adds `Rejection reason` and then freezes.

A decision title takes the same form. Its body contains `Motivation`, `Decision`, `Alternatives considered`, and `Consequences`, with an optional `Analysis` section between `Motivation` and `Decision`. An archived decision retains this format and freezes after relationship and factual link repairs.

A proposal records `Draft owner` and `Draft writer`; a decision records `Decision owner` and `Decision writer`. The owner is the accountable maintainer, and the writer records the original writer and does not change during later maintenance. Relationship and lifecycle metadata follows the writer field and precedes the reciprocal language links. Paths, commands, API names, metadata fields, and code identifiers retain their repository spelling in both languages.

The complete filename, including the date, language suffix, and extension, must not exceed 60 characters.

### Authoring the record

`Motivation` is the first required body section and states the concrete reason for considering or adopting the choice. Its first sentence identifies the subject and the concrete problem, intended change, or goal without relying on the title, links, or later text. A wanted capability need not be framed as a defect. A reversal proposal opens with the change it proposes, and a successor decision describes the complete choice it records.

An optional `Analysis` section follows `Motivation` and precedes `Proposal` or `Decision`; omit it when there is no substantive analysis. It records only observations, evidence, constraints, reasoning, and uncertainties that affect the choice. It is not an implementation plan or a copy of research notes, and it neither repeats `Motivation` nor the alternatives section.

An ADR records a coherent durable choice, its reasons, necessary boundaries and ownership, important public promises, and significant compatibility, safety, cost, and failure consequences. Include a technical detail only when omitting it would prevent the reader from understanding the choice or a material tradeoff, or would lose a contract that must be preserved, and use only the necessary fragment. Configuration authority, immutable identity, and process-wide side effects may be essential even when described with concrete identifiers. Full API and configuration tables, schemas, command references, and maintained inventories belong in their owning public documentation. Internal function names, algorithm steps, file-by-file edits, execution plans, test commands, and validation logs belong in implementation documentation, code, tests, or task materials. Acceptance criteria describe observable outcomes rather than test procedures. An ADR links accessible public contracts and must not cite ignored task materials as public authority.

Relocating a binding clause does not cancel it. Keep its meaning and an accessible reference, and retain enough original detail in a historical record to explain the choice at that time; a link to changing current documentation cannot replace the historical contract.

Distinguish an intentionally closed protocol, ownership rule, or safety boundary from examples and a growing inventory. Prefer a link to the owning inventory over a fixed count or exhaustive file tree, and state the protected boundary and reason when a closed set or prohibition is necessary. A present scope limit or an option not needed for an initial release is not automatically a permanent prohibition; describe that distinction when writing the decision. Do not retroactively downgrade an existing prohibition to escape it, or add speculative abstractions and configuration solely to make the wording extensible. Defensive rules must address the actual operation and harm: ordinary validation, repair, lifecycle changes, and repeated activation may need different preconditions, and identity, permission, and side-effect protections are preserved instead of being replaced by blanket restrictions unrelated to the protected boundary.

Record only alternatives that existed before writing or were genuinely considered, and only possible harmful outcomes as risks. An alternative must describe another course of action rather than a fact, requirement, constraint, acceptance criterion, implementation detail, or restatement. A risk must name a plausible harmful outcome caused by the proposal or by an omission, rather than relabeling facts, requirements, constraints, invariants, acceptance criteria, or tasks. Write `None` or `无` when the applicable section has no content. Descriptive level-three headings may organize a required section but never replace required level-two headings.

### Decision lifecycle

Use `Update decision` when new content does not conflict with a current decision. Append it under a final `Changes` section with a dated level-three heading. Link another decision when the addition deserves its own ADR. Purely editorial maintenance creates no new choice and needs no reversal.

Use `Reverse decision` for a conflicting choice. First merge a proposal that names every decision to reverse and identifies the effective clause, the proposed choice, and why both cannot hold; code size, an added feature, another host dependency, or a renamed file is not sufficient evidence by itself. After implementation, combine each old decision's still-effective rules with the accepted proposal into a complete new decision. The successor preserves the still-effective rules within the decision's scope; it does not reproduce the component's implementation specification. Add `Reverses` to the new decision's header metadata block and `Reversed by` to the archived decision's header metadata block, then move the old pair to `archived/` in the same change.

An archived decision adds `Archived: YYYY-MM-DD` to its header metadata block before an optional `Reversed by` and is no longer current authority. Current documentation must not cite it as current.

### Maintenance

Keep `proposal/`, `decision/`, `rejected/`, and `archived/` in Git with `.gitkeep` even when they contain ADR files.

The maintainer owns proposal approval, rejection, and decision archival. Agents may research, draft, implement, and review ADR changes within authorized work, but may not make those lifecycle decisions without explicit approval.

Keep current decisions accurate when factual paths, names, or verification entry points move. Factual maintenance must not express a conflicting choice.

Archived decisions freeze after relationship and factual link repairs, and rejected proposals freeze after factual link repairs. The naming rules and the heading rule apply to every ADR file, so bringing the file name, titles, and subheadings of an archived decision or a rejected proposal into line with them is ordinary maintenance rather than a granted exception. Such an edit keeps every recorded choice, reason, constraint, uncertainty, historical capability scope, authorship, date, and reversal relationship, and it neither unfreezes the record nor changes a binding promise.

Use review, repository search, and Git history rather than a dedicated ADR Skill, classification system, translation sidecar, archive manifest, or custom checker. Add a mechanical check only after repeated maintenance or an observed failure identifies a concrete invariant.

The full authoring policy lives in [the ADR guide](../README.md), with its [Chinese counterpart](../README.zh.md) and paired glossary.

## Alternatives considered

**Keep the prefix as a format literal.** Considered while scoping this change, on the reading that the header template rather than prose mandates it. This would repeat in the title what the directory already states and leave the conflict with the heading rule unresolved.

**Leave the ADR titles unchanged and clean the other surfaces only.** Considered while scoping this change. The heading rule covers ADR titles as well, so this would leave the repository disagreeing with its own rule.

## Consequences

The repository has one searchable bilingual location for proposals and decisions, with directory names that state document type and lifecycle state.

A title states the topic alone, so a reader or a script that classifies a record by its title alone misreads its type. The directory, the metadata block, and the reciprocal language links carry that information.

A proposal and its implementation require separate branches and mainline commits. This adds one review boundary but prevents implementation from silently defining the rationale it is supposed to follow.

Two authoritative language files can drift. Same-change review and reciprocal links reduce the risk but do not prove semantic equivalence mechanically.

Reversing a decision requires reconstructing a complete current contract. Review must compare the archived decision and accepted proposal so still-effective rules are not lost.

Separating a necessary contract from implementation material is a judgment rather than a mechanical check. Relocating a clause preserves it only when its meaning and an accessible reference survive.

Requiring a named incompatibility before a reversal narrows reversals. An addition that states no conflict is recorded through a dated `Changes` entry, with a link to a separate decision when it needs one; purely editorial maintenance creates no new choice, and existing constraints remain in effect.

Discovery depends on concise filenames and repository search rather than a central index. Additional structure is deferred until the active tree becomes measurably difficult to search.

The glossary stays deliberately small. Ordinary wording and unconfirmed synonyms do not become contractual terminology.

## Changes

### 2026-09-29 Require a single sentence opening paragraph

`Motivation` now opens with one short sentence stating what is to be done, written as the action itself rather than as a description of the record, and the concrete problem, background, reasons, and evidence move to the paragraphs after it. This replaces the earlier requirement that the first sentence identify the concrete problem, intended change, or goal. The rule itself is stated in [the ADR guide](../README.md), and the [motivation decision](./2026-08-22-use-motivation-heading-in-adrs.md) records the same update.

### 2026-10-14 Allow one bounded naming cleanup

The [naming rules](../../rule/documentation.md) now apply to the records already in the tree, so a file name or heading names one subject. One bounded exception allows the headings and file names of archived decisions and rejected proposals to be reworded under those rules. Every record keeps its choice, reason, constraint, uncertainty, historical capability scope, authorship, date, and reversal relationship, and the exception neither unfreezes a record nor grants continuing permission to edit frozen material.

### 2026-10-15 Drop the ADR title prefix

An ADR title now carries the topic alone in both languages, and the heading rule's punctuation ban applies to the titles and subheadings of every ADR file. The archived pairs are reworded under the same rule, keeping every recorded choice, reason, constraint, uncertainty, historical capability scope, authorship, date, and reversal relationship.

### 2026-10-15 Cancel the frozen record exceptions

The bounded exceptions granted to the three earlier cleanups are withdrawn. The naming rules and the heading rule apply to every ADR file, so bringing a record's file name, titles, and subheadings into line with them is ordinary maintenance. The maintainer directed this withdrawal on 2026-10-15 and exempted it from the reversal process, so the clauses above are amended in place rather than through a proposal and a successor decision. The withdrawal removes standing permission only; it does not reverse a recorded choice, reopen a cleanup, or restore the wording those cleanups replaced.
