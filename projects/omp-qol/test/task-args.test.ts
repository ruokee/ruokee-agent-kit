/** Task argument cleanup behavior, guard, and activation tests. */

import { describe, expect, test } from "bun:test";
import type { ToolInfo } from "@oh-my-pi/pi-coding-agent";
import type { ModuleState } from "../src/extension.ts";
import { parseQolSettings, type ModuleId, type QolSettings } from "../src/settings.ts";
import { installTaskArgsModule, sanitizeTaskArgs } from "../src/task-args.ts";
import { createHarness, moduleContext, type Harness } from "./host.ts";

function settings(overrides: Record<string, unknown> = {}): QolSettings {
  const parsed = parseQolSettings(overrides);
  if (parsed.kind !== "loaded") throw new Error("expected loaded settings");
  return parsed.settings;
}

function tasksOf(next: Record<string, unknown> | undefined): unknown[] {
  if (next === undefined) throw new Error("expected a rewritten input");
  const tasks = next.tasks;
  if (!Array.isArray(tasks)) throw new Error("expected a tasks array");
  return tasks;
}

type TaskSchemaShape = "single" | "batch" | "model-only" | "json-schema" | "json-schema-model-only";

function taskTool(source = "builtin", shape: TaskSchemaShape = "single"): ToolInfo {
  const hasSeance = shape !== "model-only" && shape !== "json-schema-model-only";
  const properties = !hasSeance
    ? { model: { type: "string" } }
    : shape === "batch"
      ? {
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: { sourceSession: { type: "string" }, model: { type: "string" } },
            },
          },
        }
      : { sourceSession: { type: "string" }, model: { type: "string" } };
  const schema = { type: "object", properties };
  const parameters =
    shape === "json-schema" || shape === "json-schema-model-only" ? schema : { toJsonSchema: () => schema };
  return {
    name: "task",
    description: "task",
    parameters,
    sourceInfo: { path: "<builtin:task>", source, scope: "temporary", origin: "top-level" },
  } as unknown as ToolInfo;
}

function install(overrides: { tool?: ToolInfo | null; settings?: QolSettings }): {
  state: ModuleState;
  harness: Harness;
  statuses: Array<{ id: ModuleId; state: ModuleState }>;
  reports: string[];
} {
  const infos = overrides.tool === null ? [] : [overrides.tool ?? taskTool()];
  const harness = createHarness(infos);
  const statuses: Array<{ id: ModuleId; state: ModuleState }> = [];
  const reports: string[] = [];
  const context = moduleContext({
    pi: harness.pi,
    ctx: harness.context(),
    settings: overrides.settings ?? settings(),
    report: (key, message) => reports.push(`${key}: ${message}`),
    setStatus: (id, state) => statuses.push({ id, state }),
  });
  return { state: installTaskArgsModule(context), harness, statuses, reports };
}

describe("sanitizeTaskArgs", () => {
  test("removes both fields from a flat non-seance call and preserves other arguments", () => {
    const input = {
      agent: "worker",
      sourceSession: "",
      model: "@ds-flash",
      task: "do it",
      nested: { value: 1 },
    };
    const next = sanitizeTaskArgs(input);

    expect(next).toEqual({ agent: "worker", task: "do it", nested: { value: 1 } });
    expect(next).not.toBe(input);
    expect(input).toHaveProperty("sourceSession");
    expect(input).toHaveProperty("model");
  });

  test("cleans each batch item and keeps untouched items by identity", () => {
    const seance = { agent: "seance", sourceSession: "session", model: "model" };
    const untouched = { agent: "worker", task: "unchanged" };
    const changed = { agent: "worker", sourceSession: "", model: "", task: "changed" };
    const input = { tasks: [seance, untouched, changed], sourceSession: "batch-level" };

    const next = sanitizeTaskArgs(input);
    const tasks = tasksOf(next);

    expect(tasks).toHaveLength(3);
    expect(tasks[0]).toBe(seance);
    expect(tasks[1]).toBe(untouched);
    expect(tasks[2]).toEqual({ agent: "worker", task: "changed" });
    expect(next?.sourceSession).toBe("batch-level");
    expect(input.tasks[2]).toBe(changed);
  });

  test("trims the agent and keeps both fields on seance items", () => {
    expect(sanitizeTaskArgs({ agent: " seance ", sourceSession: "session", model: "model" })).toBeUndefined();
  });

  test("leaves a missing, empty, whitespace, non-string, or null agent unchanged", () => {
    const agents: unknown[] = [undefined, "", "   ", 7, null];
    for (const agent of agents) {
      const input = { agent, sourceSession: "", model: "" };
      expect(sanitizeTaskArgs(input)).toBeUndefined();
    }
  });

  test("returns undefined when the item has no target field", () => {
    expect(sanitizeTaskArgs({ agent: "worker", task: "do it" })).toBeUndefined();
  });

  test("treats a non-array tasks value as a flat call", () => {
    expect(sanitizeTaskArgs({ agent: "worker", tasks: "not-an-array", sourceSession: "" })).toEqual({
      agent: "worker",
      tasks: "not-an-array",
    });
  });

  test("skips non-object batch items and returns undefined when nothing changed", () => {
    const input = { tasks: [null, "text", { agent: "worker", sourceSession: "", model: "" }] };
    const next = sanitizeTaskArgs(input);
    const tasks = tasksOf(next);
    expect(tasks[0]).toBeNull();
    expect(tasks[1]).toBe("text");
    expect(tasks[2]).toEqual({ agent: "worker" });

    expect(
      sanitizeTaskArgs({
        tasks: [null, "text", { agent: "seance", sourceSession: "session" }, { agent: "worker" }],
      }),
    ).toBeUndefined();
  });
});

describe("installTaskArgsModule", () => {
  test("registers for a built-in task tool and counts rewritten calls", async () => {
    const installed = install({});
    expect(installed.state).toEqual({ status: "enabled", detail: "rewrites=0" });
    expect(installed.harness.handlers.get("tool_call")).toHaveLength(1);

    const ctx = installed.harness.context();
    const first = await installed.harness.emit(
      "tool_call",
      {
        type: "tool_call",
        toolCallId: "1",
        toolName: "task",
        input: { agent: "worker", sourceSession: "", model: "" },
      },
      ctx,
    );
    expect(first).toEqual([{ input: { agent: "worker" } }]);
    expect(installed.statuses.at(-1)).toEqual({
      id: "taskArgs",
      state: { status: "enabled", detail: "rewrites=1" },
    });

    const other = await installed.harness.emit(
      "tool_call",
      { type: "tool_call", toolCallId: "2", toolName: "read", input: { file_path: "x" } },
      ctx,
    );
    expect(other).toEqual([undefined]);

    await installed.harness.emit(
      "tool_call",
      { type: "tool_call", toolCallId: "3", toolName: "task", input: { agent: "worker", model: "m" } },
      ctx,
    );
    expect(installed.statuses.at(-1)?.state.detail).toBe("rewrites=2");
  });

  test("does not return input when a task call needs no cleanup", async () => {
    const installed = install({});
    const result = await installed.harness.emit(
      "tool_call",
      { type: "tool_call", toolCallId: "1", toolName: "task", input: { agent: "worker" } },
      installed.harness.context(),
    );
    expect(result).toEqual([undefined]);
    expect(installed.statuses).toEqual([]);
  });

  test("finds the seance field in a batch task schema", () => {
    const installed = install({ tool: taskTool("builtin", "batch") });
    expect(installed.state).toEqual({ status: "enabled", detail: "rewrites=0" });
    expect(installed.harness.handlers.get("tool_call")).toHaveLength(1);
  });

  test("stays unavailable when the task schema only has the ordinary model selector", () => {
    const installed = install({ tool: taskTool("builtin", "model-only") });
    expect(installed.state).toEqual({ status: "unavailable", reason: "task-tool-without-seance-fields" });
    expect(installed.harness.handlers.get("tool_call")).toBeUndefined();
    expect(installed.reports.some((entry) => entry.startsWith("taskArgs:task-tool-without-seance-fields:"))).toBe(true);
  });

  test("accepts a raw JSON schema that exposes the seance field", () => {
    const installed = install({ tool: taskTool("builtin", "json-schema") });
    expect(installed.state).toEqual({ status: "enabled", detail: "rewrites=0" });
  });

  test("stays unavailable for a raw JSON schema with only the model selector", () => {
    const installed = install({ tool: taskTool("builtin", "json-schema-model-only") });
    expect(installed.state).toEqual({ status: "unavailable", reason: "task-tool-without-seance-fields" });
    expect(installed.harness.handlers.get("tool_call")).toBeUndefined();
  });

  test("stays unavailable without a task tool", () => {
    const installed = install({ tool: null });
    expect(installed.state).toEqual({ status: "unavailable", reason: "task-tool-absent" });
    expect(installed.harness.handlers.get("tool_call")).toBeUndefined();
    expect(installed.reports.some((entry) => entry.startsWith("taskArgs:task-tool-absent:"))).toBe(true);
  });

  test("stays incompatible when another extension replaced the task tool", () => {
    const installed = install({ tool: taskTool("extension") });
    expect(installed.state).toEqual({ status: "incompatible", reason: "task-tool-shadowed" });
    expect(installed.harness.handlers.get("tool_call")).toBeUndefined();
    expect(installed.reports.some((entry) => entry.startsWith("taskArgs:task-tool-shadowed:"))).toBe(true);
  });

  test("stays disabled when its switch is off", () => {
    const installed = install({ settings: settings({ taskArgsEnabled: false }) });
    expect(installed.state).toEqual({ status: "disabled", reason: "taskArgs-disabled" });
    expect(installed.harness.handlers.get("tool_call")).toBeUndefined();
  });
});
