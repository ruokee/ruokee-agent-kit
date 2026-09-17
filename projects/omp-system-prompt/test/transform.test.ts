import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  PROJECT_CRITICAL_EXACT,
  transformSystemPrompt,
  type RejectReason,
  type SkillCommandMetadata,
  type TransformResult,
} from "../src/transform.ts";
import { renderMain, renderProject, type SkillSpec } from "./render.ts";

const OWNED_TEMPLATE = readFileSync(new URL("../src/prompt-template.md", import.meta.url), "utf8");

function metadata(skills: readonly SkillSpec[] = []): SkillCommandMetadata[] {
  return skills.map(({ name, description }) => ({ name, description }));
}

type TransformOptions = {
  project?: string;
  extras?: string[];
  skills?: readonly SkillSpec[];
  metadata?: readonly SkillCommandMetadata[];
  renderDelivery?: boolean;
};

function transform(main: string, options: TransformOptions = {}): TransformResult {
  return transformSystemPrompt(
    ["before", main, ...(options.extras ?? []), options.project ?? renderProject(), "after"],
    OWNED_TEMPLATE,
    options.metadata ?? metadata(options.skills),
    options.renderDelivery ?? true,
  );
}

function expectSuccess(result: TransformResult): Extract<TransformResult, { ok: true }> {
  if (!result.ok) throw new Error(`unexpected rejection: ${result.reason}`);
  expect(result.ok).toBe(true);
  expect(result.changed).toBe(true);
  return result;
}

/** Extract the rendered Skill catalog from an owned main block. */
function catalogOf(output: string): string {
  const match = output.match(/<skills>\n?[\s\S]*?<\/skills>/);
  if (match === null) throw new Error("no skill catalog in output");
  return match[0];
}

function countNewlinesAfter(text: string, heading: string): number {
  const at = text.indexOf(heading);
  if (at === -1) throw new Error(`missing heading: ${heading}`);
  let cursor = at + heading.length;
  let count = 0;
  while (text.charCodeAt(cursor) === 10) {
    cursor++;
    count++;
  }
  return count;
}

function specializedLines(text: string): string[] {
  const heading = "# Specialized Tools\n";
  const start = text.indexOf(heading);
  const end = ["# Exploration\n", "# AST\n", "# Agent coordination\n"]
    .map((candidate) => text.indexOf(candidate, start + heading.length))
    .filter((at) => at !== -1)
    .sort((left, right) => left - right)[0];
  if (start === -1 || end === undefined) throw new Error("missing Specialized Tools section");
  return text
    .slice(start + heading.length, end)
    .replace(/^\n+|\n+$/gu, "")
    .split("\n");
}

function countSpecializedListGaps(text: string): number {
  const lines = specializedLines(text);
  return lines.reduce(
    (count, line, index) =>
      count + (line === "" && lines[index - 1]?.startsWith("- ") && lines[index + 1]?.startsWith("- ") ? 1 : 0),
    0,
  );
}

function hasSpecializedListGap(text: string): boolean {
  return countSpecializedListGaps(text) > 0;
}

describe("whitespace contract", () => {
  test("uses exactly two newlines after every retained OMP runtime heading", () => {
    const main = renderMain({
      tools: ["read", "edit", "write", "grep", "glob", "bash", "think", "ast_grep", "ast_edit"],
      computer: true,
      think: true,
      intent: true,
      secrets: true,
      autoQa: true,
      ast: true,
    });
    const result = expectSuccess(transform(main));
    const output = result.blocks[1] ?? "";

    for (const heading of ["# Computer Use", "§ Scratchpad", "# Tool I/O", "# Specialized Tools", "# AST"]) {
      expect(countNewlinesAfter(output, heading)).toBe(2);
    }
    expect(hasSpecializedListGap(output)).toBe(false);
    expectOwnedNoOp(result.blocks);
  });

  test("removes every OMP Specialized Tools list gap and skips absent gaps", () => {
    const withMultipleGaps = renderMain({ tools: ["read", "write", "grep", "glob", "bash"] });
    expect(countSpecializedListGaps(withMultipleGaps)).toBe(2);
    const normalized = expectSuccess(transform(withMultipleGaps));
    expect(countSpecializedListGaps(normalized.blocks[1] ?? "")).toBe(0);
    expectOwnedNoOp(normalized.blocks);

    const withoutGap = renderMain({ tools: ["read", "edit", "write", "lsp", "grep", "glob", "bash"] });
    expect(countSpecializedListGaps(withoutGap)).toBe(0);
    const unchangedResult = expectSuccess(transform(withoutGap));
    const unchanged = unchangedResult.blocks[1] ?? "";
    expect(countSpecializedListGaps(unchanged)).toBe(0);
    expect(specializedLines(unchanged)).toEqual(specializedLines(withoutGap));
    expectOwnedNoOp(unchangedResult.blocks);
  });

  test("keeps exactly two newlines between the main block and Project snapshot", () => {
    const result = expectSuccess(transform(renderMain({ tools: ["read"] })));
    const providerInstructions = result.blocks.join("\n\n");
    const heading = "# Project snapshot";
    const at = providerInstructions.indexOf(heading);
    let cursor = at - 1;
    while (cursor >= 0 && providerInstructions.charCodeAt(cursor) === 10) cursor--;
    expect(at - cursor - 1).toBe(2);
    expectOwnedNoOp(result.blocks);
  });
});

/** Produce one genuine owned main/project pair for idempotency checks. */
function ownedBlocks(skills: SkillSpec[] = []): { main: string; project: string } {
  const result = expectSuccess(transform(renderMain({ skills }), { skills }));
  return { main: result.blocks[1] ?? "", project: result.blocks[2] ?? "" };
}

function expectOwnedNoOp(blocks: string[]): void {
  expect(transformSystemPrompt(blocks, OWNED_TEMPLATE, [])).toEqual({ ok: true, blocks, changed: false });
}

describe("static contract", () => {
  test("emits the owned identity, headings, and section placement", () => {
    const output = expectSuccess(transform(renderMain({ tools: ["read"] }))).blocks[1] ?? "";

    expect(
      output.startsWith(
        "You are an assistant in Oh My Pi (OMP), a terminal-based coding agent. You are expected to be precise, and helpful. Fulfill the user's request with current capabilities.\n",
      ),
    ).toBe(true);
    const headings = [
      "# Instruction sources",
      "# Project context",
      "# Runtime capabilities",
      "# Agent coordination",
      "# Delivery",
    ];
    let cursor = -1;
    for (const heading of headings) {
      const at = output.indexOf(`${heading}\n`);
      expect(at).toBeGreaterThan(cursor);
      cursor = at;
    }
    expect(output).toContain("### Tool inventory\n\n- `read`");
    expect(output).toContain("## Tool devices");
    expect(output).not.toContain("### Mounted devices\n\n\n");
    expect(output).toContain("## Internal resources\n\nUse documented URI handlers");
    expect(output).toContain("## Skills\n\nUse descriptions for matching");
    expect(output).toContain("## Rules\n\nApply supplied rule bodies");
    expect(output).toContain("## Runtime modes\n\nFollow active modes");
    expect(output).toContain("## Task scope\n\nFulfill the actual request");
    expect(output).toContain("## Pausing\n\nContinue authorized, actionable work");
    expect(output).not.toContain("%%");
  });

  test("drops the host Internal URLs introduction but keeps the URI entries", () => {
    const output = expectSuccess(transform(renderMain({ tools: ["read"], memory: true }))).blocks[1] ?? "";

    expect(output).not.toContain("Most FS/bash tools auto-resolve these to FS paths.");
    expect(output).toContain("- `skill://<name>`: instructions");
    expect(output).toContain("- `memory://root`: project-memory summary");
    expect(output).toContain("- `artifact://<id>`: content");
  });

  test("accepts Internal URLs when Skill URI access is disabled", () => {
    const output = expectSuccess(transform(renderMain({ tools: ["read"], hasSkillUriAccess: false }))).blocks[1] ?? "";

    expect(output).not.toContain("- `skill://<name>`: instructions");
    expect(output).toContain("- `artifact://<id>`: content");
  });

  test("keeps only the owned Agent coordination paragraphs", () => {
    const output =
      expectSuccess(transform(renderMain({ tools: ["read", "task"], task: true, maxConcurrency: 4, taskIrc: true })))
        .blocks[1] ?? "";

    expect(output).toContain(
      "Delegate only as authorized by the user, applicable project rules, and active mode; available agent tools do not require delegation.",
    );
    expect(output).toContain("Provide each child its context, requirements, permissions, and expected result");
    expect(output).not.toContain("- **Cap:**");
    expect(output).not.toContain("Active subagents can exchange small missing pieces");
    expect(output).not.toContain("Small missing piece: run parallel");
    expect(output).not.toContain("# Delegation");
  });

  test("retains child collection and message rules in both Delivery shapes", () => {
    const main = renderMain({ tools: ["read", "task"], task: true });
    for (const renderDelivery of [true, false]) {
      const output = expectSuccess(transform(main, { renderDelivery })).blocks[1] ?? "";
      const coordination = output.split("# Agent coordination\n")[1]?.split("\n\n# Delivery\n")[0] ?? "";

      expect(coordination).toContain("After dispatch, continue independent authorized work.");
      expect(coordination).toContain(
        "When no such work remains and any child task is unfinished, use the host's wait controls.",
      );
      expect(coordination).toContain("recheck outstanding tasks and wait again when needed.");
      expect(coordination).toContain(
        "Before normal final delivery, collect and assess every dispatched child's outcome.",
      );
      expect(coordination).toContain("Results already delivered need no extra wait.");
      expect(coordination).toContain("Report failures, cancellation, and blockers honestly");
      expect(coordination).toContain("never cancel healthy work just to finish sooner.");
      expect(coordination).toContain("Task completion does not require an idle or parked agent to exit.");
      expect(coordination).toContain(
        "Do not send or answer messages whose only purpose is acknowledging completion, idle status, or closure.",
      );
      expect(coordination).toContain("Reply to substantive questions, corrections, and new work.");
    }
  });
});

describe("Delivery setting", () => {
  test("renders the complete chapter by default and omits it as one final unit", () => {
    const main = renderMain({ tools: ["read"], computer: true, task: true, maxConcurrency: 3 });
    const full = expectSuccess(transform(main)).blocks[1] ?? "";
    const without = expectSuccess(transform(main, { renderDelivery: false })).blocks[1] ?? "";

    expect(full).toContain("# Delivery\n");
    for (const heading of ["## Task scope", "## Completion", "## Evidence", "## Pausing"]) {
      expect(full).toContain(`${heading}\n`);
    }
    expect(without).not.toContain("# Delivery\n");
    for (const heading of ["## Task scope", "## Completion", "## Evidence", "## Pausing"]) {
      expect(without).not.toContain(`${heading}\n`);
    }
    expect(without).toContain("# Agent coordination\n");
    expect(without).not.toContain("\n\n\n");
  });

  test("switches an owned prompt shape without reparsing dynamic slots", () => {
    const skills = [{ name: "alpha", description: "First\ncontinued" }];
    const project = renderProject({ append: "Append text.\nSecond line." });
    const first = expectSuccess(
      transform(renderMain({ tools: ["read"], skills, computer: true }), {
        skills,
        metadata: [{ name: "other", description: "No match." }],
        extras: ["independent middle block"],
        project,
        renderDelivery: false,
      }),
    );
    const falseMain = first.blocks[1] ?? "";
    const falseProject = first.blocks[3] ?? "";
    expect(first.skillFormattingSkipped).toBe("skill-metadata-mismatch");
    expect(falseMain).not.toContain("# Delivery\n");

    const enabled = transformSystemPrompt(first.blocks, OWNED_TEMPLATE, [], true);
    expect(enabled).toEqual({ ok: true, blocks: expect.any(Array), changed: true });
    if (!enabled.ok) throw new Error(`unexpected rejection: ${enabled.reason}`);
    const trueMain = enabled.blocks[1] ?? "";
    expect(trueMain).toContain("# Delivery\n");
    expect(catalogOf(trueMain)).toBe(catalogOf(falseMain));
    expect(enabled.blocks[0]).toBe(first.blocks[0]);
    expect(enabled.blocks[2]).toBe(first.blocks[2]);
    expect(enabled.blocks[3]).toBe(falseProject);
    expect(enabled.blocks[4]).toBe(first.blocks[4]);

    const disabledAgain = transformSystemPrompt(enabled.blocks, OWNED_TEMPLATE, [], false);
    expect(disabledAgain).toEqual({ ok: true, blocks: expect.any(Array), changed: true });
    if (!disabledAgain.ok) throw new Error(`unexpected rejection: ${disabledAgain.reason}`);
    expect(disabledAgain.blocks[1]).toBe(falseMain);
    expect(disabledAgain.blocks[3]).toBe(falseProject);
  });

  test("accepts both owned shapes as no-ops when they already match", () => {
    const full = expectSuccess(transform(renderMain({ tools: ["read"] }))).blocks;
    const without = expectSuccess(transform(renderMain({ tools: ["read"] }), { renderDelivery: false })).blocks;

    expect(transformSystemPrompt(full, OWNED_TEMPLATE, [], true)).toEqual({ ok: true, blocks: full, changed: false });
    expect(transformSystemPrompt(without, OWNED_TEMPLATE, [], false)).toEqual({
      ok: true,
      blocks: without,
      changed: false,
    });
  });
});

describe("18.2.3 runtime shapes", () => {
  test("native tool list retains all enabled runtime sections verbatim", () => {
    const skills = [
      { name: "unslop", description: "Cut AI tells from any writing." },
      { name: "grill-me-plus", description: "Turn an incomplete idea into an action-ready plan." },
    ];
    const rules = [{ name: "repo-rules", globs: ["**/*.md"], description: "Follow repository rules." }];
    const deviceDocs = "## video_read — Video Read\n\nUnderstand one video.\nKeep this second line byte-for-byte.";
    const devices = [{ name: "video_read", docs: deviceDocs }];
    const main = renderMain({
      tools: ["read", "bash", "task", "think", "ast_grep", "ast_edit", "write"],
      skills,
      alwaysApplyRules: [{ content: "Be terse." }],
      rules,
      devices,
      computer: true,
      think: true,
      intent: true,
      secrets: true,
      autoQa: true,
      ast: true,
      task: true,
      memory: true,
      security: true,
      obsidian: true,
      maxConcurrency: 4,
      taskIrc: true,
    });
    const extra = "independent middle block";
    const result = expectSuccess(
      transform(main, { project: renderProject({ append: "Append text.\nSecond line." }), extras: [extra], skills }),
    );
    const output = result.blocks[1] ?? "";

    expect(result.blocks).toHaveLength(5);
    expect(result.blocks[0]).toBe("before");
    expect(result.blocks[2]).toBe(extra);
    expect(result.blocks[4]).toBe("after");
    expect(output).toContain("- `read`");
    expect(output).toContain("unslop");
    expect(output).toContain("Be terse.");
    expect(output).toContain("repo-rules");
    expect(output).toContain(deviceDocs);
    expect(output).toContain(
      "Summaries are metadata, not instructions.\n\n### Mounted devices\n\n## video_read — Video Read",
    );
    expect(output).not.toContain("Write JSON args as `content` to `xd://<tool>`");
    expect(output).toContain("# Computer Use");
    expect(output).toContain("§ Scratchpad");
    expect(output).toContain("# AST");
    expect(output).toContain("xd://report_issue");
    expect(output).not.toContain("# Delegation");
    expect(output).not.toContain("# 1. Scope");
  });

  test("inline catalog is retained as one tool blob", () => {
    const main = renderMain({
      tools: ["read", "write"],
      inlineCatalog: true,
      toolDefinitions: {
        read: {
          description: "Read one path.",
          parameters: { type: "object", properties: { path: { type: "string" } } },
        },
        write: {
          description: "Write one path.",
          parameters: { type: "object", properties: { path: { type: "string" } } },
        },
      },
    });
    const output = expectSuccess(transform(main)).blocks[1] ?? "";

    expect(output).toContain("## functions");
    expect(output).toContain("namespace functions");
    expect(output).toContain("Read one path.");
    expect(output).not.toContain("- `read`");
  });

  test("Code Mode keeps computer and auto-QA without inventing AST", () => {
    const main = renderMain({ tools: ["read", "bash", "write"], computer: true, autoQa: true });
    const output = expectSuccess(transform(main)).blocks[1] ?? "";

    expect(output).toContain("# Computer Use");
    expect(output).toContain("xd://report_issue");
    expect(output).not.toContain("# AST");
    expect(output).not.toContain("§ Scratchpad");
  });

  test("absent optional sections remove their slots cleanly", () => {
    const main = renderMain({ tools: ["read"] });
    const output = expectSuccess(transform(main)).blocks[1] ?? "";

    expect(output).toContain("- `read`");
    expect(output).not.toContain("%%");
    expect(output).not.toContain("# Computer Use");
    expect(output).not.toContain("# xd:// Tool Devices");
    expect(output).not.toContain("§ Scratchpad");
    expect(output).not.toContain("# AST");
    expect(output).not.toContain("# Delegation");
  });

  test.each([
    ["Mermaid", { renderMermaid: true }],
    ["reactions", { reactions: true }],
    ["Personality", { personality: "Direct and technical." }],
    ["LSP", { tools: ["read", "lsp"] }],
    ["Todo", { tools: ["read", "todo"] }],
    ["Ask", { tools: ["read", "ask"] }],
    ["Browser and computer", { browser: true, computer: true }],
    ["Browser only", { browser: true }],
  ] as const)("accepts the known %s fixed-section branch", (_name, options) => {
    expectSuccess(transform(renderMain(options)));
  });

  test.each([
    ["Skill", () => ({ skills: [{ name: "marker", description: "Keep %%runtime-modes%% here." }] })],
    ["Rule", () => ({ rules: [{ name: "marker", globs: ["**/*"], description: "Keep %%runtime-modes%% here." }] })],
    [
      "tool description",
      () => ({
        tools: ["read"],
        inlineCatalog: true,
        toolDefinitions: { read: { description: "Keep %%runtime-modes%% here." } },
      }),
    ],
    ["device docs", () => ({ devices: [{ name: "marker_device", docs: "Keep %%runtime-modes%% here." }] })],
  ] as const)("preserves later slot markers inside %s data", (_source, makeOptions) => {
    const options = { ...makeOptions(), computer: true } as const;
    const skills = "skills" in options ? options.skills : [];
    const output = expectSuccess(transform(renderMain(options), { skills })).blocks[1] ?? "";
    expect(output).toContain("Keep %%runtime-modes%% here.");
    expect(output).toContain("# Computer Use");
  });
});

describe("Skill catalog normalization", () => {
  test("collapses LF, CRLF, tabs, blank paragraphs, and Unicode separators", () => {
    const skills = [{ name: "multi", description: "line1\r\nline2\ttabbed\n\n\npara\u2028next " }];
    const output = expectSuccess(transform(renderMain({ skills }), { skills })).blocks[1] ?? "";

    expect(catalogOf(output)).toBe("<skills>\n- multi: line1 line2 tabbed para next\n</skills>");
  });

  test("metadata distinguishes a continuation line from a genuine entry", () => {
    const one = [{ name: "alpha", description: "First\n- beta: Second" }];
    const two = [
      { name: "alpha", description: "First" },
      { name: "beta", description: "Second" },
    ];
    const single = expectSuccess(transform(renderMain({ skills: one }), { skills: one })).blocks[1] ?? "";
    const pair = expectSuccess(transform(renderMain({ skills: two }), { skills: two })).blocks[1] ?? "";

    expect(catalogOf(single)).toBe("<skills>\n- alpha: First - beta: Second\n</skills>");
    expect(catalogOf(pair)).toBe("<skills>\n- alpha: First\n- beta: Second\n</skills>");
  });

  test("preserves non-whitespace text, names, order, and the visible set", () => {
    const skills = [
      { name: "alpha", description: "First\ncontinued" },
      { name: "beta", description: "Second" },
      { name: "gamma", description: "Third" },
    ];
    const output = expectSuccess(transform(renderMain({ skills }), { skills })).blocks[1] ?? "";

    expect(catalogOf(output)).toBe("<skills>\n- alpha: First continued\n- beta: Second\n- gamma: Third\n</skills>");
  });

  test("keeps catalogs without metadata when the catalog is missing or empty", () => {
    const noCatalog = expectSuccess(transform(renderMain({ tools: ["read"] }))).blocks[1] ?? "";
    expect(noCatalog).not.toContain("<skills>");

    const empty = renderMain({ tools: ["read"] }).replace(
      "# Skills & Rules\n",
      "# Skills & Rules\n<skills>\n</skills>\n",
    );
    const output = expectSuccess(transform(empty)).blocks[1] ?? "";
    expect(output).toContain("<skills>\n</skills>");
  });

  test("keeps the catalog and applies the prompt when Skill commands are disabled", () => {
    const skills = [{ name: "alpha", description: "First\nContinuation" }];
    const result = transform(renderMain({ skills }), { metadata: [] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.skillFormattingSkipped).toBe("skill-metadata-unavailable");
    expect(catalogOf(result.blocks[1] ?? "")).toBe("<skills>\n- alpha: First\nContinuation\n</skills>");
    expect(result.blocks[1]).toContain("### Tool inventory");
    expect(result.blocks[2]).toContain("# Project snapshot");
  });

  test("matches visible entries against hidden candidates before, between, and after them", () => {
    const visible = [
      { name: "alpha", description: "First\ncontinued" },
      { name: "beta", description: "Second" },
    ];
    const metadata = [
      { name: "before", description: "Hidden before" },
      { name: "alpha", description: "First\ncontinued" },
      { name: "between", description: "Hidden between" },
      { name: "beta", description: "Second" },
      { name: "after", description: "Hidden after" },
    ];
    const result = expectSuccess(transform(renderMain({ skills: visible }), { metadata }));

    expect(result.skillFormattingSkipped).toBeUndefined();
    const catalog = catalogOf(result.blocks[1] ?? "");
    expect(catalog).toBe("<skills>\n- alpha: First continued\n- beta: Second\n</skills>");
    expect(catalog).not.toContain("before");
    expect(catalog).not.toContain("between");
    expect(catalog).not.toContain("after");
  });

  test.each([
    ["missing entry", () => [{ name: "alpha", description: "First" }], "skill-metadata-mismatch"],
    [
      "different order",
      () => [
        { name: "beta", description: "Second" },
        { name: "alpha", description: "First" },
      ],
      "skill-metadata-mismatch",
    ],
    [
      "description mismatch",
      () => [
        { name: "alpha", description: "Changed" },
        { name: "beta", description: "Second" },
      ],
      "skill-metadata-mismatch",
    ],
    [
      "ambiguous duplicate candidate",
      () => [
        { name: "alpha", description: "First\nContinuation" },
        { name: "alpha", description: "First\nContinuation" },
        { name: "beta", description: "Second" },
      ],
      "skill-metadata-mismatch",
    ],
  ] as const)("keeps the whole Skill catalog on %s", (_name, makeMetadata, reason) => {
    const skills = [
      { name: "alpha", description: "First\nContinuation" },
      { name: "beta", description: "Second" },
    ];
    const result = transform(renderMain({ skills }), { metadata: makeMetadata() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.skillFormattingSkipped).toBe(reason);
    expect(catalogOf(result.blocks[1] ?? "")).toBe("<skills>\n- alpha: First\nContinuation\n- beta: Second\n</skills>");
    expect(result.blocks[1]).toContain("### Tool inventory");
    expect(result.blocks[2]).toContain("# Project snapshot");
  });

  test("keeps an earlier extension's rewritten catalog and applies the rest", () => {
    const skills = [
      { name: "alpha", description: "First" },
      { name: "beta", description: "Second" },
    ];
    const main = renderMain({ skills }).replace("- alpha: First", "- alpha: Rewritten");
    const result = transform(main, { skills });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.skillFormattingSkipped).toBe("skill-metadata-mismatch");
    expect(catalogOf(result.blocks[1] ?? "")).toBe("<skills>\n- alpha: Rewritten\n- beta: Second\n</skills>");
    expect(result.blocks[1]).toContain("### Tool inventory");
  });

  test("recognizes local Skill fallback output as an idempotent owned prompt", () => {
    const skills = [{ name: "alpha", description: "First\nContinuation" }];
    const first = transform(renderMain({ skills }), { metadata: [] });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.skillFormattingSkipped).toBe("skill-metadata-unavailable");
    expect(transformSystemPrompt(first.blocks, OWNED_TEMPLATE, [])).toEqual({
      ok: true,
      blocks: first.blocks,
      changed: false,
    });
  });
  test("keeps an unsupported Skill entry format while applying other changes", () => {
    const skills = [{ name: "alpha", description: "First\nContinuation" }];
    const main = renderMain({ skills }).replace("- alpha: First", "alpha: First");
    const result = transform(main, { skills });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.skillFormattingSkipped).toBe("skill-metadata-mismatch");
    expect(catalogOf(result.blocks[1] ?? "")).toBe("<skills>\nalpha: First\nContinuation\n</skills>");
    expect(result.blocks[1]).toContain("### Tool inventory");
    expect(transformSystemPrompt(result.blocks, OWNED_TEMPLATE, [])).toEqual({
      ok: true,
      blocks: result.blocks,
      changed: false,
    });
  });

  test("keeps the whole input when the Skill outer boundary is missing", () => {
    const skills = [{ name: "alpha", description: "First" }];
    const main = renderMain({ skills }).replace("</skills>\n", "");
    expect(transform(main, { skills })).toEqual({ ok: false, reason: "main-block-not-found" });
  });

  test("normalized owned output is a no-op without metadata", () => {
    const skills = [{ name: "alpha", description: "First\nSecond" }];
    const first = expectSuccess(transform(renderMain({ skills }), { skills }));
    const again = transformSystemPrompt(first.blocks, OWNED_TEMPLATE, []);

    expect(again).toEqual({ ok: true, blocks: first.blocks, changed: false });
  });

  test("leaves whitespace in other dynamic regions untouched", () => {
    const ruleBody = "Rule one\n\nRule two";
    const deviceDocs = "## device\n\nDoc one\n\nDoc two";
    const projectBody = "Body one\n\nBody two";
    const append = "Append one\n\nAppend two";
    const skills = [{ name: "alpha", description: "First\nSecond" }];
    const main = renderMain({
      tools: ["read"],
      skills,
      alwaysApplyRules: [{ content: ruleBody }],
      devices: [{ name: "video_read", docs: deviceDocs }],
    });
    const output =
      expectSuccess(
        transform(main, {
          skills,
          project: renderProject({
            contextFiles: [{ path: "AGENTS.md", content: projectBody }],
            append,
          }),
        }),
      ).blocks[1] ?? "";

    expect(output).toContain(ruleBody);
    expect(output).toContain(deviceDocs);
    expect(output).toContain("- alpha: First Second");
    expect(output).not.toContain("Rule one Rule two");

    expect(output).not.toContain("Doc one Doc two");
  });
});

describe("opaque dynamic boundaries", () => {
  test.each([
    ["dir-context", "<dir-context>"],
    ["workspace-tree", "<workspace-tree>"],
    ["workspace-roots", "<workspace-roots>"],
    ["critical", "<critical>"],
  ] as const)("keeps line-start %s in PROJECT context files", (_name, marker) => {
    const body = `before\n${marker}\nafter`;
    const first = expectSuccess(
      transform(renderMain(), {
        project: renderProject({ contextFiles: [{ path: "AGENTS.md", content: body }] }),
      }),
    );

    expect(first.blocks[2]).toContain(body);
    expectOwnedNoOp(first.blocks);
  });

  test.each([
    [
      "always-apply rules",
      renderMain({ alwaysApplyRules: [{ content: "before\n# Internal URLs\nafter" }] }),
      [] as SkillSpec[],
      "before\n# Internal URLs\nafter",
    ],
    [
      "domain rules",
      renderMain({ rules: [{ name: "lookalike", globs: ["**/*"], description: "before\n# Internal URLs\nafter" }] }),
      [] as SkillSpec[],
      "before\n# Internal URLs\nafter",
    ],
    [
      "Skill descriptions",
      renderMain({ skills: [{ name: "lookalike", description: "before\n# Internal URLs\nafter" }] }),
      [{ name: "lookalike", description: "before\n# Internal URLs\nafter" }] as SkillSpec[],
      "- lookalike: before # Internal URLs after",
    ],
  ] as const)("keeps line-start %s in main dynamic data", (_name, main, skills, expected) => {
    const first = expectSuccess(transform(main, { skills }));

    expect(first.blocks[1]).toContain(expected);
    expectOwnedNoOp(first.blocks);
  });

  test("keeps line-start structural markers in device documentation", () => {
    const docs = "before\n§ Tool Policy\nafter";
    const first = expectSuccess(transform(renderMain({ tools: ["read"], devices: [{ name: "video_read", docs }] })));

    expect(first.blocks[1]).toContain(docs);
    expectOwnedNoOp(first.blocks);
  });

  test("keeps line-start structural markers in inline tool descriptions", () => {
    const description = "before\n# Computer Use\nafter";
    const first = expectSuccess(
      transform(
        renderMain({
          tools: ["read"],
          inlineCatalog: true,
          toolDefinitions: { read: { description } },
        }),
      ),
    );

    expect(first.blocks[1]).toContain("// before\n// # Computer Use\n// after");
    expectOwnedNoOp(first.blocks);
  });
});

describe("bounded parsing", () => {
  const baseSkills = [{ name: "alpha", description: "First skill." }];
  const baseMain = renderMain({
    tools: ["read", "task"],
    skills: baseSkills,
    rules: [{ name: "python", globs: ["**/*.py"], description: "Python rules." }],
    task: true,
    maxConcurrency: 2,
    taskIrc: true,
  });

  const rejectionCases: Array<[string, string, RejectReason]> = [
    [
      "garbage internal URL entry",
      baseMain.replace("# Tool Inventory", "unexpected internal line\n# Tool Inventory"),
      "unknown-section",
    ],
    [
      "unexpected Tool Policy line",
      baseMain.replace("# Tool I/O", "unexpected policy line\n# Tool I/O"),
      "unknown-section",
    ],
    [
      "unexpected conventions prefix line",
      baseMain.replace("</conventions>", "unexpected prefix line\n</conventions>"),
      "unknown-section",
    ],
    [
      "unexpected Engineering line",
      baseMain.replace("§ Runtime", "unexpected engineering line\n§ Runtime"),
      "unknown-section",
    ],
    [
      "unexpected Workflow tail line",
      baseMain.replace("§ Delivery", "unexpected workflow line\n§ Delivery"),
      "unknown-section",
    ],
  ];

  test.each(rejectionCases)("rejects %s", (_name, main, reason) => {
    expect(transform(main, { skills: baseSkills })).toEqual({ ok: false, reason });
  });

  test.each([
    ["Scope", () => ({ skills: baseSkills }), "- Read relevant skills first."],
    [
      "Ask",
      () => ({ tools: ["read", "ask"] }),
      "- Ask before destructive commands/deleting unrelated code you didn't write; code the cutover obsoletes is in scope.",
    ],
    [
      "LSP",
      () => ({ tools: ["read", "lsp"] }),
      "  - Before exported-symbol modification, MUST run `lsp references`; missed callsites are bugs.",
    ],
    ["Todo", () => ({ tools: ["read", "todo"] }), "- Update todos; skip trivial requests."],
    [
      "Browser",
      () => ({ browser: true }),
      "    - **Web UI** → use `browser.open` to get a tab handle, its direct helpers for common actions, `tab.run` for custom JavaScript, and `tab.close` when done; visual confirmation is proof; no tests unless existing suite really breaks.",
    ],
    [
      "Computer",
      () => ({ computer: true }),
      "    - **Native desktop UI** → use the `computer` helpers from JavaScript or Python eval; ground every claim in fresh screenshot or accessibility evidence.",
    ],
    [
      "fallback",
      () => ({}),
      "    - No suitable runtime capability for the changed surface → verify with a throwaway script or smoke test; explicitly report when visual verification cannot be performed.",
    ],
  ] as const)("rejects a misplaced %s condition line", (_name, makeOptions, line) => {
    const main = renderMain(makeOptions());
    const needle = `${line}\n`;
    if (!main.includes(needle)) throw new Error(`fixture line missing: ${line}`);
    const moved = main.replace(needle, "").replace("§ Delivery", `${line}\n§ Delivery`);
    expect(transform(moved, { skills: baseSkills })).toEqual({ ok: false, reason: "unknown-section" });
  });

  test("rejects unexpected content in the delegation mode", () => {
    const main = baseMain.replace("## Delegation gates", "Unexpected delegation mode line.\n## Delegation gates");
    expect(transform(main, { skills: baseSkills })).toEqual({ ok: false, reason: "unknown-section" });
  });

  test("rejects missing, duplicate, or custom structural blocks", () => {
    const project = renderProject();
    expect(transformSystemPrompt([project], OWNED_TEMPLATE, metadata(baseSkills))).toEqual({
      ok: false,
      reason: "main-block-not-found",
    });
    expect(transformSystemPrompt([baseMain], OWNED_TEMPLATE, metadata(baseSkills))).toEqual({
      ok: false,
      reason: "project-block-not-found",
    });
    expect(transformSystemPrompt([baseMain, baseMain, project], OWNED_TEMPLATE, metadata(baseSkills))).toEqual({
      ok: false,
      reason: "ambiguous-boundary",
    });
    expect(transformSystemPrompt(["custom prompt", project], OWNED_TEMPLATE)).toEqual({
      ok: false,
      reason: "main-block-not-found",
    });
  });

  test("empty input and missing template have bounded results", () => {
    expect(transformSystemPrompt([], OWNED_TEMPLATE)).toEqual({ ok: true, blocks: [], changed: false });
    expect(transformSystemPrompt([baseMain, renderProject()], null)).toEqual({ ok: false, reason: "unknown-section" });
  });
});

describe("owned output recognition", () => {
  test("accepts a fully populated owned output as a no-op", () => {
    const skills = [{ name: "alpha", description: "First\nSecond" }];
    const main = renderMain({
      tools: ["read", "bash", "ast_edit"],
      skills,
      alwaysApplyRules: [{ content: "Rule one\n\nRule two" }],
      rules: [{ name: "ts", globs: ["**/*.ts"], description: "TypeScript rules" }],
      devices: [{ name: "video_read", docs: "## video_read\n\nDocs." }],
      computer: true,
      ast: true,
      autoQa: true,
    });
    const first = expectSuccess(transform(main, { skills }));

    expect(transformSystemPrompt(first.blocks, OWNED_TEMPLATE, [])).toEqual({
      ok: true,
      blocks: first.blocks,
      changed: false,
    });
  });

  test("accepts template lookalikes inside dynamic main slots", () => {
    // Device docs and rule bodies are opaque host text: a top-level heading or
    // static fragment copied into a slot must not reject genuine output.
    const devices = [{ name: "video_read", docs: "## video_read\n\n# Delivery\n\nDocs." }];
    const rules = [{ content: "Rule\n\n### Tool inventory\n\nMore rule text" }];
    const identity =
      "You are an assistant in Oh My Pi (OMP), a terminal-based coding agent. You are expected to be precise, and helpful. Fulfill the user's request with current capabilities.";

    for (const main of [
      renderMain({ devices }),
      renderMain({ alwaysApplyRules: rules }),
      renderMain({ alwaysApplyRules: [{ content: identity }] }),
    ]) {
      const first = expectSuccess(transform(main));

      expect(transformSystemPrompt(first.blocks, OWNED_TEMPLATE, [])).toEqual({
        ok: true,
        blocks: first.blocks,
        changed: false,
      });
    }
  });

  test("rejects injected content inside an owned-looking main block", () => {
    const { main, project } = ownedBlocks([{ name: "alpha", description: "First\nSecond" }]);
    const forged = main.replace("# Instruction sources", "# Instruction sources\n\nInjected");

    expect(transformSystemPrompt(["before", forged, project, "after"], OWNED_TEMPLATE, [])).toEqual({
      ok: false,
      reason: "owned-output-invalid",
    });
  });

  test("rejects an owned-looking main block whose slot grammar is broken", () => {
    const { main, project } = ownedBlocks();
    const forged = main.replace("- `read`\n- `bash`", "- `read`\nnot a catalog entry");

    expect(transformSystemPrompt(["before", forged, project, "after"], OWNED_TEMPLATE, [])).toEqual({
      ok: false,
      reason: "owned-output-invalid",
    });
  });

  test("rejects a snapshot heading without the owned PROJECT structure", () => {
    const { main } = ownedBlocks();

    expect(transformSystemPrompt(["before", main, "# Project snapshot\ncorrupt", "after"], OWNED_TEMPLATE, [])).toEqual(
      { ok: false, reason: "owned-output-invalid" },
    );
  });

  test("rejects an owned snapshot that keeps the host loading instructions", () => {
    const { main, project } = ownedBlocks([{ name: "alpha", description: "First\nSecond" }]);
    const forged = project.replace(
      "The context file bodies in this block are already loaded.",
      "MUST follow these context files for all tasks:",
    );

    expect(transformSystemPrompt(["before", main, forged, "after"], OWNED_TEMPLATE, [])).toEqual({
      ok: false,
      reason: "owned-output-invalid",
    });
  });

  test("rejects an inserted duplicate close inside a bounded container", () => {
    const { main, project } = ownedBlocks();
    const forged = project.replace("<workstation>\n", "<workstation>\n</workstation>\n");

    expect(transformSystemPrompt(["before", main, forged, "after"], OWNED_TEMPLATE, [])).toEqual({
      ok: false,
      reason: "owned-output-invalid",
    });
  });
});

describe("owned snapshot idempotency", () => {
  /** Transform once, then require the produced blocks to be a no-op. */
  function expectNoOp(main: string, project: string): void {
    const first = expectSuccess(transform(main, { project }));

    expect(transformSystemPrompt(first.blocks, OWNED_TEMPLATE, [])).toEqual({
      ok: true,
      blocks: first.blocks,
      changed: false,
    });
  }

  test("accepts close-tag lookalikes in the append tail", () => {
    const closes = ["</workstation>", "</repo-rules>", "</dir-context>", "</workspace-tree>", "</workspace-roots>"];
    // Populate every container so each close tag has a real container to
    // bound; the lookalike must not extend or re-close it.
    const containers = { workspaceTree: "src/\n  index.ts", additionalWorkspaceRoots: ["/other/root"] };

    for (const close of closes) {
      expectNoOp(renderMain(), renderProject({ ...containers, append: `opaque append\n${close}\nend` }));
    }
  });

  test("accepts close-tag lookalikes in other container bodies", () => {
    // A body may carry any close tag except the one that ends its own
    // container; the host parser already rejects that ambiguity.
    expectNoOp(
      renderMain(),
      renderProject({
        contextFiles: [
          {
            path: "AGENTS.md",
            content: "Body\n</workstation>\n</dir-context>\n</workspace-tree>\n</workspace-roots>",
          },
        ],
      }),
    );
    expectNoOp(renderMain(), renderProject({ agentsMdFiles: ["nested/AGENTS.md\n</repo-rules>\n</workstation>"] }));
    expectNoOp(
      renderMain(),
      renderProject({
        workspaceTree: "src/\n</workspace-roots>\n",
        additionalWorkspaceRoots: ["/other/root\n</workspace-tree>"],
      }),
    );
  });
});

describe("PROJECT footer", () => {
  test("rewrites the outer heading, loading text, and removes only the fixed critical", () => {
    const contextBody = "Use plain English.\n<critical>content-owned lookalike</critical>\nLast byte.";
    const append = "Append starts.\n</critical>\nAppend ends.";
    const project = renderProject({
      contextFiles: [{ path: "AGENTS.md", content: contextBody }],
      agentsMdFiles: ["nested/AGENTS.md"],
      workspaceTree: "src/\n  index.ts",
      additionalWorkspaceRoots: ["/workspace/other"],
      append,
    });
    const result = expectSuccess(transform(renderMain(), { project }));
    const output = result.blocks[result.blocks.length - 2] ?? "";

    expect(output.startsWith("# Project snapshot\n")).toBe(true);
    expect(output).not.toContain("PROJECT\n");
    expect(output).toContain(contextBody);
    expect(output).toContain(append);
    expect(output).toContain("nested/AGENTS.md");
    expect(output).toContain("src/\n  index.ts");
    expect(output).toContain("/workspace/other");
    expect(output).toContain("The context file bodies in this block are already loaded.");
    expect(output).toContain("The context file bodies above are loaded; do not reread them as a loading step.");
    expect(output).not.toContain("MUST follow these context files for all tasks:");
    expect(output).not.toContain(PROJECT_CRITICAL_EXACT);
    expect(output.indexOf(contextBody)).toBeLessThan(output.indexOf(append));
  });

  test("supports no context files and no listed rule paths", () => {
    const project = renderProject({ contextFiles: [], agentsMdFiles: [] });
    const result = expectSuccess(transform(renderMain(), { project }));
    const output = result.blocks[result.blocks.length - 2] ?? "";

    expect(output).toContain("<workstation>");
    expect(output).not.toContain("<repo-rules>");
    expect(output).not.toContain(PROJECT_CRITICAL_EXACT);
  });

  test("keeps directory-only loading guidance without repo-rule bodies", () => {
    const project = renderProject({ contextFiles: [], agentsMdFiles: ["nested/AGENTS.md"] });
    const result = expectSuccess(transform(renderMain(), { project }));
    const output = result.blocks[result.blocks.length - 2] ?? "";

    expect(output).toContain("nested/AGENTS.md");
    expect(output).toContain(
      "The directory rule paths above are listed, not loaded; fetch applicable rules before dependent work.",
    );
    expect(output).not.toContain("The context file bodies in this block are already loaded.");
  });

  test("rejects altered or missing fixed critical tail", () => {
    const main = renderMain();
    const altered = renderProject().replace(
      "- Before yielding, MUST verify significant behavioral changes: run the specific test, command, or scenario covering the change.",
      "- Before yielding, verify changes.",
    );
    const missing = renderProject().replace(PROJECT_CRITICAL_EXACT, "");

    expect(transformSystemPrompt([main, altered], OWNED_TEMPLATE)).toEqual({
      ok: false,
      reason: "project-block-not-found",
    });
    expect(transformSystemPrompt([main, missing], OWNED_TEMPLATE)).toEqual({
      ok: false,
      reason: "project-block-not-found",
    });
  });
});
