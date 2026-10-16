# ADR mechanism

Decision owner: Ruokee
Decision writer: OMP
Reverses: [ADR mechanism](../../../archived/2026/08/22-r4-adr-mechanism.md)

English | [中文](./22-adr-mechanism.zh.md)

## Motivation

Maintain bilingual ADR proposals and decisions with stable decision paths and traceable reversal histories.

An ADR preserves a durable choice, its rationale, necessary contract, and lifecycle. Successive versions need one current reference and separately accessible historical records, including when several reversals happen on the same day. Year and month directories group records without making their actual archival dates part of their identity.

The [previous mechanism](../../../archived/2026/08/22-r4-adr-mechanism.md) required naming maintenance to preserve each record's filename date. Its successors used different dates. Normalizing all versions to the decision's first proposal date changes that date meaning and historical maintenance boundary. It does not change the choices recorded by the other ADRs.

## Decision

### Terminology

Use **ADR** as the primary term for an architecture decision record. The ADR root is `.agents/adr`.

Use `proposal` and `decision` as the two document types. `proposal/` contains active proposals, `rejected/` contains rejected proposals, `decision/` contains current decisions, and `archived/` contains archived decisions. The directory expresses type and state, so headers contain no `Status` field.

Use `Create decision`, `Update decision`, and `Reverse decision` as action phrases. `Reverse decision` is a verb phrase rather than a noun label. A successor uses `Reverses` in its header metadata to link its archived predecessor, which uses `Reversed by` to link its actual successor.

Maintain `glossary.md` and `glossary.zh.md` at the ADR root. The glossary contains ADR, proposal, decision, `Update decision`, and `Reverse decision`. Each entry has one concise definition naming the corresponding term in the other language. New entries require the maintainer to establish their meaning explicitly.

### Identity

A decision's first proposal date and short canonical English topic name identify its current record and every archived version. Ordinary reversals preserve that date and name. The actual archival date stays in `Archived: YYYY-MM-DD`, and dated `Changes` entries keep their actual event dates.

A successor continuing the original topic retains its identity and revision sequence. A topic extracted into an independent decision gets its own first proposal date, canonical name, and sequence while preserving its actual source and reversal relationships. A shared predecessor or a `Reverses` link alone does not establish shared identity.

A proposal uses its own first proposal date, even when it proposes to reverse an older decision. Rejection preserves the proposal date. A reversal proposal's date does not replace the older decision's identity date.

### Paths

ADR bodies use these paths:

```text
.agents/adr/proposal/YYYY/MM/DD-name.md
.agents/adr/decision/YYYY/MM/DD-name.md
.agents/adr/rejected/YYYY/MM/DD-name.md
.agents/adr/archived/YYYY/MM/DD-rN-name.md
```

`YYYY` is a four-digit year; `MM` and `DD` are two-digit month and day values. Chinese counterparts use the same directory and basename with `.zh.md`. The current decision and all its archives use the identity's first proposal date for directory placement, even when archival happens in a later month or year.

Only archived decisions carry `rN`. The first reversal creates `r1`, and each later reversal of that identity increments `N` once. Days, months, and years do not reset it. Other decisions, ordinary updates, naming corrections, directory moves, language counterparts, and multiple relationship links do not consume its numbers. A successor replaces the current record at its canonical path without overwriting any archive.

Keep `.gitkeep` in each of the four lifecycle roots, including when they contain records. Create time directories only for actual records. The layout imposes no file-count limit on a month directory. The guide and glossary stay at the ADR root.

### Proposal workflow

Search active proposals and current decisions before planning a requirement. Determine whether it adds an unrelated capability, extends a current decision without conflict, or conflicts with a current decision.

Create one proposal for a requirement unless the maintainer requests another split. One proposal may create several decisions, reverse several decisions, or do both.

Merge an approved proposal to `main` as a dedicated change before implementation begins. Start implementation from that updated `main` on a new short-lived branch. After implementation, create the new decisions, update decisions that do not conflict, reverse conflicting decisions, and remove the consumed proposal in the implementation change. Git history preserves the independently merged proposal.

### Record format

Each ADR is one same-directory English and Chinese pair with reciprocal language links. The unsuffixed English file is the default public link. Both files are semantically authoritative, must be complete in the same change, and move together. A semantic conflict blocks merge until the maintainer resolves it. Authors may begin in either language.

A title carries the topic alone in both languages because the directory states type and state. A proposal contains `Motivation`, `Proposal`, `Alternatives considered`, `Acceptance criteria`, and `Risks`, optionally adding `Analysis` between `Motivation` and `Proposal`. Its Chinese sections are `动机`, `提议`, `考虑过的替代方案`, `验收标准`, `风险`, and optional `分析`. A rejected proposal adds `Rejection reason` or `拒绝原因` and freezes after factual link repairs.

A decision contains `Motivation`, `Decision`, `Alternatives considered`, and `Consequences`, optionally adding `Analysis` between `Motivation` and `Decision`. Its Chinese sections are `动机`, `决定`, `考虑过的替代方案`, `结果`, and optional `分析`. An archived decision retains this format and freezes after relationship and factual link repairs.

A proposal records `Draft owner` and `Draft writer`; a decision records `Decision owner` and `Decision writer`. The owner is the accountable maintainer; the writer is the original writer and does not change during later maintenance. Keep these fields identical across the pair. Omit provider, router, and channel prefixes from a model writer's name; a host or product name such as `OMP` may remain. Relationship and lifecycle metadata follows the writer field and precedes reciprocal language links. Paths, commands, API names, metadata fields, and code identifiers retain their repository spelling in both languages.

Apply the [documentation naming rules](../../../../rule/documentation.md#naming) to every ADR filename, title, and subsection heading. Name one subject with a short imperative, phrase, or noun, and leave details in the body. A date prefix in a `Changes` heading does not exempt its topic text. The complete leaf filename, including `DD`, any `rN`, topic, language suffix, and extension, must not exceed 60 characters.

### Authoring the record

`Motivation` is the first required body section. Its first paragraph is one short sentence stating what is to be done, written as the action itself rather than as a description of the record. It must make sense without the title, links, or later text. The following paragraphs carry the concrete problem, background, reasons, and evidence. A wanted capability need not be framed as a defect. A reversal proposal opens with its proposed change; a successor decision describes the complete choice it records.

Optional `Analysis` records only observations, evidence, constraints, reasoning, and uncertainties affecting the choice. Omit it when there is no substantive analysis. It is not an implementation plan or copied research notes, and does not repeat motivation or alternatives.

An ADR records a coherent durable choice, reasons, necessary boundaries and ownership, important public promises, and significant compatibility, safety, cost, and failure consequences. Include only the technical fragment necessary to understand the choice or a material tradeoff, or preserve a binding contract. Configuration authority, immutable identity, and process-wide side effects may require concrete identifiers.

Full API and configuration tables, schemas, command references, and maintained inventories belong in their owning public documentation. Internal function names, algorithm steps, file-by-file edits, execution plans, test commands, and validation logs belong in implementation documentation, code, tests, or task materials. Acceptance criteria state observable outcomes rather than test procedures. Link accessible public contracts; ignored task materials are not public authority.

Relocating a binding clause does not cancel it. Preserve its meaning and an accessible reference. Retain enough original detail in historical records to explain the choice at that time; a link to changing current documentation cannot replace the historical contract.

Distinguish intentionally closed protocols, ownership rules, and safety boundaries from examples and growing inventories. Prefer the owning inventory over fixed counts or exhaustive trees. Explain the protected boundary and reason for a closed set or prohibition. A present scope limit or an option not needed initially is not automatically a permanent prohibition. Do not retroactively downgrade an existing prohibition or add speculative abstractions and configuration merely to make wording extensible.

Defensive rules must address the actual operation and harm. Validation, repair, lifecycle changes, and repeated activation may need different preconditions. Preserve identity, permission, and side-effect protections rather than replace them with blanket restrictions unrelated to the boundary.

Record only alternatives that existed before drafting or were genuinely considered during requirement discussion or analysis. Identify where each became a real option. Each must be a different course of action for the same choice, not a fact, requirement, constraint, acceptance criterion, implementation detail, or restatement. Risks name credible harmful outcomes caused by adoption or a relevant omission. Delete unsupported or misclassified entries. Write only `None` in English and `无` in Chinese when the applicable section has no qualifying content. Descriptive level-three headings may organize required sections but never replace their level-two headings or carry progress history and copied inventories.

### Decision lifecycle

Use `Update decision` for non-conflicting additions. Append them under a final `Changes` or `变更` section with dated level-three headings. Link another decision when an addition deserves its own ADR. Purely editorial maintenance creates no new choice and needs no reversal.

Use `Reverse decision` for a conflicting choice. First merge a proposal naming every decision to reverse, the effective clause, the proposed choice, and why both cannot hold. Code size, an added feature, another host dependency, or a rename alone is insufficient. After implementation, combine each old decision's still-effective rules and the accepted proposal into a complete successor within that decision's scope, without copying the component's implementation specification.

Move the replaced bilingual version to its next archive revision in the same change. Add `Archived: YYYY-MM-DD` before optional `Reversed by` in the archive metadata. The successor's `Reverses` points to that archive, and the archive's `Reversed by` points to its actual successor. Archived records are not current authority.

Direct relationships follow versions. If A is reversed by B and later B by C, A's `Reversed by` follows B into B's archive rather than drifting to C at the current path. B still links to A; C links to B's archive. References to current authority use the canonical current path; citations of a particular historical choice follow that version to its archive. Classify each reference by its meaning, not its source directory. Stable file paths do not make heading fragments immutable.

### Maintenance

The maintainer owns proposal approval, rejection, and decision archival. Agents may research, draft, implement, and review within authorized work, but need explicit approval for those lifecycle decisions. Keep a rejected proposal only while its rationale prevents a realistic mistake.

Keep current decisions accurate when factual paths, names, or verification entry points move. Factual maintenance must not express a conflicting choice. Move language pairs together and repair relationship links, body links, language links, inbound references, and heading fragments in the same change, recomputing relative paths from each source's location.

Naming rules cover every retained proposal, decision, archive, and rejected proposal. Correct identity dates, canonical names, revision order, titles, and headings using content, relationship fields, proposal sources, and relevant Git history rather than treating existing names or links as authoritative. Correct evidenced relationship errors. Naming corrections do not add reversals or permit rewriting historical substance. Do not retain duplicate old files as compatibility aliases.

Preserve every recorded choice, reason, constraint, uncertainty, historical capability scope, original author, actual archival date, and event date. Identity-date normalization changes path dates, not actual events. Git history preserves original paths and per-record filename dates. A historical format example or Git object path may retain its original spelling when that spelling is the fact being cited. Ordinary naming maintenance neither unfreezes a record nor changes a binding promise.

Use review, repository search, and Git history rather than a dedicated ADR Skill, classification system, translation sidecar, archive manifest, index, or permanent maintenance script. Add a mechanical check only after repeated maintenance or an observed failure identifies a concrete invariant.

The [ADR guide](../../../README.md) owns detailed formats and operations, with its [Chinese counterpart](../../../README.zh.md) and paired glossary. The [repository specification](../../../../spec/repository.md) states lasting goals and observable invariants. Keep the guide, glossary, documentation rules, specification, and affected references aligned in both languages.

## Alternatives considered

**Keep per-record dates and the flat layout.** Considered for stable decision references and same-day reversals. Current paths would still change at each reversal, dates would not distinguish same-day archives, and lifecycle roots would accumulate ungrouped records.

**Apply the conventions only to future records.** Considered for historical correction. Existing long names, inconsistent identity dates, and incorrect relationships would remain, forcing readers to follow two conventions within one history.

## Consequences

Current authority has one stable path per decision, and each replaced version remains independently accessible. Identity-based year and month directories group its history even when archival happens years later. `Archived` records the event date rather than directory placement.

Direct relationships require maintenance when a current successor itself becomes archived. Treating every citation as current authority can silently redirect historical evidence to different content. Mistaking common ancestry for identity can combine independent decisions or assign the wrong sequence.

Titles carry topics, not types. Readers use directories, metadata, and language links to identify records. Discovery uses concise names and repository search rather than a central index.

A proposal and its implementation require separate branches and mainline commits. This preserves an independent rationale and review boundary. A reversal requires comparing the predecessor and proposal to reconstruct the complete current contract. Necessary contract detail and bilingual semantic alignment remain review judgments, not mechanically proven properties.

The glossary stays small. Ordinary wording and unconfirmed synonyms do not become contractual terminology.
