# tk documentation

Decision owner: Ruokee
Decision writer: OMP Claude Opus 5.5
Reverses: [tk documentation](../../../archived/2026/08/29-r5-tk-documentation.md)

English | [中文](./29-tk-documentation.zh.md)

## Motivation

Maintain complete bilingual CLI guidance in two self-contained Skill trees and independently usable public documentation.

Each language has one Skill and one maintained copy of its references. Keeping those files together makes source and installed navigation identical. Complete specifications and clear topic ownership let Agents and users obtain the same contract without depending on private work records.

## Decision

### Usage patterns

Records, Deep research, Iterative design, and Scratchpad organize ordinary Task materials. A Task may combine them or use none. Patterns add no metadata, schema fields, `extra` conventions, runtime states, commands, or automatic directories. Formal decisions follow the project's designated mechanism and location.

Suggest a pattern only after its signal appears and explain the materials and maintenance it adds. An explicit user request authorizes adoption without another confirmation. Adoption grants no Task creation, lifecycle, deletion, move, or unclear-overwrite permission. Ordinary material editing retains its existing permissions.

The [Agent behavior specification](../../../../spec/tk-agent.md#material-patterns) preserves each pattern's signals, counterexamples, defaults, history, evidence, and cleanup requirements. The [pattern reference](../../../../../projects/tk/skills/tk-cli/references/patterns.md) provides operating guidance. Project conventions may override default paths. Create materials for actual work, without empty scaffolds, invented history, future-date records, or automatic rearrangement of existing Tasks. Task summaries, detailed materials, and WAL keep separate roles.

### Skill source

`tk-cli` and `tk-cli-zh` each contain their entry, complete references, and Agent metadata. All source and installed file references resolve inside the same Skill. Assembly collects those complete trees and rejects missing Markdown targets. There is one maintained reference copy per language and no cross-directory assembly dependency.

The two languages provide equivalent behavior. [Skill design](../../../../../projects/tk/docs/design/skill.md) owns source and distribution organization under the [self-containment decision](./24-component-self-containment.md).

### Contract ownership

The complete [tk specification set](../../../../spec/README.md#tk) owns required behavior and acceptance, including necessary commands, parameters, fields, defaults, limits, failure semantics, and compatibility. Specifications contain no repository-file links and delegate no missing requirements.

Component user references independently describe the same contract. Design explains algorithms and internal mechanisms; validation describes methods and evidence. The [design index](../../../../../projects/tk/docs/design/README.md) navigates one primary explanation per topic. Distributed component documentation does not depend on repository specifications.

The [component README](../../../../../projects/tk/README.md) introduces tk and links its bilingual guide and design pages without duplicating detailed contracts. Repository entries link to the component entry. Review records, Task paths, branch state, implementation logs, and local materials stay outside public pages.

ADRs preserve durable choices, necessary reasons, material alternatives, and consequences. They link accessible contracts rather than copying full command, field, or test inventories.

### Final state wording

Public documentation states the current formal contract. It contains no design-revision narration, review debates, discarded development commands, unreleased-format compatibility, or Agent work history. Historical decisions retain their actual contracts. Only the component README's brief deprecation statement describes retired access; current references describe the supported CLI without update instructions.

### Language pair

Ordinary public Markdown pages use same-directory `name.md` and `name.zh.md` pairs, including component README pairs, under the [public documentation decision](./20-bilingual-docs.md). Guide and design topics link their counterpart immediately after the H1. Skill language variants remain separate self-contained trees.

Repository file links are relative to the document, using `./` for its directory or descendants and the necessary `../` for outside targets. Pages do not use separate language directories or redirect placeholders. Moves repair affected inbound links and command examples.

English and Chinese have equivalent meaning. Chinese uses natural phrasing rather than mechanical sentence mapping. Commands, paths, fields, code, logs, product names, and identifiers retain required spelling and capitalization.

The glossary includes only tk-specific meanings, fixed capitalization, and stable translations. General technical vocabulary stays in its owning document. Fixed Chinese forms include `受管`, `草稿纸`, `人类可读`, `直接切换`, `支持的子命令`, `活动操作标记`, `表示切换`, `续跑令牌`, and `续跑状态`.

### Distribution documentation

Public references cover the sole CLI interface, both language identities, English-default installation, mutually exclusive Harness and custom-root targets, root mappings, and the bounded lifecycle of the two ordinary Skills.

### ADR lifecycle

ADRs use the decision format. Current decisions live under `decision/`; adopted and replaced decisions live under `archived/`. Language pairs stay semantically aligned and carry no `Status` field. The maintainer controls adoption and archival; design, implementation, and validation completion grant neither automatically.

Tasks hold discussion, approval, and execution arrangements without new runtime states or commands. Formal decisions retain publicly understandable reasons and contracts independently of Task materials, including material rejected alternatives. Unadopted drafts are not archived decisions. Decisions requiring implementation integrate with it; document-only choices may integrate independently.

### Maintenance

A public behavior change updates complete affected specifications, design and reference pages, guide and CLI examples, both languages, affected Skills, current owning ADRs, and validation methods and scenarios together.

Use repository Markdown, link, formatting, and spelling checks with manual bilingual review. Do not add a custom structure or translation checker until repeated maintenance or an observed drift failure establishes a concrete invariant worth automating. The [documentation design](../../../../../projects/tk/docs/design/documentation.md) and [glossary](../../../../../projects/tk/docs/design/GLOSSARY.md) hold the maintenance details.

## Alternatives considered

None

## Consequences

Readers can determine requirements from the specification set and use component guidance independently. Source and installed Skills share usable internal navigation without maintaining duplicate same-language references.

Bilingual Skill and public guidance still require coordinated edits. Updating only some files can give Agents different adoption or maintenance rules from those users read. Formatting and Rust checks do not establish semantic equivalence or Agent behavior; manual review and applicable Harness scenarios retain those responsibilities.

Final-state wording keeps public references focused. Task materials retain execution evidence, while ADRs preserve reasons without becoming progress logs.
