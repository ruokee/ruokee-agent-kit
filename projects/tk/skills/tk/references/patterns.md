# Material patterns

These patterns organize ordinary Task files. They do not add runtime state, schema fields, lifecycle values, or automatic indexing. Project instructions override them.

Choose a pattern only when the material needs it. Do not prebuild empty structures.

## Scratchpad

Use a scratchpad for short-lived notes that are not a final deliverable.

```text
scratchpad.md
```

Delete or replace it when its useful facts move into `TASK.md` or durable material.

## Research package

Use when the work must preserve sources, evidence, claim boundaries, and unresolved questions.

```text
research/
├── sources.md
├── findings.md
└── open-questions.md
```

Record source locations and distinguish observed facts from inference.

## Design revisions

Use when several designs replace one another and readers need one current entry point.

```text
design/
├── README.md
├── revision-1.md
└── revision-2.md
```

The README names the current revision and the status of older ones. `TASK.md` links to the current entry point instead of copying the design.

## Review records

Use when preserving independent reviews, disagreements, and disposition matters.

```text
records/
├── reviewer-a.md
├── reviewer-b.md
└── disposition.md
```

Keep reviewer observations separate from the final disposition. The disposition states which findings changed the result.

## Validation evidence

Use when acceptance depends on repeatable commands, environment details, observed results, and a pass or fail judgment.

```text
validation/
├── environment.md
├── commands.md
└── results.md
```

Record only evidence needed to reproduce the judgment. Do not turn routine command output into permanent material.
