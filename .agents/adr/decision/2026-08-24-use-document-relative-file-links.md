# ADR decision: Use document-relative links for file paths

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol

English | [中文](./2026-08-24-use-document-relative-file-links.zh.md)

## Motivation

File references in nested documents needed one form that supports both GitHub's branch-aware relative-link navigation and click-through in local editors. The `File paths` rules at the time replaced a path that returned two or more directory levels with a repository-root-relative path without a leading `/`. That form works in local editors, but GitHub resolves relative Markdown links from the directory containing the current document, so nested documents point to the wrong location. Adding a leading `/` makes the link repository-root-relative on GitHub, but local editors may treat it as an absolute filesystem path.

## Decision

The `File paths` section in `AGENTS.md` requires Markdown links for repository file references that readers should follow. Each link destination is relative to the Markdown document containing the reference. Destinations in the current directory or a descendant use `./`; paths outside that tree use as many `../` segments as needed. A destination does not start with `/`, use a repository-root-relative path, or use an absolute GitHub URL for a file in this repository.

When the link text names the file, it remains repository-root-relative so the repository location stays clear. For example, an ADR under `.agents/adr/decision/` links to the architect Skill as:

```markdown
[skills/architect/SKILL.md](../../../skills/architect/SKILL.md)
```

The visible path identifies the file from the repository root. The document-relative destination lets the same link navigate on GitHub and in a local editor.

## Alternatives considered

**Keep repository-root-relative destinations without a leading `/`.** GitHub resolves them beneath the directory containing a nested document, so they do not reach the intended repository file.

**Use destinations beginning with `/`.** GitHub resolves them from the repository root, but local editors may resolve them from the filesystem root.

**Use absolute GitHub URLs.** They make navigation depend on a repository URL and branch instead of the checked-out document, so local editing no longer uses the same target.

## Consequences

Existing navigable repository file references now use document-relative destinations. GitHub resolves them against the current branch, and local editors can follow the same destinations.

Moving a Markdown document changes the base for its relative destinations. A document move must update affected links in the same change.
