# Skill behavior

[简体中文](./skill.zh.md)

This page defines the ideal behavior for Agents using tk. The runtime enforces metadata, path, lifecycle, relationship, Git, and persistence rules. Skill does not duplicate these rules.

## When to use tk

Use tk when the user explicitly mentions a Task ID, Task name, Task path, Task branch, or tk operation.

In permissive projects, an Agent may also create a Task for work that clearly deserves persistence across multiple steps or sessions. Quick questions, ordinary TODOs, minor one-off changes, and casual ideas do not need a Task.

A Task is a temporary effort worth preserving. Creating one does not mean that the user or Agent has committed to executing or completing it.

## Installed Skill identities

tk provides four independent, self-contained Skills:

| Mode | English | Chinese |
| --- | --- | --- |
| tools | `tk` | `tk-zh` |
| CLI | `tk-cli` | `tk-cli-zh` |

The tools Skills use the Harness's logical operation for search, read, create, update, and log. Their exec operation accepts only version, init, check, and rename. Public CLI use is reserved for supported commands without a logical operation. A missing, refused, or failed logical operation is reported as an integration or transport failure and is not retried through the direct CLI.

The CLI Skills use the public `tk` CLI for every Task operation and contain the complete current command reference they need. They do not compare entry routes or depend on integration discovery.

English and Chinese Skills in the same mode have equivalent semantic coverage. Each of the four directories can be installed and understood without another repository component.

## Lifecycle semantics

- `planning` preserves ideas, investigations, or plans that are still taking shape.
- `open` means active work is underway.
- `closed` means the effort has ended, whether completed, abandoned, infeasible, or superseded.

Status describes facts, not priority.

## Resolving a Task

Each new session starts with no Task bound by default.

1. When the user provides a full ID, exact name, path, directory name, or branch, first search or read.
2. If a full reference is unique, read its summary directly.
3. For a name, UUID prefix, text, or material path, first search, then use the full reference returned.
4. If the user's information cannot uniquely identify one of several candidates, show the candidates and ask.
5. An ongoing conversation may retain the resolved Task for the current session, but must not write that binding into the Task.

A normal catchup is read-only: read the summary, the `TASK.md` entry point, and any necessary materials; report the current goal, status, dependencies, established conclusions, blockers, and next steps; then stop. Continue working only if the user also asks to proceed.

## Creating Tasks

### strict

Create a top-level Task in a strict project only when the user explicitly requests or confirms creation in the current conversation. An Agent must not treat "this issue may be important" as confirmation.

### permissive

A permissive project allows an Agent to create a Task proactively for work worth preserving, even without a commitment to execute it. The Agent selects the status based on context:

- Use planning when the content is still taking shape and the user explicitly wants to preserve early materials.
- Use open when active work has already begun.

After creation, report the Task name, status, and path in the same response.

### Child Tasks

A genuine work unit under an open Task may be created as a child Task without obtaining top-level creation authorization again. Do not create a child Task under a closed parent Task or implicitly reopen the parent Task.

Use batch creation only for independent, genuine work units under the same parent Task, not to import an entire backlog.

## `TASK.md`

`TASK.md` stores concise current facts and important entry points:

- Goals.
- Scope and constraints.
- Stable adopted decisions.
- Links to important materials.
- Blockers that remain active.

It does not store step-by-step chat transcripts, command logs, long-form research, or superseded plans. Write detailed materials as ordinary files in the Task directory and link to them from `TASK.md`.

An Agent may edit the `TASK.md` body and ordinary materials. Managed metadata must be changed through tk operations.

## Logging

As soon as a fact becomes a persistent decision, correction, recoverable milestone, validation result, collaboration result, or blocker, write it to WAL before starting the next branch of work.

Each log entry must use a non-empty, single-line summary, with details in the Markdown body. For actor, use the most specific model or Harness information currently available. actor indicates attribution only, not identity or authorization.

Do not log routine reads, temporary plans, tool execution traces, or speculation that is still taking shape.

## Updating, closing, and reopening

Read the current Task before updating it. Change relationships, extra, and lifecycle through tk update.

Before closing, confirm that:

- The work has actually ended.
- Descendants and dependencies satisfy the normal closing rules.
- `TASK.md` retains only current results and entry points.
- Any validation results or decisions that must be preserved have been recorded.

Both close and reopen require a non-empty reason and explicit confirmation from the current user. A closed Task is read-only by default except for rename and repair. New work should normally use a related Task. Reopen the original Task only when the user explicitly confirms that the new work still belongs to it.

## Manually repairing `tk.toml`

Always use public tk operations for routine changes.

When `tk.toml` is damaged and tk cannot express the repair:

1. State exactly which fields will change and their final contents.
2. Obtain explicit authorization in the current conversation.
3. Make only the minimal edits described.
4. Run `tk check`.
5. After the Task is usable again, record the manual repair event in WAL.

Do not manually edit metadata, cleanup manifests, or Harness configuration to bypass a runtime rejection.

## Error handling

First read the stable error code, category, details, and the completed and incomplete items. If necessary, read or check the current state again before deciding whether to retry.

After a multi-target operation fails, do not assume that the runtime will roll back or resume. Issue a new, complete command based on the current canonical state and the user's goal.

When user input is genuinely required, explain the effect of each choice clearly. Do not ask the user for information that can be determined from tools, project files, or existing materials.

## Material patterns

The following patterns are non-exhaustive references. Project instructions may extend or override them:

| Pattern | Appropriate content |
| --- | --- |
| scratchpad | A short-term temporary note area that is not a final deliverable |
| research package | Research that must preserve sources, evidence, conclusion boundaries, and unresolved questions |
| design revisions | Multiple rounds of superseding designs and an entry point to the current version |
| review records | Multi-party reviews, disagreements, and resolution outcomes |
| validation evidence | Reproducible commands, environment details, results, and acceptance judgments |

Material patterns organize ordinary files only. They do not add runtime state.
