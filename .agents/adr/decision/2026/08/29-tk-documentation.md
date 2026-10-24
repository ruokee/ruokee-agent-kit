# tk documentation

Decision owner: Ruokee
Decision writer: OMP Claude Opus 5.5
Reverses: [tk documentation](../../../archived/2026/08/29-r4-tk-documentation.md)

English | [中文](./29-tk-documentation.zh.md)

## Motivation

Maintain tk's four material patterns with complete specifications, independently usable component guidance, and aligned bilingual documentation.

One shared protocol lets an Agent and a user reach the same understanding of what a pattern adds, what it requires, and which page owns which contract.

Each tk Skill reference that is identical across the tools and CLI Skills of one language keeps one source file, and the build copies it into every Skill of that language. Keeping a complete copy in each of the four Skill source directories would repeat every shared edit in both Skill trees of a language, and a change that reaches only one tree leaves the tools and CLI Skills telling the Agent different rules.

The [Agent behavior specification](../../../../spec/tk-agent.md) states the required pattern behavior. The [Skill pattern reference](../../../../../projects/tk/skills/shared/en/patterns.md) and [Skill guidance](../../../../../projects/tk/docs/design/skill.md) explain their use.

## Analysis

The [archived documentation decision](../../../archived/2026/08/29-r1-tk-documentation.md) fixes the Chinese form of `scratchpad` as `临时记事区`, which conflicts with `草稿纸` as the pattern's Chinese name.

An [earlier decision](../../../archived/2026/08/29-r2-tk-documentation.md) required each of the four Skill trees to keep its own complete pattern reference. The shared source per language avoids duplicated edits and remains the distribution choice. A [later version](../../../archived/2026/08/29-r3-tk-documentation.md) assigned required behavior and acceptance exclusively to component pages. That ownership leaves a specification incomplete without those pages. Specifications therefore contain the complete requirements, while component guidance, design, and validation retain their distinct purposes.

The [direct predecessor](../../../archived/2026/08/29-r4-tk-documentation.md#adr-lifecycle) required separate proposal and decision formats. The [ADR mechanism](./22-adr-mechanism.md) uses tasks for discussion and approval and retains only current and replaced decisions. tk documentation follows that mechanism without changing the task runtime or material patterns.

## Decision

### Usage patterns

Records, Deep research, Iterative design, and Scratchpad organize ordinary Task materials. A Task may combine them or use none. Formal decisions follow the project's designated mechanism and location. Patterns add no tk metadata, schema fields, `extra` conventions, runtime states, commands, or automatic directory generation.

### Pattern adoption

Suggest a pattern only after its signal appears, explaining the materials and maintenance it adds. Explicit user requests authorize adoption without another confirmation. Adoption grants no Task creation, lifecycle, deletion, move, or unclear-overwrite permission. Ordinary material editing retains its existing permissions.

The [Agent behavior specification](../../../../spec/tk-agent.md#material-patterns) preserves each pattern's signals, counterexamples, defaults, history, evidence, and cleanup requirements. The [pattern reference](../../../../../projects/tk/skills/shared/en/patterns.md) provides the operating guidance. Project conventions may override default paths; create material for actual work, without empty scaffolds, invented history, future-date records, or automatic migration. Task summaries, detailed materials, and WAL retain their separate roles.

### Contract ownership

Keep one source per language for references shared by tools and CLI Skills. The component owns its source and assembly layout in [Skill design](../../../../../projects/tk/docs/design/skill.md#installed-skill-identities). Same-language shared references are identical, and languages are semantically equivalent. Assembly rejects collisions between shared and Skill-specific files and Markdown links to missing payload targets.

Each assembled and installed Skill carries all its language's shared references and references only its own files, under the [self-containment decision](./24-component-self-containment.md). Sources remain within the tk component. Source navigation may require assembly; installed navigation must work independently.

The [Agent behavior specification](../../../../spec/tk-agent.md) contains complete behavior and acceptance. [Skill guidance](../../../../../projects/tk/docs/design/skill.md) is independently usable. The [glossary](../../../../../projects/tk/docs/design/GLOSSARY.md), [documentation design](../../../../../projects/tk/docs/design/documentation.md), and [validation](../../../../../projects/tk/docs/design/validation.md) own terminology, maintenance, and validation methods. Maintain them, their translations, and Skill references together.

### Public documentation set

The component [README](../../../../../projects/tk/README.md) introduces tk and navigates its complete bilingual guides and design topics without copying detailed contracts. Repository entries link to the component entry. Review records, Task paths, branch state, implementation logs, and local materials stay outside public pages.

### Topic ownership

The complete [tk specification set](../../../../spec/README.md#tk) owns required behavior and acceptance. Each detailed component explanation has one primary topic page, navigated by the [design index](../../../../../projects/tk/docs/design/README.md). User guidance, implementation design, validation methods, and terminology retain distinct purposes.

Specifications fully state necessary commands, parameters, fields, defaults, limits, failure semantics, and compatibility. User references independently describe the same contract; design holds algorithms and internal mechanisms. Component pages may link to their primary topic explanations, but specifications do not delegate requirements or link repository files. Distributed component documentation does not depend on repository specifications.

ADRs preserve durable decisions, alternatives, and consequences. They link to current public contracts instead of copying full command, field, or test inventories.

### Final state wording

Public documentation states the current formal contract as if it had been implemented in that form from the beginning. It does not narrate design revisions, review debates, discarded development commands, compatibility with unreleased formats, or Agent work history.

A real behavior change after release may include migration guidance when users need it. Development-only experiments do not become compatibility history and are not listed as removed features.

### Language pair

Each guide and design topic links to its other-language counterpart immediately after the H1. Repository file links are relative to the current document. Paths in the current directory or below start with `./`; links outside the directory use the required `../` segments.

English and Chinese pages have equivalent meaning. Chinese uses natural Chinese rather than mechanical sentence mapping. Commands, paths, fields, code, logs, product names, and identifiers retain their required spelling and capitalization.

Ordinary public Markdown pages use same-directory `name.md` and `name.zh.md` pairs, including component README pairs, under the [public documentation decision](./20-bilingual-docs.md). Do not maintain separate language directories or redirect placeholders at replaced paths, and repair affected inbound links and command examples when pages move.

The glossary contains only terms with tk-specific meaning, fixed capitalization, or a translation that must remain stable. General technical vocabulary stays in its owning document. Fixed Chinese forms include `受管`, `草稿纸`, `人类可读`, `直接切换`, `支持的子命令`, `活动操作标记`, `表示切换`, `续跑令牌`, and `续跑状态`.

### Distribution documentation

Public documentation covers tools and CLI modes, English and Chinese selection through `tk install`, the four Skill identities, multiple Harness payloads, two Harness-independent CLI Skill payloads, the split routing contract, the mutually exclusive install targets, and the bounded custom-root lifecycle.

### ADR lifecycle

ADRs use the decision format. Current decisions live under `decision/`, and decisions that took effect and were replaced live under `archived/`. English and Chinese pairs remain semantically aligned. The maintainer controls adoption of durable choices and archival; completing design, implementation, or validation grants neither authority automatically. ADR files carry no `Status` field.

Tasks hold discussion, approval, and execution arrangements without adding tk states or commands. A formal decision preserves the public reasons and contract independently, including material rejected alternatives. Unadopted drafts are not archived decisions. Decisions requiring implementation are integrated with it; document-only choices may be integrated independently.

### Maintenance

A public behavior change updates complete affected specifications, relevant design and reference pages, affected guide and CLI examples, both languages, affected Skill content, every current ADR that owns the decision, and the corresponding validation methods and scenarios in the same change.

Repository Markdown, link, formatting, and spelling checks are combined with manual bilingual review. tk does not add a custom documentation structure or translation checker until repeated maintenance or an observed drift failure establishes a concrete invariant worth automating.

The authoritative maintenance details live in the [documentation design](../../../../../projects/tk/docs/design/documentation.md) and [glossary](../../../../../projects/tk/docs/design/GLOSSARY.md).

## Alternatives considered

**Keep a complete copy of every shared reference in each Skill source directory.** Each source directory then resolves its own links, but every shared edit stays duplicated across two trees per language, and drift between the tools and CLI Skills is caught only by review.

## Consequences

Readers can determine the complete required behavior from the specification set or use component guidance independently. Design and validation have separate implementation and evidence responsibilities. These documents describe the same contract without making component users depend on repository specifications.

Shared Skill references and bilingual public contracts describe the same patterns. A shared reference has one source per language, so the tools and CLI Skills of that language cannot differ in those files. Keeping the Skill references, the four `SKILL.md` files, and both languages aligned still requires maintaining them together; a change that reaches only some files can leave the rules inconsistent, so an Agent may follow different adoption or maintenance rules from those users read.

A reader or Agent browsing a Skill source directory follows a `./references/` link to a shared file and finds nothing, because the file exists there only after assembly. Someone who edits the source tree without reading the [Skill design](../../../../../projects/tk/docs/design/skill.md) may recreate a local copy and reintroduce a duplicate source; the build stops on the path collision, but only after the copy is written.

Every product change carries bilingual documentation work. Manual review remains necessary because formatting checks, link checks, and Rust tests cannot establish semantic equivalence, writing quality, or Agent behavior; scenario validation exercises the four patterns through each of the four Skills.

Final-state wording keeps public documentation compact, but review history and implementation evidence must live in Task materials or other non-public records. ADRs retain rationale without becoming release notes or progress logs.
