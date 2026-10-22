# Setup

Read the [common contract](./SKILL.md) in full. Use this guidance when the user requests workloop initialization or reconfiguration, or an actual failure calls for the relevant preparation detail. Setup is not a prerequisite to ordinary use and does not authorize implementation or delivery.

## Resolve settings

Read the user's intended scope and the applicable existing external guidance. Reuse established choices instead of asking the same questions. Put durable defaults in the appropriate `AGENTS.md` or equivalent instruction file according to the project's convention and the user's write permission. Do not save these settings inside the installed Skill, Task results, a new workloop configuration database, or an invented user/project override hierarchy.

Clarify only choices that affect use and cannot be resolved from evidence. Respect current question restrictions. Identify the exact destination before editing; a request to initialize workloop does not grant unrelated global or protected writes. Preserve other guidance and do not overwrite unknown content.

## Select roles

Record independent defaults for the quick self-checker, Verify, and Senior where the user wants them, with host, exact model selector or alias, and reasoning level when the host supports it. Worker defaults may follow the project's existing Agent conventions. Do not put a specific model or provider into workloop's distributed instructions.

Resolve effective choices in this order: current explicit request, continuing choice for the same execution, then applicable external defaults. Preserve aliases when sending them to the host. An unavailable choice produces its actual error, not a silent substitute. A Verify choice is not inferred from the executor. A Senior default does not assign a Senior; that role remains opt-in.

## Set inspection limits

Record separate maximum counts for preparation-material self-check and implementation-unit quick check if the user configures them. Otherwise the executor chooses a default maximum from three to five according to the task. An explicit maximum such as four is a limit, not a requirement to perform four inspections.

A pass may end on the first inspection. First inspection and rechecks share the count, preparation and each implementation unit count separately, and revisions or independent Verify feedback do not reset it. At the limit, stop adding inspections, finish actionable repairs, and report unresolved and unrechecked work. Independent Verify has no self-check count limit. Keep those semantics alongside any configured number.

## Choose collaboration

Use the project's selected terminal collaboration mechanism. Recommend Herdr when a choice is needed, without making it mandatory; tmux or another supported mechanism is valid. Record the chosen tool and relevant project conventions in external guidance.

Each mechanism must support normal session startup, ordinary-message assignment, role isolation, appropriate session reuse, explicit working locations and reply routes, candidate freezing, final-result waiting, and recovery of saved results after delivery failure. Follow that tool's instructions for concrete commands. `nowait` changes only cross-session request waiting; native self-check completion barriers remain required.

Do not start all roles, install tools, or probe the environment just to establish defaults. Use the selected mechanism when actual work calls for it. If that action fails, address the concrete error rather than treating setup as a general preflight checklist.

## Record project conventions

Help maintain the project's working arrangement only when requested and permitted. This may include branch and worktree conventions, candidate preservation, checks, and ownership of shared edits. Workloop follows those external rules rather than prescribing a universal development layout.

Record the project's Ship meaning as an observable outcome with required actions, checks, acceptance conditions, protected permissions, and allowed cleanup. Examples include submitting a PR for review, running a local application for evaluation, or updating a Harness installation for an authorized trial. Select the actual project goal; do not combine examples into mandatory steps.

Separate a procedure from permission to perform it. Documenting a release or installation process does not grant a current release or installation. Defining Ship does not automatically close Tasks or require production delivery. A missing custom definition does not block another well-defined operation.

## Apply changes

Edit only the approved external guidance and keep its existing style. Explain which choices were recorded and where, including any unresolved setting that affects use. Do not copy session routes, temporary grants, live Agent identities, or pending assignments into durable defaults.

For reconfiguration, replace the applicable existing default rather than adding a conflicting duplicate. Preserve current explicit selections until the user changes them; a default update does not silently replace a role already chosen for an active execution. Re-read changed guidance when it becomes relevant.

When an actual load or tool action fails, record the error, obtain the minimum relevant details, and resolve the specific prerequisite under the available permission. Report a missing capability directly if it cannot be supplied. Do not weaken acceptance or claim a configuration change has proved host or model behavior.

Return the changed guidance location, effective defaults and scope, observed checks if any, and remaining blockers. Do not start implementation, delivery, or Task closure merely because setup is complete.
