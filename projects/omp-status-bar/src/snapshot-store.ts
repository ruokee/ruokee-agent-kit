/**
 * Module-level binding between the live OMP session and the bundled
 * providers. The extension sets the sources at `session_start` and clears
 * them at `session_shutdown`; providers read through the shared snapshot
 * store so one sampler feeds every instance.
 */
import type { ContextUsage } from "@oh-my-pi/pi-coding-agent";
import type { SnapshotSources, CompactionSettingsShape } from "./snapshot.ts";
import { SnapshotStore as SnapshotStoreImpl } from "./snapshot.ts";
export type { CompactionSettingsShape, SnapshotSources } from "./snapshot.ts";
export { FALLBACK_COMPACTION } from "./snapshot.ts";

/** The one session-scoped store; reset only in tests. */
let store: SnapshotStoreImpl | undefined;

/** Access the shared snapshot store, creating it on first use. */
export function getSnapshotStore(): SnapshotStoreImpl {
  if (store === undefined) {
    store = new SnapshotStoreImpl();
  }
  return store;
}

/** Live sources bound by the extension; undefined outside a session. */
let sources: SnapshotSources | undefined;

/** Bind live session sources at session start. */
export function bindSessionSources(input: {
  getUsageStatistics: () => { input: number; cacheWrite: number; cacheRead: number; output: number };
  getContextUsage: () => ContextUsage | undefined;
  getModel: () => { provider: string; id: string; contextWindow: number | null; input: readonly string[] } | undefined;
  getCompactionSettings: () => CompactionSettingsShape | undefined;
}): void {
  sources = {
    getUsageStatistics: input.getUsageStatistics,
    getContextUsage: input.getContextUsage,
    getModel: input.getModel,
    getCompactionSettings: input.getCompactionSettings,
  };
  getSnapshotStore().bind(sources);
}

/** Release the sources at session shutdown; ticks become no-ops after this. */
export function unbindSessionSources(): void {
  sources = undefined;
  getSnapshotStore().unbind();
}

/** Reset both the store and the binding; tests only. */
export function resetSnapshotStoreForTests(): void {
  sources = undefined;
  store = undefined;
}
