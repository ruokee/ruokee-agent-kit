# Compaction usage

## Goals

Fill missing native session usage for soft compaction and Handoff requests without duplicate accounting, request changes, content retention, or guessed identities and prices.

## Out of scope

Purposes outside the four below, recovery of attempts hidden by a host-internal retry, changing ordinary-turn telemetry, reading request bodies or summaries, or a separate usage store.

## Public surface

`compactionUsageEnabled` is boolean, default `true`. OMP project settings override user settings and changes require restart. No separate telemetry configuration is required. Native recording disables compensation with `host-records-usage`. `/smart-context` reports live process state, entries, `costMissing`, and unresolved-request counts such as `unrecorded=api-unresolved`. Turning compensation off stops future writes but retains historical `model_usage` entries, which remain visible in OMP session statistics.

## Invariants

### Request scope

The closed mapping is summary to `compaction:summary`, short-summary to `compaction:short-summary`, turn-prefix to `compaction:turn-prefix`, and Handoff to `compaction:handoff`. The purpose must be confirmed by that request's own observed usage event, not guessed from content or timing. `compaction_native`, `branch_summary`, evaluation, skill descriptions, image questions, and every other purpose are excluded.

A completed in-scope request reporting tokens contributes exactly one native `model_usage` entry to its live session branch. All-zero usage writes none. A billed failed attempt reporting tokens is recorded. Attempts hidden by host-internal retry cannot be reconstructed from a final event.

### Identity

Use the owning session's actual API, Provider id, and model id. A normalized telemetry Provider label is not identity, even if it equals a registered Provider name. Prefer the raw request Provider id observed before telemetry normalization; otherwise accept only a model id unique across that session's model catalog. Never choose one of several Providers serving the same id or substitute another model's API.

Attribute an event to its live conversation id, or to the agent's registered session when that id is absent. Unregistered sessions and unresolved identities write nothing and increment the applicable fixed count. `/new`, `/resume`, and fork change the active identity; late requests naming the previous session must not write into the new one.

### Accounting

Record the resolved purpose, API, Provider, model, reported input/output/cache token counts, total tokens, request stop reason, and supplied per-component Provider cost. Consume each cost claim only for its own event. Missing cost records zero and increments `costMissing`; do not estimate a local price. Statistics must include entries in the active branch and window. Completion-time branch position follows the branch on which compaction runs and blocks until completion.

No entry carries content, summary, handoff document, or model role. Preserve request contents, timing, routing, and results.

### Telemetry ownership

Compatible activations share process-level observation without duplicate callbacks or accounting. With no user telemetry configuration, usage observation still works but exports nothing, reports `isRecording=false`, and adds no content attributes, links, or events. This introduces instrumentation work even when the user configured no telemetry.

Preserve every user telemetry field, tracer receiver behavior, supported span method, estimator, callback, and export behavior. Parent-to-child and multi-level configuration inheritance must not duplicate callbacks or usage entries. Ordinary-turn telemetry and unrelated host behavior remain unchanged.

Missing readable telemetry, a usage-writing interface, recognized ownership, an observed event, or a readable request kind prevents activation or recording rather than inventing data. Refused activation restores any changes it still owns. An off activation releases the shared adjustment; unreadable or rejected settings stop a recognizable adjustment from another activation and enable none. Every session's live status retains the stopped reason. A foreign replacement ends this component's ownership; do not take it over.

### Native replacement

Read the `compactionRequestUsage` export from `@oh-my-pi/pi-agent-core` on activation. Its presence disables compensation to prevent double entries. Do not infer this from a host version or PR commit alone.

Merge of [PR #15034](https://github.com/can1357/oh-my-pi/pull/15034) triggers rechecking a published target host. Before removing the module, confirm the export, native recording of the same purposes and per-component costs, and inclusion in active-window statistics. PR code, merge, release, and installed capability are distinct states. Once native behavior replaces compensation, remove its code, setting, status, documents, and checks, update the specification and decision, and retain historical entries. Neither Remote nor Handoff alignment is removed.

## Acceptance criteria

- All four purposes produce correctly attributed entries and matching host-statistics deltas. Zero-token and out-of-scope events write none; billed failed attempts retain reported usage.
- Raw identities, unique-catalog fallback, duplicate model ids, normalized labels, unresolved APIs, missing sessions, and journal switches neither guess nor misattribute requests.
- Reported per-component costs are retained once; missing cost remains zero with a count. Existing user telemetry and multi-level child inheritance continue without duplicate callbacks or entries.
- Off, rejected configuration, foreign ownership, stopped owners, and native recording retain their specified refusal and release behavior. Ordinary turns and request routing remain unchanged.
