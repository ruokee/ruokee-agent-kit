# Documentation

[简体中文](./documentation.zh.md)

This page defines the layout, language pairing, topic ownership, and maintenance rules for public tk documentation.

## Public pages

Public documentation includes:

- The component [English README](../../README.md) and [Chinese README](../../README.zh.md);
- English and Chinese user guides;
- English and Chinese design indexes;
- Paired English and Chinese pages for system, data-model, runtime, tool-api, cli-reference, harnesses, installation, skill, validation, documentation, and GLOSSARY;
- tk entry points in the repository root README and Chinese README;
- Current English and Chinese tk ADRs.

Review records, revision numbers, Task paths, and local materials do not appear on public pages.

## Topic ownership

- Component README: capability overview and navigation to usage and design documentation.
- guide: runtime prerequisites, installation, first use, common workflows, and CLI links.
- system: product scope, system components, Task and Harness boundaries, and invariants.
- data-model: Task schema, representation, discovery, WAL, writes, migration, rename, cleanup, and checks.
- runtime: layers, processes, context, failure boundaries, and version dimensions.
- tool-api: the six tools, requests, results, and stable errors.
- cli-reference: the complete command tree, arguments, defaults, exit codes, and examples.
- harnesses: the four current Harness forms, mode and language selections, schemas, adapters, and assembly.
- installation: embedded components, installation, updates, clean uninstall, and compatibility.
- skill: Agent triggers, authorization, Task navigation, WAL, and material handling.
- validation: observable acceptance contracts.
- documentation: documentation layout, language, and maintenance rules.
- GLOSSARY: project-specific terms and fixed translations.

A behavior's parameters and algorithm appear only on its primary owning page. Other pages link to it instead of duplicating the contract.

## Wording for the current state

Public documentation describes only the current commands and behavior after official release.

Do not include commands, arguments, files, compatibility layers, or design experiments that appeared during development but were never officially released. Do not list them separately as "no longer supported." Document version differences only for actual behavior changes after official release and only when users need migration guidance.

Documentation states the final state. It does not describe the change process, review debates, or Agent work records.

## Bilingual pages

Public Markdown pages use same-directory `name.md` and `name.zh.md` pairs, including the component `README.md` and `README.zh.md`. Each design topic and guide provides a link to the other language immediately after its H1. Links are relative to the current document.

English and Chinese pages must have equivalent meaning, but Chinese pages use natural Chinese rather than sentence-by-sentence translation. Preserve commands, fields, code, logs, and product terms with fixed capitalization.

Repository and component README pairs provide reciprocal language entry points without requiring the topic-page format.

See the [glossary](./GLOSSARY.md) for fixed translations.

## ADRs

ADRs use Harness terminology. Installation-related ADR filenames, titles, and links use Harness rather than host naming aliases.

ADR proposals live under `proposal/` or `rejected/`; decisions live under `decision/` or `archived/`. ADR files do not contain a `Status` field. Maintainers control proposal approval, rejection, and decision archival; completing design, implementation, or validation does not change lifecycle state automatically.

English and Chinese ADR pairs remain semantically consistent within the same change.

## Links

Markdown links within the repository use paths relative to the current document:

- Paths in the current directory or its descendants start with `./`;
- Parent paths use the required number of `../` segments;
- Links to files within the repository do not use absolute paths or absolute GitHub URLs.

When a filename is link text, describe its path from the repository root without a leading `/`.

## Writing

- Use direct sentences for definitions and requirements.
- Negative wording is acceptable for data protection, security boundaries, and explicit rejection rules.
- Remove defensive negatives that add no information. Do not impose mechanical quantity targets.
- Use the fixed translation pairs `human-readable` / `人类可读`, `managed` / `受管`, `scratchpad` / `草稿纸`, `clean cutover` / `直接切换`, and `supported subcommands` / `支持的子命令`.
- Do not add implementation details or general technical terms to the global glossary.

## Checks

Documentation uses the repository's existing Markdown, link, formatting, and spelling checks, together with manual bilingual review. Do not add a tk-specific bilingual structure checker.

When updating public behavior, the same change must update:

1. The design page that owns the behavior;
2. Affected guide, Skill, and CLI examples;
3. The corresponding Chinese pages;
4. Every current ADR that describes the contract;
5. The corresponding acceptance items in the validation documentation.

Review materials may explain the rationale, but they cannot be the sole source of the public contract.
