# Repository dictionary

Draft owner: Ruokee
Draft writer: OMP DeepSeek V4.1 Flash

English | [中文](./17-repository-dictionary.zh.md)

## Motivation

Create a shared repository dictionary for development work.

Term definitions are scattered across the `architect`, `code-quality`, `python-engineering`, and `msgspec` Skill glossaries and the ADR glossary. Each glossary covers one component. Cross-component repository concepts, workflow concepts, and AI coding vocabulary have no shared definition.

Some terms are defined more than once. `Recommendation` in `architect` is a candidate direction; in the review Skills it is the smallest sufficient action for a finding. `ADR` in `architect` names the general architecture record, while the ADR glossary names this repository's mechanism. Agents and maintainers can use the same word with different meanings, and the same concept can appear under different words.

## Proposal

Create `docs/dictionary/` as this repository's shared vocabulary for development work.

### Entries

The index at `docs/dictionary/README.md` and `docs/dictionary/README.zh.md` groups entries into repository and components, documents and decisions, workflow, review language, and AI coding. Each entry gives the canonical English term, its corresponding Chinese term, and a one-sentence definition. A term that needs a mechanism, examples, or a boundary note also gets a linked page pair.

The first batch covers repository and toolchain concepts, review terms, and high-frequency AI coding vocabulary. The dictionary index holds the current list. Later entries enter on demand.

### Authority

The dictionary is authoritative for shared terms. Component glossaries keep self-contained copies whose meaning must agree with the dictionary; a component may add a scope-specific note that does not contradict the shared definition. The ADR glossary keeps ADR-local terms and points shared terms to the dictionary.

`.agents/rule/terminology.md` and its Chinese page state the normative requirements: use the dictionary's canonical term and definition in repository documents, rules, specifications, decisions, task materials, and discussion of repository work; do not introduce a synonym for an entry; an Agent proposes a new entry to the maintainer, and adds or changes a canonical term or definition only after the maintainer confirms it.

### Repository integration

- The root `AGENTS.md` links the dictionary and the terminology rule.
- The rule index lists `terminology.md`.
- The repository specification lists the dictionary and the terminology rule in its public surface.
- The README documentation layers include the dictionary.
- The ADR glossary points shared terms to the dictionary and keeps ADR-local terms.
- Skill files do not reference the dictionary or the rule.

The dictionary is repository documentation, not a distributable component. `.omp/AGENTS.md` inherits the root reference through `@../AGENTS.md` and stays unchanged.

### Source

Entry organization follows Matt Pocock's [`dictionary-of-ai-coding`](https://github.com/mattpocock/dictionary-of-ai-coding): a short description, a definition, an optional avoid note, and examples. That repository has no license file, so the dictionary does not copy its text. The dictionary index and the resulting decision record the source and the absence of a license.

## Alternatives considered

**A single file at `docs/dictionary.md`.** It has fewer files, but long explanations and examples crowd one page, and concurrent edits conflict. Rejected.

**A distributable Skill.** It could align vocabulary in other projects, but the confirmed requirement is repository development, and a self-contained Skill cannot reference a repository-wide dictionary. Rejected.

**Merge the Skill glossaries into the dictionary.** This would create one source, but it breaks component self-containment and removes the glossaries that installed Skills carry. Rejected.

**Copy Matt's entries.** This would cover the vocabulary quickly, but the source has no license. Rejected.

**Add a terminology check.** It would enforce stronger consistency than the confirmed requirement, which stops at a normative rule and review. Rejected.

## Acceptance criteria

1. The index lists every first-batch term once, with the canonical term, the corresponding term in the other language, and a definition. No concept has two competing entries, and no entry repeats.
2. Terms that need a page have an English and Chinese pair that link to each other, carry the same meaning, and include at least one of a mechanism, an example, or a boundary note beyond the definition. The index entry for each such term links to its page.
3. The terminology rule and its Chinese page are equivalent and cross-linked. The root `AGENTS.md`, rule index, repository specification, README documentation layers, and ADR glossary are wired as described.
4. Shared terms in the Skill and ADR glossaries do not contradict the dictionary. The check covers the English Skills, their Chinese variants, and the ADR glossary, and affected copies are updated.
5. No Skill file references the dictionary or the terminology rule.
6. The dictionary index records the Matt source and the absence of a license, and contains no copied text.
7. After implementation, a decision records the agreed mechanism and the consumed proposal is removed.
8. The documentation formatting check passes, and the complete repository check passes on the clean, committed final candidate.

## Risks

The first batch is large. Entries that only need a sentence can become shallow definitions, and the linked pages may absorb too many terms. The split rule keeps pages to terms that need a mechanism, examples, or a boundary note.

Chinese canonical terms can conflict with established usage. The dictionary settles one term per concept, which may require edits to existing documents.

The dictionary and component glossaries can drift after this change. The normative rule and review control this; no automated check is added.

The English and Chinese pages can diverge in meaning. Both files change together, and reviewers read them as a pair.
