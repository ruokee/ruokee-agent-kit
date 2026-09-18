# ADR decision: Integrate tk with Harnesses

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol
Archived: 2026-09-02
Reversed by: [Integrate tk tools with Harnesses](../decision/2026-09-02-integrate-tk-tools-with-harnesses.md)

English | [中文](./2026-08-28-integrate-tk-with-harnesses.zh.md)

## Motivation

The [tk product architecture](../decision/2026-08-21-define-tk-product-architecture.md) supports Codex, Claude Code, Pi, and OMP without moving Task semantics into Harness-specific code. These Harnesses expose different component, MCP, extension, Package, tool registration, and loading interfaces. They still need one logical tool set and one request and result contract.

A failed integration must not terminate the surrounding Agent session. At the same time, an adapter must reject an incompatible runtime or incomplete schema before it exposes tools that cannot honor the public contract.

## Decision

### Logical tools and schemas

tk defines exactly six transport-independent logical tools: search, read, create, update, log, and exec.

MCP exposes them as `search`, `read`, `create`, `update`, `log`, and `exec` in the `tk` namespace. Pi and OMP register `tk_search`, `tk_read`, `tk_create`, `tk_update`, `tk_log`, and `tk_exec`.

Rust generates MCP and native JSON schemas from the same request types. A Harness does not add request fields, change defaults, flatten schema structures, or duplicate domain validation. exec accepts only `--version`, `init`, `check`, and `rename`. actor is accepted only by update, log, and exec rename.

All tools return the runtime's unified JSON result. Adapters keep process startup, killed processes, malformed output, oversized output, and decoding failures separate from domain errors.

### Harness forms

Codex uses an English Skill and an MCP registration that starts the fixed `tk mcp` runtime. These installed parts form one Codex component without requiring an external Codex Plugin.

Claude Code uses a self-contained Plugin containing the English Skill and MCP configuration for the fixed runtime. It follows the official Plugin lifecycle.

Pi uses a self-contained Package with the English Skill and a native extension. The extension registers the six native tools and does not set `loadMode`.

OMP uses a separate self-contained Package with the English Skill and a native extension. It marks read, create, update, and log as essential, and search and exec as discoverable. OMP passes its cancellation signal to the runtime.

Pi and OMP may be configured separately to use MCP, but their tk Packages install and manage only the native integration.

### Adapter loading

Before registering the first native tool, an adapter validates all of the following:

1. `$HOME/.local/bin/tk` exists, is a regular file, and has a Unix executable bit;
2. version JSON is valid;
3. Rust reports a compatible runtime and component range;
4. the generated native schema is valid for the Harness;
5. all six tool names, descriptions, request schemas, and Harness-specific fields are present.

Preflight failure registers zero tools. The extension entry point catches the failure, emits one bounded diagnostic, and returns without terminating the Harness session.

If the Harness API rejects a `registerTool` call after accepting an earlier prefix, the adapter stops, reports the error, and leaves the accepted prefix as the Harness API defines it. The adapter does not claim rollback.

### Tool calls

Each native tool call selects cwd from the explicit request, Harness session directory, then process directory. It selects actor only for operations that append WAL, maps the logical request to public CLI arguments, starts `tk` directly without a shell, reads bounded stdout and stderr concurrently, and decodes the unified result.

Adapters do not implement Task parsing, name normalization, authorization, path resolution, search ranking, migration, GC, installation, or semantic version range parsing. Rust owns those rules.

The authoritative integration details live in [Harness integration](../../../projects/tk/docs/design/harnesses.md) and the [tool API](../../../projects/tk/docs/design/tool-api.md). Agent behavior lives in the [English Skill](../../../projects/tk/skills/tk/SKILL.md), with a complete [Chinese alternative](../../../projects/tk/skills/tk-zh/SKILL.md).

## Alternatives considered

**Use MCP for every Harness component.** Pi and OMP provide native tool APIs with session context, cancellation, and load metadata. Ignoring them would give those Harnesses a less direct integration while still requiring component-specific setup.

**Write a separate schema in each adapter.** Handwritten copies would drift in fields, defaults, unions, descriptions, and tool names. Rust-generated schemas keep one contract source.

**Implement Task rules in TypeScript adapters.** This would create host-specific behavior and repeat compatibility, validation, and error logic outside the runtime.

**Start the runtime through a shell.** Shell invocation would add quoting, command interpretation, and platform-specific behavior to a fixed executable call.

**Terminate the Harness when tk fails to load.** tk is one optional capability inside a larger session. A load error should disable tk and remain visible without taking down unrelated Agent work.

## Consequences

Codex and Claude Code use MCP while Pi and OMP receive native tools suited to their public APIs. All four still share the same logical requests, schemas, domain rules, and result envelope.

Adapters remain thin but are not trivial. They must enforce runtime and schema compatibility, resource limits, context mapping, load error isolation, and transport failure reporting.

Adding a Harness requires a self-contained component, generated or mapped schemas, lifecycle support, load validation, and isolation tests. It does not require another Task implementation or a change to the definition of Harness.

A registration failure can leave a prefix of native tools registered when the Harness API has already accepted them. This is an explicit API boundary, not a transaction guarantee.
