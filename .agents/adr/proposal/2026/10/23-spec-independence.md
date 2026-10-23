# Specification independence

Draft owner: Ruokee
Draft writer: OMP GPT-6 Astra

English | [中文](./23-spec-independence.zh.md)

## Motivation

Make specifications complete, implementation-independent statements of required behavior.

A spec should explain why a capability is needed, what it must do, and the observable results that distinguish conformance from deviation. After removing the original implementation and its explanatory material, a reader should still be able to build a functionally equivalent implementation. Internal choices may differ.

The [specification decision](../../../decision/2026/10/04-specifications.md) instead assigns detailed contracts to other pages and permits specs to link them. The [archived Pin decision](../../../archived/2026/09/15-r2-omp-context-pin.md) named the README as the sole documented source of limits. The [tk spec](../../../../spec/tk.md) delegates detailed behavior and acceptance to design pages and includes implementation choices. Removing those links alone would leave missing requirements; copying the linked pages would bring implementation detail into the target.

## Proposal

### Complete targets

A spec states the subject's goals, scope, necessary conditions, observable behavior, failure outcomes, and acceptance criteria. It contains every confirmed requirement needed to recreate substantially the same capability without the original implementation or its explanatory documents.

Exact commands, input and output formats, values, defaults, limits, and compatibility commitments belong in a spec when they are confirmed external requirements. Classify a statement by what it constrains, not by whether it contains technical identifiers. A storage format can be an external compatibility contract; an internal record field does not become a requirement merely because the implementation uses it.

Internal functions, module organization, algorithms, build arrangements, implementation steps, test commands, and validation logs do not belong in a spec. When a passage mixes an observable requirement with an implementation choice, preserve the requirement independently rather than deleting the entire passage or retaining the mechanism as a requirement.

Existing implementation helps discover omissions but does not approve a target. Authors may investigate relevant code, design material, current decisions and their dated changes, and confirmed requirements, including sources not linked by the existing spec. Readers must not need those sources to complete the target. A conflict between a necessary behavior's original requirement and a current decision requires a maintainer decision; it is not resolved by copying whichever behavior the code currently provides.

### Navigation

Spec bodies contain no links to repository files. This includes component documents, source files, ADRs, rules, language counterparts, and other specs. Bare paths, instructions to consult another document, and phrases such as "as currently implemented" must not substitute for requirements.

Keep same-directory English and Chinese pairs complete and semantically equivalent. Move language, subject, and related-decision navigation to the [spec index](../../../../spec/README.md), which remains a non-spec page with project supplements. It must not become a second location for missing functional requirements. Remove the `Related ADRs` section from spec bodies; retain the other existing sections where applicable rather than imposing host or interface sections on unrelated subjects.

A subject may span several spec files when their scopes and combined requirement boundary are clear. The external index identifies the complete file set and language pairs. That set must remain sufficient without implementation material; splitting by internal module structure is not a requirement. ADRs, rules, indexes, and ordinary component documentation retain their applicable links and language navigation.

### Document responsibilities

Specs own the complete target. Component documentation explains installation and use against that target and remains independently useful to users. Necessary requirements may therefore appear in both a spec and a user reference; avoiding repeated text cannot justify an incomplete spec or introduce a competing target authority. Include the required constraints, not whole copies of user documentation; installation instructions, usage guidance, and reference material retain their component-documentation role. Implementation design belongs in design material and code. Evidence belongs in maintenance records. ADRs retain their durable choices, reasons, and necessary historical contracts, even when those contracts contain implementation detail that a spec must exclude.

The internal `maintain-spec` Skill continues to own the main maintenance method. Its checks must reject both delegating a necessary requirement to component documentation and relabeling an implementation description as a spec. Check the meaning and completeness of requirements, not only headings, formatting, or link resolution.

Preserve confirmed behavior, quantities, defaults, conditions, exceptions, failure semantics, and compatibility promises across the correction. Update the maintenance method, project supplements, affected specs, documentation rules, dictionary description, root README pair, and affected component responsibility statements together. Navigation and inbound references must remain usable. This changes documentation responsibilities, not component behavior, configuration values, persisted formats, or host maintenance bounds.

Distributable components remain self-contained and do not depend on repository specs for use, builds, or distribution. Internal maintenance Skills may read the project documents they maintain. Specs remain explanatory Markdown, with no generator, dedicated checker, or runtime consumer added by this choice.

### Conflicting decisions

The following eight decisions define the affected documentation responsibilities. Reverse only clauses that still conflict with complete, independent specs. Retain current records that already satisfy this division. Each complete successor retains every other effective clause and dated change in its scope. Preserve the recorded historical choices rather than rewriting them as if they had always required independent specs. Required language versions and direct predecessor relationships move together under the existing ADR mechanism.

1. [Specifications](../../../decision/2026/10/04-specifications.md), especially `Maintenance ownership` and `Reference direction`, delegates detailed commands, parameters, settings, formats, and maintenance declarations, requires language links and related ADRs in specs, and permits repository-file references. Replace that division with complete targets and external navigation. Preserve the spec location and inventory, current-target editing, confirmed-requirement authority, ADR conflict handling, the internal Skill's ownership and loading triggers, the task Goal boundary, and component self-containment.
2. [tk documentation](../../../decision/2026/08/29-tk-documentation.md), under `Contract ownership` and `Topic ownership`, gives behavior and observable acceptance to design pages and requires other pages to link normative detail rather than repeat it. Replace that exclusivity: the spec owns required Agent and product behavior and acceptance; the Skill design explains their design and implementation, and validation documentation owns verification methods and evidence. Normative external parameters and fields must be complete in the spec; component references remain independently useful, while algorithms and internal definitions stay in implementation design. Preserve the four usage patterns and their adoption permissions, authoritative Skill sources and shared-reference assembly, installed self-containment, component documentation organization, language rules outside spec bodies, distribution coverage, and all other tk contracts.
3. [Bilingual documentation](../../../decision/2026/08/20-bilingual-docs.md), under `Language scope`, requires reciprocal language links. Add the spec-body exception and put counterpart navigation in the external index. Preserve same-directory pairs, completeness, same-change semantic alignment, identifier spelling, ordinary-document links, Skill packaging, and ADR metadata and lifecycle requirements.
4. [Repository rules](../../../decision/2026/10/12-repository-rules.md), under `What moves`, requires the repository spec to link pages owning moved procedural details. Remove that requirement. Rules continue to own working procedures, while the repository spec states complete deliverable properties and acceptance. Preserve the rule layer, its maintenance ownership, Agent entry-point responsibilities, project boundaries, and its dated internal-maintenance-method addition.
5. [OMP QoL](../../../decision/2026/09/20-omp-qol.md), in its `Decision`, assigns module mechanics and per-adjustment evidence to a set of pages that includes the spec. Keep required behavior, defaults, limits, status and failure outcomes in the spec; keep internal mechanisms and recorded evidence outside it. Preserve the component's module and configuration boundaries, switches and defaults, process-wide limitations, ownership and release behavior, compatibility contract, and real-session validation obligations. Its README maintenance declaration remains effective under the continuing host-maintenance contract below; the spec states the same confirmed bound and its meaning in full.
6. [Task argument cleanup](../../../decision/2026/10/17-task-argument-cleanup.md), under `Fit with the component`, likewise assigns mechanics and per-adjustment evidence to the README and spec. Replace only that assignment. Preserve `taskArgsEnabled`, schema-dependent activation, seance and non-seance behavior, rewrite boundaries, activation and status rules, accepted speculative-execution costs, host compatibility, and the upstream-retirement condition. The decision's implementation contract is not removed merely because it stays outside the spec.
7. The [archived omp-context-pin decision](../../../archived/2026/09/15-r2-omp-context-pin.md) named the README as the sole documented source of limits. Its [current successor](../../../decision/2026/09/15-omp-context-pin.md) already assigns complete usage, record, numbering, reset, limit, persistence, and cache requirements to the Pin spec. Retain that division: the spec states all required public behavior and capacity constraints; the README retains independently usable instructions and reference material. Preserve `/ctx-pin`, `ctx_pin`, `read` approval, no component-added authorization, confirmation or source-admission checks, and no user-configuration writes. Limits remain component-adjustable defaults, not constants fixed by the ADR; changing them updates the spec and user documentation together. They constrain active bodies only, not tokens, metadata, or older tail messages; a full request can still overflow after compaction. Preserve readable over-limit entries, refusal of new writes, capacity-independent unpinning, verbatim retention, source and identity rules, recovery, persistence, cache and validation contracts.
8. The [Context Pin tool contract](../../../decision/2026/10/17-context-pin-tool-contract.md), in its final `Decision` paragraph, already assigns the actions and observable behavior to the Pin spec, common goals and invariants to the main spec, and user operations to the Pin guide. Retain that division. Preserve all six actions, revision-free current-entry writes, retry identity and conflict semantics, complete read-only `show`, capacity-refusal feedback without mutation, confirmed edits acting on the current entry, the older-draft overwrite consequence, existing journal compatibility, `read` approval, and component-adjustable limits.

### Continuing decisions

The [host-maintenance decision](../../../decision/2026/09/28-host-maintenance.md#maintenance-declaration) keeps each component README's compatibility section as the authoritative component-facing declaration of its confirmed bound. This does not make it the only place that can state the requirement. The spec must state that same bound and its maintenance meaning completely, without requiring the README to fill a gap. Neither document may introduce a different bound; bound changes keep their existing approval requirements and update both statements together. This preserves the declaration ownership repeated by [status bar](../../../decision/2026/09/04-omp-status-bar.md), [model prompt rules](../../../decision/2026/09/14-model-prompt-rules.md), [smart-context](../../../decision/2026/10/12-smart-cache.md), and OMP QoL. No maintenance upper bound, installation gate, new version guarantee, or claim that all maintained versions were tested is introduced. Those declaration clauses need no reversal.

The [workloop decision](../../../decision/2026/10/22-workloop.md#specifications) already assigns goals, boundaries, and observable outcomes to its spec. A non-conflicting dated addition clarifies that all required operation behavior belongs there, while Skills and component documentation retain operation methods and usage. The [dictionary decision](../../../decision/2026/10/17-repository-dictionary.md#repository-integration) requires the repository spec to describe the dictionary and terminology rule, not to link them; preserve that choice without reversal. Other unchanged decisions remain effective.

## Alternatives considered

None

## Acceptance criteria

- For every current spec subject, its complete spec set alone states the functional scope, necessary conditions, observable success and failure behavior, and acceptance needed to recreate substantially the same capability. Different internal implementation choices are allowed.
- Every confirmed requirement has a corresponding retained statement. Necessary requirements previously found only in implementation material are verified and expressed in the spec; implementation choices do not become requirements by default.
- Spec bodies contain neither repository-file links nor indirect delegation through paths or references to existing material. They contain no descriptions of the actual implementation. External indexes identify complete subject sets and language pairs without carrying missing requirements.
- The maintenance method rejects both detail delegation and implementation descriptions presented as specs, while retaining confirmed external constraints such as capacity values.
- The eight decisions express the required documentation responsibilities. Any needed successors change only the named responsibilities and preserve all other effective contracts. Non-conflicting decisions, rules, terminology and affected documentation express consistent responsibilities; archives preserve the historical choices and direct relationships.
- English and Chinese express equivalent, complete requirements. Components remain independently installable and usable, and no product behavior, configuration value, storage contract, or maintenance bound changes because of this documentation correction.

## Risks

A spec and a user reference may both state the same external limit or default. Updating only one can direct implementers and users toward different behavior. Same-change maintenance and semantic comparison are required; formatting and valid links cannot detect that disagreement.

A passage may mix an implementation mechanism with a required failure outcome. Removing it as a unit can silently remove the requirement. The correction must separate those meanings and account for retained behavior rather than treating deletion of technical text as success.
