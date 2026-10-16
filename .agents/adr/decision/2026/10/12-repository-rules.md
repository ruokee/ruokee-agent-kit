# Repository rules

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash

English | [中文](./12-repository-rules.zh.md)

## Motivation

State the repository's working rules in a bilingual layer under `.agents/rule/`, beside specifications and ADRs, so that one normative statement has one owning layer.

The repository had a document type for what each component and area should be and one for why a durable choice was made, and neither owned how work is done here. Commit, branch, worktree, validation, and documentation rules sat in the root `AGENTS.md`, which also carried repository positioning and navigation, and the Invariants of the [repository spec](../../../../spec/repository.md) mixed constraints on actions with properties of the delivered repository. The [spec rules](../../../../spec/README.md) named the gap themselves: their division of work gives the repository documentation and the README the job of telling contributors how to work and `AGENTS.md` the job of navigation and non-trivial rules, and no page owned the working rules themselves. The [ADR rules](../../../README.md) cannot hold it, because a rule has no alternatives or consequences to record.

## Analysis

A normative statement in this repository falls into five kinds. A statement that can be checked from the deliverable alone is a spec invariant: repository file links are relative to their containing document, ordinary public pages come in language pairs, and Prettier formats all tracked Markdown. A statement that constrains an action, a step, an order, a permission, or a prohibition is a rule: commit, merge, push, and branch deletion are separate authorizations, development checks run before review, and the complete check runs on the final candidate. A statement that records a choice, its alternatives, and its consequences is a decision. Instructions for installing and using a component are component documentation. Entry points and the non-trivial rules that must hold without further reading belong to `AGENTS.md`, and each of those rules keeps its owning page in this layer.

The same constraint often appears in two forms, which is not duplication: the spec says a commit message is an English Conventional Commit whose scope comes from a fixed set, while the rule says when to run the formatting hook, which files belong to the current task, and which authorization each Git action needs. Only two layers stating the same thing is duplication, and this layer removes that.

The following current decisions bear on the layer, and none of them conflicts with it:

- [Add a specification layer](./04-specifications.md) recorded the division of work for specs, ADRs, and component documentation and left contributor instructions to the repository documentation, the README, and `AGENTS.md`. This decision adds a fourth document type to that division and reverses no part of it.
- [Clarify the ADR content boundaries](../08/22-adr-mechanism.md) keeps ADR content rules, lifecycle, and glossary unchanged. A rule keeps no history, so it cannot replace a contract that a decision records.
- [Keep distributable components self contained](../08/24-component-self-containment.md) forbids references from inside a component to files outside it. The rule layer is repository documentation outside component directories, and the reference direction keeps every component independent of it.
- [Colocate bilingual public documentation](../08/20-bilingual-docs.md) requires same-directory language pairs for ordinary public pages, and rule pages follow it.
- [Scope development checks](../09/12-repository-checks.md) defines how affected checks are selected and how the complete gate is recorded. Rules state when those checks run and what evidence they leave.
- [Review authorization](../09/06-review-authorization.md) keeps a review request from authorizing edits to the reviewed files, and the Git rules state it for branch work.

## Decision

### Ownership

`.agents/rule/` carries the repository's working rules, and the [layer's entry page](../../../../rule/README.md) defines the layer. Its directory name is singular like `spec`.

One normative statement has one owning layer, and the [spec layer](../../../../spec/README.md#division-of-work) states how specs, decisions, rules, component documentation, the repository documentation, and `AGENTS.md` divide their work. A rule `AGENTS.md` states keeps its owning page in this layer, and a change updates both texts.

### Files

The [rule layer's entry page](../../../../rule/README.md#file-layout) owns the rule file layout, the naming of a rule file, and the current activity list. `.agents/adr/` uses subdirectories to express a record's lifecycle state, while a rule is a current constraint edited in place that keeps no history.

### Writing a rule

The [rule layer's entry page](../../../../rule/README.md#writing-a-rule) owns how a single rule is written, traced to a source, and cited.

### Editing

The [rule layer's entry page](../../../../rule/README.md#editing-a-rule) owns how a rule is edited, when a rule change goes through the ADR process, and what a rule file keeps out.

### Reference direction

The [rule layer's entry page](../../../../rule/README.md#reference-direction) owns the reference direction and the layer's status as explanatory documentation.

### What moves

The root `AGENTS.md` gives up the long text of its working rules and keeps repository positioning, per-activity navigation, and the non-trivial rules that every change keeps in view, linking the rule page that owns each complete statement. The [repository spec](../../../../spec/repository.md) gives up its working-procedure statements and keeps the properties of the delivered repository, its acceptance results, and every requirement the migration does not touch, linking the page that owns a moved detail. The [root README](../../../../../README.md) gives up the procedure paragraphs that restate `AGENTS.md` and keeps its contributor-facing overview, its layout section, and its links to the layers.

The layer has no spec of its own: the repository spec carries the rule layer's goals, boundaries, and acceptance, because the area this layer describes is the repository itself. A rule that holds on one machine only, that names the device's model, provider, endpoint, or absolute path, or that carries a personal working preference stays out of the layer and out of tracked files. The same applies to a working convention that exists only outside Git, such as how task state and task materials are kept. Component-internal rules stay with the component: the instructions in a `SKILL.md` are the product delivered to a host, not a repository rule. The first delivery also covers repository working rules that already applied and had no owning document, so its source is the repository's publishable working rules rather than a file list.

### Reading the rules

The layer [README](../../../../rule/README.md) states the layer's definition, its file layout, how a single rule is written, editing a rule, the reference direction, and this decision, and it indexes the rules by activity. `AGENTS.md` states where the layer is, links its entry the way the ADR and spec entry points are linked, carries the navigation and the non-trivial rules, and states at the strength of "as far as possible" that validation and evaluation work reads the applicable rules. A host injects `AGENTS.md` at the start of a session, while a rule page is read only when a reader chooses to open it, so a rule page may never arrive and a committed compaction can drop what a session already read; `AGENTS.md` therefore repeats the rules a change applies most often and the rules a reader is least likely to think of loading. Reading stays on demand for the remaining rules: no host injection mechanism and no requirement to load every rule is added.

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
