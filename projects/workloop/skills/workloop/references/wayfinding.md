# Wayfinding

Read this reference after [Clarify](../operations/clarify.md) resolves the request and before investigation, when the work is larger than one working session or its route still depends on unresolved questions. Continue an existing map with this reference instead of rebuilding it. A small, clear Plan and ordinary revisions to it need no map. A large job with an already clear route may proceed directly to design and a Plan; the map reflects actual unresolved questions. This reference supports Clarify only, within its existing entry, lifecycle, and execution mode.

## Keep the map in Clarify materials

The map belongs to the owning Task's Clarify materials and normally lives in `design.md`. Use an existing dedicated material when one exists; established materials keep their location. Keep in it:

- Destination and boundary: the confirmed goal and the work it excludes. Refer to the confirmed goal; the goal stays the single requirement source.
- Context, references, and long-term preferences. These give background; execution needs its own permission.
- Decisions already made, one line each with a link to the full design and evidence, which remain in their own materials.
- Areas not yet stated precisely. Move them into the question list once they become clear; implementation steps form after resolution.
- Open questions that can be stated precisely, with their real dependencies, the method that can resolve them, the required evidence or user decision, the completion condition, and the material owner.
- Out-of-scope items and why. Correct mistaken entries; reducing confirmed scope still requires an effective user decision.

Use meaningful titles or existing material identifiers. Do not occupy the Plan's `U01` unit sequence or introduce a decision unit type. Existing tk subtasks keep their own materials; the parent's preparation materials cover the whole confirmed scope and link child results rather than creating a subtask per question.

## Resolve questions

Research, prototypes, interviews, and preparation are methods within Clarify, separate from unit types and lifecycle.

- Research reads local or external material and produces evidence. Complete facts leave the choice of approach to the user.
- A prototype gives the user something concrete to judge. Clarify may produce an approved sketch or sample text; implementation code, configuration changes, and external actions follow their own permission. A prototype that must run first becomes its own limited executable work with a goal, method, and acceptance under the Execute Plan and check rules; its result returns to the main Clarify.
- An interview handles only material choices that facts and existing requirements cannot answer. The user sets priorities.
- Preparation records external conditions that block a decision. Completion requires the condition to actually hold; a request or checklist marks progress, and external actions follow their own permission.

Focus on the current question in real dependency order. After it is resolved, update decisions, dependencies, and vague areas, then continue with whatever the current request permits. A session may resolve several decisions, and the current request decides when to continue after building a map. Explicit subsets, human checkpoints, and real blockers still apply. Follow existing collaboration permission for parallel research; keep one editor per map and keep live session routes in recoverable session state.

## Form the Plan

Form `plan.md` only when the current planned scope has clear goals, necessary design, material choices, unit results, and acceptance, with every question and vague area affecting the execution contract resolved. When a blocker remains, keep the preparation materials; the Plan forms once the contract is complete.

The Plan contains complete, independently assessable units and real dependencies. It may link settled design and evidence. Alternatives awaiting a choice, decision records, pending child clarification, and steps that first research what to do stay in Clarify materials. Labels such as `U01` identify execution units only.

A child that owns Plan work must complete its contract and any required Plan before that work becomes executable. When the current scope still has an unclear child, keep the full scope in the goal and preparation materials; the parent Plan forms once the child contract is complete. When the user explicitly names an independent implementation subset, form a complete Plan for that subset and leave the remaining scope in the Task's materials.

Units start as their dependencies allow; later units may depend on earlier results, and a service or deployment prerequisite still depends on its actual state. Execute, Ship, and protected actions need their own permission.

## Return after execution starts

A new fact during execution may invalidate the current contract. Record the affected unit and its basis, and return the question and options to Clarify materials. Preserve the Plan record, completed candidates, and still-valid evidence; continue authorized work with clear, unaffected contracts. After clarification, revise the affected contract; the revised Plan stays complete and executable.

## Check boundary

Preparation checks judge separately whether Clarify materials faithfully cover the scope and whether a delivered Plan contains only resolved contracts. Before a Plan is delivered, the design discussion stands on its own; once delivered, a contract that still needs clarification fails. Formal Markdown delivery and separately authorized prototypes receive implementation checks as their actual objects, including when they serve Clarify. Self-check rounds and counting keep their existing rules; a question stays within its preparation round.
