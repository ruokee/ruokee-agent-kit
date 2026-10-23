# Model prompt rules

English | [中文](./model-prompts.zh.md)

## Goals

Append user-authored model-specific system instructions on each covered ordinary turn without replacing host templates, changing existing blocks, or accumulating prior-turn bodies.

## Out of scope

New match dimensions or discovery roots, aliases or model families, glob or model-list syntax, cached rules, per-request or mid-turn refresh, extra side-request injection, and guaranteed precedence over later extensions.

## Public surface

`modelPromptsEnabled` is a boolean, default `false`, using the [package activation contract](./README.md#configuration). Disabled rules register no injection handler, read no rule directory or file, and diagnose no unused files. The switch is independent of Pin, alignment, and usage. `/smart-context` reports state and a fixed reason, without bodies or model identities.

## Invariants

### Discovery

On each covered turn, read `model-prompts` in the active profile's user agent directory from `getAgentDir()` and in `getProjectAgentDir(ctx.cwd)`, which is the current project's `.omp/model-prompts`. Read only direct, non-hidden, regular files with lowercase `.md` suffix. Ignore file symlinks and subdirectories; search no ancestor or additional resource root. A missing directory is empty. No effective model means no rule read.

User-directory bodies precede project-directory bodies. Within a directory, sort filenames in JavaScript string order. Project files do not shadow same-named user files; identical bodies from different files remain separate blocks. Asynchronous completion order cannot change ordering.

### Format

Read UTF-8 Markdown with at most one opening BOM. Opening and closing frontmatter delimiter lines are exactly `---`, with LF or CRLF endings. The required `match` field is a non-empty array. Each entry contains exactly one supported key and a non-blank string:

- `exact`: compare the complete `${model.provider}/${model.id}`.
- `model`: compare the complete `model.id`, including any `/` in it.
- `contains`: literal substring of `${model.provider}/${model.id}`.
- `regex`: JavaScript `RegExp` against that same string, compiled without flags.

Entries are alternatives; several matches append the file once. Matching is case-sensitive and textual, without alias, role, family, display-name, wire-name, or thinking-suffix resolution. Ignore extra top-level frontmatter metadata and never inject it. Unknown or multiple entry keys invalidate the entire file. A blank body is invalid.

### Injection

Return a new array with every incoming block unchanged and in order, followed by one independent block per matching file. The body starts after the closing delimiter's line ending. Exclude frontmatter and the opening BOM; preserve body bytes, LF/CRLF, indentation, blank lines, headings, comments, template-like text, and trailing newlines. Add no wrapper, heading, trim, rendering, context rewrite, message, or journal entry.

Rules and the effective event model refresh on every covered turn. Additions, edits, deletions, and repairs apply next turn without restart. Failed reads do not reuse old bodies. No model, rule, or match preserves incoming blocks. The host's turn override survives an intra-turn rebuild; the next turn starts from the host base prompt, so earlier bodies do not accumulate. Setting changes still require restart.

### Coverage

Cover ordinary main turns and ordinary child turns running `before_agent_start`. Children match their own effective model and preserve role, independent blocks, and protocol. Add no route for plan-mode children, Handoff, title generation, classification, or other bypasses. Side requests retain the host's treatment of the live Agent prompt. Refresh is turn-level, not per Provider request, automatic fallback, or temporary mid-turn model change. Later handlers may overwrite the result; do not reorder extensions or claim final-provider precedence.

### Failure

Skip an invalid document at its first error: `frontmatter-missing`, `frontmatter-invalid`, `match-missing`, `match-empty`, `entry-shape`, `entry-key`, `entry-value`, `regex-invalid`, or `body-blank`. `file-unreadable` affects one file, `directory-unreadable` one directory. Other valid sources continue. An unexpected handler failure reports `unexpected-error` and preserves incoming blocks, including earlier handlers' results. Diagnostic failure must not stop the turn.

Use the current event's UI channel or the headless host logger. Diagnostics contain fixed reason and scope-relative source, deduplicated by session, source, and reason. New and forked sessions have independent histories; revisiting a session retains its activation's diagnostic history. Disclose no body, absolute path, raw parser error, regex source, or conversation. An invalid switch disables only this module; rejected root settings follow whole-component rejection.

### Trust

Enabled project rules become system instructions. Add no project-trust gate, isolation, regex sandbox or timeout, body quota, or size limit. Large rules consume prompt space, and slow directories delay turn assembly. User documentation must state these effects and the rule locations.

### Upstream replacement

When OMP ships model-scoped instructions through [issue #6739](https://github.com/can1357/oh-my-pi/issues/6739) or equivalent behavior, compare matching dimensions, replacement versus append composition, block position, refresh timing, directory discovery, precedence, and ordering. Then decide whether to retain the capability, keep missing parts, or remove it, with a corresponding version and decision update. Templates alone do not establish equivalence.

## Acceptance criteria

- Off and absent-model paths read nothing. Discovery, all four match modes, OR-once behavior, validation, BOM, and directory ordering follow the contract.
- Final assembled and serialized requests contain matching bodies once, byte-for-byte without metadata, preserving host blocks and dynamic content. Consecutive turns and prompt rebuilds do not accumulate bodies.
- File additions, edits, deletions, repairs, cwd changes, and effective-model changes take effect at the specified turn boundary.
- File and directory failures remain local, unexpected failures preserve input, diagnostics retain privacy and per-session ownership, and ordinary children use their own model without adding bypass coverage.

## Related ADRs

- [Model prompt rules](../../adr/decision/2026/09/14-model-prompt-rules.md)
- [Context package](../../adr/decision/2026/10/12-smart-cache.md)
