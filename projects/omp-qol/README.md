# omp-qol

[中文](./README.zh.md)

Six independently switchable adjustments to OMP behavior: continuing waits, bounded continuation after model errors, an experimental compaction deadline extension, native history replay, opt-in remote compaction cache alignment, and opt-in model prompt rules. [Adjustments](./docs/adjustments.md) states each adjustment's host source, limits, and observed evidence.

Jobs, messages, processes, turns, and compaction stay with OMP. Every adjustment can be switched off; an unrecognized host interface, structure, or ownership keeps the affected adjustment inactive with a reason.

## Adjustments

| Adjustment | Default | Effect |
| --- | --- | --- |
| [Continuing waits](./docs/adjustments.md#continuing-waits) | on | A `wait` call continues across all-running job snapshots to one total deadline, 20 minutes by default, instead of returning each empty native window. |
| [Continuing after a transient model error](./docs/adjustments.md#continuing-after-a-transient-model-error) | on | A turn that ended with an eligible upstream error continues in the same session after 1 s and again with a doubling delay up to 8 s, at most 8 continuation turns per failure chain. Eligible covers classifier-flagged transient and timeout failures, turns the host marked as interrupted mid-stream, and errors carrying neither a status nor a classification. |
| [Extending one compaction deadline](./docs/adjustments.md#extending-one-compaction-deadline) | **off** | Within one compaction window, a matching `AbortSignal.timeout` call gets a longer deadline, so a remote compaction that needs more than the native 5 minutes is not cut off. Process-wide and experimental. |
| [Replaying native history in a resumed session](./docs/adjustments.md#replaying-native-history-in-a-resumed-session) | on | A resumed session's first request replays the native provider items the previous process ended with, instead of rebuilding the conversation from its generic content, so a prompt cache over that form can serve it. Process-wide, one flag, no body rewrite. |
| [Aligning remote compaction cache](./docs/adjustments.md#aligning-remote-compaction-cache) | **off** | Reuse a confirmed online request prefix for owned non-Codex Responses V2 compaction. Requires a selected provider and preserves native speculative compaction. |
| [Model prompt rules](#model-prompt-rules) | **off** | Append matching user-authored Markdown bodies to each covered turn's system prompt, without requiring a template or another component. |

The wait adjustment adds an optional `timeout`; replay chooses the stored native items; cache alignment changes only a recognized compaction request prefix and tool definitions. None changes the model, cache key, stored history, or session file. Recovery starts a turn and wait repeats a call the model already made; provider quota is spent when the model runs.

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
| `waitEnabled` | `true` | boolean | Extend the recognized builtin `wait`. |
| `waitContinueEmptyWindows` | `true` | boolean | Continue inside one call on an all-running job snapshot. When off, return the first native window. |
| `waitJobsSeconds` | `1200` | number `0.05`–`3600` | Default total deadline of one `wait` call. An explicit `timeout` overrides it. |
| `waitMessagesSeconds` | `1200` | number `0.05`–`3600` | Accepted and validated; no effect on supported hosts, which offer no message-only wait entry. |
| `waitProcessSeconds` | `1200` | number `0.05`–`3600` | Accepted and validated; no effect on supported hosts, which offer no named-process wait entry. Use the host's `proc://` interface for process control. |

### Recovery

| Key | Default | Accepted | Effect |
| --- | --- | --- | --- |
| `recoveryEnabled` | `true` | boolean | Register the `session_stop` handler. |
| `recoveryMode` | `knownTransient` | `knownTransient`, `unclassified` | Error scope that is eligible. `knownTransient` accepts errors the host classifies as transient or timeout, an error the host marked as interrupted mid-stream, or an error with neither an HTTP status nor a classification. `unclassified` accepts host-classified transient or timeout errors and all unclassified errors, with or without an HTTP status, after the same safety exclusions and terminal client status checks. |
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

### Compaction cache

| Key | Default | Accepted | Effect |
| --- | --- | --- | --- |
| `compactionCacheEnabled` | `false` | boolean | Enable the process-owned cache adjustment for the main session without registering a speculation-vetoing hook. |
| `compactionCacheProvider` | `""` | string | Exact configured provider name. Empty keeps the module inactive; only `openai-responses` V2 requests can match. |
| `compactionCacheMode` | `"hooks"` | `standard`, `hooks` | `standard` retains the recognized host repairs; `hooks` also reuses a proved completed host context projection, including insertion, reordering, and restored context. Neither mode enables the module. |

To enable it for a configured provider, replace `your-provider` with its name:

```bash
omp plugin config set @ruokee/omp-qol compactionCacheProvider your-provider
omp plugin config set @ruokee/omp-qol compactionCacheEnabled true
```

Restart OMP with a model from that provider. `/qol` must show `cache: enabled`; `rewrites=0` means no eligible request has been rewritten yet, not that a provider cache hit occurred. Turn the setting off and restart to remove the hooks and wrappers. A stopped owner does not recover within the same process.

The default `hooks` mode observes the owning session's context result without invoking handlers again or depending on a companion extension. With no relevant handler, it performs the common repair. `standard` leaves unknown hook differences native. To select it, set `compactionCacheMode` to `standard` and restart. Both modes require unchanged transport confirmation and complete request validation; an unknown projection or request difference leaves every byte native. `/qol` shows the effective `mode`.

### Model prompts

| Key | Default | Accepted | Effect |
| --- | --- | --- | --- |
| `modelPromptsEnabled` | `false` | boolean | Append model-matched rule bodies. The master `enabled` switch must also be on. |

```bash
omp plugin config set @ruokee/omp-qol modelPromptsEnabled true
```

Restart OMP after changing the switch. Existing rule files need no path or format migration. When either switch is off, this module registers no turn handler, reads no rule directory, and reports no unused-file diagnostic.

### Validation

- A key that is absent takes its default.
- `null`, a wrong type, a non-finite number, a number that is not an integer where an integer is required, a value outside the range above, or an enum value outside the manifest disables the module that owns the key. Other modules register normally.
- An unknown key, a settings root that is not an object, or a settings getter that fails disables every module.
- Diagnostics name the key and the rule that rejected it, never the value: `wait.jobsSeconds=range`. A module reports each reason once per activation through the host log, and through the UI when the host has one.

## Status

`/qol` prints the current state and changes nothing. It runs no model turn and reads no value outside the settings schema.

```
@ruokee/omp-qol 0.5.4
activation cwd: /home/me/project
refresh: restart OMP; settings are read once per activation
settings: ok
wait: enabled (entry=wait effectiveDefaultSeconds=1200 messageContinuation=not-applicable processWait=not-applicable serviceContinuation=not-applicable) — enabled=true continueEmptyWindows=true
recovery: enabled — enabled=true mode=knownTransient maxAttempts=8 backoffBaseMs=1000 backoffMaxMs=8000 notify=true
compaction: disabled (compaction-disabled) — enabled=false timeoutMs=900000 floorMs=300000 windowGuardMs=3600000 notify=true
replay: enabled (rewrites=0) — enabled=true
cache: disabled (cache-disabled) enabled=false providerSelected=false mode=hooks
modelPrompts: disabled (model-prompts-disabled) enabled=false
```

`pending` means no session has started in this process. `disabled`, `invalid`, `incompatible`, and `unavailable` each carry a reason code, and `problems:` lists the rejected keys when the settings object was accepted only in part. A rejected settings object replaces every module line with the reason and ends the report with the keys that rejected it.

## Model prompt rules

Each covered turn reads `model-prompts` under the active profile's user agent directory, resolved by `getAgentDir()`, and under `getProjectAgentDir(ctx.cwd)`, that is `<cwd>/.omp/model-prompts`. Only direct, non-hidden regular files with a lowercase `.md` suffix participate. File symlinks and subdirectories are ignored; no ancestor directory or resource root is searched. A missing directory is empty.

Names sort in JavaScript string order within each directory. User bodies precede project bodies. Project files do not shadow same-named user files; identical bodies from different files still contribute separate blocks. Read completion order cannot change this order.

### Format and matching

```markdown
---
metadata: optional, ignored
match:
  - exact: example-provider/example-model-1.0
  - model: another-model-1.0
  - contains: example-model
  - regex: ^example-provider/example-model-1\.0
---

Text appended to the system prompt.
```

UTF-8 Markdown may begin with one BOM. Delimiter lines must contain exactly `---`, with LF or CRLF endings. `match` is a required, non-empty array. Each entry has exactly one of these keys and a non-blank string value:

- `exact` compares the complete `${model.provider}/${model.id}`.
- `model` compares the complete `model.id`, including any `/` in the id.
- `contains` tests a literal substring of `${model.provider}/${model.id}`.
- `regex` tests that same string with a JavaScript `RegExp` compiled without flags.

Entries are alternatives; a file matching several entries contributes once. Matching is case-sensitive and textual. It does not resolve aliases, roles, families, display names, wire names, or thinking-level suffixes, and adds no glob or model-list syntax. Extra top-level frontmatter keys are ignored and never injected. An unknown key or multiple keys inside an entry invalidates the whole file.

Each matching file contributes one block at the end of the incoming turn array. The body starts after the closing delimiter's line ending and stays byte-for-byte, including headings, blank lines, LF/CRLF, indentation, HTML comments, template-like text, and trailing newlines. Frontmatter and the opening BOM are excluded. No wrapper, heading, trimming, template render, context rewrite, message, or history entry is added. Existing blocks keep their bytes and order.

### Refresh and failures

Rules and the effective model are read anew at each covered turn. Additions, edits, deletions, and repairs take effect next turn without restart. Failed files do not reuse an earlier body. With no model, no rules, or no match, the incoming prompt stays unchanged. OMP's turn-scoped override survives a mid-turn rebuild; its next turn starts from the host base prompt, so bodies do not accumulate. Settings still use the activation snapshot and need a restart.

An invalid document is skipped as a whole at its first failure: `frontmatter-missing`, `frontmatter-invalid`, `match-missing`, `match-empty`, `entry-shape`, `entry-key`, `entry-value`, `regex-invalid`, or `body-blank`. `file-unreadable` affects one file and `directory-unreadable` one directory; other valid sources continue. A handler exception reports `unexpected-error` and keeps the incoming prompt, including earlier handlers' results.

Rule diagnostics carry a fixed reason and scope-relative source such as `project/20-rules.md`, deduplicated by session, source, and reason. Each turn uses its current UI notification channel, or the host logger when headless. Bodies, absolute directories, parser errors, regex source, and conversation content are not reported. New or forked sessions have separate histories; returning to a visited session retains that activation's history. Invalid switch types disable only this module; a rejected settings object follows the existing whole-component rejection rule. `/qol` shows state, effective switch, and reason, not model identities or rule bodies.

### Coverage and trust

Ordinary main turns and ordinary child turns that run `before_agent_start` are covered. Each child matches its own effective model and keeps its role, independent blocks, and host protocol. Plan-mode children, Handoff, title generation, and difficulty classification gain no injection route. Side requests keep the host's treatment of the live Agent prompt. This is a turn-level contract, not independent refresh on every provider request, fallback, or temporary model switch. Later handlers can overwrite the result; the module neither reorders extensions nor claims final-provider precedence.

When enabled, project rules become system instructions. This adds no project-trust gate or security isolation. JavaScript regular expressions have no sandbox or execution timeout. Matching bodies have no size or quota limit, so large files can consume prompt space and slow directories delay turn assembly. Keep personal rules in the user directory and inspect project rules before enabling them.

### Upstream re-check

When OMP ships model-scoped instructions, through [issue #6739](https://github.com/can1357/oh-my-pi/issues/6739) or an equivalent facility, re-check matching dimensions, replacement/append composition and block position, refresh timing, and directory discovery/precedence/order. Decide whether to retain the local capability, keep only the missing parts, or remove it, and record the corresponding version change. Host templates alone do not establish equivalent model-rule behavior.

## Limits

Each adjustment lists its own limits in [Adjustments](./docs/adjustments.md). The short version:

- **Wait.** A recognized parameterless builtin `wait` is re-registered with one optional total-deadline `timeout`; delegation sends `{}` to the native tool, and only nonempty all-running job snapshots continue. Messages, settled or absent jobs, errors, interruptions, cancellations, and service frames return as native results. Message-only continuation, named-process waiting, and service-only continuation are not provided. A deadline ends only the call; background jobs and processes keep running.
- **Recovery.** The fixed exclusion list wins over the configured mode, continuations are capped at 8, and the host counts them as well. One failure chain can span several agent runs, so the count follows the chain rather than one submitted prompt, and the chain ends on a turn that settles on its own, on an error outside the configured scope, and on a cancelled pass. A turn is re-run, so a tool call from the failed turn can run again. Long waits run inside the 30 s handler budget the host gives one `session_stop` handler. The interruption mark and the statusless condition are host details without a compatibility promise, so a host release can silently narrow or widen the accepted set.
- **Compaction.** The experiment replaces `AbortSignal.timeout` for the whole process, so every caller that passes a matching timeout in a window gets the longer deadline, not only the compaction request. It can only lengthen a deadline and never shorten one. A window that overlaps another window, belongs to another session, or arrives in an order the extension does not recognize disables the experiment for that process and reports why. One compaction operation that falls back to its next method keeps the same signal, and the extension treats a repeat of that signal as the same operation instead of an overlap; a second live signal inside one window still disables the experiment. Registering the `session_before_compact` hook also turns off speculative compaction in OMP `18.5.0`, so an enabled experiment can make a compaction wait in the foreground; with the default off, no handler is registered. A second activation in the same process keeps the installed patch when it carries the same package version and the same settings snapshot, and reports `incompatible` with `patch-owned-elsewhere`; it registers no window events, so only the activation that installed the patch opens windows, and that session's compaction runs on the native timeout while the window is closed. A second activation with another snapshot or another version, with the master switch or this module's switch off, or with invalid keys stops the installed patch instead, and an activation whose settings could not be read or were rejected stops it too, without enabling a module. When the activation that installed the patch ends its session, the patch stops rewriting and the process keeps the native deadline until OMP restarts; `/qol` reports `compaction: incompatible (owner-stopped)` from then on.
- **Replay.** The wrapper replaces `Map.prototype.set` for the whole process and inspects every write, measured at about 2 ns per string-keyed call. It decides one host flag: the first request of a resumed session replays the items the previous process stored, which assumes the endpoint that answers it can still replay them, the assumption the previous process ended on. A session carrying items that endpoint rejects would fail that request, where the native path rebuilds and proceeds. It covers `openai-responses` provider states only; codex responses, Anthropic, and completions keep their own rules. It depends on the `openai-responses:` state key prefix, on the `nativeHistoryReplayWarmed` field, and on the state being stored through a `Map` write, so a host that renames either or builds the state another way makes it inert without failing, and the rewrite count in `/qol` is the only signal. The wrapper holds no window and no subscription, stays installed after the activation that installed it ends, and comes out only when an activation's effective settings keep it off, when an activation has no usable settings at all, or when the process ends.

- **Cache.** Only the owning main session's recognized V2 requests for the selected provider can be rewritten. Unknown differences pass through unchanged. Process-wide transport and signal wrappers observe the owning model registry instance; a later matching activation reports `patch-owned-elsewhere`, and conflicting settings, navigation, owner shutdown, or overwritten functions stop rewriting until restart. Each owned root keeps its confirmed online reference across retries while newer online work can advance. The cache module does not register a pre-compaction hook or disable speculation; another extension or the separately enabled deadline module may still veto it. References remain in memory without body logs. Cache hits remain a provider decision.

## Compatibility

The minimum maintained OMP version is `18.5.0`, with no upper maintenance bound. This section states the maintenance commitment; it is not an installation or runtime requirement. An earlier host may still run the package without gaining a maintenance commitment. The declaration does not promise that later releases keep working, and it does not mean every version at or above the minimum was verified.

The package declares `@oh-my-pi/pi-ai`, `@oh-my-pi/pi-coding-agent`, and `@oh-my-pi/pi-utils` as unrestricted host peers (`*`). Those declarations name the host packages the component imports; they carry no maintenance range, no runtime check, and no claim about any host version.

The automated type check and test suite run against OMP `18.5.0`. Source baselines are path-specific: recovery, the compaction deadline, and replay cite `18.2.8`, where those mechanisms were first read; continuing waits cite `18.5.0`; cache alignment cites `18.5.1`. A host without the main-session identity required by cache alignment leaves that module inactive. [Adjustments](./docs/adjustments.md) separates each source baseline, actual check or CLI run, and untested scenario.

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

The test suite replaces the host with a small recording host and keeps the package boundaries real: the settings getter from the installed `@oh-my-pi/pi-coding-agent`, the error classifier from the installed `@oh-my-pi/pi-ai`, and `AbortSignal.timeout` and `Map.prototype.set` in both their native and patched form. It covers activation and validation, `wait` registration and its model-visible parameters, the structural continuation rule and deadline races, the recovery classification matrix and continuation chain, the compaction install order, window lifecycle, and restore path, and the replay wrapper's rewrite and forwarding matrix, ownership and release paths, refusals, and `/qol` line.

Model-rule checks cover discovery, matching, body fidelity, next-turn refresh, failure isolation, configuration boundaries, and session-scoped diagnostics. Real CLI and TUI observations, with their limits, are recorded in [Model prompt rules](./docs/adjustments.md#model-prompt-rules).

## License

MIT.
