import { afterEach, expect, test } from "bun:test";
import type { ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activate } from "../src/extension.ts";
import {
  collectRuleBodies,
  installModelPromptsModule,
  type ModelPromptsHost,
  type RuleFileSystem,
} from "../src/model-prompts.ts";
import { parseQolSettings } from "../src/settings.ts";
import { createHarness, moduleContext, resetNativeReplay } from "./host.ts";
import { treeFileSystem, type RuleTree } from "./rule-tree.ts";

afterEach(resetNativeReplay);
const MODEL = { provider: "example", id: "family/model" };
const ROOTS = { user: "user", project: "project" };
const document = (body: string, id = MODEL.id) => `---\nmatch:\n  - model: ${id}\n---\n${body}`;

function setup(raw: Record<string, unknown> = { modelPromptsEnabled: true }, host: ModelPromptsHost = {}) {
  const harness = createHarness();
  const parsed = parseQolSettings(raw);
  if (parsed.kind !== "loaded") throw new Error("invalid test settings");
  const context = harness.context({
    model: MODEL as ExtensionContext["model"],
    models: { current: () => undefined } as ExtensionContext["models"],
    sessionManager: { getSessionId: () => "first" } as ExtensionContext["sessionManager"],
  });
  const state = installModelPromptsModule(
    moduleContext({
      pi: harness.pi,
      ctx: context,
      settings: parsed.settings,
      off: !parsed.settings.enabled
        ? "master-disabled"
        : parsed.invalidModules.includes("modelPrompts")
          ? "settings-invalid"
          : undefined,
    }),
    host,
  );
  const turn = async (ctx = context, blocks = ["host", "dynamic context"]) => {
    const results = await harness.emit("before_agent_start", { systemPrompt: blocks }, ctx);
    const result = results[0] as { systemPrompt: string[] } | undefined;
    return result?.systemPrompt ?? blocks;
  };
  return { harness, context, state, turn };
}

test("default, module-off, master-off and invalid switches never access rule sources", async () => {
  for (const raw of [
    {},
    { modelPromptsEnabled: false },
    { enabled: false, modelPromptsEnabled: true },
    { modelPromptsEnabled: "private invalid value" },
  ]) {
    const reads: string[] = [];
    const fs: RuleFileSystem = {
      readDirectory: async (path) => {
        reads.push(path);
        throw new Error("unused rule directory");
      },
      readFile: async (path) => {
        reads.push(path);
        throw new Error("unused rule file");
      },
      isMissing: () => false,
    };
    const h = setup(raw, {
      ruleRoots: () => {
        reads.push("roots");
        return ROOTS;
      },
      ruleFileSystem: fs,
    });
    const input = ["host", "dynamic context"];
    expect(await h.turn(h.context, input)).toBe(input);
    expect(reads).toEqual([]);
    expect(h.harness.notifications).toEqual([]);
    expect(h.harness.warnings).toEqual([]);
  }
});

test("reads current cwd/model each turn and refreshes edits, deletes, additions and repairs", async () => {
  const tree: RuleTree = { "user/a.md": document("old\n"), "project/bad.md": "private invalid" };
  const roots: string[] = [];
  const h = setup(undefined, {
    ruleRoots: (cwd) => {
      roots.push(cwd);
      return ROOTS;
    },
    ruleFileSystem: {
      readDirectory: (path) => treeFileSystem(tree).readDirectory(path),
      readFile: (path) => treeFileSystem(tree).readFile(path),
      isMissing: (error) => treeFileSystem(tree).isMissing(error),
    },
  });
  const input = ["host", "dynamic context"];
  expect(await h.turn(h.context, input)).toEqual([...input, "old\n"]);
  tree["user/a.md"] = document("edited\n");
  tree["project/bad.md"] = document("repaired\n");
  expect(await h.turn()).toEqual([...input, "edited\n", "repaired\n"]);
  delete tree["user/a.md"];
  tree["project/new.md"] = document("added\n");
  expect(await h.turn()).toEqual([...input, "repaired\n", "added\n"]);
  const other = { ...h.context, cwd: "/other", model: { ...MODEL, id: "other" } as ExtensionContext["model"] };
  expect(await h.turn(other, input)).toBe(input);
  expect(input).toEqual(["host", "dynamic context"]);
  expect(roots).toEqual([h.context.cwd, h.context.cwd, h.context.cwd, "/other"]);
});

test("no model causes no reads; current model fallback appends byte-exact bodies without mutation", async () => {
  let reads = 0;
  const body = "\n# Heading\r\n  {{literal}}\r\n<!-- retained -->\r\n";
  const fs = treeFileSystem({ "user/a.md": document(body) });
  const h = setup(undefined, {
    ruleRoots: () => {
      reads++;
      return ROOTS;
    },
    ruleFileSystem: fs,
  });
  const input = Object.freeze(["host", "dynamic context"]) as unknown as string[];
  const noModel = { ...h.context, model: undefined };
  expect(await h.turn(noModel, input)).toBe(input);
  expect(reads).toBe(0);
  const fallback = { ...noModel, models: { current: () => MODEL } as ExtensionContext["models"] };
  expect(await h.turn(fallback, input)).toEqual([...input, body]);
  expect(await h.turn(fallback, input)).toEqual([...input, body]);
});

test("diagnostics are private, session-local, reason-local and use the current turn sink", async () => {
  const tree = { "user/bad.md": "secret body and private regexp" };
  const gate = Promise.withResolvers<void>();
  const fs = treeFileSystem(tree);
  let first = true;
  const h = setup(undefined, {
    ruleRoots: () => ROOTS,
    ruleFileSystem: {
      ...fs,
      readDirectory: async (path) => {
        if (first) {
          first = false;
          await gate.promise;
        }
        return fs.readDirectory(path);
      },
    },
  });
  const second = {
    ...h.context,
    hasUI: false,
    sessionManager: { getSessionId: () => "second" } as ExtensionContext["sessionManager"],
  };
  const pending = h.turn(h.context);
  await h.turn(second);
  gate.resolve();
  await pending;
  await h.turn(h.context);
  await h.turn(second);
  expect(h.harness.notifications).toHaveLength(1);
  expect(h.harness.warnings).toHaveLength(1);
  tree["user/bad.md"] = "---\nmatch: []\n---\nsecret";
  await h.turn(h.context);
  expect(h.harness.notifications).toHaveLength(2);
  for (const text of [...h.harness.warnings, ...h.harness.notifications.map((entry) => entry.message)]) {
    expect(text).toContain("user/bad.md");
    expect(text).not.toContain("secret");
    expect(text).not.toContain(h.context.cwd);
  }
});

test("unexpected model/root failures and broken diagnostic sinks preserve incoming blocks", async () => {
  const h = setup(undefined, {
    ruleRoots: () => {
      throw new Error("private path");
    },
  });
  const input = ["earlier template", "Delivery", "footer"];
  const brokenSink = {
    ...h.context,
    ui: {
      ...h.context.ui,
      notify: () => {
        throw new Error("UI error");
      },
    },
  };
  expect(await h.turn(brokenSink, input)).toBe(input);
  const modelFailure = {
    ...h.context,
    model: undefined,
    models: {
      ...h.context.models,
      current: () => {
        throw new Error("private model");
      },
    },
  };
  expect(await h.turn(modelFailure, input)).toBe(input);
  expect(h.harness.notifications).toEqual([]);
});

test("real filesystem discovery excludes symlinks, hidden and nested files", async () => {
  const root = await mkdtemp(join(tmpdir(), "qol-rules-"));
  try {
    const user = join(root, "user");
    const project = join(root, "project");
    await mkdir(join(user, "nested"), { recursive: true });
    await mkdir(project);
    for (const name of ["kept.md", ".hidden.md", "upper.MD", "nested/rule.md"])
      await writeFile(join(user, name), document(name));
    await symlink(join(user, "kept.md"), join(user, "link.md"));
    expect((await collectRuleBodies({ user, project }, MODEL)).bodies).toEqual(["kept.md"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("invalid module config preserves siblings; activation snapshot changes only on restart", async () => {
  let raw: Record<string, unknown> = { modelPromptsEnabled: "private", recoveryEnabled: true, replayEnabled: false };
  const harness = createHarness();
  const runtime = activate(harness.pi, async () => raw);
  await harness.emit("session_start", {}, harness.context());
  expect(runtime.state.modules.modelPrompts).toEqual({ status: "invalid", reason: "settings-invalid" });
  expect(runtime.state.modules.recovery.status).toBe("enabled");
  raw = { modelPromptsEnabled: true, replayEnabled: false };
  await harness.emit("session_start", {}, harness.context());
  expect(runtime.state.modules.modelPrompts.status).toBe("invalid");
  const fresh = createHarness();
  const restarted = activate(fresh.pi, async () => raw);
  await fresh.emit("session_start", {}, fresh.context());
  expect(restarted.state.modules.modelPrompts.status).toBe("enabled");
  expect(harness.notifications.map((entry) => entry.message).join()).not.toContain("private");
});
