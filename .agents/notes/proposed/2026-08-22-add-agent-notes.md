# Agent Note: Add the Agent Note mechanism

Status: proposed
Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol

English | [中文](./2026-08-22-add-agent-notes.zh.md)

## Problem

The repository has durable decisions about Skill ownership, host integration, package layout, persisted formats, and release policy, but no repository-owned place to preserve their rationale. The reasons currently live in conversations, task materials, branch context, or prose written for a specific implementation.

This makes later review depend on reconstructing intent from code and Git history. It also leaves no shared rule for distinguishing a current decision from a proposal, rejected option, temporary plan, or obsolete record.

A Chinese version is required for direct maintainer audit. The repository is public and uses English as its default documentation language, so a Chinese-only record would hide decision rationale from much of its audience.

## Proposal

Add a minimal evolving decision-record system under `.agents/notes/`. Call each record an **Agent Note** everywhere in the repository. The generic term `ADR` remains explanatory prose, not a second document type.

### Location

Store every Agent Note under `.agents/notes/`. Use `yyyy-mm-dd-topic-title` as the stable identity. The date records the first proposal and does not change when the pair moves. Start without classification subdirectories or a central index; repository search and the active lifecycle tree are enough at the current scale.

### Lifecycle

Encode lifecycle state in the path:

```text
.agents/notes/proposed/
.agents/notes/implemented/
.agents/notes/rejected/
.agents/notes/archived/
```

`implemented` notes remain current when factual paths, names, or verification entry points change. They may not be edited into a different decision. A reversal creates a new note and explicit supersession links. Archived notes are frozen history and not current authority.

### Format

Require a title, lifecycle status, decision owner, original draft writer, language switcher, and lifecycle-specific body:

- every note starts with `## Problem`;
- proposed notes require `## Proposal`, `## Alternatives considered`, `## Acceptance criteria`, and `## Risks`;
- implemented notes replace proposal language with `## Decision` and `## Consequences`;
- rejected notes preserve the proposal and add `## Rejection reason`;
- archived notes come only from implemented notes and record the archive date.

When a required section such as `## Proposal` contains substantial content, organize it with descriptive level-three headings. These headings remain inside the required section; they must not replace required level-two headings or become progress history and copied implementation inventories.

### Bilingual maintenance

Represent each logical note as one same-directory English and Chinese file pair. The unsuffixed `.md` file is English and is the default public link; `.zh.md` is the Chinese audit copy. Both are semantically authoritative and move through lifecycle directories together.

Authors may begin in either language. Both files must be complete in the same change, and a semantic conflict blocks merge until the maintainer resolves it. Status values, paths, commands, API names, and code identifiers remain in English in both files.

### Agent maintenance rules

The maintainer owns lifecycle decisions. Agents may research, draft, implement, and review notes within an authorized change, but may not accept, reject, or archive a note without explicit approval.

Keep the complete policy in `.agents/notes/README.md` with a Chinese counterpart. Put short subtree instructions in `.agents/notes/AGENTS.md`, and add only a trigger and ownership summary to the root `AGENTS.md`.

Do not add a dedicated Skill, classification system, translation sidecar, archive manifest, or custom checker in the first version. Add a mechanical check only after repeated maintenance or a real failure identifies an invariant worth automating.

## Alternatives considered

**Use `ADR` as the repository term.** It is familiar, but it describes architecture more narrowly than the process, storage, distribution, and host-contract decisions this repository also needs to preserve. It also competes with `Agent Note`, the established term in the reference design.

**Write only Chinese records.** This gives the maintainer the lowest-cost audit path, but conflicts with the public repository's English documentation policy and withholds rationale from external contributors.

**Put English and Chinese in one file.** A single file avoids missing counterparts, but every reader and Agent must load both languages. The structure becomes harder to scan, while semantic drift can still occur between the two sections.

**Adopt DeepSeek Harness's complete triplet and validation system now.** Hash sidecars, classification gates, translation tooling, and a frozen archive solve real problems at hundreds of notes. They add files and maintenance before this repository has shown the same failures.

**Keep decisions in ordinary documentation and Git history.** This avoids a new mechanism but does not give proposals, current decisions, rejected alternatives, and frozen history distinct identities or maintenance rules.

## Acceptance criteria

1. The repository uses `Agent Note` as the only document-type name for these records.
2. `.agents/notes/README.md` and its Chinese counterpart define location, lifecycle, format, additional headings, bilingual authority, and supersession.
3. `.agents/notes/AGENTS.md` provides concise instructions for Agents editing the subtree.
4. The root `AGENTS.md` tells Agents when to read the Note rules and preserves maintainer lifecycle ownership.
5. This proposal exists as a complete English and Chinese file pair in `proposed/`.
6. The first version adds no classification tree, central index, dedicated Skill, sidecar, archive manifest, or custom validation script.

## Risks

Two authoritative language files can drift. Same-change review and reciprocal links are sufficient at the initial scale but depend on discipline.

Requiring Chinese before merge adds work for external contributors. The contributor does not need to translate it personally; the maintainer or an Agent may complete the counterpart in the same branch.

Living implemented notes can duplicate source and user documentation. Notes should retain stable rationale and boundaries, then link to schemas, code, tests, and usage docs rather than copying their inventories.

Without classifications or an index, discovery depends on good slugs and repository search. Add structure only when the active tree becomes measurably difficult to search.
