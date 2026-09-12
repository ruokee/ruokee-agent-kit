import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  registerTkTools as registerPiTools,
  runBoundedProcess as runPiProcess,
  type RegisteredTool as PiTool,
  type ProcessResult,
} from "../pi/common.ts";
import {
  registerTkTools as registerOmpTools,
  runBoundedProcess as runOmpProcess,
  type RegisteredTool as OmpTool,
} from "../omp/common.ts";

const originalHome = process.env.HOME;
let temporaryHome: string | undefined;

afterEach(async () => {
  process.env.HOME = originalHome;
  if (temporaryHome !== undefined) {
    await rm(temporaryHome, { recursive: true, force: true });
    temporaryHome = undefined;
  }
});

async function installFakeRuntime(): Promise<string> {
  temporaryHome = await mkdtemp(join(tmpdir(), "tk-adapter-"));
  process.env.HOME = temporaryHome;
  const directory = join(temporaryHome, ".local", "bin");
  await mkdir(directory, { recursive: true });
  const runtime = join(directory, "tk");
  await writeFile(runtime, "#!/bin/sh\nexit 0\n");
  await chmod(runtime, 0o755);
  return runtime;
}

function contract(harness: "pi" | "omp") {
  const names = ["tk_search", "tk_read", "tk_create", "tk_update", "tk_log", "tk_exec"];
  return {
    contract_version: 3,
    runtime_version: "0.1.0",
    runtime_compat: [">=0.1,<0.2"],
    schema_type: "native",
    harness,
    tools: names.map((name) => ({
      name,
      description: name,
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      ...(harness === "omp"
        ? {
            loadMode: name === "tk_exec" ? "discoverable" : "essential",
          }
        : {}),
    })),
  };
}

function success(stdout: unknown) {
  return {
    stdout: typeof stdout === "string" ? stdout : JSON.stringify(stdout),
    stderr: "",
    code: 0,
    killed: false,
  };
}

describe("bounded process runners", () => {
  test("pass arguments directly without shell interpretation", async () => {
    const expected = "literal; echo not-a-shell";
    const [pi, omp] = await Promise.all([
      runPiProcess("/bin/printf", ["%s", expected], tmpdir()),
      runOmpProcess("/bin/printf", ["%s", expected], tmpdir()),
    ]);
    expect(pi).toEqual({ stdout: expected, stderr: "", code: 0, killed: false });
    expect(omp).toEqual({ stdout: expected, stderr: "", code: 0, killed: false });
  });

  test("kill processes when either output stream exceeds one MiB", async () => {
    await expect(
      runPiProcess(process.execPath, ["-e", 'process.stdout.write("x".repeat(1024 * 1024 + 1))'], tmpdir()),
    ).rejects.toThrow("output exceeded the 1 MiB adapter limit");
    await expect(
      runOmpProcess(process.execPath, ["-e", 'process.stderr.write("x".repeat(1024 * 1024 + 1))'], tmpdir()),
    ).rejects.toThrow("output exceeded the 1 MiB adapter limit");
  });

  test("kill cancelled processes and report the killed result", async () => {
    const piController = new AbortController();
    const ompController = new AbortController();
    const blockingScript = "Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0)";
    const pi = runPiProcess(process.execPath, ["-e", blockingScript], tmpdir(), piController.signal);
    const omp = runOmpProcess(process.execPath, ["-e", blockingScript], tmpdir(), ompController.signal);
    piController.abort();
    ompController.abort();
    const [piResult, ompResult] = await Promise.all([pi, omp]);
    expect(piResult.killed).toBe(true);
    expect(ompResult.killed).toBe(true);
  });
});

describe("Pi native adapter", () => {
  test("validates before registration and maps Revision 7 CLI fields", async () => {
    const runtime = await installFakeRuntime();
    const registered: PiTool[] = [];
    const calls: Array<{ command: string; args: string[]; cwd: string }> = [];
    await registerPiTools({
      harnessName: "pi",
      wrapSchema: (schema) => schema,
      async run(command, args, cwd) {
        calls.push({ command, args, cwd });
        if (args[0] === "--version") {
          return success({ runtime_version: "0.1.0" });
        }
        if (args[0] === "schema") {
          return success(contract("pi"));
        }
        return success({ ok: true, data: { mapped: true } });
      },
      registerTool(tool) {
        registered.push(tool);
      },
    });

    expect(registered).toHaveLength(6);
    expect(registered.every((tool) => !("loadMode" in tool))).toBe(true);
    const read = registered.find((tool) => tool.name === "tk_read");
    await read?.execute({ task_ref: "task", wal_max_entries: 7, wal_max_length: 8192 }, undefined, {
      cwd: temporaryHome!,
    });
    expect(calls.at(-1)).toEqual({
      command: runtime,
      args: [
        "--output",
        "json",
        "--cwd",
        temporaryHome!,
        "read",
        "task",
        "--wal-max-entries",
        "7",
        "--wal-max-length",
        "8192",
      ],
      cwd: temporaryHome!,
    });
    const create = registered.find((tool) => tool.name === "tk_create");
    await create?.execute(
      {
        type: "task",
        name: "top",
        body: "ignored body",
        status: "open",
        user_confirmed: true,
      },
      undefined,
      { cwd: temporaryHome! },
    );
    expect(calls.at(-1)?.args).toEqual([
      "--output",
      "json",
      "--cwd",
      temporaryHome!,
      "create",
      "task",
      "top",
      "--status",
      "open",
      "--user-confirmed",
      "true",
    ]);
    await create?.execute(
      {
        type: "subtasks",
        parent_ref: "parent",
        subtasks: [{ name: "child", status: "planning", body: "ignored body" }],
        user_confirmed: false,
      },
      undefined,
      { cwd: temporaryHome! },
    );
    expect(calls.at(-1)?.args.slice(-4)).toEqual([
      "--item",
      JSON.stringify({ name: "child", status: "planning" }),
      "--user-confirmed",
      "false",
    ]);
  });
  test("registers no tools when native schema validation fails", async () => {
    await installFakeRuntime();
    const registered: PiTool[] = [];
    const registration = registerPiTools({
      harnessName: "pi",
      wrapSchema: (schema) => schema,
      async run(_command, args) {
        if (args[0] === "--version") {
          return success({ runtime_version: "0.1.0" });
        }
        return success({ ...contract("pi"), contract_version: 2 });
      },
      registerTool(tool) {
        registered.push(tool);
      },
    });
    await expect(registration).rejects.toThrow("invalid Pi native tool contract");
    expect(registered).toHaveLength(0);
  });
});

describe("OMP native adapter", () => {
  test("uses Rust-provided load modes and command-local actor", async () => {
    const runtime = await installFakeRuntime();
    const registered: OmpTool[] = [];
    const calls: Array<{ command: string; args: string[]; cwd: string }> = [];
    await registerOmpTools({
      harnessName: "omp",
      wrapSchema: (schema) => schema,
      async run(command, args, cwd) {
        calls.push({ command, args, cwd });
        if (args[0] === "--version") {
          return success({ runtime_version: "0.1.0" });
        }
        if (args[0] === "schema") {
          return success(contract("omp"));
        }
        return success({ ok: true, data: { mapped: true } });
      },
      registerTool(tool) {
        registered.push(tool);
      },
    });

    expect(registered.find((tool) => tool.name === "tk_search")?.loadMode).toBe("essential");
    expect(registered.find((tool) => tool.name === "tk_exec")?.loadMode).toBe("discoverable");
    expect(registered.find((tool) => tool.name === "tk_update")?.loadMode).toBe("essential");
    const update = registered.find((tool) => tool.name === "tk_update");
    await update?.execute({ task_ref: "task", start: true, user_confirmed: true }, undefined, {
      cwd: temporaryHome!,
      actor: "omp:test/model",
    });
    expect(calls.at(-1)).toEqual({
      command: runtime,
      args: [
        "--output",
        "json",
        "--cwd",
        temporaryHome!,
        "update",
        "task",
        "--start",
        "--user-confirmed",
        "true",
        "--actor",
        "omp:test/model",
      ],
      cwd: temporaryHome!,
    });
    const create = registered.find((tool) => tool.name === "tk_create");
    await create?.execute(
      {
        type: "task",
        name: "top",
        body: "ignored body",
        status: "open",
        user_confirmed: true,
      },
      undefined,
      { cwd: temporaryHome! },
    );
    expect(calls.at(-1)?.args).toEqual([
      "--output",
      "json",
      "--cwd",
      temporaryHome!,
      "create",
      "task",
      "top",
      "--status",
      "open",
      "--user-confirmed",
      "true",
    ]);
    await create?.execute(
      {
        type: "subtasks",
        parent_ref: "parent",
        subtasks: [{ name: "child", body: "ignored body" }],
        user_confirmed: true,
      },
      undefined,
      { cwd: temporaryHome! },
    );
    expect(calls.at(-1)?.args.slice(-4)).toEqual([
      "--item",
      JSON.stringify({ name: "child" }),
      "--user-confirmed",
      "true",
    ]);
  });
});

for (const harness of ["pi", "omp"] as const) {
  describe(`${harness} result boundaries`, () => {
    async function toolsReturning(result: ProcessResult) {
      await installFakeRuntime();
      const tools: Array<PiTool | OmpTool> = [];
      const adapter = {
        wrapSchema: (schema: Record<string, unknown>) => schema,
        async run(_command: string, args: string[]) {
          if (args[0] === "--version") return success({ runtime_version: "0.1.0" });
          if (args[0] === "schema") return success(contract(harness));
          return result;
        },
        registerTool: (tool: PiTool | OmpTool) => {
          tools.push(tool);
        },
      };
      if (harness === "pi") await registerPiTools({ ...adapter, harnessName: "pi" });
      else await registerOmpTools({ ...adapter, harnessName: "omp" });
      return tools;
    }

    test("preserves success, warnings, and structured domain failures", async () => {
      const result = success({});
      const tools = await toolsReturning(result);
      const read = tools.find((tool) => tool.name === "tk_read")!;
      const cases = [
        { code: 0, envelope: { ok: true, data: { found: true } } },
        {
          code: 0,
          envelope: {
            ok: true,
            data: { committed: true },
            warnings: [{ code: "wal_append_failed", message: "WAL unavailable", details: { task_ref: "task" } }],
          },
        },
        {
          code: 3,
          envelope: {
            ok: false,
            error: {
              code: "task_not_found",
              category: "resolution",
              message: "Task not found",
              details: { task_ref: "task" },
            },
          },
        },
        {
          code: 3,
          envelope: {
            ok: false,
            error: {
              code: "creation_confirmation_required",
              category: "policy",
              message: "Confirmation required",
            },
          },
        },
        {
          code: 4,
          envelope: {
            ok: false,
            error: {
              code: "partial_commit",
              category: "storage",
              message: "Some targets committed",
              details: {
                committed: true,
                completed: ["first"],
                uncompleted: ["second"],
                original_error: { code: "io_error", category: "storage", message: "Write failed" },
              },
            },
          },
        },
        {
          code: 2,
          envelope: { ok: false, error: { code: "invalid_request", category: "request", message: "Invalid input" } },
        },
        {
          code: 5,
          envelope: { ok: false, error: { code: "project_not_found", category: "environment", message: "No project" } },
        },
        {
          code: 130,
          envelope: { ok: false, error: { code: "cancelled", category: "cancelled", message: "Cancelled by runtime" } },
        },
      ];
      for (const { code, envelope } of cases) {
        Object.assign(result, success(envelope), { code });
        const output = await read.execute({ task_ref: "task" }, undefined, { cwd: temporaryHome! });
        expect(output.details).toEqual(envelope);
        expect(JSON.parse(output.content[0]!.text)).toEqual(envelope);
      }
    });

    test("rejects protocol failures, cancelled commands, and oversized output", async () => {
      const result = success({});
      const tools = await toolsReturning(result);
      const read = tools.find((tool) => tool.name === "tk_read")!;
      const failures = [
        { ...success("not JSON"), code: 2 },
        { ...success({ ok: true, data: {} }), code: 2 },
        success({ ok: false, error: { code: "failure", category: "internal", message: "Failure", details: {} } }),
        { ...success({ ok: false, error: "failure" }), code: 2 },
        { ...success({ ok: false, error: { code: "failure" } }), code: 2 },
        { ...success({ ok: false, error: { code: "failure", category: "internal", message: "Panic" } }), code: 101 },
        success({ ok: true }),
        { ...success({ ok: true, data: {} }), killed: true },
        success("x".repeat(1024 * 1024 + 1)),
      ];
      for (const failure of failures) {
        Object.assign(result, failure);
        await expect(read.execute({ task_ref: "task" }, undefined, { cwd: temporaryHome! })).rejects.toThrow();
      }
      Object.assign(result, success({ ok: true, data: {} }));
      const controller = new AbortController();
      controller.abort();
      await expect(read.execute({ task_ref: "task" }, controller.signal, { cwd: temporaryHome! })).rejects.toThrow(
        "cancelled",
      );
    });

    test("keeps tk_exec raw output and nonzero exit behavior", async () => {
      const result = { ...success("raw stdout"), stderr: "raw stderr" };
      const tools = await toolsReturning(result);
      const exec = tools.find((tool) => tool.name === "tk_exec")!;
      const output = await exec.execute({ argv: ["check"] }, undefined, { cwd: temporaryHome! });
      expect(output.details).toEqual({ ok: true, data: { exit_code: 0, stdout: "raw stdout", stderr: "raw stderr" } });
      result.code = 2;
      await expect(exec.execute({ argv: ["check"] }, undefined, { cwd: temporaryHome! })).rejects.toThrow("raw stderr");
    });
  });
}
