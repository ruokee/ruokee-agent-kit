/**
 * Capacity limits for pinned bodies.
 *
 * Both entry points enforce these before any state change, and the component
 * README documents the same constants.
 */

/** Maximum UTF-8 size of one entry body. */
export const MAX_ENTRY_BYTES = 16_384;

/** Maximum UTF-8 size of all active bodies on one branch. */
export const MAX_BRANCH_BYTES = 16_384;

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
  /** Limit that the operation exceeds first. */
  limit: "entry" | "branch";
  /** Bytes allowed by the exceeded limit. */
  limitBytes: number;
  /** Active bytes on the branch before the operation. */
  currentBytes: number;
  /** Bytes of the body the operation replaces; zero for a create. */
  replacedBytes: number;
  /** Size of the body the operation carries. */
  bodyBytes: number;
  /** Branch total the operation would reach. */
  attemptedBytes: number;
  /** Bytes above the exceeded limit. */
  excessBytes: number;
  /** Entry being replaced, when the operation is an update. */
  entryId?: number;
}

/**
 * Check one body against both declared limits.
 *
 * `currentBytes` is the branch total before the operation. `replacedBytes` is
 * the size of the body this operation replaces, or zero for a create. The
 * branch attempt is `currentBytes - replacedBytes + bodyBytes`, so an update
 * releases the old body before it counts the new one. Callers run this before
 * any state change, so a rejection appends nothing.
 */
export function checkCapacity(body: string, currentBytes: number, replacedBytes = 0): CapacityOverflow | undefined {
  const bodyBytes = byteLength(body);
  const attemptedBytes = currentBytes - replacedBytes + bodyBytes;
  if (bodyBytes > MAX_ENTRY_BYTES) {
    return {
      limit: "entry",
      limitBytes: MAX_ENTRY_BYTES,
      currentBytes,
      replacedBytes,
      bodyBytes,
      attemptedBytes,
      excessBytes: bodyBytes - MAX_ENTRY_BYTES,
    };
  }
  if (attemptedBytes > MAX_BRANCH_BYTES) {
    return {
      limit: "branch",
      limitBytes: MAX_BRANCH_BYTES,
      currentBytes,
      replacedBytes,
      bodyBytes,
      attemptedBytes,
      excessBytes: attemptedBytes - MAX_BRANCH_BYTES,
    };
  }
  return undefined;
}
