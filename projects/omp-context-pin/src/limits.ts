/**
 * Capacity limits for pinned bodies.
 *
 * Both entry points enforce these before any state change, and the component
 * README documents the same constants.
 */

/** Maximum UTF-8 size of one entry body. */
export const MAX_ENTRY_BYTES = 16_384;

/** Maximum UTF-8 size of all active bodies on one branch. */
export const MAX_BRANCH_BYTES = 65_536;

/** Declared limits as they are written in user-facing text. */
export const MAX_ENTRY_BYTES_LABEL = MAX_ENTRY_BYTES.toLocaleString("en-US");
export const MAX_BRANCH_BYTES_LABEL = MAX_BRANCH_BYTES.toLocaleString("en-US");

const encoder = new TextEncoder();

/** UTF-8 size of a body, in bytes. */
export function byteLength(text: string): number {
  return encoder.encode(text).byteLength;
}

/** Declared limit that an operation would exceed. */
export interface CapacityOverflow {
  limit: "entry" | "branch";
  limitBytes: number;
  /** Size the branch or the body would reach if the operation were accepted. */
  usedBytes: number;
  /** Size of the body the operation carries. */
  bodyBytes: number;
  /** Active bytes of the branch before the operation, excluding the replaced body. */
  currentBytes: number;
}

/**
 * Check one body against both declared limits.
 *
 * `activeBytes` is the branch total excluding the body being replaced: the
 * current total for a create, or the total without that entry for an update.
 * Callers run this before any state change, so a rejection appends nothing.
 */
export function checkCapacity(body: string, activeBytes: number): CapacityOverflow | undefined {
  const bodyBytes = byteLength(body);
  if (bodyBytes > MAX_ENTRY_BYTES) {
    return {
      limit: "entry",
      limitBytes: MAX_ENTRY_BYTES,
      usedBytes: bodyBytes,
      bodyBytes,
      currentBytes: activeBytes,
    };
  }
  const totalBytes = activeBytes + bodyBytes;
  if (totalBytes > MAX_BRANCH_BYTES) {
    return {
      limit: "branch",
      limitBytes: MAX_BRANCH_BYTES,
      usedBytes: totalBytes,
      bodyBytes,
      currentBytes: activeBytes,
    };
  }
  return undefined;
}
