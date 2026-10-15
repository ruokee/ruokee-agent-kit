# Keep pin capacity in the component

Draft owner: Ruokee
Draft writer: OMP DeepSeek V4.1 Flash

English | [中文](./2026-10-15-keep-pin-capacity-in-component.zh.md)

## Motivation

Move the capacity values of pinned text out of the decision and into the component.

[Add omp-context-pin extension](../decision/2026-09-15-add-omp-context-pin.md) fixes two capacity values inside its capacity clause: a limit for one entry body and a limit for the active entries of a branch. Both are defaults that follow from how the component is used. Pinned text carries interface agreements, file-structure notes, and commands that must run verbatim. That key material is usually short, so a modest branch total is enough, and the limits bound the worst-case context cost rather than accommodate large documents. A default of that kind moves with usage, and a decision that states it turns every later adjustment into an ADR reversal.

## Proposal

Reverse the capacity clause of [Add omp-context-pin extension](../decision/2026-09-15-add-omp-context-pin.md) and record the choice in a successor decision.

The successor keeps the mechanism without the values: both entry points check the per-entry and per-branch limits in UTF-8 bytes before any state change; an operation that would exceed either limit is rejected, changes nothing, and reports the limit and the current usage. The current values are the component's own defaults, documented in the component README, and adjusting them is a component change.

The two statements cannot hold together: a decision that fixes a value is contradicted by any adjustment of that value, so the values and the mechanism cannot both stay in the decision.

## Alternatives considered

- Keep the values in the decision and reverse it whenever a value changes. Considered while deciding where the values belong. Each adjustment would carry a proposal, a successor decision, and an archive of the previous decision, which is more record than a usage-dependent default justifies.
- Remove the values by appending a `## Changes` entry to the current decision. Considered as the lighter mechanism. An update is allowed only when the added content does not conflict with the decision, and an entry that withdraws the binding force of an existing clause conflicts with it, so this route is closed.
- State the values in the specification layer instead. Considered while checking which layer owns them. The component specification states goals, invariants, and acceptance criteria and points to the component README for the size limits. Repeating tunable values there adds a second place to keep in sync.

## Acceptance criteria

- The successor decision states the capacity mechanism and names neither value.
- The reversed decision is archived, and both records link to each other through `Reverses` and `Reversed by`.
- The component README remains the documented owner of the current values, and the component, its documentation, and its checks agree on them.

## Risks

- A successor that fails to carry over a still-effective rule of the reversed decision drops that rule from the recorded authority. The successor must preserve every rule that still applies within the decision's scope.
- Once the decision stops naming the values, a component change that adjusts them can be mistaken for a conflict with the decision, or the values can drift out of the README unnoticed. The successor must state that the values belong to the component, and the README must stay the single documented owner.
