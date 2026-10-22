# workloop

English | [中文](./workloop.zh.md)

Spec for the instruction component under `projects/workloop/`. Its [component guide](../../projects/workloop/README.md) owns usage details; the installed Skills own the workflow contract.

## Goals

- Provide a complete Agent workflow for new tk Tasks, from goal clarification and necessary design through planning, implementation, independent verification, and project-defined delivery.
- Make either language Skill usable independently through the target Harness's existing Skill mechanism and natural-language operation requests.
- Preserve effective requirements, permission boundaries, evidence, and current execution state across revisions and context recovery.
- Distribute complete Skills through Harness-native mechanisms and provide thin OMP command entries through a resource-only package.

## Out of scope

- Programmatic enforcement, workflow runtime code, or a dedicated installer.
- Compatibility or migration for old workflow entries or material names.
- Task management outside tk, or a general user/project configuration hierarchy. These are deferred rather than permanent prohibitions.
- Implicit integration, local installation, publication, real-model experiments, or Task closure.

## Public surface

- English Skill and common contract: [workloop](../../projects/workloop/skills/workloop/SKILL.md).
- Chinese Skill and common contract: [workloop-zh](../../projects/workloop/skills/workloop-zh/SKILL.md).
- Each Skill's operation index loads Clarify, Execute, Verify, Ship, or Supervise from its own directory, with a short conditional reference to setup.
- [Usage guide](../../projects/workloop/README.md) covers dependencies, operation selection, material ownership, examples, and configuration.
- [Installation guide](../../projects/workloop/docs/installation.md) covers standalone Skill lifecycle operations and OMP package management.
- The [OMP package](../../projects/workloop/package.json) includes both Skills and `/wl-clarify`, `/wl-exec`, `/wl-verify`, `/wl-ship`, and `/wl-supervise` as Markdown file commands.

## Invariants

- `workloop` and `workloop-zh` are independent Skill identities under `projects/workloop/skills/`, with complete equivalent instructions and the same version. Neither depends on the other language or files outside its installed directory.
- tk is required through its name and public interface, not its implementation files. Other auxiliary capabilities apply only where needed. Herdr is recommended, not mandatory.
- Clarify owns goal discussion, necessary design, and direct Plan creation or revision. Analysis materials and temporary files do not authorize implementation or configuration changes. Preparation completion does not launch or solicit execution.
- Goal describes intended results without implementation methods; diagnosis records facts and causes without repair proposals. Optional materials stay optional. Every executable task has a separate `plan.md`, including a simple or single-unit task, and may mix inline units with linked subtasks.
- Execute implements directly; Supervise schedules independent Workers. Unrestricted execution continues the remaining Plan, usually one unit at a time and several serially, without routine intermediate permission questions. Execution prohibits structured question tools by default.
- Preparation self-check is automatic after Plan formation; preparation's independent Verify starts on request. Each implementation unit needs both self-check and independent Verify. The common contract owns limits, early pass, cumulative counts, author repairs, and rechecks.
- Independent assessment is read-only, bound to its scope and candidate, and appended to the verification record. A changed candidate does not inherit an old pass.
- Role selections are independent, Senior is explicitly assigned, collaboration preserves context isolation and suitable session reuse, and requests wait for final results unless `nowait` applies. Recovery restores restrictions in plain language and reloads missing bodies without requiring a particular persistence API.
- Ship is defined by the project and effective grants. Delivery, acceptance, production release, and closure are distinct. Feedback returns only affected work to Clarify or Execute, or to a separately owned Task when appropriate.
- Initialization is optional and stores defaults in applicable external guidance. Ordinary operations do not perform proactive environment preflight; actual failures lead to focused information gathering.
- OMP commands pass only the operation, user input, and loading instructions. An explicit language-Skill selection wins; otherwise they use English. Workflow bodies remain in the actual loaded Skill directory.
- Standalone installation copies a complete language directory or uses a host-supported link. OMP package management remains separate from the ordinary repository Skill installer. Neither installs prerequisites implicitly.
- The package and both Skills share one version. Known component Markdown selects formatting; the package manifest and unregistered paths retain complete-check fallback.

## Acceptance criteria

- Each complete language directory can be copied out of the repository and its actual links followed from `SKILL.md` to every operation and setup document without escaping that directory.
- Both languages express the same required behavior, including direct planning, design-only and no-action paths, mixed Plans, serial execution, independent Worker scheduling, explicit limits, self-check termination, Verify repair cycles, context recovery, verified dependency development, and project-defined Ship feedback.
- Goal, diagnosis, Plan, inspection counts, permission separation, and append-only assessment responsibilities agree across the common contract, operation bodies, and examples.
- The component, specifications, language-identity decision, and paired public documentation agree on ownership and distribution boundaries; ordinary Skill variants keep their existing rules.
- Both language directories support complete-directory installation, replacement, removal, and internal loading-path checks in a temporary destination. The documentation states host-specific reload conditions and installation ownership.
- Package resources exist, versions agree, and every OMP entry loads its named operation with the user's input. Native discovery and collision claims have a matching host-interface basis.
- The check selector recognizes registered component Markdown without adding runtime checks and preserves complete fallback for package or unknown inputs and mixed changes.
- Evidence distinguishes file and scenario inspection from actual Harness discovery, real-model behavior, and user acceptance. No stronger runtime claim follows from textual checks alone.

## Related ADRs

- [Skill language variants](../adr/decision/2026/08/20-skill-variants.md).
- [Component self containment](../adr/decision/2026/08/24-component-self-containment.md).
- [workloop](../adr/decision/2026/10/22-workloop.md).
