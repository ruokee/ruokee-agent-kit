---
name: maintain-spec
description: Maintain or review long-lived component and repository specifications. Load before creating, changing, removing, or reviewing a spec, and when feature work changes a long-lived target, boundary, or acceptance condition. Not for ordinary reading or forming a task Goal.
metadata:
  version: "1.0.2"
---

# Maintain specifications

Maintain the complete current requirements for one component or repository area. Readers must be able to rebuild substantially the same functionality from its specification set after the original implementation and its explanatory material are removed. Different internal implementations may satisfy the same requirements. Do not turn implementation drift into a new target.

## Read the basis

1. Resolve the request, subject, working location, and write permission. A review or analysis request stays read-only. Loading this Skill grants no editing, lifecycle, or Git permission.
2. Read the project's specification supplements and applicable documentation rules. In this repository, start with [specification supplements](../../spec/README.md). Project supplements define locations, language policy, and working procedures; apply their explicit overrides to the method below. Absence of an override leaves the default method in effect.
3. Read the affected current specs, confirmed requirements, relevant current decisions including their dated `Changes`, and necessary component documentation, design, and implementation. Read task discussions when needed to establish approval or a proposed target. Check relevant sources beyond the existing links to find omitted requirements. These are the author's evidence, not dependencies for the spec reader. A suggested choice or an existing implementation does not approve a requirement. Archived decisions explain history, not the current target.
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

Omit an inapplicable section. A repository convention, for example, has no host lower bound. Follow the project's language and heading conventions; do not create translations for a single-language project.

A spec is edited in place. It carries no revision history, review notes, task records, session information, or proposal/accepted/archived state machine. State what the subject should be and the observable results that distinguish conformance from deviation. Acceptance follows confirmed requirements rather than the implementation already available; it is not a list of test commands.

State the purpose, required capabilities, input conditions, observable results, failure behavior, and acceptance completely. Preserve confirmed commands, parameters, formats, file conventions, quantities, defaults, limits, and compatibility promises when they affect the external contract. A technical identifier is not automatically an implementation detail.

Exclude descriptions of how the actual implementation works: internal functions, algorithms, state containers, storage or build organization, and execution or verification records. For a mixed clause, extract its required behavior before removing the mechanism. Do not copy whole user guides into the spec; installation instructions, examples, design explanations, and reference organization keep their own purposes.

Include no repository-file links in a spec, including language links, links to another spec, ADRs, rules, source, or component documentation. Do not replace a link with a bare path, a vague documented limit, or "as currently implemented" to delegate a requirement. A path that is itself a confirmed external interface may remain with its required behavior fully stated. Keep language, topic, and decision navigation in an existing non-spec index.

If a subject needs several specs, state each file's scope and identify the complete set in that external index. The set must be sufficient without implementation material. Split by coherent requirement areas, not by every internal module.

For a new subject, create the required files and update the project's spec inventory. For a changed target, update the spec, component, and component documentation in the same change. For removal, handle the corresponding spec and its inventory and inbound references within the authorized removal scope. Do not reorder unrelated specs or create an archive mechanism for them.

## Division of work

- A spec owns the complete required target, external behavior, and acceptance of its subject.
- An ADR records a durable choice, its reasons, alternatives, consequences, and necessary historical contract. A link to a spec does not replace that contract.
- A rule constrains an action. This Skill owns the main specification maintenance method; project supplements own explicit local differences.
- Component documentation independently tells users how to install and use a component. It expresses the same confirmed contract, not a competing target. Design explains implementation; validation material holds methods and evidence. Necessary requirements are complete in the spec even when users also need them in a guide.
- Repository documentation and its README guide contributors.
- Project Agent instructions provide navigation and the rules that must stay in view.
- The task workflow owns task Goals and execution arrangements; the task tool owns task identity and lifecycle.

## Reference direction

Other repository documents may link to a spec. Its own body contains no repository-file links. A distributable component must not link to, name a path in, or depend on repository specification files. Its running, building, and distribution remain independent of them. Internal project maintenance Skills may read the project material they maintain; they are not distributed components.

Specs are explanatory documentation. Existing Markdown checks handle them; maintaining the layer does not add a dedicated checker or runtime consumer.

## Check the result

Compare the complete changed target with confirmed requirements and effective decisions, including `Changes`. Trace every retained requirement, restored omission, and removed implementation description to its basis and destination in the owning work materials. Do not reduce this check to links or headings. Preserve quantities, defaults, exceptions, failure results, permissions, and compatibility. If original requirements and a current decision conflict, pause that clause for the maintainer's decision, preserve both sources, and continue unaffected work.

Read the complete spec set without opening the original implementation or its explanatory documents. Can a new implementer determine the required behavior and judge a different implementation against it? Reject both missing requirements delegated to another page and internal implementation descriptions relabeled as requirements. Confirmed external constraints remain valid, including exact limits.

For required languages, compare meaning and completeness in the same change; do not choose one version to resolve an authority conflict without permission. Check that every spec body has no repository-file links or indirect delegation. Check external inventories, language navigation, inbound links, and heading fragments. Run the project's applicable checks under the current authorization. Formatting proves formatting, not semantic agreement or successful Agent behavior.

For review, return actionable differences and their evidence without editing the target. For maintenance, report the actual scope, basis, changes, checks, and unresolved issues. Keep execution evidence in the owning work materials, not in the spec. Complete unaffected authorized work when a necessary decision or permission blocks another part.
