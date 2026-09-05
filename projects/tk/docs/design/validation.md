# Validation

[简体中文](./validation.zh.md)

This page defines the observable contracts that must be proven when implementing the current tk contract. Validation does not replace the design and must not weaken the contract for implementation convenience.

## Repository boundaries

Validate the following static facts:

- One Cargo package produces the `tk` executable;
- Rust is the only component assembler;
- Components have exactly one Rust-based assembly path;
- Multiple payloads cover the Harness, mode, and language selections without referencing other component directories;
- The two standalone CLI Skill payloads contain only `tk-cli` or `tk-cli-zh` and have no Harness field;
- The four Skill identities map exactly to tools or CLI mode and English or Chinese;
- CLI payloads contain no tk operation registration, while tools payloads contain the selected Harness integration;
- Review records and Task materials are not included in product artifacts.

## Data model tests

Cover split and embed:

- Strict decoding, stable encoding, and body preservation for schema 1;
- Unknown fields, missing versions, unknown versions, incorrect types, and restricted YAML;
- Canonical top-level discovery and mode-specific carrier markers for descendants;
- Direct, configured-directory, and ordinary-material nested children with nearest-valid-ancestor parenthood;
- Marked invalid carriers, symbolic links, runtime-owned paths, discovery limits, duplicate identities, and logical sibling sequences;
- UUIDv7, generated name-path agreement, relation deduplication, cross-root references, and dependency cycles;
- Child sequence allocation after `subtasks_dir` changes, gap preservation, and exhaustion at `99`;
- Non-generated child rename without a directory move and generated rename with a stable sequence;
- planning, open, and closed transitions and closing constraints;
- Strict and permissive creation;
- create rejects `--body` as an unknown CLI argument and rejects `body` as an unknown field in create requests and child Task items;
- The runtime writes an initial body of exactly `# <normalized-name>` for both split and embed creation;
- subtask retry matches only fields create owns, so a retry after the body was rewritten returns no changes and no duplicates;
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

## Write and concurrency tests

Cover:

- Same-directory temporary files and atomic replacement for single-file writes;
- The last complete replacement to finish determines the final bytes;
- All domain preflight checks complete before the first write in multi-target operations;
- Injected I/O failures at every commit point, with accurate reporting of completed and incomplete items;
- No automatic rollback and no generated resume state;
- Retried bulk creation skips items that already exist and match;
- An active producer process blocks writes from other projects;
- A marker from an exited producer process continues to block writes until GC;
- read, search, and diagnostic-only operations are not blocked by activity markers;
- Single-file updates do not create project activity markers.

## Migration and representation switching

When multiple official schemas exist, test each adjacent migrator separately and test composed chains. The current initial version is 1.

Cover stepwise forward migration for split and embed, body preservation, preflight checks for all targets, skipping the current version, unknown versions, missing conversions, and downgrade rejection.

Representation switching covers split→embed, embed→split, committing configuration last, completed and incomplete items after intermediate failures, and no WAL append.

## rename

Cover name and path updates, unchanged results for repeated identical rename operations, WAL warnings, target conflicts, and reference scanning:

- `git_policy=track` scans Git-tracked project Markdown;
- `ignore` and `none` scan ordinary Markdown under task_root;
- Bodies in both split and embed participate;
- References are reported but not modified automatically;
- Dry-run with references succeeds and returns the complete plan;
- A path-moving execution with references stops with the stable error code `broken_reference_conflict`, category `conflict`, and exit status 3 before the first write, with `old_path`, normalized `new_name`, absolute `target_path`, and every reference path and line in the details;
- `--ignore-brokenlinks` lets the move complete, leaves reference files byte for byte unchanged, and keeps the references in the result;
- A path move without references completes. A non-generated child rename completes without moving its directory, and repeating an identical rename returns no change; neither returns `broken_reference_conflict`.

## check and GC

check tests cover fully valid projects, domain diagnostics, and fail-fast behavior for required I/O. After a required read fails, check must not continue producing an apparently complete diagnostic set.

GC tests cover:

- Version, process identity, time, and temporary paths in the minimal cleanup manifest;
- Content belonging to active processes is preserved;
- Content and markers belonging to exited processes are removed;
- Path escapes, symlinks, unknown manifests, and content that cannot be proven to belong to tk are preserved;
- Legacy cleanup formats from development are neither parsed nor migrated;
- Task, WAL, project configuration, and Harness configuration are not modified;
- Deletion errors report deleted and undeleted items.

## Tools and CLI

Generated contract tests cover the six MCP tools and Pi and OMP native tools, confirming names, fields, defaults, union types, and the OMP-specific `loadMode`.

CLI tests cover:

- Command tree, help, version, and text and JSON output;
- Separation of stdout and stderr;
- Current exit-code mapping;
- actor appears only in update, log, and rename;
- All default statuses for search;
- init force does not read Task data;
- Harness install defaults to tools mode and English, accepts all mode and language values, and reports the resolved Skill;
- Custom-root install requires explicit CLI mode and rejects tools mode;
- Install and uninstall require exactly one of Harness and Skill root;
- Component commands have no local source and reject global cwd;
- Unknown commands and options outside the current contract are rejected.

MCP tests cover initialize, list, six tool calls, cancellation, protocol stdout, and clean shutdown.

## Adapters

Unit and process tests for Pi and OMP cover:

- The fixed runtime is missing, is not a regular file, or lacks the execute bit;
- version and native schema decoding;
- Rust compatibility-range results without duplicating semver logic in TypeScript;
- Zero registrations when preflight fails;
- Registration stops after an intermediate registerTool failure, while the already registered prefix may remain;
- The entry point emits exactly one bounded error and exits normally;
- Pi does not set `loadMode`;
- OMP essential and discoverable classifications;
- cwd, actor, cancellation, direct process invocation, and output limits.

## Component assembly

Repeated builds must produce the same set of Harness payloads, two standalone CLI Skill payloads, file bytes, `tar.zst` bytes, and manifest. Validate target kind, Harness where applicable, mode, language, Skill identity, paths, permissions, digests, missing items, extra items, and `runtime_compat`.

Validate builds both with and without `TK_SOURCE_REVISION`. Build scripts must not invoke Git or write generated artifacts outside Cargo-managed directories.

## Installation and uninstallation

Isolated tests cover all Harness, mode, and language selections:

- install, update, selection switching, no_change, and uninstall;
- Embedded archives with no network or local sources;
- The resolved `mode`, `language`, and `skill` in text and JSON install results;
- Official Harness APIs take precedence;
- Tools-mode registration and CLI-mode absence of tk operation registration;
- The original file remains unchanged if shared configuration parsing fails;
- Only tk entries are removed from shared configuration;
- Uninstall completely removes active and known residual tk-specific directories, including modified and extra content;
- Unrelated Harness content and later modifications are preserved;
- Intermediate I/O failures report completed and incomplete items;
- GC cleans up only temporary component content and does not continue lifecycle operations.

Custom-root tests cover both standalone languages, relative and absolute roots, missing parent creation, complete payload convergence, language switching, dry-run, no_change, and uninstall. They prove that only `tk-cli` and `tk-cli-zh` are managed, unrelated children and the root remain, no Harness executable is required, and results contain `skill_root` instead of `harness`. Custom-root uninstall reports CLI mode and omits language and Skill.

## Real Harness validation

| Harness | Required validation |
| --- | --- |
| Codex | Real installation, loading, and uninstallation in an isolated environment |
| Claude Code | Real installation, loading, and uninstallation in an isolated environment |
| Pi | Real installation, loading, and uninstallation in an isolated environment |
| OMP | Real installation, loading, one real tool call, and uninstallation in an isolated environment |

Each Harness validates all four mode and language selections. OMP tools mode additionally performs the real operation call shown above.

Real tests must observe the Harness's actual loading result and post-uninstallation state. Checking assembled files alone is insufficient.

## Skill and documentation

Skill scenarios cover strict/permissive creation, planning/open selection, Task parsing, catchup, WAL, authorization for manual repair, close/reopen, five material modes, tools routing without direct CLI retry, and CLI-only command use.

Public documentation checks cover language links, semantic correspondence, terminology, and naturalness across the English and Chinese pages. Use existing repository checks and manual review without adding a custom documentation structure checker.
