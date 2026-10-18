/**
 * Copy-last-reply shortcut.
 *
 * OMP 18.5.0 loads an extension factory before it constructs interactive mode,
 * and its native action table has no shortcut that copies an assistant reply.
 * This module registers one fixed shortcut while the factory runs, so the key
 * is claimed for the whole process. The handler reads the activation snapshot
 * and stays inert until the module is enabled; that keeps a disabled module
 * from copying while it still owns the key.
 *
 * The copied text is the last assistant message of the current branch, matching
 * the host's `AgentSession.getLastAssistantText()` semantics: text blocks only,
 * no thinking, tool calls, or tool output. An aborted message with no content is
 * skipped. A last assistant message without text yields nothing rather than
 * falling back to an older reply.
 */

import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { copyToClipboard } from "@oh-my-pi/pi-coding-agent/utils/clipboard";
import type { ModuleContext, ModuleState } from "./extension.ts";

/** The fixed shortcut. Interactive mode reads the registry without rebinding. */
export const COPY_SHORTCUT = "alt+shift+a";

/** Help-panel description of the shortcut. */
export const COPY_DESCRIPTION = "Copy the text of the last reply";

/** Writes text somewhere the user can paste it. */
export type CopyText = (text: string) => Promise<void>;

type LastReplySource = Pick<ExtensionContext["sessionManager"], "getBranch">;

/**
 * The text blocks of the last assistant message, or undefined.
 *
 * An aborted message with no content is skipped so the shortcut does not
 * treat a cancelled empty turn as a reply. Any other assistant message ends
 * the search: when it has no text, there is nothing to copy.
 */
export function lastAssistantText(sessionManager: LastReplySource): string | undefined {
  const branch = sessionManager.getBranch();
  for (let index = branch.length - 1; index >= 0; index -= 1) {
    const entry = branch[index]!;
    if (entry.type !== "message" || entry.message.role !== "assistant") continue;
    const message = entry.message;
    if (message.stopReason === "aborted" && message.content.length === 0) continue;
    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    return text.length === 0 ? undefined : text;
  }
  return undefined;
}

/**
 * Build the shortcut handler.
 *
 * The copy function is injected so tests never touch a real clipboard. A
 * clipboard failure becomes one error notification; it never escapes the
 * handler.
 */
export function createCopyHandler(
  isActive: () => boolean,
  copyText: CopyText = copyToClipboard,
): (ctx: ExtensionContext) => Promise<void> {
  return async (ctx) => {
    if (!isActive()) return;
    if (!ctx.isIdle()) {
      ctx.ui.notify("The reply is still streaming; wait before copying.", "warning");
      return;
    }
    const text = lastAssistantText(ctx.sessionManager);
    if (text === undefined) {
      ctx.ui.notify("No reply to copy.", "warning");
      return;
    }
    try {
      await copyText(text);
      ctx.ui.notify("Copied the last reply.", "info");
    } catch {
      ctx.ui.notify("Failed to copy the last reply.", "error");
    }
  };
}

/** Register the shortcut during the extension factory. */
export function registerCopyShortcut(
  pi: ExtensionAPI,
  isActive: () => boolean,
  copyText: CopyText = copyToClipboard,
): void {
  pi.registerShortcut(COPY_SHORTCUT, {
    description: COPY_DESCRIPTION,
    handler: createCopyHandler(isActive, copyText),
  });
}

/** Report this module's own switch; the master and validation states come from `installModule`. */
export function installCopyModule(context: ModuleContext): ModuleState {
  if (!context.settings.copy.enabled) return { status: "disabled", reason: "copy-disabled" };
  return { status: "enabled" };
}
