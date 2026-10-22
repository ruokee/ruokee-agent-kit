# workloop

English | [中文](./README.zh.md)

workloop is a Markdown workflow for Agent tasks: clarify the goal, implement a Plan, independently verify results, and deliver what the project defines. It requires tk for durable Tasks and uses the target Harness's existing Skill loading mechanism. It contains no workflow runtime or programmatic action enforcement.

## Use a Skill

Choose the complete English [workloop](./skills/workloop/SKILL.md) or Chinese [workloop-zh](./skills/workloop-zh/SKILL.md) directory. Both are independently discoverable and contain the same required contract, all operation bodies, and setup guidance. Load the selected Skill through your Harness and request an operation in natural language. Keep the whole directory, not just `SKILL.md`.

Install tk separately and use its public interface under the project's Task rules. Collaboration uses the selected supported terminal tool; Herdr is recommended, not required. Other Skills are used for relevant activities under their own entry rules, not installed or made mandatory by this component.

workloop is for new tasks. It continues and repairs its own Tasks across sessions but does not migrate old workflow entries or material names.

## Install

Follow [installation](./docs/installation.md) for complete-directory copying, supported links, updates, removal, and reload conditions. Standalone Skills use the target Harness's existing mechanism. OMP additionally supports the `@ruokee/workloop` resource package with both Skills and `/wl-clarify`, `/wl-exec`, `/wl-verify`, `/wl-ship`, and `/wl-supervise`. The commands load an explicit language choice or default to English.

The repository's ordinary Skill installer does not manage this component. The OMP package contains only resources, with no Extension, build step, or runtime dependencies.

## Choose an operation

- **Clarify** resolves goals, performs necessary research or diagnosis, develops design, and forms or revises `plan.md`. A known goal can go straight to planning. A design-only request stays design-only.
- **Execute** implements in the current session and coordinates self-check and independent Verify. Without a narrower limit, it continues the remaining Plan, usually one unit at a time and several serially.
- **Verify** independently evaluates specified materials or an implementation candidate without editing it. Each report names its candidate, evidence, verdict, and limits.
- **Ship** performs the delivery defined by the project under the actual request and permissions. It need not mean production release or Task closure.
- **Supervise** schedules independent Workers instead of implementing itself. It can assign independent units to separate Workers while preserving each unit's review boundary.

Check is preparation's implicit material inspection. Start and End describe workflow positions; they are not additional commands. Goal discussion and Plan completion do not start execution or invite it in the closing reply.

## Keep materials focused

The owning tk Task holds the materials. `goal.md` states the desired result and stopping conditions without implementation methods. Optional `design.md` explains the approach. Optional diagnosis records the problem and supported causes without repair recommendations. Research summarizes sources; Grill preserves discussion.

Every task entering Execute needs an independent `plan.md`, even a single-unit change. It can expand some units inline and link others to tk subtasks. Execution records preserve candidates and checks; `verification.md` appends each independent assessment without replacing earlier failures. Optional materials need no empty files or role matrix.

## Understand checks

A formed Plan receives preparation self-check by default. Preparation's independent Verify starts on user request and includes necessary in-scope author repairs and rechecks unless the user limits it. Implementation requires both quick self-check and independent Verify for each unit.

Self-check defaults to a selected maximum of three to five inspections, overridable in external guidance. A pass ends early. Preparation and each implementation unit count separately; revisions and Verify feedback do not reset the count. At the limit, stop adding self-checks, finish actionable repairs, and report unrechecked changes. Independent Verify has no self-check limit.

Execution normally needs no repeated confirmation for in-scope implementation, repairs, checks, or independent Verify. It prohibits structured question tools by default; indispensable user-only decisions are raised in ordinary text. `confirm` requests item-by-item confirmation without removing checks or enabling structured questions. `nowait` changes cross-session request waiting, not self-check barriers or permission.

Verification, user acceptance, integration, installation, publication, and Task closure are distinct. Verified dependency candidates can support subsequent development under project rules without integration permission. Changed candidates require affected evidence to be refreshed.

## Examples

Use the selected Skill name and your actual Task reference in the request. No host-specific slash command is required.

```text
Use workloop to clarify this idea and save the agreed goal.
Use workloop to write a one-unit Plan for the already-confirmed goal.
Use workloop to discuss the design only. Do not form a Plan or implement it.
Use workloop to execute the remaining Plan for this Task.
Use workloop to execute only U02 for this Task.
Use workloop to supervise the independent units in this Plan.
Use workloop to independently verify these preparation materials.
Use workloop to ship this candidate according to the project's delivery definition.
```

For Chinese guidance, request `workloop-zh` and express the operation in Chinese. Either language supports the complete workflow. An infeasible or unnecessary task may stop after a supported conclusion, with any closure handled through tk's applicable permission rather than a forced Plan.

## Configure defaults

Initialization is optional. Ask to initialize or reconfigure the selected Skill; its short setup link leads to the full instructions. Settings belong in appropriate external guidance such as `AGENTS.md`: independent role models and reasoning, the two self-check limits, collaboration choice, project work conventions, and Ship's intended result. A Senior default model does not activate a Senior.

Explicit current choices override continuing choices, which override applicable defaults. Preserve exact model selectors and aliases. workloop does not embed machine-specific models or create a user/project configuration hierarchy. Ordinary operations do not perform proactive availability checks; actual errors lead to focused diagnosis.

## Recover work

Retain Task, operation, scope, candidate, permissions, explicit prohibitions, inspection count, and next action in state that survives compaction. When the full contract or current operation leaves context, reload it from the selected installed Skill. A remembered link is not a loaded body. No particular Pin API is required.

## Validation scope

The distributed material is instruction text. Directory completeness, internal links, and scenario walkthroughs can be checked without a live Harness. Host discovery, actual Agent behavior, and user outcomes need their own exercised evidence; a file check does not prove them. Keep those claims separate when evaluating a particular installation.
