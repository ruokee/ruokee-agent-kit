# ADR decision: Add the Agent Note mechanism

Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol
Archived: 2026-09-02
Reversed by: [Establish the ADR mechanism](../decision/2026-09-02-establish-adr-mechanism.md)

English | [中文](./2026-08-22-add-agent-notes.zh.md)

## Motivation

The repository has durable decisions about Skill ownership, host integration, package layout, persisted formats, and release policy, but no repository-owned place to preserve their rationale. The reasons currently live in conversations, task materials, branch context, or prose written for a specific implementation.

This makes later review depend on reconstructing intent from code and Git history. It also leaves no shared rule for distinguishing a current decision from a proposal, rejected option, temporary plan, or obsolete record.

A Chinese version is required for direct maintainer audit. The repository is public and uses English as its default documentation language, so a Chinese-only record would hide decision rationale from much of its audience.

## Decision

The repository uses a minimal evolving decision-record system under `.agents/notes/`. Each record is called an **Agent Note** everywhere in the repository. The generic term `ADR` remains explanatory prose, not a second document type.

### Location

Every Agent Note lives under `.agents/notes/`. `yyyy-mm-dd-topic-title` is its stable identity. The date records the first proposal and does not change when the pair moves. The first version has no classification subdirectories or central index; repository search and the active lifecycle tree are enough at the current scale.

### Lifecycle

The path encodes lifecycle state:

```text
.agents/notes/proposed/
.agents/notes/implemented/
.agents/notes/rejected/
.agents/notes/archived/
```

`implemented` notes remain current when factual paths, names, or verification entry points change. They may not be edited into a different decision. A reversal creates a new note and explicit supersession links. Archived notes are frozen history and not current authority.

### Format

Each note includes a title, lifecycle status, decision owner, original draft writer, language switcher, and lifecycle-specific body:

- new notes start with `## Motivation`;
- proposed notes require `## Proposal`, `## Alternatives considered`, `## Acceptance criteria`, and `## Risks`;
- implemented notes replace proposal language with `## Decision` and `## Consequences`;
- rejected notes preserve the proposal and add `## Rejection reason`;
- archived notes come only from implemented notes and record the archive date.

When a required section such as `## Proposal` or `## Decision` contains substantial content, descriptive level-three headings organize it. These headings remain inside the required section; they do not replace required level-two headings or become progress history and copied implementation inventories.

### Bilingual maintenance

Each logical note is one same-directory English and Chinese file pair. The unsuffixed `.md` file is English and is the default public link; `.zh.md` is the Chinese audit copy. Both are semantically authoritative and move through lifecycle directories together.

Authors may begin in either language. Both files must be complete in the same change, and a semantic conflict blocks merge until the maintainer resolves it. Status values, paths, commands, API names, and code identifiers remain in English in both files.

### Agent maintenance rules

The maintainer owns lifecycle decisions. Agents may research, draft, implement, and review notes within an authorized change, but may not accept, reject, or archive a note without explicit approval.

The complete policy was maintained in `.agents/notes/README.md` with a Chinese counterpart. Short subtree instructions lived in `.agents/notes/AGENTS.md`; the root `AGENTS.md` contained only a trigger and ownership summary.

The first version has no dedicated Skill, classification system, translation sidecar, archive manifest, or custom checker. A mechanical check is added only after repeated maintenance or a real failure identifies an invariant worth automating.

## Alternatives considered

**Use `ADR` as the repository term.** It is familiar, but it describes architecture more narrowly than the process, storage, distribution, and host-contract decisions this repository also needs to preserve. It also competes with `Agent Note`, the established term in the reference design.

**Write only Chinese records.** This gives the maintainer the lowest-cost audit path, but conflicts with the public repository's English documentation policy and withholds rationale from external contributors.

**Put English and Chinese in one file.** A single file avoids missing counterparts, but every reader and Agent must load both languages. The structure becomes harder to scan, while semantic drift can still occur between the two sections.

**Adopt DeepSeek Harness's complete triplet and validation system now.** Hash sidecars, classification gates, translation tooling, and a frozen archive solve real problems at hundreds of notes. They add files and maintenance before this repository has shown the same failures.

**Keep decisions in ordinary documentation and Git history.** This avoids a new mechanism but does not give proposals, current decisions, rejected alternatives, and frozen history distinct identities or maintenance rules.

## Consequences

The repository now has one searchable place for proposed, implemented, rejected, and archived decisions, with rationale and alternatives available in both languages.

Two authoritative language files can drift. Same-change review and reciprocal links are sufficient at the initial scale but depend on discipline.

Requiring Chinese before merge adds work for external contributors. The contributor does not need to translate it personally; the maintainer or an Agent may complete the counterpart in the same branch.

Living implemented notes can duplicate source and user documentation. Notes should retain stable rationale and boundaries, then link to schemas, code, tests, and usage docs rather than copying their inventories.

Without classifications or an index, discovery depends on good slugs and repository search. Add structure only when the active tree becomes measurably difficult to search.

## Changes

### 2026-08-22: Use a neutral Chinese translation for Consequences

The Chinese format translates `## Consequences` as `## 结果`, not `## 后果`. In Chinese, `后果` usually emphasizes harmful effects or negative outcomes associated with errors or improper conduct. `结果` is the broader, more common, and neutral term.

### 2026-08-22: Use Motivation as the opening section

The first required body heading changed from `## Problem` to `## Motivation` in English and from `## 问题` to `## 动机` in Chinese. `Motivation` covers observed problems, requirements, desired capabilities, and other concrete reasons for change. Every existing note was migrated in the same change, so the repository no longer contains a note body that opens with the earlier heading.
