/**
 * Shared runtime type guards for unvalidated values.
 */

/** Whether the value is a non-array plain object. */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
