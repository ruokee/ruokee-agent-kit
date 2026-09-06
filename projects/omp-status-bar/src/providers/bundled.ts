/**
 * First-party providers bundled with the status bar Host.
 *
 * All six read the session-scoped shared snapshot (`src/snapshot.ts`), so one
 * 600 ms sampler feeds every instance and `getUsageStatistics()` is called at
 * most once per tick. Providers never touch OMP UI; they publish structured
 * fragments only.
 *
 * Token metrics (`total`, `input`, `cache`, `output`, `cache-hit`) share the
 * TICO accounting:
 *
 *   I = input + cacheWrite, C = cacheRead, O = output, T = I + C + O
 *
 * The `context` provider renders context usage plus the speculation-band
 * indicator state machine.
 */

import type { ProviderDefinition, ProviderFragment, ProviderInstanceContext, ProviderSpan } from "../provider-api.ts";
import { registerProvider } from "../provider-api.ts";
import { getProviderRegistry } from "../registry.ts";
import { formatTokenCount } from "../format.ts";
import { composeContextFragment } from "../context-fragment.ts";
import { getSnapshotStore } from "../snapshot-store.ts";
import type { SnapshotStore } from "../snapshot.ts";
import { SpeculationMachine, type SpeculationState } from "../speculation.ts";

/** Colors are fixed per provider; not user-configurable. */
const COLORS = {
  total: "#5fafaf",
  input: "#00afff",
  cache: "#8787af",
  output: "#ff5faf",
  cacheHit: "#8787af",
} as const;

/** Label text per metric and label mode. */
const LABELS = {
  compact: { total: "T", input: "I", cache: "C", output: "O", cacheHit: "H" },
  word: { total: "Total", input: "Input", cache: "Cache", output: "Output", cacheHit: "Hit" },
} as const;

type LabelMode = keyof typeof LABELS;
type MetricKey = keyof (typeof LABELS)["compact"];

/**
 * Reject any option key outside the allowlist; a provider accepting only
 * its documented keys keeps typos from being silently ignored.
 */
function rejectUnknownOptions(options: Record<string, unknown>, allowed: readonly string[]): void {
  const unknown = Object.keys(options).find((key) => !allowed.includes(key));
  if (unknown !== undefined) {
    throw new Error(`unknown option ${JSON.stringify(unknown)}; accepted: ${allowed.join(", ")}`);
  }
}

/** Read and validate the `label` option; anything else invalidates the entry. */
function readLabel(options: Record<string, unknown>): LabelMode {
  rejectUnknownOptions(options, ["label"]);
  const raw = options.label;
  if (raw === undefined) {
    return "compact";
  }
  if (raw !== "compact" && raw !== "word") {
    throw new Error("`label` must be `compact` or `word`");
  }
  return raw;
}

/**
 * Shared instance behavior: subscribe a tick listener to the snapshot
 * store's scope and publish. The first subscriber in a scope samples that
 * scope immediately (so content appears at once), and every sampler tick
 * calls the listener; context listeners are called every tick even when the
 * snapshot did not change, so the blink phase advances. The listener still
 * dedupes by normalized fragment before publishing.
 */
function makeTickerInstance(
  context: ProviderInstanceContext,
  store: SnapshotStore,
  scope: "stats" | "context",
  render: () => ProviderFragment | undefined,
): { start: () => void; stop: () => void } {
  let last: readonly ProviderSpan[] | undefined;
  const publish = (): void => {
    const fragment = render();
    const next = fragment === undefined ? [] : fragment.spans;
    if (last !== undefined && sameSpans(last, next)) {
      return;
    }
    last = next;
    context.publish({ spans: next });
  };
  return {
    start: () => {
      if (scope === "stats") {
        store.retainStats(publish);
      } else {
        store.retainContext(publish);
      }
      // Content appears without waiting for the first tick: either this
      // subscription just sampled its scope, or the scope already holds data.
      publish();
    },
    stop: () => {
      if (scope === "stats") {
        store.releaseStats(publish);
      } else {
        store.releaseContext(publish);
      }
    },
  };
}

/** Structural span equality; no JSON in the update hot path. */
function sameSpans(a: readonly ProviderSpan[], b: readonly ProviderSpan[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((span, index) => {
    const other = b[index];
    return other !== undefined && span.text === other.text && span.color === other.color && span.dim === other.dim;
  });
}

/** One span "label value"; label, space, and value share one color. */
function metricSpan(label: string, value: string, colorKey: keyof typeof COLORS): ProviderSpan {
  const color: `#${string}` = COLORS[colorKey];
  return { text: `${label} ${value}`, color };
}

/** Build the five token-metric providers from a metric key. */
function tokenMetricProvider(metric: "total" | "input" | "cache" | "output" | "cache-hit"): ProviderDefinition {
  return {
    id: metric,
    contractVersion: 1,
    describe: (options) => ({ label: readLabel(options as Record<string, unknown>) }),
    create: (context) => {
      const store = getSnapshotStore();
      return makeTickerInstance(context, store, "stats", () => {
        const stats = store.snapshot.stats;
        if (stats === undefined) {
          return undefined;
        }
        const labelMode = (context.config.label as LabelMode) ?? "compact";
        const input = stats.input + stats.cacheWrite;
        const cacheRead = stats.cacheRead;
        const output = stats.output;
        const total = input + cacheRead + output;
        if (total <= 0) {
          return { spans: [] };
        }
        // cache-hit (H): percentage of cacheRead over I + C; hidden while the
        // denominator is zero even when other metrics are visible.
        if (metric === "cache-hit") {
          const denominator = input + cacheRead;
          if (denominator <= 0) {
            return { spans: [] };
          }
          const hit = Math.round((100 * cacheRead) / denominator);
          return { spans: [metricSpan(LABELS[labelMode].cacheHit, `${hit}%`, "cacheHit")] };
        }
        const value = metric === "total" ? total : metric === "input" ? input : metric === "cache" ? cacheRead : output;
        return { spans: [metricSpan(LABELS[labelMode][metric], formatTokenCount(value), metric)] };
      });
    },
  };
}

/** Context provider: usage text plus speculation-band indicator glyph. */
const contextProvider: ProviderDefinition = {
  id: "context",
  contractVersion: 1,
  describe: (options) => {
    const opts = options as Record<string, unknown>;
    rejectUnknownOptions(opts, ["mode"]);
    const mode = opts.mode ?? "percent";
    if (mode !== "percent" && mode !== "absolute") {
      throw new Error("`mode` must be `percent` or `absolute`");
    }
    return { mode };
  },
  create: (context) => {
    const store = getSnapshotStore();
    const machine = new SpeculationMachine();
    let blinkPhase = false;
    let lastState: SpeculationState = "hidden";
    return makeTickerInstance(context, store, "context", () => {
      const snap = store.snapshot;
      if (snap.context === undefined) {
        machine.reset();
        lastState = "hidden";
        return undefined;
      }
      const { usage, model, compaction } = snap.context;
      const state = machine.evaluate({ usage, model, compaction });
      // Entering `indicating` always starts lit; each subsequent tick in
      // that state flips the frame. Phase flips are fragment changes, so
      // the publish dedupe passes them through.
      if (state === "indicating") {
        if (lastState !== "indicating") {
          blinkPhase = true;
        } else {
          blinkPhase = !blinkPhase;
        }
      }
      lastState = state;
      return composeContextFragment(usage, (context.config.mode as string) ?? "percent", state, blinkPhase);
    });
  },
};

export const BUILTIN_PROVIDERS: readonly ProviderDefinition[] = [
  tokenMetricProvider("total"),
  tokenMetricProvider("input"),
  tokenMetricProvider("cache"),
  tokenMetricProvider("output"),
  tokenMetricProvider("cache-hit"),
  contextProvider,
];

/**
 * Register all six builtin providers atomically: every id is preflighted
 * against the registry before anything is registered, so a single conflict
 * (a third party already claimed a builtin id) leaves no partial batch and
 * no builtin overrides third-party content.
 */
export function registerBuiltinProviders(): void {
  const registry = getProviderRegistry();
  for (const definition of BUILTIN_PROVIDERS) {
    if (registry.get(definition.id) !== undefined) {
      throw new Error(`Cannot register built-in provider "${definition.id}": the id is already registered`);
    }
  }
  for (const definition of BUILTIN_PROVIDERS) {
    registerProvider(definition);
  }
}
