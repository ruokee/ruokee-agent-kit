/**
 * The `/ctx-pin` command: the user entry point.
 *
 * The command is a thin interface over the shared operation path, so a user and
 * the Agent see the same entries, revisions, sources and refusals. Every dialog
 * result is revalidated against the live session before a write: the revision
 * shown when a dialog opened is the revision the write must still find, and a
 * session that changed while a dialog was open leaves the journal untouched.
 *
 * A confirmed write is submitted as a user message and applied when the host
 * consumes it, so the command reports the operation as pending rather than as
 * stored. The message holds the write itself, and the request it opens carries
 * the result back to the user and the model.
 *
 * Text can be pinned without a dialog: `/ctx-pin add <body>` submits the body
 * as it was typed. The menu is opened by the bare command, and both entries
 * create an entry through the same submission.
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@oh-my-pi/pi-coding-agent";
import { MAX_BRANCH_BYTES_LABEL } from "./limits.ts";
import { originKey, type PinRequest } from "./envelope.ts";
import {
  type PinEnvironment,
  type SessionObservation,
  listPins,
  observeSession,
  observationHolds,
} from "./operations.ts";
import { PERSISTENCE_NOTE, detailText, pendingText } from "./receipt.ts";
import { type PinState, findEntry } from "./state.ts";
import { selectEntry } from "./ui.ts";

/** Command name registered with OMP. */
export const COMMAND_NAME = "ctx-pin";

/** Entries of the action menu of one pinned entry. */
const VIEW = "View";
const EDIT = "Edit";
const UNPIN = "Unpin";
const BACK = "Back";

export const NO_UI_TEXT = "omp-context-pin needs the interactive OMP interface to manage pins.";

/** Subcommand that pins text the user typed on the command line. */
const ADD_SUBCOMMAND = "add";

/** Usage shown for a subcommand this component does not have, or a missing body. */
export const USAGE_TEXT = [
  "Usage: /ctx-pin manages the pinned text of this branch.",
  `  /ctx-pin            open the list`,
  `  /ctx-pin ${ADD_SUBCOMMAND} <text>   pin the text as it was typed`,
].join("\n");
export const SESSION_CHANGED_TEXT =
  "The session, branch or pin period changed while this dialog was open; nothing was written.";

/** Register the command. `environment` binds it to the calling session. */
export function registerPinCommand(
  pi: ExtensionAPI,
  environment: (ctx: ExtensionCommandContext) => PinEnvironment,
): void {
  pi.registerCommand(COMMAND_NAME, {
    description: `Manage the text pinned into later ordinary requests of this branch. Pin text as it is typed with /${COMMAND_NAME} ${ADD_SUBCOMMAND} <text>. ${PERSISTENCE_NOTE}`,
    handler: async (args, ctx) => {
      await runPinCommand(environment(ctx), ctx, args);
    },
  });
}

/**
 * Run the command: an inline write, or the interactive menu.
 *
 * An argument that is not the inline form is answered with usage and sends no
 * model message, because a mistyped command must not pin anything.
 */
export async function runPinCommand(env: PinEnvironment, ctx: ExtensionCommandContext, args = ""): Promise<void> {
  if (ctx.hasUI === false) {
    ctx.ui.notify(NO_UI_TEXT, "warning");
    return;
  }

  if (args !== "") {
    // The body is the arguments after `add` and one separating space, exactly
    // as typed: no word splitting, no quote removal and no trimming, so what
    // the command receives is what gets pinned.
    if (!args.startsWith(`${ADD_SUBCOMMAND} `)) {
      ctx.ui.notify(USAGE_TEXT, "warning");
      return;
    }
    const body = args.slice(ADD_SUBCOMMAND.length + 1);
    if (body === "") {
      ctx.ui.notify(USAGE_TEXT, "warning");
      return;
    }
    await addInline(env, ctx, body);
    return;
  }

  // A session the host does not persist keeps pins only while the process runs,
  // so the condition is stated before any entry is managed, not only on unpin.
  ctx.ui.notify(PERSISTENCE_NOTE, "info");

  while (true) {
    // Captured before the menu opens: a session or branch change while the menu
    // waits for an answer has to be noticed before that answer is acted on.
    const observed = observeSession(env);
    const listing = listPins(env);
    if (!listing.ok || listing.state === undefined) {
      ctx.ui.notify(listing.text, "error");
      return;
    }
    const state = listing.state;
    // Creating is offered first, the entries follow in creation order, and
    // closing the list stays last. The answer is the number a row shows, so a
    // body that two entries share, or one the row had to cut short, still picks
    // the entry the row named.
    const picked = await selectEntry(
      ctx,
      state,
      `Pinned text (${state.usedBytes} of ${MAX_BRANCH_BYTES_LABEL} UTF-8 bytes)`,
    );
    if (picked === undefined || picked.kind === "close") return;
    if (!observationHolds(env, observed)) {
      ctx.ui.notify(SESSION_CHANGED_TEXT, "warning");
      return;
    }

    // A confirmed write closes the dialog: the user goes back to the session
    // that consumes the message. Reading, going back and cancelling leave the
    // menu open.
    if (picked.kind === "add") {
      if (await addPin(env, ctx, observed)) return;
      continue;
    }

    if (picked.entryId === undefined) continue;
    if (await manageEntry(env, ctx, state, picked.entryId, observed)) return;
  }
}

/**
 * Pin text the user typed on the command line.
 *
 * The body is submitted as it arrived: the command is the confirmation, so no
 * dialog opens and nothing asks again. The submission is synchronous, so the
 * session cannot move between reading it and handing the message over.
 */
async function addInline(env: PinEnvironment, ctx: ExtensionCommandContext, body: string): Promise<void> {
  submitWrite(env, ctx, observeSession(env), { action: "create", body });
}

/** Create one entry. Returns whether the menu closes: a write closes it, a cancel does not. */
async function addPin(env: PinEnvironment, ctx: ExtensionCommandContext, observed: SessionObservation) {
  const body = await ctx.ui.editor("New pinned text");
  if (body === undefined) return false; // Cancelled: nothing is written.
  if (!observationHolds(env, observed)) {
    ctx.ui.notify(SESSION_CHANGED_TEXT, "warning");
    return true;
  }

  return submitWrite(env, ctx, observed, { action: "create", body });
}

/** Act on one existing entry. Returns whether the menu closes: a write and a moved session close it. */
async function manageEntry(
  env: PinEnvironment,
  ctx: ExtensionCommandContext,
  state: PinState,
  entryId: number,
  observed: SessionObservation,
): Promise<boolean> {
  const entry = findEntry(state, entryId);
  if (entry === undefined) return true;

  const action = await ctx.ui.select(`Entry #${entryId} (revision ${entry.revision})`, [VIEW, EDIT, UNPIN, BACK]);
  if (action === undefined || action === BACK) return true;
  if (!observationHolds(env, observed)) {
    ctx.ui.notify(SESSION_CHANGED_TEXT, "warning");
    return false;
  }

  if (action === VIEW) {
    ctx.ui.notify(detailText(entry));
    return false;
  }

  if (action === EDIT) {
    const edited = await ctx.ui.editor("Edit pinned text", entry.body);
    if (edited === undefined) return false; // Cancelled: nothing is written.
    if (!observationHolds(env, observed)) {
      ctx.ui.notify(SESSION_CHANGED_TEXT, "warning");
      return true;
    }
    // The revision shown when this dialog opened is the one the write must still find.
    return submitWrite(env, ctx, observed, { action: "update", entryId, revision: entry.revision, body: edited });
  }

  const confirmed = await ctx.ui.confirm(
    "Unpin this entry?",
    `Entry #${entryId} (revision ${entry.revision}) is active now. Unpinning removes it from this branch; an older copy may stay in history until the next committed compaction. ${PERSISTENCE_NOTE}`,
  );
  if (!confirmed) return false;
  if (!observationHolds(env, observed)) {
    ctx.ui.notify(SESSION_CHANGED_TEXT, "warning");
    return true;
  }
  return submitWrite(env, ctx, observed, { action: "delete", entryId, revision: entry.revision });
}

/** A write the user confirmed, before it has an operation number. */
type Draft =
  | { action: "create"; body: string }
  | { action: "update"; entryId: number; revision: number; body: string }
  | { action: "delete"; entryId: number; revision: number };

/**
 * Submit one confirmed write as the user message that carries it.
 *
 * The identity is taken once for this submission, and the message carries it: a
 * request that reads the message again applies one operation, while confirming
 * another write is a new operation even when the text is the same. The request
 * records the session and pin period it was written in, and the host binding
 * records the number and the branch it was confirmed on, so the request that
 * consumes the message refuses an operation meant for another session, period
 * or branch instead of applying it where it does not belong.
 *
 * A session with no number left reports that and writes nothing. Returns
 * whether the message was handed to the host.
 */
function submitWrite(
  env: PinEnvironment,
  ctx: ExtensionCommandContext,
  observed: SessionObservation,
  draft: Draft,
): boolean {
  const allocated = env.reserveOperation();
  if (!allocated.ok) {
    ctx.ui.notify(`No operation number is available in this session: ${allocated.detail}.`, "error");
    return false;
  }
  const base = {
    operationId: allocated.id,
    origin: originKey(observed.sessionId, observed.resetEntryId),
  };
  const request: PinRequest =
    draft.action === "create"
      ? { ...base, action: "create", body: draft.body }
      : {
          ...base,
          action: draft.action,
          entryId: draft.entryId,
          revision: draft.revision,
          body: draft.action === "update" ? draft.body : "",
        };
  env.submit(request);
  ctx.ui.notify(pendingText(), "info");
  return true;
}
