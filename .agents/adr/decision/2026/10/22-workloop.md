# workloop

Decision owner: Ruokee
Decision writer: OMP GPT-6 Astra
Reverses: [workloop](../../../archived/2026/10/22-r1-workloop.md)

English | [中文](./22-workloop.zh.md)

## Motivation

Provide workloop as self-contained language Skills with matching OMP Prompt templates and activity-specific instruction loading.

Goal clarification, implementation, verification, and delivery need a coherent contract available outside the source repository. Full workflows maintained in both Skills and host prompts create competing authorities. A large universally loaded body also gives configuration and individual operations execution or coordination details they do not yet need.

Direct installation gives the selected language Skill and its matching entries one maintenance owner. The workflow can use Markdown and existing Harness mechanisms without a runtime. Planning readiness, execution permission, and the different kinds of assessment need explicit boundaries so preparation does not become implementation or user acceptance.

## Decision

### Component

Maintain workloop under `projects/workloop/` as a first-party instruction component containing Markdown Skills, component documentation, and language-specific OMP Prompt templates. It has no OMP package manifest, Extension, runtime code, build system, or dedicated installer.

English `workloop` and Chinese `workloop-zh` are independently discoverable identities under `projects/workloop/skills/`. Each contains all instructions needed for its complete workflow. Both languages change together, express equivalent capabilities and requirements, and carry the same component version. Do not duplicate them under the repository's ordinary Skill or variant roots.

Require tk by name and public interface, without importing its implementation or referencing its files. Other tools and Skills become prerequisites only where needed. Installation does not install prerequisites. Task management through GitHub or GitLab Issues or PRs remains deferred, not permanently prohibited; submitting a PR may still be a project's delivery goal.

Serve new tasks without old entry aliases, old material-name compatibility, or workflow/material migration. Continue, repair, and recover tasks begun with workloop under their own identity and effective requirements.

### Instruction ownership

Each installed language Skill references only its own directory, following the [component self-containment decision](../08/24-component-self-containment.md). Its entry owns purpose, prerequisites, actual request resolution, operation routing, minimum cross-operation boundaries, and instruction recovery. Keep user language, project writing rules, factual integrity, effective requirements, and the distinction between a deferred capability and a prohibition.

Operations own their steps and result materials. Shared Task ownership, self-check, role selection, collaboration, and execution constraints each have one owner per language and explicit loading conditions. Direct Skill use and Prompt invocation converge on the selected operation; Setup loads configuration guidance. Do not replace the entry with another equally large universally required body.

No new arguments does not erase sufficient current conversation or Task context. Continue without requiring restatement; resolve missing information only when the current Task or needed goal cannot be determined. Quoted or edited instructions are not execution requests.

### Operations

Expose `clarify`, `exec`, `verify`, `ship`, and `supervise`.

- `clarify` resolves goals and completion, investigates or diagnoses when needed, and develops necessary design. Once the goal, design, and foreseeable consequential choices are clear, form or revise the separate `plan.md` and self-check in the same operation. Respect discussion-only, design-only, no-plan, pause, and writing restrictions. Infeasible or unnecessary work, or a decision not to continue, may end with a supported conclusion instead of a forced Plan. Apply task-closure rules separately. Preparation never starts implementation or invites the next operation.
- `exec` implements the requested scope in the current session and coordinates checks. Unless narrowed, continue the remaining Plan from the resolved starting point, usually one unit at a time and several serially. Routine implementation, repair, self-check, independent Verify, and necessary rechecks need no repeated permission. Structured question tools are prohibited; indispensable user-only decisions use ordinary text. `confirm` requests item-by-item confirmation without removing checks or enabling structured questions.
- `supervise` schedules the scope through independent Workers without implementing their changes. Independent units may use separate Workers. Overall scope and Worker boundaries remain distinct, with the same continuous-progress default and question restriction as Execute. A Worker stops at its assigned boundary while the owner continues the wider authorized Plan.
- `verify` independently judges preparation materials or an executed candidate against its goal, applicable Skills, project rules, and effective requirements. It remains read-only and distinguishes `passed`, `changes required`, and `unable to determine`. Judgments bind to the actual scope and candidate.
- `ship` performs project-defined delivery under the request and effective grants. It has no universal bundle of integration, cleanup, installation, deployment, or publication. Report achieved outcome, running or submitted-for-review state, acceptance, and relevant production-release state with evidence. Delivery is distinct from user acceptance and Task closure.

Check is implicit preparation, not another required entry. Start and End describe positions, not commands. Material and design defects return to Clarify; implementation deviations return to Execute. Delivery feedback reopens affected work or an independently owned Task under task rules when it has a separate goal or boundary. Execution or delivery ending never closes a Task automatically.

### Materials

Keep materials by responsibility in the owning tk Task. `goal.md` describes results and stopping conditions in natural language without implementation methods. Optional design explains how; diagnosis records the problem, conditions, and supported or uncertain causes without repair proposals. Research summarizes traceable sources; Grill preserves discussion. Optional activities require no empty documents.

Every executable task requires a separate `plan.md`, including a simple or single-unit task. Plans may mix inline units and linked tk subtasks while preserving stable labels and completed results. Subtask details and results stay with their owner; the parent keeps cross-unit decisions and links. Size units for a complete result and independent review, not file or edit counts.

Analysis may maintain ordinary materials and necessary temporary files under its permission, without granting implementation, configuration, Git, or managed-metadata changes. Conversation-only, no-record, no-write, and narrower limits govern saving. Stable results belong in ordinary materials; live routing, role assignments, temporary grants, and pending work belong in session state.

Preparation self-check uses its established record, normally `plan-check.md`, never `material_check.md` or `verification.md`. Requested independent preparation review appends to `material_check.md`; independent Verify of an executed unit appends to `verification.md`. Preserve established record responsibilities without renaming historical files for uniformity. Classify by the object's role, not extension: an executed ADR proposal is an implementation candidate even when entirely Markdown. Preserve prior candidate-bound assessments, including failures, and create no empty report for an unrequested activity.

### Checks

A formed Plan receives preparation self-check for contradictions, omissions, and foreseeable execution blockers, not environment preflight. Unresolved requirements and consequential choices return to discussion. Independent preparation review starts only on request. Unless explicitly limited, that request covers author repairs and necessary rechecks by the same suitable read-only verifier until a current pass or real blocker.

Each self-check inspection uses a fresh read-only context; the author repairs. Select a default maximum from three to five according to the task, unless external guidance overrides it. Preparation and each implementation unit count separately. First inspection and rechecks accumulate; startup or communication failure does not consume a substantive inspection. Revisions and independent feedback never reset counts. A current pass ends self-check immediately. At the limit, stop inspections, finish actionable repairs, and report unresolved and unrechecked work without inventing success.

Each implemented unit requires self-check and independent Verify. Independent Verify has no self-check round limit. Exhausting preparation self-check does not request independent review. Inspectors preserve permission, candidate identity, evidence, and the distinction between an evidenced defect and inability to judge.

Exercise changed behavior and record candidate, scope, conditions, inputs, observations, evidence, coverage, and limits. Distinguish file checks, loading paths, host discovery, actual UI or model behavior, and user outcomes. Candidate changes invalidate affected evidence; reuse unchanged evidence only within its stated identity and scope, without claiming an independent rerun. Checks do not confer user acceptance or protected permission.

### Coordination

Select each role's host, model, reasoning, and location independently from the current explicit request, continuing choice, then external defaults. Preserve exact selectors and aliases. Verify does not inherit the executor's model, and unavailable choices are not silently replaced. Senior exists only after explicit assignment; a default does not activate it. Advice may settle implementation choices and in-scope clarification, not override requirements, expand scope, waive Verify, or grant protected permission.

Use the selected collaboration tool. Herdr is recommended, not required. Preserve role isolation, normal startup at explicit locations, ordinary-message assignments, and candidate freezing. Every assignment resolves current Task, unit, basis, candidate, scope, grants, outcome, and live reply owner. Independent Verify resolves its own basis rather than accepting the implementer's checklist as authority.

Reuse suitable Verify and assigned Senior sessions apart from implementation. A verifier must not have implemented the target. Finish or recover a busy role's current assignment before sending another. Do not inject assignments through system prompts, operate another Agent's question dialog, send unsolicited mid-work messages, or read working Agents' private session files.

Wait for final results by default, including blocking completion when a collaboration command continues in the background. Do not poll or infer success from lifecycle state. Explicit `nowait` changes only cross-session waiting, not native self-check barriers, scope, checks, or acceptance. Preserve pending assignments and resume on final results. A final reply does not wait on its recipient. Validate sender, scope, candidate, verdict, and saved report; recover saved results after delivery failure and check effects before repeating possibly successful non-idempotent actions.

### Permissions

Resolve foreseeable requirement choices during Clarify. An execution grant covers ordinary in-scope implementation, repair, local preparation, checks, temporary processes, and project-required candidate preservation. Reuse effective grants; authorized temporary-directory checks remain within their scope. Do not postpone every consequential choice until the end in the name of avoiding repeated approval.

Project-protected proposal approval, archival, integration, push, publication, installation, expense, privileged actions, and Task closure require their own effective grants. Verification is not acceptance, and acceptance grants no unrelated action. Preserve explicit confirmation requests and human checkpoints. Missing permission, a requirement decision, or external state blocks dependent actions only; continue unrelated authorized ready work.

Under project working rules, verified committed predecessors may supply development dependencies before integration or final user review. Keep their candidates frozen and each unit reviewable against its base. Refresh affected descendants and evidence if a predecessor changes. A branch cannot substitute for a required deployment, service, or published artifact. Preserve unintegrated candidates for ordered delivery rather than merging merely to continue development.

### Recovery

Preserve the current activity's scope, basis, candidate where relevant, grants, explicit restrictions, completed check counts, and next action in recoverable context. Preserve restrictions in plain language, including the prohibition on structured questions, not only `noask`. Collaboration owns live roles, routes, resources, and pending assignments; configuration-only work does not carry a full execution state.

Reload a missing entry, current operation, or currently required reference from the actual installed Skill. A remembered path or past read is not available instruction text. Reconcile state with effects to avoid repeating completed work or pending requests. No host-specific Pin API is required. Loading instructions does not enforce compliance.

### Initialization

Setup is a short conditional entry route, not an installation or ordinary-use prerequisite. It maintains selected role defaults, self-check maxima, collaboration choices, project working conventions, and Ship meaning in applicable external guidance such as `AGENTS.md`. Do not copy generic workflow algorithms into that guidance, embed machine-specific models in distributed instructions, or build a general user/project configuration hierarchy. Default updates preserve active explicit choices; configuration grants no execution permission.

Act on the requested operation without proactive tool, environment, or file-availability preflight. An actual failure prompts only the facts and relevant preparation or diagnostic guidance needed to address it. This neither removes quality checks nor authorizes unavailable actions.

### Distribution

Use existing Harness discovery and loading mechanisms for complete Skill copying or supported links. Installation documentation owns first installation, complete replacement, language switching, removal, and actual loading conditions, distinguishing placement, discovery, and loaded text. Do not guess unknown host paths or impose a closed Harness list. The ordinary repository Skill installer does not manage this component.

One OMP installation selects one complete language Skill and its matching `/wl-clarify`, `/wl-exec`, `/wl-verify`, `/wl-ship`, and `/wl-supervise` Prompt set. Templates fix the Skill identity and pass only operation, loading instruction, and input. Empty arguments produce no input heading or section; nonempty arguments preserve host-parsed characters without template escaping or second interpretation. Install only the selected templates in the actual Prompt discovery location.

Retire old workloop package resources and owned same-name file commands before direct installation; leave unrelated resources intact. Follow the host's real template-loading behavior rather than assuming file-command reload also reloads templates. Other Harnesses use complete Skills and natural-language operations without dedicated integrations or OMP command syntax.

### Specifications

The [component Spec](../../../../spec/workloop.md) states targets and observable acceptance; Skills and [component documentation](../../../../../projects/workloop/README.md) own operation and usage details. Keep these contracts aligned.

The [Skill layout decision](../08/20-skill-variants.md#changes) keeps component-owned Skills in the project and leaves ordinary same-name variants unchanged. Repository checks format registered component Markdown, including maintained references and language Prompt paths, without adding workflow runtime checks. Unknown and shared inputs retain complete-check fallback.

## Alternatives considered

Putting complete Skills under the ordinary Skill and variant roots would reuse that layout but split ownership from OMP templates. Keeping the component together accepts a separate distribution path without duplicating Skill bodies.

Keeping all common instructions in the entry or a mandatory shared file offers one obvious reading location, but makes every activity load unrelated execution and collaboration details. Operation ownership and conditional references preserve one owner per rule without universal loading.

## Consequences

Instruction text cannot enforce operation or permission boundaries. An Agent that fails to load current instructions or disregards them can skip checks or act without permission. Self-contained loading and recovery reduce missing-context failures but do not replace independent verification or establish reliable model behavior.

Each language carries a complete authoritative contract. Updating only one can give the other language different permissions or checks even when both load successfully. Maintaining both together and judging semantic equivalence is a continuing cost; matching versions alone is insufficient.

A retained same-name OMP file command precedes a new Prompt template, so copying templates alone can leave an old entry active. Installation includes retiring owned conflicting resources and observing the host's real discovery and loading conditions.

## Changes

### 2026-10-23 Specification completeness

The component specification completely states required operation behavior, permissions, boundaries, and acceptance, without implementation descriptions or repository-file links. Skills supply the executable Agent instructions and component documentation supplies independently usable guidance for the same contract. The non-spec index carries language, topic, and decision navigation. This preserves the division between required outcomes and their operation or usage methods.
