/**
 * Extension entry and execution-chain tests.
 *
 * Drives the real extension factory through a stub Extension API and the
 * real per-module execution path with a stub extension context:
 *
 * - registration honors the config: defaults, per-tool disablement, both
 *   load modes, and explicit null rejection, with `read` approval on every
 *   registered tool;
 * - an invalid configuration (malformed YAML, unknown field, wrong type or
 *   value, unreadable file) registers zero tools and reports the problem;
 * - execution resolves the configured model, fetches its credential, and
 *   passes the URL/prompt inputs through to the Responses request;
 * - model failures (missing config, unresolvable model, missing
 *   credential, wrong API type) return clear error results;
 * - the abort signal reaches the credential lookup and the HTTP request;
 * - page extraction rejects non-HTTP(S) URLs before any model or network
 *   work.
 *
 * The agent directory is a real temp dir: this file sets
 * `PI_CODING_AGENT_DIR` before importing the extension, so the real
 * `getAgentDir()` reads it. Each test writes the YAML it needs before
 * activating the factory.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { YAML } from "bun";
// Module-load boundary: set the agent dir env before the first import of
// pi-coding-agent (transitively loaded by src/extension.ts), because the
// dirs resolver caches the directory at module init.
const AGENT_DIR = mkdtempSync(path.join(tmpdir(), "codex-web-entry-"));
const ORIGINAL_AGENT_DIR = process.env.PI_CODING_AGENT_DIR;
process.env.PI_CODING_AGENT_DIR = AGENT_DIR;
const { default: factory } = await import("../src/extension.ts");

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

/** Restore the agent dir env and clean the temp dir after the whole file. */
process.on("exit", () => {
  if (ORIGINAL_AGENT_DIR === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = ORIGINAL_AGENT_DIR;
  rmSync(AGENT_DIR, { recursive: true, force: true });
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

interface Harness {
  tools: RegisteredTool[];
  warnings: string[];
}

/** Activate the factory against the current agent dir and config. */
function activate(): Harness {
  const harness: Harness = { tools: [], warnings: [] };
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
  factory({
    logger: { warn: (message: string) => harness.warnings.push(message) },
    registerTool: (tool: unknown) => harness.tools.push(tool as RegisteredTool),
    zod: { z: { object: (shape: Record<string, unknown>) => shape, string: () => ({ ...zodString }) } },
  } as never);
  return harness;
}

/** Write a config file (or delete it when null) before activation. */
function setConfig(yaml: string | null): void {
  const file = path.join(AGENT_DIR, "omp-codex-web-access.yml");
  if (yaml === null) {
    rmSync(file, { force: true });
  } else {
    writeFileSync(file, yaml);
  }
}

/** Minimal structured model stub satisfying the transport's field needs. */
const model = {
  api: "openai-responses",
  baseUrl: "https://example.test/v1",
  id: "gpt-test",
  provider: "test-provider",
};

/** Stub extension context with a resolvable model and recorded calls. */
function context(registered: typeof model | undefined, key: string | undefined = "registry-secret") {
  const calls = { getApiKey: 0, resolve: [] as string[], getApiKeySignals: [] as (AbortSignal | undefined)[] };
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
        async getApiKey(_model: unknown, _sessionId: unknown, options?: { signal?: AbortSignal }) {
          calls.getApiKey += 1;
          calls.getApiKeySignals.push(options?.signal);
          return key;
        },
        getProviderHeaders() {
          return { "x-provider": "configured" };
        },
      },
    },
  };
}

describe("extension entry registration", () => {
  test("missing file registers both tools with default load modes", async () => {
    setConfig(null);
    const { tools } = activate();
    expect(tools.map((tool) => tool.name)).toEqual(["codex_web_search", "codex_web_fetch"]);
    expect(tools.map((tool) => tool.loadMode)).toEqual(["essential", "discoverable"]);
    expect(tools.every((tool) => tool.approval === "read")).toBe(true);
    expect(String(tools[1]?.description)).toMatch(/model-assisted/);
    expect(String(tools[1]?.description)).toMatch(/not raw HTML/);
  });

  test("each tool can be disabled independently", async () => {
    setConfig("tools:\n  codex_web_search:\n    enabled: false\n");
    expect(activate().tools.map((tool) => tool.name)).toEqual(["codex_web_fetch"]);

    setConfig("tools:\n  codex_web_fetch:\n    enabled: false\n");
    expect(activate().tools.map((tool) => tool.name)).toEqual(["codex_web_search"]);
  });

  test("loadMode is honored per tool", async () => {
    setConfig("tools:\n  codex_web_search:\n    loadMode: discoverable\n  codex_web_fetch:\n    loadMode: essential\n");
    expect(activate().tools.map((tool) => tool.loadMode)).toEqual(["discoverable", "essential"]);
  });

  test("explicit null fields register nothing and report the field", async () => {
    for (const yaml of ["model: null\n", "tools: null\n", "tools:\n  codex_web_search: null\n"]) {
      setConfig(yaml);
      const { tools, warnings } = activate();
      expect(tools).toEqual([]);
      expect(warnings[0]).toContain("omp-codex-web-access");
    }
  });

  test("invalid YAML registers nothing and reports the problem", async () => {
    setConfig("model: [unclosed\n");
    const { tools, warnings } = activate();
    expect(tools).toEqual([]);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain("omp-codex-web-access");
  });

  test("unknown top-level field registers nothing", async () => {
    setConfig("model: provider/m\nversion: 2\n");
    const { tools, warnings } = activate();
    expect(tools).toEqual([]);
    expect(warnings[0]).toContain("version");
  });

  test("wrong type and invalid values register nothing", async () => {
    setConfig("model: 42\n");
    expect(activate().tools).toEqual([]);

    setConfig("tools:\n  codex_web_search:\n    loadMode: sideways\n");
    const { tools, warnings } = activate();
    expect(tools).toEqual([]);
    expect(warnings[0]).toContain("loadMode");
  });

  test("unreadable config registers nothing and explains the read failure", () => {
    // A directory at the config path makes readFileSync fail with EISDIR,
    // exercising the non-ENOENT error branch on a real filesystem.
    setConfig(null);
    mkdirSync(path.join(AGENT_DIR, "omp-codex-web-access.yml"));
    try {
      const { tools, warnings } = activate();
      expect(tools).toEqual([]);
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toContain("omp-codex-web-access");
      expect(warnings[0]).toContain("Cannot read");
    } finally {
      rmSync(path.join(AGENT_DIR, "omp-codex-web-access.yml"), { recursive: true, force: true });
    }
  });
});

describe("tool execution chain", () => {
  test("search resolves the configured model, gets its credential, and sends the query", async () => {
    setConfig("model: test-provider/gpt-test\n");
    const [tool] = activate().tools;
    if (!tool) throw new Error("codex_web_search was not registered");
    let body: Record<string, unknown> = {};
    installFetch(async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return Response.json({ output_text: "Found it" });
    });
    const ctx = context(model);
    const result = await tool.execute("call", { query: "needle" }, undefined, undefined, ctx.value);
    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toBe("Found it");
    expect(ctx.calls.resolve).toEqual(["test-provider/gpt-test"]);
    expect(ctx.calls.getApiKey).toBe(1);
    expect(body.input).toBe("needle");
  });

  test("fetch passes the URL and extraction prompt to Responses", async () => {
    setConfig("model: test-provider/gpt-test\n");
    const [, tool] = activate().tools;
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
    setConfig("model: test-provider/gpt-test\n");
    const [, tool] = activate().tools;
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
    setConfig(null);
    const [tool] = activate().tools;
    if (!tool) throw new Error("codex_web_search was not registered");
    let fetched = false;
    installFetch(async () => {
      fetched = true;
      return Response.json({});
    });
    const result = await tool.execute("call", { query: "x" }, undefined, undefined, context(model).value);
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("omp-codex-web-access.yml");
    expect(fetched).toBe(false);
  });

  test("returns clear model errors", async () => {
    setConfig("model: missing/model\n");
    const [tool] = activate().tools;
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

  test("propagates the abort signal to credential lookup and HTTP request", async () => {
    setConfig("model: test-provider/gpt-test\n");
    const [tool] = activate().tools;
    if (!tool) throw new Error("codex_web_search was not registered");
    const controller = new AbortController();
    let httpSignal: AbortSignal | undefined;
    installFetch(async (_input, init) => {
      httpSignal = init?.signal ?? undefined;
      const { promise, reject } = Promise.withResolvers<Response>();
      const signal = init?.signal;
      // Real fetch rejects synchronously for an already-aborted signal; the
      // execute path awaits credential lookup before fetching, so abort can
      // fire before the request starts.
      if (signal?.aborted) {
        reject(signal.reason);
        return promise;
      }
      signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      return promise;
    });
    const ctx = context(model);
    // Cancellation surfaces as an error result (the tool boundary catches),
    // so the observable contract is the error message plus signal flow.
    const request = tool.execute("call", { query: "x" }, controller.signal, undefined, ctx.value);
    controller.abort(new DOMException("cancelled", "AbortError"));
    const result = await request;
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/cancel/i);
    expect(ctx.calls.getApiKeySignals[0]).toBe(controller.signal);
    expect(httpSignal).toBe(controller.signal);
  });
});
