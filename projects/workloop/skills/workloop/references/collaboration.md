# Collaboration

Read before the first cross-session assignment or receipt, including self-check, independent Verify, Worker dispatch, or assigned Senior advice. Single-session Setup and work without collaboration do not need this reference. Select roles through [role selection](./roles.md) when needed.

## Establish the route

Use the selected tool's supported interface and instructions. Herdr is recommended, not required; tmux or another terminal mechanism is valid. Start normally at an explicit working location, discover live identities, and send assignments as ordinary messages, never injected system prompts. Do not operate another Agent's question dialog.

An assignment identifies its owning Task, unit, basis, exact scope, candidate or dependency base, grants and restrictions, required outcome, report destination, stopping point, and live reply owner. Do not assume shared conversation history. For independent Verify, provide the Task, unit or material scope, candidate location, and reply owner; let the verifier resolve its basis instead of supplying an implementer's review checklist.

## Isolate work

Give shared files or logic one editing owner at a time. Freeze candidates during review. A verifier must not have implemented the target. Keep implementation and verification contexts separate.

Reuse suitable isolated Verify and explicitly assigned Senior sessions across units and rechecks. Finish or recover a busy role's existing assignment before sending another. Create a session only when no suitable one exists or replacement is requested. Self-check instead uses a fresh context for each inspection under its own rules.

Do not send unsolicited mid-work messages or inspect a working Agent's private session files. Results are final-only; a bounded Senior consultation is a separate assignment.

## Receive the result

Wait for final results on cross-session work and advice by default. Use the collaboration tool's wait operation. If it continues as a background command, use the host's blocking final-result wait until a result or concrete blocker arrives. Do not poll or infer a verdict from lifecycle state.

Only explicit `nowait` permits dispatch without these cross-session waits. Preserve the pending assignment and resume when its final result arrives, without another routine continue request. `nowait` changes neither native self-check final-result barriers nor scope, required checks, or acceptance. A final reply to an owner does not wait on that owner.

Verify the returned sender, Task/unit, candidate, verdict, and saved report before progressing. Missing, stale, truncated, or conflicting evidence needs clarification, not an inferred pass. Recover a saved result after delivery failure before redispatching. Check the effect of a possibly successful non-idempotent action before repeating it.

## Preserve live state

Keep role choices, live identities, reply routes, owned resources, pending assignments, and waiting restrictions in recoverable session state, separate from durable product materials. On recovery, reconcile the actual assignment and effects before sending work again. Replace revoked grants before acting and preserve restrictions in plain language, including the prohibition on structured question tools when effective.
