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

English `workloop` and Chinese `workloop-zh` are independently discoverable identities owned by the component. Each contains all instructions needed for its complete workflow. Both languages change together, express equivalent capabilities and requirements, and carry the same component version. Do not duplicate them under the repository's ordinary Skill or variant roots.

Require tk by name and public interface, without importing its implementation or referencing its files. Other tools and Skills become prerequisites only where needed. Installation does not install prerequisites. Task management through GitHub or GitLab Issues or PRs remains deferred, not permanently prohibited; submitting a PR may still be a project's delivery goal.

Serve new tasks without old entry aliases, old material-name compatibility, or workflow/material migration. Continue, repair, and recover tasks begun with workloop under their own identity and effective requirements.

### Instruction ownership

Each installed language Skill references only its own directory, following the [component self-containment decision](../08/24-component-self-containment.md). Its entry owns purpose, prerequisites, actual request resolution, operation routing, minimum cross-operation boundaries, and instruction recovery. Keep user language, project writing rules, factual integrity, effective requirements, and the distinction between a deferred capability and a prohibition.

Operations own their steps and result materials. Shared Task ownership, self-check, role selection, collaboration, and execution constraints each have one owner per language and explicit loading conditions. Direct Skill use and Prompt invocation converge on the selected operation; Setup loads configuration guidance. Do not replace the entry with another equally large universally required body.

No new arguments does not erase sufficient current conversation or Task context. Continue without requiring restatement; resolve missing information only when the current Task or needed goal cannot be determined. Quoted or edited instructions are not execution requests.

### Operations

Expose `clarify`, `exec`, `verify`, `ship`, and `supervise`, with complete behavior in the [component specification](../../../../spec/workloop.md) and executable guidance in the [component](../../../../../projects/workloop/README.md).

Clarify resolves goals, necessary investigation and design, consequential choices, and a separate Plan without granting execution. Execute implements in the current session; Supervise schedules independent Workers without implementing. Both continue the authorized Plan unless explicitly narrowed. A Worker stops at its assigned boundary without narrowing the owner's scope.

Verify independently judges preparation or a frozen implementation candidate, read-only, as `passed`, `changes required`, or `unable to determine`. Ship delivers the project's defined result under effective permission, without a universal integration or publication bundle. Neither verification nor delivery is user acceptance or Task closure.

Check is implicit preparation, not another required entry. Material and design defects return to Clarify; implementation deviations return to Execute. Delivery feedback reopens affected work or an independently owned Task when it has a separate goal or boundary.

### Materials

Keep results in their owning tk Task, with a separate `plan.md` for every executable Task, including one-unit work. Plans preserve stable unit labels, completed results, and child ownership. Units deliver complete independently assessable results. Optional activities need no empty material.

Separate goal, design, implementation evidence, self-check, independent assessment, and delivery records. Preserve earlier candidate-bound assessments and failures without renaming historical files for uniformity. Executed Markdown is an implementation candidate. The [specification](../../../../spec/workloop.md#materials) defines required material contents; component instructions define their use.

Saving follows effective permission and narrower no-write or conversation-only limits. Stable results belong in ordinary materials; live role routes, temporary grants, and pending assignments belong in recoverable session state. Saving materials grants no implementation or lifecycle authority.

### Checks

A formed Plan receives preparation self-check for contradictions, omissions, and foreseeable execution blockers, not environment preflight. Unresolved requirements and consequential choices return to discussion. Independent preparation review starts only on request. Unless explicitly limited, that request covers author repairs and necessary rechecks by the same suitable read-only verifier until a current pass or real blocker.

Each self-check inspection uses a fresh read-only context; the author repairs. Select a default maximum from three to five according to the task, unless external guidance overrides it. Preparation and each implementation unit count separately. Preparation counts are per Clarify round: a later round starts a fresh count after the previous round returns for a new request, a returned material or design defect, or changed requirements or basis, and an earlier exhausted round does not block it. A round declared only to obtain a fresh count remains the same round. Within each preparation round and each implementation unit, first inspection and rechecks accumulate. Material revisions, repairs, rechecks, and independent feedback never reset the applicable count. Session recovery or another agent continuing the same round does not reset it. Starting a new round does not reset any implementation unit's count. Startup or communication failure does not consume a substantive inspection. A current pass ends self-check immediately. At the applicable limit, stop inspections, finish actionable repairs, and report unresolved and unrechecked work without inventing success.

Each implemented unit requires self-check and independent Verify. Independent Verify has no self-check round limit. Exhausting preparation self-check does not request independent review. Inspectors preserve permission, candidate identity, evidence, and the distinction between an evidenced defect and inability to judge.

Exercise changed behavior and record candidate, scope, conditions, inputs, observations, evidence, coverage, and limits. Distinguish file checks, loading paths, host discovery, actual UI or model behavior, and user outcomes. Candidate changes invalidate affected evidence; reuse unchanged evidence only within its stated identity and scope, without claiming an independent rerun. Checks do not confer user acceptance or protected permission.

### Coordination

Choose each role's host, exact model selector, reasoning, and location independently from explicit requests, continuing choices, then external defaults. Verify does not inherit the executor's model; unavailable choices are not silently replaced. Senior requires explicit assignment and cannot change requirements, expand scope, waive Verify, or grant protected permission.

Use isolated roles, normal startup, ordinary assignments, explicit locations, and frozen candidates through the selected collaboration tool. Herdr is recommended, not required. Verify resolves its own basis; the implementer's checklist is evidence, not authority. Reuse suitable Verify and assigned Senior sessions, separate from implementation, and resolve a busy assignment before another. Do not inspect private working-session files, operate another Agent's question dialog, or send unsolicited mid-work messages.

Wait for final results by default, including blocking completion after a background return, without polling or inferring a verdict from lifecycle state. Explicit `nowait` changes cross-session waiting only, not native self-check barriers, checks, scope, or permission. Preserve pending assignments and resume on final results. Validate the sender, scope, candidate, verdict, and saved report; recover existing results before repeating possibly completed actions. Final replies do not wait on their recipients.

### Permissions

Resolve foreseeable requirement choices during Clarify. An execution grant covers ordinary in-scope implementation, repair, local preparation, checks, temporary processes, and project-required candidate preservation. Reuse effective grants; authorized temporary-directory checks remain within their scope. Do not postpone every consequential choice until the end in the name of avoiding repeated approval.

Project-protected proposal approval, archival, integration, push, publication, installation, expense, privileged actions, and Task closure require their own effective grants. Verification is not acceptance, and acceptance grants no unrelated action. Preserve explicit confirmation requests and human checkpoints. Missing permission, a requirement decision, or external state blocks dependent actions only; continue unrelated authorized ready work.

Execute and Supervise prohibit structured question tools, including delegated workarounds. Indispensable user-only decisions use ordinary text while unaffected authorized work continues. `confirm` requests item-by-item confirmation without removing checks or this prohibition.

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

The [Skill layout decision](../08/20-skill-variants.md) keeps component-owned Skills in the project and leaves ordinary same-name variants unchanged. Repository checks format registered component Markdown, including all Markdown in either known language Skill's shared reference directory without per-file registration, and language Prompt paths. This adds no workflow runtime checks. Unknown operations or languages, legacy command paths, non-Markdown files, shared inputs, and mixed unknown changes retain complete-check fallback.

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

### 2026-10-25 Clarify-round preparation counts

Preparation self-check counts are per Clarify round. A later round starts a fresh count after the previous round returns; within a round, material revisions, repairs, rechecks, and independent preparation feedback share the count and do not reset it. Session recovery or another agent continuing the same round does not reset it. Starting a new round does not reset any implementation unit's count. The Clarify operation owns the round boundary and its record; the self-check reference owns counting. This clarifies an undefined boundary and does not change the independent Verify limit or the implementation-unit count rule.

### 2026-10-29 Tool-neutral collaboration

The user or project selects the collaboration terminal, for example Tern, Herdr, or tmux. The listed tools are examples, not a built-in preference; use the selected tool's supported interface and instructions, and do not make another tool's specific runtime conditions a collaboration prerequisite. This entry replaces the Herdr recommendation in the coordination section above; role isolation, identity location, normal startup, ordinary assignments, candidate freezing, and final-result delivery requirements remain unchanged.
