# Clarify

Read the [common contract](../SKILL.md) in full, then apply this operation to the user's actual request. Clarify includes goal discussion, necessary investigation and design, and planning. It does not authorize implementation.

## Resolve the request

Read the owning Task, current goal, relevant decisions, existing materials, and project rules. Determine whether the user wants an initial discussion, a specific design question, direct Plan creation, or revision of existing materials. Use what is already clear; do not restart a finished interview because the entry point is the same.

For a new idea, establish the problem, intended result, scope, constraints, and conditions for stopping. Assess whether action is useful and feasible before choosing a solution. For a known goal, move directly to the requested design or Plan work. Honor discussion-only, design-only, no-plan, pause, and no-write limits.

## Investigate

Read project facts and existing patterns first. Use local or public research where facts are missing; start from an existing research summary and trace individual evidence when necessary. Apply relevant research, diagnosis, architecture, or interview Skills according to their entry conditions, rather than making every activity mandatory.

A diagnosis records symptoms, actual conditions, evidence, and supported or uncertain causes. Keep repair suggestions out of that report. Develop repair approaches in design when the user wants them. Distinguish measurements and observations from conclusions or assumptions.

For unresolved user requirements or consequential tradeoffs, explain the alternatives, evidence, recommendation, and decision needed. Use the applicable interview method, including structured questions only where allowed. Check available facts before asking. Do not decide user-only priorities or convert an Agent proposal into a confirmed requirement. Preserve the discussion record when an interview occurs.

## Define the result

Save confirmed requirements in `goal.md` using natural language: what should happen, which cases and constraints matter, what is outside the current scope, and how to recognize completion or a justified stop. Keep implementation details in optional `design.md`. Match each acceptance condition to a confirmed requirement or necessary evidence; do not add benefit metrics, migrations, installations, or experiments to make the plan look comprehensive.

Necessary design belongs within Clarify. Explain how the goal can be achieved using the existing system and the smallest adequate change. Include consequential alternatives and their actual tradeoffs, ownership, dependencies, failure behavior, and implementation detail only where needed. A design-only request may maintain `design.md` without forcing the other materials or planning.

If the work is infeasible, unnecessary, or the user decides not to continue, save the conclusion and its basis. End the operation without creating a Plan merely to fill a stage. When closure is appropriate, follow tk and project lifecycle permission; stopping at Clarify neither forbids closure nor grants it automatically.

## Form the Plan

When the user has decided to pursue execution, naturally form the required `plan.md` within Clarify. Do not ask a routine extra question just to move from goal discussion to planning. This is preparation for execution, not permission to start it. Explicit limits still apply, and real unresolved choices must be settled rather than hidden in the Plan.

Every executable task has a Plan, even if it contains one short unit. Preserve existing labels, completed results, and valid evidence when revising it. Read linked subtasks before changing their parent contract. Use a mix of inline units and tk subtask links when useful; create tasks only under tk's applicable permission, not merely to obtain a material directory.

For each unit provide an independently assessable result, its goal and design basis, changes and non-goals, prerequisites, observable acceptance, required checks, permission requirements, and material owner. A linked unit may leave its detail in the subtask while the parent keeps its goal, dependency, and link. Choose units with enough result value to justify independent Verify and small enough to implement and review completely.

Order actual dependencies and identify independent work. Distinguish a code dependency available from a verified predecessor candidate from an external deployment, service, or published artifact that must really exist. Do not make an ungranted merge a development prerequisite when the project permits verified dependency branches. Do not add delivery, installation, or expensive real-model experiments without a requirement and the relevant grant.

Write a Plan another Agent can execute without inventing product choices. Resolve foreseeable user decisions during preparation; do not leave a "decisions pending" list as the execution contract. If a decision really remains missing, state the blocker outside the action-ready Plan and preserve the settled work.

## Check the materials

After forming a Plan, initiate preparation self-check under the common inspection contract. Compare the current goal, design, Plan, linked subtask materials, and relevant discussion decisions. Check changed requirements propagated correctly, no capability or condition was lost, units are complete, dependencies are usable, and foreseeable permission or product decisions have been addressed. Check writing and project-document rules as applicable.

This is a materials check, not a tool, environment, or file-availability preflight. Do not install dependencies, change Git state, or run a formatter that writes beyond the authorized materials under this analysis permission.

Repair in-scope material issues as author, then use a fresh read-only inspection while below the selected limit. Apply early pass, cumulative counts, and limit exhaustion exactly as the common contract states. An unresolved requirement or significant choice returns to discussion, not an invented solution.

Preparation's independent Verify is not automatic. When the user requests it, freeze the current materials and use the selected isolated verifier with the owning Task, material scope, candidate locator, and reply owner. The user request covers in-scope author repairs and rechecks by that same verifier until a current pass or a real blocker. Honor an explicit one-round, report-only, or narrower limit. Verify remains read-only; it does not take over the author's repairs. Unable to determine is not passed.

## Return

Save the permitted materials and check results. Return their paths, the established result, the inspection count and verdict, independent Verify outcome when requested, and genuine remaining choices or blockers. Keep earlier failures with their original scope and candidate. Do not claim implementation from a completed goal, design, Plan, or material review.

Finish within Clarify. Do not invite, recommend, or ask to start execution at the end of a preparation request. Execute only if the user actually requested execution as well, under its own scope and permissions.
