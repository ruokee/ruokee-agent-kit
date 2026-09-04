# Usage patterns

These patterns show ways to place ordinary materials in a Task directory. They are not tk-managed formats. Create files for the work that exists. Do not prebuild empty directories or placeholder documents to match an example.

## Scratchpad

Create `scratchpad/` when temporary material needs a place:

```text
<task>/
└── scratchpad/
```

`scratchpad/` may contain any files or subdirectories, such as temporary notes, command output, unorganized fragments, screenshots, or small scripts. tk does not prescribe names, formats, or depth.

A scratchpad only provides a temporary place. When content stabilizes, move conclusions that still matter into suitable ordinary materials or `TASK.md`. Delete obsolete drafts so later readers do not mistake an old guess for current fact.

## Research

This is one possible layout, not a template to copy:

```text
research/
├── question.md
├── sources/
├── evidence.md
└── report.md
```

The real layout depends on the question, source types, and deliverable. One Markdown file is enough for one conclusion. Add files only when raw data, source excerpts, or several rounds of analysis need preservation. Do not create empty `sources/`, `evidence.md`, or `report.md` entries.

Reviewable research usually states:

- the question being answered;
- factual sources and access dates;
- conclusions supported by evidence;
- points that remain unconfirmed.

## Experiments

This is also only an example:

```text
experiment/
├── setup.md
├── inputs/
├── runs/
└── result.md
```

Keep the materials the experiment needs. A short command check may record only the command, environment, and output. Add directories for samples, scripts, or repeated runs only when they exist. Do not copy the example hierarchy mechanically.

An experiment record should let a later reader determine what ran, which inputs it used, what was observed, and where the conclusion applies. If the result cannot be reproduced, state the missing environment, data, or external dependency.

## Iterative design

Design work may separate stable constraints, candidate choices, and verification results. For example:

```text
design/
├── constraints.md
├── options.md
└── verification.md
```

Let the file count follow the actual complexity. Do not create `options.md` without several candidates. Do not create a directory when one page is enough.

Keep the current objective, active decisions, important material links, and current blockers in `TASK.md`. Superseded choices may remain in ordinary materials, but mark them clearly as rejected or obsolete so they do not contaminate current state.

## Decision records

When a project already uses ADRs, RFCs, or another formal decision system, Task materials may hold proposal drafts, evidence, and discussion results. Put the formal decision in the project-defined location. A Task directory does not replace that system.

A design decision should state at least:

- the current decision;
- constraints and evidence behind it;
- affected behavior or interfaces;
- unresolved questions.

Do not put session-only editing history, corrected old claims, or Agent work notes in a formal decision.

## Material links

Ordinary materials may use any format and directory structure, but `TASK.md` should link important entry points. Link text should name the material instead of saying only "see here."

For example:

```markdown
## Important materials

- CLI behavior review: `research/cli-behavior.md`
- Experiment result: `experiment/result.md`
```

WAL records what happened, ordinary materials hold reusable content, and `TASK.md` states current status. Do not copy whole passages among them.
