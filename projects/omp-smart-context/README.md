# omp-smart-context

[中文](./README.zh.md)

`@ruokee/omp-smart-context` provides independently switchable context capabilities. OMP keeps control of session history and compaction.

## Guides

- [Align Remote compaction requests](./docs/remote.md).
- [Align Handoff requests](./docs/handoff.md).
- [Record missing compaction usage](./docs/usage.md).
- [Add model-specific instructions](./docs/model-prompts.md).
- [Keep text across compaction with Pin](./docs/pin.md).
- [Configure the package](#configuration), [read status](./docs/status.md), [migrate existing settings](./docs/migration.md), or [check compatibility](#compatibility).
- [Changelog](./CHANGELOG.md).

## Install

From this component directory:

```bash
omp install . --scope user
```

OMP's native plugin manager loads the extension and its declared settings. No separate extension entry or settings file is needed. When replacing smart-cache, standalone Pin, or migrated QoL modules, follow [Migration](./docs/migration.md) before restarting.

## Configuration

```bash
omp plugin config list @ruokee/omp-smart-context
omp plugin config set @ruokee/omp-smart-context compactionCacheProviderFilter example-provider
omp plugin config set @ruokee/omp-smart-context compactionCacheEnabled true
omp plugin config set @ruokee/omp-smart-context handoffCacheEnabled true
omp plugin config set @ruokee/omp-smart-context modelPromptsEnabled true
omp plugin config set @ruokee/omp-smart-context pinEnabled true
```

- `compactionCacheEnabled`: boolean, default `false`. Enable Remote alignment.
- `compactionCacheProviderFilter`: string, default `""`. Repair Remote only when this exactly matches the current model's Provider name. It does not select a model or route. An empty value leaves Remote alignment unavailable.
- `compactionCacheMode`: `standard` or `hooks`, default `hooks`. Choose how much completed request handling Remote can reuse. See [Modes](./docs/remote.md#modes).
- `handoffCacheEnabled`: boolean, default `false`. Enable Handoff alignment, independently of Remote settings.
- `compactionUsageEnabled`: boolean, default `true`. Fill missing soft/Handoff usage when the host does not record it natively.
- `modelPromptsEnabled`: boolean, default `false`. Append matching model instructions. When off, no rule files are read and no unused-file errors are reported.
- `pinEnabled`: boolean, default `false`. Enable `/ctx-pin` and `ctx_pin`. Turning it off preserves existing records and history.

### Configuration sources

OMP merges project overrides over user settings. Missing keys take their defaults. The package reads only its own settings and has no master switch.

### Apply changes

Restart OMP after changing settings or extension registrations. Navigating or creating a session does not reload them. Model-rule file edits are different: they take effect on the next covered ordinary turn without restart.

### Configuration errors

An invalid setting for one capability disables that capability alone. An unknown key, non-object settings root, or settings-reader failure rejects the whole package configuration. `/smart-context` reports a fixed reason without printing rejected values.

## Remote compaction alignment

OMP prepares Remote compaction differently from ordinary requests. Differences in prompts, tool definitions, or history can break the shared prefix and cause cache misses. Remote alignment restores eligible common content so compaction can reuse that prefix.

Enable Remote alignment and set its filter to the current model's exact Provider name. OMP must still select Remote on a model that supports it. Coverage is non-Codex `openai-responses` V2. The model and native route stay unchanged. See the [Remote guide](./docs/remote.md) for modes and limits.

## Handoff alignment

Handoff requests can omit system instructions present in ordinary requests and use different generation options. These differences can break the shared cached prefix. Handoff alignment restores supported common content and options.

It has its own default-off switch. Native generation, cancellation, and fallback remain with OMP. See the [Handoff guide](./docs/handoff.md#support) for current protocol and authentication support and their limits.

## Record missing compaction usage

Fill compaction-request usage missing from session statistics. The capability is on by default and stops automatically when the installed host exposes native recording. See the [usage guide](./docs/usage.md) for recorded requests, costs, skips, and the upstream fix.

## Model prompt rules

Append system instructions for specified models. Each covered ordinary main or child turn matches its own current model; file edits take effect next turn. This does not add rules to all side requests. See [Model prompt rules](./docs/model-prompts.md) for directories, format, errors, and trust implications.

## Pin

Keep selected text in later ordinary requests on the current session branch, including after compaction. Enable Pin to use the `/ctx-pin` user command and `ctx_pin` Agent tool. See the [Pin guide](./docs/pin.md) for confirmation, updates, capacity, resets, and persistence risks.

## Status

Run `/smart-context` to check each capability without starting a model turn. Remote and Handoff report separately. `awaiting-reference` means waiting for an eligible ordinary request; `already-aligned` and `rewritten` mean alignment succeeded; `rejected` means no rewrite was made and the native request still sends. The [status reference](./docs/status.md) explains all states and counters.

## Compatibility

The minimum maintained OMP version is `18.5.0`, without an upper maintenance bound. This is a maintenance commitment, not an installation or runtime gate. Missing interfaces disable their owning capability. Support above the floor does not mean every host version or extension combination has been exercised.

Host peers `@oh-my-pi/pi-agent-core`, `@oh-my-pi/pi-ai`, `@oh-my-pi/pi-coding-agent`, `@oh-my-pi/pi-tui`, and `@oh-my-pi/pi-utils` use `*`; development dependencies are locked to `18.5.0`. Provider cache availability and billing remain Provider-dependent, even when request alignment succeeds.

## Development

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
```

## License

MIT.
