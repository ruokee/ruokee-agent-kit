# Usage patterns

These patterns describe ways to organize ordinary materials inside a Task directory. They are not tk-managed formats and add no metadata, schema fields, `extra` conventions, runtime states, commands, or automatic directory generation. Create files for the work that exists; do not prebuild empty directories or placeholder documents to match an example.

## Adoption and shared maintenance

A Task may combine any of these patterns or use none. Before suggesting one, confirm that its signal has appeared and explain which materials it adds and what maintenance it requires. After the user adopts it, state the choice briefly in the `TASK.md` body and link the existing entry materials. An explicit request to use a pattern is adoption authorization itself; do not ask for a separate confirmation.

Adopting a pattern does not authorize creating a Task or changing its lifecycle. Routine creation and editing of ordinary materials keep their existing permissions. Deleting or moving materials follows the applicable authorization rules, as does overwriting materials whose ownership or meaning is unclear; adopting a pattern grants no cleanup permission.

The default paths below are the usual organization. Project rules and existing material structures can replace them. Do not invent past activity, create a record dated in the future, or migrate an existing Task just to match an example.

`TASK.md` holds current facts, current decisions, and important entry links. Ordinary materials hold reusable detail. WAL, the Work Activity Log, holds concise durable event summaries appended through tk. Link between them instead of copying whole passages. Formal decisions follow the project's designated mechanism and location.

## Records

Suggest Records after substantive investigation, implementation, validation, or decision work has occurred on a second local calendar date. A same-day task, or a plan to continue later without further activity, does not meet that signal.

Default material: `records/YYYY-MM-DD-topic.md`, with the local date and topic in the file name.

Each record keeps the context, the actions taken, evidence links, and the conclusions held at that time. Maintain a record only for a date with real activity; do not open a page for a date without activity. Preserve earlier judgments as they were written, put later corrections in subsequent materials, and keep `TASK.md` pointed at the conclusions that still apply.

Records link to stable designs, reference material, and sources, which keep their own files. Records do not replace WAL or a formal decision record.

## Deep research

Suggest Deep research when the work needs collecting, retaining, or cross-checking external sources, or when a source list and source materials already exist. Reading one known document or answering an ordinary API usage question does not meet that signal.

Default materials:

- `research/report.md` for the conclusions;
- `research/README.md` to navigate the research materials that exist.

Add a research plan, source map, claim checks, or other supporting material only as the work needs them. Create `research/sources/` only when Task-specific sources need local retention; do not prebuild an empty source directory.

Maintain source provenance and access dates, the evidence behind key claims, conflicts between sources, the points that remain unverified, and the limits within which the conclusions hold. A source list alone does not show what the evidence supports, and unverified inferences stay distinguishable from facts. `TASK.md` links the report directly.

## Iterative design

Suggest Iterative design when two or more major redesigns have replaced earlier approaches, an earlier design was discarded as a whole, or the main boundaries keep changing. Incremental additions, wording changes, and ordinary review corrections do not call for a new revision.

Default material: `revision_<N>/`, one self-contained directory per major revision. Its `README.md` explains the background, goals, main design, and material entry points.

Create the next revision only for a new major redesign; correct ordinary issues by editing the current revision. Keep superseded revisions as they stood. `TASK.md` links only the current revision as the design entry point. When a replacement needs explanation, put that explanation in the new revision instead of rewriting the old design to erase the earlier judgment.

## Scratchpad

Suggest Scratchpad when unfinished fragments, notes, command output, small scripts, or other temporary files need a persistent place. A brief exchange that needs no retention, or a conclusion that already belongs in an ordinary material, does not meet that signal.

Default material: `scratchpad/`, which may contain any files and subdirectories, without a prescribed name, format, or depth.

When useful content stabilizes, organize it into suitable ordinary materials and keep only the necessary current conclusions and entry links in `TASK.md`. Keep obsolete content distinguishable from current facts rather than letting an old guess read as current. Deleting or moving scratchpad content follows the applicable authorization rules.

## Material links

Ordinary materials may use any format and directory structure, but `TASK.md` should link the important entry points. Link text should name the material instead of saying only "see here."

For example, the entry names and the relative targets that `TASK.md` links:

| Entry | Target relative to `TASK.md` |
| --- | --- |
| Records | `./records/2026-09-11-usage-patterns.md` |
| Research report | `./research/report.md` |
| Current design | `./revision_2/README.md` |
| Scratchpad notes | `./scratchpad/probe-notes.md` |

Write each entry as a relative Markdown link in `TASK.md`.
