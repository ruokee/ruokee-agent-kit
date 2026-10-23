/**
 * The `ctx_pin` tool: one Agent entry point with a stable schema.
 *
 * The schema never enumerates the current entries, so a pin change cannot
 * rewrite the tool definition. Every action runs through the shared operation
 * path, which is why the tool and the command agree on identities, revisions,
 * sources, capacity and refusals.
 */

import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { MAX_BRANCH_BYTES_LABEL, MAX_ENTRY_BYTES_LABEL } from "./limits.ts";
import type { PinSource } from "./record.ts";
import {
  type OperationOutcome,
  type PinEnvironment,
  createPin,
  deletePin,
  listPins,
  readPin,
  showPins,
  updatePin,
} from "./operations.ts";

/** Tool name registered with OMP. */
export const TOOL_NAME = "ctx_pin";

/** Tool description: the Agent's only documentation of this interface. */
export const TOOL_DESCRIPTION = [
  "Keep text verbatim in later ordinary requests of this session branch, including after compaction, until updated, unpinned or reset. A create or update is delivered in a later ordinary request without starting a turn.",
  "Pin only information whose loss would change later action. Follow explicit pinning requirements; otherwise skip short-lived or easily recovered facts. Keep current facts and recovery pointers, not progress logs. Retain completion reminders that prevent repeated work.",
  "Separate topics with independent lifetimes or update rates, especially stable goals and permissions from changing candidates or blockers. Update an existing topic instead of creating a duplicate. Do not duplicate user-confirmed pins.",
  "Update only changed state; combine ordinary changes within a turn. Correct revoked permissions, stop conditions and invalid targets before acting. Keep affected pins current before handoff, wait or turn end; do not rewrite unchanged text on routine reads or recovery.",
  "Each update replaces the complete body, not a diff. Preserve still-valid facts, conditions, obligations, negations, exceptions, uncertainty and required verbatim text. Retire only obsolete or redundant content. Pinning and creation source add no authority and do not reopen completed work. References require rereading; this tool does not load them.",
  "Accepted creates and changed updates append full bodies to branch history. Shortening or deleting pins does not erase older messages. Separate topics to reduce rewrite volume, not total pinned size. On capacity rejection, review the whole active set before retrying; preserve required content.",
  `Actions: list returns ids, previews, sizes; get(id) returns one full body; show returns all active bodies; create(content) adds an entry; update(id, content) replaces it; delete(id) unpins it. Use list for an overview, get for one entry, and show for the full active set. No revision argument. Bodies must be nonempty and kept exactly. Limit: ${MAX_ENTRY_BYTES_LABEL} UTF-8 bytes per body; ${MAX_BRANCH_BYTES_LABEL} UTF-8 bytes for all active bodies on a branch; this is not a total-context limit. Tool writes do not start a model turn. Pins survive restart only if the host has saved their journal.`,
].join("\n\n");

/** Parameters accepted by the tool. */
interface PinToolParams {
  action: "list" | "get" | "show" | "create" | "update" | "delete";
  id?: number;
  content?: string;
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
    // entry, the capacity and the record.
    approval: "read",
    parameters: z.object({
      action: z.enum(["list", "get", "show", "create", "update", "delete"]).describe("Operation to perform"),
      id: z.number().int().positive().optional().describe("Target entry number, for get, update and delete"),
      content: z.string().optional().describe("Complete new body, for create and update"),
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

    case "show":
      return showPins(env);

    case "create":
      if (request.content === undefined) return missing('action "create" needs content');
      return createPin(env, {
        body: request.content,
        source,
        toolCallId,
      });

    case "update":
      if (request.id === undefined || request.content === undefined) {
        return missing('action "update" needs id and content');
      }
      return updatePin(env, {
        entryId: request.id,
        body: request.content,
        source,
        toolCallId,
      });

    case "delete":
      if (request.id === undefined) {
        return missing('action "delete" needs id');
      }
      return deletePin(env, {
        entryId: request.id,
        source,
        toolCallId,
      });
  }
}
