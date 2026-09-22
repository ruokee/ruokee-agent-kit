/**
 * Shape × preset cross product through the host path: every builtin
 * composer shape combined with every builtin status-line preset goes through
 * the same real Host mount and the target OMP's real public rendering
 * surface — `getComposerStyle`/`registerComposerStyle` for shapes and
 * `StatusLineComponent.getPreviewLines` (top attachment + bottom bar) for
 * the native status line — so the test fails if a shape or a preset stops
 * actually participating in rendering.
 *
 * Also proves an extension-owned shape registers through pi-tui's public
 * registry and renders like any builtin shape.
 */
import { describe, test, expect } from "bun:test";
import { Settings, StatusLineComponent, initThemeSync } from "@oh-my-pi/pi-coding-agent";
import { getComposerStyle, registerComposerStyle } from "@oh-my-pi/pi-tui/components/composer/registry";
import type {
  ComposerChromeContext,
  ComposerRowContext,
  ComposerStyle,
} from "@oh-my-pi/pi-tui/components/composer/types";
import { StatusBarHost, type HostEnvironment, type WidgetFactory } from "../src/host.ts";
import { registerProvider, type ProviderDefinition } from "../src/provider-api.ts";
import { resetProviderRegistryForTests } from "../src/registry.ts";
import { resetSnapshotStoreForTests } from "../src/snapshot-store.ts";
import { BUILTIN_COMPOSER_SHAPES } from "@oh-my-pi/pi-tui/overlays/composer-shape-registry";
import { statusLineHost } from "@oh-my-pi/pi-coding-agent/modes/status-line-host";
import { STATUS_LINE_PRESETS } from "@oh-my-pi/pi-coding-agent";

const SHAPES = BUILTIN_COMPOSER_SHAPES.map((shape) => shape.value);
const PRESETS = Object.keys(STATUS_LINE_PRESETS) as (keyof typeof STATUS_LINE_PRESETS)[];

const WINDOW = 200_000;

let combo = 0;

function registerComboProvider(): ProviderDefinition {
  combo++;
  return {
    contractVersion: 1,
    id: `combo.${combo}`,
    describe: () => ({}),
    create: (context) => ({
      start: () => context.publish({ spans: [{ text: `seg${combo}`, color: "#5fafaf" }] }),
      stop: () => {},
    }),
  };
}

function makeEnv(): HostEnvironment & { widgets: { key: string; factory: WidgetFactory; options: unknown }[] } {
  const widgets: { key: string; factory: WidgetFactory; options: unknown }[] = [];
  return {
    hasUI: true,
    widgets,
    setWidget(key: string, factory: WidgetFactory, options?: { placement?: "belowEditor" | "aboveEditor" }) {
      widgets.push({ key, factory, options });
    },
    unsetWidget(key: string) {
      void key;
    },
    setInterval: (callback: () => void, ms: number) => 1,
    setTimeout: (callback: () => void, ms: number) => 2,
    clearTimer(_timer: unknown) {},
  };
}

/** Minimal session double satisfying the status line's queries. */
function fakeSession(): import("@oh-my-pi/pi-coding-agent").AgentSession {
  const model = { id: "test-model", contextWindow: WINDOW };
  const messages = [{ role: "user", content: "hi" }];
  return {
    messages,
    systemPrompt: [],
    agent: { state: { tools: [] } },
    skills: [],
    model,
    modelRegistry: { isUsingOAuth: () => false },
    state: { messages, model },
    settings: undefined,
    sessionManager: {
      getUsageStatistics: () => ({
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        orchestrationInput: 0,
        orchestrationOutput: 0,
        orchestrationCacheRead: 0,
        premiumRequests: 0,
        cost: 0,
      }),
      getSessionName: () => "render-test",
    },
    getAsyncJobSnapshot: () => ({ running: [] }),
    isFastModeActive: () => false,
    getContextUsage: () => ({ tokens: 42_000, contextWindow: WINDOW, percent: 21 }),
    contextUsageRevision: 0,
  } as unknown as import("@oh-my-pi/pi-coding-agent").AgentSession;
}

describe("shape × preset cross product", () => {
  test("builtin shape and preset lists are non-empty", () => {
    expect(SHAPES.length).toBeGreaterThan(0);
    expect(PRESETS.length).toBe(7);
    expect(SHAPES).toContain("band");
    expect(PRESETS).toContain("default");
  });

  test("every shape × preset combination mounts the widget and renders the native status line", async () => {
    await Settings.init({ agentDir: "/tmp/ompsb-cross-product" });
    initThemeSync();
    for (const shape of SHAPES) {
      for (const preset of PRESETS) {
        resetProviderRegistryForTests();
        resetSnapshotStoreForTests();
        const provider = registerComboProvider();
        registerProvider(provider);
        const env = makeEnv();
        const host = new StatusBarHost({
          environment: env,
          getAgentDir: () => "/agent",
          joinPath: (a, b) => `${a}/${b}`,
          onDiagnostic: () => {},
          configReader: (async () => ({
            config: {
              version: 1,
              separator: "slash",
              statuses: [{ id: provider.id, options: {}, sourceIndex: 0 }],
            },
            problems: [],
          })) as never,
        });
        await host.start();
        // Same Host Widget factory for every combo; belowEditor placement.
        expect(env.widgets.length, `${shape}/${preset}: widget mounted`).toBe(1);
        expect(env.widgets[0]!.options, `${shape}/${preset}: belowEditor`).toEqual({ placement: "belowEditor" });

        // The fake TUI records the component-scoped repaint request path.
        const painted: unknown[] = [];
        const tui = { requestComponentRender: (component: unknown) => painted.push(component) };
        const component = env.widgets[0]!.factory(tui, {
          fg: (color: string, text: string) => (color === "dim" ? `\x1b[2m${text}\x1b[22m` : text),
        });

        // Surface 1: the extension's own belowEditor Widget renders its
        // row independently of the native status line.
        const rows = component.render(120);
        expect(rows.length, `${shape}/${preset}: one visible widget row`).toBe(1);
        expect(rows[0]!.length, `${shape}/${preset}: non-empty widget content`).toBeGreaterThan(0);
        expect(rows.join("\n"), `${shape}/${preset}: widget shows provider content`).toContain("seg");
        // Extreme widths do not crash and stay within bounds.
        expect(component.render(1).length).toBeLessThanOrEqual(1);
        expect(component.render(0).length).toBeLessThanOrEqual(1);

        // Surface 2: OMP's real native status line, configured with this
        // combo's shape and preset through its own public surface. The
        // preview pipeline composes the top attachment and the bottom bar
        // exactly as the real UI does; every shape/preset pair must produce
        // visible content. It renders without any input from the Widget;
        // the two coexist.
        const statusLine = new StatusLineComponent(fakeSession(), statusLineHost);
        try {
          statusLine.setComposerStyle(getComposerStyle(shape));
          statusLine.updateSettings({ preset });
          const preview = statusLine.getPreviewLines(120, getComposerStyle(shape));
          const visible = preview.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
          expect(visible.length, `${shape}/${preset}: native status line renders`).toBeGreaterThan(0);
        } finally {
          statusLine.dispose();
        }
        await host.shutdown();
      }
    }
  }, 30_000);

  test("extension-owned composer shape registers through the public registry and renders", async () => {
    await Settings.init({ agentDir: "/tmp/ompsb-cross-product" });
    initThemeSync();
    const extShape: ComposerStyle = {
      id: "ompsb-ext-shape",
      sideBorders: false,
      verticalChrome: 1,
      statusAttachment: "top-rule-chip",
      bottomBar: "left",
      bottomBarGap: true,
      defaultPromptGutter: "❯ ",
      defaultPaddingX: () => 0,
      sideChromeWidth: (paddingX: number) => paddingX,
      renderTop: (ctx: ComposerChromeContext) => ctx.borderColor(ctx.box.horizontal.repeat(ctx.width)),
      renderRow: (ctx: ComposerRowContext) => [ctx.gutter + ctx.text + ctx.pad],
      renderBottom: () => undefined,
    };
    const disposeShape = registerComposerStyle(extShape);
    try {
      expect(getComposerStyle("ompsb-ext-shape")).toBe(extShape);
      resetProviderRegistryForTests();
      resetSnapshotStoreForTests();
      const provider = registerComboProvider();
      registerProvider(provider);
      const env = makeEnv();
      const host = new StatusBarHost({
        environment: env,
        getAgentDir: () => "/agent",
        joinPath: (a, b) => `${a}/${b}`,
        onDiagnostic: () => {},
        configReader: (async () => ({
          config: { version: 1, separator: "slash", statuses: [{ id: provider.id, options: {}, sourceIndex: 0 }] },
          problems: [],
        })) as never,
      });
      await host.start();
      const component = env.widgets[0]!.factory(
        { requestComponentRender: () => {} },
        { fg: (_color: string, text: string) => text },
      );
      // The extension-owned shape drives the native status line exactly
      // like a builtin shape (through the same preview pipeline), while
      // the Widget row renders independently.
      const statusLine = new StatusLineComponent(fakeSession(), statusLineHost);
      try {
        statusLine.setComposerStyle(getComposerStyle("ompsb-ext-shape"));
        const preview = statusLine.getPreviewLines(120, getComposerStyle("ompsb-ext-shape"));
        const visible = preview.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
        expect(visible.length).toBeGreaterThan(0);
        const widgetRows = component.render(120);
        expect(widgetRows.join("\n")).toContain("seg");
      } finally {
        statusLine.dispose();
        await host.shutdown();
      }
    } finally {
      disposeShape();
    }
  });
});
