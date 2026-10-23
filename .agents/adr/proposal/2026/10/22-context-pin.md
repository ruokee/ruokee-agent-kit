# Context Pin

Draft owner: Ruokee
Draft writer: OMP gpt-6-astra

English | [中文](./22-context-pin.zh.md)

## Motivation

Make Context Pin an optional capability of smart-context instead of a separate extension.

The [current Pin decision](../../../decision/2026/09/15-omp-context-pin.md) makes installation of `omp-context-pin` the activation boundary. Installing other context capabilities must not automatically add a model tool, while existing Pin users need the same journal and lifecycle behavior after migration.

## Proposal

Continue the `15-omp-context-pin` identity. Replace the independent package with Pin modules owned by the self-contained smart-context package. Introduce independent `pinEnabled`, defaulting to `false`, read from the native activation snapshot. An invalid Pin setting disables Pin without disabling other valid capabilities.

When disabled, register no `ctx_pin` tool, `/ctx-pin` command, or Pin projection handler. Do not substitute a registered tool that returns a disabled error. Preserve existing journal records and ordinary history text. When enabled, register the module once and initialize it from the current session event context, without assuming a newly registered handler receives that same event again.

Keep the session journal as authority and preserve supported record types, format versions, integer identities, revisions, retry identities, and replay. Persisted `omp-context-pin` names identify data, not a dependency on the old package. Do not rewrite user logs or introduce another store. Keep the existing `/new`, `/clear`, `/fresh`, navigation, branch, restart, and compaction semantics.

Preserve `/ctx-pin` and the [six-action tool contract](../../../decision/2026/10/17-context-pin-tool-contract.md), including current-entry writes, retry recognition before lookup, complete `show`, source labels, read-only operations without writes, confirmed user submission, and non-active Agent delivery. All actions keep approval level `read`; the module adds no authorization gate. Pin content gains no instruction authority, restores no revoked permission, and reopens no completed work.

Keep the current single-entry and total-active-body limit of 16,384 UTF-8 bytes each in component documentation rather than fixing tunable limits in the successor decision. Rejected writes change nothing, and unpinning remains available over capacity. Keep original projection order and committed compaction boundaries so a superseded revision cannot become effective after the latest one.

Replace the old component's real-host and real-model acceptance requirements with repository checks and local controlled runs of the actual journal and projection path. Controlled committed-compaction records establish the post-commit mechanism, not model-generated summary quality or real TUI behavior. Preserve historical evidence and its conditions. Maintain the tool decision's references without inventing a new action contract.

Remove the old package, distribution and check entries when smart-context owns Pin. Existing users explicitly enable `pinEnabled`, remove the old extension, and restart. No automatic installation or configuration migration occurs.

## Alternatives considered

- Enable Pin by default. Existing users would need no new switch, but users who install only for other capabilities would receive an extra model tool. Default-off preserves that choice at the cost of an explicit migration setting.

## Acceptance criteria

- Disabled Pin exposes no tool, command, or new projection, preserves data, and leaves other capabilities working.
- Enabled Pin retains six actions, user submission, numbering, capacity behavior, retries, and supported journal recovery.
- A controlled post-compaction request contains the latest effective body verbatim and does not revive an older revision after it.
- Combined requests do not repeat Pin projection or model rules, and each request has at most one alignment writer.

## Risks

Existing Pin users who omit the new switch stop receiving new projections until they enable it. Accepted user drafts can still overwrite newer entry bodies under the current-entry contract, and older tail messages and opaque history can still contain earlier text even after the active body changes.

The byte limits bound active bodies, not tokens, metadata, or accumulated tail messages, so a complete request can still overflow. Journal state and model projection remain separate; recovery may deliver a duplicate or older revision, making final projection order part of acceptance.
