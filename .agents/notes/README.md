# Agent Notes

English | [中文](./README.zh.md)

An **Agent Note** is this repository's architecture decision record. `Agent Note` is the only document-type name used in repository paths, headings, instructions, and cross-references. `ADR` may appear only when explaining the concept to readers who know the generic term.

Agent Notes preserve why a durable decision exists, what alternatives lost, and what would count as success or failure. They are not progress logs, implementation plans without a chosen direction, release notes, or summaries of routine changes.

## When to write one

Create or update an Agent Note when a decision has real alternatives and changes one of these long-lived boundaries:

- architecture or package ownership;
- a public, host, storage, or distribution contract;
- a persisted format or compatibility rule;
- repository-wide development, validation, or release process.

Do not create one for a local bug fix, mechanical refactor, ordinary documentation update, status report, or temporary plan unless that work changes one of those boundaries.

Search active notes before creating a new one. Update the note that already owns the decision. If a new decision reverses or replaces it, create a new note and cross-link both rather than rewriting history.

## Location and lifecycle

The path encodes lifecycle state:

```text
.agents/notes/proposed/yyyy-mm-dd-topic-title.md
.agents/notes/implemented/yyyy-mm-dd-topic-title.md
.agents/notes/rejected/yyyy-mm-dd-topic-title.md
.agents/notes/archived/yyyy-mm-dd-topic-title.md
```

- `proposed` records a decision the maintainer has not accepted.
- `implemented` records an accepted decision that the repository implements and still treats as current.
- `rejected` preserves a declined proposal only while its rationale prevents a plausible mistake.
- `archived` preserves an implemented decision that is no longer current or useful for active maintenance.

The filename date is when the topic was first proposed and does not change during lifecycle moves. Use a short English slug. Do not add classification subdirectories or a central index until the active tree becomes difficult to search.

The maintainer owns lifecycle decisions. An Agent may draft a `proposed` note within an authorized change. Moving a note to `implemented`, `rejected`, or `archived` requires the maintainer's explicit approval.

When a lifecycle directory contains no documents, keep it present with `.gitkeep`.

## Bilingual files

Each logical Agent Note is one same-directory pair:

```text
yyyy-mm-dd-topic-title.md
yyyy-mm-dd-topic-title.zh.md
```

The unsuffixed file is English and is the default public link. The `.zh.md` file is the Chinese audit copy. Both are semantically authoritative; neither may omit rationale, alternatives, criteria, risks, or consequences present in the other.

Authors may start in either language. Both files must be complete and reviewed in the same change. An external contributor may provide English first, but the pair must be completed before merge. A semantic conflict blocks the change until the maintainer resolves it.

Use reciprocal language links immediately below the metadata block. Keep status values, paths, commands, API names, and code identifiers in their original English form.

## Fixed format

Every note starts with the matching language block.

`## Motivation` (Chinese `## 动机`) opens the body of new notes written under the current format. It records why the decision is being considered and may describe an observed problem, a requirement, a desired capability, or another concrete reason for change. The neutral name does not weaken the expectation that the section state the reason precisely.

English file:

```markdown
# Agent Note: <title>

Status: <proposed|implemented|rejected|archived>
Decision owner: <name>
Draft writer: <writer>

English | [中文](./<filename>.zh.md)
```

Chinese file:

```markdown
# Agent Note: <中文标题>

Status: <proposed|implemented|rejected|archived>
Decision owner: <name>
Draft writer: <writer>

[English](./<filename>.md) | 中文
```

`Decision owner` names the maintainer accountable for the decision. `Draft writer` records who produced the original draft and does not change when later editors maintain the note. It is usually a concrete Agent name; use the specific Agent identifier when known rather than a generic `Agent` label.

The Chinese counterpart translates the title and language link text, but keeps `# Agent Note:`, `Status:`, the status value, `Decision owner`, `Draft writer`, and both field values unchanged.

### Proposed

English body:

```markdown
## Motivation
## Proposal
## Alternatives considered
## Acceptance criteria
## Risks
```

Chinese body:

```markdown
## 动机
## 提议
## 考虑过的替代方案
## 验收标准
## 风险
```

### Implemented

English body:

```markdown
## Motivation
## Decision
## Alternatives considered
## Consequences
```

Chinese body:

```markdown
## 动机
## 决定
## 考虑过的替代方案
## 结果
```

When an implemented decision receives a later material refinement, add `## Changes` to the English file and `## 变更` to the Chinese file as the final section, after `## Consequences` or `## 结果`. Record each refinement under a dated level-three heading:

English changes:

```markdown
## Changes

### YYYY-MM-DD: <summary>
```

Chinese changes:

```markdown
## 变更

### YYYY-MM-DD：<摘要>
```

### Rejected

Keep the proposed structure.

English addition:

```markdown
## Rejection reason
```

Chinese addition:

```markdown
## 拒绝原因
```

A rejected note is frozen after the verdict and factual link repairs.

### Archived

Only an implemented note may be archived. Change its status to `archived`, add `Archived: YYYY-MM-DD` below the owner line, and then freeze both files. Active documentation must not cite an archived note as current authority.

## Additional headings

When a required section contains substantial content, use descriptive level-three headings to organize it. For example, a long `## Proposal` may contain `### Location`, `### Lifecycle`, and `### Format`.

Level-three headings remain inside their parent section. Do not insert headings before `## Motivation`, replace required level-two headings, or use subsections for progress history and copied implementation inventories.

## Maintenance

Keep an `implemented` note current when factual paths, names, or verification entry points move. Do not use factual maintenance to reverse the decision. A reversal requires a new note that identifies the old note as superseded; the old note links back to its replacement.

Move both language files together during every lifecycle transition and update inbound links in the same change. Delete a rejected note only when its rationale no longer prevents a realistic mistake, and delete both language files together.

The first version uses review and Git history rather than a dedicated Skill, classification system, hash sidecar, archive manifest, or custom checker. Add the smallest mechanical check after a repeated maintenance action or a real drift failure shows what needs enforcement.
