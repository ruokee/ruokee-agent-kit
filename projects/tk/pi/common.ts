import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const MAX_OUTPUT_BYTES = 1024 * 1024;
const MAX_LOAD_ERROR_LENGTH = 500;
const RUNTIME_COMPAT = ">=0.1,<0.2";
const TOOL_NAMES = ["tk_search", "tk_read", "tk_create", "tk_update", "tk_log", "tk_exec"] as const;

export type ProcessResult = {
  stdout: string;
  stderr: string;
  code: number;
  killed: boolean;
};

export type ToolContext = { cwd: string; actor?: string };
export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  details: unknown;
};
export type RegisteredTool = {
  name: string;
  label: string;
  description: string;
  parameters: unknown;
  execute(params: Record<string, unknown>, signal: AbortSignal | undefined, context: ToolContext): Promise<ToolResult>;
};
export type HarnessAdapter = {
  harnessName: "pi";
  wrapSchema(schema: Record<string, unknown>): unknown;
  run(command: string, args: string[], cwd: string, signal?: AbortSignal): Promise<ProcessResult>;
  registerTool(tool: RegisteredTool): void;
};

type RuntimeEnvelope = {
  ok: boolean;
  data?: unknown;
  error?: unknown;
  warnings?: unknown[];
};
type ToolSchema = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};
type NativeContract = {
  contract_version: 2;
  runtime_version: string;
  runtime_compat: string[];
  harness: "pi";
  tools: ToolSchema[];
};

export function runBoundedProcess(
  command: string,
  args: string[],
  cwd: string,
  signal?: AbortSignal,
): Promise<ProcessResult> {
  if (signal?.aborted) {
    return Promise.reject(new Error("tk command was cancelled"));
  }

  const { promise, resolve, reject } = Promise.withResolvers<ProcessResult>();
  const child = spawn(command, args, {
    cwd,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let overflow = false;
  let settled = false;
  let cancelled = false;

  const stop = () => {
    if (!child.killed) {
      child.kill("SIGKILL");
    }
  };
  const capture = (chunks: Buffer[], stream: "stdout" | "stderr") => (chunk: Buffer | string) => {
    if (overflow) {
      return;
    }
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (stream === "stdout") {
      stdoutBytes += bytes.length;
      if (stdoutBytes > MAX_OUTPUT_BYTES) {
        overflow = true;
        stop();
        return;
      }
    } else {
      stderrBytes += bytes.length;
      if (stderrBytes > MAX_OUTPUT_BYTES) {
        overflow = true;
        stop();
        return;
      }
    }
    chunks.push(bytes);
  };
  const abort = () => {
    cancelled = true;
    stop();
  };
  const cleanup = () => signal?.removeEventListener("abort", abort);

  child.stdout.on("data", capture(stdout, "stdout"));
  child.stderr.on("data", capture(stderr, "stderr"));
  signal?.addEventListener("abort", abort, { once: true });
  child.once("error", (error) => {
    if (settled) {
      return;
    }
    settled = true;
    cleanup();
    reject(new Error(`tk process failed to start: ${error.message}`));
  });
  child.once("close", (code, processSignal) => {
    if (settled) {
      return;
    }
    settled = true;
    cleanup();
    if (overflow) {
      reject(new Error("tk output exceeded the 1 MiB adapter limit"));
      return;
    }
    resolve({
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8"),
      code: code ?? 1,
      killed: cancelled || processSignal !== null,
    });
  });
  if (signal?.aborted) {
    abort();
  }
  return promise;
}

export async function registerTkTools(adapter: HarnessAdapter): Promise<void> {
  const runtime = join(process.env.HOME ?? homedir(), ".local", "bin", "tk");
  await requireRuntime(runtime);
  const loadCwd = process.cwd();
  const version = await runRawJson(adapter, runtime, ["--version", "--output", "json"], loadCwd);
  if (!isObject(version) || typeof version.runtime_version !== "string") {
    throw new Error("tk returned an invalid version document");
  }

  const schema = await runRawJson(
    adapter,
    runtime,
    ["schema", "generate", "--type", "native", "--harness", "pi"],
    loadCwd,
  );
  const contract = parseContract(schema);
  if (contract.runtime_version !== version.runtime_version) {
    throw new Error("tk version and native schema runtime versions differ");
  }
  if (contract.runtime_compat.length !== 1 || contract.runtime_compat[0] !== RUNTIME_COMPAT) {
    throw new Error("tk native schema reports a different runtime compatibility range");
  }
  validateToolSet(contract.tools);

  const tools = contract.tools.map((definition) => makeTool(adapter, runtime, definition));
  for (const tool of tools) {
    adapter.registerTool(tool);
  }
}

export function loadErrorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_LOAD_ERROR_LENGTH);
}

async function requireRuntime(runtime: string): Promise<void> {
  let metadata;
  try {
    metadata = await stat(runtime);
  } catch {
    throw new Error(`tk runtime is not installed at ${runtime}`);
  }
  if (!metadata.isFile()) {
    throw new Error(`tk runtime is not a regular file at ${runtime}`);
  }
  try {
    await access(runtime, constants.X_OK);
  } catch {
    throw new Error(`tk runtime is not executable at ${runtime}`);
  }
}

function makeTool(adapter: HarnessAdapter, runtime: string, definition: ToolSchema): RegisteredTool {
  return {
    name: definition.name,
    label: toolLabel(definition.name),
    description: definition.description,
    parameters: adapter.wrapSchema(definition.inputSchema),
    async execute(params, signal, context) {
      if (definition.name === "tk_exec") {
        return executeRaw(adapter, runtime, params, signal, context);
      }
      const cwd = requestCwd(params.cwd, context.cwd);
      const actor = params.actor ?? context.actor ?? adapter.harnessName;
      const args = ["--output", "json", "--cwd", cwd];
      args.push(...mapArguments(definition.name, params, actor));
      const envelope = await runEnvelope(adapter, runtime, args, context.cwd, signal);
      return toolResult(envelope);
    },
  };
}

function mapArguments(name: string, params: Record<string, unknown>, actor: unknown): string[] {
  switch (name) {
    case "tk_search": {
      const args = ["search", requiredString(params, "query")];
      flag(args, params.regex, "--regex");
      flag(args, params.search_body, "--search-body");
      repeat(args, params.status, "--status");
      jsonOption(args, params, "extra", "--extra");
      option(args, params.limit, "--limit");
      return args;
    }
    case "tk_read": {
      const args = ["read", requiredString(params, "task_ref")];
      option(args, params.view, "--view");
      option(args, params.wal_max_entries, "--wal-max-entries");
      option(args, params.wal_max_length, "--wal-max-length");
      return args;
    }
    case "tk_create":
      return createArguments(params);
    case "tk_update": {
      const args = ["update", requiredString(params, "task_ref")];
      repeat(args, params.depends_on_add, "--depends-on-add");
      repeat(args, params.depends_on_remove, "--depends-on-remove");
      repeat(args, params.related_to_add, "--related-to-add");
      repeat(args, params.related_to_remove, "--related-to-remove");
      jsonOption(args, params, "extra_set", "--extra-set");
      repeat(args, params.extra_remove, "--extra-remove");
      flag(args, params.start, "--start");
      option(args, params.close, "--close");
      option(args, params.reopen, "--reopen");
      flag(args, params.force, "--force");
      args.push("--user-confirmed", String(Boolean(params.user_confirmed)));
      option(args, actor, "--actor");
      return args;
    }
    case "tk_log": {
      const args = ["log", requiredString(params, "task_ref"), "--message", requiredString(params, "message")];
      option(args, params.body, "--body");
      option(args, actor, "--actor");
      return args;
    }
    default:
      throw new Error(`Unsupported first-class tk tool: ${name}`);
  }
}

function createArguments(params: Record<string, unknown>): string[] {
  const type = requiredString(params, "type");
  if (type === "task") {
    const args = ["create", "task", requiredString(params, "name")];
    option(args, params.status, "--status");
    option(args, params.created_at, "--created-at");
    repeat(args, params.depends_on, "--depends-on");
    repeat(args, params.related_to, "--related-to");
    jsonOption(args, params, "extra", "--extra");
    args.push("--user-confirmed", String(Boolean(params.user_confirmed)));
    return args;
  }
  if (type === "subtasks" && Array.isArray(params.subtasks)) {
    const args = ["create", "subtask", requiredString(params, "parent_ref")];
    for (const subtask of params.subtasks) {
      if (!isObject(subtask)) {
        throw new Error("each subtask must be an object");
      }
      args.push("--item", JSON.stringify({ ...subtask, body: undefined }));
    }
    args.push("--user-confirmed", String(Boolean(params.user_confirmed)));
    return args;
  }
  throw new Error(`Unsupported create type: ${type}`);
}

async function executeRaw(
  adapter: HarnessAdapter,
  runtime: string,
  params: Record<string, unknown>,
  signal: AbortSignal | undefined,
  context: ToolContext,
): Promise<ToolResult> {
  if (!stringArray(params.argv) || params.argv.length === 0) {
    throw new Error("argv must be a non-empty array of strings");
  }
  const first = params.argv[0];
  if (!["--version", "init", "check", "rename"].includes(first)) {
    throw new Error(`tk_exec does not support ${first}`);
  }
  if (params.actor !== undefined && first !== "rename") {
    throw new Error("actor is accepted only for tk_exec rename");
  }
  const args = [...params.argv];
  if (first === "rename") {
    option(args, params.actor ?? context.actor ?? adapter.harnessName, "--actor");
  }
  const result = await adapter.run(runtime, args, requestCwd(params.cwd, context.cwd), signal);
  enforceResult(result, signal);
  if (result.code !== 0) {
    throw new Error(JSON.stringify({ code: result.code, stdout: result.stdout, stderr: result.stderr }));
  }
  return toolResult({
    ok: true,
    data: { exit_code: result.code, stdout: result.stdout, stderr: result.stderr },
  });
}

async function runEnvelope(
  adapter: HarnessAdapter,
  runtime: string,
  args: string[],
  cwd: string,
  signal?: AbortSignal,
): Promise<RuntimeEnvelope> {
  const result = await adapter.run(runtime, args, cwd, signal);
  enforceResult(result, signal);
  const value = parseJson(result);
  if (!isObject(value) || result.code !== 0 || value.ok !== true) {
    throw new Error(JSON.stringify(isObject(value) ? value.error : value));
  }
  return value as RuntimeEnvelope;
}

async function runRawJson(adapter: HarnessAdapter, runtime: string, args: string[], cwd: string): Promise<unknown> {
  const result = await adapter.run(runtime, args, cwd);
  enforceResult(result);
  if (result.code !== 0) {
    throw new Error(JSON.stringify({ code: result.code, stderr: result.stderr }));
  }
  return parseJson(result);
}

function parseContract(value: unknown): NativeContract {
  if (
    !isObject(value) ||
    value.contract_version !== 2 ||
    value.schema_type !== "native" ||
    value.harness !== "pi" ||
    typeof value.runtime_version !== "string" ||
    !Array.isArray(value.runtime_compat) ||
    !Array.isArray(value.tools)
  ) {
    throw new Error("tk returned an invalid Pi native tool contract");
  }
  const tools = value.tools.map((tool) => {
    if (
      !isObject(tool) ||
      typeof tool.name !== "string" ||
      typeof tool.description !== "string" ||
      !isObject(tool.inputSchema) ||
      Object.hasOwn(tool, "loadMode")
    ) {
      throw new Error("tk returned an invalid Pi native tool definition");
    }
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    };
  });
  return {
    contract_version: 2,
    runtime_version: value.runtime_version,
    runtime_compat: value.runtime_compat.map(String),
    harness: "pi",
    tools,
  };
}

function validateToolSet(tools: ToolSchema[]): void {
  const names = tools.map((tool) => tool.name);
  if (names.length !== TOOL_NAMES.length || names.some((name, index) => name !== TOOL_NAMES[index])) {
    throw new Error(`tk native schema must expose exactly: ${TOOL_NAMES.join(", ")}`);
  }
}

function enforceResult(result: ProcessResult, signal?: AbortSignal): void {
  if (Buffer.byteLength(result.stdout) > MAX_OUTPUT_BYTES || Buffer.byteLength(result.stderr) > MAX_OUTPUT_BYTES) {
    throw new Error("tk output exceeded the 1 MiB adapter limit");
  }
  if (result.killed || signal?.aborted) {
    throw new Error("tk command was cancelled");
  }
}

function parseJson(result: ProcessResult): unknown {
  try {
    return JSON.parse(result.stdout.trim()) as unknown;
  } catch (error) {
    throw new Error(`tk returned invalid JSON: ${String(error)}; stderr=${result.stderr}`);
  }
}

function toolLabel(name: string): string {
  return name
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function requestCwd(value: unknown, sessionCwd: string): string {
  if (value === undefined) {
    return resolve(sessionCwd);
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("cwd must be a non-empty path string");
  }
  return resolve(sessionCwd, value);
}

function requiredString(object: Record<string, unknown>, key: string): string {
  const value = object[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value;
}

function option(args: string[], value: unknown, name: string): void {
  if (value !== undefined) {
    args.push(name, String(value));
  }
}

function flag(args: string[], value: unknown, name: string): void {
  if (value === true) {
    args.push(name);
  }
}

function repeat(args: string[], value: unknown, name: string): void {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array`);
  }
  for (const item of value) {
    args.push(name, String(item));
  }
}

function jsonOption(args: string[], object: Record<string, unknown>, key: string, name: string): void {
  if (Object.hasOwn(object, key)) {
    args.push(name, JSON.stringify(object[key]));
  }
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toolResult(envelope: RuntimeEnvelope): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(envelope) }],
    details: envelope,
  };
}
