import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { buildHostTemplate, HOST_TEMPLATE_FILE_NAME } from "../src/host-template.ts";
import { getDeliveryChapter } from "../src/template.ts";
import {
  prepareTemplate,
  transformSystemPrompt as transformWith,
  type OwnedTemplate,
  type TransformResult,
} from "../src/transform.ts";
import {
  HOST_TEMPLATE,
  renderMain,
  renderProject,
  replaceHostText,
  type MainOptions,
  type ProjectOptions,
} from "./render.ts";

const OWNED_TEMPLATE = readFileSync(new URL("../src/prompt-template.md", import.meta.url), "utf8");
const COMMITTED_TEMPLATE = readFileSync(new URL(`../${HOST_TEMPLATE_FILE_NAME}`, import.meta.url), "utf8");

const CHAPTER = getDeliveryChapter(OWNED_TEMPLATE) ?? "";
const OWNED = prepareTemplate(OWNED_TEMPLATE) as OwnedTemplate;
// The host project-prompt.md selects this line for ordinary subagents.
const SUBAGENT_CRITICAL_LINE =
  "- Changes complete → yield; verification is main agent's job. NEVER run it yourself unless your assignment explicitly instructs it.";
const MAIN_CRITICAL_LINE =
  "- Before yielding, MUST verify significant behavioral changes: run the specific test, command, or scenario covering the change.";
const SUBAGENT_CRITICAL_TAIL = [
  "<critical>",
  "- Each response MUST advance the task; completion only stopping condition.",
  "- MUST default to informed action; do not ask for confirmation when tools or repo context can answer.",
  SUBAGENT_CRITICAL_LINE,
  "</critical>",
].join("\n");

/** The provider prompt a host with the component template selected builds. */
function hostTurn(options: { main?: MainOptions; project?: ProjectOptions; renderDelivery?: boolean } = {}) {
  return transformSystemPrompt(
    [renderMain(options.main ?? {}, HOST_TEMPLATE), renderProject(options.project), "after"],
    options.renderDelivery ?? true,
  );
}

function transformSystemPrompt(blocks: readonly string[], renderDelivery: boolean): TransformResult | undefined {
  return transformWith(blocks, OWNED, renderDelivery);
}

function expectApplied(result: TransformResult | undefined): Extract<TransformResult, { ok: true }> {
  if (result === undefined) throw new Error("template render not recognized");
  if (!result.ok) throw new Error(`unexpected rejection: ${result.reason}`);
  return result;
}

describe("host template artifact", () => {
  test("the committed file matches the owned source", () => {
    const built = buildHostTemplate(OWNED_TEMPLATE);
    if (built === null) throw new Error("owned template cannot be bound to host data");
    expect(built.text).toBe(COMMITTED_TEMPLATE);
    expect(COMMITTED_TEMPLATE).not.toContain("%%");
    expect(COMMITTED_TEMPLATE.endsWith("\n")).toBe(true);
  });

  test("renders every owned section from host data", () => {
    const rendered = renderMain(
      {
        tools: ["read", "bash", "write", "ast_grep"],
        toolDefinitions: { read: { label: "Read" }, bash: { label: "Bash" } },
        skills: [{ name: "code-quality", description: "Review code quality." }],
        alwaysApplyRules: [{ content: "Project conventions apply." }],
        rules: [{ name: "example-rule", globs: ["**/*.ts"], description: "Example rules." }],
        devices: [{ name: "video_read", docs: "- xd://video_read — Read a video." }],
        intent: true,
        secrets: true,
        autoQa: true,
      },
      HOST_TEMPLATE,
    );
    for (const section of [
      "# Instruction sources",
      "### Tool inventory",
      "- Read: `read`",
      "### Mounted devices",
      "- xd://video_read — Read a video.",
      "## Internal resources",
      "- skill://<name>",
      "<skills>",
      "- code-quality: Review code quality.",
      "<generic-rules>",
      "Project conventions apply.",
      "</generic-rules>\n\n<domain-rules>",
      "- example-rule (**/*.ts): Example rules.",
      "## Runtime modes",
      "# Tool I/O",
      "- Most tools take `i`",
      "$$HASH$$",
      "# Specialized Tools",
      "- `bash`: real binaries",
      "<critical>\n`write xd://report_issue`",
      "# AST\n\nSHOULD use syntax-aware tools before text hacks:",
      "- Structural discovery → `ast_grep`.",
    ]) {
      expect(rendered).toContain(section);
    }
    expect(rendered).not.toContain("# Delivery");
  });

  test("leaves no gap where a section is absent", () => {
    const rendered = renderMain(
      {
        tools: ["read"],
        skills: [],
        rules: [],
        alwaysApplyRules: [],
        devices: [],
        internalUrls: [],
        toolDefinitions: { read: { label: "Read" } },
      },
      HOST_TEMPLATE,
    );
    expect(rendered).toContain("### Tool inventory\n\n- Read: `read`\n\n## Tool devices");
    expect(rendered).toContain("### Mounted devices\n\n## Internal resources");
    expect(rendered).toContain("## Internal resources\n\nUse documented URI handlers");
    expect(rendered).toContain("## Skills\n\nUse descriptions for matching");
    expect(rendered).toContain("## Runtime modes\n\nFollow active modes'");
    expect(rendered).toContain("# Specialized Tools\n\nMUST use specialized tool over shell equivalent:");
    for (const absent of [
      "- skill://",
      "<skills>",
      "<generic-rules>",
      "<domain-rules>",
      "# Tool I/O",
      "# AST",
      "§ Scratchpad",
    ]) {
      expect(rendered).not.toContain(absent);
    }
    expect(rendered).not.toContain("\n\n\n");
  });
});

describe("host template route", () => {
  test("applies the owned Delivery chapter as its own block", () => {
    const main = renderMain({ tools: ["read"], computer: false }, HOST_TEMPLATE);
    const result = expectApplied(hostTurn({ main: { tools: ["read"] }, project: {} }));
    expect(result.changed).toBe(true);
    expect(result.blocks[0]).toBe(main);
    expect(result.blocks[1]).toBe(CHAPTER);
    expect(result.notes).toBeUndefined();
    const joined = result.blocks.join("\n\n");
    expect(joined.match(/^# Delivery$/gm)).toHaveLength(1);
    expect(joined).toContain(main.slice(0, 80));
    expect(joined.endsWith("after")).toBe(true);
    expect(joined).toContain("</project-context>");
    expect(joined.startsWith("You are an assistant in Oh My Pi")).toBe(true);
  });

  test("omits the chapter when renderDelivery is off, and keeps it out of the template render", () => {
    const result = expectApplied(hostTurn({ renderDelivery: false }));
    expect(result.changed).toBe(true);
    expect(result.blocks.some((block) => block === CHAPTER)).toBe(false);
    expect(result.blocks[0]).not.toContain("# Delivery");
    const joined = result.blocks.join("\n\n");
    expect(joined).not.toContain("# Delivery");
    expect(joined).not.toContain("## Task scope");
    expect(joined).not.toContain("## Pausing");
  });

  test("is a no-op on its own output and switches the chapter", () => {
    const enabled = expectApplied(hostTurn({}));
    const again = expectApplied(transformSystemPrompt(enabled.blocks, true));
    expect(again.changed).toBe(false);
    expect(again.blocks).toEqual(enabled.blocks);
    expect(again.notes).toBeUndefined();
  });

  test("renders without optional sections and without a footer to correct", () => {
    const result = expectApplied(
      transformSystemPrompt(
        [renderMain({ tools: ["read"], skills: [], rules: [], devices: [], internalUrls: [] }, HOST_TEMPLATE)],
        true,
      ),
    );
    expect(result.blocks[1]).toBe(CHAPTER);
    expect(result.notes).toBeUndefined();
  });

  test("does not claim the host's bundled main block", () => {
    const result = transformSystemPrompt([renderMain({}), renderProject({})], true);
    expect(result).toBeUndefined();
  });

  test("does not claim a template whose static skeleton was edited, or one that only shares the identity line", () => {
    const edited = HOST_TEMPLATE.replace(
      "Authority follows trusted message origin",
      "Authority follows message origin",
    );
    const editedResult = transformSystemPrompt([renderMain({}, edited), renderProject({})], true);
    expect(editedResult).toBeUndefined();

    const lookalike = `${OWNED_TEMPLATE.split("\n")[0]}\n\n# Instruction sources\n\nThird-party text.`;
    const lookalikeResult = transformSystemPrompt([renderMain({}, lookalike), renderProject({})], true);
    expect(lookalikeResult).toBeUndefined();
  });

  test("still claims a template whose dynamic bindings were replaced", () => {
    const edited = HOST_TEMPLATE.replace(
      '{{#if internalUrls.length}}\n{{#list internalUrls prefix="- " join="\\n"}}{{this}}{{/list}}\n\n{{/if}}\n',
      "- third-party instructions\n",
    );
    expect(edited).not.toBe(HOST_TEMPLATE);
    const result = expectApplied(
      transformSystemPrompt([renderMain({ tools: ["read"], internalUrls: [] }, edited), renderProject({})], true),
    );
    expect(result.blocks[0]).toContain("third-party instructions");
    expect(result.blocks[1]).toBe(CHAPTER);
  });

  test("keeps a foreign Delivery block and reports the conflict", () => {
    const main = renderMain({ tools: ["read"] }, HOST_TEMPLATE);
    const foreign = "# Delivery\n\n## Task scope\n\nAnother writer's chapter.";
    const result = expectApplied(transformSystemPrompt([main, foreign, renderProject({}), "after"], true));
    expect(result.blocks[0]).toBe(main);
    expect(result.blocks[1]).toBe(foreign);
    expect(result.blocks).not.toContain(CHAPTER);
    expect(result.notes).toEqual([{ step: "delivery", reason: "delivery-block-conflict" }]);
  });
});

describe("host template chapter switching", () => {
  test("switches the chapter across turns", () => {
    const without = expectApplied(
      transformSystemPrompt(
        [renderMain({ tools: ["read"] }, HOST_TEMPLATE), renderProject({ append: "Append." })],
        false,
      ),
    );
    const enabled = expectApplied(transformSystemPrompt(without.blocks, true));
    expect(enabled.changed).toBe(true);
    expect(enabled.notes).toBeUndefined();
    expect(enabled.blocks[0]).toBe(without.blocks[0]);
    expect(enabled.blocks[1]).toBe(CHAPTER);
    expect(enabled.blocks).toHaveLength(without.blocks.length + 1);

    const disabled = expectApplied(transformSystemPrompt(enabled.blocks, false));
    expect(disabled.blocks).toEqual(without.blocks);

    const again = expectApplied(transformSystemPrompt(disabled.blocks, false));
    expect(again.changed).toBe(false);
    expect(again.blocks).toEqual(disabled.blocks);
  });
});

describe("host template footer", () => {
  test("corrects the new footer and keeps bodies, paths, workspace, and append", () => {
    const body = "Use plain English.\n\nA quoted </project-context> marker stays inside the body.";
    const append = "Append text.\nwith <critical> inside.";
    const result = expectApplied(
      hostTurn({
        project: {
          contextFiles: [{ path: "AGENTS.md", content: body }],
          agentsMdFiles: ["some/AGENTS.md"],
          workspaceTree: "src/\n  index.ts",
          additionalWorkspaceRoots: ["/other/root"],
          activeRepo: "<active-repo-context>\nActive project: `web/`.\n</active-repo-context>",
          append,
        },
      }),
    );
    const footer = result.blocks[2] ?? "";
    expect(footer).not.toContain("MUST follow these context files for all tasks:");
    expect(footer).not.toContain("Context files above auto-loaded");
    expect(footer).not.toContain("Each response MUST advance the task");
    expect(footer).toContain("The context file bodies in this block are already loaded.");
    expect(footer).toContain("The context file bodies above are loaded; do not reread them as a loading step.");
    expect(footer).toContain(`<file path="AGENTS.md">\n${body}\n</file>`);
    expect(footer).toContain("- some/AGENTS.md");
    expect(footer).toContain("<workspace-tree>\nWorking-directory layout");
    expect(footer).toContain("src/\n  index.ts");
    expect(footer).toContain("<workspace-roots>");
    expect(footer).toContain("- /other/root");
    expect(footer).toContain("<active-repo-context>\nActive project: `web/`.");
    expect(footer.endsWith(`</project-context>\n\n${append}`)).toBe(true);
    expect(footer.startsWith("<project-context>\n<workstation>")).toBe(true);
    expect(footer).toContain("- Model: example-model-1.0");
    expect(result.notes).toBeUndefined();
  });
  test("removes the subagent tail without changing main output or opaque copies", () => {
    const quotedTail = SUBAGENT_CRITICAL_TAIL;
    const quotedMainTail = quotedTail.replace(SUBAGENT_CRITICAL_LINE, MAIN_CRITICAL_LINE);
    const body = `Quoted host tails:\n${quotedTail}\n${quotedMainTail}`;
    const append = `Append remains opaque:\n${quotedMainTail}\n${quotedTail}`;
    const project: ProjectOptions = {
      contextFiles: [{ path: "nested/rules.md", content: body }],
      agentsMdFiles: ["some/AGENTS.md"],
      workspaceTree: "src/\n  index.ts",
      additionalWorkspaceRoots: ["/other/root"],
      activeRepo: "<active-repo-context>\nActive project: `web/`.\n</active-repo-context>",
      append,
    };
    const main = renderMain({}, HOST_TEMPLATE);
    const before = [main, renderProject({ ...project, subagent: true }), "after"];
    const expected = expectApplied(hostTurn({ project }));
    const result = expectApplied(transformSystemPrompt(before, true));
    expect(result.blocks).toEqual(expected.blocks);
    expect(result.blocks[2]).toContain(`<file path="nested/rules.md">\n${body}\n</file>`);
    expect(result.blocks[2]?.endsWith(`</project-context>\n\n${append}`)).toBe(true);
    expect(result.notes).toBeUndefined();
    const again = expectApplied(transformSystemPrompt(result.blocks, true));
    expect(again.blocks).toEqual(result.blocks);
    expect(again.changed).toBe(false);
  });

  for (const kind of ["main", "subagent"] as const) {
    for (const [shape, project] of [
      ["bodies", {}],
      ["directories", { contextFiles: [] }],
      ["workstation only", { contextFiles: [], agentsMdFiles: [] }],
    ] satisfies Array<[string, ProjectOptions]>) {
      test(`preserves a critical block at the append start across repeated ${kind} conversion with ${shape}`, () => {
        const append = `${SUBAGENT_CRITICAL_TAIL}\n\nUSER_APPEND_KEEP`;
        const result = expectApplied(
          transformSystemPrompt(
            [renderMain({}, HOST_TEMPLATE), renderProject({ ...project, append, subagent: kind === "subagent" })],
            false,
          ),
        );
        expect(result.blocks[1]?.endsWith(`</project-context>\n\n${append}`)).toBe(true);
        expect(result.notes).toBeUndefined();
        const again = expectApplied(transformSystemPrompt(result.blocks, false));
        expect(again.blocks).toEqual(result.blocks);
        expect(again.changed).toBe(false);
        expect(again.notes).toBeUndefined();
      });
    }
  }

  test("keeps complete bare-footer output unchanged for non-ambiguous appends", () => {
    const main = renderMain({}, HOST_TEMPLATE);
    for (const [subagent, tail] of [
      [false, SUBAGENT_CRITICAL_TAIL.replace(SUBAGENT_CRITICAL_LINE, MAIN_CRITICAL_LINE)],
      [true, SUBAGENT_CRITICAL_TAIL],
    ] as const) {
      for (const append of [
        "",
        "ORDINARY_APPEND_KEEP",
        `Quoted tail:\n${SUBAGENT_CRITICAL_TAIL}`,
        "<!-- omp-system-prompt:project-context -->\nAPPEND_KEEP",
      ]) {
        const footer = renderProject({ contextFiles: [], agentsMdFiles: [], append, subagent });
        const expected = replaceHostText(footer, `\n\n${tail}`, "", "native outer tail");
        const result = expectApplied(transformSystemPrompt([main, footer], false));
        expect(result.blocks).toEqual([main, expected]);
        expect(result.notes).toBeUndefined();
        const again = expectApplied(transformSystemPrompt(result.blocks, false));
        expect(again.blocks).toEqual(result.blocks);
        expect(again.changed).toBe(false);
      }
    }
  });

  test("adds only the ownership comment when a bare append starts with either known tail", () => {
    const main = renderMain({}, HOST_TEMPLATE);
    for (const tail of [
      SUBAGENT_CRITICAL_TAIL,
      SUBAGENT_CRITICAL_TAIL.replace(SUBAGENT_CRITICAL_LINE, MAIN_CRITICAL_LINE),
    ]) {
      const append = `${tail}\n\nAPPEND_KEEP`;
      const footer = renderProject({ contextFiles: [], agentsMdFiles: [], append, subagent: true });
      const expected = footer
        .replace(`\n\n${SUBAGENT_CRITICAL_TAIL}`, "")
        .replace("</workstation>", "</workstation>\n\n<!-- omp-system-prompt:project-context -->");
      const result = expectApplied(transformSystemPrompt([main, footer], false));
      expect(result.blocks).toEqual([main, expected]);
      const enabled = expectApplied(transformSystemPrompt(result.blocks, true));
      expect(enabled.blocks).toEqual([main, CHAPTER, expected]);
      const disabled = expectApplied(transformSystemPrompt(enabled.blocks, false));
      expect(disabled.blocks).toEqual(result.blocks);
      const again = expectApplied(transformSystemPrompt(disabled.blocks, false));
      expect(again.changed).toBe(false);
      expect(again.blocks).toEqual(result.blocks);
    }
  });

  test("retains an unknown subagent tail at the validated outer boundary", () => {
    const unknownLine = `${SUBAGENT_CRITICAL_LINE} Additional instruction.`;
    const footer = replaceHostText(
      renderProject({ append: "Append.", subagent: true }),
      SUBAGENT_CRITICAL_LINE,
      unknownLine,
      "unknown critical tail",
    );
    const result = expectApplied(transformSystemPrompt([renderMain({}, HOST_TEMPLATE), footer], true));
    expect(result.blocks[2]).toContain(unknownLine);
    expect(result.blocks[2]?.endsWith("</critical>\n\nAppend.")).toBe(true);
    expect(result.notes).toBeUndefined();
  });

  test("uses the directory-only loading line when no context body is present", () => {
    const result = expectApplied(hostTurn({ project: { contextFiles: [] } }));
    const footer = result.blocks[2] ?? "";
    expect(footer).toContain("The directory rule paths above are listed, not loaded");
    expect(footer).not.toContain("The context file bodies above are loaded");
    expect(footer).not.toContain("Each response MUST advance the task");
  });

  test("leaves the footer alone when the outer boundary is not unique", () => {
    const footer = renderProject({
      contextFiles: [{ path: "AGENTS.md", content: "Line.\n</project-context>\nTail." }],
    });
    const result = expectApplied(
      transformSystemPrompt([renderMain({ tools: ["read"] }, HOST_TEMPLATE), footer, "after"], true),
    );
    expect(result.blocks[2]).toBe(footer);
    expect(result.notes).toEqual([{ step: "project-footer", reason: "project-footer-ambiguous" }]);
    expect(result.blocks[3]).toBe("after");
  });

  test("leaves a footer alone when its loading instructions are unknown", () => {
    const footer = renderProject({}).replace(
      "MUST follow these context files for all tasks:",
      "Read these context files first:",
    );
    const result = expectApplied(transformSystemPrompt([renderMain({ tools: ["read"] }, HOST_TEMPLATE), footer], true));
    expect(result.blocks[2]).toBe(footer);
    expect(result.notes).toEqual([{ step: "project-footer", reason: "project-footer-not-recognized" }]);
  });
});
