# omp-status-bar

## Goals

Show one persistent status row below the OMP editor. Compose independently configured providers in user order, including conversation token counts, cache-hit rate, context usage, and answered-request count. Other extensions can add providers through a versioned public contract.

## Out of scope

- Registering or replacing native statusline segments.
- Money, cost, premium-request readings, or the legacy `tokens` and `cost` provider ids.
- A package-level `enabled` switch, configuration hot reload, or configurable refresh intervals.
- Reading compaction settings or estimating a speculative compaction band.
- A replacement glyph when the terminal font lacks the context glyph.

## Public surface

### Configuration

OMP plugin enablement controls the component. Read YAML from `<agentDir>/omp-status-bar.yml`, where `agentDir` is the active OMP profile's agent directory. Creating, resuming, or forking a session reads that session's configuration once. Changes apply at the next session start.

The top-level fields are:

- `version`, required integer `1`.
- `statuses`, required ordered array. It determines enablement and display order. An empty array is valid and shows no widget.
- `separator`, one of `space`, `slash`, `dot`, `pipe`, default `slash`.
- `tight`, boolean, default `false`. A nonempty row starts with one ASCII space when false and with no extra space when true.

Each status entry has a nonempty string `id` and an optional `options` mapping, default `{}`. Additional entry fields invalidate that entry. Repeated ids create independent instances and may have different options.

A missing configuration silently shows nothing. Bad YAML, wrong top-level types, unknown top-level keys, an unsupported version, or a bad separator start no providers for that session and produce a bounded diagnostic. An invalid entry, unknown provider id, unsupported provider contract version, or rejected provider options skip only that entry.

`space` separates visible fragments with one ASCII space. `slash`, `dot`, and `pipe` use `/`, `·`, and `|` respectively, each with one ASCII space on each side. The whole separator is dimmed. Empty fragments produce no separator.

### Display

A session with UI and at least one successfully started provider has one persistent row below the editor. Updates change its content without creating another widget. With no visible provider content it occupies zero rows and can show later publications.

Compose fragments strictly in configuration order. Measure visible terminal width with escape sequences excluded and truncate from the right with one trailing ellipsis when necessary. Preserve leading content; do not reorder entries, selectively discard entries, or shorten `word` labels to compact labels to fit.

The row supplements the native statusline and is independent of `statusLine.showHookStatus` and a custom preset's `status` segment. All builtin Composer shapes of the maintained host use the same below-editor position.

### Token metrics

The builtin ids are `total`, `input`, `cache`, `output`, `cache-hit`, `context`, and `turn`, without aliases. The first five use one consistent snapshot of the conversation's own usage on the current branch. Count assistant-message usage and `task` result usage. Exclude out-of-band `model_usage` records. Tree navigation and branching change the totals with the active branch.

For the branch counters `input`, `cacheWrite`, `cacheRead`, and `output`:

```text
I = input + cacheWrite
C = cacheRead
T = I + C + output
O = output
H = C / (I + C)
```

Each metric publishes nothing when its own data is absent. `cache-hit` also publishes nothing when `I + C` is zero.

Token quantities use decimal units `K`, `M`, `G`, `T`, scaled by 1000. Non-finite or non-positive values render `0`. Values below 1000 render as rounded integers. A scaled value below `99.95` uses one decimal with trailing `.0` removed; otherwise it uses an integer. At `999.5` it promotes to the next available unit, avoiding `1000K`.

`total`, `input`, `cache`, `output`, and `cache-hit` accept `label: compact|word`, default `compact`. Unknown options or invalid values invalidate the entry. `cache-hit` additionally accepts integer `decimalPlaces` from 0 to 2, default 1, and renders exactly that many percentage decimals, including trailing zeroes, followed by `%`.

| Provider | Compact label | Word label | Color |
| --- | --- | --- | --- |
| `total` | `T` | `Total` | `#5fafaf` |
| `input` | `I` | `Input` | `#00afff` |
| `cache` | `C` | `Cache` | `#af87ff` |
| `output` | `O` | `Output` | `#ff5faf` |
| `cache-hit` | `H` | `Hit` | `#8787af` |

A label, one following space, and its quantity share the specified fixed color. Colors are not configurable.

### Turn count

`turn` accepts no option keys; any key invalidates only that entry. It counts successful assistant responses on the current session branch, including responses already present when a session is bound or resumed. Each later successful response advances it once. Failed, interrupted, or pre-model-call stopped requests leave it unchanged. Rewinding or branching can lower the count; switching sessions uses the history of the session now in front.

A positive count renders `Turn`, one space, and the number in `#87d7af`. Emphasize it while a turn runs and dim it between turns. A zero count publishes nothing. A configuration containing only `turn` requires no token or context sampling.

### Context usage

`context` accepts only `mode: percent|absolute`, default `percent`. Unknown options or another mode invalidate the entry. Missing context usage or `contextWindow <= 0` produce no content.

Percent mode shows `ctx ` and the current usage percentage rounded to an integer, followed by `%`. Absolute mode shows only the current token count in the token format above. Do not show the window size.

Prefix the text with the Nerd Font glyph `U+F0068` and one plain space. Render the glyph dimmed in `#5fafaf` and the text in the terminal's default foreground. Glyph and text form one fragment, so a configured separator never splits them. The glyph is static, does not blink, and does not change with usage. There is no missing-glyph fallback.

### Provider API

The public import is `@ruokee/omp-status-bar/provider`. It exports `PROVIDER_CONTRACT_VERSION` with value `1`, `registerProvider`, and the following types. These signatures are the external extension contract, not requirements for internal storage or rendering.

```ts
export type ProviderOptions = Readonly<Record<string, unknown>>;
export type ProviderDescription = Readonly<Record<string, unknown>>;

export interface ProviderSpan {
  text: string;
  color?: `#${string}`;
  dim?: boolean;
}
export interface ProviderFragment {
  spans: readonly ProviderSpan[];
}
export interface ProviderInstanceContext {
  readonly options: ProviderOptions;
  readonly config: ProviderDescription;
  publish(fragment: ProviderFragment): void;
  setInterval(callback: () => void, ms: number): unknown;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimer(timer: unknown): void;
}
export interface ProviderInstance {
  start(): void | Promise<void>;
  stop(): void | Promise<void>;
}
export interface ProviderDefinition {
  readonly id: string;
  readonly contractVersion: 1;
  describe(options: ProviderOptions): ProviderDescription;
  create(context: ProviderInstanceContext): ProviderInstance;
}
export declare function registerProvider(definition: ProviderDefinition): void;
```

Register during extension activation before `session_start`. Registration lasts for the process. Duplicate ids and unsupported versions are rejected, and incompatible definitions are also rejected before instance creation. Third parties cannot take builtin ids. Extensions resolving separate copies of the package still participate in the same process-wide registration set.

For each configuration entry, `describe` validates its options and may throw to reject it. `options` in the instance context is that entry's raw mapping; `config` is exactly the returned description, without interpretation by the status bar. `create` returns an independent lifecycle. Await its `start` and `stop` once each when applicable. Failure during creation or start deactivates and cleans up only that instance.

Providers publish structured fragments through their context. They do not emit separators or call OMP UI methods, and have no widget or theme access through this contract. The status bar handles sanitization, style, composition, and truncation.

Normalize each publication as follows:

- Require an array of spans, each with string `text`.
- Accept an optional color only in case-insensitive `#RRGGBB` form. `dim` defaults to false and, when present, must be boolean. Color and dim apply together; dim without color uses the terminal foreground.
- Strip ANSI and VT escapes, replace C0/C1 controls with spaces, and collapse runs of ASCII spaces.
- Add no spacing between spans. Discard spans whose sanitized text is empty. Trim only the fragment's outermost spaces, retaining spaces at adjacent span boundaries.
- An empty fragment or content that sanitizes away withdraws that instance's prior content. A structurally invalid fragment also clears it and records a bounded diagnostic.
- Later changes to a published object cannot alter the displayed fragment.

Context timers use the host-managed lifecycle. Shutdown clears them and rejects new timers, publications, and late callbacks.

## Invariants

- Work only in UI-capable sessions. A headless session must not replace, sample, unbind, or stop the UI session's data or alter its turn count.
- Metrics and context update while requests run. Shared token readings describe the same observation, without repeated aggregation for each metric. Read context only when a context provider needs it. Third-party-only and turn-only configurations start no builtin sampling.
- Stop the prior session's providers and resources before activating the next session. Shutdown wins over an unfinished start, with no late publication or remount.
- Provider callback, publication, start, and stop failures do not end the OMP session. Diagnose them without unbounded repetition and keep unrelated providers working.
- Changing content does not create duplicate widgets or timers. Releasing the final subscriber releases its sampling resources.
- No compaction settings or speculative-band estimation affect the row.

## Host lower bound

The minimum maintained OMP version is `18.5.0`, with no upper maintenance bound. This is a maintenance commitment, not an installation or runtime gate, and does not certify every later version. An earlier host may run without becoming maintained. Do not retain behavior solely to support earlier hosts. Host dependency declarations do not impose an upper maintenance range.

## Acceptance criteria

- Configuration validity, per-entry isolation, repeated ids, default options, labels, colors, formulas, rounding thresholds, missing data, and branch changes satisfy the contracts above.
- Third-party providers can register through the public import, including a separately resolved package copy. Invalid versions, duplicate ids, invalid fragments, and lifecycle failures remain bounded to their defined scope.
- On a maintained real OMP TUI, the row stays below the editor; token and context readings update during requests; `turn` advances once per successful response, remains unchanged on failures and interruptions, dims between turns, and follows resumed or rewound history.
- In a real terminal, the row survives width changes and truncates from the right within the available columns. It coexists with the native statusline, terminal-title spinner, and subagent cards without flicker or layout shifts. Session switching and shutdown leave no duplicate widgets or timers.
- The static context glyph appears with the prescribed color and spacing when data exists. No compaction setting is read. Headless sessions leave the UI session untouched.
