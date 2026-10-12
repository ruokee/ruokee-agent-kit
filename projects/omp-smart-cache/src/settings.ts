export type Mode = "standard" | "hooks";
export interface RemoteSettings {
  readonly enabled: boolean;
  readonly provider: string;
  readonly mode: Mode;
}
export type RemoteResult =
  { readonly ok: true; readonly settings: RemoteSettings } | { readonly ok: false; readonly reason: string };
export interface HandoffSettings {
  readonly enabled: boolean;
}
export type HandoffResult =
  { readonly ok: true; readonly settings: HandoffSettings } | { readonly ok: false; readonly reason: string };
export interface Settings {
  readonly remote: RemoteResult;
  readonly handoff: HandoffResult;
}

const REMOTE = ["compactionCacheEnabled", "compactionCacheProvider", "compactionCacheMode"] as const;
const HANDOFF = ["handoffCacheEnabled"] as const;

/** Validate the native getter's activation snapshot without echoing private values or keys. */
export function parseSettings(raw: unknown): Settings {
  // A root or key-set failure leaves no honest per-capability value to report.
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return {
      remote: { ok: false, reason: "settings-root-invalid" },
      handoff: { ok: false, reason: "settings-root-invalid" },
    };
  const values = raw as Record<string, unknown>;
  const known: readonly string[] = [...REMOTE, ...HANDOFF];
  if (Object.keys(values).some((key) => !known.includes(key)))
    return {
      remote: { ok: false, reason: "settings-unknown-key" },
      handoff: { ok: false, reason: "settings-unknown-key" },
    };
  const enabled = values.compactionCacheEnabled ?? false,
    provider = values.compactionCacheProvider ?? "",
    mode = values.compactionCacheMode ?? "hooks",
    handoff = values.handoffCacheEnabled ?? false;
  const remote: RemoteResult =
    values.compactionCacheEnabled === null || typeof enabled !== "boolean"
      ? { ok: false, reason: "compactionCacheEnabled=type" }
      : values.compactionCacheProvider === null || typeof provider !== "string"
        ? { ok: false, reason: "compactionCacheProvider=type" }
        : values.compactionCacheMode === null || (mode !== "standard" && mode !== "hooks")
          ? { ok: false, reason: "compactionCacheMode=enum" }
          : { ok: true, settings: { enabled, provider, mode } };
  // One capability's invalid value leaves the other capability's activation intact.
  const side: HandoffResult =
    values.handoffCacheEnabled === null || typeof handoff !== "boolean"
      ? { ok: false, reason: "handoffCacheEnabled=type" }
      : { ok: true, settings: { enabled: handoff } };
  return { remote, handoff: side };
}
