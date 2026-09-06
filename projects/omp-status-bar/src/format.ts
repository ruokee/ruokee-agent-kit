/**
 * Decimal token formatter shared by the token metrics and the context
 * provider's absolute mode.
 *
 * Rules (schema version 1):
 * 1. Non-finite and non-positive values render `0`.
 * 2. Below `1000`, the rounded integer.
 * 3. `1000`-scale with `K`, `M`, `G`, `T` units.
 * 4. A scaled value below `99.95` keeps one decimal, with a trailing `.0`
 *    removed.
 * 5. A scaled value at or above `99.95` renders as an integer.
 * 6. A scaled value reaching `999.5` promotes to the next unit, so
 *    `1000K` never renders.
 */

const UNITS = ["K", "M", "G", "T"] as const;

export function formatTokenCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) {
    return "0";
  }
  if (count < 1000) {
    return String(Math.round(count));
  }
  let value = count / 1000;
  let unitIndex = 0;
  // Promote while the scaled value would still display as `1000` or more of
  // the current unit (`999.5` rounds to `1000`); the unit caps at `T` and
  // larger magnitudes keep counting on `T` (1200T, 12000T, ...).
  while (unitIndex < UNITS.length - 1 && value >= 999.5) {
    value /= 1000;
    unitIndex++;
  }
  const unit = UNITS[unitIndex];
  if (value < 99.95) {
    const fixed = value.toFixed(1);
    return fixed.endsWith(".0") ? `${fixed.slice(0, -2)}${unit}` : `${fixed}${unit}`;
  }
  return `${Math.round(value)}${unit}`;
}
