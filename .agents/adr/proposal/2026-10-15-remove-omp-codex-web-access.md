# Remove the omp-codex-web-access extension

Draft owner: Ruokee
Draft writer: OMP DeepSeek V4.1 Flash

English | [中文](./2026-10-15-remove-omp-codex-web-access.zh.md)

## Motivation

Remove `@ruokee/omp-codex-web-access` from the repository and archive the decision that keeps it.

The extension registers `codex_web_search` and `codex_web_fetch`, which reach a forwarding Provider's model through OMP's `openai-responses` API, and it configures them through five keys in OMP's native plugin settings. [Use native plugin settings for Codex web access](../decision/2026-09-10-use-codex-web-plugin-settings.md) maintains the package, its two tools, its settings contract, its activation behavior, and its model execution.

The component has been marked as approaching deprecation since 2026-10-08, in its own README and in the repository READMEs. The maintainer reports that recent OMP releases reach a forwarded Provider's model with hosted web search, which is the path `codex_web_search` covers, so that tool duplicates a host capability where this path works. Page extraction has no native equivalent, and the deprecation marking was not a plan to delete it.

The maintainer now removes the component and accepts that both tools disappear with it. Page extraction is not migrated to another component, an OMP setting, or a host configuration, and no replacement is planned.

Removing the component also changes the repository's records: the spec layer, the two root READMEs, `docs/installation`, the changed-path check configuration, and three current decisions that state the component's present role or cite its settings clause.

## Analysis

The component has no distribution channel. Installations come from this repository, either copied into an OMP plugin directory or linked to it. A copied installation keeps running after the repository drops the component, and a linked installation stops working when the directory it points at disappears. Neither is a published release, so the removal needs no migration path of its own.

Two current decisions and one current spec cite the archived decision as current authority. [Maintain the extension that improves the OMP experience](../decision/2026-10-10-maintain-omp-experience-extension.md) and [Provide remote alignment through smart-cache](../decision/2026-10-12-provide-remote-alignment.md) cite its `### Native settings` section for how a component reads OMP plugin settings; the clause they rely on says that OMP owns the settings file, the user and project scope merge, and the getter, and it is not specific to this component. The QoL spec lists the decision among the decisions behind that spec. Current documentation must not cite an archived decision as current authority, so the clause needs a home that outlives the archive and the spec's list needs a current entry for it.

The rest of the archived decision is scoped to the component: its tools, its settings keys, its activation, its migration rule, and its model execution describe behavior that no longer exists after the removal.

## Proposal

### Decisions to reverse

The following effective clause cannot coexist with this choice:

| Current decision | Effective clause | Proposed choice and conflict |
| --- | --- | --- |
| [Use native plugin settings for Codex web access](../decision/2026-09-10-use-codex-web-plugin-settings.md) | The repository maintains the `@ruokee/omp-codex-web-access` package at `projects/omp-codex-web-access` with its two tools, its native settings keys, its activation behavior, its migration rule, and its model execution | The component and its repository content are deleted, and neither tool is replaced. A decision that maintains a component cannot hold together with a decision that deletes it, so the maintenance clause cannot stay in the decision. |

The reversal changes only the clause in the table. Everything else in that decision is scoped to the component.

Delete `projects/omp-codex-web-access` and bring the repository's current records into line with the removal: the documentation that lists the component, the changed-path check configuration, and the spec layer, including the settings decision's entry in the QoL spec's related-decision list.

Record the removal in a decision that carries `Reverses`, and archive the decision above with `Archived` and `Reversed by`; its existing `Reverses` to [Add OMP Codex web access](../archived/2026-09-06-add-omp-codex-web-access.md) stays. The successor records the removal alone and does not reproduce the component's settings contract. The two decisions that cite the archived decision state what they rely on in their own text and keep their existing choices; those edits are editorial maintenance and add no `## Changes` entry.

Moving both language files of the settings decision breaks every relative link that points at its former path. The same change repairs them: the `Reversed by` entry in the addition decision and the historical mentions in the archived QoL and smart-cache decisions change their paths only, and keep their content, because an archived record freezes after its links are repaired.

[Maintain host components against a shared OMP floor](../decision/2026-10-04-raise-omp-host-floor.md) names the component in its inventory of OMP-facing components and links to the settings decision where it reports that component's bound. The component leaves that inventory, and the link goes with it. The decision's choice, one shared bound for the remaining components, is unaffected, so the change is factual maintenance rather than a reversal, and it records the update under a dated `## Changes` entry, as the decision already does for smart-cache.

The removal carries no compatibility layer, no migration guide, and no replacement component. No package is published, marked deprecated, or unpublished, because there is no distribution channel. Archived decisions and Git history keep their mentions of the component.

## Alternatives considered

**Keep the component in place and stop maintaining it.** Considered while deciding how to retire the component during requirement clarification. This leaves the component inventory and every reference unchanged, but the repository would keep an entry for a component that no longer serves a need, and the approaching-deprecation status would stay open with no removal date.

**Keep the component for page extraction and remove only the search tool.** Considered while deciding whether page extraction needs a home during requirement clarification. This preserves the tool the host does not provide, but the repository would keep maintaining the component, its checks, and its documentation for one tool.

**Move page extraction into another component or an OMP configuration.** Considered while judging whether the remaining behavior needs a home. This preserves the capability, but the removal gives page extraction up deliberately, so the migration would create a new maintenance surface for a capability the maintainer chose not to keep.

**Remove the component without an ADR proposal, as an ordinary change.** Considered while choosing whether the removal needs the ADR flow. This avoids a proposal and an archive, but a current decision would keep maintaining a component that no longer exists, and the decision chain would lose the record of why it was removed.

**Keep the local installation and remove only the repository content.** Considered while deciding how far the removal reaches during requirement clarification. This deletes only the repository copy, but the linked installation would point at a deleted directory.

**Record the settings clause as a general section of the successor decision, with its scope left implicit.** Considered while deciding where that clause lives after the archive. This keeps one source for the plugin settings contract, but a reader looking for how a component reads its settings would find that rule inside a removal decision and have to infer which components it covers.

**Record the settings clause as a general section of the successor decision and state its scope.** Considered as the other way to keep one source for that clause. This keeps the source and makes its reach explicit, but the removal decision would carry a clause unrelated to the removal.

**Write a separate decision for the native plugin settings contract.** Considered as the third way to give that clause a home. This keeps each decision to its own subject, but it widens this change beyond the removal, and the new decision's only subject would be a contract the components that use it already state for themselves.

## Acceptance criteria

- `projects/omp-codex-web-access` does not exist, and no repository file references the directory or the package, apart from archived decisions, other historical records, and Git history.
- The spec layer does not list the component: its spec pair is gone, the spec list has no entry for it, the host compatibility inventory and links do not name it, and the QoL spec's related-decision list no longer names the settings decision.
- No current decision or spec cites the archived settings decision as current authority, apart from the `Reverses` link the removal decision carries, and the QoL spec's related-decision list names the extension decision that states the settings contract.
- Every relative link to the settings decision resolves: the `Reversed by` entry in the addition decision and the historical mentions in the archived QoL and smart-cache decisions point at the archived path, and their content is unchanged.
- The root READMEs, `docs/installation` and its Chinese copy, and the changed-path check configuration no longer name the component, the remaining checklist entries keep continuous numbering, and the repository checks pass.
- The removal decision records `Reverses`; the settings decision sits in `archived/` with `Archived` and `Reversed by` and keeps its existing `Reverses`; the two decisions that cite it no longer do so and keep their existing choices.
- The host floor decision no longer names the component and no longer links to the settings decision, and a dated `## Changes` entry records the update.

## Risks

- A missed reference leaves the repository describing a component that does not exist, or pointing at a decision that has moved. The spec list, the host compatibility inventory, the root README checklist numbering, and the archived links are the most likely places to be missed.
- Stating the settings clause in two decisions lets the two copies drift apart, and a reader follows a rule that no longer matches the other copy.
- A copied installation keeps running after the repository drops the component, so a later host change can stop it without a diagnostic while the user still treats the two tools as maintained.
