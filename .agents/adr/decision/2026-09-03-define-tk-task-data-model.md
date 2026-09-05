# ADR decision: Define the tk Task data model with carrier discovery

Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol
Reverses: [Define the tk Task data model](../archived/2026-08-28-define-tk-task-data-model.md)

English | [中文](./2026-09-03-define-tk-task-data-model.zh.md)

## Motivation

The [tk product architecture](./2026-08-21-define-tk-product-architecture.md) makes project files the only authoritative Task state. The runtime therefore needs one exact model for identity, paths, lifecycle, relationships, representations, discovery, writes, migration, and cleanup.

The earlier model used `subtasks_dir` for both child creation and discovery. That made a placement preference part of Task visibility. Changing the setting, importing a valid child, or placing a child below ordinary materials could hide valid managed data. Creation still needs one predictable destination and numbering rule, while discovery must recognize existing valid carriers without treating ordinary Markdown as Tasks.

## Decision

### Project, paths, and representation

A project uses sparse configuration at `.agents/tk_config.toml`. It selects one project-relative Task root, default child creation directory, Git policy, creation policy, and metadata mode. The default Task root is `.tk`. `subtasks_dir` controls only where later child Tasks are created and never limits discovery or moves existing data.

Top-level Tasks use the canonical `YYYY/MM/DD-NN--slug` topology. New child Tasks use a stable two-digit `NN--slug` directory below the parent or its configured `subtasks_dir`. Existing child Tasks may be stored in any real descendant directory below a valid top-level Task. The nearest enclosing valid Task defines parenthood. Metadata does not store `parent`.

Generated direct-child sequence allocation examines all discovered direct children with a valid `NN--slug` leaf, takes the largest sequence, and does not fill gaps. The configured creation directory selects the destination only. Sequence `99` is the final generated sibling number, and exhaustion fails before writing.

The project-wide metadata mode is split or embed. split stores metadata in `tk.toml` and body text in `TASK.md`. embed stores the same metadata in restricted YAML frontmatter and preserves the body bytes below it. A project does not mix representations per Task.

Schema 1 contains the immutable UUIDv7 `id`, normalized `name`, `planning`, `open`, or `closed` status, immutable timezone-aware `created_at`, same-root `depends_on` and `related_to` relationships, and optional losslessly representable `extra`. The schema does not store parent, branch, priority, assignment, update time, close reason, or session identity.

Every formally released schema transition retains an adjacent forward migrator. Migration applies those migrators in order, supports split and embed, and preserves the Task body. There is no downgrade path, schema 0, or compatibility contract for unreleased development formats.

### Carrier discovery, identity, and lifecycle

Top-level discovery first requires canonical topology, a valid calendar date, a non-empty slug, and a metadata name matching that slug. Descendant discovery then traverses real ordinary directories below each valid top-level Task.

A descendant directory becomes a structural candidate only through the marker for the project's metadata mode. In split mode, a regular `tk.toml` is the marker and a valid Task also requires a regular paired `TASK.md`. In embed mode, a regular `TASK.md` must begin with recognizable tk frontmatter whose opening metadata key is `schema_version`. The complete carrier must pass strict schema, identity, representation, and safe-path validation.

A generated `NN--slug` child must match its metadata name. A non-generated child has no path-to-name requirement. Marked but invalid directories remain managed errors for `check` and are omitted from normal discovery. Unrelated `TASK.md`, ordinary YAML frontmatter, symlinks, special files, WAL, `.tk-tmp`, cleanup data, and paths outside the Task root do not become Tasks. Ordinary and invalid directories remain traversable under the nearest valid ancestor, except runtime-owned paths.

Discovery order is deterministic. A scan accepts at most 100,000 real directories and 256 descendant levels. Crossing either limit or encountering a required I/O error fails the scan without returning a partial graph.

UUIDv7 is authoritative identity. Paths locate Tasks and names describe them. Duplicate IDs remain graph diagnostics and make UUID resolution ambiguous. Relationships remain within one Task root. A Task cannot relate to itself, and `depends_on` cannot form a cycle. Relationships are deduplicated and stored in stable UUID order.

`planning` preserves an early idea, investigation, or plan that the user wants saved. `open` means the Task is being handled. `closed` is readable but otherwise read-only. Closing and reopening require a non-empty reason and current explicit authorization. Normal close also requires closed descendants and dependencies. Force close bypasses only those two checks.

A strict project requires current explicit authorization to create a top-level Task. A permissive project may create work worth preserving without treating creation as an execution commitment. Creating a planning Task still requires an expressed intent to save the early work.

### Discovery graph, search, and Git policy

The Task root has no persistent index or cache. Each operation builds one carrier-based Task graph on demand. Search, exact path resolution, parent and descendant checks, relationship validation, `check`, schema migration, metadata mode switching, and sequence allocation use this graph.

Exact read and mutation accept a complete UUIDv7, an absolute discovered Task directory, an absolute managed carrier, or a relative discovered Task path in the current project. An absolute material path may locate its owning project but is not an exact Task reference. Git projects use their Git root. Non-Git project discovery uses the canonical top-level ancestor and bounded project checks rather than walking to the file-system root.

Search classifies a query once as UUID or explicit Task path, existing material path, explicit regular expression, or string. It does not fall back after classification. Search includes all three statuses by default and orders `uuid`, `path`, `regex`, then `string` matches. Items within a class use `created_at` descending and ID ascending. The default limit is 20 and the maximum is 100. Results include closed ancestors derived from the discovery graph.

Git policy runs only before persistent writes. `track` requires managed Task files not to be ignored, `ignore` requires the Task root to be ignored, and `none` does not invoke Git policy commands. tk does not modify Git configuration, ignore rules, the index, commits, or history.

### Persistence and maintenance

A managed single-file change writes a complete same-directory temporary file and atomically replaces the target. Ordinary writes do not use locks, leases, compare-and-swap, or automatic merge. Concurrent replacements resolve to the operation that finishes last.

WAL is an ordinary daily Markdown activity record. Metadata commits before an automatic WAL append. WAL failure returns a warning and does not roll back committed metadata. actor is attribution text, not identity or authorization.

Multi-target operations complete all domain prechecks, commit in deterministic order, stop at the first error or cancellation point, and report completed and uncompleted targets with the original error. They do not roll back automatically or write a continuation state. A later invocation rebuilds the discovery graph and replans from current managed files.

A multi-target project write creates an activity marker before the first persistent write. The marker identifies the operation, project scope, Linux boot ID, PID, and process start time. Other writes remain blocked while the producer is active and after it exits, until GC removes the marker. Reads, searches, and pure diagnostics remain available. The marker is not a general lock.

Cleanup manifests contain only their format version, producer identity, creation time, and tk temporary paths. GC removes provably tk-owned temporary content and ended activity markers. It never completes, rolls back, or repairs a Task, migration, rename, or component operation.

rename updates only the Task itself and reports the resolved parent, old path, target path, and Markdown references. A non-generated child keeps its directory and changes metadata only. A generated child or top-level Task preserves its sequence and updates the slug path. rename does not rewrite references. `git_policy=track` scans Git-tracked project Markdown. `ignore` and `none` scan ordinary Markdown under the Task root.

`check` validates marked carriers, generated name-path agreement, UUID and direct-child sequence uniqueness, relationships, WAL, activity markers, and cleanup data without modifying content. It reports marked invalid carriers and resolved logical parents. A required I/O failure or discovery limit stops the scan and reports it as incomplete. A damaged split carrier may be repaired manually only when tk cannot express the repair, the Agent describes the exact edit, and the user explicitly authorizes it in the current conversation. The Agent then reruns `check` and records the repair in WAL when the Task is usable.

The complete format and operation details live in the [data model](../../../projects/tk/docs/design/data-model.md) and [tool API](../../../projects/tk/docs/design/tool-api.md).

## Alternatives considered

**Support only split or only embed.** split is convenient for direct metadata inspection, while embed keeps a Task in one file. Both preserve the same schema without making either representation secondary.

**Use locks, transactions, or persistent recovery plans.** These mechanisms would add coordination and a second operation state machine. Atomic replacement, complete preflight, explicit partial results, activity markers, and retry from current managed files cover the intended local workflow.

**Rewrite Markdown references during rename.** Automatic editing could change unrelated or intentionally historical text. Reporting references keeps the Task change precise and leaves content decisions to the caller.

**Keep child discovery under `subtasks_dir`.** This narrows scanning and guarantees generated paths, but changing a placement preference can hide valid carriers and make imported children unreachable.

## Consequences

Task state remains readable with ordinary file tools and portable across interfaces. Changing `subtasks_dir` no longer changes visibility, and imported or reorganized valid child carriers remain usable.

A fully valid carrier below a Task becomes a Task even when its author intended it as an example. Repositories must not copy complete managed carriers into ordinary materials. Moving a valid carrier below another valid Task also changes its derived parent, close blockers, and sibling numbering without changing metadata. `check` and rename expose the resolved parent and paths for diagnosis.

Recursive discovery reads more directories than configured-path discovery. The fixed depth and directory limits prevent unbounded work, but large or unreadable material trees can make project-wide operations fail explicitly. The absence of a permanent index means discovery, checks, relationship validation, migration, and representation switching may use memory proportional to the number of Tasks.

Ordinary concurrent writes have last-completing-writer behavior. Multi-target failures can leave valid partial results, and callers must inspect completed and uncompleted lists before retrying. No hidden continuation state exists after the process exits.

Every released schema transition becomes long-lived maintenance code. Supporting two representations also requires equivalent validation, migration, and body preservation in both paths.

## Changes

### 2026-09-05: Creation no longer accepts body input

`TASK.md` remains ordinary Agent-maintained content, so the create interface does not accept body text through `tk create task --body`, the top-level create request, or child Task items. When the runtime creates a Task, it automatically generates `# <normalized-name>` as the initial body: alone in split mode, after the managed frontmatter in embed mode. After creation the caller maintains the body, and rename and subtask retry matching use no body input or matching condition. Callers write `TASK.md` with ordinary file operations after creation. `tk log --body` is unchanged because WAL entries are not Task content. The persisted metadata schema and component format are unchanged.

### 2026-09-05: Rename guards against broken references

A rename that would move a Task path stops with a conflict error before the first persistent write when references to the old path exist. The error details carry the old path, the normalized new name, the absolute target path, and every reference path and line. `--ignore-brokenlinks` permits that move without rewriting references. Dry-run reports the plan and references without writing. The scan boundaries, including tracked project Markdown, ordinary Markdown under the Task root, and split and embed bodies, are unchanged.
