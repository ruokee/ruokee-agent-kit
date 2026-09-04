# Task concepts

Read this file when Task identity, paths, content, relationships, or lifecycle are unclear. The main Skill defines routine creation, update, and file-maintenance rules.

## Task model

### Identity and paths

A UUIDv7 is the stable Task identity. Names and directories aid recognition and may change through `rename`; they are not identity.

Top-level Tasks normally live at:

```text
<task_root>/YYYY/MM/DD-NN--slug/
```

New subtasks normally live below the parent's configured `subtasks_dir` and use an `NN--slug` directory name. `subtasks_dir` controls creation placement only. Discovery can recognize Tasks elsewhere below the parent from valid carriers. See [Subtasks](./subtask.md).

Names use NFKC normalization, allow a restricted character set, and occupy at most 32 terminal display columns. Display columns are not Unicode character count. Let the runtime validate names and compute slugs during creation or rename.

### Content

A Task directory contains four kinds of content:

- managed metadata: identity, name, status, timestamps, relationships, schema version, and `extra`;
- the `TASK.md` body: current objective, scope, constraints, stable decisions, important material links, and active blockers;
- WAL: runtime-appended activity records in `wal/YYYY-MM-DD.md`;
- ordinary materials: any content outside managed carriers and WAL, using whatever file formats and directory structure suit the work.

The runtime owns managed metadata and WAL. An Agent may maintain the `TASK.md` body and ordinary materials, but must not rewrite managed fields outside the runtime or edit, delete, or reorder existing WAL entries.

WAL records durable events that happened, such as decisions, corrections, recoverable milestones, verification results, collaboration results, and blockers. It is append-only history, not a current-state summary. Keep only current facts in the body. Put longer reusable content in ordinary materials and link it from the body.

Ordinary materials are not governed by the tk schema and are not added to the Task index. They may be documents, code, data, images, command output, or other files. Do not use the managed names `tk.toml`, `TASK.md`, or `wal/` for ordinary materials.

### Managed fields

|Field|Rule|
|-|-|
|`id`|Required UUIDv7; immutable after creation|
|`name`|Required; changed only through `rename`|
|`status`|`planning`, `open`, or `closed`|
|`created_at`|Timezone-aware RFC 3339; immutable after creation|
|`depends_on`|UUID set within the same Task root|
|`related_to`|UUID set within the same Task root|
|`extra`|Structured extension values changed by top-level key|
|`schema_version`|Current supported schema version|

`parent`, close reasons, historical names, `actor`, and session bindings are not managed fields. Directory containment determines parentage. Lifecycle reasons go to WAL.

### Metadata carriers

`split` mode uses two files:

```text
<Task directory>/tk.toml
<Task directory>/TASK.md
```

`tk.toml` contains only managed metadata. `TASK.md` contains only the body.

`embed` mode stores managed metadata in strict tk YAML frontmatter at the top of `TASK.md`, followed by the body. Missing, duplicate, or unknown fields, incorrect types, or non-canonical ordering may invalidate the carrier.

The project's `metadata_mode` must match the carriers on disk. Do not convert carriers manually. See [Project storage](./project-storage.md) for project-wide conversion.

### Creation input

A top-level creation requires at least a name. The body defaults to a generated heading, status defaults to `open`, time defaults to now, and relationships and `extra` default to empty.

Pass `created_at` only when importing a historical Task whose original timezone-aware timestamp is reliable. Relationship targets must already exist in the same Task root. A Task cannot reference itself, and dependencies cannot form a cycle.

## Resolution

### Exact references

Exact references accept only a complete UUIDv7, an absolute Task directory, an absolute managed carrier path, or a project-relative Task path. Exact operations do not guess from a fuzzy name.

A complete absolute Task or material path can locate its owning project even when it is outside the project discovered from the current working directory.

### Search input

Names, directory basenames, UUID prefixes, text, regular expressions, and material paths are search input. Search chooses the query type first and does not fall back to another interpretation after one fails. Results have stable ordering by match kind, creation time, and ID.

Search may return zero, one, or several candidates. Choose one Task before updating, closing, renaming, or appending WAL.

## Lifecycle

### Status

|Status|Meaning|
|-|-|
|`planning`|An idea, investigation, or plan the user explicitly wants preserved while it is still forming|
|`open`|Work that is being carried out|
|`closed`|Work that ended, including completion, abandonment, infeasibility, or replacement|

Status states a fact, not priority.

### Transitions

Allowed transitions are:

- `planning` to `open`;
- `planning` to `closed`;
- `open` to `closed`;
- `closed` to `open`.

`start` changes `planning` to `open`. Repeating `start` on an `open` Task returns no change. A `closed` Task can open only through `reopen`.

### Closing

A normal close requires:

- the target is not already `closed`;
- every descendant is `closed`;
- every `depends_on` target is `closed`;
- a non-empty reason;
- truthful confirmation for this close.

When blockers exist, the runtime returns the specific descendants or dependencies and does not close them automatically.

`force` skips only the descendant and dependency checks. It does not close those Tasks or bypass authorization, reason, schema, path, Git, relationship, or `closed` ancestor rules.

### Reopening

`reopen` requires a non-empty reason and truthful confirmation for the current operation. It is rejected below a `closed` ancestor because reopening would hide active work inside a closed tree.

New work usually belongs in an open Task with `related_to` pointing to the original. Reopen only when the user confirms the work still belongs to the original Task.

### Restrictions while `closed`

A `closed` Task permits `read`, `search`, and `check`. Ordinary metadata changes, WAL append, `rename`, and subtask creation are rejected.

The runtime writes close and reopen events to WAL. Do not append a duplicate manual entry.

## Relationships

### Dependencies

`depends_on` means the target Task must end first. It is directed and cannot form a cycle. All dependency targets must be `closed` before the Task can close.

### Related Tasks

`related_to` records an association only. It is not automatically symmetric. Adding A to B does not modify B.

### Relationship constraints

Both relationship sets contain UUIDs from the same Task root, exclude the Task itself, and are deduplicated and sorted by UUID.

Change relationships incrementally instead of rewriting a whole set from an assumed concurrent state. The runtime rejects the entire request when a target is missing, belongs to another Task root, is the Task itself, or would create a dependency cycle.
