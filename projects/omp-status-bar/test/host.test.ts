/**
 * Host lifecycle behavior tests: mount sequencing, factory parameter
 * capture, one-time unmount, dedupe, and failure containment — all through
 * the public Host surface with a scripted environment.
 */
import { describe, test, expect } from "bun:test";
import { StatusBarHost, type HostEnvironment, type WidgetTheme } from "../src/host.ts";
import type { StatusBarWidgetComponent } from "../src/widget.ts";
import { registerProvider } from "../src/provider-api.ts";
import { resetProviderRegistryForTests } from "../src/registry.ts";
import { getSnapshotStore, resetSnapshotStoreForTests } from "../src/snapshot-store.ts";

interface TimerEntry {
  callback: () => void;
  ms: number;
  cleared: boolean;
}

/** Scripted environment recording widget and timer operations. */
function makeEnvironment(over: Partial<HostEnvironment> = {}) {
  const timers = new Map<unknown, TimerEntry>();
  let nextId = 1;
  const widgets: {
    key: string;
    factory: HostEnvironment["setWidget"] extends (k: string, f: infer F, ...a: never) => void ? F : never;
    options: unknown;
  }[] = [];
  const unsetKeys: string[] = [];
  const rendered: unknown[] = [];
  let tui: object | undefined = {
    marker: "tui",
    requestComponentRender: (component: unknown) => {
      rendered.push(component);
    },
  };
  let theme: WidgetTheme = { fg: (color: string, text: string) => (color === "dim" ? `\x1b[2m${text}\x1b[22m` : text) };
  const env = {
    hasUI: true,
    timers,
    widgets,
    unsetKeys,
    rendered,
    getTui: () => tui,
    getTheme: () => theme,
    setWidget(key: string, factory: never, options: unknown) {
      widgets.push({ key, factory, options });
    },
    unsetWidget(key: string) {
      unsetKeys.push(key);
    },
    setInterval(callback: () => void, ms: number) {
      const id = { id: nextId++ };
      timers.set(id, { callback, ms, cleared: false });
      return id;
    },
    setTimeout(callback: () => void, ms: number) {
      const id = { id: nextId++ };
      timers.set(id, { callback, ms, cleared: false });
      return id;
    },
    clearTimer(timer: unknown) {
      const entry = timers.get(timer);
      if (entry) entry.cleared = true;
    },
    ...over,
  };
  return env as typeof env & { rendered: unknown[] };
}

type TestEnv = ReturnType<typeof makeEnvironment>;

const DIAG = () => {
  const sink: string[] = [];
  return { sink, onDiagnostic: (m: string) => sink.push(m) };
};

function makeHost(env: TestEnv, reader: () => Promise<unknown>, diagnostics: (m: string) => void): StatusBarHost {
  return new StatusBarHost({
    environment: env,
    getAgentDir: () => "/agent",
    joinPath: (a, b) => `${a}/${b}`,
    onDiagnostic: diagnostics,
    configReader: reader as never,
  });
}

const SIMPLE_CONFIG = () => ({
  config: { version: 1, separator: "slash", statuses: [{ id: "test.pass", options: {}, sourceIndex: 0 }] },
  problems: [],
});

/** Register the happy-path provider; every test resets the registry first. */
function registerPass(): void {
  registerProvider({
    contractVersion: 1,
    id: "test.pass",
    describe: () => ({}),
    create(context) {
      return {
        start: () => context.publish({ spans: [{ text: "hello" }] }),
        stop: () => {},
      };
    },
  });
}

/** Register a provider whose start fails; each call needs a fresh id. */
function registerFailing(id: string): void {
  registerProvider({
    contractVersion: 1,
    id,
    describe: () => ({}),
    create: () => ({
      start: () => {
        throw new Error("boom");
      },
      stop: () => {},
    }),
  });
}

describe("StatusBarHost lifecycle", () => {
  test("headless session never registers a widget", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    const env = makeEnvironment({ hasUI: false });
    const { sink, onDiagnostic } = DIAG();
    const host = makeHost(env, async () => ({ missing: true }), onDiagnostic);
    await host.start();
    await host.shutdown();
    expect(env.widgets.length).toBe(0);
    expect(env.unsetKeys.length).toBe(0);
    expect(sink).toEqual([]);
  });

  test("widget mounts only after a successful start, not before", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    registerPass();
    const env = makeEnvironment();
    const host = makeHost(
      env,
      async () => SIMPLE_CONFIG(),
      () => {},
    );
    await host.start();
    expect(env.widgets.length).toBe(1);
    expect(env.widgets[0]?.key).toBe("ruokee.omp-status-bar");
    expect(env.widgets[0]?.options).toEqual({ placement: "belowEditor" });
    await host.shutdown();
  });

  test("factory receives tui and theme and initializes with current content", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    registerPass();
    registerProvider({
      contractVersion: 1,
      id: "test.second",
      describe: () => ({}),
      create: (context) => ({
        start: () => context.publish({ spans: [{ text: "world" }] }),
        stop: () => {},
      }),
    });
    const env = makeEnvironment();
    const host = makeHost(
      env,
      async () => ({
        config: {
          version: 1,
          separator: "slash",
          statuses: [
            { id: "test.pass", options: {}, sourceIndex: 0 },
            { id: "test.second", options: {}, sourceIndex: 1 },
          ],
        },
        problems: [],
      }),
      () => {},
    );
    await host.start();
    const registration = env.widgets[0];
    expect(registration).toBeDefined();
    // The Host's factory must pass the real tui/theme through; record what
    // OMP (here the test) handed over.
    const theme = env.getTheme();
    const component = registration!.factory(env.getTui(), theme) as StatusBarWidgetComponent;
    // The providers published on start; the late-created component still
    // shows both fragments joined by the themed dim separator.
    const rows = component.render(80);
    expect(rows.length).toBe(1);
    expect(rows[0]).toContain("hello");
    expect(rows[0]).toContain("world");
    // The separator text went through the theme's public `fg` channel and
    // the theme's own escape codes are kept verbatim.
    expect(rows[0]).toContain("\x1b[2m / \x1b[22m");
    await host.shutdown();
  });

  test("fragment update repaints via requestComponentRender without re-mount", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    let publishMore: (() => void) | undefined;
    registerProvider({
      contractVersion: 1,
      id: "test.dynamic",
      describe: () => ({}),
      create: (context) => ({
        start: () => {
          context.publish({ spans: [{ text: "first" }] });
          publishMore = () => context.publish({ spans: [{ text: "second" }] });
        },
        stop: () => {},
      }),
    });
    const env = makeEnvironment();
    const host = makeHost(
      env,
      async () => ({
        config: { version: 1, separator: "slash", statuses: [{ id: "test.dynamic", options: {}, sourceIndex: 0 }] },
        problems: [],
      }),
      () => {},
    );
    await host.start();
    expect(env.widgets.length).toBe(1);
    const component = env.widgets[0]!.factory(env.getTui(), env.getTheme()) as StatusBarWidgetComponent;
    const mountsBefore = env.widgets.length;
    publishMore!();
    expect(env.widgets.length).toBe(mountsBefore); // no re-mount
    expect(env.rendered.length).toBeGreaterThan(0);
    expect(env.rendered.at(-1)).toBe(component);
    expect(component.render(80).join("")).toContain("second");
    await host.shutdown();
  });

  test("equal fragments do not trigger renders", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    let republish: (() => void) | undefined;
    registerProvider({
      contractVersion: 1,
      id: "test.dedupe",
      describe: () => ({}),
      create: (context) => ({
        start: () => {
          context.publish({ spans: [{ text: "same" }] });
          republish = () => context.publish({ spans: [{ text: "same" }] });
        },
        stop: () => {},
      }),
    });
    const env = makeEnvironment();
    const host = makeHost(
      env,
      async () => ({
        config: { version: 1, separator: "slash", statuses: [{ id: "test.dedupe", options: {}, sourceIndex: 0 }] },
        problems: [],
      }),
      () => {},
    );
    await host.start();
    const component = env.widgets[0]!.factory(env.getTui(), env.getTheme()) as StatusBarWidgetComponent;
    const rendersBefore = env.rendered.length;
    republish!();
    expect(env.rendered.length).toBe(rendersBefore);
    expect(component.render(80).join("")).toContain("same");
    await host.shutdown();
  });

  test("all entries failing never mounts the widget", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    registerFailing("test.boom");
    const env = makeEnvironment();
    const { onDiagnostic } = DIAG();
    const host = makeHost(
      env,
      async () => ({
        config: { version: 1, separator: "slash", statuses: [{ id: "test.boom", options: {}, sourceIndex: 0 }] },
        problems: [],
      }),
      onDiagnostic,
    );
    await host.start();
    expect(env.widgets.length).toBe(0);
    await host.shutdown();
    expect(env.unsetKeys.length).toBe(0);
  });

  test("shutdown unmounts exactly once after stopping instances", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    let stopCalls = 0;
    registerProvider({
      contractVersion: 1,
      id: "test.stopcount",
      describe: () => ({}),
      create: () => ({
        start: () => {},
        stop: () => {
          stopCalls++;
        },
      }),
    });
    const env = makeEnvironment();
    const host = makeHost(
      env,
      async () => ({
        config: { version: 1, separator: "slash", statuses: [{ id: "test.stopcount", options: {}, sourceIndex: 0 }] },
        problems: [],
      }),
      () => {},
    );
    await host.start();
    await host.shutdown();
    await host.shutdown(); // idempotent
    expect(stopCalls).toBe(1);
    expect(env.unsetKeys).toEqual(["ruokee.omp-status-bar"]);
  });

  test("start-shutdown race abandons the flow without touching widgets", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    registerPass();
    const env = makeEnvironment();
    const host = makeHost(
      env,
      async () => SIMPLE_CONFIG(),
      () => {},
    );
    // Shutdown wins the race before start proceeds past the config read.
    const started = host.start();
    await host.shutdown();
    await started;
    expect(env.widgets.length).toBe(0);
  });

  test("shutdown starts provider stops before reclaiming timers and unmounts last", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    const events: string[] = [];
    registerProvider({
      id: "test.ordered",
      contractVersion: 1,
      describe: () => ({}),
      create: (ctx) => ({
        start() {
          events.push("start");
          // One managed interval so timer reclamation is observable.
          ctx.setInterval(() => {}, 1000);
        },
        async stop() {
          events.push("stop-started");
          await new Promise((resolve) => setTimeout(resolve, 0));
          events.push("stop-finished");
        },
      }),
    });
    const env = makeEnvironment();
    const host = makeHost(
      env,
      async () => ({
        config: { version: 1, separator: "slash", statuses: [{ id: "test.ordered", options: {}, sourceIndex: 0 }] },
        problems: [],
      }),
      () => {},
    );
    await host.start();
    events.length = 0;
    const rawClear = env.clearTimer.bind(env);
    env.clearTimer = (timer: unknown) => {
      events.push("clearTimer");
      rawClear(timer);
    };
    const rawUnset = env.unsetWidget.bind(env);
    env.unsetWidget = (key: string) => {
      events.push("unsetWidget");
      rawUnset(key);
    };
    await host.shutdown();
    const stopStarted = events.indexOf("stop-started");
    const stopFinished = events.indexOf("stop-finished");
    const firstClear = events.indexOf("clearTimer");
    const unset = events.indexOf("unsetWidget");
    expect(stopStarted).toBeGreaterThanOrEqual(0);
    expect(firstClear).toBeGreaterThan(stopStarted);
    expect(stopFinished).toBeGreaterThan(firstClear);
    expect(unset).toBe(events.length - 1);
    expect(unset).toBeGreaterThan(stopFinished);
  });

  test("shutdown wins over a never-settling provider start", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    let releaseStart: (() => void) | undefined;
    let rejectStart: ((error: unknown) => void) | undefined;
    let stopCount = 0;
    registerProvider({
      id: "test.pending",
      contractVersion: 1,
      describe: () => ({}),
      create: () => ({
        start(): Promise<void> {
          return new Promise((resolve, reject) => {
            releaseStart = resolve;
            rejectStart = reject;
          });
        },
        stop() {
          stopCount++;
        },
      }),
    });
    const env = makeEnvironment();
    const host = makeHost(
      env,
      async () => ({
        config: { version: 1, separator: "slash", statuses: [{ id: "test.pending", options: {}, sourceIndex: 0 }] },
        problems: [],
      }),
      () => {},
    );
    const starting = host.start();
    // Start is awaiting the provider's pending start; no widget mounted yet.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(env.widgets.length).toBe(0);
    // Shutdown without ever releasing the provider's start promise.
    await Promise.all([starting, host.shutdown()]);
    // host.start() completed without the original promise resolving: the
    // widget was never registered and never unregistered; stop ran once.
    expect(env.widgets.length).toBe(0);
    expect(env.unsetKeys.length).toBe(0);
    expect(stopCount).toBe(1);
    // A late rejection after shutdown is absorbed, not unhandled. Release
    // the promise only for test cleanup.
    rejectStart?.(new Error("late start rejection"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Release the resolve side too; nothing observable changes.
    releaseStart?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  test("identical parse problems across indexes dedupe by content, keeping the first index", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    registerPass();
    const env = makeEnvironment();
    const { sink, onDiagnostic } = DIAG();
    const host = makeHost(
      env,
      async () => ({
        config: {
          version: 1,
          separator: "slash",
          statuses: [{ id: "test.pass", options: {}, sourceIndex: 0 }],
        },
        problems: [
          { index: 2, reason: 'unknown field "extra"' },
          { index: 5, reason: 'unknown field "extra"' },
          { index: 9, reason: 'unknown field "other"' },
        ],
      }),
      onDiagnostic,
    );
    await host.start();
    const dup = sink.filter((m) => m.includes('unknown field "extra"'));
    expect(dup.length).toBe(1);
    expect(dup[0]?.includes("statuses[2]")).toBe(true);
    expect(dup[0]?.includes("statuses[5]")).toBe(false);
    expect(sink.some((m) => m.includes('unknown field "other"'))).toBe(true);
    await host.shutdown();
  });

  test("config parse problems are reported per entry and skip only those entries", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    registerPass();
    const env = makeEnvironment();
    const { sink, onDiagnostic } = DIAG();
    const host = makeHost(
      env,
      async () => ({
        config: { version: 1, separator: "slash", statuses: [{ id: "test.pass", options: {}, sourceIndex: 0 }] },
        problems: [{ index: 3, reason: 'unknown field "extra"' }],
      }),
      onDiagnostic,
    );
    await host.start();
    expect(sink.some((m) => m.includes("statuses[3]") && m.includes("unknown field"))).toBe(true);
    expect(env.widgets.length).toBe(1); // the valid entry still mounted the bar
    await host.shutdown();
  });

  test("timer reclamation at shutdown", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    let interval: unknown;
    registerProvider({
      contractVersion: 1,
      id: "test.leak",
      describe: () => ({}),
      create: (context) => ({
        start: () => {
          interval = context.setInterval(() => {}, 1000);
        },
        stop: () => {},
      }),
    });
    const env = makeEnvironment();
    const host = makeHost(
      env,
      async () => ({
        config: { version: 1, separator: "slash", statuses: [{ id: "test.leak", options: {}, sourceIndex: 0 }] },
        problems: [],
      }),
      () => {},
    );
    await host.start();
    expect(env.timers.size).toBe(1);
    await host.shutdown();
    const entry = [...env.timers.values()].at(0);
    expect(entry?.cleared).toBe(true);
  });

  test("shutdown refuses late publishes", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    let publishAfterShutdown: (() => void) | undefined;
    registerProvider({
      contractVersion: 1,
      id: "test.late",
      describe: () => ({}),
      create: (context) => ({
        start: () => {
          publishAfterShutdown = () => context.publish({ spans: [{ text: "late" }] });
        },
        stop: () => {},
      }),
    });
    const env = makeEnvironment();
    const host = makeHost(
      env,
      async () => SIMPLE_CONFIG(),
      () => {},
    );
    await host.start();
    await host.shutdown();
    expect(() => publishAfterShutdown?.()).not.toThrow();
  });

  test("double start throws", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    const env = makeEnvironment();
    const host = makeHost(
      env,
      async () => ({ missing: true }),
      () => {},
    );
    await host.start();
    await expect(host.start()).rejects.toThrow("twice");
    await host.shutdown();
  });

  test("start after shutdown throws", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    const env = makeEnvironment();
    const host = makeHost(
      env,
      async () => ({ missing: true }),
      () => {},
    );
    await host.shutdown();
    await expect(host.start()).rejects.toThrow("shut down");
  });

  test("a start settling as shutdown begins leaves the instance to shutdown", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    let stopCount = 0;
    let releaseStart: (() => void) | undefined;
    registerProvider({
      id: "test.nearmiss",
      contractVersion: 1,
      describe: () => ({}),
      create: () => ({
        start(): Promise<void> {
          return new Promise((resolve) => {
            releaseStart = resolve;
          });
        },
        stop() {
          stopCount++;
        },
      }),
    });
    const sink: string[] = [];
    const env = makeEnvironment();
    const host = makeHost(
      env,
      async () => ({
        config: { version: 1, separator: "slash", statuses: [{ id: "test.nearmiss", options: {}, sourceIndex: 0 }] },
        problems: [],
      }),
      (m) => sink.push(m),
    );
    const starting = host.start();
    // Start is parked on the provider's pending start promise.
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Shutdown begins, then the start settles in the same tick: the race
    // may have already returned the settled outcome, but shutdown owns the
    // instance. No "failed to start" diagnostic may appear, and stop runs
    // exactly once through the shutdown path.
    const shuttingDown = host.shutdown();
    releaseStart?.();
    await Promise.all([starting, shuttingDown]);
    expect(stopCount).toBe(1);
    expect(sink.filter((m) => m.includes("failed to start")).length).toBe(0);
    expect(sink.filter((m) => m.includes("stop")).length).toBe(0);
  });

  test("identical sampler and widget-mount failure text dedupe separately", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    registerProvider({
      id: "test.combo",
      contractVersion: 1,
      describe: () => ({}),
      create: () => ({
        start() {
          // The sampler handler is already installed at this point; fire a
          // sampler error whose text matches the upcoming mount failure.
          getSnapshotStore().onSamplerError?.(new Error("same text"));
        },
        stop() {},
      }),
    });
    const sink: string[] = [];
    const throwingEnv = {
      ...makeEnvironment(),
      setWidget() {
        throw new Error("same text");
      },
    };
    const host = makeHost(
      throwingEnv,
      async () => ({
        config: { version: 1, separator: "slash", statuses: [{ id: "test.combo", options: {}, sourceIndex: 0 }] },
        problems: [],
      }),
      (m) => sink.push(m),
    );
    // Both categories fire within one reporter's lifetime: the sampler
    // error during the provider's start, then the mount failure. The
    // category-prefixed keys keep them as two diagnostics.
    await host.start();
    expect(sink.filter((m) => m.includes("sampler:") && m.includes("same text")).length).toBe(1);
    expect(sink.filter((m) => m.includes("widget mount failed") && m.includes("same text")).length).toBe(1);
  });

  test("a throwing setWidget tears the session down: stop once, timers cleared, no unset, bounded diagnostic", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    let stopCount = 0;
    registerProvider({
      id: "test.mountfail",
      contractVersion: 1,
      describe: () => ({}),
      create: (ctx) => ({
        start() {
          // One managed interval so reclamation is observable.
          ctx.setInterval(() => {}, 1000);
        },
        stop() {
          stopCount++;
        },
      }),
    });
    const sink: string[] = [];
    const unsetKeys: string[] = [];
    let clearCount = 0;
    const throwingEnv = {
      ...makeEnvironment(),
      setWidget() {
        throw new Error("setWidget exploded");
      },
      unsetWidget(key: string) {
        unsetKeys.push(key);
      },
      clearTimer() {
        clearCount++;
      },
    };
    const host = makeHost(
      throwingEnv,
      async () => ({
        config: { version: 1, separator: "slash", statuses: [{ id: "test.mountfail", options: {}, sourceIndex: 0 }] },
        problems: [],
      }),
      (m) => sink.push(m),
    );
    // start() mounts through setWidget, which throws: the Host tears the
    // session down instead of leaving providers and timers running without
    // any UI output. There is no later mount retry in the session.
    await host.start();
    expect(stopCount).toBe(1);
    expect(clearCount).toBeGreaterThan(0);
    expect(unsetKeys.length).toBe(0);
    expect(sink.filter((m) => m.includes("widget mount failed") && m.includes("setWidget exploded")).length).toBe(1);
  });

  test("the first failure is visible and identical content is reported once", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    registerPass();
    // Two configured instances of one provider that rejects options: the
    // same rejection content from two entries collapses into one line.
    registerProvider({
      id: "test.rejecting",
      contractVersion: 1,
      describe: () => {
        throw new Error("bad options");
      },
      create: () => ({ start() {}, stop() {} }),
    });
    const env = makeEnvironment();
    const { sink, onDiagnostic } = DIAG();
    const host = makeHost(
      env,
      async () => ({
        config: {
          version: 1,
          separator: "slash",
          statuses: [
            { id: "test.rejecting", options: {}, sourceIndex: 0 },
            { id: "test.rejecting", options: {}, sourceIndex: 1 },
          ],
        },
        problems: [],
      }),
      onDiagnostic,
    );
    await host.start();
    const failures = sink.filter((m) => m.includes("bad options"));
    expect(failures.length).toBe(1);
    expect(failures[0]).toContain("statuses[0]");
    await host.shutdown();
  });

  test("distinct failures each report until the cap, then exactly one suppression notice", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    const env = makeEnvironment();
    const { sink, onDiagnostic } = DIAG();
    // Twelve distinct providers whose start() throws: the first eight land,
    // the ninth triggers the single suppression notice.
    const statuses: { id: string; options: Record<string, never>; sourceIndex: number }[] = [];
    for (let index = 0; index < 12; index++) {
      registerProvider({
        id: `test.fail${index}`,
        contractVersion: 1,
        describe: () => ({}),
        create: () => ({
          start: () => {
            throw new Error(`boom ${index}`);
          },
          stop() {},
        }),
      });
      statuses.push({ id: `test.fail${index}`, options: {}, sourceIndex: index });
    }
    const host = makeHost(
      env,
      async () => ({ config: { version: 1, separator: "slash", statuses }, problems: [] }),
      onDiagnostic,
    );
    await host.start();
    const booms = sink.filter((m) => m.includes("boom "));
    expect(booms.length).toBe(8);
    expect(sink.filter((m) => m.includes("further status bar failures suppressed")).length).toBe(1);
    // No widget: every entry failed.
    expect(env.widgets.length).toBe(0);
    await host.shutdown();
  });

  test("a hostile then-getter from interval and timeout callbacks stays contained", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    const { sink, onDiagnostic } = DIAG();
    const hostile = {
      get then(): never {
        throw new Error("then getter boom");
      },
    };
    registerProvider({
      id: "test.hostile-then",
      contractVersion: 1,
      describe: () => ({}),
      create: (ctx) => ({
        start() {
          ctx.setInterval(() => hostile, 10);
          ctx.setTimeout(() => hostile, 10);
        },
        stop() {},
      }),
    });
    const env = makeEnvironment();
    const host = makeHost(
      env,
      async () => ({
        config: {
          version: 1,
          separator: "slash",
          statuses: [{ id: "test.hostile-then", options: {}, sourceIndex: 0 }],
        },
        problems: [],
      }),
      onDiagnostic,
    );
    await host.start();
    // Fire both managed timers directly; neither may throw.
    expect(() => {
      for (const timer of env.timers.values()) {
        timer.callback();
      }
    }).not.toThrow();
    // Both hostile callbacks ran and were contained; the two identical
    // failures dedupe to one bounded diagnostic.
    const booms = sink.filter((m) => m.includes("then getter boom"));
    expect(booms.length).toBe(1);
    expect(booms[0]).toContain("callback failure");
    // A later callback still executes: fire again, diagnostics stay at the
    // same single entry (dedupe by content).
    for (const timer of env.timers.values()) {
      timer.callback();
    }
    expect(sink.filter((m) => m.includes("then getter boom")).length).toBe(1);
    await host.shutdown();
  });

  test("stop and callback failures carry the original entry index", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    let tick: (() => void) | undefined;
    registerProvider({
      id: "test.indexing",
      contractVersion: 1,
      describe: () => ({}),
      create: (context) => ({
        start: () => {
          tick = () => {
            throw new Error("tick exploded");
          };
          context.setInterval(tick, 5);
        },
        stop: () => {
          throw new Error("stop exploded");
        },
      }),
    });
    const env = makeEnvironment();
    const { sink, onDiagnostic } = DIAG();
    const host = makeHost(
      env,
      async () => ({
        config: {
          version: 1,
          separator: "slash",
          statuses: [
            { id: "test.pass", options: {}, sourceIndex: 0 },
            { id: "test.indexing", options: {}, sourceIndex: 4 },
          ],
        },
        problems: [],
      }),
      onDiagnostic,
    );
    await host.start();
    // Drive the managed interval directly: the failure diagnostic names the
    // original config index, not the filtered instance position.
    const record = env.timers.values().next().value as TimerEntry;
    record.callback();
    await Promise.resolve();
    expect(sink.some((m) => m.includes("tick exploded") && m.includes("statuses[4]"))).toBe(true);
    // Stop failure also reports the original index.
    await host.shutdown();
    expect(sink.some((m) => m.includes("stop exploded") && m.includes("statuses[4]"))).toBe(true);
  });
});
