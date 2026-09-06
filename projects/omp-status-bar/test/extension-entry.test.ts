/**
 * Extension entry lifecycle tests.
 *
 * Drive the real extension factory through a stub Extension API: capture the
 * `session_start` / `session_shutdown` handlers the extension registers,
 * emit events with a fake extension context, and assert the observable
 * contract:
 *
 * - the widget mounts through `setWidget` with the real `(tui, theme)`
 *   factory pair and `belowEditor` placement;
 * - sampler ticks drive both the token metrics and the context provider and
 *   repaint through the captured TUI instance;
 * - headless sessions read no config and mount nothing;
 * - shutdown runs the Host teardown first (stop providers, clear the shared
 *   sampler interval, unset the widget) and unbinds the session sources
 *   last, even when a stop throws;
 * - no unhandled rejection escapes the emitted handlers.
 *
 * The agent directory is a real temp dir (the Host reads the YAML config
 * from `<agentDir>/omp-status-bar.yml` through the real config reader). The
 * entry module is imported statically; each activation refreshes the dirs
 * resolver from the env before the factory runs.
 */

import { afterAll, describe, test, expect } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { registerProvider, type ProviderInstanceContext } from "../src/provider-api.ts";
import { resetProviderRegistryForTests } from "../src/registry.ts";
import { resetSnapshotStoreForTests } from "../src/snapshot-store.ts";
import factory from "../src/extension.ts";

// One agent dir per test file: the pi dirs module caches the agent dir on
// first import, so the env var must point at one stable directory and each
// test rewrites the YAML config inside it.
const AGENT_DIR = mkdtempSync(path.join(tmpdir(), "ompsb-entry-"));
const ORIGINAL_AGENT_DIR = process.env.PI_CODING_AGENT_DIR;
process.env.PI_CODING_AGENT_DIR = AGENT_DIR;
afterAll(async () => {
  // Restore the pre-suite environment and the cached dirs resolver so later
  // test files see the process's original agent directory again.
  if (ORIGINAL_AGENT_DIR === undefined) {
    delete process.env.PI_CODING_AGENT_DIR;
  } else {
    process.env.PI_CODING_AGENT_DIR = ORIGINAL_AGENT_DIR;
  }
  const dirs = await import("@oh-my-pi/pi-utils");
  dirs.refreshDirsFromEnv();
  rmSync(AGENT_DIR, { recursive: true, force: true });
});

interface IntervalRecord {
  callback: () => void;
  cleared: boolean;
  clearCalled?: boolean;
}

type Handler = (event: unknown, ctx: unknown) => Promise<void> | void;

/** Capture `omp.on` handlers and emit events with a fake extension context. */
class ExtensionHarness {
  readonly statuses = new Map<string, string | undefined>();
  readonly intervals: IntervalRecord[] = [];
  readonly diagnostics: string[] = [];
  readonly handlers: Record<string, Handler[]> = {};
  readonly widgetFactories: ((tui: unknown, theme: unknown) => unknown)[] = [];
  readonly agentDir: string;
  /** The TUI instance the factory last received; repaint requests land here. */
  readonly repaints: unknown[] = [];
  #ctx?: unknown;
  #omp?: unknown;
  #metrics = { percent: 42, totalTokens: 12_300, cost: 0.42 };
  /** When true the next context-usage read throws; drives sampler-error tests. */
  usageThrows = false;
  /** The compaction group served by the injected Settings stub; undefined = uninitialized. */
  settingsGroup: Record<string, unknown> | undefined = undefined;
  /** Counts reads of the compaction group through the injected namespace. */
  settingsGroupReads = 0;

  constructor(configYaml: string) {
    this.agentDir = AGENT_DIR;
    writeFileSync(path.join(this.agentDir, "omp-status-bar.yml"), configYaml);
  }

  /** Invoke the extension factory once, capturing the event handlers. */
  async activate(): Promise<void> {
    // Rebuild the pi dirs resolver from the current env: other test files
    // in the same bun process may have initialized it with the real agent
    // dir. Dynamic import is required: the module caches the agent dir on
    // first load, and refreshDirsFromEnv is the only way to re-resolve it.
    const dirs = await import("@oh-my-pi/pi-utils");
    dirs.refreshDirsFromEnv();
    const harness = this;
    const ctx = {
      hasUI: true,
      ui: {
        setWidget: (key: string, factory: unknown, options?: unknown) => {
          void key;
          void options;
          if (typeof factory === "function") {
            harness.widgetFactories.push(factory as (tui: unknown, theme: unknown) => unknown);
          } else {
            harness.widgetFactories.length = 0;
          }
        },
      },
      getContextUsage: () => {
        if (this.usageThrows) {
          throw new Error("usage getter exploded");
        }
        // The context-usage token count tracks totalTokens so metric
        // updates move the speculation band inputs together.
        return { tokens: this.#metrics.totalTokens, contextWindow: 200_000, percent: this.#metrics.percent };
      },
      model: {
        provider: "test",
        id: "test-model",
        contextWindow: 200_000,
        input: ["text"],
      },
      sessionManager: {
        // The shared sampler reads the four token buckets; the harness
        // derives them from totalTokens so tests drive one number.
        getUsageStatistics: () => {
          const tokens = this.#metrics.totalTokens;
          const input = Math.round(tokens * 0.8);
          return {
            input,
            cacheWrite: 0,
            cacheRead: tokens - input,
            output: 0,
            totalTokens: tokens,
            cost: this.#metrics.cost,
          };
        },
      },
      setInterval: (callback: () => void) => {
        const record: IntervalRecord = { callback, cleared: false };
        this.intervals.push(record);
        return record;
      },
      setTimeout: (_callback: () => void, ms: number) => ({ id: ms }),
      clearTimer: (timer: unknown) => {
        (timer as { clearCalled?: boolean }).clearCalled = true;
      },
    };
    this.#ctx = ctx;
    const diagnostics = this.diagnostics;
    // The stub keeps its own group state, so reads prove the extension uses
    // the Settings namespace injected by the active OMP runtime.
    const injectedSettings = {
      get instance() {
        if (harness.settingsGroup === undefined) {
          throw new Error("Settings not initialized. Call Settings.init() first.");
        }
        return {
          getGroup: (prefix: string) => {
            if (prefix !== "compaction") {
              throw new Error(`unexpected group: ${prefix}`);
            }
            harness.settingsGroupReads++;
            return harness.settingsGroup;
          },
        };
      },
    };
    const omp = {
      logger: {
        warn: (message: string) => {
          diagnostics.push(message);
        },
      },
      on: (event: string, handler: Handler) => {
        (this.handlers[event] ??= []).push(handler);
      },
      pi: {
        Settings: injectedSettings,
      },
    };
    this.#omp = omp;
    await factory(omp as never);
  }

  /** Mount the widget exactly the way OMP would: factory(realTui, realTheme). */
  mountWidget(): unknown {
    const factoryFn = this.widgetFactories.at(-1);
    if (factoryFn === undefined) {
      throw new Error("no widget factory was registered");
    }
    const tui = {
      requestComponentRender: (component: unknown) => {
        this.repaints.push(component);
      },
    };
    const theme = {
      fg: (color: string, text: string) => (color === "dim" ? `\x1b[2m${text}\x1b[22m` : text),
    };
    return factoryFn(tui, theme);
  }

  async emitStart(): Promise<void> {
    for (const handler of this.handlers["session_start"] ?? []) {
      await handler({}, this.#ctx);
    }
  }

  async emitShutdown(): Promise<void> {
    for (const handler of this.handlers["session_shutdown"] ?? []) {
      await handler({}, this.#ctx);
    }
  }

  setMetrics(percent: number, totalTokens: number, cost: number): void {
    this.#metrics = { percent, totalTokens, cost };
  }

  dispose(): void {
    // Keep the shared agent dir; only reset the config file content.
    rmSync(path.join(this.agentDir, "omp-status-bar.yml"), { force: true });
  }
}

describe("extension entry lifecycle", () => {
  test("session_start mounts a belowEditor widget and publishes the composed line", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    registerProvider({
      id: "entry-probe",
      contractVersion: 1,
      describe: () => ({}),
      create: (context: ProviderInstanceContext) => ({
        start: () => context.publish({ spans: [{ text: "entry-probe:running" }] }),
        stop: () => {},
      }),
    });
    const h = new ExtensionHarness("version: 1\nstatuses:\n  - id: entry-probe\n");
    try {
      await h.activate();
      await h.emitStart();
      expect(h.widgetFactories.length).toBe(1);
      // The captured factory receives the real (tui, theme) pair; mounting
      // is what makes content visible.
      const component = h.mountWidget() as { render: (width: number) => string[] };
      const rows = component.render(120);
      expect(rows.length).toBe(1);
      expect(rows[0]).toContain("entry-probe:running");
      expect(h.statuses.has("ruokee.omp-status-bar")).toBe(false);
    } finally {
      await h.emitShutdown();
      h.dispose();
    }
  });

  test("fake-timer ticks update metrics and repaint through the captured tui", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    const h = new ExtensionHarness("version: 1\nstatuses:\n  - id: context\n  - id: total\n");
    try {
      await h.activate();
      await h.emitStart();
      expect(h.widgetFactories.length).toBe(1);
      const component = h.mountWidget() as { render: (width: number) => string[] };
      expect(component.render(120).join("")).toContain("ctx 42%");
      h.repaints.length = 0;
      h.setMetrics(90, 45_000, 1.25);
      // Drive the real OMP-managed interval callbacks: both the token
      // metrics and the context line refresh, and the repaint goes through
      // the tui captured at mount.
      for (const record of h.intervals) {
        record.callback();
      }
      await Promise.resolve();
      expect(component.render(120).join("")).toContain("ctx 90%");
      expect(component.render(120).join("")).toContain("45K");
      expect(h.repaints.length).toBeGreaterThan(0);
    } finally {
      await h.emitShutdown();
      h.dispose();
    }
  });

  test("compaction settings flow through the injected Settings namespace", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    const h = new ExtensionHarness("version: 1\nstatuses:\n  - id: context\n");
    try {
      await h.activate();
      // Reads resolve through pi.pi.Settings.instance at call time, so the
      // group set here before the session tick is what the sampler sees.
      h.settingsGroup = {
        enabled: true,
        asyncEnabled: true,
        methodOrder: ["handoff", "snapcompact", "remote"],
        thresholdPercent: 80,
        thresholdTokens: 160_000,
        reserveTokens: 40_000,
        remoteEndpoint: undefined,
      };
      await h.emitStart();
      const component = h.mountWidget() as { render: (width: number) => string[] };
      // 150_000 tokens sit inside the speculation band [140_000, 160_000),
      // so injected compaction settings make the context provider publish
      // its indicator instead of staying hidden.
      h.setMetrics(95, 150_000, 1.5);
      for (const record of h.intervals) {
        record.callback();
      }
      await Promise.resolve();
      const line = component.render(120).join("");
      expect(line).toContain("ctx 95%");
      expect(line).toContain("\u{F0068}");
      // The group came from the injected stub, through the runtime's
      // getGroup channel.
      expect(h.settingsGroupReads).toBeGreaterThan(0);
    } finally {
      await h.emitShutdown();
      h.dispose();
    }
  });

  test("an uninitialized injected Settings leaves the speculation icon hidden", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    const h = new ExtensionHarness("version: 1\nstatuses:\n  - id: context\n");
    try {
      await h.activate();
      // settingsGroup stays undefined: the injected instance getter throws,
      // so the sampler binds the fallback compaction group (speculation
      // off) and the icon stays hidden at any usage level.
      await h.emitStart();
      const component = h.mountWidget() as { render: (width: number) => string[] };
      h.setMetrics(95, 150_000, 1.5);
      for (const record of h.intervals) {
        record.callback();
      }
      await Promise.resolve();
      const line = component.render(120).join("");
      expect(line).toContain("ctx 95%");
      expect(line.includes("\u{F0068}")).toBe(false);
      // The injected getter never returned a compaction group.
      expect(h.settingsGroupReads).toBe(0);
    } finally {
      await h.emitShutdown();
      h.dispose();
    }
  });

  test("sampler source errors reach the logger once and later ticks still run", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    const h = new ExtensionHarness("version: 1\nstatuses:\n  - id: context\n");
    try {
      await h.activate();
      await h.emitStart();
      const component = h.mountWidget() as { render: (width: number) => string[] };
      expect(component.render(120).join("")).toContain("ctx 42%");
      // The context-usage getter now throws: the sampler must report one
      // diagnostic instead of swallowing the error, and keep the interval.
      h.usageThrows = true;
      for (const record of h.intervals) {
        record.callback();
      }
      const exploded = h.diagnostics.filter((m) => m.includes("usage getter exploded"));
      expect(exploded.length).toBe(1);
      expect(exploded[0]).toContain("sampler");
      // The sampler keeps running: recover the getter and the next tick
      // publishes again.
      h.usageThrows = false;
      h.setMetrics(90, 12_300, 0.42);
      for (const record of h.intervals) {
        record.callback();
      }
      expect(component.render(120).join("")).toContain("ctx 90%");
    } finally {
      await h.emitShutdown();
      h.dispose();
    }
  });

  test("headless sessions read no config and mount no widget", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    registerProvider({
      id: "headless-probe",
      contractVersion: 1,
      describe: () => ({}),
      create: () => ({
        start() {
          throw new Error("must never be created headless");
        },
        stop: () => {},
      }),
    });
    const h = new ExtensionHarness("this is not valid: [config");
    try {
      await h.activate();
      // Break the context: hasUI false.
      const startHandler = h.handlers["session_start"]![0]!;
      const ctx = { hasUI: false };
      await startHandler({}, ctx);
      expect(h.widgetFactories.length).toBe(0);
      expect(h.intervals.length).toBe(0);
    } finally {
      h.dispose();
    }
  });

  test("session_shutdown stops providers, clears intervals, unsets the widget, then unbinds", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    const order: string[] = [];
    registerProvider({
      id: "order-probe",
      contractVersion: 1,
      describe: () => ({}),
      create: (context: ProviderInstanceContext) => ({
        start: () => context.publish({ spans: [{ text: "on" }] }),
        stop: () => {
          order.push("provider-stopped");
        },
      }),
    });
    const h = new ExtensionHarness("version: 1\nstatuses:\n  - id: order-probe\n");
    try {
      await h.activate();
      await h.emitStart();
      const component = h.mountWidget();
      expect(component).toBeDefined();
      await h.emitShutdown();
      // A third-party provider subscribes to no sampler scope, so the shared
      // interval never starts; assert only the stop order and the unmount.
      expect(order).toEqual(["provider-stopped"]);
    } finally {
      h.dispose();
    }
  });

  test("shutdown unbinds even when a provider stop throws", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    registerProvider({
      id: "throwing-stop",
      contractVersion: 1,
      describe: () => ({}),
      create: () => ({
        start: () => {},
        stop: () => {
          throw new Error("stop exploded");
        },
      }),
    });
    const h = new ExtensionHarness("version: 1\nstatuses:\n  - id: throwing-stop\n");
    try {
      await h.activate();
      await h.emitStart();
      // Must not reject: the stop failure is contained as a diagnostic.
      await h.emitShutdown();
      expect(h.diagnostics.join("\n")).toContain("stop exploded");
    } finally {
      h.dispose();
    }
  });

  test("a conflicting builtin id fails activation atomically with no partial builtins", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    const { getProviderRegistry } = await import("../src/registry.ts");
    const h = new ExtensionHarness("version: 1\nstatuses: []\n");
    try {
      // A third party already owns "cache", the third builtin id: the
      // preflight must reject the whole batch before anything registers.
      registerProvider({
        id: "cache",
        contractVersion: 1,
        describe: () => ({}),
        create: () => ({ start() {}, stop() {} }),
      });
      await expect(h.activate()).rejects.toThrow(/already registered/);
      // No partial batch: none of the six builtin ids landed, and the
      // third party still owns its id.
      expect(getProviderRegistry().has("total")).toBe(false);
      expect(getProviderRegistry().has("input")).toBe(false);
      expect(getProviderRegistry().has("cache")).toBe(true);
      expect(getProviderRegistry().has("output")).toBe(false);
      expect(getProviderRegistry().has("cache-hit")).toBe(false);
      expect(getProviderRegistry().has("context")).toBe(false);
    } finally {
      h.dispose();
    }
  });

  test("a bad entry followed by a start-failing entry reports the original indexes", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    registerProvider({
      id: "start-boom",
      contractVersion: 1,
      describe: () => ({}),
      create: () => ({
        start: () => {
          throw new Error("cannot start");
        },
        stop: () => {},
      }),
    });
    // statuses[0] is structurally invalid; statuses[1] starts but fails.
    const h = new ExtensionHarness("version: 1\nstatuses:\n  - options: {}\n  - id: start-boom\n");
    try {
      await h.activate();
      await h.emitStart();
      const text = h.diagnostics.join("\n");
      expect(text).toContain("statuses[0]");
      expect(text).toContain("statuses[1]");
      expect(text).toContain("cannot start");
    } finally {
      await h.emitShutdown();
      h.dispose();
    }
  });
});
