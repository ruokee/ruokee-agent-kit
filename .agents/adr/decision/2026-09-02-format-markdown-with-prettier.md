# ADR decision: Format Markdown with Prettier

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol, Ruokee

English | [中文](./2026-09-02-format-markdown-with-prettier.zh.md)

## Motivation

Prettier provides deterministic formatting for Markdown structures such as paragraphs, headings, lists, block quotes, links, code blocks, and tables. Without one repository formatter, authors and editors can produce different layouts, while basic whitespace checks cannot enforce a common result.

Prettier normally pads table cells to align each source column. That padding makes raw Markdown harder to scan and increases the amount of text an Agent must process. The repository also needs consistent spacing between Chinese text and Latin letters or numbers.

## Decision

Use Prettier as the repository Markdown formatter.

The repository's Prettier setup must:

- produce deterministic formatting for ordinary Markdown;
- format Markdown tables compactly without padding cells to a uniform source width;
- normalize spacing between Chinese text and Latin letters or numbers;
- preserve document meaning and fenced code content;
- produce no further changes when run again on formatted input.

Provide repository commands that format all tracked Markdown files or selected Markdown files and check them without modifying them. The Git hook checks changed Markdown files.

Any intentional formatting exception must be explicit and reviewed against a concrete repository case.

## Alternatives considered

**Keep Markdown formatting manual.** This leaves layout dependent on each author and editor and gives repository checks no common expected result.

## Consequences

Tracked Markdown files have one repeatable format. Raw tables stay compact without width-based padding, and Chinese prose uses consistent spacing next to Latin letters and numbers.

Formatting can rewrite Markdown layout even when its meaning is unchanged. Keep mechanical formatting changes separate from authored content changes so reviewers can identify accidental edits.

Contributors and repository checks require Node.js and the locked development dependencies.
