# ADR proposal: Format Markdown with Prettier

Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol, Ruokee

English | [中文](./2026-09-02-format-markdown-with-prettier.zh.md)

## Motivation

Prettier already provides deterministic formatting for Markdown structures such as paragraphs, headings, lists, block quotes, links, code blocks, and tables. This repository does not currently apply it to Markdown, so authors and editors still determine those layouts while existing checks cover only basic whitespace and line endings.

Adopting Prettier establishes one base Markdown format for the repository. Its native table formatter pads cells so each source column has a uniform width. In this repository, that padding makes raw Markdown harder to scan and consumes unnecessary Agent context. The configured format must therefore keep tables compact without width-based padding and must also normalize spacing between Chinese text and Latin letters or numbers.

## Proposal

Adopt Prettier as the repository Markdown formatter.

The repository's Prettier setup must:

- produce deterministic formatting for ordinary Markdown;
- format Markdown tables compactly without padding cells to a uniform source width;
- normalize spacing between Chinese text and Latin letters or numbers;
- preserve document meaning and fenced code content;
- produce no further changes when run again on formatted input.

Provide repository-supported ways to apply the format and to detect tracked Markdown files that do not match it. Document how contributors format all tracked Markdown files and selected files.

Format existing tracked Markdown files during implementation. Keep the cleanup mechanical and separate it from authored content changes. Any intentional formatting exception must be explicit and reviewed against a concrete repository case.

The implementation creates one bilingual decision, `2026-09-02-format-markdown-with-prettier`, and removes this proposal pair.

## Alternatives considered

**Keep Markdown formatting manual.** This leaves layout dependent on each author and editor and gives repository checks no common expected result.

## Acceptance criteria

- `proposal/` contains this complete English and Chinese pair with reciprocal language links and aligned meaning.
- The proposal change modifies only this pair in Git and does not add formatter configuration or generated formatting changes.
- The repository has a documented way to format all tracked Markdown files and selected Markdown files with Prettier.
- Formatting produces compact Markdown tables without uniform-width padding and consistent spacing between Chinese text and Latin letters or numbers.
- Formatting preserves document meaning and fenced code content.
- A repeated formatting run produces no changes.
- Repository checks detect tracked Markdown files that do not match the configured format.
- The historical cleanup contains only formatter output and explicit, reviewed exceptions.
- The completed implementation creates one bilingual decision, removes this proposal pair, and leaves all repository checks passing.

## Risks

Prettier may rewrite Markdown layouts in ways that obscure an unintended content change. Review representative output before applying the formatter to all tracked files, then keep the generated cleanup separate from authored edits.

A repository-wide cleanup will produce a large diff. Review becomes unreliable if unrelated content changes are mixed into it.

The formatter adds a runtime and dependency installation requirement to contributor setup. Development documentation must state the required setup and failure recovery steps.
