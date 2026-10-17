# Runtime architecture

[简体中文](./runtime.zh.md)

## Layers

The Rust runtime is divided into layers by responsibility:

- Interface layer: CLI, MCP, generated tool schemas, and text and JSON output.
- Application layer: request orchestration, project and Task resolution, preflight checks, commit ordering, and result aggregation.
- Domain layer: Task identity, names, lifecycle, relationships, search ranking, and authorization rules.
- Persistence layer: split/embed decoding and encoding, path safety, atomic replacement, and WAL.
- Maintenance layer: schema migration, representation switching, rename, check, GC, and component lifecycle.
- Harness adapters: native tool mappings for Pi and OMP, with load error isolation.

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

## Project resolution

Project discovery is separate from Git policy checks.

read, search, and check only locate the project and read state. Write operations run the shared Git policy check before the first persistent write. `git_policy=none` does not require Git to be installed.

Exact absolute paths first locate the project through the canonical top-level Task directory and bounded ancestor checks. The runtime then requires the path to belong to a Task in the carrier-based discovery graph. Git projects use the Git root. Non-Git projects do not traverse without bounds to the file system root.

## Memory bounds

Discovery builds one in-memory graph and may use O(number of Tasks) memory. search retains at most the best 100 result items and does not read body content when `search_body=false`.

The [data model](./data-model.md#candidate-identification) defines the per-scan directory and depth limits, what a scan skips, and the failure it returns.

check, relationship validation, schema migration, and representation switching reuse the discovered graph. The runtime does not claim that project operations use constant memory.

Process stdout, stderr, tool schemas, `tk read` WAL responses, frontmatter, and protocol frames have explicit byte or entry limits. Each subprocess stream and each MCP JSON payload is limited to 1 MiB. Oversized MCP input closes the stdio transport. Oversized MCP output fails the transport instead of emitting a partial frame. `tk check` separately streams complete WAL input without fixed total file, byte, or entry limits.

## Write behavior

A single-file write responds to cancellation before atomic replacement. After atomic replacement begins, it completes the current replacement before returning a result.

Multi-target commands respond to cancellation between commit points. Cancellation before the first write leaves no persistent changes. Cancellation after a partial commit uses the same result boundary as a normal I/O failure: it reports completed and incomplete items without automatic rollback.

Activity markers only block uncleaned project-level multi-target writes and do not provide general concurrency control.

## Failure boundaries

Expected errors use stable error codes, categories, messages, and structured details. Messages are intended for humans, and callers must not parse them to determine the error type.

- Request, context, configuration, policy, parsing, managed-file, invariant, conflict, storage, compatibility, and environment errors are expected failures.
- panic, impossible states, and internal encoding failures are internal.
- Errors after partial writes must include completed and incomplete items.
- A WAL append failure does not roll back metadata that has already been committed.
- A required I/O failure or cancellation during check makes the scan incomplete and identifies an I/O failure path when one exists.

Exit codes use the current implementation mapping. 0 means success, and nonzero means failure or rejection. Error codes and categories express the specific reason instead of binding each error to a new numeric contract.

## Executable checks

On Linux, the fixed runtime and official Harness commands must:

- exist at the specified path;
- be regular files;
- have at least one executable bit set.

If process startup fails, the runtime preserves the operating system error and classifies it as environment.

## Harness adapters

The extension entry point's preflight checks, failure behavior, and registration and rollback guarantees are defined in [Harness integration](./harnesses.md#adapter-loading). The loading marks for each adapter are defined in its [OMP](./harnesses.md#omp) and [Pi](./harnesses.md#pi) sections.

## Component assembly

Build-time assembly is defined in [Harness integration](./harnesses.md#assembly-at-build-time), and the embedded artifacts are defined in [Installation](./installation.md#embedded-payloads).

## Version dimensions

- runtime version: the executable package version.
- CLI contract version: the version of the CLI, MCP, and native tool contracts.
- Task schema version: the current Task metadata version.
- component format version: the version of the embedded Harness component and standalone CLI Skill archive format.
- cleanup manifest version: the version of the minimal cleanup manifest format.

`tk --version --output json` uses `runtime_version`, `cli_contract_version`, `task_schema_version`, and `component_format_version`.
