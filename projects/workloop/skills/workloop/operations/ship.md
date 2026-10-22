# Ship

Read the [common contract](../SKILL.md) in full. Deliver the selected result according to the project's Ship definition, actual user request, and effective permissions. Ship has no fixed bundle of actions and is not necessarily production release or the end of the Task.

## Resolve delivery

Read the owning Task, goal, selected units and candidates, execution records, current independent verification, and the project's delivery guidance. Determine the requested outcome and what observable result completes it. Use an established project definition without requiring initialization again.

For example, a project may define Ship as submitting a PR for maintainer review, starting a local application for evaluation, or updating a Harness installation and conducting an authorized trial. These are alternatives among project definitions, not steps every project must perform. A PR delivery goal does not move Task management out of tk.

If the project has no Ship definition, use an unambiguous user request. If both leave a material choice unresolved, identify that choice and the minimum decision needed; do not invent a universal merge/install/release procedure or silently perform one. Respect current restrictions on questions and writes.

## Check readiness

Identify the exact result being delivered, its dependency order, current Verify coverage, acceptance state, and required project gates. A pass on another candidate or only part of this scope does not cover the delivery. Read saved reports, not just an Agent's pass message. Preserve valid evidence and repeat only checks invalidated by candidate or target changes or required by the project.

Separate user acceptance, advance approval, operation grants, and actual completion. A direct delivery request may authorize the project's routine delivery actions; reuse effective grants rather than asking for them twice. Establish acceptance from an explicit user statement or evidence meeting the project's acceptance conditions, not from the operation name alone. The request does not implicitly authorize unrelated targets or protected operations outside that definition. Verify alone supplies no delivery permission.

If the project requires integration, use its prescribed method and final-candidate checks. For a dependent branch stack, preserve each unit's identity and deliver in dependency order. Preparing a different integration candidate can invalidate affected evidence; recheck before treating it as verified. If the project instead targets a running service or a submitted PR, judge that actual target rather than imposing a merge as a universal prerequisite.

A missing required approval, permission, artifact, or external state blocks its dependent action. Complete unaffected authorized preparation without weakening readiness or presenting an unperformed action as done.

## Deliver

Perform only the resolved delivery actions. Reuse valid permissions for ordinary steps; obtain any project-required separate protected grant. Do not add push, publication, deployment, local installation, restart, expense, or destructive cleanup merely because the operation is named Ship.

Observe the actual destination and result. Installation is distinct from discovery, restart from successful loading, running from acceptance, submission from review, and release from user satisfaction. Use the project's completion conditions and record what was observed at the delivered candidate and destination. Stop only owned processes or resources whose control is authorized, and preserve reconstruction evidence before authorized cleanup.

On an evidenced implementation defect, return affected work to [Execute](./exec.md). On a goal, material, or design problem, return to [Clarify](./clarify.md). Preserve completed unaffected results. Delivery feedback may open a new tk Task when it has an independent goal or boundary, under task-creation permission; otherwise continue the current Task. Do not force every delivery to include a later effect-measurement stage.

## Return

Save the permitted delivery record with Task and scope, source candidate and actual delivered identity, target, project-defined outcome, actions and checks performed, observations, evidence locations, deviations, and remaining requirements. Link the relevant execution and verification records.

Report actual states separately: project goal achieved or blocked, running or submitted for review, acceptance result, integration, installation or restart when relevant, and publication or production release. Omit genuinely inapplicable states, not unfinished required work. If feedback requires another Clarify or Execute step, name its affected scope.

Reaching the project's current Ship target does not automatically close the Task. Apply tk and project lifecycle rules and the user's actual closure permission. Do not claim user acceptance or production delivery solely from the operation name.
