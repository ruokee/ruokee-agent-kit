# tk data

## Goals

Define tk's persistent Task data, discovery, lifecycle, writes, and maintenance behavior. This area applies equally to CLI, MCP, and native operations. Ordinary project files remain authoritative and readable without a service.

## Public surface

### Project configuration

Project configuration is sparse TOML at `.agents/tk_config.toml`. The defaults are:

```toml
task_root = ".tk"
subtasks_dir = ""
git_policy = "none"
creation_policy = "strict"
metadata_mode = "split"
```

Default values are omitted when writing configuration; a project using only defaults may have no configuration file. Each project has one Task root and one metadata mode. `task_root` is project-relative. `subtasks_dir` is relative to each parent and changes where new children are created, not the parentage or location of existing Tasks.

`init` rejects an already initialized project. `init --force` rewrites sparse configuration from this invocation's explicit values and defaults, even when the existing configuration is unparseable. It does not read, migrate, move, delete, or otherwise change Task data.

Before a write, `git_policy=track` requires managed files not to be ignored; `ignore` requires the Task root to be ignored; `none` requires no Git integration. These checks do not modify Git ignore rules, index, configuration, or history. Reads do not apply write-policy gates.

### Metadata

Schema version 1 has exactly these managed fields:

- `schema_version`: supported integer schema version, currently `1`.
- `id`: immutable UUIDv7.
- `name`: a valid Task name; only rename changes it.
- `status`: `planning`, `open`, or `closed`.
- `created_at`: immutable timezone-aware RFC 3339 timestamp.
- `depends_on` and `related_to`: UUID sets within the same Task root.
- `extra`: structured values representable without loss in JSON and TOML, changed by top-level key.

Unknown fields, missing required fields or versions, unsupported versions, and wrong types are invalid. `parent`, historical names, close reasons, actor, and session bindings are not managed fields. Parentage comes from containment; lifecycle reasons belong in WAL.

In `split` mode, a Task directory contains regular files `tk.toml` for metadata and `TASK.md` for body. In `embed` mode, regular `TASK.md` starts with strict YAML frontmatter, followed by the body. Frontmatter starts and ends with a line containing exactly `---`; LF and CRLF line endings are accepted. The YAML bytes between those delimiters, including their own line endings but excluding delimiter lines and body, may not exceed 1,048,576 bytes. Tags, duplicate keys, unknown fields, unsupported types, unclosed frontmatter, and excess size are rejected. A mode mismatch or conflicting carriers is an error.

Every metadata write and representation switch preserves body bytes. Creation accepts no body input and writes an initial body of exactly `# <normalized-name>`. The heading is ordinary text thereafter and does not control Task identity or managed name.

### Names

A saved name must be NFKC text with at least one letter or number. Its allowed characters are letters, numbers, ordinary U+0020 spaces, hyphens, and underscores. The saved name and generated directory suffix each have an independent maximum actual display width of 32 terminal columns. Separators count; date and sequence prefixes do not. A generated suffix contains no whitespace. Exceeding the width gives `task_name_too_wide`.

A saved name corresponds to a generated suffix when removing spaces, hyphens, and underscores leaves identical characters, including case. Formatting correspondence neither creates an identity alias nor changes search semantics.

Creation and explicit rename normalize the input with NFKC, retain letters and numbers, collapse each intervening non-letter/non-number run to one hyphen, and remove leading and trailing separators. An empty result is invalid. The normalized result must fit the width limit. Ordinary reads and checks do not normalize or move anything. Unrelated metadata writes and representation switches preserve valid saved spelling.

### Discovery

Top-level Task directories use `<task-root>/YYYY/MM/DD-NN--slug/`, with a valid calendar date, two-digit sequence, `--` separator, and non-empty suffix corresponding to the saved name. New children use `<parent>/<subtasks_dir>/NN--slug/`. A real nested Task may also live in an ordinary material directory. The nearest valid enclosing Task is its parent; no parent field is stored. Invalid marked directories do not replace a valid ancestor.

Discovery recognizes carriers for the configured mode. An embed discovery marker requires opening frontmatter and a `schema_version` header. An ordinary `TASK.md` or ordinary YAML material does not by itself create a Task. A marked but invalid carrier is excluded from ordinary Task results and reported by integrity checking. Duplicate identities and invalid generated name/path correspondence remain errors.

Discovery follows real directories, not ordinary material symbolic links. Missing, unreadable, cyclic, internal, or external link targets neither produce link diagnostics nor contribute Tasks. A material link named `TASK.md`, `tk.toml`, `wal`, or `.tk-tmp` does not acquire a managed role by basename. The actual managed Task root, carriers, WAL, and reserved temporary storage retain their type and representation requirements.

A discovery operation is bounded to 100,000 real directories and depth below 256. A required I/O failure or limit violation fails the operation rather than returning a partial graph. Explicit absolute discovered Task, carrier, or material paths can locate their own project, even when cwd is in another project. Non-Git reverse discovery is bounded: generated top-level date structure supplies a candidate root and at most two additional ancestor levels are checked for matching configuration. It does not search indefinitely toward the filesystem root.

Git projects use their Git root and project configuration. Ordinary context directories use bounded nearest-project discovery. `git_policy=none` does not require Git to be installed. WAL, reserved `.tk-tmp` storage, cleanup data, special files, and paths outside the Task root do not contribute Tasks.

### Creation

Top-level creation requires a name. Status defaults to `open`, time to now, relationships to empty, and `extra` to an empty object. A supplied historical timestamp must be reliable and timezone-aware. `strict` creation requires current explicit user confirmation. `permissive` creation allows work worth retaining without a new confirmation. Creating `planning` work requires the user's explicit intent to retain an early idea, investigation, or plan.

Child creation accepts 1 to 50 items under an `open` or `planning` parent. Open children need no new top-level creation authorization; any planning child requires current confirmation. Relationships may refer only to existing same-root Tasks, not future siblings in the batch. Preflight covers the entire batch before writes; creation then follows input order.

Child numbering considers all discovered direct children with generated leaf names, regardless of their containing material or configured creation directory. It uses the greatest existing sequence plus one, does not fill gaps, starts at `01`, and stops at `99`.

A retried child batch skips existing matching direct children. Matching uses the fields creation owns: name, status, explicit `created_at` when supplied, relationships, and `extra`. It excludes body. Saved names must first be valid; retry comparison permits added ordinary spaces by removing them before creation normalization. Distinct normalized requests such as `AI学习` and `AI-学习` remain distinct. Successful items and remaining items are reported after partial failure.

### Relationships

Relationship UUID sets are sorted and deduplicated. Targets must exist in the same root; self-reference is forbidden and dependencies must not form a cycle. `extra` updates affect top-level keys only.

A combined relationship and lifecycle update validates the candidate relationships, including close eligibility. Rejection leaves both metadata and WAL unchanged. An empty update or an update with no net change returns `changed:false`.

### Lifecycle

The permitted transitions are `planning` to `open`, either active state to `closed`, and `closed` to `open`. There is no transition back to `planning`.

`start` on `open` is a no-op. A closed Task can become active only through `reopen`. `close` and `reopen` require current explicit confirmation and a non-empty reason. Closing requires all descendants and dependencies to be closed. Explicitly authorized force-close bypasses only those two checks, not authorization, relationship validity, or other invariants. It does not close other Tasks automatically.

A closed ancestor prevents reopening and active writes below it. Closed Tasks are read-only for ordinary updates and logs, but rename and eligible name repair may keep the closed status. Completing a session or workflow does not close a Task.

### WAL

WAL is append-only Markdown in `wal/YYYY-MM-DD.md`. Each entry has this representation:

```markdown
## 2026-08-31T12:34:56+08:00 · actor

Message

Optional body
```

Only a complete H2 with a timezone-aware RFC 3339 timestamp, the separator, and actor starts an entry. Other H2 text belongs to the body. Actor is single-line attribution, not authorization. Message is non-empty single-line text; body is optional Markdown. There is no deduplication, transaction, or special body-escaping format.

Metadata commits before its automatic WAL event. If WAL append fails, the metadata stays committed and the result contains a non-fatal `wal_append_failed` warning. A log operation appends an event without changing metadata and rejects closed Tasks.

## Invariants

### Writes

A single-file write produces a complete atomic replacement. The last complete replacement to finish determines the final bytes. Multi-target operations finish all domain preflight before writing and commit in their defined order. I/O failure or cancellation between commits stops further writes and reports completed targets, uncompleted targets, and the original error. No automatic rollback or continuation state is provided.

While a multi-target operation has an active producer, other project writes fail with `operation_in_progress`. If the producer exits, writes remain blocked until GC clears its abandoned activity state. Read, search, and diagnostic-only checks remain available. Single-file updates do not establish this project-wide activity state.

### Migration

Schema migration uses only formally released forward transformations, one version at a time, and retains support for migrating each released version. It preserves body bytes, preflights all selected carriers, skips carriers already at the target version, and commits in deterministic order. Unknown versions, missing transformations, and downgrades are rejected. No rollback or resume state is supplied.

Representation switching covers every discovered Task in a project. After full preflight, it commits Tasks in deterministic order and configuration last. It preserves names and body bytes, adds no WAL entry, and reports partial progress if interrupted.

### Rename

Rename changes only the selected Task's managed name and applicable generated suffix. It preserves ID, date, sequence, body, status, and all other metadata. Non-generated child directories do not move. Closed Tasks are eligible and remain closed.

A full UUID, exact directory, or exact carrier can locate a repairable Task whose string name is invalid, empty, or too wide, or whose recognizable generated suffix is defective. A missing name, wrong field type, damaged identity, unsupported schema, or unrelated invalid metadata is not repaired by rename.

No change requires exact equality of the saved name and applicable path to the normalized target. Formatting equivalence alone is insufficient. The plan is checked exactly again before commit; a changed source produces `stale_rename_plan`. If a directory move succeeds and metadata writing fails, the result reports partial completion. A readable intermediate state still requires retry to reach the exact target.

Rename reports Markdown references to the old path without rewriting them. Under `track`, scanning covers working-tree Markdown, including untracked files and excluding files deleted from the worktree even if still indexed. Under `ignore` and `none`, it covers Task-root Markdown. Both body representations participate; frontmatter, WAL, and temporary content do not. Required read failures fail scanning. The bounds are 100,000 directories and depth below 256; exceeding either gives `reference_scan_limit_exceeded`.

A valid dry-run succeeds even when references exist. Execution that moves a path with old references fails before its first write with `broken_reference_conflict`, category `conflict`, exit status `3`. Details include `old_path`, normalized `new_name`, absolute `target_path`, and all reference paths and lines. `--ignore-brokenlinks` permits the move but leaves all reference files byte-for-byte unchanged and still reports them. Metadata-only and no-op results report references without applying the path-move gate.

### Integrity checking

`check` is read-only. It diagnoses managed metadata, representation, identity, parentage, names, relations, lifecycle, WAL, and reserved temporary-storage errors without repairing them. It reads complete regular WAL files without a fixed total-history limit. Ordinary material links retain the discovery behavior above.

A complete check with blocking diagnostics returns `check_failed`, exit `3`. A required I/O failure, cancellation, or resource-limit failure makes the check incomplete: return `check_incomplete`, exit `4`, and stop rather than presenting an apparently complete diagnostic set. A complete valid project exits `0`.

### Garbage collection

GC removes only temporary content proven to have been created by tk whose producer has exited. It preserves and reports active-producer content, symlinks, escaping paths, unknown cleanup formats, and content whose ownership cannot be established reliably. It does not parse or migrate legacy development cleanup formats.

GC does not modify Task data, WAL, project configuration, or canonical Harness targets. It does not resume, roll back, or complete a domain operation. A deletion error stops the operation and reports deleted and undeleted paths. Dry-run reports the same eligible cleanup without deletion.

## Acceptance criteria

- Both representations reject malformed managed data and retain body bytes, immutable identity fields, valid saved name formatting, and relation semantics on supported writes.
- Names and suffixes independently accept 32 columns and reject 33, including separators. Explicit rename reaches the exact target; child retry ignores edited body and added ordinary spaces without merging distinct normalized requests.
- Direct children, configured-directory children, and children inside ordinary materials retain nearest-valid-parent relationships. Numbering remains monotonic after creation-directory changes and reports exhaustion at `99`.
- Public read, search, and check retain real Task identity and parentage around ordinary symlinks, including dangling, unreadable, external, and cyclic targets, without changing link paths or target bytes. Managed-storage counterexamples still fail.
- Lifecycle and combined-update rejection preserve metadata and WAL. Force-close bypasses only active descendant and dependency checks.
- Each multi-target commit failure reports the actual completed and remaining targets. WAL failure does not roll back committed metadata; abandoned activity blocks writes until GC while reads remain available.
- Migration and representation changes preserve body and name bytes and report partial results. Rename reference gating, explicit override, dry-run, exact recheck, and metadata-only behavior follow the defined contracts.
- Integrity checks distinguish complete-invalid from incomplete reads and never disguise partial discovery as a complete result. GC leaves domain data and unproven temporary ownership untouched.
