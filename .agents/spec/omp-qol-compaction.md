# QoL compaction deadline

## Goals

Offer an opt-in extension of eligible compaction deadlines with explicit process-wide costs and ownership limits. This adjustment follows the component-wide configuration, activation, status, and isolation requirements.

## Public surface

### Configuration

| Key | Default |
| --- | --- |
| `compactionTimeoutEnabled` | `false` |
| `compactionTimeoutMs` | `900000` |
| `compactionTimeoutFloorMs` | `300000` |
| `compactionWindowGuardMs` | `3600000` |
| `compactionTimeoutNotify` | `true` |

`compactionTimeoutFloorMs` is an integer from 300000 through 3599999. `compactionTimeoutMs` is an integer greater than that floor and at most 3600000.

`compactionWindowGuardMs` is an integer from the effective timeout through 14400000.

### Status

The `/qol` compaction line shows timeout, floor, guard, notification setting, and its actual process-wide state.

### Compaction deadline

The timeout adjustment is an opt-in process-wide experiment. A window opens for remote automatic compaction, before manual compaction, or when the host reports an active compaction. During that window, a finite `AbortSignal.timeout(ms)` request satisfying `floor <= ms < timeout` receives the configured timeout. Other inputs retain native behavior, including native errors for invalid input. Outside the window all inputs retain native behavior.

The first un-aborted compaction cancellation signal belongs to that operation. An already-aborted signal closes the window; later cancellation closes its own window, never a subsequent one. Repeated notifications with the same signal, including serial fallback methods, continue the same window without renewing its guard deadline or duplicating notifications and resources. A different live signal, overlapping operation, another session's window, or unrecognized event order stops the experiment for the process and reports the reason, including `overlapping-round` for a second live operation.

Close the window at the earliest compaction end, committed compaction, session switch, shutdown, cancellation, or guard expiry. The guard runs from the original opening event. With notifications enabled, report only the first extended deadline in each window.

One activation owns the process-wide experiment. A later activation with the same package version and effective settings keeps it without taking ownership or opening windows, and reports `incompatible` with `patch-owned-elsewhere`. It still shares the process-wide effect while the owner's window is open. A different version or settings snapshot stops a recognizable existing experiment. A disabled or invalid activation also stops it without enabling any module; its own switch state remains distinct from the actual process state shown by `/qol`.

An owner ending its session stops the experiment and leaves `owner-stopped` as a terminal state for that process. Restart OMP to reactivate it. A session switch closes the window without ending the activation. Refuse coexistence with a recognized earlier compaction patch, unknown ownership state, an overwritten owned adjustment, missing required host capability, or a process in which the experiment has already stopped. Failed event registration reports `registration-error` and leaves no active experiment. Release only resources still owned by this component; never overwrite a replacement installed by another extension.

The accepted costs and limits are:

- The window covers a time period, not an isolated request or project. Every matching timeout in the process is extended, including unrelated callers and other sessions.
- It can only lengthen a newly created deadline. Closing a window cannot shorten signals already created. The deadline limits one signal, not the combined time of retries and fallbacks.
- Enabling the experiment gives up host speculative compaction. Do not start, defer the threshold to, or consume speculative compaction while interception applies. Compaction previously prepared in the background may therefore make the foreground wait.
- Native compaction uses 300000 ms. A floor above that value prevents the compaction request itself from matching; `/qol` states this explicitly.
- The process-level adjustment writes no persistent configuration or session state. Disabling it and restarting restores native behavior.

## Acceptance criteria

- With the experiment enabled and a window open, timeouts in the configured interval are extended process-wide, including unrelated callers and other sessions. Inputs outside the interval or window retain native behavior, including native errors; the default-off state changes no timeout.
- Repeated notifications and fallback methods with the same signal keep one window without renewing its guard. Cancellation and guard expiry close that window; overlapping operations stop the experiment.
- Matching later activations neither acquire ownership nor open windows. Conflicting activations and owner exit stop the experiment; unknown or foreign ownership is not overwritten, and released resources belong only to this component.
- A real remote compaction longer than the native deadline completes successfully, and model requests remain usable afterwards. Host upgrades revalidate this behavior; changing a maintenance declaration does not replace that evidence.
