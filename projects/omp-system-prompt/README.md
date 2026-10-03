# omp-system-prompt

[中文](./README.zh.md)

This OMP extension replaces the fixed policy text in OMP's default system prompt with maintained English text, and appends user-authored rule documents for the model in use. It preserves recognized host-rendered runtime sections in their semantic positions. Two host prompt paths are supported: replacement of the recognized default block, and the OMP 18.4.3 host path where the host renders a component-owned template. OMP re-renders the system prompt each turn and hands the block array to `before_agent_start`; the extension transforms that input, never a startup snapshot.

## How it works

OMP assembles the system prompt from blocks: a default main block, optional Computer Safety and active-repo blocks, and a PROJECT footer. On each turn the extension receives the current block array through the `before_agent_start` event and:

- Recognizes exactly one default main block by its conventions preamble and `§ Role` identity line, plus exactly one structurally valid PROJECT footer. Two preambles are accepted: the `<conventions>` wrapper with `Helpful, trusted assistant for load-bearing changes in Oh My Pi coding harness.`, and the unwrapped form with `You are a helpful, trusted assistant working in Oh My Pi coding harness.` Both are matched as text, not against a host version, and any other preamble falls back. Any other block passes through byte-for-byte in its original position.
- Rebuilds the main block from the extension's owned template. Seven slots receive the host-rendered tool catalog, dynamic `xd://` device documentation, Internal URLs, Skills, always-apply rules, domain rules, and runtime-mode protocols. The owned template puts the tool catalog under `### Tool inventory` and the device catalog under `### Mounted devices`.
- Places Computer Use, Scratchpad, dynamic Tool I/O lines, Specialized Tools with automated QA, and AST in the runtime-modes slot. Before removing the host's fixed Tool Policy, Exploration, Workflow, Delivery, and Critical policy text, it validates the required and conditional lines in their rendered order against the recognized prompt structure. The owned final `# Delivery` chapter is included or omitted according to `renderDelivery`.
- Normalizes the retained OMP runtime chapters `# Computer Use`, `§ Scratchpad`, `# Tool I/O`, `# Specialized Tools`, and `# AST` to exactly two LF characters between each heading and its body. If OMP emits blank lines between adjacent `Specialized Tools` list items, the extension removes every such gap in that section; it does not compress whitespace globally or rewrite static owned text, code blocks, or arbitrary host content. The owned main block has no trailing LF, so OMP's `systemPrompt.join("\n\n")` leaves exactly two LFs before `# Project snapshot`.
- Validates the host Internal URLs section, including the conditional presence or absence of the `skill://` entry, discards its fixed `Most FS/bash tools auto-resolve these to FS paths.` introduction, and retains only the URI entries.
- Validates the whole host Delegation section, then drops it. The owned `# Agent coordination` section supplies the coordination policy described below; the rendered concurrency cap and the extra `hub` communication hint are not carried into any owned slot. Host concurrency enforcement is unaffected.
- Normalizes Skill catalog descriptions to one line when complete Skill command metadata corresponds to the catalog. See below.
- Rewrites only the PROJECT wrapper: its outer heading becomes `# Project snapshot`, its loading guidance is replaced, and the exact fixed `<critical>` tail is removed at its structural position. Context-file bodies, listed paths, workspace data, extra roots, and appended prompt bytes stay verbatim.

## Host template route

OMP 18.4.3 lets the user supply the system prompt template itself, so the host renders the owned structure before this extension sees the turn. The component ships that template as `host-template.hbs`, generated from the same owned source by `bun run build:template`. The artifact is not a runtime input: the extension keeps reading `src/prompt-template.md` and derives its recognition anchors from that source on activation.

Selection happens through the host's own mechanism, one of:

- `omp --system-prompt-template <path to host-template.hbs>` for a single run.
- A `SYSTEM_TEMPLATE.md` file the host discovers, such as `<project>/.omp/SYSTEM_TEMPLATE.md` or the equivalent file in the user agent directory.

Both are user decisions. The component does not write that file, change the installed host, or select the template by itself; without either input the turn follows the default-block route above.

When one block is a render of the shipped template, the extension handles the turn per step instead of replacing the whole prompt:

- The template block stays byte-for-byte in its position. Its tool, device, `xd://` URI, Skill, rule, and runtime-mode slots already carry the host's dynamic data, including the mounted-device documentation. The extension does not normalize whitespace inside it; the bindings keep the section boundaries.
- The owned `# Delivery` chapter becomes its own block directly after the template block, and stays out when `renderDelivery` is false. A foreign block that starts with `# Delivery` at that position belongs to another writer: the extension keeps it and reports `delivery-block-conflict` instead of inserting its own chapter.
- The footer is corrected in place. The host's loading guidance and auto-loaded line become the owned text. At the validated outer `<project-context>` boundary, the exact fixed main-agent tail or the OMP 18.5.0 subagent tail is removed together with its preceding blank line, using the matched text's length. Unknown tails stay intact. Context-file bodies, listed paths, workspace data, extra roots, the `<active-repo-context>` block, and appended prompt bytes stay verbatim, including copies of known `<critical>` tails inside bodies or append text.
- Repeated conversion recognizes the owned loading line or a neutral `<!-- omp-system-prompt:project-context -->` comment at its validated outer position and leaves the append untouched, even when it begins with a complete known critical tail. The comment is added only when all three conditions hold: the footer has no loading guidance, this conversion removes an exactly recognized native tail, and the append starts with a complete known critical block. It sits after `</workstation>`, outside every opaque field and the append. Only the comment and its separator may change prior complete output; ordinary appends and footers with loading guidance keep their prior output. Recognition works with either Delivery value and across changes, without a process-local cache or new setting. It is not proof of authorship or a security boundary.
- An absent footer needs no work and reports nothing. A footer whose boundary is not unique reports `project-footer-ambiguous`, and one whose loading instructions are unknown reports `project-footer-not-recognized`; either way the footer keeps its input and the remaining steps still apply.

Recognition uses the owned source's own static text as anchors: each anchor is edge-trimmed, the anchors keep their order, the first sits at the block start, and the last at the block end. Dynamic slot bodies are not part of that basis, so a third-party template that reproduces the whole static skeleton and changes only slot bodies is claimed as well. A render of a different template, a truncated or corrupt render, and a third-party block that merely opens with the owned identity line stay unclaimed and fall back to the default-block route. On a host that renders its bundled template, no block matches, the default-block route finds no default main block either, and the turn keeps the host prompt with the usual replacement failure diagnostic.

When both routes could answer, the default-block route goes first as long as it can still rebuild the input and the input does not already carry the owned Delivery chapter as its own block, so the older route keeps the chapter inside the block it rebuilds. The template route answers the rest: input that already carries the chapter as its own block, and input no default-block rebuild can reproduce. A `renderDelivery` change between turns then adds or removes the chapter on whichever route holds the input, and repeating a turn changes nothing.

This route also covers the hybrid case of the component template running on a host that still renders the older `PROJECT` footer: the footer is rewritten by the same parser the default-block route uses, retaining its original main-agent-tail contract. The new subagent tail is recognized only in `<project-context>` footers. A later `renderDelivery` change still adds or removes the chapter, whether the default-block route rebuilt the block or this route inserted the chapter as its own block.

## Agent coordination

The owned coordination policy stays active with either `renderDelivery` value. It instructs the parent to continue independent authorized work after dispatch, wait when no such work remains and children are unfinished, and collect and assess every child's outcome before normal final delivery. A wait may return for one result, a message, a timeout, or an interruption, so the parent must recheck outstanding tasks. Results already delivered need no extra wait; failures, cancellation, and blockers must be reported honestly, and healthy work must not be cancelled merely to finish sooner.

Task completion does not require an idle or parked agent to exit. Messages that only acknowledge completion, idle status, or closure need no reply; substantive questions, corrections, and new work still do. These are model instructions. The extension does not add a runtime barrier or change host job and messaging behavior.

## Delivery setting

The package declares `omp.settings.renderDelivery` as a boolean with a default of `true`.

- `true` or an unset value renders the complete final `# Delivery` chapter.
- `false` omits that exact chapter, including `Task scope`, `Completion`, `Evidence`, and `Pausing`.
- The effective value is read on every `before_agent_start` turn through the public `getPluginSettings(PACKAGE_NAME, ctx.cwd)` API. User-level values can be set with `omp plugin config set @ruokee/omp-system-prompt renderDelivery false`; a project-level `.omp/plugin-overrides.json` value under `settings.@ruokee/omp-system-prompt.renderDelivery` overrides the user value.
- A settings read failure or non-boolean value keeps Delivery enabled, reports one bounded session diagnostic for that reason, and lets the request continue.
- When the setting changes between turns, the extension recognizes either owned shape, reuses the captured dynamic slots, Skill fallback catalog, PROJECT block, and independent blocks, and changes only the Delivery chapter.
- On the host template route the chapter is inserted as its own block after the template render, or left out entirely; a foreign `# Delivery` block at that position stays and reports `delivery-block-conflict`.

## Skill description normalization

The host renders each Skill as `- <name>: <description>` and inserts the description text without encoding field boundaries. One Skill whose description is `First\n- beta: Second` renders exactly like two Skills `alpha: First` and `beta: Second`, so list syntax alone cannot recover entry boundaries.

When the event contains a nonempty Skill catalog, the extension reads the current public `pi.getCommands()` entries with `source: "skill"` as ordered candidates. It uses only their names, order, and descriptions. A candidate may be absent from the event catalog, including a hidden Skill. The event catalog remains authoritative for the visible set. The extension never reads command paths, rescans resources, or adds candidates to the output.

Correspondence succeeds only when the complete visible catalog maps to one unique ordered candidate subsequence. Every visible name and order position must match, and every rendered description span must match the candidate description after whitespace normalization. Metadata establishes boundaries only; it never restores text that differs from the host-rendered event. On success, only the visible description spans are normalized to one ASCII space with trimmed edges, covering LF, CRLF, tabs, blank paragraphs, and Unicode line separators. Hidden unused candidates stay out of the output.

If no unique correspondence exists, the extension keeps the complete isolated `<skills>` block byte-for-byte and continues the rest of the prompt transformation:

- Skill commands are disabled, so no Skill command metadata is available.
- A candidate is missing, out of order, or extra metadata cannot map to the visible catalog.
- A description does not match the event text, or an earlier extension rewrote the catalog.
- Entry spans are ambiguous, names are malformed, or the rendered formatting is unsupported.

A missing or supported empty Skill catalog needs no metadata and stays absent or empty. The extension never adds Skills from the command list. If the Skill outer boundary cannot be isolated, the failure remains structural and the whole input is preserved. A local Skill fallback reports `Skill catalog formatting skipped`; it does not claim that the system prompt replacement failed.

## Model prompt rules

The same extension appends user-authored prompt text for the model in use. Each covered turn reads `model-prompts` under the user agent directory (`getAgentDir()`, the active profile's agent directory) and under the project agent directory (`getProjectAgentDir(cwd)`, that is `<cwd>/.omp`). Only direct children count: a missing directory is empty, subdirectories are ignored, and no ancestor directory or resource root is searched. Rule files are direct regular files whose name ends in a lowercase `.md` and does not start with a dot, ordered by name in JavaScript string order, with the user directory first.

A rule document is Markdown with a `---` frontmatter block:

```markdown
---
match:
  - exact: pro-20x/gpt-5.6-luna
  - model: gpt-5.6-sol
  - contains: gpt-5.6
  - regex: ^pro-20x/gpt-5\.6
---

Text appended to the system prompt.
```

`match` is required and non-empty. Each entry carries exactly one key, and entries are alternatives:

- `exact` compares the whole `provider/id` string.
- `model` compares the bare model id.
- `contains` tests a substring of `provider/id`.
- `regex` tests the whole `provider/id` against a JavaScript regular expression compiled without flags.

Matching is case-sensitive and textual. The keys take the model id literally, so a role alias, an alternate or routed id, and a thinking-level suffix match only when the id already contains that text; no alias, family, glob, or `name` key exists. Other frontmatter keys are ignored and never injected. The body after the closing delimiter is what gets appended, byte-for-byte, including its own headings, blank lines, and CRLF endings.

Each matching file contributes one block, appended after the prompt the turn already has: after this extension's replaced prompt when the replacement applied, and after the incoming host prompt when it did not. The host stores the combined array as that turn's system prompt, so the rules survive a mid-turn rebuild and the next turn starts from the host's base prompt without accumulation. Files are read again on every turn, so an edit takes effect on the next turn.

An invalid document is skipped without affecting the others, and the first failure wins. A missing or malformed delimiter pair (`frontmatter-missing`), unparsable YAML (`frontmatter-invalid`), a missing or mistyped `match` (`match-missing`), an empty array (`match-empty`), an entry that is not a single-key object (`entry-shape`), an unknown key (`entry-key`), a non-string or blank value (`entry-value`), an uncompilable pattern (`regex-invalid`), and a blank body (`body-blank`) each skip that one file. A file read failure reports `file-unreadable`; an unreadable directory reports `directory-unreadable` and skips only that directory. Each skip reports one bounded diagnostic per session naming the affected source as `<scope>/<file name>`, without rule text or the resolved directory. A turn with no matching document, and a turn without a current model, appends nothing.

### Upstream re-check

Upstream [issue #6739](https://github.com/can1357/oh-my-pi/issues/6739) proposes host-level model-scoped instructions (`modelInstructions`). When the host ships that mechanism, or an equivalent model-to-prompt capability, re-check this component before changing it:

- the matching dimensions the host covers, such as exact `provider/model` keys, bare model ids, substring matching, and regular expressions;
- how host-provided text composes with a replaced or customized system prompt: replacement or append, and where the text lands in the block order;
- refresh timing: per agent turn, per provider request, on model switch, on temporary switch, and on fallback;
- rule discovery conventions: directories, user and project precedence, and file order.

Then decide whether model-scoped prompt text still belongs in this component, should keep only the parts the host leaves out, or should be dropped, and record the outcome alongside the matching version change.

## Fallback behavior

Processing has two scopes. Structural fallback applies when the template is missing or malformed, the default main block or PROJECT footer is missing or duplicated, the fixed PROJECT critical tail cannot be proven at its structural position, a section is out of order, unexpected structure or non-blank content appears in a checked region, or a Skill outer boundary is not reliable. The extension leaves the incoming array untouched for that turn and reports a bounded replacement failure without prompt bodies, Skill names, or private paths. Once the outer structures are valid, Skill metadata failure affects only the Skill catalog; static policy, runtime sections, and PROJECT changes continue, with a separate deduplicated diagnostic.

The host template route reports per step. Confirming the render is all-or-nothing for that route: when no block is a render of the owned template, recognition falls back to the default-block route, and a turn that matches neither keeps its input unchanged with the bounded replacement failure. Once a render is confirmed, the Delivery step and the footer step resolve independently, each leaving its own input alone while the others still apply. A turn where every step leaves its input alone returns no replacement, so the host prompt stays active.

Already-normalized output from this extension is recognized as a no-op only after full structural validation. The main block must match the owned template's static fragments byte-for-byte, with every dynamic slot in its bounded position; fragment matching already fixes the static skeleton, so a template lookalike inside a slot value is accepted as opaque host text. The PROJECT snapshot must carry the complete rewritten structure, including the owned loading guidance and the required workstation and context-file sections. Each container close is determined before the next known outer structure, so a close-tag lookalike in a later container body or in the append tail does not end an earlier container. A block that only shares the identity line, the heading sequence, or the `# Project snapshot` prefix but is corrupted, injected, or third-party forged is rejected with `owned-output-invalid` instead of being claimed as this extension's output.

Unexpected exception fallback covers errors thrown by the normal per-turn settings, command-metadata, transformation, or result-handling path. The extension returns no replacement, leaves the incoming array active, and reports `unexpected-error` once per session without the exception message or stack.

Activation-time template failures follow the same channel contract. A missing or unreadable template (`template-unavailable`) still registers the turn handler, leaves the first turn's input unchanged, and reports once through the session channel: `ctx.ui.notify` in interactive sessions, the OMP file logger otherwise.

Diagnostics use the public session ID for deduplication, including in-memory sessions. New and forked sessions have separate histories; resuming an already visited session retains its history for this activation. Each turn keeps its own notification or logging channel, even when turns overlap.

The extension does not inspect the OMP version to decide whether to activate, transform, warn, or fall back. Host-rendered event blocks are the only source of retained runtime content; the extension does not independently load skills, rules, tools, or devices.

## Coverage boundaries

The extension applies to ordinary main-session turns and ordinary subagent turns that rebind the parent's extensions. Each child keeps its role, yield protocol, and independent blocks.

Plan-mode subagents load no extensions, so the hook does not run for them. No public task or agent field requests restriction directly; plan mode is the public route, and its child is the restricted child. That statement carries the 18.1.11 container scope recorded under verified scope. On 18.4.3 a child agent with a restricted tool set, the `scout` agent spawned through the `task` tool, did reach the hook, and its provider request carried the owned render, the owned Delivery chapter, and its own role block.

Handoff generation uses the base prompt; title generation and difficulty classification use their own paths. None runs this turn hook. On 18.4.3 the delegated-task label request carried the host's own task prompt without owned text and produced no replacement diagnostic, while a custom `--system-prompt` in the same log produced the bounded `main-block-not-found` diagnostic, so an absent diagnostic marks a path this hook does not serve rather than a silent failure.

Ephemeral side requests such as `/btw` do not independently run the hook; they send the live Agent prompt. A per-turn override stays active until the next turn replaces or clears it.

Device notifications: when an `xd://` device mounts mid-session, OMP suppresses a notice for a device the delivered base catalog already lists. A replaced prompt drops that base catalog, so the device is announced again even though the owned `### Mounted devices` slot lists it. The extension does not maintain separate device state, so it accepts the duplicate notice.

The override lasts one agent turn, not one provider request. A host rebuild during a turn preserves it, so a transformed catalog describes turn-start assembly until the next turn. Appended rule blocks are part of that same turn-scoped prompt. Earlier extension blocks remain intact, and later handlers can overwrite this result; the extension does not reorder other extensions or claim final-provider precedence.

## Compatibility

The minimum maintained OMP version is `18.1.21`, with no upper maintenance bound. This section states the maintenance commitment, not an installation, activation, transformation, or fallback condition: a host below the bound is not blocked and may still run the package, without gaining a maintenance commitment below it, and having no upper bound does not mean that every later release works or has been verified.

The package declares `@oh-my-pi/pi-coding-agent` and `@oh-my-pi/pi-utils` as unrestricted host peers (`*`). Those declarations name the host packages the component imports; they carry no maintenance range, no runtime check, and no claim about any host version.

The automated type check and test suite run against OMP `18.2.8`, and the three direct OMP dev dependencies stay pinned at `18.2.8` so the default host fixture stays reproducible. A dev dependency version is neither a maintenance bound nor a supported-version range. The Verified scope section below separates the evidence: the structure the runtime recognizes in event text, the stored original 18.1.21 template regression, and the real-host observations, which keep their original OMP 18.1.11 version scope. No real CLI run covers 18.1.21.

The host template route binds the runtime-section fields of OMP 18.4.3 and later. The suite renders the stored 18.4.3 host templates from `test/fixtures/omp-18.4.3/` with the locked test renderer, and a test regenerates the committed artifact from the owned source so the two cannot drift.

The extension reads no host version. It recognizes the main block and the PROJECT footer from the event text, and an unrecognized structure falls back to the incoming prompt, so the maintenance bound never becomes a gate.

## Installation

The package has not been published. After cloning the GitHub repository, install its locked dependencies and install the package into OMP:

```bash
git clone https://github.com/ruokee/ruokee-agent-kit.git
cd ruokee-agent-kit/projects/omp-system-prompt
bun install
omp install "$(pwd)" --scope user
```

`omp install` is an alias of `omp plugin install`; `omp plugin link "$(pwd)" --scope user` works the same. OMP reads `omp.extensions` from `package.json` and loads `src/extension.ts`.

### Updating

The registration points at this checkout, so the installation keeps reading the package and its dependencies from that directory. Update it from the repository root:

```bash
cd /path/to/ruokee-agent-kit
git pull
cd projects/omp-system-prompt
bun install --frozen-lockfile
```

Restart OMP afterwards: a running process keeps the extension code it loaded at startup, and starting another session in the same process does not reload it. Prompt rule documents are read again on every turn, so editing those files needs no restart.

### Extension order

OMP runs `before_agent_start` handlers in extension installation order, and each handler receives the previous handler's output as its input. This extension reads whatever array it receives, so extensions installed after it see the owned main block instead of the default one; extensions that expect the stock host main block must run before it.

### Verified scope

Component checks run in the component directory: `bun run typecheck` and `bun test`. Tests render inputs at test time from the locked OMP 18.2.8 host fixture, from the stored 18.1.21 templates, and from the component's own generated template, and one of them regenerates that artifact from the owned source. They cover both `hasSkillUriAccess` branches, and cover native tool lists, inline catalogs, Code Mode, fixed-section condition branches, misplaced condition-line rejection, one-pass slot filling, fixed-region rejection, structural boundaries, encoded installation paths, byte preservation, block order, PROJECT footer variants, the original 18.1.21 templates in both Delivery shapes, Skill description normalization, hidden ordered candidates, both Delivery shapes and transitions, child collection and message rules in both shapes, settings failures, unexpected turn-processing exceptions, and bounded diagnostics. The rule coverage adds every matching dimension, the accepted and rejected document shapes, delimiter and byte-preservation rules, discovery order and filtering, read-failure isolation, the append step after the replacement result, the model fallback, and the default rule directories. The coordination assertions verify rendered instructions; they do not establish actual parent-child scheduling or message behavior.

The `<conventions>` prefix first appears in OMP 18.1.21. The suite stores the unmodified main and PROJECT templates of the published `@oh-my-pi/pi-coding-agent@18.1.21` in `test/fixtures/omp-18.1.21/`, renders them with the same locked test renderer as the default fixture, and transforms the result in both Delivery shapes, so that boundary is checked on every test run instead of in a recorded one-off check. It exercises the stored template text through the current renderer, not the 18.1.21 host itself: the host's events, APIs, and final provider behavior stay uncovered. OMP 18.2.7 dropped that wrapper, reworded the XML sentence and the § Role identity line, rewrote the `agent://<id>` entry, and added `find`-conditional lines. The suite covers both wordings: the default fixture renders the installed template, and a second fixture renders it with `find` in the tool kind, deletes the three lines that mention the tool, and restores the older `grep` wording, so the pre-18.2.7 head wording is exercised from the same installed template. Each anchor is matched against the wording the host actually rendered, so a recognized wording is handled without consulting a version number, and output from either wording keeps its own text in the retained sections. These fixture versions are test evidence, not a support table. The peer dependencies remain unrestricted, and the runtime does not inspect the host version.

Host checks on OMP 18.2.8 ran the published CLI against a local OpenAI-compatible endpoint that logged each provider request body, with the component linked into an isolated config directory. With `--system-prompt-template host-template.hbs` the provider request carried the template render, the owned Delivery chapter as its own block, and the corrected footer; the same release renders no Internal URL entries there, because it supplies no `internalUrls` data for that slot, while the default-block route keeps the host's rendered entries. With `renderDelivery` set to `false` and one matching rule document, the request carried no Delivery chapter and ended with the appended rule body. A strict template argument that pointed at a missing file failed the session before the extension ran, and a plain custom prompt left the incoming text active with the logged `main-block-not-found` diagnostic. These runs exercised the template path on a release older than the one the shipped template binds, so they are compatibility observations rather than target-version evidence.

The real-host and container observations below were collected on OMP 18.1.11 and retain that version scope. They are not OMP 18.2.8 real-host evidence.

Host checks on OMP 18.4.3 ran that release's published CLI from a sandboxed install in a git-ignored directory, with an isolated `HOME`, the component linked into that sandbox, and a loopback OpenAI-compatible endpoint logging every provider request body. Selecting `host-template.hbs` through `--system-prompt-template` and, in a separate run, through a discovered `<project>/.omp/SYSTEM_TEMPLATE.md` produced the same three core blocks: the template render, the owned Delivery chapter as its own block, and the corrected `<project-context>` footer, followed by a fourth block carrying the matching model rule. The footer carried the owned loading guidance, the project context bodies and rule paths, and no fixed `<critical>` tail; the render bound that release's own data, including backticked Internal URL entries, the visible Skill list, matching rule documents, the runtime-mode section, and a `xd://` device entry after a second component was linked. A model switch changed the appended rule body with the model, and editing a rule document between turns changed that body on the next turn while the turn that edited it kept the earlier body. A delegated `task` child and a restricted-tool `scout` child both sent requests carrying the owned render, the Delivery chapter, and their own role block; the delegated-task label request sent the host's own task prompt with no owned text and left no replacement diagnostic, while a custom `--system-prompt` in the same log produced the bounded `main-block-not-found` diagnostic. With `renderDelivery` set to `false`, the request carried no Delivery chapter. On the Anthropic transport the request marked the last static block before the footer, which with the owned set is the Delivery chapter, as a cache breakpoint, so the footer stays outside the cached prefix. This round exercised those paths only: the interactive UI, a real model's output, plan-mode children, `/handoff`, `/btw`, mid-run host rebuilds, mid-session device-mount notices, and a mid-session `renderDelivery` toggle stayed unexercised on 18.4.3, and the cache property was observed as block boundaries and a breakpoint position rather than as a cache-hit measurement.

Host checks on OMP 18.5.0 ran the published CLI in disposable Podman containers without host-directory mounts, with an isolated `HOME` and the component linked there. Both the main agent and an ordinary `task` child used the discovered synthetic project's `.omp/SYSTEM_TEMPLATE.md`. A loopback forwarder recorded request bodies and sent them to a real Provider; the captured main and child instructions exactly matched their same-turn post-handler blocks joined by two LFs. The main request kept the synthetic project body and append bytes, including quoted complete critical tails, with the owned loading guidance. The child request kept its independent role block and had no fixed tail after the outer `<project-context>` close. The child footer did not automatically inherit the main turn's project body or CLI append; quoted body text in the explicit task context is separate from footer inheritance. Byte preservation for those child footer inputs is regression-test evidence, not a real-child observation. Both agents returned the requested markers, and the same-run logs contained no `omp-system-prompt` diagnostics. These checks cover the footer repair, not general OMP 18.5.0 certification or unchanged features.

Footer regressions cover both exact native tails, complete critical blocks at the append start, byte-exact opaque copies, and unchanged complete old output for ordinary appends. The conditional ownership comment is checked as the sole output addition for ambiguous bare footers, with repeated complete arrays and Delivery round trips.

A later OMP 18.5.0 run exercised the conditional comment with a bare main footer and a critical-first append. The Provider received the required comment and the complete append. Its ordinary child received a bare footer without a comment or native tail, retaining its independent role. A post-handler observer repeated both conversions, obtained the identical complete arrays with `changed=false`, and passed those arrays to the host. Both agents returned the required markers. A separate ordinary-append main run delivered the exact no-comment output to the real Provider, with the append preserved and repeated conversion unchanged; Provider 429 responses exhausted the host's two retries, so that run established Provider-facing output but not model completion.

Container checks ran in disposable Podman containers without host-directory mounts. The containers were removed after the checks.

- Controlled success: two Skills, one description carrying tab, blank-line, and Unicode line-separator whitespace. The final provider payload carried the owned static skeleton, the single-lined description, the preserved tool and device catalogs, the `# Project snapshot` heading, and neither the host Delegation cap nor its extra `hub` hint.
- Local Skill formatting fallback keeps the complete isolated catalog byte-for-byte, including an arbitrary body inside a valid `<skills>` wrapper, while static policy and PROJECT rewriting continue; the diagnostic names `Skill catalog formatting skipped` and the owned output remains idempotent on the next transform.
- Structural fallback covers unreliable outer boundaries and malformed main or PROJECT structure; it keeps the incoming blocks unchanged and reports the bounded replacement failure channel.
- A real-host run with `renderDelivery=false` produced the expected Provider instructions: they began with the owned identity and omitted `# Delivery`; the model returned the requested exact marker.
- A real-host run used a configuration where the visible event catalog omitted a hidden Skill while `pi.getCommands()` still exposed it. The provider-facing instructions used the owned identity and PROJECT snapshot, retained the mounted `xd://` device entries and plugin-loaded runtime policy, and omitted the hidden candidate.
- A real-host run with a bounded preceding catalog rewrite preserved the rewritten Skill entry byte-for-byte, applied the owned identity and PROJECT snapshot, and emitted only the local `Skill catalog formatting skipped` diagnostic.
- Manual invocation of the hidden Skill still resolved its command. The provider input carried the full Skill body and user arguments in a custom message whose Provider `role` was `user`; the model replied with the requested exact marker.
- Session paths observed in containers: the first turn, a continued second turn, a mid-turn rebuild after a tool call (the owned prompt persisted into the second provider request), an ordinary subagent turn (the child's own role blocks stayed intact), and a later extension overriding the result before the provider request.
- Restricted child observed in a container: `omp --plan-yolo` ran a plan-mode parent turn with the owned prompt, and the spawned child request carried the host default prompt with the `read`/`grep`/`glob`/`yield` tool set and no owned identity.
- Handoff observed in a container: `/handoff` compacted the session and its side request carried the host default prompt.
- `/btw` observed in a container: before any turn it carried the host default prompt; after a replaced turn it carried the owned prompt.
- Device notification observed in a container: one request carried both the owned mounted-device catalog entry and a hidden mount notice for the same device; the same scenario without the extension carried the device in the host catalog and no notice. The device stayed usable in both cases.
- Fresh real-host runs exercised analysis-only requests, requested prototypes, project-specific compatibility requirements, authorization boundaries, justified pauses, honest verification, quoted control tags, runtime device notices, and changed workspace context. The model performed or declined each requested action as expected, and every captured Provider request began with the owned identity.

## Development

```bash
cd projects/omp-system-prompt
bun install
bun run typecheck
bun test
bun run build:template
```

`bun run build:template` regenerates `host-template.hbs` from `src/prompt-template.md` and reports its byte size and anchor count; run it after editing the owned source, then `bun test`, which fails when the committed artifact and the source disagree.

The runtime imports are limited to two unrestricted peer dependencies: `@oh-my-pi/pi-coding-agent` for extension APIs and `@oh-my-pi/pi-utils` for the profile-aware agent directory helpers. Tests pin direct dev dependencies on `@oh-my-pi/pi-coding-agent`, `@oh-my-pi/pi-ai`, and `@oh-my-pi/pi-utils` at 18.2.8 to keep the host fixture reproducible; the dev dependency version does not restrict installation or activation.

## License

MIT.
