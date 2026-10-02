/**
 * Conversation-scoped token accounting for the bundled token metrics.
 *
 * OMP records two kinds of token usage on a session branch: a message's own
 * usage, which is traffic the conversation sent, and standalone
 * `model_usage` entries, which carry out-of-band work such as the Find
 * judgment cascade. OMP's `getUsageStatistics()` sums both into one
 * session total, so a metric that reads it reports cache misses and a cache
 * hit rate for work the conversation never sent: the judgment cascade always
 * reports `cacheRead: 0`, which drags the rate down for the rest of the
 * session.
 *
 * This module derives the conversation totals from the branch instead.
 * Assistant message usage and `task` tool result usage count; every
 * `model_usage` entry is skipped. The result is session-cumulative for the
 * branch the session currently holds, including any tree navigation or
 * branching that changes which history is in front.
 *
 * Structural views keep this module free of OMP types; callers pass the
 * branch from `sessionManager.getBranch()`.
 */

import { isObject, type UnknownRecord } from "./object-guard.ts";
import type { UsageStats } from "./snapshot.ts";

/** The token buckets every consumed usage record contributes. */
const USAGE_FIELDS = ["input", "cacheWrite", "cacheRead", "output"] as const;

/** Structural view of one session entry this module reads. */
export interface ConversationEntryLike {
  readonly type?: string | undefined;
  readonly message?: unknown;
}

/**
 * Sum the conversation usage recorded along one branch. Entries this module
 * does not recognize, missing usage, and non-finite counters contribute
 * zero, so an unexpected host shape reports fewer tokens instead of `NaN`.
 */
export function sumConversationUsage(branch: readonly ConversationEntryLike[]): UsageStats {
  const totals = { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 };
  for (const entry of branch) {
    if (!isObject(entry) || entry.type !== "message") continue;
    const usage = usageOf(entry.message);
    if (usage === undefined) continue;
    for (const field of USAGE_FIELDS) {
      const value = usage[field];
      if (typeof value === "number" && Number.isFinite(value)) totals[field] += value;
    }
  }
  return totals;
}

/**
 * Usage one message contributes: an assistant message's own usage, or the
 * usage a completed `task` tool result reports for the subagent it ran.
 * Every other role and tool contributes nothing.
 */
function usageOf(message: unknown): UnknownRecord | undefined {
  if (!isObject(message)) return undefined;
  if (message.role === "assistant") {
    return isObject(message.usage) ? message.usage : undefined;
  }
  if (message.role === "toolResult" && message.toolName === "task") {
    return isObject(message.details) && isObject(message.details.usage) ? message.details.usage : undefined;
  }
  return undefined;
}
