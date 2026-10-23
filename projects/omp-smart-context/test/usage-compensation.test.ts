/**
 * Compaction usage module tests.
 *
 * The module replaces an accessor on the host's agent prototype and keeps the
 * patch for the rest of the process, so every test injects the accessor slot and
 * clears the registry slot the way a fresh process has it. The configuration the
 * module hands out is read back through the installed accessor, and a request is
 * driven the way the host drives one: the span comes from the tracer the
 * configuration carries, the oneshot kind is stamped on that span, and the usage
 * event is delivered with the same span.
 */

import { afterEach, describe, expect, test } from "bun:test";
import type { ModuleState } from "../src/settings.ts";
import { parseSettings } from "../src/settings.ts";
import {
  buildUsage,
  createUsageCompensationInstaller,
  FINISH_REASONS_ATTRIBUTE,
  hasTokens,
  ONESHOT_KIND_ATTRIBUTE,
  readStopReason,
  resolveRequestModel,
  stopForeignUsagePatch,
  usagePatchRegistry,
  usageStatusFromRegistry,
  USAGE_REGISTRY_SCHEMA,
  type ModelIdentity,
  type ModelQuery,
  type ModelUsageWrite,
  type TelemetryAccessor,
  type UsageCompensationDeps,
  type UsageLedger,
  type UsageRegistry,
  type UsageContext,
} from "../src/usage-compensation.ts";
import { createHarness, type Harness } from "./host.ts";

const TEST_RUNTIME_ID = "usage-test-runtime";

const REGISTRY_KEY = Symbol.for("ruokee.omp-smart-context.usage-compensation.registry");
const PROVIDER = "example-provider";
const MODEL = "example-model-1.0";
const API = "openai-responses";

function globalSlots(): Record<symbol, unknown> {
  return globalThis as unknown as Record<symbol, unknown>;
}

/** A telemetry configuration the host's accessor returns for one agent. */
interface AgentTelemetry {
  telemetry?: Record<string, unknown> | undefined;
  sessionId?: string;
}

/** One span as the host's tracer builds it, recording the attributes it receives. */
interface RecordingSpan {
  attributes: Array<[unknown, unknown]>;
  setAttribute(key: unknown, value?: unknown): void;
  setAttributes(values: Record<string, unknown>): void;
  isRecording(): boolean;
}

/** One tracer as the host builds it: it produces the spans above. */
interface RecordingTracer {
  spans: RecordingSpan[];
  startSpan(name: string): RecordingSpan;
}

function recordingSpan(): RecordingSpan {
  const attributes: Array<[unknown, unknown]> = [];
  const span: RecordingSpan = {
    attributes,
    setAttribute: (key, value) => {
      attributes.push([key, value]);
    },
    setAttributes: (values) => {
      for (const entry of Object.entries(values)) attributes.push(entry);
    },
    isRecording: () => true,
  };
  return span;
}

function recordingTracer(): RecordingTracer {
  const spans: RecordingSpan[] = [];
  return {
    spans,
    startSpan: () => {
      const span = recordingSpan();
      spans.push(span);
      return span;
    },
  };
}

/** One usage entry a test's ledger received. */
interface RecordedWrite {
  write: ModelUsageWrite;
  owner: { sessionId: string; parentId: string | null };
}

/** A session journal the module writes into, with the entries it received. */
interface FakeLedger {
  ledger: UsageLedger;
  writes: RecordedWrite[];
  /** Move this manager to another journal, the way `/new` and `/resume` do. */
  switchTo: (sessionId: string) => void;
}

function fakeLedger(sessionId = "session-1", leafId: string | null = "leaf-1", keeps = true): FakeLedger {
  const writes: RecordedWrite[] = [];
  let current = sessionId;
  return {
    writes,
    switchTo: (next) => {
      current = next;
    },
    ledger: {
      getSessionId: () => current,
      getLeafId: () => leafId,
      appendModelUsage: (write, owner) => {
        writes.push({ write, owner });
        return keeps ? `usage-${writes.length}` : undefined;
      },
    },
  };
}

/** A model query that names the api of the compaction model. */
function fakeModels(overrides: Partial<ModelQuery> = {}): ModelQuery {
  const identity: ModelIdentity = { id: MODEL, provider: PROVIDER, api: API };
  return {
    resolve: (spec) => (spec === `${PROVIDER}/${MODEL}` ? identity : undefined),
    list: () => [identity],
    ...overrides,
  };
}

/** The accessor slot a test owns, standing in for the host's agent prototype. */
interface AccessorSlot {
  deps: UsageCompensationDeps;
  /** The accessor standing in for the host's own. */
  native: TelemetryAccessor;
  /** The accessor currently installed. */
  current: () => TelemetryAccessor | undefined;
  /** Replace the accessor the way another extension would. */
  replace: (accessor: TelemetryAccessor) => void;
  /** How often the installer wrote the slot. */
  installs: () => number;
  /** The configuration an agent sees through the installed accessor. */
  config: (agent: AgentTelemetry) => Record<string, unknown> | undefined;
}

/**
 * One accessor slot, with the registry slot cleared the way a fresh process has
 * it. The accessor stands in for the host's `Agent.prototype.telemetry` getter:
 * it answers with the configuration the agent itself carries.
 */
function accessorSlot(options: { hostRecordsUsage?: boolean; takesInstall?: boolean } = {}): AccessorSlot {
  globalSlots()[REGISTRY_KEY] = undefined;
  const native: TelemetryAccessor = {
    enumerable: false,
    configurable: true,
    get(this: unknown) {
      return (this as AgentTelemetry | undefined)?.telemetry;
    },
  };
  let current: TelemetryAccessor | undefined = native;
  let installs = 0;
  const deps: UsageCompensationDeps = {
    // The host hands out a fresh accessor object per read, carrying the getter
    // the prototype holds; only that getter identifies the live patch.
    readAccessor: () => (current === undefined ? undefined : { ...current, get: current.get }),
    installAccessor: (accessor) => {
      if (options.takesInstall === false) return;
      current = accessor;
      installs += 1;
    },
    defaultTracer: () => recordingTracer(),
    hostRecordsCompactionUsage: () => options.hostRecordsUsage === true,
  };
  return {
    deps,
    native,
    current: () => current,
    replace: (accessor) => {
      current = accessor;
    },
    installs: () => installs,
    config: (agent) => current?.get.call(agent) as Record<string, unknown> | undefined,
  };
}

function usageSettings(overrides: Record<string, unknown> = {}) {
  const parsed = parseSettings(overrides).compactionUsage;
  if (!parsed.ok) throw new Error("expected valid usage settings");
  return parsed.settings;
}

interface InstallOptions {
  raw?: Record<string, unknown>;
  off?: "settings-invalid";
  runtimeId?: string;
  cwd?: string;
  /** Session the activation registers, as a journal and an optional model query. */
  session?: { ledger: UsageLedger; models?: ModelQuery };
}

interface Attempt {
  state: ModuleState;
  reports: string[];
  harness: Harness;
}

/** Run one activation's install attempt against one accessor slot. */
function attempt(slot: AccessorSlot, options: InstallOptions = {}): Attempt {
  const harness = createHarness();
  const reports: string[] = [];
  const context: UsageContext = {
    pi: harness.pi,
    ctx: harness.context({
      cwd: options.cwd ?? "/tmp/omp-qol-project",
      ...(options.session === undefined
        ? {}
        : { sessionManager: options.session.ledger, models: options.session.models ?? fakeModels() }),
    } as never),
    settings: usageSettings(options.raw ?? {}),
    runtimeId: options.runtimeId ?? TEST_RUNTIME_ID,
    off: options.off,
    report: (key, message) => reports.push(`${key}: ${message}`),
  };
  return { state: createUsageCompensationInstaller(slot.deps)(context), reports, harness };
}

/** The registry the shipped installer published, required to exist. */
function installedRegistry(): UsageRegistry {
  const registry = usagePatchRegistry();
  if (registry === undefined) throw new Error("expected the installer to publish a registry");
  return registry;
}

/** Fields a test overrides when it builds one usage event. */
interface UsageEventOverrides {
  provider?: string;
  model?: string;
  usage?: Record<string, unknown>;
  conversationId?: string;
  providerId?: string;
  modelId?: string;
}

/** A usage event as the host delivers one, with the span it came from. */
function usageEvent(span: unknown, overrides: UsageEventOverrides = {}): Record<string, unknown> {
  return {
    span,
    operation: "chat",
    conversationId: overrides.conversationId ?? "session-1",
    provider: overrides.provider ?? PROVIDER,
    model: overrides.model ?? MODEL,
    ...(overrides.providerId === undefined ? {} : { providerId: overrides.providerId }),
    ...(overrides.modelId === undefined ? {} : { modelId: overrides.modelId }),
    usage: overrides.usage ?? {
      inputTokens: 300,
      outputTokens: 50,
      totalTokens: 350,
      cachedInputTokens: 40,
      cacheWriteTokens: 10,
    },
  };
}

/** Drive one completed request through the configuration the module handed out. */
function request(
  config: Record<string, unknown>,
  kind: string | undefined,
  options: {
    event?: UsageEventOverrides;
    /** Cost the estimator reported for this request, as a host that prices it exposes. */
    spend?: Record<string, unknown>;
    /** Provider and requested model ids the estimator context carries on hosts that name them. */
    ids?: { providerId?: string; modelId?: string };
    attributes?: Array<[string, unknown]>;
  } = {},
): unknown {
  const tracer = config.tracer as RecordingTracer;
  const span = tracer.startSpan("chat");
  if (kind !== undefined) span.setAttribute(ONESHOT_KIND_ATTRIBUTE, kind);
  for (const [key, value] of options.attributes ?? []) span.setAttribute(key, value);
  const event = usageEvent(span, options.event);
  if (options.spend !== undefined || options.ids !== undefined) {
    (config.costEstimator as (context: unknown) => unknown)({
      provider: PROVIDER,
      model: MODEL,
      usage: event.usage,
      ...options.ids,
      usageCost: options.spend,
    });
  }
  (config.onChatUsage as (inner: unknown) => unknown)(event);
  return span;
}

afterEach(() => {
  globalSlots()[REGISTRY_KEY] = undefined;
});

describe("usage compensation installation", () => {
  test("leaves the accessor alone while the module is off", () => {
    const slot = accessorSlot();
    const setup = attempt(slot, { raw: { compactionUsageEnabled: false }, session: fakeLedger() });

    expect(setup.state).toEqual({ status: "disabled", reason: "compactionUsage-disabled" });
    expect(slot.current()?.get).toBe(slot.native.get);
    expect(slot.installs()).toBe(0);
    expect(usagePatchRegistry()).toBeUndefined();
    expect(setup.reports).toEqual([]);
  });

  test("keeps a rejected key ahead of the module switch", () => {
    const invalid = accessorSlot();
    expect(attempt(invalid, { raw: {}, off: "settings-invalid", session: fakeLedger() }).state).toEqual({
      status: "invalid",
      reason: "settings-invalid",
    });
    expect(invalid.installs()).toBe(0);
  });

  test("installs one accessor and records the one it replaced", () => {
    const slot = accessorSlot();
    const session = fakeLedger();
    const setup = attempt(slot, { session, cwd: "/tmp/omp-qol-project" });
    const registry = installedRegistry();

    expect(setup.state).toEqual({ status: "enabled", detail: "entries=0" });
    expect(registry.original.get).toBe(slot.native.get);
    expect(slot.current()?.get).toBe(registry.installed.get);
    expect(slot.current()?.get).not.toBe(slot.native.get);
    expect(slot.installs()).toBe(1);
    expect(setup.reports).toEqual([]);
  });

  test("recognizes its own accessor when the host reads it back as a fresh object", () => {
    const slot = accessorSlot();
    const first = attempt(slot, { session: fakeLedger() });
    // The host answers every read with a new accessor object carrying the same
    // getter, so a second activation must still recognize the patch it holds.
    const second = attempt(slot, { session: fakeLedger("session-2"), runtimeId: "other-runtime" });

    expect(first.state).toEqual({ status: "enabled", detail: "entries=0" });
    expect(second.state).toEqual({ status: "enabled", detail: "entries=0" });
    expect(slot.installs()).toBe(1);
    expect(installedRegistry().original.get).toBe(slot.native.get);
  });

  test("refuses a registry slot written in a layout this version does not know", () => {
    const slot = accessorSlot();
    globalSlots()[REGISTRY_KEY] = { schema: 99, runtimeId: "other" };

    const setup = attempt(slot, { session: fakeLedger() });

    expect(setup.state).toEqual({ status: "incompatible", reason: "registry-unrecognized" });
    expect(slot.installs()).toBe(0);
    expect(setup.reports.join("\n")).toContain("compactionUsage:registry-unrecognized");
    // A slot this version cannot read is never described as its own patch.
    expect(usageStatusFromRegistry({ status: "disabled", reason: "compactionUsage-disabled" })).toEqual({
      status: "disabled",
      reason: "compactionUsage-disabled",
    });
  });

  test("refuses to stack on an accessor another extension installed", () => {
    const slot = accessorSlot();
    attempt(slot, { session: fakeLedger() });
    const foreign: TelemetryAccessor = {
      enumerable: false,
      configurable: true,
      get: () => ({ tracer: recordingTracer() }),
    };
    slot.replace(foreign);

    const setup = attempt(slot, { session: fakeLedger() });

    expect(setup.state).toEqual({ status: "incompatible", reason: "patch-overwritten" });
    expect(slot.current()?.get).toBe(foreign.get);
    expect(slot.installs()).toBe(1);
    expect(usageStatusFromRegistry({ status: "enabled" })).toEqual({
      status: "incompatible",
      reason: "patch-overwritten",
    });
  });

  test("does not install on a host that records these requests itself", () => {
    const slot = accessorSlot({ hostRecordsUsage: true });

    const setup = attempt(slot, { session: fakeLedger() });

    expect(setup.state).toEqual({ status: "incompatible", reason: "host-records-usage" });
    expect(slot.installs()).toBe(0);
    expect(usagePatchRegistry()).toBeUndefined();
  });

  test("refuses a host without an accessor or without a usage writer", () => {
    const noAccessor = accessorSlot();
    noAccessor.replace(undefined as unknown as TelemetryAccessor);
    expect(attempt(noAccessor, { session: fakeLedger() }).state).toEqual({
      status: "incompatible",
      reason: "accessor-absent",
    });

    const slot = accessorSlot();
    const setup = attempt(slot, { session: undefined });
    expect(setup.state).toEqual({ status: "incompatible", reason: "writer-absent" });
    expect(slot.installs()).toBe(0);
    expect(setup.reports.join("\n")).toContain("compactionUsage:writer-absent");
  });

  test("gives the accessor up when the runtime does not take it", () => {
    const slot = accessorSlot({ takesInstall: false });

    const setup = attempt(slot, { session: fakeLedger() });

    expect(setup.state).toEqual({ status: "incompatible", reason: "install-failed" });
    expect(slot.current()?.get).toBe(slot.native.get);
    expect(usagePatchRegistry()).toBeUndefined();
    expect(setup.reports.join("\n")).toContain("compactionUsage:install-failed");
  });

  test("shares one patch with a second activation and registers its session", () => {
    const slot = accessorSlot();
    const first = attempt(slot, { session: fakeLedger("session-1") });
    const second = attempt(slot, { session: fakeLedger("session-2"), runtimeId: "other-runtime" });

    expect(first.state).toEqual({ status: "enabled", detail: "entries=0" });
    expect(second.state).toEqual({ status: "enabled", detail: "entries=0" });
    expect(slot.installs()).toBe(1);
    expect([...installedRegistry().sessions.keys()]).toEqual(["session-1", "session-2"]);
  });

  test("releases the accessor when the running activation turns the module off", () => {
    const slot = accessorSlot();
    attempt(slot, { session: fakeLedger() });

    const setup = attempt(slot, { raw: { compactionUsageEnabled: false }, session: fakeLedger() });

    expect(setup.state).toEqual({ status: "disabled", reason: "compactionUsage-disabled" });
    expect(slot.current()?.get).toBe(slot.native.get);
    expect(usageStatusFromRegistry({ status: "enabled" })).toEqual({
      status: "incompatible",
      reason: "compactionUsage-disabled",
    });
  });
});

describe("usage compensation writes", () => {
  test("writes one entry per compaction request with the purpose upstream uses", () => {
    const expected: Array<[string, string]> = [
      ["compaction_summary", "compaction:summary"],
      ["compaction_short_summary", "compaction:short-summary"],
      ["compaction_turn_prefix", "compaction:turn-prefix"],
      ["handoff", "compaction:handoff"],
    ];
    for (const [kind, purpose] of expected) {
      const slot = accessorSlot();
      const session = fakeLedger();
      attempt(slot, { session });
      const config = slot.config({ telemetry: undefined, sessionId: "session-1" });
      if (config === undefined) throw new Error("expected a configuration");

      request(config, kind, {
        spend: { input: 1, output: 2, cacheRead: 3, cacheWrite: 4, total: 10 },
      });

      expect(session.writes).toEqual([
        {
          write: {
            purpose,
            api: API,
            provider: PROVIDER,
            model: MODEL,
            usage: {
              input: 250,
              output: 50,
              cacheRead: 40,
              cacheWrite: 10,
              totalTokens: 350,
              cost: { input: 1, output: 2, cacheRead: 3, cacheWrite: 4, total: 10 },
            },
            stopReason: "stop",
          },
          owner: { sessionId: "session-1", parentId: "leaf-1" },
        },
      ]);
      expect(installedRegistry().entries).toBe(1);
      expect(installedRegistry().costMissing).toBe(0);
      globalSlots()[REGISTRY_KEY] = undefined;
    }
  });

  test("records a failed attempt that still consumed tokens", () => {
    const slot = accessorSlot();
    const session = fakeLedger();
    attempt(slot, { session });
    const config = slot.config({ telemetry: undefined, sessionId: "session-1" });
    if (config === undefined) throw new Error("expected a configuration");

    // The host writes the terminal status of the span, which is what carries
    // `aborted`, only after the usage event this module reads, so the finish
    // reason is the only reading available here.
    request(config, "compaction_summary", {
      spend: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, total: 3 },
      attributes: [[FINISH_REASONS_ATTRIBUTE, ["error"]]],
      event: { usage: { inputTokens: 120, outputTokens: 0, totalTokens: 120 } },
    });

    expect(session.writes[0]?.write.stopReason).toBe("error");
    expect(session.writes[0]?.write.usage.input).toBe(120);
    expect(installedRegistry().entries).toBe(1);
  });

  test("counts an entry the journal refused as unwritten", () => {
    const slot = accessorSlot();
    const session = fakeLedger("session-1", "leaf-1", false);
    attempt(slot, { session });
    const config = slot.config({ telemetry: undefined, sessionId: "session-1" });
    if (config === undefined) throw new Error("expected a configuration");

    request(config, "compaction_turn_prefix", {
      spend: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, total: 3 },
      attributes: [[FINISH_REASONS_ATTRIBUTE, ["stop"]]],
      event: { usage: { inputTokens: 12, outputTokens: 3, totalTokens: 15 } },
    });

    expect(session.writes).toHaveLength(1);
    expect(installedRegistry().entries).toBe(0);
    expect(installedRegistry().costMissing).toBe(0);
    expect(usageStatusFromRegistry({ status: "enabled" })).toEqual({
      status: "enabled",
      detail: "entries=0 unrecorded=1(write-failed)",
    });
  });

  test("skips attempts that consumed no tokens", () => {
    const slot = accessorSlot();
    const session = fakeLedger();
    attempt(slot, { session });
    const config = slot.config({ telemetry: undefined, sessionId: "session-1" });
    if (config === undefined) throw new Error("expected a configuration");

    request(config, "compaction_summary", {
      attributes: [[FINISH_REASONS_ATTRIBUTE, ["error"]]],
      event: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
    });

    expect(session.writes).toEqual([]);
    expect(installedRegistry().entries).toBe(0);
    expect(installedRegistry().costMissing).toBe(0);
    expect(usageStatusFromRegistry({ status: "enabled" })).toEqual({ status: "enabled", detail: "entries=0" });
  });

  test("skips requests that are not compaction ones", () => {
    const slot = accessorSlot();
    const session = fakeLedger();
    attempt(slot, { session });
    const config = slot.config({ telemetry: undefined, sessionId: "session-1" });
    if (config === undefined) throw new Error("expected a configuration");

    request(config, undefined);
    request(config, "compaction_native");
    request(config, "evaluation");
    request(config, "branch_summary");

    expect(session.writes).toEqual([]);
    expect(installedRegistry().entries).toBe(0);
  });

  test("skips a request whose session never started and reports it", () => {
    const slot = accessorSlot();
    const session = fakeLedger("session-1");
    const setup = attempt(slot, { session });
    const config = slot.config({ telemetry: undefined, sessionId: "session-9" });
    if (config === undefined) throw new Error("expected a configuration");

    request(config, "compaction_summary", { event: { conversationId: "session-9" } });

    expect(session.writes).toEqual([]);
    expect(setup.reports.join("\n")).toContain("compactionUsage:session-unregistered");
    expect(usageStatusFromRegistry({ status: "enabled" })).toEqual({
      status: "enabled",
      detail: "entries=0 unrecorded=1(session-unregistered)",
    });
  });

  test("routes a request to the session it names", () => {
    const slot = accessorSlot();
    const first = fakeLedger("session-1");
    const second = fakeLedger("session-2");
    attempt(slot, { session: first });
    attempt(slot, { session: second, runtimeId: "other-runtime" });
    const config = slot.config({ telemetry: undefined, sessionId: "session-1" });
    if (config === undefined) throw new Error("expected a configuration");

    request(config, "compaction_summary", { event: { conversationId: "session-2" } });

    expect(first.writes).toEqual([]);
    expect(second.writes).toHaveLength(1);
    expect(second.writes[0]?.owner.sessionId).toBe("session-2");
  });

  test("falls back to the agent's own session when the event names none", () => {
    const slot = accessorSlot();
    const session = fakeLedger("session-1");
    attempt(slot, { session });
    const config = slot.config({ telemetry: undefined, sessionId: "session-1" });
    if (config === undefined) throw new Error("expected a configuration");

    const tracer = config.tracer as RecordingTracer;
    const span = tracer.startSpan("chat");
    span.setAttribute(ONESHOT_KIND_ATTRIBUTE, "compaction_summary");
    const event = usageEvent(span);
    delete event.conversationId;
    (config.onChatUsage as (inner: unknown) => unknown)(event);

    expect(session.writes).toHaveLength(1);
  });

  test("writes a zero cost and counts it when the provider reported none", () => {
    const slot = accessorSlot();
    const session = fakeLedger();
    attempt(slot, { session });
    const config = slot.config({ telemetry: undefined, sessionId: "session-1" });
    if (config === undefined) throw new Error("expected a configuration");

    request(config, "compaction_summary");

    expect(session.writes[0]?.write.usage.cost).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 });
    expect(installedRegistry().costMissing).toBe(1);
    expect(usageStatusFromRegistry({ status: "enabled" })).toEqual({
      status: "enabled",
      detail: "entries=1 costMissing=1",
    });
  });

  test("claims a provider-computed cost once and leaves later requests uncosted", () => {
    const slot = accessorSlot();
    const session = fakeLedger();
    attempt(slot, { session });
    const config = slot.config({ telemetry: undefined, sessionId: "session-1" });
    if (config === undefined) throw new Error("expected a configuration");

    request(config, "compaction_summary", { spend: { input: 7, output: 8, cacheRead: 9, cacheWrite: 10, total: 34 } });
    request(config, "compaction_short_summary", {
      spend: { input: 1, output: 1, cacheRead: 1, cacheWrite: 1, total: 4 },
    });
    request(config, "handoff");

    expect(session.writes.map((entry) => entry.write.usage.cost)).toEqual([
      { input: 7, output: 8, cacheRead: 9, cacheWrite: 10, total: 34 },
      { input: 1, output: 1, cacheRead: 1, cacheWrite: 1, total: 4 },
      { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    ]);
    expect(installedRegistry().entries).toBe(3);
    expect(installedRegistry().costMissing).toBe(1);
  });

  test("skips a request whose api it cannot name", () => {
    const slot = accessorSlot();
    const session = fakeLedger();
    const models: ModelQuery = { resolve: () => undefined };
    const setup = attempt(slot, { session: { ...session, models } });
    const config = slot.config({ telemetry: undefined, sessionId: "session-1" });
    if (config === undefined) throw new Error("expected a configuration");

    request(config, "compaction_summary", { spend: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, total: 3 } });

    expect(session.writes).toEqual([]);
    expect(setup.reports.join("\n")).toContain("compactionUsage:api-unresolved");
    expect(usageStatusFromRegistry({ status: "enabled" })).toEqual({
      status: "enabled",
      detail: "entries=0 unrecorded=1(api-unresolved)",
    });
  });

  test("names the api through the provider id the host reported", () => {
    const slot = accessorSlot();
    const session = fakeLedger();
    // The normalized telemetry label names no model of its own; only the raw
    // provider id resolves, and only the qualified lookup reaches it.
    const models: ModelQuery = {
      resolve: (spec) =>
        spec === `sample-provider-id/${MODEL}`
          ? { id: MODEL, provider: "sample-provider-id", api: "by-provider-id" }
          : undefined,
    };
    attempt(slot, { session: { ...session, models } });
    const config = slot.config({ telemetry: undefined, sessionId: "session-1" });
    if (config === undefined) throw new Error("expected a configuration");

    request(config, "compaction_summary", { ids: { providerId: "sample-provider-id", modelId: MODEL } });

    expect(session.writes[0]?.write.api).toBe("by-provider-id");
    expect(session.writes[0]?.write.provider).toBe("sample-provider-id");
    expect(session.writes[0]?.write.usage.cost.total).toBe(0);
    expect(installedRegistry().costMissing).toBe(1);
  });

  test("stores the provider id the request ran under, not the telemetry label", () => {
    const slot = accessorSlot();
    const session = fakeLedger();
    const models: ModelQuery = {
      list: () => [{ id: MODEL, provider: "raw-provider", api: API }],
      resolve: () => undefined,
    };
    attempt(slot, { session: { ...session, models } });
    const config = slot.config({ telemetry: undefined, sessionId: "session-1" });
    if (config === undefined) throw new Error("expected a configuration");

    // A host that normalizes provider ids for telemetry reports the label to the
    // usage event and the raw id to its cost estimator; the raw id is the id the
    // journal stores.
    request(config, "compaction_summary", { ids: { providerId: "raw-provider" } });
    expect(session.writes[0]?.write.provider).toBe("raw-provider");
    expect(session.writes[0]?.write.api).toBe(API);

    // A host that carries the raw id on the event itself is read the same way.
    request(config, "compaction_summary", { event: { providerId: "raw-provider" } });
    expect(session.writes[1]?.write.provider).toBe("raw-provider");
    expect(session.writes[1]?.write.api).toBe(API);
  });

  test("resolves the session's single entry for the request's model", () => {
    const slot = accessorSlot();
    const session = fakeLedger();
    attempt(slot, { session: { ...session, models: fakeModels() } });
    const config = slot.config({ telemetry: undefined, sessionId: "session-1" });
    if (config === undefined) throw new Error("expected a configuration");

    // No raw provider id reached this request, and one catalog entry offers this
    // model id: that entry is the request's identity, whatever the label says.
    request(config, "compaction_summary");

    expect(session.writes[0]?.write.provider).toBe(PROVIDER);
    expect(session.writes[0]?.write.api).toBe(API);
  });

  test("does not take a telemetry label that matches a registered provider as the identity", () => {
    const slot = accessorSlot();
    const session = fakeLedger();
    // The default normalization reports `openai-codex` as `openai`, and this
    // session serves the model under both ids: the label matching `openai` does
    // not mean the request ran there, so it decides nothing.
    const models: ModelQuery = {
      resolve: () => undefined,
      list: () => [
        { id: MODEL, provider: "openai", api: "openai-responses" },
        { id: MODEL, provider: "openai-codex", api: "openai-codex-responses" },
      ],
    };
    const setup = attempt(slot, { session: { ...session, models } });
    const config = slot.config({ telemetry: undefined, sessionId: "session-1" });
    if (config === undefined) throw new Error("expected a configuration");

    request(config, "compaction_summary", { event: { provider: "openai" } });

    expect(session.writes).toEqual([]);
    expect(setup.reports.join("\n")).toContain("compactionUsage:api-unresolved");
    expect(usageStatusFromRegistry({ status: "enabled" })).toEqual({
      status: "enabled",
      detail: "entries=0 unrecorded=1(api-unresolved)",
    });
  });

  test("resolves a telemetry label through a catalog that offers the model once", () => {
    const slot = accessorSlot();
    const session = fakeLedger();
    // `google` reaches the event as `gcp.gemini`, which names no provider of this
    // session; one catalog entry for this model id is the request's identity.
    const models: ModelQuery = {
      list: () => [{ id: MODEL, provider: "google", api: "google-generative-ai" }],
      resolve: () => undefined,
    };
    attempt(slot, { session: { ...session, models } });
    const config = slot.config({ telemetry: undefined, sessionId: "session-1" });
    if (config === undefined) throw new Error("expected a configuration");

    request(config, "compaction_summary", { event: { provider: "gcp.gemini" } });

    expect(session.writes[0]?.write.provider).toBe("google");
    expect(session.writes[0]?.write.api).toBe("google-generative-ai");
  });

  test("skips a model id that two providers serve under a telemetry label", () => {
    const slot = accessorSlot();
    const session = fakeLedger();
    // Two providers offer this model id, and the label names neither: writing one
    // of them would record the other provider's api for this request.
    const models: ModelQuery = {
      list: () => [
        { id: MODEL, provider: "example-provider", api: API },
        { id: MODEL, provider: "google", api: "google-generative-ai" },
      ],
      resolve: () => undefined,
    };
    const setup = attempt(slot, { session: { ...session, models } });
    const config = slot.config({ telemetry: undefined, sessionId: "session-1" });
    if (config === undefined) throw new Error("expected a configuration");

    request(config, "compaction_summary", { event: { provider: "gcp.gemini" } });

    expect(session.writes).toEqual([]);
    expect(setup.reports.join("\n")).toContain("compactionUsage:api-unresolved");
    expect(usageStatusFromRegistry({ status: "enabled" })).toEqual({
      status: "enabled",
      detail: "entries=0 unrecorded=1(api-unresolved)",
    });
  });

  test("takes the raw provider id over another provider's model of the same id", () => {
    const slot = accessorSlot();
    const session = fakeLedger();
    const models: ModelQuery = {
      list: () => [
        { id: MODEL, provider: "example-provider", api: API },
        { id: MODEL, provider: "google", api: "google-generative-ai" },
      ],
      resolve: () => undefined,
    };
    attempt(slot, { session: { ...session, models } });
    const config = slot.config({ telemetry: undefined, sessionId: "session-1" });
    if (config === undefined) throw new Error("expected a configuration");

    // The event carries the normalized label, and the estimator path carries the
    // raw provider id beside it: the raw id picks this request's own entry out of
    // a catalog that offers the same model id under another provider.
    request(config, "compaction_summary", { ids: { providerId: "google" } });

    expect(session.writes[0]?.write.provider).toBe("google");
    expect(session.writes[0]?.write.api).toBe("google-generative-ai");
  });

  test("skips a raw provider id that names no model of this session", () => {
    const slot = accessorSlot();
    const session = fakeLedger();
    // The estimator path names the provider this request ran under, and the
    // session offers that model id under another provider only. That provider's
    // api is not written in place of the one this request ran on.
    const models: ModelQuery = {
      list: () => [{ id: MODEL, provider: "example-provider", api: API }],
      resolve: () => undefined,
    };
    const setup = attempt(slot, { session: { ...session, models } });
    const config = slot.config({ telemetry: undefined, sessionId: "session-1" });
    if (config === undefined) throw new Error("expected a configuration");

    request(config, "compaction_summary", { ids: { providerId: "google" } });

    expect(session.writes).toEqual([]);
    expect(setup.reports.join("\n")).toContain("compactionUsage:api-unresolved");
    expect(usageStatusFromRegistry({ status: "enabled" })).toEqual({
      status: "enabled",
      detail: "entries=0 unrecorded=1(api-unresolved)",
    });
  });

  test("follows a session that switches to another journal", async () => {
    const slot = accessorSlot();
    const session = fakeLedger("session-1");
    const { harness } = attempt(slot, { session });
    const config = slot.config({ telemetry: undefined, sessionId: "session-1" });
    if (config === undefined) throw new Error("expected a configuration");

    request(config, "compaction_summary");
    expect(session.writes[0]?.owner.sessionId).toBe("session-1");

    // `/new` keeps this manager and moves it to a second journal, and the host
    // runs the activation only once.
    session.switchTo("session-2");
    await harness.emit(
      "session_switch",
      { reason: "new" },
      harness.context({
        sessionManager: session.ledger,
        models: fakeModels(),
      } as never),
    );

    request(config, "compaction_summary", { event: { conversationId: "session-2" } });
    expect(session.writes).toHaveLength(2);
    expect(session.writes[1]?.owner.sessionId).toBe("session-2");
    expect(installedRegistry().entries).toBe(2);

    // The journal the session left is no longer this manager's, so a request
    // that still names it is not written into the new one.
    request(config, "compaction_summary", { event: { conversationId: "session-1" } });
    expect(session.writes).toHaveLength(2);
    expect(usageStatusFromRegistry({ status: "enabled" })).toEqual({
      status: "enabled",
      detail: "entries=2 costMissing=2 unrecorded=1(session-unregistered)",
    });
  });
});

describe("usage compensation and the host's configuration", () => {
  test("keeps an existing configuration and its hooks in place", () => {
    const slot = accessorSlot();
    const session = fakeLedger();
    const userTracer = recordingTracer();
    const seen: unknown[] = [];
    const costs: unknown[] = [];
    attempt(slot, { session });
    const config = slot.config({
      telemetry: {
        tracer: userTracer,
        captureContent: true,
        exporter: "example-exporter",
        costEstimator: (context: unknown) => {
          costs.push(context);
          return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };
        },
        onChatUsage: (event: unknown) => seen.push(event),
      },
      sessionId: "session-1",
    });
    if (config === undefined) throw new Error("expected a configuration");

    // The user's tracer still makes the span; the module interposes on it so the
    // oneshot kind can be read, and every other field passes through.
    expect(config.tracer).not.toBe(userTracer);
    expect(config.captureContent).toBe(true);
    expect(config.exporter).toBe("example-exporter");

    request(config, "compaction_summary", { spend: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, total: 3 } });

    expect(userTracer.spans).toHaveLength(1);
    expect(costs).toHaveLength(1);
    expect(seen).toHaveLength(1);
    expect(session.writes).toHaveLength(1);
    expect(session.writes[0]?.write.usage.cost.total).toBe(3);
  });

  test("creates no span of its own for an agent without a configuration", () => {
    const slot = accessorSlot();
    const session = fakeLedger();
    attempt(slot, { session });
    const config = slot.config({ telemetry: undefined, sessionId: "session-1" });
    if (config === undefined) throw new Error("expected a configuration");

    const tracer = config.tracer as Record<string, unknown>;
    expect(tracer.isRecording).toBeUndefined();
    expect((tracer.startSpan as (name: string) => { isRecording(): boolean })("chat").isRecording()).toBe(false);

    request(config, "compaction_summary", { spend: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, total: 3 } });

    expect(session.writes).toHaveLength(1);
    expect(session.writes[0]?.write.usage.cost.total).toBe(3);
  });

  test("records through the inert tracer's spans as the host's own", () => {
    const slot = accessorSlot();
    const session = fakeLedger();
    attempt(slot, { session });
    const config = slot.config({ telemetry: undefined, sessionId: "session-1" });
    if (config === undefined) throw new Error("expected a configuration");

    const tracer = config.tracer as {
      startSpan(name: string): { setAttributes(values: Record<string, unknown>): void };
    };
    const span = tracer.startSpan("chat");
    span.setAttributes({ [ONESHOT_KIND_ATTRIBUTE]: "compaction_turn_prefix", "other.attribute": "dropped" });
    (config.onChatUsage as (inner: unknown) => unknown)(usageEvent(span));

    expect(session.writes[0]?.write.purpose).toBe("compaction:turn-prefix");
    expect(installedRegistry().readings.get(span as object)).toEqual({
      [ONESHOT_KIND_ATTRIBUTE]: "compaction_turn_prefix",
    });
  });
});

describe("usage compensation and an inherited configuration", () => {
  test("keeps the user hooks of an inherited configuration running once each", () => {
    const slot = accessorSlot();
    const session = fakeLedger();
    attempt(slot, { session });
    const userTracer = recordingTracer();
    const costs: unknown[] = [];
    const seen: unknown[] = [];
    const parent = slot.config({
      telemetry: {
        tracer: userTracer,
        captureContent: true,
        costEstimator: (context: unknown) => {
          costs.push(context);
          return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };
        },
        onChatUsage: (event: unknown) => seen.push(event),
      },
      sessionId: "session-1",
    });
    if (parent === undefined) throw new Error("expected a configuration");
    // The host hands a child agent a shallow copy of the configuration it read
    // from the parent, hooks and tracer included.
    const child = slot.config({ telemetry: { ...parent }, sessionId: "session-1" });
    if (child === undefined) throw new Error("expected a configuration");

    request(child, "handoff", {
      spend: { input: 1, output: 2, cacheRead: 3, cacheWrite: 4, total: 10 },
      ids: { providerId: PROVIDER, modelId: MODEL },
    });

    expect(session.writes).toHaveLength(1);
    expect(session.writes[0]?.write).toMatchObject({
      purpose: "compaction:handoff",
      api: API,
      provider: PROVIDER,
      model: MODEL,
    });
    expect(session.writes[0]?.write.usage.cost.total).toBe(10);
    expect(costs).toHaveLength(1);
    expect(seen).toHaveLength(1);
    expect(userTracer.spans).toHaveLength(1);
    expect(installedRegistry()).toMatchObject({ entries: 1, costMissing: 0, unrecorded: 0 });
  });

  test("processes a configuration inherited twice as one request", () => {
    const slot = accessorSlot();
    const session = fakeLedger();
    const { reports } = attempt(slot, { session });
    const parent = slot.config({ telemetry: undefined, sessionId: "session-1" });
    if (parent === undefined) throw new Error("expected a configuration");
    const child = slot.config({ telemetry: { ...parent }, sessionId: "session-1" });
    if (child === undefined) throw new Error("expected a configuration");
    const grandchild = slot.config({ telemetry: { ...child }, sessionId: "session-1" });
    if (grandchild === undefined) throw new Error("expected a configuration");

    request(grandchild, "handoff", {
      spend: { input: 1, output: 2, cacheRead: 3, cacheWrite: 4, total: 10 },
      ids: { providerId: PROVIDER, modelId: MODEL },
    });

    expect(reports).toEqual([]);
    expect(session.writes).toHaveLength(1);
    expect(session.writes[0]?.write.usage.cost.total).toBe(10);
    expect(installedRegistry()).toMatchObject({ entries: 1, costMissing: 0, unrecorded: 0 });
  });

  test("keeps one inherited request recorded when the catalog names several providers", () => {
    const slot = accessorSlot();
    const session = fakeLedger();
    // Two providers offer the same model id, so the catalog alone cannot say
    // which one ran the request.
    const ambiguousCatalog = fakeModels({
      list: () => [
        { id: MODEL, provider: PROVIDER, api: API },
        { id: MODEL, provider: "other-provider", api: API },
      ],
    });
    const { reports } = attempt(slot, { session: { ledger: session.ledger, models: ambiguousCatalog } });
    const parent = slot.config({ telemetry: undefined, sessionId: "session-1" });
    if (parent === undefined) throw new Error("expected a configuration");
    const child = slot.config({ telemetry: { ...parent }, sessionId: "session-1" });
    if (child === undefined) throw new Error("expected a configuration");

    request(child, "handoff", {
      spend: { input: 1, output: 2, cacheRead: 3, cacheWrite: 4, total: 10 },
      ids: { providerId: PROVIDER, modelId: MODEL },
    });

    expect(reports).toEqual([]);
    expect(session.writes).toHaveLength(1);
    expect(session.writes[0]?.write).toMatchObject({ provider: PROVIDER, api: API, model: MODEL });
    expect(session.writes[0]?.write.usage.cost.total).toBe(10);
    expect(session.writes[0]?.owner.sessionId).toBe("session-1");
    expect(installedRegistry()).toMatchObject({ entries: 1, costMissing: 0, unrecorded: 0 });
  });

  test("records an inherited request in the session that ran it", () => {
    const slot = accessorSlot();
    const childSession = fakeLedger("child-1");
    const { reports } = attempt(slot, { session: { ledger: childSession.ledger } });
    const parent = slot.config({ telemetry: undefined, sessionId: "parent-1" });
    if (parent === undefined) throw new Error("expected a configuration");
    const child = slot.config({ telemetry: { ...parent }, sessionId: "child-1" });
    if (child === undefined) throw new Error("expected a configuration");

    // An event without a usable conversation id follows the session the agent
    // that ran the request belongs to, which is the child's and not its parent's.
    request(child, "handoff", {
      spend: { input: 1, output: 2, cacheRead: 3, cacheWrite: 4, total: 10 },
      ids: { providerId: PROVIDER, modelId: MODEL },
      event: { conversationId: "" },
    });

    expect(reports).toEqual([]);
    expect(childSession.writes).toHaveLength(1);
    expect(childSession.writes[0]?.owner).toEqual({ sessionId: "child-1", parentId: "leaf-1" });
    expect(childSession.writes[0]?.write.usage.cost.total).toBe(10);
    expect(installedRegistry()).toMatchObject({ entries: 1, costMissing: 0, unrecorded: 0 });
  });
});

describe("usage compensation ownership", () => {
  test("stops a patch another runtime installed and gives the accessor back", () => {
    const slot = accessorSlot();
    attempt(slot, { session: fakeLedger() });
    const installed = slot.current() as TelemetryAccessor;

    stopForeignUsagePatch("other-runtime", slot.deps);

    expect(slot.current()?.get).toBe(slot.native.get);
    expect(slot.current()?.get).not.toBe(installed.get);
    expect(usageStatusFromRegistry({ status: "enabled" })).toEqual({
      status: "incompatible",
      reason: "runtime-conflict",
    });
    expect(stopForeignUsagePatch("another-runtime", slot.deps)).toBeUndefined();
  });

  test("leaves its own runtime's patch in place", () => {
    const slot = accessorSlot();
    attempt(slot, { session: fakeLedger() });
    const installed = slot.current() as TelemetryAccessor;

    expect(stopForeignUsagePatch(TEST_RUNTIME_ID, slot.deps)).toBeUndefined();
    expect(slot.current()?.get).toBe(installed.get);
    expect(usageStatusFromRegistry({ status: "enabled" })).toEqual({ status: "enabled", detail: "entries=0" });
  });

  test("refuses to install again after its own patch stopped", () => {
    const slot = accessorSlot();
    attempt(slot, { session: fakeLedger() });
    stopForeignUsagePatch("other-runtime", slot.deps);

    const setup = attempt(slot, { session: fakeLedger(), runtimeId: "third-runtime" });

    expect(setup.state).toEqual({ status: "incompatible", reason: "runtime-conflict" });
    // One install, then the release that put the host's own accessor back.
    expect(slot.installs()).toBe(2);
  });
});

describe("usage compensation helpers", () => {
  test("rebuilds the journal's usage shape from the event", () => {
    expect(
      buildUsage(
        { inputTokens: 300, outputTokens: 50, totalTokens: 350, cachedInputTokens: 40, cacheWriteTokens: 10 },
        undefined,
      ),
    ).toEqual({
      input: 250,
      output: 50,
      cacheRead: 40,
      cacheWrite: 10,
      totalTokens: 350,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    });
    expect(buildUsage({ inputTokens: 120, outputTokens: 0 }, undefined)).toEqual({
      input: 120,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 120,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    });
    // Cached buckets never make the input negative, whatever the provider reports.
    expect(buildUsage({ inputTokens: 10, cachedInputTokens: 40, outputTokens: 5 }, undefined).input).toBe(0);
  });

  test("reads the stop reason from the span attributes", () => {
    expect(readStopReason({ [FINISH_REASONS_ATTRIBUTE]: ["length"] })).toBe("length");
    expect(readStopReason({ [FINISH_REASONS_ATTRIBUTE]: ["tool_calls"] })).toBe("toolUse");
    expect(readStopReason({ [FINISH_REASONS_ATTRIBUTE]: ["stop"] })).toBe("stop");
    expect(readStopReason({ [FINISH_REASONS_ATTRIBUTE]: ["error"] })).toBe("error");
    expect(readStopReason({})).toBe("stop");
    expect(readStopReason(undefined)).toBe("stop");
    // The terminal status that names an abort arrives after the usage event, so
    // an attribute that is not a finish reason changes nothing.
    expect(readStopReason({ "error.type": "aborted", [FINISH_REASONS_ATTRIBUTE]: ["error"] })).toBe("error");
  });

  test("resolves a request's own identity through the session's model query", () => {
    const models = fakeModels();
    expect(resolveRequestModel(models, MODEL, undefined, undefined)).toEqual({
      provider: PROVIDER,
      api: API,
    });
    // A raw provider id that names no entry of this session resolves nothing,
    // and it never falls through to the catalog.
    expect(resolveRequestModel(models, MODEL, "other-provider", undefined)).toBeUndefined();
    expect(resolveRequestModel(undefined, MODEL, undefined, undefined)).toBeUndefined();

    // The provider id the estimator path reports is the id the journal stores,
    // so it is resolved as itself and never through a model id alone.
    const byId: ModelQuery = {
      resolve: (spec) =>
        spec === `raw-provider/${MODEL}` ? { id: MODEL, provider: "raw-provider", api: "by-provider-id" } : undefined,
    };
    expect(resolveRequestModel(byId, MODEL, "raw-provider", undefined)).toEqual({
      provider: "raw-provider",
      api: "by-provider-id",
    });
    expect(resolveRequestModel(byId, MODEL, "other-raw-provider", undefined)).toBeUndefined();

    // A catalog entry under another provider is not this request's identity.
    const crossed: ModelQuery = {
      resolve: () => undefined,
      list: () => [{ id: MODEL, provider: "other-provider", api: API }],
    };
    expect(resolveRequestModel(crossed, MODEL, "raw-provider", undefined)).toBeUndefined();

    // A catalog that offers this model once settles the identity, and two
    // providers offering it settle nothing. The event's telemetry label never
    // takes part: `openai-codex` reports as `openai`, so a label naming a
    // registered provider does not prove the request ran under that provider.
    const sole: ModelQuery = {
      resolve: () => undefined,
      list: () => [{ id: MODEL, provider: "google", api: "google-generative-ai" }],
    };
    expect(resolveRequestModel(sole, MODEL, undefined, undefined)).toEqual({
      provider: "google",
      api: "google-generative-ai",
    });
    const shared: ModelQuery = {
      resolve: () => undefined,
      list: () => [
        { id: MODEL, provider: "google", api: "google-generative-ai" },
        { id: MODEL, provider: "openai-codex", api: "openai-codex-responses" },
      ],
    };
    expect(resolveRequestModel(shared, MODEL, undefined, undefined)).toBeUndefined();
    // Without a catalog, the label cannot be settled at all.
    expect(resolveRequestModel({ resolve: () => undefined }, MODEL, undefined, undefined)).toBeUndefined();

    // One provider's own entry stands even when the catalog carries a decoy.
    const catalog: ModelQuery = {
      resolve: () => undefined,
      list: () => [
        { id: MODEL, provider: "example-provider", api: API },
        { id: MODEL, provider: "google", api: "google-generative-ai" },
      ],
    };
    expect(resolveRequestModel(catalog, MODEL, "google", undefined)).toEqual({
      provider: "google",
      api: "google-generative-ai",
    });
  });

  test("counts a request as token-bearing only when a bucket is non-zero", () => {
    expect(hasTokens(undefined)).toBe(false);
    expect(hasTokens({})).toBe(false);
    expect(hasTokens({ inputTokens: 0, outputTokens: 0 })).toBe(false);
    expect(hasTokens({ outputTokens: 1 })).toBe(true);
    expect(hasTokens({ cachedInputTokens: 5 })).toBe(true);
    expect(hasTokens({ cacheWriteTokens: 5 })).toBe(true);
  });
});
