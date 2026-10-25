# Validation

[简体中文](./validation.zh.md)

This page describes validation methods and scenarios for tk's required behavior and implementation choices. Specifications contain the complete behavior and acceptance requirements; design explains implementation. Validation must not weaken either obligation for implementation convenience.

The lists below are scenario requirements, not a coverage report. The automated entry point is `cargo test --manifest-path projects/tk/Cargo.toml` for Rust and component lifecycle checks. Lifecycle tests run the candidate CLI against real temporary files with no Harness commands. Run installed-Skill and real-Harness scenarios separately. Record the actual candidate, host version, inputs, observations, and uncovered cases with each validation result.

## Automated prerequisites

Use Rust with `rustfmt`, Git, and a non-root POSIX environment. From the repository root, prepare locked crate dependencies separately from checks:

```sh
cargo fetch --locked --manifest-path projects/tk/Cargo.toml
```

Run Rust formatting validation with `cargo fmt --manifest-path projects/tk/Cargo.toml -- --check`, followed by the Rust test command above. Keep each checkout's writable dependencies and build output independent. These commands do not change the user's runtime or Skill installation.

## Repository boundaries

Validate the following static facts:

- One Cargo package produces the `tk` executable;
- Rust is the only component assembler;
- Components have exactly one Rust-based assembly path;
- The embedded distribution contains exactly two self-contained Skills, `tk-cli` and `tk-cli-zh`, with no Harness field;
- Each source and installed tree contains all of its references, with equivalent language coverage;
- Review records and Task materials are not included in product artifacts.

## Data model tests

Cover split and embed:

- Strict decoding, stable encoding, and body preservation for schema 1;
- Unknown fields, missing versions, unknown versions, incorrect types, and restricted YAML;
- Canonical top-level discovery and mode-specific carrier markers for descendants;
- Direct, configured-directory, and ordinary-material nested children with nearest-valid-ancestor parenthood;
- Marked invalid carriers, symbolic links, runtime-owned paths, discovery limits, duplicate identities, and logical sibling sequences;
- UUIDv7, generated name-path agreement, relation deduplication, cross-root references, and dependency cycles;
- Formatting correspondence for ordinary spaces, hyphens, and underscores without case folding or text changes, across top-level Tasks and generated children;
- Actual 32/33-column boundaries for names and generated suffixes, counting all separators independently and rejecting whitespace in generated directories;
- Valid saved spellings survive managed writes and both representation-switching directions without implicit name changes, directory moves, or new diagnostics;
- Child sequence allocation after `subtasks_dir` changes, gap preservation, and exhaustion at `99`;
- Non-generated child rename without a directory move and generated rename with a stable sequence;
- planning, open, and closed transitions and closing constraints;
- Combined relationship and close updates validate candidate dependencies, preserve metadata and WAL on rejection, and retain force-close authorization and relationship checks;
- One update reuses one discovery graph for relationship references, close or reopen checks, and candidate relationship validation;
- Strict and permissive creation;
- create rejects `--body` as an unknown CLI argument and rejects `body` as an unknown field in child Task items;
- The runtime writes an initial body of exactly `# <normalized-name>` for both split and embed creation;
- subtask retry matches only fields create owns, ignores added ordinary formatting spaces and edited bodies, and keeps distinct normalized requests such as `AI学习` and `AI-学习` separate;
- Git `track`, `ignore`, and `none` preflight checks only before writes;
- Reverse project discovery from absolute discovered Task, carrier, and material paths;
- Bounded ancestor checks for non-Git discovery.

## Search tests

Cover:

- planning, open, and closed by default;
- Explicit status filters narrow results;
- Interpretation order for full UUIDs, unambiguous Task paths, material paths, regex, and string;
- No fallback after the query type is determined;
- UUID prefixes of at least 8 characters;
- Match class, descending `created_at`, and ascending ID;
- `match` returns `uuid`, `path`, `regex`, or `string`;
- A default limit of 20, a maximum of 100, and a bounded result set;
- `search_body=false` does not read bodies.

## WAL tests

Cover valid entry encoding and parsing, actor, message, body, and budget. WAL failures must not roll back already committed metadata.

Do not add an escaping format or a dedicated test contract for body text that exactly resembles a complete entry header.

## Write tests

Cover:

- Same-directory temporary files and atomic replacement for single-file writes;
- The last complete replacement to finish determines the final bytes;
- All domain preflight checks complete before the first write in multi-target operations;
- Injected I/O failures at every commit point, with accurate reporting of completed and incomplete items;
- No automatic rollback and no generated resume state;
- Retried bulk creation skips items that already exist and match;
- An active producer process blocks writes from other projects;
- A marker from an exited producer process continues to block writes until GC;
- read, search, and diagnostic-only operations stay available under an active marker ([minimal cleanup manifest](./data-model.md#minimal-cleanup-manifest));
- Single-file updates do not create project activity markers.

## Migration tests

When multiple official schemas exist, test each adjacent migrator separately and test composed chains. The current initial version is 1.

Cover stepwise forward migration for split and embed, body preservation, preflight checks for all targets, skipping the current version, unknown versions, missing conversions, and downgrade rejection.

## Representation switching tests

Representation switching covers split→embed, embed→split, committing configuration last, completed and incomplete items after intermediate failures, and no WAL append.

## rename

Cover name and path updates, unchanged results for repeated identical rename operations, WAL warnings, target conflicts, and reference scanning:

- `git_policy=track` scans project Markdown from the file system, independent of Git staging state;
- `ignore` and `none` scan ordinary Markdown under task_root;
- Bodies in both split and embed participate;
- Closed Tasks rename and repair while keeping the status;
- Formatting-compatible sources still reach the exact normalized name and applicable path, including separator-only changes and repeated requests for a displayed name;
- Empty or actually over-wide names and recognizable suffix defects remain repairable; exact precommit rechecks retain `stale_rename_plan`;
- A real directory move followed by metadata I/O failure reports partial completion, and a readable intermediate state still requires retry to reach the exact target;
- A metadata-only rename reports references without applying the path-move gate, and a no-op request still reports them;
- A file deleted from the worktree but still present in the Git index does not fail the scan, and untracked files participate;
- Unreadable reference files fail the command explicitly, and a scan that exceeds its depth or directory limit stops with `reference_scan_limit_exceeded`;
- References are reported but not modified automatically;
- Dry-run with references succeeds and returns the complete plan;
- A path-moving execution with references stops with the stable error code `broken_reference_conflict`, category `conflict`, and exit status 3 before the first write, with `old_path`, normalized `new_name`, absolute `target_path`, and every reference path and line in the details;
- `--ignore-brokenlinks` lets the move complete, leaves reference files byte for byte unchanged, and keeps the references in the result;
- A path move without references completes. A non-generated child rename completes without moving its directory, and repeating an identical rename returns no change; neither returns `broken_reference_conflict`.

## Maintenance tests

check tests cover fully valid projects, domain diagnostics, and fail-fast behavior for required I/O. After a required read fails, check must not continue producing an apparently complete diagnostic set.

In both metadata modes, exercise the public CLI with ordinary file and directory links at direct and nested material locations. Cover relative and absolute links, targets inside and outside the project, missing and genuinely unreadable targets, self-cycles and mutual cycles. `check` must succeed without link diagnostics and must not discover invalid carriers or duplicate identities through linked directories. Read and search must retain the original Task identities and nearest-parent relationships, including real nested children. Ordinary links named `TASK.md`, `tk.toml`, `wal`, or `.tk-tmp` do not acquire managed roles by basename.

Counterexamples retain managed Task root and carrier rules, representation conflicts, WAL root and entry types, and temporary root, operation, manifest, and payload types. These errors must remain observable alongside ordinary links. Preserve complete-failed and required-I/O-incomplete exit contracts. Compare stored link paths, target bytes, and Task data before and after checking; the check must not change them.

GC tests cover:

- Version, process identity, time, and temporary paths in the minimal cleanup manifest;
- Content belonging to active processes is preserved;
- Content and markers belonging to exited processes are removed;
- Path escapes, symlinks, unknown manifests, and content that cannot be proven to belong to tk are preserved;
- Legacy cleanup formats from development are neither parsed nor migrated;
- Task, WAL, project configuration, and Harness configuration are not modified;
- Deletion errors report deleted and undeleted items.

## Interface tests

Exercise these CLI scenarios:

- Command tree, help, version, and text and JSON output;
- Separation of stdout and stderr;
- Current exit-code mapping;
- actor appears only in update, log, and rename;
- All default statuses for search;
- init force does not read Task data;
- Both target types default to English, accept either language, and report the resolved Skill;
- Install and uninstall require exactly one of Harness and Skill root;
- Component commands have no local source and reject global cwd;
- Unknown commands and options outside the current contract are rejected.

## Component assembly

Repeated builds must produce the same two CLI Skill payloads, file bytes, `tar.zst` bytes, and manifest. Validate language, Skill identity, paths, permissions, digests, missing items, extra items, and `runtime_compat`.

Validate builds both with and without `TK_SOURCE_REVISION`. Build scripts must not invoke Git or write generated artifacts outside Cargo-managed directories.

## Installation tests

Isolated tests cover every Harness root mapping and a custom root in both languages:

- install, update, selection switching, no_change, and uninstall;
- Embedded archives with no network or local sources;
- The resolved target, `language`, and `skill` in text and JSON install results;
- The fixed runtime is absent, is not a regular file, or lacks execute permission;
- Installation writes the selected Skill, removes the other language, and requires no Harness executable;
- Uninstall completely removes both CLI Skill directories, including modified and extra content;
- The root, other children, and unrelated configuration remain unchanged;
- Intermediate I/O failures report completed and incomplete items;
- GC cleans up only temporary component content and does not continue lifecycle operations.

Custom-root tests also cover relative and absolute roots and missing parent creation. Both target types cover complete payload convergence, language switching, dry-run, and no_change. Results contain exactly one of `skill_root` and `harness`; uninstall omits language and Skill.

## Real Harness validation

- Codex: real installation, loading, and uninstallation in an isolated environment.
- Claude Code: real installation, loading, and uninstallation in an isolated environment.
- Pi: real installation, loading, and uninstallation in an isolated environment.
- OMP: real installation, loading, a Task operation through the CLI, and uninstallation in an isolated environment.

Each Harness validates ordinary Skill placement, discovery, and uninstallation for both languages.

Real tests must observe the Harness's actual loading result and post-uninstallation state. Checking assembled files alone is insufficient.

## Skill tests

Skill scenarios cover strict/permissive creation, planning/open selection, Task parsing, catchup, WAL, authorization for manual repair, close/reopen, the four material patterns, and CLI command use. Both Skill identities must present the same pattern semantics, and each stays self-contained.

Across the four patterns, a suggestion follows a signal that has appeared and explains what the pattern adds and what it requires to maintain; the Agent states the choice in `TASK.md` only after the user adopts it. A counterexample only rules out proactive suggestions; an explicit user request to use a pattern is adoption authorization on its own and is never blocked by one.

Material pattern scenarios observe:

- Records: same-day work or a plan to continue later triggers no proactive suggestion; once a second local calendar date holds substantive activity a suggestion is possible. Materials keep the judgments held at the time, later corrections go into subsequent materials rather than rewriting earlier ones, and no past activity or future-dated record is invented. Records, WAL, and `TASK.md` keep their separate roles.
- Deep research: reading one known document or answering an ordinary API question triggers no proactive suggestion, while work that needs collecting, retaining, or cross-checking external sources can be suggested. Materials tie each key claim to its source and keep source access dates, conflicts between sources, and what remains unverified, alongside the boundaries of the conclusions.
- Iterative design: a new major redesign starts the next revision, while a common correction stays in the current revision; each revision is self-contained, superseded revisions keep their content, and `TASK.md` exposes one current design entry point.
- Scratchpad: a brief exchange that needs no retention creates no material; temporary content is retained, stable content moves into ordinary materials, and obsolete content stays distinguishable; without authorization to delete or move materials, no cleanup runs.

Adopting a pattern adds no metadata, schema, `extra`, state, or commands, and does not extend Task creation or lifecycle authorization. An existing project layout may override the default directories. No scenario requires creating empty materials.

Markdown and Rust baseline checks cannot prove Agent behavior on their own; the patterns are confirmed through Harness scenarios with the candidate Skill installed.

## Documentation tests

Public documentation checks cover language links, semantic correspondence, terminology, and naturalness across the English and Chinese pages. Use existing repository checks and manual review without adding a custom documentation structure checker.
