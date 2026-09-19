/**
 * OMP extension entry: register `codex_web_search` and `codex_web_fetch`.
 *
 * The factory only installs a `session_start` handler. The first event awaits
 * the public OMP settings getter with that event's cwd, validates one complete
 * settings object, and registers enabled tools from the resulting snapshot.
 * Repeated and concurrent events share the same activation promise, so they do
 * not reread settings or register duplicate tools. A failed activation remains
 * terminal until the extension is created again.
 *
 * Page extraction accepts only HTTP(S) URLs; the protocol check runs before
 * model resolution, credential lookup, and any network request. Public
 * reachability is the caller's contract and the model's to determine. This
 * component never fetches the target URL itself — the model performs the web
 * access — so there is no DNS or private-address probing here.
 */

import { type ExtensionAPI, type ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { getPluginSettings as getPublicPluginSettings } from "@oh-my-pi/pi-coding-agent/extensibility/plugins";
import { parseCodexWebAccessSettings, type CodexWebAccessConfig, type ConfigProblem, type ToolName } from "./config.ts";
import { WebAccessError } from "./errors.ts";
import { executeWebAccess, toolError } from "./execute.ts";

export const PACKAGE_NAME = "@ruokee/omp-codex-web-access";

/** Public settings seam used by activation and replaced by tests. */
export type PluginSettingsReader = (packageName: string, cwd: string) => Promise<Record<string, unknown>>;

/** Result of resolving settings for registration. */
type RegistrationConfig = { config: CodexWebAccessConfig } | { invalid: true; problems: ConfigProblem[] };

const MAX_DIAGNOSTIC_LENGTH = 256;
const MAX_DIAGNOSTIC_PART_LENGTH = 80;

function sanitizeDiagnosticPart(value: string): string {
  const printable = value.replace(/[^\x20-\x7e]/g, "?");
  if (printable.length <= MAX_DIAGNOSTIC_PART_LENGTH) return printable;
  return `${printable.slice(0, MAX_DIAGNOSTIC_PART_LENGTH - 3)}...`;
}

function describeProblems(problems: ConfigProblem[]): string {
  const shown = problems
    .slice(0, 8)
    .map((problem) => `${sanitizeDiagnosticPart(problem.field)}: ${sanitizeDiagnosticPart(problem.reason)}`);
  if (problems.length > shown.length) shown.push(`...and ${problems.length - shown.length} more`);
  const message = shown.join("; ");
  if (message.length <= MAX_DIAGNOSTIC_LENGTH) return message;
  return `${message.slice(0, MAX_DIAGNOSTIC_LENGTH - 3)}...`;
}

async function loadRegistrationConfig(readSettings: PluginSettingsReader, cwd: string): Promise<RegistrationConfig> {
  try {
    const settings = await readSettings(PACKAGE_NAME, cwd);
    const parsed = parseCodexWebAccessSettings(settings);
    return parsed.kind === "invalid" ? { invalid: true, problems: parsed.problems } : { config: parsed.config };
  } catch {
    return {
      invalid: true,
      problems: [{ field: "(settings)", reason: "settings getter failed" }],
    };
  }
}

/** Reject anything but HTTP(S) URLs before any model or credential work. */
function requireHttpUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new WebAccessError("invalid_url");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new WebAccessError("invalid_url");
  }
}

/** Per-tool description text; fetch must disclose its model-mediated nature. */
const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  codex_web_search:
    "Search the web with the OMP-configured Responses model. Returns generated text and cited source URLs.",
  codex_web_fetch:
    "Use the OMP-configured Responses model to read and extract information from a URL. The result is model-assisted and may be cleaned or summarized; it is not raw HTML or a verbatim page snapshot.",
};

function registerConfiguredTools(pi: ExtensionAPI, config: CodexWebAccessConfig): void {
  const { z } = pi.zod;
  const entries: [ToolName, boolean][] = [
    ["codex_web_search", config.tools.codex_web_search.enabled],
    ["codex_web_fetch", config.tools.codex_web_fetch.enabled],
  ];
  for (const [name, enabled] of entries) {
    if (!enabled) continue;
    if (name === "codex_web_search") {
      pi.registerTool({
        name,
        label: "Codex Web Search",
        description: TOOL_DESCRIPTIONS[name],
        parameters: z.object({ query: z.string().min(1).describe("Search query") }),
        loadMode: config.tools.codex_web_search.loadMode,
        approval: "read",
        async execute(_toolCallId, params, signal, _onUpdate, ctx: ExtensionContext) {
          const { query } = params as { query: string };
          return executeWebAccess(query, config.model, signal, ctx);
        },
      });
    } else {
      pi.registerTool({
        name,
        label: "Codex Web Fetch",
        description: TOOL_DESCRIPTIONS[name],
        parameters: z.object({
          url: z.string().url().describe("HTTP(S) URL to inspect"),
          prompt: z.string().optional().describe("Information to extract from the page"),
        }),
        loadMode: config.tools.codex_web_fetch.loadMode,
        approval: "read",
        async execute(_toolCallId, params, signal, _onUpdate, ctx: ExtensionContext) {
          const { url, prompt } = params as { url: string; prompt?: string };
          try {
            requireHttpUrl(url);
          } catch (error) {
            return toolError(error, signal);
          }
          const request = prompt?.trim() || "Extract the page's main information accurately.";
          const promptText = `Read this specific page and answer only from it: ${url}\n\nTask: ${request}\nCite the page URL in the answer.`;
          return executeWebAccess(promptText, config.model, signal, ctx);
        },
      });
    }
  }
}

/** Install one session_start activation barrier with a replaceable settings reader. */
export function activate(pi: ExtensionAPI, readSettings: PluginSettingsReader = getPublicPluginSettings): void {
  let initialization: Promise<void> | undefined;

  pi.on("session_start", async (_event, ctx) => {
    if (initialization === undefined) {
      initialization = (async () => {
        const registration = await loadRegistrationConfig(readSettings, ctx.cwd);
        if ("invalid" in registration) {
          pi.logger.warn(
            `omp-codex-web-access: configuration error, registering no tools: ${describeProblems(registration.problems)}`,
          );
          return;
        }
        try {
          registerConfiguredTools(pi, registration.config);
        } catch {
          pi.logger.warn("omp-codex-web-access: registration error, no further tools were registered");
        }
      })();
    }
    await initialization;
  });
}

export default function codexWebAccessExtension(pi: ExtensionAPI): void {
  activate(pi);
}
