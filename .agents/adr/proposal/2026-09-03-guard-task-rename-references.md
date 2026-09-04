# ADR proposal: Guard Task rename against broken references

Decision owner: Ruokee
Draft writer: Mind (OMP GPT-5.6 Sol)

English | [中文](./2026-09-03-guard-task-rename-references.zh.md)

## Motivation

Renaming a top-level or generated child Task changes its directory path when the normalized slug changes. A non-generated child keeps its directory and changes metadata only. For a path-moving rename, existing Markdown references can break as soon as the move commits, so tk should expose the normalized destination and every known old-path reference before changing the filesystem. The Agent can then repair those references while the source path is still part of the rename plan.

The [tk Task data model](../decision/2026-09-03-define-tk-task-data-model.md) already requires rename to scan Markdown references and report them without rewriting files. The runtime performs that scan for dry-run and execution, but human-readable CLI output does not show the reference list. Execution also proceeds when references exist. After a path move, current Task state contains the new path, so a later scan derived from that state cannot accurately reproduce the old-path reference list.

## Proposal

### Reference plan and output

Keep the current scan boundary:

- `git_policy=track` scans every Git-tracked `*.md` path across the project;
- `git_policy=ignore` and `none` recursively scan regular Markdown under `task_root`, skipping `wal`, `.tk-tmp`, and symlinks;
- split Task bodies participate;
- discovered embed Task bodies participate, but their managed frontmatter does not.

The scan continues to find occurrences of the old project-relative Task path. tk does not parse or rewrite Markdown links.

Both dry-run and execution keep the existing structured plan fields, including `old_path` and optional `parent_task`, and expose the normalized `new_name`, absolute `target_path`, and every reference path and line. Human-readable output prints the target path and reference list. JSON keeps the structured rename plan. An empty reference list does not produce an empty text section.

### Broken-link prevention by default

Before a non-dry-run rename that would move the Task path writes anything, stop the operation if references exist. Add `--ignore-brokenlinks` to permit that path move while leaving those references unchanged. The override does not suppress scanning or output. It has no effect on dry-run or a rename whose `target_path` equals `old_path`.

When this gate prevents the rename, return a stable structured error with conflict semantics and exit status 3. Its details contain at least `old_path`, normalized `new_name`, `target_path`, and the reference path and line list. Human-readable error output shows the same target and references and names `--ignore-brokenlinks` as the explicit override.

Dry-run always succeeds after a valid plan is built, including when references exist. A rename whose `target_path` equals `old_path`, including a metadata-only non-generated child rename or an unchanged request, also succeeds without applying the broken-link gate.

### Execution consistency

Keep the existing pre-commit plan rebuild. If the Task state, target path, or reference list changes before commit, return the existing stale-plan conflict and write nothing. The broken-reference check belongs to the shared Rust rename operation so direct CLI and `tk_exec rename` use the same rule.

Increment the CLI contract version when implementing the change. Task schema and component format versions remain unchanged.

## Alternatives considered

**Report references but continue by default.** Adding text output alone would make the current scan visible, but a path-moving execution could still leave broken paths unless every caller notices and interrupts the operation itself.

**Automatically rewrite references.** The current data-model decision rejected this because matching text can be unrelated, historical, or intentionally preserved. The rename operation should not take ownership of ordinary Markdown files.

**Apply the broken-link gate to dry-run.** This would make the preview command require an override even though it performs no write. A successful dry-run gives the caller the normalized destination and complete repair list before deciding whether to proceed.

## Acceptance criteria

1. Dry-run prints and returns the normalized name, absolute target path, and all detected reference paths and line numbers without changing files. Structured results retain the old path and resolved parent when one exists.
2. Normal execution that does not move the Task path, or moves it with no references, completes with the current rename, metadata, and WAL behavior.
3. A path-moving execution with references and without `--ignore-brokenlinks` prevents the path change and returns a conflict error with exit status 3 before the first persistent write.
4. The blocked result's text and JSON details include the target path and every detected reference.
5. A path-moving execution with `--ignore-brokenlinks` completes, leaves reference files unchanged, and still reports the reference list.
6. `git_policy=track`, `ignore`, and `none`, plus split and embed bodies, retain their current scan boundaries.
7. A path-moving rename does not parse Markdown structure, rewrite files, create an alias, or keep a compatibility path at the old location.
8. For a top-level or generated child Task, a requested name containing whitespace, separators, or discarded punctuation reports the target path derived from the normalized name.
9. A non-generated child rename keeps its directory and is not blocked by references to that unchanged path. Repeating an already completed rename returns no change under the same rule.
10. CLI, `tk_exec`, the `tk`, `tk-zh`, `tk-cli`, and `tk-cli-zh` Skills, public design documents, and tests describe the same gate and override spelling.
11. The implementation increments the CLI contract version without changing Task schema or component format versions.

## Risks

The scanner matches path text rather than Markdown syntax. A code example, historical note, or other intentional occurrence can block a path-moving rename even when it is not a navigable link. `--ignore-brokenlinks` provides the explicit escape for that case while preserving the evidence.

A large reference list increases human-readable and structured output. Existing process and protocol output limits still apply, so a project with enough matches can fail with the current bounded-output error instead of returning a truncated plan.
