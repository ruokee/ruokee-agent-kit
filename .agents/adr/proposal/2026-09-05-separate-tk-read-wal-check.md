# ADR proposal: Separate tk read response limits from complete WAL checks

Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol

English | [中文](./2026-09-05-separate-tk-read-wal-check.zh.md)

## Motivation

`tk read` should return enough current information to help a caller understand a Task. The existing view semantics do not match that purpose. `summary` truncates the Task body to 2000 characters and uses a fixed five-entry, 4096-byte WAL budget. It returns the same `WalEntry` shape as `detailed`, which includes WAL entry bodies.

`detailed` accepts up to 1000 entries and 1048576 bytes of WAL output. The shared WAL reader separately limits its scan to 1024 files, 1048576 input bytes, and 1000 parsed entries. `tk check` passes `usize::MAX` for both budgets, but the reader still enforces those limits and reports `wal_truncated`. Once a Task has more than 1000 WAL entries, `tk check` validates only part of its history.

`tk read` and `tk check` need different resource rules. `tk read` must bound each response. `tk check` must inspect all valid WAL and report an incomplete check when it cannot finish. A reader that stops at response limits cannot satisfy both contracts.

## Proposal

### Define three read views

Keep `summary` as the default view. The supported views become `minimal`, `summary`, and `detailed`.

`minimal` returns Task metadata and managed paths. It does not read the Task body or WAL.

`summary` returns metadata, relationships, and the complete current Task body. Recent WAL entries include `timestamp`, `actor`, and `message`, but not `body`.

`detailed` adds `body` to the WAL entries returned by `summary`. The Task information is otherwise identical.

Replace `metadata` directly with `minimal` and do not retain a compatibility alias. Increase the CLI contract version from 2 to 3 so generated contracts and Harness adapters reject incompatible runtimes.

### Limit each tk read response

Keep the caller-selectable `wal_max_entries` and `wal_max_length` fields for `summary` and `detailed`. Both fields default to their maximum values: 50 entries and 16000 bytes. Accepted ranges are 0 through 50 and 0 through 16000. Callers may lower either limit but cannot raise either.

Project each WAL entry for the selected view before measuring it. Count the compact JSON UTF-8 bytes of the complete projected entry. `timestamp`, `actor`, and `message` always count; `body` counts only for `detailed`. Starting with the newest entry, include only complete entries that fit both limits. Return the selected entries in chronological order. The existing WAL truncation state indicates that stored history was omitted.

Do not add pagination, cursors, or a full-history mode to `tk read`. Complete history remains available in the ordinary `wal/YYYY-MM-DD.md` files. Agents that need it read those files directly.

### Stream the complete WAL during tk check

Give `tk check` a separate streaming WAL inspector. It scans every regular daily WAL Markdown file in deterministic order, reads each file to the end, and validates every entry. It does not retain the complete history in memory and imposes no fixed total file, byte, or entry limits on valid WAL.

WAL size alone must neither produce `wal_truncated` nor cause a partial scan to be reported as successful. A required I/O failure returns `check_incomplete` and identifies the failed path. Any other interruption also returns `check_incomplete`. Existing WAL format diagnostics continue to cover the complete input.

The bounded read path may stop after selecting enough recent entries. The read path and the complete inspector may share parsing logic, but `tk check` must not inspect WAL through the bounded response interface.

### Update public contracts and decisions

Update the CLI, generated tool schema, OMP and Pi adapters, design documents, and English and Chinese Skills in the same implementation change. The WAL guidance must distinguish recent Task context returned by `tk read` from complete history read from the daily WAL files.

After implementation, record this contract under `Changes` in both language versions of the [runtime and CLI decision](../decision/2026-08-28-define-tk-runtime-and-cli.md) and [Task data model decision](../decision/2026-09-03-define-tk-task-data-model.md), then remove this proposal. No current decision needs to be reversed.

## Alternatives considered

**Raise the shared WAL reader limits.** Larger constants would only postpone the failure. `tk check` would still depend on `tk read` response limits and would still materialize history that it can inspect incrementally.

**Add pagination or a full-history mode to `tk read`.** This would let callers traverse all WAL through the command, but the complete history already exists as ordinary daily Markdown files. Task understanding does not require another cursor or pagination contract.

## Acceptance criteria

1. `tk read` defaults to `summary` and accepts only `minimal`, `summary`, or `detailed`.
2. `minimal` returns metadata and managed paths without reading the Task body or WAL.
3. `summary` returns the complete current Task body and recent WAL entries without `body`. `detailed` returns the same Task information and includes WAL entry bodies when present.
4. `summary` and `detailed` accept `wal_max_entries` from 0 through 50 and `wal_max_length` from 0 through 16000, with defaults of 50 and 16000. They apply both limits after projecting entries for the selected view, include only complete entries, select from newest to oldest, and return the result in chronological order.
5. Truncation state reports history omitted by the read limits. `tk read` exposes no pagination, cursor, or full-history mode, and the English and Chinese guidance directs callers to daily WAL files for complete history.
6. `tk check` streams and validates every regular WAL Markdown file and every entry without fixed total file, byte, or entry limits. Valid history size alone never produces `wal_truncated`.
7. A required I/O failure returns `check_incomplete` with the failed path. Any other interrupted scan also returns `check_incomplete` instead of a successful partial result.
8. CLI parsing, JSON output, generated schemas, OMP and Pi adapters, design documents, Skills, and behavioral tests use the same view names, defaults, limits, returned WAL fields, and truncation rules. The CLI contract version is 3.
9. Behavioral tests prove that `summary` omits bodies, `detailed` includes bodies within both limits, values above either maximum are rejected, and `tk check` scans more than 1024 files, 1048576 bytes, and 1000 entries without truncation.
10. The implementation updates both affected bilingual decisions under `Changes`, removes this proposal, and does not reverse a current decision.

## Risks

Complete WAL checks take time proportional to stored history, so a large Task can make `tk check` much slower than `tk read`. Streaming avoids retaining all valid entries at once, but it cannot avoid reading them. I/O failures and interrupted scans must remain visible as `check_incomplete`.

The view rename and lower limits make CLI contract version 2 clients incompatible. Raising the contract version, regenerating every schema and adapter, and rejecting version mismatches prevents old clients from being treated as compatible.
