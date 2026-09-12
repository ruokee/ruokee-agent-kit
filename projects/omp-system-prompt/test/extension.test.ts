import { expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { activate, type PluginSettingsReader } from "../src/extension.ts";
import { renderMain, renderProject } from "./render.ts";

const TEMPLATE_PATH = new URL("../src/prompt-template.md", import.meta.url);
const ENTRY_URL = new URL("../src/extension.ts", import.meta.url).href;
const TEST_CWD = "/tmp/omp-system-prompt-test";

type Command = { name: string; description?: string; source: string };
type Notify = (message: string, level: string) => void;
interface TestContext {
  cwd: string;
  hasUI: boolean;
  ui: { notify: Notify };
  sessionManager: { getSessionId(): string };
}
type Handler = (
  event: { systemPrompt: string[] },
  ctx: TestContext,
) => Promise<{ systemPrompt?: string[] } | undefined>;

const noSettings: PluginSettingsReader = async () => ({});

function host(importMetaUrl = ENTRY_URL, getPluginSettings: PluginSettingsReader = noSettings) {
  return { importMetaUrl, getPluginSettings };
}

function context(hasUI = false, notify: Notify = () => {}, sessionId = "session-1"): TestContext {
  return { cwd: TEST_CWD, hasUI, ui: { notify }, sessionManager: { getSessionId: () => sessionId } };
}

test("loads the template from encoded installation paths", () => {
  const root = mkdtempSync(join(tmpdir(), "omp system prompt "));
  try {
    const component = join(root, "escaped %23 path");
    mkdirSync(component);
    copyFileSync(TEMPLATE_PATH, join(component, "prompt-template.md"));

    const warnings: string[] = [];
    const handlers: unknown[] = [];
    const pi = {
      logger: { warn: (message: string) => warnings.push(message) },
      on: (_event: string, handler: unknown) => handlers.push(handler),
    };

    activate(pi as never, host(pathToFileURL(join(component, "extension.ts")).href));

    expect(warnings).toEqual([]);
    expect(handlers).toHaveLength(1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("uses visible Skill entries while ignoring hidden command candidates", async () => {
  const skills = [
    { name: "alpha", description: "First skill." },
    { name: "beta", description: "Second skill." },
  ];
  const blocks = ["before", renderMain({ skills }), renderProject(), "after"];
  const warnings: string[] = [];
  const handlers: Handler[] = [];
  let reads = 0;
  const pi = {
    logger: { warn: (message: string) => warnings.push(message) },
    on: (_event: string, handler: Handler) => handlers.push(handler),
    getCommands: () => {
      reads += 1;
      return [
        { name: "skill:before", description: "Hidden before.", source: "skill" },
        { name: "skill:alpha", description: "First skill.", source: "skill" },
        { name: "skill:between", description: "Hidden between.", source: "skill" },
        { name: "skill:beta", description: "Second skill.", source: "skill" },
        { name: "skill:after", description: "Hidden after.", source: "skill" },
        { name: "help", description: "Show help.", source: "builtin" },
      ] satisfies Command[];
    },
  };

  activate(pi as never, host());
  const handler = handlers[0];
  expect(handler).toBeDefined();

  const first = await handler!({ systemPrompt: blocks }, context());
  expect(reads).toBe(1);
  expect(first?.systemPrompt?.[1]).toContain("- alpha: First skill.");
  expect(first?.systemPrompt?.[1]).toContain("- beta: Second skill.");
  expect(first?.systemPrompt?.[1]).not.toContain("Hidden before.");
  expect(first?.systemPrompt?.[1]).not.toContain("Hidden between.");
  expect(first?.systemPrompt?.[1]).not.toContain("Hidden after.");
  expect(warnings).toEqual([]);
});

test("reports Skill formatting skip without claiming replacement failure", async () => {
  const skills = [{ name: "alpha", description: "First\nContinuation" }];
  const blocks = ["before", renderMain({ skills }), renderProject(), "after"];
  const warnings: string[] = [];
  const handlers: Handler[] = [];
  const pi = {
    logger: { warn: (message: string) => warnings.push(message) },
    on: (_event: string, handler: Handler) => handlers.push(handler),
    getCommands: () => [] as Command[],
  };

  activate(pi as never, host());
  const handler = handlers[0];
  expect(handler).toBeDefined();

  const result = await handler!({ systemPrompt: blocks }, context());
  expect(result?.systemPrompt?.[1]).toContain("You are an assistant in Oh My Pi");
  expect(result?.systemPrompt?.[2]).toContain("# Project snapshot");
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain("Skill catalog formatting skipped");
  expect(warnings[0]).toContain("skill-metadata-unavailable");
  expect(warnings[0]).not.toContain("replacement NOT applied");
  expect(warnings[0]).not.toContain("First");
});

test("reports a Skill formatting skip through the interactive sink", async () => {
  const skills = [{ name: "alpha", description: "First skill." }];
  const blocks = ["before", renderMain({ skills }), renderProject(), "after"];
  const warnings: string[] = [];
  const notifications: Array<{ message: string; level: string }> = [];
  const handlers: Handler[] = [];
  const pi = {
    logger: { warn: (message: string) => warnings.push(message) },
    on: (_event: string, handler: Handler) => handlers.push(handler),
    getCommands: () => [] as Command[],
  };

  activate(pi as never, host());
  const handler = handlers[0];
  expect(handler).toBeDefined();

  const result = await handler!(
    { systemPrompt: blocks },
    context(true, (message, level) => notifications.push({ message, level })),
  );

  expect(result?.systemPrompt?.[1]).toContain("You are an assistant in Oh My Pi");
  expect(result?.systemPrompt?.[2]).toContain("# Project snapshot");
  expect(warnings).toEqual([]);
  expect(notifications).toHaveLength(1);
  expect(notifications[0]?.level).toBe("warning");
  expect(notifications[0]?.message).toContain("Skill catalog formatting skipped");
  expect(notifications[0]?.message).toContain("skill-metadata-unavailable");
  expect(notifications[0]?.message).not.toContain("replacement NOT applied");
  expect(notifications[0]?.message).not.toContain("First skill.");
});

test("deduplicates local and whole-prompt diagnostics independently", async () => {
  const blocks = [
    "before",
    renderMain({ skills: [{ name: "alpha", description: "First" }] }),
    renderProject(),
    "after",
  ];
  const warnings: string[] = [];
  const handlers: Handler[] = [];
  const pi = {
    logger: { warn: (message: string) => warnings.push(message) },
    on: (_event: string, handler: Handler) => handlers.push(handler),
    getCommands: () => [] as Command[],
  };

  activate(pi as never, host());
  const handler = handlers[0];
  expect(handler).toBeDefined();
  const ctx = context();

  expect((await handler!({ systemPrompt: blocks }, ctx))?.systemPrompt).toBeDefined();
  expect(await handler!({ systemPrompt: ["custom", renderProject()] }, ctx)).toBeUndefined();
  expect((await handler!({ systemPrompt: blocks }, ctx))?.systemPrompt).toBeDefined();
  expect(await handler!({ systemPrompt: ["custom", renderProject()] }, ctx)).toBeUndefined();

  expect(warnings).toHaveLength(2);
  expect(warnings.filter((message) => message.includes("Skill catalog formatting skipped"))).toHaveLength(1);
  expect(warnings.filter((message) => message.includes("replacement NOT applied"))).toHaveLength(1);
});

test("reads renderDelivery every turn and switches the owned shape", async () => {
  const values: Record<string, unknown>[] = [{ renderDelivery: false }, { renderDelivery: true }];
  const calls: Array<{ packageName: string; cwd: string }> = [];
  const readSettings: PluginSettingsReader = async (packageName, cwd) => {
    calls.push({ packageName, cwd });
    return values.shift() ?? {};
  };
  const handlers: Handler[] = [];
  const pi = {
    logger: { warn: () => {} },
    on: (_event: string, handler: Handler) => handlers.push(handler),
    getCommands: () => [] as Command[],
  };
  const initial = ["before", renderMain({ tools: ["read"] }), renderProject(), "after"];

  activate(pi as never, host(ENTRY_URL, readSettings));
  const handler = handlers[0];
  expect(handler).toBeDefined();

  const disabled = await handler!({ systemPrompt: initial }, context());
  expect(disabled?.systemPrompt?.[1]).not.toContain("# Delivery\n");
  const enabled = await handler!({ systemPrompt: disabled?.systemPrompt ?? initial }, context());
  expect(enabled?.systemPrompt?.[1]).toContain("# Delivery\n");
  expect(calls).toEqual([
    { packageName: "@ruokee/omp-system-prompt", cwd: TEST_CWD },
    { packageName: "@ruokee/omp-system-prompt", cwd: TEST_CWD },
  ]);
});

test("uses the default true behavior when renderDelivery is unset", async () => {
  const handlers: Handler[] = [];
  const pi = {
    logger: { warn: () => {} },
    on: (_event: string, handler: Handler) => handlers.push(handler),
    getCommands: () => [] as Command[],
  };

  activate(pi as never, host());
  const result = await handlers[0]!({ systemPrompt: ["before", renderMain(), renderProject(), "after"] }, context());
  expect(result?.systemPrompt?.[1]).toContain("# Delivery\n");
});

test("fails open on settings errors and invalid values with session deduplication", async () => {
  let calls = 0;
  const readSettings: PluginSettingsReader = async () => {
    calls += 1;
    if (calls <= 2) throw new Error("settings unavailable");
    return { renderDelivery: "false" };
  };
  const warnings: string[] = [];
  const handlers: Handler[] = [];
  const pi = {
    logger: { warn: (message: string) => warnings.push(message) },
    on: (_event: string, handler: Handler) => handlers.push(handler),
    getCommands: () => [] as Command[],
  };
  const input = { systemPrompt: ["before", renderMain(), renderProject(), "after"] };

  activate(pi as never, host(ENTRY_URL, readSettings));
  const handler = handlers[0];
  expect(handler).toBeDefined();
  for (let index = 0; index < 4; index++) {
    const result = await handler!(input, context());
    expect(result?.systemPrompt?.[1]).toContain("# Delivery\n");
  }

  expect(warnings.filter((message) => message.includes("renderDelivery setting ignored"))).toHaveLength(2);
  expect(warnings.filter((message) => message.includes("read-failed"))).toHaveLength(1);
  expect(warnings.filter((message) => message.includes("invalid-type"))).toHaveLength(1);
  expect(warnings.every((message) => !message.includes("replacement NOT applied"))).toBe(true);
});

test("reports unexpected turn-processing errors and leaves the host prompt active", async () => {
  const blocks = ["before", renderMain(), renderProject(), "after"];
  const warnings: string[] = [];
  const notifications: Array<{ message: string; level: string }> = [];
  const handlers: Handler[] = [];
  let commandReads = 0;
  let settingsReads = 0;
  const readSettings: PluginSettingsReader = async () => {
    settingsReads += 1;
    return {};
  };
  const pi = {
    logger: { warn: (message: string) => warnings.push(message) },
    on: (_event: string, handler: Handler) => handlers.push(handler),
    getCommands: () => {
      commandReads += 1;
      throw new Error("unexpected command failure");
    },
  };

  activate(pi as never, host(ENTRY_URL, readSettings), "template");
  const handler = handlers[0];
  expect(handler).toBeDefined();

  const ctx = context(true, (message, level) => notifications.push({ message, level }));
  expect(await handler!({ systemPrompt: blocks }, ctx)).toBeUndefined();
  expect(commandReads).toBe(1);
  expect(settingsReads).toBe(1);
  expect(warnings).toEqual([]);
  expect(notifications).toHaveLength(1);
  expect(notifications[0]?.level).toBe("warning");
  expect(notifications[0]?.message).toContain("unexpected-error");
  expect(notifications[0]?.message).toContain("replacement NOT applied");
  expect(notifications[0]?.message).not.toContain("unexpected command failure");

  // One report per session even across turns.
  expect(await handler!({ systemPrompt: blocks }, ctx)).toBeUndefined();
  expect(commandReads).toBe(2);
  expect(settingsReads).toBe(2);
  expect(notifications).toHaveLength(1);
});

test("reports a missing template through the log channel and stays inactive", async () => {
  const blocks = ["before", renderMain(), renderProject(), "after"];
  const warnings: string[] = [];
  const notifications: Array<{ message: string; level: string }> = [];
  const handlers: Handler[] = [];
  let commandReads = 0;
  let settingsReads = 0;
  const readSettings: PluginSettingsReader = async () => {
    settingsReads += 1;
    throw new Error("settings must not be read for a fatal activation");
  };
  const pi = {
    logger: { warn: (message: string) => warnings.push(message) },
    on: (_event: string, handler: Handler) => handlers.push(handler),
    getCommands: () => {
      commandReads += 1;
      return [] as Command[];
    },
  };

  activate(pi as never, host(ENTRY_URL, readSettings), null);
  const handler = handlers[0];
  expect(handler).toBeDefined();

  const result = await handler!(
    { systemPrompt: blocks },
    context(false, (message, level) => notifications.push({ message, level })),
  );

  expect(result).toBeUndefined();
  expect(commandReads).toBe(0);
  expect(settingsReads).toBe(0);
  expect(notifications).toEqual([]);
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain("template-unavailable");
  expect(warnings[0]).toContain("replacement NOT applied");
});

test("rejects a template whose Delivery chapter is not final", async () => {
  const root = mkdtempSync(join(tmpdir(), "omp-system-prompt-nonfinal-delivery-"));
  try {
    const component = join(root, "component");
    mkdirSync(component);
    const template = readFileSync(TEMPLATE_PATH, "utf8").replace("\n# Delivery\n", "\n# Delivery\n\n# Later chapter\n");
    writeFileSync(join(component, "prompt-template.md"), template);

    const warnings: string[] = [];
    const handlers: Handler[] = [];
    const pi = {
      logger: { warn: (message: string) => warnings.push(message) },
      on: (_event: string, handler: Handler) => handlers.push(handler),
      getCommands: () => [] as Command[],
    };

    activate(pi as never, host(pathToFileURL(join(component, "extension.ts")).href));
    const result = await handlers[0]!({ systemPrompt: ["before", renderMain(), renderProject(), "after"] }, context());
    expect(result).toBeUndefined();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("template-unavailable");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("reports a corrupt template file through the interactive sink", async () => {
  const root = mkdtempSync(join(tmpdir(), "omp-system-prompt-corrupt-"));
  try {
    const component = join(root, "component");
    mkdirSync(component);
    // Duplicated slot marker: loadTemplate rejects it before the transformer runs.
    writeFileSync(join(component, "prompt-template.md"), "Owned text\n\n%%tools%%\n\n%%tools%%\n");

    const warnings: string[] = [];
    const notifications: Array<{ message: string; level: string }> = [];
    const handlers: Handler[] = [];
    const pi = {
      logger: { warn: (message: string) => warnings.push(message) },
      on: (_event: string, handler: Handler) => handlers.push(handler),
      getCommands: () => [] as Command[],
    };

    activate(pi as never, host(pathToFileURL(join(component, "extension.ts")).href));
    const handler = handlers[0];
    expect(handler).toBeDefined();

    const result = await handler!(
      { systemPrompt: ["before", renderMain(), renderProject(), "after"] },
      context(true, (message, level) => notifications.push({ message, level })),
    );

    expect(result).toBeUndefined();
    expect(warnings).toEqual([]);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.level).toBe("warning");
    expect(notifications[0]?.message).toContain("template-unavailable");
    expect(notifications[0]?.message).toContain("replacement NOT applied");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("deduplicates each diagnostic within its session across new, resume, and fork identities", async () => {
  for (const scenario of ["template", "settings", "structure", "skills", "unexpected"]) {
    const notifications: string[] = [];
    const warnings: string[] = [];
    const handlers: Handler[] = [];
    const pi = {
      logger: { warn: (message: string) => warnings.push(message) },
      on: (_event: string, handler: Handler) => handlers.push(handler),
      getCommands: () => {
        if (scenario === "unexpected") throw new Error("private failure");
        return [];
      },
    };
    const readSettings: PluginSettingsReader =
      scenario === "settings"
        ? async () => {
            throw new Error("private settings");
          }
        : noSettings;
    activate(
      pi as never,
      host(ENTRY_URL, readSettings),
      scenario === "template" ? null : readFileSync(TEMPLATE_PATH, "utf8"),
    );
    const event = {
      systemPrompt:
        scenario === "structure"
          ? ["custom", renderProject()]
          : [
              renderMain({ skills: scenario === "skills" ? [{ name: "alpha", description: "Skill" }] : [] }),
              renderProject(),
            ],
    };
    const handler = handlers[0]!;
    const first = context(true, (message) => notifications.push(message), "first");
    await handler(event, first);
    await handler(event, first);
    expect(notifications).toHaveLength(1);
    await handler(event, context(false, undefined, "second"));
    await handler(event, context(false, undefined, "second"));
    expect(warnings).toHaveLength(1);
    await handler(event, first);
    expect(notifications).toHaveLength(1);
    await handler(event, context(false, undefined, "fork"));
    expect(warnings).toHaveLength(2);
    expect(warnings.join(" ")).not.toContain("private");
  }
});

test("overlapping turns keep their own diagnostic channels", async () => {
  const notifications: string[] = [];
  const warnings: string[] = [];
  const handlers: Handler[] = [];
  let release!: () => void;
  let signalStarted!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    signalStarted = resolve;
  });
  let reads = 0;
  const readSettings: PluginSettingsReader = async () => {
    if (++reads === 1) {
      signalStarted();
      await blocked;
    }
    return { renderDelivery: "invalid" };
  };
  const pi = {
    logger: { warn: (message: string) => warnings.push(message) },
    on: (_event: string, handler: Handler) => handlers.push(handler),
    getCommands: () => [],
  };
  activate(pi as never, host(ENTRY_URL, readSettings));
  const event = { systemPrompt: [renderMain({ skills: [] }), renderProject()] };
  const handler = handlers[0]!;
  const first = handler(
    event,
    context(true, (message) => notifications.push(message), "first"),
  );
  try {
    await started;
    await handler(event, context(false, undefined, "second"));
  } finally {
    release();
    await first;
  }
  expect(notifications).toHaveLength(1);
  expect(warnings).toHaveLength(1);
  expect(notifications[0]).toContain("renderDelivery setting ignored");
});
