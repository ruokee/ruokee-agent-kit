/**
 * Shared execution path for both tools: resolve the configured model,
 * materialize its credential and headers, POST to the Responses endpoint,
 * and format the answer.
 *
 * The model selector comes from the native OMP plugin settings (not an
 * environment variable). Credential, model-header, and HTTP work receive the
 * caller's abort signal. Provider headers cannot receive it, so cancellation
 * is checked immediately before and after that lookup. Every failure becomes
 * a tool-level error result; nothing throws past the tool boundary.
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
 * Responses endpoint; both tools build it from their parameters. OMP resolves
 * credentials and configured headers before the transport receives a plain
 * request snapshot.
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
    signal?.throwIfAborted();
    const apiKey = await ctx.modelRegistry.getApiKey(model, undefined, { signal });
    signal?.throwIfAborted();
    if (!apiKey || apiKey === "N/A") throw new Error(`no credential available for provider ${model.provider}`);
    let providerHeaders: Record<string, string> | undefined;
    try {
      providerHeaders = await ctx.modelRegistry.getProviderHeaders(model.provider);
    } catch {
      signal?.throwIfAborted();
      throw new Error(`failed to resolve headers for provider ${model.provider}`);
    }
    signal?.throwIfAborted();
    let modelHeaders: Record<string, string> | undefined;
    try {
      modelHeaders = await ctx.modelRegistry.resolveModelHeaders(model, signal);
    } catch {
      signal?.throwIfAborted();
      throw new Error(`failed to resolve headers for model ${model.provider}/${model.id}`);
    }
    signal?.throwIfAborted();
    const requestModel: ResponsesModel = {
      api: model.api,
      baseUrl: model.baseUrl,
      headers: modelHeaders,
      id: model.id,
      provider: model.provider,
    };
    const result = await runResponsesWeb({
      apiKey,
      input: prompt,
      model: requestModel,
      providerHeaders,
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
