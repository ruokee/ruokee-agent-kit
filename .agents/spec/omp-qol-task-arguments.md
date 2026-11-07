# QoL task arguments

## Goals

Clean incompatible fields from eligible builtin task calls before host validation, preserving all other arguments and native task behavior. This adjustment follows the component-wide configuration, activation, status, and isolation requirements.

## Public surface

### Configuration

| Key | Default |
| --- | --- |
| `taskArgsEnabled` | `true` |

### Status

The `/qol` task arguments line shows the activation's rewritten-call count.

### Task arguments

Act before host validation only for the builtin `task` whose schema exposes `sourceSession`. Missing tools report `unavailable`; shadowed tools report `incompatible`. A schema without that field reports `unavailable` with `task-tool-without-seance-fields`, preserving its ordinary `model` selector and speculative launch.

A flat call is one item; a `tasks` array is a batch. For each object whose `agent` is a string that trims nonempty and is not `seance`, remove its own `sourceSession`. Also remove its own `model` on hosts without ordinary per-call selection or when that selection is disabled for task calls. This includes `off` and `eval`. Values of removed fields do not affect cleanup.

Read permission from the calling session for each call, independently of concurrent sessions. Where the host separates operator grants from effective settings, both layers must permit task model selection. Otherwise use its effective mode. Retain the original `model` value and structure for native validation and authorization when selection is enabled. A host exposing the capability whose settings are unreadable also retains `model` for native handling. Host settings remain unchanged.

Preserve missing, empty, whitespace-only, non-string, and `seance` agents, non-object entries, batch-level fields, and all other arguments. Infer no default agent. One changed call increments the counter once, even if several items change. An unchanged call does not increment it. An eligible model-only item counts as rewritten when selection is disabled. It stays unchanged when selection is enabled.

The host displays, executes, and persists the revised current assistant arguments. Later requests and the session file therefore see the cleaned call. Do not rewrite earlier history or add a session entry. Keep the native task schema, description, approvals, dispatch, background lifecycle, and result rendering. Calls invalid for another reason still fail. If multiple extensions revise an input, the host's last revision wins.

The accepted cost is disabling speculative task launch and experimental read speculation while cleanup is registered, including for calls it leaves unchanged. Do not change the host settings themselves. Disabling the module restores native behavior at the next activation. A schema lacking `sourceSession` incurs none of this cost. A host changing the meaning or scope of these fields requires re-evaluation; do not extend cleanup by guessing.

## Acceptance criteria

- Eligible flat and batch calls lose each qualifying item's own `sourceSession`. Older hosts and disabled task selection also remove `model`, allowing the task to use the Agent's configured model. Enabled selection retains it. Seance items, excluded agent shapes, absent target fields, non-object entries, batch-level fields, and unrelated arguments remain unchanged.
- In `off` and `eval`, eligible model-only calls lose the field and increment the rewrite count. In enabled selection, such calls keep their arguments and count. Retained unsupported or unauthorized model choices follow native errors.
- Changes to task selection permission apply to subsequent calls. Each calling session's effective settings and operator grant layer determine its own result. Unreadable settings on a capable host preserve `model` for native handling.
- A changed call increments the counter once, regardless of the number of changed items. Displayed, executed, and persisted current arguments contain the same cleanup result; calls invalid for another reason still fail natively.
- Disabled cleanup, missing or shadowed tools, and schemas without `sourceSession` leave native arguments and behavior unchanged. A model-only schema retains its ordinary selector and speculative launch.
