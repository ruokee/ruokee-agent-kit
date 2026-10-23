# Handoff alignment

English | [中文](./handoff.zh.md)

## Goals

Align native Handoff requests with a confirmed ordinary request from the same session, preserving native document generation, adoption, and continuation.

## Out of scope

APIs other than `openai-completions` and `openai-responses`, new commands or document persistence, manual-compaction replacement, summary fabrication, extra retries, or projecting Responses generation policy to ordinary values.

## Public surface

`handoffCacheEnabled` is a boolean, default `false`, read in the [package activation snapshot](./README.md#configuration). It has no Provider filter or mode and is independent of Remote settings. Responses Handoff does not require Remote activation, a matching Provider, or any particular Remote mode. V2 remains Remote's responsibility. Unsupported APIs keep their native behavior.

## Invariants

Apply the [shared reference and lifetime contract](./request-alignment.md). Dispatch by actual request kind after proving operation ownership; each physical request has at most one writer.

### Reference confirmation

Capture the same confirmed ordinary dispatch together with Provider, model identity, API, system prompt, thinking state, and tool set. A prepared request without tools supplies no reference. Pending confirmation freezes dispatch epoch, persistent and Provider identities, cancellation signal, and the complete owner, then rechecks them after the successful response. Invalidated or cancelled work cannot publish a reference. Freeze tool definitions through the host's native wire-schema conversion, including callable schemas.

The operation's reference is immutable across newer work, authentication refresh, transport retries, and handler-state changes. Capture Responses source from that same ordinary context dispatch, never from public Agent state that may not yet be synchronized. Confirmed final ordinary transport and a 2xx response establish the independent reference. Alignment calls themselves never become references.

Observe the native construction baseline of both Handoff methods before registration. An unconfirmed baseline leaves them untouched; loss of an installed wrapper makes Handoff unavailable. Check the operation's complete owner on every physical send before consulting cached operation results. An owner change permanently revokes that operation, even if later values or request bodies match the old ones. The payload callback marks preparation only; final transport performs projection and counts each delegation or retry.

### Common history

Rewrite only when the side system is a prefix of the reference system and the reference non-system history is a strict prefix of the side history. The bound native Handoff snapshot must retain its complete source prefix and have a new tail.

Source comparison excludes only assistant top-level `completedAt` and `contextSnapshot`, which the host backfills as local bookkeeping after dispatch. Content, Provider replay payloads, unknown fields, and every other field match strictly. Neither captured history nor outgoing input is changed. Final wire-history proof remains separate.

### Chat Completions

Restore the ordinary system/developer fragments and `reasoning_effort`. Restore the ordinary `tool_choice` only when the side choice was not explicit. Keep native side instructions and the new history tail. Restoring tool choice can produce a tool call rather than document text; this remains a native generation failure rather than being suppressed or retried by the extension.

### Responses

Use the native serializer to identify the prepared system expression and restore only the proved missing system content.

For top-level instructions, match the known ordinary system fragments with native side instructions as a text prefix. Replacing instructions leaves the complete input untouched. For a leading developer expression, known ordinary fragments and common history must identify exactly one side-system boundary. Replace only that leading system, preserving positions of historical developer messages. Both missing complete fragments and a missing suffix within a fragment can be restored.

Tool definitions must match. Images, new history, call/result pairing, cache keys, and side identity stay native. Nested reasoning, native configuration updates, and `none` are not projected to ordinary values. Keep the host's existing auto-only compatibility retry. Exclude strictly recognized reasoning configuration updates only from common-history comparison, never insert or remove them in outgoing input. Native effective reasoning and generation semantics remain, with differences counted as axes or unprojected.

Missing required proof preserves the whole request. Skip and count an independently unrestorable axis; unrelated fields do not veto proved system projection. Replace the complete validated candidate atomically at final transport after payload hooks. Identical candidates are not reserialized.

### Native behavior

Invalidated operations, unconfirmed or changed references, and changed system prefixes or history projections send natively with fixed reasons. `rejected` never means blocked, delayed, or dropped.

OMP owns generation, triggering, speculation, cancellation, authentication and transport retries, model and method fallback, document validation, history commits, and continuation. Keep native routing and the independent side session unchanged. Native manual focus and automatic entry use the host generator. Register no `session_before_compact` handler and add no retry, command, or document store.

Replace the adaptation only after behavioral verification that a maintained native interface provides equivalent results, configuration semantics, isolation, and failure behavior across required paths. An upstream merge alone is insufficient.

## Acceptance criteria

- Both APIs restore only their permitted axes, preserve native side instructions and new history, and work independently of Remote settings.
- Responses covers both system expressions, historical developer positions, missing fragments and suffixes, image history, callable tools, native reasoning updates, and ordinary state not yet synchronized.
- Bookkeeping-only backfill is accepted; changed content, replay payloads, unknown source fields, and changed final wire history are refused.
- Navigation, cancellation, tool/model/system/thinking/Provider changes, compaction, and release cannot revive old references or operations. A retry after owner restoration remains native once revoked.
- Actual sends and retries are counted at transport, later payload options survive, competing wrappers remain installed, and native document adoption or failure remains native.

## Related ADRs

- [Handoff alignment](../../adr/decision/2026/10/12-handoff-alignment.md)
- [Request alignment](../../adr/decision/2026/10/22-request-alignment.md)
