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

A flat call is one item; a `tasks` array is a batch. For each object whose `agent` is a string that trims nonempty and is not `seance`, remove only that object's own `sourceSession` and `model`, regardless of their values. Preserve missing, empty, whitespace-only, non-string, and `seance` agents, non-object entries, batch-level fields, and all other arguments. Infer no default agent. One changed call increments the counter once, even if several items change; an unchanged call does not increment it.

The host displays, executes, and persists the revised current assistant arguments. Later requests and the session file therefore see the cleaned call. Do not rewrite earlier history or add a session entry. Keep the native task schema, description, approvals, dispatch, background lifecycle, and result rendering. Calls invalid for another reason still fail. If multiple extensions revise an input, the host's last revision wins.

The accepted cost is disabling speculative task launch and experimental read speculation while cleanup is registered, including for calls it leaves unchanged. Do not change the host settings themselves. Disabling the module restores native behavior at the next activation. A schema lacking `sourceSession` incurs none of this cost. A host changing the meaning or scope of these fields requires re-evaluation; do not extend cleanup by guessing.

## Acceptance criteria

Task cleanup covers flat and batch calls, seance preservation, every excluded agent shape, absent target fields, malformed task shapes, one increment per changed call, builtin/schema guards, model-only schemas, missing or shadowed tools, and switches. Persisted current arguments reflect the result.
