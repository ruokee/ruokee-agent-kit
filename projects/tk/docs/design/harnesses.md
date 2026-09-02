# Harness integration

[简体中文](./harnesses.zh.md)

## Harness definition

A Harness is the software environment around a model that enables it to run as an Agent. It includes the model interaction loop, system prompt, context management, tools, permissions, and hooks.

tk currently supports Codex, Claude Code, Pi, and OMP. Adding a Harness requires a self-contained component, installation and uninstallation paths, load validation, and isolation tests. It does not require changing the product definition of Harness.

## Components

A Harness component is a self-contained tk unit assembled and installed for one Harness. Each component may contain:

- The authoritative English tk Skill;
- Native manifests required by an MCP, Plugin, extension, or Package;
- Native adapters for Pi or OMP;
- Static configuration required by the Harness.

A component must not contain runtime executables, a Chinese Skill, content for another Harness, review materials, or product source code.

Files within a component directory may reference only one another. The component must not depend on the repository directory layout after installation.

## Codex

The Codex component installs:

- One English tk Skill;
- An MCP registration that points to the fixed user-level `tk mcp`.

The Skill and MCP registration may reside in different official Harness targets, but together they form the Codex component.

## Claude Code

The Claude Code component is a self-contained Plugin that follows Claude Code's native rules. It contains an English Skill and MCP configuration that points to the fixed runtime. The component is installed and uninstalled through the official Plugin lifecycle.

## Pi

The Pi component is a self-contained Package containing an English Skill and a native extension.

The extension registers six tools:

- `tk_search`
- `tk_read`
- `tk_create`
- `tk_update`
- `tk_log`
- `tk_exec`

Each call starts the fixed `tk` executable directly without using a shell. If a request has no cwd, it uses the Pi session directory. actor is injected only for update, log, or exec rename.

Pi does not set `loadMode`.

## OMP

The OMP component is a self-contained Package containing an English Skill and a native extension. It provides the same six tools as Pi.

OMP uses the public API to set:

- read, create, update, and log as essential;
- search and exec as discoverable.

Only OMP uses `loadMode`. The adapter passes the OMP cancellation signal to the runtime.

## MCP

Codex and Claude Code use `tk mcp`. Users may configure MCP separately for Pi and OMP, but the native components do not install or manage that external MCP configuration.

The MCP server exposes six protocol tools: `search`, `read`, `create`, `update`, `log`, and `exec`. The schema is generated from Rust request types.

## Native schema

Pi and OMP use the output of `tk schema generate --type native --harness <pi|omp>`. The generation contract defines:

- Tool names and descriptions;
- JSON schema types and default values;
- Harness-specific schema wrappers;
- OMP `loadMode`.

Adapters must not maintain a second handwritten schema or flatten structures such as `oneOf` into different semantics.

## Adapter loading

Before registering the first tool, the extension entry point completes all of the following preflight checks:

1. The fixed runtime path exists;
2. The path is a regular file with a Unix executable bit;
3. The version JSON can be parsed;
4. Rust determines that the runtime version satisfies the component's `runtime_compat`;
5. The native schema can be parsed;
6. All six tool names, request schemas, and Harness-specific fields are complete.

If the runtime is missing or not executable, the version is incompatible, the manifest or schema is invalid, or a mapping is incorrect, the entry point catches the error, emits one bounded diagnostic, and stops loading. It must not terminate the Harness session.

If preflight fails, zero tools are registered. If a `registerTool` call fails partway through registration, the adapter stops subsequent registration and reports the error. Any prefix of tools already accepted by the Harness may remain registered. The adapter must not claim rollback guarantees that it cannot provide.

## Tool calls

The adapter performs each call in this order:

1. Select cwd from the request, session directory, and process directory;
2. Select actor only for requests that write WAL;
3. Mechanically map the logical request to public CLI argv;
4. Start `tk` directly without using a shell;
5. Read bounded stdout and stderr concurrently;
6. Decode the uniform JSON result;
7. Report process or output failures as transport errors.

The adapter does not implement Task validation, name normalization, authorization, path resolution, migration, GC, compatibility-range parsing, or installation logic.

## Build-time assembly

Cargo builds use Rust assembly logic to generate component trees, deterministic `tar.zst` archives, and manifests for all four Harnesses. Identical inputs must produce identical paths, file bytes, archive bytes, and manifests.

Assembly reads only the current component's own source files and the authoritative English Skill. Publishing, installation, and validation use the same Rust artifacts.

Rust assembly artifacts are the only component inputs used for publishing, installation, and validation.

## Skill languages

Embedded components install only the English Skill. The Chinese Skill is a complete, semantically equivalent alternative that users may install manually through the official Harness mechanism. tk does not select, update, or uninstall this external Chinese Skill.

## Validation requirements

All four Harnesses must complete real installation, loading, and uninstallation in isolated environments. Only OMP must additionally complete one real tool call.

Real validation for Codex, Claude Code, and Pi ends after successful loading. It does not require calling tk through a real model session.
