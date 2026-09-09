/**
 * Test-only fixtures that render the installed 18.1.11 host templates.
 *
 * Both test files share these helpers so extension-level checks exercise the
 * same recognized default main block and PROJECT footer as transform checks.
 */

import { renderToolInventory } from "@oh-my-pi/pi-ai/dialect";
import { prompt } from "@oh-my-pi/pi-utils";
import { readFileSync } from "node:fs";

const MAIN_TEMPLATE = readFileSync(
  new URL("../node_modules/@oh-my-pi/pi-coding-agent/src/prompts/system/system-prompt.md", import.meta.url),
  "utf8",
);
const PROJECT_TEMPLATE = readFileSync(
  new URL("../node_modules/@oh-my-pi/pi-coding-agent/src/prompts/system/project-prompt.md", import.meta.url),
  "utf8",
);

type ToolDefinition = {
  wireName?: string;
  label?: string;
  description?: string;
  parameters?: unknown;
};

export type SkillSpec = { name: string; description: string };

export type MainOptions = {
  tools?: readonly string[];
  toolDefinitions?: Record<string, ToolDefinition>;
  inlineCatalog?: boolean;
  skills?: SkillSpec[];
  alwaysApplyRules?: { content: string }[];
  rules?: { name: string; globs: string[]; description: string }[];
  computer?: boolean;
  devices?: { name: string; docs: string }[];
  think?: boolean;
  intent?: boolean;
  secrets?: boolean;
  autoQa?: boolean;
  ast?: boolean;
  task?: boolean;
  memory?: boolean;
  security?: boolean;
  obsidian?: boolean;
  maxConcurrency?: number;
  taskIrc?: boolean;
  renderMermaid?: boolean;
  reactions?: boolean;
  personality?: string;
  browser?: boolean;
};

export function renderMain(options: MainOptions = {}): string {
  const names = options.tools ?? ["read", "bash"];
  const definitions = options.toolDefinitions ?? {};
  const devices = options.devices ?? [];
  const tools = [...new Set([...names, ...devices.map((device) => device.name)])];
  const toolInfo = names.map((name) => {
    const definition = definitions[name];
    return { name: definition?.wireName ?? name, label: definition?.label ?? null };
  });
  const toolInventory = options.inlineCatalog
    ? renderToolInventory(
        names.map((name) => {
          const definition = definitions[name];
          return {
            name: definition?.wireName ?? name,
            description: definition?.description ?? "",
            parameters: definition?.parameters ?? { type: "object", properties: {} },
          } as never;
        }),
      )
    : "";
  const toolRefs = Object.fromEntries(
    [...names, ...devices.map((device) => device.name)].map((name) => [name, definitions[name]?.wireName ?? name]),
  );
  const data = {
    tools,
    toolInfo,
    toolInventory,
    toolListMode: !options.inlineCatalog,
    toolRefs,
    skills: options.skills ?? [],
    alwaysApplyRules: options.alwaysApplyRules ?? [],
    rules: options.rules ?? [],
    environment: [
      { label: "OS", value: "linux" },
      { label: "Arch", value: "x64" },
    ],
    model: "luna",
    hasMemoryRoot: options.memory ?? false,
    securityEnabled: options.security ?? false,
    hasObsidian: options.obsidian ?? false,
    computerEnabled: options.computer ?? false,
    xdevTools: devices,
    xdevDocs: devices.map((device) => device.docs).join("\n"),
    thinkToolName: "think",
    intentTracing: options.intent ?? false,
    intentField: "i",
    secretsEnabled: options.secrets ?? false,
    writeTransportOnly: false,
    autoQaEnabled: options.autoQa ?? false,
    astEnabled: (options.ast ?? false) || names.some((name) => name === "ast_grep" || name === "ast_edit"),
    delegationBias: "gated",
    eagerTasks: false,
    eagerTasksAlways: false,
    taskBatch: true,
    scoutAvailable: true,
    MAX_CONCURRENCY: options.maxConcurrency ?? 0,
    taskIrcEnabled: options.taskIrc ?? false,
    renderMermaid: options.renderMermaid ?? false,
    reactions: options.reactions ?? false,
    personality: options.personality ?? "",
    browserEnabled: options.browser ?? false,
    includeWorkspaceTree: false,
    workspaceTree: { rendered: "", truncated: false },
    additionalWorkspaceRoots: [],
    contextFiles: [],
    agentsMdSearch: { files: [] },
  };
  return prompt.format(prompt.render(MAIN_TEMPLATE, data), { renderPhase: "post-render" });
}

export type ProjectOptions = {
  contextFiles?: { path: string; content: string }[];
  agentsMdFiles?: string[];
  workspaceTree?: string;
  additionalWorkspaceRoots?: string[];
  append?: string;
};

export function renderProject(options: ProjectOptions = {}): string {
  const contextFiles = options.contextFiles ?? [
    { path: "AGENTS.md", content: "Use plain English.\n\n# Conventions\nSecond section." },
    { path: "src/.agents.md", content: "- keep it terse" },
  ];
  const data = {
    environment: [
      { label: "OS", value: "linux" },
      { label: "Arch", value: "x64" },
    ],
    model: "luna",
    contextFiles,
    agentsMdSearch: { files: options.agentsMdFiles ?? ["some/AGENTS.md", "docs/.agents.md"] },
    includeWorkspaceTree: options.workspaceTree !== undefined,
    workspaceTree: { rendered: options.workspaceTree ?? "", truncated: false },
    additionalWorkspaceRoots: options.additionalWorkspaceRoots ?? [],
    appendPrompt: options.append ?? "",
    tools: ["read", "bash"],
    toolRefs: { read: "read", bash: "bash", glob: "glob" },
  };
  return prompt.format(prompt.render(PROJECT_TEMPLATE, data), { renderPhase: "post-render" });
}
