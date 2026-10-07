# omp-system-prompt

[中文](./README.zh.md)

This OMP extension applies a maintained English strategy to OMP's system prompt through the host's own template mechanism. The user selects the shipped `host-template.hbs`, the host renders it with runtime data, and the extension completes that render on each turn. OMP re-renders the system prompt each turn and hands the block array to `before_agent_start`; the extension transforms that input, never a startup snapshot.

## Approaching deprecation

`omp-system-prompt` 0.5.1 is approaching deprecation. The maintainer reports that recent OMP updates substantially reduced the native prompt and support user-selected templates, reducing the need for this extension. Its template strategy, `renderDelivery`, footer processing, and current maintenance remain available. No removal date is set; the component does not uninstall itself or alter user templates and rules.

Model prompt rules belong to QoL and are independently opt-in there. This component does not discover, read, append, or forward those rules.

## How it works

OMP assembles the system prompt from blocks: a main block, optional Computer Safety and active-repo blocks, and a `<project-context>` footer. The component ships `host-template.hbs`, generated from the owned source `src/prompt-template.md` by `bun run build:template`. Its tool, device, `xd://` URI, Skill, rule, and runtime-mode slots are bound to host data, so the host renders the owned structure before this extension sees the turn. The artifact is not a runtime input: the extension keeps reading `src/prompt-template.md` and derives its recognition anchors from that source on activation.

When exactly one block is a render of the shipped template, the extension handles the turn per step:

- The template block stays byte-for-byte in its position. Its tool, device, `xd://` URI, Skill, rule, and runtime-mode slots already carry the host's dynamic data, including the mounted-device documentation. The extension does not normalize whitespace inside it; the bindings keep the section boundaries.
- The owned `# Delivery` chapter becomes its own block directly after the template block, and stays out when `renderDelivery` is false. A foreign block that starts with `# Delivery` at that position belongs to another writer: the extension keeps it and reports `delivery-block-conflict` instead of inserting its own chapter.
- The footer is corrected in place. The host's loading guidance and auto-loaded line become the owned text. At the validated outer `<project-context>` boundary, the exact fixed main-agent tail or the OMP 18.5.0 subagent tail is removed together with its preceding blank line, using the matched text's length. Unknown tails stay intact. Context-file bodies, listed paths, workspace data, extra roots, the `<active-repo-context>` block, and appended prompt bytes stay verbatim, including copies of known `<critical>` tails inside bodies or append text.
- Repeated conversion recognizes the owned loading line or a neutral `<!-- omp-system-prompt:project-context -->` comment at its validated outer position and leaves the append untouched, even when it begins with a complete known critical tail. The comment is added only when all three conditions hold: the footer has no loading guidance, this conversion removes an exactly recognized native tail, and the append starts with a complete known critical block. It sits after `</workstation>`, outside every opaque field and the append. Only the comment and its separator may change prior complete output; ordinary appends and footers with loading guidance keep their prior output. Recognition works with either Delivery value and across changes, without a process-local cache or new setting. It is not proof of authorship or a security boundary.
- An absent footer needs no work and reports nothing. A footer whose boundary is not unique reports `project-footer-ambiguous`, and one whose loading instructions are unknown reports `project-footer-not-recognized`; either way the footer keeps its input and the remaining steps still apply.

Recognition uses the owned source's own static text as anchors: each anchor is edge-trimmed, the anchors keep their order, the first sits at the block start, and the last at the block end. Dynamic slot bodies are not part of that basis, so a third-party template that reproduces the whole static skeleton and changes only slot bodies is claimed as well. A render of a different template, a truncated or corrupt render, and a third-party block that merely opens with the owned identity line stay unclaimed.

Any other main block is not the component's to change. Without a selected template, with `SYSTEM.md`, with `--system-prompt`, or with another template, the extension leaves the system prompt as the host built it and reports nothing.

## Agent coordination

The owned coordination policy stays active with either `renderDelivery` value. It instructs the parent to continue independent authorized work after dispatch, wait when no such work remains and children are unfinished, and collect and assess every child's outcome before normal final delivery. A wait may return for one result, a message, a timeout, or an interruption, so the parent must recheck outstanding tasks. Results already delivered need no extra wait; failures, cancellation, and blockers must be reported honestly, and healthy work must not be cancelled merely to finish sooner.

Task completion does not require an idle or parked agent to exit. Messages that only acknowledge completion, idle status, or closure need no reply; substantive questions, corrections, and new work still do. These are model instructions. The extension does not add a runtime barrier or change host job and messaging behavior.

## Delivery setting

The package declares `omp.settings.renderDelivery` as a boolean with a default of `true`.

- `true` or an unset value renders the complete final `# Delivery` chapter.
- `false` omits that exact chapter, including `Task scope`, `Completion`, `Evidence`, and `Pausing`.
- On every turn that carries a render of the owned template, the effective value is read through the public `getPluginSettings(PACKAGE_NAME, ctx.cwd)` API. User-level values can be set with `omp plugin config set @ruokee/omp-system-prompt renderDelivery false`; a project-level `.omp/plugin-overrides.json` value under `settings.@ruokee/omp-system-prompt.renderDelivery` overrides the user value.
- A settings read failure or non-boolean value keeps Delivery enabled, reports one bounded session diagnostic for that reason, and lets the request continue.
- When the setting changes between turns, the extension recognizes its own earlier output and adds or removes only the Delivery chapter block.
- A foreign `# Delivery` block directly after the template render stays and reports `delivery-block-conflict`.

## Fallback behavior

The extension changes a turn only when exactly one block is a host render of the owned template; any other input passes through silently, as described above. Two template renders in one turn report `ambiguous-boundary` and leave the input unchanged. Once a single render is confirmed, the Delivery step and the footer step resolve independently, each leaving its own input alone while the other still applies. A turn where every step leaves its input alone returns no replacement, so the host prompt stays active. Diagnostics carry a bounded reason without prompt bodies or private paths.

Unexpected exception fallback covers errors thrown by the normal per-turn transformation or result-handling path; settings read failures use the settings fallback above. The extension returns no replacement, leaves the incoming array active, and reports `unexpected-error` once per session without the exception message or stack.

Activation-time template failures follow the same channel contract. A missing or unreadable template (`template-unavailable`) still registers the turn handler, leaves the first turn's input unchanged, and reports once through the session channel: `ctx.ui.notify` in interactive sessions, the OMP file logger otherwise.

Diagnostics use the public session ID for deduplication, including in-memory sessions. New and forked sessions have separate histories; resuming an already visited session retains its history for this activation. Each turn keeps its own notification or logging channel, even when turns overlap.

The extension does not inspect the OMP version to decide whether to activate, transform, warn, or fall back. Host-rendered event blocks are the only source of retained runtime content; the extension does not independently load skills, rules, tools, or devices.

## Coverage boundaries

The extension applies to ordinary main-session turns and ordinary subagent turns that rebind the parent's extensions. Each child keeps its role, yield protocol, and independent blocks.

Plan-mode subagents load no extensions, so the hook does not run for them. No public task or agent field requests restriction directly; plan mode is the public route, and its child is the restricted child.

Handoff generation uses the base prompt; title generation and difficulty classification use their own paths. None runs this turn hook.

Ephemeral side requests such as `/btw` do not independently run the hook; they send the live Agent prompt. A per-turn override stays active until the next turn replaces or clears it.

The override lasts one agent turn, not one provider request. A host rebuild during a turn preserves it, so the completed prompt describes turn-start assembly until the next turn. Earlier extension blocks remain intact, and later handlers can overwrite this result; the extension does not reorder other extensions or claim final-provider precedence.

## Compatibility

The minimum maintained OMP version is `18.5.0`, with no upper maintenance bound. This section states the maintenance commitment, not an installation, activation, transformation, or fallback condition: a host below the bound is not blocked and may still run the package, without gaining a maintenance commitment below it, and having no upper bound does not mean that every later release works or has been verified.

The package declares `@oh-my-pi/pi-coding-agent` as an unrestricted host peer (`*`). That declaration names the host package the component imports; it carries no maintenance range, runtime check, or claim about any host version.

The three direct OMP dev dependencies are pinned at `18.5.0`, and the test suite renders the host templates of that installed package. A dev dependency version is neither a maintenance bound nor a supported-version range. The shipped template binds the runtime-section fields of OMP 18.5.0, and a test regenerates the committed artifact from the owned source so the two cannot drift.

The extension reads no host version. It recognizes the template render and the `<project-context>` footer from the event text, and anything it does not recognize stays as the host built it, so the maintenance bound never becomes a gate.

## Installation

The package has not been published. After cloning the GitHub repository, install its locked dependencies and install the package into OMP:

```bash
git clone https://github.com/ruokee/ruokee-agent-kit.git
cd ruokee-agent-kit/projects/omp-system-prompt
bun install
omp install "$(pwd)" --scope user
```

`omp install` is an alias of `omp plugin install`; `omp plugin link "$(pwd)" --scope user` works the same. OMP reads `omp.extensions` from `package.json` and loads `src/extension.ts`.

### Selecting the template

This step is optional. Without it the extension changes nothing. The template is a user choice: the component never writes a template file, changes the installed host, or selects the template by itself. Use one of the host's own inputs:

- For one run, pass the shipped file on the command line:

    ```bash
    omp --system-prompt-template /path/to/ruokee-agent-kit/projects/omp-system-prompt/host-template.hbs
    ```

- For every run, copy it to a `SYSTEM_TEMPLATE.md` file the host discovers: `<project>/.omp/SYSTEM_TEMPLATE.md` for one project, or `SYSTEM_TEMPLATE.md` in the user agent directory (`~/.omp/agent/` by default) for every project. Copy it again after an update changes `host-template.hbs`.

The host picks one main prompt source per session ([`main.ts`](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/main.ts), [`system-prompt.ts`](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/system-prompt.ts), [`discovery/builtin.ts`](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/discovery/builtin.ts)):

- A command-line `--system-prompt` or `--system-prompt-template` wins over discovered files, and the two flags cannot be combined.
- Among discovered files, the project level wins over the user level.
- At the same level, `SYSTEM.md` wins over `SYSTEM_TEMPLATE.md`.

A `SYSTEM.md` at the same or a higher level, or a `--system-prompt` argument, therefore hides the template, and the extension leaves that prompt alone.

### Updating

The registration points at this checkout, so the installation keeps reading the package and its dependencies from that directory. Update it from the repository root:

```bash
cd /path/to/ruokee-agent-kit
git pull
cd projects/omp-system-prompt
bun install --frozen-lockfile
```

Restart OMP afterwards: a running process keeps the extension code it loaded at startup, and starting another session in the same process does not reload it.

### Extension order

OMP runs `before_agent_start` handlers in actual extension load order, and each handler receives the previous handler's output. This extension reads the array it receives, so handlers loaded after it see the inserted Delivery block and corrected footer; handlers that need the host's uncorrected footer must run before it. Installation command order alone does not establish this order.

### Verified scope

Component checks run in the component directory: `bun run typecheck` and `bun test`. Tests render inputs at test time from the installed OMP 18.5.0 host templates and from the component's generated template, and one regenerates that artifact from the owned source. They cover template-render recognition, rejection of edited skeletons and lookalikes, the host's bundled main block and custom prompts staying unchanged without diagnostics, both Delivery shapes and switching between them, Delivery conflicts, footer correction for the main-agent and subagent tails, ambiguous and unrecognized footers, repeated conversion, settings fallback, diagnostic deduplication, and encoded installation paths.

Host checks on OMP 18.5.0 ran the published CLI in disposable Podman containers without host-directory mounts, with an isolated `HOME` and the component linked there. Both the main agent and an ordinary `task` child used the discovered synthetic project's `.omp/SYSTEM_TEMPLATE.md`. A loopback forwarder recorded request bodies and sent them to a real Provider; the captured main and child instructions exactly matched their same-turn post-handler blocks joined by two LFs. The main request kept the synthetic project body and append bytes, including quoted complete critical tails, with the owned loading guidance. The child request kept its independent role block and had no fixed tail after the outer `<project-context>` close. The child footer did not automatically inherit the main turn's project body or CLI append; quoted body text in the explicit task context is separate from footer inheritance. Byte preservation for those child footer inputs is regression-test evidence, not a real-child observation. Both agents returned the requested markers, and the same-run logs contained no `omp-system-prompt` diagnostics. These checks cover the footer repair, not general OMP 18.5.0 certification or unchanged features.

Footer regressions cover both exact native tails, complete critical blocks at the append start, byte-exact opaque copies, and unchanged complete old output for ordinary appends. The conditional ownership comment is checked as the sole output addition for ambiguous bare footers, with repeated complete arrays and Delivery round trips.

A later OMP 18.5.0 run exercised the conditional comment with a bare main footer and a critical-first append. The Provider received the required comment and the complete append. Its ordinary child received a bare footer without a comment or native tail, retaining its independent role. A post-handler observer repeated both conversions, obtained the identical complete arrays with `changed=false`, and passed those arrays to the host. Both agents returned the required markers. A separate ordinary-append main run delivered the exact no-comment output to the real Provider, with the append preserved and repeated conversion unchanged; Provider 429 responses exhausted the host's two retries, so that run established Provider-facing output but not model completion.

## Development

```bash
cd projects/omp-system-prompt
bun install
bun run typecheck
bun test
bun run build:template
```

`bun run build:template` regenerates `host-template.hbs` from `src/prompt-template.md` and reports its byte size and anchor count; run it after editing the owned source, then `bun test`, which fails when the committed artifact and the source disagree.

The runtime imports only the unrestricted peer `@oh-my-pi/pi-coding-agent` for extension APIs. Tests pin direct dev dependencies on `@oh-my-pi/pi-coding-agent`, `@oh-my-pi/pi-ai`, and `@oh-my-pi/pi-utils` at 18.5.0 to keep the host templates reproducible; the dev dependency version does not restrict installation or activation.

## License

MIT.
