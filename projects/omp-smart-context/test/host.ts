import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";

type Handler = (event: unknown, ctx: ExtensionContext) => unknown;

export interface Harness {
  pi: ExtensionAPI;
  warnings: string[];
  notifications: Array<{ message: string; level: string }>;
  handlers: Map<string, Handler[]>;
  context(overrides?: Partial<ExtensionContext>): ExtensionContext;
  emit(type: string, event: unknown, ctx: ExtensionContext): Promise<unknown[]>;
}

/** Recording event boundary for migrated usage and prompt-rule behavior cases. */
export function createHarness(): Harness {
  const warnings: string[] = [];
  const notifications: Array<{ message: string; level: string }> = [];
  const handlers = new Map<string, Handler[]>();
  const pi = {
    logger: {
      warn: (message: string) => {
        warnings.push(message);
      },
    },
    on: (type: string, handler: Handler) => {
      const list = handlers.get(type);
      if (list) list.push(handler);
      else handlers.set(type, [handler]);
    },
  } as unknown as ExtensionAPI;
  return {
    pi,
    warnings,
    notifications,
    handlers,
    context: (overrides: Partial<ExtensionContext> = {}) =>
      ({
        cwd: "/tmp/context-project",
        hasUI: true,
        ui: {
          notify: (message: string, level = "info") => {
            notifications.push({ message, level });
          },
        },
        ...overrides,
      }) as unknown as ExtensionContext,
    emit: async (type: string, event: unknown, ctx: ExtensionContext) => {
      const results: unknown[] = [];
      for (const handler of handlers.get(type) ?? []) results.push(await handler(event, ctx));
      return results;
    },
  };
}
