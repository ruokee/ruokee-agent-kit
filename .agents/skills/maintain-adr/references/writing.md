# Writing rules

Write for a reader with only the finished record and its accessible sources. An ADR is not a progress log, release note, temporary plan, or routine-change summary.

## Open with the choice

`Motivation` opens a decision. Its first paragraph is one short sentence stating the action to perform or choice to adopt. Write that action itself, not what the record does; it must be understandable without the title, links, or later text. Following paragraphs give the concrete problem, background, reasons, and evidence. A wanted capability need not be framed as a defect. A successor decision states its complete choice.

An optional `Analysis` immediately follows `Motivation`, before `Decision`. Omit it without substantive analysis. Include only observations, evidence, constraints, reasoning, and uncertainty that affect the choice. Do not copy research notes or an implementation plan, or repeat the motivation and alternatives.

## Preserve the necessary contract

Record a coherent durable choice, its reasons, necessary boundaries and ownership, important public promises, and material compatibility, safety, cost, and failure consequences. Include a technical detail only when omitting it would obscure the choice or a material tradeoff, or lose a contract that must be preserved. Include only the necessary fragment. Configuration authority, immutable identity, and process-wide side effects can be essential even when they use concrete identifiers.

Full API and configuration tables, schemas, command references, and maintained inventories belong in their owning public documentation. Internal function names, algorithm steps, file-by-file edits, execution plans, test commands, and validation logs belong in implementation documentation, code, tests, or task materials. Acceptance criteria describe observable outcomes, not test procedures.

Link accessible public contracts. Do not cite ignored task materials as public authority or include task lifecycle, branches, commit identifiers, or session-only context. Relocating a binding clause does not cancel it: preserve its meaning and an accessible reference. Historical records retain enough original detail to explain their choice; a changing current document cannot substitute for the historical contract.

## State actual boundaries

Distinguish intentionally closed protocols, ownership rules, and safety boundaries from examples and growing inventories. Prefer a link to an owning inventory over a fixed count or exhaustive file tree. When a closed set or prohibition is necessary, explain the protected boundary and reason.

A present scope limit or an option not needed for an initial release is not automatically a permanent prohibition. Preserve that distinction. Do not retroactively weaken an existing prohibition to escape it, or add speculative abstractions and configuration merely to make wording extensible.

Defensive rules address the actual operation and harm. Validation, repair, lifecycle changes, and repeated activation may need different preconditions. Preserve identity, permission, and side-effect protections rather than replacing them with blanket restrictions unrelated to the protected boundary.

## Review substantive entries

Review alternatives and risk-like statements wherever they appear, including `Consequences`. First establish that an alternative genuinely entered the choice or that a risk has a credible cause. Then ask what material tradeoff, harm, or boundary a reader would miss if it were removed. The first check alone does not establish lasting decision value.

Locate the supporting requirement, analysis, discussion, or historical evidence. An entry's own claim that an option was considered or rejected is not evidence. Keep review evidence in work materials; the ADR records the choice and necessary reasons, not a discussion transcript or a claim that this checklist was followed.

Remove unsupported, misclassified, or immaterial entries instead of making them sound plausible or moving them elsewhere. Preserve unique binding clauses and necessary reasons in their proper place. Combine repeated causes and consequences without losing conditions. Do not use entry counts, deletion ratios, or word-count targets as quality measures.

Consequences may include material benefits and accepted costs; they need not all be risks. Judge historical entries against requirements and evidence from their own time, not later constraints. Use descriptive level-three headings when a required section needs structure. Do not replace required level-two headings or use subsections for progress history or copied implementation inventories.

## Alternatives considered

Start the required section with `None`; add only real, material alternatives that pass the preceding checks. An empty result is complete. Use the project's language equivalent where required.

An alternative is a different course for the same durable choice that genuinely entered the choice and explains a material tradeoff. Existence, plausibility, or mention in discussion alone is insufficient. Do not invent alternatives to make a record look complete.

Facts, requirements, acceptance criteria, restatements of the selected approach, simple negations of settled requirements, and implementation variations without material tradeoffs are not alternatives. If the requirement is reply text, copying thinking merely negates the agreed scope.

An option genuinely viable before a later constraint or feasibility finding can still explain an important choice. Preserve that reason without reproducing exploration or treating every rejected implementation idea as a separate alternative. If none qualifies, the section contains only `None` or the prescribed equivalent.

## Material consequences

Include only credible ways a choice could cause material harm when stating risks in `Consequences`. No separate risk section or fixed number of risks is required.

Name the relevant condition or omission, causal mechanism, and harmful outcome that matters to this choice. Preserve material residual risks, compatibility losses, continuing costs, and technical uncertainty affecting adoption. An omission can qualify when it creates a decision-specific, consequential failure path; do not exclude it merely because implementation is involved.

Facts, requirements, invariants, acceptance criteria, tasks, repeated behavior descriptions, and temporary verification gaps are not risks by themselves. Generic warnings that code may fail, documents may drift, or users may misunderstand do not establish a risk specific to the decision.

`Behavior must remain consistent` is a constraint. Separately maintained authorities that drift and produce conflicting behavior describe a failure mechanism. Removing a revision check can let an older draft overwrite a newer body, a concrete cost. A handler that disables speculative task startup imposes an execution cost under its registration conditions. Keep such causal conditions rather than adding generic maintenance warnings to every ADR.

Omit risk claims that fail these criteria. Consequences may instead state the supported benefits or accepted costs of the choice.
