# ADR proposal: Clarify ADR content and reversal boundaries

Draft owner: Ruokee
Draft writer: OMP GPT-6 Astra

English | [中文](./2026-09-23-clarify-adr-content-boundaries.zh.md)

## Motivation

This proposal makes ADRs easier to review by requiring a self-contained opening sentence, separating optional analysis from the choice, limiting implementation detail, and cleaning up existing records without changing their meaning.

Readers need to identify the choice and its reasons without reviewing a component's entire implementation. Routine evolution should not require reversing a broad decision merely because it fixed a document count, an internal mechanism, or a temporary omission as a permanent constraint.

## Analysis

The [ADR guide](../README.md) already excludes progress logs and copied implementation inventories. The [tk documentation decision](../decision/2026-09-11-align-tk-usage-patterns.md#topic-ownership) also assigns detailed contracts to their owning pages. The general guide does not explain when a technical detail is essential to a decision, or require the first motivation sentence to identify the work independently.

A reversal can follow the existing rules correctly while exposing an unnecessarily narrow earlier promise. The [original QoL decision](../archived/2026-09-20-add-omp-qol.md#compaction-experiment-and-its-replacement) stopped a process-wide adjustment whenever another owner was registered. Its [successor](../archived/2026-09-21-reuse-a-matching-compaction-patch.md#compaction-experiment-and-its-replacement) allowed a matching activation to preserve the installed patch without becoming another owner. That changes an explicit rule. Separately, the [tk documentation successor](../decision/2026-09-11-align-tk-usage-patterns.md#motivation) cites a fixed translation as the conflict requiring the documentation policy to be restated. Translation ownership and record scope made that reversal broader than the changed term warranted.

The relevant questions are whether the new choice contradicts an accepted rule, and whether that rule belongs at that level of detail. Fewer reversals alone do not establish better decisions. Existing explicit constraints remain binding until deliberately changed.

## Proposal

### Open with the purpose, then add analysis only when needed

In proposals and decisions, the first sentence of `Motivation` must identify the subject and the concrete problem, intended change, or goal without relying on the title, links, or later text. A wanted capability need not be framed as a defect. A reversal proposal opens with the change it proposes; a successor decision describes the complete choice it records.

Allow an optional `## Analysis` section immediately after `## Motivation` and before `## Proposal` or `## Decision`. Chinese uses `## 分析` immediately after `## 动机`. Omit it when there is no substantive analysis. Preserve the other required sections.

Analysis contains only observations, evidence, constraints, reasoning, and uncertainties that affect the choice. It must not become an implementation plan or a copy of research notes. Motivation keeps the context needed to explain why the choice matters; neither section repeats the other or the alternatives section.

### Keep the choice and the necessary contract in the ADR

An ADR records a coherent durable choice, its reasons, necessary boundaries and ownership, important public promises, and significant compatibility, safety, cost, and failure consequences. Its scope need not be an entire component or a separate record for each parameter.

Include a technical detail only when omitting it would prevent the reader from understanding the choice or a material tradeoff, or would lose a contract that must be preserved. Use only the necessary fragment. Configuration authority, immutable identity, or process-wide side effects may be essential even when described with concrete identifiers.

Full API and configuration tables, schemas, command references, and maintained inventories belong in their owning public documentation. Internal function names, algorithm steps, file-by-file edits, execution plans, test commands, and validation logs belong in implementation documentation, code, tests, or task materials. Acceptance criteria describe observable outcomes rather than test procedures. An ADR links to accessible public contracts; it must not cite ignored task materials as public authority.

Relocating a binding clause does not cancel it. Keep its meaning and an accessible reference. In historical records, retain enough original detail to explain the choice at that time; a link to changing current documentation cannot replace the historical contract.

### Avoid accidental permanent constraints

Distinguish an intentionally closed protocol, ownership rule, or safety boundary from examples and a growing inventory. Prefer a link to the owning inventory over a fixed count or exhaustive file tree. Explain the protected boundary and reason when a closed set or prohibition is necessary.

A present scope limit or an option not needed for an initial release is not automatically a permanent prohibition. Describe that distinction when writing the decision. Do not retroactively downgrade an existing prohibition to escape it, or add speculative abstractions and configuration solely to make the wording extensible.

Defensive rules must address the actual operation and harm. Ordinary validation, repair, lifecycle changes, and repeated activation may need different preconditions. Preserve identity, permission, and side-effect protections instead of replacing them with blanket restrictions unrelated to the protected boundary.

### Demonstrate the conflict before reversing a decision

A reversal proposal must identify the effective clause, the proposed choice, and why both cannot hold. Code size, an added feature, another host dependency, or a renamed file is not sufficient evidence by itself.

Non-conflicting additions continue to use dated `Changes` entries, with a linked decision when an addition warrants its own ADR. Purely editorial maintenance does not create a new choice or require a reversal. A complete successor decision preserves the still-effective rules within the decision's scope; it does not reproduce the component's implementation specification.

### Clean up every existing record while preserving its history

Apply these rules to every English and Chinese ADR pair present when the cleanup begins, across active proposals, current decisions, archived decisions, and rejected proposals. Improve the opening, separate analysis where useful, and remove or relocate unnecessary implementation material. Check each pair rather than sampling.

Preserve the recorded choices, reasons, constraints, uncertainty, historical capability scope, original authorship, dates, and reversal relationships. Do not update an old record to describe today's functionality. Do not approve, reject, or implement another proposal through editing. If removing a detail would change a binding promise, retain it unless a separately identified contract change is approved. This cleanup does not rewrite Git history.

The cleanup requires a one-time exception to the [ADR mechanism decision](../decision/2026-09-02-establish-adr-mechanism.md#formats-and-bilingual-maintenance), which freezes archived decisions after relationship and factual link repairs and freezes rejected proposals. Structural and wording edits exceed those permissions even when meaning is unchanged. This proposal therefore names that decision for reversal. Its successor must preserve all other effective mechanism rules, add the authoring rules above, and state the bounded exception. Frozen records remain frozen outside this cleanup; approval of the proposal is not a general permission to rewrite them.

The [Motivation decision](../decision/2026-08-22-use-motivation-heading-in-adrs.md) receives a non-conflicting `Changes` entry for the first-sentence requirement. The bilingual guide and glossary must describe the resulting policy consistently. Only the mechanism replacement requires lifecycle and relationship changes; the other records retain their state. The separate [ADR maintenance Skill proposal](./2026-09-03-add-adr-maintenance-skill.md) remains unapproved, and this proposal introduces no Skill, metadata model, or custom checker.

## Alternatives considered

None

## Acceptance criteria

1. Both language versions of the guide require an independently understandable motivation opening and place optional analysis immediately after it for both ADR types.
2. The guide distinguishes necessary decision contracts from implementation material, closed constraints from growing inventories, and demonstrated contradictions from non-conflicting additions.
3. Every existing ADR pair receives a semantic check against these rules. Its choices and history remain recoverable, including any binding detail that cannot safely be removed or relocated.
4. The mechanism successor explicitly records the one-time frozen-record exception and preserves its other effective rules. The Motivation decision records its compatible refinement. Relationship links and current-authority references remain valid.
5. Both languages express the same obligations, exceptions, and historical meaning. The cleanup changes no component behavior and grants no approval to an unrelated proposal.

## Risks

- Treating a binding detail as incidental could silently weaken an accepted guarantee or erase the reason for a historical choice. Moving it to mutable documentation can also make the old choice impossible to reconstruct. Semantic preservation and accessible historical context are required before removing such text.
- Authors could interpret the distinction between inventories and contracts as permission to ignore an explicit restriction, or treat the frozen-record exception as continuing permission. Reversal still requires the exact conflict to be named, and the exception applies only to this cleanup.
