# Repository dictionary

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash

English | [中文](./17-repository-dictionary.zh.md)

## Motivation

Create a shared repository dictionary for development work.

Term definitions are scattered across component glossaries, including the `architect`, `code-quality`, `python-engineering`, and `msgspec` Skill glossaries. Each glossary covers one component. Cross-component repository concepts, workflow concepts, and AI coding vocabulary have no shared definition.

Some terms are defined more than once. `Recommendation` in `architect` is a candidate direction; in the review Skills it is the smallest sufficient action for a finding. `ADR` in `architect` names the general architecture record, while this repository uses the same word for its decision mechanism. Agents and maintainers can use the same word with different meanings, and the same concept can appear under different words.

## Decision

### Scope

`docs/dictionary/` is this repository's shared vocabulary for development work. The dictionary is public repository documentation, not a distributable component, and Skill files do not reference it or the [terminology rule](../../../../rule/terminology.md).

### Entries

The [index](../../../../../docs/dictionary/README.md) groups entries into repository and components, documents and decisions, workflow, review language, and AI coding. Each entry gives the canonical English term, its corresponding Chinese term, and a one-sentence definition. A term that needs a mechanism, examples, or a boundary note also gets a linked English and Chinese page pair.

The first batch covers repository and toolchain concepts, review terms, and high-frequency AI coding vocabulary. The index holds the current list; later entries enter on demand.

### Authority

The dictionary is authoritative for shared terms. Component glossaries keep self-contained copies whose meaning must agree with the dictionary; a component may add a scope-specific note that does not contradict the shared definition. The dictionary's ADR page defines ADR terms; the repository maintains no separate ADR glossary.

The [terminology rule](../../../../rule/terminology.md) and its Chinese page state the normative requirements: use the dictionary's canonical term and definition in repository documents, rules, specifications, decisions, task materials, and discussion of repository work; do not introduce a synonym for an entry; keep third-party proper names, commands, fields, and file name literals in their original spelling; an Agent proposes a new entry to the maintainer, and adds or changes a canonical term or definition only after the maintainer confirms it.

### Repository integration

The root `AGENTS.md` links the dictionary and the terminology rule. The [rule index](../../../../rule/README.md) lists `terminology.md`. The [repository specification](../../../../spec/repository.md) lists the dictionary and the terminology rule in its public surface. The [README](../../../../../README.md) documentation layers include the dictionary. The [ADR guide](../../../README.md) points ADR terms to the dictionary's ADR page. `.omp/AGENTS.md` inherits the root reference through `@../AGENTS.md`.

### Source

Entry organization follows Matt Pocock's [`dictionary-of-ai-coding`](https://github.com/mattpocock/dictionary-of-ai-coding): a short description, a definition, an optional avoid note, and examples. That repository has no license file, so the dictionary does not copy its text. The dictionary index records the source and the absence of a license.

## Alternatives considered

**A single file at `docs/dictionary.md`.** It has fewer files, but long explanations and examples crowd one page, and concurrent edits conflict. Rejected.

**A distributable Skill.** It could align vocabulary in other projects, but the confirmed requirement is repository development, and a self-contained Skill cannot reference a repository-wide dictionary. Rejected.

**Merge the Skill glossaries into the dictionary.** This would create one source, but it breaks component self-containment and removes the glossaries that installed Skills carry. Rejected.

**Copy Matt's entries.** This would cover the vocabulary quickly, but the source has no license. Rejected.

**Add a terminology check.** It would enforce stronger consistency than the confirmed requirement, which stops at a normative rule and review. Rejected.

## Consequences

The repository now has a shared reference for cross-component and AI coding terms, and the terminology rule makes its use normative. Component glossaries keep their self-contained copies and must agree with the shared definitions; the repository maintains no separate ADR glossary.

The first batch is large. Entries that only need a sentence can become shallow definitions, and the linked pages may absorb too many terms. The split rule keeps pages to terms that need a mechanism, examples, or a boundary note.

Chinese canonical terms can conflict with established usage. The dictionary settles one term per concept, which may require edits to existing documents.

The dictionary and component glossaries can drift after this change. The normative rule and review control this; no automated check is added.

The English and Chinese pages can diverge in meaning. Both files change together, and reviewers read them as a pair.
