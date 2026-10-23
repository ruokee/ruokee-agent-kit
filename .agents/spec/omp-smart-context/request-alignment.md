# Request alignment

English | [中文](./request-alignment.zh.md)

## Goals

Let Remote and Handoff reuse proved common content from the same session's ordinary request. Share observation and transport coordination without merging their protocol eligibility, reasons, or benefit evidence.

## Out of scope

Owning Pin, usage, or model-rule state; rebuilding a sent result by rerunning a handler; changing ordinary or non-target requests; taking over native maintenance or a competing wrapper.

## Public surface

The [package](./README.md) owns configuration and status. [Remote](./remote.md) and [Handoff](./handoff.md) own independent applicability and repair rules. A refusal means the complete native request still sends; it never blocks, delays, or drops the request.

## Invariants

### Ordinary reference

A reference contains raw source, completed preparation, callbacks, and the actual outgoing payload from one ordinary main-loop dispatch. Confirm that they belong to the same dispatch and reach transport unchanged. Title, warming, advisor, and Handoff requests do not establish ordinary references. Handoff additionally requires a prepared tool set.

Each actual AgentSession registers its own effective model, API, tools, prompt, persistent identity, Provider identity, dispatch, and epoch. An epoch is the session's reference-validity generation. Equal models, text, endpoints, cache keys, or timing never prove session ownership. Main sessions, native task children, and Eval children retain separate references and counts.

Native CLI/SDK construction publication is observed before `session_start`; continuously check original agent, runner, and stream identities. This is not an authentication interface for arbitrary Agent instances. Unobserved or changed construction may retain complete-range proof, but equal lengths or outputs cannot grant local native independence. History-dependent image preparation and later date/cwd reminders require complete-range proof unless local dependencies are established.

### Operation lifetime

Each native operation freezes its first reference, including absence, for its entire lifetime. Newer ordinary work, handler-state changes, authentication refresh, and transport retries cannot replace it.

Navigation revokes the old epoch before switch, branch, or tree work. After native transition settles, fresh ordinary work can restore eligibility whether that transition succeeded, failed, or was cancelled. Model, tools, system, thinking, history, cancellation, compaction commit, and session release invalidate affected facts. Late responses, retries, or restored old values cannot revive invalidated work.

Automatic maintenance may commit between tool-loop steps without changing the run signal. A new ordinary dispatch binds its own credential resolver to its current epoch, preparation, and final send. It can restore the session reference while the old root operation remains permanently revoked. Only a new operation root can capture the restored reference. Ambiguous identity, a cancelled signal, or an earlier dispatch's resolver remains ineligible.

### Reuse

Prove the complete retained source range before attempting local reuse. Duplicate source messages do not invalidate a complete proof. Partial reuse requires independently extractable already-sent units, all retained dependencies, and retained processing conditions. Output equality, position, length, or provenance alone is insufficient. Do not rerun a black-box context or request handler.

Opaque history remains opaque. Native trimming, deleted dependencies, tool call/result pairing, image history, and new tails retain their native boundaries. Do not restore removed tool output or invent a pure-projection protocol.

### Coordination

Use one process coordinator, separate session registrations, immutable facts from the same ordinary dispatch, and one wrapper per native method or actual model registry. A physical request has at most one rewriting capability. V2 proof does not grant Handoff eligibility. A refusal or missing interface in one capability leaves the other usable.

Coordinator and activation records carry a contract version. A foreign version is neither reused nor changed and reports `coordinator-conflict`; activation snapshots use this contract version's own process-global key.

Construct the complete candidate, validate it at final transport after payload callbacks, then replace it atomically. An identical candidate is already aligned and is not reserialized. Missing proof preserves the whole native body with a fixed reason. Count actual transport delegations and retries, not payload callbacks; maintain independent bounded counters and keep refusals in totals.

### Native ownership

OMP owns triggering, preparation, trimming, speculation, credentials, cancellation, retries, fallback, adoption, commits, and continuation. Add no compaction entry point, `session_before_compact` handler, summary fabrication, or retry. A compaction veto remains with its installing component.

Preserve native arguments, receivers, results, exceptions, signals, and still-owned property shapes. Release a finished or replaced child only from its own registration. Restore only wrappers still owned by this package, never a competing wrapper. Release shared resources after the last registration. Retain only current references and snapshots reachable from live operations. In-flight references remain in the running process until settings or registrations are changed and OMP restarts.

## Acceptance criteria

- Concurrent sessions with the same model remain isolated, including task and Eval children, cancellation, replacement, and revival.
- A reference is established only by a confirmed ordinary send. Ordinary and non-target bodies remain unchanged, and handlers execute once.
- Invalidation permanently revokes old operations; fresh ordinary work restores only future eligibility, including continuation on an unchanged run signal.
- Independent off and refusal states preserve native requests and the other alignment capability. Each physical send has at most one writer and is counted once.
- Cleanup preserves foreign wrappers and native method behavior, and releases only the departing session's resources.

## Related ADRs

- [Request alignment](../../adr/decision/2026/10/22-request-alignment.md)
- [Context package](../../adr/decision/2026/10/12-smart-cache.md)
