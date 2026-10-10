export type Mode = "standard" | "hooks";
export interface Settings {
  readonly enabled: boolean;
  readonly provider: string;
  readonly mode: Mode;
}
export type SettingsResult =
  { readonly ok: true; readonly settings: Settings } | { readonly ok: false; readonly reason: string };

/** Validate the native getter's activation snapshot without echoing private values or keys. */
export function parseSettings(raw: unknown): SettingsResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, reason: "settings-root-invalid" };
  const values = raw as Record<string, unknown>;
  const keys = ["compactionCacheEnabled", "compactionCacheProvider", "compactionCacheMode"];
  if (Object.keys(values).some((key) => !keys.includes(key))) return { ok: false, reason: "settings-unknown-key" };
  const enabled = values.compactionCacheEnabled ?? false;
  const provider = values.compactionCacheProvider ?? "";
  const mode = values.compactionCacheMode ?? "hooks";
  if (values.compactionCacheEnabled === null || typeof enabled !== "boolean")
    return { ok: false, reason: "compactionCacheEnabled=type" };
  if (values.compactionCacheProvider === null || typeof provider !== "string")
    return { ok: false, reason: "compactionCacheProvider=type" };
  if (mode !== "standard" && mode !== "hooks") return { ok: false, reason: "compactionCacheMode=enum" };
  if (values.compactionCacheMode === null) return { ok: false, reason: "compactionCacheMode=enum" };
  return { ok: true, settings: { enabled, provider, mode } };
}
