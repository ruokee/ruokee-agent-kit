/**
 * Settings schema, defaults, and runtime validation.
 *
 * OMP owns configuration: it merges user values with project overrides and
 * parses the result, and the extension reads that merged object through the
 * public plugin settings getter. Nothing here reads a configuration file, and
 * nothing here invents a value source.
 *
 * Validation mirrors the `omp.settings` manifest defaults. A missing key takes
 * the default; an explicit `null`, a wrong type, a non-finite number, a
 * fractional value for an integer field, an out-of-range number, or an unknown
 * enum value invalidates that key. Faults stay local: a bad compaction number
 * disables the compaction module and leaves the others alone, while faults that
 * make the whole object unusable keep every module on native behavior.
 */

/** The modules this package can switch on and off. */
export const MODULE_IDS = ["wait", "recovery", "compaction", "replay"] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

/** Recovery eligibility modes. */
export const RECOVERY_MODES = ["knownTransient", "unclassified"] as const;
export type RecoveryMode = (typeof RECOVERY_MODES)[number];

/** Bounds shared by the validated settings and the `wait` tool parameter. */
export const WAIT_SECONDS_MIN = 0.05;
export const WAIT_SECONDS_MAX = 3600;

/** Bounds of the compaction experiment numbers. */
export const COMPACTION_TIMEOUT_MAX_MS = 3_600_000;
export const COMPACTION_FLOOR_MIN_MS = 300_000;
export const COMPACTION_GUARD_MAX_MS = 14_400_000;

/** Manifest defaults, mirrored by the runtime validation below. */
export const SETTINGS_DEFAULTS = {
  enabled: true,
  waitEnabled: true,
  waitContinueEmptyWindows: true,
  waitJobsSeconds: 1200,
  waitMessagesSeconds: 1200,
  waitProcessSeconds: 1200,
  recoveryEnabled: true,
  recoveryMode: "knownTransient",
  recoveryMaxAttempts: 8,
  recoveryBackoffBaseMs: 1000,
  recoveryBackoffMaxMs: 8000,
  recoveryNotify: true,
  compactionTimeoutEnabled: false,
  compactionTimeoutMs: 900_000,
  compactionTimeoutFloorMs: 300_000,
  compactionWindowGuardMs: 3_600_000,
  compactionTimeoutNotify: true,
  replayEnabled: true,
} as const;

/** Settings of the hub wait module. */
export interface WaitSettings {
  enabled: boolean;
  continueEmptyWindows: boolean;
  jobsSeconds: number;
  messagesSeconds: number;
  processSeconds: number;
}

/** Settings of the model-error recovery module. */
export interface RecoverySettings {
  enabled: boolean;
  mode: RecoveryMode;
  maxAttempts: number;
  backoffBaseMs: number;
  backoffMaxMs: number;
  notify: boolean;
}

/** Settings of the experimental compaction deadline module. */
export interface CompactionSettings {
  enabled: boolean;
  timeoutMs: number;
  floorMs: number;
  guardMs: number;
  notify: boolean;
}

/** Settings of the native-history replay module. */
export interface ReplaySettings {
  enabled: boolean;
}

/** One validated activation snapshot; modules read their own slice. */
export interface QolSettings {
  /** Master switch: false keeps every module on native behavior. */
  enabled: boolean;
  wait: WaitSettings;
  recovery: RecoverySettings;
  compaction: CompactionSettings;
  replay: ReplaySettings;
}

/** Why one key failed validation. Rules are named so diagnostics never echo a value. */
export type FieldRule = "type" | "null" | "finite" | "integer" | "range" | "enum" | "unknown-key" | "root" | "reader";

/** One rejected key with the module it disables. */
export interface FieldProblem {
  module: ModuleId | "global";
  key: string;
  rule: FieldRule;
}

/** Result of validating one effective settings object. */
export type SettingsParseResult =
  | { kind: "loaded"; settings: QolSettings; problems: FieldProblem[]; invalidModules: ModuleId[] }
  | { kind: "global-error"; problems: FieldProblem[] };

interface NumberRule {
  /** Lower bound, inclusive. */
  min?: number;
  /** Upper bound, inclusive. */
  max?: number;
  /** Reject fractional values. */
  integer?: boolean;
}

type Read<T> = { ok: true; value: T } | { ok: false; problem: FieldProblem };

/** Narrow an untrusted settings root. Compiled schemas are unavailable for a getter result. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Read a boolean: a missing key takes the default, `null` is explicit and invalid. */
function readBoolean(raw: Record<string, unknown>, key: string, module: ModuleId, fallback: boolean): Read<boolean> {
  const value = raw[key];
  if (value === undefined) return { ok: true, value: fallback };
  if (value === null) return { ok: false, problem: { module, key, rule: "null" } };
  if (typeof value !== "boolean") return { ok: false, problem: { module, key, rule: "type" } };
  return { ok: true, value };
}

/** Read an enum member: anything outside the manifest values is refused. */
function readEnum<T extends string>(
  raw: Record<string, unknown>,
  key: string,
  module: ModuleId,
  values: readonly T[],
  fallback: T,
): Read<T> {
  const value = raw[key];
  if (value === undefined) return { ok: true, value: fallback };
  if (value === null) return { ok: false, problem: { module, key, rule: "null" } };
  if (typeof value !== "string") return { ok: false, problem: { module, key, rule: "type" } };
  const match = values.find((candidate) => candidate === value);
  if (match === undefined) return { ok: false, problem: { module, key, rule: "enum" } };
  return { ok: true, value: match };
}

/** Read a validated number, distinguishing type, finiteness, integrality, and range faults. */
function readNumber(
  raw: Record<string, unknown>,
  key: string,
  module: ModuleId,
  fallback: number,
  rule: NumberRule,
): Read<number> {
  const value = raw[key];
  if (value === undefined) return { ok: true, value: fallback };
  if (value === null) return { ok: false, problem: { module, key, rule: "null" } };
  if (typeof value !== "number") return { ok: false, problem: { module, key, rule: "type" } };
  if (!Number.isFinite(value)) return { ok: false, problem: { module, key, rule: "finite" } };
  if (rule.integer === true && !Number.isInteger(value))
    return { ok: false, problem: { module, key, rule: "integer" } };
  if (rule.min !== undefined && value < rule.min) return { ok: false, problem: { module, key, rule: "range" } };
  if (rule.max !== undefined && value > rule.max) return { ok: false, problem: { module, key, rule: "range" } };
  return { ok: true, value };
}

/**
 * Validate one effective object returned by the settings getter.
 *
 * A root that is not an object, an unknown key, or a wrong `enabled` type is a
 * global error: every module stays on native behavior. Everything else is local
 * to the module that owns the key.
 */
export function parseQolSettings(raw: unknown): SettingsParseResult {
  if (!isPlainObject(raw)) {
    return { kind: "global-error", problems: [{ module: "global", key: "settings", rule: "root" }] };
  }

  const knownKeys = new Set(Object.keys(SETTINGS_DEFAULTS));
  const unknown = Object.keys(raw)
    .filter((key) => !knownKeys.has(key))
    .sort();
  if (unknown.length > 0) {
    return {
      kind: "global-error",
      problems: unknown.map((key) => ({ module: "global", key, rule: "unknown-key" }) as const),
    };
  }

  const enabled = raw.enabled;
  if (enabled !== undefined && (enabled === null || typeof enabled !== "boolean")) {
    const rule: FieldRule = enabled === null ? "null" : "type";
    return { kind: "global-error", problems: [{ module: "global", key: "enabled", rule }] };
  }

  const waitEnabled = readBoolean(raw, "waitEnabled", "wait", SETTINGS_DEFAULTS.waitEnabled);
  const continueEmptyWindows = readBoolean(
    raw,
    "waitContinueEmptyWindows",
    "wait",
    SETTINGS_DEFAULTS.waitContinueEmptyWindows,
  );
  const jobsSeconds = readNumber(raw, "waitJobsSeconds", "wait", SETTINGS_DEFAULTS.waitJobsSeconds, {
    min: WAIT_SECONDS_MIN,
    max: WAIT_SECONDS_MAX,
  });
  const messagesSeconds = readNumber(raw, "waitMessagesSeconds", "wait", SETTINGS_DEFAULTS.waitMessagesSeconds, {
    min: WAIT_SECONDS_MIN,
    max: WAIT_SECONDS_MAX,
  });
  const processSeconds = readNumber(raw, "waitProcessSeconds", "wait", SETTINGS_DEFAULTS.waitProcessSeconds, {
    min: WAIT_SECONDS_MIN,
    max: WAIT_SECONDS_MAX,
  });

  const recoveryEnabled = readBoolean(raw, "recoveryEnabled", "recovery", SETTINGS_DEFAULTS.recoveryEnabled);
  const recoveryMode = readEnum(raw, "recoveryMode", "recovery", RECOVERY_MODES, SETTINGS_DEFAULTS.recoveryMode);
  const maxAttempts = readNumber(raw, "recoveryMaxAttempts", "recovery", SETTINGS_DEFAULTS.recoveryMaxAttempts, {
    min: 1,
    max: 8,
    integer: true,
  });
  const backoffBaseMs = readNumber(raw, "recoveryBackoffBaseMs", "recovery", SETTINGS_DEFAULTS.recoveryBackoffBaseMs, {
    min: 1,
    max: 10_000,
    integer: true,
  });
  const baseForRange = backoffBaseMs.ok ? backoffBaseMs.value : SETTINGS_DEFAULTS.recoveryBackoffBaseMs;
  const backoffMaxMs = readNumber(raw, "recoveryBackoffMaxMs", "recovery", SETTINGS_DEFAULTS.recoveryBackoffMaxMs, {
    min: baseForRange,
    max: 10_000,
    integer: true,
  });
  const recoveryNotify = readBoolean(raw, "recoveryNotify", "recovery", SETTINGS_DEFAULTS.recoveryNotify);

  const compactionEnabled = readBoolean(
    raw,
    "compactionTimeoutEnabled",
    "compaction",
    SETTINGS_DEFAULTS.compactionTimeoutEnabled,
  );
  const floorMs = readNumber(
    raw,
    "compactionTimeoutFloorMs",
    "compaction",
    SETTINGS_DEFAULTS.compactionTimeoutFloorMs,
    {
      min: COMPACTION_FLOOR_MIN_MS,
      max: COMPACTION_TIMEOUT_MAX_MS - 1,
      integer: true,
    },
  );
  const floorForRange = floorMs.ok ? floorMs.value : SETTINGS_DEFAULTS.compactionTimeoutFloorMs;
  const timeoutMs = readNumber(raw, "compactionTimeoutMs", "compaction", SETTINGS_DEFAULTS.compactionTimeoutMs, {
    min: floorForRange + 1,
    max: COMPACTION_TIMEOUT_MAX_MS,
    integer: true,
  });
  const timeoutForRange = timeoutMs.ok ? timeoutMs.value : SETTINGS_DEFAULTS.compactionTimeoutMs;
  const guardMs = readNumber(raw, "compactionWindowGuardMs", "compaction", SETTINGS_DEFAULTS.compactionWindowGuardMs, {
    min: timeoutForRange,
    max: COMPACTION_GUARD_MAX_MS,
    integer: true,
  });
  const compactionNotify = readBoolean(
    raw,
    "compactionTimeoutNotify",
    "compaction",
    SETTINGS_DEFAULTS.compactionTimeoutNotify,
  );
  const replayEnabled = readBoolean(raw, "replayEnabled", "replay", SETTINGS_DEFAULTS.replayEnabled);

  const reads: Read<unknown>[] = [
    waitEnabled,
    continueEmptyWindows,
    jobsSeconds,
    messagesSeconds,
    processSeconds,
    recoveryEnabled,
    recoveryMode,
    maxAttempts,
    backoffBaseMs,
    backoffMaxMs,
    recoveryNotify,
    compactionEnabled,
    floorMs,
    timeoutMs,
    guardMs,
    compactionNotify,
    replayEnabled,
  ];
  const problems: FieldProblem[] = [];
  for (const read of reads) if (!read.ok) problems.push(read.problem);

  const invalidModules = MODULE_IDS.filter((id) => problems.some((found) => found.module === id));

  return {
    kind: "loaded",
    invalidModules,
    problems,
    settings: {
      enabled: enabled === undefined ? SETTINGS_DEFAULTS.enabled : enabled,
      wait: {
        enabled: waitEnabled.ok ? waitEnabled.value : SETTINGS_DEFAULTS.waitEnabled,
        continueEmptyWindows: continueEmptyWindows.ok
          ? continueEmptyWindows.value
          : SETTINGS_DEFAULTS.waitContinueEmptyWindows,
        jobsSeconds: jobsSeconds.ok ? jobsSeconds.value : SETTINGS_DEFAULTS.waitJobsSeconds,
        messagesSeconds: messagesSeconds.ok ? messagesSeconds.value : SETTINGS_DEFAULTS.waitMessagesSeconds,
        processSeconds: processSeconds.ok ? processSeconds.value : SETTINGS_DEFAULTS.waitProcessSeconds,
      },
      recovery: {
        enabled: recoveryEnabled.ok ? recoveryEnabled.value : SETTINGS_DEFAULTS.recoveryEnabled,
        mode: recoveryMode.ok ? recoveryMode.value : SETTINGS_DEFAULTS.recoveryMode,
        maxAttempts: maxAttempts.ok ? maxAttempts.value : SETTINGS_DEFAULTS.recoveryMaxAttempts,
        backoffBaseMs: backoffBaseMs.ok ? backoffBaseMs.value : SETTINGS_DEFAULTS.recoveryBackoffBaseMs,
        backoffMaxMs: backoffMaxMs.ok ? backoffMaxMs.value : SETTINGS_DEFAULTS.recoveryBackoffMaxMs,
        notify: recoveryNotify.ok ? recoveryNotify.value : SETTINGS_DEFAULTS.recoveryNotify,
      },
      compaction: {
        enabled: compactionEnabled.ok ? compactionEnabled.value : SETTINGS_DEFAULTS.compactionTimeoutEnabled,
        timeoutMs: timeoutMs.ok ? timeoutMs.value : SETTINGS_DEFAULTS.compactionTimeoutMs,
        floorMs: floorMs.ok ? floorMs.value : SETTINGS_DEFAULTS.compactionTimeoutFloorMs,
        guardMs: guardMs.ok ? guardMs.value : SETTINGS_DEFAULTS.compactionWindowGuardMs,
        notify: compactionNotify.ok ? compactionNotify.value : SETTINGS_DEFAULTS.compactionTimeoutNotify,
      },
      replay: {
        enabled: replayEnabled.ok ? replayEnabled.value : SETTINGS_DEFAULTS.replayEnabled,
      },
    },
  };
}

/** Render the problems of one module as `key=rule` fragments, without echoing values. */
export function describeProblems(problems: readonly FieldProblem[], module: ModuleId | "global"): string {
  return problems
    .filter((found) => found.module === module)
    .map((found) => `${found.key}=${found.rule}`)
    .join(" ");
}
