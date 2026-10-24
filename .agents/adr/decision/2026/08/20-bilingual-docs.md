# Bilingual documentation

Decision owner: Ruokee
Decision writer: OMP GPT-6 Astra
Reverses: [Bilingual documentation](../../../archived/2026/08/20-r3-bilingual-docs.md)

English | [中文](./20-bilingual-docs.zh.md)

## Motivation

Keep complete English and Chinese public documentation in same-directory pairs, while components own the internal layout of their Skill language resources.

Each language must be independently readable. English is the default public language; Chinese supports the maintainer's review of decisions and usage. Language equivalence and discoverable entry points do not require a fixed project-internal Skill subdirectory. The predecessor's fixed subdirectory made local source moves change a public language policy.

## Decision

### Language scope

Write code, comments, configuration, and default public documentation in English. Maintain complete Chinese documentation for public behavior and usage. Ordinary public Markdown pages use same-directory `name.md` and `name.zh.md` pairs. Repository and component entry pages use `README.md` and `README.zh.md`, not separate language directories.

Keep reciprocal language links on ordinary pages. Specification bodies contain no repository-file links, including language links; their non-spec index provides both language entries. Every document makes sense on its own. Update and review both languages together, preserving equivalent behavior, limits, and instructions rather than requiring sentence-by-sentence translation. Keep paths, commands, API names, status values, and code identifiers in their repository spelling.

Internal implementation notes, comments, generated files, and maintainer-only artifacts require translation only when their audience needs it. Create a real pair when public behavior or usage first requires Chinese documentation, never empty language placeholders.

ADRs follow the stricter paired format of the [ADR mechanism](./22-adr-mechanism.md). Both versions are semantically authoritative and move together under its metadata and lifecycle rules.

### Skill packaging

Skill language distributions follow the [Skill packaging decision](./20-skill-variants.md), including ordinary Skill discovery roots, component ownership, installed identities, language equivalence, and self-containment. Each project chooses its internal Skill source layout. The ordinary documentation filename convention does not rename Skill files, identities, or installed paths.

### Public entry points

The [English repository README](../../../../../README.md) and [Chinese repository README](../../../../../README.zh.md) provide equivalent capability indexes and development guidance. They distinguish user-invoked and Agent-invoked Skills and group extensions by Harness applicability. Each Skill entry links both languages; each extension entry links its corresponding component README.

Component README pairs introduce the capability and navigate its usage and design documentation without duplicating detailed command inventories or normative contracts. Specifications state complete requirements; user references independently explain the same contract.

Do not maintain separate Skill index pages, duplicate language-directory entry pages, or redirect placeholders at replaced paths. Repair affected inbound links and command examples when pages move. Use [document-relative links](./24-relative-links.md) and preserve [component self-containment](./24-component-self-containment.md).

## Alternatives considered

Separate English and Chinese documentation directories are viable, but need a different path convention from ADRs and existing component documentation. Same-directory pairs give ordinary pages one filename convention and keep counterparts together.

## Consequences

Readers reach both complete language versions through ordinary language links or the specification index. Component-internal source moves do not change the language policy when installed identities and complete distributions remain stable.

Each affected change maintains both languages and navigation. Existing repository checks and explicit affected-link checks apply; no permanent translation or document-structure checker is added.

Moving public pages can invalidate external bookmarks. Repository-owned links are repaired together, but external references cannot all be updated here.
