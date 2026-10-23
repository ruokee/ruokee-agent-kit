export type Mode = "standard" | "hooks";
export interface RemoteSettings {
  readonly enabled: boolean;
  readonly provider: string;
  readonly mode: Mode;
}
export type RemoteResult =
  { readonly ok: true; readonly settings: RemoteSettings } | { readonly ok: false; readonly reason: string };
export type ToggleResult =
  | { readonly ok: true; readonly settings: { readonly enabled: boolean } }
  | { readonly ok: false; readonly reason: string };
export interface AlignmentSettings {
  readonly remote: RemoteResult;
  readonly handoff: ToggleResult;
}
export interface Settings extends AlignmentSettings {
  readonly compactionUsage: ToggleResult;
  readonly modelPrompts: ToggleResult;
}
export interface ModuleState {
  readonly status: "pending" | "enabled" | "disabled" | "invalid" | "incompatible";
  readonly reason?: string;
  readonly detail?: string;
}

const KEYS: Record<string, true> = {
  compactionCacheEnabled: true,
  compactionCacheProvider: true,
  compactionCacheMode: true,
  handoffCacheEnabled: true,
  compactionUsageEnabled: true,
  modelPromptsEnabled: true,
};

export function rejectedSettings(reason: string): Settings {
  return {
    remote: { ok: false, reason },
    handoff: { ok: false, reason },
    compactionUsage: { ok: false, reason },
    modelPrompts: { ok: false, reason },
  };
}

function toggle(values: Record<string, unknown>, key: string, fallback: boolean): ToggleResult {
  const value = values[key];
  return value === undefined || typeof value === "boolean"
    ? { ok: true, settings: { enabled: value ?? fallback } }
    : { ok: false, reason: `${key}=type` };
}

/** Validate one native activation snapshot without echoing private values or unknown keys. */
export function parseSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return rejectedSettings("settings-root-invalid");
  const values = raw as Record<string, unknown>;
  if (Object.keys(values).some((key) => !Object.hasOwn(KEYS, key))) return rejectedSettings("settings-unknown-key");
  const enabled = values.compactionCacheEnabled ?? false,
    provider = values.compactionCacheProvider ?? "",
    mode = values.compactionCacheMode ?? "hooks";
  const remote: RemoteResult =
    values.compactionCacheEnabled === null || typeof enabled !== "boolean"
      ? { ok: false, reason: "compactionCacheEnabled=type" }
      : values.compactionCacheProvider === null || typeof provider !== "string"
        ? { ok: false, reason: "compactionCacheProvider=type" }
        : values.compactionCacheMode === null || (mode !== "standard" && mode !== "hooks")
          ? { ok: false, reason: "compactionCacheMode=enum" }
          : { ok: true, settings: { enabled, provider, mode } };
  return {
    remote,
    handoff: toggle(values, "handoffCacheEnabled", false),
    compactionUsage: toggle(values, "compactionUsageEnabled", true),
    modelPrompts: toggle(values, "modelPromptsEnabled", false),
  };
}
