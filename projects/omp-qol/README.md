# omp-qol

[中文](./README.zh.md)

Four independently switchable adjustments to OMP behavior in one extension: a native wait entry with a configurable total deadline, a bounded continuation turn after an eligible model error, an experimental extension of one compaction deadline, and a process-wide wrapper that keeps a resumed session's first request on the provider's native history. [Adjustments](./docs/adjustments.md) states, per adjustment, the OMP source it attaches to, the host version it is written against, its limits, and what has been verified.

The extension performs no work of its own. Jobs, messages, processes, turns, and compaction stay with OMP; the extension changes when an existing mechanism stops and delegates everything else unchanged. Every adjustment can be switched off, and an adjustment that does not recognize the host interface, structure, or ownership it depends on stays inactive and reports the reason.

## Adjustments

| Adjustment | Default | Effect |
| --- | --- | --- |
| [Continuing waits](./docs/adjustments.md#continuing-waits) | on | The extension selects the native wait entry the session exposes. Legacy `hub` waits keep their complete routing; standalone `wait` calls continue across all-running job snapshots to one total deadline, 20 minutes by default. |
| [Continuing after a transient model error](./docs/adjustments.md#continuing-after-a-transient-model-error) | on | A turn that ended with an eligible upstream error continues in the same session after 1 s and again with a doubling delay up to 8 s, at most 8 continuation turns per failure chain. Eligible covers classifier-flagged transient and timeout failures, turns the host marked as interrupted mid-stream, and errors carrying neither a status nor a classification. |
| [Extending one compaction deadline](./docs/adjustments.md#extending-one-compaction-deadline) | **off** | Within one compaction window, a matching `AbortSignal.timeout` call gets a longer deadline, so a remote compaction that needs more than the native 5 minutes is not cut off. Process-wide and experimental. |
| [Replaying native history in a resumed session](./docs/adjustments.md#replaying-native-history-in-a-resumed-session) | on | A resumed session's first request replays the native provider items the previous process ended with, instead of rebuilding the conversation from its generic content, so a prompt cache over that form can serve it. Process-wide, one flag, no body rewrite. |

Except for the optional `timeout` added to the standalone `wait` schema and the serialization the replay adjustment decides, the adjustments do not touch the model, the request body, other tool schemas, the history, or the session file. The wait parameter controls only one outer call, and replay changes which stored items one request carries, not the conversation they describe. The recovery adjustment starts a turn, and the wait adjustment repeats a call the model already made; both spend provider quota when the model runs.

## Configuration

Settings live in OMP's plugin settings for `@ruokee/omp-qol`. The manifest in `package.json` declares each key, its type, default, and description, and OMP merges project overrides over the global values.

```bash
omp plugin config list @ruokee/omp-qol
omp plugin config set @ruokee/omp-qol waitJobsSeconds 1800
```

Settings are read once per activation. Restart OMP after a change: a running process keeps the values it read at startup, and a new session in that process does not reload them.

### General

| Key | Default | Accepted | Effect |
| --- | --- | --- | --- |
| `enabled` | `true` | boolean | Master switch. When off, no module registers. |

### Wait

| Key | Default | Accepted | Effect |
| --- | --- | --- | --- |
| `waitEnabled` | `true` | boolean | Extend the native wait entry the session exposes: legacy `hub` when present, otherwise the recognized builtin `wait`. |
| `waitContinueEmptyWindows` | `true` | boolean | Continue inside one call on a certain empty legacy hub window or an all-running standalone job snapshot. When off, return the first native window. |
| `waitJobsSeconds` | `1200` | number `0.05`–`3600` | Default total deadline for a job or mixed `hub` wait and for standalone `wait`. An explicit standalone `timeout` overrides it. |
| `waitMessagesSeconds` | `1200` | number `0.05`–`3600` | Default total deadline of a message-only `hub` wait. Not applicable to standalone `wait`. |
| `waitProcessSeconds` | `1200` | number `0.05`–`3600` | Default `timeout` filled into a named-process `hub` wait. Not applicable to standalone `wait`; use the host's `proc://` interface for available process control. |

### Recovery

| Key | Default | Accepted | Effect |
| --- | --- | --- | --- |
| `recoveryEnabled` | `true` | boolean | Register the `session_stop` handler. |
| `recoveryMode` | `knownTransient` | `knownTransient`, `unclassified` | Error scope that is eligible. `knownTransient` accepts errors the host classifies as transient or timeout, an error the host marked as interrupted mid-stream, or an error with neither an HTTP status nor a classification. `unclassified` accepts every error that carries no classification and is not one of the excluded kinds. |
| `recoveryMaxAttempts` | `8` | integer `1`–`8` | Continuation turns requested for one failure chain. |
| `recoveryBackoffBaseMs` | `1000` | integer `1`–`10000` | Delay before the first continuation. |
| `recoveryBackoffMaxMs` | `8000` | integer above `recoveryBackoffBaseMs`, up to `10000` | Upper bound of the doubling delay. |
| `recoveryNotify` | `true` | boolean | Show a warning line with the attempt number and the delay for each continuation. |

### Compaction timeout

| Key | Default | Accepted | Effect |
| --- | --- | --- | --- |
| `compactionTimeoutEnabled` | `false` | boolean | Install the process-wide `AbortSignal.timeout` wrapper. Off by default. |
| `compactionTimeoutMs` | `900000` | integer above `compactionTimeoutFloorMs`, up to `3600000` | Deadline in milliseconds applied to one matching timeout call. |
| `compactionTimeoutFloorMs` | `300000` | integer `300000`–`3599999` | Lowest timeout value the experiment raises. An expert setting: a floor that leaves no room above it rejects the module, and a floor above the native `300000` ms request deadline stops the compaction request itself from matching, which `/qol` states. |
| `compactionWindowGuardMs` | `3600000` | integer from `compactionTimeoutMs` up to `14400000` | Longest lifetime of one compaction window, counted from the event that opened it. |
| `compactionTimeoutNotify` | `true` | boolean | Show a warning line the first time a window rewrites a deadline. |

### Replay

| Key | Default | Accepted | Effect |
| --- | --- | --- | --- |
| `replayEnabled` | `true` | boolean | Install the process-wide wrapper that keeps a resumed session's first request on the provider's native history. On by default; the adjustment is inert for a session that carries no stored items. |

### Validation

- A key that is absent takes its default.
- `null`, a wrong type, a non-finite number, a number that is not an integer where an integer is required, a value outside the range above, or an enum value outside the manifest disables the module that owns the key. Other modules register normally.
- An unknown key, a settings root that is not an object, or a settings getter that fails disables every module.
- Diagnostics name the key and the rule that rejected it, never the value: `wait.jobsSeconds=range`. A module reports each reason once per activation through the host log, and through the UI when the host has one.

## Status

`/qol` prints the current state and changes nothing. It runs no model turn and reads no value outside the settings schema.

```
@ruokee/omp-qol 0.4.1
activation cwd: /home/me/project
refresh: restart OMP; settings are read once per activation
settings: ok
wait: enabled (entry=wait effectiveDefaultSeconds=1200 messageContinuation=not-applicable processWait=not-applicable serviceContinuation=not-applicable) — enabled=true continueEmptyWindows=true
recovery: enabled — enabled=true mode=knownTransient maxAttempts=8 backoffBaseMs=1000 backoffMaxMs=8000 notify=true
compaction: disabled (compaction-disabled) — enabled=false timeoutMs=900000 floorMs=300000 windowGuardMs=3600000 notify=true
replay: enabled (rewrites=0) — enabled=true
```

`pending` means no session has started in this process. `disabled`, `invalid`, `incompatible`, and `unavailable` each carry a reason code, and `problems:` lists the rejected keys when the settings object was accepted only in part. A rejected settings object replaces every module line with the reason and ends the report with the keys that rejected it.

## Limits

Each adjustment lists its own limits in [Adjustments](./docs/adjustments.md). The short version:

- **Wait.** The module selects capabilities, not host versions. A recognized builtin `hub` keeps the established wrapper, full settings, routes, approval behavior, and interruptibility. When `hub` is absent, a recognized parameterless builtin `wait` is re-registered with one optional total-deadline `timeout`; delegation sends `{}` to the native tool, and only nonempty all-running job snapshots continue. Messages, settled or absent jobs, errors, interruptions, cancellations, and service frames return as native results. Message-only continuation, named-process waiting, and service-only continuation are not applicable on this entry. A deadline ends only the call; background jobs and processes keep running.
- **Recovery.** The fixed exclusion list wins over the configured mode, continuations are capped at 8, and the host counts them as well. One failure chain can span several agent runs, so the count follows the chain rather than one submitted prompt, and the chain ends on a turn that settles on its own, on an error outside the configured scope, and on a cancelled pass. A turn is re-run, so a tool call from the failed turn can run again. Long waits run inside the 30 s handler budget the host gives one `session_stop` handler. The interruption mark and the statusless condition are host details without a compatibility promise, so a host release can silently narrow or widen the accepted set.
- **Compaction.** The experiment replaces `AbortSignal.timeout` for the whole process, so every caller that passes a matching timeout in a window gets the longer deadline, not only the compaction request. It can only lengthen a deadline and never shorten one. A window that overlaps another window, belongs to another session, or arrives in an order the extension does not recognize disables the experiment for that process and reports why. One compaction operation that falls back to its next method keeps the same signal, and the extension treats a repeat of that signal as the same operation instead of an overlap; a second live signal inside one window still disables the experiment. Registering the `session_before_compact` hook also turns off speculative compaction in OMP `18.2.8`, so an enabled experiment can make a compaction wait in the foreground; with the default off, no handler is registered. A second activation in the same process keeps the installed patch when it carries the same package version and the same settings snapshot, and reports `incompatible` with `patch-owned-elsewhere`; it registers no window events, so only the activation that installed the patch opens windows, and that session's compaction runs on the native timeout while the window is closed. A second activation with another snapshot or another version, with the master switch or this module's switch off, or with invalid keys stops the installed patch instead, and an activation whose settings could not be read or were rejected stops it too, without enabling a module. When the activation that installed the patch ends its session, the patch stops rewriting and the process keeps the native deadline until OMP restarts; `/qol` reports `compaction: incompatible (owner-stopped)` from then on.
- **Replay.** The wrapper replaces `Map.prototype.set` for the whole process and inspects every write, measured at about 2 ns per string-keyed call. It decides one host flag: the first request of a resumed session replays the items the previous process stored, which assumes the endpoint that answers it can still replay them, the assumption the previous process ended on. A session carrying items that endpoint rejects would fail that request, where the native path rebuilds and proceeds. It covers `openai-responses` provider states only; codex responses, Anthropic, and completions keep their own rules. It depends on the `openai-responses:` state key prefix, on the `nativeHistoryReplayWarmed` field, and on the state being stored through a `Map` write, so a host that renames either or builds the state another way makes it inert without failing, and the rewrite count in `/qol` is the only signal. The wrapper holds no window and no subscription, stays installed after the activation that installed it ends, and comes out only when an activation's effective settings keep it off, when an activation has no usable settings at all, or when the process ends.

## Compatibility

The minimum maintained OMP version is `18.2.8`, with no upper maintenance bound. This section states the maintenance commitment, not an installation, activation, or run condition: a host below the bound is not blocked and may still run the package, without gaining a maintenance commitment below it, and having no upper bound does not mean that every later release works or has been verified.

The package declares `@oh-my-pi/pi-ai` and `@oh-my-pi/pi-coding-agent` as unrestricted host peers (`*`). Those declarations name the host packages the component imports; they carry no maintenance range, no runtime check, and no claim about any host version.

The automated type check and the test suite run against the OMP `18.2.8` development dependency baseline. Source baselines are path-specific: most adjustments cite OMP `18.2.8`, while continuing waits cite both the legacy `18.2.8` `hub` path and the standalone `18.4.3` `wait` path. [Adjustments](./docs/adjustments.md) records each source baseline, automated check, and real OMP CLI run, including the exact version and scenario covered and every item left unverified.

Each adjustment checks the host interface, structure, or ownership it depends on, and stays inactive with a reason when that check does not hold, which leaves that adjustment on the host's own behavior. The checks cover what the modules inspect, and not the entry's own imports or a difference no module looks at, so an unrecognized host change can also alter behavior without disabling the adjustment.

Before trusting the extension on an upgraded host, re-read the upstream source each adjustment cites and re-check the adaptation points it lists.

## Installation

Clone the repository, install the locked dependencies, and install the package into OMP:

```bash
git clone https://github.com/ruokee/ruokee-agent-kit.git
cd ruokee-agent-kit/projects/omp-qol
bun install --frozen-lockfile
omp install "$(pwd)" --scope user
```

`omp install` is an alias of `omp plugin install`, and `omp plugin link "$(pwd)" --scope user` registers the same directory. OMP reads `omp.extensions` from `package.json` and loads `src/extension.ts`; no manual extension-path setting is required.

### Updating

The registration points at this checkout, so the installation keeps reading the package and its dependencies from that directory.

```bash
cd /path/to/ruokee-agent-kit
git pull
cd projects/omp-qol
bun install --frozen-lockfile
```

Restart OMP afterwards: a running process keeps the extension code it loaded at startup. The extension stores nothing of its own, so an update changes no session, message, or job.

### Uninstalling

Uninstall the package and restart OMP. Nothing else is written outside the settings you set, which you can delete with `omp plugin config delete @ruokee/omp-qol <key>`.

## Development

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
```

The test suite replaces the host with a small recording host and keeps the package boundaries real: the settings getter from the installed `@oh-my-pi/pi-coding-agent`, the error classifier from the installed `@oh-my-pi/pi-ai`, and `AbortSignal.timeout` and `Map.prototype.set` in both their native and patched form. It covers activation and validation, capability selection between `hub` and standalone `wait`, model-visible wait parameters, both structural continuation rules and deadline races, the recovery classification matrix and continuation chain, the compaction install order, window lifecycle, and restore path, and the replay wrapper's rewrite and forwarding matrix, ownership and release paths, refusals, and `/qol` line.

## License

MIT.
