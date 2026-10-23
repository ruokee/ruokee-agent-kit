# Compaction usage

English | [中文](./usage.zh.md)

## Goals

Fill missing native session usage for soft compaction and Handoff requests without duplicate accounting, request changes, content retention, or guessed identities and prices.

## Out of scope

Purposes outside the four below, recovery of attempts hidden by a host-internal retry, changing ordinary-turn telemetry, reading request bodies or summaries, or a separate usage store.

## Public surface

`compactionUsageEnabled` is a boolean, default `true`, with the [package configuration contract](./README.md#configuration). Native recording disables compensation with `host-records-usage`. `/smart-context` reports live process state, entries, `costMissing`, and unresolved-request counts such as `unrecorded=api-unresolved`. Turning compensation off stops future writes but retains historical `model_usage` entries.

## Invariants

### Request scope

The closed mapping is summary to `compaction:summary`, short-summary to `compaction:short-summary`, turn-prefix to `compaction:turn-prefix`, and Handoff to `compaction:handoff`. Read the request's own oneshot kind from its observed chat-usage span. `compaction_native`, `branch_summary`, evaluation, skill descriptions, image questions, and every other purpose are excluded.

A completed in-scope request reporting tokens writes one native `model_usage` entry through `appendModelUsage` to its live session branch. All-zero snapshots write none. A billed failed attempt reporting tokens is recorded. An attempt retried away within the host's own wrapper cannot be reconstructed from the final event.

### Identity

Resolve actual API, Provider id, and model id through the owning session's registry. A normalized telemetry Provider label is not identity, even if it equals a registered Provider name. Prefer the raw request Provider id supplied before normalization by the estimator path; otherwise resolve only a model id unique across the session catalog. Never select one of several Providers serving the same id or substitute another model's API.

Locate the live session by event conversation id, or by the agent's registered session when absent. Unregistered sessions and unresolved identities write nothing and report the fixed applicable count. On `/new`, `/resume`, or fork, re-register the same manager under its current identity and drop the previous identity; late requests naming the old session do not write into the new one.

### Accounting

Record the resolved purpose, API, Provider, model, reported input/output/cache token counts, total tokens, request stop reason, and supplied per-component Provider cost. Consume each cost claim only for its own event. Missing cost records zero and increments `costMissing`; do not estimate a local price. Statistics must include entries in the active branch and window. Completion-time branch position follows the branch on which compaction runs and blocks until completion.

No entry carries content, summary, handoff document, or model role. Preserve request contents, timing, routing, and results.

### Telemetry ownership

One process registry owns the readable `Agent.prototype.telemetry` accessor patch and serves registered sessions. A later compatible activation registers without another wrapper. With no user configuration, provide an inert tracer that enables the host's instrumentation but exports nothing, has `isRecording=false`, and adds no content attributes, links, or events. This adds instrumentation work even when the user configured no telemetry.

With user configuration, preserve every field, tracer receiver, known span method, estimator, callback, and export behavior. Unwrap this module's inherited wrappers before wrapping child configurations, so parent-to-child copies do not duplicate callbacks or writes. Leave `setTelemetry`, the private field used by ordinary turns, and all other class members unchanged.

A missing readable accessor, usage writer, recognized registry layout, owned install, observed event span, or readable request kind prevents installation or recording rather than inventing data. A refused install restores its replaced accessor. An off activation releases the installed patch; unreadable or rejected settings stop a patch installed by another activation and install none. Preserve a stopped registry's reason in every session's live status. If another extension replaces the accessor, release this module as replaced without taking it over.

### Native replacement

Read the `compactionRequestUsage` export from `@oh-my-pi/pi-agent-core` on activation. Its presence disables compensation to prevent double entries. Do not infer this from a host version or PR commit alone.

Merge of [PR #15034](https://github.com/can1357/oh-my-pi/pull/15034) triggers rechecking a published target host. Before removing the module, confirm the export, native recording of the same purposes and per-component costs, and inclusion in active-window statistics. PR code, merge, release, and installed capability are distinct states. Once native behavior replaces compensation, remove its code, setting, status, documents, and checks, update the specification and decision, and retain historical entries. Neither Remote nor Handoff alignment is removed.

## Acceptance criteria

- All four purposes produce correctly attributed entries and matching host-statistics deltas. Zero-token and out-of-scope events write none; billed failed attempts retain reported usage.
- Raw identities, unique-catalog fallback, duplicate model ids, normalized labels, unresolved APIs, missing sessions, and journal switches neither guess nor misattribute requests.
- Reported per-component costs are retained once; missing cost remains zero with a count. Existing user telemetry and multi-level child inheritance continue without duplicate callbacks or entries.
- Off, rejected configuration, foreign accessors, stopped owners, and native recording retain their specified refusal and release behavior. Ordinary turns and request routing remain unchanged.

## Related ADRs

- [Compaction usage](../../adr/decision/2026/10/13-compaction-usage.md)
- [Context package](../../adr/decision/2026/10/12-smart-cache.md)
