/**
 * Settings validation and default tests (matrix C01).
 *
 * The manifest defaults and the runtime defaults are compared key by key, and
 * every validation rule is exercised through the public parse entry point.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  COMPACTION_FLOOR_MIN_MS,
  COMPACTION_GUARD_MAX_MS,
  COMPACTION_TIMEOUT_MAX_MS,
  MODULE_IDS,
  parseQolSettings,
  SETTINGS_DEFAULTS,
  WAIT_SECONDS_MAX,
  WAIT_SECONDS_MIN,
} from "../src/settings.ts";

interface ManifestShape {
  omp?: { settings?: Record<string, { type?: string; default?: unknown; min?: number; max?: number }> };
}

const manifest = JSON.parse(readFileSync(path.join(import.meta.dir, "..", "package.json"), "utf8")) as ManifestShape;

function parse(raw: unknown) {
  const result = parseQolSettings(raw);
  if (result.kind !== "loaded") throw new Error(`expected a loaded result, got ${result.kind}`);
  return result;
}

describe("manifest and runtime defaults", () => {
  test("every manifest setting has the same runtime default and type", () => {
    const settings = manifest.omp?.settings ?? {};
    expect(Object.keys(settings).sort()).toEqual(Object.keys(SETTINGS_DEFAULTS).sort());
    for (const [key, declared] of Object.entries(settings)) {
      expect(declared.default).toBe(SETTINGS_DEFAULTS[key as keyof typeof SETTINGS_DEFAULTS]);
    }
    expect(settings.compactionTimeoutEnabled?.type).toBe("boolean");
    expect(settings.recoveryMode?.type).toBe("enum");
  });

  test("an empty object takes every default", () => {
    const { settings, problems, invalidModules } = parse({});
    expect(problems).toEqual([]);
    expect(invalidModules).toEqual([]);
    expect(settings.enabled).toBe(true);
    expect(settings.wait).toEqual({
      enabled: true,
      continueEmptyWindows: true,
      jobsSeconds: 1200,
      messagesSeconds: 1200,
      processSeconds: 1200,
    });
    expect(settings.recovery).toEqual({
      enabled: true,
      mode: "knownTransient",
      maxAttempts: 8,
      backoffBaseMs: 1000,
      backoffMaxMs: 8000,
      notify: true,
    });
    expect(settings.compaction).toEqual({
      enabled: false,
      timeoutMs: 900000,
      floorMs: 300000,
      guardMs: 3600000,
      notify: true,
    });
    expect(settings.replay).toEqual({ enabled: true });
  });

  test("accepted values include every boundary of the documented ranges", () => {
    const { settings, problems } = parse({
      enabled: false,
      waitEnabled: false,
      waitContinueEmptyWindows: false,
      waitJobsSeconds: WAIT_SECONDS_MIN,
      waitMessagesSeconds: WAIT_SECONDS_MAX,
      waitProcessSeconds: 0.5,
      recoveryEnabled: false,
      recoveryMode: "unclassified",
      recoveryMaxAttempts: 1,
      recoveryBackoffBaseMs: 10_000,
      recoveryBackoffMaxMs: 10_000,
      recoveryNotify: false,
      compactionTimeoutEnabled: true,
      compactionTimeoutFloorMs: COMPACTION_FLOOR_MIN_MS,
      compactionTimeoutMs: COMPACTION_TIMEOUT_MAX_MS,
      compactionWindowGuardMs: COMPACTION_GUARD_MAX_MS,
      compactionTimeoutNotify: false,
      replayEnabled: false,
    });
    expect(problems).toEqual([]);
    expect(settings.enabled).toBe(false);
    expect(settings.wait.jobsSeconds).toBe(WAIT_SECONDS_MIN);
    expect(settings.wait.messagesSeconds).toBe(WAIT_SECONDS_MAX);
    expect(settings.recovery.mode).toBe("unclassified");
    expect(settings.compaction.timeoutMs).toBe(COMPACTION_TIMEOUT_MAX_MS);
    expect(settings.compaction.guardMs).toBe(COMPACTION_GUARD_MAX_MS);
  });
});

describe("rejected values", () => {
  const cases: Array<[string, Record<string, unknown>, string]> = [
    ["explicit null", { waitJobsSeconds: null }, "waitJobsSeconds=null"],
    ["wrong type", { waitEnabled: "yes" }, "waitEnabled=type"],
    ["non-finite number", { waitJobsSeconds: Number.POSITIVE_INFINITY }, "waitJobsSeconds=finite"],
    ["NaN", { waitMessagesSeconds: Number.NaN }, "waitMessagesSeconds=finite"],
    ["fractional integer field", { recoveryMaxAttempts: 2.5 }, "recoveryMaxAttempts=integer"],
    ["below the range", { waitProcessSeconds: 0.01 }, "waitProcessSeconds=range"],
    ["above the range", { waitJobsSeconds: 3600.5 }, "waitJobsSeconds=range"],
    ["unknown enum value", { recoveryMode: "always" }, "recoveryMode=enum"],
    ["enum of the wrong type", { recoveryMode: 3 }, "recoveryMode=type"],
    ["attempts above the host budget", { recoveryMaxAttempts: 9 }, "recoveryMaxAttempts=range"],
    ["attempts below one", { recoveryMaxAttempts: 0 }, "recoveryMaxAttempts=range"],
    ["backoff maximum below the base", { recoveryBackoffMaxMs: 500 }, "recoveryBackoffMaxMs=range"],
    ["floor below the native deadline", { compactionTimeoutFloorMs: 299_999 }, "compactionTimeoutFloorMs=range"],
    ["timeout at the floor", { compactionTimeoutMs: 300_000 }, "compactionTimeoutMs=range"],
    ["guard below the timeout", { compactionWindowGuardMs: 800_000 }, "compactionWindowGuardMs=range"],
    ["guard above the maintenance bound", { compactionWindowGuardMs: 14_400_001 }, "compactionWindowGuardMs=range"],
    ["fractional timeout", { compactionTimeoutMs: 900_000.5 }, "compactionTimeoutMs=integer"],
    ["a non-boolean replay switch", { replayEnabled: "on" }, "replayEnabled=type"],
  ];

  for (const [label, raw, expected] of cases) {
    test(`reports ${label}`, () => {
      const { problems, invalidModules } = parse(raw);
      const rendered = problems.map((problem) => `${problem.key}=${problem.rule}`);
      expect(rendered).toContain(expected);
      expect(invalidModules.length).toBe(1);
    });
  }

  test("a fault in one module leaves the other modules usable", () => {
    const { problems, invalidModules } = parse({ recoveryMaxAttempts: 0 });
    expect(invalidModules).toEqual(["recovery"]);
    expect(problems).toEqual([{ module: "recovery", key: "recoveryMaxAttempts", rule: "range" }]);
  });

  test("an invalid value is reported even when its module is switched off", () => {
    const { problems, invalidModules } = parse({ waitEnabled: false, waitJobsSeconds: "long" });
    expect(problems).toEqual([{ module: "wait", key: "waitJobsSeconds", rule: "type" }]);
    expect(invalidModules).toEqual(["wait"]);
  });

  test("several faults across modules are all reported", () => {
    const { invalidModules, problems } = parse({ waitJobsSeconds: -1, compactionTimeoutMs: 1.5 });
    expect(invalidModules).toEqual(["wait", "compaction"]);
    expect(problems.map((problem) => problem.module)).toEqual(["wait", "compaction"]);
    expect(MODULE_IDS).toEqual(["wait", "recovery", "compaction", "replay"]);
  });
});

describe("global faults", () => {
  const cases: Array<[string, unknown, string]> = [
    ["a non-object root", 42, "settings=root"],
    ["an array root", [], "settings=root"],
    ["a null root", null, "settings=root"],
    ["an unknown key", { waitJobsTimeouts: 5 }, "waitJobsTimeouts=unknown-key"],
    ["a wrong master switch", { enabled: "true" }, "enabled=type"],
    ["an explicit null master switch", { enabled: null }, "enabled=null"],
  ];

  for (const [label, raw, expected] of cases) {
    test(`rejects ${label} for every module`, () => {
      const result = parseQolSettings(raw);
      expect(result.kind).toBe("global-error");
      if (result.kind !== "global-error") return;
      expect(result.problems.map((problem) => `${problem.key}=${problem.rule}`)).toContain(expected);
      expect(result.problems.every((problem) => problem.module === "global")).toBe(true);
    });
  }

  test("unknown keys are reported in a stable order", () => {
    const result = parseQolSettings({ zeta: 1, alpha: 2 });
    expect(result.kind).toBe("global-error");
    if (result.kind !== "global-error") return;
    expect(result.problems.map((problem) => problem.key)).toEqual(["alpha", "zeta"]);
  });
});
