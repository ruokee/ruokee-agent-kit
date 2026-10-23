# Model prompt rules

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash
Reverses: [Model prompt rules](../../../archived/2026/09/14-r3-model-prompt-rules.md)

English | [中文](./14-model-prompt-rules.zh.md)

## Motivation

Maintain model prompt rules in smart-context without changing rule files or turn-level behavior.

The capability needs its own switch in the context extension, independent of QoL's master switch. Moving ownership must preserve matching, diagnostics, prompt fidelity, and existing coverage without adding injection paths.

## Analysis

A maintainer needs user-authored Markdown rules that give different models different system instructions without editing extension source, host files, or a distribution. Smart-context provides that capability independently of any component template or strategy replacement. The public `before_agent_start` event exposes the current turn's system-prompt blocks and effective model and accepts an extended array. Native handlers chain in actual extension load order without a priority setting, and installation-command order does not establish execution order.

## Decision

### Component switches

The self-contained `@ruokee/omp-smart-context` owns the rules under the [component boundary](../08/24-component-self-containment.md) and [package contract](../10/12-smart-cache.md). `modelPromptsEnabled` is an independent native boolean setting, defaulting to `false`, with no master switch. When disabled, register no injection handler, read no rule directory, and diagnose no unused rule files. Read settings once at activation; changes require restarting OMP, and navigation or a new session does not refresh the snapshot.

An invalid boolean disables this module only. Unknown settings, a non-object settings root, or a settings-reader failure reject the package configuration. `/smart-context` shows the module's effective state and inactive reason without running a model or exposing rule bodies or model identifiers.

The component declares a direct pi-utils peer; host peers stay unrestricted, and its maintenance lower bound is declared in the compatibility section of the component README, which is the authority for that bound. The component is maintained against OMP 18.5.0 under [Maintain host components against a shared OMP floor](./28-host-maintenance.md), which owns the bound for every OMP-facing component.

### Rule application

The append step reads the current profile's user agent `model-prompts` directory and the project's `.omp/model-prompts` on every covered turn. Read only direct, non-hidden, lowercase `.md` regular files. Preserve case-sensitive `exact`, `model`, `contains`, and `regex` matching, OR semantics within a file, and one append per matching file. Validate and remove frontmatter and remove a leading BOM; preserve the body byte-for-byte, including line endings.

Return a new array containing every incoming block in its original order followed by one block per matching file. Do not modify incoming blocks or wrap, trim, re-render, or rewrite host content. User-directory bodies precede project-directory bodies, filename order applies within a directory, and asynchronous reads cannot change the result. The [model prompt rules Spec](../../../../spec/omp-smart-context/model-prompts.md) owns the detailed file and matching contract.

When nothing matches, the step returns nothing and leaves the turn input untouched. The system-prompt channel is the only channel.

### Diagnostics

Invalid rules, unreadable directories, and errors raised outside validation report through the component's existing channel: `ctx.ui.notify` in interactive sessions and the host logger otherwise, deduplicated by the current event's session, source, and reason code, including a return to an earlier session or overlapping sessions. A diagnostic carries a fixed reason code and a source locatable relative to the rule scope. It never carries a rule body, an absolute path, a raw parser error, a regular expression source, or conversation content. A file failure affects one file, a directory failure affects one directory, and an unexpected processing error preserves the incoming blocks, including earlier components' results; a diagnostic failure cannot stop the model turn. Regular expressions run as JavaScript regular expressions with no timeout and no sandbox.

### Host coverage

Each turn uses its effective event model and current cwd; no model means no rule read. Refresh happens per turn, not per provider request, temporary mid-turn switch, or automatic fallback, so additions, edits, deletions, and repairs apply on the next covered turn without a restart and without a body snapshot or cache. Coverage is ordinary main sessions and ordinary child Agents that run the public `before_agent_start` hook, and each child keeps its own model, role, and independent blocks. No new injection route serves plan-mode children, Handoff, titles, classification, or other bypasses, and later handlers retain their authority to change the final input.

Rule documents in a project directory turn repository content into system-prompt text. Project rules can become system instructions, and this component adds no trust gate, security isolation, regular expression sandbox or timeout, or body size limit. Public documentation states the directory and the injection.

### Upstream recheck

The [model prompt rules Spec](../../../../spec/omp-smart-context/model-prompts.md) owns the recheck when the host provides model-scoped instructions itself, through upstream [issue #6739](https://github.com/can1357/oh-my-pi/issues/6739) or an equivalent capability:

- which matching dimensions the host covers, such as exact `provider/model` keys, bare model ids, substrings, and regular expressions;
- how host text composes with a replaced or customized system prompt: replacement or append, and its position in the block order;
- when host text refreshes: per turn, per provider request, on model switch, on temporary switch, and on fallback;
- how the host discovers rules: directories, user and project precedence, and file order.

The outcome decides whether the local capability stays, covers only what the host leaves out, or is removed, with a matching version change.

### Verification

Component checks cover the matching keys with positive and negative cases, alternative semantics within one file, rule validation and BOM handling, body fidelity for LF and CRLF, ordering across both directories regardless of read completion order, missing directories, and the non-accumulation of appended blocks across turns.

Controlled runs through actual prompt assembly and serialization record the candidate, locked host library, effective fixture models, and final requests. A handler return value alone is not Provider-facing evidence. Verify that appended bodies reach the request once without frontmatter, model changes re-match, host blocks and dynamic content survive, and consecutive turns or prompt rebuilds do not accumulate text. Real-model calls and a full CLI/TUI matrix are not integration gates. Preserve historical runs with their actual owner and conditions.

### Migration

Remove QoL's implementation, registration, setting, and status. Clear `modelPromptsEnabled` from both user and project QoL settings. Preserve the former effective `enabled && modelPromptsEnabled` result at each scope, resolving project overrides first. Keep unrelated settings and rule files unchanged. Restart after updating extension entries and settings; add no runtime fallback or automatic configuration migration.

The successor replaces QoL ownership, master-switch dependence, and mandatory real-host coverage with the controlled integration gate above. Matching, injection, diagnostics, failure isolation, coverage, trust boundaries, and native replacement rechecks remain binding. No other extension must be installed or ordered first.

## Alternatives considered

None

## Consequences

- The rules do not depend on another extension being installed, ordered first, or updated in step. Their settings and runtime dependencies remain within smart-context.
- Rule files in the project directory turn repository content into system-prompt text. OMP performs no project-trust gating, and project settings and extensions load unconditionally for the current directory, so a cloned repository that ships `.omp/model-prompts/*.md` can add instructions to any session opened inside it. A maintainer keeps their own rules in the user directory.
- Appended text could compound if a host change starts feeding a previous turn's override back as input. The append step relies on the host building each turn's prompt from its base prompt, and a change there would add another copy of every matching body on each turn.
- Rule bodies grow the system prompt of every matching turn. No size limit or budget check exists, so one large rule file adds its full text to all subsequent turns of a session and can crowd out other prompt content.
- Text matching cannot distinguish an intended match from a coincidental one. A `contains` or `regex` rule can apply to more models than its author expected, and an uncompilable regular expression drops that rule with a diagnostic that does not say which models the author meant to cover.
- The append step reads both rule directories on every turn the hook runs, so a slow or remote directory delays prompt assembly for each turn with no cache to amortize it.
- Copying the module switch without QoL's former effective master state can activate rules the user disabled. Migration therefore calculates both scopes before removing the old keys.
