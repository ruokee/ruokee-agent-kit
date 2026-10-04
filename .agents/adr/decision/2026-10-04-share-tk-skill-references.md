# ADR decision: Align tk usage patterns with shared Skill reference sources

Decision owner: Ruokee
Decision writer: OMP Claude Opus 5.5
Reverses: [Align tk usage patterns](../archived/2026-09-11-align-tk-usage-patterns.md)

English | [中文](./2026-10-04-share-tk-skill-references.zh.md)

## Motivation

Define tk's four built-in usage patterns and the ownership and bilingual consistency rules for the pages that describe them.

One shared protocol lets an Agent and a user reach the same understanding of what a pattern adds, what it requires, and which page owns which contract.

Each tk Skill reference that is identical across the tools and CLI Skills of one language keeps one source file, and the build copies it into every Skill of that language. The tools Skill and the CLI Skill of each language carry six references with byte-identical content: `catchup.md`, `patterns.md`, `project-storage.md`, `subtask.md`, `task-concept.md`, and `wal.md`. Keeping a complete copy in each of the four Skill source directories means 24 file copies of 12 distinct texts, six English and six Chinese. An edit then has to be repeated in both Skill trees of a language, and a change that reaches only one tree leaves the tools and CLI Skills telling the Agent different rules.

The [Skill pattern reference](../../../projects/tk/skills/shared/en/patterns.md) and the [Skill design](../../../projects/tk/docs/design/skill.md) state the four patterns.

## Analysis

The [archived documentation decision](../archived/2026-08-29-maintain-tk-documentation.md) fixes the Chinese form of `scratchpad` as `临时记事区`, which conflicts with `草稿纸` as the pattern's Chinese name.

The [predecessor decision](../archived/2026-09-11-align-tk-usage-patterns.md) required each of the four Skill trees to keep its own complete pattern reference. A shared reference with one source per language cannot satisfy that clause, so this decision replaces it and carries the predecessor's other rules unchanged.

## Decision

### Four usage patterns

Define four built-in usage patterns for ordinary Task materials:

| English name | Chinese name | Default materials |
| --- | --- | --- |
| Records | 记录 | `records/YYYY-MM-DD-topic.md` |
| Deep research | 深度调研 | `research/report.md` and `research/README.md` |
| Iterative design | 迭代设计 | `revision_<N>/README.md` and materials within that revision |
| Scratchpad | 草稿纸 | Files and subdirectories under `scratchpad/` |

A Task may use any combination of the four patterns or none. Formal decisions follow the project's designated mechanism and location.

Patterns govern Agent behavior and ordinary materials. They add no tk metadata, schema fields, `extra` conventions, runtime states, commands, or automatic directory generation.

### Adoption and shared maintenance

- Suggest a pattern only after its signal has appeared, and explain the materials it introduces and the maintenance it requires. After the user adopts it, state the choice briefly in the `TASK.md` body and link its existing entry materials. An explicit user request to use a pattern is adoption authorization and needs no further confirmation.
- Pattern adoption does not replace authorization to create a Task or change its lifecycle. Routine material creation and editing retain their existing permissions. Deleting or moving materials requires the applicable authorization, as does overwriting materials whose ownership or meaning is unclear. Adopting a pattern grants no cleanup permission.
- Project rules and existing material structures can override the default paths. Create materials for work that has occurred. Do not prebuild empty directories, invent past activity, create future-date records, or migrate existing Tasks merely to match an example.
- `TASK.md` holds current facts, current decisions, and important entry links. Ordinary materials hold reusable detail. WAL, the Work Activity Log, holds concise durable event summaries appended through tk. Link these sources instead of copying entire documents between them.

### Records

Suggest Records after substantive investigation, implementation, validation, or decision work has occurred on a second local calendar date. Same-day tasks and plans to continue later do not meet that suggestion signal.

Maintain records only for local dates with substantive activity. Each record captures context, actions, evidence links, and conclusions held at that time. Preserve earlier judgments, put later corrections in subsequent materials, and keep `TASK.md` pointed at current conclusions. Stable designs, reference material, and sources keep their own material files, which records can link. Records do not replace WAL or formal decision records.

### Deep research

Suggest Deep research when the work requires collecting, retaining, or cross-checking external sources, or already has a source list and source materials. Reading one known document or answering an ordinary API usage question does not meet that signal.

Use `research/report.md` for conclusions and `research/README.md` to navigate existing research materials. Add plans, source maps, claim checks, and other supporting material only as needed. Create `research/sources/` only when Task-specific sources need local retention.

Maintain source provenance and access dates, evidence supporting key claims, conflicts between sources, unverified points, and the limits of conclusions. `TASK.md` provides a direct route to the report. A source list alone does not explain what the evidence supports, and unverified inferences must remain distinguishable from facts.

### Iterative design

Suggest Iterative design when two or more major redesigns replace earlier approaches, an earlier design is discarded as a whole, or the main boundaries keep changing. Incremental additions, wording changes, and ordinary review corrections do not call for a new revision.

Keep each revision self-contained under `revision_<N>/`. Its `README.md` explains the background, goals, main design, and material entry points. Create the next revision only for a new major redesign. Edit the current revision for ordinary corrections.

Retain superseded revisions as they stood. `TASK.md` links only the current revision as its design entry point. When a replacement needs explanation, put that explanation in the new revision rather than rewriting the old design to erase the earlier judgment.

### Scratchpad

Suggest Scratchpad when unfinished fragments, notes, outputs, small scripts, or other temporary files need persistent storage. Stable conclusions belong in organized ordinary materials. A brief exchange that needs no retention does not require a scratchpad.

Allow arbitrary files and subdirectories under `scratchpad/`, without a mandatory template, filename, or depth. When useful content stabilizes, organize it into suitable ordinary materials and keep only necessary current conclusions and entry links in `TASK.md`. Distinguish obsolete content from current facts. Deletion and movement follow the applicable authorization rules.

### Skill and contract ownership

The four Skill source directories are [tk](../../../projects/tk/skills/tk/SKILL.md), [tk-zh](../../../projects/tk/skills/tk-zh/SKILL.md), [tk-cli](../../../projects/tk/skills/tk-cli/SKILL.md), and [tk-cli-zh](../../../projects/tk/skills/tk-cli-zh/SKILL.md). Together with `projects/tk/skills/shared/en/` and `projects/tk/skills/shared/zh/`, they are the authoritative Skill sources. The six shared references live once per language in the shared directory. Each Skill source directory keeps `SKILL.md`, its mode-specific references, and any Agent metadata. Tools and CLI references in the same language have identical content; English and Chinese have equivalent meaning.

The tk build copies each shared reference of a language into the `references/` directory of every Skill in that language when it assembles the distributed payloads. A shared file and a Skill-specific file at the same assembled path stop the build. `SKILL.md` links to `./references/<file>.md`, the installed path, so these links resolve in the assembled payload and in every installed Skill; in the source tree, a link to a shared reference does not resolve inside the Skill directory. The build rejects a payload Markdown link whose target is missing.

Self-containment applies to the assembled and installed Skills under the [self-contained component decision](./2026-08-24-keep-components-self-contained.md). Each installed Skill references only files inside itself and carries every shared reference of its language, and the sources stay inside the tk component directory `projects/tk/`.

The [Skill design](../../../projects/tk/docs/design/skill.md) owns the Agent behavior contract. The [glossary](../../../projects/tk/docs/design/GLOSSARY.md) owns the four names and their meanings. The [documentation design](../../../projects/tk/docs/design/documentation.md) owns translation maintenance, and [validation](../../../projects/tk/docs/design/validation.md) owns observable acceptance. These contracts, their language counterparts, and the Skill references change together.

### Public documentation set

Public tk documentation lives under `projects/tk/docs/` and contains:

- English and Chinese user guides;
- English and Chinese design indexes;
- paired pages for system architecture, data model, runtime, tool API, CLI reference, Harness integration, installation, Skill behavior, validation, documentation, and the glossary;
- the component [English README](../../../projects/tk/README.md) and [Chinese README](../../../projects/tk/README.zh.md), which introduce tk and link to the guides and design pages without duplicating detailed commands or normative contracts;
- tk entry points in the repository root README and Chinese README, which link to the component entry pages;
- current English and Chinese tk ADRs under `decision/`.

Review records, revision numbers, Task paths, branch status, implementation logs, and local materials do not appear in public pages.

### Topic ownership

Each behavior has one primary owning page. The system page owns product boundaries and invariants. The data-model page owns Task formats and persistence. Runtime owns process and failure behavior. Tool API owns logical requests and results. CLI reference owns command spelling and exit behavior. Harness integration owns component forms and adapters. Installation owns component lifecycle. Skill owns Agent behavior and material patterns. Validation owns observable acceptance. Documentation owns maintenance rules. The glossary owns only project-specific terms and fixed translations.

A parameter table, algorithm, or normative field definition appears only on its owning page. Other pages link to it and state only the context needed by their readers.

ADRs preserve durable decisions, alternatives, and consequences. They link to current public contracts instead of copying full command, field, or test inventories.

### Final-state wording

Public documentation states the current formal contract as if it had been implemented in that form from the beginning. It does not narrate design revisions, review debates, discarded development commands, compatibility with unreleased formats, or Agent work history.

A real behavior change after release may include migration guidance when users need it. Development-only experiments do not become compatibility history and are not listed as removed features.

### English and Chinese

Each guide and design topic links to its other-language counterpart immediately after the H1. Repository file links are relative to the current document. Paths in the current directory or below start with `./`; links outside the directory use the required `../` segments.

English and Chinese pages have equivalent meaning. Chinese uses natural Chinese rather than mechanical sentence mapping. Commands, paths, fields, code, logs, product names, and identifiers retain their required spelling and capitalization.

Ordinary public Markdown pages use same-directory `name.md` and `name.zh.md` pairs, including component README pairs, under the [public documentation decision](./2026-09-07-colocate-bilingual-docs.md). Do not maintain separate language directories or redirect placeholders at replaced paths, and repair affected inbound links and command examples when pages move.

The glossary contains only terms with tk-specific meaning, fixed capitalization, or a translation that must remain stable. General technical vocabulary stays in its owning document. Fixed Chinese forms include `受管`, `草稿纸`, `人类可读`, `直接切换`, `支持的子命令`, `活动操作标记`, `表示切换`, `续跑令牌`, and `续跑状态`.

### Component selection and distribution documentation

Public documentation covers tools and CLI modes, English and Chinese selection through `tk install`, the four Skill identities, multiple Harness payloads, two Harness-independent CLI Skill payloads, the split routing contract, the mutually exclusive install targets, and the bounded custom-root lifecycle.

### ADR format and lifecycle

ADR proposals and decisions use separate repository formats and directories. English and Chinese pairs remain semantically aligned, and the maintainer controls proposal approval, rejection, and decision archival. Current records live under `decision/`, and ADR files carry no `Status` field.

### Maintenance

A public behavior change updates the owning design page, affected guide and CLI examples, both languages, affected Skill content, every current ADR that owns the decision, and the corresponding validation contract in the same change.

Repository Markdown, link, formatting, and spelling checks are combined with manual bilingual review. tk does not add a custom documentation structure or translation checker until repeated maintenance or an observed drift failure establishes a concrete invariant worth automating.

The authoritative maintenance details live in the [documentation design](../../../projects/tk/docs/design/documentation.md) and [glossary](../../../projects/tk/docs/design/GLOSSARY.md).

## Alternatives considered

**Repeat complete contracts on every related page.** Duplication would make routine changes require many synchronized edits and leave readers unsure which copy is authoritative.

**Keep implementation history in public design pages.** Development chronology would obscure the current contract and turn unreleased experiments into accidental compatibility promises.

**Put every technical term in the glossary.** A large general glossary would duplicate ordinary technical documentation and create needless translation maintenance.

**Build a tk-specific bilingual structure checker.** Structural similarity cannot prove semantic equivalence or natural Chinese. Existing checks plus direct review are sufficient until a repeated mechanical failure identifies a useful rule.

**Keep a complete copy of every shared reference in each Skill source directory.** Each source directory then resolves its own links, but every shared edit stays duplicated across two trees per language, and drift between the tools and CLI Skills is caught only by review.

## Consequences

Readers can enter through a guide, design topic, Skill, or ADR and follow relative links to the owning contract. Each normative detail has one main maintenance location.

Shared Skill references and bilingual public contracts describe the same patterns. A shared reference has one source per language, so the tools and CLI Skills of that language cannot differ in those files. Keeping the Skill references, the four `SKILL.md` files, and both languages aligned still requires maintaining them together; a change that reaches only some files can leave the rules inconsistent, so an Agent may follow different adoption or maintenance rules from those users read.

A reader or Agent browsing a Skill source directory follows a `./references/` link to a shared file and finds nothing, because the file exists there only after assembly. Someone who edits the source tree without reading the [Skill design](../../../projects/tk/docs/design/skill.md) may recreate a local copy and reintroduce a duplicate source; the build stops on the path collision, but only after the copy is written.

Every product change carries bilingual documentation work. Manual review remains necessary because formatting checks, link checks, and Rust tests cannot establish semantic equivalence, writing quality, or Agent behavior; scenario validation exercises the four patterns through each of the four Skills.

Final-state wording keeps public documentation compact, but review history and implementation evidence must live in Task materials or other non-public records. ADRs retain rationale without becoming release notes or progress logs.
