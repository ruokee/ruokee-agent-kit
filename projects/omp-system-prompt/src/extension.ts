/**
 * OMP extension entry: replace the default system prompt's fixed policy.
 *
 * At activation the extension reads the owned template once. It registers
 * `before_agent_start`; on each turn the handler transforms the current
 * `event.systemPrompt` array — never a startup snapshot or
 * `ctx.getSystemPrompt()`, which reflects the already-chained result rather
 * than the handler-chain input.
 *
 * Failure handling is fail-open by design: custom prompt paths, malformed
 * templates, unrecognized block shapes, and unexpected turn-processing
 * errors leave the incoming array untouched so the turn proceeds with the host prompt.
 * A bounded diagnostic reports the reason through the session channel
 * (interactive notify or file logger); it does not claim to have blocked
 * the model request. Activation-time failures register the handler too, so
 * the first turn reports them once on the correct channel.
 */

import {
  type BeforeAgentStartEvent,
  type BeforeAgentStartEventResult,
  type ExtensionAPI,
  type ExtensionContext,
} from "@oh-my-pi/pi-coding-agent";
import { getPluginSettings as getPublicPluginSettings } from "@oh-my-pi/pi-coding-agent/extensibility/plugins";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DiagnosticTracker, type DiagnosticSink } from "./diagnostics.ts";
import { TEMPLATE_FILE_NAME, loadTemplate } from "./template.ts";
import { transformSystemPrompt } from "./transform.ts";

const PACKAGE_NAME = "@ruokee/omp-system-prompt";

/** Reason codes mapped to the bounded target shown in diagnostics. */
const REASON_TARGETS: Record<string, string> = {
  "empty-input": "empty input",
  "main-block-not-found": "default main block",
  "project-block-not-found": "project block",
  "unknown-section": "unrecognized section",
  "ambiguous-boundary": "ambiguous boundary",
  "owned-output-invalid": "owned output structure",
  "template-unavailable": "owned prompt template",
};

const SKILL_FORMATTING_TARGET = "Skill catalog";
const DELIVERY_SETTING_TARGET = "renderDelivery";
const SCOPE = "omp-system-prompt";

/** Runtime inputs the activation step needs; tests substitute their own. */
export type PluginSettingsReader = (packageName: string, cwd: string) => Promise<Record<string, unknown>>;

export interface ExtensionHost {
  importMetaUrl: string;
  getPluginSettings?: PluginSettingsReader;
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

  // Session-level dedup: one tracker for the whole activation. The sink
  // is re-resolved at report time so the channel matches the session the
  // failing turn ran in (interactive notify vs file logger).
  let currentSink: () => DiagnosticSink = () => ({ report: loggerWarn });
  const tracker = new DiagnosticTracker(SCOPE, {
    report: (message: string) => currentSink().report(message),
  });

  // Activation-time failures still register the turn handler: the session
  // channel is only known from the event context, and the diagnostic is
  // reported once per session on the first turn. The input stays unchanged.
  const fatal =
    templateText === null
      ? { reason: "template-unavailable", target: REASON_TARGETS["template-unavailable"] ?? "owned prompt template" }
      : null;

  const SKILL_COMMAND_PREFIX = "skill:";
  const readSettings = host.getPluginSettings ?? getPublicPluginSettings;

  pi.on("before_agent_start", async (event: BeforeAgentStartEvent, ctx: ExtensionContext) => {
    currentSink = () => sinkFor(ctx, loggerWarn);
    if (fatal) {
      tracker.report(fatal.reason, fatal.target);
      return undefined;
    }

    try {
      const renderDelivery = await resolveRenderDelivery(readSettings, ctx.cwd, tracker);
      // Current-turn Skill command metadata: names, order, and descriptions
      // only. Paths are ignored and no resource is rescanned; the event
      // catalog stays authoritative for what is visible.
      const skillMetadata = pi
        .getCommands()
        .filter((command) => command.source === "skill" && command.name.startsWith(SKILL_COMMAND_PREFIX))
        .map((command) => ({
          name: command.name.slice(SKILL_COMMAND_PREFIX.length),
          description: command.description ?? "",
        }));
      const result = transformSystemPrompt(event.systemPrompt, templateText, skillMetadata, renderDelivery);
      if (result.ok) {
        if (result.skillFormattingSkipped !== undefined) {
          tracker.reportSkillFormattingSkipped(result.skillFormattingSkipped, SKILL_FORMATTING_TARGET);
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
}

/** Production entry: the component template and public host APIs. */
export default function ompSystemPromptExtension(pi: ExtensionAPI): void {
  activate(pi, { importMetaUrl: import.meta.url });
}
