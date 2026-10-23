# Execute

Apply the loaded [entry](../SKILL.md). Read [Task ownership](../references/task.md) and [execution constraints](../references/execution.md) before resolving the assignment. Implement in the current session and coordinate checks directly; no Supervisor is required. Follow project working conventions.

## Resolve the unit

Read the owning Task's goal, mandatory `plan.md`, linked unit details, relevant design and decisions, dependencies, current implementation, acceptance, and execution evidence. A one-unit task still requires a separate Plan. Return missing or unready planning to [Clarify](./clarify.md), without inventing requirements during implementation.

Apply the execution constraints to the selected scope, permission, continuous progress, and question restrictions. When a role is needed, read [role selection](../references/roles.md). For assigned work or cross-session dispatch, read [collaboration](../references/collaboration.md). Use Senior only when explicitly assigned.

Keep the Task, unit, basis and entry location, candidate, scope and grants, explicit restrictions, inspection count and limit, and next action in recoverable state. Keep live routes and pending assignments under the collaboration rules.

## Implement

Reuse project patterns and complete the requested change. Preserve unrelated work and effective requirements. Prepare only the local environment and temporary processes needed for authorized implementation and checks. Do not add preflight, hypothetical features, compatibility shims, or unrelated fallback behavior.

Update affected callers, contracts, and documentation together. Exercise changed behavior, run required checks, and repair in-scope failures without weakening acceptance. Record conditions and observations, not just exit status. Follow project candidate-commit rules and preserve a stable candidate for inspection.

Save substantive results in the established execution record, normally `execution.md`: unit, branch or change location, dependency base, candidate, completed behavior, inputs, observations, commands and outcomes, coverage, deviations, and remaining limits. Keep failures and repairs traceable. Preserve reconstruction sources rather than treating installed dependencies as evidence. Stop owned temporary processes before authorized cleanup.

Use verified predecessor candidates under the execution constraints. Missing product decisions or required capabilities block dependent actions; they do not justify delivering a partial substitute as complete.

## Self-check

After implementation and exercised checks, read [self-check](../references/self-check.md). Supply this unit's basis, frozen candidate, evidence, and authorized result location. Save inspection results in the execution record or a linked self-check record, not an independent Verify report. Apply its fresh-context, cumulative-count, early-pass, and limit rules. The author repairs and reruns affected checks.

## Obtain independent Verify

Each implementation unit needs independent [Verify](./verify.md), even after self-check passes. Under the execution grant, select and launch or reuse a suitable isolated verifier through the role and collaboration references. Supply the Task, current unit, frozen candidate location, and live reply owner. Let the verifier load its operation and resolve its basis and report; do not copy its assessment method here.

Wait and validate the final result under the collaboration rules. On `changes required`, repair in scope, exercise affected behavior, update evidence, freeze the new candidate, and request recheck from the same suitable verifier. Independent feedback does not reset self-check counts. On `unable to determine`, resolve the specific missing prerequisite rather than relabeling the result. Preserve pending requests instead of redispatching them.

Complete the authorized repair and recheck cycle without routine intermediate confirmation. Explicit request limits and real human checkpoints still apply.

## Continue

After a current independent pass, save the unit result and begin the next authorized dependency-ready unit in this execution. Pending user review or predecessor integration alone does not require a stop. A Worker stops at its assigned boundary and returns a final result to the owner, who continues the wider Plan.

If all remaining work is genuinely blocked, save each blocker, finished candidate, and exact missing fact, state, or permission. Preserve the full selected scope. When that scope is complete, return its candidates together for user review. Integration and Ship require their own effective permission.

## Return

Save the execution record and link independent reports rather than duplicating them. Return concise per-unit results with Task, unit, location, base, candidate, completed behavior, material paths, exercised evidence, coverage, limits, self-check count and result, independent verdict and report, user-review or advance-approval state, delivery state, and actual remaining requirements.

Do not claim merge, installation, restart, publication, or Task closure from execution completion. Preserve verified unintegrated candidates for project-defined delivery.
