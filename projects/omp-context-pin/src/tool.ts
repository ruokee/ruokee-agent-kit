/**
 * The `ctx_pin` tool: one Agent entry point with a stable schema.
 *
 * The schema never enumerates the current entries, so a pin change cannot
 * rewrite the tool definition. Every action runs through the shared operation
 * path, which is why the tool and the command agree on identities, revisions,
 * sources, capacity and refusals.
 */

import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import type { PinRecord, PinSource } from "./record.ts";
import { LIMITS_SENTENCE, PERSISTENCE_NOTE } from "./receipt.ts";
import {
  type OperationOutcome,
  type PinEnvironment,
  createPin,
  deletePin,
  listPins,
  readPin,
  updatePin,
} from "./operations.ts";

/** Tool name registered with OMP. */
export const TOOL_NAME = "ctx_pin";

/** Tool description: the Agent's only documentation of this interface. */
export const TOOL_DESCRIPTION = [
  "Pin text so its body stays available to later ordinary requests of this session branch, verbatim,",
  "until it is updated, unpinned, or the branch's context is reset.",
  "Use pins proactively for context whose loss across compaction or interruption could change later action: decisions, permissions, constraints, roles, identities, destinations, task scope, recovery pointers, conclusions, blockers and next steps. Follow explicit user, project or workflow requirements for content and timing; otherwise skip short-lived or easily recovered information with no effect on later decisions.",
  "Do not put stable goals or permissions and changing candidates, blockers or next steps in the same entry. When both need saving, use separate create calls from the first write, even for one task. Headings inside one body are not independent entries. Small size or a shared task name is not a reason to combine independently changing topics. A genuinely coherent topic with one lifetime and update rate can stay in one entry. Update an existing topic rather than create an equivalent copy; unrelated topics need separate entries.",
  "When a pinned candidate, blocker, next step or other actionable state changes, update only its affected entry before a handoff, wait or turn end. Combine ordinary changes within a turn. For changed permissions, restrictions, triggered stop conditions or invalid destinations, first correct or retire the affected pin, then continue under the new constraints. Acknowledging a change in chat does not update a pin; do not leave its active body describing the old state. Changing a candidate or next step grants no new permission; check still-valid constraints before acting.",
  "Do not rewrite unchanged bodies just because a request, read, routine command, compaction or recovery occurred. Every update must include the complete new body, not a diff; keep frequently updated entries focused.",
  "Keep essential constraints, current conclusions and clear recovery pointers, not full process logs or version histories. References require rereading; this tool does not load them. Carry forward every still-valid fact, condition, obligation, negation, exception, uncertainty and user-required verbatim text when replacing a body. A candidate change does not resolve uncertainty or withdraw a condition the user still requires. Keep such recovery information in the active pin set, not only in chat history. Remove only information that is genuinely obsolete.",
  "Retire obsolete or superseded information, but keep completion reminders that prevent repeated work. On recovery use the latest effective branch state and necessary current sources; pinning adds no authority and does not restart completed tasks or restore old permissions.",
  "Source records the creation entry point, not extra authority or the reason for pinning.",
  "Actions:",
  "- list: entry numbers and body starts, with sources, revisions and sizes, without full bodies",
  "- get: the full body, the entry number, the creation source, the revision and the UTF-8 byte size",
  "- create: pin a new body (content)",
  "- update: replace the body of one entry (id, content, expectedRevision)",
  "- delete: unpin an entry (id, expectedRevision)",
  "create, update and delete append the operation record and hand the host a change message for the model;",
  "a change message not yet present in the session journal is added to the next request and handed to the host once per session and pin period.",
  "A write the user confirms in /ctx-pin is a user message the host runs, so the request that carries it applies it and no call here is needed for it.",
  "An empty body is refused; accepted bodies keep every character and all whitespace exactly.",
  `Limits, checked before anything is written: ${LIMITS_SENTENCE}.`,
  "update and delete require the revision you last read for that id; a stale revision is refused instead of overwriting.",
  PERSISTENCE_NOTE,
].join(" ");

/** Parameters accepted by the tool. */
interface PinToolParams {
  action: "list" | "get" | "create" | "update" | "delete";
  id?: number;
  content?: string;
  expectedRevision?: number;
}

interface PinToolDetails {
  code: OperationOutcome["code"];
  entryId?: number;
  revision?: number;
}

function result(outcome: OperationOutcome): {
  content: Array<{ type: "text"; text: string }>;
  details: PinToolDetails;
  isError?: boolean;
} {
  const details: PinToolDetails = { code: outcome.code };
  if (outcome.entryId !== undefined) details.entryId = outcome.entryId;
  if (outcome.revision !== undefined) details.revision = outcome.revision;
  const payload = { content: [{ type: "text" as const, text: outcome.text }], details };
  return outcome.ok ? payload : { ...payload, isError: true };
}

function missing(requirement: string): OperationOutcome {
  return { ok: false, code: "rejected", text: `${requirement}. Nothing was written.` };
}

function cancelled(): OperationOutcome {
  return { ok: false, code: "rejected", text: "This call was cancelled before it ran; nothing was written." };
}

/** Register the tool. `environment` binds the tool to the calling session. */
export function registerPinTool(pi: ExtensionAPI, environment: (ctx: ExtensionContext) => PinEnvironment): void {
  const { z } = pi.zod;

  pi.registerTool({
    name: TOOL_NAME,
    label: "Context Pin",
    description: TOOL_DESCRIPTION,
    loadMode: "essential",
    // Every action is declared at the read tier, so no approval mode asks the
    // user to confirm a pin in this session. The host still applies an explicit
    // per-tool prompt or deny, and the shared operation path still checks the
    // entry, the revision, the capacity and the record.
    approval: "read",
    parameters: z.object({
      action: z.enum(["list", "get", "create", "update", "delete"]).describe("Operation to perform"),
      id: z.number().int().positive().optional().describe("Target entry number, for get, update and delete"),
      content: z.string().optional().describe("Complete new body, for create and update"),
      expectedRevision: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Revision you last read for this id, for update and delete"),
    }),
    async execute(toolCallId, params, signal, _onUpdate, ctx) {
      const request = params as PinToolParams;
      // A call that was cancelled before it ran writes nothing: cancellation
      // after acceptance leaves the accepted record, cancellation before it
      // must leave none.
      if (signal?.aborted === true) return result(cancelled());
      const env = environment(ctx);
      return result(runAction(env, request, toolCallId));
    },
  });
}

/** Route one tool call through the shared operation path. */
export function runAction(env: PinEnvironment, request: PinToolParams, toolCallId: string): OperationOutcome {
  const source: PinSource = "agent";
  switch (request.action) {
    case "list":
      return listPins(env);

    case "get":
      if (request.id === undefined) return missing('action "get" needs id');
      return readPin(env, request.id);

    case "create":
      if (request.content === undefined) return missing('action "create" needs content');
      return createPin(env, {
        body: request.content,
        source,
        toolCallId,
      });

    case "update":
      if (request.id === undefined || request.content === undefined || request.expectedRevision === undefined) {
        return missing('action "update" needs id, content and expectedRevision');
      }
      return updatePin(env, {
        entryId: request.id,
        body: request.content,
        source,
        expectedRevision: request.expectedRevision,
        toolCallId,
      });

    case "delete":
      if (request.id === undefined || request.expectedRevision === undefined) {
        return missing('action "delete" needs id and expectedRevision');
      }
      return deletePin(env, {
        entryId: request.id,
        source,
        expectedRevision: request.expectedRevision,
        toolCallId,
      });
  }
}
