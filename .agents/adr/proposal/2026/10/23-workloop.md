# workloop

Draft owner: Ruokee
Draft writer: OMP GPT-6 Astra

English | [中文](./23-workloop.zh.md)

## Motivation

Distribute workloop as a complete language Skill with matching OMP Prompt templates, and load workflow instructions according to the requested activity.

The current [workloop decision](../../../decision/2026/10/22-workloop.md) combines independently installable language Skills with an OMP package that exposes both languages and selects one at invocation time. Direct installation needs one clear owner for the selected Skill and its matching entries. Keeping an old package or same-name file command alongside new templates can also cause the host to invoke a different entry from the one the user installed.

The common Skill body includes material formats, inspection loops, role coordination, and execution details before the requested operation is known. Setup and a single operation therefore receive instructions they do not need yet. Moving that entire body to another mandatory file would preserve the same loading problem.

Planning readiness, execution permission, and independent assessment also need explicit boundaries. A ready goal should yield a Plan without a second routine planning request. Preparation self-check, requested independent material review, and independent assessment of an executed candidate need distinct records so their conclusions cannot be mistaken for one another.

## Proposal

### Distribution

Reverse the component and distribution clauses of the current decision that require OMP resource packaging and invocation-time language selection. Retain the component under `projects/workloop/`, with independently installable `workloop` and `workloop-zh` Skills and equivalent capabilities. Ship complete ordinary Skill directories and two language-specific sets of Prompt templates, without a package manifest, runtime, Extension, build system, or dedicated installer.

An OMP installation selects one complete language Skill and its matching set of `/wl-clarify`, `/wl-exec`, `/wl-verify`, `/wl-ship`, and `/wl-supervise` templates. Each template fixes the selected Skill identity and passes only the operation, loading instruction, and user input. It does not choose a language from the input or duplicate the workflow body. Empty arguments produce no user-input heading or empty section; nonempty arguments retain the characters produced by the host's argument parser. With no new arguments, use sufficient current conversation or Task context instead of asking the user to restate it. Ask for missing information only when the current Task or required goal cannot be resolved.

The installation guide owns first installation, full replacement, language switching, removal, and host loading conditions. It distinguishes file placement, discovery, and actual loading. Switching management modes first removes workloop's old package resources and conflicting same-name file commands; unrelated resources remain untouched. Install only the selected templates into the host's actual Prompt discovery location. Use the host's supported loading behavior rather than assuming file-command reload also reloads templates. Setup remains optional. Other Harnesses continue to use their own Skill mechanism and natural-language operation selection.

### Instruction ownership

Replace the current Component clause assigning the common contract to `SKILL.md` with a minimal entry, operation bodies, and activity-specific shared references. The entry owns purpose, prerequisites, request resolution, routing, essential cross-operation boundaries, and recovery of missing instructions; detailed shared contracts are no longer universally loaded there. Retain the user's language, applicable project writing rules, and factual integrity, including conditions, negation, attribution, and genuine uncertainty. Preserve effective requirements and permissions, the distinction between deferred and prohibited capabilities, and the existing no-migration boundary.

Each operation owns its steps and result materials. Shared Task ownership, self-check, role selection, collaboration, and execution constraints have one owner within each language Skill and explicit reading conditions at their callers. Setup owns external configuration choices rather than copying the workflow into project guidance. Preserve the current Initialization clause's configuration scope, prohibition on embedded machine-specific models, and exclusion of a general user/project configuration hierarchy. Direct invocation, setup, and Prompt entry paths load the current activity's complete instructions without requiring unrelated operation details. Do not replace the large entry with an equally large file that every path must read.

Every language directory remains self-contained after installation. Missing current instructions must be reloaded from the actual installed location. Each operation preserves the state needed to resume its own work; shared collaboration guidance owns recovery of live routes and pending assignments. A configuration-only request need not retain a full execution state. Loading or rereading instructions does not establish model compliance.

### Planning

Clarify forms or revises the separate `plan.md` in the same operation when the goal and necessary design are clear, foreseeable consequential choices are resolved, and no discussion-only, design-only, no-Plan, pause, or no-write restriction prevents it. It then self-checks the preparation materials. An infeasible or unnecessary effort, or a decision not to continue, may end with its supported conclusion without manufacturing a Plan.

Preparation may maintain ordinary materials and necessary temporary files within its operation's permission. Producing or checking those materials grants no implementation, configuration, Git, or managed-metadata changes, and neither starts implementation nor invites the next operation. Preserve stable unit labels, completed results, optional materials, linked subtask ownership, and the distinction between a goal, a diagnosis, a design, and an execution plan.

### Assessment records

Refine the current Materials and Checks clauses by assigning distinct records to their three assessment responsibilities. This preserves the existing independent material-review capability within Verify, without adding an operation or command:

- Clarify's automatic self-check uses its established preparation check record, such as `plan-check.md`, never `material_check.md` or `verification.md`.
- An independent review of preparation materials starts on request and appends its material candidate, scope, evidence, and verdict to `material_check.md`.
- Independent Verify of an executed unit appends its implementation candidate, scope, evidence, and verdict to `verification.md`.

Classify the object by its role, not its file extension. A proposal produced by Execute is an implementation candidate even when all changed files are Markdown. Do not create empty reports for unrequested activities or rename established self-check records merely for uniformity.

Retain fresh read-only self-check contexts, author repairs, separate preparation and per-unit counts, first-inspection and recheck accumulation, early termination on a current pass, and reporting of unresolved or unrechecked changes at the limit. Select a default limit from three to five inspections according to task size and complexity, unless applicable external guidance overrides it. Each implemented unit still requires both self-check and independent Verify. Independent reviews have no self-check round limit; reaching that limit does not request a preparation review. Independent assessors remain read-only, preserve earlier assessments, and distinguish passed, changes required, and unable to determine. A changed candidate invalidates affected evidence.

A requested preparation review covers in-scope author revisions and rechecks by the same read-only verifier until a current pass or a real blocker, unless the user limits the review.

### Execution authority

Keep requirement choices, ordinary execution, protected actions, and user acceptance separate. Resolve foreseeable requirement choices during Clarify. A valid execution request covers its ordinary implementation, repair, self-check, independent Verify, and necessary rechecks without routine permission requests between units. Authorized temporary-directory file checks remain within their check scope. Where the project permits it, a verified committed predecessor can supply a development dependency before integration or final user review. It cannot substitute for an actually required external deployment or published state.

Project-specific proposal approval, archival, integration, push, installation, publication, expense, and Task closure still require their effective grants. Missing permission blocks the actions that depend on it, while unrelated authorized ready work continues. Honor an explicit item-by-item confirmation request or required human checkpoint. Do not turn a rule against repeated permission requests into a rule that postpones every consequential choice until the end.

Preserve independent role selection, explicitly assigned Senior participation, isolated reusable Verify sessions, frozen candidates, ordinary-message assignments, final-result waiting, recovery of saved results, and scope-bound evidence. Execute implements directly; Supervise schedules Workers. A Worker stops at its assigned boundary, while the execution owner continues the wider authorized Plan. Both operations retain their prohibition on structured question tools. Ship remains defined by the project and its effective permissions, not by a universal action bundle.

### Contract alignment

Form a complete successor to the current workloop decision, retaining its identity and every still-effective clause. Keep the [workloop Spec](../../../../spec/workloop.md), both language Skills and Prompt sets, usage and installation guides, and repository check selection consistent with the chosen contract. Register the component's maintained Prompt and reference paths while retaining complete-check fallback for unknown or shared inputs. Maintain the two language Skills and their Prompt sets together with equivalent behavior; both Skills carry the same component version.

Retain tk as a named public-interface prerequisite, Harness-independent standalone use, the absence of old aliases or material migration, optional initialization, focused recovery after actual failures rather than proactive environment preflight, and the distinction between file checks, host discovery, real-model behavior, user acceptance, delivery, and Task closure. Shared Task guidance preserves identity and supports continuing, repairing, and recovering Tasks already started with workloop.

## Alternatives considered

Keeping the entire common contract in a mandatory entry or shared file would preserve one obvious reading location, but every entry would still load execution and coordination details regardless of its activity. Activity-owned bodies and conditional shared references retain a single owner per rule while reducing unrelated mandatory context.

## Acceptance criteria

- Either complete language Skill works independently of the repository and the other language. All required internal loading paths remain inside the selected directory.
- An OMP direct installation exposes one selected language Skill and five matching Prompt entries. Replacement, language switching, and removal leave neither nested Skill copies nor conflicting workloop entries, and preserve unrelated resources.
- Empty Prompt input does not add an empty section or discard usable Task context. Nonempty input preserves host-parsed characters. Entry templates do not own workflow logic.
- Direct Skill use, setup, and each Prompt path load the requested activity's required instructions; unrelated execution and inspection details are conditional rather than universal.
- A planning-ready request yields its Plan and automatic preparation self-check in the same Clarify operation while respecting explicit restrictions and no-action outcomes.
- The three kinds of assessment use their own records and triggers, preserve candidate-bound histories, and never confer implementation or user-acceptance authority.
- Authorized dependency-ready execution continues without routine approval gates while project-protected actions and explicit human checkpoints retain their conditions.
- Both language Skills and Prompt sets, paired documentation, the complete successor decision, the Spec, and check consumers describe the same boundaries. Textual checks do not establish actual model behavior.

## Risks

A retained same-name OMP file command takes precedence over a new Prompt template. Copying templates without retiring the old workloop resources can therefore leave the old entry active despite an apparently successful installation. Installation instructions must cover that transition and the host's actual discovery and loading conditions.
