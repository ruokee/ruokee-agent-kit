# Execute

Apply the loaded [entry](../SKILL.md). Read [Task ownership](../references/task.md) and [execution constraints](../references/execution.md) before resolving the assignment. Act as the Builder in the current session: implement, self-check, repair, and coordinate independent Verify. No Supervisor is required. Follow project working conventions.

## Resolve the unit

Resolve the actual execution request and owning Task, then read its current tk status. If it is `planning`, start it through tk's public interface, such as `tk update <task_ref> --start` in the CLI, before checking Plan readiness. This execution request authorizes starting the owning Task; other Tasks keep their own grants.

Continue an `open` Task without starting it again. A `closed` Task follows tk's separate reopening permission. On recovery or a failed start, reconcile the actual Task state through tk before implementation; managed metadata changes go through tk.

Read the owning Task's goal, mandatory `plan.md`, linked unit details, relevant design and decisions, dependencies, current implementation, acceptance, and execution evidence. A one-unit task still requires a separate Plan. Return only the scope affected by missing or unready planning to [Clarify](./clarify.md); implementation follows the confirmed requirements. Apply the shared execution constraints to real dependencies and unresolved contracts.

Returning to Clarify because of missing planning or a problem found during execution, verification, or user acceptance leaves the Task `open`. Workflow stages may return to earlier work; a started Task keeps its `open` status.

Apply the execution constraints to the selected scope, permission, continuous progress, and question restrictions. When a role is needed, read [role selection](../references/roles.md). For assigned work or cross-session dispatch, read [collaboration](../references/collaboration.md). Use Senior only when explicitly assigned.

Keep the Task, unit, basis and entry location, candidate, complete request's endpoint, completed and remaining actions, scope and grants, explicit restrictions, inspection count and limit, and next action in recoverable state. Keep live routes and pending assignments under the collaboration rules.

## Implement

Reuse project patterns and complete the requested change. Preserve unrelated work and effective requirements. Prepare only the local environment and temporary processes needed for authorized implementation and checks. Limit changes to the requested work; preflight, hypothetical features, compatibility shims, and unrelated fallback behavior stay out.

Update affected callers, contracts, and documentation together. Perform debugging needed for implementation and honor project-required author checks or hooks. The Verifier owns actual verification and evidence collection; a complete author-run verification is not a handoff prerequisite. Follow project candidate-commit rules and preserve a stable candidate for inspection.

Save substantive results in the established execution record, normally `execution.md`: unit, branch or change location, dependency base, candidate, completed behavior, implementation observations, repairs, deviations, and remaining limits. Link the Verifier's checks and evidence rather than duplicating them. Preserve reconstruction sources rather than treating installed dependencies as evidence. Stop owned temporary processes before authorized cleanup.

Use verified predecessor candidates under the execution constraints. Missing product decisions or required capabilities block dependent actions; delivery waits for the full authorized scope. When a new fact invalidates a contract, pause that work and record the question and options in Clarify materials; continue clear, unaffected authorized work.

## Self-check

After implementation, read [self-check](../references/self-check.md) and inspect this unit in the current main session. Use its basis, candidate, changed output, and relevant materials. Save the lightweight inspection in the execution record or a linked self-check record; `verification.md` holds independent Verify. Follow the shared count, reset, early-pass, and limit rules. Repair actionable findings.

## Obtain independent Verify

Each implementation unit needs independent [Verify](./verify.md), even after self-check passes. Under the execution grant, select and launch or reuse a suitable isolated verifier through the role and collaboration references. Supply the Task, current unit, frozen candidate location, and live reply owner. The verifier loads its operation and resolves its basis and report.

Wait and validate the final result under the collaboration rules. On `changes required`, the original Builder repairs in scope, records the changes, freezes the new candidate, and requests affected rechecks from the same suitable Verifier. The Verifier runs those rechecks and updates evidence. Apply self-check resets under its shared policy when verification completes. On `unable to determine`, resolve the specific missing prerequisite rather than relabeling the result. Preserve pending requests instead of redispatching them.

Complete the authorized repair and recheck cycle without routine intermediate confirmation. Explicit request limits and real human checkpoints still apply.

## Continue

After a current independent pass, save the unit result and begin the next authorized dependency-ready unit in this execution. Pending user review or predecessor integration leaves the next authorized unit available. A delegated Builder stops at its assigned boundary and returns a final result to the owner, who continues the wider Plan.

If all remaining work is genuinely blocked, save each blocker, finished candidate, and exact missing fact, state, or permission. Preserve the full selected scope. When that scope is complete, return its candidates together for user review. Integration and Ship require their own effective permission.

## Return

Save the execution record and link independent reports rather than duplicating them. Return concise per-unit results with Task, unit, location, base, candidate, completed behavior, material paths, exercised evidence, coverage, limits, self-check count and result, independent verdict and report, user-review or advance-approval state, delivery state, and actual remaining requirements.

Execution completion covers the implemented candidate; merge, installation, restart, publication, and Task closure follow their own grants. Keep verified unintegrated candidates available for project-defined delivery.

Return through the [entry's continuation rule](../SKILL.md#continue-the-request) to resolve any later actions already covered by the complete request.
