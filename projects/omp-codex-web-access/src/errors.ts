/** Only locally defined diagnostics may cross the tool error boundary. */
const MESSAGES = {
  invalid_url: "url must be an absolute HTTP(S) URL",
  model_not_configured:
    "No model configured for codex_web_search/codex_web_fetch: set the native `model` plugin setting to `provider/model-id`",
  model_unavailable: "configured model is not registered or authenticated in OMP",
  model_resolution_failed: "failed to resolve the configured model",
  credential_unavailable: "no credential available for the configured model",
  credential_resolution_failed: "failed to resolve the model credential",
  provider_headers_failed: "failed to resolve headers for provider",
  model_headers_failed: "failed to resolve headers for model",
  unsupported_api: "unsupported model API; expected openai-responses",
  missing_base_url: "configured model has no base URL",
  invalid_headers: "invalid Responses request headers",
  http_error: "Responses HTTP request failed",
  response_failed: "Responses request failed",
  response_incomplete: "Responses response incomplete",
  unexpected_response_status: "Responses returned an unexpected status",
  invalid_json: "invalid Responses JSON",
  invalid_sse_json: "invalid Responses SSE JSON",
  invalid_sse_line: "invalid Responses SSE line",
  missing_body: "Responses SSE had no response body",
  missing_events: "Responses SSE contained no data events",
  missing_completion: "Responses SSE ended before a completion event",
  empty_output: "Responses returned no text",
  cancelled: "request cancelled",
  request_failed: "request failed; check model configuration and provider availability",
} as const;

export type WebAccessErrorCode = keyof typeof MESSAGES;

/** Carries a fixed message and, for HTTP failures, only a numeric status. */
export class WebAccessError extends Error {
  readonly status?: number;

  constructor(
    readonly code: WebAccessErrorCode,
    status?: number,
  ) {
    const httpStatus =
      code === "http_error" && typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599
        ? status
        : undefined;
    super(httpStatus === undefined ? MESSAGES[code] : `Responses HTTP ${httpStatus}`);
    this.name = "WebAccessError";
    this.status = httpStatus;
  }
}
