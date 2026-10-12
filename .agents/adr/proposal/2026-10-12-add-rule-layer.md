# ADR proposal: Add a rule layer

Draft owner: Ruokee
Draft writer: OMP DeepSeek V4.1 Flash

English | [中文](./2026-10-12-add-rule-layer.zh.md)

## Motivation

Give the repository's working rules their own layer under `.agents/rule/`, beside `.agents/spec/` and `.agents/adr/`, and move the working-procedure text out of the root `AGENTS.md` and the repository spec.

The repository has a document type for what each component and area should be, and one for why a durable choice was made. Neither owns how work is done here. Commit, branch, worktree, validation, and documentation rules sit in the [root entry file](../../../AGENTS.md), which also carries repository positioning and navigation, and the Invariants of the [repository spec](../../spec/repository.md) mix constraints on actions with properties of the delivered repository. [The spec rules](../../spec/README.md) name the gap themselves: their division of work gives the repository instructions and README the job of telling contributors how to work, and no page owns that content. [The ADR rules](../README.md) cannot hold it, because a rule has no alternatives or consequences to record. A reader who asks what to do when committing has no page to read, and a constraint written in two layers is updated in one of them and goes stale in the other.

## Analysis

A normative statement in this repository falls into five kinds, and the boundary between two of them decides this layer. A statement that can be checked from the deliverable alone is a spec invariant: repository file links are relative to their document, ordinary public pages come in language pairs, and Prettier formats all tracked Markdown. A statement that constrains an action, a step, an order, a permission, or a prohibition is a rule: commit, merge, push, and branch deletion are separate authorizations, development checks run before review, and the complete check runs on the final candidate. A statement that records a choice, its alternatives, and its consequences is a decision. Instructions for installing and using a component are component documentation. An entry point, a pointer to another layer, or shorthand that cannot be inferred from the files and tool configuration belongs in the root entry file.

The same constraint often appears in two forms, which is not duplication: the spec says a commit message is an English Conventional Commit whose scope comes from a fixed set, and the rule says when to run the formatting hook, which files belong to the current task, and which authorization each Git action needs. Only two layers stating the same thing is duplication, and that is what this layer removes.

The [repository spec](../../spec/repository.md) mixes both kinds in several Invariants: it names commit, merge, push, and branch deletion as separate authorization boundaries, states when the development check runs, places the complete check on the clean final candidate together with the record it requires, requires the aggregate, the selector mapping, and the regression tests to change together, and gives the version change as a scale from `Z` to `X`. The [root entry file](../../../AGENTS.md) carries rules beside its navigation and its first-party boundary. [Add a specification layer](../decision/2026-10-04-add-spec-layer.md) recorded the division of work for specs, ADRs, and component documentation, and left the repository instructions and README to tell contributors how to work. This proposal gives that content a layer of its own and adds a fourth document type to the division without reversing any part of it: specs keep stating targets and observable results, decisions keep recording choices and reasons, and the new layer takes the constraints on actions. Neither the ADR mechanism nor the spec layer added a checker, a classification system, or a manifest for its own content, and the rule layer follows them.

## Proposal

### Layers and ownership

`.agents/rule/` carries the repository's working rules: what a contributor or an agent must do, in what order, with which permission, and what is forbidden. One normative statement has one owning layer. A spec states what a subject should be and which observable result shows it; a decision records a durable choice, its reasons, and its consequences; a rule states the constraint that binds an action; component documentation tells users how to install and use the component; the root entry file and README provide navigation and non-trivial shorthand. A rule carries no long rationale: when a reader needs the reason, the rule links the decision that owns it or the spec that owns the property it enforces.

### Directory and files

The layer lives in `.agents/rule/`, beside `.agents/spec/` and `.agents/adr/`, and its directory name is singular like `spec`. Rules sit flat in one directory, one file per activity, as same-directory `name.md` and `name.zh.md` pairs with reciprocal language links directly below the title; the layer's own rules are `README.md` and `README.zh.md`. A rule file carries no date, no status, and no subdirectory: `.agents/adr/` uses its subdirectories to express a record's lifecycle state, while a rule is a current constraint edited in place that keeps no history. The first delivery covers repository boundary, planning, tasks, Git, validation, documentation, collaboration, and maintenance; the set follows the activities and changes when a real activity needs a page of its own.

### Writing a rule

One rule states one constraint in the imperative and may add one short sentence. Rules are not numbered, and a citation uses the file path and the section heading, because a number becomes an inventory that someone has to maintain and this layer adds no manifest. A rule should trace to a spec invariant, a current decision, or the maintainer's explicit decision; a rule without such a source is allowed when it is the current practice, and it must not conflict with a spec or a current decision. A rule keeps its original condition, exception, strength, and permission, so a rule stated at the strength of "as far as possible" stays at that strength, and a prohibition keeps its exception.

### Editing and change

A rule that adds, removes, or changes a durable choice it carries, such as an authorization boundary, a process requirement, or a release policy, goes through the ADR process before the rule changes; an editorial clarification that changes no durable choice does not. Rules are edited in place, keep no history, and carry no status, review notes, task information, or session information.

### Reference direction

References run one way. A rule may link to component files, component documentation, specs, and decisions. No file inside a distributable component links to, names a path in, or depends on `.agents/rule/`, and running, building, or distributing a component does not depend on the layer. Rules are explanatory documentation: the Markdown checks and the changed-path selector treat them like other Markdown, and no checker, classification system, or manifest is added for them.

### What moves

The [root entry file](../../../AGENTS.md) gives up the body of its working rules and keeps repository positioning, per-activity navigation, the headings its readers already link to, and the entry points to the ADR rules, the spec rules, and the rule rules. The [repository spec](../../spec/repository.md) gives up its working-procedure statements and keeps the properties of the delivered repository, its acceptance results, and every requirement the migration does not touch, linking the page that owns a moved detail. The [root README](../../../README.md) gives up the procedure paragraphs that restate the root entry file and keeps its contributor-facing overview, its layout section, and its links to the layers. The layer has no spec of its own: the repository spec carries the layer's goals, boundaries, and acceptance, because the area the layer describes is the repository itself. Rules that hold on one machine only, or that name local models, providers, endpoints, or paths, do not enter the layer. Component-internal rules stay inside their component: a `SKILL.md` instruction is the product delivered to a host, not a repository rule. The first delivery also covers the working rules that apply to repository work but have no owning document today, so the source set is the repository's publishable working rules rather than a list of files. The migration keeps the tool-choice contract that a real-host test starts an OMP CLI and does not use RPC.

### Version change authority

The migration states the version rule once: a functional change updates the component's `X.Y.Z` version together with its change, the default increment is `Z`, and changing `X` or `Y` is the maintainer's explicit decision that an agent does not take by change size. The current invariant reads "`Z` for small compatible changes, `Y` for larger behavior or capability changes, and `X` for a rewrite", which an agent can read as permission to choose the level, and the rule replaces that reading without changing the default.

### Sequencing

This proposal merges to `main` on its own. The implementation change that follows starts from the resulting `main` on a new short-lived branch: it creates the layer README pair and the activity pages, updates the [root entry file](../../../AGENTS.md), the [root README](../../../README.md) pair, the [spec rules](../../spec/README.md) pair, and the [repository spec](../../spec/repository.md) pair, creates the current rule-layer decision pair, and removes this consumed proposal. The old spec-layer decision keeps its content, because the new layer extends the division of work instead of reversing it, and no decision that does not exist yet is linked.

## Alternatives considered

**Name the layer `standard` instead of `rule`.** Considered while choosing the layer name. Standards literature and several document taxonomies pair a third layer with ADRs under "standards", which reads as a published document set for readers outside the team, and `standard` also collides with the existing use of a "standard" entry point. `rule` names the clause-level constraint this layer actually holds, matches the bare-noun form of `spec` and `adr`, and keeps the Chinese term `规则` available.

**Write the rules into a single root `RULES.md` file.** Considered while choosing where the layer lives. One file is easy to find, but it cannot carry a language pair per topic, and every activity would be edited through the same file, which does not fit the repository's documentation layout.

**Merge the rules into `.agents/spec/`.** Considered while choosing the layer boundary. It adds no directory, but a reader can no longer tell whether an entry states a target or constrains an action, and a single statement would have two possible homes.

**Organize the rules in subdirectories by activity.** Considered while choosing the file layout. `.agents/adr/` uses subdirectories, but they encode lifecycle state, and a rule has no state, so the subdirectory would add path depth and link segments without carrying meaning.

**Keep the working rules in the root `AGENTS.md` and add no layer.** Considered as the existing arrangement. It needs no new document type, but the entry file carries navigation, positioning, and rules together, the repository spec duplicates several of them in a different form, and no page owns a rule as its subject.

**Number the rules and maintain an inventory.** Considered while choosing how a rule is cited. A number and a manifest make a rule easy to reference from a checklist, but the repository keeps no such list for its ADRs or specs, and the number would need maintenance on every rule added or removed.

**State the layer's own target inside a new spec under `.agents/spec/`.** Considered while choosing where the layer's goals and acceptance live. A dedicated spec would put them where every other area states its own, but the area this layer describes is the repository itself, whose spec already exists and can carry the rule layer's target without splitting either document.

## Acceptance criteria

1. `.agents/rule/` contains the layer README pair and one page pair per activity, each pair carrying reciprocal language links directly below the title and the same rules in both languages.
2. The layer README pair states the layer's definition, its division of work with specs, decisions, and component documentation, the file organization and naming, how a single rule is written, editing and change, the reference direction, and the decision behind the layer.
3. Every working rule that leaves the [root entry file](../../../AGENTS.md), the [root README](../../../README.md), or the [repository spec](../../spec/repository.md), and every repository working rule that has no owning document today, has a recorded disposition, moved into a rule page, kept with a link to its owning page, or kept out of the repository, and each moved rule keeps its original condition, exception, strength, and permission. No action statement remains in the spec, and the contract that a real-host test starts an OMP CLI and does not use RPC is preserved.
4. The [root entry file](../../../AGENTS.md) states where the rule layer is, links its entry in the form the ADR and spec entry points already use, keeps its per-activity navigation and its existing heading anchors, and states, at the strength of "as far as possible", that validation and evaluation work reads the applicable rules.
5. The [root README](../../../README.md) pair states the rule layer and its purpose, and the [spec rules](../../spec/README.md) pair names the rule layer in its division of work and keeps its spec list consistent with what each spec owns.
6. The [repository spec](../../spec/repository.md) pair states the rule layer's goals, boundaries, and acceptance, still states its own goals, non-goals, public surface, invariants, acceptance criteria, and related ADRs, keeps every requirement the migration does not touch, and links the rule pages and the current rule-layer decision.
7. A current rule-layer decision pair exists, this proposal pair is removed from `proposal/`, and every inbound link resolves.
8. A Markdown-only change under `.agents/rule/` classifies as documentation and does not force the complete check, while a change to the selector script or its tests still selects the complete check, and the selector regression tests cover the new path. The root README's affected-check mapping lists the rule layer among the explanatory Markdown.
9. The layer contains no long rationale, no rule numbers, no manifest or inventory file, and no component-internal rules.
10. The final candidate is clean, committed, contains the target `main`, and passes the complete repository check.

## Risks

- Rules that leave the root entry file no longer arrive with the instructions a host injects at the start of a session, so an agent can act without reading a rule that binds its work and skip the complete gate, commit on a branch outside its scope, or merge without authorization. Navigation entries, the layer README's per-activity index, and the entry file's request to read the applicable rules bound this, but reading stays on demand and no mechanism enforces it.
- A rule can lose a condition, an exception, or a permission while moving, and the resulting text then allows or forbids the wrong thing, for example dropping the statement that a review request does not authorize edits to the reviewed files, or weakening "as far as possible" into a requirement. The disposition record and reviewer comparison against the source text are the guard.
- The version rule can keep or gain a reading in which an agent picks `X` or `Y` from the size of its change, so a release version moves without the maintainer's decision. The rule states the default and the permission together, and acceptance criterion 3 keeps both.
- Two layers can still state the same constraint, and a later edit that updates one of them leaves the other describing an older rule. The ownership rule narrows the overlap without removing it, and nothing checks the two texts mechanically.
- The repository spec can lose a requirement that is not a working procedure while its procedure statements are removed, such as the commit scope set, the bilingual pairing rule, or an acceptance criterion. The disposition record and acceptance criterion 6 keep unrelated requirements traceable.
- The selector can classify a rule-only change wrongly, or a widened pattern can stop routing shared inputs and unknown paths to the complete check, so a branch is recorded as documentation-only while it changes a shared input. The regression tests and acceptance criterion 8 are the guard.
- An English rule and its Chinese pair can drift, so the two authoritative texts disagree about a constraint and readers of each language follow a different rule. Both files change together and review compares meaning, because the format check cannot see a semantic difference.
