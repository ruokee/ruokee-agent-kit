# Status

[中文](./status.zh.md)

Run `/smart-context` to read capability state without starting a model turn. Remote and Handoff have separate sections; usage, model rules, and Pin follow them. Reports contain no message or rule bodies, opaque history, credentials, raw endpoints, or private paths.

## Alignment states

- `disabled`: the capability's switch is off.
- `unavailable`: configuration, a required host interface, session identity, or conflicting extension ownership prevents use. Read the fixed reason.
- `awaiting-reference`: no confirmed eligible ordinary request is available. Send an ordinary prompt before trying another compaction or Handoff.
- `already-aligned`: the native request already matches the eligible aligned result; no rewrite was needed.
- `rewritten`: a validated aligned request was sent to native transport.
- `rejected`: the request was sent unchanged because alignment could not be verified. It was not blocked, delayed, or dropped.

A changed model, tool set, history, branch, or cancellation can invalidate an earlier ordinary request. Fresh ordinary work can restore eligibility for future operations; it does not change a compaction already in progress.

The shared fetch observer is installed when the first ordinary model call or session-bound credential resolution starts. Proxy wrappers loaded earlier during startup remain in the transport chain. If another extension replaces the installed observer, `transport-wrapper-lost` permanently disables alignment for the affected registration; a new prompt does not reclaim the wrapper.

## Alignment fields

- `mode`: Remote's selected `standard` or `hooks` mode.
- `online`: whether an ordinary request has been confirmed and why it is or is not usable.
- `binding`: whether the current compaction or Handoff is associated with an eligible session request.
- `candidate`: the result of checking a possible rewrite.
- `sending`: whether native transport received the rewritten or original body.
- `dispatch`, `operation`, `reference`: local counters identifying an ordinary send, an operation, or its ordinary reference. They are not model or Provider identifiers.

For Anthropic, `transport-unconfirmed` preserves a caller-owned fetch; `cache-policy-unconfirmed` leaves an incompatible cache layout unchanged. An Anthropic-specific interface failure does not disable Remote or the other Handoff protocols. A newer ordinary dispatch prevents an older response from restoring its reference.

## Counters

- `operations`: logical compaction or Handoff operations.
- `sends`: actual transport sends, including retries.
- `retries`: additional sends within an operation.
- `aligned`: sends that were already aligned or successfully rewritten.
- `rewritten`: sends whose body changed.
- `rejected`: sends left native after a failed alignment check. They remain in the total.
- `reused`, `retained`: reuse and retention counts for the latest Remote send, not cumulative totals.
- `axes`, `unprojected`: Handoff repair dimensions restored or left at their native values.

Every retry increments `sends` and exactly one of `aligned` or `rejected`; a rewritten retry also increments `rewritten`. `operations` increases only for the operation's first physical send.

Counters are bounded. Alignment success says what request was sent; it is separate from OMP adopting a compaction result or a Provider reporting a cache hit.

## Other capabilities

`compactionUsage`, `modelPrompts`, and `pin` each report their own state and optional fixed `reason`. Disabled, invalid, or incompatible state in one capability does not itself disable the others. Usage also reports live process registration and entry, missing-cost, or unresolved-identity counts. See [Usage](./usage.md#check-the-result).

After changing settings or extension registrations, restart OMP. Reading status does not reload configuration or repair another extension's ownership conflict.
