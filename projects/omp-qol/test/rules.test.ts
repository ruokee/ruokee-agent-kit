import { expect, test } from "bun:test";
import {
  collectRuleBodies,
  matchesModel,
  parseRuleDocument,
  type RuleRejectReason,
  type RuleRoots,
} from "../src/model-prompts.ts";
import { treeFileSystem, type RuleTree } from "./rule-tree.ts";

const MODEL = { id: "example-model-1.0", provider: "example-provider" };
const ROOTS: RuleRoots = { user: "user", project: "project" };

function document(match: string, body = "Rule body."): string {
  return `---\n${match}\n---\n${body}`;
}

function expectDocument(text: string) {
  const parsed = parseRuleDocument(text);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw new Error(`expected a valid document, got ${parsed.reason}`);
  return parsed.document;
}

function expectReason(text: string, reason: RuleRejectReason) {
  const parsed = parseRuleDocument(text);
  expect(parsed.ok).toBe(false);
  if (parsed.ok) throw new Error("expected an invalid document");
  expect(parsed.reason).toBe(reason);
}

test("matches substrings, exact pairs, bare ids, and regular expressions", () => {
  const cases: Array<[string, boolean]> = [
    ["  - exact: example-provider/example-model-1.0", true],
    ["  - exact: example-model-1.0", false],
    ["  - exact: example-provider/other", false],
    ["  - model: example-model-1.0", true],
    ["  - model: example-provider/example-model-1.0", false],
    ["  - contains: example-model", true],
    ["  - contains: example-provider/", true],
    ["  - contains: EXAMPLE-PROVIDER", false],
    ["  - regex: ^example-provider/example-model-1\\.[01]", true],
    ["  - regex: ^example-provider/example-model-1\\.[2-9]", false],
  ];
  for (const [condition, expected] of cases) {
    expect(matchesModel(expectDocument(document(`match:\n${condition}`)), MODEL)).toBe(expected);
  }
});

test("treats entries as alternatives in any order", () => {
  const parsed = expectDocument(
    document("match:\n  - model: example-provider/other\n  - contains: example-model\n  - exact: nowhere"),
  );
  expect(matchesModel(parsed, MODEL)).toBe(true);
});

test("rejects documents without an exact delimiter pair", () => {
  expectReason("match:\n  - model: example-model-1.0\n", "frontmatter-missing");
  expectReason("Rule body only.\n", "frontmatter-missing");
  expectReason("text\n---\nmatch:\n  - model: example-model-1.0\n---\nbody", "frontmatter-missing");
  expectReason("----\nmatch:\n  - model: example-model-1.0\n---\nbody", "frontmatter-missing");
  expectReason("--- x\nmatch:\n  - model: example-model-1.0\n---\nbody", "frontmatter-missing");
  expectReason("---\nmatch:\n  - model: example-model-1.0\n----\nbody", "frontmatter-missing");
  expectReason("---\nmatch:\n  - model: example-model-1.0\n", "frontmatter-missing");
  expectReason("---\n", "frontmatter-missing");
});

test("rejects documents whose match block is absent, mistyped, or empty", () => {
  expectReason("---\ntitle: nope\n---\nbody", "match-missing");
  expectReason("---\n---\nbody", "match-missing");
  expectReason("---\nmatch: example-model-1.0\n---\nbody", "match-missing");
  expectReason("---\nmatch:\n---\nbody", "match-missing");
  expectReason("---\nmatch: []\n---\nbody", "match-empty");
  expectReason('---\nmatch: "example-model-1.0"\n---\nbody', "match-missing");
  expectReason("---\n[unclosed\n---\nbody", "frontmatter-invalid");
  expectReason("---\nmatch:\n  - model: [unclosed\n---\nbody", "frontmatter-invalid");
});

test("rejects entries with the wrong shape, unknown keys, or blank values", () => {
  expectReason(document('match:\n  - "plain string"'), "entry-shape");
  expectReason(document("match:\n  - [model, example-model-1.0]"), "entry-shape");
  expectReason(
    document("match:\n  -\n    model: example-model-1.0\n    exact: example-provider/example-model-1.0"),
    "entry-shape",
  );
  expectReason(document("match:\n  - name: example-model"), "entry-key");
  expectReason(document("match:\n  - Model: example-model-1.0"), "entry-key");
  expectReason(document("match:\n  - model: 5"), "entry-value");
  expectReason(document("match:\n  - model: [example-model-1.0]"), "entry-value");
  expectReason(document('match:\n  - model: ""'), "entry-value");
  expectReason(document('match:\n  - contains: "  "'), "entry-value");
});

test("rejects an uncompilable regular expression", () => {
  expectReason(document("match:\n  - regex: '[unclosed'"), "regex-invalid");
  expectReason(document('match:\n  - regex: "(?<name>"'), "regex-invalid");
});

test("rejects a blank body", () => {
  expectReason("---\nmatch:\n  - model: example-model-1.0\n---\n", "body-blank");
  expectReason("---\nmatch:\n  - model: example-model-1.0\n---\n   \n\t\n", "body-blank");
});

test("keeps the body byte-for-byte after the closing delimiter", () => {
  const parsed = expectDocument(document("match:\n  - model: example-model-1.0", "\nfirst\n\n<!-- kept -->\nlast\n"));
  expect(parsed.body).toBe("\nfirst\n\n<!-- kept -->\nlast\n");

  const crlf = expectDocument("---\r\nmatch:\r\n  - model: example-model-1.0\r\n---\r\nline one\r\nline two\r\n");
  expect(crlf.body).toBe("line one\r\nline two\r\n");

  const bom = expectDocument("\uFEFF---\nmatch:\n  - model: example-model-1.0\n---\nbody without a trailing newline");
  expect(bom.body).toBe("body without a trailing newline");
});

test("appends user documents before project documents in name order", async () => {
  // String order puts `10-b.md` before `2-a.md`, so names sort as written.
  const tree: RuleTree = {
    "user/10-b.md": document("match:\n  - contains: example-model", "User ten."),
    "user/2-a.md": document("match:\n  - model: example-model-1.0", "User two."),
    "project/1-c.md": document("match:\n  - exact: example-provider/example-model-1.0", "Project one."),
  };
  const { bodies, diagnostics } = await collectRuleBodies(ROOTS, MODEL, treeFileSystem(tree));

  expect(diagnostics).toEqual([]);
  expect(bodies).toEqual(["User ten.", "User two.", "Project one."]);
});

test("ignores hidden files, other extensions, and nested directories", async () => {
  const tree: RuleTree = {
    "user/.hidden.md": document("match:\n  - contains: example-model", "Hidden."),
    "user/notes.markdown": document("match:\n  - contains: example-model", "Other extension."),
    "user/UPPER.MD": document("match:\n  - contains: example-model", "Wrong case."),
    "user/.md": document("match:\n  - contains: example-model", "Dot only."),
    "user/nested/rule.md": document("match:\n  - contains: example-model", "Nested."),
    "user/kept.md": document("match:\n  - contains: example-model", "Kept."),
  };
  const { bodies, diagnostics } = await collectRuleBodies(ROOTS, MODEL, treeFileSystem(tree));

  expect(diagnostics).toEqual([]);
  expect(bodies).toEqual(["Kept."]);
});

test("skips only the affected source when a read fails", async () => {
  const tree: RuleTree = {
    "user/kept.md": document("match:\n  - contains: example-model", "User kept."),
    "user/gone.md": document("match:\n  - contains: example-model", "Unreadable."),
    "project/kept.md": document("match:\n  - contains: example-model", "Project kept."),
  };
  const { bodies, diagnostics } = await collectRuleBodies(
    ROOTS,
    MODEL,
    treeFileSystem(tree, { unreadableFiles: ["user/gone.md"] }),
  );

  expect(diagnostics).toEqual([{ reason: "file-unreadable", source: "user/gone.md" }]);
  expect(bodies).toEqual(["User kept.", "Project kept."]);
});

test("reports an unreadable directory and still reads the other one", async () => {
  const tree: RuleTree = { "project/kept.md": document("match:\n  - contains: example-model", "Project kept.") };
  const { bodies, diagnostics } = await collectRuleBodies(
    ROOTS,
    MODEL,
    treeFileSystem(tree, { unreadableDirectories: ["user"] }),
  );

  expect(diagnostics).toEqual([{ reason: "directory-unreadable", source: "user" }]);
  expect(bodies).toEqual(["Project kept."]);
});

test("treats missing directories as an empty set", async () => {
  const { bodies, diagnostics } = await collectRuleBodies(ROOTS, MODEL, treeFileSystem({}));

  expect(diagnostics).toEqual([]);
  expect(bodies).toEqual([]);
});

test("reports each invalid document once with its scope-relative source", async () => {
  const tree: RuleTree = {
    "user/01-blank.md": "---\nmatch:\n  - contains: example-model\n---\n",
    "user/02-wrong-key.md": document("match:\n  - nam: example-model"),
    "user/03-matchless.md": "---\ntitle: nope\n---\nbody",
    "project/01-gone.md": "---\nmatch:\n  - contains: example-model\n---\nbody",
  };
  const { bodies, diagnostics } = await collectRuleBodies(
    ROOTS,
    MODEL,
    treeFileSystem(tree, { unreadableFiles: ["project/01-gone.md"] }),
  );

  expect(diagnostics).toEqual([
    { reason: "body-blank", source: "user/01-blank.md" },
    { reason: "entry-key", source: "user/02-wrong-key.md" },
    { reason: "match-missing", source: "user/03-matchless.md" },
    { reason: "file-unreadable", source: "project/01-gone.md" },
  ]);
  expect(bodies).toEqual([]);
});

test("skips documents that do not match the turn's model", async () => {
  const tree: RuleTree = {
    "user/primary.md": document("match:\n  - model: example-model-1.0", "Primary."),
    "user/secondary.md": document("match:\n  - model: another-model-2.0", "Secondary."),
    "user/other-provider.md": document("match:\n  - exact: other-provider/example-model-1.0", "Other provider."),
  };
  const { bodies, diagnostics } = await collectRuleBodies(ROOTS, MODEL, treeFileSystem(tree));

  expect(diagnostics).toEqual([]);
  expect(bodies).toEqual(["Primary."]);
});

test("ignores top-level metadata but rejects unknown match-entry keys", () => {
  const parsed = expectDocument(
    document("title: Private metadata\nmatch:\n  - model: example-model-1.0", "Only body.\n"),
  );
  expect(parsed.body).toBe("Only body.\n");
  expect(matchesModel(parsed, MODEL)).toBe(true);
  expectReason(document("match:\n  - model: example-model-1.0\n  - unknown: example-model"), "entry-key");
});

test("uses the complete model id and keeps matching case-sensitive", () => {
  const model = { provider: "Example", id: "family/model" };
  for (const [condition, expected] of [
    ["model: family/model", true],
    ["model: model", false],
    ["exact: Example/family/model", true],
    ["exact: example/family/model", false],
    ["contains: Family", false],
    ["regex: ^Example/family/model$", true],
  ] as const)
    expect(matchesModel(expectDocument(document("match:\n  - " + condition)), model)).toBe(expected);
});

test("keeps equal bodies from separate sources and applies each OR rule once", async () => {
  const text = document("match:\n  - model: example-model-1.0\n  - contains: example-model", "Same.\n");
  const tree = { "project/same.md": text, "user/same.md": text };
  expect((await collectRuleBodies(ROOTS, MODEL, treeFileSystem(tree))).bodies).toEqual(["Same.\n", "Same.\n"]);
});
