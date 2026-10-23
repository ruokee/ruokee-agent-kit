# Record missing compaction usage

[中文](./usage.zh.md)

Compaction requests consume tokens, but some OMP hosts omit them from session statistics. This capability fills those missing records, including available Provider costs, without changing the request or storing its content.

## Enable

`compactionUsageEnabled` defaults to `true`. Set it through [native configuration](../README.md#configuration) and restart OMP after changes. No separate telemetry setup is required.

If the installed host exposes native `compactionRequestUsage`, compensation stops automatically with `host-records-usage` to avoid double counting. This check uses the installed capability, not a version number.

## Recorded requests

A completed request with reported tokens adds one `model_usage` entry to its owning session branch. The four recorded purposes are:

- `compaction:summary`: soft summary.
- `compaction:short-summary`: soft short summary.
- `compaction:turn-prefix`: soft turn-prefix summary.
- `compaction:handoff`: Handoff document generation.

Entries retain the actual API, Provider, model, reported token counts, stop reason, and supplied per-component costs. Session statistics include those entries. Existing entries remain when the capability is disabled or removed.

## Check the result

Run `/smart-context` to see whether usage recording is enabled and how many entries it has written. Use OMP's session statistics to view totals.

- `host-records-usage`: the host records usage natively, so compensation is inactive.
- `costMissing`: an entry lacked supplied Provider cost. It records zero cost, not an estimated price.
- `unrecorded=api-unresolved`: request identity could not be resolved reliably, so no entry was written.

Session changes follow the current session journal. Requests still naming a departed session are skipped instead of being written into a new one.

## Limits

Zero-token requests write nothing. A failed attempt that reports billed tokens is recorded. Native V2 compaction, branch summaries, evaluation requests, Skill descriptions, image questions, and other purposes are not added. Attempts hidden by a host-internal retry cannot be recovered from the final usage event.

Missing sessions, ambiguous Provider/model identity, or missing host interfaces can prevent recording. The extension does not guess identities, APIs, or prices. It stores no request body, summary, Handoff document, or separate ledger.

User telemetry and callbacks retain their behavior, including child-session inheritance. When no telemetry was configured, compensation enables the host's request instrumentation with a tracer that exports nothing. This adds instrumentation work, but no content export. Ordinary-turn telemetry stays unchanged.

To stop new entries, set `compactionUsageEnabled=false` and restart OMP. Other capabilities and historical usage remain.

## Native replacement

[PR #15034](https://github.com/can1357/oh-my-pi/pull/15034) tracks the upstream recording fix. Code in a PR, a merged PR, and a released installed host are different stages. Automatic shutdown depends on the native export described above. The compensation module can be removed from a future extension release once published native recording covers the same requests, costs, and active-window statistics. Existing entries and both alignment capabilities remain.
