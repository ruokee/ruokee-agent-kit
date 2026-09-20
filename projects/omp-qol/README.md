# omp-qol

[中文](./README.zh.md)

Three independently switchable adjustments to OMP behavior in one extension: a hub `wait` that keeps waiting to a total deadline, a bounded continuation turn after an eligible model error, and an experimental extension of one compaction deadline. [Adjustments](./docs/adjustments.md) states, per adjustment, the OMP source it attaches to, the host version it is written against, its limits, and what has been verified.

The extension performs no work of its own. Jobs, messages, processes, turns, and compaction stay with OMP; the extension changes when an existing mechanism stops and delegates everything else unchanged. Every adjustment can be switched off, and an adjustment that finds the host different from the version it is written against stays inactive and reports the reason.

## Adjustments

| Adjustment | Default | Effect |
| --- | --- | --- |
| [Continuing hub waits](./docs/adjustments.md#continuing-hub-waits) | on | One `hub` `wait` call keeps waiting while the native window carries nothing new, up to 20 minutes by default, instead of handing the model an empty frame every 5 seconds. |
| [Continuing after a transient model error](./docs/adjustments.md#continuing-after-a-transient-model-error) | on | A turn that ended with an eligible upstream error continues in the same session after 1 s and again with a doubling delay up to 8 s, at most 8 continuation turns per failure chain. |
| [Extending one compaction deadline](./docs/adjustments.md#extending-one-compaction-deadline) | **off** | Within one compaction window, a matching `AbortSignal.timeout` call gets a longer deadline, so a remote compaction that needs more than the native 5 minutes is not cut off. Process-wide and experimental. |

On their own, the adjustments do not touch the model, the request body, the tool schema, the history, or the session file. The recovery adjustment starts a turn, and the wait adjustment repeats a call the model already made; both spend provider quota when the model runs.

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
| `waitEnabled` | `true` | boolean | Register the wrapper that owns the `hub` tool name. |
| `waitContinueEmptyWindows` | `true` | boolean | Continue inside one call when a native window carried nothing new. When off, the first window is returned as the native tool returns it. |
| `waitJobsSeconds` | `1200` | number `0.05`–`3600` | Default total deadline of a job or mixed wait. |
| `waitMessagesSeconds` | `1200` | number `0.05`–`3600` | Default total deadline of a message-only wait. |
| `waitProcessSeconds` | `1200` | number `0.05`–`3600` | Default `timeout` filled into a named-process wait. The native process wait keeps its own meaning of the parameter. |

### Recovery

| Key | Default | Accepted | Effect |
| --- | --- | --- | --- |
| `recoveryEnabled` | `true` | boolean | Register the `session_stop` handler. |
| `recoveryMode` | `knownTransient` | `knownTransient`, `unclassified` | Error scope that is eligible: errors the host classifies as transient or timeout, or every error that carries no classification and is not one of the excluded kinds. |
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

### Validation

- A key that is absent takes its default.
- `null`, a wrong type, a non-finite number, a number that is not an integer where an integer is required, a value outside the range above, or an enum value outside the manifest disables the module that owns the key. Other modules register normally.
- An unknown key, a settings root that is not an object, or a settings getter that fails disables every module.
- Diagnostics name the key and the rule that rejected it, never the value: `wait.jobsSeconds=range`. A module reports each reason once per activation through the host log, and through the UI when the host has one.

## Status

`/qol` prints the current state and changes nothing. It runs no model turn and reads no value outside the settings schema.

```
@ruokee/omp-qol 0.1.2
activation cwd: /home/me/project
refresh: restart OMP; settings are read once per activation
settings: ok
wait: enabled — enabled=true continueEmptyWindows=true jobsSeconds=1200 messagesSeconds=1200 processSeconds=1200
recovery: enabled — enabled=true mode=knownTransient maxAttempts=8 backoffBaseMs=1000 backoffMaxMs=8000 notify=true
compaction: disabled (compaction-disabled) — enabled=false timeoutMs=900000 floorMs=300000 windowGuardMs=3600000 notify=true
```

`pending` means no session has started in this process. `disabled`, `invalid`, `incompatible`, and `unavailable` each carry a reason code, and `problems:` lists the rejected keys when the settings object was accepted only in part. A rejected settings object replaces every module line with the reason and ends the report with the keys that rejected it.

## Limits

Each adjustment lists its own limits in [Adjustments](./docs/adjustments.md). The short version:

- **Wait.** The wrapper acts only when the session exposes a builtin `hub` tool whose description carries the native wait-window sentence and whose parameters are a schema. It forwards the approval class, the interruptible flag, and the schema of that tool, and it adds no new operation. A wait that ends at its deadline leaves background jobs and processes running.
- **Recovery.** The fixed exclusion list wins over the configured mode, continuations are capped at 8, and the host counts them as well. One failure chain can span several agent runs, so the count follows the chain rather than one submitted prompt, and the chain ends on a turn that settles on its own, on an error outside the configured scope, and on a cancelled pass. A turn is re-run, so a tool call from the failed turn can run again. Long waits run inside the 30 s handler budget the host gives one `session_stop` handler.
- **Compaction.** The experiment replaces `AbortSignal.timeout` for the whole process, so every caller that passes a matching timeout in a window gets the longer deadline, not only the compaction request. It can only lengthen a deadline and never shorten one. A window that overlaps another window, belongs to another session, or arrives in an order the extension does not recognize disables the experiment for that process and reports why. Registering the `session_before_compact` hook also turns off speculative compaction in OMP `18.2.4`, so an enabled experiment can make a compaction wait in the foreground; with the default off, no handler is registered. A second activation in the same process stops the installed patch instead of sharing it, and an activation whose settings could not be read or were rejected stops it too, without enabling a module.

## Compatibility

The package declares the peer range `>=18.2.4 <19` in `package.json`. Automated checks run against OMP `18.2.4` (`can1357/oh-my-pi` at `1c0303b1f2ec515cbf4b44a9a49d68a029531aac`, tag `v18.2.4`), which is the baseline each adjustment documents. The range is metadata: it carries no runtime check and no claim about every version in it. Each adjustment reads the host interface it needs and stays inactive with a reason when the interface is missing or unrecognizable, so a later host version degrades to native behavior instead of failing.

`docs/adjustments.md` records, per adjustment, which verification ran and which items remain unverified.

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

The test suite replaces the host with a small recording host and keeps the package boundaries real: the settings getter from the installed `@oh-my-pi/pi-coding-agent`, the error classifier from the installed `@oh-my-pi/pi-ai`, and `AbortSignal.timeout` in both its native and patched form. It covers activation and validation, the wait deadline loop and empty-window recognition, the recovery classification matrix and continuation chain, and the compaction install order, window lifecycle, and restore path.

## License

MIT.
