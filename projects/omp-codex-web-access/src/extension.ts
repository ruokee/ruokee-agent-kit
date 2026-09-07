/**
 * OMP extension entry: register `codex_web_search` and `codex_web_fetch`.
 *
 * At activation the extension reads `omp-codex-web-access.yml` from the
 * active agent directory (`getAgentDir()`), then registers only the tools
 * the configuration enables. An invalid configuration registers neither
 * tool and reports every problem through the extension logger; a missing
 * file or omitted fields use the defaults (search essential, fetch
 * discoverable). Configuration is read once per activation, so changes
 * apply to new OMP sessions.
 *
 * Page extraction accepts only HTTP(S) URLs; the protocol check runs before
 * model resolution, credential lookup, and any network request. Public
 * reachability is the caller's contract and the model's to determine. This
 * component never fetches the target URL itself — the model performs the
 * web access — so there is no DNS or private-address probing here.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { getAgentDir, type ExtensionAPI, type ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { YAML } from "bun";
import {
  CONFIG_FILE_NAME,
  defaultTools,
  parseCodexWebAccessConfig,
  type CodexWebAccessConfig,
  type ConfigProblem,
  type ToolName,
} from "./config.ts";
import { executeWebAccess, toolError } from "./execute.ts";

/** Result of resolving configuration for registration. */
type RegistrationConfig = { config: CodexWebAccessConfig } | { invalid: true; problems: ConfigProblem[] };

function describeProblems(problems: ConfigProblem[]): string {
  return problems.map((problem) => `${problem.field}: ${problem.reason}`).join("; ");
}

/** Read the YAML config from the agent directory; a missing file defaults. */
function loadRegistrationConfig(agentDir: string): RegistrationConfig {
  // Synchronous read keeps activation atomic: the tools either register
  // from a valid config or not at all, before any session starts.
  const configPath = path.join(agentDir, CONFIG_FILE_NAME);
  let text: string | undefined;
  try {
    text = readFileSync(configPath, "utf8");
  } catch (error) {
    if (!(error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT")) {
      return {
        invalid: true,
        problems: [
          {
            field: "(file)",
            reason: `Cannot read ${CONFIG_FILE_NAME}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
  if (text === undefined) {
    return { config: { model: "", tools: defaultTools() } };
  }
  const parsed = parseCodexWebAccessConfig(text, YAML);
  return parsed.kind === "invalid" ? { invalid: true, problems: parsed.problems } : { config: parsed.config };
}

/** Reject anything but HTTP(S) URLs before any model or credential work. */
function requireHttpUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`url must be an absolute HTTP(S) URL, got: ${url}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`url must use the http or https protocol, got: ${parsed.protocol}`);
  }
}

/** Per-tool description text; fetch must disclose its model-mediated nature. */
const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  codex_web_search:
    "Search the web with the OMP-configured Responses model. Returns generated text and cited source URLs.",
  codex_web_fetch:
    "Use the OMP-configured Responses model to read and extract information from a URL. The result is model-assisted and may be cleaned or summarized; it is not raw HTML or a verbatim page snapshot.",
};

export default function codexWebAccessExtension(pi: ExtensionAPI): void {
  const { z } = pi.zod;
  let registration: RegistrationConfig;
  try {
    registration = loadRegistrationConfig(getAgentDir());
  } catch (error) {
    pi.logger.warn(
      `omp-codex-web-access: configuration error, registering no tools: ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }
  if ("invalid" in registration) {
    pi.logger.warn(
      `omp-codex-web-access: configuration error, registering no tools: ${describeProblems(registration.problems)}`,
    );
    return;
  }
  const { config } = registration;

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
            return toolError(error instanceof Error ? error.message : String(error));
          }
          const request = prompt?.trim() || "Extract the page's main information accurately.";
          const promptText = `Read this specific page and answer only from it: ${url}\n\nTask: ${request}\nCite the page URL in the answer.`;
          return executeWebAccess(promptText, config.model, signal, ctx);
        },
      });
    }
  }
}
