# tk Task data

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash
Reverses: [tk Task data](../../../archived/2026/08/28-r4-tk-data.md)

English | [中文](./28-tk-data.zh.md)

## Motivation

Keep file-backed Task identity with configurable date layouts, explicit reference updates, and persistent scan reports.

The [tk product architecture](./21-tk-architecture.md) makes project files the only authoritative Task state, requiring precise rules for carrier discovery, identity, paths, lifecycle, relationships, representations, writes, migration, cleanup, name repair for open and closed Tasks, and filesystem-based reference reporting.

## Analysis

Carrier discovery separates valid Tasks from ordinary materials and damaged managed data, and normal operations require that strict discovery result. rename is also responsible for repairing an existing string name and a recognizable generated directory suffix. Requiring the old name to pass complete validation would prevent the runtime from performing that repair even though UUID remains identity and the path remains a locator.

A closed Task needs the same name maintenance as any other Task. Reopening is a lifecycle change with its own reason and authorization requirements, and it cannot serve as a recovery path because strict loading rejects the damaged old name before the lifecycle branch is reached. A closed Task with a damaged name would otherwise have no public recovery path.

Reference reporting should describe the files a user actually keeps, not the staging state of the working tree. Enumerating candidates from the Git index misses present untracked Markdown, and an index entry whose file is missing from the working tree fails the whole scan before dry-run or execution can proceed.

Daily directories reduce the number of entries in a monthly directory when a workspace gathers many projects' Tasks. Keeping monthly as the default preserves existing roots. Ordinary discovery needs one configured layout so imported or partially moved directories do not silently become managed Tasks.

Path changes affect both incoming references and links inside moved files. A shared mapping and scan lets rename and layout operations report those effects consistently. Explicit updates leave historical text under caller control, while a persistent report remains available after a preview or failed operation.

## Decision

UUIDv7 is authoritative identity: paths locate Tasks and names describe them. Relationships remain within one Task root, a Task cannot relate to itself, and `depends_on` cannot form a cycle.

Ordinary writes do not use locks, leases, compare-and-swap, or automatic merge. A multi-target operation reports completed and uncompleted targets with the original error instead of rolling back.

Closing and reopening require a non-empty reason and current explicit authorization.

rename performs ordinary renaming and repairs a noncanonical, empty, or over-long string name and a recognizable generated directory whose nonempty suffix disagrees with metadata. It tolerates only those old-state defects, while other commands retain strict discovery.

`task_layout` selects monthly `YYYY/MM/DD-NN--slug` or daily `YYYY/MM/DD/NN-slug`, with monthly as the sparse default. Ordinary discovery, creation, reads, search, check, repair, and metadata operations use only the selected layout. Child placement and discovery retain their existing rules.

Layout switch converts the current root in either direction and saves configuration last. Layout migrate adapts explicitly selected canonical top-level directories already imported into the current root and preserves configuration, metadata mode, and schema. Both preserve source dates, sequence numbers, slugs, identity, metadata, subtrees, and WAL. Final-graph validation merges the necessary source, target, or selected trees, deduplicating physical directories before UUID, sequence, carrier, target, and relationship checks. Conflicts preserve existing data.

rename and both layout operations preserve reference content by default. `--update-references` explicitly enables rewriting, and repeatable `--extend-scan` accepts additional Markdown files or directories, including external absolute paths. Shared rules cover Markdown destinations, images, definitions, full Task-root path wikilinks, and path text. Filename-only wikilinks retain their text. Relative links account for the moved source and target; content outside edited path intervals is preserved.

Every valid-project invocation saves a distinct immutable JSON scan report before managed changes, including dry-run, no-change, and planning failure. Reports contain mappings, references, scope, and diagnostics. Summary and errors express actual completion separately. Report storage failure stops managed changes. Reports under `<task_root>/.tk-tmp/reports` remain until the user removes them; operation cleanup and project GC retain this real directory. Reports are auxiliary snapshots rather than recovery plans.

Commit order is directory movement, optional reference replacement, then switch configuration or rename metadata and WAL. migrate preserves configuration. Input snapshots and reference scans are rechecked before managed writes. A partial switch retains source configuration until its final write, so already moved Tasks may temporarily disappear from ordinary views. New calls replan current files and use previous reports to review earlier moves. Automatic rollback remains outside the operation contract.

The complete format and operation details live in the [data model](../../../../../projects/tk/docs/design/data-model.md) and [CLI reference](../../../../../projects/tk/docs/design/cli-reference.md).

## Alternatives considered

**Support only split or only embed.** split is convenient for direct metadata inspection, while embed keeps a Task in one file. Both preserve the same schema without making either representation secondary.

**Use locks, transactions, or persistent recovery plans.** These mechanisms would add coordination and a second operation state machine. Atomic replacement, complete preflight, explicit partial results, activity markers, and retry from current managed files cover the intended local workflow.

**Rewrite references by default.** Automatic edits can change intentionally historical text. Preserving content by default and offering explicit updates leaves that decision to the caller while using one scan for reporting and rewriting.

**Keep child discovery under `subtasks_dir`.** This narrows scanning and guarantees generated paths, but changing a placement preference can hide valid carriers and make imported children unreachable.

## Consequences

Task state remains readable with ordinary file tools and portable across interfaces. Changing `subtasks_dir` no longer changes visibility, and imported or reorganized valid child carriers remain usable.

A fully valid carrier below a Task becomes a Task even when its author intended it as an example. Repositories must not copy complete managed carriers into ordinary materials. Moving a valid carrier below another valid Task also changes its derived parent, close blockers, and sibling numbering without changing metadata. `check` and rename expose the resolved parent and paths for diagnosis.

Recursive discovery reads more directories than configured-path discovery. The fixed depth and directory limits prevent unbounded work, but large or unreadable material trees can make project-wide operations fail explicitly. The absence of a permanent index means discovery, checks, relationship validation, migration, representation switching, and repair planning may use memory proportional to the number of candidates.

rename can recover eligible names without granting permissive loading to read, search, update, lifecycle, migration, or representation switching. Repair planning must maintain a second validation mode limited to old-name and recognizable-suffix defects. Invalid enclosing candidates can make a descendant ineligible because its parent cannot be established safely.

Closed Tasks retain their lifecycle state during name repair. References outside the selected scan scope, including non-Markdown files, may remain unnoticed. Explicit extension roots let callers include otherwise external Markdown.

The filesystem walk includes generated or unrelated Markdown. Explicit updates can therefore change historical path text that the caller wanted to retain. Callers can inspect the report before enabling updates. Resource limits and required I/O failures remain explicit planning failures.

Partial layout commits can temporarily hide moved Tasks under the source configuration. Reports retain the earlier mapping for inspection, while a new switch plan handles remaining source roots. Persistent reports accumulate until the user cleans them.

Ordinary concurrent writes have last-completing-writer behavior. Multi-target failures can leave valid partial results, and callers must inspect completed and uncompleted lists before retrying. A directory move followed by metadata failure is replanned from current managed files after activity-marker cleanup. No hidden continuation state or automatic rollback exists.

Every released schema transition becomes long-lived maintenance code. Supporting two representations also requires equivalent validation, migration, body preservation, and name repair in both paths.

## Changes

### 2026-09-05 Creation body input

`TASK.md` remains ordinary Agent-maintained content, so create accepts no body through `tk create task --body` or child Task items. When the runtime creates a Task, it automatically generates `# <normalized-name>` as the initial body: alone in split mode, after the managed frontmatter in embed mode. After creation the caller maintains the body, and rename and subtask retry matching use no body input or matching condition. Callers write `TASK.md` with ordinary file operations after creation. `tk log --body` is unchanged because WAL entries are not Task content. The persisted metadata schema and component format are unchanged.

### 2026-09-05 WAL access

`tk read` returns recent WAL within caller-selectable limits of at most 50 entries and 16000 compact JSON UTF-8 bytes. The `summary` view defaults to 5 entries and 4000 bytes and omits WAL bodies. `detailed` defaults to 50 entries and 16000 bytes and includes WAL bodies. Both views return the complete current Task body. `minimal` reads neither body nor WAL. The runtime selects complete projected entries from newest to oldest, silently omits the rest without a truncation indicator, and returns the selected entries in chronological order. Complete history remains in ordinary `wal/YYYY-MM-DD.md` files.

`tk check` no longer validates WAL through the bounded read path. Its streaming inspector reads every regular daily WAL file and validates every entry in deterministic order without fixed total history limits. It retains no complete WAL history in memory. Required I/O failures and cancellation make the check incomplete, while valid WAL size alone does not.

### 2026-10-19 Task name formatting

Saved names and generated suffixes may differ only in the use or omission of ordinary spaces `U+0020`, hyphens, and underscores. After ignoring those characters, the remaining text must match exactly. NFKC, non-empty text, and the other character requirements remain mandatory, and generated suffixes contain no whitespace. This lets project formatters add readable spaces without requiring name repair or a directory move.

Each saved name and generated suffix independently obeys the 32-terminal-column limit on its actual string, including every separator. Formatting correspondence grants no width exemption and does not change identity, search matching, or Task merging.

Creation and explicit rename retain request normalization and space-free generated paths. Ordinary reads, checks, updates, and representation switching accept valid formatting without rewriting it. Child creation retries ignore newly added ordinary spaces before applying the existing creation-name comparison, while keeping originally distinct normalized requests distinct.

rename still targets a concrete normalized name and applicable path, and returns no change only when both match exactly. Formatting correspondence does not replace narrow damaged-name repair, closed-state preservation, target conflicts, reference scanning and explicit update control, exact precommit rechecks, or partial-commit reporting. A directory move followed by a metadata failure may leave a valid readable Task, but retry must still complete the requested target. The [data model](../../../../../projects/tk/docs/design/data-model.md#task-names) owns the full rules.

### 2026-10-23 Requirement ownership

The [data model](../../../../../projects/tk/docs/design/data-model.md) and [CLI reference](../../../../../projects/tk/docs/design/cli-reference.md) state the complete required data and operation behavior, including formats, limits, failures, and acceptance. Design explains their implementation. These component pages own the requirements, without changing Task data or operation semantics.

### 2026-11-14 Metadata reports

Representation switching and schema migration save distinct immutable pre-execution reports, including dry-run, no-change requests, and planning failures in a valid project. Report persistence completes before managed changes. File plans describe carrier creation, rewriting, deletion, and schema conversions; configuration remains a separate final step for representation switches. Errors preserve file-level partial completion and unknown outcomes. GC and check preserve reports for manual inspection. Operation-specific details avoid imposing directory-move and reference fields on metadata changes. The [data model](../../../../../projects/tk/docs/design/data-model.md#scan-reports) owns the report format.

### 2026-11-14 Reference exclusions

Path operations accept explicit invocation-scoped reference exclusions so callers can retain the rest of a filesystem scan while omitting selected files or directory subtrees. Exclusions take precedence over default and extension roots in planning and precommit reference rechecks. Reports preserve the declared scope and express completeness within it. Task discovery and managed changes keep their own contracts. Excluded references retain their content and may keep old paths after movement. The [data model](../../../../../projects/tk/docs/design/data-model.md#reference-updates) owns the path and report rules.
