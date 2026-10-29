# Verify

Apply the loaded [entry](../SKILL.md) and read [Task ownership](../references/task.md). Independently judge the selected preparation materials or executed candidate. Keep the target read-only and perform only permitted checks and report writes. Repair needs its own grant. For cross-session receipt or return, read [collaboration](../references/collaboration.md); when selecting a role, read [role selection](../references/roles.md).

## Resolve the target

Resolve the owning Task, requested unit or material scope, goal, Plan and linked details, design, effective decisions, project rules, candidate location, and live reply owner. A new assignment brings its own scope and verdict.

Read source requirements and user decisions where needed. Implementation and an author's checklist describe what was done; requirements come from their own sources. Judge requirements at their original scope; each Task carries its own restrictions, and permission applies from the time it takes effect.

Classify the actual object. Goal, design, and Plan materials reviewed before execution are preparation. An executed unit is an implementation candidate even when its entire result is Markdown, such as an ADR proposal. This classification determines the assessment and report below.

Name the exact candidate. Use the project's commit/tree or equivalent identity and working state for implementation; use a file set and revision or frozen snapshot for preparation. Clarify an ambiguous, moving, missing, or conflicting target. Keep it read-only; the author keeps it frozen during assessment.

## Assess

For preparation, compare goal, design, Plan, and linked details with current requirements. Check contradictions, lost conditions, unsupported additions, infeasible dependencies, unresolved choices, and foreseeable blockers. Check separately that the Clarify materials faithfully cover the confirmed scope and its subtasks, and that any delivered Plan contains only resolved executable contracts. A subtask recorded elsewhere but absent from preparation materials is a coverage defect; a recorded question stays in Clarify. Preserve material responsibilities and confirmed limits. Review stays read-only; environment preflight and implementation belong to their own operations.

For implementation, inspect the complete relevant change and consumers against the goal, Plan acceptance, applicable Skills, and project rules. Trace needed behavior and relevant failure or boundary cases. Check permission, documentation, dependency bases, self-check history, repairs, and completeness, including placeholders and partial substitutes.

Read execution evidence with its candidate and coverage. Independently exercise changed behavior and run proportionate non-destructive checks where permitted and needed. Inspect a check's behavior before invoking it when it may write or create external effects. Those effects need separate authorization; name any resulting evidence gap.

Reuse unchanged evidence with producer, candidate, conditions, inputs, result, and scope stated. An independent rerun requires the verifier to run it. File paths, host discovery, controlled providers, real models, and interactive behavior establish different facts. Keep relevant limits without rejecting sufficient evidence for the actual requested scope.

Report actionable, evidenced findings with severity, location, observed fact, violated requirement or consequential risk, and the smallest correction restoring the goal. Findings stay within the requested scope and report evidenced requirement violations; style preferences are not findings.

## Decide

Use one verdict for the current scope:

- `passed`: required result met with sufficient evidence. State limits; the pass covers the stated scope.
- `changes required`: an evidenced defect or unmet requirement needs correction. Name affected work and required repair evidence.
- `unable to determine`: necessary information, capability, stable identity, permission, or evidence is missing. State the prerequisite for judgment. The verdict stays open.

A material or design defect returns to [Clarify](./clarify.md); implementation deviation returns to [Execute](./exec.md). The author repairs. Recheck affected work with enough surrounding coverage to detect regression. Independent Verify runs without the self-check inspection limit.

## Save the assessment

Append independent preparation review to `material_check.md`. Append independent assessment of executed candidates to `verification.md`. Keep these records separate from each other and automatic self-check. Preserve historical files without renaming them for uniformity; a report exists only after a requested review.

Preserve each prior verdict and candidate, including failed rounds. A new candidate gets a new assessment; prior failures keep their verdicts. Record scope, candidate and relevant base, basis, conditions and inputs, checks and observations, reused evidence, findings, verdict, limits, and missing prerequisites. Link the execution record instead of duplicating it. Keep self-check claims, independent judgment, user acceptance, and delivery status separate.

No-record and narrower restrictions govern saving. State the limit and point to the permitted destination; a gate requiring a saved report waits for permission and destination.

## Return

Save the permitted report, then return a final-only result to the live owner as the last action; the owner resumes from it. A direct request returns to the user. Include sender, Task/unit or material scope, candidate, verdict, actionable findings or blocker, and report path.

On delivery failure, recover the saved report instead of repeating the assessment. Use the same suitable isolated session for rechecks, resolving each current assignment anew. Honor one-round or report-only limits; otherwise requested preparation review and authorized execution include necessary in-scope rechecks.

Keep target identity, scope, basis, assessment state, report location, and next action recoverable; collaboration owns live routing. A pass covers the judged scope; proposal approval, integration, installation, publication, Task closure, and user acceptance follow their own decisions.
