# Align Responses Handoff

Draft owner: Ruokee
Draft writer: OMP GPT-6.1 Sol

English | [中文](./16-align-responses-handoff.zh.md)

## Motivation

Extend smart-cache Handoff alignment to native Responses side requests.

The [current Handoff decision](../../../decision/2026/10/12-handoff-alignment.md#applicability) assigns `openai-completions` sessions to Handoff and leaves `openai-responses` sessions to remote alignment. Native Responses Handoff requests do not carry the V2 compaction trigger that remote requires. Neither capability aligns these requests, even when the same session has already sent reusable ordinary content.

Responses also represents system prompts and reasoning differently from Chat Completions. Extending the API condition alone would leave its reference capture and projection unsupported. The change needs an independent Responses projection within Handoff, while [remote's V2 reuse contract](../../../decision/2026/10/10-remote-alignment.md) remains intact.

## Proposal

### Request ownership

Select the capability by the actual request kind after proving its operation ownership. An `openai-responses` session may use Handoff for a native Handoff side request and remote for an eligible V2 request. At most one capability rewrites an actual request. APIs other than `openai-completions` and `openai-responses` remain outside both capabilities.

Keep `handoffCacheEnabled` as Handoff's only switch, with its existing default and activation semantics. Responses Handoff reference capture must work when remote is disabled, its Provider is not selected, or its mode differs. Add no Provider inventory, setting, mode, package, or extension entry.

### Confirmed observations

Only a confirmed ordinary main-loop dispatch supplies a reference. Its source, completed preparation, final outgoing payload, and transport confirmation must belong to that same dispatch. Handoff and other side requests never become references. Keep the existing requirement for a tool-bearing prepared request.

The capabilities may share immutable observations of that dispatch through the existing coordinator. Each capability interprets those observations under its own protocol and proves its own eligibility. They do not share protocol rules, payload-shape rules, reason codes, or benefit evidence. A remote V2 proof never establishes Handoff eligibility, and a refusal or missing interface in one capability does not disable the other.

### Responses projection

Keep the existing Chat Completions projection and its axis-by-axis behavior. Add a separate Responses projection after the host's payload hooks, followed by validation at the actual sending boundary.

Before rewriting, prove the operation's ownership, the system-prompt prefix, the common history prefix and its correspondence to already-sent results, the new tail boundary, and tool ownership. Missing necessary proof leaves the entire native request unchanged. Within that boundary, skip and count an independent axis that cannot be restored; unrelated field differences do not veto the remaining axes. Replace a complete validated body atomically, and do not reserialize an identical candidate.

Respect Responses' native system-prompt expression, whether top-level `instructions` or a proven leading `developer` segment. Do not promote historical developer messages into the system prompt. Preserve new history and Handoff instructions, native tool schemas and call pairing, images, reasoning replay, and the user's effective thinking choice. Nested reasoning and native configuration-update state must remain consistent; copying a single effort field is insufficient.

Preserve Responses Handoff's native `toolChoice: none` and the host's existing auto-only compatibility retry. Do not restore ordinary-request auto into document generation. Keep cache keys, routing, the independent side-session identity, cancellation, and other native request options. This changes no Chat Completions tool-choice behavior and adds no retry.

### Retained contracts

Keep the [extension's ownership and capability model](../../../decision/2026/10/12-smart-cache.md) and the remote decision unchanged. Keep Handoff's native configuration authority, per-session identity and isolation, immutable operation snapshots, epoch invalidation, navigation settlement, failure behavior, bounded resources, and ownership-based wrapper restoration. New ordinary sends may restore future eligibility but never revive an invalidated operation or its late response.

Use the same coordinator and one owned wrapper per native method. External wrappers, lost ownership, and mixed installations remain conflicts rather than permission to seize a function. Closing one capability or session must not stop a valid neighbor. OMP retains document generation, scheduling, cancellation, authentication and transport retries, fallback, validation, adoption, commits, and continuation. Add no compaction entry point, veto, credential request, reference request, handler rerun, or settings mutation.

Keep `/smart-cache` as one command with separate capability state, staged reasons, and bounded operation, send, and retry counters. It starts no model turn and discloses no request content, opaque data, credentials, endpoints, private paths, or dynamic private keys. Client alignment, native adoption, and Provider cache benefit remain separate results.

### Decision reversal

Reverse [Handoff alignment](../../../decision/2026/10/12-handoff-alignment.md). Its conflicting clauses are:

- Public configuration and applicability limit Handoff to the Chat Completions shape and reserve Responses sessions for remote. Replace session-wide exclusivity with request-kind ownership and independent Responses support.
- The projection boundary and native-responsibility clauses restore ordinary `reasoning_effort` and tool choice into the side request. Those request-wide restoration rules cannot also preserve Responses' native document-generation choice and reasoning representation. Preserve the Chat Completions rules, but give Responses its own system and reasoning semantics and preserve its native document-generation tool choice.
- Independence says that nothing beyond the package, coordinator, registration, and wrappers is shared. Permit immutable ordinary-dispatch observations while keeping protocol proofs, payload-shape rules, reasons, and benefit evidence independent.

The complete successor must retain every non-conflicting Handoff contract, including the separately authorized, restart-based trial-extension cutover. Align the [component specification](../../../../spec/omp-smart-cache.md), including its evidence-sharing wording, with that successor. The extension and remote decisions are not reversed. Current decisions and the specification remain effective until the implementation change establishes the successor.

## Alternatives considered

### Restore during native preparation

Restoring context before the native serializer was considered while choosing where to restore common content. This would handle fewer wire fields directly, but later hooks and stateful serialization could still change the common prefix. It would expand preparation interception without removing the need for final-send proof, so final-payload projection is preferred.

### Extend only the API condition

Allowing Responses through the existing Handoff path was considered while choosing the API scope. That path expects Chat Completions messages and reasoning fields. Changing eligibility alone leaves Responses capture and projection unsupported and cannot preserve native Responses document-generation semantics.

## Acceptance criteria

1. A Responses session can use Handoff and V2 under their respective independent switches, with at most one rewrite owner per request. Handoff works without an eligible remote capability, and consecutive Handoffs use confirmed ordinary references rather than earlier side requests.
2. Eligible final Handoff requests reuse proven common content after payload hooks while preserving Handoff instructions, new history, native system-prompt expressions, tools, reasoning state, cache routing, and side-session identity. Responses retains native none and the host's existing compatibility retry.
3. Necessary ownership or prefix-proof failure preserves the whole native request. An independently unavailable projection axis does not prevent other valid axes, and unrelated field differences remain diagnostic rather than a whole-request equality gate.
4. Changed identity, tools, thinking choice, cancellation, navigation, late confirmation, retries, and concurrent sessions cannot revive stale references or affect a valid neighbor. External wrapping and mixed installations report conflict or unavailability without taking ownership.
5. Chat Completions Handoff and remote retain their existing contracts. Ordinary and non-target requests, including Anthropic, remain unchanged. No extra reference requests, handler executions, or retries are introduced.
6. Maintained-host native behavior and final-request evidence establish document adoption, commits, and continuation, including the maintenance lower bound. Staged state and counters describe client behavior; native outcomes are judged separately. Real Provider benefit requires separate comparable measurements; controlled responses and synthetic usage do not establish it.
7. The complete successor, component specification, and bilingual public documentation agree on request ownership, protocol independence, confirmed observations, and the verified scope. All unrelated contracts remain effective.

## Risks

A mistaken association between source history and final Responses content can insert stale or another session's content, or lose the new Handoff tail. The separate protocol proof, immutable ownership, and atomic replacement must protect those boundaries.

Responses reasoning and system-prompt forms can evolve independently of Chat Completions. Reusing the latter's projection rules could change effective thinking, duplicate developer content, or produce an invalid document request. Maintaining separate projections adds work and requires native behavior evidence.

Both capabilities use the coordinator, so a reference-capture or wrapper change for Handoff can regress remote or stop alignment for both. Independent protocol acceptance and conflict handling remain necessary. Preserving native tool choice can also leave a Provider-specific cache difference unresolved; client alignment alone does not establish a reduction in uncached input.
