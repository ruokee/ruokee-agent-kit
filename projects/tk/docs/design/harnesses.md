# Harness integration

[简体中文](./harnesses.zh.md)

## Harness definition

A Harness is the software environment around a model that enables it to run as an Agent. It includes the model interaction loop, system prompt, context management, tools, permissions, and hooks.

tk currently supports Codex, Claude Code, Pi, and OMP. Adding a Harness requires a self-contained component, installation and uninstallation paths, load validation, and isolation tests. It does not require changing the product definition of Harness.

## Components

A Harness component is a self-contained tk unit assembled and installed for one Harness, mode, and language selection. The Skill mapping is:

| Mode | Language | Skill |
| --- | --- | --- |
| `tools` | `en` | `tk` |
| `tools` | `zh` | `tk-zh` |
| `cli` | `en` | `tk-cli` |
| `cli` | `zh` | `tk-cli-zh` |

Tools-mode components contain the selected Skill and the Harness's tk integration. CLI-mode components contain the selected CLI Skill. Claude Code, Pi, and OMP also retain the native manifest needed to load it; Codex needs no manifest. CLI-mode components contain no MCP configuration or native tool extension. A component does not contain the runtime executable, another Harness's content, review materials, or product source code.

Files within a component directory may reference only one another. The component must not depend on the repository directory layout after installation.

## Codex

Tools mode installs the selected `tk` or `tk-zh` Skill and an MCP registration that points to the fixed user-level `tk mcp`. CLI mode installs `tk-cli` or `tk-cli-zh` and keeps the tk MCP registration absent.

The Skill and optional MCP registration may reside in different official Harness targets, but together they form the selected Codex component.

## Claude Code

Claude Code uses a self-contained Plugin that follows its native rules. Tools mode contains the selected tools Skill and MCP configuration for the fixed runtime. CLI mode contains the selected CLI Skill and omits MCP configuration. Both modes use the official Plugin lifecycle.

## Pi

Pi uses a self-contained Package. Tools mode contains the selected tools Skill and a native extension. CLI mode contains the selected CLI Skill and no extension registration.

The tools extension registers:

- `tk_search`
- `tk_read`
- `tk_create`
- `tk_update`
- `tk_log`
- `tk_exec`

Each call starts the fixed `tk` executable directly without using a shell. If a request has no cwd, it uses the Pi session directory. actor is injected only for update, log, or exec rename.

Pi does not set `loadMode`.

## OMP

OMP uses a separate self-contained Package with the same mode and language choices as Pi. Its tools extension provides the same six operations.

OMP uses the public API to set search, read, create, update, and log as essential. Only exec is discoverable.

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

For ordinary native tools, both successful results and valid domain failures are returned verbatim in the text content and structured `details`. A domain failure's nonzero CLI exit code does not turn its error envelope into an exception. Invalid envelopes, unexpected exit codes, process failures, and adapter cancellation remain exceptions. `tk_exec` keeps its separate raw stdout/stderr contract.

## Build-time assembly

Cargo builds use Rust assembly logic to generate multiple Harness component payloads and two Harness-independent CLI Skill payloads, one deterministic `tar.zst` archive, and one manifest. The Harness selections span four Harnesses, two modes, and two languages. Identical inputs must produce identical paths, file bytes, archive bytes, and manifests.

Harness assembly reads only the selected Harness source and one of the four self-contained Skill trees. The standalone payloads read only `tk-cli` or `tk-cli-zh`. Publishing, installation, and validation use the same Rust artifacts.

Rust assembly artifacts are the only component inputs used for publishing, installation, and validation.

## Skill selection

The Harness installation lifecycle selects, updates, and uninstalls all four Skill identities. The custom-root lifecycle selects only `tk-cli` and `tk-cli-zh`. Language selection is part of `tk install`; it is not a separate manual copy path.

## Validation requirements

All Harness selections must complete installation, loading, and uninstallation in isolated environments. Tools-mode validation confirms registration or native extension loading. CLI-mode validation confirms that no tk operation registration is present. OMP tools mode additionally completes one real tk call.

The two standalone CLI Skill payloads must complete isolated custom-root install, update, language switch, no_change, and uninstall. This path validates files and ownership boundaries, not real Harness loading. Real Harness validation for Codex, Claude Code, and Pi ends after successful loading and does not require a model session call.
