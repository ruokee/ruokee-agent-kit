# Smart context

Draft owner: Ruokee
Draft writer: OMP gpt-6-astra

English | [中文](./22-smart-context.zh.md)

## Motivation

Consolidate the existing context capabilities into the self-contained `@ruokee/omp-smart-context` extension.

The capabilities have different state owners and failure boundaries, but their installation and maintenance belong together. A package contract must allow independently maintained capabilities without making its current membership a permanent architectural constraint.

## Proposal

Continue the identity of [smart-cache](../../../decision/2026/10/12-smart-cache.md). Replace its package and directory with `@ruokee/omp-smart-context` and `projects/omp-smart-context`. Keep one native extension entry, native OMP settings source, component-local dependencies and checks, and paired public documentation. Remove the old package rather than retaining an adapter or cross-component imports.

The successor keeps `decision/2026/10/12-smart-cache.md` and its language pair; the replaced pair becomes `archived/2026/10/12-r1-smart-cache`. The package rename does not reset that identity.

The conflicting clauses are the old package identity, `/smart-cache`, the requirement that every capability is opt-in, and the requirement that all capabilities share the alignment coordinator. Use `/smart-context` for read-only status, preserve each capability's specified defaults, and confine the shared coordinator to [request alignment](./22-request-alignment.md). Pin journals, usage accounting, and model-rule state keep their own owners.

Keep only common invariants in the successor: self-containment, host-owned user and project settings precedence, one activation snapshot, module-local failure isolation, a read-only status entry, and the shared OMP maintenance floor of `18.5.0`. Add no package-wide master switch. Unknown keys or an invalid settings root reject the component configuration; an invalid module key disables only its module. Diagnostics expose fixed reasons, never bodies, opaque content, credentials, raw endpoints, private paths, or dynamic private keys. Keep unrestricted host peers and no version gate.

Each capability owns its behavior, switches, state, and acceptance in its own decision. The README and component Spec own the delivered capability inventory and detailed reference. Adding or removing a capability without changing a common invariant does not reverse the package decision. Do not ship placeholder settings or introduce a module framework.

Use repository checks and local controlled runs for the integrated extension's acceptance. Keep client alignment, native behavior, and measured Provider benefit distinct. Real-model calls, measured cache savings, and a complete CLI/TUI matrix are not integration gates. Preserve historical evidence with its actual candidate and conditions.

Configuration moves explicitly to the new package at user and project scope, without runtime fallback to an old namespace or automatic edits to user settings. Cut over through a restart, preserving effective enablement and unrelated settings.

## Alternatives considered

None

## Acceptance criteria

- One self-contained package owns each migrated capability, with independent switches and failures and no old runtime alias.
- The status entry reports each delivered capability without starting a model turn or exposing content.
- Ordinary capability membership changes leave unrelated decisions unchanged; shared ownership rules apply only where their mechanism is used.
- The successor preserves still-effective self-containment and host maintenance obligations, with bilingual references and explicit evidence coverage.

## Risks

A shared release and entry can ship a regression in several capabilities together. Independent state and failure boundaries reduce interference, while combined behavior still requires controlled verification.
