/**
 * Direct Responses-endpoint transport shared by both tools.
 *
 * Requests go straight to the configured model's Responses endpoint with
 * native `web_search` enabled. Both JSON and SSE replies are supported,
 * `url_citation` annotations are collected and deduplicated, and Responses
 * protocol errors (including incomplete responses and non-completed
 * statuses) surface as thrown errors. No Codex CLI is launched.
 */

/**
 * Plain model fields needed by the transport after OMP has materialized the
 * configured header chain for this request.
 */
export interface ResponsesModel {
  api: string;
  baseUrl: string;
  headers?: Record<string, string>;
  id: string;
  provider: string;
}
export interface ResponsesWebResult {
  model: string;
  sources: string[];
  text: string;
}

interface RunResponsesOptions {
  apiKey: string;
  fetch?: typeof fetch;
  input: string;
  model: ResponsesModel;
  providerHeaders?: Record<string, string>;
  signal?: AbortSignal;
}

function errorMessage(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  return errorMessage(record.message) ?? errorMessage(record.error) ?? errorMessage(record.reason);
}

/** Depth-first collection of `url_citation` URLs, deduplicated via Set. */
function collectCitations(value: unknown, sources: Set<string>): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectCitations(item, sources);
    return;
  }
  const record = value as Record<string, unknown>;
  if (record.type === "url_citation" && typeof record.url === "string") sources.add(record.url);
  for (const child of Object.values(record)) collectCitations(child, sources);
}

/** Concatenated output text of a Responses payload (JSON or completed event). */
function responseText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (typeof record.output_text === "string") return record.output_text;
  if (!Array.isArray(record.output)) return "";
  const parts: string[] = [];
  for (const item of record.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const output = part as Record<string, unknown>;
      if (output.type === "output_text" && typeof output.text === "string") parts.push(output.text);
    }
  }
  return parts.join("");
}

/** First Responses protocol error in a payload, or undefined when healthy. */
function responseError(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  const type = typeof record.type === "string" ? record.type : "";
  if (type === "error") return errorMessage(record.error) ?? errorMessage(record) ?? "unknown Responses error";
  if (type === "response.failed") {
    return errorMessage((record.response as Record<string, unknown> | undefined)?.error) ?? "response failed";
  }
  if (type === "response.incomplete") {
    return (
      errorMessage((record.response as Record<string, unknown> | undefined)?.incomplete_details) ??
      "response incomplete"
    );
  }
  if (typeof record.status === "string" && record.status !== "completed") {
    return errorMessage(record.error) ?? errorMessage(record.incomplete_details) ?? `response status ${record.status}`;
  }
  return errorMessage(record.error);
}

function parseJsonResponse(raw: string): Omit<ResponsesWebResult, "model"> {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    throw new Error(`invalid Responses JSON: ${errorMessage(error) ?? String(error)}`);
  }
  const failure = responseError(payload);
  if (failure) throw new Error(`Responses error: ${failure}`);
  const sources = new Set<string>();
  collectCitations(payload, sources);
  const text = responseText(payload).trim();
  if (!text) throw new Error("Responses returned no text");
  return { text, sources: [...sources] };
}

interface SseState {
  complete: boolean;
  deltas: string[];
  finalText: string;
  sawData: boolean;
  sources: Set<string>;
}

/** Apply one SSE block (already split at blank lines) to the stream state. */
function processSseBlock(block: string, state: SseState): void {
  if (!block.trim()) return;
  const data: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) continue;
    if (!line.startsWith("data:")) throw new Error(`invalid Responses SSE line: ${line}`);
    data.push(line.slice(5).trimStart());
  }
  if (!data.length) return;
  state.sawData = true;
  const encoded = data.join("\n");
  if (encoded === "[DONE]") {
    state.complete = true;
    return;
  }
  let payload: unknown;
  try {
    payload = JSON.parse(encoded);
  } catch (error) {
    throw new Error(`invalid Responses SSE JSON: ${errorMessage(error) ?? String(error)}`);
  }
  const failure = responseError(payload);
  if (failure) throw new Error(`Responses error: ${failure}`);
  collectCitations(payload, state.sources);
  if (!payload || typeof payload !== "object") return;
  const record = payload as Record<string, unknown>;
  if (record.type === "response.output_text.delta" && typeof record.delta === "string") state.deltas.push(record.delta);
  if (record.type === "response.output_text.done" && typeof record.text === "string") state.finalText = record.text;
  if (record.type === "response.completed") {
    state.finalText ||= responseText(record.response);
    state.complete = true;
  }
}

function finishSseResponse(state: SseState): Omit<ResponsesWebResult, "model"> {
  if (!state.sawData) throw new Error("Responses SSE contained no data events");
  if (!state.complete) throw new Error("Responses SSE ended before a completion event");
  const text = (state.deltas.length ? state.deltas.join("") : state.finalText).trim();
  if (!text) throw new Error("Responses returned no text");
  return { text, sources: [...state.sources] };
}

/** Consume an SSE body until a completion event, canceling the reader early. */
async function parseSseResponse(body: ReadableStream<Uint8Array> | null): Promise<Omit<ResponsesWebResult, "model">> {
  if (!body) throw new Error("Responses SSE had no response body");
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const state: SseState = { complete: false, deltas: [], finalText: "", sawData: false, sources: new Set() };
  let buffer = "";
  try {
    while (!state.complete) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let delimiter = buffer.search(/\r?\n\r?\n/);
      while (delimiter >= 0) {
        const block = buffer.slice(0, delimiter);
        const separator = buffer.slice(delimiter).match(/^\r?\n\r?\n/)?.[0] ?? "\n\n";
        buffer = buffer.slice(delimiter + separator.length);
        processSseBlock(block, state);
        if (state.complete) break;
        delimiter = buffer.search(/\r?\n\r?\n/);
      }
      if (done) {
        if (buffer.trim()) processSseBlock(buffer, state);
        break;
      }
    }
  } finally {
    if (state.complete) await reader.cancel();
    reader.releaseLock();
  }
  return finishSseResponse(state);
}

function setHeaderIfMissing(headers: Headers, name: string, value: string): void {
  if (!headers.has(name)) headers.set(name, value);
}

/**
 * POST the prompt to `<baseUrl>/responses` with native web search and parse
 * the reply. Provider headers apply first, then model headers, and the
 * bearer credential is only set when neither already provides one.
 */
export async function runResponsesWeb(options: RunResponsesOptions): Promise<ResponsesWebResult> {
  if (options.model.api !== "openai-responses") {
    throw new Error(
      `model ${options.model.provider}/${options.model.id} uses ${options.model.api}; expected openai-responses`,
    );
  }
  const baseUrl = options.model.baseUrl.trim().replace(/\/+$/, "");
  if (!baseUrl) throw new Error(`model ${options.model.provider}/${options.model.id} has no base URL`);
  if (!options.apiKey) throw new Error(`no credential available for provider ${options.model.provider}`);

  let headers: Headers;
  try {
    headers = new Headers(options.providerHeaders);
    for (const [name, value] of Object.entries(options.model.headers ?? {})) headers.set(name, value);
    setHeaderIfMissing(headers, "authorization", `Bearer ${options.apiKey}`);
    setHeaderIfMissing(headers, "content-type", "application/json");
    setHeaderIfMissing(headers, "accept", "text/event-stream");
  } catch {
    throw new Error("invalid Responses request headers");
  }

  const response = await (options.fetch ?? fetch)(`${baseUrl}/responses`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: options.model.id,
      input: options.input,
      stream: true,
      tools: [{ type: "web_search", search_context_size: "high" }],
      tool_choice: { type: "web_search" },
    }),
    signal: options.signal,
  });
  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`Responses HTTP ${response.status}: ${raw.trim() || response.statusText}`);
  }
  const parsed = response.headers.get("content-type")?.includes("text/event-stream")
    ? await parseSseResponse(response.body)
    : parseJsonResponse(await response.text());
  return { ...parsed, model: `${options.model.provider}/${options.model.id}` };
}

/** Render the answer plus a deduplicated Sources list for the tool result. */
export function formatResponsesWebResult(result: ResponsesWebResult): string {
  if (!result.sources.length) return result.text;
  return `${result.text}\n\nSources:\n${result.sources.map((source) => `- ${source}`).join("\n")}`;
}
