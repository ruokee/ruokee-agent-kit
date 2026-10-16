# well-said attribution

Draft owner: Ruokee
Draft writer: OMP DeepSeek V4.1 Flash

English | [中文](./15-well-said-attribution.zh.md)

## Motivation

Move the well-said source attribution and license information out of the Skill components and into the repository's own documentation.

Each well-said component currently carries four adjacent files: `LICENSE` for Ruokee's own material, `LICENSE.unslop` for the reused unslop material, and `SOURCES.md` with `SOURCES.zh.md` for authorship, the pinned source revision, and the category mapping. The [well-said decision](../../../decision/2026/09/12-well-said.md) requires that file set, and the [Skill spec](../../../../spec/skills.md) requires source attribution and license notices inside a Skill tree.

Neither position fits this material. A Skill file enters the Agent context as instructions, or is read beside them as part of one component, so a legal notice means nothing to a writing session and can read as part of the capability's rules. Attribution and license information serve a reader of the repository, so the repository records them outside the Skill tree: the `README.md` entry carries one credit line naming the source and its author, and the successor decision carries the upstream path, the pinned revision, and the license.

## Analysis

The English style rules and author-voice guidance are still mostly verbatim copies of the pinned unslop revision `99559f2f52047978602ef365589275831e76af07`. Twenty-three of the thirty-six style rules match an upstream rule line for line once the numbering prefix is removed, one of the four process steps matches as well, and all six author-voice bullets are identical. Rules 20, 21, 22, 23, and 31 are local additions. The remaining English sections, `Guidance`, `Defensive phrasing`, `Trimming chain of thought leakage`, and `Writing articles`, are local.

Reused material keeps its provenance and the license that applies to it. The repository holds that record in the README credit and in the successor decision, which keeps the upstream repository path, the pinned revision, the pstack MIT license, and the author. This repository also never distributes a component copy on its own: the installer copies a component directory from this checkout into a host skill path, and no per-component artifact is published. The notice files inside the components therefore cover no distribution path of this repository.

## Proposal

### Component layout

Each language component contains only `SKILL.md`. Delete `LICENSE`, `LICENSE.unslop`, `SOURCES.md`, and `SOURCES.zh.md` from both `skills/well-said/` and `variants/zh/skills/well-said/`. The writing instructions and `metadata.version` do not change, and no replacement notice file is added anywhere in the repository.

### Attribution

The well-said entry in `README.md` gains `Inspired by [unslop](https://github.com/cursor/plugins/blob/main/pstack/skills/unslop/SKILL.md) by [Lauren Tan](https://github.com/poteto).`, and `README.zh.md` carries the same credit in Chinese. The README entry carries the credit, while the successor decision keeps the license, the upstream path, and the pinned revision.

### Placement rule

`.agents/rule/boundary.md` keeps `Preserve source authorship, and comply with the licenses and attribution requirements that apply to reused material.` and adds: `Keep license and notice files out of a Skill tree, where they can read as part of the capability. Record source attribution and license information at the repository level instead: in the repository README, in the README of a component that ships one, or in the decision that owns the material.` The rule covers notice files and the place where attribution and license information is recorded. It leaves a source citation line that a capability's own decision requires, such as the attribution the [architect decision](../../../decision/2026/08/22-architect.md) requires in both language versions of its `SKILL.md`, because a rule must not conflict with a current decision.

`.agents/spec/skills.md` reaches these invariants:

- "A Skill tree holds host-discoverable material such as `SKILL.md`, workflows, references, examples, and glossaries, and carries no license or notice files." Its `grill-me` sentence stays.
- "Material adapted from a third party records its source attribution and license information at the repository level: in the repository README, in the README of a component that ships one, or in the decision that owns the material."
- "Each language component declares its version in `metadata.version` and contains only `SKILL.md`; source attribution lives in the repository README, as defined by the well-said decision."

The Chinese file says the same, and both language files change together.

### Decision replacement

The [well-said decision](../../../decision/2026/09/12-well-said.md) cannot hold together with this proposal. Its `Component layout` section lists the four files and requires an install or distribution to carry them, `Validation requirements` item 3 requires each component to contain its own source documents and both license files, and `Consequences` concludes that each language component must include its own complete supporting files. Each of those clauses places the notices inside the component.

The successor keeps the still-effective rules: the capability scope, editing authority, loading, agent communication, version policy, the remaining validation requirements, and the upstream facts.

The [first-party capability decision](../../../decision/2026/08/20-first-party-capabilities.md) is not reversed. Its ownership clause requires reused material to satisfy the licenses and attribution requirements that apply to it and does not say where the repository states them, so the README credit and the successor decision satisfy it.

Implementation reverses the well-said decision once. Its replaced language files move to `archived/2026/09/12-r2-well-said.md` and `archived/2026/09/12-r2-well-said.zh.md` with `Archived` and `Reversed by`, the successor takes the canonical path with `Reverses` pointing at that archive, and the earlier archive `archived/2026/09/12-r1-well-said.md`, whose `Reversed by` currently points at the replaced decision, follows it to `r2`. The archived `r2` pair keeps the layout it chose, with its link to the removed source document rewritten as a statement pointing at the successor. The consumed proposal is removed.

## Alternatives considered

**Drop only the component `LICENSE` files.** This was considered when choosing how much of each component's file set to remove. It removes the copy of the repository license, while each component keeps the upstream notice beside the writing instructions, which is the position under discussion.

**Keep `SOURCES.md` and `SOURCES.zh.md` and drop both license files.** This was considered when narrowing the removal to the two license files. It keeps the pinned revision, the category mapping, and the authorship split, and keeps both source documents in each component, which is the position under discussion.

**Keep `LICENSE.unslop` and drop the other three files.** This was considered when deciding whether the component keeps the upstream notice. It keeps the upstream notice inside the component. It keeps a legal notice in the Skill tree for a distribution path this repository does not use.

**Keep the notices in the Skill tree and load them on demand.** This was considered when deciding how a component exposes files that are not instructions. It keeps each component self-contained. It still puts legal text beside instructions that hosts and Agents read as one component, and adds a loading rule for material no writing session needs.

**Write the placement rule into the skills spec only.** This was considered when choosing where the placement rule lives. The rule would then cover plain Skills and miss the extensions that ship a README of their own.

**Write the placement rule into the boundary rule only, deleting the wrong requirement from the skills spec.** This was the other single-document placement considered at the same time. A Skill author reading the Skill spec would find no placement rule there and would have to look in the boundary rule.

**Record an accepted deviation instead of changing the rule.** This was considered before the placement was recognized as the defect. The boundary rule would keep an unconditional license duty, gain a deviation path, and a decision would name this reuse as an exception. It adds an exception mechanism for a case where no distribution path of this repository needs it.

**State the license and copyright year in the README credit as well.** This was considered when wording the README credit. The credit stays a credit, while the license and the pinned revision live in the decision a reader consults for reuse terms.

**Link the pinned revision from the README instead of `main`.** This was considered when wording the README link. The README link names where the upstream Skill lives now, while the decision pins the revision this repository copied.

## Acceptance criteria

1. `skills/well-said/` and `variants/zh/skills/well-said/` each contain only `SKILL.md`, both files stay byte-identical to their previous state, and `metadata.version` does not change.
2. `README.md` and `README.zh.md` credit the unslop inspiration, link to the upstream Skill, and name Lauren Tan as its author.
3. `.agents/rule/boundary.md` keeps its authorship and license duty and states where the repository records attribution and license information, and `.agents/spec/skills.md` no longer requires source attribution or license notices inside a Skill tree and keeps license and notice files out of it; both Chinese counterparts say the same.
4. The well-said decision is reversed once: its replaced files are archived under `r2` with the actual `Archived` date and `Reversed by`, the successor carries `Reverses` at the canonical path and keeps its predecessor's still-effective rules and the upstream revision, and the earlier archive's `Reversed by` points at `r2`. The first-party capability decision is unchanged.
5. No tracked file links to a removed or moved file, each reference is classified by meaning, current authority keeps the canonical decision path, historical citations follow the archived version, and relative paths and language links resolve.
6. The consumed proposal is removed, and the repository checks pass.

## Risks

The category mapping in the removed `SOURCES.md` files survives only in Git history, so a later provenance check reads history instead of a file.

A reader could take the new placement rule as ending the license obligation for reused material. The boundary rule keeps the duty, and the successor decision records the license, the pinned revision, and the author.

A reference classified by meaning can be classified wrongly: a citation of the current layout pointed at the archived version would read the superseded layout as current.

The change touches two components, two README files, a spec, a rule, and several decisions in two languages. A missed file leaves the repository stating two layouts at once.
