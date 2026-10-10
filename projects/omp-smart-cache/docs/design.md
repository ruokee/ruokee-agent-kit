# Design

[中文](./design.zh.md)

`omp-smart-cache` rewrites an already-sent request so its common content matches what the Provider caches, and the request keeps its meaning. The package owns the outgoing body of a proved target request; OMP owns everything else.

## Reference

An ordinary main-loop dispatch becomes a reference only when its source, completed preparation, existing callbacks, and actual outgoing payload belong to the same dispatch and reach transport unchanged. Raw history, preparation, and the payload must line up as one dispatch. Title, warming, advisor, and Handoff requests keep their native bodies, as do non-target requests.

Each native operation freezes its initial reference, including a missing reference, across later online work and authentication or transport retries. Every AgentSession registers separately with its own actual model, tools, prompt, persistent identity, Provider identity, epoch, and dispatch. One process dispatcher and one wrapper per actual model registry serve concurrent sessions. Model equality, endpoint, cache key, timing, or text never define identity.

## Reuse

A complete retained source range is proved before any local matching, and a duplicate source message still admits a complete proof. With partial retention, only already-sent units that can be extracted independently, with all dependencies and processing conditions retained, may be reused. Equal output, length, index, or provenance alone is not independence.

Native rewritten tool output stays rewritten, deleted dependencies are not restored, and new ordinary, tool, and image tails, opaque history, call/result pairing, and the trigger keep their native boundaries. An indivisible result whose dependencies changed leaves the whole request native with `projection-dependency-changed`. Unknown provenance or unit boundaries leave it native with `projection-unconfirmed`. Both refusals count as unaligned and stay in the total. The package offers no frozen pure-projection protocol and never re-executes a black-box handler.

## Modes

Both modes align recognized native common content, including valid tool-schema preparation, reminders, replay semantics, and implicit tool-choice defaults. V2 keeps its own output limit or omission.

- `standard` accepts recognized native preparation differences.
- `hooks` additionally reuses proved already-sent handling results. A complete retained range supports lawful insertion, reordering, restoration, cross-range merging, images, and existing post-payload transformations. Stateful handlers run once.

## Observation and ownership

The implementation observes native CLI/SDK publication before `session_start` and continuously checks the original agent, runner, and stream identities. That observation is not an authentication API for arbitrary constructed Agent instances. An unobserved or changed chain may keep a complete-range proof, but it cannot gain local native independence from matching lengths or outputs. History-dependent image preparation and later date/cwd reminders also need a complete-range proof when local dependencies are not established.

A switch, branch, or tree navigation revokes the old epoch first. After the native transition settles, a new ordinary send restores eligibility, whether the transition succeeded, was cancelled, or failed. A child's finish or replacement releases only its own registration. Cleanup restores only the wrappers this package still owns and never takes over a competing wrapper. Shared resources are released after the last registration, and retention is limited to current references and snapshots reachable through live native operations.

## Failure behavior

Unknown fields, explicit policy differences, a model or tool mismatch, ambiguous identity, a missing reference, a cancelled operation, a foreign wrapper, or an unavailable interface leave the whole request native. The rewrite covers the non-Codex Responses V2 remote compaction path only. Credentials, reference and authentication requests, and Handoff behavior stay with OMP, and a compaction veto stays with the component that installed it.

An update leaves in-flight references with the running process. Turning the switch off, or removing the package and restarting OMP, restores the native request path.
