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
- [Side-request context](https://github.com/can1357/oh-my-pi/blob/e3106be68f778635da3a17106835ce2e0e6992af/packages/agent/src/agent.ts#L773-L802) defaults to the live Agent prompt; callers such as Handoff can explicitly select the base prompt.
- [Task concurrency enforcement](https://github.com/can1357/oh-my-pi/blob/e3106be68f778635da3a17106835ce2e0e6992af/packages/coding-agent/src/task/index.ts#L574-L640) uses a session semaphore configured by `task.maxConcurrency`, independently of the prompt's Cap text.

## Proposal

### Distribute one self-contained extension

Add `projects/omp-system-prompt/` as the first-party package `@ruokee/omp-system-prompt`. Declare its entry through native `omp.extensions` metadata. Keep its runtime, maintainer-owned English prompt, checks, and bilingual README documentation inside the component. This follows the [first-party capability boundary](../decision/2026-08-20-establish-first-party-capability-kit.md) and [self-contained component contract](../decision/2026-08-24-keep-components-self-contained.md); neither decision needs reversal.

Use public OMP extension APIs. Do not import private prompt builders, rescan resources, duplicate context discovery, or vendor upstream templates. Do not require files from another repository component or a machine-specific installation. Use native installation, activation, disablement, and removal mechanisms. Do not write `SYSTEM.md` on the user's behalf.

Run on the unmodified OMP distribution. Do not patch upstream source or installed binaries, require a new upstream API, or replace the host with an SDK-owned session to satisfy this component's contract.

Start with an exact OMP `18.1.11` peer dependency and a runtime check against the public `VERSION` export. A matching version is necessary but not sufficient: every input must also pass the supported-format checks. Broader version support requires source review and validation rather than a speculative 18.x range.

### Separate static policy from runtime content

The owned prompt defines OMP identity, instruction-source boundaries, context interpretation, tool availability and recovery, authorized coordination, scope, evidence, and the distinction between completion and a justified pause. It must not assert that an XML name grants authority or that all user content has been sanitized. It is not a replacement for host-side message provenance or input security.

Leave engineering preferences, communication style, delegation defaults, compatibility choices, and verification workflows to applicable user and project rules. Do not copy or edit those rules automatically. Replace the recognized default personality, engineering, workflow, delivery, and unconditional continuation text with the owned contract.

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

Its top-level sections, in order, are `# Instruction sources`, `# Project context`, `# Runtime capabilities`, `# Agent coordination`, and `# Delivery`. Runtime capabilities contains Tool access, Tool devices, Internal resources, Skills, Rules, and Runtime modes in that order. Put the actual tool inventory below `### Tool inventory` under Tool access and the actual device catalog and inline documentation below `### Mounted devices` under Tool devices. Missing catalogs do not create example entries. Delivery contains Task scope, Completion, Evidence, and Pausing in that order. The separate PROJECT block supplies `# Project snapshot`.

Internal resources contains the owned URI guidance followed by the host's actual URI entries. Validate and discard the host's fixed `Most FS/bash tools auto-resolve these to FS paths.` introduction. Preserve the URI entries themselves. Review annotations and historical dynamic examples are not runtime prompt content.

Agent coordination contains exactly these two owned paragraphs:

```text
Delegate only as authorized by the user, applicable project rules, and active mode; available agent tools do not require delegation.

Provide each child its context, requirements, permissions, and expected result; do not assume shared conversation or loaded context. Use actual IDs, concurrency limits, channels, and retrieval protocols. Respect child restrictions; delegation cannot expand authorization. Accept results on evidence and required verification, not job completion alone. Track the whole deliverable and unresolved dependencies; child success is not overall completion.
```

Validate and consume the recognized host Delegation section without carrying its Cap text or additional `hub` communication item into any owned slot. Do not remove tool descriptions, runtime notices, child instructions, or user rules that independently describe these capabilities. Host concurrency enforcement remains active; this choice removes an advance numeric hint from the main policy text.

### Normalize descriptions with matching Skill metadata

The default Skill list does not encode recoverable field boundaries. One Skill with description `First\n- beta: Second` can render like two separate Skills. Version pinning and a `- <name>:` line pattern cannot detect every such ambiguity.

When a recognized nonempty Skill catalog is present, use the current public `pi.getCommands()` entries with `source: "skill"` as auxiliary metadata. OMP names those commands `skill:<name>` and supplies their descriptions and paths. Do not load the paths or rescan resources. Skill commands may be disabled, and their metadata includes hidden Skills without exposing the `hide` field. The event catalog remains authoritative for what is visible.

Require the complete ordered Skill command metadata to correspond to the complete event catalog under the reviewed 18.1.11 rendering format. Match names, order, and rendered description text, and establish unambiguous description spans before changing any bytes. Matching must account for host formatting without importing private builders or copying upstream templates. This contract does not support selecting or guessing a visible subset from a larger command list. Missing or malformed metadata, extra hidden entries, unsupported formatting, ambiguous spans, and earlier-handler edits that prevent correspondence cause the entire transformation to fall back. Do not retry with a text-only entry heuristic or enable Skill commands on the user's behalf.

Within the matched event description spans, replace each run of whitespace with one ASCII space and trim its edges. This includes LF, CRLF, tabs, blank paragraphs, and Unicode line separators. Preserve all non-whitespace text, Skill names, entry ordering, and the visible set. Metadata establishes boundaries; it must not restore raw source text that differs from the host-rendered event. Each resulting catalog entry occupies one line. Do not modify Skill files, Skill bodies, rules, project content, or other dynamic descriptions.

A missing or supported empty Skill catalog stays absent or empty and needs no metadata correspondence. Do not add Skills from the command list. Recognized output already produced by this extension remains unchanged without comparing its normalized descriptions against unnormalized metadata again.

Full-catalog matching is deliberately conservative: a hidden Skill or disabled Skill commands can prevent all prompt replacement for that turn. Describe this limit explicitly. Normalization is guaranteed only when correspondence and all other format checks succeed; fallback is not successful activation of the owned policy.

### Transform the event input atomically

Use the current `event.systemPrompt`, never a startup snapshot or `ctx.getSystemPrompt()` as a substitute for the handler-chain input. Process each turn independently. Load the owned template when the extension activates; template edits require reactivation or a new session, not a file watcher.

Recognize the supported default main block and a unique PROJECT block without assuming PROJECT has a fixed index. Check anchor order, multiplicity, optional sections, and complete coverage of the target text. Every source region must be classified as recognized fixed policy, retained runtime content, or a known separator. Unknown nonempty regions must not disappear silently.

Treat embedded bodies as opaque data, not XML to deserialize or templates to render recursively. The checked whitespace-only change to catalog description spans is the specified exception. Reject ambiguous candidate boundaries. Never apply a global replacement to all `skills` or `critical` tags. Neither text recognition nor metadata correspondence authenticates arbitrary input that imitates the host format.

Construct the replacement only after all checks succeed. Preserve array structure, relative block order, and unchanged text byte-for-byte relative to the event input. Do not promise to restore formatting that OMP already changed before emitting the event. Do not flatten the system blocks into one string or regenerate tool schemas from a different API.

Empty input stays empty. Reprocessing this extension's output must not duplicate content. Return no `systemPrompt` when there is no actual change. Unknown versions, custom prompts, malformed owned templates, missing or duplicate anchors, unknown target sections, ambiguous boundaries, and failed Skill metadata correspondence leave the entire incoming array unchanged. A Skill normalization failure also prevents static policy and PROJECT changes; never return a partially transformed prompt.

Report that replacement was not applied, with a bounded reason and no prompt bodies or private context. Use the host notification channel when interactive and its logging facility otherwise. Deduplicate identical diagnostics within each session. This fallback preserves the incoming prompt; it does not block the model request or guarantee that the owned policy is active.

### State the coverage boundary

The extension applies to ordinary main-session turns and ordinary subagent turns that rebind the parent's extensions. Preserve each child's role, yield protocol, and independent blocks. Restricted-tool and plan-mode subagents load no extensions and remain outside coverage.

Handoff generation uses the base prompt and title generation uses its own path. Neither is covered by this turn hook. Ephemeral side requests such as `/btw` do not independently run the hook; they use the live Agent prompt and may reuse an override active at that moment. Do not describe them as always using the base prompt or promise an independently refreshed replacement. Do not add provider-payload patches to imitate a global replacement hook.

The override lasts for one agent turn, not one provider request. Host rebuilds during a turn preserve the override, so a transformed catalog describes turn-start assembly rather than guaranteed immediate updates. Current tool definitions and host capability notices remain authoritative; the next start event transforms the new input.

Earlier extensions' independent blocks remain intact. An earlier edit that makes the target format unrecognizable causes a diagnostic and no replacement. Later handlers can overwrite the result. Do not reorder other extensions or claim final-provider precedence.

## Alternatives considered

### Use SYSTEM.md or the custom-prompt flag

This is the simpler native replacement path and participates in base assembly, including paths outside turn hooks. It does not preserve the required default runtime content in 18.1.11, and custom text does not receive recursive interpolation. Recreating omitted catalogs would duplicate host responsibilities. Do not choose it for this extension.

### Modify the shared OMP assembly or use an SDK-owned session

The shared builder has structured data, and an SDK-owned session offers a lower-level replacement callback. Both change the required independently installable extension on an unmodified host. They are outside this component's boundary, including when normalization or path coverage cannot be guaranteed. Such inputs remain unsupported with the documented fallback; they do not introduce an upstream-change prerequisite.

### Rewrite provider requests

The lower-level provider hook operates on provider payloads and has different coverage, including an unsupported devin-agent path in the documented host behavior. It adds provider-specific transformations without resolving the missing structured source data. Do not use it to compensate for turn-hook limits.

### Normalize descriptions using list syntax alone

Treating every `- <name>:` line as a new Skill works for descriptions that never imitate that syntax. It can silently turn a continuation into a visible Skill and cannot detect every violation. Require matching public metadata instead of adopting that source-text assumption.

### Preserve every catalog description unchanged

This avoids reconstructing description spans but leaves ordinary multiline entries unnormalized even when matching metadata is available. Use preservation when the transformation falls back, not as the successful output contract for supported inputs.

## Acceptance criteria

1. The package installs and loads through native OMP mechanisms on unmodified 18.1.11. Its documentation states the exact version, format, session, metadata, fallback, and extension-order boundaries. No private files, host patches, or other repository components are required.
2. Successful output follows the specified identity text, section order, tool and device headings, URI introduction handling, and the two Agent coordination paragraphs. No removed host Delegation fragment is relocated into another owned slot. Actual tool descriptions, runtime notices, and independent instructions remain intact.
3. Supported native-tool, inline-descriptor, and Code Mode inputs preserve actual access paths and complete required descriptors. Conditional devices, rules, Skills, modes, and URI entries reflect host input rather than bundled examples.
4. Complete matching Skill metadata permits single-line descriptions for LF, CRLF, tabs, blank paragraphs, and Unicode line separators, preserving non-whitespace text, names, order, and the visible set. Metadata that distinguishes a continuation from a genuine next entry produces the corresponding correct result. Source files and full Skill bodies are unchanged.
5. A nonempty catalog with disabled Skill commands, extra hidden metadata, missing metadata, unsupported formatting, ambiguous spans, or an incompatible earlier edit preserves the full input with a diagnostic. No hidden Skill is added and no text-only guess or partial static replacement is returned. Missing or supported empty catalogs remain unchanged without requiring metadata. Document fallback as non-activation.
6. Outside the specified catalog whitespace change, code, XML-like text, template-like strings, rule bodies, tool and device descriptions, loaded project bodies, append text, Computer Safety, Memory and MCP content, active-repository context, subagent instructions, and unrelated extension blocks retain their text and ordering. PROJECT changes are limited to its outer heading, specified loading statements, and host-owned critical block.
7. Empty input, repeated processing, consecutive turns, mode changes, and handler chaining do not duplicate content or restore stale input. Already-normalized owned output is a no-op. Unsupported versions, custom paths, and unknown target content visibly remain unmodified.
8. Real OMP execution verifies final provider-facing content for main and ordinary subagent turns, the restricted-subagent and Handoff boundaries, side requests with and without an active turn override, mid-turn rebuild behavior, and device notifications. A handler return value alone is not sufficient evidence.
9. A representative configured-host scenario includes enabled plugins, their Skills and devices, and externally managed components with working paths. Compare host input with final provider content to detect missing or added capabilities. A minimal scenario includes only the model configuration needed for its request. Label partial environments as partial; private inventories and prompt captures stay out of public artifacts.
10. Behavioral checks exercise analysis-only requests, requested prototypes, project-specific compatibility requirements, authorization boundaries, justified pauses, honest verification claims, quoted control tags, genuine runtime notices, and changed workspace context. Use the configured `pro-20x` channel's `luna` model when model execution is authorized. Record observed scope without claiming a security guarantee.
11. Component checks and the repository baseline pass before release. Public documentation reports verified behavior and fallback outcomes in the exercised scenarios without private prompt captures. Do not make the extension a daily default while required runtime or behavioral checks remain unverified.

## Risks

The event exposes text without provenance or structured field boundaries. A host format change or embedded imitation can lead to incorrect slicing and loss of instructions. Exact version checks, full-catalog metadata correspondence, complete target coverage, ambiguity rejection, and preservation tests reduce this risk but do not turn text recognition into a security boundary. Pure text cannot reveal every ambiguity in the original Skill structure.

Failing open to the incoming prompt can leave default policy active when the user expected the owned prompt. Visible diagnostics and explicit fallback documentation are necessary; the extension must not claim to block requests.

Skill command metadata can be absent or include entries hidden from the prompt. Full-catalog matching can therefore reject otherwise ordinary configurations and leave default policy active for the entire turn. Verify both successful normalization and these fallback cases; document the observed support limit instead of silently guessing a visible subset.

Removing the main prompt's Cap hint can lead the model to queue more work than it intended. The host still enforces its concurrency setting, but the Task tool schema does not supply the same current numeric hint. Verify that coordination remains usable without implying that the removal has no information cost.

A turn override remains active through mid-turn base rebuilds. Its catalog may become stale until the next turn, and OMP resets `baseXdevCatalogDelivered` on replacement, potentially repeating device notices. Final-request and tool-change checks must establish that capabilities remain usable without adding a second device-state manager.

Normal turns, Handoff, and other side requests can follow different static policies; ephemeral requests can also inherit whichever live prompt is active. Later extensions can replace the owned output. Coverage and ordering documentation must make these differences visible.

Changing instruction-source wording can affect recognition of genuine host controls as well as quoted content. Prompt changes alone cannot prove correct provenance handling. Behavioral failures in either direction block adoption as the daily default.
