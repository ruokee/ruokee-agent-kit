---
name: maintain-spec
description: Maintain or review long-lived component and repository specifications. Load before creating, changing, removing, or reviewing a spec, and when feature work changes a long-lived target, boundary, or acceptance condition. Not for ordinary reading or forming a task Goal.
metadata:
  version: "1.0.0"
---

# Maintain specifications

Maintain a complete current target for one component or repository area. Use the existing specification mechanism and the confirmed requirements. Do not turn implementation drift into a new target.

## Read the basis

1. Resolve the request, subject, working location, and write permission. A review or analysis request stays read-only. Loading this Skill grants no editing, lifecycle, or Git permission.
2. Read the project's specification supplements and applicable documentation rules. In this repository, start with [specification supplements](../../spec/README.md). Project supplements define locations, language policy, and working procedures; apply their explicit overrides to the method below. Absence of an override leaves the default method in effect.
3. Read the affected current specs, relevant current decisions including their dated `Changes`, active proposals, and the component documentation that owns the details. A proposal and an existing implementation are evidence, not approval of a requirement. Archived decisions are not current authority and must not be cited or copied into a current spec.
4. Use confirmed task requirements where they apply to the long-lived subject. A task Goal belongs to its task workflow. Do not create, interview for, revise, rename, or save it through this Skill. A historical task file named `spec.md` does not change that boundary.

Read only the documents relevant to the change. When a historical identity or relationship needs explanation, inspect that history without adopting it as the current target. Report a missing necessary source or an unresolved authority conflict; do not invent a requirement to fill it.

## Classify the change

Distinguish a new subject, a changed target, removal, boundary clarification, an omission, an implementation deviation, and editorial repair. Determine the complete affected document set before writing, including project inventories, required language versions, component documentation, current decisions, and inbound links.

A spec must not conflict with a current decision. For a target change that conflicts, identify the effective clause and the proposed change, then follow the project's ADR mechanism before changing the spec. Load `maintain-adr` when that work is needed. A spec edit that changes no durable choice needs no ADR. Do not require both Skills for every edit.

Keep quantities, conditions, exceptions, compatibility promises, and unaffected requirements intact. Distinguish an intentional closed boundary from examples or a growing inventory. A present deferral is not a permanent prohibition.

## Write the current target

Use the following sections in order where applicable:

- Goals
- Out of scope
- Public surface
- Invariants
- Host lower bound
- Acceptance criteria
- Related ADRs

Omit an inapplicable section. A repository convention, for example, has no host lower bound. Follow the project's language and heading conventions; do not create translations for a single-language project.

A spec is edited in place. It carries no revision history, review notes, task records, session information, or proposal/accepted/archived state machine. State what the subject should be and the observable results that distinguish conformance from deviation. Acceptance follows confirmed requirements rather than the implementation already available; it is not a list of test commands.

Link the page that owns a detail instead of repeating it. Command and parameter references, settings tables, file formats, and component maintenance declarations stay on their owning pages. Add only the context a spec reader needs. List related ADRs as links and follow project-relative link conventions.

For a new subject, create the required files and update the project's spec inventory. For a changed target, update the spec, component, and component documentation in the same change. For removal, handle the corresponding spec and its inventory and inbound references within the authorized removal scope. Do not reorder unrelated specs or create an archive mechanism for them.

## Division of work

- A spec states what its subject should be.
- An ADR records a durable choice, its reasons, alternatives, consequences, and necessary historical contract. A link to a spec does not replace that contract.
- A rule constrains an action. This Skill owns the main specification maintenance method; project supplements own explicit local differences.
- Component documentation tells users how to install and use a component.
- Repository documentation and its README guide contributors.
- Project Agent instructions provide navigation and the rules that must stay in view.
- The task workflow owns task Goals and execution arrangements; the task tool owns task identity and lifecycle.

## Reference direction

A spec may reference component files, component documentation, ADRs, and rules. A distributable component must not link to, name a path in, or depend on repository specification files. Its running, building, and distribution must remain independent of them. Internal project maintenance Skills may read the project material they maintain; they are not distributed components.

Specs are explanatory documentation. Existing Markdown checks handle them; maintaining the layer does not add a dedicated checker or runtime consumer.

## Check the result

Compare the complete changed target with confirmed requirements and effective decisions, including `Changes`. Check preserved requirements and the ownership of details, not merely the presence of headings. For required language versions, compare meaning and keep them complete in the same change; do not choose one version to resolve an authority conflict without permission.

Check inventories, relative paths, inbound links, language links, and heading fragments. Run the project's applicable checks under the current authorization. Formatting proves formatting, not semantic agreement or successful Agent behavior.

For review, return actionable differences and their evidence without editing the target. For maintenance, report the actual scope, basis, changes, checks, and unresolved issues. Keep execution evidence in the owning work materials, not in the spec. Complete unaffected authorized work when a necessary decision or permission blocks another part.
