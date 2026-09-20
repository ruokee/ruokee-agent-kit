/**
 * The text of one operation a user confirmed.
 *
 * A confirmed write is submitted as an ordinary user message, so the text of
 * that message is the write itself and nothing else: the body the user
 * confirmed, or the management sentence that asks for a deletion. Which
 * operation a message carries is not read from the text. The entry points record
 * the submission when the command hands it over, and the request that holds a
 * message with the same text is the one that applies it, so the text stays byte
 * for byte what the dialog showed and carries no number, marker or origin of its
 * own. A body that looks like a field line, a fence or a management sentence all
 * stay the user\'s text.
 */

/** Fields every submitted operation carries. */
interface PinRequestBase {
  /** Invocation identity, so a message consumed twice is one operation. */
  operationId: number;
  /** Session and pin period the draft belonged to. */
  origin: string;
  /** Text to pin, verbatim. A delete has none. */
  body: string;
}

/** A create allocates its entry identity when it is accepted. */
export interface CreatePinRequest extends PinRequestBase {
  action: "create";
}

/** An update or a delete addresses one entry at the revision the draft shows. */
export interface EntryPinRequest extends PinRequestBase {
  action: "update" | "delete";
  entryId: number;
  revision: number;
}

/** One operation the user confirmed. */
export type PinRequest = CreatePinRequest | EntryPinRequest;

/** Digits of the origin token. */
const ORIGIN_DIGITS = 8;

/**
 * Short token for the session and pin period an operation was drafted in.
 *
 * The token is recomputed when the message is consumed, so an operation
 * submitted in another session or another pin period is refused instead of
 * applied to a branch it was never written for.
 */
export function originKey(sessionId: string | undefined, resetEntryId: string | undefined): string {
  const text = `${sessionId ?? ""}|${resetEntryId ?? ""}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(ORIGIN_DIGITS, "0");
}

/** Body of a delete operation: the management text that asks for it. */
export function deleteBody(entryId: number): string {
  return `Unpin #${entryId}.`;
}

/** The text one write was submitted as, from what the write changed. */
export function writeText(action: string, entryId: number, body: string | undefined): string {
  return action === "delete" ? deleteBody(entryId) : (body ?? "");
}

/** The message a confirmed write is submitted as. */
export function submittedText(request: PinRequest): string {
  return writeText(request.action, request.action === "delete" ? request.entryId : 0, request.body);
}

/**
 * Text of a user message, as the host stores it.
 *
 * The host accepts a string and stores the message as one text part, and a
 * session the host restored hands back the same parts, so both shapes are read
 * the same way, with several parts read as their texts joined by a line break.
 * Parts other than text carry no text and are ignored.
 */
export function messageText(content: unknown): string | undefined {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return undefined;
  const parts: string[] = [];
  for (const part of content) {
    if (typeof part !== "object" || part === null) continue;
    const candidate = part as { type?: unknown; text?: unknown };
    if (candidate.type === "text" && typeof candidate.text === "string") parts.push(candidate.text);
  }
  return parts.length === 0 ? undefined : parts.join("\n");
}

/**
 * Text of one user message, when the request holds one.
 *
 * Only a user message can carry a confirmed write, so a message of any other
 * role reports nothing here.
 */
export function userMessageText(message: unknown): string | undefined {
  if (typeof message !== "object" || message === null) return undefined;
  const holder = message as { role?: unknown; content?: unknown };
  if (holder.role !== "user") return undefined;
  return messageText(holder.content);
}
