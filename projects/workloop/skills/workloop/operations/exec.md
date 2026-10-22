# Execute

Read the [common contract](../SKILL.md) in full. Implement in the current session and coordinate self-check and independent Verify directly. No Supervisor is required. Follow the project's working conventions.

## Resolve the scope

Read the owning Task's goal, `plan.md`, relevant design and decisions, dependencies, current implementation, acceptance, and existing execution evidence. A separate Plan file is mandatory, including for a one-unit task. If it is missing or not action-ready, return the affected planning work to [Clarify](./clarify.md); do not invent requirements while implementing.

Select the named unit or subset when the user limits the scope. Otherwise start at the current or first unfinished dependency-ready unit and complete the remaining Plan. A session usually handles one unit at a time and may finish several serially. Quoted controls, examples, or negations do not alter scope or permission.

Execution normally continues implementation, repair, self-check, independent Verify, and necessary rechecks without intermediate confirmation; neither `auto` nor `noask` is required. Do not use structured question tools; use ordinary text for an indispensable user-only decision. `confirm` requests item-by-item confirmation while preserving required checks and the prohibition on structured questions.

Keep scope, ordinary operation permission, protected permissions, collaboration waiting, and user acceptance separate. Resolve roles and any explicitly assigned Senior under the common contract. Record current basis, candidate, inspection count and limit, and next action in recoverable session state.

## Implement a unit

Reuse the project's existing patterns and make the complete requested change. Preserve unrelated work and effective requirements. Prepare only the local environment and temporary processes actually needed by the authorized implementation and checks. Do not add environment preflight, hypothetical features, compatibility shims, or fallback behavior unrelated to the goal.

Update affected callers, contracts, and documentation together. Exercise the changed path, run required checks, and repair in-scope failures without weakening acceptance. Record actual conditions and observations, not just exit status. Follow project rules for candidate commits and keep a stable candidate for inspection.

Save substantive results in the owning execution record: unit, branch or change location, dependency base, candidate identity, completed behavior, inputs, observations, check commands and outcomes, coverage, deviations, and remaining limits. Keep initial failures and later repairs traceable. Preserve reconstruction sources instead of treating installed dependencies as evidence. Stop owned temporary processes before authorized cleanup.

A design defect or material contradiction returns the affected work to Clarify. An implementation deviation is repaired here. Continue unaffected ready work where possible without expanding scope. An unresolved product decision or unavailable required capability is a blocker, not a reason to return a plausible partial implementation as complete.

## Use verified dependencies

When a later unit needs verified predecessor code that has not been integrated, preserve the predecessor with local task-owned commits and use its verified branch tip as the later unit's base under the project's branch conventions. Record each unit's base and candidate so its change remains independently reviewable. Freeze completed predecessors instead of mixing later changes into their candidates.

Lack of integration permission does not block development from a valid verified dependency. Do not merge merely to make a later unit start. A real dependency on deployed services, published artifacts, or other external state still needs that state. If a predecessor changes, refresh affected descendants and rerun their affected checks and Verify. Leave candidates available for ordered review and delivery unless integration itself has been authorized.

## Self-check

After implementation and exercised checks, start the selected fresh read-only checker with the unit basis, candidate, evidence, and authorized report location. Use the common inspection policy, including the configured or selected three-to-five default limit, final-result waiting, early pass, and cumulative unit count. Do not edit the target until the final inspection result is collected.

Repair actionable findings and rerun affected checks. Request another fresh inspection only below the unit limit. Stop quick inspections on a current pass or at the limit. Independent Verify feedback never resets the count. At the limit, finish repairs and report which changes lack a later quick inspection; unresolved required work still blocks completion.

## Obtain independent Verify

Implementation requires independent Verify even when self-check passes. Launch or reuse the selected isolated verifier directly under the execution grant, with no routine extra permission question. Apply the common coordination rules and the selected tool's interface. Supply the owning Task, current unit, frozen candidate location, and live reply owner. Request the workloop Verify operation and let the verifier read its own instructions and basis.

Wait for the assignment's final result by default, including the host's blocking wait when the collaboration command continues in the background. Explicit `nowait` permits returning with a saved pending assignment; on the final result resume this execution without asking for another continue instruction. Do not redispatch an already-pending request.

Check sender, unit, candidate, and saved report. On changes required, repair in scope, exercise affected behavior, preserve updated evidence, freeze the new candidate, and request recheck from the same verifier. Do not restart the quick-inspection count. On unable to determine, address the specific missing evidence or prerequisite; do not relabel it as pass or failure. Missing or conflicting reports require clarification.

Use an assigned Senior for implementation choices and in-scope clarification under the common role contract, not as a replacement verifier or a source of protected permission. Complete the affected repair and recheck cycle without routine intermediate confirmation. Honor explicit limits on the actual execution request.

## Continue the Plan

After a current independent pass, save the unit result and begin the next authorized dependency-ready unit in the same execution. Do not stop merely for user acceptance or integration of the predecessor. A supervised Worker stops at its assigned boundary and sends its owner a final result, so the owner can continue the wider Plan.

If every remaining unit is genuinely blocked, save each blocker, the finished candidates, and the precise fact, state, or permission needed. Do not reduce the goal to the units already completed. If the whole selected scope is complete, return its candidates together for user review. Integration and Ship require their own effective permission, not another implementation loop.

## Return

Save the execution record and link each independent report rather than copying it. Return concise per-unit results:

- Task, unit, branch or change location, base, candidate, completed result, and material paths.
- Exercised behavior, checks, observations, evidence, coverage, and limits.
- Quick-inspection result and completed count, including later repairs and unrechecked changes.
- Independent Verify verdict and report, with its exact candidate and scope.
- User-review or advance-approval state, actual delivery state, and concrete blockers or remaining requirements.

Do not claim merge, installation, restart, publication, or Task closure from execution completion. Leave a verified but unintegrated result intact for the project's delivery procedure.
