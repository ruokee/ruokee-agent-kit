# ADR decision: Provide opt-in model prompt rules through QoL

Decision owner: Ruokee
Decision writer: OMP
Reverses: [Add model-scoped prompt rules to the system prompt extension](../archived/2026-09-14-add-model-prompt-rules.md)

English | [中文](./2026-10-07-use-qol-model-prompts.zh.md)

## Motivation

A maintainer needs user-authored Markdown rules that give different models different system instructions without editing extension source, host files, or a distribution. QoL should enable that capability independently of a component template or system-prompt strategy replacement. OMP's reduced prompt text and native templates reduce the maintainer's need for additional strategy replacement; they do not withdraw the model-rule requirement.

## Analysis

The public `before_agent_start` event exposes the current turn's system-prompt blocks and effective model and accepts an extended array. The previously checked upstream request is [issue #6739](https://github.com/can1357/oh-my-pi/issues/6739). That historical check does not establish that every current host lacks an equivalent capability; the upstream re-check below remains required. Native handlers chain in actual extension load order without a priority setting. Installation-command order does not establish execution order.

## Decision

### Component, switches, and coexistence

The self-contained `@ruokee/omp-qol` owns the rules under [Keep components self-contained](./2026-08-24-keep-components-self-contained.md) and [Maintain the extension that improves the OMP experience](./2026-10-10-maintain-omp-experience-extension.md). `modelPromptsEnabled` is a native boolean setting, defaults to `false`, and is subordinate to `enabled`. Both switches must be on for the rule handler, rule directory access, and unused-file diagnostics. Settings are read once at activation; changes require restarting OMP, and navigation or a new session does not refresh the snapshot.

An invalid boolean disables this module only. Unknown settings, a non-object settings root, or a settings read failure reject all modules under the existing QoL contract. `/qol` shows the module's effective state, boolean, and inactive reason without running a model or exposing rule bodies or model identifiers.

The same change removes all rule entry points, reads, diagnostics, tests, and unused runtime dependencies from system-prompt, with no forwarding, alias, or shim. That component continues to maintain its template, Delivery, and footer. QoL declares a direct pi-utils peer; host peers stay unrestricted and the maintenance floor remains OMP 18.5.0. Both components increment their patch versions.

QoL works without system-prompt. Coexistence requires system-prompt before QoL in actual load order, with neither component depending on the other's files. Template failure preserves incoming blocks for rule append; rule failure preserves the template result. Later handlers retain authority to change the final input, with no cross-extension scheduler or guarantee. Users update both components together, then enable the new switch and restart. There is no mixed-old-version double-entry compatibility.

### Rule documents and matching

Read two fixed directories on every turn the hook runs:

- the user directory `getAgentDir()/model-prompts`, resolved through the host-provided `getAgentDir()` from `@oh-my-pi/pi-utils`;
- the project directory `getProjectAgentDir(ctx.cwd)/model-prompts`, resolved through `getProjectAgentDir()` from the same package.

A directory contributes only its direct-child regular files with a lowercase `.md` extension. The loader does not recurse, follow file symlinks, or read hidden files. Files are ordered by JavaScript string comparison of their names, so prefixes such as `10-` and `20-` control order, and asynchronous reads cannot change it. User-directory bodies precede project-directory bodies. Bodies are not deduplicated across directories, a project file does not shadow a user file, and files with identical content are not merged. A missing directory is an empty set, and a read failure in one directory does not stop the other from contributing.

A rule document opens with a frontmatter block delimited by lines containing exactly `---`, optionally preceded by a UTF-8 BOM. LF and CRLF delimiter line endings are accepted. The required frontmatter key `match` is a non-empty array; other top-level metadata is ignored. Each entry is an object with exactly one of these keys and a non-empty, non-whitespace string value:

| Key | Matches |
| --- | --- |
| `exact` | equality with `${model.provider}/${model.id}` |
| `model` | equality with `model.id` |
| `contains` | literal substring of `${model.provider}/${model.id}` |
| `regex` | `new RegExp(value).test()` against `${model.provider}/${model.id}`, no flags |

Entries are alternatives. Any matching entry applies the file, and the append step appends a file that matches more than one entry once. Matching is case-sensitive and textual. It does not resolve aliases, roles, families, display names, wire names, or suffixes that select a thinking level, and it offers no globs or model lists. Model ids containing `/` compare as complete ids.

The append step takes the body, the text after the closing delimiter line ending, and appends it byte-for-byte, including empty lines, CRLF, indentation, HTML comments, template-like text, and a trailing newline. It removes a leading BOM.

Unknown entry keys, more than one key in one entry, a missing or wrongly typed `match`, an empty `match` array, non-object entries, blank or non-string values, invalid YAML, a missing or malformed delimiter, an uncompilable regular expression, or a whitespace-only body make one file invalid. The component skips the whole file with one diagnostic naming the file and the first failed validation's fixed reason code. A skipped file never partially applies, and the component never removes or replaces text from another file. The append step re-reads rule files on each turn the hook runs, so additions, edits, and deletions apply on the next turn without restarting the session.

### Injection contract

When at least one rule matches, the append step returns a new array containing every incoming block in its original order followed by one block per matching file in the order above. It does not modify the incoming array. When nothing matches, it returns nothing and leaves the turn input untouched.

The system-prompt channel is the only channel. The host builds each turn's prompt from its base prompt ([base prompt](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/session/session-tools.ts#L1488-L1524)) and does not reuse a turn override as the next turn's input, so consecutive ordinary turns do not accumulate appended blocks.

The append step does not read `ctx.getSystemPrompt()`, modify incoming blocks, add wrapper tags or headings, or re-render host content.

### Diagnostics

Invalid rules, unreadable directories, and errors raised outside validation report through the component's existing channel: `ctx.ui.notify` in interactive sessions and the host logger otherwise, deduplicated by the current event's session, source, and reason code, including a return to an earlier session or overlapping sessions. Diagnostics carry a fixed reason code and a locatable source such as `project/20-reasoning.md`. They do not include rule bodies, absolute paths, raw parser errors, regex sources, or conversation content.

Regular expressions run as JavaScript regular expressions with no timeout and no sandbox.

Each turn uses its effective event model and current cwd; no model means no rule read. Model switches, file additions, edits, deletions, and repairs re-match on the next covered turn without a body snapshot or cache. Coverage is ordinary main sessions and ordinary child Agents that run the hook, preserving each child's own model, role, and independent blocks. No new injection route serves plan-mode, Handoff, titles, classification, or other bypasses. Refresh is per turn, not per Provider request, temporary mid-turn switch, or automatic fallback. Unexpected processing errors preserve the input, and diagnostic failure cannot stop the model turn.

### Upstream re-check

The component documents the re-check it needs when the host provides model-scoped instructions itself, through upstream issue #6739 or an equivalent capability:

- which matching dimensions the host covers, such as exact `provider/model` keys, bare model ids, substrings, and regular expressions;
- how host text composes with a replaced or customized system prompt: replacement or append, and its position in the block order;
- when host text refreshes: per turn, per provider request, on model switch, on temporary switch, and on fallback;
- how the host discovers rules: directories, user and project precedence, and file order.

The outcome decides whether the local capability stays, covers only what the host leaves out, or is removed, with a matching version change.

### Verification

Component checks cover the four matching keys with positive and negative cases, alternative semantics within one file, ids containing `/`, case sensitivity, the difference between `exact` and `model`, rule validation and BOM handling, body fidelity for LF, CRLF, indentation, HTML comments, and trailing newlines, ordering across both directories regardless of read completion order, missing directories, the combination with the replacement step in both failure directions, and the non-accumulation of appended blocks across turns.

Real-host checks record the exercised OMP release, the models, and the observed provider-facing request. A handler return value is not provider evidence. They confirm that appended text reaches the request, that frontmatter never does, that a model switch re-matches against the new model, that host blocks and dynamic content survive, that no appended text is duplicated across consecutive turns or after a mid-turn prompt rebuild, and that ordinary subagent turns inherit the rules while the plan-mode restricted subagent exercised at that time did not run the hook; the restricted-tool child observed later on OMP 18.4.3 is recorded under Changes. Cases the available model configuration cannot trigger, such as automatic fallback, are recorded as unverified instead of inferred.

## Alternatives considered

### Inject as the first conversation message

This option was considered when choosing the injection position. The `message` channel inserts `role: "custom"` messages into the turn's message list ([consumption](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/session/agent-session.ts#L6496-L6525)), and the session records them as `custom_message` entries ([persistence](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/session/agent-session.ts#L2806-L2820), [entry](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/session/session-manager.ts#L2488-L2499)), so every turn would add another copy of the instructions to the history. After a model switch, the history keeps instructions selected for the previous model, and the text sits below system-prompt authority. The system prompt, rebuilt for each turn, was chosen instead.

### Match by OMP role alias

This option was considered when deciding the matching dimensions. Because the host does not record the starting role, a role condition could only mean the model that role currently resolves to, which is another question. It was dropped, leaving the four keys above.

### Patch the provider request payload

This option was considered as a way to refresh on every provider request rather than once per turn. It requires per-provider payload knowledge, and no available extension point publishes a contract for provider request payloads. Per-request refresh is not needed for the requested behavior, so the option stays available for a future change rather than part of this decision.

## Consequences

Rule files in the project directory turn repository content into system-prompt text. OMP performs no project-trust gating, and project settings and extensions load unconditionally for the current directory. A cloned repository that ships `.omp/model-prompts/*.md` can therefore add instructions to any session opened inside it. Public documentation states the directory and the injection, and a maintainer keeps their own rules in the user directory.

Appended text could compound if a host change starts feeding a previous turn's override back as input. The append step relies on the host building each turn's prompt from its base prompt; a change there would add another copy of every matching body on each turn. The verification above exercises repeated turns and mid-turn rebuilds, and the upstream re-check covers a move to a host-owned mechanism.

Rule bodies grow the system prompt of every matching turn. No size limit or budget check exists, so one large rule file adds its full text to all subsequent turns of a session and can crowd out other prompt content. Public documentation states that the append step adds a body verbatim whenever its file matches.

Text matching cannot distinguish an intended match from a coincidental one. A `contains` or `regex` rule can apply to more models than its author expected, and an uncompilable regular expression drops that rule with a diagnostic that does not say which models the author meant to cover. Public documentation states the matching target, case sensitivity, and the diagnostic channel; resolving a rule against the current model is left to the author.

The append step reads both rule directories on every turn the hook runs, so a slow or remote directory delays prompt assembly for each turn with no cache to amortize it. The directories are small by design, and the read is bounded to direct children; unreadable directories go to the diagnostic channel instead of blocking the turn.

## Changes

### 2026-09-28: Maintenance declaration inherited with the host contract

The component keeps the host contract it inherits from [Render the system prompt strategy from a host template](../archived/2026-09-30-render-system-prompt-from-host-template.md): the README compatibility section declares the maintenance lower bound under [Adapt first-party host components to host upgrades](../archived/2026-09-28-adapt-components-to-host-upgrades.md), while the host peer stays unrestricted. Appending matching rule documents, the settings the component reads, and the check of the native capability it depends on stay unchanged.

### 2026-09-30: A restricted-tool child on OMP 18.4.3 runs both handlers

On OMP 18.4.3, the `scout` agent spawned through the `task` tool carries a restricted tool set and sends a provider request that contains both the replacement result and the matching model-rule body, so the replacement handler and the rule append handler both run for that child. The verification entry above therefore describes the environment exercised when it was written, a plan-mode restricted subagent, rather than restricted subagents in general. Whether an OMP 18.4.3 plan-mode child runs the handlers stays unverified, and the two subagent classes keep separate statements in this decision. Evidence: the OMP 18.4.3 host checks recorded in the [component README](../../../projects/omp-system-prompt/README.md) verification scope.

### 2026-10-04: Host contract from the template-only successor

The component inherits its host contract from [Render the system prompt strategy only from the component template](../archived/2026-10-04-use-system-prompt-template-only.md), and its maintenance lower bound is OMP 18.5.0 under [Maintain host components against a shared OMP floor](./2026-10-04-raise-omp-host-floor.md). The append step still runs after the replacement step. A turn without the component template is a no-op for the replacement step rather than a failure, and the append step still extends the host's system prompt array on that turn.
