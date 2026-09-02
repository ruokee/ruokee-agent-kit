# Task concepts

## Task boundary

A Task is a temporary project effort worth preserving. Creation does not imply a commitment to execute or complete it.

Use a Task when durable state will help work survive several steps, sessions, Agents, or context compaction. Do not use tk for quick answers, temporary checklists, priorities, schedules, boards, external Issues, Agent orchestration, or session binding.

## Identity and location

UUIDv7 is the authoritative identity. A name describes the Task. A path locates it and may change during rename.

Top-level Tasks live under the configured Task root. Child directory topology represents parenthood. Metadata does not store a `parent` field.

Exact references are full UUIDv7 values, absolute Task directories, absolute canonical carrier paths, or project-relative Task paths. Names, prefixes, text, branches, and material paths require search.

## Metadata

Current schema 1 contains only:

- `schema_version`;
- immutable `id` and `created_at`;
- normalized `name`;
- `status` as `planning`, `open`, or `closed`;
- `depends_on` and `related_to` UUID sets within one Task root;
- optional losslessly representable `extra`.

It does not store branch, parent, update time, close reason, session, priority, assignment, or installation state.

A split project stores metadata in `tk.toml` and body text in `TASK.md`. An embed project stores metadata in restricted YAML frontmatter and preserves the body bytes below it.

## `TASK.md`

Keep current facts and important entry points in `TASK.md`:

- objective;
- scope and constraints;
- stable decisions;
- important material links;
- blockers that still apply.

Put detailed research, designs, review records, validation evidence, and temporary notes in ordinary files. The runtime does not index those materials.

You may edit the body and ordinary material. Change managed metadata through tk operations. An exception for a damaged `tk.toml` requires an exact proposed edit, current user authorization, `tk check`, and a later WAL record.
