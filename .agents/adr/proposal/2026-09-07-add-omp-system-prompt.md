# ADR proposal: Add an OMP system prompt extension

Decision owner: Ruokee
Draft writer: OMP GPT-6 Astra

English | [中文](./2026-09-07-add-omp-system-prompt.zh.md)

## Motivation

OMP's default system prompt combines runtime capabilities with engineering preferences, delegation policy, personality, a fixed workflow, and unconditional continuation requirements. A maintainer-owned prompt should describe the runtime and an honest delivery contract while leaving working methods and engineering choices to applicable user and project rules.

A static `SYSTEM.md` does not preserve the default assembly contract. In OMP 18.1.11, the custom wrapper retains some context and resource information but omits the default tool inventory, internal-resource catalog, and device documentation. Its inserted text is not recursively rendered as a template.

The public `before_agent_start` event supplies the rendered `systemPrompt: string[]` and accepts a replacement array. It supports a separately distributed extension without modifying OMP. The public `getCommands()` API can also expose Skill names and descriptions when Skill commands are enabled, but it does not identify the final visible catalog. Description normalization therefore requires a checked correspondence with the event input and explicit format and coverage limits.

The evidence baseline is OMP `v18.1.11`, commit `e3106be68f778635da3a17106835ce2e0e6992af`:

- [Prompt assembly](https://github.com/can1357/oh-my-pi/blob/e3106be68f778635da3a17106835ce2e0e6992af/packages/coding-agent/src/system-prompt.ts#L988-L1055) builds separate main, optional safety, PROJECT, and optional active-repository blocks.
- [Extension chaining](https://github.com/can1357/oh-my-pi/blob/e3106be68f778635da3a17106835ce2e0e6992af/packages/coding-agent/src/extensibility/extensions/runner.ts#L1715-L1766) passes each replacement to the next handler.
- [PROJECT template](https://github.com/can1357/oh-my-pi/blob/e3106be68f778635da3a17106835ce2e0e6992af/packages/coding-agent/src/prompts/system/project-prompt.md) contains both contextual data and fixed instructions, with optional append text after its final critical block.
- [Skill command metadata](https://github.com/can1357/oh-my-pi/blob/e3106be68f778635da3a17106835ce2e0e6992af/packages/coding-agent/src/extensibility/extensions/get-commands-handler.ts#L55-L64) exposes `session.skills` through `getCommands()` when Skill commands are enabled, including hidden Skills. The [prompt filter](https://github.com/can1357/oh-my-pi/blob/e3106be68f778635da3a17106835ce2e0e6992af/packages/coding-agent/src/system-prompt.ts#L970-L972) separately excludes hidden Skills and requires the `read` tool.
- [Hidden Skill semantics](https://github.com/can1357/oh-my-pi/blob/e3106be68f778635da3a17106835ce2e0e6992af/packages/coding-agent/src/extensibility/skills.ts#L24-L29) retain resource and enabled manual-command access while excluding the Skill from the system catalog. [Manual invocation](https://github.com/can1357/oh-my-pi/blob/e3106be68f778635da3a17106835ce2e0e6992af/packages/coding-agent/src/modes/skill-command.ts#L43-L68) expands the selected Skill and arguments into a user-attributed message.
- [Side-request context](https://github.com/can1357/oh-my-pi/blob/e3106be68f778635da3a17106835ce2e0e6992af/packages/agent/src/agent.ts#L773-L802) defaults to the live Agent prompt; callers such as Handoff can explicitly select the base prompt.
- [Task concurrency enforcement](https://github.com/can1357/oh-my-pi/blob/e3106be68f778635da3a17106835ce2e0e6992af/packages/coding-agent/src/task/index.ts#L574-L640) uses a session semaphore configured by `task.maxConcurrency`, independently of the prompt's Cap text.

## Proposal

### Distribute one self-contained extension

Add `projects/omp-system-prompt/` as the first-party package `@ruokee/omp-system-prompt`. Declare its entry through native `omp.extensions` metadata. Keep its runtime, maintainer-owned English prompt, checks, and bilingual README documentation inside the component. This follows the [first-party capability boundary](../decision/2026-08-20-establish-first-party-capability-kit.md) and [self-contained component contract](../decision/2026-08-24-keep-components-self-contained.md); neither decision needs reversal.

Use public OMP extension APIs. Do not import private prompt builders, rescan resources, duplicate context discovery, or vendor upstream templates. Do not require files from another repository component or a machine-specific installation. Use native installation, activation, disablement, and removal mechanisms. Do not write `SYSTEM.md` on the user's behalf.

Run on the unmodified OMP distribution. Do not patch upstream source or installed binaries, require a new upstream API, or replace the host with an SDK-owned session to satisfy this component's contract.

Start with an exact OMP `18.1.11` peer dependency and a runtime check against the public `VERSION` export. A matching version is necessary but not sufficient: every input must also pass the supported-format checks. Broader version support requires source review and validation rather than a speculative 18.x range.

### Configure the Delivery chapter

Declare `renderDelivery` in the package's `omp.settings` manifest entry as a boolean with default `true`:

```json
{
  "omp": {
    "settings": {
      "renderDelivery": {
        "type": "boolean",
        "default": true
      }
    }
  }
}
```

Manage the user-level value through native OMP:

```sh
omp plugin config set @ruokee/omp-system-prompt renderDelivery false
```

A project can override it in `.omp/plugin-overrides.json`:

```json
{
  "settings": {
    "@ruokee/omp-system-prompt": {
      "renderDelivery": false
    }
  }
}
```

On every `before_agent_start` turn, read the effective value with the public `getPluginSettings(packageName, ctx.cwd)` export from `@oh-my-pi/pi-coding-agent/extensibility/plugins`. Project settings override the user-level value. Do not import private modules or parse `omp-plugins.lock.json` or another host file directly.

The default is `true`, so an absent setting preserves the full Delivery chapter. Only an exact boolean `false` disables it. A read failure or non-boolean value falls back to `true`, keeps Delivery, and reports through the existing bounded, session-deduplicated diagnostic channel without blocking the model request. The disabled range is exact: omit from the `# Delivery` heading through the end of its final `## Pausing` body, including `Task scope`, `Completion`, `Evidence`, and `Pausing`; do not remove adjacent dynamic slots, PROJECT content, or independent blocks.

### Separate static policy from runtime content

The owned Delivery chapter defines scope, evidence, completion, and justified pausing only when Delivery is enabled. When Delivery is disabled, the extension provides none of those four requirements; applicable user, project, or other system rules may still provide them. The owned prompt otherwise defines OMP identity, instruction-source boundaries, context interpretation, tool availability and recovery, and authorized coordination. It must not assert that an XML name grants authority or that all user content has been sanitized. It is not a replacement for host-side message provenance or input security.

Leave engineering preferences, communication style, delegation defaults, compatibility choices, and verification workflows to applicable user and project rules. Do not copy or edit those rules automatically. Render the owned Delivery contract under the setting rules above. When the setting disables it, omit the whole Delivery chapter rather than substituting host Delivery text.

Preserve runtime content already selected and rendered by OMP:

- Actual tool names, wire names, native or inline descriptors, device catalogs and inline documentation, and conditional internal-resource entries.
- Skill names, ordering, and filtering, with catalog description whitespace normalized only under the conditions below. Preserve always-apply rule bodies and conditional rule catalogs, including their ordering and text.
- Enabled Computer Use and Scratchpad constraints, intent-field and opaque-token protocols, specialized-tool and AST routing, and enabled automatic-QA instructions. Do not retain delegation preferences merely because they are conditional.
- PROJECT environment, loaded file bodies, discovered-but-unloaded paths, workspace trees and roots, append text, and all independent system blocks, including Computer Safety and subagent role and yield instructions.

In PROJECT, distinguish loaded bodies from merely discovered paths. Change the recognized outer `PROJECT` heading to `# Project snapshot`, change only the specified outer loading statements, and remove only the host template's exact three-instruction critical block. Preserve file bodies and append text even when they contain similar tags or wording. Preserve the rest of PROJECT in place instead of duplicating it inside the new main block.

### Define the owned static structure

The main block starts with this identity text:

```text
You are an assistant in Oh My Pi (OMP), a terminal-based coding agent. You are expected to be precise, and helpful. Fulfill the user's request with current capabilities.
```

Its top-level sections, in order, are `# Instruction sources`, `# Project context`, `# Runtime capabilities`, and `# Agent coordination`; append `# Delivery` when `renderDelivery` is `true` or safely defaults to `true`. Runtime capabilities contains Tool access, Tool devices, Internal resources, Skills, Rules, and Runtime modes in that order. Put the actual tool inventory below `### Tool inventory` under Tool access and the actual device catalog and inline documentation below `### Mounted devices` under Tool devices. Missing catalogs do not create example entries. When present, Delivery contains Task scope, Completion, Evidence, and Pausing in that order. The separate PROJECT block supplies `# Project snapshot`.

Internal resources contains the owned URI guidance followed by the host's actual URI entries. Validate and discard the host's fixed `Most FS/bash tools auto-resolve these to FS paths.` introduction. Preserve the URI entries themselves. Review annotations and historical dynamic examples are not runtime prompt content.

Agent coordination contains exactly these two owned paragraphs:

```text
Delegate only as authorized by the user, applicable project rules, and active mode; available agent tools do not require delegation.

Provide each child its context, requirements, permissions, and expected result; do not assume shared conversation or loaded context. Use actual IDs, concurrency limits, channels, and retrieval protocols. Respect child restrictions; delegation cannot expand authorization. Accept results on evidence and required verification, not job completion alone. Track the whole deliverable and unresolved dependencies; child success is not overall completion.
```

Validate and consume the recognized host Delegation section without carrying its Cap text or additional `hub` communication item into any owned slot. Do not remove tool descriptions, runtime notices, child instructions, or user rules that independently describe these capabilities. Host concurrency enforcement remains active; this choice removes an advance numeric hint from the main policy text.

### Normalize visible descriptions with Skill command candidates

The default Skill list does not encode recoverable field boundaries. One Skill with description `First\n- beta: Second` can render like two separate Skills. Version pinning and a `- <name>:` line pattern cannot detect every such ambiguity.

When a recognized nonempty Skill catalog is present, use the current public `pi.getCommands()` entries with `source: "skill"` as auxiliary metadata. OMP names those commands `skill:<name>` and supplies their descriptions and paths. Do not load the paths or rescan resources. Skill commands may be disabled, and their metadata includes hidden Skills without exposing the `hide` field. The event catalog remains authoritative for what is visible.

Treat the ordered Skill command metadata as candidates. Permit unused candidates, including hidden Skills, and require exactly one complete correspondence between the event catalog and an ordered selection of candidates under the reviewed 18.1.11 rendering format. Match every visible name, entry order, and rendered description, establishing unambiguous description spans before changing any bytes. Matching must account for host formatting without importing private builders or copying upstream templates. The complete event catalog must be covered; do not infer visibility or description boundaries from names or list-shaped lines alone. Extra hidden candidates are not themselves a reason to skip normalization.

Within the matched event description spans, replace each run of whitespace with one ASCII space and trim its edges. This includes LF, CRLF, tabs, blank paragraphs, and Unicode line separators. Preserve all non-whitespace text, Skill names, entry ordering, and the visible set. Metadata establishes boundaries; it must not restore raw source text that differs from the host-rendered event. Each resulting catalog entry occupies one line. Do not modify Skill files, Skill bodies, rules, project content, or other dynamic descriptions.

A missing or supported empty Skill catalog stays absent or empty and needs no metadata correspondence. Do not add Skills from the command list. Recognized output already produced by this extension must not re-match its Skill catalog against command metadata, whether its catalog was normalized or retained verbatim after a Skill fallback. Parse both valid owned main-block shapes, with and without Delivery, and extract the same dynamic slots and retained blocks from either shape. Re-render the owned main block for the current `renderDelivery` target using those slots. If the target shape differs, switch only the Delivery shape and preserve the catalog and other retained blocks; do not require the host default block to be available again, and do not drop a catalog retained by Skill fallback. If the target shape already matches, keep the recognized output unchanged. Do not reject a valid owned output merely because its catalog still has multiline descriptions, or compare that catalog with command metadata again.

Once the complete outer Skill catalog has been uniquely delimited, missing or malformed metadata, disabled Skill commands, unsupported description formatting, ambiguous description correspondence, or earlier-handler edits that prevent matching leave the entire original catalog byte-for-byte unchanged. Do not normalize only the entries that happened to match. Continue the supported static-policy, tool, device, internal-resource, and PROJECT transformations. Do not retry with a text-only entry heuristic or enable Skill commands on the user's behalf. Failure to delimit the outer catalog safely remains a structural failure, as specified below.

### Preserve hidden Skills and manual invocation

Hidden Skills remain absent from the automatic system catalog and retain the host's `skill://<name>` access and, when Skill commands are enabled, user invocation through `/skill:<name>`. Their presence in command metadata must not prevent normalization of a uniquely matched visible catalog or application of the other prompt transformations. Do not change hide flags or command settings, remove plugins, or hardcode Skill-name exclusions to obtain a match.

Use the host's existing manual-invocation path. Preserve the invoked Skill's full body, user-supplied arguments, and user attribution; do not apply catalog description formatting to that message. Manual invocation does not require exposing the hidden Skill in the automatic catalog. The extension neither adds its own invocation mechanism nor bypasses disabled host commands.

### Separate Skill fallback from whole-prompt failure

Use the current `event.systemPrompt`, never a startup snapshot or `ctx.getSystemPrompt()` as a substitute for the handler-chain input. Process each turn independently. Load the owned template when the extension activates; template edits require reactivation or a new session, not a file watcher.

At the start of every `before_agent_start` turn, read the effective `renderDelivery` value for the current `ctx.cwd`. Treat only boolean `false` as disabled; use `true` for `true`, absence, read failure, or any other value. This decision applies to the replacement built for that turn.

Recognize the supported default main block and a unique PROJECT block without assuming PROJECT has a fixed index. Check anchor order, multiplicity, optional sections, and complete coverage of the target text. Every source region must be classified as recognized fixed policy, retained runtime content, or a known separator. Unknown nonempty regions must not disappear silently.

Treat embedded bodies as opaque data, not XML to deserialize or templates to render recursively. The checked whitespace-only change to catalog description spans is the specified exception. Reject ambiguous outer block or catalog boundaries; ambiguity confined to description correspondence uses the Skill fallback. Never apply a global replacement to all `skills` or `critical` tags. Neither text recognition nor metadata correspondence authenticates arbitrary input that imitates the host format.

Construct the replacement only after the main-block, PROJECT, and other structural checks succeed. Fill the Skill slot with either the fully normalized catalog or its complete verbatim input after a Skill fallback. Render the owned Delivery chapter when the current effective value is `true`; when it is `false`, omit exactly the range from `# Delivery` through the end of the final `## Pausing` body. Preserve array structure, relative block order, and unchanged text byte-for-byte relative to the event input. Do not promise to restore formatting that OMP already changed before emitting the event. Do not flatten the system blocks into one string or regenerate tool schemas from a different API.

Empty input stays empty. Reprocessing this extension's output must not duplicate content. Owned-output recognition and idempotency support both valid shapes, with and without the Delivery chapter. On every turn, evaluate the current effective setting so a configuration change takes effect on the next turn without duplicating or retaining stale Delivery text. Return no `systemPrompt` when there is no actual change. Unknown versions, custom prompts, malformed owned templates, missing or duplicate structural anchors, unknown target sections outside a preserved Skill catalog, and ambiguous outer boundaries leave the entire incoming array unchanged. A Skill fallback cannot authorize replacement across an unrecognized structural boundary. Failure to match descriptions inside a uniquely identified catalog does not prevent the other transformations.

Distinguish an applied replacement with Skill formatting skipped from a replacement not applied because of a whole-prompt failure. Report the affected scope and a bounded reason without prompt bodies or private context; a Skill-only diagnostic must not say that the entire replacement was not applied. Use the host notification channel when interactive and its logging facility otherwise. Deduplicate identical diagnostics within each session without conflating the two failure scopes. Neither fallback blocks a model request, and later handlers may still overwrite an applied replacement.

### State the coverage boundary

The extension applies to ordinary main-session turns and ordinary subagent turns that rebind the parent's extensions. Preserve each child's role, yield protocol, and independent blocks. Restricted-tool and plan-mode subagents load no extensions and remain outside coverage.

Handoff generation uses the base prompt and title generation uses its own path. Neither is covered by this turn hook. Ephemeral side requests such as `/btw` do not independently run the hook; they use the live Agent prompt and may reuse an override active at that moment. Do not describe them as always using the base prompt or promise an independently refreshed replacement. Do not add provider-payload patches to imitate a global replacement hook.

The override lasts for one agent turn, not one provider request. Host rebuilds during a turn preserve the override, so a transformed catalog describes turn-start assembly rather than guaranteed immediate updates. Current tool definitions and host capability notices remain authoritative; the next start event transforms the new input.

Earlier extensions' independent blocks remain intact. An earlier edit that makes an outer target structure unrecognizable causes a diagnostic and no replacement. An edit confined to a safely isolated Skill catalog that prevents description correspondence uses only the Skill fallback. Later handlers can overwrite the result. Do not reorder other extensions or claim final-provider precedence.

## Alternatives considered

### Use a CLI flag

A CLI flag would affect one invocation, would not persist the choice, and would not provide a project-level override. It does not meet the requirement for a durable user setting that projects can shadow, so it was rejected.

### Use a component-owned config file or parse the lockfile

A component-owned file would create a second configuration source. Parsing `omp-plugins.lock.json` or another host file directly would copy OMP's configuration responsibility and bypass the public API. Both approaches were rejected in favor of the native plugin setting and public effective-settings lookup.

## Acceptance criteria

1. The package installs and loads through native OMP mechanisms on unmodified 18.1.11. Its documentation states the exact version, format, session, metadata, fallback, and extension-order boundaries. No private files, host patches, or other repository components are required.
2. Successful output follows the specified identity text, section order, tool and device headings, URI introduction handling, and the two Agent coordination paragraphs. With effective `renderDelivery` true, absent, or safely defaulted, it includes the complete `# Delivery` chapter. With `false`, it omits exactly the range from that heading through the final `## Pausing` body, including Task scope, Completion, Evidence, and Pausing. Other owned chapters, dynamic slots, PROJECT content, and independent instructions remain intact. No removed host Delegation fragment is relocated into another owned slot. Actual tool descriptions and runtime notices remain intact.

3. Supported native-tool, inline-descriptor, and Code Mode inputs preserve actual access paths and complete required descriptors. Conditional devices, rules, Skills, modes, and URI entries reflect host input rather than bundled examples.
4. A unique complete correspondence with ordered command candidates permits single-line descriptions for LF, CRLF, tabs, blank paragraphs, and Unicode line separators, preserving non-whitespace text, names, order, and the visible set. Unused hidden candidates do not prevent this success or enter the output. Metadata that distinguishes a continuation from a genuine next entry produces the corresponding correct result. Source files and full Skill bodies are unchanged.
5. With a safely isolated nonempty catalog, disabled Skill commands, unavailable or malformed metadata, unsupported description formatting, ambiguous description correspondence, or an incompatible earlier edit preserve the entire original Skill catalog while the other supported prompt transformations apply. Do not normalize a matching subset of entries. Diagnostics identify only Skill formatting as skipped. Missing or supported empty catalogs require no metadata. If an outer structural check also fails, preserve the entire input and report whole-prompt non-application instead. No hidden Skill is added, no text-only guess is used, and host command settings remain unchanged.
6. Outside the specified catalog whitespace change, code, XML-like text, template-like strings, rule bodies, tool and device descriptions, loaded project bodies, append text, Computer Safety, Memory and MCP content, active-repository context, subagent instructions, and unrelated extension blocks retain their text and ordering. PROJECT changes are limited to its outer heading, specified loading statements, and host-owned critical block.
7. Empty input, repeated processing, consecutive turns, mode changes, handler chaining, and changes to `renderDelivery` do not duplicate content, restore stale input, or leave a stale Delivery chapter. Recognized owned output is a no-op when its Delivery shape matches the current effective setting. When it does not match, preserve the recognized dynamic slots and other blocks, switch only the Delivery shape, and return the changed output. Fresh host input is evaluated independently on each turn. Unsupported versions, custom paths, and unrecognized outer structures visibly remain unmodified.

8. Real OMP execution verifies final provider-facing content for main and ordinary subagent turns, the restricted-subagent and Handoff boundaries, side requests with and without an active turn override, mid-turn rebuild behavior, and device notifications. Manually invoke a hidden Skill with host commands enabled and verify its full body, arguments, and user attribution in the request, its absence from the automatic catalog, and continued prompt replacement. A handler return value alone is not sufficient evidence.
9. A representative configured-host scenario includes enabled plugins, their visible and hidden Skills and devices, and externally managed components with working paths. With Skill commands enabled, it must demonstrate successful owned-policy and PROJECT replacement and visible-description normalization despite hidden command candidates. Do not remove plugins or change hide flags to obtain success. Record host input, command metadata, handler output, final provider content, and diagnostics from the same run to detect missing or added capabilities. Exercise Skill fallback separately and verify that the other replacements still reach the Provider; fallback cases do not substitute for the representative success case. A minimal scenario includes only the model configuration needed for its request. Label partial environments as partial; private inventories and prompt captures stay out of public artifacts.
10. Behavioral checks exercise analysis-only requests, requested prototypes, project-specific compatibility requirements, authorization boundaries, justified pauses, honest verification claims, quoted control tags, genuine runtime notices, and changed workspace context. Use the configured `pro-20x` channel's `luna` model when model execution is authorized. Record each scenario's input, expected behavior, observed actions or replies, and result. Confirm the owned prompt was applied on covered paths before using model behavior as evidence for that policy; request capture or a confirmation token alone is insufficient. Record observed scope without claiming a security guarantee.
11. Component checks and the repository's `pnpm check` pass before release. Public documentation reports verified behavior, successful hidden-Skill support, Skill-only fallback, and whole-prompt fallback in the exercised scenarios without private prompt captures. Do not make the extension a daily default while required runtime or behavioral checks remain unverified.
12. `package.json` declares `renderDelivery` under `omp.settings` as a boolean with default `true`. Documentation shows the native `omp plugin config` command and `.omp/plugin-overrides.json` project override. Every `before_agent_start` turn reads the public effective-settings API for the current cwd; read failures and non-boolean values preserve Delivery, emit a bounded session-deduplicated diagnostic, and do not block the model request.

## Risks

The event exposes text without provenance or structured field boundaries. A host format change or embedded imitation can lead to incorrect slicing and loss of instructions. Exact version checks, unique complete catalog correspondence with command candidates, complete outer target coverage, ambiguity handling, and preservation tests reduce this risk but do not turn text recognition into a security boundary. Pure text cannot reveal every ambiguity in the original Skill structure.

Whole-prompt fallback can leave default policy active when the user expected the owned prompt. Skill-only fallback instead leaves catalog descriptions unnormalized while the owned policy applies. Diagnostics that confuse these states can misrepresent which policy is active. Verify and document both outcomes separately; the extension must not claim to block requests.

Skill command metadata can be absent or contain entries hidden from the prompt. Selecting candidates without validating the entire visible catalog can misclassify a continuation or expose a hidden Skill. Require a unique complete correspondence and retain the original catalog when it cannot be established. Skill-local preservation depends on a reliable outer boundary; if that boundary is uncertain, preserving a guessed span is unsafe and whole-prompt fallback remains necessary.

Removing the main prompt's Cap hint can lead the model to queue more work than it intended. The host still enforces its concurrency setting, but the Task tool schema does not supply the same current numeric hint. Verify that coordination remains usable without implying that the removal has no information cost.

A turn override remains active through mid-turn base rebuilds. Its catalog may become stale until the next turn, and OMP resets `baseXdevCatalogDelivered` on replacement, potentially repeating device notices. Final-request and tool-change checks must establish that capabilities remain usable without adding a second device-state manager.

Normal turns, Handoff, and other side requests can follow different static policies; ephemeral requests can also inherit whichever live prompt is active. Later extensions can replace the owned output. Coverage and ordering documentation must make these differences visible.

Changing instruction-source wording can affect recognition of genuine host controls as well as quoted content. Prompt changes alone cannot prove correct provenance handling. Behavioral failures in either direction block adoption as the daily default.

An incorrect configuration read, precedence rule, or type check could leave an unexpected Delivery shape across turns. Per-turn reads through the public effective-settings API, exact boolean validation, the `true` fallback, transition checks for both owned-output shapes, and bounded diagnostics reduce this risk.

Disabling Delivery intentionally removes Task scope, Completion, Evidence, and Pausing. Users or project maintainers who expect the full delivery contract could miss those instructions if they set the option without understanding its exact boundary. The command and project-override examples must state that this is the complete chapter boundary.
