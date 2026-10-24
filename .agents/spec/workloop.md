# workloop

## Goals

Provide an instruction workflow for new tk Tasks, from goal clarification and necessary design through planning, implementation, independent verification, and project-defined delivery. Either language must be independently usable through the Harness's existing Skill mechanism and natural-language requests.

Preserve confirmed requirements, permission boundaries, evidence, and active execution state across revisions and context recovery. Instructions guide Agent behavior without enforcing it programmatically.

Load the complete instructions needed for the current activity without requiring unrelated operation details. Distribute one selected language Skill with matching thin OMP Prompt templates through direct installation.

## Out of scope

- A workflow runtime, programmatic action enforcement, OMP package manifest, dedicated installer, or implicit prerequisite installation.
- Recognition or migration of old workflow aliases and material names. Tasks begun with workloop remain recoverable under their existing identities.
- Task management outside tk or a general user/project configuration hierarchy. These are deferred, not permanently prohibited.
- Implicit integration, local installation, restart, publication, paid or real-model experiments, destructive cleanup, or Task closure.

## Public surface

### Entry

The independent Skill identities are `workloop` and `workloop-zh`. Both provide complete, equivalent instructions for Clarify, Execute, Verify, Ship, Supervise, and optional Setup. The entry resolves the request and routes to the activity. Shared rules have one owner per language and explicit loading conditions; no large replacement common body is universally required. Use the user's language and applicable writing rules, preserving facts, decisions, conditions, negation, attribution, and genuine uncertainty. Quoted instructions, examples, and negations do not activate an operation; an orientation request receives explanation rather than execution.

Resolve the actual operation, project, owning Task, effective requirements, scope, and grants. tk is required for durable identity, relationships, lifecycle, and material ownership through its public interface, not implementation files. Other Skills apply only to their relevant activities. Herdr is recommended, not mandatory; another supported terminal collaboration mechanism is valid.

OMP exposes `/wl-clarify`, `/wl-exec`, `/wl-verify`, `/wl-ship`, and `/wl-supervise` through five Prompt templates fixed to the language selected at installation. Each template supplies only the Skill identity, operation, loading instructions, and user input. It loads the installed Skill and follows that Skill's routing, not workflow bodies in the Prompt directory. Input does not select another language. Empty arguments produce no input heading or empty input section; nonempty input preserves host-parsed characters without template escaping or a second interpretation. Missing new arguments retain sufficient effective conversation or Task context; ask for information only when the Task or required goal cannot actually be resolved. Preparation Check is an implicit material inspection, not an extra command.

### Materials

Resolve material ownership through tk. A parent, dependency, adviser, or earlier session does not automatically own a new result. Reuse the Task for the same effort and follow project permission for creation, relationships, and closure. Stable unit labels start at `U01` within the owning Plan and survive revision. A Plan may mix inline units and links to tk subtasks; linked detail must be read before execution or revision.

An operation normally permits saving its ordinary results. Explicit conversation-only, no-record, no-write, and narrower restrictions prevail. Read existing material before updating it. Preserve substantial results as they settle and before returning; missing required storage remains an explicit unmet condition, not a reason to write elsewhere.

- `goal.md` states the desired result, scope, constraints, and completion or stopping conditions in natural language, without implementation methods.
- Optional `design.md` explains the solution and necessary implementation details. Optional diagnosis records symptoms, observed conditions, evidence, and supported or uncertain causes, without repair proposals.
- Research summarizes conclusions and traceable sources. An interview may keep `grill.md` or its established record. Optional activities require no empty files or material-to-role matrix.
- Every executable Task has a separate `plan.md`, including one-unit work.
- The established execution record, normally `execution.md`, identifies units, bases, candidates, completed behavior, inputs, checks, observations, repairs, and limits.
- Automatic preparation self-check uses its own established record, normally `plan-check.md`, never either independent report. Implementation self-check belongs in the execution record or its linked self-check report.
- Requested independent preparation review appends to `material_check.md`. Independent Verify of executed candidates appends to `verification.md`. Neither overwrites earlier assessments or failures. Executed Markdown-only units remain implementation candidates. Existing records retain their established responsibilities without historical file migration; unrequested reviews create no empty reports.
- The established delivery record, normally `ship.md`, states the actual delivery result.

Stable results belong in Task materials. Live role routes, pending assignments, temporary grants, and session identities belong in recoverable session state. A parent links subtask evidence rather than taking ownership or copying it.

### Clarify

Clarify handles a new idea, a specific design question, direct Plan formation for a known goal, and material revision. It does not restart settled interviews. Honor discussion-only, design-only, no-plan, pause, and no-write limits.

Establish the problem, desired result, scope, constraints, and stopping conditions. Question unnecessary, infeasible, or harmful work before choosing a solution. Read project facts and patterns first; use proportionate investigation where facts are missing. Distinguish observations, assumptions, proposals, and decisions. User-only priorities and consequential tradeoffs need the user's decision after evidence, real alternatives, and a recommendation; available facts are not questions for the user.

A known goal may proceed directly to requested design or planning. When the goal, necessary design, and foreseeable consequential choices are clear, form `plan.md` in the same Clarify operation unless discussion-only, design-only, no-plan, pause, or writing restrictions prevent it. No separate request to create the Plan is required, and forming it grants no execution permission. Each unit states a complete independently assessable result, goal/design basis, changes, non-goals, dependencies, observable acceptance, checks, permissions, and material owner. Resolve foreseeable product decisions rather than hiding them as executable work. Separate a verified code dependency from deployment, service, or published-artifact state that must actually exist.

After Plan formation, preparation self-check is automatic. Independent Verify of preparation starts only on request, not because self-check reaches its limit. It normally includes in-scope author repairs and same-verifier rechecks until a current pass or real blocker. One-round or report-only limits prevail. A design-only request does not force a Plan. An unnecessary or infeasible effort, or a user's decision not to continue, may end with a supported conclusion rather than empty stages; closure retains its own permission. Clarify neither implements nor ends by inviting execution unless execution was actually requested.

### Execute

Execute implements in the current session and directly coordinates self-check and independent Verify; it requires no Supervisor. Missing or non-action-ready planning returns affected work to Clarify, not invented requirements.

A named subset limits work. Otherwise continue every remaining dependency-ready unit, usually one at a time and several serially. Ordinary execution includes in-scope implementation, repairs, local setup, checks, temporary processes, and candidate preservation required by the project. It does not need repeated intermediate permission or `auto`/`noask` keywords. `confirm` requests item-by-item confirmation without waiving checks.

Reuse ordinary grants across implementation, repairs, checks, and units. Keep consequential requirement choices, protected actions, and explicit human intervention points separate. A missing grant or external state blocks only dependent actions; continue unaffected authorized ready work. This rule also governs Supervise.

Execution and supervision prohibit structured question tools, including wrappers or another Agent used to evade the restriction. Put indispensable user-only decisions in ordinary text and continue unaffected authorized work. Preserve explicit prohibitions in plain language across recovery.

Complete the requested behavior and affected contracts without placeholders, speculative features, or weakened acceptance. Exercise changed behavior, preserve a stable candidate, obtain quick self-check and independent Verify, repair in-scope findings, refresh affected checks, and recheck with the same suitable verifier. A material contradiction returns only affected work to Clarify. An unavailable prerequisite is a blocker, not a partial substitute.

A frozen, committed, verified predecessor may be a later unit's base under project rules before integration. Preserve each unit's base, candidate, and review boundary; refresh descendants and invalidated evidence if the predecessor changes. Do not merge solely to unblock development. Actual external-state dependencies still require their state.

After a current independent pass, continue the next authorized ready unit without waiting merely for user acceptance or integration. If all remaining work is blocked, retain every finished candidate and each precise blocker. A Worker returns only at its assigned boundary; that boundary does not narrow the owner's overall authorization.

### Verify

Verify independently assesses specified preparation or implementation while keeping the target read-only. Resolve source requirements, Plan and linked details, design, decisions, rules, candidate identity, and reply owner. An author's checklist or implementation is evidence, not requirement authority. Ambiguous, moving, missing, or conflicting targets require resolution.

Name the exact commit/tree and working state, or a frozen material set. Do not modify or format the candidate, and freeze author edits during assessment. Inspect the relevant change and consumers, permission scope, dependencies, prior repairs, and actual evidence. Exercise proportionate non-destructive checks only within the grant. Preserve valid reused evidence with its author, candidate, conditions, and coverage without claiming an independent rerun.

Return one verdict:

- `passed`: the candidate meets the required result with sufficient evidence for that scope.
- `changes required`: an evidenced defect or unmet requirement needs correction.
- `unable to determine`: necessary information, stable identity, capability, permission, or evidence is missing. This is neither a pass nor an established defect.

Findings state severity, location, observation, violated requirement or material risk, and the smallest restoring correction. Optional improvements do not become failures. The author repairs; a suitable isolated verifier is reused for affected rechecks with enough surrounding coverage to detect regression. Material/design defects return to Clarify; implementation deviations return to Execute.

Classify the target by its role, not its file extension: independent preparation review uses `material_check.md`, and independent Verify of executed candidates uses `verification.md`. Append each assessment with scope, candidate and base, basis, actual inputs, checks, observations, reused evidence, findings, verdict, and limits. A new success does not overwrite an old failure. A delegated verifier saves the authorized report and sends a final-only result to the live owner without waiting for that owner. Recover an already-saved report after delivery failure rather than repeating the assessment.

### Ship

Ship delivers the project-defined observable result under the actual request and effective permissions. It has no universal merge/install/release bundle. Use an established definition or unambiguous request; ask only for a genuinely unresolved material choice. A procedure declaration does not grant its execution.

Resolve the exact candidate, dependency order, current Verify scope, acceptance, and project gates. A pass on another candidate or partial scope does not cover delivery. Reuse valid grants and evidence; refresh checks invalidated by candidate or target changes. Protected actions outside the definition need separate permission. Integration, where required, follows project method and dependency order, not a universal prerequisite for every delivery.

Observe the actual destination and result. Copying is not discovery, restarting is not successful loading, running is not acceptance, and submission is not review. Preserve reconstruction evidence before authorized cleanup and stop only authorized owned resources. Implementation defects return to Execute; goal or design problems return to Clarify. Independent new work may get its own Task under applicable permission. Ship does not force a later benefit-measurement stage or automatically close the Task.

### Supervise

Supervise schedules the resolved Plan through independent Workers; it neither implements their changes nor acts as their independent verifier. Incomplete preparation returns to Clarify. Scope, parallelism, assignments, and protected permissions remain separate.

Assign complete dependency-ready units. Independent units may run concurrently when scope and project allow it; shared edits have one owner at a time. Assignments contain Task/unit, Plan basis, working location, edit boundary, grants, restrictions, dependency candidate, required checks, authorized materials, expected result, stopping point, and reply owner. Workers use Execute and return exercised results, quick-check counts, and independent reports.

The Supervisor reads and validates final reports rather than treating lifecycle labels or completion claims as verdicts. Findings return to the responsible Worker without resetting its quick-check count. Missing evidence is resolved within scope; saved results are recovered after communication failure. After each current pass, schedule the next authorized ready unit. Return all selected candidates together once complete, retaining blocked scope rather than silently dropping it.

### Setup

Setup is optional and applies to initialization, reconfiguration, or focused preparation after an actual failure. Store selected durable defaults and project conventions in authorized external project guidance, not copied workflow algorithms, installed Skills, Task results, or a new database. Preserve existing unrelated guidance; replace a default rather than adding a conflicting duplicate. Configuration alone does not require Task, execution, self-check, or collaboration procedures and creates no placeholder Task.

Defaults may include independent role models and reasoning, separate preparation and unit inspection limits, collaboration mechanism, project work conventions, and Ship's observable result. Do not launch roles, install tools, or probe availability merely to define defaults. A changed default does not replace an active explicit selection. Session routes and temporary grants are not durable defaults. Setup grants neither implementation nor delivery.

### Distribution

Install one complete selected language Skill through the Harness's existing copy or supported directory-link mechanism. Both language Skills share one version and each works without repository files or the other language. Replacement preserves the old whole installation outside discovery roots, replaces rather than merges, removes obsolete files from discovery, and leaves the old copy recoverable on failure. Language switching removes the previous identity and templates before installing the other set. Removal touches only owned installed resources; unlinking preserves the source. Shared roots, unrelated files, backups, and source checkouts remain intact. Setup is not an installation or ordinary-use prerequisite, and installation does not install tk or other prerequisites.

OMP directly installs one Skill and five matching templates, without package management, Extension code, a build step, or runtime dependencies. The repository's ordinary Skill installer does not manage this component. Default user roots are `~/.omp/agent/skills/` and `~/.omp/agent/prompts/`. Under relocated configuration or a profile, `omp config path` with the intended session's environment and profile identifies the effective agent root. Deliberate project-local installation uses `.omp/skills/` and `.omp/prompts/`. The complete selected Skill occupies its named directory; only the five selected `wl-*.md` templates are placed flat in the Prompt root. OMP uses basenames even during recursive discovery, so the two language template sets must not coexist in that root. First installation requires absent destinations; existing owned resources use complete replacement, without overwriting unknown content or nesting a new Skill inside an old copy.

Before direct installation, retire an existing `@ruokee/workloop` package through the manager that installed it. On OMP `18.12.3`, `omp plugin uninstall @ruokee/workloop` removes the listed package's registration and plugin state, not a linked source checkout or separately installed resources. Move owned same-name file commands outside discovery roots; leave unrelated or other owners' resources intact and resolve other conflicts with their owners. This interface version is not a maintenance floor.

On that interface, native `.omp` resources have priority 100 and package resources 90. Different same-name Skills preserve the higher-precedence bare name and namespace others; identical copies deduplicate; custom Skill directories have their own overrides. Native file commands outrank package file commands. Built-in, extension, and custom handlers precede file commands, which precede Prompt templates. The `wl-` prefix cannot guarantee no user collision; equal-priority order is not a contract. Users can identify the actual discovered source.

OMP Prompt installation, replacement, language switching, and removal require a new session to load the resulting template set. `/reload-plugins` refreshes plugin resources, Skills, and file commands, not Prompt templates. Existing sessions may retain old content. Other Harnesses use their own actual loading requirements and receive no OMP templates unless they support the format. File placement, host discovery, and actual instruction loading are separate results; a copy, matching version, or discovery alone does not establish loaded text or correct Agent behavior.

## Invariants

- Confirmed requirements, proposed constraints, observed behavior, tests, and generated plans remain distinguishable. Neither code nor an Agent's claim approves a requirement. A deferral is not a permanent exclusion, and a motivation does not invent an acceptance gate.
- Scope, ordinary operation grants, protected permissions, waiting policy, user acceptance, delivery, and Task status remain separate. Loading a Skill or saving a report expands none of them.
- Role host, exact model selector, reasoning, and location are chosen independently in this order: current explicit request, still-effective choice for the same execution, then project defaults. Preserve aliases. An unavailable choice reports its actual failure without silent substitution; Verify is not inferred from the executor.
- Senior exists only after explicit assignment. A default does not activate it. Advice may settle consequential in-scope implementation choices, not goals, priorities, protected grants, waived checks, or replacement of independent Verify.
- Each quick inspection has a fresh read-only context; the author repairs. Select a maximum of three to five unless configured otherwise. Preparation and each implementation unit count separately. First inspection and rechecks share the count; revisions and Verify feedback never reset it. Startup or communication failure consumes no substantive inspection. A current pass ends early; at the limit finish repairs, stop more quick inspections, and identify unresolved or unrechecked changes. Independent Verify has no such limit.
- Every implementation unit requires self-check and independent Verify. Preparation requires self-check after Plan formation and independent Verify only on request. A limit exhausted or an old candidate's pass cannot establish current success.
- Collaboration uses normal startup, ordinary messages, explicit locations and live reply routes, isolated roles, appropriate session reuse, and frozen candidates. Finish or recover a busy assignment before redispatch. Do not inspect private working-session files or send unsolicited mid-work messages.
- Cross-session work and advice wait for final results by default, including a host blocking wait after background return. Explicit `nowait` permits saved pending cross-session assignments, not removal of native self-check barriers, checks, or permission limits. On final delivery resume authorized work without another continue request. Validate sender, unit, candidate, verdict, and saved report.
- Evidence names the candidate, conditions, inputs, results, and scope. Source inspection, file checks, controlled integration, real Harness behavior, UI behavior, and real-model outcomes prove different things. Changed behavior invalidates affected evidence; unchanged evidence is reused only with its identity and scope.
- Recovery retains activity-specific state: Task, operation, scope, basis, candidate, grants, prohibitions, inspection count and limit, pending assignments, and next action where applicable. Reload missing entry, operation, and conditionally required instructions from the actual installed Skill; a remembered reference is not loaded content. Configuration-only recovery does not require execution state. Recover pending assignments without duplicate actions. No particular persistence API is required.
- Ordinary operations do not run speculative environment preflight. Actual failures trigger focused fact gathering and authorized prerequisite repair, never fabricated success, weakened acceptance, or silent substitutes.

## Acceptance criteria

- Both language Skills independently express every operation and preserve equivalent behavior, permissions, counts, failure handling, and recovery. All their internal references remain within the installed directory.
- Direct Skill use, Setup, and each Prompt entry identify initial reads, conditional reads, and handoff instructions. Every effective rule has an owner and a reachable loading condition; configuration-only work does not require full execution or self-check procedures.
- Scenarios for same-operation Plan formation after goal/design readiness, unresolved consequential choices, design-only, no-plan, pause, no-write and no-action requests, mixed Plans, serial Execute, independent Workers, explicit subsets, and unavailable prerequisites produce the specified work and stopping boundaries.
- A first-pass self-check can end early; repairs and independent feedback preserve accumulated counts; cap exhaustion leaves unverified changes explicit. Changed candidates receive affected rechecks rather than inheriting a pass.
- Automatic self-check, requested independent preparation review, and executed-candidate Verify retain distinct triggers, writers, records, candidate histories, and recheck rules. Markdown execution outputs stay implementation candidates. A check grants neither user acceptance nor protected permission.
- Verified dependency development can continue without ungranted integration, while real external dependencies still block their consumers. Delivery follows the actual project outcome and grants.
- Each installed OMP set exposes five fixed-language entries and preserves empty-input continuation, quoted multiword input, special characters, and template-like input under the host parser's semantics. Installed sources and resource collisions remain identifiable.
- Either complete language supports first installation, full replacement, switching in both directions, removal, and internal loading outside the repository, without nested copies, stale language resources, or deletion of unrelated files. The new-session requirement remains distinct from file placement and discovery.
- Registered component Markdown, including all Markdown in either known language Skill's shared reference directory and the language-specific templates, selects formatting checks without per-file reference registration. Unknown operations, languages, legacy command paths, non-Markdown files, shared inputs, and mixed unknown changes retain complete-check fallback. Deletion and rename classification remain effective without a workflow runtime checker. Claims distinguish scenario inspection, actual host discovery, model behavior, and user acceptance.
