# ADR proposal: Allow closed Task rename and file system reference scanning

Decision owner: Ruokee
Draft writer: deepseek/deepseek-v4.1-flash

English | [中文](./2026-09-10-allow-closed-rename-filesystem-scan.zh.md)

## Motivation

[The current data model decision](../decision/2026-09-08-repair-names-through-tk-rename.md) makes rename responsible for repairing damaged names and generated directory suffixes, and it makes a closed Task read-only. Those two rules combine into a dead end: rename refuses a closed Task, and reopen cannot run because strict loading rejects the damaged old name before the lifecycle branch is reached. A closed Task with a damaged name has no public recovery path, and `check` can only keep reporting the damage without repairing it.

The same decision makes the `track` reference scan enumerate Git-tracked Markdown from the index. A Markdown file that exists in the working tree but has not been added to the index is never scanned, and an index entry whose file is missing from the working tree fails the whole scan before dry-run or execution can proceed. Reference reporting should describe the files a user actually keeps, not the staging state of the working tree.

Reopening is a lifecycle change with its own reason and authorization requirements. Restoring a name is maintenance: UUID is identity and the name is a mutable description. A closed Task should get the same name maintenance as any other Task without changing lifecycle state.

## Proposal

### Allow rename for closed Tasks

`tk rename` and `tk_exec rename` accept a closed Task through the same exact reference forms as any other Task. An ordinary name change, a repair of an existing string name, and a repair of a recognizable generated directory suffix are all allowed, and the Task stays closed after the operation. No new argument or confirmation flag is added, and no temporary reopen is required.

The repair scope is unchanged: string names that are noncanonical, empty, empty after normalization, or wider than the current display limit, and recognizable generated suffixes that disagree with metadata. Everything outside that scope keeps its strictness: missing names, wrong field types, unparseable carriers, missing markers, unsupported schemas, damaged identity, unsafe paths, and unrecognizable generated structures remain errors. The new name and the final path keep full validation. Existing write protections keep their behavior: target conflicts, Git policy, activity markers, and the current-state recheck before the write.

`update` and reopen keep their strict name loading. rename is the recovery path; once it has restored a canonical name, reopen works again for a closed Task that needs further edits.

### Keep reference scanning and broken-reference protection aligned

Every rename builds a plan that scans and reports Markdown references, including a rename that only changes metadata without moving the path and one that resolves to no change at all. dry-run and execution results both carry the reference list, and rename never rewrites references.

Broken-reference protection keeps its current condition: an execution that would move the Task path, finds references to the old path, and receives no `--ignore-brokenlinks` stops with `broken_reference_conflict` before the first write. A rename that does not move the path never triggers that rejection. `--ignore-brokenlinks` still permits a move without touching reference files, and both the error details and the success result still list every reference.

### Enumerate reference candidates from the file system

Reference candidates come from a directory walk over the actual file system:

- With `git_policy=track`, ordinary Markdown across the project.
- With `ignore` or `none`, ordinary Markdown under the Task root.

The walk reuses the current traversal order and safety rules: symbolic links, tk-owned runtime paths (WAL directories and `.tk-tmp`), and the Git administrative directory are excluded, and a fixed resource limit fails the request explicitly instead of returning a partial list. A file that is already gone when the scan runs is never a candidate, so a stale index entry cannot fail the request. A present Markdown file participates whether or not it is tracked, so staging and commit state do not change the result.

Required I/O failures during the walk or during reads stay explicit errors. A dry-run or an `--ignore-brokenlinks` request must not report a successful scan when part of it could not be completed.

Git policy keeps its current scope and timing: it runs only before persistent writes, checks the project root as a whole (`track` requires managed Task files not to be ignored, `ignore` requires the Task root to be ignored, `none` invokes no Git command), and does not select reference candidates per directory or file. Reads and dry-run run no policy checks.

### Correct the current contracts

This proposal conflicts with two rules in the [current data model decision](../decision/2026-09-08-repair-names-through-tk-rename.md): the closed read-only rule and the Git-tracked `track` scan source. Both are reversed through the ADR process. The decision's remaining rules stay in force: the repair scope, exact reference forms, preserved fields and WAL append, target and policy checks, dry-run semantics, and reference reporting without rewriting.

The replacement decision must carry the still-effective rules of the current decision, including its update entries. Current decisions remain unchanged during the proposal stage.

## Alternatives considered

**Require reopening before rename.** This keeps the closed read-only rule intact but cannot serve as a recovery path: reopen requires the damaged name to load under strict validation, which is the defect being repaired. It also turns name maintenance into a lifecycle transition with reason and authorization requirements that change no lifecycle fact.

**Limit closed rename to damaged-name repair.** This would keep ordinary name corrections rejected for closed Tasks. Distinguishing repair from ordinary rename would add a second classification of the same request while still blocking a legitimate correction, and the maintenance value of a canonical name does not depend on why the old one was wrong.

**Keep Git index enumeration and tolerate missing files.** Skipping entries whose files are gone would remove the failure, but the scan would still miss present untracked Markdown and would still depend on staging state. Querying Git per directory or per path keeps the same dependence for every candidate.

## Acceptance criteria

1. A closed Task can be renamed through the CLI and `tk_exec rename` in split and embed. An ordinary name change and a repair of a damaged name or generated suffix both succeed, the Task stays closed, and UUID, status, body, relationships, `extra`, creation time, existing WAL, date, sequence, and parent location are unchanged. dry-run writes nothing.
2. A generated directory suffix repair on a closed Task moves the directory to the repaired slug while identity and parent ownership stay unchanged, and the broken-reference behavior of the move matches every other Task.
3. Every rename request scans and reports references, including metadata-only changes and no-op requests. A no-op returns `changed: false`, reports the scanned references, and writes nothing.
4. Reference candidates follow the file system. `track` reports references from present Markdown across the project; `ignore` and `none` report from the Task root. A file deleted before the scan does not fail the request, a present untracked Markdown file participates, and staging or commit state does not change the result.
5. Broken-reference protection is unchanged: a path-moving execution with references and no `--ignore-brokenlinks` stops with `broken_reference_conflict` before the first write; dry-run reports the plan without writing; `--ignore-brokenlinks` completes the move and leaves reference files byte for byte unchanged.
6. A required I/O failure during a scan (permission, encoding, or a file that disappears mid-scan) is reported explicitly. Dry-run and `--ignore-brokenlinks` never turn an incomplete scan into a reported success.
7. Existing safety checks still reject unsafe renames: duplicate UUIDs, wrong field types, damaged relationships, unsafe paths, target conflicts, and Git policy failures keep their current behavior.
8. `update` and reopen keep strict name validation, and the CLI and exec keep their current arguments, result shape, and contract version.

## Risks

Renamed closed Tasks move finished work. References outside the scanned scope, such as other projects, exported documents, or non-Markdown files, are not reported, so a broken external link can go unnoticed while the Task still looks stable.

The wider file system walk can pick up generated or unrelated Markdown. A build artifact that happens to contain the old path string can trigger `broken_reference_conflict` for a legitimate move, pushing callers toward `--ignore-brokenlinks` and weakening the protection that flag bypasses.

Projects with large vendor or generated Markdown trees scan more content than index enumeration did. Crossing the fixed resource limit fails the request, so rename can become unavailable in such projects until the tree shrinks.
