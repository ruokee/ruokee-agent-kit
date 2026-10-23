# Handoff alignment

Draft owner: Ruokee
Draft writer: OMP gpt-6-astra

English | [中文](./22-handoff-alignment.zh.md)

## Motivation

Maintain Handoff alignment in smart-context with its existing independent protocol contract.

The [current decision](../../../decision/2026/10/12-handoff-alignment.md) names smart-cache as the owner. Integrating context features must not make Handoff depend on remote Provider selection or treat its document request as Responses V2 compaction.

## Proposal

Continue the `12-handoff-alignment` identity, replacing package ownership and `/smart-cache` with smart-context and `/smart-context`. Keep `handoffCacheEnabled` independently default-off, read in the activation snapshot, with native behavior when disabled. It remains independent of remote enablement, Provider choice, and mode.

Preserve Chat Completions and Responses applicability, same-dispatch transport-confirmed ordinary references, immutable operation snapshots, full ownership rechecks, invalidation, bounded state, and independent per-axis projection followed by atomic replacement. Retain the current positive boundaries, native history, new tails, tools, images, routing, cancellation, and explicit policy. Missing proof leaves the complete request native rather than delaying or dropping it.

Chat Completions keeps its existing system, reasoning-effort, and tool-choice projections. Responses restores only proved missing system content, preserves native `none`, nested reasoning and configuration updates, and keeps the native auto-only compatibility retry. Do not copy the remote V2 algorithm, rerun handlers, manufacture a summary, execute a returned tool, or add a retry. OMP retains generation, scheduling, fallback, adoption, history commits, and continuation.

Use the [shared alignment contract](./22-request-alignment.md) for one wrapper per method, per-session registration, owned release, and at most one rewriting capability per physical request. Other context modules do not join that coordinator. Keep separate states, staged reasons, counters, and native replacement conditions.

Verify integration with repository checks and local controlled requests using the actual host library. Real Provider benefit still needs comparable measurements when claimed, but real-model calls and a full CLI/TUI matrix are not integration acceptance gates. Preserve historical trial and installation evidence without relabeling it as evidence for the new package. Restart-based migration removes the old entry rather than stacking wrappers.

## Alternatives considered

None

## Acceptance criteria

- Both APIs retain their positive projections and conservative refusals, including native policy differences.
- Handoff works with remote disabled or configured differently, and never shares another session's reference.
- No context handler runs twice, no physical request is rewritten by two capabilities, and status triggers no model request.
- Controlled evidence distinguishes projection, native result adoption, and any separately measured Provider benefit.

## Risks

Chat Completions tool-choice restoration can still produce a tool call instead of a document; the extension executes no such tool and adds no retry. Shared preparation or transport changes can invalidate proof for both alignment capabilities, so migration must exercise both rather than only Handoff.
