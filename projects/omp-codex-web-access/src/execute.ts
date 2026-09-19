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
import { WebAccessError, type WebAccessErrorCode } from "./errors.ts";
import { formatResponsesWebResult, runResponsesWeb, type ResponsesModel } from "./responses.ts";

export interface ExecuteWebAccessResult {
  content: [{ type: "text"; text: string }];
  details: {
    error?: string;
    code?: WebAccessErrorCode;
    status?: number;
    model?: string;
    sources?: string[];
    text?: string;
  };
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
    signal?.throwIfAborted();
    if (!selector.trim()) throw new WebAccessError("model_not_configured");
    let model;
    try {
      model = ctx.models.resolve(selector);
    } catch {
      throw new WebAccessError("model_resolution_failed");
    }
    if (!model) throw new WebAccessError("model_unavailable");
    signal?.throwIfAborted();
    let apiKey;
    try {
      apiKey = await ctx.modelRegistry.getApiKey(model, undefined, { signal });
    } catch {
      throw new WebAccessError("credential_resolution_failed");
    }
    signal?.throwIfAborted();
    if (!apiKey || apiKey === "N/A") throw new WebAccessError("credential_unavailable");
    let providerHeaders: Record<string, string> | undefined;
    try {
      providerHeaders = await ctx.modelRegistry.getProviderHeaders(model.provider);
    } catch {
      throw new WebAccessError("provider_headers_failed");
    }
    signal?.throwIfAborted();
    let modelHeaders: Record<string, string> | undefined;
    try {
      modelHeaders = await ctx.modelRegistry.resolveModelHeaders(model, signal);
    } catch {
      throw new WebAccessError("model_headers_failed");
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
    return toolError(error, signal);
  }
}
/** The single error-result shape every tool failure returns. */
export function toolError(error: unknown, signal?: AbortSignal): ExecuteWebAccessResult {
  const failure = signal?.aborted
    ? new WebAccessError("cancelled")
    : error instanceof WebAccessError
      ? new WebAccessError(error.code, error.status)
      : new WebAccessError("request_failed");
  return {
    content: [{ type: "text", text: `Codex web access request failed: ${failure.message}` }],
    details: {
      error: failure.message,
      code: failure.code,
      ...(failure.status === undefined ? {} : { status: failure.status }),
    },
    isError: true,
  };
}
