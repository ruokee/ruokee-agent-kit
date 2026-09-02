# Data model and persistence

[简体中文](./data-model.zh.md)

## Project and Task root directories

Project configuration is stored in `.agents/tk_config.toml`. The configuration is sparse TOML relative to the defaults:

```toml
task_root = ".tk"
subtasks_dir = ""
git_policy = "none"
creation_policy = "strict"
metadata_mode = "split"
```

Default values are not written to the configuration file. The file may be absent when all defaults apply.

- `task_root` is a project-relative path and defaults to `.tk`.
- `subtasks_dir` is an optional relative directory under each parent Task.
- `git_policy` is `track`, `ignore`, or `none`.
- `creation_policy` is `strict` or `permissive`.
- `metadata_mode` is `split` or `embed` and applies to the entire project.

`init --force` may ignore an unparseable existing project configuration and write a new sparse configuration using the explicit arguments from the current invocation plus defaults. It does not read, migrate, move, delete, or rewrite Task data, and it does not process an individual Task's `tk.toml`.

## Task directories

Top-level Tasks use this layout:

```text
<task-root>/YYYY/MM/DD-NN--slug/
```

A child Task is stored directly under its parent Task directory or under the parent's `subtasks_dir`, using a stable sequence number and slug. Directory topology represents parent-child relationships. Metadata does not store `parent`.

The Task root has no persistent index or cache. Discovery, search, and project-wide checks traverse the file system on demand.

## Metadata schema

The current initial schema version is 1. Metadata contains only:

| Field | Contract |
| --- | --- |
| `schema_version` | Required positive integer |
| `id` | Required UUIDv7, immutable after creation |
| `name` | Required normalized name, modifiable only by rename |
| `status` | `planning`, `open`, or `closed` |
| `created_at` | Required RFC 3339 timestamp with a time zone, immutable after creation |
| `depends_on` | Set of UUIDs within the same Task root |
| `related_to` | Set of UUIDs within the same Task root |
| `extra` | Optional structured value that can be represented losslessly in both JSON and TOML |

The schema does not include `parent`, `branch`, `updated_at`, the most recent close reason, `paused`, `archived`, installation time, or session state.

Unknown fields, incorrect types, missing versions, and unsupported versions are invalid. Ordinary content does not become a candidate even if it resembles Task metadata.

## split and embed

split uses this layout:

```text
Task/
├── tk.toml
└── TASK.md
```

`tk.toml` stores all metadata, and `TASK.md` stores the body.

embed uses this layout:

```text
Task/
└── TASK.md
```

`TASK.md` stores all metadata in restricted YAML frontmatter, followed by the body after the closing delimiter. At runtime, YAML tags, duplicate keys, unknown fields, unclosed frontmatter, and frontmatter exceeding the size limit are rejected.

When modifying embed metadata, the runtime preserves the body byte for byte. Representation switching applies to the entire project. Mixing representations per Task is not allowed.

## Candidate identification

Candidate scanning takes the project's `metadata_mode` and first requires canonical topology. A top-level Task is stored at `YYYY/MM/DD-NN--slug`. Each descendant is stored under the configured `subtasks_dir` with an exact `NN--slug` directory. The sequence widths, `--` separator, calendar date, and non-empty slug are mandatory.

Sequence allocation considers only existing canonical Task siblings. It never widens the sequence field beyond two digits. When sequence `99` is already in use, creation fails with a conflict before writing.

- In split mode, only canonical directories containing both regular `tk.toml` and `TASK.md` files are candidates.
- In embed mode, only canonical `TASK.md` files with strictly valid tk frontmatter are candidates.
- Ordinary `TASK.md` files, ordinary YAML frontmatter, malformed frontmatter, content with incomplete fields, noncanonical placements, and directories containing only similarly named files are ignored.
- symlink, devices, directories masquerading as files, and out-of-bounds paths cannot become candidates.
- `.tk-tmp`, WAL, and reserved temporary directories do not participate in Task discovery.

`check` may report managed carriers that are explicitly referenced by project configuration but have invalid types or content. It does not promote arbitrary similar files to "damaged Task candidates."

## Identity, names, and relationships

UUIDv7 is the authoritative identity. Paths are locators and may change through rename. Names are normalized using NFKC, restricted characters, and a limit of 32 terminal display columns.

`depends_on` and `related_to` may reference only Tasks within the same Task root. A Task cannot reference itself, and `depends_on` cannot form a cycle. Relationships are sorted by UUID and deduplicated.

## Lifecycle

| Current status | Target status | Requirements |
| --- | --- | --- |
| `planning` | `open` | Allowed, with an automatic WAL append |
| `planning` | `closed` | Non-empty reason, current authorization, and close checks |
| `open` | `closed` | Non-empty reason, current authorization, and close checks |
| `closed` | `open` | Non-empty reason, current authorization, and no closed ancestor |

A normal close requires all descendants and dependency targets to be closed. A forced close bypasses only descendant and dependency checks. It does not bypass authorization, reason, schema, path, Git, or relationship validation.

A closed Task is read-only by default. read, search, and check may still read it.

## Creation authorization

- In a `strict` project, a top-level Task may be created only when the user explicitly requests or confirms it in the current context.
- A `permissive` project allows an Agent to create a Task for work worth preserving, without requiring a prior commitment to perform the work.
- Creating a `planning` Task requires the user to explicitly express an intent to save an early idea, investigation, or plan.
- The default creation status is `open`. Pass `planning` explicitly when needed.
- Ordinary child Tasks within an open Task tree do not require new top-level authorization.

## Project discovery

Git projects are located using the Git root and project configuration.

For an exact path outside Git, use the Task directory structure:

1. Starting from a Task, managed file, or material path, search upward for the first directory matching `DD-NN--slug`.
2. Its parent must match `MM`, and the next parent must match `YYYY`.
3. The parent of `YYYY` is the candidate Task root.
4. Inspect at most two additional ancestor directories to match project configuration against the Task root.
5. If the project cannot be confirmed within two levels, fail without continuing to the file-system root.

For an ordinary context directory, use bounded nearest-project discovery. An exact absolute Task path or material path first locates its owning project, allowing a caller in project A's cwd to read an absolute reference in project B.

## Git policy

Git policy is checked only before persistent writes:

- `track` requires managed Task files not to be ignored.
- `ignore` requires the Task root to be ignored.
- `none` does not invoke Git policy commands.

read, search, and purely diagnostic operations are not rejected because of Git policy. tk never modifies `.gitignore`, the index, Git configuration, commits, or history.

## Search visibility

When the status filter is omitted or an empty array is passed, search includes `planning`, `open`, and `closed`. Only a non-empty status array narrows the result set. File-system traversal does not stop at a closed parent Task, and results report closed ancestors.

Search ordering and matching are defined by the [tool API](./tool-api.md#search).

## WAL

Each Task's WAL is stored at `wal/YYYY-MM-DD.md` and uses this entry format:

```markdown
## 2026-08-31T12:34:56+08:00 · actor

Message

Optional body
```

Only a `## ` line that fully matches the RFC 3339 timestamp, separator, and actor starts a new entry. An ordinary Markdown H2 belongs to the body.

WAL is an ordinary auxiliary Markdown record and does not participate in the correctness of domain operations. It provides no duplicate detection, transactional guarantees, or special line escaping. Body text that exactly resembles a complete entry header is treated as an extremely unlikely event, so tk does not add a length prefix or a new format for it.

actor is single-line attribution information, not identity authentication or authorization. Only update, log, and rename requests that actually append WAL accept actor.

Metadata is committed first, then the automatic WAL entry is appended. If the WAL append fails, the operation returns a warning and does not roll back the committed metadata.

## Single-file writes

A managed single-file update uses a temporary file in the same directory followed by atomic replacement:

1. Strictly read the current state.
2. Complete domain validation.
3. Run the pre-write Git policy check.
4. Write and close the complete temporary file.
5. Atomically replace the target.
6. Remove temporary content.

Normal writes do not use locks, leases, compare-and-swap, or automatic merging. Concurrent complete replacements of the same file are resolved by whichever operation finishes last.

## Multi-target operations

Batch creation, schema migration, representation switching, rename, and Harness component operations follow the same failure boundary:

1. Complete all domain validation before the first write.
2. Commit each item in deterministic order.
3. Stop immediately on an ordinary I/O error.
4. Return completed items, incomplete items, and the original error.
5. Do not roll back automatically, create continuation state, or continue operating after the process exits.

The same request may be executed again after the caller confirms the current state. Each invocation replans from the current canonical state.

Batch creation may skip existing items that match the request. schema migration skips carriers already at the target version.

## schema migration

Released schema versions use stepwise migrators, such as 1→2 and 2→3. Migration always proceeds in order until it reaches the target version.

- Migrators for every released version are retained indefinitely.
- Both split and embed support stepwise migration while preserving the body.
- Reading, validation, and conversion planning for all selected carriers must complete before the first write.
- Downgrades are not supported.
- Unreleased development formats do not constitute an earlier schema.
- The initial schema is 1.

Migrators may be implemented as Rust modules or as resource files embedded at build time. Code organization does not change the stepwise migration contract.

## Representation switching

Representation switching converts the entire project between split and embed:

1. Read and validate all candidate Tasks.
2. Generate the target carrier for each Task.
3. Commit Tasks in deterministic order.
4. Update project configuration last.
5. If the operation fails partway through, report completed and incomplete Tasks without automatic rollback.

Switching does not append Task WAL entries.

## rename

rename modifies only the Task's own name, directory, and metadata:

1. Resolve a unique Task.
2. Normalize the new name and compute the target path.
3. Verify that the target does not exist, relationships are valid, and Git policy allows the write.
4. Scan Markdown references and return the list.
5. Move the directory without overwriting.
6. Update metadata.
7. Append WAL.

The runtime does not automatically rewrite references. With `git_policy=track`, it scans all Git-tracked Markdown in the project. With `ignore` or `none`, it scans regular Markdown under `task_root`. Task bodies in both split and embed are included. Managed frontmatter, WAL, and temporary content are excluded.

## Minimal cleanup manifest

Each operation that must register temporary content uses a minimal cleanup manifest containing only:

- The manifest format version.
- The producer process identity.
- The creation time.
- Paths to temporary files and directories created by tk.

The manifest is responsible only for cleaning up temporary content. It does not record domain state, content digests, or commit stages.

A command that modifies multiple project targets creates an activity marker before the first write. The marker records the operation ID, project scope, Linux boot ID, PID, and process start time.

- While the producer process is active, other project write operations return `operation_in_progress`.
- After the producer process exits, write operations remain rejected and instruct the caller to run GC first.
- read, search, and purely diagnostic operations are not blocked.
- Single-file atomic replacement does not create a project-level activity marker.
- A race in which two processes create markers at exactly the same time is treated as an extremely unlikely event and does not add locking.

## GC

GC processes only tk temporary content:

- Manifests and paths belonging to active producer processes are preserved.
- Manifests belonging to exited producer processes are cleaned up using their recorded paths.
- Path escapes, symlink, unparseable manifests, and content that cannot be proven to belong to tk are preserved and reported.
- Earlier cleanup formats from development are treated as unknown content and are not parsed or migrated.
- GC does not continue, complete, or roll back domain operations.
- GC does not modify Task metadata, bodies, WAL, project configuration, or Harness configuration.

If an I/O error occurs during deletion, GC stops and reports deleted and undeleted paths.

## check

check strictly validates project configuration, Task carriers, schema, representation consistency, paths, UUIDs, relationships, WAL, activity markers, and temporary manifests.

If a required directory or file cannot be read, check immediately returns an incomplete check and does not continue collecting diagnostics. If format or domain errors are found after a complete read, the check is complete but failed. check does not modify any content.
