# Runtime architecture

[简体中文](./runtime.zh.md)

## Layers

The Rust runtime is divided into layers by responsibility:

| Layer | Responsibilities |
| --- | --- |
| Interface layer | CLI, MCP, generated tool schemas, and text and JSON output |
| Application layer | Request orchestration, project and Task resolution, preflight checks, commit ordering, and result aggregation |
| Domain layer | Task identity, names, lifecycle, relationships, search ranking, and authorization rules |
| Persistence layer | split/embed decoding and encoding, path safety, atomic replacement, and WAL |
| Maintenance layer | schema migration, representation switching, rename, check, GC, and component lifecycle |
| Harness adapters | Native tool mappings for Pi and OMP, with load error isolation |

Dependencies flow from the interface layer to the application and domain layers, then to the persistence layer. Harness adapters depend only on generated contracts and public process interfaces, not on private Rust modules.

## Process model

The following commands use short-lived processes:

- Task reads, writes, and searches;
- project initialization and checks;
- schema migration and representation switching;
- rename and GC;
- Harness component installation, update, and removal;
- schema generation and version output.

The MCP server serves exactly one stdio connection. It may retain immutable tool definitions, but it resolves cwd, the project, and the Task again for every call. The runtime does not cache the project graph or create a background index.

Each native tool call from Pi or OMP starts the public `tk` executable. Adapters do not invoke a shell or call hidden subcommands.

## Request context

The cwd for a project request is selected in this order:

1. cwd explicitly provided by the request;
2. the session directory provided by the Harness;
3. the runtime process directory.

A complete absolute Task path or material path may locate its own project and does not have to belong to the cwd project.

actor applies only to update, log, and rename requests that append to WAL. Direct CLI calls use `cli` by default. Native adapters prefer available model information and otherwise use the Harness name.

Context is never persisted as Task state.

## Project discovery and Git

Project discovery is separate from Git policy checks.

read, search, and check only locate the project and read state. Write operations run the shared Git policy check before the first persistent write. `git_policy=none` does not require Git to be installed.

Exact absolute paths first locate the project through the Task directory structure and bounded ancestor checks. Git projects use the Git root. Non-Git projects do not traverse without bounds to the file system root.

## Memory bounds

search processes candidates one at a time and retains at most the best 100 items needed for the final result. When `search_body=false`, it does not read body content.

check, relationship graphs, schema migration, and representation switching may use O(number of Tasks) memory when they genuinely require full-project information. The runtime does not claim that all project operations use constant memory.

Process stdout, stderr, tool schemas, WAL reads, and protocol frames have explicit byte or entry limits.

Each subprocess stream and each MCP JSON payload is limited to 1 MiB. Oversized MCP input closes the stdio transport. Oversized MCP output fails the transport instead of emitting a partial frame.

## Writes and cancellation

A single-file write responds to cancellation before atomic replacement. After atomic replacement begins, it completes the current replacement before returning a result.

Multi-target commands respond to cancellation between commit points. Cancellation before the first write leaves no persistent changes. Cancellation after a partial commit uses the same result boundary as a normal I/O failure: it reports completed and incomplete items without automatic rollback.

Normal Task writes do not use locks, leases, CAS, or automatic merging. Activity markers only block uncleaned project-level multi-target writes and do not provide general concurrency control.

## Failure boundaries

Expected errors use stable error codes, categories, messages, and structured details. Messages are intended for humans, and callers must not parse them to determine the error type.

- Request, context, configuration, policy, parsing, managed-file, invariant, conflict, storage, compatibility, and environment errors are expected failures.
- panic, impossible states, and internal encoding failures are internal.
- Errors after partial writes must include completed and incomplete items.
- A WAL append failure does not roll back metadata that has already been committed.
- Required I/O failures during check indicate that the scan is incomplete.

Exit codes use the current implementation mapping. 0 means success, and nonzero means failure or rejection. Error codes and categories express the specific reason instead of binding each error to a new numeric contract.

## Executable checks

On Linux, the fixed runtime and official Harness commands must:

- exist at the specified path;
- be regular files;
- have at least one executable bit set.

If process startup fails, the runtime preserves the operating system error and classifies it as environment.

## Harness adapters

Before registering the first tool, the Pi and OMP adapters complete:

1. fixed runtime checks;
2. version JSON decoding;
3. native tool contract decoding;
4. consistency checks between `runtime_compat` and the component declaration;
5. completeness checks for all six tool names and schemas.

Adapters do not parse semantic version ranges. Rust evaluates compatibility ranges during component installation.

The extension entry point catches a missing or non-executable runtime, invalid output, contract conflicts, missing tools, and registration errors. It emits one bounded error and completes loading normally without terminating the Harness session.

Validation failure before the first registration guarantees that zero tools are registered. If a `registerTool` call fails partway through registration, tools in the prefix already accepted by the Harness API may remain registered. The adapter does not claim rollback.

OMP marks search and exec as discoverable and all other tools as essential. Pi does not set a `loadMode` that is absent from its public API.

## Component builds and runtime sources

Cargo builds use a single Rust assembly implementation to generate four self-contained components from the English Skill and the source code for each Harness. Generation writes only to Cargo `OUT_DIR` and Cargo's own target directory.

The runtime uses embedded archives and manifests through `include_bytes!`. Installation does not access the network, start `curl`, or accept a local archive path.

## Version dimensions

| Version | Meaning |
| --- | --- |
| runtime version | Executable package version |
| CLI contract version | Version of the CLI, MCP, and native tool contracts |
| Task schema version | Current Task metadata version |
| component format version | Version of the embedded Harness component archive format |
| cleanup manifest version | Version of the minimal cleanup manifest format |

`tk --version --output json` uses `runtime_version`, `cli_contract_version`, `task_schema_version`, and `component_format_version`.

When `TK_SOURCE_REVISION` is set, component manifests use its value. Otherwise, they use `package-v<CARGO_PKG_VERSION>`. The build script does not invoke Git.
