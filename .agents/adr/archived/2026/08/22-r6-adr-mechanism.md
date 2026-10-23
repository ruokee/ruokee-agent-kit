# ADR mechanism

Decision owner: Ruokee
Decision writer: OMP
Reverses: [ADR mechanism](./22-r5-adr-mechanism.md)
Archived: 2026-10-22
Reversed by: [ADR mechanism](./22-r7-adr-mechanism.md)

English | [中文](./22-r6-adr-mechanism.zh.md)

## Motivation

Maintain bilingual ADR proposals and decisions with stable decision paths and traceable reversal histories.

An ADR preserves a durable choice, its rationale, necessary contract, and lifecycle. Successive versions need one current reference and separately accessible historical records, including when several reversals happen on the same day. Year and month directories group records without making their actual archival dates part of their identity.

The [earlier mechanism](./22-r4-adr-mechanism.md) required naming maintenance to preserve each record's filename date. Its successors used different dates. Normalizing all versions to the decision's first proposal date changes that date meaning and historical maintenance boundary. It does not change the choices recorded by the other ADRs.

The ADR glossary duplicated terms the repository dictionary defines, creating a second authority that needed synchronized updates. The dictionary is now the only repository term source outside distributable components, and the ADR guide points to its ADR page.

## Decision

### Terminology

Use **ADR** as the primary term, with `.agents/adr` as the root. The guide's document layout defines `proposal` and `decision` as the two document types. `proposal/` contains active proposals, `rejected/` rejected proposals, `decision/` current decisions, and `archived/` archived decisions. Directories express type and state, so records have no `Status` field. Use `Create decision`, `Update decision`, and `Reverse decision` as action phrases, not noun labels; `Reverses` links a successor to its archive and `Reversed by` links that archive to its actual successor.

### Identity

A decision's first proposal date and short canonical English topic name identify its current record and every archived version. Ordinary reversals retain that identity and path. An extracted independent topic gets its own first proposal date, canonical name, and sequence while preserving actual source and reversal relationships; common ancestry or a `Reverses` link does not establish shared identity. A proposal keeps its own first proposal date even when reversing an older decision, and rejection preserves it. It does not replace the older decision's date. `Archived` and dated `Changes` retain actual event dates.

### Paths

The guide's layout uses `proposal/YYYY/MM/DD-name.md`, `decision/YYYY/MM/DD-name.md`, `rejected/YYYY/MM/DD-name.md`, and `archived/YYYY/MM/DD-rN-name.md` beneath the ADR root. Year has four digits, month and day two. Current and archive paths use the identity date even across years. Only archives carry `rN`: start at `r1` and increment once per reversal of that decision, without resetting across days, months, or years. Another decision, language counterpart, multiple links, ordinary update, directory move, or naming correction consumes no number. Create time directories only for actual records, with no monthly file-count limit. Keep the guide at the root and all four lifecycle directories tracked with `.gitkeep`, including when nonempty.

Every retained filename, title, and subsection, including topic text after a `Changes` date, uses one short imperative, phrase, or noun under the naming rules. The full leaf filename, including date, revision, topic, language suffix, and extension, is at most 60 characters.

### Proposal workflow

One requirement gets one proposal unless the maintainer requests another split, and an approved proposal merges to `main` as a dedicated change before implementation begins. Implementation starts from the resulting `main` on a new short-lived branch. One proposal may create several decisions, reverse several decisions, or both. After implementation, create the new decisions, update non-conflicting decisions, reverse conflicting decisions, and remove the consumed proposal in the same implementation change; Git preserves the independently merged rationale. A rejected proposal moves to `rejected/` under its original date and name without `rN`, adds `Rejection reason` or `拒绝原因`, and freezes after factual link repairs. Keep it only while its rationale prevents a realistic mistake.

### Record format

Each ADR is one same-directory English and Chinese pair, `DD-name.md` and `DD-name.zh.md`, or `DD-rN-name.md` and `DD-rN-name.zh.md` for archives. Both files are semantically authoritative, complete in the same change, and moved together. English is the default public link, Chinese the audit copy; either may be drafted first. A semantic conflict blocks merge until the maintainer resolves it. Preserve repository spelling for paths, commands, API names, metadata, and identifiers.

Titles carry topics alone. A proposal's metadata starts with `Draft owner` then `Draft writer`; a decision uses `Decision owner` then `Decision writer`. The owner is the accountable maintainer; the original writer stays unchanged in later maintenance. Model writer names omit provider, router, and channel prefixes, while host names may remain. Required language versions have identical owner and writer fields. Relationship and lifecycle fields follow the writer, and reciprocal language links immediately follow the complete metadata block. `Archived` precedes optional `Reversed by`.

Proposal sections are `Motivation`, `Proposal`, `Alternatives considered`, `Acceptance criteria`, and `Risks`, corresponding to `动机`, `提议`, `考虑过的替代方案`, `验收标准`, and `风险`. Decision sections are `Motivation`, `Decision`, `Alternatives considered`, and `Consequences`, corresponding to `动机`, `决定`, `考虑过的替代方案`, and `结果`. Describe active proposals before rejected ones and current decisions before archives.

### Authoring the record

`Motivation` opens both types with one short, standalone sentence stating the action or complete choice, not what the record does. Later paragraphs give the concrete problem, background, reasons, and evidence; a wanted capability need not be framed as a defect. A reversal proposal states the change; a successor states the complete choice. Optional substantive `Analysis` or `分析` follows motivation and precedes proposal or decision. It contains only choice-relevant observations, evidence, constraints, reasoning, and uncertainty, not an implementation plan, copied research, or repetition.

Record a coherent durable choice, its reasons, necessary boundaries, ownership, important public promises, and material compatibility, safety, cost, and failure consequences. A technical fragment belongs only when omitting it obscures the choice or a material tradeoff or loses a binding contract. Configuration authority, immutable identity, and process-wide effects may qualify. Full API and configuration tables, schemas, commands, and inventories belong on their owning public pages. Internal functions, algorithms, file-by-file edits, execution plans, test commands, and logs belong in implementation documents, code, tests, or task materials. Acceptance states observable outcomes, not test procedures. Cite accessible contracts, not ignored task materials; exclude task lifecycle, branches, commits, and session-only context.

Moving a binding clause cancels none of it. Preserve its meaning and accessible reference, and retain enough original detail in historical records to explain their choice; a changing current document cannot replace the historical contract. Distinguish closed protocols, ownership, and safety boundaries from examples or growing inventories. Prefer owning inventory links to fixed counts or exhaustive trees, and explain necessary closed boundaries. A temporary scope limit is not a permanent ban. Do not weaken a ban retroactively or prebuild abstractions for extensible wording. Defensive rules address the actual operation and harm: validation, repair, lifecycle changes, and repeated activation may have different prerequisites. Preserve identity, permission, and side-effect protections rather than unrelated blanket restrictions.

Review alternatives and risk-like entries wherever they occur, including `Consequences`. Establish genuine participation in the choice or credible causation, then the material tradeoff, harm, or boundary lost by removal. An entry's own claim of consideration is not evidence; locate its requirement, analysis, proposal, or historical source. Review evidence belongs in task materials, not the ADR. Delete unsupported, misclassified, or immaterial entries instead of polishing or relocating them; preserve unique binding clauses and necessary reasons. Combine repeated causes without losing conditions. Counts, deletion ratios, and word counts are not quality measures. Consequences may be benefits or accepted costs, not only risks. Judge history against its own time's evidence. Use descriptive level-three headings without replacing required level-two sections or copying progress and implementation inventories.

Alternatives begin with `None` or `无`. Add only different courses for the same durable choice that genuinely entered it and explain a material tradeoff; existence, plausibility, or mention is insufficient. Facts, requirements, acceptance, restatements, simple negations of settled scope, and immaterial implementation variations do not qualify. An option viable before a later constraint can retain its necessary reason without copying exploration or listing every rejected idea. An empty result is complete and contains only the prescribed empty marker.

Risks likewise begin with `None` or `无`, with no required count. State the condition or omission, causal mechanism, and decision-specific material harm. Retain residual risk, compatibility loss, continuing cost, and uncertainty affecting adoption. An omission with a consequential failure path can qualify even when implementation is involved. Facts, constraints, tasks, repeated behavior, and temporary evidence gaps are not themselves risks. Generic warnings about failing code, drifting documents, or misunderstanding do not qualify. Competing authorities that drift into conflict, an older body overwriting a newer one after removing a revision check, or a handler disabling speculative startup under its registration conditions are concrete causal examples. Keep only `None` or `无` when no entry qualifies.

### Decision lifecycle

Use `Update decision` for non-conflicting additions. Append them under a final `Changes` or `变更` section with dated level-three headings. Link another decision when an addition deserves its own ADR. Purely editorial maintenance creates no new choice and needs no reversal.

Use `Reverse decision` for a conflicting choice. First merge a proposal naming every decision to reverse, the effective clause, the proposed choice, and why both cannot hold. Code size, an added feature, another host dependency, or a rename alone is insufficient. After implementation, combine each old decision's still-effective rules and the accepted proposal into a complete successor within that decision's scope, without copying the component's implementation specification.

Move the replaced bilingual version to its next archive revision in the same change. Add `Archived: YYYY-MM-DD` before optional `Reversed by` in the archive metadata. The successor's `Reverses` points to that archive, and the archive's `Reversed by` points to its actual successor. Archived records are not current authority.

Direct relationships follow versions. If A is reversed by B and later B by C, A's `Reversed by` follows B into B's archive rather than drifting to C at the current path. B still links to A; C links to B's archive. References to current authority use the canonical current path; citations of a particular historical choice follow that version to its archive. Classify each reference by its meaning, not its source directory. Stable file paths do not make heading fragments immutable.

### Maintenance

Use review, repository search, and Git history rather than a dedicated ADR Skill, classification system, translation sidecar, archive manifest, index, or permanent maintenance script. Add a mechanical check only after repeated maintenance or an observed failure identifies a concrete invariant.

The ADR guide owns detailed formats and operations, with its Chinese counterpart and the [repository dictionary](../../../../../docs/dictionary/adr.md). The guide's binding contract is retained above rather than delegated to a changing reference. The [repository specification](../../../../spec/repository.md) states lasting goals and observable invariants. Keep the guide, documentation rules, specification, dictionary, and affected references aligned in both languages.

The maintainer owns proposal approval, rejection, and decision archival; an Agent may draft and implement within authorization but cannot decide these lifecycle changes without explicit approval. Search proposals and current decisions before planning; confirm whether a requirement needs a proposal. A choice with real alternatives that changes architecture, ownership, public or host contracts, persisted formats, compatibility, or repository-wide process warrants an ADR. A local fix, mechanical refactor, ordinary documentation change, status report, or temporary plan does not unless it changes a durable boundary.

Move language files together and repair relationships, body links, language links, inbound references, and fragments in the same change. Archives freeze after relationship and factual link repairs; rejected proposals after factual link repairs. Correct evidenced names, headings, identities, revision order, and relationships using content, links, proposal sources, and relevant Git history. Preserve choices, reasons, constraints, uncertainty, historical capabilities, original authors, actual archival dates, and event dates. Identity normalization changes path dates, not events; Git preserves original names. Naming corrections do not add reversals, unfreeze records, or alter promises. Keep no duplicate old aliases. Historical format examples and Git object paths retain original spelling when that spelling is the cited fact. Factual maintenance must not reverse a decision.

## Alternatives considered

None

## Consequences

Current authority has one stable path per decision, and each replaced version remains independently accessible. Identity-based year and month directories group its history even when archival happens years later. `Archived` records the event date rather than directory placement.

Direct relationships require maintenance when a current successor itself becomes archived. Treating every citation as current authority can silently redirect historical evidence to different content. Mistaking common ancestry for identity can combine independent decisions or assign the wrong sequence.

Titles carry topics, not types. Readers use directories, metadata, and language links to identify records. Discovery uses concise names and repository search rather than a central index.

A proposal and its implementation require separate branches and mainline commits. This preserves an independent rationale and review boundary. A reversal requires comparing the predecessor and proposal to reconstruct the complete current contract. Necessary contract detail and bilingual semantic alignment remain review judgments, not mechanically proven properties.
