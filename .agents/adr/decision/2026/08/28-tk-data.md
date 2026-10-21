# tk Task data

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash
Reverses: [tk Task data](../../../archived/2026/08/28-r3-tk-data.md)

English | [中文](./28-tk-data.zh.md)

## Motivation

Define tk's file-backed Task data model and its rules for closed-Task name repair and file system reference reporting.

The [tk product architecture](./21-tk-architecture.md) makes project files the only authoritative Task state, requiring precise rules for carrier discovery, identity, paths, lifecycle, relationships, representations, writes, migration, cleanup, name repair for open and closed Tasks, and filesystem-based reference reporting.

## Analysis

Carrier discovery separates valid Tasks from ordinary materials and damaged managed data, and normal operations require that strict discovery result. rename is also responsible for repairing an existing string name and a recognizable generated directory suffix. Requiring the old name to pass complete validation would prevent the runtime from performing that repair even though UUID remains identity and the path remains a locator.

A closed Task needs the same name maintenance as any other Task. Reopening is a lifecycle change with its own reason and authorization requirements, and it cannot serve as a recovery path because strict loading rejects the damaged old name before the lifecycle branch is reached. A closed Task with a damaged name would otherwise have no public recovery path.

Reference reporting should describe the files a user actually keeps, not the staging state of the working tree. Enumerating candidates from the Git index misses present untracked Markdown, and an index entry whose file is missing from the working tree fails the whole scan before dry-run or execution can proceed.

## Decision

UUIDv7 is authoritative identity: paths locate Tasks and names describe them. Relationships remain within one Task root, a Task cannot relate to itself, and `depends_on` cannot form a cycle.

Ordinary writes do not use locks, leases, compare-and-swap, or automatic merge. A multi-target operation reports completed and uncompleted targets with the original error instead of rolling back.

Closing and reopening require a non-empty reason and current explicit authorization.

rename performs ordinary renaming and repairs a noncanonical, empty, or over-long string name and a recognizable generated directory whose nonempty suffix disagrees with metadata. It tolerates only those old-state defects, while other commands retain strict discovery.

The complete format and operation details live in the [data model](../../../../../projects/tk/docs/design/data-model.md) and [tool API](../../../../../projects/tk/docs/design/tool-api.md).

## Alternatives considered

**Support only split or only embed.** split is convenient for direct metadata inspection, while embed keeps a Task in one file. Both preserve the same schema without making either representation secondary.

**Use locks, transactions, or persistent recovery plans.** These mechanisms would add coordination and a second operation state machine. Atomic replacement, complete preflight, explicit partial results, activity markers, and retry from current managed files cover the intended local workflow.

**Rewrite Markdown references during rename.** Automatic editing could change unrelated or intentionally historical text. Reporting references keeps the Task change precise and leaves content decisions to the caller.

**Keep child discovery under `subtasks_dir`.** This narrows scanning and guarantees generated paths, but changing a placement preference can hide valid carriers and make imported children unreachable.

## Consequences

Task state remains readable with ordinary file tools and portable across interfaces. Changing `subtasks_dir` no longer changes visibility, and imported or reorganized valid child carriers remain usable.

A fully valid carrier below a Task becomes a Task even when its author intended it as an example. Repositories must not copy complete managed carriers into ordinary materials. Moving a valid carrier below another valid Task also changes its derived parent, close blockers, and sibling numbering without changing metadata. `check` and rename expose the resolved parent and paths for diagnosis.

Recursive discovery reads more directories than configured-path discovery. The fixed depth and directory limits prevent unbounded work, but large or unreadable material trees can make project-wide operations fail explicitly. The absence of a permanent index means discovery, checks, relationship validation, migration, representation switching, and repair planning may use memory proportional to the number of candidates.

rename can recover eligible names without granting permissive loading to read, search, update, lifecycle, migration, or representation switching. Repair planning must maintain a second validation mode limited to old-name and recognizable-suffix defects. Invalid enclosing candidates can make a descendant ineligible because its parent cannot be established safely.

Closed Tasks keep their lifecycle state while rename repairs their names, so name maintenance no longer depends on reopening. References outside the scanned scope, such as other projects, exported documents, or non-Markdown files, are not reported, so a broken external link can stay unnoticed while the Task itself looks stable.

The file system walk sees generated or unrelated Markdown that index enumeration did not. A build artifact that contains the old path string can trigger `broken_reference_conflict` for a legitimate move, and a project whose Markdown tree exceeds the fixed resource limit cannot rename until the tree shrinks.

Ordinary concurrent writes have last-completing-writer behavior. Multi-target failures can leave valid partial results, and callers must inspect completed and uncompleted lists before retrying. A directory move followed by metadata failure is replanned from current managed files after activity-marker cleanup. No hidden continuation state or automatic rollback exists.

Every released schema transition becomes long-lived maintenance code. Supporting two representations also requires equivalent validation, migration, body preservation, and name repair in both paths.

## Changes

### 2026-09-05 Creation body input

`TASK.md` remains ordinary Agent-maintained content, so the create interface does not accept body text through `tk create task --body`, the top-level create request, or child Task items. When the runtime creates a Task, it automatically generates `# <normalized-name>` as the initial body: alone in split mode, after the managed frontmatter in embed mode. After creation the caller maintains the body, and rename and subtask retry matching use no body input or matching condition. Callers write `TASK.md` with ordinary file operations after creation. `tk log --body` is unchanged because WAL entries are not Task content. The persisted metadata schema and component format are unchanged.

### 2026-09-05 Rename guards against broken references

A rename that would move a Task path stops with a conflict error before the first persistent write when references to the old path exist. The error details carry the old path, the normalized new name, the absolute target path, and every reference path and line. `--ignore-brokenlinks` permits that move without rewriting references. Dry-run reports the plan and references without writing. The scan covers project Markdown, ordinary Markdown under the Task root, and split and embed bodies.

### 2026-09-05 WAL access

`tk read` returns recent WAL within caller-selectable limits of at most 50 entries and 16000 compact JSON UTF-8 bytes. The `summary` view defaults to 5 entries and 4000 bytes and omits WAL bodies. `detailed` defaults to 50 entries and 16000 bytes and includes WAL bodies. Both views return the complete current Task body. `minimal` reads neither body nor WAL. The runtime selects complete projected entries from newest to oldest, silently omits the rest without a truncation indicator, and returns the selected entries in chronological order. Complete history remains in ordinary `wal/YYYY-MM-DD.md` files.

`tk check` no longer validates WAL through the bounded read path. Its streaming inspector reads every regular daily WAL file and validates every entry in deterministic order without fixed total history limits. It retains no complete WAL history in memory. Required I/O failures and cancellation make the check incomplete, while valid WAL size alone does not.

### 2026-10-19 Task name formatting

Saved names and generated suffixes may differ only in the use or omission of ordinary spaces `U+0020`, hyphens, and underscores. After ignoring those characters, the remaining text must match exactly. NFKC, non-empty text, and the other character requirements remain mandatory, and generated suffixes contain no whitespace. This lets project formatters add readable spaces without requiring name repair or a directory move.

Each saved name and generated suffix independently obeys the 32-terminal-column limit on its actual string, including every separator. Formatting correspondence grants no width exemption and does not change identity, search matching, or Task merging.

Creation and explicit rename retain request normalization and space-free generated paths. Ordinary reads, checks, updates, and representation switching accept valid formatting without rewriting it. Child creation retries ignore newly added ordinary spaces before applying the existing creation-name comparison, while keeping originally distinct normalized requests distinct.

rename still targets a concrete normalized name and applicable path, and returns no change only when both match exactly. Formatting correspondence does not replace narrow damaged-name repair, closed-state preservation, target conflicts, reference protection, exact precommit rechecks, or partial-commit reporting. A directory move followed by a metadata failure may leave a valid readable Task, but retry must still complete the requested target. The [data model](../../../../../projects/tk/docs/design/data-model.md#task-names) owns the full rules.
