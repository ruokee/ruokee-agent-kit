# Repository rules

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash
Reverses: [Repository rules](../../../archived/2026/10/12-r1-repository-rules.md)

English | [中文](./12-repository-rules.zh.md)

## Motivation

State the repository's working rules in a bilingual layer under `.agents/rule/`, beside specifications and ADRs, so that one normative statement has one owning layer.

The repository had a document type for what each component and area should be and one for why a durable choice was made, and neither owned how work is done here. Commit, branch, worktree, validation, and documentation rules sat in the root `AGENTS.md`, which also carried repository positioning and navigation, and the Invariants of the [repository spec](../../../../spec/repository.md) mixed constraints on actions with properties of the delivered repository. The [historical spec contract](../../../archived/2026/10/04-r1-specifications.md#division-of-work) named the gap: contributor guidance belonged to repository documentation and the README, while `AGENTS.md` supplied navigation and non-trivial rules, but no page owned the working rules themselves. The [historical ADR contract](../../../archived/2026/08/22-r6-adr-mechanism.md#authoring-the-record) could not hold them, because a rule has no alternatives or consequences to record.

## Analysis

A normative statement in this repository falls into five kinds. A statement that can be checked from the deliverable alone is a spec invariant: repository file links are relative to their containing document, ordinary public pages come in language pairs, and Prettier formats all tracked Markdown. A statement that constrains an action, a step, an order, a permission, or a prohibition is a rule: commit, merge, push, and branch deletion are separate authorizations, development checks run before review, and the complete check runs on the final candidate. A statement that records a choice, its alternatives, and its consequences is a decision. Instructions for installing and using a component are component documentation. Entry points and the non-trivial rules that must hold without further reading belong to `AGENTS.md`, and each of those rules keeps its owning page in this layer.

The same constraint often appears in two forms: the spec states the complete properties of a valid deliverable, while a rule governs actions and permissions. User references may independently describe the same behavior. These roles do not justify omitting requirements from a spec or creating competing requirements.

The following decisions informed the layer. Historical citations identify the choices used at adoption; current references identify continuing constraints. None conflicted with adding the layer:

- [Add a specification layer](../../../archived/2026/10/04-r1-specifications.md) recorded the division of work for specs, ADRs, and component documentation and left contributor instructions to repository documentation, the README, and `AGENTS.md`. This decision adds a fourth document type to that division and reverses no part of it.
- [Clarify the ADR content boundaries](../../../archived/2026/08/22-r6-adr-mechanism.md) kept ADR content rules and lifecycle unchanged. A rule keeps no history, so it cannot replace a contract that a decision records.
- [Keep distributable components self contained](../08/24-component-self-containment.md) forbids references from inside a distributed component to files outside it. The rule layer is repository documentation outside component directories, and the reference direction keeps every distributed component independent of it.
- [Colocate bilingual public documentation](../08/20-bilingual-docs.md) requires same-directory language pairs for ordinary public pages, and rule pages follow it.
- [Scope development checks](../09/12-repository-checks.md) defines how affected checks are selected and how the complete gate is recorded. Rules state when those checks run and what evidence they leave.
- [Review authorization](../09/06-review-authorization.md) keeps a review request from authorizing edits to the reviewed files, and the Git rules state it for branch work.

## Decision

### Ownership

`.agents/rule/` carries the repository's working rules, and the [layer's entry page](../../../../rule/README.md) defines the layer. Its directory name is singular like `spec`.

One normative statement has one owning layer, and [maintain-spec](../../../../skills/maintain-spec/SKILL.md#division-of-work) states how specs, decisions, rules, component documentation, repository documentation, and `AGENTS.md` divide their work. A rule `AGENTS.md` states keeps its owning page in this layer, and a change updates both texts.

### Files

The [rule layer's entry page](../../../../rule/README.md#file-layout) owns the rule file layout, the naming of a rule file, and the current activity list. `.agents/adr/` uses subdirectories to express a record's lifecycle state, while a rule is a current constraint edited in place that keeps no history.

### Writing a rule

The [rule layer's entry page](../../../../rule/README.md#writing-a-rule) owns how a single rule is written, traced to a source, and cited.

### Editing

The [rule layer's entry page](../../../../rule/README.md#editing-a-rule) owns how a rule is edited, when a rule change goes through the ADR process, and what a rule file keeps out.

### Reference direction

The [rule layer's entry page](../../../../rule/README.md#reference-direction) owns the reference direction and the layer's status as explanatory documentation.

### What moves

The root `AGENTS.md` keeps repository positioning, per-activity navigation, and the non-trivial rules every change must keep in view, linking the rule page that owns each complete procedure. The [repository spec](../../../../spec/repository.md) states the complete properties of the delivered repository and its acceptance, without working procedures or repository-file links. Non-spec indexes provide navigation to the related rules and decisions. The [root README](../../../../../README.md) keeps the contributor-facing overview, layout, and links to the layers rather than duplicating long procedures.

The layer has no spec of its own: the repository spec carries the rule layer's goals, boundaries, and acceptance, because the area this layer describes is the repository itself. A rule that holds on one machine only, that names the device's model, provider, endpoint, or absolute path, or that carries a personal working preference stays out of the layer and out of tracked files. The same applies to a working convention that exists only outside Git, such as how task state and task materials are kept. Component-internal rules stay with the component: the instructions in a `SKILL.md` are the product delivered to a host, not a repository rule. The first delivery also covers repository working rules that already applied and had no owning document, so its source is the repository's publishable working rules rather than a file list.

Moving rules into this layer preserves their conditions, exceptions, permissions, and unrelated spec requirements. The [development rules](../../../../rule/development.md#checks) retain the complete-check fallback for shared inputs and unknown paths and own the selector regression-check obligations.

### Reading the rules

The layer [README](../../../../rule/README.md) states the layer's definition, its file layout, how a single rule is written, editing a rule, the reference direction, and this decision, and it indexes the rules by activity. `AGENTS.md` states where the layer is, links its entry the way the ADR and spec entry points are linked, carries the navigation and the non-trivial rules, and states at the strength of "as far as possible" that validation and evaluation work reads the applicable rules. A host injects `AGENTS.md` at the start of a session, while a rule page is read only when a reader chooses to open it, so a rule page may never arrive and a committed compaction can drop what a session already read; `AGENTS.md` therefore repeats the rules a change applies most often and the rules a reader is least likely to think of loading. Reading stays on demand for the remaining rules: no host injection mechanism and no requirement to load every rule is added.

## Alternatives considered

None

## Consequences

One page per activity states the current constraint that binds an action, and `AGENTS.md` and the layer README index those pages, so a contributor or an Agent can find the rule that governs a step and its related spec and decision.

Rules that leave `AGENTS.md` no longer arrive with the instructions a host injects at the start of a session, so an agent can act without reading a detail that binds its work. `AGENTS.md` repeats the rules a change applies most often and the rules a reader is least likely to think of loading, and the remaining detail stays on demand: navigation entries, the per-activity index, and the request in `AGENTS.md` to read the applicable rules bound this, but nothing enforces it.

`AGENTS.md` and a rule page state the same constraint for the resident rules, and a later edit that updates one of them leaves the other describing an older rule. `AGENTS.md` repeats only the rules a change applies most often and the rules a reader is least likely to load, and reviewers compare the two texts, because nothing checks them mechanically.

## Changes

### 2026-10-22 Internal maintenance methods

[maintain-spec](../../../../skills/maintain-spec/SKILL.md) and [maintain-adr](../../../../skills/maintain-adr/SKILL.md) own the main methods for their document types. The spec and ADR README pairs own project supplements and navigation; this rule layer retains cross-cutting project rules. Internal project Skills are repository maintenance material, distinct from instructions inside distributed components. Each normative statement still has one main owner, with triggers and navigation in project entry points rather than duplicate complete methods.
