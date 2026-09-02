# Agent Note: Define the tk Task data model

Status: implemented
Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol

English | [中文](./2026-08-28-define-tk-task-data-model.zh.md)

## Motivation

The [tk product architecture](./2026-08-21-define-tk-product-architecture.md) makes project files the only authoritative Task state. That choice requires one exact model for identity, paths, lifecycle, relationships, representations, discovery, writes, migration, and cleanup. Loose recognition or hidden recovery state would make ordinary project files ambiguous and give different callers different views of the same Task.

The model must remain inspectable by people while surviving interrupted writes, schema changes, and project-wide operations without turning into a database or transaction engine.

## Decision

### Project and representation

A project uses sparse configuration at `.agents/tk_config.toml`. It selects one project-relative Task root, optional child directory, Git policy, creation policy, and metadata mode. The default Task root is `.tk`.

Top-level Tasks use `YYYY/MM/DD-NN--slug`. Child Tasks use a stable two-digit sequence and slug below their parent. Directory topology defines parenthood. Sequence `99` is the last available sibling number.

The project-wide metadata mode is either split or embed. split stores metadata in `tk.toml` and body text in `TASK.md`. embed stores the same metadata in restricted YAML frontmatter and preserves the body bytes below it. A project does not mix representations per Task.

Schema 1 contains the immutable UUIDv7 `id`, normalized `name`, `planning`, `open`, or `closed` status, immutable timezone-aware `created_at`, same-root `depends_on` and `related_to` relationships, and optional losslessly representable `extra`. The schema does not store parent, branch, priority, assignment, update time, close reason, or session identity.

Every formally released schema transition retains an adjacent forward migrator. Migration applies those migrators in order, supports split and embed, and preserves the Task body. There is no downgrade path, schema 0, or compatibility contract for unreleased development formats.

### Candidates, identity, and lifecycle

Only canonical topology and a strictly valid carrier in the configured metadata mode form a Task candidate. Similar Markdown, malformed frontmatter, incomplete carriers, symlinks, special files, temporary content, and out-of-bounds paths are ignored. `check` may diagnose invalid content in locations that the project identifies as managed, but discovery does not invent damaged Task candidates.

UUIDv7 is authoritative identity. Paths locate Tasks and names describe them. rename is the only operation that changes a Task name and canonical path.

Relationships remain within one Task root. A Task cannot relate to itself, and `depends_on` cannot form a cycle. Relationships are deduplicated and stored in stable UUID order.

`planning` preserves an early idea, investigation, or plan that the user wants saved. `open` means the Task is being handled. `closed` is readable but otherwise read-only. Closing and reopening require a non-empty reason and current explicit authorization. Normal close also requires closed descendants and dependencies. Force close bypasses only those two checks.

A strict project requires current explicit authorization to create a top-level Task. A permissive project may create work worth preserving without treating creation as an execution commitment. Creating a planning Task still requires an expressed intent to save the early work.

### Discovery, search, and Git policy

The Task root has no persistent index or cache. Discovery and project-wide checks traverse canonical files on demand. Git projects use their Git root. Non-Git discovery and exact absolute paths use bounded ancestor checks rather than walking to the file-system root.

Exact read and mutation accept a complete UUIDv7 or canonical Task path. Search classifies a query once as UUID or explicit Task path, existing material path, explicit regular expression, or string. It does not fall back after classification. Search includes all three statuses by default and orders `uuid`, `path`, `regex`, then `string` matches. Items within a class use `created_at` descending and ID ascending. The default limit is 20 and the maximum is 100.

Git policy runs only before persistent writes. `track` requires managed Task files not to be ignored, `ignore` requires the Task root to be ignored, and `none` does not invoke Git policy commands. tk does not modify Git configuration, ignore rules, the index, commits, or history.

### Persistence and maintenance

A managed single-file change writes a complete same-directory temporary file and atomically replaces the target. Ordinary writes do not use locks, leases, compare-and-swap, or automatic merge. Concurrent replacements resolve to the operation that finishes last.

WAL is an ordinary daily Markdown activity record. Metadata commits before an automatic WAL append. WAL failure returns a warning and does not roll back committed metadata. actor is attribution text, not identity or authorization.

Multi-target operations complete all domain prechecks, commit in deterministic order, stop at the first error or cancellation point, and report completed and uncompleted targets with the original error. They do not roll back automatically or write a continuation state. A later invocation rereads canonical state and replans.

A multi-target project write creates an activity marker before the first persistent write. The marker identifies the operation, project scope, Linux boot ID, PID, and process start time. Other writes remain blocked while the producer is active and after it exits, until GC removes the marker. Reads, searches, and pure diagnostics remain available. The marker is not a general lock.

Cleanup manifests contain only their format version, producer identity, creation time, and tk temporary paths. GC removes provably tk-owned temporary content and ended activity markers. It never completes, rolls back, or repairs a Task, migration, rename, or component operation.

rename updates only the Task itself and reports Markdown references. It does not rewrite them. `git_policy=track` scans Git-tracked project Markdown. `ignore` and `none` scan ordinary Markdown under the Task root.

`check` validates managed project state without modifying it. A required I/O failure stops the scan and reports it as incomplete. A damaged `tk.toml` may be repaired manually only when tk cannot express the repair, the Agent describes the exact edit, and the user explicitly authorizes it in the current conversation. The Agent then reruns `check` and records the repair in WAL when the Task is usable.

The complete format and operation details live in the [data model](../../../projects/tk/docs/design/data-model.md) and [tool API](../../../projects/tk/docs/design/tool-api.md).

## Alternatives considered

**Use a database or permanent index.** This would add another authoritative state store, migration path, and synchronization boundary. Canonical files and bounded scans are sufficient for local Task projects.

**Support only split or only embed.** split is convenient for direct metadata inspection, while embed keeps a Task in one file. Both can preserve the same schema without making either representation secondary.

**Treat similar or malformed files as damaged Tasks.** Heuristic recovery would make discovery depend on guesses and could claim ordinary project content. Strict candidates keep the boundary deterministic.

**Use locks, transactions, or persistent recovery plans.** These mechanisms would add coordination and a second operation state machine. Atomic replacement, complete preflight, explicit partial results, activity markers, and retry from canonical state cover the intended local workflow.

**Rewrite Markdown references during rename.** Automatic editing could change unrelated or intentionally historical text. Reporting references keeps the Task change precise and leaves content decisions to the caller.

## Consequences

Task state remains readable with ordinary file tools and portable across interfaces. The absence of a permanent index means discovery and some maintenance operations scan the project. Search keeps a bounded candidate set, while checks, relationship validation, migration, and representation switching may use memory proportional to the number of Tasks.

Ordinary concurrent writes have last-completing-writer behavior. Multi-target failures can leave valid partial results, and callers must inspect the completed and uncompleted lists before retrying. No hidden continuation state exists after the process exits.

Every released schema transition becomes long-lived maintenance code. Supporting two representations also requires equivalent validation, migration, and body preservation in both paths.
