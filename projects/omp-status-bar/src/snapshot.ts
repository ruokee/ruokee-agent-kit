/**
 * Internal snapshot store shared by the bundled metric providers.
 *
 * The store owns the shared 600 ms sampler for every built-in provider:
 * the first subscription samples immediately and starts one OMP-managed
 * interval; the last release clears it. Source access is gated:
 *
 * - Token metrics (`total`, `input`, `cache`, `output`, `cache-hit`) share a
 *   subscription count; with at least one subscriber, each tick calls
 *   `getUsageStatistics()` at most once.
 * - The `context` metric subscribes separately; with a subscriber, each tick
 *   reads `getContextUsage()`, the model, and the compaction settings group.
 *
 * With no subscribers the sampler calls nothing. Revision increases only
 * when a consumed field actually changes, so equal snapshots keep the
 * revision stable and providers suppress equal fragments.
 *
 * Every snapshot is package-owned: all consumed fields are copied into new
 * frozen records, so a caller mutating a settings or model object after
 * publication cannot change the active snapshot without a new sample.
 */

/** Usage statistics the Host cares about; mirrors OMP's `UsageStatistics` fields in scope. */
export interface UsageStats {
  readonly input: number;
  readonly cacheWrite: number;
  readonly cacheRead: number;
  readonly output: number;
}

/** Live context and model state the context provider reads. */
export interface ContextSample {
  readonly usage: Readonly<{ tokens: number; contextWindow: number; percent: number }> | undefined;
  readonly model:
    Readonly<{ provider: string; id: string; contextWindow: number | null; input: readonly string[] }> | undefined;
  readonly compaction: CompactionSettingsShape;
}

/** One immutable snapshot. */
export interface StatusBarSnapshot {
  readonly revision: number;
  readonly stats: UsageStats | undefined;
  readonly context: ContextSample | undefined;
}

/** The compaction settings subset the sampler consumes. */
export interface CompactionSettingsShape {
  readonly enabled: boolean;
  readonly asyncEnabled: boolean;
  readonly methodOrder: readonly unknown[];
  readonly thresholdTokens: number;
  readonly thresholdPercent: number;
  readonly reserveTokens: number | undefined;
  readonly remoteEndpoint: string | undefined;
}

/** Live context usage shape from OMP. */
export interface ContextUsageSample {
  tokens: number;
  contextWindow: number;
  percent: number;
}

/** Live model shape the sampler copies from. */
export interface ModelSample {
  provider: string;
  id: string;
  contextWindow: number | null;
  input: readonly string[];
}

/** Session sources the sampler reads; the extension binds these to the live ctx. */
export interface SnapshotSources {
  getUsageStatistics(): UsageStats;
  getContextUsage(): ContextUsageSample | undefined;
  getModel(): ModelSample | undefined;
  getCompactionSettings(): Partial<CompactionSettingsShape> | undefined;
}

/** Compaction group used when the settings read fails or omits fields: speculation off. */
export const FALLBACK_COMPACTION: CompactionSettingsShape = Object.freeze({
  enabled: false,
  asyncEnabled: false,
  methodOrder: Object.freeze([]) as readonly unknown[],
  thresholdTokens: 0,
  thresholdPercent: 0,
  reserveTokens: undefined,
  remoteEndpoint: undefined,
});

/** Normalize a raw counter to a finite, non-negative number; invalid becomes zero. */
function normalizeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Copy a context record with every consumed nested value, then freeze the
 * whole record: the returned `context` object itself is frozen, not just
 * its fields, so no nested slot can be replaced after publication.
 */
function freezeContext(context: ContextSample): ContextSample {
  const usage =
    context.usage === undefined
      ? undefined
      : Object.freeze({
          tokens: context.usage.tokens,
          contextWindow: context.usage.contextWindow,
          percent: context.usage.percent,
        });
  const model =
    context.model === undefined
      ? undefined
      : Object.freeze({
          provider: context.model.provider,
          id: context.model.id,
          contextWindow: context.model.contextWindow,
          input: Object.freeze([...context.model.input]),
        });
  const compaction = Object.freeze({
    enabled: context.compaction.enabled,
    asyncEnabled: context.compaction.asyncEnabled,
    methodOrder: Object.freeze([...context.compaction.methodOrder]),
    thresholdTokens: context.compaction.thresholdTokens,
    thresholdPercent: context.compaction.thresholdPercent,
    reserveTokens: context.compaction.reserveTokens,
    remoteEndpoint: context.compaction.remoteEndpoint,
  });
  return Object.freeze({ usage, model, compaction });
}

/** Timer surface the store needs; satisfied by the Host environment. */
export interface SamplerTimers {
  setInterval(callback: () => void, ms: number): unknown;
  clearTimeout(timer: unknown): void;
}

/** Shared sampling cadence for all built-in providers; internal, not configurable. */
export const SAMPLE_INTERVAL_MS = 600;

export class SnapshotStore {
  #sources: SnapshotSources | undefined;
  #statsSubscribers = 0;
  #contextSubscribers = 0;
  readonly #statsListeners = new Set<() => void>();
  readonly #contextListeners = new Set<() => void>();
  #revision = 0;
  #snapshot: StatusBarSnapshot = Object.freeze({ revision: 0, stats: undefined, context: undefined });
  #timers: SamplerTimers | undefined;
  #interval: unknown;
  /** Optional sink for listener failures; keeps listener errors bounded. */
  onSamplerError: ((error: unknown) => void) | undefined = undefined;

  /** Bind the live session sources; called once per session start. */
  bind(sources: SnapshotSources): void {
    this.#sources = sources;
  }

  /**
   * Release everything session-bound at shutdown: the sources, the timer
   * surface, the error sink, and any still-running interval. After this a
   * later tick cannot reach the old Host's environment or diagnostics —
   * a next session binds its own surfaces through bind/attachTimers.
   */
  unbind(): void {
    this.#sources = undefined;
    if (this.#interval !== undefined) {
      this.#timers?.clearTimeout(this.#interval);
      this.#interval = undefined;
    }
    this.#timers = undefined;
    this.onSamplerError = undefined;
  }

  /** Attach the timer surface used for the shared interval (Host-provided). */
  attachTimers(timers: SamplerTimers): void {
    this.#timers = timers;
  }

  /**
   * Subscribe one token-metric instance. The first stats subscriber samples
   * the stats scope immediately and starts the shared interval; later
   * subscribers only get the existing cadence.
   */
  retainStats(listener: () => void): void {
    const first = this.#statsSubscribers === 0;
    this.#statsListeners.add(listener);
    this.#statsSubscribers++;
    if (first) {
      // Only the newly activated scope is read; an already-running interval
      // or an active context scope is not re-read here.
      this.#sampleScope("stats");
      this.#ensureStarted();
    }
  }

  /** Unsubscribe one token-metric instance. The last release clears the interval. */
  releaseStats(listener: () => void): void {
    this.#statsListeners.delete(listener);
    this.#statsSubscribers = Math.max(0, this.#statsSubscribers - 1);
    this.#maybeStop();
  }

  /**
   * Subscribe the context provider instance. The first context subscriber
   * samples the context scope immediately and starts the shared interval.
   */
  retainContext(listener: () => void): void {
    const first = this.#contextSubscribers === 0;
    this.#contextListeners.add(listener);
    this.#contextSubscribers++;
    if (first) {
      this.#sampleScope("context");
      this.#ensureStarted();
    }
  }

  /** Unsubscribe the context provider instance. */
  releaseContext(listener: () => void): void {
    this.#contextListeners.delete(listener);
    this.#contextSubscribers = Math.max(0, this.#contextSubscribers - 1);
    this.#maybeStop();
  }

  get statsSubscribed(): boolean {
    return this.#statsSubscribers > 0;
  }

  get contextSubscribed(): boolean {
    return this.#contextSubscribers > 0;
  }

  get intervalRunning(): boolean {
    return this.#interval !== undefined;
  }

  /** Current immutable snapshot. */
  get snapshot(): StatusBarSnapshot {
    return this.#snapshot;
  }

  #ensureStarted(): void {
    if (this.#interval !== undefined || this.#timers === undefined) {
      return;
    }
    // One interval for every subscribed scope; the callback samples each
    // active scope and notifies that scope's listeners.
    this.#interval = this.#timers.setInterval(() => this.#tick(), SAMPLE_INTERVAL_MS);
  }

  #maybeStop(): void {
    if (this.#statsSubscribers > 0 || this.#contextSubscribers > 0 || this.#interval === undefined) {
      return;
    }
    this.#timers?.clearTimeout(this.#interval);
    this.#interval = undefined;
  }

  /**
   * One sampler tick: sample every subscribed scope once, then notify that
   * scope's listeners. Stats listeners are called only when the stats
   * fields changed — no churn for equal reads; context listeners are called
   * every tick even when the snapshot did not change, so the blink phase
   * advances (providers still dedupe by normalized fragment). Listener
   * exceptions and source getter exceptions stay inside this boundary.
   */
  #tick(): void {
    const statsChanged = this.#sampleScope("stats");
    this.#sampleScope("context");
    if (statsChanged) {
      for (const listener of this.#statsListeners) {
        this.#notify(listener);
      }
    }
    // The context scope notifies unconditionally: its blink phase advances
    // on the shared cadence, not on data changes.
    for (const listener of this.#contextListeners) {
      this.#notify(listener);
    }
  }

  #notify(listener: () => void): void {
    try {
      listener();
    } catch (error) {
      this.onSamplerError?.(error);
    }
  }

  /**
   * Sample one scope's sources once; returns whether a consumed field
   * changed. With no subscribers in the scope this calls nothing, so an
   * inactive scope keeps its previous owned value and stays free of source
   * reads. When both scopes are active, one call adds exactly one read per
   * scope: activating the context scope never re-reads usage statistics and
   * vice versa.
   *
   * Allocation is lazy: primitives are normalized and compared first, and
   * the frozen record is only built when something actually changed.
   */
  #sampleScope(scope: "stats" | "context"): boolean {
    const sources = this.#sources;
    if (!sources) {
      return false;
    }
    if (scope === "stats") {
      if (this.#statsSubscribers === 0) {
        return false;
      }
      let raw: UsageStats;
      try {
        // One call per tick feeds every token metric.
        raw = sources.getUsageStatistics();
      } catch (error) {
        this.onSamplerError?.(error);
        return false;
      }
      // Compare normalized primitives against the active record before
      // allocating anything.
      const input = normalizeCount(raw.input);
      const cacheWrite = normalizeCount(raw.cacheWrite);
      const cacheRead = normalizeCount(raw.cacheRead);
      const output = normalizeCount(raw.output);
      const old = this.#snapshot.stats;
      if (
        old !== undefined &&
        old.input === input &&
        old.cacheWrite === cacheWrite &&
        old.cacheRead === cacheRead &&
        old.output === output
      ) {
        return false;
      }
      const stats = Object.freeze({ input, cacheWrite, cacheRead, output });
      this.#revision++;
      this.#snapshot = Object.freeze({
        revision: this.#revision,
        stats,
        context: this.#snapshot.context,
      });
      return true;
    }
    if (this.#contextSubscribers === 0) {
      return false;
    }
    try {
      const compactionRaw = sources.getCompactionSettings();
      const usage = sources.getContextUsage();
      const model = sources.getModel();
      const old = this.#snapshot.context;
      // Compare raw primitives against the old record before copying.
      if (old !== undefined && contextUnchanged(old, compactionRaw, usage, model)) {
        return false;
      }
      const context = freezeContext({
        usage,
        model,
        compaction:
          compactionRaw === undefined
            ? FALLBACK_COMPACTION
            : {
                enabled: compactionRaw.enabled ?? false,
                asyncEnabled: compactionRaw.asyncEnabled ?? false,
                methodOrder: compactionRaw.methodOrder ?? EMPTY_METHOD_ORDER,
                thresholdTokens: compactionRaw.thresholdTokens ?? 0,
                thresholdPercent: compactionRaw.thresholdPercent ?? 0,
                reserveTokens: compactionRaw.reserveTokens,
                remoteEndpoint: compactionRaw.remoteEndpoint,
              },
      });
      this.#revision++;
      this.#snapshot = Object.freeze({
        revision: this.#revision,
        stats: this.#snapshot.stats,
        context,
      });
      return true;
    } catch (error) {
      this.onSamplerError?.(error);
      return false;
    }
  }

  /**
   * Test seam: sample the subscribed scopes without a timer tick. Production
   * sampling happens only through the interval callback; this method exists
   * for direct store tests.
   */
  sample(): StatusBarSnapshot {
    this.#sampleScope("stats");
    this.#sampleScope("context");
    return this.#snapshot;
  }
}

/** Shared frozen empty array: no allocation when the settings omit the field. */
const EMPTY_METHOD_ORDER: readonly unknown[] = Object.freeze([]);

/**
 * Compare the raw context source reads against the active record using only
 * primitives and array contents; no allocation. A false here means at least
 * one consumed field differs, so the record must be rebuilt.
 */
function contextUnchanged(
  old: ContextSample,
  compactionRaw: Partial<CompactionSettingsShape> | undefined,
  usage: ContextUsageSample | undefined,
  model: ModelSample | undefined,
): boolean {
  const enabled = compactionRaw?.enabled ?? false;
  const asyncEnabled = compactionRaw?.asyncEnabled ?? false;
  const methodOrder = compactionRaw?.methodOrder ?? EMPTY_METHOD_ORDER;
  const thresholdTokens = compactionRaw?.thresholdTokens ?? 0;
  const thresholdPercent = compactionRaw?.thresholdPercent ?? 0;
  const reserveTokens = compactionRaw?.reserveTokens;
  const remoteEndpoint = compactionRaw?.remoteEndpoint;
  const compaction = old.compaction;
  if (
    compaction.enabled !== enabled ||
    compaction.asyncEnabled !== asyncEnabled ||
    compaction.thresholdTokens !== thresholdTokens ||
    compaction.thresholdPercent !== thresholdPercent ||
    compaction.reserveTokens !== reserveTokens ||
    compaction.remoteEndpoint !== remoteEndpoint ||
    compaction.methodOrder.length !== methodOrder.length ||
    !compaction.methodOrder.every((value, index) => value === methodOrder[index])
  ) {
    return false;
  }
  if (usage === undefined) {
    if (old.usage !== undefined) {
      return false;
    }
  } else {
    if (
      old.usage === undefined ||
      old.usage.tokens !== usage.tokens ||
      old.usage.contextWindow !== usage.contextWindow ||
      old.usage.percent !== usage.percent
    ) {
      return false;
    }
  }
  if (model === undefined) {
    if (old.model !== undefined) {
      return false;
    }
  } else {
    if (
      old.model === undefined ||
      old.model.provider !== model.provider ||
      old.model.id !== model.id ||
      old.model.contextWindow !== model.contextWindow ||
      old.model.input.length !== model.input.length ||
      !old.model.input.every((value, index) => value === model.input[index])
    ) {
      return false;
    }
  }
  return true;
}
