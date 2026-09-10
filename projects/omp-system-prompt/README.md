# omp-system-prompt

[中文](./README.zh.md)

This OMP extension replaces the fixed policy text in OMP's default system prompt with maintained English text. It preserves recognized host-rendered runtime sections in their semantic positions. OMP re-renders the system prompt each turn and hands the block array to `before_agent_start`; the extension transforms that input, never a startup snapshot.

## How it works

OMP assembles the system prompt from blocks: a default main block, optional Computer Safety and active-repo blocks, and a PROJECT footer. On each turn the extension receives the current block array through the `before_agent_start` event and:

- Recognizes exactly one default main block by the `§ Role` identity lines and exactly one structurally valid PROJECT footer. Any other block passes through byte-for-byte in its original position.
- Rebuilds the main block from the extension's owned template. Seven slots receive the host-rendered tool catalog, dynamic `xd://` device documentation, Internal URLs, Skills, always-apply rules, domain rules, and runtime-mode protocols. The owned template puts the tool catalog under `### Tool inventory` and the device catalog under `### Mounted devices`.
- Places Computer Use, Scratchpad, dynamic Tool I/O lines, Specialized Tools with automated QA, and AST in the runtime-modes slot. Before removing the host's fixed Tool Policy, Exploration, Workflow, Delivery, and Critical policy text, it validates the required and conditional lines in their rendered order against the recognized prompt structure. The owned final `# Delivery` chapter is included or omitted according to `renderDelivery`.
- Normalizes the retained OMP runtime chapters `# Computer Use`, `§ Scratchpad`, `# Tool I/O`, `# Specialized Tools`, and `# AST` to exactly two LF characters between each heading and its body. If OMP emits blank lines between adjacent `Specialized Tools` list items, the extension removes every such gap in that section; it does not compress whitespace globally or rewrite static owned text, code blocks, or arbitrary host content. The owned main block has no trailing LF, so OMP's `systemPrompt.join("\n\n")` leaves exactly two LFs before `# Project snapshot`.
- Validates the host Internal URLs section, discards its fixed `Most FS/bash tools auto-resolve these to FS paths.` introduction, and retains only the URI entries.
- Validates the whole host Delegation section, then drops it. The owned `# Agent coordination` section supplies the coordination policy described below; the rendered concurrency cap and the extra `hub` communication hint are not carried into any owned slot. Host concurrency enforcement is unaffected.
- Normalizes Skill catalog descriptions to one line when complete Skill command metadata corresponds to the catalog. See below.
- Rewrites only the PROJECT wrapper: its outer heading becomes `# Project snapshot`, its loading guidance is replaced, and the exact fixed `<critical>` tail is removed at its structural position. Context-file bodies, listed paths, workspace data, extra roots, and appended prompt bytes stay verbatim.

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

## Fallback behavior

Processing has two scopes. Structural fallback applies when the template is missing or malformed, the default main block or PROJECT footer is missing or duplicated, the fixed PROJECT critical tail cannot be proven at its structural position, a section is out of order, unexpected structure or non-blank content appears in a checked region, or a Skill outer boundary is not reliable. The extension leaves the incoming array untouched for that turn and reports a bounded replacement failure without prompt bodies, Skill names, or private paths. Once the outer structures are valid, Skill metadata failure affects only the Skill catalog; static policy, runtime sections, and PROJECT changes continue, with a separate deduplicated diagnostic.

Already-normalized output from this extension is recognized as a no-op only after full structural validation. The main block must match the owned template's static fragments byte-for-byte, with every dynamic slot in its bounded position; fragment matching already fixes the static skeleton, so a template lookalike inside a slot value is accepted as opaque host text. The PROJECT snapshot must carry the complete rewritten structure, including the owned loading guidance and the required workstation and context-file sections. Each container close is determined before the next known outer structure, so a close-tag lookalike in a later container body or in the append tail does not end an earlier container. A block that only shares the identity line, the heading sequence, or the `# Project snapshot` prefix but is corrupted, injected, or third-party forged is rejected with `owned-output-invalid` instead of being claimed as this extension's output.

Unexpected exception fallback covers errors thrown by the normal per-turn settings, command-metadata, transformation, or result-handling path. The extension returns no replacement, leaves the incoming array active, and reports `unexpected-error` once per session without the exception message or stack.

Activation-time template failures follow the same channel contract. A missing or unreadable template (`template-unavailable`) still registers the turn handler, leaves the first turn's input unchanged, and reports once through the session channel: `ctx.ui.notify` in interactive sessions, the OMP file logger otherwise.

The extension does not inspect the OMP version to decide whether to activate, transform, warn, or fall back. Host-rendered event blocks are the only source of retained runtime content; the extension does not independently load skills, rules, tools, or devices.

## Coverage boundaries

The extension applies to ordinary main-session turns and ordinary subagent turns that rebind the parent's extensions. Each child keeps its role, yield protocol, and independent blocks.

Restricted-tool and plan-mode subagents load no extensions, so the hook does not run for them. No public task or agent field requests restriction directly; plan mode is the public route, and its child is the restricted child.

Handoff generation uses the base prompt; title generation and difficulty classification use their own paths. None runs this turn hook.

Ephemeral side requests such as `/btw` do not independently run the hook; they send the live Agent prompt. A per-turn override stays active until the next turn replaces or clears it.

Device notifications: when an `xd://` device mounts mid-session, OMP suppresses a notice for a device the delivered base catalog already lists. A replaced prompt drops that base catalog, so the device is announced again even though the owned `### Mounted devices` slot lists it. The extension does not maintain separate device state, so it accepts the duplicate notice.

The override lasts one agent turn, not one provider request. A host rebuild during a turn preserves it, so a transformed catalog describes turn-start assembly until the next turn. Earlier extension blocks remain intact, and later handlers can overwrite this result; the extension does not reorder other extensions or claim final-provider precedence.

## Installation

The package has not been published. After cloning the GitHub repository, install its locked dependencies and install the package into OMP:

```bash
git clone https://github.com/ruokee/ruokee-agent-kit.git
cd ruokee-agent-kit/projects/omp-system-prompt
bun install
omp install "$(pwd)" --scope user
```

`omp install` is an alias of `omp plugin install`; `omp plugin link "$(pwd)" --scope user` works the same. OMP reads `omp.extensions` from `package.json` and loads `src/extension.ts`.

### Extension order

OMP runs `before_agent_start` handlers in extension installation order, and each handler receives the previous handler's output as its input. This extension reads whatever array it receives, so extensions installed after it see the owned main block instead of the default one; extensions that expect the stock host main block must run before it.

### Verified scope

Component checks run in the component directory: `bun run typecheck` and `bun test` (91 tests, 475 assertions). Tests render inputs at test time from the locked host fixture and cover native tool lists, inline catalogs, Code Mode, fixed-section condition branches, misplaced condition-line rejection, one-pass slot filling, fixed-region rejection, structural boundaries, encoded installation paths, byte preservation, block order, PROJECT footer variants, Skill description normalization, hidden ordered candidates, both Delivery shapes and transitions, child collection and message rules in both shapes, settings failures, unexpected turn-processing exceptions, and bounded diagnostics. The coordination assertions verify rendered instructions; they do not establish actual parent-child scheduling or message behavior.

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
```

The runtime imports are limited to one unrestricted peer dependency: `@oh-my-pi/pi-coding-agent`. Tests pin direct dev dependencies on `@oh-my-pi/pi-coding-agent`, `@oh-my-pi/pi-ai`, and `@oh-my-pi/pi-utils` to keep the host fixture reproducible; dev dependency versions do not restrict installation or activation.

## License

MIT.
