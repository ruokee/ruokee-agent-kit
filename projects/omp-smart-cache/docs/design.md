# Design

[中文](./design.zh.md)

`omp-smart-cache` rewrites an already-sent request so its common content matches what the Provider caches, and the request keeps its meaning. The package owns the outgoing body of a proved target request; OMP owns everything else.

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

Applicability follows the session's API. A session whose model API is `openai-completions` is a candidate, one whose API is `openai-responses` stays with remote alignment, and any other API uses neither capability. One request is taken by at most one capability, and one switch never enables the other.

The reference is the same kind of confirmed ordinary dispatch the remote capability requires, captured together with the ownership it was observed under: Provider, model identity, API, system prompt, thinking state, and tool set. It is immutable for the operation it belongs to; newer online work, an authentication refresh, a transport retry, and a handler-state advance cannot move it. Switch, branch, and tree navigation, a compaction commit, and session release clear it and invalidate that session's epoch, and a new ordinary send restores eligibility without restarting OMP. The calls this capability aligns never become a reference. A prepared request that carries no tool set supplies no reference, so a session that never sends tools stays native.

Within the boundary the capability restores the online system segments, which are the serializer's prompt fragments under either the `system` or the `developer` role, the online `reasoning_effort` when the reference holds one, and the online `tool_choice` when the reference holds no explicit choice, replacing the body once after the host's own payload hooks and leaving the side instruction, the new history, the cache keys, the cancellation signal, and every other option untouched. Projections are restored axis by axis: an axis that cannot be restored is skipped and counted, a known cache-sensitive field outside those axes is compared with the reference and counted when it differs, and an unrelated difference never abandons the rewrite. Field equality is not the gate; the operation binding and the prefix checks are. An identical candidate is reported as `already-aligned` and is not reserialized.

Outside the boundary the request is sent unchanged with a fixed reason: an invalidated operation, an unconfirmed reference, a reference whose captured ownership changed, or a changed system prefix or history projection. `rejected` means this capability did not rewrite the request, and it never means the request was blocked, delayed, or dropped.

OMP keeps document generation, triggering, cancellation, authentication and transport retries, model and method fallback, document validation, history commits, and continuation. The capability adds no entry point, registers no `session_before_compact`, replaces no manual compaction, fabricates no summary, and adds no retry. Restoring the online tool choice can make the model call a tool instead of producing text, and that failure stays the host's own outcome rather than a capability success.

The two capabilities share the package, the process coordinator, the per-session registration, and one wrapper per native method, and share no protocol rules, payload shapes, reason codes, or evidence; a refusal or a missing interface in one leaves the other working. The process-global coordinator and the activation entries carry a contract version, so a copy of another version is never read as this version's state: a foreign coordinator is reported as `coordinator-conflict` and left untouched, and the activation snapshot is cached under this version's own process-global key, so a copy of another version neither reads this entry nor writes one this version would reuse.

## Observation

The implementation observes native CLI/SDK publication before `session_start` and continuously checks the original agent, runner, and stream identities. That observation is not an authentication API for arbitrary constructed Agent instances. An unobserved or changed chain may keep a complete-range proof, but it cannot gain local native independence from matching lengths or outputs. History-dependent image preparation and later date/cwd reminders also need a complete-range proof when local dependencies are not established.

## Ownership

A switch, branch, or tree navigation revokes the old epoch first. After the native transition settles, a new ordinary send restores eligibility, whether the transition succeeded, was cancelled, or failed. A child's finish or replacement releases only its own registration. Cleanup restores only the wrappers this package still owns and never takes over a competing wrapper. Shared resources are released after the last registration, and retention is limited to current references and snapshots reachable through live native operations.

## Failure behavior

Unknown fields, explicit policy differences, a model or tool mismatch, ambiguous identity, a missing reference, a cancelled operation, a foreign wrapper, or an unavailable interface leave the whole request native. The rewrite covers the non-Codex Responses V2 remote compaction path only. Credentials, reference and authentication requests, and Handoff behavior stay with OMP, and a compaction veto stays with the component that installed it.

An update leaves in-flight references with the running process. Turning the switch off, or removing the package and restarting OMP, restores the native request path.
