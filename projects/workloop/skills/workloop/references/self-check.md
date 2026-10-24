# Self-check

Read when Clarify or Execute starts self-check. The calling operation supplies the object and result location. Self-check is distinct from independent Verify.

## Inspect

Select the checker under [role selection](./roles.md), then apply [collaboration](./collaboration.md) when creating or assigning its separate context. Each inspection uses a fresh read-only context. The author repairs; the checker does not implement.

Provide the owning Task, scope, candidate or material locator, applicable basis, exercised evidence, and authorized result location. Request actionable findings with evidence and a final verdict. Zero findings is valid. Freeze the target until the final result is collected. Native subagents require their native final-result barrier even with `nowait`.

## Count inspections

Use the applicable configured limit, or choose a maximum from three to five according to task size and complexity. Preparation and each implementation unit have separate counts. Preparation counts are per Clarify round. Each new round starts its own count, and an earlier round's exhausted limit does not block it. The Clarify operation defines when a new round starts. A round declared only to obtain a fresh count remains the same round. Starting a new round does not reset any implementation unit's count.

Within one Clarify round, the first inspection and rechecks share the count. Within each implementation unit, the first inspection and rechecks share its count. A completed substantive inspection consumes one count; startup or communication failure does not. Material revisions, repairs, rechecks, and independent feedback never reset the applicable count. Session recovery, compaction, or another agent continuing the same round does not reset it either.

A current pass ends self-check immediately, including on the first inspection. Otherwise repair actionable findings and rerun affected checks. Request a fresh inspection only while below the applicable limit. Avoid repeated inspections for details without material effect on correctness, consistency, the goal, or actual use.

At the applicable limit, stop adding inspections, finish actionable repairs, and report unresolved findings and changes not rechecked by self-check. Exhaustion and a pass on an older candidate do not establish a current pass. Required unresolved work still blocks completion.

## Preserve the result

Save the verdict, candidate, completed count and limit, findings, author disposition, repairs, and unrechecked changes in the calling operation's record. Preserve failed rounds. Keep the current Clarify round's or implementation unit's count, limit, and pending inspection in recoverable session state.

A formed Plan receives preparation self-check by default. Preparation's independent Verify starts only on user request, not on exhaustion of self-check. Each implementation unit needs both self-check and independent Verify. Independent Verify has no self-check round limit; neither check replaces the other.
