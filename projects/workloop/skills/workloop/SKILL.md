---
name: workloop
description: Use when the user requests workloop goal clarification, design, planning, execution, independent verification, project-defined delivery, supervision, initialization, or continuation of a workloop Task.
metadata:
  version: "0.1.6"
---

# workloop

Guide a Task from a clear goal through implementation, independent verification, and project-defined delivery. These instructions guide Agent behavior; they do not enforce it programmatically.

## Resolve the request

Read this entry in full. Resolve the actual request, project, effective requirements, scope, and permission from the user, applicable guidance, and current context. No new arguments does not mean no Task context: continue when the current Task and goal are clear, and ask for missing information only when they cannot be resolved. Quoted, explained, or edited instructions do not request their execution. An orientation request receives an explanation.

Require tk for durable Task management through its public interface and the applicable interface guidance, such as tk-cli. Do not depend on tk's implementation files. Other Skills and collaboration tools apply only to activities that need them. Setup and orientation do not require a placeholder Task.

## Load the activity

Follow links from this actual installed directory. Read the selected body in full, then its references at their stated conditions. Do not scan every reference or load unrelated operations.

- [Clarify](./operations/clarify.md): resolve goals, investigate, design, and form or revise a Plan.
- [Execute](./operations/exec.md): implement in the current session and coordinate checks.
- [Verify](./operations/verify.md): independently assess preparation materials or an executed candidate.
- [Ship](./operations/ship.md): perform the delivery defined by the project.
- [Supervise](./operations/supervise.md): schedule independent Workers without implementing their work.
- [Setup](./setup.md): initialize or update external defaults when requested; it is not a prerequisite to installation or ordinary use.

## Preserve the contract

Use the user's language, applicable project writing rules, and a writing Skill such as well-said when available. Preserve facts, decisions, conditions, negation, attribution, and genuine uncertainty.

Distinguish confirmed requirements, user-supplied constraints, proposals, observations, and temporary restrictions. Code, generated materials, tests, or completion claims do not establish approval. A motivation adds no acceptance gate. Resolve contradictions against effective decisions; do not silently replace the goal, reduce scope, or remove a capability. Question unnecessary, infeasible, or harmful work with evidence. A deferred capability is not permanently prohibited. Reopen only affected work and preserve completed results.

workloop serves new tasks without old entry aliases or material-name migration. Continuing, repairing, and recovering its own Tasks remains supported. Respect the requested operation's permission; producing materials or passing checks grants no unrelated action or Task closure.

Act without proactive tool, environment, or file-availability preflight. After an actual failure, record it and obtain only the facts needed to resolve it under the available permission. Do not invent substitutes, hide missing prerequisites, or weaken acceptance.

## Recover instructions

Preserve the current operation, effective scope, and restrictions in recoverable session state. Each activity states its additional state needs. If this entry, the selected body, or a currently required reference has left context, reload it from its actual installed location before acting. A remembered path is not loaded text. Reconcile saved state with actual effects so completed work and pending assignments are not repeated. No particular persistence API is required; rereading supplies instructions, not proof of compliance.
