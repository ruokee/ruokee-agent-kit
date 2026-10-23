# omp-smart-context

[中文](./README.zh.md)

`@ruokee/omp-smart-context` provides independently switchable context capabilities: remote compaction alignment, Handoff alignment, compaction usage accounting, and model prompt rules. OMP retains control of session history and compaction execution.

## Documentation

- [Design](./docs/design.md) covers how a reference is confirmed, what may be reused, and when a request stays native.
- [Verification](./docs/verification.md) lists the host interfaces the package relies on and the scenarios already checked.
- [Usage](./docs/usage.md) covers request accounting, ownership, and native retirement.
- [Migration](./docs/migration.md) explains how to preserve settings when replacing the old owners.

## Install

From this component directory:

```bash
omp install . --scope user
```

## Configuration

Install this package through OMP's native plugin manager. Its manifest declares the extension and settings, so no separate extension entry or settings file is needed.

```bash
omp plugin config list @ruokee/omp-smart-context
omp plugin config set @ruokee/omp-smart-context compactionCacheProvider example-provider
omp plugin config set @ruokee/omp-smart-context compactionCacheEnabled true
omp plugin config set @ruokee/omp-smart-context handoffCacheEnabled true
omp plugin config set @ruokee/omp-smart-context modelPromptsEnabled true
```

- `compactionCacheEnabled`: default `false`, accepts a boolean. Enable remote alignment.
- `compactionCacheProvider`: default `""`, accepts a string. Exact configured Provider name. An empty value keeps alignment unavailable.
- `compactionCacheMode`: default `"hooks"`, accepts `standard` or `hooks`. Select the remote reuse contract. Enabling remote alignment takes the switch and the exact Provider name.
- `handoffCacheEnabled`: default `false`, accepts a boolean. Enable Handoff alignment. It takes this switch alone, with no Provider name and no mode.
- `compactionUsageEnabled`: default `true`, accepts a boolean. Record the four soft/Handoff request purposes when the host does not account for them itself.
- `modelPromptsEnabled`: default `false`, accepts a boolean. Append matching rule bodies. When off, register no injection handler, read no rule files, and emit no unused-file diagnostics.

OMP merges project overrides over user settings. The extension reads one native settings snapshot per activation; restart OMP after changing settings. Navigation does not refresh it. Children retain their own actual model, tools, prompt, and session identities. Missing keys take their defaults. An invalid module key disables only its owner. An unknown key, a non-object root, or a failed getter rejects the whole component configuration. Diagnostics use fixed reasons without rejected values. There is no master switch or old-package configuration fallback. Rule files still refresh each covered turn. [Design](./docs/design.md#modes) describes the two remote modes.

## Remote compaction alignment

Remote compaction resends conversation content, much of which an ordinary request already sent. This optimization rewrites a fully proved target request at the final sending boundary, so the selected Provider's compaction reuses the confirmed results of that same ordinary request and the body stays consistent with what was already sent. OMP keeps triggering, preparation, trimming, credentials, retries, fallback, speculative adoption, history commits, and continuation, and ordinary requests reach transport unchanged.

Alignment rewrites the outgoing body on the client, and client alignment, native usability, and real Provider benefit stay separate outcomes. [Design](./docs/design.md) covers the full mechanism.

## Handoff alignment

Handoff generates a document or summary as a side request that repeats common content already sent by the ordinary main-loop dispatch. This capability restores the proved ordinary system prompt at final transport, preserving the side instruction, new history, cache key, independent side session, cancellation signal, and other native options.

Handoff alignment supports `openai-completions` and `openai-responses` sessions. Native Responses Handoff and V2 compaction belong to Handoff and remote alignment respectively, with at most one rewriting capability per request. Handoff uses only its own switch, independently of the remote switch, Provider selection, or mode. Other APIs stay native.

[Design](./docs/design.md#handoff-alignment) covers the boundary conditions, the restored axes, and how the reference is invalidated.

## Compaction usage

Completed soft summary, short-summary, turn-prefix, and Handoff requests append one `model_usage` entry to their own session branch when they report tokens. Entries retain the resolved request identity, Provider tokens, stop reason, and available per-component cost. Host statistics count these entries. Other purposes and zero-token requests add none. This process-wide compensation preserves user telemetry callbacks and stops when the host exports `compactionRequestUsage`. [Usage](./docs/usage.md) describes identity resolution, missing cost, ownership, and retirement.

## Model prompt rules

Each covered turn reads `model-prompts` under the active profile's user agent directory, resolved by `getAgentDir()`, and under `getProjectAgentDir(ctx.cwd)`, that is `<cwd>/.omp/model-prompts`. Only direct, non-hidden regular files with a lowercase `.md` suffix participate. File symlinks and subdirectories are ignored; no ancestor directory or resource root is searched. A missing directory is empty.

Names sort in JavaScript string order within each directory. User bodies precede project bodies. Project files do not shadow same-named user files; identical bodies from different files still contribute separate blocks. Read completion order cannot change this order.

### Rule files

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

UTF-8 Markdown may begin with one BOM. Delimiter lines must contain exactly `---`, with LF or CRLF endings. `match` is a required, non-empty array. Each entry has exactly one of these keys and a non-blank string value:

- `exact` compares the complete `${model.provider}/${model.id}`.
- `model` compares the complete `model.id`, including any `/` in the id.
- `contains` tests a literal substring of `${model.provider}/${model.id}`.
- `regex` tests that same string with a JavaScript `RegExp` compiled without flags.

Entries are alternatives; a file matching several entries contributes once. Matching is case-sensitive and textual. It does not resolve aliases, roles, families, display names, wire names, or thinking-level suffixes, and adds no glob or model-list syntax. Extra top-level frontmatter keys are ignored and never injected. An unknown key or multiple keys inside an entry invalidates the whole file.

Each matching file contributes one block at the end of the incoming turn array. The body starts after the closing delimiter's line ending and stays byte-for-byte, including headings, blank lines, LF/CRLF, indentation, HTML comments, template-like text, and trailing newlines. Frontmatter and the opening BOM are excluded. No wrapper, heading, trimming, template render, context rewrite, message, or history entry is added. Existing blocks keep their bytes and order.

### Rule loading

Rules and the effective model are read anew at each covered turn. Additions, edits, deletions, and repairs take effect next turn without restart. Failed files do not reuse an earlier body. With no model, no rules, or no match, the incoming prompt stays unchanged. OMP's turn-scoped override survives a mid-turn rebuild; its next turn starts from the host base prompt, so bodies do not accumulate. Settings still use the activation snapshot and need a restart.

An invalid document is skipped as a whole at its first failure: `frontmatter-missing`, `frontmatter-invalid`, `match-missing`, `match-empty`, `entry-shape`, `entry-key`, `entry-value`, `regex-invalid`, or `body-blank`. `file-unreadable` affects one file and `directory-unreadable` one directory; other valid sources continue. A handler exception reports `unexpected-error` and keeps the incoming prompt, including earlier handlers' results.

Rule diagnostics carry a fixed reason and scope-relative source such as `project/20-rules.md`, deduplicated by session, source, and reason. Each turn uses its current UI notification channel, or the host logger when headless. Bodies, absolute directories, parser errors, regex source, and conversation content are not reported. New or forked sessions have separate histories; returning to a visited session retains that activation's history. Invalid switch types disable only this module; a rejected settings object follows the whole-component rejection rule. `/smart-context` shows state and reason, not model identities or rule bodies.

### Coverage

Ordinary main turns and ordinary child turns that run `before_agent_start` are covered. Each child matches its own effective model and keeps its role, independent blocks, and host protocol. Plan-mode children, Handoff, title generation, and difficulty classification gain no injection route. Side requests keep the host's treatment of the live Agent prompt. This is a turn-level contract, not independent refresh on every provider request, fallback, or temporary model switch. Later handlers can overwrite the result; the module neither reorders extensions nor claims final-provider precedence.

### Trust

When enabled, project rules become system instructions. This adds no project-trust gate or security isolation. JavaScript regular expressions have no sandbox or execution timeout. Matching bodies have no size or quota limit, so large files can consume prompt space and slow directories delay turn assembly. Keep personal rules in the user directory and inspect project rules before enabling them.

### Upstream recheck

When OMP ships model-scoped instructions, through [issue #6739](https://github.com/can1357/oh-my-pi/issues/6739) or an equivalent facility, re-check matching dimensions, replacement/append composition and block position, refresh timing, and directory discovery/precedence/order. Decide whether to retain the local capability, keep only the missing parts, or remove it, and record the corresponding version change. Host templates alone do not establish equivalent model-rule behavior.

## Status

`/smart-context` starts no model turn. It reports remote and Handoff alignment separately, followed by independent usage and model-rule states. The alignment states are:

- `disabled`: the explicit switch is off.
- `unavailable`: configuration, interface, identity, or wrapper ownership is unusable.
- `awaiting-reference`: no confirmed ordinary reference is ready for a new operation.
- `already-aligned`: the valid candidate matches the native body, so nothing is reserialized.
- `rewritten`: a complete validated candidate was delegated.
- `rejected`: proof failed, so the target was delegated unchanged.

Separate fields report online confirmation, operation binding, candidate validation, and sending. Local dispatch, operation, and reference numbers are session-local counters. Logical operations, physical sends, retries, rewrites, and refusals are counted separately with bounded counters; refusals stay in the total. Usage reports live registry state and entry, missing-cost, or unresolved-identity counts. Model rules report enabled, disabled, invalid, or incompatible state and a fixed reason. Reports omit message bodies, opaque bytes, credentials, raw endpoints, private paths, and rule bodies.

## Compatibility

The minimum maintained OMP version is `18.5.0`, with no upper maintenance bound. This is a maintenance commitment, not an installation or runtime gate. A host below the floor may still run the package. Verification records the versions and conditions actually exercised, not every version above the floor.

The package declares `@oh-my-pi/pi-agent-core`, `@oh-my-pi/pi-ai`, `@oh-my-pi/pi-coding-agent`, and `@oh-my-pi/pi-utils` as unrestricted host peers (`*`) and locks its development dependencies to `18.5.0`. Missing interfaces disable their owning capability. [Verification](./docs/verification.md) records the interfaces and scenarios checked.

## Development

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
```

## Changes

### 0.1.0

First release of `@ruokee/omp-smart-context`. Provide remote and Handoff alignment, compaction usage accounting, and optional model prompt rules. Replace smart-cache and the migrated QoL modules with one native activation snapshot and `/smart-context`. Follow [Migration](./docs/migration.md) before restarting.

## License

MIT.
