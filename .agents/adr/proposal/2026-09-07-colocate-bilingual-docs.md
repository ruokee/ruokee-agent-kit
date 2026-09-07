# ADR proposal: Colocate English and Chinese public documentation

Decision owner: Ruokee
Draft writer: OMP GPT-6 Astra

English | [中文](./2026-09-07-colocate-bilingual-docs.zh.md)

## Motivation

The [public documentation decision](../decision/2026-08-20-maintain-bilingual-public-documentation.md) requires Chinese user documentation under `docs/zh/`. This separates language counterparts by directory, while [ADRs](../README.md) and component documentation already use same-directory English and Chinese file pairs.

One same-directory convention makes the counterpart of a public page predictable and keeps both language versions beside the component or topic they describe. A repository overview should also provide a complete capability index, with component entry pages leading to detailed documentation.

## Proposal

### Language pairs

Write code, comments, configuration, and default public documentation in English. Pair each public Markdown page that needs Chinese documentation with a file in the same directory: `name.md` and `name.zh.md`. Repository and component entry pages use `README.md` and `README.zh.md`. Do not maintain separate language directories or duplicate pages at the former paths.

Keep reciprocal language links and update both versions in the same change. Require equivalent meaning rather than sentence-by-sentence translation. Each page must make sense independently. Preserve paths, commands, API names, status values, and code identifiers in their repository spelling.

Public behavior and usage documentation requires Chinese counterparts. Internal implementation notes, comments, generated files, and maintainer-only artifacts do not require translation solely because they exist. Do not create empty language placeholders.

ADRs retain their existing pair format, semantic authority, metadata, and lifecycle rules. Skills retain their host-discoverable packaging and language variants under `skills/<name>/` and `variants/zh/skills/<name>/`. Independently named tk Skills also retain their component paths. This proposal changes ordinary public documentation layout, not Skill identities or installed paths.

### Public entry points

Use the repository's `README.md` and `README.zh.md` as the bilingual capability index. Both list the same available capabilities, distinguish user-invoked and Agent-invoked Skills, and group extensions by Harness applicability. Link each Skill's base and Chinese variant, and link extensions to their corresponding component entry page.

Component README pairs introduce the capability and link to its usage and design documentation. They do not duplicate detailed command references or normative contracts. Complete the tk README pair as this entry point, retaining its existing guides and design pages as the owners of detailed behavior.

Remove the separate Skill indexes once their content is represented in the repository README pair. Update inbound links and references to use the current entry points, including the [deep-research decision](../decision/2026-09-06-migrate-deep-research.md). Preserve document-relative links and component self-containment.

### Decision maintenance

If accepted and implemented, this proposal reverses [Maintain English and Chinese public documentation](../decision/2026-08-20-maintain-bilingual-public-documentation.md). Create a complete replacement decision that preserves its still-effective language, translation-scope, semantic-agreement, and ADR-pair rules while adopting same-directory public documentation pairs and the entry-point responsibilities above.

Update repository authoring instructions to use the same convention. Update the [tk documentation decision](../decision/2026-08-29-maintain-tk-documentation.md) and corresponding documentation design pages to include component README navigation without changing topic ownership. Repair factual links and entry-point descriptions in affected records; do not change unrelated capability behavior or ADR policy.

## Alternatives considered

Keep separate English and Chinese documentation directories as required by the current decision. This preserves the existing root documentation convention, but leaves ordinary documentation with a different pairing rule from ADRs and component pages and makes counterpart paths depend on the document category.

## Acceptance criteria

1. Ordinary public Markdown counterparts use same-directory `name.md` and `name.zh.md` paths, including repository and component README pairs. Authoring instructions describe this convention rather than requiring `docs/zh/`.
2. The repository README pair has semantically equivalent introductions, capability indexes, and development guidance. The listed capabilities lead to usable documentation, including nonempty tk component README pages.
3. Replaced language-directory entry pages and separate Skill indexes have no duplicate or redirect placeholders. Affected inbound links and command examples reference current paths.
4. Reciprocal language links and document-relative file links resolve. Skill language-variant trees and installed paths remain unchanged.
5. A complete bilingual decision replaces the conflicting public documentation decision through the existing ADR lifecycle. Affected tk documentation rules and deep-research index references agree with the current entry points.
6. The change passes `pnpm check`, explicit local-link checks for affected pages, and a semantic review of both languages. No new permanent documentation checker is required.

## Risks

Moving public pages can invalidate bookmarks or inbound links outside this repository. Repository-owned links can be repaired together, but external references cannot all be updated here.
