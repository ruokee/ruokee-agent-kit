# OMP Status Bar

[中文](./usage.zh.md)

A persistent OMP status bar extension: one `belowEditor` widget host plus six builtin providers showing token metrics, cache hit rate, and context usage with a speculative-compaction band indicator.

Part of [projects/omp-status-bar](../README.md). Written by Ruokee.

## Install

The package is not published yet. Clone this repository, install its locked dependencies, and link the package into OMP:

```bash
cd projects/omp-status-bar
bun install
omp plugin link "$(pwd)" --scope user
```

OMP reads `omp.extensions` from `package.json` and loads `src/extension.ts`; no manual extension-path setting is required.

The supported OMP range is `>=18.1.8 <19`. The automated development baseline is OMP 18.1.8, and the real TUI smoke test covers OMP 18.1.10.

## Configuration

The Host reads one file at `session_start`:

```text
<agentDir>/omp-status-bar.yml
```

`agentDir` comes from `getAgentDir()` in `@oh-my-pi/pi-coding-agent`, so the file follows the active OMP profile. Hot reload does not happen; edits apply on the next OMP session.

Full example:

```yaml
version: 1
separator: slash
statuses:
  - id: total
    options:
      label: compact
  - id: input
    options:
      label: word
  - id: cache
  - id: output
  - id: cache-hit
    options:
      label: word
  - id: context
    options:
      mode: percent
```

### Top-level fields

| Field | Required | Contract |
| --- | --- | --- |
| `version` | yes | Only the integer `1` is accepted |
| `separator` | no | `space`, `slash`, `dot`, `pipe`; default `slash` |
| `statuses` | yes | Ordered array; order defines both enablement and display order |

There is no package-level `enabled` switch; OMP plugins manage overall enablement.

A missing config file silently shows nothing. An invalid document (bad YAML, wrong types, wrong schema version, bad separator, unknown top-level field) starts no provider for that session and records one bounded diagnostic. An empty `statuses` array is valid but mounts no widget.

Each `statuses` entry needs a non-empty string `id` and optional `options` mapping (default `{}`). Extra fields on an entry invalidate that entry. The same provider id may appear multiple times; each occurrence creates an independent instance. An unknown id, incompatible contract version, or invalid options skips only that entry; other entries keep running.

### Separators

| Value | Glyph |
| --- | --- |
| `space` | one ASCII space |
| `slash` | `/` |
| `dot` | `·` |
| `pipe` | `\|` |

`slash`, `dot`, and `pipe` include one ASCII space on each side of the glyph; `space` is exactly one ASCII space. The widget renders the whole separator dimmed. Providers never emit separators.

## Builtin providers

Six ids: `total`, `input`, `cache`, `output`, `cache-hit`, `context`. No legacy `tokens` or `cost` ids and no aliases.

### Metric formulas

All five token metrics read the same per-tick snapshot from `getUsageStatistics()`:

```text
input = input + cacheWrite          (I)
cacheRead = cacheRead               (C)
total = input + cacheWrite + cacheRead + output   (T)
output = output                     (O)
hitRate = C / (I + C)               (H)
```

T, I, C, and O render through the shared decimal token formatter:

1. Non-finite and non-positive values show `0`.
2. Below `1000`, show the rounded integer.
3. Scale by `1000` using `K`, `M`, `G`, `T` in order.
4. Scaled values below `99.95` keep one decimal, dropping a trailing `.0`.
5. Scaled values at or above `99.95` show an integer.
6. At `999.5` the value promotes to the next unit, so `1000K` never appears.

H shows a percentage rounded to an integer, such as `H 82%` or `Hit 82%`. When `I + C` is zero, the provider publishes nothing.

### Label options

`total`, `input`, `cache`, `output`, and `cache-hit` accept one option:

```yaml
options:
  label: compact
```

| Value | `total` | `input` | `cache` | `output` | `cache-hit` |
| --- | --- | --- | --- | --- | --- |
| `compact` (default) | `T` | `I` | `C` | `O` | `H` |
| `word` | `Total` | `Input` | `Cache` | `Output` | `Hit` |

Labels apply per instance, so mixing is allowed. The widget never downgrades `word` to `compact` on a narrow terminal.

### Fixed colors

The label, the following space, and the number share one color span. These colors are not configurable:

| Provider | Color |
| --- | --- |
| `total` | `#5fafaf` |
| `input` | `#00afff` |
| `cache` | `#8787af` |
| `output` | `#ff5faf` |
| `cache-hit` | `#8787af` |

## Context provider

`context` accepts one option:

| Option | Values | Default | Output examples |
| --- | --- | --- | --- |
| `mode` | `percent`, `absolute` | `percent` | `ctx 12%`, `14.7K` |

An unknown option or another `mode` value invalidates that entry.

Data comes from `ctx.getContextUsage()`. When usage is missing or `contextWindow <= 0`, the provider publishes nothing. `percent` rounds to an integer; `absolute` formats only the current token count with the shared token formatter. The context window remains an internal input for validation and speculation-band calculation and is not displayed.

The context text and the speculation glyph share one provider fragment joined by a plain space, never crossing the top-level separator.

## Speculative-compaction band indicator

### Meaning

The glyph only means the context has probably entered OMP's speculative-compaction band. It is not OMP's internal `idle`, `running`, or `armed` state, and it cannot prove a compaction task is running or finished.

The glyph is the Nerd Font character `U+F0068`, the same one pi-moon and OMP's `icon.auto` use. Terminals whose fonts lack the glyph get no fallback.

### Band math

Each sample reads the current token count and window from `ctx.getContextUsage()`, the model from `ctx.model`, and the compaction settings group from `Settings.instance.getGroup("compaction")`. Threshold and method selection reuse the functions OMP exports:

```ts
import { resolveSpeculationMethod } from "@oh-my-pi/pi-coding-agent/session/compaction-methods";
import { resolveSpeculationLeadTokens } from "@oh-my-pi/pi-coding-agent/session/speculation-lead";
import { resolveThresholdTokens } from "@oh-my-pi/pi-agent-core/compaction";
```

```text
lead = min(32000, max(8192, floor(threshold * 0.125)))
start = max(0, threshold - lead)
speculationBand = [start, threshold)
```

`resolveSpeculationMethod()` returns `remote`, `handoff`, or `soft` and picks the first available method by `methodOrder`, excluding `snapcompact` and `shake` as the first available method.

The estimate cannot observe whether OMP is already compacting, generating a handoff, or whether a `session_before_compact` handler blocked the speculative task. OMP's real compaction decision may also use an internal stored-conversation estimate that inflates the token count beyond what `ctx.getContextUsage()` reports. The indicator may therefore fire early, late, or when no speculation would happen; the UI never claims a real running state.

### State machine

Internal states:

- `hidden`: auto-compaction disabled, async compaction disabled, no speculable method, or invalid threshold data;
- `normal`: the glyph shows steady and dimmed;
- `indicating`: the glyph blinks.

The machine keeps a fingerprint of what the current estimate is based on: model provider, model id, context window, resolved method, threshold, and start. The first valid sample applies the first-sample rules below. When an existing fingerprint changes, the machine drops the previous token and the entry permission for the current cycle, re-baselines, and stays `normal` or `hidden` for that sample; it never enters `indicating` directly.

First valid sample:

- token inside `[start, threshold)`: enter `indicating`;
- token below `start`: enter `normal` and allow later band entry;
- token at or above `threshold`: enter `normal`; being past the threshold is not read as "speculation already ran".

Entry from `normal` into `indicating` requires the token inside `[start, threshold)` plus an entry permission for the current compaction cycle.

Once `indicating`, the state latches. Even if the token passes `threshold`, the glyph keeps blinking. Any of these ends the indication:

- the current token is lower than the previous sample's token;
- `compaction.enabled` turns off;
- `compaction.asyncEnabled` turns off;
- `resolveSpeculationMethod()` no longer returns a speculable method;
- model provider, model id, or context window changed;
- the session ended.

When the token drops inside `indicating`, the machine returns to `normal`. A drop only means "context shrank"; branch switching or history trimming can trigger it too. To avoid re-blinking immediately while still inside the band, the machine waits until the token falls below `start` before the next cycle may enter `indicating` again.

A changed model, window, resolved method, threshold, or start creates a new baseline without reusing the old fingerprint's previous token or permission. The new baseline permits the next `indicating` only after the token goes below `start`.

### Blink

- `normal` shows a fixed dimmed glyph.
- The first frame after entering `indicating` is emphasized.
- Then every `600 ms` the frame flips between emphasized and dimmed.
- Leaving `indicating` stops the animation immediately; no background timer survives.

Emphasized frames use `#5fafaf`. Dimmed frames use the same color with `dim: true`. The context text itself uses the terminal default foreground.

## Data refresh

When the first builtin provider starts, the internal sources sample immediately and a shared OMP-managed interval ticks every `600 ms`. All configured builtin providers read the same immutable snapshot; T, I, C, O, and H never trigger five separate `getUsageStatistics()` calls per tick.

With TICO or H subscribers, each tick calls `getUsageStatistics()` at most once. `getContextUsage()`, the model, and the compaction settings are read only while `context` has subscribers. Third-party-only configs start no internal sources.

Snapshots bump their revision only when a field changes. Providers publish only when their normalized fragment changes; the blink phase of `indicating` also counts as a fragment change.

The shared interval clears when the last builtin provider stops. Third-party providers use their own OMP-managed timers through the public provider context.

Builtin providers expose no `refreshMs` option; the fixed cadence is internal and not part of schema version 1.

## Failure behavior

- The config, builtin sources, and widget only start when `ctx.hasUI` is true.
- One config entry creates one provider instance; failures in `create()` or `start()` deactivate and clean up that instance only.
- Every interval and timeout goes through OMP-managed timers.
- Provider callback, publish, start, and stop errors never end the OMP session.
- Diagnostics deduplicate by content and stay bounded.
- After shutdown the host rejects new timers, new publishes, and late callbacks.
- A shutdown racing an unfinished start wins: no remount, no publish.

## Release gate

The automated suite runs headless and cannot see the terminal. Before a release is tagged, a real OMP TUI session must be started on the target OMP version with this extension enabled, and must confirm:

- the status bar renders one persistent row below the editor;
- token metrics and context usage update while a request runs;
- the bar coexists with OMP's native status line without flicker or layout shifts.

Until that session has been run and reviewed for the exact release commit, the widget's on-screen behavior is unverified.

## License

MIT. See the repository [LICENSE](../../../LICENSE).
