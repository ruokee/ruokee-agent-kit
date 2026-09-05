import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  registerTkTools as registerPiTools,
  runBoundedProcess as runPiProcess,
  type RegisteredTool as PiTool,
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
    contract_version: 2,
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
        return success({ ...contract("pi"), contract_version: 3 });
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
