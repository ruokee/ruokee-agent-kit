/**
 * Extension activation and execution-chain tests.
 *
 * Most tests substitute the public settings getter and model registry at the
 * extension seam. The cache regression uses OMP's real ModelRegistry with an
 * isolated config and SQLite cache. The suite covers the session_start
 * activation barrier, one-snapshot registration, native setting validation
 * failures, legacy YAML isolation, and the model-backed execution path.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { AuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-storage";
import { activate as installExtension, PACKAGE_NAME, type PluginSettingsReader } from "../src/extension.ts";

const originalFetch = globalThis.fetch;
const TEST_CWD = path.join(tmpdir(), "codex-web-session-project");

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

interface RegisteredTool {
  name: string;
  label: string;
  description: string;
  parameters: Record<string, unknown>;
  loadMode?: string;
  approval?: string;
  execute: (
    toolCallId: string,
    params: unknown,
    signal: AbortSignal | undefined,
    onUpdate: unknown,
    ctx: unknown,
  ) => Promise<{
    content: Array<{ type: string; text: string }>;
    details: Record<string, unknown>;
    isError?: boolean;
  }>;
}

type SessionHandler = (_event: unknown, ctx: { cwd: string }) => Promise<void>;

interface Harness {
  tools: RegisteredTool[];
  warnings: string[];
  sessionStart: SessionHandler;
}

/** Install the extension with a replaceable native settings getter. */
function activate(
  readSettings: PluginSettingsReader = async () => ({}),
  onRegister?: (tool: unknown) => void,
): Harness {
  const harness: Omit<Harness, "sessionStart"> & { sessionStart?: SessionHandler } = {
    tools: [],
    warnings: [],
  };
  const zodString = {
    describe() {
      return this;
    },
    min() {
      return this;
    },
    optional() {
      return this;
    },
    url() {
      return this;
    },
  };
  installExtension(
    {
      logger: { warn: (message: string) => harness.warnings.push(message) },
      on: (_event: string, handler: unknown) => {
        harness.sessionStart = handler as SessionHandler;
      },
      registerTool: (tool: unknown) => {
        if (onRegister) {
          onRegister(tool);
        } else {
          harness.tools.push(tool as RegisteredTool);
        }
      },
      zod: { z: { object: (shape: Record<string, unknown>) => shape, string: () => ({ ...zodString }) } },
    } as never,
    readSettings,
  );
  if (harness.sessionStart === undefined) throw new Error("session_start handler was not installed");
  return harness as Harness;
}

async function start(harness: Harness, cwd = TEST_CWD): Promise<void> {
  await harness.sessionStart({}, { cwd });
}

/** Minimal structured model stub satisfying the transport's field needs. */
const model = {
  api: "openai-responses",
  baseUrl: "https://example.test/v1",
  id: "gpt-test",
  provider: "test-provider",
};

type HeaderResolver = (
  signal?: AbortSignal,
) => Record<string, string> | undefined | Promise<Record<string, string> | undefined>;

interface ContextOptions {
  modelHeaders?: HeaderResolver;
  providerHeaders?: HeaderResolver;
}

/** Stub extension context with a resolvable model and recorded calls. */
function context(
  registered: typeof model | undefined,
  key: string | undefined = "registry-secret",
  options: ContextOptions = {},
) {
  const calls = {
    getApiKey: 0,
    getApiKeySignals: [] as (AbortSignal | undefined)[],
    getProviderHeaders: [] as string[],
    resolve: [] as string[],
    resolveModelHeaderSignals: [] as (AbortSignal | undefined)[],
  };
  return {
    calls,
    value: {
      models: {
        resolve(selector: string) {
          calls.resolve.push(selector);
          return registered;
        },
      },
      modelRegistry: {
        async getApiKey(_model: unknown, _sessionId: unknown, apiKeyOptions?: { signal?: AbortSignal }) {
          calls.getApiKey += 1;
          calls.getApiKeySignals.push(apiKeyOptions?.signal);
          return key;
        },
        async getProviderHeaders(provider: string) {
          calls.getProviderHeaders.push(provider);
          return options.providerHeaders ? await options.providerHeaders() : { "x-provider": "configured" };
        },
        async resolveModelHeaders(_model: unknown, signal?: AbortSignal) {
          calls.resolveModelHeaderSignals.push(signal);
          return options.modelHeaders ? await options.modelHeaders(signal) : { "x-model": "resolved" };
        },
      },
    },
  };
}

describe("session_start activation", () => {
  test("does not register tools before the first session_start", async () => {
    const harness = activate();
    expect(harness.tools).toEqual([]);
    await start(harness);
    expect(harness.tools.map((tool) => tool.name)).toEqual(["codex_web_search", "codex_web_fetch"]);
    expect(harness.tools.map((tool) => tool.loadMode)).toEqual(["essential", "discoverable"]);
    expect(harness.tools.every((tool) => tool.approval === "read")).toBe(true);
  });

  test("keeps registration at zero while the settings getter is pending", async () => {
    const deferred = Promise.withResolvers<Record<string, unknown>>();
    const harness = activate(async () => deferred.promise);
    const pending = start(harness);
    await Promise.resolve();
    expect(harness.tools).toEqual([]);
    deferred.resolve({});
    await pending;
    expect(harness.tools).toHaveLength(2);
  });

  test("passes the session cwd and package name to the public getter", async () => {
    const calls: Array<{ packageName: string; cwd: string }> = [];
    const sessionCwd = mkdtempSync(path.join(tmpdir(), "codex-web-session-cwd-"));
    try {
      const harness = activate(async (packageName, cwd) => {
        calls.push({ packageName, cwd });
        return {};
      });
      await start(harness, sessionCwd);
      expect(calls).toEqual([{ packageName: PACKAGE_NAME, cwd: sessionCwd }]);
      expect(sessionCwd).not.toBe(process.cwd());
    } finally {
      rmSync(sessionCwd, { recursive: true, force: true });
    }
  });

  test("shares one pending read and one registration across duplicate concurrent events", async () => {
    const deferred = Promise.withResolvers<Record<string, unknown>>();
    let reads = 0;
    const harness = activate(async () => {
      reads += 1;
      return deferred.promise;
    });
    const first = start(harness, "/tmp/project-one");
    const second = start(harness, "/tmp/project-two");
    await Promise.resolve();
    expect(reads).toBe(1);
    expect(harness.tools).toEqual([]);
    deferred.resolve({});
    await Promise.all([first, second]);
    await start(harness, "/tmp/project-three");
    expect(reads).toBe(1);
    expect(harness.tools).toHaveLength(2);
  });

  test("rereads settings for a new extension activation", async () => {
    let reads = 0;
    const first = activate(async () => {
      reads += 1;
      return { searchEnabled: false };
    });
    await start(first);
    expect(first.tools.map((tool) => tool.name)).toEqual(["codex_web_fetch"]);

    const second = activate(async () => {
      reads += 1;
      return { fetchEnabled: false };
    });
    await start(second);
    expect(reads).toBe(2);
    expect(second.tools.map((tool) => tool.name)).toEqual(["codex_web_search"]);
  });

  test("keeps registration at zero after a rejected read and does not retry", async () => {
    let reads = 0;
    const harness = activate(async () => {
      reads += 1;
      throw new Error("settings unavailable");
    });
    await start(harness);
    await start(harness);
    expect(reads).toBe(1);
    expect(harness.tools).toEqual([]);
    expect(harness.warnings).toHaveLength(1);
    expect(harness.warnings[0]).toContain("settings getter failed");
  });

  test("keeps registration at zero for an invalid effective object", async () => {
    const harness = activate(async () => ({ searchEnabled: "yes" }));
    await start(harness);
    expect(harness.tools).toEqual([]);
    expect(harness.warnings).toHaveLength(1);
    expect(harness.warnings[0]).toContain("searchEnabled");
  });

  test("honors independent enablement and load modes", async () => {
    const harness = activate(async () => ({
      searchEnabled: false,
      searchLoadMode: "discoverable",
      fetchEnabled: true,
      fetchLoadMode: "essential",
    }));
    await start(harness);
    expect(harness.tools.map((tool) => tool.name)).toEqual(["codex_web_fetch"]);
    expect(harness.tools[0]?.loadMode).toBe("essential");
  });

  test("keeps both tools disabled when both enablement settings are false", async () => {
    const harness = activate(async () => ({ searchEnabled: false, fetchEnabled: false }));
    await start(harness);
    expect(harness.tools).toEqual([]);
  });

  test("isolates concurrent activations with different project directories", async () => {
    const projectOne = mkdtempSync(path.join(tmpdir(), "codex-web-project-one-"));
    const projectTwo = mkdtempSync(path.join(tmpdir(), "codex-web-project-two-"));
    try {
      const first = activate(async (_packageName, cwd) => (cwd === projectOne ? { searchEnabled: false } : {}));
      const second = activate(async (_packageName, cwd) => (cwd === projectTwo ? { fetchEnabled: false } : {}));
      await Promise.all([start(first, projectOne), start(second, projectTwo)]);
      expect(first.tools.map((tool) => tool.name)).toEqual(["codex_web_fetch"]);
      expect(second.tools.map((tool) => tool.name)).toEqual(["codex_web_search"]);
    } finally {
      rmSync(projectOne, { recursive: true, force: true });
      rmSync(projectTwo, { recursive: true, force: true });
    }
  });

  test("bounds and redacts settings getter exception diagnostics", async () => {
    const marker = "GETTER-SENSITIVE-MARKER";
    const harness = activate(async () => {
      throw new Error(`${marker}\n${"x".repeat(1_000)}`);
    });
    await start(harness);
    const warning = harness.warnings[0] ?? "";
    expect(warning).toContain("settings getter failed");
    expect(warning).not.toContain(marker);
    expect(warning).not.toContain("\n");
    expect(warning.length).toBeLessThanOrEqual(256);
  });

  test("bounds unknown setting diagnostics and removes control characters", async () => {
    const marker = "UNKNOWN-SENSITIVE-MARKER";
    const unknownKey = `unknown-${"x".repeat(200)}-${marker}\n\u001b[31m`;
    const harness = activate(async () => ({ [unknownKey]: "value" }));
    await start(harness);
    const warning = harness.warnings[0] ?? "";
    expect(warning).not.toContain(marker);
    expect(warning).not.toContain("\n");
    expect(warning).not.toContain("\u001b");
    expect(warning.length).toBeLessThanOrEqual(256);
  });

  test("bounds registration exception diagnostics without exposing the exception", async () => {
    const marker = "REGISTRATION-SENSITIVE-MARKER";
    const harness = activate(
      async () => ({}),
      () => {
        throw new Error(`${marker}\n${"x".repeat(1_000)}`);
      },
    );
    await start(harness);
    const warning = harness.warnings[0] ?? "";
    expect(warning).toContain("registration error");
    expect(warning).not.toContain(marker);
    expect(warning).not.toContain("\n");
    expect(warning.length).toBeLessThanOrEqual(256);
  });

  test("uses one model snapshot for registered tools", async () => {
    const settings: Record<string, unknown> = { model: "test-provider/first" };
    const harness = activate(async () => settings);
    await start(harness);
    settings.model = "test-provider/second";
    const [tool] = harness.tools;
    if (!tool) throw new Error("codex_web_search was not registered");

    installFetch(async () => Response.json({ output_text: "Found it" }));
    const ctx = context(model);
    await tool.execute("call", { query: "needle" }, undefined, undefined, ctx.value);
    expect(ctx.calls.resolve).toEqual(["test-provider/first"]);
  });
});

describe("tool execution chain", () => {
  test("search resolves the configured model, gets its credential, and sends the query", async () => {
    const harness = activate(async () => ({ model: "test-provider/gpt-test" }));
    await start(harness);
    const [tool] = harness.tools;
    if (!tool) throw new Error("codex_web_search was not registered");
    let body: Record<string, unknown> = {};
    let headers = new Headers();
    installFetch(async (_input, init) => {
      body = JSON.parse(String(init?.body));
      headers = new Headers(init?.headers);
      return Response.json({ output_text: "Found it" });
    });
    const ctx = context(model);
    const result = await tool.execute("call", { query: "needle" }, undefined, undefined, ctx.value);
    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toBe("Found it");
    expect(ctx.calls.resolve).toEqual(["test-provider/gpt-test"]);
    expect(ctx.calls.getApiKey).toBe(1);
    expect(ctx.calls.getProviderHeaders).toEqual(["test-provider"]);
    expect(ctx.calls.resolveModelHeaderSignals).toEqual([undefined]);
    expect(headers.get("x-provider")).toBe("configured");
    expect(headers.get("x-model")).toBe("resolved");
    expect(body.input).toBe("needle");
  });

  test("materializes changing registry headers once per tool call", async () => {
    const harness = activate(async () => ({ model: "test-provider/gpt-test" }));
    await start(harness);
    const [tool] = harness.tools;
    if (!tool) throw new Error("codex_web_search was not registered");
    let providerRevision = 0;
    let modelRevision = 0;
    const requests: Array<Record<string, string | null>> = [];
    installFetch(async (_input, init) => {
      const headers = new Headers(init?.headers);
      requests.push({
        authorization: headers.get("authorization"),
        model: headers.get("x-model-revision"),
        provider: headers.get("x-provider-revision"),
        shared: headers.get("x-shared"),
      });
      return Response.json({ output_text: "Found it" });
    });
    const ctx = context(model, "registry-secret", {
      providerHeaders: async () => ({
        "X-Shared": "provider",
        "x-provider-revision": String(++providerRevision),
      }),
      modelHeaders: async () => ({
        "x-model-revision": String(++modelRevision),
        "x-shared": "model",
      }),
    });

    await tool.execute("first", { query: "one" }, undefined, undefined, ctx.value);
    await tool.execute("second", { query: "two" }, undefined, undefined, ctx.value);

    expect(requests).toEqual([
      { authorization: "Bearer registry-secret", model: "1", provider: "1", shared: "model" },
      { authorization: "Bearer registry-secret", model: "2", provider: "2", shared: "model" },
    ]);
    expect(ctx.calls.getProviderHeaders).toEqual(["test-provider", "test-provider"]);
    expect(ctx.calls.resolveModelHeaderSignals).toEqual([undefined, undefined]);
  });

  test("restores omitted cached headers through the real ModelRegistry before sending", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "codex-web-registry-cache-"));
    const modelsPath = path.join(root, "models.yml");
    const cacheDbPath = path.join(root, "models.db");
    writeFileSync(
      modelsPath,
      JSON.stringify({
        providers: {
          "test-provider": {
            api: "openai-responses",
            apiKey: "registry-secret",
            authHeader: true,
            baseUrl: "https://example.test/v1",
            discovery: { injectV1: false, type: "openai-models-list" },
            headers: { "x-provider": "provider", "x-shared": "provider" },
            modelOverrides: {
              "gpt-test": { headers: { "x-model": "model", "x-shared": "model" } },
            },
          },
        },
      }),
    );
    const authStorage = await AuthStorage.create(":memory:");
    try {
      const discoveryUrls: string[] = [];
      const writerRegistry = new ModelRegistry(authStorage, modelsPath, {
        cacheDbPath,
        fetch: async (input) => {
          const url = String(input);
          discoveryUrls.push(url);
          if (url !== "https://example.test/v1/models") return new Response("not found", { status: 404 });
          return Response.json({ data: [{ id: "gpt-test" }] });
        },
      });
      await writerRegistry.refresh("online");
      expect(discoveryUrls.filter((url) => url === "https://example.test/v1/models")).toHaveLength(1);

      const cache = new Database(cacheDbPath, { readonly: true });
      const row = cache
        .query<{ header_omitted_model_ids: string; models: string }, [string]>(
          "SELECT header_omitted_model_ids, models FROM model_cache WHERE provider_id = ?",
        )
        .get("test-provider:openai-models-list-bare-context-v3");
      cache.close();
      if (!row) throw new Error("ModelRegistry did not persist the discovery cache");
      const cachedModel = (JSON.parse(row.models) as Array<Record<string, unknown>>).find(
        (entry) => entry.id === "gpt-test",
      );
      expect(cachedModel).toBeDefined();
      expect(Object.hasOwn(cachedModel ?? {}, "headers")).toBe(false);
      expect(Object.hasOwn(cachedModel ?? {}, "resolveHeaders")).toBe(false);
      expect(JSON.parse(row.header_omitted_model_ids)).toContain("gpt-test");

      let reloadNetworkRequests = 0;
      const restoredRegistry = new ModelRegistry(authStorage, modelsPath, {
        cacheDbPath,
        fetch: async () => {
          reloadNetworkRequests += 1;
          throw new Error("cache reload must not access the network");
        },
      });
      const restoredModel = restoredRegistry.find("test-provider", "gpt-test");
      if (!restoredModel) throw new Error("ModelRegistry did not restore the cached model");
      expect(reloadNetworkRequests).toBe(0);
      expect(await restoredRegistry.resolveModelHeaders(restoredModel)).toMatchObject({
        Authorization: "Bearer registry-secret",
        "x-model": "model",
        "x-provider": "provider",
        "x-shared": "model",
      });

      const harness = activate(async () => ({ model: "test-provider/gpt-test" }));
      await start(harness, root);
      const [tool] = harness.tools;
      if (!tool) throw new Error("codex_web_search was not registered");
      let body: Record<string, unknown> = {};
      let headers = new Headers();
      installFetch(async (_input, init) => {
        body = JSON.parse(String(init?.body));
        headers = new Headers(init?.headers);
        return Response.json({ output_text: "Found it" });
      });

      const result = await tool.execute("cache-restore", { query: "needle" }, undefined, undefined, {
        models: { resolve: () => restoredModel },
        modelRegistry: restoredRegistry,
      });
      expect(result.isError).toBeUndefined();
      expect(result.content[0]?.text).toBe("Found it");
      expect(body.input).toBe("needle");
      expect(headers.get("authorization")).toBe("Bearer registry-secret");
      expect(headers.get("x-provider")).toBe("provider");
      expect(headers.get("x-model")).toBe("model");
      expect(headers.get("x-shared")).toBe("model");
      expect(headers.get("content-type")).toBe("application/json");
      expect(headers.get("accept")).toBe("text/event-stream");
      expect(reloadNetworkRequests).toBe(0);
    } finally {
      authStorage.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("sanitizes header resolver failures before sending a request", async () => {
    const harness = activate(async () => ({ model: "test-provider/gpt-test" }));
    await start(harness);
    const [tool] = harness.tools;
    if (!tool) throw new Error("codex_web_search was not registered");
    let fetched = false;
    installFetch(async () => {
      fetched = true;
      return Response.json({ output_text: "unexpected" });
    });

    const providerFailure = await tool.execute(
      "provider",
      { query: "one" },
      undefined,
      undefined,
      context(model, "credential-secret", {
        providerHeaders: async () => {
          throw new Error("provider-header-secret");
        },
      }).value,
    );
    expect(providerFailure.isError).toBe(true);
    expect(providerFailure.content[0]?.text).toContain("failed to resolve headers for provider test-provider");
    expect(providerFailure.content[0]?.text).not.toContain("provider-header-secret");
    expect(providerFailure.content[0]?.text).not.toContain("credential-secret");

    const modelFailure = await tool.execute(
      "model",
      { query: "two" },
      undefined,
      undefined,
      context(model, "credential-secret", {
        modelHeaders: async () => {
          throw new Error("model-header-secret");
        },
      }).value,
    );
    expect(modelFailure.isError).toBe(true);
    expect(modelFailure.content[0]?.text).toContain("failed to resolve headers for model test-provider/gpt-test");
    expect(modelFailure.content[0]?.text).not.toContain("model-header-secret");
    expect(modelFailure.content[0]?.text).not.toContain("credential-secret");
    expect(fetched).toBe(false);
  });

  test("redacts invalid provider, model, and credential header values", async () => {
    const harness = activate(async () => ({ model: "test-provider/gpt-test" }));
    await start(harness);
    const [tool] = harness.tools;
    if (!tool) throw new Error("codex_web_search was not registered");
    let requests = 0;
    installFetch(async () => {
      requests += 1;
      return Response.json({ output_text: "unexpected" });
    });
    const marker = "SYNTHETIC-HEADER";
    const cases = [
      context(model, "credential", {
        providerHeaders: async () => ({ Authorization: `${marker}-PROVIDER\nBAD` }),
      }).value,
      context(model, "credential", {
        modelHeaders: async () => ({ Authorization: `${marker}-MODEL\nBAD` }),
      }).value,
      context(model, `${marker}-CREDENTIAL\nBAD`, {
        providerHeaders: async () => ({ "x-provider": "configured" }),
        modelHeaders: async () => ({ "x-model": "resolved" }),
      }).value,
    ];

    for (const ctx of cases) {
      const result = await tool.execute("invalid-header", { query: "x" }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("invalid Responses request headers");
      expect(result.content[0]?.text).not.toContain(marker);
      expect(result.details.error).toBe("invalid Responses request headers");
      expect(result.details.error).not.toContain(marker);
    }
    expect(requests).toBe(0);
  });

  test("fetch passes the URL and extraction prompt to Responses", async () => {
    const harness = activate(async () => ({ model: "test-provider/gpt-test" }));
    await start(harness);
    const [, tool] = harness.tools;
    if (!tool) throw new Error("codex_web_fetch was not registered");
    let input = "";
    installFetch(async (_url, init) => {
      input = String(JSON.parse(String(init?.body)).input);
      return Response.json({ output_text: "Example Domain" });
    });
    const result = await tool.execute(
      "call",
      { url: "https://example.com", prompt: "Return the title" },
      undefined,
      undefined,
      context(model).value,
    );
    expect(result.isError).toBeUndefined();
    expect(input).toContain("https://example.com");
    expect(input).toContain("Return the title");
  });

  test("fetch rejects non-HTTP(S) URLs before any model or network work", async () => {
    const harness = activate(async () => ({ model: "test-provider/gpt-test" }));
    await start(harness);
    const [, tool] = harness.tools;
    if (!tool) throw new Error("codex_web_fetch was not registered");
    let fetched = false;
    installFetch(async () => {
      fetched = true;
      return Response.json({ output_text: "x" });
    });
    const ctx = context(model);
    for (const url of ["file:///etc/passwd", "ftp://example.com/doc", "not a url"]) {
      const result = await tool.execute("call", { url }, undefined, undefined, ctx.value);
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toMatch(/http/i);
    }
    expect(ctx.calls.resolve).toEqual([]);
    expect(fetched).toBe(false);
  });

  test("missing or empty model errors at call time", async () => {
    const harness = activate();
    await start(harness);
    const [tool] = harness.tools;
    if (!tool) throw new Error("codex_web_search was not registered");
    let fetched = false;
    installFetch(async () => {
      fetched = true;
      return Response.json({});
    });
    const result = await tool.execute("call", { query: "x" }, undefined, undefined, context(model).value);
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("No model configured");
    expect(fetched).toBe(false);
  });

  test("returns clear model errors", async () => {
    const harness = activate(async () => ({ model: "missing/model" }));
    await start(harness);
    const [tool] = harness.tools;
    if (!tool) throw new Error("codex_web_search was not registered");

    let result = await tool.execute("call", { query: "x" }, undefined, undefined, context(undefined).value);
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/not registered or authenticated/);

    result = await tool.execute(
      "call",
      { query: "x" },
      undefined,
      undefined,
      context({ ...model, api: "anthropic-messages" }).value,
    );
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/expected openai-responses/);

    result = await tool.execute("call", { query: "x" }, undefined, undefined, context(model, "").value);
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/no credential available/);
  });

  test("stops a pre-cancelled request before credential or header lookup", async () => {
    const harness = activate(async () => ({ model: "test-provider/gpt-test" }));
    await start(harness);
    const [tool] = harness.tools;
    if (!tool) throw new Error("codex_web_search was not registered");
    const controller = new AbortController();
    controller.abort(new DOMException("pre-cancelled", "AbortError"));
    let fetched = false;
    installFetch(async () => {
      fetched = true;
      return Response.json({ output_text: "unexpected" });
    });
    const ctx = context(model);

    const result = await tool.execute("call", { query: "x" }, controller.signal, undefined, ctx.value);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/pre-cancelled/);
    expect(ctx.calls.getApiKey).toBe(0);
    expect(ctx.calls.getProviderHeaders).toEqual([]);
    expect(ctx.calls.resolveModelHeaderSignals).toEqual([]);
    expect(fetched).toBe(false);
  });

  test("stops after an unabortable provider header lookup finishes", async () => {
    const harness = activate(async () => ({ model: "test-provider/gpt-test" }));
    await start(harness);
    const [tool] = harness.tools;
    if (!tool) throw new Error("codex_web_search was not registered");
    const controller = new AbortController();
    const providerStarted = Promise.withResolvers<void>();
    const providerHeaders = Promise.withResolvers<Record<string, string> | undefined>();
    let fetched = false;
    installFetch(async () => {
      fetched = true;
      return Response.json({ output_text: "unexpected" });
    });
    const ctx = context(model, "registry-secret", {
      providerHeaders: () => {
        providerStarted.resolve();
        return providerHeaders.promise;
      },
    });
    const request = tool.execute("call", { query: "x" }, controller.signal, undefined, ctx.value);
    await providerStarted.promise;
    controller.abort(new DOMException("cancelled during provider headers", "AbortError"));
    providerHeaders.resolve({ "x-provider": "late" });

    const result = await request;
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/cancelled during provider headers/);
    expect(ctx.calls.getProviderHeaders).toEqual(["test-provider"]);
    expect(ctx.calls.resolveModelHeaderSignals).toEqual([]);
    expect(fetched).toBe(false);
  });

  test("passes the abort signal to credential, model headers, and HTTP", async () => {
    const harness = activate(async () => ({ model: "test-provider/gpt-test" }));
    await start(harness);
    const [tool] = harness.tools;
    if (!tool) throw new Error("codex_web_search was not registered");
    const controller = new AbortController();
    const fetchStarted = Promise.withResolvers<void>();
    let httpSignal: AbortSignal | undefined;
    installFetch(async (_input, init) => {
      httpSignal = init?.signal ?? undefined;
      fetchStarted.resolve();
      const { promise, reject } = Promise.withResolvers<Response>();
      const signal = init?.signal;
      if (signal?.aborted) {
        reject(signal.reason);
        return promise;
      }
      signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      return promise;
    });
    const ctx = context(model);
    const request = tool.execute("call", { query: "x" }, controller.signal, undefined, ctx.value);
    await fetchStarted.promise;
    controller.abort(new DOMException("cancelled", "AbortError"));

    const result = await request;
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/cancel/i);
    expect(ctx.calls.getApiKeySignals).toEqual([controller.signal]);
    expect(ctx.calls.resolveModelHeaderSignals).toEqual([controller.signal]);
    expect(httpSignal).toBe(controller.signal);
  });
});
