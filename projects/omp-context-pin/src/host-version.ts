/**
 * Host version gate.
 *
 * `package.json` declares the peer range `>=18.1.8 <19`. Peer metadata is not a
 * runtime check, so activation compares the host's public `VERSION` against the
 * same bounds. That value is the `@oh-my-pi/pi-utils` package version, which the
 * host package re-exports, so the gate assumes both ship the same version line.
 * Only the leading `major.minor.patch` triple is read, and a `-suffix` is kept
 * as the prerelease marker semver gives it: `18.1.8-beta.2` sorts below the
 * minimum `18.1.8` and is unsupported, while a prerelease above the minimum
 * sorts above it and passes. A value whose suffix is not semver leaves it
 * unreadable, like a value that carries no readable triple: the caller falls
 * back to the capability probes instead of blocking a working host.
 */

/** Lowest supported host version, matching the declared peer range. */
export const MIN_HOST_VERSION = { major: 18, minor: 1, patch: 8 };

/** Exclusive upper bound of the supported major version. */
export const MAX_HOST_MAJOR = 19;

export interface HostVersion {
  major: number;
  minor: number;
  patch: number;
  /** Whether the version string carried a `-suffix`. */
  prerelease: boolean;
}

/** How a host version string relates to the declared range. */
export type VersionSupport = "supported" | "unsupported" | "unknown";

/** Suffix a semver version carries: an optional `-prerelease` then `+build` marker. */
const VERSION_SUFFIX = /^(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/** Read the leading `major.minor.patch` triple of a host version string. */
export function parseHostVersion(version: string): HostVersion | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)(.*)$/.exec(version.trim());
  if (match === null) return undefined;
  const suffix = match[4] ?? "";
  // A suffix that is neither a semver prerelease nor a build marker leaves the
  // string unreadable, so the gate reports it as unknown and the caller falls
  // back to the capability probes instead of placing that host in the range.
  if (!VERSION_SUFFIX.test(suffix)) return undefined;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: suffix.startsWith("-"),
  };
}

/**
 * Classify a host version against the declared peer range.
 *
 * `unknown` means the string carried no readable triple; it is not a rejection.
 */
export function classifyHostVersion(version: string): VersionSupport {
  const parsed = parseHostVersion(version);
  if (parsed === undefined) return "unknown";
  if (parsed.major >= MAX_HOST_MAJOR || parsed.major < MIN_HOST_VERSION.major) return "unsupported";
  if (parsed.minor !== MIN_HOST_VERSION.minor)
    return parsed.minor > MIN_HOST_VERSION.minor ? "supported" : "unsupported";
  if (parsed.patch !== MIN_HOST_VERSION.patch)
    return parsed.patch > MIN_HOST_VERSION.patch ? "supported" : "unsupported";
  // Same triple as the minimum: a prerelease of it sorts below the minimum.
  return parsed.prerelease ? "unsupported" : "supported";
}
