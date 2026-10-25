# Relative file links

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol
Reverses: [Relative file links](../../../archived/2026/08/24-r1-relative-links.md)

English | [中文](./24-relative-links.zh.md)

## Motivation

Use document-relative file links, except in templates copied into GitHub Issue or PR bodies.

Relative links support GitHub's branch-aware navigation and click-through in local editors. A template copied into an Issue or PR body loses its source directory as a link base. Its file links need a destination independent of the page displaying the body. The predecessor's blanket prohibition on absolute GitHub file URLs prevented that use.

## Decision

Use Markdown links for repository file references that readers should follow, under the repository [file links rules](../../../../rule/documentation.md#file-links).

In templates whose contents are copied into GitHub Issue or PR bodies, use full GitHub URLs to files on the repository's default branch. This exception applies only to file links within those template bodies, including their language navigation.

For all other repository file links, write the destination relative to the Markdown document containing it. Destinations in the current directory or a descendant use `./`; paths outside that tree use as many `../` segments as needed. Do not use a leading `/`, a repository-root-relative destination, or an absolute GitHub URL for a file in this repository.

When the link text names the file, write it from the repository root without a leading `/`. For example, an ADR under `.agents/adr/decision/YYYY/MM/` links to the architect Skill as:

```markdown
[skills/architect/SKILL.md](../../../../../skills/architect/SKILL.md)
```

The visible path identifies the file from the repository root. The document-relative destination lets the same link navigate on GitHub and in a local editor.

## Alternatives considered

**Keep relative links in body templates.** The copied body no longer has the template's directory as its base, so these links can resolve to an Issue or PR route instead of the repository file.

**Use a single bilingual body.** This avoids cross-file language navigation but lengthens every default body and replaces the separate complete language versions.

**Use absolute GitHub URLs throughout the repository.** This removes branch-aware and local-file navigation from ordinary documents without solving an additional requirement.

**Use repository-root-relative destinations.** Destinations without a leading `/` resolve beneath a nested document's directory on GitHub. A leading `/` can instead resolve from the filesystem root in a local editor.

## Consequences

Ordinary documents retain branch-aware GitHub links and local-file navigation. Moving a Markdown document changes the base for its relative destinations; update affected links in the same change.

Body templates link to the published default-branch files regardless of the page displaying the body. Those links do not follow a local checkout or fork, and new target files must be published before the links can open them.
