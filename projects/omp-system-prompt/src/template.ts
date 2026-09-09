/**
 * Maintainer-owned template for the replacement main block.
 *
 * The template carries owned static English text plus `%%name%%` slots.
 * The transformer fills each slot with a verbatim segment extracted from
 * the host's rendered default main block. Slot values are data, never
 * re-parsed or recursively rendered.
 */

/** One slot in the owned template, keyed by its `%%name%%` marker. */
export type SlotName =
  "tools" | "devices" | "internal-urls" | "skills" | "always-apply-rules" | "domain-rules" | "runtime-modes";

export const SLOT_NAMES: readonly SlotName[] = [
  "tools",
  "devices",
  "internal-urls",
  "skills",
  "always-apply-rules",
  "domain-rules",
  "runtime-modes",
] as const;

export const TEMPLATE_FILE_NAME = "prompt-template.md";

const SLOT_MARKER_RE = /%%([a-z-]+)%%/g;
const DELIVERY_MARKER = "\n\n# Delivery\n";
const DELIVERY_HEADINGS = ["# Delivery", "## Task scope", "## Completion", "## Evidence", "## Pausing"] as const;

export interface TemplateVariants {
  withDelivery: string;
  withoutDelivery: string;
}

/**
 * Validate the final Delivery chapter and derive its two supported shapes.
 *
 * The chapter is deliberately located by the exact blank-line boundary and
 * must contain the four known subsections in order. No later top-level
 * heading is accepted, so the no-Delivery shape can be derived without a
 * second static template.
 */
export function getTemplateVariants(template: string): TemplateVariants | null {
  const normalized = template.replace(/\n+$/u, "");
  const deliveryAt = normalized.indexOf(DELIVERY_MARKER);
  if (deliveryAt <= 0 || normalized.indexOf(DELIVERY_MARKER, deliveryAt + DELIVERY_MARKER.length) !== -1) {
    return null;
  }

  const delivery = normalized.slice(deliveryAt + 2);
  const lines = delivery.split("\n");
  if (lines[0] !== DELIVERY_HEADINGS[0]) return null;

  const headingCounts = new Map<string, number>();
  for (const line of lines) {
    if (line.startsWith("# ") && line !== DELIVERY_HEADINGS[0]) return null;
    if (line.startsWith("## ") && !DELIVERY_HEADINGS.includes(line as (typeof DELIVERY_HEADINGS)[number])) return null;
    if (DELIVERY_HEADINGS.includes(line as (typeof DELIVERY_HEADINGS)[number])) {
      headingCounts.set(line, (headingCounts.get(line) ?? 0) + 1);
    }
  }
  let previous = -1;
  for (const heading of DELIVERY_HEADINGS) {
    if (headingCounts.get(heading) !== 1) return null;
    const position = lines.indexOf(heading);
    if (position <= previous) return null;
    previous = position;
  }

  return {
    withDelivery: normalized,
    withoutDelivery: normalized.slice(0, deliveryAt),
  };
}

/**
 * Read and validate the owned template once at activation.
 *
 * Returns the normalized template text with slot markers intact, or `null`
 * when the file is missing, empty, structurally invalid, or carries an
 * unknown or duplicated marker. A broken template must never reach the
 * transformer, which would otherwise splice retained content into an
 * unintended place.
 */
export function loadTemplate(read: (path: string) => string, resolve: (name: string) => string): string | null {
  let text: string;
  try {
    text = read(resolve(TEMPLATE_FILE_NAME));
  } catch {
    return null;
  }
  if (text.trim().length === 0) return null;
  const seen = new Map<string, number>();
  for (const match of text.matchAll(SLOT_MARKER_RE)) {
    const name = match[1];
    if (name === undefined || !SLOT_NAMES.includes(name as SlotName)) return null;
    seen.set(name, (seen.get(name) ?? 0) + 1);
  }
  for (const name of SLOT_NAMES) {
    if (seen.get(name) !== 1) return null;
  }
  const variants = getTemplateVariants(text);
  return variants?.withDelivery ?? null;
}
