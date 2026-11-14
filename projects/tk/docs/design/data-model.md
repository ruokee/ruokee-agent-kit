# Data model

[简体中文](./data-model.zh.md)

## Project configuration

Project configuration is stored in `.agents/tk_config.toml`. The configuration is sparse TOML relative to the defaults:

```toml
task_root = ".tk"
subtasks_dir = ""
git_policy = "none"
creation_policy = "strict"
metadata_mode = "split"
task_layout = "monthly"
```

Default values are not written to the configuration file. The file may be absent when all defaults apply.

- `task_root` is a project-relative path and defaults to `.tk`.
- `subtasks_dir` is the optional relative default creation directory under each parent Task. It does not constrain discovery.
- `git_policy` is `track`, `ignore`, or `none`.
- `creation_policy` is `strict` or `permissive`.
- `metadata_mode` is `split` or `embed` and applies to the entire project.
- `task_layout` is `monthly` or `daily` and selects the ordinary top-level discovery layout. It defaults to `monthly`.

`init --force` may ignore an unparseable existing project configuration and write a new sparse configuration using the explicit arguments from the current invocation plus defaults. It does not read, migrate, move, delete, or rewrite Task data, and it does not process an individual Task's `tk.toml`.

## Task directories

Top-level Tasks use the configured layout:

```text
monthly: <task-root>/YYYY/MM/DD-NN--slug/
daily:   <task-root>/YYYY/MM/DD/NN-slug/
```

New child Tasks use a stable `NN--slug` directory directly below the parent or below its configured `subtasks_dir`. Existing child Tasks may be stored deeper below ordinary material directories. The nearest enclosing valid Task defines parenthood, so directory topology still represents parent-child relationships without storing `parent` in metadata.

The Task root has no persistent index or cache. Discovery builds one in-memory graph from the file system on demand, and every project-wide caller uses that graph.

Both layouts allocate a two-digit sequence per calendar date, continuing after the largest discovered sequence without filling gaps. Sequence `99` prevents further creation on that date. Layout changes preserve the date, sequence, original slug, UUID, metadata, subtree, and WAL.

## Metadata schema

The current initial schema version is 1. Metadata contains only:

- `schema_version`: required positive integer.
- `id`: required UUIDv7, immutable after creation.
- `name`: required name satisfying the Task-name rules, modifiable only by rename.
- `status`: `planning`, `open`, or `closed`.
- `created_at`: required RFC 3339 timestamp with a time zone, immutable after creation.
- `depends_on`: set of UUIDs within the same Task root.
- `related_to`: set of UUIDs within the same Task root.
- `extra`: optional structured value that can be represented losslessly in both JSON and TOML.

The schema does not include `parent`, `branch`, `updated_at`, the most recent close reason, `paused`, `archived`, installation time, or session state.

Unknown fields, incorrect types, missing versions, and unsupported versions are invalid. Ordinary content does not become a candidate even if it resembles Task metadata.

## Metadata modes

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

## Creation body

create accepts no body input. The CLI has no `--body` option, and child Task items reject `body` as an unknown field. When the runtime creates a Task, it automatically writes `# <normalized-name>` as the initial body: alone in `TASK.md` for split, after the managed frontmatter for embed.

After creation the caller maintains the body as ordinary content. Neither rename nor subtask retry matching takes body input or matches on it. Metadata changes preserve body bytes. Explicit reference updates can change reference paths in the body. Representation switching preserves the body.

## Candidate identification

Ordinary top-level discovery accepts only the configured monthly or daily topology. Both require fixed numeric widths, a valid calendar date, a two-digit sequence, a non-empty slug, and a metadata name corresponding to the slug under the [Task-name rules](#task-names). Layout operations can read the other topology during dedicated preflight. After discovering a valid top-level Task, the runtime recursively scans real descendant directories, including ordinary material directories.

A descendant directory first needs an intentional marker for the project's `metadata_mode`:

- In split mode, a regular `tk.toml` is the marker. A valid Task also requires a regular paired `TASK.md`.
- In embed mode, a regular `TASK.md` is a marker only when it starts with the tk YAML delimiter and `schema_version` header. The complete frontmatter must then pass strict validation.

A marked directory becomes a Task only after its carrier, schema, UUIDv7 identity, representation, and project path pass validation. A generated `NN--slug` child must also correspond to its metadata name under the Task-name rules. A non-generated child has no path-to-name requirement. Marked but invalid directories are omitted from normal discovery and reported by `check`; unrelated `TASK.md` files and ordinary YAML frontmatter remain materials.

The nearest enclosing valid Task is the discovered parent. Invalid marked directories and ordinary material directories do not replace that ancestor. Symbolic links, special files, WAL directories, `.tk-tmp`, cleanup data, and paths outside the Task root do not participate in discovery.

Ordinary Task materials may contain file or directory symbolic links, directly or in nested material directories. Relative and absolute links may point inside or outside the project. Discovery and `check` do not resolve or read their targets, including missing, unreadable, or cyclic targets. Linked Task markers and duplicate identities do not enter the graph; real nested children still do. A material link's name alone does not make it a managed carrier or runtime path.

Traversal order is deterministic. One scan accepts at most 100,000 real directories and 256 descendant levels. Crossing either limit or encountering a required I/O failure returns `task_discovery_limit_exceeded` or the relevant storage error instead of a partial Task graph. `check` reports such a scan as incomplete.

`subtasks_dir` controls only where new children are written. Sequence allocation examines all discovered direct children whose leaf has a valid generated `NN--slug`, takes the largest sequence, and does not fill gaps. New names remain two digits wide. If sequence `99` is already present, creation fails before writing.

## Task identity

UUIDv7 is the authoritative identity. Paths are locators and may change through rename or layout operations. Names describe Tasks.

## Task names

Saved names must be NFKC text containing at least one letter or number. Only letters, numbers, ordinary spaces `U+0020`, hyphens `-`, and underscores `_` are allowed.

Saved names and generated directory suffixes each occupy at most 32 actual terminal display columns. Count every space, hyphen, and underscore in the stored string, without stripping or normalizing it first. A name that grows from 32 to 33 columns through formatting fails with `task_name_too_wide`. Date and sequence prefixes are not part of the suffix width.

A generated suffix satisfies the same character and non-empty-text rules and contains no whitespace. Compare a valid name and suffix by ignoring only ordinary spaces, hyphens, and underscores on both sides. The remaining text must match exactly, including case. For example, suffix `AI学习` corresponds to names `AI学习`, `AI 学习`, `AI-学习`, and `AI_学习`. This comparison is not identity, a search alias, or a rule for merging Tasks. Non-generated child directories have no name correspondence requirement.

Creation and explicit rename retain request normalization with NFKC, restricted characters, and collapsed hyphen separators. New generated directories contain no spaces. Ordinary reads and `check` do not normalize saved names or move directories; metadata updates and representation switching preserve a valid saved spelling.

For child creation retries, validate the saved name completely, remove its ordinary spaces, then apply the existing creation normalization before comparing it with the normalized request name. Other request fields keep their existing matching conditions. Formatting spaces therefore do not duplicate an existing child, while requests `AI学习` and `AI-学习` remain distinct.

## Relationships

`depends_on` and `related_to` may reference only Tasks within the same Task root. A Task cannot reference itself, and `depends_on` cannot form a cycle. Relationships are sorted by UUID and deduplicated.

## Lifecycle

- `planning`→`open`: allowed, with an automatic WAL append.
- `planning`→`closed`: non-empty reason, current authorization, and close checks.
- `open`→`closed`: non-empty reason, current authorization, and close checks.
- `closed`→`open`: non-empty reason, current authorization, and no closed ancestor.

A normal close requires all descendants and dependency targets to be closed. A forced close bypasses only descendant and dependency checks. It does not bypass authorization, reason, schema, path, Git, or relationship validation.

When an update combines relationship changes with a lifecycle action, validation uses the candidate metadata after those changes. Adding an open dependency blocks normal close; removing the last open dependency permits close if the remaining checks pass. A rejected update writes neither metadata nor a lifecycle WAL entry.

An update builds one strict Task graph and reuses it to resolve the target and relationship references, check lifecycle constraints, and validate candidate relationships. The graph lasts only for that request; it does not synchronize concurrent writers.

A closed Task is read-only by default. read, search, and check may still read it. rename stays available and does not change the status.

## Creation authorization

- In a `strict` project, a top-level Task may be created only when the user explicitly requests or confirms it in the current context.
- A `permissive` project allows an Agent to create a Task for work worth preserving, without requiring a prior commitment to perform the work.
- Creating a `planning` Task requires the user to explicitly express an intent to save an early idea, investigation, or plan.
- The default creation status is `open`. Pass `planning` explicitly when needed.
- Ordinary child Tasks within an open Task tree do not require new top-level authorization.

## Project discovery

Git projects are located using the Git root and project configuration.

For an exact path outside Git, use the Task directory structure:

1. Starting from a Task, managed file, or material path, search upward for a canonical monthly or daily top-level ancestor.
2. Validate its date directories and sequence topology.
3. The parent of `YYYY` is the candidate Task root.
4. Inspect at most two additional ancestor directories to match project configuration against the Task root.
5. Load the configured-layout carrier graph and require the exact path to be inside a discovered Task.
6. If the project cannot be confirmed within two levels, fail without continuing to the file-system root.

For an ordinary context directory, use bounded nearest-project discovery. An exact absolute discovered Task path, managed carrier, or material path first locates its owning project, allowing a caller in project A's cwd to read an absolute reference in project B.

## Git policy

Git policy is checked before managed Task or configuration writes. Auxiliary scan report creation is independent of this check:

- `track` requires managed Task files not to be ignored.
- `ignore` requires the Task root to be ignored.
- `none` does not invoke Git policy commands.

read, search, and purely diagnostic operations are not rejected because of Git policy. tk never modifies `.gitignore`, the index, Git configuration, commits, or history.

## Search visibility

When the status filter is omitted or an empty array is passed, search includes `planning`, `open`, and `closed`. Only a non-empty status array narrows the result set. File-system traversal does not stop at a closed parent Task, and results report closed ancestors.

Search ordering and matching are defined by the [CLI reference](./cli-reference.md#tk-search).

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

`tk read` returns recent WAL within caller-selectable entry and byte budgets. The `summary` view omits WAL bodies, while `detailed` includes them. Entries outside the budgets are silently omitted without a truncation field, warning, or diagnostic. Complete history remains available in the daily files.

`tk check` uses a separate streaming inspector. It reads every regular daily WAL Markdown file and every entry in deterministic order without fixed total file, byte, or entry limits. A required I/O failure or cancellation makes the check incomplete rather than returning a successful partial scan.

## Writes to one file

A managed single-file update uses a temporary file in the same directory followed by atomic replacement:

1. Strictly read the current state.
2. Complete domain validation.
3. Run the pre-write Git policy check.
4. Write and close the complete temporary file.
5. Atomically replace the target.
6. Remove temporary content.

Concurrent complete replacements of the same file are resolved by whichever operation finishes last.

## Operations over multiple targets

Batch creation, schema migration, representation switching, layout operations, rename, and CLI Skill lifecycle operations follow the same failure boundary for managed changes:

1. Complete all domain validation before the first write.
2. Commit each item in deterministic order.
3. Stop immediately on an ordinary I/O error.
4. Return completed items, incomplete items, and the original error.
5. Do not roll back automatically, create continuation state, or continue operating after the process exits.

The same request may be executed again after the caller confirms the current state. Each invocation rebuilds the discovered Task graph and replans from current managed files.

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

1. Read and validate all discovered Tasks.
2. Generate the target carrier for each Task.
3. Commit Tasks in deterministic order.
4. Update project configuration last.
5. If the operation fails partway through, report completed and incomplete file or configuration steps without automatic rollback.

Switching does not append Task WAL entries.

## Layout changes

`tk switch layout --to <monthly|daily>` merges the complete source graph with existing target-layout Tasks during preflight. It validates carriers, names, UUID uniqueness, date sequences, and relationships, moves source top-level directories in source-path order, and writes the target configuration last. Existing target Tasks stay in place. Switching an empty root updates configuration; selecting the active layout produces a no-change report.

`tk migrate layout --task <path>...` adapts explicitly selected canonical top-level directories already inside the current Task root to the configured layout. Relative paths resolve from the project root. Repeated selections and selected Tasks already at the target are deduplicated by physical directory. Preflight merges selected subtrees with the active graph before checking UUIDs, sequences, targets, and relationships. Configuration, metadata representation, and schema keep their existing values.

Both operations preserve source numbering and slugs. Existing targets or duplicate same-date sequences stop planning. A partial switch keeps the old configuration until every required move and reference update succeeds. Some moved Tasks may then be hidden from ordinary discovery. A later switch replans against both layouts and processes remaining source directories. Earlier path mappings remain available in the earlier report for manual reference repair.

## rename

rename applies request normalization and a concrete target even when the saved name and generated suffix already correspond under formatting comparison. It also repairs an invalid, empty, or over-wide string name, or a recognizable generated suffix that fails the [Task-name rules](#task-names):

1. Resolve one eligible candidate by full UUID, exact Task directory, or exact managed carrier. Repairable candidates participate in UUID uniqueness and parent ownership; indeterminate ancestry is rejected.
2. Normalize the new name and validate the complete metadata with that replacement. Missing or incorrectly typed names, damaged identity, unsupported schema, invalid relationships or `extra`, unsafe paths, and unrecognizable generated structures remain errors.
3. Keep a non-generated child directory unchanged. Otherwise preserve the date and sequence and compute the new slug path.
4. Verify that any moved target does not exist.
5. Scan references and persist the scan report.
6. Check project writability and Git policy, then recheck inputs.
7. Move a generated directory without overwriting. Skip this step for a non-generated child.
8. Apply reference updates when explicitly requested.
9. Update metadata while preserving status and all fields except `name`. Preserve the current body, including any reference edits.
10. Append WAL.

Only exact equality of the saved name and applicable target path returns no change. Renaming name `AI 学习` at suffix `AI学习` to `AI 学习` targets name and suffix `AI-学习`. Renaming name `AI-学习` at suffix `AI_学习` to the same name still moves the directory.

Before committing, compare the current path, complete metadata, carrier bytes, configuration, target, and references exactly with the plan. Formatting equivalence never suppresses `stale_rename_plan`. A failure after a committed step returns completed and incomplete steps with the original error and report path. A readable intermediate state still requires the same request to replan and finish its exact target.

## Reference updates

rename and both layout commands preserve reference content by default. `--update-references` explicitly enables rewriting. Repeated `--extend-scan <path>` accepts Markdown files or directories, including absolute paths outside the project. Relative inputs resolve from the project root.

With `git_policy=track`, the default scan covers project Markdown from the file system, independent of Git staging state. With `ignore` or `none`, it covers Markdown under `task_root`. Overlapping inputs are deduplicated and sorted. Symbolic links are skipped; explicitly selected links are rejected. The merged scan accepts at most 100,000 real directories and 256 levels. Required I/O failures and `reference_scan_limit_exceeded` stop planning.

Known Task WAL, `.git`, and the current Task root's `.tk-tmp` are excluded. Embed `TASK.md` scanning starts after managed frontmatter. Imported subtrees and existing target-layout Tasks contribute their known runtime directories.

Repeated `--exclude-scan <path>` excludes a literal path and its descendants by complete path components. Relative paths resolve from the project root; external absolute paths are accepted. Paths are lexically normalized, sorted, and deduplicated without inspecting the excluded target. Nonexistent and out-of-scope paths are retained. Parent and child exclusions may coexist. Patterns and ignore files are not interpreted.

Exclusion takes precedence over default and extension roots, before extension-path inspection, traversal, or reference reads. A fully excluded extension input skips its preflight checks. Other extension inputs retain their existing ancestor and symbolic-link checks. The precommit reference recheck uses the same exclusions; changes confined to excluded paths do not invalidate the reference plan. Excluded references retain their content. Task discovery, carrier checks, metadata writes, and managed directory movement remain independent of reference exclusions.

The scanner handles ordinary Markdown link and image destinations, reference definitions, full Task-root paths in wikilinks, and full Task paths in text or code. Filename-only wikilinks and external URIs stay unchanged. Labels, titles, aliases, fragments, and queries retain their bytes. Destinations support escapes, parentheses, angle brackets, and URL percent encoding. Matching requires a complete path prefix and directory component. A same-named Task-root segment beneath another directory is a different path.

Relative full-path wikilinks resolve from the project root before mapping. Leading parent components therefore retain their effect on the referenced location. Wikilinks match source directories by whole path components. The nearest source ancestor determines the mapping. Characters such as `!` and `:` within a filename belong to that component.

Let F map each moved directory and its descendants to their new paths. For a relative link from file S to target T, the replacement is the relative path from `parent(F(S))` to `F(T)`. This covers moved files linking outward, incoming links, links between moved Tasks, and subtree-local links. Targets use lexical normalization. An already applicable reference keeps its original spelling.

One scan prepares all mappings. Each changed file retains one original content snapshot and sorted non-overlapping UTF-8 byte intervals. Before committing, the runtime rescans the file set and references and compares every pending file's full content. Each file is replaced once at its mapped location using a same-directory atomic temporary file, including extension files on another file system.

## Scan reports

Every rename, layout, and metadata invocation in a valid project saves an independent report, including dry-run, no-change requests, and planning failures. CLI parsing, project resolution, cancellation, and report-storage failures use their corresponding errors. Reports use `create_new`, UTF-8 JSON, flush, and sync before managed changes begin:

```text
<task-root>/.tk-tmp/reports/YYYYMMDDTHHMMSS+ZZZZ--<operation>--<UUIDv7>.json
```

The operations are `rename`, `switch-layout`, `migrate-layout`, `switch-metadata`, and `migrate-metadata`. Reports are immutable pre-execution snapshots. Their common header contains `report_version=1`, `operation`, `run_id`, local `created_at`, `dry_run`, `project_root`, `task_root`, and `diagnostics`. Read the operation-specific details using both the version and operation. Layout and rename retain their source and target layouts, scan roots, completeness, Task mappings, and references. Task mappings contain `task_id`, `old_path`, `target_path`, `old_name`, and `new_name`. Reference entries contain `kind`, `old_file`, `target_file`, one-based `line`, half-open `byte_start` and `byte_end`, `original`, `replacement`, `old_target`, and `target`.

Metadata reports use `plan_complete`. A failed plan retains known entries and diagnostics with `plan_complete=false`. Representation switching records `source`, `target`, and `tasks`; each Task contains `task_id`, absolute `task_dir`, and ordered `file_changes` with `action` (`create`, `rewrite`, or `delete`) and `path`. split→embed rewrites `TASK.md` then deletes `tk.toml`; embed→split creates `tk.toml` then rewrites `TASK.md`. `config_change` records `path`, `key`, `before`, and `after`, or is null for a same-mode request. Configuration commits last and retains sparse-config creation, replacement, and deletion semantics.

Schema migration records `requested_target`, nullable resolved `target_version`, absolute `selected_files`, and `files`. An empty selection means all discovered carriers. File plans contain `task_id`, `path`, `source_version`, `target_version`, `conversions`, and `changed`, including carriers already at the target. Target parsing and carrier selection failures after project resolution also save reports. The current schema is 1.

All recorded paths are absolute. Equal original and replacement values identify references requiring no edit. `scan_complete=false` marks incomplete reference scans. Actual execution status belongs to the CLI [path summary](./cli-reference.md#path-change-results), [metadata summary](./cli-reference.md#metadata-results), or error. Reports provide a record for manual inspection. They are not replay input.

Path-operation reports include `excluded_paths` only when explicit exclusions were supplied. It contains their normalized, sorted, deduplicated absolute paths, including paths outside the scan and paths that do not exist. It is prepared before business planning, so a planning failure retains the declared exclusions. `scan_roots` retains default and extension roots. Scan completeness describes those roots minus built-in and explicit exclusions, including a completely excluded scope. Reference entries and summary counts cover the remaining scope. Report version 1 and metadata reports retain their existing contracts.

Dry-run adds only its report. Task data, references, and configuration retain their bytes. Report failure stops managed changes and cleans up the incomplete report. Existing reports remain until the user removes them. Project write gates, check, and GC reserve the real `.tk-tmp/reports` directory and preserve its content. User-level operation directories keep their existing semantics.

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
- Project scan reports in the real `.tk-tmp/reports` directory are retained.
- GC does not modify Task metadata, bodies, WAL, project configuration, or Harness configuration.

If an I/O error occurs during deletion, GC stops and reports deleted and undeleted paths.

## check

check strictly validates project configuration, marked Task carriers, schema, representation consistency, generated name-path agreement, UUID uniqueness, direct-child sequence uniqueness, relationships, WAL, activity markers, and temporary manifests. It reports the resolved parent path for logical sibling-sequence conflicts.

Ordinary material links produce no diagnostic. Task roots, recognized Task carriers, each discovered Task's WAL, and the project Task root's `.tk-tmp` data retain their managed type requirements. `check` reports links in WAL and temporary runtime data without following them. It does not inspect ordinary link validity or grant managed storage a link alias.

If a required directory or file cannot be read, discovery crosses a resource limit, or the scan is interrupted, check immediately returns an incomplete check and does not continue collecting diagnostics. The failed I/O path is included when available. Valid WAL size alone does not make the check incomplete. If marked carrier, format, or domain errors are found after a complete read, the check is complete but failed. check does not modify any content.
