# Terminology

English | [中文](./terminology.zh.md)

The [repository dictionary](../../docs/dictionary/README.md) defines the shared terms this rule enforces. The [repository spec](../spec/repository.md) owns the documentation properties the rule depends on.

## Using the dictionary

- Use the dictionary's canonical term and definition in repository documents, specs, rules, decisions, task materials, and discussions about repository work.
- Keep third-party proper names, commands, fields, and file name literals in their original spelling; the canonical term does not rewrite them.
- Do not introduce a synonym for a recorded concept; record an intentional alias or translation in the entry.
- Propose a new entry to the maintainer when a recurring concept is not recorded.
- Get the maintainer's confirmation before adding an entry or changing a canonical term or its meaning.
- Keep each component glossary's meaning aligned with the authoritative dictionary.
- Keep glossaries only in distributable components; the rest of the repository uses the dictionary.
- Keep an entry's English and Chinese pages equivalent and linked.

## Scope

- Keep the dictionary specific to repository development. Do not add it to a distributable component or make a component depend on it.
- Keep component glossaries self-contained for use after installation in other projects.

## Related ADRs

- [Repository dictionary](../adr/decision/2026/10/17-repository-dictionary.md)
