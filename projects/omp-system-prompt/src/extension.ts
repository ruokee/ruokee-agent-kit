/**
 * OMP extension entry: apply the owned strategy to a host render of the
 * component's own template, then append model-scoped rule documents.
 *
 * At activation the extension reads the owned template once. It registers
 * `before_agent_start` twice: the first handler inspects the current
 * `event.systemPrompt` array — never a startup snapshot or
 * `ctx.getSystemPrompt()`, which reflects the already-chained result rather
 * than the handler-chain input. When no block is a render of the owned
 * template (no template selected, `SYSTEM.md`, `--system-prompt`, or another
 * template), it returns nothing and reports nothing. The second handler
 * receives the chained result, keeps it, and appends one block per rule
 * document matching the turn's model.
 *
 * Failure handling is fail-open by design: a malformed owned template,
 * unrecognized step boundaries, unreadable rule sources, and unexpected
 * turn-processing errors leave the incoming array untouched so the turn
 * proceeds with the host prompt. A bounded diagnostic reports the reason
 * through the session channel (interactive notify or file logger); it does not
 * claim to have blocked the model request. Activation-time failures register
 * the handler too, so the first turn reports them once on the correct channel.
 */

import {
  type BeforeAgentStartEvent,
  type BeforeAgentStartEventResult,
  type ExtensionAPI,
  type ExtensionContext,
} from "@oh-my-pi/pi-coding-agent";
import { getPluginSettings as getPublicPluginSettings } from "@oh-my-pi/pi-coding-agent/extensibility/plugins";
import { getAgentDir, getProjectAgentDir } from "@oh-my-pi/pi-utils";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DiagnosticTracker, type DiagnosticSink } from "./diagnostics.ts";
import { RULE_DIR_NAME, collectRuleBodies, nodeRuleFileSystem, type RuleFileSystem, type RuleRoots } from "./rules.ts";
import { loadTemplate } from "./template.ts";
import { isHostTemplateRender } from "./host-template.ts";
import { prepareTemplate, transformSystemPrompt } from "./transform.ts";

const PACKAGE_NAME = "@ruokee/omp-system-prompt";

/** Reason codes mapped to the bounded target shown in diagnostics. */
const REASON_TARGETS: Record<string, string> = {
  "ambiguous-boundary": "ambiguous boundary",
  "template-unavailable": "owned prompt template",
};

const DELIVERY_SETTING_TARGET = "renderDelivery";
const DELIVERY_BLOCK_TARGET = "Delivery block";
const PROJECT_FOOTER_TARGET = "project footer";
const SCOPE = "omp-system-prompt";

/** Runtime inputs the activation step needs; tests substitute their own. */
export type PluginSettingsReader = (packageName: string, cwd: string) => Promise<Record<string, unknown>>;

export interface ExtensionHost {
  importMetaUrl: string;
  getPluginSettings?: PluginSettingsReader;
  /** Rule directories for one turn; tests point them at their own trees. */
  ruleRoots?: (cwd: string) => RuleRoots;
  /** Rule file access; tests substitute their own. */
  ruleFileSystem?: RuleFileSystem;
}

/** Production rule directories: the active profile's agent dir and `<cwd>/.omp`. */
function defaultRuleRoots(cwd: string): RuleRoots {
  return {
    user: join(getAgentDir(), RULE_DIR_NAME),
    project: join(getProjectAgentDir(cwd), RULE_DIR_NAME),
  };
}

/** Read the owned template from the component directory, once. */
function readTemplate(importMetaUrl: string): string | null {
  return loadTemplate(
    (path: string) => readFileSync(path, "utf8"),
    (name: string) => fileURLToPath(new URL(name, importMetaUrl)),
  );
}

/** One diagnostic channel per session: interactive notify or file logger. */
function sinkFor(ctx: ExtensionContext, loggerWarn: (message: string) => void): DiagnosticSink {
  if (ctx.hasUI) {
    return { report: (message: string) => ctx.ui.notify(message, "warning") };
  }
  return { report: loggerWarn };
}

/** Read the effective setting for this turn; malformed values fail open. */
async function resolveRenderDelivery(
  readSettings: PluginSettingsReader,
  cwd: string,
  tracker: DiagnosticTracker,
): Promise<boolean> {
  try {
    const settings = await readSettings(PACKAGE_NAME, cwd);
    if (settings === null || typeof settings !== "object" || Array.isArray(settings)) {
      tracker.reportSettingsFallback("invalid-type", DELIVERY_SETTING_TARGET);
      return true;
    }
    if (!Object.prototype.hasOwnProperty.call(settings, "renderDelivery")) return true;
    if (typeof settings.renderDelivery === "boolean") return settings.renderDelivery;
    tracker.reportSettingsFallback("invalid-type", DELIVERY_SETTING_TARGET);
  } catch {
    tracker.reportSettingsFallback("read-failed", DELIVERY_SETTING_TARGET);
  }
  return true;
}

/**
 * Shared activation used by the production entry and tests. `host` supplies
 * replaceable public runtime inputs; the template file lives beside this
 * module.
 */
export function activate(
  pi: ExtensionAPI,
  host: ExtensionHost,
  templateText: string | null = readTemplate(host.importMetaUrl),
): void {
  const loggerWarn = (message: string) => pi.logger.warn(message);

  // Preserve deduplication when returning to a session. Each turn gets its
  // own sink so an overlapping turn cannot redirect another's diagnostic.
  const seenBySession: Record<string, Set<string>> = Object.create(null);

  // Activation-time failures still register the turn handler: the session
  // channel is only known from the event context, and the diagnostic is
  // reported once per session on the first turn. The input stays unchanged.
  const owned = templateText === null ? null : prepareTemplate(templateText);
  const readSettings = host.getPluginSettings ?? getPublicPluginSettings;
  const ruleRoots = host.ruleRoots ?? defaultRuleRoots;
  const ruleFileSystem = host.ruleFileSystem ?? nodeRuleFileSystem;

  pi.on("before_agent_start", async (event: BeforeAgentStartEvent, ctx: ExtensionContext) => {
    const seen = (seenBySession[ctx.sessionManager.getSessionId()] ??= new Set<string>());
    const tracker = new DiagnosticTracker(SCOPE, sinkFor(ctx, loggerWarn), seen);
    if (owned === null) {
      tracker.report("template-unavailable", REASON_TARGETS["template-unavailable"] ?? "owned prompt template");
      return undefined;
    }

    try {
      // Only a host render of the owned template is the component's to
      // change; any other main block stays as the host built it, silently.
      if (!event.systemPrompt.some((block) => isHostTemplateRender(block, owned.anchors))) return undefined;
      const renderDelivery = await resolveRenderDelivery(readSettings, ctx.cwd, tracker);
      const result = transformSystemPrompt(event.systemPrompt, owned, renderDelivery);
      if (result === undefined) return undefined;
      if (result.ok) {
        for (const note of result.notes ?? []) {
          if (note.step === "delivery") tracker.reportDeliverySkipped(note.reason, DELIVERY_BLOCK_TARGET);
          else tracker.reportProjectFooterUnchanged(note.reason, PROJECT_FOOTER_TARGET);
        }
        if (!result.changed) return undefined;
        return { systemPrompt: result.blocks } satisfies BeforeAgentStartEventResult;
      }
      tracker.report(result.reason, REASON_TARGETS[result.reason] ?? "system prompt");
    } catch {
      tracker.report("unexpected-error", "system prompt transformation");
    }
    return undefined;
  });

  // Model-scoped rules: an independent second pass. It runs after the
  // replacement above, keeps whatever array it receives, and appends one
  // block per matching rule document. Files are re-read every turn, so
  // editing a rule takes effect on the next turn; the model identity is the
  // turn's effective model, without role, alias, or thinking-level lookup.
  pi.on("before_agent_start", async (event: BeforeAgentStartEvent, ctx: ExtensionContext) => {
    const seen = (seenBySession[ctx.sessionManager.getSessionId()] ??= new Set<string>());
    const tracker = new DiagnosticTracker(SCOPE, sinkFor(ctx, loggerWarn), seen);
    const model = ctx.model ?? ctx.models.current();
    if (model === undefined) return undefined;

    try {
      const { bodies, diagnostics } = await collectRuleBodies(
        ruleRoots(ctx.cwd),
        { id: model.id, provider: model.provider },
        ruleFileSystem,
      );
      for (const diagnostic of diagnostics) {
        if (diagnostic.reason === "directory-unreadable") {
          tracker.reportRuleDirectoryUnreadable(diagnostic.source);
          continue;
        }
        tracker.reportRuleSkipped(diagnostic.reason, diagnostic.source);
      }
      if (bodies.length === 0) return undefined;
      return { systemPrompt: [...event.systemPrompt, ...bodies] } satisfies BeforeAgentStartEventResult;
    } catch {
      tracker.reportRuleFailure("unexpected-error", "model prompt rules");
    }
    return undefined;
  });
}

/** Production entry: the component template and public host APIs. */
export default function ompSystemPromptExtension(pi: ExtensionAPI): void {
  activate(pi, { importMetaUrl: import.meta.url });
}
