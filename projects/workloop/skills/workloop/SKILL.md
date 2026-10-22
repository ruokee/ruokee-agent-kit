---
name: workloop
description: Use when the user requests workloop goal clarification, design, planning, execution, independent verification, project-defined delivery, supervision, initialization, or continuation of a workloop Task.
metadata:
  version: "0.1.0"
---

# workloop

Guide a Task from a clear goal through implementation, independent verification, and the delivery its project defines. Apply this common contract and the requested operation together. Instructions guide Agent behavior; they do not enforce it programmatically.

## Enter

Read this file in full before acting. Resolve the requested operation, current project, owning Task, effective requirements, scope, and permissions from the user and applicable guidance. Do not execute an operation merely because its instructions are quoted, explained, or edited. An orientation request receives an explanation, not implementation.

Require tk for durable Task management. Use its public interface and applicable task-management instructions, such as the tk-cli Skill when using its CLI. Do not import or read another component's implementation files. Other Skills and collaboration tools are needed only for the activities that use them; naming an example does not make it a universal prerequisite.

Use the complete installed Skill and natural language to select an operation. Read only its body, following links from this actual loaded location:

- [Clarify](./operations/clarify.md): resolve goals, investigate, design, and form or revise a Plan.
- [Execute](./operations/exec.md): implement in the current session and coordinate checks.
- [Verify](./operations/verify.md): independently assess materials or an implementation candidate.
- [Ship](./operations/ship.md): perform the delivery defined by the project.
- [Supervise](./operations/supervise.md): schedule independent Workers without implementing their work.

For initialization or reconfiguration, read [Setup](./setup.md).

Use the user's language. Apply the project's writing rules and a writing Skill such as well-said when available. Keep facts, decisions, conditions, negation, attribution, and genuine uncertainty intact when revising materials.

Workloop serves new tasks. It does not recognize old workflow aliases or migrate old material names. Continue, repair, and recover Tasks begun with workloop under their existing identity and effective requirements.

## Preserve requirements

Distinguish confirmed requirements, user-supplied solution constraints, proposals, observations, and temporary restrictions. Existing code, a generated Plan, a test, or an Agent's completion claim does not establish user approval. A motivation does not create an acceptance gate. Resolve conflicting sources against current decisions, not whichever derived document is easiest to follow.

Read relevant sources before asking for facts already available. Question work that is unnecessary, infeasible, or harmful, and explain the evidence. Do not quietly replace the goal, reduce scope, or remove an existing capability. A deferred capability is not permanently prohibited. Preserve completed results and reopen only work affected by a changed requirement or finding.

## Own the Task

Resolve the owner through tk before assigning units or saving materials. Reuse the Task for the same effort. A parent, dependency, shared adviser, or earlier session does not automatically own a new result. Apply tk and project permissions to creation, relationships, metadata, and closure; do not edit managed metadata by hand.

Keep stable unit labels within the owning Plan, starting a new local sequence at U01. A Plan may expand a unit inline or link to a tk subtask containing its details. Read linked details when executing that unit. Preserve labels and finished units when revising a Plan; do not mechanically create a subtask for every unit.

A parent stores cross-unit decisions and links. Subtask results belong to that subtask. Stable results belong in materials, while live role choices, reply routes, pending assignments, and temporary permission state stay in session context.

## Save materials

A request for an operation authorizes saving its ordinary result materials by default. Reuse the owning Task's established files, read before updating, and save meaningful results as they settle and before returning. Explicit conversation-only, no-record, no-write, or narrower restrictions take precedence. If the destination genuinely remains unresolved, identify what is missing without writing elsewhere to evade the limit.

- `goal.md` states what is wanted, the expected result, constraints, and stopping conditions in natural language. It excludes implementation methods and code details.
- Optional `design.md` explains how to achieve the goal, including necessary architecture, algorithms, data structures, or implementation detail.
- Optional diagnosis records the problem, observed conditions, evidence, and supported or uncertain causes. It contains no repair method or recommendation; discuss those in design.
- Optional research provides a summary with traceable sources. Read that summary first, following underlying evidence when a fact needs checking.
- Optional Grill records the discussion process, commonly in `grill.md`, without replacing the current goal or decisions.
- `plan.md` is required before Execute, even for a simple or single-unit task. It defines executable units and may use linked subtask materials.
- `execution.md` records unit candidates, results, repairs, exercised checks, and limits, unless the Task already has an execution record.
- `verification.md` appends each independent assessment, bound to its scope and candidate. Preserve earlier assessments, including failures.
- `ship.md` records the actual project delivery result unless an established delivery record exists.

Optional activities need no empty materials or material-to-role matrix. Apply an auxiliary Skill's own recording rules to the activity that uses it. A request to save materials does not grant implementation, Git operations, configuration changes, or tk lifecycle transitions. Report a storage limitation and continue unaffected work; do not claim a required report was saved when it was not.

## Keep permissions separate

Clarify may maintain its ordinary analysis materials and necessary temporary files. This grants no code, configuration, Git, or managed-metadata changes. Discussion, design, and planning do not begin implementation, and their replies do not invite the next operation.

An explicit execution request normally authorizes the ordinary in-scope implementation, repair, project-local setup, checks, temporary processes, and local candidate-preservation operations required by the project. Do not repeatedly request those permissions. Respect project-specific protected-operation requirements and narrower instructions.

Execution does not automatically grant integration, push, publication, local installation, expense, privileged operations, or Task closure. Authorized temporary-directory file checks remain within their check scope. Resolve Ship actions from the project's delivery definition, the actual request, and still-effective grants; its name alone grants no fixed action bundle. Reuse permission without treating verification as acceptance or acceptance as an unrelated permission.

During execution and supervision, do not call structured question tools such as `ask`, or evade that prohibition through a wrapper or another Agent. Read evidence and make authorized choices. Put an indispensable user-only decision in ordinary text and continue unaffected work. Clarify retains its appropriate interview method. An explicit `noask` also prohibits structured questions and must survive recovery with that meaning.

## Inspect results

Use a fresh read-only checker context for each self-check inspection. The author repairs; the checker does not implement. Select the checker under the role rules below. Supply the Task, scope, candidate or material locator, applicable basis, exercised evidence, and report location. Request actionable findings with evidence and a final verdict; zero findings is valid. Wait for the native final-result barrier when using native subagents, regardless of `nowait`.

Choose a self-check limit from three to five according to task size and complexity unless an applicable instruction sets another limit. Preparation materials and each implementation unit have separate counts. First inspection and rechecks count together. A completed substantive inspection consumes one count; startup or communication failure does not. Revision and independent Verify feedback never reset the count.

A current pass ends self-check early, even on the first inspection. Otherwise repair in scope and request a fresh inspection only below the limit. At the limit, stop adding inspections, finish actionable repairs, and state unresolved findings and changes not rechecked by self-check. Neither exhausting the limit nor a pass on an older candidate establishes a current pass. Avoid repeated inspections for details without material effect on correctness, consistency, the goal, or actual use.

After a Plan is formed, self-check its materials by default. Preparation's independent Verify is optional and starts on user request, not because self-check reached its limit. Each implementation unit requires both self-check and independent Verify. Independent Verify has no self-check round limit. Do not use one kind of check as the other.

## Coordinate roles

Select each role's host, model, reasoning, and location independently from the current request, continuing choices, then applicable external defaults. Accept natural-language selections and preserve model aliases. Never infer Verify from the executor or silently substitute an unavailable model. Resolve a missing selection when that role is needed, following the current question restrictions.

Senior exists only when explicitly assigned for this execution; a continuing assignment remains effective until changed. A default model does not activate it. Consult that Senior for implementation choices and in-scope clarification within confirmed goals and constraints. Include Task, unit, basis, constraints, alternatives, decision needed, and live reply owner. Follow its recommendation within current requirements and grants. Goals, priorities, material requirement tradeoffs, and protected permissions remain user decisions. Senior cannot override requirements, expand scope, waive checks, or replace independent Verify.

Use the selected collaboration tool's supported interface and instructions. Herdr is recommended, not required; tmux or another terminal mechanism may be used. Start sessions at explicit working locations and discover live identities before sending messages. Start normally and send assignments as ordinary messages, never as injected system prompts. Do not operate another Agent's question dialog.

Reuse suitable Verify and assigned Senior sessions across units and rechecks, isolated from implementation. A verifier must not have implemented the target. Finish or recover a busy role's existing assignment before sending another; create a session only when no suitable one exists or replacement is requested. Freeze the candidate during review and do not send unsolicited mid-work messages or inspect a working Agent's private session files.

Wait for final results on cross-session work and advice by default. Use the collaboration tool's wait operation and, if it returns as a background command, the host's blocking final-result wait until a result or concrete blocker arrives. Do not poll or infer a verdict from lifecycle state. Explicit `nowait` alone permits dispatch without these cross-session waits, preserving the assignment and resuming on its final result. It changes neither native self-check waiting nor scope, checks, or acceptance. A final reply to an owner does not wait on that owner.

Assignments name the owning Task, unit, basis, exact scope, candidate or dependency base, grants and restrictions, required outcome, report destination, stopping point, and live reply owner. Send final-only results. A bounded Senior consultation is separate from a partial progress report. For independent Verify, provide the Task, unit or material scope, candidate location, and reply owner, and let the verifier resolve the basis rather than supplying an implementer's review checklist.

Check the returned sender, unit, candidate, verdict, and saved report before progressing. Missing, stale, truncated, or conflicting evidence needs clarification, not an inferred pass. Recover an already-saved result after delivery failure before redispatching. Do not repeat a possibly successful non-idempotent action without checking its effect.

## Establish evidence

Exercise changed behavior and run proportionate project-required checks. Record candidate identity, conditions, actual inputs, observations, evidence locations, coverage, deviations, and unverified areas. Source inspection, file checks, controlled providers, actual host or UI runs, and real-model runs prove different things. A test pass alone does not prove requested behavior. Do not add installation, expensive experiments, or success metrics without a requirement and the necessary permission.

A change invalidates affected evidence. Reuse unchanged evidence only with its identity and scope stated. Implementation, self-check, independent Verify, user review, delivery, installation, restart, publication, and Task status remain distinct.

## Recover context

Keep the operation, owning Task, unit, basis and entry location, current candidate, effective scope and grants, explicit restrictions, completed inspection count and limit, and next action in persistent context or session state that survives compaction. Keep live roles, routes, owned resources, and pending assignments separately from durable product materials. Use the host's available persistence mechanism; no particular Pin API is required.

Preserve restrictions in plain language, including "do not call structured question tools", not just `noask`. Replace revoked or changed permissions before acting. If the full common contract or current operation has left context, reread it from the actual installed Skill before continuing. A retained reference or a historical "read" claim is not loaded text. Reconcile saved state with current materials and effects; do not repeat completed work or pending dispatches. Reloading instructions is evidence of availability, not proof of compliance.

## Handle failure

Act within the selected operation without proactive tool, environment, or file-availability preflight. When an actual load or action fails, capture the error and obtain only the information necessary to address it. Apply relevant preparation or diagnostic guidance on demand. Do not invent substitutes, suppress missing prerequisites, or weaken acceptance to obtain success.

Return material contradictions or design defects to Clarify, implementation deviations to Execute. Reopen only affected work and preserve the overall authorized scope. Infeasible or unnecessary work may end after a supported conclusion and any required agreement; Task closure still follows tk and project rules. A real missing permission or fact blocks dependent actions, not unrelated ready work.
