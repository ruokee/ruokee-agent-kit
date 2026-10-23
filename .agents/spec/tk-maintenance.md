# tk maintenance

## Goals

Define schema migration, representation switching, rename, integrity checking, and temporary-content cleanup. These operations use tk's shared data, discovery, and write requirements equally through CLI, MCP, and native interfaces.

## Public surface

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

`check` is read-only. It diagnoses managed metadata, representation, identity, parentage, names, relations, lifecycle, WAL, and reserved temporary-storage errors without repairing them. It reads complete regular WAL files without a fixed total-history limit. Ordinary material links retain the shared discovery behavior.

A complete check with blocking diagnostics returns `check_failed`, exit `3`. A required I/O failure, cancellation, or resource-limit failure makes the check incomplete: return `check_incomplete`, exit `4`, and stop rather than presenting an apparently complete diagnostic set. A complete valid project exits `0`.

### Garbage collection

GC removes only temporary content proven to have been created by tk whose producer has exited. It preserves and reports active-producer content, symlinks, escaping paths, unknown cleanup formats, and content whose ownership cannot be established reliably. It does not parse or migrate legacy development cleanup formats.

GC does not modify Task data, WAL, project configuration, or canonical Harness targets. It does not resume, roll back, or complete a domain operation. A deletion error stops the operation and reports deleted and undeleted paths. Dry-run reports the same eligible cleanup without deletion.

## Acceptance criteria

- Explicit rename reaches the exact target.
- Migration and representation changes preserve body and name bytes and report partial results. Rename reference gating, explicit override, dry-run, exact recheck, and metadata-only behavior follow the defined contracts.
- Integrity checks distinguish complete-invalid from incomplete reads and never disguise partial discovery as a complete result. GC leaves domain data and unproven temporary ownership untouched.
