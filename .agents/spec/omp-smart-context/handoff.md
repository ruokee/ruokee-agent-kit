# Handoff alignment

## Goals

Align native Handoff requests with a confirmed ordinary request from the same session, preserving native document generation, adoption, and continuation.

## Out of scope

APIs other than `openai-completions` and `openai-responses`, new commands or document persistence, manual-compaction replacement, summary fabrication, extra retries, or projecting Responses generation policy to ordinary values.

## Public surface

`handoffCacheEnabled` is boolean, default `false`. OMP project settings override user settings, missing keys take defaults, and changes require restart. It has no Provider filter or mode and is independent of Remote settings. Responses Handoff does not require Remote activation, a matching Provider, or any particular Remote mode. V2 remains Remote's responsibility. Unsupported APIs keep native behavior. `/smart-context` reports Handoff's state and counts separately.

## Invariants

The shared request-alignment requirements apply to Handoff. The actual request kind and confirmed operation ownership determine eligibility; each physical request has at most one writer. Main sessions, native task children, and Eval children remain isolated even when their models and request text are equal.

### Reference confirmation

The reference belongs to one confirmed ordinary dispatch with its Provider and persistent session identities, effective model and API, system prompt, thinking state, and tool set. These facts and cancellation status must remain valid through the successful response. A prepared request without tools supplies no reference. Tool definitions must match the host's wire representation, including callable schemas. Invalidated or cancelled work cannot establish a reference.

The operation's reference is immutable across newer work, authentication refresh, transport retries, and handler-state changes. Responses source must belong to that same ordinary context dispatch, even while public Agent state is not yet synchronized. Only confirmed final ordinary transport followed by a 2xx response establishes the reference. Alignment calls never become references.

Unknown native Handoff provenance leaves the request unchanged. Loss of required interception makes Handoff unavailable. Complete operation ownership must remain valid at every physical send; a changed owner permanently revokes the operation even if later values or bodies return to their old values. Payload callbacks are preparation, not sends. Validate the actual final transport request and count every delegation and retry there.

### Common history

Rewrite only when the side system is a prefix of the reference system and the reference non-system history is a strict prefix of the side history. The bound native Handoff snapshot must retain its complete source prefix and have a new tail.

Source comparison excludes only assistant top-level `completedAt` and `contextSnapshot`, which the host backfills as local bookkeeping after dispatch. Content, Provider replay payloads, unknown fields, and every other field match strictly. Neither captured history nor outgoing input is changed. Final wire-history proof remains separate.

### Chat Completions

Restore the ordinary system/developer fragments and `reasoning_effort`. Restore the ordinary `tool_choice` only when the side choice was not explicit. Keep native side instructions and the new history tail. Restoring tool choice can produce a tool call rather than document text; this remains a native generation failure rather than being suppressed or retried by the extension.

### Responses

Recognize the system expression in the host's prepared wire format and restore only proved missing system content.

For top-level instructions, match the known ordinary system fragments with native side instructions as a text prefix. Replacing instructions leaves the complete input untouched. For a leading developer expression, known ordinary fragments and common history must identify exactly one side-system boundary. Replace only that leading system, preserving positions of historical developer messages. Both missing complete fragments and a missing suffix within a fragment can be restored.

Tool definitions must match. Images, new history, call/result pairing, cache keys, and side identity stay native. Nested reasoning, native configuration updates, and `none` are not projected to ordinary values. Keep the host's existing auto-only compatibility retry. Exclude strictly recognized reasoning configuration updates only from common-history comparison, never insert or remove them in outgoing input. Native effective reasoning and generation semantics remain, with differences counted as axes or unprojected.

Missing required proof preserves the whole request. Skip and count an independently unrestorable axis; unrelated fields do not veto proved system projection. The complete candidate must remain valid after payload hooks and be applied as one final-transport replacement. Identical candidates retain their original serialization.

### Native behavior

Invalidated operations, unconfirmed or changed references, and changed system prefixes or history projections send natively with fixed reasons. `rejected` never means blocked, delayed, or dropped.

OMP owns generation, triggering, speculation, cancellation, authentication and transport retries, model and method fallback, document validation, history commits, and continuation. Keep native routing, the independent side session, and native manual-focus and automatic generation behavior. Add no `session_before_compact` interception, retry, command, or document store.

Replace the adaptation only after behavioral verification that a maintained native interface provides equivalent results, configuration semantics, isolation, and failure behavior across required paths. An upstream merge alone is insufficient.

## Acceptance criteria

- Both APIs restore only their permitted axes, preserve native side instructions and new history, and work independently of Remote settings.
- Responses covers both system expressions, historical developer positions, missing fragments and suffixes, image history, callable tools, native reasoning updates, and ordinary state not yet synchronized.
- Bookkeeping-only backfill is accepted; changed content, replay payloads, unknown source fields, and changed final wire history are refused.
- Navigation, cancellation, tool/model/system/thinking/Provider changes, compaction, and release cannot revive old references or operations. A retry after owner restoration remains native once revoked.
- Actual sends and retries are counted at transport, later payload options survive, foreign ownership remains intact, and native document adoption or failure remains native.
