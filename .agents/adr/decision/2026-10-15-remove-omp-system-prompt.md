# Remove the omp-system-prompt extension

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash
Reverses: [Retain the template functionality of an extension approaching deprecation](../archived/2026-10-07-retain-system-prompt-template.md)

English | [中文](./2026-10-15-remove-omp-system-prompt.zh.md)

## Motivation

Remove `@ruokee/omp-system-prompt` from the repository and archive the decision that keeps it.

The extension rendered its own English strategy text into the OMP system prompt through a template the user selected, inserted a Delivery chapter, and corrected the `<project-context>` footer. [Retain the template functionality of an extension approaching deprecation](../archived/2026-10-07-retain-system-prompt-template.md) kept the template, the Delivery chapter, the footer, and the current maintenance while marking the component as approaching deprecation.

A later OMP release simplified the default system prompt substantially and supports templates natively. The customization this extension performed is no longer needed for that reason, and the simplified default prompt is no longer bloated. The model prompt rules that once lived in this component moved to QoL, so the removal takes that capability away from no one.

## Analysis

The extension's own value was the Delivery chapter and the footer correction. A template render does not need the extension to run, so the strategy text survives wherever a copy of the template file still exists and the host still selects it: a user who installs such a copy as `SYSTEM_TEMPLATE.md`, or passes that copy with `--system-prompt-template`, keeps the text and receives no diagnostic. The Delivery chapter and the footer correction are lost while the extension does not run, which means it is disabled or uninstalled and the current process stops executing its handler. Deleting the repository alone does not stop a complete plugin copy that the host still loads and whose input the handler still recognizes, while a run that passes the repository path of `host-template.hbs` fails once that directory is gone, because an explicit template argument loads strictly and the host does not fall back to its own prompt.

The component has no distribution channel. Every installation comes from this repository, either copied into the local plugin directory or linked to it. A copied installation keeps running against a host version its patches were not written for; a linked installation breaks when the directory disappears. Both are installations of one machine, so no release needs a migration path.

## Decision

### Removal

`projects/omp-system-prompt` and its repository content are deleted: the package, its module entry, its template, its checks, its documentation, and its specification. The host owns system prompt assembly entirely.

The removal adds no compatibility layer, no migration guide, and no replacement component. It publishes, deprecates, and unpublishes no package, because there is no distribution channel. The local plugin installation is removed in the same change, because a linked installation would otherwise point at a deleted directory. Archived decisions and Git history keep their mentions of the component.

### Decision reversal

| Archived decision | Effective clause | Choice and conflict |
| --- | --- | --- |
| [Retain the template functionality of an extension approaching deprecation](../archived/2026-10-07-retain-system-prompt-template.md) | The component is kept as an extension approaching deprecation, and its template, Delivery chapter, footer, diagnostics, optional installation, and current maintenance remain | The component and its repository content are deleted. A record that keeps a component cannot hold together with one that deletes it, so no clause of the retention stays in force. |
| [Provide model prompt rules that are off by default through QoL](../archived/2026-10-07-use-qol-model-prompts.md) | The template, the Delivery chapter, and the footer stay with the system prompt component, which continues to maintain them, and the two components coexist with the system prompt component before QoL in actual load order | The component no longer exists. A boundary that assigns these behaviors to a deleted component cannot hold, and a load-order requirement between two components has no subject once one of them is gone. |

The reversal changes only the clauses in the table. The rest of the retention decision is scoped to the component, and the reversal of [Render the system prompt strategy only from the component template](../archived/2026-10-04-use-system-prompt-template-only.md) ends with the route it replaced.

[Provide model prompt rules that are off by default through QoL](./2026-10-15-use-qol-model-prompts.md) carries the QoL decision's rules for rule matching, composition, settings, diagnostics, and main and child sessions, which the removal leaves unaffected. It also records the reversal of the clauses that named this component, and it carries the reversal of [Add model scoped prompt rules to the system prompt extension](../archived/2026-09-14-add-model-prompt-rules.md), because the rules that reversal covers are the rules this decision keeps.

### Host floor inventory

[Maintain host components against a shared OMP floor](./2026-10-04-raise-omp-host-floor.md) names the component in its inventory of OMP-facing components. Removing the name leaves the choice, one shared bound for the remaining components, intact, so the inventory is brought into line as factual maintenance rather than a reversal.

## Alternatives considered

**Keep the component and stop maintaining it.** Considered while deciding how to retire the component. The repository component inventory stays unchanged, but the repository keeps carrying a component that serves no need, and its approaching-deprecation status stays open indefinitely without a removal date.

**Archive the retention decision and keep the component.** Considered while deciding what the record should say about a component that serves no need. This records the status change without touching the component, but the archived decision and the retained component would describe different states of the repository, and the same maintenance cost remains.

**Move the Delivery chapter and the footer correction into another component.** Considered while judging whether the two remaining behaviors need a home. This preserves them, but the reason for removing the extension is that this customization is no longer needed, so the maintenance surface would stay for behavior that is no longer wanted.

**Leave the clauses about the component in the two current decisions.** Considered while checking how far the removal reaches into the records. Those decisions would then state the present role of a deleted component, which is the state the removal introduces and the records must not contradict.

## Consequences

- The Delivery chapter and the `<project-context>` footer correction stop applying in every session where the extension does not run, which means it is disabled or uninstalled and the process no longer executes its handler. A complete plugin copy that the host still loads keeps producing both. A kept template copy supplies the strategy text alone, because both behaviors belong to the handler rather than to a template render.
- A reference the removal misses leaves the repository describing a component that does not exist. The QoL coexistence statement and the host compatibility inventory are the most likely places to be missed.
- An installed copy that keeps running does so against a host version its patches were not written for, and its patch can fail without a diagnostic, so a user can believe the strategy text is still applied.
- Removing the local installation changes state outside the repository. Without a record of the previous plugin list, restoring it needs a fresh link or install command.
- The component inventory in the specification layer, the documentation, and the changed-path check configuration describes a smaller set of components, and the specification layer owns that inventory for later readers.
