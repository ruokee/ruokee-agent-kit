# Handoff alignment

Decision owner: Ruokee
Decision writer: OMP
Archived: 2026-10-16
Reversed by: [Handoff alignment](../../../decision/2026/10/12-handoff-alignment.md)

English | [中文](./12-r1-handoff-alignment.zh.md)

## Motivation

Carry Handoff cache alignment as the second capability of `@ruokee/omp-smart-cache`, with its own switch and state beside [remote alignment](../../../decision/2026/10/10-remote-alignment.md).

Handoff writes the compaction summary or the handoff document from the live conversation and sends that work as a side request that repeats the session's system prompt and tool definitions. The ordinary main-loop dispatch already sent that content, and a Provider caches a request prefix, so a side request that rebuilds the system prompt differently, drops the online reasoning setting, or replaces the online tool choice pays full input price for content the conversation already paid for. Remote alignment serves a different request shape under its own Responses V2 rules, so this capability needs its own contract instead of a share of those rules. The [extension decision](../../../decision/2026/10/12-smart-cache.md) records the package, the capability model, and the shared maintenance floor.

A local trial extension aligned such side requests on one machine. It stays outside the repository, it is a single-session experiment with no settings, no per-session isolation, and no accepted evidence for the paths it never exercised, and it cannot ship as a second wrapper beside remote: the host exposes one method per seam, and the remote capability restores only the functions it still owns, so a foreign wrapper stops remote alignment with a reported conflict.

## Analysis

The capability aligns against already-sent content. Observing a final side request or an intermediate context does not prove what the online request contained or whether it reached transport, so only a confirmed ordinary main-loop dispatch can serve as the reference. The host builds the side request after that dispatch from the session's own history plus a base system prompt, and it exposes no interface that marks a request as a handoff request, identifies the dispatch that should serve as its reference, or hands over the prepared side request. The capability therefore reconstructs the operation from the session's request-preparation and sending seams, and it needs the signal those seams carry to tell one operation from another.

The host sends this work through its own side-request path rather than the session's streaming entry point, so a reference observed there belongs to the ordinary dispatch. Both preparation seams receive the same operation signal, which is what lets one binding cover the operation across those seams. A later host change to that path leaves the reference unmatched, so the boundary checks below are the guard.

Evidence from the trial is narrow. It covered the seams and the three projections on real requests, refused a stateful context projection and a user-initiated thinking change instead of overwriting them, and measured one pair of requests. It did not cover automatic or speculative compaction, cancellation and retry, model and tool switching, multimodal input, or subagents, and shared server-side caching prevents separating the contribution of each restored field.

## Decision

### Public configuration

Handoff alignment is one capability of the [smart-cache extension](../../../decision/2026/10/12-smart-cache.md), needs no separate installation, package, settings reader, or extension entry, and has its own decision, switch, state, counters, and acceptance.

Its public contract is one native OMP setting, `handoffCacheEnabled`, boolean, defaulting to `false`. It enables this capability alone; remote keeps `compactionCacheEnabled`, `compactionCacheProvider`, and `compactionCacheMode` unchanged. A disabled switch leaves every request native. No Provider whitelist, mode, or second configuration source is added, and the switch is read in the same activation snapshot as the remote settings and requires restarting OMP. Remote needs an exact Provider name because V2 opaque data, trimming, and routing semantics vary by Provider; this capability depends on the chat-completions request shape and binds its reference to the same session, model, prompt, and tool set, so a Provider key would add configuration surface and a second Provider inventory without adding protection. Component documentation declares the verified matrix and its gaps instead.

### Applicability

Applicability follows the session's API rather than a list of Providers. A session whose model API is `openai-completions` is a Handoff candidate, one whose API is `openai-responses` stays with remote alignment, and any other API uses neither capability. At most one capability takes a given request, and enabling one never enables the other.

### Reference binding

Only a confirmed ordinary main-loop dispatch supplies a reference, and only after its HTTP response confirms the send. The calls this capability aligns never become a reference. Each session keeps its own reference together with the ownership it was captured with: Provider, model identity, API, system prompt, thinking state, and tool set. A prepared request that carries no tool set supplies no reference, so a session that never sends tools stays native.

A reference is immutable for the operation it belongs to. Newer online work, an authentication refresh, a transport retry, and a handler-state advance cannot move it, and a retry cannot acquire a newer one. The binding is established at the preparation seam that identifies the operation and is resolved at the seam that prepares the outgoing request, using the signal both seams receive. Switch, branch, and tree navigation, compaction commits, and session release clear the reference and invalidate that session's epoch; an operation already bound keeps its own snapshot, and a new ordinary send restores eligibility without restarting the process.

### Projection boundary

The capability rewrites a side request only when the side system segments are a prefix of the reference system, the reference's non-system history is a strict prefix of the side history, and the reference still belongs to the same session, model, API, prompt, thinking state, and tool set. Within that boundary it restores the online system segments, the online `reasoning_effort` when the reference holds one, and the online `tool_choice` when the reference holds no explicit choice. It replaces the request body once, after the host's own payload hooks, and leaves the side instruction, the new history, the cache keys, the cancellation signal, and every other request option untouched.

Projections are restored axis by axis. An axis that cannot be restored is skipped and counted instead of abandoning the rewrite, and a known cache-sensitive field outside those axes is compared with the reference and counted when it differs. Field differences are not a gate, because the operation binding, not field equality, establishes the request identity.

A request outside the boundary is sent unchanged with a fixed reason: an invalidated operation, an unconfirmed reference, a reference whose session, model, API, prompt, thinking state, or tool set changed, or a changed system prefix or history projection. `rejected` means this capability did not rewrite the request and it never means the request was blocked, delayed, or dropped. An identical candidate is reported as already aligned without reserialization.

### Independence

The capability shares the package, the coordinator, the per-session registration, and one wrapper per native method with remote alignment, and shares nothing else: no protocol rules, payload shapes, reason codes, or benefit evidence. It does not reuse remote's Responses V2 rules, and a refusal or a missing interface in one capability leaves the other working.

`/smart-cache` stays one command that starts no model turn, and it reports both capabilities in their own sections with their own state, staged reasons, and bounded counters; the remote section keeps its current wording and fields. States distinguish `disabled`, `unavailable`, `awaiting-reference`, `already-aligned`, `rewritten`, and `rejected`, and online confirmation, reference binding, candidate validation, and sending causes stay separate so a later missing reference does not erase an earlier proof failure. Diagnostics use local session and operation identifiers, fixed reasons, and bounded counters, with no request body, opaque content, credentials, endpoint, private path, or dynamic private key.

### Native responsibility

OMP retains document generation, scheduling, triggering, cancellation, authentication and transport retries, model and method fallback, result validation, history commits, and continuation. The capability adds no entry point, registers no `session_before_compact`, replaces no manual compaction, vetoes nothing, requests no credentials, mutates no settings, fabricates no summary, validates no document structure, and adds no retry. It forwards native arguments, receivers, promises, exceptions, signals, and cancellation reasons unchanged, and a host-chosen fallback stays native rather than being reported as alignment. Restoring the online tool choice can make the model call a tool instead of producing text, and that failure surfaces as the host's own empty-document outcome.

Choose maintained behavior by capability and structure. Replace these adaptations when a maintained native interface provides equivalent results, configuration semantics, isolation, and failure behavior across the required paths, after behavioral verification rather than merely an upstream merge.

### Trial extension cutover

The local trial extension stays installed only until this capability passes its own acceptance and an installation authorization follows. That authorized cutover replaces and disables the trial; this decision does not perform it. While the trial extension is still auto-discovered, the package reports a conservative wrapper conflict instead of seizing a wrapper, and the cutover happens by restarting affected processes rather than by transferring in-flight state.

## Alternatives considered

None

## Consequences

- Two capabilities in one coordinator can interfere. A change made for one capability can alter the shared wrapper, the per-session lifecycle, or the other capability's diagnostics, so a regression in one can ship together with an improvement in the other. Moving remote's rules unchanged and re-running its acceptance before release are the guard.
- A user can enable the switch while the trial extension is still discovered. One wrapper can then drop the other, so alignment stops with a reported conflict, or a wrapper loop repeats the same rewrite; the conservative conflict report and the restart-based cutover bound this without preventing the coexistence.
- Aligning a request does not guarantee a Provider cache hit. The capability can add maintenance without repeating the observed benefit.
- A host change to the side-request path can leave the reference unmatched, so the capability refuses and reports the fixed reason while losing the benefit; with boundary checks that are too loose it can instead restore a system prompt or tool choice the host no longer intends, producing a wrong or truncated handoff document.
- Restoring the online tool choice into a request the host builds for document generation can make the model call a tool instead of producing text, and the host's document extraction then fails. The capability executes no tool and adds no retry, so that failure stays the host's own outcome rather than a capability success.
