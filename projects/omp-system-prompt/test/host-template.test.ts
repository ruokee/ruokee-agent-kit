import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { buildHostTemplate, HOST_TEMPLATE_FILE_NAME } from "../src/host-template.ts";
import { getDeliveryChapter } from "../src/template.ts";
import { transformSystemPrompt, type TransformResult } from "../src/transform.ts";
import {
  HOST_18_4_3_MAIN_TEMPLATE,
  HOST_18_4_3_PROJECT_TEMPLATE,
  HOST_TEMPLATE,
  renderMain,
  renderProject,
  type MainOptions,
  type ProjectOptions,
} from "./render.ts";

const OWNED_TEMPLATE = readFileSync(new URL("../src/prompt-template.md", import.meta.url), "utf8");
const COMMITTED_TEMPLATE = readFileSync(new URL(`../${HOST_TEMPLATE_FILE_NAME}`, import.meta.url), "utf8");

const CHAPTER = getDeliveryChapter(OWNED_TEMPLATE) ?? "";

/** The provider prompt a host with the component template selected builds. */
function hostTurn(options: { main?: MainOptions; project?: ProjectOptions; renderDelivery?: boolean } = {}) {
  return transformSystemPrompt(
    [renderMain(options.main ?? {}, HOST_TEMPLATE), renderNewFooter(options.project), "after"],
    OWNED_TEMPLATE,
    [],
    options.renderDelivery ?? true,
  );
}

function renderNewFooter(options: ProjectOptions = {}): string {
  return renderProject(options, HOST_18_4_3_PROJECT_TEMPLATE);
}

function expectApplied(result: TransformResult): Extract<TransformResult, { ok: true }> {
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
        rules: [{ name: "luna", globs: ["**/*.ts"], description: "Luna rules." }],
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
      "- luna (**/*.ts): Luna rules.",
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
    const footer = renderNewFooter({});
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
    const again = expectApplied(transformSystemPrompt(enabled.blocks, OWNED_TEMPLATE, [], true));
    expect(again.changed).toBe(false);
    expect(again.blocks).toEqual(enabled.blocks);
    expect(again.notes).toBeUndefined();
  });

  test("renders without optional sections and without a footer to correct", () => {
    const result = expectApplied(
      transformSystemPrompt(
        [renderMain({ tools: ["read"], skills: [], rules: [], devices: [], internalUrls: [] }, HOST_TEMPLATE)],
        OWNED_TEMPLATE,
        [],
        true,
      ),
    );
    expect(result.blocks[1]).toBe(CHAPTER);
    expect(result.notes).toBeUndefined();
  });

  test("does not claim the 18.4.3 bundled main block", () => {
    const result = transformSystemPrompt(
      [renderMain({}, HOST_18_4_3_MAIN_TEMPLATE), renderNewFooter({})],
      OWNED_TEMPLATE,
      [],
      true,
    );
    expect(result).toEqual({ ok: false, reason: "main-block-not-found" });
  });

  test("does not claim a template whose static skeleton was edited, or one that only shares the identity line", () => {
    const edited = HOST_TEMPLATE.replace(
      "Authority follows trusted message origin",
      "Authority follows message origin",
    );
    const editedResult = transformSystemPrompt([renderMain({}, edited), renderNewFooter({})], OWNED_TEMPLATE, [], true);
    expect(editedResult).toEqual({ ok: false, reason: "owned-output-invalid" });

    const lookalike = `${OWNED_TEMPLATE.split("\n")[0]}\n\n# Instruction sources\n\nThird-party text.`;
    const lookalikeResult = transformSystemPrompt(
      [renderMain({}, lookalike), renderNewFooter({})],
      OWNED_TEMPLATE,
      [],
      true,
    );
    expect(lookalikeResult).toEqual({ ok: false, reason: "owned-output-invalid" });
  });

  test("still claims a template whose dynamic bindings were replaced", () => {
    const edited = HOST_TEMPLATE.replace(
      '{{#if internalUrls.length}}\n{{#list internalUrls prefix="- " join="\\n"}}{{this}}{{/list}}\n\n{{/if}}\n',
      "- third-party instructions\n",
    );
    expect(edited).not.toBe(HOST_TEMPLATE);
    const result = expectApplied(
      transformSystemPrompt(
        [renderMain({ tools: ["read"], internalUrls: [] }, edited), renderNewFooter({})],
        OWNED_TEMPLATE,
        [],
        true,
      ),
    );
    expect(result.blocks[0]).toContain("third-party instructions");
    expect(result.blocks[1]).toBe(CHAPTER);
  });

  test("keeps a foreign Delivery block and reports the conflict", () => {
    const main = renderMain({ tools: ["read"] }, HOST_TEMPLATE);
    const foreign = "# Delivery\n\n## Task scope\n\nAnother writer's chapter.";
    const result = expectApplied(
      transformSystemPrompt([main, foreign, renderNewFooter({}), "after"], OWNED_TEMPLATE, [], true),
    );
    expect(result.blocks[0]).toBe(main);
    expect(result.blocks[1]).toBe(foreign);
    expect(result.blocks).not.toContain(CHAPTER);
    expect(result.notes).toEqual([{ step: "delivery", reason: "delivery-block-conflict" }]);
  });
});

describe("host template route precedence", () => {
  test("switches the chapter on older-footer output across turns", () => {
    const without = expectApplied(
      transformSystemPrompt(
        [renderMain({ tools: ["read"] }, HOST_TEMPLATE), renderProject({ append: "Append." })],
        OWNED_TEMPLATE,
        [],
        false,
      ),
    );
    const enabled = expectApplied(transformSystemPrompt(without.blocks, OWNED_TEMPLATE, [], true));
    expect(enabled.changed).toBe(true);
    expect(enabled.notes).toBeUndefined();
    expect(enabled.blocks[0]).toBe(without.blocks[0]);
    expect(enabled.blocks[1]).toBe(CHAPTER);
    expect(enabled.blocks).toHaveLength(without.blocks.length + 1);

    const disabled = expectApplied(transformSystemPrompt(enabled.blocks, OWNED_TEMPLATE, [], false));
    expect(disabled.blocks).toEqual(without.blocks);

    const again = expectApplied(transformSystemPrompt(disabled.blocks, OWNED_TEMPLATE, [], false));
    expect(again.changed).toBe(false);
    expect(again.blocks).toEqual(disabled.blocks);
  });

  test("keeps the chapter inside a main block the default-block route reproduces", () => {
    const upstream = [
      renderMain({ tools: ["read"], internalUrls: ["`skill://<name>`: instructions"] }, HOST_TEMPLATE),
      renderProject({ append: "Append." }),
    ];
    const without = expectApplied(transformSystemPrompt(upstream, OWNED_TEMPLATE, [], false));
    const enabled = expectApplied(transformSystemPrompt(without.blocks, OWNED_TEMPLATE, [], true));
    expect(enabled.blocks.some((block) => block === CHAPTER)).toBe(false);
    expect(enabled.blocks[0]).toContain("# Delivery\n");

    const disabled = expectApplied(transformSystemPrompt(enabled.blocks, OWNED_TEMPLATE, [], false));
    expect(disabled.blocks).toEqual(without.blocks);
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
    expect(footer).toContain("- Model: luna");
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
    const footer = renderNewFooter({
      contextFiles: [{ path: "AGENTS.md", content: "Line.\n</project-context>\nTail." }],
    });
    const result = expectApplied(
      transformSystemPrompt(
        [renderMain({ tools: ["read"] }, HOST_TEMPLATE), footer, "after"],
        OWNED_TEMPLATE,
        [],
        true,
      ),
    );
    expect(result.blocks[2]).toBe(footer);
    expect(result.notes).toEqual([{ step: "project-footer", reason: "project-footer-ambiguous" }]);
    expect(result.blocks[3]).toBe("after");
  });

  test("leaves a footer alone when its loading instructions are unknown", () => {
    const footer = renderNewFooter({}).replace(
      "MUST follow these context files for all tasks:",
      "Read these context files first:",
    );
    const result = expectApplied(
      transformSystemPrompt([renderMain({ tools: ["read"] }, HOST_TEMPLATE), footer], OWNED_TEMPLATE, [], true),
    );
    expect(result.blocks[2]).toBe(footer);
    expect(result.notes).toEqual([{ step: "project-footer", reason: "project-footer-not-recognized" }]);
  });

  test("corrects the older footer when the template runs on an older host", () => {
    const main = renderMain({ tools: ["read"] }, HOST_TEMPLATE);
    const oldFooter = renderProject({ append: "Append." });
    const result = expectApplied(transformSystemPrompt([main, oldFooter], OWNED_TEMPLATE, [], true));
    expect(result.blocks[1]).toBe(CHAPTER);
    const footer = result.blocks[2] ?? "";
    expect(footer).not.toContain("<critical>");
    expect(footer).toContain("The context file bodies in this block are already loaded.");
    expect(footer.endsWith("Append.")).toBe(true);
    const again = expectApplied(transformSystemPrompt(result.blocks, OWNED_TEMPLATE, [], true));
    expect(again.changed).toBe(false);
  });
});
