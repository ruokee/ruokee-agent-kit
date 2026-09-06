/**
 * Context fragment composition: usage text plus the speculation indicator.
 *
 * Output shapes (from the spec):
 * - percent:  `ctx 12%`
 * - absolute: `14.7K`
 *
 * The indicator glyph joins the usage text with a plain space inside the
 * same fragment, bypassing the top-level separator. `hidden` contributes no
 * glyph. `normal` is the glyph dimmed in the emphasis color; `indicating`
 * flips between that dim frame and the lit frame via `blinkPhase`.
 */

import type { ProviderFragment, ProviderSpan } from "./provider-api.ts";
import { formatTokenCount } from "./format.ts";
import type { SpeculationState } from "./speculation.ts";

/** Emphasis color of the indicator; the dim frame uses the same color. */
export const SPECULATION_COLOR = "#5fafaf";

/** Nerd Font glyph matching OMP `icon.auto`. */
export const SPECULATION_GLYPH = "\u{F0068}";

/**
 * Build the context provider fragment.
 *
 * @param blinkPhase true renders the emphasis frame of the blink; false the
 *   dim frame. Only meaningful while `indicating`.
 */
export function composeContextFragment(
  usage: { tokens: number; contextWindow: number; percent: number } | undefined,
  mode: string,
  state: SpeculationState,
  blinkPhase = false,
): ProviderFragment | undefined {
  if (usage === undefined || usage.contextWindow <= 0) {
    return undefined;
  }
  const spans: ProviderSpan[] = [];
  const usageText = mode === "absolute" ? formatTokenCount(usage.tokens) : `ctx ${Math.round(usage.percent)}%`;
  spans.push({ text: usageText });
  if (state !== "hidden") {
    spans.push({ text: " " });
    if (state === "indicating" && blinkPhase) {
      spans.push({ text: SPECULATION_GLYPH, color: SPECULATION_COLOR });
    } else {
      spans.push({ text: SPECULATION_GLYPH, color: SPECULATION_COLOR, dim: true });
    }
  }
  return { spans };
}
