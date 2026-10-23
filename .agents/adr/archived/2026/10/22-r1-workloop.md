# workloop

Decision owner: Ruokee
Decision writer: OMP GPT-6 Astra
Archived: 2026-10-23
Reversed by: [workloop](../../../decision/2026/10/22-workloop.md)

English | [中文](./22-r1-workloop.zh.md)

## Motivation

Provide workloop as a self-contained bilingual Skill for Agent task workflows.

Goal clarification, implementation, verification, and delivery need a common contract that remains available when a Skill is installed without its source repository. Keeping operation bodies outside the Skill makes standalone installation incomplete. Maintaining full workflows in both Skills and host prompts creates separate authorities for the same behavior.

The workflow needs both Harness-independent use and convenient OMP entry points. Markdown can express these instructions without a runtime, while a component directory can keep the complete Skills and optional host resources together. Packaging changes instruction discovery, not the Agent's ability to obey instructions.

## Decision

### Component

Maintain workloop under `projects/workloop/` as a first-party instruction component. It contains Markdown Skills, component documentation, and OMP resource packaging, without an Extension, runtime code, build system, or dedicated installer.

The English `workloop` and Chinese `workloop-zh` are independently discoverable Skill identities under `projects/workloop/skills/`. Each contains its complete common contract, operation bodies, and initialization guidance. Both languages provide the same capabilities and required instructions, change together, and carry the same component version. Do not maintain additional copies under the repository's ordinary Skill or variant roots.

Each installed Skill references only files inside its own directory. Its `SKILL.md` provides the common contract and operation index; operation bodies load on demand. Host prompts pass the operation, user input, and loading instructions without becoming another workflow authority. This applies the existing [component self-containment decision](../../../decision/2026/08/24-component-self-containment.md).

Require tk for task management through its name and public interfaces, without importing its implementation or referencing its files. Other tools or Skills become prerequisites only where the operation needs them. Installing workloop does not install tk or a collaboration tool. Task management through GitHub or GitLab Issues or PRs is deferred, not permanently prohibited; a project may still define submitting a PR as its delivery goal.

The component serves new tasks. It does not provide old entry-point aliases, old material-name compatibility, or migration of existing workflows and task materials. Continuing, repairing, and recovering tasks started with workloop remains supported.

### Operations

Expose `clarify`, `exec`, `verify`, `ship`, and `supervise` as the workflow operations.

- `clarify` resolves the goal and completion conditions, investigates or diagnoses when needed, develops necessary design, and produces or revises the execution Plan. A clear goal can proceed directly to planning. Every task entering execution requires a separate `plan.md`, including a simple or single-unit task. Deciding to proceed naturally includes planning without a routine extra permission gate, but producing materials never starts implementation. A design-only, discussion-only, paused, infeasible, or unnecessary task need not complete the other materials. Save the useful conclusion and apply the project's task-closure rules when work will not continue.
- `exec` implements the requested scope in the current session and coordinates its checks. Without a narrower limit, it continues the remaining Plan from the resolved starting point. A session usually handles one unit at a time and may finish several serially. Routine implementation, repair, self-check, independent Verify, and necessary rechecks do not require repeated permission. Execution prohibits structured question tools by default; indispensable user decisions are raised in ordinary text. `confirm` requests item-by-item confirmation without removing required checks or enabling structured questions.
- `supervise` schedules the resolved scope through independent Workers and does not implement their changes itself. It may assign independent units to different Workers; the overall scope and each Worker's assignment remain distinct. It has the same continuous-progress default as `exec`.
- `verify` independently judges current materials or a unit result against its goal, applicable Skills, project rules, and other effective requirements. The verifier is read-only and distinguishes passed, changes required, and unable to determine. Its verdict applies to a named scope and candidate, not all later changes.
- `ship` performs the delivery defined by the project under the request and effective permissions. It has no universal bundle of merge, cleanup, installation, deployment, or publication actions. Report the achieved project goal, running or submitted-for-review state, acceptance results, and production-release state with their evidence. Reaching that project's current delivery goal is distinct from production release, user acceptance, and task closure.

Check is an implicit preparation activity, not an additional required entry point. Start and End describe workflow positions rather than commands. Material problems and design defects return to `clarify`; implementation deviations return to `exec`. Delivery feedback may also return to `clarify`, or lead to another Task under the applicable task-management rules when it has a separate goal or boundary. Reopen only affected work, and never close a task merely because execution or delivery has ended.

### Materials

Keep materials by responsibility in the owning tk Task. `goal.md` describes the intended result and stopping conditions in natural language, without implementation methods. Optional `design.md` describes how to achieve that result. Optional diagnosis records the problem, observed conditions, and supported or uncertain causes, without repair proposals. Research provides a summary with traceable sources; Grill records the discussion. Optional activities do not require empty documents.

The mandatory `plan.md` defines executable units. A Plan may expand some units inline and link others to tk subtasks, preserving stable labels and completed results. Referenced subtask materials supply those units' detail without duplicating it in the parent. Size units for a complete result and a manageable independent review, rather than splitting by file or edit count.

Analysis may maintain its ordinary materials and necessary temporary files within the operation's permission. That does not grant implementation, configuration, Git, or managed-metadata changes. Material completion does not invite or launch the next operation. Verification records append each assessment with its candidate, scope, evidence, and verdict instead of rewriting previous results.

### Checks

After forming a Plan, perform a material self-check for inconsistent decisions, omissions, and foreseeable execution blockers. This is not an environment preflight. Unresolved requirements and consequential choices return to discussion. Preparation's independent Verify starts only when requested; that request covers necessary in-scope author revisions and rechecks by the same read-only verifier until a current pass or a real blocker, unless the user limits the review.

Preparation self-checks and implementation quick checks are read-only, with the author making repairs. Choose a default limit from three to five inspections according to the task, unless an applicable external instruction overrides it. A pass ends inspection early. Count preparation separately from each implementation unit, including first inspection and rechecks; neither revisions nor independent Verify feedback resets the count. At the limit, stop adding self-check inspections, finish actionable repairs, and report unresolved and unrechecked changes without inventing a pass.

Each implementation unit requires both self-check and independent Verify. Independent Verify has no self-check round limit. Preparation does not acquire an independent Verify requirement merely because self-checks reach their limit.

Exercise changed behavior and record the target, conditions, inputs, observations, evidence, coverage, and limits. Distinguish file and loading-path checks from actual Harness discovery and model behavior. Candidate changes invalidate affected evidence; a past pass does not cover a changed candidate.

### Coordination

Resolve each role independently from an explicit selection, a continuing choice, or an applicable external default. Do not infer Verify's model from the executor or silently replace an unavailable selection. Senior participates only when explicitly assigned; configuring its default model does not activate it.

Use the selected collaboration tool. Herdr is recommended, not required; another terminal collaboration mechanism must preserve role isolation, suitable session reuse, ordinary-message assignments, and final-result waiting. Reuse suitable Verify and assigned Senior sessions, keeping them separate from implementation. Every assignment resolves its current Task, unit, candidate, scope, and reply owner. Start sessions normally, without injecting assignments through system prompts. Freeze a candidate during its review.

Wait for final results by default; explicit `nowait` changes cross-session waiting, not native self-check barriers, execution scope, or acceptance. A final reply does not wait on its recipient. If a saved result was not delivered, recover that result before dispatching duplicate work. Routing and pending assignments are runtime state rather than durable Task content.

Execution permission does not supply protected permissions for integration, push, publication, local installation, expense, or task closure. Preserve explicit limits and reuse existing grants; authorized temporary-directory file checks remain within their check scope. A verified but unmerged predecessor can supply a later unit's development dependency without granting integration permission; a branch cannot substitute for a genuinely required external deployment or service state. Follow the project's working arrangement.

### Recovery

Retain the operation, Task, current unit and candidate, basis, effective scope, permissions, explicit prohibitions, inspection count, and next action in available persistent context or session state that survives compaction. Preserve the meaning of restrictions, including the prohibition on structured question tools, rather than only a control word such as `noask`.

When the full instructions leave context, reread the common contract and current operation before continuing. A remembered path or historical claim that a file was read does not mean its body remains available. No host-specific Pin API is required. Reloading supplies the instructions; it does not enforce compliance.

### Initialization

Initialization and reconfiguration guidance is discoverable through a short conditional reference in `SKILL.md`, not a prerequisite to ordinary use. It can save role-model defaults, the two self-check limits, collaboration choice, project working conventions, and the project's Ship meaning in applicable external guidance such as `AGENTS.md`. Do not embed machine-specific models or build a general user/project configuration hierarchy.

Follow the requested operation directly. Do not add proactive checks for tool, environment, or file availability. After an actual loading or execution error, obtain only the information needed to address it and read preparation or diagnostic guidance as needed. This does not remove required quality checks or authorize an unavailable operation.

### Distribution

Document normal installation, update, removal, and reload conditions for the complete selected-language Skill through the target Harness's existing discovery and loading mechanisms. Support complete-directory copying and links where the Harness supports them. The instructions do not impose a closed list of Harnesses, guess unknown host paths, or require identical maintenance steps across hosts. The repository's ordinary Skill installer does not manage this component.

OMP additionally receives a native resource package containing both complete Skills and thin prompts for `/wl-clarify`, `/wl-exec`, `/wl-verify`, `/wl-ship`, and `/wl-supervise`. Entry points honor an explicit language-Skill selection and otherwise use English. Package resources share the component version. Document native package maintenance separately from standalone Skill installation, using the host's actual interfaces and resource-conflict behavior. Do not introduce host runtime code or dedicated integrations for other Harnesses.

Other Harnesses use the complete Skill and select operations through natural language, without dedicated workflow commands or runtime integration layers. OMP's command syntax is not a requirement for them.

### Specifications

The [component Spec](../../../../spec/workloop.md) states its goals, boundaries, and observable outcomes; the Skills and [component documentation](../../../../../projects/workloop/README.md) own operation and usage details. Keep the Spec aligned with the delivered capability.

The [Skill layout decision](../../../decision/2026/08/20-skill-variants.md#changes) keeps project-owned Skills within their component and preserves the ordinary same-name language-variant rule. Dependencies remain declared by name. Repository checks format the registered component Markdown without adding runtime checks; the package manifest and unregistered inputs retain complete-check fallback.

## Alternatives considered

Keeping the complete Skills under the ordinary root Skill and language-variant directories would reuse that layout, but leave the OMP prompts and package resources with a different owner. The project layout keeps those resources together while preserving independently installable Skills. It accepts a separate distribution path outside the ordinary Skill installer rather than duplicating the Skill bodies across both layouts.

## Consequences

An instruction-only component cannot enforce operation or permission boundaries. An Agent that fails to load the current body or disregards a visible rule can still skip required checks or perform unauthorized work. Self-contained loading and recovery instructions reduce missing-context failure paths, but packaging and rereading do not eliminate the need for independent verification or establish reliable model behavior.

The two independently installable language Skills each carry a complete authoritative contract. A change applied to only one body can give users of the other language different permissions or required checks even when both copies load successfully. Maintaining both in the same change and reviewing semantic equivalence is a continuing cost of independent language distribution; matching version numbers alone cannot establish equivalence.

## Changes

### 2026-10-23 Specification completeness

The component specification completely states required operation behavior, permissions, boundaries, and acceptance, without implementation descriptions or repository-file links. Skills supply the executable Agent instructions and component documentation supplies independently usable guidance for the same contract. The non-spec index carries language, topic, and decision navigation. This preserves the division between required outcomes and their operation or usage methods.
