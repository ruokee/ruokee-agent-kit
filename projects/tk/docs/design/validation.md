# Validation

[简体中文](./validation.zh.md)

This page defines the observable contracts that must be proven when implementing the current tk contract. Validation does not replace the design and must not weaken the contract for implementation convenience.

## Repository boundaries

Validate the following static facts:

- One Cargo package produces the `tk` executable;
- Rust is the only component assembler;
- Components have exactly one Rust-based assembly path;
- All sixteen Harness, mode, and language payloads are self-contained and do not reference other component directories;
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
- References are reported but not modified automatically.

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
- install defaults to tools mode and English, accepts all mode and language values, and reports the resolved Skill;
- install has no local source;
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

Repeated builds must produce the same sixteen component payloads, file bytes, `tar.zst` bytes, and manifest. Validate Harness, mode, language, Skill identity, paths, permissions, digests, missing items, extra items, and `runtime_compat`.

Validate builds both with and without `TK_SOURCE_REVISION`. Build scripts must not invoke Git or write generated artifacts outside Cargo-managed directories.

## Installation and uninstallation

Isolated tests cover all sixteen Harness, mode, and language selections:

- install, update, selection switching, no_change, and uninstall;
- Embedded archives with no network or local sources;
- The resolved `mode`, `language`, and `skill` in text and JSON results;
- Official Harness APIs take precedence;
- Tools-mode registration and CLI-mode absence of tk operation registration;
- The original file remains unchanged if shared configuration parsing fails;
- Only tk entries are removed from shared configuration;
- Uninstall completely removes active and known residual tk-specific directories, including modified and extra content;
- Unrelated Harness content and later modifications are preserved;
- Intermediate I/O failures report completed and incomplete items;
- GC cleans up only temporary component content and does not continue lifecycle operations.

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
