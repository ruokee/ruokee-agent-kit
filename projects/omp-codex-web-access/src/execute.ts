/**
 * Shared execution path for both tools: resolve the configured model, fetch
 * its credential, POST to the Responses endpoint, and format the answer.
 *
 * The model selector comes from the native OMP plugin settings (not an
 * environment variable). Credential resolution and the HTTP request both receive the
 * caller's abort signal, so a cancelled tool call stops pending work. Every
 * failure becomes a tool-level error result; nothing throws past the tool
 * boundary.
 */

import type { ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { formatResponsesWebResult, runResponsesWeb, type ResponsesModel } from "./responses.ts";

export interface ExecuteWebAccessResult {
  content: [{ type: "text"; text: string }];
  details: { error?: string; model?: string; sources?: string[]; text?: string };
  isError?: boolean;
}

/**
 * Run one model-backed request. `prompt` is the full input text sent to the
 * Responses endpoint; both tools build it from their parameters. The model
 * resolved by OMP flows through to `runResponsesWeb` unchanged.
 */
export async function executeWebAccess(
  prompt: string,
  selector: string,
  signal: AbortSignal | undefined,
  ctx: ExtensionContext,
): Promise<ExecuteWebAccessResult> {
  try {
    if (!selector.trim()) {
      throw new Error(
        "No model configured for codex_web_search/codex_web_fetch: set the native `model` plugin setting to `provider/model-id`",
      );
    }
    const model = ctx.models.resolve(selector);
    if (!model) throw new Error(`model ${selector} is not registered or authenticated in OMP`);
    const apiKey = await ctx.modelRegistry.getApiKey(model, undefined, { signal });
    if (!apiKey || apiKey === "N/A") throw new Error(`no credential available for provider ${model.provider}`);
    const result = await runResponsesWeb({
      apiKey,
      input: prompt,
      model,
      providerHeaders: ctx.modelRegistry.getProviderHeaders(model.provider),
      signal,
    });
    return {
      content: [{ type: "text", text: formatResponsesWebResult(result) }],
      details: { model: result.model, sources: result.sources, text: result.text },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return toolError(message);
  }
}
/** The single error-result shape every tool failure returns. */
export function toolError(message: string): ExecuteWebAccessResult {
  return {
    content: [{ type: "text", text: `Codex web access request failed: ${message}` }],
    details: { error: message },
    isError: true,
  };
}
