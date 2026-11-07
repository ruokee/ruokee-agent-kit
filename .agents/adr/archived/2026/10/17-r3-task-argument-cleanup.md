# Task argument cleanup

Decision owner: Ruokee
Decision writer: OMP GPT-6 Astra
Reverses: [Task argument cleanup](./17-r2-task-argument-cleanup.md)
Archived: 2026-11-07
Reversed by: [Task argument cleanup](../../../decision/2026/10/17-task-argument-cleanup.md)

English | [中文](./17-r3-task-argument-cleanup.zh.md)

## Motivation

Clean seance-only fields from ordinary task items according to host capability, preserving native per-call model selection and authorization.

OMP 18.11.3 exposes both fields on every `task` item when the session advertises the `seance` agent, not only on items that select it. [`validateSeanceFields`](https://github.com/can1357/oh-my-pi/blob/v18.11.3/packages/coding-agent/src/task/seance.ts) rejects any present value when the resolved agent is not `seance`, because it compares against `undefined` rather than checking for a meaningful value. A model that treats optional fields as inputs can send `""`, `/dev/null`, or a model name and fail the whole call before dispatch. One session produced four such failures, with `sourceSession` values `""` and `/dev/null`, and `model` values `""` and `@ds-flash`. A retry that omitted both fields succeeded.

OMP `18.14.2` introduced ordinary per-call model selection. In [`18.16.0`](https://github.com/can1357/oh-my-pi/blob/v18.16.0/packages/coding-agent/src/task/seance.ts), ordinary items still reject `sourceSession`, while `model` follows the [native authorization policy](https://github.com/can1357/oh-my-pi/blob/v18.16.0/packages/coding-agent/src/task/model-approval.ts). Unconditionally removing both fields discards valid model choices and turns unauthorized selections into default-model tasks. Cleanup must preserve that native decision while retaining the older host's two-field cleanup.

The host validates the batch before dispatch. If speculative task launch is active, subagents already started from closed `tasks[]` items are discarded. An upstream fix for accidentally supplied seance-only fields remains outside this repository. QoL removes those fields at the extension seam while keeping the task schema and host dispatch path native.

## Analysis

### Host validation

When advertised, the task schema expands the two optional fields on every item. It also supplies the default agent when that agent matches the schema's identifier pattern, so a model that omits `agent` can still reach the event with a concrete non-seance value. The `tool_call` event normally receives the schema-validated arguments; a lenient fallback after a schema failure can preserve raw arguments. A handler's returned `input` replaces the arguments used for dispatch, display, persistence, and execution. The task tool's own `validateSeanceParams` runs inside `execute`, after the event, so a handler can remove the fields before the failing check without wrapping the tool.

The schema's normal validation removes `null` and the string `"null"` from optional fields. A lenient fallback after a schema failure can preserve raw arguments, so a cleanup rule that ignores values covers both paths.

The field set identifies the schema contract. OMP 18.5.0 had `model` as an ordinary optional selector and no `sourceSession`; OMP 18.11.3 added both through `seanceTaskSchemaFields`. Deleting `model` whenever it appears would remove a valid selector from a schema without seance fields. The module therefore probes the built-in schema for `sourceSession` and applies the cleanup only when it is present.

### Speculative execution

Speculative execution is an OMP optimization that starts work before a tool call finishes streaming. For a batch `task` call, the host starts each item's subagent as soon as that item's JSON object closes, instead of waiting for the complete call. If the finished call fails validation, is blocked, or its arguments change, the host aborts the launched runs. [`task.speculativeLaunch`](https://github.com/can1357/oh-my-pi/blob/v18.11.3/packages/coding-agent/src/task/settings.ts) enables this behavior by default.

A separate experimental setting, `tools.speculativeExecution.enabled`, defaults to false. It allows validated local reads to start before normal dispatch. Network requests, provider completions, and filesystem writes are not included.

OMP denies both forms when an extension registers a `tool_call`, `tool_result`, or approval lifecycle handler, or when task approval is not auto-allowed. A handler could block the call or require approval, and a call that is not auto-allowed must not start early. Registering the cleanup handler therefore removes speculative launch from every session that enables the module, not only from calls that carry the two fields.

### Fit with the component

`@ruokee/omp-qol` carries independently switchable adjustments under one package, one settings entry, and one check surface. The [OMP QoL decision](../../../decision/2026/09/20-omp-qol.md) owns that boundary. The [component specification set](../../../../spec/README.md#omp-qol) contains complete required behavior and acceptance. The [component README](../../../../../projects/omp-qol/README.md) provides an independent user reference; component design and validation materials hold mechanics and per-adjustment evidence. The wait module establishes the pattern for declining to act when the session does not expose the expected built-in tool. The component's maintenance floor is OMP 18.13.3, which exposes the `tool_call` input replacement contract used here. In a session that does not expose the seance fields, the module stays unavailable and registers no handler.

## Decision

### Public configuration

The independently switchable `taskArgs` adjustment follows the [OMP QoL decision](../../../decision/2026/09/20-omp-qol.md). Its public contract is one native OMP setting, `taskArgsEnabled`, boolean, defaulting to `true`, subordinate to the component's master switch. It is rejected or reported by the existing settings rules and read in the same activation snapshot as every other key, so a change applies at the next OMP start.

When the built-in task schema exposes `sourceSession`, ordinary items lose that field. Hosts without ordinary per-call model capability also lose `model`. Hosts with that capability receive the original `model` for native validation, including when their authorization mode is `off` or `eval`. A `seance` item keeps both fields and follows the host's requirements for a non-empty `sourceSession`. On a schema with only the ordinary `model` selector, the module reports `unavailable` and leaves arguments unchanged.

### Where it attaches

The module reads the built-in task schema and registers one `tool_call` handler only when the schema exposes `sourceSession`. It reads the event input, returns a revised input only when something changed, and leaves the native tool in place. The host uses the returned input for display, persistence, and execution, so the cleanup reaches the same check that rejected the original call.

The module does not replace the tool definition, the schema, the description, the approval policy, the dispatch path, the background lifecycle, or the result rendering. It adds no session entry of its own and does not rewrite earlier history. The host persists the revised arguments in the current assistant message, so later requests and the session file observe them.

### Rewrite rule

A flat call is one item; a `tasks` array is a batch. For each item whose `agent` is a string, trims non-empty, and is not `seance`, remove its own `sourceSession` key. Remove its own `model` key only on hosts without ordinary per-call model capability. Values of removed fields do not matter: empty strings, placeholders, and non-empty values are treated alike. A retained `model` keeps its value and structure. Items without a field to remove keep their identity and do not count as rewritten calls.

A batch call applies the rule to each `tasks[]` item and leaves the batch-level fields alone. The handler copies only changed objects. Every other argument, including `task`, `solutionSpace`, `tools`, `context`, `name`, and unknown fields, keeps its value and structure.

An item whose `agent` is missing, empty, whitespace, non-string, or `seance` is left unchanged. The host may resolve a default agent after the event, and the extension cannot know that default with the same authority as the host.

### Module status

The module is installed only when the session exposes a `task` tool whose source is `builtin` and whose schema exposes `sourceSession`. A missing tool reports `unavailable` with `task-tool-absent`, a shadowed tool reports `incompatible` with `task-tool-shadowed`, and a built-in schema without `sourceSession` reports `unavailable` with `task-tool-without-seance-fields`. OMP 18.5.0 has the ordinary `model` selector and no `sourceSession`, so the module is unavailable there and registers no handler. The module switch off reports `disabled`, as does the master switch. An invalid `taskArgsEnabled` value disables this module only.

`/qol` reports the module status and the number of calls whose input changed during the current activation. A batch that changes several items counts as one rewritten call. The counter is diagnostic state, not a persisted metric.

### Speculative execution cost

Where the seance schema is present, registering the handler makes `task.speculativeLaunch` ineffective for the session, including for task calls that carry neither field. The module does not change the host setting; the registered handler is what causes OMP to deny the early launch. A user who needs speculative launch can turn the cleanup off. The experimental read speculation is also denied when it is enabled. A schema without `sourceSession` registers no handler, so the cost does not apply there. This decision accepts that cost where the seance contract is present.

### Boundaries

The module does not repair every malformed task shape. It leaves calls with a missing or empty agent unchanged, so the host resolves the default agent and applies its native validation. Calls that put the fields at the batch level are also left for native validation. The module does not retry, intercept results, or add model-visible guidance. It is an input cleanup at the host's extension seam.

The schema guard keys on the `sourceSession` field the host exposes, not on a version number. It therefore stays inactive on the 18.5.0 schema that has only the ordinary `model` selector, and it becomes active when a later host exposes the seance field.

The host's registration of `task.perCallModel` identifies ordinary model capability. Read its presence once per activation from the host registry. Its current value does not change cleanup. The host alone resolves selectors, authorizes models, and reports disallowed choices; QoL leaves these settings unchanged. This preserves the OMP `18.13.3` maintenance floor without a version-number gate.

The module also does not make an otherwise invalid call valid. Other schema failures, approval decisions, and dispatch errors keep their native behavior. When several extensions return `input` for one call, the host uses the last result, so this revision can overwrite another extension's revision or be overwritten by one registered later.

### Upstream fix

The host should ignore accidental empty seance-only values or expose seance-only fields solely to seance items. The module can be retired when the component's maintenance floor includes a host with that corrected contract.

## Alternatives considered

- **Wrap the `task` tool through the extension tool API.** The extension API can delegate to the native implementation through `ctx.invokeTool`, so the wrapper does not have to reproduce dispatch, approval, or background lifecycle. It would still replace the tool definition, schema, description, and native rendering path, and would need to preserve them across host changes. The `tool_call` handler changes less and keeps the native tool intact.
- **Delete `model` when per-call selection is off.** This would hide the operator's rejection and execute the default model instead. Keeping the field gives the host full control in `off`, `eval`, and `on` modes.
- **Always preserve `model`.** This would restore ordinary task failures on the maintained older hosts that reserve it for seance. Capability-based cleanup retains their existing behavior.

## Consequences

- **Accepted loss of speculative launch.** OMP starts batch subagents before the full call only when no lifecycle handler is registered and task approval is auto-allowed. Where the seance schema is present and the module is enabled, every qol session loses that early start for every batch task call, including calls without the two fields. Users also lose speculative reads if they enabled them. This adds latency to batch dispatch. A schema without `sourceSession` registers no handler, so the cost does not apply there.
- **Continued cost after an upstream fix.** If a later host stops exposing the fields to non-seance items but keeps `sourceSession` in the schema, the handler remains registered for the current process and the speculation cost remains until the module is disabled or retired. If the field disappears from the schema, the next activation reports unavailable and registers no handler.
- **Last-wins input revision.** When several extensions return `input` for one call, the host uses the last result. The qol revision can overwrite another extension's revision, or be overwritten by one registered later. Each handler sees the original input.
- **Dependence on host details.** Cleanup relies on input replacement, the `sourceSession` schema marker, built-in provenance, and the host's shared settings registry. A changed capability marker or an extension resolving a separate registry can select the old cleanup on a capable host and discard its model selector.
