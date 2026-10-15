# Remove the omp-system-prompt extension

Draft owner: Ruokee
Draft writer: OMP DeepSeek V4.1 Flash

English | [中文](./2026-10-15-remove-omp-system-prompt.zh.md)

## Motivation

Remove `@ruokee/omp-system-prompt` from the repository and archive the decision that keeps it.

The extension renders its own English strategy text into OMP's system prompt through a template the user selects, inserts a Delivery chapter, and corrects the `<project-context>` footer. [Retain the template functionality of an extension approaching deprecation](../decision/2026-10-07-retain-system-prompt-template.md) kept the template, the Delivery chapter, the footer, and the current maintenance while marking the component as approaching deprecation.

A later OMP release simplified the default system prompt substantially and supports templates natively. The customization this extension performs is no longer needed for that reason, and the simplified default prompt is no longer bloated. The model prompt rules that once lived in this component moved to QoL, so removing the component does not remove that capability.

## Analysis

The extension's own value is the Delivery chapter and the footer correction. A template render does not need the extension to run, so the strategy text survives wherever a copy of the template file still exists and the host still selects it: a user who keeps such a copy as `SYSTEM_TEMPLATE.md`, or passes that copy with `--system-prompt-template`, keeps the text without a diagnostic. The Delivery chapter and the footer correction are lost only while the extension does not run, which means it is disabled or uninstalled and the current process no longer executes its handler; deleting the repository alone does not stop a complete plugin copy that the host still loads and whose input the handler still recognizes. A run that passes the repository path of `host-template.hbs` instead fails at startup once the directory is gone, because an explicit template argument is loaded strictly and the host does not fall back to its own prompt.

The component has no distribution channel. Installations come from this repository, either copied into the local plugin directory or linked to it. A copied installation keeps running but no longer matches the host version its patches were written for; a linked installation breaks when the directory disappears. Both are installations of this machine, so no release needs a migration path.

Removing the component also touches the repository's records: the spec layer, which carries the component inventory and the QoL coexistence statement, and two current decisions that state the component's present role.

## Proposal

### Decisions to reverse

The following effective clauses cannot coexist with this choice:

| Current decision | Effective clause | Proposed choice and conflict |
| --- | --- | --- |
| [Retain the template functionality of an extension approaching deprecation](../decision/2026-10-07-retain-system-prompt-template.md) | The component is kept as an extension approaching deprecation, and its template, Delivery chapter, footer, diagnostics, optional installation, and current maintenance remain | The component and its repository content are deleted. A decision that keeps a component cannot hold together with a decision that deletes it, so the retention cannot stay in the decision. |
| [Provide model prompt rules that are off by default through QoL](../decision/2026-10-07-use-qol-model-prompts.md) | The template, the Delivery chapter, and the footer stay with the system prompt component, which continues to maintain them, and the two components coexist with the system prompt component before QoL in actual load order | The component no longer exists. A boundary that assigns these behaviors to a deleted component cannot hold, and a load-order requirement between two components has no subject once one of them is gone. |

The reversal changes only the clauses in the table. The rest of the retention decision is scoped to the component, apart from the statement that the model prompt rules moved to QoL, which the QoL decision records as its own choice. The QoL decision's rules for rule matching, composition, settings, diagnostics, and main and child sessions are unaffected, and its successor keeps them.

Delete `projects/omp-system-prompt` and bring the repository's current records into line with the removal: the documentation that lists the component, the changed-path check configuration, the spec layer, and the two current decisions above.

Record the removal in a decision, archive the retention decision, and replace the QoL decision with a successor that keeps its still-effective rules. The archived retention decision keeps its existing `Reverses` and gains `Archived` and `Reversed by`; the new decisions record `Reverses`, so the decision chain stays readable.

[Maintain host components against a shared OMP floor](../decision/2026-10-04-raise-omp-host-floor.md) names the component in its inventory of OMP-facing components. Removing that name leaves the decision's choice, one shared bound for the remaining components, intact, so the inventory is brought into line as factual maintenance rather than a reversal.

The removal carries no compatibility layer, no migration guide, and no replacement component. No package is published, marked deprecated, or unpublished, because there is no distribution channel. Archived decisions and Git history keep their mentions of the component.

The local installation of the plugin is removed in the same change, because a linked installation would otherwise point at a deleted directory.

## Alternatives considered

**Keep the component and stop maintaining it.** Considered while deciding how to retire the component. This leaves the repository's component inventory unchanged, but the repository would keep carrying a component that no longer serves a need, and its "approaching deprecation" status would stay open indefinitely without a removal date.

**Archive the retention decision and keep the component.** Considered while choosing what the record should say about a component that no longer serves a need. This records the status change without touching the component, but the archived decision and the retained component would describe different states of the repository, and the same maintenance cost remains.

**Move the Delivery chapter and the footer correction into another component.** Considered while judging whether the two remaining behaviors need a home. This would preserve them, but the reason for removing the extension is that this customization is no longer needed, so the maintenance surface would stay for behavior that is no longer wanted.

**Leave the clauses about the component in the two current decisions and change nothing there.** Considered while checking how far the removal reaches into the records. Those decisions would then state the present role of a deleted component, which is the outcome this proposal removes elsewhere.

## Acceptance criteria

- `projects/omp-system-prompt` does not exist, and no repository file references the directory or the package, apart from archived decisions, other historical records, and Git history.
- The spec layer does not list the component: its spec pair is gone, the spec list has no entry for it, the host compatibility inventory and links do not name it, and the QoL spec declares no coexistence with it.
- Repository checks pass after the check configuration and its fixture stop referring to the component.
- The removal decision and the successor QoL decision record `Reverses`; the retention decision and the QoL decision sit in `archived/` with `Archived` and `Reversed by`, and the retention decision keeps its existing `Reverses`.
- The host floor decision's component inventory no longer names the component.
- The local plugin installation no longer contains the plugin, and the link into the repository is gone.

## Risks

- A missed reference leaves the repository describing a component that does not exist. The QoL coexistence statement and the host compatibility inventory are the most likely places to be missed.
- An installed copy keeps running against a host version it was not written for, and its patch may fail without a diagnostic, so the user may believe the strategy text is still applied.
- Removing the local installation changes state outside the repository. Without a record of the previous plugin list, restoring it needs a fresh link or install command.
- A successor QoL decision that drops a still-effective rule, or a missing relationship field, leaves the decision chain incomplete and lets a rule that still binds disappear from the current records.
