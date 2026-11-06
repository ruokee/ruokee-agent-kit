/**
 * Task argument cleanup module.
 *
 * Only explicit non-seance items in a schema exposing `sourceSession` are
 * cleaned. Hosts with `task.perCallModel` own ordinary `model` validation;
 * older hosts treat both fields as seance-only. Capability presence, rather
 * than its configured value, selects the cleanup so native rejection stays
 * visible when ordinary model selection is disabled.
 */

import { lookup } from "@oh-my-pi/pi-coding-agent/config/registry";
import type { ModuleContext, ModuleState } from "./extension.ts";

export const TASK_TOOL_NAME = "task";

const SEANCE_FIELD = "sourceSession";

/** Whether a JSON schema object or any nested schema declares this property. */
function hasSchemaProperty(value: unknown, name: string): boolean {
  if (Array.isArray(value)) return value.some((entry) => hasSchemaProperty(entry, name));
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const properties = record.properties;
  if (properties !== null && typeof properties === "object" && Object.hasOwn(properties, name)) return true;
  return Object.values(record).some((entry) => hasSchemaProperty(entry, name));
}

/** One item and whether the cleanup produced a different object. */
interface CleanItem {
  value: unknown;
  changed: boolean;
}

/**
 * Remove the seance-only fields from one task item when its own `agent` is a
 * non-seance string. Missing, empty, non-string, or seance agents, non-object
 * items, and items without a field to remove keep their identity.
 */
function cleanItem(item: unknown, perCallModel: boolean): CleanItem {
  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    return { value: item, changed: false };
  }
  const record = item as Record<string, unknown>;
  const agent = typeof record.agent === "string" ? record.agent.trim() : "";
  if (agent.length === 0 || agent === "seance") return { value: item, changed: false };

  const hasTarget = Object.hasOwn(record, SEANCE_FIELD) || (!perCallModel && Object.hasOwn(record, "model"));
  if (!hasTarget) return { value: item, changed: false };

  const next = { ...record };
  delete next.sourceSession;
  if (!perCallModel) delete next.model;
  return { value: next, changed: true };
}

/**
 * Rewrite one task call input.
 *
 * A `tasks` array is a batch: each item is cleaned independently and unchanged
 * items keep their identity. Any other shape is a flat call and the top-level
 * object is the item. The top-level fields are never touched in a batch. The
 * function returns `undefined` when nothing changed, and never mutates the
 * input.
 */
export function sanitizeTaskArgs(
  input: Record<string, unknown>,
  perCallModel: boolean,
): Record<string, unknown> | undefined {
  if (Array.isArray(input.tasks)) {
    let changed = false;
    const tasks = input.tasks.map((item) => {
      const cleaned = cleanItem(item, perCallModel);
      if (!cleaned.changed) return item;
      changed = true;
      return cleaned.value;
    });
    return changed ? { ...input, tasks } : undefined;
  }

  const cleaned = cleanItem(input, perCallModel);
  return cleaned.changed ? (cleaned.value as Record<string, unknown>) : undefined;
}

/** Register the cleanup handler for the built-in `task` tool. */
export function installTaskArgsModule(context: ModuleContext): ModuleState {
  const { pi, settings, report, setStatus } = context;
  if (!settings.taskArgs.enabled) return { status: "disabled", reason: "taskArgs-disabled" };

  const task = pi.getAllTools().find((tool) => tool.name === TASK_TOOL_NAME);
  if (task === undefined) {
    report("taskArgs:task-tool-absent", "taskArgs stays inactive: this session exposes no built-in `task`");
    return { status: "unavailable", reason: "task-tool-absent" };
  }
  if (task.sourceInfo.source !== "builtin") {
    report(
      "taskArgs:task-tool-shadowed",
      "taskArgs stays inactive: another extension already replaced the `task` tool",
    );
    return { status: "incompatible", reason: "task-tool-shadowed" };
  }
  const parameters = task.parameters as { toJsonSchema?: () => Record<string, unknown> };
  let seanceFieldPresent = false;
  try {
    seanceFieldPresent = hasSchemaProperty(
      typeof parameters.toJsonSchema === "function" ? parameters.toJsonSchema() : parameters,
      SEANCE_FIELD,
    );
  } catch {
    seanceFieldPresent = false;
  }
  if (!seanceFieldPresent) {
    report(
      "taskArgs:task-tool-without-seance-fields",
      "taskArgs stays inactive: the built-in `task` schema exposes no `sourceSession` field",
    );
    return { status: "unavailable", reason: "task-tool-without-seance-fields" };
  }

  const perCallModel = lookup("task.perCallModel") !== undefined;
  let rewrites = 0;
  pi.on("tool_call", (event) => {
    if (event.toolName !== TASK_TOOL_NAME) return;
    const next = sanitizeTaskArgs(event.input, perCallModel);
    if (next === undefined) return;
    rewrites += 1;
    setStatus?.("taskArgs", { status: "enabled", detail: `rewrites=${rewrites}` });
    return { input: next };
  });

  return { status: "enabled", detail: "rewrites=0" };
}
