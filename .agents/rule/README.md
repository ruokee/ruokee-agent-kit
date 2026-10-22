# Rules

English | [中文](./README.zh.md)

Rules state how work is done in this repository: what a contributor or an Agent must do, in what order, with which permission, and what is forbidden. The layer lives in `.agents/rule/`, beside [specifications](../spec/README.md) and [ADRs](../adr/README.md).

When a reader needs the reason behind a rule, the rule links the decision that owns it or the spec that owns the property it enforces.

The [spec maintenance Skill](../skills/maintain-spec/SKILL.md) and [ADR maintenance Skill](../skills/maintain-adr/SKILL.md) own their main document methods. This layer supplies cross-cutting rules and navigation; the spec and ADR READMEs supply project-specific supplements.

## Rules by activity

- [boundary.md](./boundary.md) covers first-party scope, content layout, public content, and component versions.
- [git.md](./git.md) covers branches, working directories, commits, authorizations, merges, and teardown.
- [development.md](./development.md) covers planning, environments, hooks, checks, and evidence.
- [documentation.md](./documentation.md) covers documents, specs, decisions, bilingual pairs, naming, cleanup, and file references.
- [terminology.md](./terminology.md) covers canonical terms, component glossaries, dictionary entries, and language pairs.

## File layout

- Keep rules flat in `.agents/rule/`, one activity per file, with no subdirectory, date, or status in a name.
- Pair every page as `name.md` and `name.zh.md`, and use `README.md` and `README.zh.md` for this entry page.
- Grow the set of activities with real needs. The pages listed above are not a closed set.

## Writing a rule

- State one constraint per rule in the imperative, and add at most one short sentence that explains it.
- Trace a rule to a spec invariant, a current decision, or the maintainer's explicit decision. A rule without that source is allowed when it is the current practice, and it must not conflict with a spec or a current decision.
- Keep a rule's original condition, exception, strength, and permission. A rule stated as "as far as possible" keeps that strength, and a prohibition keeps its exception.
- Cite a rule by its file path and section heading. Do not number rules.
- Keep long rationale, rule numbers, and inventories out of this layer. Link the decision or the spec that owns the reason instead.

## Editing a rule

- Edit a rule in place. Rules keep no history, no status, and no revision record.
- Keep rules stated in both `AGENTS.md` and a rule page aligned in the same change, whichever file is edited first.
- Run the ADR process before changing a rule that adds, removes, or changes a durable choice it carries, such as an authorization boundary, a process requirement, or a release policy. An editorial clarification that changes no durable choice needs no ADR.
- Keep task information, review notes, and session information out of a rule file.

## Reference direction

- Link component files, component documentation, specs, and decisions from a rule.
- Keep every path inside `.agents/rule/` out of a distributable component. A component must not link to, name a path in, or depend on this layer, and running, building, or distributing it must not depend on the layer.
- Treat rules as explanatory documentation. The Markdown checks and the changed-path selector handle them like other Markdown, and the layer adds no checker, classification system, or manifest.

## Related ADRs

- [Repository rules](../adr/decision/2026/10/12-repository-rules.md)
