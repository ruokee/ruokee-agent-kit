/**
 * Context fragment composition: the context window glyph plus usage text.
 *
 * Output shapes (from the spec):
 * - percent:  `<U+F0068> ctx 12%`
 * - absolute: `<U+F0068> 14.7K`
 *
 * The glyph is static: it does not blink and does not change with usage. It
 * joins the usage text with a plain space inside the same fragment,
 * bypassing the top-level separator. Without usage data, or with a context
 * window of zero or less, the fragment is absent.
 */

import type { ProviderFragment } from "./provider-api.ts";
import { formatTokenCount } from "./format.ts";

/** Color of the context window glyph. */
export const CONTEXT_GLYPH_COLOR = "#5fafaf";

/** Nerd Font glyph marking the context window, matching OMP `icon.auto`. */
export const CONTEXT_GLYPH = "\u{F0068}";

/** Build the context provider fragment. */
export function composeContextFragment(
  usage: { tokens: number; contextWindow: number; percent: number } | undefined,
  mode: string,
): ProviderFragment | undefined {
  if (usage === undefined || usage.contextWindow <= 0) {
    return undefined;
  }
  const usageText = mode === "absolute" ? formatTokenCount(usage.tokens) : `ctx ${Math.round(usage.percent)}%`;
  return {
    spans: [{ text: CONTEXT_GLYPH, color: CONTEXT_GLYPH_COLOR, dim: true }, { text: " " }, { text: usageText }],
  };
}
