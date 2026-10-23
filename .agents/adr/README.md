# Architecture decision records

English | [中文](./README.zh.md) | [Dictionary](../../docs/dictionary/adr.md)

Before creating, repairing, updating, reversing, archiving, or reviewing an ADR, or changing a durable choice in project work, load [maintain-adr](../skills/maintain-adr/SKILL.md). The Skill owns the main structure, lifecycle, writing rules, and maintenance operations. This page holds the repository's supplements and navigation.

## Project supplements

Use `.agents/adr/` as the ADR root. The Skill's `decision/` directory holds current decisions, and `archived/` holds decisions that took effect and were later replaced. Keep this README pair at the root and both directories in Git with `.gitkeep`, even when they contain records.

Read the [dictionary's ADR page](../../docs/dictionary/adr.md) for shared terms. Use the [documentation rules](../rule/documentation.md) for names and links, and the [development rules](../rule/development.md) for checks. Long-lived targets live under [.agents/spec/](../spec/README.md); load [maintain-spec](../skills/maintain-spec/SKILL.md) when the change affects them.

## Languages

Each ADR is one same-directory English and Chinese pair, `DD-name.md` and `DD-name.zh.md`. Archives use `DD-rN-name.md` and `DD-rN-name.zh.md` with identical identity dates and revision numbers.

The unsuffixed English file is the default public link. The Chinese file is the audit counterpart; both are semantically authoritative and move together. Either language may be drafted first, but both must be complete in the same change. A semantic conflict blocks merge until the maintainer resolves it. Put reciprocal language links immediately after the complete metadata block, with identical owner and writer fields and unchanged repository spellings for identifiers.

Translate topic titles into Chinese. Keep metadata keys, including `Decision owner`, `Decision writer`, `Reverses`, `Archived`, and `Reversed by`, in their repository spelling.

Use these Chinese equivalents for the Skill's sections:

- `Motivation`: `动机`.
- `Analysis`: `分析`.
- `Decision`: `决定`.
- `Alternatives considered`: `考虑过的替代方案`.
- `Consequences`: `结果`.
- `Changes`: `变更`.

Use only `None` in an empty English alternatives section and only `无` in its Chinese counterpart.

## Authority

The maintainer owns adoption of durable choices and archival of replaced decisions. Agents may draft and implement within authorized work, but need explicit authority for those decisions. Reuse an effective approval rather than requiring it again. A task status, Plan, review verdict, or completed implementation grants no approval, archival, integration, or task-closure permission.

Use the existing tk task for discussion, approval and its scope, ordinary rejected options, and pending execution. Public collaboration may use an accessible Issue or PR without requiring either platform. Keep the formal decision's necessary reasons and material rejected alternatives publicly understandable without private task records. A durable choice not to adopt an option may itself be a decision. A small or quick change that changes no durable choice needs no ADR.

## Integration

For a choice requiring implementation, integrate its formal decision with that implementation. A document-only choice may be integrated as a documentation change. Pending approved work stays in the task, and the current decision remains mainline authority until the replacement change is integrated. Follow the [Git rules](../rule/git.md) for worktrees, local commits, review, and separate merge permission.

When continued development is authorized, an implementation unit may start on a new branch from a verified, committed predecessor containing its dependencies before that candidate merges. Freeze the predecessor and keep each unit reviewable against its own base. This does not approve a choice, authorize archival, or grant integration permission by itself.

After implementation, form the required decisions and complete successors, update non-conflicting decisions, and archive replaced versions with their direct relationships in the same change. Preserve necessary public reasons in decisions and historical contracts in archives. Unadopted drafts do not enter the archive.

## Related ADRs

- [ADR mechanism](./decision/2026/08/22-adr-mechanism.md)
