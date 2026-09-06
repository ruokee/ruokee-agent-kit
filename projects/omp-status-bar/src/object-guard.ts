/**
 * Canonical object type guard for this package.
 *
 * This is a standalone package without a shared type-guard module, so this
 * file is the single definition site. Callers import `isObject` from here;
 * do not recreate the guard at individual call sites.
 */

export type UnknownRecord = Record<string, unknown>;

/** True when the value is a non-null, non-array object. */
export function isObject(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
