# Clarify

Apply the loaded [entry](../SKILL.md), then read [Task ownership](../references/task.md) before resolving materials. Clarify covers goal discussion, necessary investigation, design, and planning. It may maintain ordinary analysis materials and necessary temporary files, but grants no implementation, configuration, Git, or managed-metadata changes.

## Resolve the request

Read the owning Task, current goal, relevant decisions, existing materials, and project rules. Distinguish initial discussion, a design question, Plan creation, and revision. Use settled information without restarting a completed interview. Establish the problem, intended result, scope, constraints, and stopping conditions only where missing.

Question usefulness and feasibility before selecting a solution. Honor discussion-only, design-only, no-plan, pause, no-write, and other explicit limits.

## Investigate

After resolving the request and before investigation, decide whether the work is larger than one working session or its route still depends on unresolved questions. When that condition holds, read [wayfinding](../references/wayfinding.md). Continue an existing map with the same reference. Small, clear work and its ordinary revisions skip the map.

Read project facts and patterns first. Use local or public research where facts are missing. Start from an existing research summary and trace underlying sources when needed. Apply research, diagnosis, architecture, or interview Skills only when their entry conditions apply.

Explain unresolved consequential choices with alternatives, evidence, recommendation, and the decision needed. Use the permitted interview method, including structured questions where allowed. Do not decide user-only priorities or treat an Agent proposal as a requirement.

## Maintain materials

Reuse the owning Task's established files:

- `goal.md`: confirmed requirements in natural language, intended result, relevant cases, constraints, exclusions, and completion or justified stopping conditions. Exclude implementation methods and code detail.
- Optional `design.md`: how to achieve the goal using the existing system and smallest adequate change. Include consequential alternatives, ownership, dependencies, failure behavior, algorithms, data structures, or implementation detail only where needed.
- Optional diagnosis: symptoms, actual conditions, evidence, and supported or uncertain causes. Keep repair methods and recommendations in design, not diagnosis.
- Optional research: a summary with traceable sources, separating observation, conclusion, and assumption.
- Optional Grill, commonly `grill.md`: the interview discussion without replacing current requirements and decisions.
- `plan.md`: the complete work arrangement described below, containing executable units only. It is required before Execute, including for a one-unit task.

Match acceptance to confirmed requirements or necessary evidence. Do not invent benefit metrics, migration, installation, or experiments. A design-only request may maintain design without forcing other materials or a Plan.

If work is infeasible, unnecessary, or the user decides not to continue, save the supported conclusion within recording permission and end without forcing a Plan. Follow tk and project permission if closure is appropriate; stopping here neither forbids nor grants it.

## Form the Plan

When the current planned scope has clear goals, necessary design, material choices, unit results, and acceptance, with every question and vague area affecting the execution contract resolved, form the Plan and self-check in this same Clarify operation. Honor discussion-only, design-only, no-plan, pause, and writing restrictions. Act on the request directly; a routine planning confirmation adds nothing. Implementation needs its own authorization.

Read [execution constraints](../references/execution.md) when forming the Plan, arranging dependencies, and resolving permission. Clarify retains its permitted interview method. Resolve choices that can be settled here rather than routinely postponing them. Keep blockers and unresolved questions in Clarify materials, normally the wayfinding map; a Plan contains complete executable contracts only. When a blocker remains, keep the preparation materials; the Plan forms once the contract is complete.

Preserve unit labels, completed results, and valid evidence. A Plan may mix inline units and links to tk subtasks. Each unit names its result, basis, dependencies, acceptance, permissions, and material owner. A child that owns Plan work must complete its contract and any required Plan before that work becomes executable. Detailed contracts and evidence remain with the subtask; readiness is judged from those materials. Create subtasks under tk permission, not to obtain a directory.

When a subtask needs separate discussion or preparation, complete that preparation before planning its implementation. Link existing materials; the child's Plan forms with its completed contract. Read the results before that implementation and update the Plan's dependencies and links. The subtask's final result includes its prepared implementation. When the current scope still has an unclear child, keep the full scope in the goal and preparation materials; the parent Plan forms once the child contract is complete. An explicit user decision defines an independent implementation subset; form a complete Plan for that subset and leave the remaining scope in the Task's materials. Changing confirmed scope requires an effective user decision.

Each action-ready unit defines a complete independently assessable result, goal and design basis, changes and non-goals, prerequisites, observable acceptance, checks, permission needs, and material owner. Order real dependencies and identify independent work. Use verified predecessor candidates where permitted; distinguish them from genuinely required deployments, services, or published artifacts. Integration, delivery, and expensive trials need their own requirement and grant.

## Check the materials

After forming a Plan, read [self-check](../references/self-check.md) and follow its role and collaboration links when starting inspection. Check current goal, design, Plan, linked details, discussion decisions, project rules, dependencies, foreseeable permissions, and writing. Check separately whether the Clarify materials faithfully cover the confirmed scope and its subtasks, and whether a delivered Plan contains only resolved contracts. A recorded question stays in Clarify, and a ready subset leaves the remaining unresolved scope in the Task's materials. This check covers plan quality; tool and environment checks run at their own step. Dependency installation, Git state changes, and formatting outside authorized materials belong to those steps.

Each Clarify round is a separate preparation phase with its own preparation self-check count. A new round starts when Clarify is entered again after a previous round returned, for a new request, a material or design defect returned from Verify, Execute, Supervise, or Ship, or changed requirements or basis. A request received while the round is still active, a material revision, a repair, a recheck, or independent preparation feedback stays in the same round. Session recovery, compaction, or another agent continuing the round also stays in the same round. A round declared only to obtain a fresh count remains the same round. The self-check reference owns counting. Record the round's trigger, basis, candidate, count, and limit in the preparation record.

Save this automatic check in the established preparation self-check record, normally `plan-check.md`; `material_check.md` and `verification.md` hold independent reviews. Repair as author under the shared inspection rules. An unresolved significant requirement returns to discussion.

Independent preparation review starts on user request; self-check exhaustion leaves the review optional. Then read [role selection](../references/roles.md) and [collaboration](../references/collaboration.md), freeze the materials, and assign [Verify](./verify.md). The verifier determines the report under that operation; independent preparation review uses `material_check.md`. A report exists only after a requested review.

The review request covers in-scope author repairs and necessary rechecks by the same suitable verifier until a current pass or real blocker, unless limited to one round, report-only, or a narrower scope. The verifier remains read-only; the author repairs. Unable to determine leaves the result open.

## Return

Save permitted results and preserve earlier failures with their scope and candidate. Return material paths, established result, self-check count and verdict, requested independent outcome, and actual blockers. Keep the current Task, basis, material revision, inspection count and limit, effective restrictions, and next action in recoverable state.

Finish within Clarify and return the Clarify result. Execution starts under a separate request within its own scope and permissions. Preparation and review stay preparation.
