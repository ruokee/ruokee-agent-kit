/**
 * Shared-sampler tests: the snapshot store owns one interval, scopes
 * subscribe tick listeners, the first subscriber in a scope samples that
 * scope immediately, and every timer tick samples subscribed scopes and
 * notifies their listeners. Timers are simulated; nothing waits on
 * wall-clock time.
 */
import { describe, test, expect } from "bun:test";
import { SnapshotStore, SAMPLE_INTERVAL_MS, type SnapshotSources } from "../src/snapshot.ts";

/** Deterministic timer set: setInterval/clearTimeout over manual ticks. */
class FakeTimers {
  readonly intervals: { callback: () => void; ms: number }[] = [];
  setInterval(callback: () => void, ms: number): unknown {
    const entry = { callback, ms };
    this.intervals.push(entry);
    return entry;
  }
  clearTimeout(timer: unknown): void {
    const at = this.intervals.indexOf(timer as { callback: () => void; ms: number });
    if (at >= 0) {
      this.intervals.splice(at, 1);
    }
  }
  tick(): void {
    for (const entry of [...this.intervals]) {
      entry.callback();
    }
  }
  get count(): number {
    return this.intervals.length;
  }
}

/** Sources recording every usage read; context reads recorded separately. */
function makeSources() {
  const reads: number[] = [];
  const contextReads: number[] = [];
  let usage = { input: 5, cacheWrite: 0, cacheRead: 3, output: 2 };
  const sources: SnapshotSources = {
    getUsageStatistics: () => {
      reads.push(1);
      return usage;
    },
    getContextUsage: () => {
      contextReads.push(1);
      return undefined;
    },
    getModel: () => undefined,
    getCompactionSettings: () => undefined,
  };
  return {
    sources,
    reads,
    contextReads,
    setUsage(next: { input: number; cacheWrite: number; cacheRead: number; output: number }): void {
      usage = next;
    },
  };
}

describe("SnapshotStore sampler ownership", () => {
  test("no subscriber means no interval and no source reads", () => {
    const timers = new FakeTimers();
    const { sources, reads } = makeSources();
    const store = new SnapshotStore();
    store.bind(sources);
    store.attachTimers(timers);
    store.sample();
    expect(reads.length).toBe(0);
    expect(timers.count).toBe(0);
  });

  test("first stats subscription samples immediately and starts exactly one interval", () => {
    const timers = new FakeTimers();
    const { sources, reads } = makeSources();
    const store = new SnapshotStore();
    store.bind(sources);
    store.attachTimers(timers);
    store.retainStats(() => {});
    expect(reads.length).toBe(1);
    expect(timers.count).toBe(1);
    expect(timers.intervals[0]?.ms).toBe(SAMPLE_INTERVAL_MS);

    store.retainStats(() => {});
    expect(timers.count).toBe(1);
    // Adding a same-scope subscriber does not re-read the sources.
    expect(reads.length).toBe(1);
    store.releaseStats(() => {});
    expect(timers.count).toBe(1);
    store.releaseStats(() => {});
    expect(timers.count).toBe(0);
  });

  test("two metric instances of the same scope share the single interval and both get ticks", () => {
    const timers = new FakeTimers();
    const store = new SnapshotStore();
    const { sources, reads, setUsage } = makeSources();
    store.bind(sources);
    store.attachTimers(timers);
    let aTicks = 0;
    let bTicks = 0;
    const tickA = (): void => {
      aTicks++;
    };
    const tickB = (): void => {
      bTicks++;
    };
    store.retainStats(tickA);
    store.retainStats(tickB);
    setUsage({ input: 6, cacheWrite: 0, cacheRead: 3, output: 2 });
    timers.tick();
    // One immediate sample + one tick read; the changed tick notifies both.
    expect(reads.length).toBe(2);
    expect(aTicks).toBe(1);
    expect(bTicks).toBe(1);
    store.releaseStats(tickA);
    setUsage({ input: 7, cacheWrite: 0, cacheRead: 3, output: 2 });
    timers.tick();
    expect(bTicks).toBe(2);
    expect(aTicks).toBe(1);
    store.releaseStats(tickB);
    expect(timers.count).toBe(0);
  });

  test("unchanged stats tick does not notify stats listeners; a changed tick does", () => {
    const timers = new FakeTimers();
    const store = new SnapshotStore();
    const { sources, setUsage } = makeSources();
    store.bind(sources);
    store.attachTimers(timers);
    let ticks = 0;
    store.retainStats(() => {
      ticks++;
    });
    // The immediate sample consumed the initial read; an unchanged tick
    // calls the listener zero times.
    timers.tick();
    timers.tick();
    expect(ticks).toBe(0);
    setUsage({ input: 6, cacheWrite: 0, cacheRead: 3, output: 2 });
    timers.tick();
    expect(ticks).toBe(1);
    store.releaseStats(() => {});
  });

  test("published records are deeply frozen and immune to external mutation", () => {
    const timers = new FakeTimers();
    const store = new SnapshotStore();
    const rawUsage = { input: 5, cacheWrite: 0, cacheRead: 3, output: 2 };
    const rawModel = { provider: "p", id: "m", contextWindow: 8, input: ["a", "b"] };
    const rawCompaction = {
      enabled: true,
      asyncEnabled: false,
      methodOrder: ["x"],
      thresholdTokens: 10,
      thresholdPercent: 20,
      reserveTokens: 30,
      remoteEndpoint: undefined,
    };
    store.bind({
      getUsageStatistics: () => rawUsage,
      getContextUsage: () => ({ tokens: 1, contextWindow: 2, percent: 3 }),
      getModel: () => rawModel,
      getCompactionSettings: () => rawCompaction,
    });
    store.attachTimers(timers);
    store.retainStats(() => {});
    store.retainContext(() => {});
    const snapshot = store.snapshot;
    // Every consumed level is frozen.
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.stats)).toBe(true);
    expect(Object.isFrozen(snapshot.context)).toBe(true);
    const context = snapshot.context;
    if (!context) {
      throw new Error("context missing");
    }
    expect(Object.isFrozen(context.usage)).toBe(true);
    const model = context.model;
    if (!model) {
      throw new Error("model missing");
    }
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.input)).toBe(true);
    expect(Object.isFrozen(context.compaction)).toBe(true);
    expect(Object.isFrozen(context.compaction.methodOrder)).toBe(true);
    // Mutating the raw source objects after publication changes nothing.
    rawUsage.input = 999;
    rawModel.input.push("c");
    rawModel.id = "mutated";
    rawCompaction.methodOrder.push("y");
    rawCompaction.enabled = false;
    const after = store.snapshot;
    expect(after.stats?.input).toBe(5);
    expect(model.id).toBe("m");
    expect(model.input.length).toBe(2);
    expect(context.compaction.methodOrder.length).toBe(1);
    expect(context.compaction.enabled).toBe(true);
    expect(after.context !== undefined && Object.isFrozen(after.context)).toBe(true);
    // The frozen objects refuse writes outright.
    expect(() => {
      (after.stats as { input: number }).input = 1;
    }).toThrow();
    expect(() => {
      (context.compaction as { enabled: boolean }).enabled = false;
    }).toThrow();
    store.releaseStats(() => {});
    store.releaseContext(() => {});
  });

  test("unbind clears the timer surface, error sink, and kills a running interval", () => {
    const timers = new FakeTimers();
    const store = new SnapshotStore();
    let sinkErrors = 0;
    const { sources, setUsage } = makeSources();
    store.bind(sources);
    store.attachTimers(timers);
    store.onSamplerError = () => sinkErrors++;
    store.retainStats(() => {});
    setUsage({ input: 6, cacheWrite: 0, cacheRead: 3, output: 2 });
    // The interval is running with the old surface.
    expect(timers.count).toBe(1);
    store.unbind();
    // The interval was terminated through the old surface and all surfaces
    // are dropped.
    expect(timers.count).toBe(0);
    expect(store.intervalRunning).toBe(false);
    // A post-unbind tick cannot sample (no sources, no timers) and cannot
    // reach the old error sink; the snapshot keeps the last pre-unbind
    // value.
    setUsage({ input: 7, cacheWrite: 0, cacheRead: 3, output: 2 });
    timers.tick();
    expect(sinkErrors).toBe(0);
    expect(store.snapshot.stats?.input).toBe(5);
  });

  test("context scope keeps the interval alive after stats release", () => {
    const timers = new FakeTimers();
    const store = new SnapshotStore();
    const { sources } = makeSources();
    store.bind(sources);
    store.attachTimers(timers);
    store.retainStats(() => {});
    store.retainContext(() => {});
    store.releaseStats(() => {});
    expect(timers.count).toBe(1);
    store.releaseContext(() => {});
    expect(timers.count).toBe(0);
  });

  test("activating context does not re-read usage stats and vice versa", () => {
    const timers = new FakeTimers();
    const store = new SnapshotStore();
    const { sources, reads, contextReads, setUsage } = makeSources();
    store.bind(sources);
    store.attachTimers(timers);
    store.retainStats(() => {});
    const statsReadsAtStart = reads.length;
    store.retainContext(() => {});
    // The context subscription reads only the context scope.
    expect(reads.length).toBe(statsReadsAtStart);
    expect(contextReads.length).toBe(1);
    const contextReadsAtStart = contextReads.length;
    // A stats-only subscriber added to a running store reads only stats.
    store.retainStats(() => {});
    expect(contextReads.length).toBe(contextReadsAtStart);
    setUsage({ input: 6, cacheWrite: 0, cacheRead: 3, output: 2 });
    timers.tick();
    // One tick: exactly one read per active scope. The tick reads both
    // scopes even when the context scope stays unchanged (reads are gated
    // by subscription, not by change).
    expect(reads.length).toBe(statsReadsAtStart + 1);
    expect(contextReads.length).toBe(contextReadsAtStart + 1);
    store.releaseStats(() => {});
    store.releaseStats(() => {});
    const statsReadsAfterRelease = reads.length;
    timers.tick();
    // Stats scope unsubscribed: tick no longer reads usage statistics.
    expect(reads.length).toBe(statsReadsAfterRelease);
    expect(contextReads.length).toBe(contextReadsAtStart + 2);
    store.releaseContext(() => {});
  });

  test("tick notifies context listeners every tick even when the snapshot is unchanged", () => {
    const timers = new FakeTimers();
    const store = new SnapshotStore();
    store.bind({
      getUsageStatistics: () => ({ input: 1, cacheWrite: 0, cacheRead: 0, output: 0 }),
      getContextUsage: () => ({ tokens: 10_000, contextWindow: 100_000, percent: 10 }),
      getModel: () => undefined,
      getCompactionSettings: () => undefined,
    });
    store.attachTimers(timers);
    let contextTicks = 0;
    store.retainContext(() => {
      contextTicks++;
    });
    const snapshotAtStart = store.snapshot;
    timers.tick();
    timers.tick();
    timers.tick();
    // Snapshot identical, listener still notified each tick (blink phase).
    expect(contextTicks).toBe(3);
    expect(store.snapshot).toBe(snapshotAtStart);
    store.releaseContext(() => {
      contextTicks++;
    });
  });

  test("tick calls getUsageStatistics at most once and revision only moves on change", () => {
    const timers = new FakeTimers();
    let usage = { input: 1, cacheWrite: 0, cacheRead: 0, output: 0 };
    const store = new SnapshotStore();
    store.bind({
      getUsageStatistics: () => usage,
      getContextUsage: () => undefined,
      getModel: () => undefined,
      getCompactionSettings: () => undefined,
    });
    store.attachTimers(timers);
    store.retainStats(() => {});
    const first = store.snapshot;
    timers.tick();
    expect(store.snapshot).toBe(first);
    usage = { input: 2, cacheWrite: 0, cacheRead: 0, output: 0 };
    timers.tick();
    expect(store.snapshot.revision).toBe(first.revision + 1);
    expect(store.snapshot.stats?.input).toBe(2);
    store.releaseStats(() => {});
  });

  test("listener exception stays in the sampler and other listeners still run", () => {
    const timers = new FakeTimers();
    const store = new SnapshotStore();
    const { sources, setUsage } = makeSources();
    store.bind(sources);
    store.attachTimers(timers);
    const errors: unknown[] = [];
    store.onSamplerError = (error) => errors.push(error);
    let goodTicks = 0;
    store.retainStats(() => {
      throw new Error("listener boom");
    });
    store.retainStats(() => {
      goodTicks++;
    });
    setUsage({ input: 6, cacheWrite: 0, cacheRead: 3, output: 2 });
    timers.tick();
    expect(goodTicks).toBe(1);
    expect(errors.length).toBe(1);
    // An unchanged tick notifies no stats listener, so no new error lands.
    timers.tick();
    expect(goodTicks).toBe(1);
    expect(errors.length).toBe(1);
    store.releaseStats(() => {});
    store.releaseStats(() => {});
  });

  test("source getter exception stays in the sampler and skips that scope", () => {
    const timers = new FakeTimers();
    const store = new SnapshotStore();
    const errors: unknown[] = [];
    store.onSamplerError = (error) => errors.push(error);
    let ticks = 0;
    store.bind({
      getUsageStatistics: () => {
        throw new Error("stats boom");
      },
      getContextUsage: () => undefined,
      getModel: () => undefined,
      getCompactionSettings: () => undefined,
    });
    store.attachTimers(timers);
    store.retainStats(() => {
      ticks++;
    });
    const revision = store.snapshot.revision;
    timers.tick();
    // The failing scope keeps its previous snapshot and its revision; the
    // error lands in the sink. A failed read is not a change, so the stats
    // listeners are not notified for this tick.
    expect(ticks).toBe(0);
    // One error from the immediate subscription sample, one from the tick.
    expect(errors.length).toBe(2);
    expect(store.snapshot.revision).toBe(revision);
    store.releaseStats(() => {});
  });

  test("snapshot is frozen and owned: caller mutation cannot change it", () => {
    const store = new SnapshotStore();
    const settings = {
      enabled: true,
      asyncEnabled: false,
      methodOrder: ["a"],
      thresholdTokens: 100,
      thresholdPercent: 50,
      reserveTokens: 10,
      remoteEndpoint: "x",
    };
    store.bind({
      getUsageStatistics: () => ({ input: 1, cacheWrite: 0, cacheRead: 0, output: 0 }),
      getContextUsage: () => ({ tokens: 10, contextWindow: 100, percent: 10 }),
      getModel: () => ({ provider: "p", id: "m", contextWindow: 100, input: ["text"] }),
      getCompactionSettings: () => settings,
    });
    store.retainContext(() => {});
    const snapshot = store.snapshot;
    expect(snapshot.context?.model?.input).toEqual(["text"]);
    // Mutating the source after publication changes nothing the store holds.
    (settings.methodOrder as string[]).push("b");
    expect(snapshot.context?.compaction?.methodOrder).toEqual(["a"]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    store.releaseContext(() => {});
  });

  test("unbind makes ticks no-ops", () => {
    const timers = new FakeTimers();
    const { sources, reads } = makeSources();
    const store = new SnapshotStore();
    store.bind(sources);
    store.attachTimers(timers);
    store.retainStats(() => {});
    const readsAfterStart = reads.length;
    store.unbind();
    timers.tick();
    expect(reads.length).toBe(readsAfterStart);
    store.releaseStats(() => {});
  });
});
