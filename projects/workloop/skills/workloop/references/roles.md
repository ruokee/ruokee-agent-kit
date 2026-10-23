# Role selection

Read when selecting a checker, verifier, Worker, or explicitly assigned Senior, or when Setup configures role defaults. Read the Senior section only when that role is assigned or its defaults are being configured.

## Select a role

Resolve each role's host, model, reasoning level, and location independently in this order:

1. The current explicit request.
2. A continuing choice for the same execution.
3. Applicable external defaults.

Accept natural-language selections and pass exact model selectors or aliases to the host. Do not infer Verify from the executor or silently substitute an unavailable model. Resolve a missing selection when the role is needed, under current question restrictions. Report an actual availability error rather than changing the choice silently.

Updating a default does not replace an explicit choice already effective for the current execution. Distributed instructions do not prescribe a local model, provider, working directory, or role configuration. Apply [collaboration](./collaboration.md) when launching, assigning, or receiving cross-session work.

## Use an assigned Senior

Senior exists only when explicitly assigned for this execution. A continuing assignment remains effective until changed; a default model does not activate it.

Consult that Senior for implementation choices and in-scope clarification within confirmed goals and constraints. Include the Task, unit, basis, constraints, alternatives, decision needed, and live reply owner. Follow its recommendation within effective requirements and grants.

Goals, priorities, material requirement tradeoffs, and protected permissions remain user decisions. Senior cannot override requirements, expand scope, waive checks, or replace independent Verify. A bounded consultation is not a partial progress report.
