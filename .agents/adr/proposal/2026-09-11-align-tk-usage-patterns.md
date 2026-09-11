# ADR proposal: Align tk usage patterns

Decision owner: Ruokee
Draft writer: OMP anyrouter/gpt-6-astra

English | [中文](./2026-09-11-align-tk-usage-patterns.zh.md)

## Motivation

The [Skill pattern reference](../../../projects/tk/skills/tk/references/patterns.md) and the [Skill design](../../../projects/tk/docs/design/skill.md) describe different sets of material patterns. They lack a shared protocol for when to suggest a pattern, how a user adopts it, and what the Agent maintains afterward. Directory examples alone do not explain how to preserve activity across dates, keep research claims tied to evidence, or retain designs replaced by major revisions.

The [documentation decision](../decision/2026-08-29-maintain-tk-documentation.md) fixes the Chinese form of `scratchpad` as `临时记事区`. Using `草稿纸` as the pattern's Chinese name conflicts with that choice and requires a complete successor decision.

## Proposal

### Four optional patterns

Define four built-in usage patterns for ordinary Task materials:

| English name | Chinese name | Default materials |
| --- | --- | --- |
| Records | 记录 | `records/YYYY-MM-DD-topic.md` |
| Deep research | 深度调研 | `research/report.md` and `research/README.md` |
| Iterative design | 迭代设计 | `revision_<N>/README.md` and materials within that revision |
| Scratchpad | 草稿纸 | Files and subdirectories under `scratchpad/` |

A Task may use any combination or none. Experiments, formal decisions, reviews, and validation evidence remain valid ordinary materials without becoming additional built-in patterns. Formal decisions follow the project's designated mechanism and location.

Patterns govern Agent behavior and ordinary materials. They add no tk metadata, schema fields, `extra` conventions, runtime states, commands, or automatic directory generation. Runtime, lifecycle, tool routing, and installation contracts remain unchanged.

### Adoption and shared maintenance

- Before suggesting a pattern, identify an observed signal and explain the materials it introduces and the maintenance it requires. After the user adopts it, state the choice briefly in the `TASK.md` body and link its existing entry materials. An explicit user request to use a pattern is adoption authorization and does not need another confirmation.
- Pattern adoption does not replace authorization to create a Task or change its lifecycle. Routine material creation and editing retain their existing permissions. Deleting or moving materials requires the applicable authorization, as does overwriting materials whose ownership or meaning is unclear. Adopting a pattern grants no cleanup permission.
- Project rules and existing material structures can override the default paths. Create materials for work that has occurred. Do not prebuild empty directories, invent past activity, create future-date records, or migrate existing Tasks merely to match an example.
- `TASK.md` holds current facts, current decisions, and important entry links. Ordinary materials hold reusable detail. WAL, the Work Activity Log, holds concise durable event summaries appended through tk. Link these sources instead of copying entire documents between them.

### Records

Suggest Records after substantive investigation, implementation, validation, or decision work has occurred on a second local calendar date. Same-day tasks and plans to continue later do not meet that suggestion signal.

Maintain records only for local dates with substantive activity. Each record captures context, actions, evidence links, and conclusions held at that time. Preserve earlier judgments; put later corrections in subsequent materials and keep `TASK.md` pointed at current conclusions. Stable designs, reference material, and sources keep their own material files, which records can link. Records do not replace WAL or formal decision records.

### Deep research

Suggest Deep research when the work requires collecting, retaining, or cross-checking external sources, or already has a source list and source materials. Reading one known document or answering an ordinary API usage question does not meet that signal.

Use `research/report.md` for conclusions and `research/README.md` to navigate existing research materials. Add plans, source maps, claim checks, and other supporting material only as needed. Create `research/sources/` only when Task-specific sources need local retention.

Maintain source provenance and access dates, evidence supporting key claims, conflicts between sources, unverified points, and the limits of conclusions. `TASK.md` provides a direct route to the report. A source list alone does not explain what the evidence supports, and unverified inferences must remain distinguishable from facts.

### Iterative design

Suggest Iterative design when two or more major redesigns replace earlier approaches, an earlier design is discarded as a whole, or the main boundaries keep changing. Incremental additions, wording changes, and ordinary review corrections do not call for a new revision.

Keep each revision self-contained under `revision_<N>/`. Its `README.md` explains the background, goals, main design, and material entry points. Create the next revision only for a new major redesign. Edit the current revision for ordinary corrections.

Retain superseded revisions as they stood. `TASK.md` links only the current revision as its design entry point. When a replacement needs explanation, put that explanation in the new revision rather than rewriting the old design to erase the earlier judgment.

### Scratchpad

Use Scratchpad when unfinished fragments, notes, outputs, small scripts, or other temporary files need persistent storage. Stable conclusions belong in organized ordinary materials. A brief exchange that needs no retention does not require a scratchpad.

Allow arbitrary files and subdirectories under `scratchpad/`, without a mandatory template, filename, or depth. When useful content stabilizes, organize it into suitable ordinary materials and keep only necessary current conclusions and entry links in `TASK.md`. Distinguish obsolete content from current facts. Deletion and movement follow the applicable authorization rules.

### Documentation and decision ownership

Apply the same material behavior to the four self-contained Skills: [tk](../../../projects/tk/skills/tk/SKILL.md), [tk-zh](../../../projects/tk/skills/tk-zh/SKILL.md), [tk-cli](../../../projects/tk/skills/tk-cli/SKILL.md), and [tk-cli-zh](../../../projects/tk/skills/tk-cli-zh/SKILL.md). Each keeps its own complete pattern reference. Tools and CLI references in the same language have identical content; English and Chinese have equivalent meaning. Skill files retain references within their own component.

The [Skill design](../../../projects/tk/docs/design/skill.md) owns the Agent behavior contract. The [glossary](../../../projects/tk/docs/design/GLOSSARY.md) owns the four names and their meanings. The [documentation design](../../../projects/tk/docs/design/documentation.md) owns translation maintenance, and [validation](../../../projects/tk/docs/design/validation.md) owns observable acceptance. Update these contracts and their language counterparts together with the Skill references.

Reverse the fixed `scratchpad` translation choice in the [documentation decision](../decision/2026-08-29-maintain-tk-documentation.md), using `草稿纸` as the Chinese form. The complete successor decision must incorporate this pattern contract and retain every other still-effective rule in that decision and its Changes, including the public documentation set, topic ownership, final-state wording, bilingual maintenance, self-contained Skills, documentation of component selection and custom CLI Skill roots, and README navigation. Relationship links and current references must identify the successor as current authority.

## Alternatives considered

None

## Acceptance criteria

- All four Skill references and the owning public documents define exactly the four named patterns. Each pattern states its suggestion signal, counterexamples, default materials, and ongoing maintenance. Other work can retain ordinary materials without becoming an additional pattern.
- Scenario checks cover activity on a second local date versus a same-day task, source collection and cross-checking versus a single-document query, major redesigns versus ordinary corrections, and temporary fragments versus stable conclusions.
- Before adoption, the Agent explains its suggestion and does not declare a pattern in `TASK.md`. An explicit request adopts the pattern directly. Project-specific layouts remain usable without forced migration or empty materials.
- Records retain earlier judgments while `TASK.md` points to current facts. WAL remains a concise tk-managed activity history. Research claims remain traceable to evidence and uncertainty. Superseded design revisions remain self-contained, with only the current revision exposed as the design entry point.
- Scratchpad maintenance preserves useful content and distinguishes obsolete material. No pattern grants permission to delete or move material, create a Task, or change its lifecycle.
- Same-language tools and CLI pattern references match, both languages describe the same behavior, and each Skill is self-contained. The fixed Chinese form is `草稿纸`; the successor decision retains the other effective documentation rules and has valid relationship and inbound links.
- Repository checks pass, and scenario validation exercises the four patterns through each of the four Skills. Formatting and Rust tests alone do not establish Agent behavior. The change adds no runtime or metadata mechanism.

## Risks

Maintaining four self-contained Skill references and bilingual public contracts can reproduce the existing classification drift if a change reaches only some files. An Agent could then follow different adoption or maintenance rules from those users read. Update the affected documents together and compare their semantics during review.
