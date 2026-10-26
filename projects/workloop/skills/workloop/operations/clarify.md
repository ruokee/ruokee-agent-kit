# Clarify

Apply the loaded [entry](../SKILL.md), then read [Task ownership](../references/task.md) before resolving materials. Clarify covers goal discussion, necessary investigation, design, and planning. It may maintain ordinary analysis materials and necessary temporary files, but grants no implementation, configuration, Git, or managed-metadata changes.

## Resolve the request

Read the owning Task, current goal, relevant decisions, existing materials, and project rules. Distinguish initial discussion, a design question, Plan creation, and revision. Use settled information without restarting a completed interview. Establish the problem, intended result, scope, constraints, and stopping conditions only where missing.

Question usefulness and feasibility before selecting a solution. Honor discussion-only, design-only, no-plan, pause, no-write, and other explicit limits.

## Investigate

Read project facts and patterns first. Use local or public research where facts are missing. Start from an existing research summary and trace underlying sources when needed. Apply research, diagnosis, architecture, or interview Skills only when their entry conditions apply.

Explain unresolved consequential choices with alternatives, evidence, recommendation, and the decision needed. Use the permitted interview method, including structured questions where allowed. Do not decide user-only priorities or treat an Agent proposal as a requirement.

## Maintain materials

Reuse the owning Task's established files:

- `goal.md`: confirmed requirements in natural language, intended result, relevant cases, constraints, exclusions, and completion or justified stopping conditions. Exclude implementation methods and code detail.
- Optional `design.md`: how to achieve the goal using the existing system and smallest adequate change. Include consequential alternatives, ownership, dependencies, failure behavior, algorithms, data structures, or implementation detail only where needed.
- Optional diagnosis: symptoms, actual conditions, evidence, and supported or uncertain causes. Keep repair methods and recommendations in design, not diagnosis.
- Optional research: a summary with traceable sources, separating observation, conclusion, and assumption.
- Optional Grill, commonly `grill.md`: the interview discussion without replacing current requirements and decisions.
- `plan.md`: the complete work arrangement described below, including executable units and required subtask clarification. It is required before Execute, including for a one-unit task.

Match acceptance to confirmed requirements or necessary evidence. Do not invent benefit metrics, migration, installation, or experiments. A design-only request may maintain design without forcing other materials or a Plan.

If work is infeasible, unnecessary, or the user decides not to continue, save the supported conclusion within recording permission and end without forcing a Plan. Follow tk and project permission if closure is appropriate; stopping here neither forbids nor grants it.

## Form the Plan

When the goal and necessary design are clear and foreseeable consequential user choices for the work being made executable are resolved, form the Plan and self-check in this same Clarify operation. Honor discussion-only, design-only, no-plan, pause, and writing restrictions. Do not require an additional declaration of intent to execute or a routine planning confirmation. Preparation does not authorize implementation.

Read [execution constraints](../references/execution.md) when forming the Plan, arranging dependencies, and resolving permission. Clarify retains its permitted interview method. Resolve choices that can be settled here rather than routinely postponing them. Keep genuine blockers explicit in the Plan, separate from ready implementation contracts. A parent Plan covers its confirmed scope even when some or all child implementation contracts are not ready.

Preserve unit labels, completed results, and valid evidence. A Plan may mix inline units and links to tk subtasks. Keep every in-scope subtask in the parent Plan with its goal, material owner, current step, dependencies or blockers, and material links. Detailed contracts and evidence remain with the subtask. A Task index or discussion elsewhere does not replace this coverage. Create subtasks under tk permission, not to obtain a directory.

When a subtask needs separate discussion or preparation, include a named Clarify step with its inputs, expected goal, necessary design and Plan materials, completion conditions, and the return to remaining work in the parent Plan. Link existing materials; do not create an empty child Plan or invent its implementation contract. Unresolved user decisions keep that step blocked, not complete merely because the questions were recorded. After preparation, read its results and update the parent's next step, dependencies, and links before implementation. Preparation completion is not completion of the subtask's final result. Change the confirmed scope only under an effective user decision.

Each action-ready unit defines a complete independently assessable result, goal and design basis, changes and non-goals, prerequisites, observable acceptance, checks, permission needs, and material owner. Order real dependencies and identify independent work. Use verified predecessor candidates where permitted; distinguish them from genuinely required deployments, services, or published artifacts. Do not make ungranted integration a development prerequisite or add delivery and expensive trials without requirement and permission.

## Check the materials

After forming a Plan, read [self-check](../references/self-check.md) and follow its role and collaboration links when starting inspection. Check current goal, design, Plan, linked details, discussion decisions, project rules, dependencies, foreseeable permissions, and writing. Compare the confirmed scope and its subtasks with the parent Plan: missing clarification steps are omissions even when implementation is not ready. Check each step's result and continuation without treating complete coverage as implementation readiness. This is not tool or environment preflight. Do not install dependencies, change Git state, or format outside authorized materials.

Each Clarify round is a separate preparation phase with its own preparation self-check count. A new round starts when Clarify is entered again after a previous round returned, for a new request, a material or design defect returned from Verify, Execute, Supervise, or Ship, or changed requirements or basis. A request received while the round is still active, a material revision, a repair, a recheck, or independent preparation feedback stays in the same round. Session recovery, compaction, or another agent continuing the round also stays in the same round. A round declared only to obtain a fresh count remains the same round. The self-check reference owns counting. Record the round's trigger, basis, candidate, count, and limit in the preparation record.

Save this automatic check in the established preparation self-check record, normally `plan-check.md`, never in `material_check.md` or `verification.md`. Repair as author under the shared inspection rules. An unresolved significant requirement returns to discussion.

Independent preparation review starts only on user request, not because self-check exhausted its limit. Then read [role selection](../references/roles.md) and [collaboration](../references/collaboration.md), freeze the materials, and assign [Verify](./verify.md). The verifier determines the report under that operation; independent preparation review uses `material_check.md`. Do not create an empty report when no review was requested.

The review request covers in-scope author repairs and necessary rechecks by the same suitable verifier until a current pass or real blocker, unless limited to one round, report-only, or a narrower scope. The verifier remains read-only; the author repairs. Unable to determine is not passed.

## Return

Save permitted results and preserve earlier failures with their scope and candidate. Return material paths, established result, self-check count and verdict, requested independent outcome, and actual blockers. Keep the current Task, basis, material revision, inspection count and limit, effective restrictions, and next action in recoverable state.

Finish within Clarify. Do not invite, recommend, or ask to begin execution. Execute only if the user also actually requested it under its own scope and permissions. Completed preparation or review is not implementation.
