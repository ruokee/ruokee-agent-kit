# ADR decision: Colocate English and Chinese public documentation

Decision owner: Ruokee
Decision writer: OMP GPT-6 Astra
Reverses: [Maintain English and Chinese public documentation](../archived/2026-08-20-maintain-bilingual-public-documentation.md)

English | [中文](./2026-09-07-colocate-bilingual-docs.zh.md)

## Motivation

The repository is public and uses English for code and default documentation, while Ruokee uses Chinese to review technical decisions and usage details. Separate language files keep each version independently readable without mixing both languages throughout every page.

Keeping counterparts in the same directory makes their paths predictable and keeps documentation beside its component or topic. Repository and component entry pages need clear responsibilities so readers can discover capabilities and reach their detailed documentation without competing indexes or duplicated contracts.

## Decision

### Language and scope

Write code, comments, configuration, and default public documentation in English. Maintain corresponding Chinese documentation for public behavior and usage. Ordinary public Markdown pages use same-directory `name.md` and `name.zh.md` pairs. Repository and component entry pages use `README.md` and `README.zh.md`, not separate language directories.

Keep reciprocal language links. Each document must make sense on its own. Update and review both languages in the same change, requiring equivalent behavior, limits, and instructions rather than sentence-by-sentence translation. Preserve paths, commands, API names, status values, and code identifiers in their repository spelling.

Internal implementation notes, comments, generated files, and maintainer-only artifacts require translation only when their audience needs it. Define a real file pair when public behavior or usage first requires Chinese documentation; do not create empty language placeholders.

ADRs use the stricter paired format defined by [Establish the ADR mechanism](./2026-09-02-establish-adr-mechanism.md). Both files remain semantically authoritative and move together, with the existing metadata and lifecycle rules.

### Skill packaging

Skill language variants retain their host-discoverable component layouts. English Skills live under `skills/<name>/`, and Chinese variants live under `variants/zh/skills/<name>/`, as defined by the [Skill packaging decision](./2026-08-20-package-self-contained-skill-variants.md). Independently named tk Skills retain their paths under `projects/tk/skills/`. The ordinary documentation filename convention does not rename Skill files, identities, or installed paths.

### Public entry points

The [English repository README](../../../README.md) and [Chinese repository README](../../../README.zh.md) provide equivalent capability indexes and development guidance. They distinguish user-invoked and Agent-invoked Skills and group extensions by Harness applicability. Each Skill entry links to its base and Chinese variant; each extension entry links to the corresponding component README.

Component README pairs introduce the capability and link to its usage and design documentation. Detailed commands, parameters, and normative behavior stay on their owning pages. The tk README pair provides this navigation under the [tk documentation decision](./2026-09-11-align-tk-usage-patterns.md).

Do not maintain separate Skill index pages, duplicate language-directory entry pages, or redirect placeholders at replaced paths. Repair affected inbound links and command examples when pages move. Use [document-relative links](./2026-08-24-use-document-relative-file-links.md) and preserve [component self-containment](./2026-08-24-keep-components-self-contained.md).

## Alternatives considered

Keep separate English and Chinese documentation directories. This is a viable pairing scheme, but it requires a different path convention from ADRs and existing component documentation. Same-directory pairs use one filename rule for ordinary public pages and keep counterparts together.

## Consequences

English remains the default public language, with complete Chinese counterparts for public behavior and usage. Readers can find another language version beside the current page and enter capabilities through the repository and component README pairs.

Every affected change maintains both languages and their links. File-pair and link checks can detect omissions, but they cannot prove semantic agreement; a person or capable Agent must still compare meaning. Use the existing repository checks and explicit affected-link checks rather than adding a permanent translation or documentation-structure checker.

Moving public pages can invalidate external bookmarks and inbound links. Repository-owned references are repaired together, but external references cannot all be updated here.
