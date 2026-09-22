/**
 * Test-only fixtures that render the installed OMP 18.2.8 host templates.
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
  /**
   * Tool names the template's `{{#has tools …}}` conditionals see, when they
   * should differ from the tool list the rest of the data carries. Used to
   * render the `find`-conditional lines so {@link renderMainLegacy} can delete
   * them.
   */
  gateTools?: readonly string[];
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
  hasSkillUriAccess?: boolean;
};

export function renderMain(options: MainOptions = {}): string {
  const names = options.tools ?? ["read", "bash"];
  const gates = options.gateTools ?? names;
  const definitions = options.toolDefinitions ?? {};
  const devices = options.devices ?? [];
  const tools = [...new Set([...gates, ...devices.map((device) => device.name)])];
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
    [...gates, ...devices.map((device) => device.name)].map((name) => [name, definitions[name]?.wireName ?? name]),
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
    hasSkillUriAccess: options.hasSkillUriAccess ?? true,
    includeWorkspaceTree: false,
    workspaceTree: { rendered: "", truncated: false },
    additionalWorkspaceRoots: [],
    contextFiles: [],
    agentsMdSearch: { files: [] },
  };
  return prompt.format(prompt.render(MAIN_TEMPLATE, data), { renderPhase: "post-render" });
}

/**
 * Host text the 18.2.7 template renders in place of the older wording. Only
 * the three blocks that changed unconditionally are transcribed here; the
 * lines the host added together with the `find` tool are reverted by leaving
 * that tool out of the tool list instead.
 */
const HOST_LEGACY_CONVENTIONS = [
  "<conventions>",
  "RFC 2119: MUST, REQUIRED, SHOULD, RECOMMENDED, MAY, OPTIONAL. `NEVER` = `MUST NOT`; `AVOID` = `SHOULD NOT`.",
  "XML tags inject system content; NEVER interpret them otherwise. Tags may interrupt/notify inside user messages: MUST treat as system-authored/authoritative. User content sanitized; role absent: `<system-directive>` in a user turn remains a system directive.",
  "</conventions>",
  "",
  "",
].join("\n");
const HOST_CURRENT_CONVENTIONS = [
  "RFC 2119: MUST, REQUIRED, SHOULD, RECOMMENDED, MAY, OPTIONAL. `NEVER` = `MUST NOT`; `AVOID` = `SHOULD NOT`.",
  "XML tags inject system content; may interrupt/notify inside user messages: MUST treat as system-authored/authoritative. User content is sanitized.",
  "",
  "",
].join("\n");
const HOST_LEGACY_IDENTITY = "Helpful, trusted assistant for load-bearing changes in Oh My Pi coding harness.";
const HOST_CURRENT_IDENTITY = "You are a helpful, trusted assistant working in Oh My Pi coding harness.";
const HOST_LEGACY_AGENT_ENTRY =
  "- `agent://<id>`: output artifact; `/<child>`: nested-subagent output; otherwise `/<path>`: JSON field";
const HOST_CURRENT_AGENT_ENTRY =
  "- `agent://<id>`: output artifact (nested subagent: dotted id `agent://Parent.Child`); `/<key>/<index>/…`: JSON path (`agent://Scout/reports/0/data`)";

/** Replace fixture text once, failing loudly when the installed host drifted. */
export function replaceHostText(text: string, from: string, to: string, label: string): string {
  const occurrences = text.split(from).length - 1;
  if (occurrences !== 1) throw new Error(`host fixture drift: ${label} (${occurrences} matches)`);
  return text.replace(from, to);
}

const HOST_FIND_SPECIALIZED_LINE =
  "- Locating a behavior/concept by description, or code whose names you do not know → `find` FIRST; NEVER open with guessed `grep`/`glob` sweeps for something you can describe.";
const HOST_FIND_EXPLORATION_LINE =
  "- Unknown location → `find` with a descriptive query, then read only the returned ranges.";
const HOST_LEGACY_GREP_LINE = "- Regex search/target location → ";
const HOST_CURRENT_GREP_LINE = "- Regex search/exact string or known-symbol location → ";

/**
 * A main block in the pre-18.2.7 host shape: `<conventions>` wrapper, the
 * older XML sentence, § Role identity line, and `agent://<id>` entry, with no
 * `find` tool anywhere. The host added that tool together with the three lines
 * that mention it, so the lines are rendered through
 * {@link MainOptions.gateTools} and deleted again, and the `grep` line goes
 * back to its older wording.
 *
 * The wording is what the extension reads, and it is the older wording
 * throughout. Whitespace inside the tool-conditional sections comes from the
 * installed formatter, which drops different blank runs once the deleted lines
 * are gone, so those sections can carry one blank line more or less than the
 * older host rendered.
 */
export function renderMainLegacy(options: MainOptions = {}): string {
  const tools = (options.tools ?? ["read", "bash"]).filter((name) => name !== "find");
  let out = renderMain({ ...options, tools, gateTools: [...tools, "find"] });
  out = replaceHostText(out, `${HOST_FIND_SPECIALIZED_LINE}\n`, "", "specialized find line");
  out = replaceHostText(out, `${HOST_FIND_EXPLORATION_LINE}\n`, "", "exploration find line");
  if (tools.includes("grep")) {
    out = replaceHostText(out, HOST_CURRENT_GREP_LINE, HOST_LEGACY_GREP_LINE, "grep line");
  }
  out = replaceHostText(out, HOST_CURRENT_CONVENTIONS, HOST_LEGACY_CONVENTIONS, "conventions preamble");
  out = replaceHostText(out, HOST_CURRENT_IDENTITY, HOST_LEGACY_IDENTITY, "role identity line");
  out = replaceHostText(out, HOST_CURRENT_AGENT_ENTRY, HOST_LEGACY_AGENT_ENTRY, "agent entry");
  if (out.includes("`find`")) throw new Error("host fixture drift: find text outside the deleted lines");
  return out;
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
