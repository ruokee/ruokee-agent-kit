# Design

[中文](./design.zh.md)

The alignment modules in `omp-smart-context` rewrite proved target requests to reuse common content from the same session's already-sent ordinary request. They own only the outgoing body within their proved boundaries; OMP owns scheduling, preparation, adoption, and continuation. Usage accounting and model rules have separate state and failure boundaries.

## Reference

An ordinary main-loop dispatch becomes a reference only when its source, completed preparation, existing callbacks, and actual outgoing payload belong to the same dispatch and reach transport unchanged. Raw history, preparation, and the payload must line up as one dispatch. Title, warming, advisor, and Handoff requests keep their native bodies, as do non-target requests.

Each native operation freezes its initial reference, including a missing reference, across later online work and authentication or transport retries. For remote alignment, title, warming, advisor, and Handoff requests keep their native bodies as side requests; [Handoff alignment](#handoff-alignment) is the capability that aligns a Handoff request against the ordinary send. Every AgentSession registers separately with its own actual model, tools, prompt, persistent identity, Provider identity, epoch, and dispatch. One process dispatcher and one wrapper per actual model registry serve concurrent sessions. Model equality, endpoint, cache key, timing, or text never define identity.

Automatic maintenance can commit history between tool-loop model steps without replacing the run signal. A fresh ordinary dispatch binds the credential resolver created for that dispatch to its current epoch, preparation, and final send. This restores the session reference after the commit while permanently revoking the old root operation. A later compaction operation captures the restored reference only on its own new root; an old operation or retry never acquires it. Ambiguous identity, a cancelled signal, and a resolver from an earlier dispatch remain ineligible.

Native compaction rebuilds its source from journal history. The host's hidden, agent-attributed `eval-state-context` custom message is a display-derived projection, not part of that source. Only an observed native session recognizes that exact metadata. Ordinary requests and their captured raw messages remain unchanged; the canonical source excludes this projection before full-range retention is checked. `standard` also checks recognized preparation against the unfiltered source. User messages, other custom messages, and unconfirmed construction retain every source dependency. This recognition grants no local independence and does not restore trimmed tool output.

## Reuse

A complete retained source range is proved before any local matching, and a duplicate source message still admits a complete proof. With partial retention, only already-sent units that can be extracted independently, with all dependencies and processing conditions retained, may be reused. Equal output, length, index, or provenance alone is not independence.

Native rewritten tool output stays rewritten, deleted dependencies are not restored, and new ordinary, tool, and image tails, opaque history, call/result pairing, and the trigger keep their native boundaries. An indivisible result whose dependencies changed leaves the whole request native with `projection-dependency-changed`. Unknown provenance or unit boundaries leave it native with `projection-unconfirmed`. Both refusals count as unaligned and stay in the total. The package offers no frozen pure-projection protocol and never re-executes a black-box handler.

## Modes

Both modes align recognized native common content, including valid tool-schema preparation, reminders, replay semantics, and implicit tool-choice defaults. V2 keeps its own output limit or omission.

- `standard` accepts recognized native preparation differences.
- `hooks` additionally reuses proved already-sent handling results. A complete retained range supports lawful insertion, reordering, restoration, cross-range merging, images, and existing post-payload transformations. Stateful handlers run once.

## Handoff alignment

Handoff writes its document or summary from the live conversation and sends that work as a side request built from the session's history plus a base system prompt. That request repeats a prefix the ordinary main-loop dispatch already sent, so this capability aligns it against the confirmed ordinary request of the same session. Remote alignment treats those same requests as side requests with their own bodies; this capability is what gives a side request a shared prefix with the ordinary send.

Handoff supports `openai-completions` and `openai-responses`. Prove operation ownership before dispatching by actual request kind. Responses Handoff does not require remote activation, a matching Provider, or a particular mode; remote still owns V2. Other APIs remain native, with at most one rewriting capability per request.

The reference is the same kind of confirmed ordinary dispatch the remote capability requires, captured together with the ownership it was observed under: Provider, model identity, API, system prompt, thinking state, and tool set. It is immutable for the operation it belongs to; newer online work, an authentication refresh, a transport retry, and a handler-state advance cannot move it. Switch, branch, and tree navigation, a compaction commit, and session release clear it and invalidate that session's epoch, and a new ordinary send restores eligibility without restarting OMP. The calls this capability aligns never become a reference. A prepared request that carries no tool set supplies no reference, so a session that never sends tools stays native.

A pending ordinary reference freezes its dispatch epoch, persistent and Provider identities, cancellation signal, and complete owner. Confirmation checks those facts again after a successful response. Invalidated or cancelled pending work cannot publish a reference. Tool ownership uses the host's wire-schema conversion before cloning, including native callable schemas.

Native construction observation records the two Handoff methods before registration. An unconfirmed baseline leaves them untouched; losing an installed wrapper makes this capability unavailable. Every physical send checks the operation's complete owner before consulting its memo. A changed owner permanently revokes the operation, even if a later retry has the same body or restores the earlier values. The payload callback only marks native preparation complete. The shared transport boundary performs the projection and counts each actual delegation and retry.

The capability rewrites a side request only when the side system is a prefix of the reference system and the reference's non-system history is a strict prefix of the side history. Within that boundary, Chat Completions restores online system/developer prompt fragments, the reference's `reasoning_effort`, and online `tool_choice` when no choice was explicit. Responses freezes source from the same ordinary context dispatch and uses the native serializer to identify its prepared system expression. An Agent state that may not yet be synchronized is not that source. Confirmed final ordinary transport and a 2xx response publish an independent reference. The bound native Handoff snapshot must retain its complete source prefix and include a new tail.

Source comparison excludes only the assistant's top-level `completedAt` and `contextSnapshot`, which the host fills as local session bookkeeping after dispatch. All other fields, including content, Provider replay payloads, and unknown fields, must match strictly. Neither captured history nor outgoing input is changed, and the final wire-history proof remains separate.

Responses restores only the proved system expression. Top-level instructions must match the known ordinary system fragments, with native side instructions as their text prefix; restoring instructions leaves the complete input untouched. Leading developer projection requires the known ordinary system fragments and common history to identify exactly one side-system boundary. Only that leading system is replaced; historical developer messages keep their positions. Missing complete fragments and text suffixes within a fragment can both be restored. Tool definitions must match; new history, tool pairing, images, cache keys, and side identity remain native.

Nested reasoning, native configuration updates, and none are not projected to the ordinary values; the host's existing auto-only retry stays intact. Strictly recognized reasoning configuration updates are excluded only from the common-history comparison, never inserted into or removed from outgoing input. Effective reasoning and generation semantics remain native, with differences counted as axes or unprojected. Missing necessary proof leaves the whole request native. An independent unrestorable axis is skipped and counted, and unrelated fields do not veto system projection. The complete candidate is replaced atomically at final transport after the payload hooks; identical candidates are not reserialized.

Outside the boundary the request is sent unchanged with a fixed reason: an invalidated operation, an unconfirmed reference, a reference whose captured ownership changed, or a changed system prefix or history projection. `rejected` means this capability did not rewrite the request, and it never means the request was blocked, delayed, or dropped.

OMP retains generation, triggering, speculative adoption, cancellation, authentication and transport retries, model and method fallback, document validation, history commits, and continuation. Manual focus and automatic entry use the native shared generator; the extension adds no command or document persistence. It registers no `session_before_compact`, replaces no manual compaction, fabricates no summary, and adds no retry. Restoring Chat Completions tool choice may produce a tool call instead of text, which remains a native failure; Responses preserves native document-generation tool choice.

The capabilities share the package, process coordinator, session registration, immutable facts from the same ordinary dispatch, and one wrapper per native method. Protocol rules, payload-shape rules, eligibility proofs, reasons, and benefit evidence remain independent; V2 proof never grants Handoff eligibility. A refusal or missing interface in one leaves the other working. Coordinators and activation entries carry a contract version. A foreign version is reported as coordinator-conflict, left untouched, and not reused; activation snapshots use this version's own process-global key.

## Observation

The implementation observes native CLI/SDK publication before `session_start` and continuously checks the original agent, runner, and stream identities. That observation is not an authentication API for arbitrary constructed Agent instances. An unobserved or changed chain may keep a complete-range proof, but it cannot gain local native independence from matching lengths or outputs. History-dependent image preparation and later date/cwd reminders also need a complete-range proof when local dependencies are not established.

## Ownership

A switch, branch, or tree navigation revokes the old epoch first. After the native transition settles, a new ordinary send restores eligibility, whether the transition succeeded, was cancelled, or failed. A child's finish or replacement releases only its own registration. Cleanup restores only the wrappers this package still owns and never takes over a competing wrapper. Shared resources are released after the last registration, and retention is limited to current references and snapshots reachable through live native operations.

## Failure behavior

For remote, unknown fields, explicit policy differences, model or tool mismatch, ambiguous identity, missing proof, cancellation, foreign wrappers, or unavailable interfaces leave the whole request native. It rewrites only non-Codex Responses V2, in the main session and in native task and Eval children. Handoff uses the independent proofs and per-axis rules above. Credentials, reference requests, authentication requests, and native fallback remain with OMP; a compaction veto belongs to the component that installed it.

An update leaves in-flight references with the running process. Turning the switch off, or removing the package and restarting OMP, restores the native request path.
