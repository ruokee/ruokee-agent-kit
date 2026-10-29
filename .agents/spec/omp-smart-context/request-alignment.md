# Request alignment

## Goals

Define the shared content-reuse, isolation, invalidation, and failure requirements for Remote and Handoff alignment. Both reuse proved common content from an ordinary request of the same session. Their protocol eligibility, allowed repairs, reasons, and benefit evidence remain independent.

## Out of scope

Owning Pin, usage, or model-rule state; rerunning handlers to reconstruct a sent result; changing ordinary or non-target requests; taking over native maintenance or another extension's ownership.

## Public surface

Alignment is optional. A refusal leaves the complete native request unchanged and does not block, delay, or drop it. Each capability reports reference confirmation, operation binding, candidate validation, and actual sending separately. Physical sends and retries count once at transport, not at payload preparation. Refusals remain in totals; off or unavailable Remote does not make Handoff unavailable, or vice versa.

## Invariants

### Ordinary reference

Only a confirmed ordinary main-loop dispatch can supply reusable reference content. Its raw source, completed preparation, handler results, and actual outgoing payload must belong to the same dispatch and reach transport unchanged. Title, warming, advisor, and Handoff requests do not establish an ordinary reference. Handoff additionally requires a prepared tool set.

Main sessions, native task children, and Eval children have separate references and counts. Reuse must retain the owning session, persistent and Provider identities, effective model and API, tools, system prompt, thinking state, and dispatch. Equal model names, text, endpoints, cache keys, or timing do not establish session ownership.

Support native CLI and SDK preparation, including extensions loaded after session construction and process-restored sessions. Bind the active session to its extension context and actual dispatch; manually constructed Agent instances and replaced private conversion functions are outside this support contract. Local reuse requires known native preparation conditions and retained dependencies, not equal lengths or outputs. Image preparation that depends on history, and later date or cwd reminders, require complete-range proof unless their local dependencies are established.

### Operation lifetime

A native operation uses its first eligible reference for its entire lifetime, including the initial absence of a reference. Later ordinary work, handler-state changes, authentication refresh, and transport retries cannot substitute another reference.

Before session switching, branching, or tree navigation begins, revoke the affected prior reference eligibility. After the native transition settles, fresh ordinary work may establish future eligibility whether the transition succeeded, failed, or was cancelled. Changes to model, tools, system prompt, thinking, history, cancellation, compaction commit, or session lifetime invalidate affected work. Late responses, retries, or restoration of previous values cannot revive it.

Automatic maintenance can commit between tool-loop steps without changing the run's cancellation signal. A fresh ordinary dispatch can establish a new reference using its own current identity and credentials, preparation, and final send. It cannot revive the old operation. Only a new native operation may use that new reference. Ambiguous identity, a cancelled signal, or credentials associated with an earlier dispatch cannot establish eligibility.

### Content reuse

Complete retention of the source range permits reuse of its confirmed processing result, even with duplicate source messages. Partial reuse additionally requires an independently extractable already-sent unit, all its retained dependencies, and unchanged processing conditions. Equality of output, position, length, or provenance alone is insufficient. Do not run a black-box context or request handler again to obtain proof.

Opaque history remains opaque. Native trimming, deleted dependencies, tool call/result pairing, image history, and new tails retain their boundaries. Never restore removed tool output or assume an unestablished pure-projection contract.

### Sending

Each physical request has at most one alignment writer. Remote V2 evidence does not grant Handoff eligibility. Required proof must still hold for the final request after payload callbacks. Apply the entire validated repair or leave the entire native body unchanged with a fixed reason. Do not partially publish a candidate whose required proof failed. An identical candidate is `already-aligned` and retains its original serialization.

Compatible activations share observation without duplicating interception or counts. An incompatible alignment contract reports `coordinator-conflict`; do not reuse or alter the other owner's state. Failure or a missing interface in one capability leaves the other usable.

### Native ownership

OMP owns triggering, preparation, trimming, speculation, credentials, cancellation, retries, fallback, adoption, commits, and continuation. Add no compaction entry point, `session_before_compact` interception, fabricated summary, or retry. A compaction veto stays with the component that installed it.

Preserve native arguments, receiver behavior, results, exceptions, cancellation signals, and externally observable property behavior. Finishing or replacing a child releases only that child's resources. Cleanup releases only resources still owned by this package and preserves foreign replacements. Release shared resources when no registration needs them. Do not retain dead operations or obsolete references. In-flight work remains with its running process; setting or registration changes take effect after OMP restarts.

## Acceptance criteria

- Same-model concurrent sessions remain isolated, including task and Eval children, cancellation, replacement, and resumed activity.
- Eager, cached delayed loading, and process-restored native CLI/SDK sessions can establish references through fresh ordinary sends without special startup flags or cache removal.
- Only confirmed ordinary sends establish references. Ordinary and non-target request bodies remain unchanged, and each handler executes once.
- Invalidation permanently revokes old operations. Fresh ordinary work restores only future eligibility, including continuations with an unchanged run signal.
- Complete-range and partial-unit cases enforce their distinct proof requirements without restoring trimmed content or interpreting opaque history.
- Independent off, refusal, or unavailable states preserve native requests and the other alignment capability. Each physical send has at most one writer and is counted once.
- Cleanup preserves foreign ownership and native behavior, releasing only the departing session's resources.
