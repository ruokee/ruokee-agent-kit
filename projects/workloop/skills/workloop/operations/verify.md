# Verify

Read the [common contract](../SKILL.md) in full. Independently judge the selected materials or implementation candidate. Keep the target read-only. Perform only the checks and report writes permitted by the request and project; verification does not grant repairs.

## Resolve the target

Resolve the owning Task, requested unit or material scope, goal, Plan and linked details, design, effective decisions, project rules, current candidate location, and live reply owner. Reusing this session does not carry a previous scope or verdict onto a new assignment.

Read source requirements and user decisions where needed. The implementation or author's checklist is evidence of what was done, not the authority for what should have been done. Do not substitute a narrower requirement because the candidate is easier to verify. Do not import a different Task's restrictions or reinterpret a later decision as prior authorization.

Name the exact candidate before assessing it. For code, use the project's commit/tree or equivalent identity and current working state. For materials, identify the file set and revision or frozen snapshot. Clarify an ambiguous, moving, missing, or conflicting target rather than guessing. Do not modify or format the target. An author must not edit it while assessment is active.

## Assess the result

For preparation materials, check the goal, design, Plan, and referenced unit details against current requirements. Look for contradictions, lost conditions, unsupported additions, infeasible dependencies, unresolved product choices, and foreseeable execution blockers. Preserve distinct material responsibilities and confirmed limitations. Do not turn material review into proactive environment preflight or implementation.

For an implementation unit, inspect the complete relevant change and affected consumers against the goal, Plan acceptance, applicable Skills, and project rules. Trace the behavior the user actually needs, including relevant failure and boundary cases. Check permission scope, documentation, dependency bases, self-check history and repairs, and whether the delivered result is complete rather than a placeholder or partial substitute.

Read execution evidence with its candidate and coverage. Independently exercise the changed path and run proportionate non-destructive checks where permitted and needed. Consult a check's actual behavior before invoking it if it may write or create external effects; read-only verification does not authorize such effects. When a needed check cannot be performed within the grant, identify that exact gap instead of silently skipping it.

Reuse valid unchanged evidence by naming who produced it, its candidate, conditions, inputs, result, and scope. Do not claim to have independently rerun it. A file-path check does not prove host discovery, a controlled provider does not prove real-model behavior, and an automated pass does not prove interactive correctness. Keep real limits without rejecting sufficient evidence for a narrower requested result.

Report only actionable findings supported by evidence. For each, state severity, location, observed fact, violated requirement or consequential risk, and the smallest correction that restores the goal. Do not pad findings with stylistic preferences or require unrelated features. An optional improvement is not a mandatory failure.

## Decide

Use one verdict for the current scope:

- `passed`: the candidate meets its required result and has sufficient evidence for this scope. State remaining limits without extending the pass beyond them.
- `changes required`: an evidenced defect or unmet requirement needs correction. Identify affected work and evidence needed after repair.
- `unable to determine`: necessary information, capability, stable identity, permission, or evidence is missing. Name the missing prerequisite and what would make a judgment possible. This is neither a pass nor an evidenced implementation defect.

A material or design defect belongs to [Clarify](./clarify.md); an implementation deviation belongs to [Execute](./exec.md). Do not make those repairs yourself. Assess only affected work on recheck while preserving enough surrounding coverage to detect regression.

## Save the assessment

Append to the owning Task's existing verification record, normally `verification.md`. Preserve each prior verdict and candidate, including failed rounds. A new candidate gets a new assessment rather than a replacement success label on an old failure.

Record scope, candidate identity and base where relevant, basis, actual conditions and inputs, performed checks and observations, reused evidence, findings, verdict, limits, and any missing prerequisites. Separate self-check claims, the independent judgment, user acceptance, and delivery status. Link the execution record rather than duplicating it.

Explicit no-record or narrower restrictions govern report saving. State the limitation and do not claim a saved report. If progression requires a saved report, that gate remains unmet until the necessary storage permission or destination is available.

## Return

In a delegated assignment, save the permitted report, then send the live owner a final-only result as the last action, without waiting on the owner. Include sender, Task/unit or material scope, candidate, verdict, actionable findings or blocker, and report path. For a direct user request, return the same concise result to the user.

If delivery fails after saving, retain and recover the same report rather than repeating the assessment. A recheck uses the same suitable isolated session, resolves the current assignment anew, and appends its own result. Independent Verify has no self-check inspection limit. Honor a user restriction to one round or report-only review; otherwise requested preparation review and authorized execution may return for necessary in-scope rechecks.

A pass is scoped evidence, not proposal approval, merge permission, installation, production delivery, or Task closure. Do not add user-acceptance gates between units that the execution contract already authorizes to continue.
