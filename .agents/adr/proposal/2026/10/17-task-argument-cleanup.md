# Non-seance task argument cleanup

Draft owner: Ruokee
Draft writer: OMP DeepSeek V4.1 Flash

English | [中文](./17-task-argument-cleanup.zh.md)

## Motivation

Add an `omp-qol` module that removes the seance-only `sourceSession` and `model` fields from non-seance task items before the host validates them.

OMP 18.11.3 exposes `sourceSession?` and `model?` on every `task` item when the session advertises the `seance` agent, not only on items that select `seance`. [`validateSeanceFields`](https://github.com/can1357/oh-my-pi/blob/v18.11.3/packages/coding-agent/src/task/seance.ts) rejects any present value when the resolved agent is not `seance`, because it compares against `undefined` rather than checking for a meaningful value. A model that treats optional fields as inputs can send `sourceSession: ""`, `/dev/null`, or another placeholder and fail the whole batch before dispatch. One session produced four such failures, with `sourceSession` values `""` and `/dev/null`, and `model` values `""` and `@ds-flash`. A retry that omitted both fields succeeded.

The host validates the batch before dispatch. If speculative task launch is active, subagents already started from closed `tasks[]` items are discarded. The upstream fix, to ignore empty values or to expose the fields only to `seance` items, is outside this repository. The qol component can remove the fields at the extension seam without changing the task schema or the host dispatch path.

## Analysis

### Host validation

When advertised, the task schema expands the two optional fields on every item. It also supplies the default agent when that agent matches the schema's identifier pattern, so a model that omits `agent` can still reach the event with a concrete non-seance value. The `tool_call` event normally receives the schema-validated arguments; a lenient fallback after a schema failure can preserve raw arguments. A handler's returned `input` replaces the arguments used for dispatch, display, persistence, and execution. The task tool's own `validateSeanceParams` runs inside `execute`, after the event. A handler can therefore remove the fields before the failing check without wrapping the tool.

The schema's normal validation removes `null` and the string `"null"` from optional fields. A lenient fallback after a schema failure can preserve raw arguments, so a cleanup rule that ignores values covers both paths.

### Speculative execution

Speculative execution is an OMP optimization that starts work before a tool call finishes streaming. For a batch `task` call, the host starts each item's subagent as soon as that item's JSON object closes, instead of waiting for the complete call. If the finished call fails validation, is blocked, or its arguments change, the host aborts the launched runs. [`task.speculativeLaunch`](https://github.com/can1357/oh-my-pi/blob/v18.11.3/packages/coding-agent/src/task/settings.ts) enables this behavior by default.

A separate experimental setting, `tools.speculativeExecution.enabled`, defaults to false. It allows validated local reads to start before normal dispatch. Network requests, provider completions, and filesystem writes are not included.

OMP denies both forms when an extension registers a `tool_call`, `tool_result`, or approval lifecycle handler, or when task approval is not auto-allowed. A handler could block the call or require approval, and a call that is not auto-allowed must not start early. Registering the cleanup handler therefore removes speculative launch from every session that enables the module, not only from calls that carry the two fields.

Enabling `taskArgsEnabled` therefore makes `task.speculativeLaunch` ineffective for that session. The module does not change the host setting; the registered handler is what causes OMP to deny the launch. This proposal accepts that effective default. A user who needs speculative launch can turn the cleanup off. The experimental read speculation is also denied when it is enabled.

### Fit with the component

`@ruokee/omp-qol` carries independently switchable adjustments under one package, one settings entry, and one check surface. The [OMP QoL decision](../../../decision/2026/09/20-omp-qol.md) already owns that boundary. The [component README](../../../../../projects/omp-qol/README.md) and [component specification](../../../../spec/omp-qol.md) own the module mechanics and per-adjustment evidence. The wait module establishes the pattern for declining to act when the session does not expose the expected built-in tool. The component's maintenance floor is OMP 18.5.0, which exposes the `tool_call` input replacement contract used here. On a host that does not expose the seance fields, a call without them leaves nothing to remove, and the handler returns no input.

## Proposal

Add a `taskArgs` module to `@ruokee/omp-qol`, enabled by `taskArgsEnabled` with a default of `true`. The default accepts the effective loss of speculative task launch described above: while the module is enabled, `task.speculativeLaunch` is effectively off. The module registers a `tool_call` handler for the built-in `task` tool.

### Rewrite rule

For each task item, the handler reads `agent` from the event input. When `agent` is a string, trims to a non-empty value, and is not `seance`, the handler removes the item's own `sourceSession` and `model` keys. The field values do not matter: an empty string, a placeholder, and a non-empty value are removed alike. An item without either key is left untouched.

A batch call applies the rule to each `tasks[]` item and leaves the batch-level fields alone. A flat call is treated as one item. The handler copies only changed objects and returns a revised input only when something changed. Every other argument, including `task`, `solutionSpace`, `tools`, `context`, `name`, and unknown fields, keeps its value and structure.

An item whose `agent` is missing, empty, whitespace, non-string, or `seance` is left unchanged. The host may resolve a default agent after the event, and the extension cannot know that default with the same authority as the host.

The module does not change the task schema, the tool description, approval policy, dispatch, background lifecycle, or result rendering.

### Activation

The module is subordinate to the package master switch. An invalid `taskArgsEnabled` value disables this module only. The handler is installed only when the session exposes a `task` tool whose source is `builtin`; a missing or shadowed tool leaves the module inactive with a reason.

### Status

`/qol` reports the module status and the number of calls whose input changed during the current activation. A batch that changes several items counts as one rewritten call. The counter is diagnostic state, not a persisted metric.

### Boundaries

The module does not repair every malformed task shape. It leaves calls with a missing or empty agent unchanged, so the host resolves the default agent and applies its native validation; their outcome depends on the resolved agent and the remaining arguments. Calls that put the fields at the batch level are also left for native validation. The host's validation error tells the model to put the fields on individual `seance` items inside `tasks[]`; this module does not rewrite that shape.

The module does not retry, intercept results, or add model-visible guidance. It is an input cleanup at the host's extension seam.

### Upstream fix

The host should ignore empty values or expose the fields only to `seance` items. This proposal does not replace that fix. The module can be retired when the component's maintenance floor includes a host version with the corrected contract.

## Alternatives considered

- **Wrap the `task` tool through the extension tool API.** The extension API can delegate to the native implementation through `ctx.invokeTool`, so the wrapper does not have to reproduce dispatch, approval, or background lifecycle. It would still replace the tool definition, schema, description, and native rendering path, and would need to preserve them across host changes. The `tool_call` handler changes less and keeps the native tool intact. Rejected.
- **Ask the model in a prompt or Skill to omit the fields.** It adds no handler and no speculation cost, but depends on every model and session following the instruction. The observed failures show that this is not reliable. Rejected.
- **React to the `tool_result` error and ask the model to retry.** It avoids argument rewriting, but spends a failed round and depends on the retry being correct. Rejected.
- **Remove only empty strings.** It is narrower and would preserve a non-empty `model` that a future host might accept, but the observed placeholders include `/dev/null` and `@ds-flash`, so it would not fix the reported cases. Rejected.
- **Infer the default agent when `agent` is missing or empty.** It would cover more shapes, but duplicates the host spawn policy and can resolve to `seance`. The extension cannot reliably know the host's default. Rejected.
- **Make the module default off.** It preserves speculative execution by default, but leaves the failure in place for users who do not change settings. The module only changes calls the host would reject. Rejected.
- **Wait for an upstream fix and document the workaround.** It avoids new component behavior, but the current host has no fix and users continue to lose batches. Rejected as the sole action.

## Acceptance criteria

1. With the module enabled, a non-seance item that carries `sourceSession`, `model`, or both reaches host dispatch without those fields, and the call dispatches without the `only accepted for the seance agent` error.
2. A `seance` item keeps both fields and still follows the host's requirement for a non-empty `sourceSession`.
3. Items with a missing, empty, whitespace, or non-string `agent` are unchanged, and batch-level fields are unchanged.
4. Only the two target fields change. Other arguments, nested values, the task schema, and the tool description keep their behavior.
5. The module stays inactive when the session has no built-in `task` tool or the tool is shadowed, and reports why.
6. After the next activation, turning off `taskArgsEnabled` or the package master switch restores native arguments and behavior.
7. `/qol` reports the module status and the number of rewritten calls for the current activation.
8. A real OMP session demonstrates the successful dispatch with evidence. A scenario that was not run is recorded as unverified.
9. The component specification, README, adjustment documentation, and package description describe the module, its setting, its default, and the loss of speculative execution.
10. Existing qol modules keep their behavior and settings.
11. After implementation, a decision records the choice, and the consumed proposal is removed.

## Risks

The proposal accepts the effective loss of speculative task launch described under Analysis. That loss and the remaining risks are below:

- **Accepted loss of speculative launch.** OMP starts batch subagents before the full call only when no lifecycle handler is registered and task approval is auto-allowed. With the module on by default, every qol session loses that early start for every batch task call, including calls without the two fields. Users also lose speculative reads if they enabled them. This is the accepted cost; it still adds latency to batch dispatch.
- **Continued cost after an upstream fix.** If a later host stops exposing the fields to non-seance items, the handler remains registered and the speculation cost remains until the module is disabled or retired.
- **A future legitimate `model` selector.** If the host later lets ordinary agents select a model through this field, the cleanup deletes a valid choice.
- **Last-wins input revision.** When several extensions return `input` for one call, the host uses the last result. The qol revision can overwrite another extension's revision, or be overwritten by one registered later. Each handler sees the original input.
- **Incomplete coverage.** Calls with no usable agent are left unchanged, so their outcome depends on the host's default agent and native validation. Calls with the fields at the batch level are also left unchanged. A user may read the module as a complete fix for every seance-field error.
- **Silent correction.** The module hides the model's argument mistake. The `/qol` counter is the only signal, so a prompt or schema problem can persist without a visible failure.
- **Dependence on host details.** The cleanup relies on the event input replacement contract, the schema default behavior, and built-in tool provenance. A host change to any of them can make the module inactive or delete a field the host now accepts.
