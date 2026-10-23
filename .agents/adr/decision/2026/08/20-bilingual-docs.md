# Bilingual documentation

Decision owner: Ruokee
Decision writer: OMP GPT-6 Astra
Reverses: [Bilingual documentation](../../../archived/2026/08/20-r2-bilingual-docs.md)

English | [中文](./20-bilingual-docs.zh.md)

## Motivation

Keep complete English and Chinese public documentation in same-directory pairs, with specification language navigation outside their bodies.

Each language version must be independently readable, with its counterpart beside the same component or topic. The repository is public and uses English for code and default documentation, while Ruokee uses Chinese to review technical decisions and usage details.

Repository and component entry pages also need clear responsibilities so readers can discover capabilities and reach their detailed documentation without competing indexes or duplicated contracts.

## Decision

### Language scope

Write code, comments, configuration, and default public documentation in English. Maintain corresponding Chinese documentation for public behavior and usage. Ordinary public Markdown pages use same-directory `name.md` and `name.zh.md` pairs. Repository and component entry pages use `README.md` and `README.zh.md`, not separate language directories.

Keep reciprocal language links on ordinary pages. Specification bodies contain no repository-file links, including language links; their non-spec index provides both language entries. Each document must make sense on its own. Update and review both languages in the same change, requiring equivalent behavior, limits, and instructions rather than sentence-by-sentence translation. Preserve paths, commands, API names, status values, and code identifiers in their repository spelling.

Internal implementation notes, comments, generated files, and maintainer-only artifacts require translation only when their audience needs it. Define a real file pair when public behavior or usage first requires Chinese documentation; do not create empty language placeholders.

ADRs use the stricter paired format defined by [the ADR mechanism decision](./22-adr-mechanism.md). Both files remain semantically authoritative and move together, with the existing metadata and lifecycle rules.

### Skill packaging

Skill language variants retain their host-discoverable component layouts under the [Skill packaging decision](./20-skill-variants.md). Ordinary English Skills live under `skills/<name>/`, and Chinese variants under `variants/zh/skills/<name>/`. Skills included in independently maintained project components stay under `projects/<component>/skills/`. The ordinary documentation filename convention does not rename Skill files, identities, or installed paths.

### Public entry points

The [English repository README](../../../../../README.md) and [Chinese repository README](../../../../../README.zh.md) provide equivalent capability indexes and development guidance. They distinguish user-invoked and Agent-invoked Skills and group extensions by Harness applicability. Each Skill entry links to its base and Chinese variant; each extension entry links to the corresponding component README.

Component README pairs introduce the capability and link to its usage and design documentation. Specifications contain complete requirements; detailed user references independently explain the same contract. The tk README pair provides navigation under the [tk documentation decision](./29-tk-documentation.md).

Do not maintain separate Skill index pages, duplicate language-directory entry pages, or redirect placeholders at replaced paths. Repair affected inbound links and command examples when pages move. Use [document-relative links](./24-relative-links.md) and preserve [component self-containment](./24-component-self-containment.md).

## Alternatives considered

Keep separate English and Chinese documentation directories. This is a viable pairing scheme, but it requires a different path convention from ADRs and existing component documentation. Same-directory pairs use one filename rule for ordinary public pages and keep counterparts together.

## Consequences

English remains the default public language, with complete Chinese counterparts for public behavior and usage. Readers reach the other language from ordinary pages or the specification index and enter capabilities through the repository and component README pairs.

Every affected change maintains both languages and their navigation. Use the existing repository checks and explicit affected-link checks rather than adding a permanent translation or documentation-structure checker.

Moving public pages can invalidate external bookmarks and inbound links. Repository-owned references are repaired together, but external references cannot all be updated here.
