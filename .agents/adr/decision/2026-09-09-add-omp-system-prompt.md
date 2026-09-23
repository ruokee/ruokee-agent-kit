# ADR decision: Add an OMP system prompt extension

Decision owner: Ruokee
Decision writer: OMP
Reverses: [Add an OMP system prompt extension](../archived/2026-09-07-add-omp-system-prompt.md)

English | [中文](./2026-09-09-add-omp-system-prompt.zh.md)

## Motivation

`@ruokee/omp-system-prompt` replaces fixed policy in OMP's rendered system prompt while preserving selected runtime content. The public `before_agent_start` event provides the current `systemPrompt: string[]`, and public extension APIs provide effective plugin settings and Skill command metadata. This permits a self-contained extension without patching OMP or copying its private prompt builders.

## Analysis

The peer dependency and runtime activation are not tied to a specific OMP release. Pinned dev dependencies provide a reproducible test fixture; their versions do not define compatibility. The transformer checks the full target structure before it returns a replacement. Those checks are the compatibility boundary.

## Decision

### Distribute one self-contained extension

Place the package, owned English prompt, runtime code, tests, and bilingual public documentation in `projects/omp-system-prompt/`. Declare the entry through native `omp.extensions` metadata. Use the unmodified OMP distribution and public extension APIs only. Do not import private prompt builders, rescan resources, vendor upstream templates, patch installed files, create an SDK-owned replacement session, or write `SYSTEM.md` for the user.

Declare `@oh-my-pi/pi-coding-agent` as a peer dependency without a version restriction. Do not read the host version to decide installation eligibility, activation, transformation, diagnostics, or fallback. A fixed dev dependency may reproduce a tested host fixture, but it is verification evidence only and never a support boundary.

### Transform the current turn input

Register `before_agent_start` and process the current `event.systemPrompt` on every ordinary covered turn. Never substitute a startup snapshot or `ctx.getSystemPrompt()` for the handler-chain input. Load the owned template once at activation. Earlier independent blocks remain in place, and later handlers may replace this handler's result.

Recognize exactly one supported default main block and one structurally valid PROJECT block without assuming fixed array indexes. Check anchor order, multiplicity, optional sections, required and conditional fixed text, known separators, and complete target coverage. Treat embedded bodies as opaque data. Construct output only after the outer checks succeed, and return no `systemPrompt` when the validated output would not change.

Rebuild the main block from the owned template. Preserve host-rendered tool and device catalogs, Internal URL entries, always-apply and domain rules, supported runtime-mode protocols, and every independent block. Validate and consume the host Delegation policy without copying its fixed policy text into an owned slot. Rewrite only the defined PROJECT wrapper text and fixed outer critical tail; preserve context bodies, paths, workspace data, append text, and unrelated blocks byte-for-byte.

Recognize output previously produced by this extension only after validating its complete owned skeleton and PROJECT structure. Support both Delivery shapes so repeated turns are idempotent and a setting change switches only that chapter.

### Configure `renderDelivery`

Declare `omp.settings.renderDelivery` as boolean with default `true`. On every covered turn, read the effective value for `ctx.cwd` through the public `getPluginSettings(packageName, ctx.cwd)` API. Only exact boolean `false` omits the complete final `# Delivery` chapter, including Task scope, Completion, Evidence, and Pausing. `true` or an unset value includes it.

A settings read failure or non-boolean value uses `true`, reports the bounded settings diagnostic once per session and reason, and does not block the request. Do not parse OMP configuration files directly or add another configuration source.

### Preserve Skill behavior

The event catalog is authoritative for visible Skills. Use current `pi.getCommands()` entries with `source: "skill"` only as ordered candidates for description boundaries. Use names, order, and descriptions; ignore paths and do not rescan resources or add hidden candidates to the output.

Normalize visible description whitespace only when the complete catalog has one unique ordered correspondence with command candidates. Preserve names, order, visible membership, and non-whitespace text. If the outer Skill catalog is safely isolated but metadata is missing, malformed, ambiguous, disabled, or incompatible with the rendered text, preserve the entire catalog byte-for-byte and continue the other transformations. Report only `Skill catalog formatting skipped` for this local fallback. If the outer boundary itself is not reliable, treat it as a whole-prompt structural failure.

Hidden Skills stay absent from the automatic catalog while retaining host-provided resource and manual-command behavior. Manual Skill invocation keeps the full Skill body, arguments, and user attribution and does not pass through catalog-description formatting.

### Fail open with bounded diagnostics

Custom prompts, empty or malformed target structures, missing or malformed templates, unknown checked content, ambiguous outer boundaries, and invalid owned-output lookalikes leave the incoming block array unchanged. Report the bounded whole-prompt diagnostic through `ctx.ui.notify` in interactive sessions or the OMP logger otherwise. Do not include prompt bodies, Skill names, private paths, or session context. Deduplicate identical diagnostics within the session.

Wrap the normal per-turn settings, command-metadata, transformation, and result-handling path in the smallest exception boundary that preserves the host request. If that path throws unexpectedly, catch the exception, return `undefined` so the incoming prompt remains active, and report reason `unexpected-error` through the same tracker. Do not include the exception message or stack. The diagnostic reports that replacement was not applied; it must not claim to block the model request.

A missing or malformed activation-time template still registers the turn handler. Its first covered turn reports `template-unavailable` through the correct session channel and leaves the input unchanged.

### State coverage and evidence boundaries

The hook covers ordinary main-session turns and ordinary subagent turns that rebind the parent's extensions. Restricted-tool and plan-mode children do not load extensions. Handoff, title generation, and difficulty classification use separate paths. Ephemeral side requests such as `/btw` do not independently run the hook and may use the currently active Agent prompt. A turn override can survive a mid-turn host rebuild until the next turn. Device mount notices may repeat because replacement changes the host's delivered-base-catalog state.

Verification must distinguish these observable outcomes:

- Successful replacement reaches the final provider request with preserved runtime content.
- Structural failure and unexpected exception keep the exact incoming prompt active and emit the bounded whole-prompt diagnostic.
- Skill metadata failure preserves only the isolated catalog while the owned prompt and PROJECT rewrite still reach the provider.
- `renderDelivery` changes affect the next turn and preserve all other recognized content.
- Hidden Skill visibility and manual invocation remain host-controlled.

Component checks must exercise structural recognition, byte preservation, idempotency, both Delivery shapes, settings fallback, Skill success and local fallback, exception fallback, and diagnostic deduplication. Real-host checks must record the tested OMP release, host input, command metadata where relevant, handler result, final provider-facing content, and diagnostics from the same run. A handler return value alone is not provider evidence. Tested releases and fixed dev dependencies document only the exercised fixture; they do not create an installation, activation, or compatibility limit.

## Alternatives considered

### Require an exact OMP version

An exact-version requirement disables the extension before it examines a potentially compatible rendered prompt on any other version, so it does not meet the compatibility requirement.

### Maintain an allowlist of permitted OMP versions

An allowlist disables the extension on every unlisted release and adds recurring maintenance. Structural checks still have to run for permitted versions, so the allowlist adds no compatibility proof.

## Consequences

The extension attempts normal transformation whenever OMP loads it and the required public APIs are available. It transforms compatible rendered structures on releases outside the test fixtures, while incompatible structures and unexpected turn-processing errors leave the host prompt active.

Text recognition is not a provenance or security boundary. A later host may preserve recognizable syntax while changing API or section semantics. Real-host verification establishes only the observed behavior. Public documentation must identify the exercised fixture and each observation's scope precisely; it must not turn evidence into a supported-version table or exact compatibility promise.

Structural coverage and fail-open behavior are load-bearing: changes to recognized host structure, retained runtime sections, Skill matching, Delivery boundaries, or coverage paths require matching component checks and, where provider behavior matters, a real-host observation before release.

## Changes

### 2026-09-14: Append model-scoped prompt rules

The component also appends user-authored rule documents that match the turn's model. It reads `model-prompts` under the user and project agent directories and appends one block per matching file after the array the replacement step produced; a replacement failure still lets the append step extend the incoming host array. The replacement contract above stays unchanged, and the capability is recorded in [Add model-scoped prompt rules to the system prompt extension](./2026-09-14-add-model-prompt-rules.md).
