# Self-check

Read when Clarify or Execute starts self-check. The calling operation supplies the object and result location. Self-check is distinct from independent Verify.

## Inspect

The main session responsible for the output performs self-check in its current context. Self-check uses no subagent or separate checker. Inspect the current goal, changed output, relevant Task materials, effective user requirements, and project guidance for contradictions, omissions, stale statements, and writing quality.

Keep this a lightweight inspection. Focus later inspections on new differences, unresolved findings, and consequential counterexamples. Implementation debugging remains with the Builder; actual verification, evidence collection, verdicts, and rechecks belong to independent Verify.

## Count inspections

The limit is five inspections. Keep separate counts for preparation and each implementation unit. A completed substantive inspection consumes one count. When discussion changes or verification completes, the main session SHOULD reset the applicable count. Record the reset trigger and preserve the earlier results. Routine edits and session recovery retain the current count unless a reset condition applies.

A current pass ends self-check immediately, including on the first inspection. Otherwise repair actionable findings and inspect affected differences while below the limit. Avoid repeated inspections for details without material effect on correctness, consistency, the goal, or actual use.

At the limit, stop adding inspections, finish actionable repairs, and report unresolved findings and changes not rechecked by self-check. Required unresolved work still blocks completion. An old candidate's pass applies to that candidate.

## Preserve the result

Save the verdict, candidate, completed count and limit, reset triggers, findings, repairs, and unrechecked changes in the calling operation's record. Preserve failed inspections. Keep the current count and applicable reset state recoverable.

A formed Plan receives preparation self-check by default. Preparation's independent Verify starts only on user request, not on exhaustion of self-check. Each implementation unit needs both self-check and independent Verify. Independent Verify has no self-check round limit; neither check replaces the other.
