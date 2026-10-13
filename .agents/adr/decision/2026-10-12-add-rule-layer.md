# ADR decision: Add a rule layer

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash

English | [中文](./2026-10-12-add-rule-layer.zh.md)

## Motivation

State the repository's working rules in a bilingual layer under `.agents/rule/`, beside specifications and ADRs, so that one normative statement has one owning layer.

The repository had a document type for what each component and area should be and one for why a durable choice was made, and neither owned how work is done here. Commit, branch, worktree, validation, and documentation rules sat in the root `AGENTS.md`, which also carried repository positioning and navigation, and the Invariants of the [repository spec](../../spec/repository.md) mixed constraints on actions with properties of the delivered repository. The [spec rules](../../spec/README.md) named the gap themselves: their division of work gives the repository documentation and the README the job of telling contributors how to work and `AGENTS.md` the job of navigation and non-trivial rules, and no page owned the working rules themselves. The [ADR rules](../README.md) cannot hold it, because a rule has no alternatives or consequences to record.

## Analysis

A normative statement in this repository falls into five kinds. A statement that can be checked from the deliverable alone is a spec invariant: repository file links are relative to their containing document, ordinary public pages come in language pairs, and Prettier formats all tracked Markdown. A statement that constrains an action, a step, an order, a permission, or a prohibition is a rule: commit, merge, push, and branch deletion are separate authorizations, development checks run before review, and the complete check runs on the final candidate. A statement that records a choice, its alternatives, and its consequences is a decision. Instructions for installing and using a component are component documentation. Entry points and the non-trivial rules that must hold without further reading belong to `AGENTS.md`, and each of those rules keeps its owning page in this layer.

The same constraint often appears in two forms, which is not duplication: the spec says a commit message is an English Conventional Commit whose scope comes from a fixed set, while the rule says when to run the formatting hook, which files belong to the current task, and which authorization each Git action needs. Only two layers stating the same thing is duplication, and this layer removes that.

The following current decisions bear on the layer, and none of them conflicts with it:

- [Add a specification layer](./2026-10-04-add-spec-layer.md) recorded the division of work for specs, ADRs, and component documentation and left contributor instructions to the repository documentation, the README, and `AGENTS.md`. This decision adds a fourth document type to that division and reverses no part of it.
- [Clarify the ADR content boundaries](./2026-09-23-clarify-adr-content-boundaries.md) keeps ADR content rules, lifecycle, and glossary unchanged. A rule keeps no history, so it cannot replace a contract that a decision records.
- [Keep distributable components self-contained](./2026-08-24-keep-components-self-contained.md) forbids references from inside a component to files outside it. The rule layer is repository documentation outside component directories, and the reference direction keeps every component independent of it.
- [Colocate bilingual public documentation](./2026-09-07-colocate-bilingual-docs.md) requires same-directory language pairs for ordinary public pages, and rule pages follow it.
- [Scope development checks](./2026-09-30-scope-aware-repository-checks.md) defines how affected checks are selected and how the complete gate is recorded. Rules state when those checks run and what evidence they leave.
- [Review authorization](./2026-09-06-review-authorization.md) keeps a review request from authorizing edits to the reviewed files, and the Git rules state it for branch work.

## Decision

### Ownership

`.agents/rule/` carries the repository's working rules: what a contributor or an Agent must do, in what order, with which permission, and what is forbidden. It sits beside `.agents/spec/` and `.agents/adr/`, and its directory name is singular like `spec`.

One normative statement has one owning layer. A spec states what a subject should be and which observable result shows that it meets its target; a decision records a durable choice, its reasons, and its consequences; a rule states the constraint that binds an action; component documentation tells users how to install and use the component; the repository documentation and the README tell contributors how to work in the repository; `AGENTS.md` carries navigation and the non-trivial rules that must hold when no rule page is read. A rule `AGENTS.md` states keeps its owning page in this layer, and a change updates both texts. A rule carries no long rationale: when a reader needs the reason, the rule links the decision that owns it or the spec that owns the property it enforces.

### Files

Rules sit flat in one directory, one file per activity, as same-directory `name.md` and `name.zh.md` pairs with reciprocal language links directly below the title. The layer's own rules are `README.md` and `README.zh.md`. A rule file carries no date, no status, and no subdirectory: `.agents/adr/` uses subdirectories to express a record's lifecycle state, while a rule is a current constraint edited in place that keeps no history.

The first delivery covers repository boundary, planning, Git, validation, and documentation. The set follows the activities and changes when a real activity needs a page, so the count is a delivery list rather than a closed collection.

### Writing a rule

One rule states one constraint in the imperative and may add one short sentence. Rules are not numbered, and a citation uses the file path and the section heading, because a number becomes an inventory that someone has to maintain and this layer adds no manifest. A rule traces to a spec invariant, a current decision, or the maintainer's explicit decision; a rule without such a source is allowed when it is the current practice, and it must not conflict with a spec or a current decision. A rule keeps its original condition, exception, strength, and permission, so a rule stated at the strength of "as far as possible" stays at that strength, and a prohibition keeps its exception.

### Editing

A rule that adds, removes, or changes a durable choice it carries, such as an authorization boundary, a process requirement, or a release policy, goes through the ADR process before the rule changes; an editorial clarification that changes no durable choice does not. Rules are edited in place and carry no history, no status, no review notes, no task information, and no session information.

### Reference direction

References run one way. A rule may link to component files, component documentation, specs, and decisions. No file inside a distributable component links to, names a path in, or depends on `.agents/rule/`, and running, building, or distributing a component does not depend on the layer. Rules are explanatory documentation: the Markdown checks and the changed-path selector treat them like other Markdown, and the layer adds no checker, classification system, or manifest.

### What moves

The root `AGENTS.md` gives up the long text of its working rules and keeps repository positioning, per-activity navigation, and the non-trivial rules that every change keeps in view, linking the rule page that owns each complete statement. The [repository spec](../../spec/repository.md) gives up its working-procedure statements and keeps the properties of the delivered repository, its acceptance results, and every requirement the migration does not touch, linking the page that owns a moved detail. The [root README](../../../README.md) gives up the procedure paragraphs that restate `AGENTS.md` and keeps its contributor-facing overview, its layout section, and its links to the layers.

The layer has no spec of its own: the repository spec carries the rule layer's goals, boundaries, and acceptance, because the area this layer describes is the repository itself. A rule that holds on one machine only, that names the device's model, provider, endpoint, or absolute path, or that carries a personal working preference stays out of the layer and out of tracked files. The same applies to a working convention that exists only outside Git, such as how task state and task materials are kept. Component-internal rules stay with the component: the instructions in a `SKILL.md` are the product delivered to a host, not a repository rule. The first delivery also covers repository working rules that already applied and had no owning document, so its source is the repository's publishable working rules rather than a file list.

### Reading the rules

The layer [README](../../rule/README.md) states the layer's definition, its file layout, how a single rule is written, editing a rule, the reference direction, and this decision, and it indexes the rules by activity. `AGENTS.md` states where the layer is, links its entry the way the ADR and spec entry points are linked, carries the navigation and the non-trivial rules, and states at the strength of "as far as possible" that validation and evaluation work reads the applicable rules. A host injects `AGENTS.md` at the start of a session, while a rule page is read only when a reader chooses to open it, so a rule page may never arrive and a committed compaction can drop what a session already read; `AGENTS.md` therefore repeats the rules a change applies most often and the rules a reader is least likely to think of loading. Reading stays on demand for the remaining rules: no host injection mechanism and no requirement to load every rule is added.

## Alternatives considered

**Name the layer `standard` instead of `rule`.** Considered while choosing the layer name. Standards literature and several document taxonomies pair a third layer with ADRs under "standards", which reads as a published document set for readers outside the team.

**Write the rules into a single root `RULES.md` file.** Considered while choosing where the layer lives. One file is easy to find, but it cannot carry a language pair per topic, and every activity would be edited through the same file, which does not fit the repository's documentation layout.

**Keep the working rules in the root `AGENTS.md` and add no layer.** Considered as the existing arrangement. It needs no new document type, but `AGENTS.md` carries navigation, positioning, and rules together, the repository spec duplicates several of them in another form, and no page owns a rule as its subject.

**Number the rules and maintain an inventory.** Considered while choosing how a rule is cited. A number and a manifest make a rule easy to reference from a checklist, but the repository keeps no such list for its ADRs or specs, and the number would need maintenance on every rule added or removed.

## Consequences

One page per activity states the current constraint that binds an action, and `AGENTS.md` and the layer README index those pages, so a contributor or an Agent can find the rule that governs a step and its related spec and decision.

Rules that leave `AGENTS.md` no longer arrive with the instructions a host injects at the start of a session, so an agent can act without reading a detail that binds its work. `AGENTS.md` repeats the rules a change applies most often and the rules a reader is least likely to think of loading, and the remaining detail stays on demand: navigation entries, the per-activity index, and the request in `AGENTS.md` to read the applicable rules bound this, but nothing enforces it.

A rule can lose a condition, an exception, or a permission while moving, and the resulting text then allows or forbids the wrong thing, for example by dropping the statement that a review request does not authorize edits to the reviewed files, or by turning "as far as possible" into a requirement. A recorded disposition for every moved rule and a reviewer's comparison against the source text are the guard.

`AGENTS.md` and a rule page state the same constraint for the resident rules, and a later edit that updates one of them leaves the other describing an older rule. `AGENTS.md` repeats only the rules a change applies most often and the rules a reader is least likely to load, and reviewers compare the two texts, because nothing checks them mechanically.

The repository spec can lose a requirement that is not a working procedure while its procedure statements are removed, such as the commit scope set, the bilingual pairing rule, or an acceptance criterion. A recorded disposition for every source item keeps unrelated requirements traceable.

The changed-path selector can classify a rule-only change wrongly, or a widened pattern can stop routing shared inputs and unknown paths to the complete check, so a branch is recorded as documentation-only while it changes a shared input. The selector regression tests cover the new path.

An English rule and its Chinese pair can drift, so the two authoritative texts disagree about a constraint and readers of each language follow a different rule. Both files change together and review compares meaning, because the format check cannot see a semantic difference.
