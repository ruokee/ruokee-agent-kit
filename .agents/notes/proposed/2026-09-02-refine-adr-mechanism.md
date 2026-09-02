# Agent Note: Refine the ADR mechanism

Status: proposed
Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol

English | [中文](./2026-09-02-refine-adr-mechanism.zh.md)

## Motivation

The current Agent Note mechanism established a useful place for durable decisions, but its terminology and lifecycle no longer match how the repository needs to work.

Agents have edited current records directly when a new choice should have gone through a proposal that reversed the existing decision. They have also invented alternatives and risks to fill required sections, kept lifecycle directories only while they contained records, and produced filenames that are harder to scan than the decisions they name.

The repository also needs a proposal to exist on `main` before implementation starts. A proposal may produce more than one decision or reverse more than one earlier decision. Proposals and decisions are different document types, while rejected and archived describe the final state of those types. Treating all four as one Note with a changing status obscures that model.

## Proposal

### Terminology and location

Use **ADR** as the primary term for an architecture decision record. Lowercase `adr` is acceptable where normal prose or tooling conventions require it, but it is not the preferred document name.

Each project's `AGENTS.md` selects either `docs/adr` or `.agents/adr` as its ADR root. This repository selects `.agents/adr`. Migrate the current records and instructions from `.agents/notes` to that directory as part of implementation.

Use `proposal` and `decision` as the two ADR document types. The `proposal/` directory contains active proposals, and `rejected/` contains rejected proposals. The `decision/` directory contains current decisions, and `archived/` contains archived decisions. The directory carries both the document type and its current state, so ADR headers do not contain a `Status` field.

Use `proposal` and `decision` as document-type nouns. Use `Create decision`, `Update decision`, and `Reverse decision` as action phrases. `Reverse decision` is a verb phrase; do not replace it with a noun phrase. Chinese documentation uses `提案`, `决定`, `创建决定`, `更新决定`, and `反转决定`. A new decision links to an archived decision with `Reverses`, and the archived decision links back with `Reversed by`.

Maintain `glossary.md` and `glossary.zh.md` at the ADR root as a semantically aligned bilingual pair. Each file links to its counterpart, and both ADR guides link to the glossary in their language.

The initial glossary contains exactly these confirmed concepts:

- ADR;
- `proposal` / `提案`;
- `decision` / `决定`;
- `Update decision` / `更新决定`;
- `Reverse decision` / `反转决定`.

Each entry contains one term and one concise definition that matches this mechanism. Do not add aliases, related-term lists, usage examples, directory states, headings, metadata fields, relationship labels, ordinary action wording, possible synonyms, or terms that have not been explicitly confirmed. `Create decision`, `Reverses`, and `Reversed by` remain instructions or link labels rather than glossary entries. A future term enters the glossary only after the maintainer explicitly establishes its meaning.

### Requirement intake and proposal scope

When a new requirement arrives, search the existing ADRs before planning implementation. Determine whether the requirement adds an unrelated capability, extends a current decision, or conflicts with a current decision.

A new capability may begin with a proposal. Create one proposal for the requirement unless the maintainer explicitly asks for a different split. One proposal may create several decision files, reverse several decisions, or do both.

Do not turn ADR maintenance into a Skill yet. The mechanism is still changing too quickly to justify a separately distributed capability.

### Proposal integration

Merge a proposal to `main` as a dedicated change before implementation begins. Under this repository's squash workflow, implementation starts from the resulting `main` on a new branch.

After implementation, create the new decisions, update decisions that do not conflict, reverse conflicting decisions, and remove the consumed proposal in the implementation change. Git history preserves the proposal as an independently merged artifact. A rejected proposal moves to `rejected/` instead of producing a decision.

### Update and reverse decisions

If new content does not conflict with a current decision, append it under `## Changes` or `## 变更`. A change may link to a new decision when the new content deserves its own ADR.

Do not rewrite a current decision to express a conflicting choice. Create a proposal that names the decisions to reverse. After implementation, combine the still-effective parts of each conflicting decision with the proposal's new content into a complete new decision. Add the new decision, archive the decisions it reverses, and update links in the same change.

Implementing this proposal reverses the current Agent Note mechanism decision. The actions that create, update, and reverse decisions are listed below.

### Proposal and decision formats

Organize the English and Chinese ADR guides around two separate templates rather than one template whose shape depends on `Status`.
Within the proposal section, document the active `proposal/` form first and the `rejected/` form second. Within the decision section, document the current `decision/` form first and the `archived/` form second.

A proposal uses `# ADR proposal: <title>` in English and `# ADR 提案：<标题>` in Chinese. It keeps `Decision owner`, `Draft writer`, and the language links, then requires `Motivation`, `Proposal`, `Alternatives considered`, `Acceptance criteria`, and `Risks`. A rejected proposal keeps this format and adds `Rejection reason` before it is frozen.

A decision uses `# ADR decision: <title>` in English and `# ADR 决定：<标题>` in Chinese. It keeps the same ownership and language metadata, then requires `Motivation`, `Decision`, `Alternatives considered`, and `Consequences`. Later compatible additions go under `Changes`. An archived decision keeps the decision format and becomes frozen history.

Neither template contains `Status`. The containing directory identifies whether a proposal is active or rejected and whether a decision is current or archived.

### Authoring rules

Keep every ADR filename at 60 characters or fewer, including the date, language suffix, and extension.

`## Alternatives considered` and `## 考虑过的替代方案` contain only options that existed before the ADR was written or were genuinely considered during the discussion. If there were no alternatives, write `None` or `无`.

`## Risks` and `## 风险` contain only possible harmful outcomes caused by the proposed or adopted choice, or by an omission in it. Facts, requirements, and invariants are not risks. If there are no risks, write `None` or `无`.

Keep `proposal/`, `decision/`, `rejected/`, and `archived/` in Git with a `.gitkeep` file, including when a directory has no ADR files.

### Required decision changes

This proposal defines one atomic repository-process change represented by one new decision. While this proposal remains under `.agents/notes/proposed/`, every current decision under `.agents/notes/implemented/` remains authoritative.

Reverse decision: [Add the Agent Note mechanism](../implemented/2026-08-22-add-agent-notes.md)

Create decision: `.agents/adr/decision/2026-09-02-establish-adr-mechanism.md`

Update decision: [Use Motivation as the opening section](../implemented/2026-08-22-use-motivation-heading-in-agent-notes.md)

Update decision: [Maintain English and Chinese public documentation](../implemented/2026-08-20-maintain-bilingual-public-documentation.md)

Update decision: [Use short-lived branches and squash into main](../implemented/2026-08-20-use-trunk-based-squash-workflow.md)

Update decision: [Maintain tk documentation](../implemented/2026-08-29-maintain-tk-documentation.md)

The decision listed under `Reverse decision` selects the primary term, root directory, single-document status model, and proposal-to-decision lifecycle that conflict with this proposal. The decisions listed under `Update decision` remain current and must not be placed under `Reverse decision` merely because their paths and terminology need migration.

The target repository state has these ADR changes:

1. move the pair listed under `Reverse decision` to `.agents/adr/archived/2026-08-22-add-agent-notes.md` and its Chinese counterpart;
2. add the pair listed under `Create decision` as the complete current ADR mechanism decision;
3. add a `Reverses` link from the new decision to the archived decision and a `Reversed by` link from the archived decision to the new decision before freezing the archived pair;
4. retain the still-effective bilingual, ownership, `Motivation`, fixed-section, lifecycle-authority, and searchable-history rules in the new decision, then add this proposal's rules for terminology, directories, document types, proposal integration, `Create decision`, `Update decision`, `Reverse decision`, filenames, glossary, alternatives, risks, and `.gitkeep`;
5. add dated `Changes` entries to the decisions listed under `Update decision`: keep `Motivation` first in both templates, point bilingual documentation to the ADR pair format, record the separate proposal and implementation merges in the trunk workflow, and replace the old status model in tk documentation;
6. migrate every other current decision pair from `.agents/notes/implemented/` to `.agents/adr/decision/`, convert its document header to the decision format without `Status`, and repair current terminology, paths, and links without changing its decision or placing it under `Reverse decision`;
7. add `.agents/adr/glossary.md` and `.agents/adr/glossary.zh.md` with only the five confirmed concepts listed above, reciprocal language links, and links from the corresponding ADR guides;
8. remove this proposal pair and leave `.gitkeep` in `proposal/`, `decision/`, `rejected/`, and `archived/`.

## Alternatives considered

**Keep Agent Note as the primary term and refine only the authoring rules.** This preserves the current paths and most existing text, but it retains terminology the maintainer has decided to replace and continues to model proposals and decisions as one document type with four statuses.

**Reuse the earlier proposal to package ADR maintenance as a Skill.** That proposal addressed a mechanism that has continued to change during actual use. Reusing it would freeze unstable rules into a distributable component, so this proposal keeps the mechanism in repository instructions and documentation.

## Acceptance criteria

- This proposal reaches `main` as its own merge before implementation starts.
- The root `AGENTS.md` selects `.agents/adr`, requires ADR search during requirement intake, and forbids direct conflicting edits to decisions.
- The ADR root contains `proposal/`, `decision/`, `rejected/`, and `archived/`, with each directory representing one document type and state.
- The English and Chinese ADR guides define separate proposal and decision formats without a `Status` field. They also define proposal integration, `Create decision`, `Update decision`, `Reverse decision`, filenames, glossary maintenance, alternatives, risks, and `.gitkeep` in equivalent terms.
- The ADR root contains a semantically aligned `glossary.md` and `glossary.zh.md` pair with exactly ADR, proposal, decision, `Update decision`, and `Reverse decision`; it contains no unconfirmed terminology.
- The target state archives exactly the Agent Note mechanism decision pair and adds exactly one complete new ADR mechanism decision pair under `decision/`.
- The archived mechanism decision contains `Reversed by`, and the new mechanism decision contains `Reverses`. The new decision carries every still-effective rule from the archived decision and every accepted rule from this proposal.
- The decisions listed under `Update decision` remain current and receive the dated updates named above.
- Every other current decision retains its meaning while its envelope, location, terminology, paths, and links migrate to the ADR mechanism.
- The target state removes this proposal pair and leaves all four ADR directories tracked with `.gitkeep`.
- Repository validation passes after the migration.

## Risks

Migrating the directory and terminology touches existing records and inbound links. A missed reference could leave broken navigation or two apparent sources of current ADR rules.

Reversing a decision can accidentally omit a still-effective rule from the historical decision. The new decision must be reviewed as a complete current contract before the old decision is archived.

An oversized glossary can make ordinary wording look like a fixed contract and create needless synonym disputes. Review must reject entries that the maintainer has not explicitly confirmed.
