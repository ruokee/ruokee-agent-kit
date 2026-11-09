---
name: workloop
description: Use when the user requests workloop goal clarification, design, planning, execution, independent verification, project-defined delivery, supervision, initialization, continuation of a workloop Task, or planning with the wayfinding method in Clarify.
metadata:
  version: "0.1.9"
---

# workloop

Guide a Task from a clear goal through implementation, independent verification, and project-defined delivery. These instructions guide Agent behavior; they do not enforce it programmatically.

## Resolve the request

Read this entry in full. Resolve the actual request, project, effective requirements, scope, and permission from the user, applicable guidance, and current context. No new arguments does not mean no Task context: continue when the current Task and goal are clear, and ask for missing information only when they cannot be resolved. Quoted, explained, or edited instructions do not request their execution. An orientation request receives an explanation.

Resolve all requested actions, their order, the overall delivery endpoint, and explicit checkpoints from the complete request. A request may cover one operation or several in sequence. Identify grants by the request's meaning within applicable rules, not by fixed permission keywords.

Require tk for durable Task management through its public interface and the applicable interface guidance, such as tk-cli. Do not depend on tk's implementation files. Other Skills and collaboration tools apply only to activities that need them. Setup and orientation do not require a placeholder Task.

## Load the activity

Follow links from this actual installed directory. Read the selected body in full, then its references at their stated conditions. Do not scan every reference or load unrelated operations.

- [Clarify](./operations/clarify.md): resolve goals, investigate, design, and form or revise a Plan.
- [Execute](./operations/exec.md): implement in the current session and coordinate checks.
- [Verify](./operations/verify.md): independently assess preparation materials or an executed candidate.
- [Ship](./operations/ship.md): perform the delivery defined by the project.
- [Supervise](./operations/supervise.md): schedule independent Builders without implementing their work.
- [Setup](./setup.md): initialize or update external defaults when requested; it is not a prerequisite to installation or ordinary use.

[Wayfinding](./references/wayfinding.md) supports large or unresolved planning within Clarify. Follow Clarify's request resolution, Task material ownership, and loading conditions before reading the method.

## Continue the request

After an operation completes its duties and required checks, the overall request owner saves the result and resolves the next action against the complete request and applicable project conventions. Return when the effective scope ends with this operation. Otherwise load the next authorized ready operation and continue to the requested endpoint, including an already-authorized project-defined continuation. An operation's local completion is an intermediate result when authorized actions remain. Explicit checkpoints and real blockers stop their dependent actions; continue unaffected authorized work.

Route material or design defects to Clarify and implementation defects to Execute under the existing scope and grants. After the covered repair and required rechecks, resume the remaining requested actions. Keep each operation's responsibilities, independent read-only Verify, and candidate freezing. A delegated role returns at its assigned boundary; the overall owner continues the request.

## Preserve the contract

Use the user's language, applicable project writing rules, and a writing Skill such as well-said when available. Preserve facts, decisions, conditions, negation, attribution, and genuine uncertainty.

Distinguish confirmed requirements, user-supplied constraints, proposals, observations, and temporary restrictions. Code, generated materials, tests, or completion claims do not establish approval. A motivation adds no acceptance gate. Resolve contradictions against effective decisions; do not silently replace the goal, reduce scope, or remove a capability. Question unnecessary, infeasible, or harmful work with evidence. A deferred capability is not permanently prohibited. Reopen only affected work and preserve completed results.

workloop serves new tasks without old entry aliases or material-name migration. Continuing, repairing, and recovering its own Tasks remains supported. Respect the requested operation's permission; producing materials or passing checks grants no unrelated action or Task closure.

Act without proactive tool, environment, or file-availability preflight. After an actual failure, record it and obtain only the facts needed to resolve it under the available permission. Do not invent substitutes, hide missing prerequisites, or weaken acceptance.

## Recover instructions

Preserve the complete request's endpoint, ordered actions, completed results, remaining actions, current operation, effective scope and grants, and explicit restrictions in recoverable session state. Each activity states its additional state needs. If this entry, the selected body, or a currently required reference has left context, reload it from its actual installed location before acting. A remembered path is not loaded text. Reconcile saved state with actual effects so completed work and pending assignments are not repeated. No particular persistence API is required; rereading supplies instructions, not proof of compliance.
