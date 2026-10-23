# omp-qol

[中文](./README.zh.md)

Independently switchable adjustments to OMP behavior. [Adjustments](./docs/adjustments.md) states each adjustment's host source, limits, and observed evidence.

Jobs, messages, processes, turns, and compaction stay with OMP. Every adjustment can be switched off; an unrecognized host interface, structure, or ownership keeps the affected adjustment inactive with a reason, leaving the host's own behavior in place.

## Adjustments

- [Continuing waits](./docs/adjustments.md#continuing-waits): default on. A `wait` call continues across all-running job snapshots to one total deadline, 20 minutes by default, instead of returning each empty native window.
- [Continuing after a transient model error](./docs/adjustments.md#continuing-after-a-transient-model-error): default on. A turn that ended with an eligible upstream error continues in the same session after 1 s and again with a doubling delay up to 8 s, at most 8 continuation turns per failure chain. Eligible covers classifier-flagged transient and timeout failures, turns the host marked as interrupted mid-stream, and errors carrying neither a status nor a classification.
- [Extending one compaction deadline](./docs/adjustments.md#extending-one-compaction-deadline): default **off**. Within one compaction window, a matching `AbortSignal.timeout` call gets a longer deadline, so a remote compaction that needs more than the native 5 minutes is not cut off. Process-wide and experimental.
- [Replaying native history in a resumed session](./docs/adjustments.md#replaying-native-history-in-a-resumed-session): default on. A resumed session's first request replays the native provider items the previous process ended with, instead of rebuilding the conversation from its generic content, so a prompt cache over that form can serve it. Process-wide, one flag, no body rewrite.
- [Task argument cleanup](./docs/adjustments.md#task-argument-cleanup): default on when the built-in task schema exposes the seance-only `sourceSession` field. Remove it and `model` from non-seance task items before host validation; a schema with only the ordinary `model` selector stays untouched.
- [Copy the last reply](./docs/adjustments.md#copy-the-last-reply): default on. Press `alt+shift+a` in an interactive session to copy the text blocks of the last assistant reply. Thinking, tool calls, and tool output stay out of the clipboard; a streaming turn or a reply without text leaves it unchanged.

The wait adjustment adds an optional `timeout`; replay chooses the stored native items. Neither changes the model, cache key, or stored history. Recovery starts a turn and wait repeats a call the model already made; provider quota is spent when the model runs. The task argument cleanup rewrites the event input and leaves the task schema unchanged; the host persists the revised arguments in the current assistant message. The copy shortcut only reads the active branch and writes the system clipboard; it adds no session entry and sends no request.

## Configuration

Settings live in OMP's plugin settings for `@ruokee/omp-qol`. The manifest in `package.json` declares each key, its type, default, and description, and OMP merges project overrides over the global values.

```bash
omp plugin config list @ruokee/omp-qol
omp plugin config set @ruokee/omp-qol waitJobsSeconds 1800
```

Settings are read once per activation. Restart OMP after a change. A running process keeps the values it read at startup, and a new session in that process does not reload them.

### General

- `enabled`: default `true`, accepts a boolean. Master switch. When off, no module's handler acts. The fixed copy shortcut is still registered during the factory, so its key remains claimed while this switch is off; the handler does nothing.

### Wait

- `waitEnabled`: default `true`, accepts a boolean. Extend the recognized builtin `wait`.
- `waitContinueEmptyWindows`: default `true`, accepts a boolean. Continue inside one call on an all-running job snapshot. When off, return the first native window.
- `waitJobsSeconds`: default `1200`, accepts a number `0.05`–`3600`. Default total deadline of one `wait` call. An explicit `timeout` overrides it.
- `waitMessagesSeconds`: default `1200`, accepts a number `0.05`–`3600`. Accepted and validated; no effect on supported hosts, which offer no message-only wait entry.
- `waitProcessSeconds`: default `1200`, accepts a number `0.05`–`3600`. Accepted and validated; no effect on supported hosts, which offer no named-process wait entry. Use the host's `proc://` interface for process control.

### Recovery

- `recoveryEnabled`: default `true`, accepts a boolean. Register the `session_stop` handler.
- `recoveryMode`: default `knownTransient`, accepts `knownTransient` or `unclassified`. Error scope that is eligible. `knownTransient` accepts errors the host classifies as transient or timeout, an error the host marked as interrupted mid-stream, or an error with neither an HTTP status nor a classification. `unclassified` accepts host-classified transient or timeout errors and all unclassified errors, with or without an HTTP status, after the same safety exclusions and terminal client status checks.
- `recoveryMaxAttempts`: default `8`, accepts an integer `1`–`8`. Continuation turns requested for one failure chain.
- `recoveryBackoffBaseMs`: default `1000`, accepts an integer `1`–`10000`. Delay before the first continuation.
- `recoveryBackoffMaxMs`: default `8000`, accepts an integer above `recoveryBackoffBaseMs`, up to `10000`. Upper bound of the doubling delay.
- `recoveryNotify`: default `true`, accepts a boolean. Show a warning line with the attempt number and the delay for each continuation.

### Compaction timeout

- `compactionTimeoutEnabled`: default `false`, accepts a boolean. Install the process-wide `AbortSignal.timeout` wrapper. Off by default.
- `compactionTimeoutMs`: default `900000`, accepts an integer above `compactionTimeoutFloorMs`, up to `3600000`. Deadline in milliseconds applied to one matching timeout call.
- `compactionTimeoutFloorMs`: default `300000`, accepts an integer `300000`–`3599999`. Lowest timeout value the experiment raises. An expert setting: a floor that leaves no room above it rejects the module, and a floor above the native `300000` ms request deadline stops the compaction request itself from matching, which `/qol` states.
- `compactionWindowGuardMs`: default `3600000`, accepts an integer from `compactionTimeoutMs` up to `14400000`. Longest lifetime of one compaction window, counted from the event that opened it.
- `compactionTimeoutNotify`: default `true`, accepts a boolean. Show a warning line the first time a window rewrites a deadline.

### Replay

- `replayEnabled`: default `true`, accepts a boolean. Install the process-wide wrapper that keeps a resumed session's first request on the provider's native history. On by default; the adjustment is inert for a session that carries no stored items.

### Task arguments

- `taskArgsEnabled`: default `true`, accepts a boolean. When the built-in task schema exposes the seance-only `sourceSession` field, remove it and `model` from non-seance task items before host validation. The registered handler disables speculative task launch and experimental read speculation. On a schema with only the ordinary `model` selector, the module reports `unavailable` and registers no handler. Restart to apply.

### Copy

- `copyEnabled`: default `true`, accepts a boolean. Bind `alt+shift+a` to copy the text blocks of the last assistant reply. The master `enabled` switch must also be on. The shortcut is registered while the extension factory runs, so the key stays claimed even when this switch is off or the settings are rejected; the handler then does nothing. Restart to apply.

### Validation

- A key that is absent takes its default.
- `null`, a wrong type, a non-finite number, a number that is not an integer where an integer is required, a value outside the range above, or an enum value outside the manifest disables the module that owns the key. Other modules register normally.
- An unknown key, a settings root that is not an object, or a settings getter that fails disables every module.
- Diagnostics name the key and the rule that rejected it, never the value: `wait.jobsSeconds=range`. A module reports each reason once per activation through the host log, and through the UI when the host has one.

## Status

`/qol` prints the current state and changes nothing. It runs no model turn and reads no value outside the settings schema.

```
@ruokee/omp-qol 0.5.10
activation cwd: /home/me/project
refresh: restart OMP; settings are read once per activation
settings: ok
wait: enabled (entry=wait effectiveDefaultSeconds=1200 messageContinuation=not-applicable processWait=not-applicable serviceContinuation=not-applicable) — enabled=true continueEmptyWindows=true
recovery: enabled — enabled=true mode=knownTransient maxAttempts=8 backoffBaseMs=1000 backoffMaxMs=8000 notify=true
compaction: disabled (compaction-disabled) — enabled=false timeoutMs=900000 floorMs=300000 windowGuardMs=3600000 notify=true
replay: enabled (rewrites=0) — enabled=true
taskArgs: enabled (rewrites=0) — enabled=true
copy: enabled — enabled=true shortcut=alt+shift+a
```

`pending` means no session has started in this process. `disabled`, `invalid`, `incompatible`, and `unavailable` each carry a reason code, and `problems:` lists the rejected keys when the settings object was accepted only in part. A rejected settings object replaces every module line with the reason and ends the report with the keys that rejected it.

## Limits

Each adjustment lists its own limits in [Adjustments](./docs/adjustments.md).

## Compatibility

The minimum maintained OMP version is `18.5.0`, with no upper maintenance bound. This section states the maintenance commitment; it is not an installation or runtime requirement. An earlier host may still run the package without gaining a maintenance commitment. The declaration does not promise that later releases keep working, and it does not mean every version at or above the minimum was verified.

The package declares `@oh-my-pi/pi-agent-core`, `@oh-my-pi/pi-ai`, and `@oh-my-pi/pi-coding-agent` as unrestricted host peers (`*`). Those declarations name the host packages the component imports; they carry no maintenance range, no runtime check, and no claim about any host version.

The automated type check and test suite run against OMP `18.5.0`. Source baselines are path-specific: recovery, the compaction deadline, and replay cite `18.2.8`, where those mechanisms were first read; continuing waits cite `18.5.0`; task argument cleanup cites `18.11.3`, where the seance task schema was read; copy cites `18.5.0` for the shortcut registry and clipboard export, with the native action table checked on the installed `18.11.3`.

The checks cover what the modules inspect, and not the entry's own imports or a difference no module looks at, so an unrecognized host change can also alter behavior without disabling the adjustment.

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

Restart OMP afterwards. A running process keeps the extension code it loaded at startup. The extension stores nothing of its own, so an update changes no session, message, or job.

### Uninstalling

Uninstall the package and restart OMP. Nothing else is written outside the settings you set, which you can delete with `omp plugin config delete @ruokee/omp-qol <key>`.

## Development

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
```

The test suite replaces the host with a small recording host and keeps the package boundaries real: the settings getter from the installed `@oh-my-pi/pi-coding-agent`, the error classifier from the installed `@oh-my-pi/pi-ai`, and `AbortSignal.timeout` and `Map.prototype.set` in both their native and patched form. Each adjustment records the checks its tests cover in [Adjustments](./docs/adjustments.md).

## Changes

### 0.5.10

Compaction usage and model prompt rules belong to `@ruokee/omp-smart-context`.

1. Preserve each module's effective `enabled && moduleEnabled` result in the new package, resolving project overrides first.
2. Remove `compactionUsageEnabled` and `modelPromptsEnabled` from both user and project QoL settings. Either leftover rejects the whole QoL configuration. Keep every unrelated setting and existing rule file.
3. Replace old smart-cache and standalone Pin registrations when migrating those capabilities, including manual extension paths. Restart OMP after changing registrations or configuration.

QoL neither installs nor stops the migrated modules.

## License

MIT.
