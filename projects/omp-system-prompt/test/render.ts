/**
 * Test-only renderers for the installed OMP 18.5.0 host templates.
 *
 * `renderMain` renders the host's bundled main block by default; passing
 * {@link HOST_TEMPLATE} renders what the host builds when a user selects the
 * component's template. `renderProject` renders the host `<project-context>`
 * footer for the main agent or a subagent.
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

/**
 * The component's committed host template, read the way the host reads it.
 * Pass it as the `template` argument of {@link renderMain} to reproduce what
 * the host sends to the extension.
 */
export const HOST_TEMPLATE = readFileSync(new URL("../host-template.hbs", import.meta.url), "utf8");

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
  writeTransportOnly?: boolean;
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
  hasSkillUriAccess?: boolean;
  internalUrls?: string[];
};

/**
 * Template data for a main block. Every field the installed template and the
 * component template can read is present, so either renders the same turn's
 * data.
 */
function hostData(options: MainOptions): Record<string, unknown> {
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
  return {
    tools,
    toolInfo,
    toolInventory,
    toolListMode: !options.inlineCatalog,
    toolRefs,
    skills: options.skills ?? [],
    alwaysApplyRules: options.alwaysApplyRules ?? [],
    rules: options.rules ?? [],
    internalUrls: options.internalUrls ?? ["skill://<name>", "artifact://<id>", "local://<name>.md"],
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
    writeTransportOnly: options.writeTransportOnly ?? false,
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
    hasSkillUriAccess: options.hasSkillUriAccess ?? true,
    includeWorkspaceTree: false,
    workspaceTree: { rendered: "", truncated: false },
    additionalWorkspaceRoots: [],
    contextFiles: [],
    agentsMdSearch: { files: [] },
  };
}

/**
 * Render a main block. `template` defaults to the installed host template;
 * the host-template route passes {@link HOST_TEMPLATE}.
 */
export function renderMain(options: MainOptions = {}, template: string = MAIN_TEMPLATE): string {
  return prompt.format(prompt.render(template, hostData(options)), { renderPhase: "post-render" });
}

/** Replace fixture text once, failing loudly when the installed host drifted. */
export function replaceHostText(text: string, from: string, to: string, label: string): string {
  const occurrences = text.split(from).length - 1;
  if (occurrences !== 1) throw new Error(`host fixture drift: ${label} (${occurrences} matches)`);
  return text.replace(from, to);
}

export type ProjectOptions = {
  contextFiles?: { path: string; content: string }[];
  agentsMdFiles?: string[];
  workspaceTree?: string;
  additionalWorkspaceRoots?: string[];
  /** Text the host interpolates from its own active-repo template. */
  activeRepo?: string;
  append?: string;
  /** Render the subagent critical tail instead of the main-agent one. */
  subagent?: boolean;
};

/** Render the installed host's `<project-context>` footer. */
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
    activeRepoContext: options.activeRepo ?? "",
    appendPrompt: options.append ?? "",
    subagent: options.subagent ?? false,
    tools: ["read", "bash"],
    toolRefs: { read: "read", bash: "bash", glob: "glob" },
  };
  return prompt.format(prompt.render(PROJECT_TEMPLATE, data), { renderPhase: "post-render" });
}
