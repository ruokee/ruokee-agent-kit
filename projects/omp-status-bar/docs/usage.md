# OMP Status Bar

[中文](./usage.zh.md)

A persistent OMP status bar extension: one `belowEditor` widget host plus builtin providers for token metrics, cache hit rate, context usage, and the count of model requests the session has answered.

Part of [projects/omp-status-bar](../README.md). Written by Ruokee.

## Install

The package is not published yet. Clone this repository, install its locked dependencies, and link the package into OMP:

```bash
cd projects/omp-status-bar
bun install
omp plugin link "$(pwd)" --scope user
```

OMP reads `omp.extensions` from `package.json` and loads `src/extension.ts`; no manual extension-path setting is required.

The minimum maintained OMP version is `18.5.0`, as declared in the [compatibility section of the component README](../README.md). The bound expresses maintenance responsibility only: it does not restrict installation, activation, or running, and it is not a list of verified versions. Automated checks run on OMP 18.5.0, where `bun test` and `tsc --noEmit` pass. Those are package-level runs against installed copies of the host packages, not real host runs. Real TUI validation covers OMP 18.2.3, 18.2.8, 18.4.3, and 18.5.1.

## Configuration

The Host reads one file at `session_start`:

```text
<agentDir>/omp-status-bar.yml
```

`agentDir` comes from `getAgentDir()` in `@oh-my-pi/pi-coding-agent`, so the file follows the active OMP profile. Hot reload does not happen; edits apply on the next OMP session.

Creating, resuming, or forking a session in the same process reloads the configuration. The previous Host stops before the new Host binds its data sources and mounts its widget. Shutdown also interrupts an unfinished provider start.

Full example:

```yaml
version: 1
separator: slash
tight: false
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
  - id: turn
```

### Top-level fields

| Field | Required | Contract |
| --- | --- | --- |
| `version` | yes | Only the integer `1` is accepted |
| `separator` | no | `space`, `slash`, `dot`, `pipe`; default `slash` |
| `tight` | no | `false` prefixes non-empty output with one ASCII space; `true` removes it; default `false` |
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

Builtin ids: `total`, `input`, `cache`, `output`, `cache-hit`, `context`, `turn`. No legacy `tokens` or `cost` ids and no aliases.

### Metric formulas

All five token metrics read the same per-tick snapshot. That snapshot holds the conversation's own usage, summed from the session branch the session currently holds: assistant message usage and `task` tool result usage count, out-of-band `model_usage` records do not. OMP's `getUsageStatistics()` adds both kinds into one session total, so a metric reading it would report the Find judgment cascade as conversation traffic; that cascade always reports `cacheRead: 0`, which holds the hit rate down for the rest of the session. Because the totals come from the branch, tree navigation and branching move them the same way they move `turn`.

```text
input = input + cacheWrite          (I)
cacheRead = cacheRead               (C)
total = input + cacheWrite + cacheRead + output   (T)
output = output                     (O)
hitRate = C / (I + C)               (H)
```

`input`, `cacheWrite`, `cacheRead`, and `output` are the conversation counters of that branch.

T, I, C, and O render through the shared decimal token formatter:

1. Non-finite and non-positive values show `0`.
2. Below `1000`, show the rounded integer.
3. Scale by `1000` using `K`, `M`, `G`, `T` in order.
4. Scaled values below `99.95` keep one decimal, dropping a trailing `.0`.
5. Scaled values at or above `99.95` show an integer.
6. At `999.5` the value promotes to the next unit, so `1000K` never appears.

`H` shows a percentage with one decimal place by default, including trailing zeroes, such as `H 82.0%` or `Hit 82.0%`. When `I + C` is zero, the provider publishes nothing.

### Label options

`total`, `input`, `cache`, `output`, and `cache-hit` accept a `label` option. `cache-hit` also accepts `decimalPlaces`.

```yaml
options:
  label: compact
```

| Value | `total` | `input` | `cache` | `output` | `cache-hit` |
| --- | --- | --- | --- | --- | --- |
| `compact` (default) | `T` | `I` | `C` | `O` | `H` |
| `word` | `Total` | `Input` | `Cache` | `Output` | `Hit` |

Labels apply per instance, so mixing is allowed. The widget never downgrades `word` to `compact` on a narrow terminal.

### Cache-hit precision

`cache-hit` accepts a `decimalPlaces` option:

```yaml
options:
  decimalPlaces: 2
```

It must be an integer from `0` to `2`. The default is `1`, and the provider renders exactly that many decimal places, including trailing zeroes. Set it to `0` to show an integer, such as `Hit 82%`. The range stops at `2` because `0.01` percentage points is the finest value a status-bar percentage can usefully carry.

### Fixed colors

The label, the following space, and the number share one color span. These colors are not configurable:

| Provider | Color |
| --- | --- |
| `total` | `#5fafaf` |
| `input` | `#00afff` |
| `cache` | `#af87ff` |
| `output` | `#ff5faf` |
| `cache-hit` | `#8787af` |
| `turn` | `#87d7af` |

## Turn provider

`turn` shows how many model requests the current session answered successfully. It accepts no options: any option key invalidates that entry.

```yaml
statuses:
  - id: turn
```

The value is session-cumulative, but it always follows the branch the session currently holds. Binding a session counts the assistant responses that already ended successfully on that branch, each later successful response advances the value, and navigating the session tree or branching re-seeds it from the branch now in front, so a rewind to an earlier point lowers it. A resume or a session switch therefore continues the count of the session in front instead of restarting at zero.

Only a successful response advances the value. A failed request, an interrupted response, and a request stopped before the model call leave it unchanged.

The provider renders the fixed label `Turn`, a space, and the number as one span in `#87d7af`. While a turn is running the value is emphasized; otherwise it is dimmed. While the value is zero the provider publishes nothing.

`turn` follows the session's turn lifecycle instead of the snapshot-backed builtin providers: it reads no usage or context data and schedules no timer. A config that contains only `turn` therefore starts no internal sources.

## Context provider

`context` accepts one option:

| Option | Values | Default | Output examples |
| --- | --- | --- | --- |
| `mode` | `percent`, `absolute` | `percent` | `U+F0068 ctx 12%`, `U+F0068 14.7K` |

An unknown option or another `mode` value invalidates that entry.

Data comes from `ctx.getContextUsage()`. When usage is missing or `contextWindow <= 0`, the provider publishes nothing. `percent` rounds to an integer; `absolute` formats only the current token count with the shared token formatter. The context window is used only for that check and is not displayed.

The fragment starts with the Nerd Font glyph `U+F0068`, followed by one plain space and the usage text, for example `U+F0068 ctx 12%`. The glyph is static: it neither blinks nor changes with usage. It renders dimmed in `#5fafaf`, and the usage text uses the terminal default foreground. Glyph and text share one provider fragment, so the top-level separator never falls between them. Terminals whose fonts lack the glyph get no fallback.

## Data refresh

When the first snapshot-backed builtin provider starts, the internal sources sample immediately and a shared OMP-managed interval ticks every `600 ms`. The snapshot-backed builtin providers read the same immutable snapshot; T, I, C, O, and H never trigger five separate branch aggregations per tick. `turn` is event-driven instead: it reads no source, schedules no timer, and never starts the shared interval.

With TICO or H subscribers, each tick aggregates the branch at most once. `getContextUsage()` is read only while `context` has subscribers. Third-party-only configs and configs holding only `turn` start no internal sources.

One process holds one bound source set. `session_start` binds the sources of the session that is now in front and `session_shutdown` releases them. A session without UI skips both, so a subagent session in the same process never rebinds the sources of the UI session it shares them with. The turn count follows the same rule: a session without UI ignores its turn events and never moves the value of the session in front.

Snapshots bump their revision only when a field changes. Providers publish only when their normalized fragment changes.

The shared interval clears when the last snapshot-backed builtin provider stops. Third-party providers use their own OMP-managed timers through the public provider context.

Builtin providers expose no `refreshMs` option; the fixed cadence is internal and not part of schema version 1.

## Failure behavior

- The config, builtin sources, and widget only start when `ctx.hasUI` is true. A session without UI binds nothing and holds no teardown state, so it cannot replace, sample, or unbind what the UI session bound.
- One config entry creates one provider instance; failures in `create()` or `start()` deactivate and clean up that instance only.
- Every interval and timeout goes through OMP-managed timers.
- Provider callback, publish, start, and stop errors never end the OMP session.
- Diagnostics deduplicate by content and stay bounded.
- After shutdown the host rejects new timers, new publishes, and late callbacks.
- A shutdown racing an unfinished start wins: no remount, no publish.

## Release gate

The automated suite runs headless and cannot prove terminal layout. Before a release is tagged, start a real OMP TUI session on the target OMP version with this extension enabled and confirm:

- the status bar renders one persistent row below the editor;
- token metrics and context usage update while a request runs;
- the turn count advances once per answered request, stays dimmed between turns, leaves the value unchanged for a failed or interrupted request, keeps the resumed session's count, and follows the branch in front after a tree rewind or a new branch;
- the row survives live width changes and truncates within the available columns;
- the row coexists with OMP's native status line, terminal-title spinner, and subagent cards without flicker or layout shifts;
- session switches and shutdowns leave no duplicate widget or timer behind.

OMP 18.2.3 compatibility was validated with the component's locked dependencies and the `pro-20x/gpt-5.6-luna` model. The TUI run exercised live terminal widths from 48 to 100 columns, request-time metric updates, a session switch, SGR mouse input, a subagent task card, terminal-title spinner frames, and clean shutdown. A temporary validation override lowered the recent-token cutoff so manual `/compact` exercised remote compaction; OMP reported `remote-compacted · 20K→19K`, and the row remained mounted and updated afterward. The existing runtime code and public provider contract required no change.

The turn metric was validated on OMP 18.2.8 with the component's locked dependencies and the `pro-20x/gpt-6-luna` model, run under a temporary OMP profile with its own status bar configuration. The row rendered `Turn` after the token and context readings, the value advanced once per answered model request and held at its previous value while a tool ran, an interrupted request left it unchanged, a resumed session showed the branch history before any new request, and a subagent run did not move the value of the session in front. A `/tree` rewind to an earlier entry and a branch created from an earlier message each dropped the value to the count of the branch then in front, and in both cases the next answered request advanced it from there. In that run the value rendered dimmed between requests and emphasized while a request was running.

The row was validated on OMP 18.4.3 with the component's locked dependencies and a loopback OpenAI-compatible provider (`u05mock/u05-mock-1`, 200000-token window, `u05mock/u05-mock-2`, 50000-token window, 15000 prompt tokens per request) added to a temporary agent directory. Startup rendered `ctx 4%`. During the first request the row held that reading, and once the answer arrived the frame showed `ctx 4% / Turn 1` before the next sample added the token reading as `T 15K / ctx 8% / Turn 1`. In the next request, which the provider held open, the row kept `T 15K / ctx 8% / Turn 1` while the native status line showed the working spinner; after that answer the turn count moved first (`T 15K / ctx 8% / Turn 2`) and the token total followed on the next sample (`T 30K / ctx 8% / Turn 2`). While `/hotkeys` had the Keyboard Shortcuts panel open, the bottom of the frame still carried the native status line and the widget row at `T 15K / ctx 8% / Turn 1`; ESC closed the panel and the next prompt was answered as `Turn 2`. A session-only model switch to `u05mock/u05-mock-2` changed the native status line to `U05 Mock Two` with a 50000-token window and moved the same 15000 tokens to `ctx 30%`, without touching the turn count, which advanced only on the following answered request (`T 30K / ctx 30% / Turn 2`).

The conversation-only token source was validated on OMP `18.4.4` with the component's locked dependencies and the `pro-20x/gpt-5.6-luna` model, under an isolated plugin directory that kept the host agent configuration. A Find call over a large repository read 20 files and billed 16 judgment requests (68,368 input tokens, `cacheRead: 0`) while the row showed `Total 17.7K / Cache 7.7K / I 10K / O 79 / Hit 43.5% / Turn 2`, matching the conversation's own assistant-message usage to the token (9,968 input, 7,680 cache read, 79 output) and to the resulting 43.5% rate; the session aggregate would have shown `I 78K` and `Hit 8.9%` instead. Live terminal widths, session switching, tree rewinds, interrupts, and subagent cards were not re-run in that session.

The static context glyph was validated on OMP `18.5.1` with the component's locked dependencies and the `pro-20x/gpt-5.6-luna` model, loading only this extension under the existing agent configuration, where `context` uses `absolute` mode ahead of the token metrics and `turn`. Startup rendered `U+F0068 11.8K`, with the glyph dimmed in `#5fafaf` and one space before the reading. After one answered request the row showed `U+F0068 10.3K / Total 10.3K / Cache 0 / I 10.3K / O 5 / Hit 0.0% / Turn 1`, and six frames captured about 350 ms apart rendered byte-identical rows, so the glyph did not blink. Percent mode, live terminal widths, session switching, tree rewinds, interrupts, and subagent cards were not re-run on OMP 18.5.1.

Live terminal widths, session switching, tree rewinds, interrupts, and subagent cards were not re-run on OMP 18.4.3; those checks stand as recorded for OMP 18.2.3 and 18.2.8.

This evidence applies to the documented component source. Repeat the real TUI checks after a later source change that can affect rendering or lifecycle behavior.
