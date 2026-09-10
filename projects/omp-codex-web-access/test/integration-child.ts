import { AgentRegistry, createAgentSession, Settings } from "@oh-my-pi/pi-coding-agent/sdk";
import { getPluginSettings } from "@oh-my-pi/pi-coding-agent/extensibility/plugins";
import { ExtensionRuntime, loadExtensionFromFactory } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/loader";
import { ExtensionRunner } from "@oh-my-pi/pi-coding-agent/extensibility/extensions/runner";
import { initializeExtensions } from "@oh-my-pi/pi-coding-agent/modes/runtime-init";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { AuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-storage";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { EventBus } from "@oh-my-pi/pi-coding-agent/utils/event-bus";
import extensionFactory, { PACKAGE_NAME } from "../src/extension.ts";

const COMPONENT_TOOL_NAMES: Record<string, true> = { codex_web_search: true, codex_web_fetch: true };
const cwd = process.argv[2];
const mode = process.argv[3] ?? "runner";
if (!cwd) throw new Error("integration child requires a project cwd");

type ToolState = {
  active: string[];
  enabled: string[];
  mounted: string[];
  registry: string[];
  lookup: Record<string, boolean>;
};

type LiveScenario = {
  xdev: { before: ToolState; after: ToolState; repeated: ToolState };
  secondActivation: { before: ToolState; after: ToolState; repeated: ToolState };
  fallback: { before: ToolState; after: ToolState; repeated: ToolState };
};

const result: {
  getterError: boolean;
  settings?: Record<string, unknown>;
  tools: Array<{ name: string; loadMode?: string }>;
  live?: LiveScenario;
} = {
  getterError: false,
  tools: [],
};

function componentNames(names: Iterable<string>): string[] {
  return [...names].filter((name) => COMPONENT_TOOL_NAMES[name] === true).sort();
}

function captureToolState(session: Awaited<ReturnType<typeof createAgentSession>>["session"]): ToolState {
  const runner = session.extensionRunner;
  return {
    active: componentNames(session.getActiveToolNames()),
    enabled: componentNames(session.getEnabledToolNames()),
    mounted: componentNames(session.getMountedXdevToolNames()),
    registry: componentNames(runner?.getAllRegisteredTools().map((tool) => tool.definition.name) ?? []),
    lookup: {
      codex_web_search: session.getToolByName("codex_web_search") !== undefined,
      codex_web_fetch: session.getToolByName("codex_web_fetch") !== undefined,
    },
  };
}

async function runLiveSession(
  authStorage: Awaited<ReturnType<typeof AuthStorage.create>>,
  modelRegistry: ModelRegistry,
  xdev: boolean,
  agentId: string,
): Promise<{ before: ToolState; after: ToolState; repeated: ToolState }> {
  const settings = Settings.isolated({
    "tools.xdev": xdev,
    "memory.backend": "off",
    "autolearn.enabled": false,
    "startup.quiet": true,
  });
  const { session } = await createAgentSession({
    cwd,
    agentDir: process.env.PI_CODING_AGENT_DIR ?? `${cwd}/.omp-agent`,
    authStorage,
    modelRegistry,
    extensions: [extensionFactory],
    disableExtensionDiscovery: true,
    sessionManager: SessionManager.inMemory(cwd),
    settings,
    skills: [],
    rules: [],
    contextFiles: [],
    slashCommands: [],
    enableMCP: false,
    enableLsp: false,
    skipPythonPreflight: true,
    hasUI: false,
    agentRegistry: new AgentRegistry(),
    agentId,
  });

  try {
    const runner = session.extensionRunner;
    if (!runner) throw new Error("createAgentSession did not expose an extension runner");
    const before = captureToolState(session);
    await initializeExtensions(session, {
      reportSendError: (_action, error) => {
        throw error;
      },
      reportRuntimeError: (error) => {
        throw new Error(`extension runtime error: ${String(error.error)}`);
      },
    });
    const after = captureToolState(session);
    await runner.emit({ type: "session_start" });
    const repeated = captureToolState(session);
    return { before, after, repeated };
  } finally {
    await session.dispose();
  }
}

async function runLiveScenario(): Promise<LiveScenario> {
  const authStorage = await AuthStorage.create(":memory:");
  try {
    const modelRegistry = new ModelRegistry(authStorage);
    return {
      xdev: await runLiveSession(authStorage, modelRegistry, true, "live-xdev"),
      secondActivation: await runLiveSession(authStorage, modelRegistry, true, "live-second"),
      fallback: await runLiveSession(authStorage, modelRegistry, false, "live-fallback"),
    };
  } finally {
    authStorage.close();
  }
}

try {
  try {
    result.settings = await getPluginSettings(PACKAGE_NAME, cwd);
  } catch {
    result.getterError = true;
  }

  if (mode === "live") {
    result.live = await runLiveScenario();
  } else {
    const authStorage = await AuthStorage.create(":memory:");
    try {
      const runtime = new ExtensionRuntime();
      const extension = await loadExtensionFromFactory(
        extensionFactory,
        cwd,
        new EventBus(),
        runtime,
        "codex-web-access-integration",
      );
      const sessionManager = SessionManager.inMemory(cwd);
      const modelRegistry = new ModelRegistry(authStorage);
      const runner = new ExtensionRunner([extension], runtime, cwd, sessionManager, modelRegistry);
      try {
        await runner.emit({ type: "session_start" });
        result.tools = runner
          .getAllRegisteredTools()
          .map((tool) => ({ name: tool.definition.name, loadMode: tool.definition.loadMode }));
      } finally {
        runner.disposeFileFallbacks();
        runner.clearManagedTimers();
      }
    } finally {
      authStorage.close();
    }
  }
} catch (error) {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

console.log(JSON.stringify(result));
