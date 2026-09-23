# ADR decision: Establish the ADR mechanism

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol
Reverses: [Add the Agent Note mechanism](./2026-08-22-add-agent-notes.md)
Archived: 2026-09-23
Reversed by: [Clarify the ADR mechanism and content boundaries](../decision/2026-09-23-clarify-adr-content-boundaries.md)

English | [中文](./2026-09-02-establish-adr-mechanism.zh.md)

## Motivation

The repository needs one durable and searchable place for architecture, ownership, host integration, persisted formats, distribution, and repository-process decisions. Their rationale must not depend on conversations, Task materials, temporary branches, or reconstruction from code and Git history.

The earlier Agent Note mechanism established that place, but its terminology and single-document status model did not match actual use. Proposals and decisions have different purposes. Rejected and archived describe the terminal states of those document types rather than two more document types.

The repository also needs proposals to reach `main` before implementation starts, explicit rules for updating or reversing current decisions, concise filenames, permanent lifecycle directories, and authoring rules that do not reward invented alternatives or risks.

## Decision

### Terminology and location

Use **ADR** as the primary term for an architecture decision record. This repository uses `.agents/adr` as its ADR root.

Use `proposal` and `decision` as the two document types. `proposal/` contains active proposals, `rejected/` contains rejected proposals, `decision/` contains current decisions, and `archived/` contains archived decisions. The directory expresses type and state, so ADR headers do not contain `Status`.

Use `Create decision`, `Update decision`, and `Reverse decision` as action phrases. `Reverse decision` is a verb phrase rather than a noun label. New decisions use `Reverses` in the header metadata block to link archived decisions, and archived decisions use `Reversed by` in the same block to link back.

Maintain `glossary.md` and `glossary.zh.md` at the ADR root. The initial glossary contains exactly ADR, proposal, decision, `Update decision`, and `Reverse decision`. Each entry has one concise definition that names the corresponding term in the other language. New entries require the maintainer to establish their meaning explicitly.

### Requirement intake and proposal integration

Search active proposals and current decisions before planning a new requirement. Determine whether the requirement adds an unrelated capability, extends a current decision without conflict, or conflicts with a current decision.

Create one proposal for a requirement unless the maintainer requests another split. One proposal may create several decisions, reverse several decisions, or do both.

Merge an approved proposal to `main` as a dedicated change before implementation begins. Start implementation from that updated `main` on a new short-lived branch. After implementation, create the new decisions, update decisions that do not conflict, reverse conflicting decisions, and remove the consumed proposal in the implementation change. Git history preserves the independently merged proposal.

### Formats and bilingual maintenance

Each ADR is one same-directory English and Chinese pair with reciprocal language links. Both files are semantically authoritative and move together. A semantic conflict blocks merge until the maintainer resolves it.

A proposal uses `# ADR proposal: <title>` in English and `# ADR 提案：<标题>` in Chinese. Its body contains `Motivation`, `Proposal`, `Alternatives considered`, `Acceptance criteria`, and `Risks`. A rejected proposal adds `Rejection reason` and then freezes.

A decision uses `# ADR decision: <title>` in English and `# ADR 决定：<标题>` in Chinese. Its body contains `Motivation`, `Decision`, `Alternatives considered`, and `Consequences`. An archived decision retains this format and freezes after relationship and factual link repairs.

A proposal records `Draft owner` and `Draft writer`; a decision records `Decision owner` and `Decision writer`. The owner is the accountable maintainer, and the writer records the original writer and does not change during later maintenance. Relationship and lifecycle metadata follows the writer field and precedes the reciprocal language links. Paths, commands, API names, metadata fields, and code identifiers retain their repository spelling in both languages.

`Motivation` is the first required body section and states the concrete reason for considering or adopting the choice. Descriptive level-three headings may organize a required section but never replace required level-two headings.

The complete filename, including the date, language suffix, and extension, must not exceed 60 characters.

### Update and reverse decisions

Use `Update decision` when new content does not conflict with a current decision. Append it under a final `Changes` section with a dated level-three heading. Link another decision when the addition deserves its own ADR.

Use `Reverse decision` for a conflicting choice. First merge a proposal that names every decision to reverse. After implementation, combine each old decision's still-effective rules with the accepted proposal into a complete new decision. Add `Reverses` to the new decision's header metadata block and `Reversed by` to the archived decision's header metadata block, then move the old pair to `archived/` in the same change.

An archived decision adds `Archived: YYYY-MM-DD` to its header metadata block before an optional `Reversed by` and is no longer current authority. Current documentation must not cite it as current.

### Authoring and maintenance

Record only alternatives that existed before writing or were genuinely considered. Record only possible harmful outcomes as risks. Write `None` or `无` when the applicable section has no content.

Keep `proposal/`, `decision/`, `rejected/`, and `archived/` in Git with `.gitkeep` even when they contain ADR files.

The maintainer owns proposal approval, rejection, and decision archival. Agents may research, draft, implement, and review ADR changes within authorized work, but may not make those lifecycle decisions without explicit approval.

Keep current decisions accurate when factual paths, names, or verification entry points move. Factual maintenance must not express a conflicting choice.

Use review, repository search, and Git history rather than a dedicated ADR Skill, classification system, translation sidecar, archive manifest, or custom checker. Add a mechanical check only after repeated maintenance or an observed failure identifies a concrete invariant.

The full authoring policy lives in [the ADR guide](../README.md), with its [Chinese counterpart](../README.zh.md) and paired glossary.

## Alternatives considered

**Keep Agent Note as the primary term.** This would retain the old paths and much existing prose, but it would preserve the single-document status model that obscured the distinction between proposals and decisions.

**Package ADR maintenance as a Skill now.** The mechanism is still changing through use. A distributed Skill would freeze rules before the repository has enough evidence that they are stable.

## Consequences

The repository has one searchable bilingual location for proposals and decisions, with directory names that state document type and lifecycle state.

A proposal and its implementation require separate branches and mainline commits. This adds one review boundary but prevents implementation from silently defining the rationale it is supposed to follow.

Two authoritative language files can drift. Same-change review and reciprocal links reduce the risk but do not prove semantic equivalence mechanically.

Reversing a decision requires reconstructing a complete current contract. Review must compare the archived decision and accepted proposal so still-effective rules are not lost.

Discovery depends on concise filenames and repository search rather than a central index. Additional structure is deferred until the active tree becomes measurably difficult to search.

The glossary stays deliberately small. Ordinary wording and unconfirmed synonyms do not become contractual terminology.

## Changes

### 2026-09-03: Refine the authoring rules for alternatives and risks

Agents must not invent alternatives or risks to fill required sections. Alternatives must have entered the actual choice and must describe another course of action rather than a fact, requirement, constraint, acceptance criterion, implementation detail, or restatement. Risks must name a plausible harmful outcome caused by the proposal or by an omission, rather than relabeling facts, requirements, constraints, invariants, acceptance criteria, or tasks. A section containing only `None` or `无` is complete when no entry qualifies.
