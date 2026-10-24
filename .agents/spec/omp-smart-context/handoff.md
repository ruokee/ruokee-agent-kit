# Handoff alignment

## Goals

Align native Handoff requests with a confirmed ordinary request from the same session, preserving native document generation, adoption, and continuation.

Target cache alignment across nearly all models that can use native Handoff. The model and protocol set is open to extension; each protocol follows the shared ownership, projection, and native-behavior requirements.

## Out of scope

New commands or document persistence, manual-compaction replacement, summary fabrication, extra retries, or generation-policy changes outside the permitted projection axes.

## Public surface

`handoffCacheEnabled` is boolean, default `false`. OMP project settings override user settings, missing keys take defaults, and changes require restart. It has no Provider filter or mode. Handoff does not require Remote activation, a matching Provider, or any particular Remote mode. V2 remains Remote's responsibility. APIs without a supported projection keep native behavior. `/smart-context` reports Handoff's state and counts separately.

## Invariants

The shared request-alignment requirements govern reference ownership, operation lifetime, content-reuse proof, isolation, and sending. Handoff eligibility additionally depends on the actual request kind and confirmed native operation ownership.

### Reference confirmation

The reference's required identity, model, prompt, thinking, tool, and cancellation conditions must remain valid through the successful response. A prepared request without tools supplies no reference. Tool definitions must match the host's wire representation, including callable schemas.

Any source used as proof must belong to that same ordinary context dispatch, even while public Agent state is not yet synchronized. Only confirmed final ordinary transport followed by a 2xx response establishes the reference. A newer ordinary dispatch prevents an older response from publishing a reference. Alignment calls never become references.

Unknown native Handoff provenance leaves the request unchanged. Loss of required interception makes Handoff unavailable. Complete operation ownership must remain valid at every physical send; a changed owner permanently revokes the operation even if later values or bodies return to their old values.

### Common history

Rewrite only when the side system is a prefix of the reference system and the reference non-system history is a strict prefix of the side history. The bound native Handoff snapshot must retain its complete source prefix and have a new tail.

Source comparison excludes only assistant top-level `completedAt` and `contextSnapshot`, which the host backfills as local bookkeeping after dispatch. Content, Provider replay payloads, unknown fields, and every other field match strictly. Neither captured history nor outgoing input is changed. Final wire-history proof remains separate.

### Chat Completions

For `openai-completions`, restore the ordinary system/developer fragments and `reasoning_effort`. Restore the ordinary `tool_choice` only when the side choice was not explicit. Keep native side instructions and the new history tail. Restoring tool choice can produce a tool call rather than document text; this remains a native generation failure rather than being suppressed or retried by the extension.

### Responses

For `openai-responses`, recognize the system expression in the host's prepared wire format and restore only proved missing system content.

For top-level instructions, match the known ordinary system fragments with native side instructions as a text prefix. Replacing instructions leaves the complete input untouched. For a leading developer expression, known ordinary fragments and common history must identify exactly one side-system boundary. Replace only that leading system, preserving positions of historical developer messages. Both missing complete fragments and a missing suffix within a fragment can be restored.

Tool definitions must match. Images, new history, call/result pairing, cache keys, and side identity stay native. Nested reasoning, native configuration updates, and `none` are not projected to ordinary values. Keep the host's existing auto-only compatibility retry. Exclude strictly recognized reasoning configuration updates only from common-history comparison, never insert or remove them in outgoing input. Native effective reasoning and generation semantics remain, with differences counted as axes or unprojected.

Missing required proof preserves the whole request. Skip and count an independently unrestorable axis; unrelated fields do not veto proved system projection. The shared final-transport proof and atomic replacement requirements apply to the complete candidate.

### Anthropic

For `anthropic-messages`, support native API-key and OAuth paths. Restore only proved missing system text blocks or a suffix in the last block. Ordinary prepared system content must correspond to the confirmed wire system. Keep the current OAuth side request's billing and identity prefix; final billing bytes must attest that request's complete body through native CCH processing.

Require matching wire tools, a complete raw-source prefix, a strict common wire-history prefix, and a new side tail. Comparison may normalize string/text-block forms and cache markers on known content blocks only. Preserve all other fields, images, tool arguments and results, signatures, and opaque replay. Unknown fields, nested tool arguments named `cache_control`, historical system/control items, and `Continue.` cannot be hidden by normalization. Outgoing messages and tools remain untouched.

Preserve native `tool_choice`, including `none`, thinking, output configuration, context management, metadata, identity, headers, signal, routing, authentication, and retries. Unknown generation-policy shapes keep the whole request native. Do not copy ordinary policy or identity into the side request.

System cache markers follow the proved reference fragments. Do not enable disabled caching, change native TTLs, or move message/tool breakpoints. Accept only proved ephemeral markers with optional `5m` or `1h` TTL, at most four explicit breakpoints, and long TTLs before short TTLs. Top-level automatic caching, unknown marker properties, incompatible TTL policies, or a candidate over the breakpoint limit refuse the whole projection.

Verify the final original bytes before replacing the body. An identical candidate, failed final proof, or unavailable caller-owned fetch proof preserves the original body and serialization. Keep native transport policy and the selected underlying transport. Anthropic-specific interface failures cannot disable Remote or other Handoff protocols.

### Native behavior

Invalidated operations, unconfirmed or changed references, and changed system prefixes or history projections send natively with fixed reasons. `rejected` never means blocked, delayed, or dropped.

OMP owns generation, triggering, speculation, cancellation, authentication and transport retries, model and method fallback, document validation, history commits, and continuation. Keep native routing, the independent side session, and native manual-focus and automatic generation behavior. Add no `session_before_compact` interception, retry, command, or document store.

Replace the adaptation only after behavioral verification that a maintained native interface provides equivalent results, configuration semantics, isolation, and failure behavior across required paths. An upstream merge alone is insufficient.

## Acceptance criteria

- Each supported protocol restores only its permitted axes, preserves native side instructions and new history, and works independently of Remote settings.
- Responses covers both system expressions, historical developer positions, missing fragments and suffixes, image history, callable tools, native reasoning updates, and ordinary state not yet synchronized.
- Anthropic covers API-key and OAuth, missing fragments and suffixes, cache-marker movement, equivalent text forms, final native CCH bytes, native document adoption, and refusal without partial projection.
- Bookkeeping-only backfill is accepted; changed content, replay payloads, unknown source fields, and changed final wire history are refused.
- Navigation, cancellation, tool/model/system/thinking/Provider changes, compaction, and release cannot revive old references or operations. A retry after owner restoration remains native once revoked.
- Actual sends and retries are counted at transport, later payload options survive, foreign ownership remains intact, and native document adoption or failure remains native.
