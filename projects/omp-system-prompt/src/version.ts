/**
 * Version gate for the extension.
 *
 * The extension supports exactly OMP 18.1.11. The host version comes from
 * the public `VERSION` export; anything else leaves every input unchanged.
 */

export const SUPPORTED_HOST_VERSION = "18.1.11";

/** True only when the host reports the exact supported version. */
export function isSupportedVersion(version: string | undefined | null): boolean {
  return version === SUPPORTED_HOST_VERSION;
}
