/**
 * Test host: the smallest replacement for the OMP extension host.
 *
 * It records registrations, replays lifecycle events, and hands out a context
 * with the members omp-qol reads. The replacement covers the host boundary the
 * extension talks to; OMP behavior itself is not simulated here.
 */

import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionContext,
  ToolDefinition,
  ToolInfo,
} from "@oh-my-pi/pi-coding-agent";
import type { ModuleContext, ModuleOffReason, ModuleState } from "../src/extension.ts";
import type { ModuleId, QolSettings } from "../src/settings.ts";

/** Runtime identity a test activation uses unless it exercises conflicts. */
export const TEST_RUNTIME_ID = "@ruokee/omp-qol#test-runtime";

/** `Map.prototype.set` as the process had it before any test ran. */
const NATIVE_MAP_SET = Map.prototype.set;

/** Component-owned slot the replay module keeps its registry in. */
const REPLAY_REGISTRY_KEY = Symbol.for("ruokee.omp-qol.native-replay.registry");

/**
 * Restore the process state the replay module owns.
 *
 * An activation installs the module's wrapper on `Map.prototype.set` and keeps
 * it for the rest of the process, as the host does. A test file that activates
 * the extension calls this between cases, so each case starts with the prototype
 * and the registry slot a fresh process has; without it, the next activation to
 * read unusable settings would stop the wrapper the previous case installed.
 */
export function resetNativeReplay(): void {
  Map.prototype.set = NATIVE_MAP_SET;
  (globalThis as unknown as Record<symbol, unknown>)[REPLAY_REGISTRY_KEY] = undefined;
}

/** Fields a test sets when it drives one module installer directly. */
export interface ModuleContextOptions {
  pi: ExtensionAPI;
  ctx: ExtensionContext;
  settings: QolSettings;
  runtimeId?: string;
  off?: ModuleOffReason;
  report?: (key: string, message: string) => void;
  setStatus?: (id: ModuleId, status: ModuleState) => void;
}

/** Build a module context for one installer, with the off state and identity filled in. */
export function moduleContext(options: ModuleContextOptions): ModuleContext {
  return {
    pi: options.pi,
    ctx: options.ctx,
    settings: options.settings,
    runtimeId: options.runtimeId ?? TEST_RUNTIME_ID,
    off: options.off,
    report: options.report ?? (() => undefined),
    setStatus: options.setStatus,
  };
}

/** One registered extension tool, as the extension defined it. */
export type RegisteredTool = ToolDefinition<never, unknown> & {
  /** OMP 18.2.4 forwards this undeclared property through the registered-tool adapter. */
  interruptible?: (params: Record<string, unknown>) => boolean;
};

/** A registered slash command. */
export interface RegisteredCommandLike {
  description?: string;
  handler: (args: string, ctx: ExtensionContext) => Promise<void>;
}

/** Everything a test needs to drive one activation. */
export interface Harness {
  pi: ExtensionAPI;
  tools: RegisteredTool[];
  commands: Map<string, RegisteredCommandLike>;
  /** Warnings written through `pi.logger.warn`. */
  warnings: string[];
  /** Text shown through `ctx.ui.notify`. */
  notifications: Array<{ message: string; level: string }>;
  /** Tool metadata `getAllTools()` reports. */
  toolInfos: ToolInfo[];
  /** Registered handlers per event type, in registration order. */
  handlers: Map<string, Array<(event: unknown, ctx: ExtensionContext) => unknown>>;
  /** Run one event through every handler registered for it. */
  emit(eventType: string, event: unknown, ctx: ExtensionContext): Promise<unknown[]>;
  /** Build a context with the members omp-qol reads. */
  context(overrides?: Partial<ExtensionContext>): ExtensionContext;
}

/** Build a host replacement. `toolInfos` defaults to a native-looking hub entry. */
export function createHarness(toolInfos?: ToolInfo[]): Harness {
  const tools: RegisteredTool[] = [];
  const commands = new Map<string, RegisteredCommandLike>();
  const warnings: string[] = [];
  const notifications: Array<{ message: string; level: string }> = [];
  const handlers = new Map<string, Array<(event: unknown, ctx: ExtensionContext) => unknown>>();

  const pi = {
    logger: {
      warn: (message: string) => {
        warnings.push(message);
      },
      info: () => undefined,
      debug: () => undefined,
    },
    on: (eventType: string, handler: (event: unknown, ctx: ExtensionContext) => unknown) => {
      const list = handlers.get(eventType);
      if (list === undefined) handlers.set(eventType, [handler]);
      else list.push(handler);
    },
    registerTool: (tool: RegisteredTool) => {
      tools.push(tool);
    },
    registerCommand: (name: string, command: RegisteredCommandLike) => {
      commands.set(name, command);
    },
    getAllTools: () => toolInfos ?? [],
  };

  const context = (overrides: Partial<ExtensionContext> = {}): ExtensionContext => {
    const base = {
      cwd: "/tmp/omp-qol-project",
      hasUI: true,
      ui: {
        notify: (message: string, level = "info") => {
          notifications.push({ message, level });
        },
      },
    };
    return { ...base, ...overrides } as unknown as ExtensionContext;
  };

  return {
    pi: pi as unknown as ExtensionAPI,
    tools,
    commands,
    warnings,
    notifications,
    toolInfos: toolInfos ?? [],
    handlers,
    emit: async (eventType, event, ctx) => {
      const list = handlers.get(eventType) ?? [];
      const results: unknown[] = [];
      for (const handler of list) results.push(await handler(event, ctx));
      return results;
    },
    context,
  };
}

/** A native hub entry in the shape `getAllTools()` reports. */
export function nativeHubToolInfo(description: string, parameters: unknown): ToolInfo {
  return {
    name: "hub",
    description,
    parameters,
    sourceInfo: { path: "<builtin:hub>", source: "builtin", scope: "temporary", origin: "top-level" },
  } as unknown as ToolInfo;
}

/** One tool result with the fields the wait module inspects. */
export function toolResult(overrides: {
  text?: string;
  details?: Record<string, unknown>;
  isError?: boolean;
  useless?: boolean;
}): AgentToolResult<unknown> {
  return {
    content: [{ type: "text", text: overrides.text ?? "" }],
    details: overrides.details ?? {},
    ...(overrides.isError === true ? { isError: true } : {}),
    ...(overrides.useless === true ? { useless: true } : {}),
  } as AgentToolResult<unknown>;
}
