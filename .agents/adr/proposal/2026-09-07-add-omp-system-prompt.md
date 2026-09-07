# ADR proposal: Add an OMP system prompt extension

Decision owner: Ruokee
Draft writer: OMP GPT-6 Astra

English | [中文](./2026-09-07-add-omp-system-prompt.zh.md)

## Motivation

OMP's default system prompt combines runtime capabilities with engineering preferences, delegation policy, personality, a fixed workflow, and unconditional continuation requirements. A maintainer-owned prompt should describe the runtime and an honest delivery contract while leaving working methods and engineering choices to applicable user and project rules.

A static `SYSTEM.md` does not preserve the default assembly contract. In OMP 18.1.11, the custom wrapper retains some context and resource information but omits the default tool inventory, internal-resource catalog, and device documentation. Its inserted text is not recursively rendered as a template.

The public `before_agent_start` event instead supplies the rendered `systemPrompt: string[]` and accepts a replacement array. It supports a separately distributed extension without modifying OMP. It does not expose the complete structured template data, so this approach needs explicit format and coverage limits.

The evidence baseline is OMP `v18.1.11`, commit `e3106be68f778635da3a17106835ce2e0e6992af`:

- [Prompt assembly](https://github.com/can1357/oh-my-pi/blob/e3106be68f778635da3a17106835ce2e0e6992af/packages/coding-agent/src/system-prompt.ts#L988-L1055) builds separate main, optional safety, PROJECT, and optional active-repository blocks.
- [Extension chaining](https://github.com/can1357/oh-my-pi/blob/e3106be68f778635da3a17106835ce2e0e6992af/packages/coding-agent/src/extensibility/extensions/runner.ts#L1715-L1766) passes each replacement to the next handler.
- [PROJECT template](https://github.com/can1357/oh-my-pi/blob/e3106be68f778635da3a17106835ce2e0e6992af/packages/coding-agent/src/prompts/system/project-prompt.md) contains both contextual data and fixed instructions, with optional append text after its final critical block.

## Proposal

### Distribute one self-contained extension

Add `projects/omp-system-prompt/` as the first-party package `@ruokee/omp-system-prompt`. Declare its entry through native `omp.extensions` metadata. Keep its runtime, maintainer-owned English prompt, checks, and bilingual README documentation inside the component. This follows the [first-party capability boundary](../decision/2026-08-20-establish-first-party-capability-kit.md) and [self-contained component contract](../decision/2026-08-24-keep-components-self-contained.md); neither decision needs reversal.

Use public OMP extension APIs. Do not import private prompt builders, rescan resources, duplicate context discovery, or vendor upstream templates. Do not require files from another repository component or a machine-specific installation. Use native installation, activation, disablement, and removal mechanisms. Do not write `SYSTEM.md` on the user's behalf.

Start with an exact OMP `18.1.11` peer dependency and a runtime check against the public `VERSION` export. A matching version is necessary but not sufficient: every input must also pass the supported-format checks. Broader version support requires source review and validation rather than a speculative 18.x range.

### Separate static policy from runtime content

The owned prompt defines OMP identity, instruction-source boundaries, context interpretation, tool availability and recovery, authorized coordination, scope, evidence, and the distinction between completion and a justified pause. It must not assert that an XML name grants authority or that all user content has been sanitized. It is not a replacement for host-side message provenance or input security.

Leave engineering preferences, communication style, delegation defaults, compatibility choices, and verification workflows to applicable user and project rules. Do not copy or edit those rules automatically. Replace the recognized default personality, engineering, workflow, delivery, and unconditional continuation text with the owned contract.

Preserve runtime content already selected and rendered by OMP:

- Actual tool names, wire names, native or inline descriptors, device catalogs and inline documentation, and conditional internal-resource entries.
- Skill catalogs, always-apply rule bodies, and conditional rule catalogs, including their original ordering, filtering, and text.
- Enabled Computer Use and Scratchpad constraints, intent-field and opaque-token protocols, specialized-tool and AST routing, enabled automatic-QA instructions, and the rendered concurrency limit and communication capabilities. Do not retain delegation preferences merely because they are conditional.
- PROJECT environment, loaded file bodies, discovered-but-unloaded paths, workspace trees and roots, append text, and all independent system blocks, including Computer Safety and subagent role and yield instructions.

Keep Skill descriptions as rendered. Arbitrary multiline descriptions cannot be reconstructed losslessly from the list syntax exposed by the event. A continuation can resemble another Skill entry. This extension therefore does not promise one-line descriptions or change Skill source files.

In PROJECT, distinguish loaded bodies from merely discovered paths. Change only the recognized outer loading statements and remove only the host template's exact three-instruction critical block. Preserve file bodies and append text even when they contain similar tags or wording. Preserve the rest of PROJECT in place instead of duplicating it inside the new main block.

### Transform the event input atomically

Use the current `event.systemPrompt`, never a startup snapshot or `ctx.getSystemPrompt()` as a substitute for the handler-chain input. Process each turn independently. Load the owned template when the extension activates; template edits require reactivation or a new session, not a file watcher.

Recognize the supported default main block and a unique PROJECT block without assuming PROJECT has a fixed index. Check anchor order, multiplicity, optional sections, and complete coverage of the target text. Every source region must be classified as recognized fixed policy, retained runtime content, or a known separator. Unknown nonempty regions must not disappear silently.

Treat embedded bodies as opaque data, not XML to deserialize or templates to render recursively. Reject ambiguous candidate boundaries. Never apply a global replacement to all `skills` or `critical` tags. The format recognizer is not an authenticity check for arbitrary text that imitates the host format.

Construct the replacement only after all checks succeed. Preserve array structure, relative block order, and unchanged text byte-for-byte relative to the event input. Do not promise to restore formatting that OMP already changed before emitting the event. Do not flatten the system blocks into one string or regenerate tool schemas from a different API.

Empty input stays empty. Reprocessing this extension's output must not duplicate content. Return no `systemPrompt` when there is no actual change. Unknown versions, custom prompts, malformed owned templates, missing or duplicate anchors, unknown target sections, and ambiguous boundaries leave the entire incoming array unchanged.

Report that replacement was not applied, with a bounded reason and no prompt bodies or private context. Use the host notification channel when interactive and its logging facility otherwise. Deduplicate identical diagnostics within each session. This fallback preserves the incoming prompt; it does not block the model request or guarantee that the owned policy is active.

### State the coverage boundary

The extension applies to ordinary main-session turns and ordinary subagent turns that rebind the parent's extensions. Preserve each child's role, yield protocol, and independent blocks. Restricted-tool subagents load no extensions and remain outside coverage.

Handoff generation, title generation, and ephemeral side requests that use the base prompt remain outside coverage. Do not add provider-payload patches to imitate a global replacement hook.

The override lasts for one agent turn, not one provider request. Host rebuilds during a turn preserve the override, so a transformed catalog describes turn-start assembly rather than guaranteed immediate updates. Current tool definitions and host capability notices remain authoritative; the next start event transforms the new input.

Earlier extensions' independent blocks remain intact. An earlier edit that makes the target format unrecognizable causes a diagnostic and no replacement. Later handlers can overwrite the result. Do not reorder other extensions or claim final-provider precedence.

## Alternatives considered

### Use SYSTEM.md or the custom-prompt flag

This is the simpler native replacement path and participates in base assembly, including paths outside turn hooks. It does not preserve the required default runtime content in 18.1.11, and custom text does not receive recursive interpolation. Recreating omitted catalogs would duplicate host responsibilities. Do not choose it for this extension.

### Modify the shared OMP assembly or use an SDK-owned session

The shared builder has structured data and is better suited to lossless description normalization and consistent coverage across request paths. An SDK-owned session also offers a lower-level replacement callback. Both change the distribution or host-ownership requirement beyond a separately installable extension. Prefer them if complete path coverage or arbitrary structured rewriting becomes mandatory.

### Rewrite provider requests

The lower-level provider hook operates on provider payloads and has different coverage, including an unsupported devin-agent path in the documented host behavior. It adds provider-specific transformations without resolving the missing structured source data. Do not use it to compensate for turn-hook limits.

## Acceptance criteria

1. The package installs and loads through native OMP mechanisms on 18.1.11. Its documentation states the exact version, format, session, fallback, and extension-order boundaries. No private files or other repository components are required.
2. Supported native-tool, inline-descriptor, and Code Mode inputs preserve actual access paths and complete required descriptors. Conditional devices, rules, Skills, modes, and URI entries reflect host input rather than bundled examples.
3. Multiline descriptions, code, XML-like text, and template-like strings remain unchanged as data. Ambiguous boundaries and unknown target content preserve the full input with a diagnostic, not a partial result.
4. Loaded project bodies, append text, Computer Safety, Memory and MCP content, active-repository context, subagent instructions, and unrelated extension blocks retain their text and ordering. Only the specified outer PROJECT statements and host-owned critical block change there.
5. Empty input, repeated processing, consecutive turns, mode changes, and handler chaining do not duplicate content or restore stale input. Unsupported versions and custom paths visibly remain unmodified.
6. Real OMP execution verifies final provider-facing content for main and ordinary subagent turns, the non-covered restricted-subagent and side-request paths, mid-turn rebuild behavior, and device notifications. A handler return value alone is not sufficient evidence.
7. Behavioral checks exercise analysis-only requests, requested prototypes, project-specific compatibility requirements, authorization boundaries, justified pauses, honest verification claims, quoted control tags, genuine runtime notices, and changed workspace context. Use the configured `pro-20x` channel's `luna` model when model execution is authorized. Record observed scope without claiming a security guarantee.
8. Component checks and the repository baseline pass before release. Public documentation reports verified behavior without private prompt captures. Do not make the extension a daily default while required runtime or behavioral checks remain unverified.

## Risks

The event exposes text without provenance or structured field boundaries. A host format change or embedded imitation can lead to incorrect slicing and loss of instructions. Exact version checks, complete target coverage, ambiguity rejection, and preservation tests reduce this risk but do not turn text recognition into a security boundary.

Failing open to the incoming prompt can leave default policy active when the user expected the owned prompt. Visible diagnostics and explicit fallback documentation are necessary; the extension must not claim to block requests.

A turn override remains active through mid-turn base rebuilds. Its catalog may become stale until the next turn, and OMP resets `baseXdevCatalogDelivered` on replacement, potentially repeating device notices. Final-request and tool-change checks must establish that capabilities remain usable without adding a second device-state manager.

Normal turns and base-prompt side requests can follow different static policies, while later extensions can replace the owned output. Coverage and ordering documentation must make these differences visible.

Changing instruction-source wording can affect recognition of genuine host controls as well as quoted content. Prompt changes alone cannot prove correct provenance handling. Behavioral failures in either direction block adoption as the daily default.
