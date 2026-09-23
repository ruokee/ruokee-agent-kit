# ADR decision: Integrate tk tools with Harnesses

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol, Ruokee
Reverses: [Integrate tk with Harnesses](../archived/2026-08-28-integrate-tk-with-harnesses.md)

English | [中文](./2026-09-02-integrate-tk-tools-with-harnesses.zh.md)

## Motivation

Integrating tk with Codex, Claude Code, Pi, and OMP requires one logical operation contract, because these Harnesses expose different registration and loading APIs. The integration must reject incompatible runtimes before registration and must not terminate the surrounding Agent session when tk cannot load.

Tools mode also needs one unambiguous route for covered Task operations. Direct CLI retry after a logical refusal or failure would bypass the selected integration and can repeat a write with different transport behavior.

## Decision

tk defines six transport-independent logical operations: search, read, create, update, log, and exec. MCP exposes them in the `tk` namespace. Pi and OMP register `tk_search`, `tk_read`, `tk_create`, `tk_update`, `tk_log`, and `tk_exec`.

Rust generates MCP and native JSON schemas from the same request types. Harness adapters map context and transport only. They do not duplicate Task validation, storage rules, search ranking, migration, installation, or semantic version range parsing.

The `tk` and `tk-zh` tools Skills use the logical search, read, create, update, and log operations for covered requests. If a logical operation is missing, refused, or fails, the Agent reports the integration or transport failure and does not retry through the direct CLI. Exec remains a controlled proxy for public CLI version, init, check, and rename commands.

Codex and Claude Code use MCP. Pi and OMP use native extensions. Pi sets no `loadMode`. OMP marks search, read, create, update, and log as `essential`; exec is `discoverable`. Pi and OMP start the fixed runtime directly without a shell. OMP passes its cancellation signal to the runtime.

Before native registration, adapters validate the fixed executable, version output, Rust compatibility result, generated schema, and all six operations. Preflight failure registers zero operations. A later `registerTool` failure stops registration and may leave the prefix already accepted by the Harness API. The adapter emits one bounded diagnostic and does not terminate the Harness session.

The current contract lives in [Harness integration](../../../projects/tk/docs/design/harnesses.md), the [tool API](../../../projects/tk/docs/design/tool-api.md), and the [tools Skill](../../../projects/tk/skills/tk/SKILL.md).

## Alternatives considered

**Retry failed logical operations through the CLI.** This could hide integration failures and repeat requests across transports.

## Consequences

All tools-mode Harnesses share the same requests, schemas, domain rules, and unified results. Adapters remain thin but must enforce compatibility, resource limits, context mapping, cancellation, load isolation, and transport failure reporting.

A native registration failure can leave an accepted prefix. This is a Harness API boundary, not a transaction guarantee.
