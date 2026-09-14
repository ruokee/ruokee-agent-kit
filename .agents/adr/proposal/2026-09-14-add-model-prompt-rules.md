# ADR proposal: Add model-scoped prompt rules to the system prompt extension

Decision owner: Ruokee
Draft writer: deepseek/deepseek-v4.1-flash

English | [中文](./2026-09-14-add-model-prompt-rules.zh.md)

## Motivation

Models differ in how they follow instructions. A maintainer may want one model to state assumptions before editing and another to answer briefly, without editing extension source, host files, or a distribution.

OMP 18.1.16 has no model-scoped instruction mechanism. Upstream [issue #6739](https://github.com/can1357/oh-my-pi/issues/6739) requests one as model-scoped `modelInstructions`. The public `before_agent_start` event exposes the rendered `systemPrompt: string[]` and accepts a replacement array for the current turn ([event](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/extensibility/extensions/types.ts#L752-L768), [result](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/extensibility/extensions/types.ts#L1149-L1153)), and `ctx.model` supplies the current `Model`, including its provider and id ([context](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/extensibility/extensions/types.ts#L476-L480)). An OMP extension can therefore select prompt text by model without patching OMP.

`@ruokee/omp-system-prompt` already transforms that same array to replace fixed policy. A second component would add a second transformation to the same turn input, with the visible result depending on installation order ([chaining](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/extensibility/extensions/runner.ts#L1715-L1725)). One component can apply both in a fixed internal order instead.

The requested form is user-authored Markdown. A frontmatter block carries matching metadata, which is not injected, and the body carries the injected text.

## Proposal

### Component and version

Extend `projects/omp-system-prompt` instead of adding a package. Keep the package name, the native `omp.extensions` entry, the existing `renderDelivery` setting, and the peer dependency contract. The component stays self-contained under the [self-contained component decision](../decision/2026-08-24-keep-components-self-contained.md). It reads rule files from user and project directories and no file from another repository component.

Raise the version from `0.1.2` to `0.2.0`. With no rule files present, every turn behaves as before, so the change is additive for installed users. Do not add an enable setting. The presence of rule files selects the capability.

Register two `before_agent_start` handlers in this order: the existing replacement first, the rule append second. The append step reads the array the replacement produced, so it does not re-classify blocks the replacement just wrote. The steps fail independently. A replacement failure leaves the incoming host array for the append step to extend, and an append failure leaves the replacement result in effect. Both report through the component's existing bounded, session-deduplicated diagnostic channel.

### Rule documents and matching

Read two fixed directories on every turn the hook runs:

- the user directory `getAgentDir()/model-prompts`, resolved through the host-provided `getAgentDir()` from `@oh-my-pi/pi-utils`;
- the project directory `getProjectAgentDir(ctx.cwd)/model-prompts`, resolved through `getProjectAgentDir()` from the same package.

A directory contributes only its direct-child regular files with a lowercase `.md` extension. Do not recurse, follow file symlinks, or read hidden files. Order files by JavaScript string comparison of their names, so prefixes such as `10-` and `20-` control order, and do not let asynchronous reads change it. Append user-directory bodies before project-directory bodies. Do not deduplicate across directories, do not let a project file shadow a user file, and do not merge files with identical content. A missing directory is an empty set, and a read failure in one directory does not stop the other from contributing.

A rule document opens with a frontmatter block delimited by lines containing exactly `---`, optionally preceded by a UTF-8 BOM. The frontmatter holds one required key, `match`, whose value is a non-empty array. Each entry is an object with exactly one of these keys and a non-empty string value:

| Key | Matches |
| --- | --- |
| `exact` | equality with `${model.provider}/${model.id}` |
| `model` | equality with `model.id` |
| `contains` | literal substring of `${model.provider}/${model.id}` |
| `regex` | `new RegExp(value).test()` against `${model.provider}/${model.id}`, no flags |

Entries are alternatives. Any matching entry applies the file, and the append step appends a file that matches more than one entry once. Matching is case-sensitive and textual. It does not resolve aliases, roles, families, display names, wire names, or suffixes that select a thinking level, and it offers no globs or model lists. Model ids containing `/` compare as complete ids.

The append step takes the body, the text after the closing delimiter, and appends it byte-for-byte, including empty lines, CRLF, indentation, HTML comments, template-like text, and a trailing newline. It removes a leading BOM.

Unknown keys, more than one key in one entry, an empty `match` array, non-string values, invalid YAML, a missing or malformed delimiter, or an uncompilable regular expression make one file invalid. The component skips an invalid file with one diagnostic naming the file and a fixed reason code. A skipped file never partially applies, and the component never removes or replaces text from another file. The append step re-reads rule files on each turn the hook runs, so additions, edits, and deletions apply on the next turn without restarting the session.

### Injection contract

When at least one rule matches, return the incoming array unchanged followed by one block per matching file in the order above. When nothing matches, return nothing and leave the turn input untouched.

Use the system-prompt channel only. The host builds each turn's prompt from its base prompt ([base prompt](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/session/session-tools.ts#L1488-L1524)) and does not reuse a turn override as the next turn's input, so consecutive ordinary turns do not accumulate appended blocks. Acceptance criterion 6 covers that behavior.

The append step does not read `ctx.getSystemPrompt()`, modify incoming blocks, add wrapper tags or headings, or re-render host content.

### Diagnostics

Report invalid rules, unreadable directories, and errors raised outside validation through the component's existing channel: `ctx.ui.notify` in interactive sessions and the host logger otherwise, deduplicated per session and source. Diagnostics carry a fixed reason code and a locatable source such as `project/20-reasoning.md`; they must not include rule bodies, absolute paths, raw parser errors, regex sources, or conversation content.

Regular expressions run as JavaScript regular expressions with no timeout and no sandbox.

### Upstream re-check

The component documents the re-check it needs when the host provides model-scoped instructions itself, through upstream issue #6739 or an equivalent capability:

- which matching dimensions the host covers, such as exact `provider/model` keys, bare model ids, substrings, and regular expressions;
- how host text composes with a replaced or customized system prompt: replacement or append, and its position in the block order;
- when host text refreshes: per turn, per provider request, on model switch, on temporary switch, and on fallback;
- how the host discovers rules: directories, user and project precedence, and file order.

The outcome decides whether the local capability stays, covers only what the host leaves out, or is removed, with a matching version change.

### Implementation follow-up

Implementation creates a decision for this capability and appends a dated `## Changes` entry to [Add an OMP system prompt extension](../decision/2026-09-09-add-omp-system-prompt.md) recording that the component also appends model-scoped text. No current decision is reversed. The replacement contract stays as decided.

## Alternatives considered

### Distribute a separate extension and document an ordering contract

This option was considered when choosing where the capability lives. Two components transforming the same array make the visible result depend on installation order, because handlers run in extension order with no priority option, and they require the replacement to recognize or preserve text owned by another component. Merging removes both dependencies.

### Mark the appended block with a recognizable prefix

This option was considered while hardening the separate-extension design. A component-owned marker would make the replacement's block classification fail rather than misclassify. It writes component bookkeeping text into prompt content that is otherwise injected verbatim, so it was dropped together with the separate-extension design.

### Inject as the first conversation message

This option was considered when choosing the injection position. The `message` channel inserts `role: "custom"` messages into the turn's message list ([consumption](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/session/agent-session.ts#L6496-L6525)), and the session records them as `custom_message` entries ([persistence](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/session/agent-session.ts#L2806-L2820), [entry](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/session/session-manager.ts#L2488-L2499)), so every turn would add another copy of the instructions to the history. After a model switch, the history keeps instructions selected for the previous model, and the text sits below system-prompt authority. The system prompt, rebuilt for each turn, was chosen instead.

### Match by OMP role alias

This option was considered when deciding the matching dimensions. Because the host does not record the starting role, a role condition could only mean the model that role currently resolves to, which is another question. It was dropped, leaving the four keys above.

### Patch the provider request payload

This option was considered as a way to refresh on every provider request rather than once per turn. It requires per-provider payload knowledge, and no available extension point publishes a contract for provider request payloads. Per-request refresh is not needed for the requested behavior, so the option stays available for a future change rather than part of this proposal.

## Acceptance criteria

1. The repository check passes, including the component's type check and tests.
2. Component tests cover all four matching keys with positive and negative cases, alternative semantics within one file, ids containing `/`, case sensitivity, and the difference between `exact` and `model`.
3. Component tests cover rule validation: missing delimiters, pseudo delimiters, invalid YAML, unknown keys, several keys in one entry, an empty `match` array, blank bodies, an uncompilable regular expression, and BOM handling. The component skips each invalid file with one bounded diagnostic naming the file, while other files of the same turn still apply.
4. Component tests cover body fidelity for LF, CRLF, indentation, HTML comments, and trailing newlines; ordering across both directories regardless of read completion order; and missing user and project directories.
5. Component tests cover the combination with the replacement step: the replacement result is preserved and appended bodies follow it, a replacement failure still allows appending, and an append failure still leaves the replacement in effect.
6. Component tests cover repeated turns: given the host base prompt each turn, appended blocks do not accumulate, and deleting, fixing, or invalidating a rule file changes the next turn's output without reusing stale text.
7. Real OMP runs confirm final provider-facing content rather than a handler return value: each matching key produces its expected marker text in the request, frontmatter never appears, a model switch within a session re-matches against the new model, and running with only rules, only the template, and both produces the expected prompt structure. Record the OMP version, the models used, and the observed request content.
8. Real OMP runs confirm that host blocks and dynamic content survive, and that no appended text is duplicated across consecutive turns or after a mid-turn prompt rebuild.
9. Real OMP runs confirm the coverage boundary already documented for the replacement: ordinary subagent turns that rebind the parent's extensions inherit the rules, while restricted-tool and plan-mode subagents do not run the hook. Cases the available model configuration cannot trigger, such as automatic fallback, are recorded as unverified instead of inferred.
10. The component's bilingual documentation describes both rule directories, the file format, the matching keys, file order, where appended text lands relative to the replaced prompt, and the upstream re-check above.

## Risks

Rule files in the project directory turn repository content into system-prompt text. OMP performs no project-trust gating. Project settings and extensions load unconditionally for the current directory. A cloned repository that ships `.omp/model-prompts/*.md` can therefore add instructions to any session opened inside it. Documentation states the directory and the injection, and a maintainer keeps their own rules in the user directory.

Appended text could compound if a host change starts feeding a previous turn's override back as input. The append step relies on the host building each turn's prompt from its base prompt. A change there would add another copy of every matching body on each turn. Acceptance criteria 6 and 8 exercise repeated turns and mid-turn rebuilds, and the upstream re-check covers a move to a host-owned mechanism.

Rule bodies grow the system prompt of every matching turn. No size limit or budget check exists, so one large rule file adds its full text to all subsequent turns of a session and can crowd out other prompt content. Documentation states that the append step adds a body verbatim whenever its file matches.

Text matching cannot distinguish an intended match from a coincidental one. A `contains` or `regex` rule can apply to more models than its author expected, and an uncompilable regular expression drops that rule with a diagnostic that does not say which models the author meant to cover. Documentation states the matching target, case sensitivity, and the diagnostic channel; resolving a rule against the current model is left to the author.

The append step reads both rule directories on every turn the hook runs, so a slow or remote directory delays prompt assembly for each turn with no cache to amortize it. The directories are small by design, and the read is bounded to direct children; unreadable directories go to the diagnostic channel instead of blocking the turn.
