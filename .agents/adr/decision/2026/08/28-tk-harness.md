# tk Harness integration

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol, Ruokee
Reverses: [tk Harness integration](../../../archived/2026/08/28-r2-tk-harness.md)

English | [中文](./28-tk-harness.zh.md)

## Motivation

Expose six transport-independent tk operations through each Harness's component API, with the runtime owning request schema completeness and adapters validating registration contracts.

Codex, Claude Code, Pi, and OMP expose different registration and loading APIs but need one logical operation contract. Integration must reject incompatible runtimes before registration without terminating the surrounding Agent session when tk cannot load.

The runtime already shares handwritten schemas between MCP and native integrations. Requiring derivation from request types would add a schema-generation dependency without changing the public behavior. Requiring adapters to validate every request field would give them a second copy of domain contracts. Keep the shared declarations and make their manual synchronization responsibility explicit.

Tools mode needs one route for covered Task operations. Direct CLI retry after a logical refusal or failure would bypass the selected integration and can repeat a write with different transport behavior.

## Decision

Tk defines six transport-independent logical operations: search, read, create, update, log, and exec. MCP exposes them in the `tk` namespace. Pi and OMP register `tk_search`, `tk_read`, `tk_create`, `tk_update`, `tk_log`, and `tk_exec`.

The Rust runtime owns one handwritten request schema set shared by MCP and native integrations. Maintainers keep its fields, required inputs, defaults, and unions synchronized with the request types. Schemas are not derived from those types. Harness adapters map context and transport only; they do not duplicate Task validation, storage rules, search ranking, migration, installation, or semantic version range parsing.

The `tk` and `tk-zh` tools Skills use logical search, read, create, update, and log for covered requests. If a logical operation is missing, refused, or fails, the Agent reports the integration or transport failure and does not retry through direct CLI. Exec remains a controlled proxy for public CLI version, init, check, and rename commands.

Codex and Claude Code use MCP. Pi and OMP use native extensions. Pi sets no `loadMode`. OMP marks search, read, create, update, and log as `essential`; exec is `discoverable`. Pi and OMP start the fixed runtime directly without a shell. OMP passes its cancellation signal to the runtime.

Before native registration, adapters validate the fixed executable, version output, runtime compatibility range, native contract envelope, all six tool names and descriptions, each request schema's presence as an object, and host-specific fields. The runtime owns internal schema completeness; adapters do not check every property or union branch. An empty properties object can pass adapter preflight.

Preflight failure registers zero operations. A later `registerTool` failure stops registration and may leave the prefix already accepted by the Harness API. The adapter emits one bounded diagnostic and does not terminate the Harness session.

The current contract lives in [Harness integration](../../../../../projects/tk/docs/design/harnesses.md), the [tool API](../../../../../projects/tk/docs/design/tool-api.md), and the [tools Skill](../../../../../projects/tk/skills/tk/SKILL.md). The complete [tk specification set](../../../../spec/README.md#tk) states required tool behavior, Harness integration, Agent behavior, and acceptance. Component references and installed Skills remain independently usable and express the same contract; design explains implementation.

## Alternatives considered

- Derive schemas from request types. This can reduce manual duplication but adds a generation dependency and mapping work. The shared handwritten declarations preserve the existing runtime boundary without that mechanism.
- Validate every request field in adapters. This can reject an internally incomplete schema before registration, but duplicates domain contracts in each consumer. Keep completeness with the producer instead.

## Consequences

All tools-mode Harnesses share requests, schemas, domain rules, and unified results. Adapters retain compatibility checks, resource limits, context mapping, cancellation, load isolation, and transport failure reporting.

Request types and handwritten schemas can drift if a maintainer updates only one. Runtime maintenance must check both; adapter preflight does not detect all internal schema omissions.

A native registration failure can leave an accepted prefix. This is a Harness API boundary, not a transaction guarantee.
