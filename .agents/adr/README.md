# Architecture decision records

English | [中文](./README.zh.md) | [Dictionary](../../docs/dictionary/adr.md)

Before creating, repairing, updating, reversing, rejecting, archiving, or reviewing an ADR, or changing a durable choice in project work, load [maintain-adr](../skills/maintain-adr/SKILL.md). The Skill owns the main structure, lifecycle, writing rules, and maintenance operations. This page holds the repository's supplements and navigation.

## Project supplements

Use `.agents/adr/` as the ADR root and the Skill's `proposal`, `decision`, `rejected`, and `archived` layout. Keep this README pair at the root. Keep all four lifecycle directories in Git with `.gitkeep`, even when they contain records.

Read the [dictionary's ADR page](../../docs/dictionary/adr.md) for shared terms. Use the [documentation rules](../rule/documentation.md) for names and links, and the [development rules](../rule/development.md) for checks. Long-lived targets live under [.agents/spec/](../spec/README.md); load [maintain-spec](../skills/maintain-spec/SKILL.md) when the change affects them.

## Languages

Each ADR is one same-directory English and Chinese pair, `DD-name.md` and `DD-name.zh.md`. Archives use `DD-rN-name.md` and `DD-rN-name.zh.md` with identical identity dates and revision numbers.

The unsuffixed English file is the default public link. The Chinese file is the audit counterpart; both are semantically authoritative and move together. Either language may be drafted first, but both must be complete in the same change. A semantic conflict blocks merge until the maintainer resolves it. Put reciprocal language links immediately after the complete metadata block, with identical owner and writer fields and unchanged repository spellings for identifiers.

Translate topic titles into Chinese. Keep metadata keys, including `Draft owner`, `Draft writer`, `Decision owner`, and `Decision writer`, in their repository spelling.

Use these Chinese equivalents for the Skill's sections:

- `Motivation`: `动机`.
- `Analysis`: `分析`.
- `Proposal`: `提议`.
- `Decision`: `决定`.
- `Alternatives considered`: `考虑过的替代方案`.
- `Acceptance criteria`: `验收标准`.
- `Risks`: `风险`.
- `Consequences`: `结果`.
- `Changes`: `变更`.
- `Rejection reason`: `拒绝原因`.

Use only `None` in an empty English alternatives or risks section and only `无` in its Chinese counterpart.

## Authority

The maintainer owns approval, rejection, and decision archival. Agents may draft and implement within authorized work, but need explicit authority for those lifecycle decisions. Reuse an effective approval rather than requiring it again.

Confirm whether a new requirement needs a proposal. A small or quick change that changes no durable choice needs none. One requirement gets one proposal unless the maintainer requests another split.

## Integration

Review and commit a proposal separately from its implementation. Integration puts the approved proposal into `main` before the implementation through separate squash merges. Follow the [Git rules](../rule/git.md) for worktrees, local commits, and separate merge permission.

When continued development is authorized, an implementation unit may start on a new branch from the verified proposal candidate, or from a verified predecessor containing its dependencies, before those candidates merge. Freeze the predecessor and keep each unit reviewable against its own base. This does not approve a proposal, authorize archival, or grant integration permission by itself.

After implementation, form the required decisions and complete successors, update non-conflicting decisions, and remove the consumed proposal in the same implementation change. The independently committed proposal and its later mainline commit preserve its rationale.

## Related ADRs

- [ADR mechanism](./decision/2026/08/22-adr-mechanism.md)
