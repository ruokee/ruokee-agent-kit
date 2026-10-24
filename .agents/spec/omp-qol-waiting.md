# QoL waiting

## Goals

Continue eligible native job-waiting windows within one call's total deadline. This adjustment follows the component-wide configuration, activation, status, and isolation requirements.

## Out of scope

Message-only continuation, named-process waiting, service-only continuation, or polling to simulate them.

## Public surface

### Configuration

| Key | Default |
| --- | --- |
| `waitEnabled` | `true` |
| `waitContinueEmptyWindows` | `true` |
| `waitJobsSeconds` | `1200` |

`waitJobsSeconds` accepts finite numbers from `0.05` through `3600` seconds.

### Status

The `/qol` wait line shows `entry=wait`, `effectiveDefaultSeconds`, and `messageContinuation`, `processWait`, and `serviceContinuation` as `not-applicable`.

### Continued waiting

Extend only the recognized standalone builtin `wait` entry. A missing, foreign, or unrecognized entry, or missing required host capability, leaves native behavior and reports a bounded reason. Preserve the native read approval, strict validation, interruptibility, and essential load behavior.

The public optional `timeout` is a finite number in `(0, 3600]` seconds and sets the total deadline of that call. Omission uses `waitJobsSeconds`. The tool parameter's lower bound is not the configuration's `0.05` lower bound.

With `waitContinueEmptyWindows=true`, continue within the same call only when the native result marks an empty window with a nonempty job list whose jobs are all still running. Judge the host's structured result, not its text. Messages, a settled job, absent jobs, errors, steering, cancellation, unknown result shapes, and service events return immediately. With the switch false, return the first native window.

The deadline ends only this wait call. It starts or cancels no job or process and does not consume messages or results outside native waiting. Caller cancellation takes precedence and retains its reason. A native result that arrives despite the deadline wins and is returned unchanged. Convert a rejection to a deadline result only after this call's own deadline and only for recognized host aborts, `ToolAbortError`, `AbortError`, or the exact message `Operation aborted`. Propagate other errors unchanged.

On a deadline without a terminal result, return the last certain all-running window with a bounded deadline note, or a minimal note if none arrived. The note identifies another `wait` call and `proc://` as available next actions. Release call-owned waiting resources on every exit.

## Acceptance criteria

Waiting covers explicit and default deadlines, the all-running continuation condition, every terminal outcome, caller cancellation, native-result races, unrelated errors, and refusal to replace an unrecognized entry. Background work continues after a wait deadline.
