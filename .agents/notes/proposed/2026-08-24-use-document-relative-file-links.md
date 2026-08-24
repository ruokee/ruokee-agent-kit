# Agent Note: Use document-relative links for file paths

Status: proposed
Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol

English | [中文](./2026-08-24-use-document-relative-file-links.zh.md)

## Motivation

The `File paths` rules currently replace a path that returns two or more directory levels with a repository-root-relative path without a leading `/`. This form supports click-through in local editors, but GitHub resolves relative Markdown links from the directory containing the current document, so nested documents point to the wrong location. Adding a leading `/` makes the link repository-root-relative on GitHub, but local editors may treat it as an absolute filesystem path.

File references need one form that supports GitHub's branch-aware relative-link navigation and click-through in local editors.

## Proposal

Update the `File paths` section in `AGENTS.md` to require Markdown links for repository file references that readers should follow. The link destination must be relative to the Markdown document containing the reference. Use `./` for the current directory or a descendant and repeat `../` as many times as needed. Do not replace multi-level traversal with a repository-root-relative destination, and do not start the destination with `/`.

When the link text names the file, keep that text repository-root-relative so the repository location remains clear. For example, a document under `docs/zh/` links to the architect Skill as:

```markdown
[skills/architect/SKILL.md](../../skills/architect/SKILL.md)
```

The visible path identifies the file from the repository root. The document-relative destination lets the same link navigate on GitHub and in a local editor.

Update existing repository file references to follow the new rule.

## Alternatives considered

**Keep repository-root-relative destinations without a leading `/`.** GitHub resolves them beneath the directory containing a nested document, so they do not reach the intended repository file.

**Use destinations beginning with `/`.** GitHub resolves them from the repository root, but local editors may resolve them from the filesystem root.

**Use absolute GitHub URLs.** They make navigation depend on a repository URL and branch instead of the checked-out document, so local editing no longer uses the same target.

## Acceptance criteria

1. `AGENTS.md` requires document-relative Markdown destinations for navigable repository file references.
2. The `File paths` rules use `./` and the required number of `../` segments without a multi-level exception.
3. Link destinations do not begin with `/` and do not use absolute GitHub URLs for files in the same repository.
4. A nested-document example uses one link that reaches the same file through GitHub and a local editor.
5. Existing navigable repository file references are updated to follow the rule.

## Risks

Moving a Markdown document changes the base for its relative destinations. A document move must update its affected links in the same change.
