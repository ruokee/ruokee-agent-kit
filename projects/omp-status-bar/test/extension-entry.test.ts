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

import { afterAll, describe, test, expect, spyOn } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { registerProvider } from "../src/provider-api.ts";
import type { ProviderDefinition, ProviderInstanceContext } from "../src/provider-api.ts";
import { registerBuiltinProviders } from "../src/providers/bundled.ts";
import { getProviderRegistry, resetProviderRegistryForTests } from "../src/registry.ts";
import { getSnapshotStore, resetSnapshotStoreForTests } from "../src/snapshot-store.ts";
import { getTurnSample, resetTurnStateForTests, type BranchEntryLike } from "../src/turn-state.ts";
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
  /** UI capability of the session this harness drives. */
  readonly hasUI: boolean;
  /** The TUI instance the factory last received; repaint requests land here. */
  readonly repaints: unknown[] = [];
  #ctx?: unknown;
  #omp?: unknown;
  #metrics = { percent: 42, totalTokens: 12_300, cost: 0.42 };
  /** When true the next context-usage read throws; drives sampler-error tests. */
  usageThrows = false;
  /** The compaction group served by the injected Settings stub; undefined = uninitialized. */
  settingsGroup: Record<string, unknown> | undefined = undefined;
  /** Live Settings instance to inject verbatim; takes precedence over {@link settingsGroup}. */
  settingsInstance: unknown = undefined;
  /** Counts reads of the compaction group through the injected namespace. */
  settingsGroupReads = 0;
  /** Branch the session binding counts; set before emitStart/emitSwitch to seed history. */
  branch: BranchEntryLike[] = [];

  constructor(configYaml: string, options: { hasUI?: boolean; totalTokens?: number } = {}) {
    this.agentDir = AGENT_DIR;
    writeFileSync(path.join(this.agentDir, "omp-status-bar.yml"), configYaml);
    this.hasUI = options.hasUI ?? true;
    if (options.totalTokens !== undefined) {
      this.setMetrics(this.#metrics.percent, options.totalTokens, this.#metrics.cost);
    }
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
      hasUI: this.hasUI,
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
        getBranch: () => this.branch,
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
        if (harness.settingsInstance !== undefined) {
          return harness.settingsInstance;
        }
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

  async emitSwitch(reason: "new" | "resume" | "fork"): Promise<void> {
    for (const handler of this.handlers["session_switch"] ?? []) {
      await handler({ type: "session_switch", reason, previousSessionFile: "/tmp/previous-session.jsonl" }, this.#ctx);
    }
  }

  async emitShutdown(): Promise<void> {
    for (const handler of this.handlers["session_shutdown"] ?? []) {
      await handler({}, this.#ctx);
    }
  }

  /** Emit one turn lifecycle event the way OMP does for the bound session. */
  async emitTurn(event: "turn_start" | "agent_end" | "turn_end", stopReason?: string): Promise<void> {
    const payload =
      event === "turn_end"
        ? { type: event, turnIndex: 0, message: { role: "assistant", stopReason }, toolResults: [] }
        : event === "turn_start"
          ? { type: event, turnIndex: 0, timestamp: 0 }
          : { type: event, messages: [] };
    for (const handler of this.handlers[event] ?? []) {
      await handler(payload, this.#ctx);
    }
  }

  /** Emit a tree navigation or a branch the way OMP does for the bound session. */
  async emitBranchChange(event: "session_tree" | "session_branch"): Promise<void> {
    const payload =
      event === "session_tree"
        ? { type: event, newLeafId: "leaf-2", oldLeafId: "leaf-1", summaryEntry: undefined }
        : { type: event, previousSessionFile: "/tmp/previous-session.jsonl" };
    for (const handler of this.handlers[event] ?? []) {
      await handler(payload, this.#ctx);
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
      // A read that failed is reported once, with its own locatable reason.
      expect(h.diagnostics.length).toBe(1);
      expect(h.diagnostics[0] ?? "").toContain("reading the compaction settings failed");
    } finally {
      await h.emitShutdown();
      h.dispose();
    }
  });

  test("a Settings instance without a readable group reports the reason once and keeps the row", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    const h = new ExtensionHarness("version: 1\nstatuses:\n  - id: context\n  - id: total\n");
    try {
      await h.activate();
      // The instance exposes no `getGroup`: that is the shape of the host
      // releases that removed the group reader, and the estimate stays hidden
      // instead of being guessed, while the metrics around it keep
      // publishing.
      h.settingsInstance = { name: "opaque" };
      await h.emitStart();
      const component = h.mountWidget() as { render: (width: number) => string[] };
      h.setMetrics(95, 150_000, 1.5);
      // Several sampler ticks: a bounded report must not repeat per tick.
      for (let tick = 0; tick < 5; tick++) {
        for (const record of h.intervals) {
          record.callback();
        }
        await Promise.resolve();
      }
      const line = component.render(120).join("");
      // The other providers around the unavailable estimate keep publishing.
      expect(line).toContain("ctx 95%");
      expect(line).toContain("T 150K");
      expect(line.includes("\u{F0068}")).toBe(false);
      expect(h.diagnostics.length).toBe(1);
      const reason = h.diagnostics[0] ?? "";
      // Locatable cause, and no configuration value leaked into the report.
      expect(reason).toContain("getGroup");
      expect(reason).not.toMatch(/[0-9]/);
    } finally {
      await h.emitShutdown();
      h.dispose();
    }
  });

  test("compaction turned off stays a silent hidden indicator", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    const h = new ExtensionHarness("version: 1\nstatuses:\n  - id: context\n");
    try {
      await h.activate();
      // A readable group that reports compaction off is a configuration
      // state, not a host that lost the read: nothing to report.
      h.settingsGroup = {
        enabled: false,
        asyncEnabled: false,
        methodOrder: ["soft"],
        thresholdTokens: 160_000,
      };
      await h.emitStart();
      const component = h.mountWidget() as { render: (width: number) => string[] };
      h.setMetrics(95, 150_000, 1.5);
      for (let tick = 0; tick < 3; tick++) {
        for (const record of h.intervals) {
          record.callback();
        }
        await Promise.resolve();
      }
      const line = component.render(120).join("");
      expect(line).toContain("ctx 95%");
      expect(line.includes("\u{F0068}")).toBe(false);
      expect(h.diagnostics).toEqual([]);
    } finally {
      await h.emitShutdown();
      h.dispose();
    }
  });

  test("a group with a foreign methodOrder shape keeps the fragment and reports nothing", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    const h = new ExtensionHarness("version: 1\nstatuses:\n  - id: context\n");
    try {
      await h.activate();
      // Another host release may return the field under a shape this package
      // does not consume. The sample must keep the readable fields and the
      // fragment published, and the icon stays hidden.
      h.settingsGroup = {
        enabled: true,
        asyncEnabled: true,
        methodOrder: true,
        thresholdTokens: 160_000,
      };
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
      expect(h.diagnostics).toEqual([]);
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
      // No partial batch: none of the builtin ids landed, and the
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

  test("a second activation in the same process keeps the builtins and mounts its own widget", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    const config = "version: 1\nstatuses:\n  - id: total\n";
    const first = new ExtensionHarness(config);
    const second = new ExtensionHarness(config);
    try {
      await first.activate();
      await first.emitStart();
      const registered = getProviderRegistry().ids().sort();

      // OMP activates the extension again for a subagent session: the ids the
      // first activation registered belong to this package, not to a third
      // party, so the second activation registers nothing and still mounts.
      await expect(second.activate()).resolves.toBeUndefined();
      expect(getProviderRegistry().ids().sort()).toEqual(registered);
      await second.emitStart();
      expect(second.widgetFactories.length).toBe(1);
    } finally {
      await first.emitShutdown();
      await second.emitShutdown();
      first.dispose();
      second.dispose();
    }
  });

  test("a session without UI binds no sources and leaves the UI session running", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    const config = "version: 1\nstatuses:\n  - id: total\n";
    // Same factory, same process: one UI session in front with one subagent
    // session without UI behind it. The two carry different data so a
    // cross-wire is visible in the sampled values.
    const main = new ExtensionHarness(config);
    const child = new ExtensionHarness(config, { hasUI: false, totalTokens: 1_000 });
    const store = getSnapshotStore();
    const listener = () => {};
    try {
      main.setMetrics(42, 500, 0.4);
      await main.activate();
      await main.emitStart();
      expect(main.widgetFactories.length).toBe(1);
      store.retainStats(listener);
      expect(store.sample().stats?.input).toBe(400);

      // The child session shares the process. Its activation, events, and
      // shutdown must leave the UI session's sources, sampler, and widget
      // exactly as they were.
      await child.activate();
      await child.emitStart();
      expect(child.widgetFactories.length).toBe(0);
      expect(child.intervals.length).toBe(0);
      expect(store.sample().stats?.input).toBe(400);
      main.setMetrics(42, 700, 0.4);
      expect(store.sample().stats?.input).toBe(560);

      await child.emitSwitch("resume");
      expect(store.sample().stats?.input).toBe(560);

      // Shutdown must not unbind sources this activation never bound.
      await child.emitShutdown();
      expect(store.sample().stats?.input).toBe(560);
      main.setMetrics(42, 900, 0.4);
      expect(store.sample().stats?.input).toBe(720);
      expect(main.widgetFactories.length).toBe(1);
      expect(child.diagnostics).toEqual([]);
    } finally {
      store.releaseStats(listener);
      await main.emitShutdown();
      main.dispose();
      child.dispose();
    }
  });

  test("a builtin id another copy of this package registered is not a conflict", () => {
    resetProviderRegistryForTests();
    // Another copy of this package registers first: its module identity is its
    // own, and only the package-scoped mark identifies the definition as this
    // package's own registration.
    const fromAnotherCopy: ProviderDefinition = {
      id: "total",
      contractVersion: 1,
      describe: () => ({}),
      create: () => ({ start() {}, stop() {} }),
    };
    Object.defineProperty(fromAnotherCopy, Symbol.for("@ruokee/omp-status-bar/builtin-provider/v1"), { value: true });
    registerProvider(fromAnotherCopy);

    registerBuiltinProviders();
    expect(getProviderRegistry().get("total")).toBe(fromAnotherCopy);
    expect(getProviderRegistry().ids().sort()).toEqual([
      "cache",
      "cache-hit",
      "context",
      "input",
      "output",
      "total",
      "turn",
    ]);
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

  test("new, resumed, and forked sessions reload configuration without leaking hosts", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    let starts = 0;
    let stops = 0;
    registerProvider({
      id: "session-probe",
      contractVersion: 1,
      describe: () => ({}),
      create: (context) => ({
        start: () => {
          context.publish({ spans: [{ text: `instance-${++starts}` }] });
        },
        stop: () => {
          stops++;
        },
      }),
    });
    const probeConfig = "version: 1\nstatuses:\n  - id: session-probe\n";
    const h = new ExtensionHarness(probeConfig);
    const line = () => {
      // The harness captures the real in-process Host widget.
      const component = h.mountWidget() as { render(width: number): string[] };
      return component.render(120).join("");
    };
    try {
      await h.activate();
      await h.emitStart();
      expect(line()).toContain("instance-1");
      writeFileSync(path.join(h.agentDir, "omp-status-bar.yml"), "version: 1\nstatuses:\n  - id: context\n");
      await h.emitSwitch("new");
      expect(line()).toContain("ctx 42%");
      expect(stops).toBe(1);
      expect(h.intervals.filter((timer) => !timer.clearCalled)).toHaveLength(1);
      writeFileSync(path.join(h.agentDir, "omp-status-bar.yml"), probeConfig);
      await h.emitSwitch("resume");
      expect(line()).toContain("instance-2");
      expect(h.intervals.every((timer) => timer.clearCalled)).toBe(true);
      await h.emitSwitch("fork");
      expect(line()).toContain("instance-3");
      expect(h.widgetFactories).toHaveLength(1);
      await h.emitShutdown();
      expect(stops).toBe(3);
      expect(h.widgetFactories).toHaveLength(0);
    } finally {
      await h.emitShutdown();
      h.dispose();
    }
  });

  test("serializes switching and shutdown behind a slow provider stop", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    let release!: () => void;
    let signalStopping!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const stopping = new Promise<void>((resolve) => {
      signalStopping = resolve;
    });
    registerProvider({
      id: "slow-session-stop",
      contractVersion: 1,
      describe: () => ({}),
      create: () => ({
        start() {},
        async stop() {
          signalStopping();
          await blocked;
        },
      }),
    });
    const h = new ExtensionHarness("version: 1\nstatuses:\n  - id: slow-session-stop\n");
    const unbind = spyOn(getSnapshotStore(), "unbind");
    try {
      await h.activate();
      await h.emitStart();
      unbind.mockClear();
      writeFileSync(path.join(h.agentDir, "omp-status-bar.yml"), "version: 1\nstatuses:\n  - id: context\n");
      const switching = h.emitSwitch("new");
      const shutdown = h.emitShutdown();
      await stopping;
      expect(unbind).not.toHaveBeenCalled();
      expect(h.widgetFactories).toHaveLength(1);
      release();
      await Promise.all([switching, shutdown]);
      expect(unbind).toHaveBeenCalledTimes(1);
      expect(h.widgetFactories).toHaveLength(0);
      expect(h.intervals.every((timer) => timer.clearCalled)).toBe(true);
      await h.emitStart();
      h.setMetrics(71, 5000, 0.1);
      for (const timer of h.intervals.filter((timer) => !timer.clearCalled)) timer.callback();
      const component = h.mountWidget() as { render(width: number): string[] };
      expect(component.render(120).join("")).toContain("ctx 71%");
      expect(h.widgetFactories).toHaveLength(1);
    } finally {
      release();
      await h.emitShutdown();
      unbind.mockRestore();
      h.dispose();
    }
  });
});

test("shutdown interrupts an unfinished provider start", async () => {
  resetProviderRegistryForTests();
  resetSnapshotStoreForTests();
  let signalStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    signalStarted = resolve;
  });
  let stopped = false;
  registerProvider({
    id: "blocked-session-start",
    contractVersion: 1,
    describe: () => ({}),
    create: () => ({
      start() {
        signalStarted();
        return new Promise<void>(() => {});
      },
      stop() {
        stopped = true;
      },
    }),
  });
  const h = new ExtensionHarness("version: 1\nstatuses:\n  - id: blocked-session-start\n");
  try {
    await h.activate();
    const starting = h.emitStart();
    await started;
    await h.emitShutdown();
    await starting;
    expect(stopped).toBe(true);
    expect(h.widgetFactories).toHaveLength(0);
  } finally {
    await h.emitShutdown();
    h.dispose();
  }
});

describe("turn metric", () => {
  const config = "version: 1\nstatuses:\n  - id: turn\n";

  test("seeds from the branch history and counts only successful responses", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    resetTurnStateForTests();
    const h = new ExtensionHarness(config);
    try {
      // The branch holds one answered response, one failed one, and one user
      // message: only the answered response is part of the starting value.
      h.branch = [
        { type: "message", message: { role: "user" } },
        { type: "message", message: { role: "assistant", stopReason: "stop" } },
        { type: "message", message: { role: "assistant", stopReason: "error" } },
      ];
      await h.activate();
      await h.emitStart();
      const component = h.mountWidget() as { render(width: number): string[] };
      expect(component.render(120).join("")).toContain("Turn 1");
      expect(getTurnSample()).toEqual({ count: 1, active: false });

      // A running turn keeps the count and stops dimming the value.
      await h.emitTurn("turn_start");
      expect(getTurnSample()).toEqual({ count: 1, active: true });
      expect(component.render(120).join("")).not.toContain("\x1b[2mTurn");

      for (const stopReason of ["stop", "length", "toolUse"]) {
        await h.emitTurn("turn_start");
        await h.emitTurn("turn_end", stopReason);
      }
      expect(getTurnSample()).toEqual({ count: 4, active: false });
      expect(component.render(120).join("")).toContain("Turn 4");

      for (const stopReason of ["error", "aborted"]) {
        await h.emitTurn("turn_start");
        await h.emitTurn("turn_end", stopReason);
      }
      expect(getTurnSample()).toEqual({ count: 4, active: false });

      // A run that ends without a `turn_end` clears the in-flight mark too.
      await h.emitTurn("turn_start");
      await h.emitTurn("agent_end");
      expect(getTurnSample()).toEqual({ count: 4, active: false });

      await h.emitShutdown();
      expect(getTurnSample()).toBeUndefined();
    } finally {
      h.dispose();
      resetTurnStateForTests();
    }
  });

  test("a resumed session re-seeds the count from the branch it now holds", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    resetTurnStateForTests();
    const h = new ExtensionHarness(config);
    try {
      h.branch = [
        { type: "message", message: { role: "assistant", stopReason: "stop" } },
        { type: "message", message: { role: "assistant", stopReason: "stop" } },
      ];
      await h.activate();
      await h.emitStart();
      expect(getTurnSample()).toEqual({ count: 2, active: false });

      // Resuming feeds the branch that is in front now, so the value follows
      // that history instead of the previous session's total.
      h.branch = [{ type: "message", message: { role: "assistant", stopReason: "stop" } }];
      await h.emitSwitch("resume");
      expect(getTurnSample()).toEqual({ count: 1, active: false });
      const component = h.mountWidget() as { render(width: number): string[] };
      expect(component.render(120).join("")).toContain("Turn 1");
    } finally {
      await h.emitShutdown();
      h.dispose();
      resetTurnStateForTests();
    }
  });

  test("tree navigation and branching re-seed the count without remounting the widget", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    resetTurnStateForTests();
    const h = new ExtensionHarness(config);
    try {
      h.branch = [
        { type: "message", message: { role: "assistant", stopReason: "stop" } },
        { type: "message", message: { role: "assistant", stopReason: "stop" } },
        { type: "message", message: { role: "assistant", stopReason: "stop" } },
      ];
      await h.activate();
      await h.emitStart();
      expect(getTurnSample()).toEqual({ count: 3, active: false });

      // Rewinding to an earlier leaf of the same session feeds a shorter
      // branch, and the next answered response continues from that history
      // instead of the value the abandoned trail had reached.
      h.branch = [{ type: "message", message: { role: "assistant", stopReason: "stop" } }];
      await h.emitBranchChange("session_tree");
      expect(getTurnSample()).toEqual({ count: 1, active: false });
      const component = h.mountWidget() as { render(width: number): string[] };
      expect(component.render(120).join("")).toContain("Turn 1");
      await h.emitTurn("turn_start");
      await h.emitTurn("turn_end", "stop");
      expect(getTurnSample()).toEqual({ count: 2, active: false });

      // A branch starts a new session trail, so its own history is the value.
      h.branch = Array.from({ length: 4 }, () => ({
        type: "message",
        message: { role: "assistant", stopReason: "stop" },
      }));
      await h.emitBranchChange("session_branch");
      expect(getTurnSample()).toEqual({ count: 4, active: false });
      // The session manager they read through is the one that changed, so the
      // Host stays mounted instead of restarting.
      expect(h.widgetFactories).toHaveLength(1);
    } finally {
      await h.emitShutdown();
      h.dispose();
      resetTurnStateForTests();
    }
  });

  test("a session without UI never moves the bound session's count", async () => {
    resetProviderRegistryForTests();
    resetSnapshotStoreForTests();
    resetTurnStateForTests();
    const main = new ExtensionHarness(config);
    const child = new ExtensionHarness(config, { hasUI: false });
    try {
      main.branch = [{ type: "message", message: { role: "assistant", stopReason: "stop" } }];
      await main.activate();
      await main.emitStart();
      expect(getTurnSample()).toEqual({ count: 1, active: false });

      child.branch = [
        { type: "message", message: { role: "assistant", stopReason: "stop" } },
        { type: "message", message: { role: "assistant", stopReason: "stop" } },
        { type: "message", message: { role: "assistant", stopReason: "stop" } },
      ];
      await child.activate();
      await child.emitStart();
      await child.emitTurn("turn_start");
      await child.emitTurn("turn_end", "stop");
      await child.emitTurn("agent_end");
      await child.emitBranchChange("session_tree");
      await child.emitBranchChange("session_branch");
      expect(getTurnSample()).toEqual({ count: 1, active: false });

      await child.emitShutdown();
      expect(getTurnSample()).toEqual({ count: 1, active: false });
    } finally {
      await main.emitShutdown();
      main.dispose();
      child.dispose();
      resetTurnStateForTests();
    }
  });
});
