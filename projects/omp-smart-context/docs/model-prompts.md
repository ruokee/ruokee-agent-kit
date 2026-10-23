# Model prompt rules

[中文](./model-prompts.zh.md)

Append system instructions for specified models. Covered ordinary main and child turns match their own current model; rule-file edits apply on the next covered turn.

## Enable

Set `modelPromptsEnabled=true` through [native configuration](../README.md#configuration), then restart OMP. It defaults to `false`. When off, no rule directory or file is read and no unused-file error is reported.

## Directories

Create rules in either location:

- `model-prompts` under the active profile's user agent directory. The default unprofiled location is `~/.omp/agent/model-prompts`; a different profile or agent-directory override uses its own directory.
- `<cwd>/.omp/model-prompts` for the current project.

Only direct, non-hidden regular files with a lowercase `.md` suffix are read. File symlinks, subdirectories, ancestor directories, and other resource directories are ignored. A missing directory is empty.

User rules come first, then project rules. Within each directory, filenames sort in JavaScript string order, so numeric prefixes such as `10-base.md` and `20-detail.md` can make ordering explicit. A project file does not replace a same-named user file. Each matching file contributes separately, even if its body matches another file's body.

## File format

```markdown
---
metadata: optional, ignored
match:
  - exact: example-provider/example-model-1.0
  - model: another-model-1.0
  - contains: example-model
  - regex: ^example-provider/example-model-1\.0
---

Text appended to the system prompt.
```

Use UTF-8 Markdown. One opening BOM is allowed. The metadata delimiters must be lines containing exactly `---`, with LF or CRLF line endings. `match` must be a non-empty array; each entry has exactly one supported key and a non-blank string:

- `exact`: complete `provider/model` match.
- `model`: complete model id, including any `/` within it.
- `contains`: literal substring of `provider/model`.
- `regex`: JavaScript regular expression against `provider/model`, without flags.

Conditions are alternatives. A file matching several conditions is appended once. Matches are case-sensitive and textual; aliases, roles, families, display names, wire names, thinking suffixes, globs, and model-list syntax are not resolved. Extra top-level metadata is ignored. An unknown or multi-key condition invalidates the whole file.

The body must not be blank. Text after the closing delimiter's line ending is appended exactly, including whitespace, line endings, comments, and trailing newlines. The metadata and opening BOM are excluded. The extension adds no heading or wrapper and does not render template-like text. Existing instructions keep their order and text.

## Apply edits

Add, edit, delete, or repair a file to change the next covered ordinary turn without restarting. A failed file does not reuse an earlier body. Without a current model or matching file, instructions stay unchanged. Rules do not accumulate across consecutive turns.

Each ordinary child matches its own model and keeps its role. Plan-mode children, Handoff, title generation, and classification receive no new injection route. Rules do not refresh on each Provider request, temporary mid-turn model switch, or automatic fallback. A later extension may overwrite appended instructions; installation order is not a precedence guarantee.

## Errors

Invalid files are skipped as a whole. Errors identify a fixed reason and relative source such as `project/20-rules.md`. One unreadable file affects that file; an unreadable directory affects that directory. Other valid rules continue. Unexpected processing errors preserve incoming instructions, including earlier extensions' additions.

Reasons include `frontmatter-missing`, `frontmatter-invalid`, `match-missing`, `match-empty`, `entry-shape`, `entry-key`, `entry-value`, `regex-invalid`, `body-blank`, `file-unreadable`, `directory-unreadable`, and `unexpected-error`. Repeated identical diagnostics are suppressed within the session. Interactive sessions show notifications; headless sessions use the host log. Bodies, absolute paths, raw parser errors, and regex text are not printed.

Use `/smart-context` to check whether the capability is enabled. Setting changes require restart even though rule-file edits do not.

## Trust

Enabled project rules become system instructions. No project-trust gate or security isolation is added. JavaScript regular expressions have no sandbox or execution timeout. Bodies have no size limit; large rules consume prompt space, and slow directories delay turn preparation. Keep personal rules in the user directory and inspect project rules before enabling them.
