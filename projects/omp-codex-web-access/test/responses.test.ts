/**
 * Responses transport tests.
 *
 * Covers the wire contract a caller observes: request shape (URL, body,
 * headers), JSON and SSE reply handling, citation deduplication, HTTP and
 * Responses protocol errors, early reader cancellation after a completion
 * event, and abort-signal propagation to the in-flight request.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { formatResponsesWebResult, runResponsesWeb, type ResponsesModel } from "../src/responses.ts";

const model: ResponsesModel = {
  api: "openai-responses",
  baseUrl: "https://example.test/v1/",
  headers: { "x-model-header": "model" },
  id: "gpt-test",
  provider: "test-provider",
};

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

/**
 * Test fetch double. Bun's `typeof fetch` requires `preconnect`, which no
 * runtime replacement provides, so stubs are installed through this cast.
 */
function installFetch(stub: (input: URL | string, init?: RequestInit) => Promise<Response>): void {
  globalThis.fetch = stub as unknown as typeof fetch;
}

function sse(events: unknown[]): Response {
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") + "data: [DONE]\n\n", {
    headers: { "content-type": "text/event-stream" },
  });
}

describe("runResponsesWeb", () => {
  test("sends the native web_search request and returns deduplicated citations", async () => {
    let requestUrl = "";
    let requestBody: Record<string, unknown> = {};
    let requestHeaders = new Headers();
    installFetch(async (input, init) => {
      requestUrl = String(input);
      requestBody = JSON.parse(String(init?.body));
      requestHeaders = new Headers(init?.headers);
      return sse([
        { type: "response.created", response: { status: "in_progress", error: null } },
        { type: "response.in_progress", response: { status: "in_progress", error: null } },
        { type: "response.output_text.delta", delta: "Result " },
        { type: "response.output_text.delta", delta: "text" },
        {
          type: "response.output_text.done",
          text: "Result text",
          annotations: [{ type: "url_citation", url: "https://source.test/a" }],
        },
        {
          type: "response.completed",
          response: {
            output: [
              {
                content: [
                  {
                    type: "output_text",
                    text: "Result text",
                    annotations: [
                      { type: "url_citation", url: "https://source.test/a" },
                      { type: "url_citation", url: "https://source.test/b" },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ]);
    });

    const result = await runResponsesWeb({
      apiKey: "secret",
      input: "find it",
      model,
      providerHeaders: { "x-provider-header": "provider" },
    });

    expect(requestUrl).toBe("https://example.test/v1/responses");
    expect(requestUrl.includes("/codex/responses")).toBe(false);
    expect(requestBody).toEqual({
      model: "gpt-test",
      input: "find it",
      stream: true,
      tools: [{ type: "web_search", search_context_size: "high" }],
      tool_choice: { type: "web_search" },
    });
    expect(requestHeaders.get("authorization")).toBe("Bearer secret");
    expect(requestHeaders.get("x-provider-header")).toBe("provider");
    expect(requestHeaders.get("x-model-header")).toBe("model");
    expect(result).toEqual({
      model: "test-provider/gpt-test",
      text: "Result text",
      sources: ["https://source.test/a", "https://source.test/b"],
    });
    expect(formatResponsesWebResult(result)).toMatch(
      /Sources:\n- https:\/\/source\.test\/a\n- https:\/\/source\.test\/b/,
    );
  });

  test("merges headers case-insensitively with model values taking precedence", async () => {
    let requestHeaders = new Headers();
    installFetch(async (_input, init) => {
      requestHeaders = new Headers(init?.headers);
      return Response.json({ output_text: "ok" });
    });

    await runResponsesWeb({
      apiKey: "api-key-must-not-win",
      input: "x",
      model: {
        ...model,
        headers: {
          ...model.headers,
          authorization: "Model token",
          "x-shared": "model",
        },
      },
      providerHeaders: {
        Authorization: "Provider token",
        "X-Shared": "provider",
      },
    });

    expect(requestHeaders.get("authorization")).toBe("Model token");
    expect(requestHeaders.get("x-shared")).toBe("model");
  });

  test("accepts a non-streaming Responses payload", async () => {
    installFetch(async () =>
      Response.json({
        output: [
          {
            content: [
              {
                type: "output_text",
                text: "Page result",
                annotations: [{ type: "url_citation", url: "https://page.test" }],
              },
            ],
          },
        ],
      }),
    );
    const result = await runResponsesWeb({ apiKey: "secret", input: "read page", model });
    expect(result.text).toBe("Page result");
    expect(result.sources).toEqual(["https://page.test"]);
  });

  test("rejects incomplete non-streaming payloads even when they contain partial text", async () => {
    installFetch(async () =>
      Response.json({
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        output_text: "partial answer",
      }),
    );
    await expect(runResponsesWeb({ apiKey: "secret", input: "x", model })).rejects.toThrow(
      /Responses response incomplete/,
    );
  });

  test("rejects unsupported models and missing credentials before fetch", async () => {
    let fetched = false;
    installFetch(async () => {
      fetched = true;
      return Response.json({});
    });
    await expect(
      runResponsesWeb({ apiKey: "secret", input: "x", model: { ...model, api: "anthropic-messages" } }),
    ).rejects.toThrow(/expected openai-responses/);
    await expect(runResponsesWeb({ apiKey: "", input: "x", model })).rejects.toThrow(/no credential available/);
    expect(fetched).toBe(false);
  });

  for (const [name, response, expected] of [
    ["HTTP errors", new Response("upstream denied", { status: 401 }), /Responses HTTP 401$/],
    [
      "Responses errors",
      sse([{ type: "response.failed", response: { error: { message: "upstream failed" } } }]),
      /Responses request failed$/,
    ],
    [
      "bad SSE",
      new Response("data: {bad}\n\n", { headers: { "content-type": "text/event-stream" } }),
      /invalid Responses SSE JSON/,
    ],
    ["empty output", sse([{ type: "response.completed", response: { output: [] } }]), /Responses returned no text/],
  ] as const) {
    test(`surfaces ${name}`, async () => {
      installFetch(async () => response);
      await expect(runResponsesWeb({ apiKey: "secret", input: "x", model })).rejects.toThrow(expected);
    });
  }

  test("rejects SSE that ends after text deltas without a completion event", async () => {
    installFetch(
      async () =>
        new Response('data: {"type":"response.output_text.delta","delta":"partial"}\n\n', {
          headers: { "content-type": "text/event-stream" },
        }),
    );
    await expect(runResponsesWeb({ apiKey: "secret", input: "x", model })).rejects.toThrow(
      /ended before a completion event/,
    );
  });

  for (const cleanupFails of [false, true]) {
    test(`returns completed output even when reader cleanup rejects: ${cleanupFails}`, async () => {
      let cancelled = false;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"type":"response.output_text.delta","delta":"complete"}\n\ndata: {"type":"response.completed","response":{}}\n\n',
            ),
          );
        },
        cancel() {
          cancelled = true;
          if (cleanupFails) throw new Error("cleanup-private-diagnostic");
        },
      });
      installFetch(async () => new Response(body, { headers: { "content-type": "text/event-stream" } }));
      const result = await runResponsesWeb({ apiKey: "secret", input: "x", model });
      expect(result.text).toBe("complete");
      expect(cancelled).toBe(true);
      expect(body.locked).toBe(false);
    });

    test(`cancels an unread HTTP error body even when cleanup rejects: ${cleanupFails}`, async () => {
      let cancelled = false;
      let pulls = 0;
      const body = new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            pulls += 1;
            controller.enqueue(new Uint8Array(1024 * 1024));
            controller.close();
          },
          cancel() {
            cancelled = true;
            if (cleanupFails) throw new Error("cleanup-private-diagnostic");
          },
        },
        { highWaterMark: 0 },
      );
      installFetch(async () => new Response(body, { status: 503 }));
      await expect(runResponsesWeb({ apiKey: "secret", input: "x", model })).rejects.toThrow(/Responses HTTP 503/);
      expect(cancelled).toBe(true);
      expect(pulls).toBe(0);
      expect(body.locked).toBe(false);
    });
  }

  for (const [name, block] of [
    ["invalid line", "private-diagnostic\n\n"],
    ["invalid JSON", "data: {invalid-json}\n\n"],
    ["protocol failure", 'data: {"type":"response.failed","response":{"error":{"message":"private-diagnostic"}}}\n\n'],
  ]) {
    for (const cleanupFails of [false, true]) {
      test(`cancels and releases SSE after ${name}, cleanup rejects: ${cleanupFails}`, async () => {
        let cancelled = false;
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(block));
          },
          cancel() {
            cancelled = true;
            if (cleanupFails) throw new Error("cleanup-private-diagnostic");
          },
        });
        installFetch(async () => new Response(body, { headers: { "content-type": "text/event-stream" } }));
        const failure = await runResponsesWeb({ apiKey: "secret", input: "x", model }).catch((error: unknown) => error);
        expect(failure).toBeInstanceOf(Error);
        expect((failure as Error).message).not.toContain("private-diagnostic");
        expect(cancelled).toBe(true);
        expect(body.locked).toBe(false);
      });
    }
  }

  test("passes cancellation to the HTTP request", async () => {
    const controller = new AbortController();
    const { promise, reject } = Promise.withResolvers<Response>();
    installFetch(async (_input, init) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      return promise;
    });
    const request = runResponsesWeb({ apiKey: "secret", input: "x", model, signal: controller.signal });
    controller.abort(new DOMException("cancelled", "AbortError"));
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });

  test("formatResponsesWebResult omits Sources when no citations exist", () => {
    expect(formatResponsesWebResult({ model: "m", sources: [], text: "plain" })).toBe("plain");
  });
});
