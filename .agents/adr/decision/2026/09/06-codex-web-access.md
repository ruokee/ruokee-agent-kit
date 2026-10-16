# Codex web access

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash
Reverses: [Codex web access](../../../archived/2026/09/06-r2-codex-web-access.md)

English | [中文](./06-codex-web-access.zh.md)

## Motivation

Remove the `@ruokee/omp-codex-web-access` extension from the repository and reverse the decision that maintained it.

The extension reached a forwarding Provider's model through OMP's `openai-responses` API and configured both tools through five keys in OMP's native plugin settings. It was marked as approaching deprecation on 2026-10-08: recent OMP releases reach a forwarded Provider's model with hosted web search, which is the path `codex_web_search` covered, so that tool duplicated a host capability where this path works, and no session had confirmed a gateway executing the hosted search tool. Page extraction had no native equivalent.

Both tools disappear with the component: page extraction is not migrated to another component, an OMP setting, or a host configuration, and no replacement is planned.

## Decision

### Removed component

The repository does not maintain `@ruokee/omp-codex-web-access`. `projects/omp-codex-web-access` and its repository content are gone, and no component provides `codex_web_search` or `codex_web_fetch`.

The host maintenance rules keep one shared lower bound for the remaining OMP-facing components, and the removal of one name does not change that bound or another component's contract.

### Rules that do not survive

The reversed decision had one subject, the component: its package, its two tools, its settings keys, its activation, its migration rule, and its model execution. None of those clauses keeps an object once the component is gone, so the removal keeps none of them. The plugin settings contract that [Maintain the extension that improves the OMP experience](./20-omp-qol.md) and [Provide remote alignment through smart-cache](../10/10-remote-alignment.md) rely on is stated by those decisions themselves: OMP owns the settings file, the user and project scope merge, and the parsing.

Archived decisions and Git history keep their mentions of the component.

## Alternatives considered

**Keep the component for page extraction and remove only the search tool.** Considered while deciding whether page extraction needs a home. It preserves the tool the host does not provide, but the repository would keep maintaining the component, its checks, and its documentation for one tool whose need the maintainer no longer recognized.

**Keep the component in place and stop maintaining it.** Considered while deciding how to retire the component. It leaves the component inventory and every reference unchanged, but the repository would keep an entry for a component that no longer serves a need, and the approaching-deprecation status would stay open with no removal date.

**Remove the component without reversing the settings decision.** Considered while choosing whether the removal needs the ADR flow. It avoids a proposal and an archive, but a current decision would keep maintaining a component that no longer exists, and the decision chain would lose the record of why it was removed.

## Consequences

- A user who installed the component from this repository loses both tools once that copy is removed. A copied installation keeps running until the user removes it or a host change breaks it, and it receives no further maintenance.
- The repository's OMP-facing component inventory and the host maintenance rules no longer include the component. The shared OMP `18.5.0` lower bound and every other component's contract are unchanged.
- Page extraction disappears from the repository's capabilities without a replacement, so a caller that needs it must use another tool or fetch the page directly.
- The plugin settings contract now has no single owning decision: a decision that relies on it states it, and a future component adopting native plugin settings states its own basis or records a decision for it.
