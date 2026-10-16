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

Use **ADR** as the primary term, with `.agents/adr` as the root. The [ADR guide](../../../README.md#document-layout) owns the document types, the state the directory expresses, the action phrases, and the glossary rules. Maintain `glossary.md` and `glossary.zh.md` at the ADR root; they carry ADR, proposal, decision, `Update decision`, and `Reverse decision`, and a new entry requires the maintainer to establish its meaning explicitly.

### Identity

A decision's first proposal date and short canonical English topic name identify its current record and every archived version, and a topic extracted into an independent decision gets its own identity. The [ADR guide](../../../README.md#document-layout) owns the directory placement, the dates each record keeps, and the treatment of successors and extracted topics.

### Paths

The four lifecycle roots, the `YYYY/MM/DD` placement, the `rN` sequence, the `.gitkeep` rule, and the root location of the guide and glossary are in the [ADR guide](../../../README.md#document-layout).

### Proposal workflow

One requirement gets one proposal unless the maintainer requests another split, and an approved proposal merges to `main` as a dedicated change before implementation begins. The [ADR guide](../../../README.md#active-proposal) owns the merge order, the post-implementation steps, and the removal of the consumed proposal.

### Record format

Each ADR is one same-directory English and Chinese pair with reciprocal language links, and both files are semantically authoritative, complete in the same change, and moved together. The [ADR guide](../../../README.md#bilingual-files) owns the pair layout, the metadata fields and their order, and the language-link placement, its [document layout](../../../README.md#document-layout) owns the file naming rules, and its [proposal format](../../../README.md#proposal-format) and [decision format](../../../README.md#decision-format) own the title form and the required sections of each document type.

### Authoring the record

The [authoring rules](../../../README.md#authoring-rules) in the ADR guide own how a record opens, when `Analysis` is warranted, what contract material belongs in it, how closed constraints and defensive rules are stated, and which alternatives and risks qualify.

### Decision lifecycle

Use `Update decision` for non-conflicting additions. Append them under a final `Changes` or `变更` section with dated level-three headings. Link another decision when an addition deserves its own ADR. Purely editorial maintenance creates no new choice and needs no reversal.

Use `Reverse decision` for a conflicting choice. First merge a proposal naming every decision to reverse, the effective clause, the proposed choice, and why both cannot hold. Code size, an added feature, another host dependency, or a rename alone is insufficient. After implementation, combine each old decision's still-effective rules and the accepted proposal into a complete successor within that decision's scope, without copying the component's implementation specification.

Move the replaced bilingual version to its next archive revision in the same change. Add `Archived: YYYY-MM-DD` before optional `Reversed by` in the archive metadata. The successor's `Reverses` points to that archive, and the archive's `Reversed by` points to its actual successor. Archived records are not current authority.

Direct relationships follow versions. If A is reversed by B and later B by C, A's `Reversed by` follows B into B's archive rather than drifting to C at the current path. B still links to A; C links to B's archive. References to current authority use the canonical current path; citations of a particular historical choice follow that version to its archive. Classify each reference by its meaning, not its source directory. Stable file paths do not make heading fragments immutable.

### Maintenance

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
