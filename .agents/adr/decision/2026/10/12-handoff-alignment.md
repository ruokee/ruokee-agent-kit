# Handoff alignment

Decision owner: Ruokee
Decision writer: OMP
Reverses: [Previous decision](../../../archived/2026/10/12-r1-handoff-alignment.md)

English | [中文](./12-handoff-alignment.zh.md)

## Motivation

Maintain Handoff cache alignment as an independent capability of `@ruokee/omp-smart-cache`.

Handoff generates a handoff document or compaction summary from the live conversation. Its side request repeats system prompts, tools, and history already sent by the ordinary main loop. Rebuilding a different common prefix loses eligibility to reuse that input. Responses Handoff carries no V2 compaction trigger and therefore needs its own protocol projection rather than [remote alignment](./10-remote-alignment.md). The [extension decision](./12-smart-cache.md) records the package, capability model, and shared maintenance floor.

A local trial extension exercised some Chat Completions projections. The host exposes one method at each preparation seam. Installing a second wrapper would break existing ownership, so one package coordinates both capabilities.

## Analysis

Only a confirmed ordinary dispatch proves content was actually sent. A final side request or intermediate context cannot establish that fact alone. The host builds Handoff from current session history and the base system prompt, without directly marking request ownership or the ordinary reference. The adaptation must bind the same source observation, prepared result, outgoing payload, and response confirmation, then check the same operation during side preparation and final sending.

Responses and Chat Completions express system prompts and reasoning differently. Responses can use top-level `instructions` or leading `developer` segments. Its document generation uses native `none` and can carry reasoning configuration updates. Copying Chat Completions restoration rules would change generation policy or separate reasoning state. Client projection and native adoption can be verified independently; Provider benefit still requires comparable real requests.

## Decision

### Public configuration

Handoff alignment is one [smart-cache](./12-smart-cache.md) capability, with its own switch, state, counters, and acceptance. It adds no installation, package, settings reader, or extension entry.

The only Handoff setting is the native boolean `handoffCacheEnabled`, defaulting to `false`. It enables this capability alone and is read with remote settings in one activation snapshot. Changes require restarting OMP. With the switch off, all requests remain native. No Provider inventory, mode, or second configuration source is added. Remote retains `compactionCacheEnabled`, `compactionCacheProvider`, and `compactionCacheMode`. Handoff protects references through same-session, model, API, prompt, and tool ownership; component documentation declares verified coverage and gaps.

### Request ownership

Handoff supports `openai-completions` and `openai-responses` rather than selecting from a Provider list. In a Responses session, a proved native Handoff side request belongs to Handoff, while an eligible V2 request belongs to remote. At most one capability rewrites a physical request. Other APIs are outside both capabilities.

The switches are independent. Handoff still obtains its own eligible ordinary reference when remote is disabled, its Provider is not selected, or its mode differs. Enabling Handoff does not enable remote.

### Reference binding

Only a confirmed ordinary main-loop dispatch supplies a reference. Raw source, preparation, final payload, and actual sending must belong to that same dispatch, and the reference is published only after HTTP response confirmation. Title, advisor, warming, Handoff, and other side requests never become references. A prepared request without a tool set supplies no Handoff reference.

Each actual AgentSession owns its reference, persistent identity, Provider identity, epoch, and captured Provider, model, API, system, thinking, and tool ownership. Matching models, endpoints, cache keys, timing, or text cannot replace identity. Public message state that has not caught up cannot replace the same dispatch's actual raw source.

Every operation freezes its initial snapshot, including a missing reference. New ordinary work, authentication refresh, retries, handler-state advances, and late signal ancestry never upgrade an old operation. Each physical send and response confirmation rechecks full ownership, signal, epoch, and wrappers. Once invalidated, an operation stays invalid even if the old values return. A late successful response cannot republish its reference.

Switch, branch, and tree navigation, compaction commits, and release revoke the session's reference and old epoch. A fresh ordinary send restores later eligibility after successful, cancelled, or failed navigation settles, without restarting. Child completion, cancellation, or revival does not stop valid neighbors.

### Shared projection boundary

Before rewriting, prove operation ownership, system prefix, correspondence between source history and the already-sent common content, the new-tail boundary, and tool ownership. Missing required proof leaves the whole native request unchanged. Unknown shapes, ambiguous boundaries, and explicit generation-policy conflicts do not receive looser matching.

Within the proved boundary, project axis by axis. Skip and count an independent axis that cannot be restored; unrelated field differences do not veto other valid axes. Count known cache-sensitive differences separately. Replace the complete final candidate atomically after the host's payload hooks and revalidate every actual send. An identical candidate reports `already-aligned` without reserialization.

Preserve the Handoff instruction, new history, native tool schemas and call/result pairing, images, reasoning replay, effective user thinking, cache keys, routing, independent side session, cancellation signal, and other native options. Do not remove dependencies of common content or acquire a replacement reference from another operation.

### Chat Completions projection

When the side system is a prefix of the ordinary system, ordinary non-system history is a strict prefix of side history, and ownership still matches, restore ordinary system segments. Restore the `reasoning_effort` axis when held by the reference. Restore `tool_choice` under the existing contract when the ordinary reference has no explicit choice. Keep counts for axes that cannot be restored.

### Responses projection

Restore only missing ordinary system content with confirmed source correspondence. Top-level `instructions` accepts a known text prefix, including a missing suffix inside one system segment. Establish the unique leading `developer` boundary from system segments identified during ordinary preparation and the complete common history. Never promote historical developer messages into the system prompt.

Ordinary raw source must be a complete prefix of the native Handoff snapshot, common wire history must correspond, and new Handoff content stays intact. Only the comparison view may recognize native reasoning configuration updates. Comparing them never deletes or moves outgoing input items.

Keep native Responses `none` and the host's existing auto-only compatibility retry; do not restore ordinary auto. Keep side-request nested reasoning and native configuration updates rather than copying one ordinary effort field and separating their state. Count these unprojected axes independently without claiming full equality to the ordinary request.

### Failure boundary

Missing references, insufficient proof, changed ownership, cancellation, old epochs, ambiguous operations, unknown wrapper baselines, lost wrapper ownership, and mixed versions remain native with fixed reasons. `rejected` means no rewrite, never a blocked, delayed, or dropped request. Later hooks retain their non-projected options.

Install one owned wrapper per method and preserve native arguments, receivers, promises, credential results, exceptions, signals, and cancellation reasons. Foreign wrappers do not authorize stacking or takeover. Release restores only still-owned functions and property shapes. Last-registration cleanup releases shared resources, retaining only current references and snapshots reachable from live operations.

### Independence

The capabilities share the package, coordinator, per-session registration, one wrapper per native method, and immutable observations of the same ordinary dispatch. Each interprets those facts and proves eligibility independently. They share no protocol rules, payload-shape rules, reason codes, or benefit evidence. Handoff does not reuse the remote V2 algorithm; refusal or a missing interface in one leaves the other working.

`/smart-cache` starts no model turn. Separate sections report each capability's state, online confirmation, binding, candidate and sending reasons, and bounded operation, physical-send, retry, alignment, and refusal counters. States include disabled, unavailable, awaiting-reference, already-aligned, rewritten, and rejected. Diagnostics contain no bodies, opaque bytes, credentials, endpoints, private paths, or private dynamic keys.

### Native responsibility

OMP owns document generation, scheduling, triggering, speculation, waiting, cancellation, authentication and transport retries, model or method fallback, result validation, adoption, history commits, and continuation. This capability adds no entry point, registers no `session_before_compact`, replaces no manual compaction, vetoes no request, adds no credential or reference request, reruns no handler, changes no setting, fabricates or structurally validates no summary, and adds no retry. Native empty results, cancellation, and fallback keep host failure and adoption semantics and never count as native success.

Chat Completions tool-choice restoration can make a model call a tool instead of producing text, leaving the host with an empty document. This capability executes no such tool and adds no retry. Responses keeps native document-generation tool choice.

Replace the adaptation after behavioral verification that a maintained native interface provides equivalent results, configuration semantics, isolation, and failure behavior across required paths. An upstream merge alone is not that proof.

### Trial extension cutover

The package replaces and disables the local trial extension after this capability passes its own acceptance and installation authorization follows. This decision does not perform installation cutover.

## Alternatives considered

### Independent extension

A separate package or second entry was considered when choosing capability ownership. It duplicates registration and diagnostics and breaks wrapper ownership because each seam exposes one method, so the existing package coordinates the capability.

### Shared V2 rules

Folding Handoff into remote was considered when choosing protocol boundaries. Request shapes, generation policies, and Provider checks differ. Sharing rules would drop V2 checks or apply them incorrectly to Handoff, so only confirmed observations are shared.

### Retain the trial

The status quo had narrow evidence for one machine's manual path and lacked native configuration, per-session isolation, and a release process. It cannot deliver the required scope.

### Full field equality

Full field equality was considered when choosing refusal conditions. Unrelated differences would abandon otherwise proved valid projections, so necessary ownership and prefix boundaries stay while other axes are handled independently.

### Provider inventory

An exact Provider name, as used by remote, was considered when defining the switch. Handoff identity and protocol checks already protect its reference. Another inventory adds configuration and maintenance without adding proof.

### Preparation-stage restoration

Restoring context before serialization was considered when choosing the Responses restoration stage. Later hooks and stateful preparation can still change the wire prefix, and final-send proof remains necessary, so projection uses observed results.

### API condition alone

Routing Responses directly into the Chat path was considered when choosing API scope. That path relies on messages and flat reasoning fields. It cannot capture Responses sources or retain native generation semantics, so Responses uses an independent projection.

## Consequences

Sharing the coordinator widens the regression scope of shared changes. Ordinary, Handoff, and remote paths need separate release verification. Mixed versions or foreign wrappers can make adaptation unavailable; conservative conflict handling and restart-based cutover keep native requests available.

Host changes to preparation, system expression, or transport can invalidate source proof and lose benefit. Overly broad boundaries could restore stale content, duplicate developer messages, copy across sessions, or change generation policy. Immutable ownership and complete-candidate proof remain necessary.

Alignment guarantees neither Provider cache residency nor a hit rate or savings. Tool choice, reasoning state, and server policy can retain cache differences. Controlled responses and synthetic usage do not replace real benefit verification.
