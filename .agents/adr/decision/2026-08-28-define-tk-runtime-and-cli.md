# ADR decision: Define the tk runtime and CLI

Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol

English | [中文](./2026-08-28-define-tk-runtime-and-cli.zh.md)

## Motivation

The [tk product architecture](./2026-08-21-define-tk-product-architecture.md) exposes the same Task behavior through a human CLI, stdio MCP, and native Harness tools. A single runtime must own request orchestration, domain rules, persistence, output, cancellation, and resource limits so that interfaces do not become separate implementations.

The runtime also needs a stable command boundary for scripts and adapters. It must report expected failures structurally without hiding transport failures, operating-system errors, or partial commits.

## Decision

### Language and executable

tk is implemented as one Rust Cargo package under `projects/tk/` and produces one executable named `tk`. The public Linux runtime path is `$HOME/.local/bin/tk`.

The runtime separates interface, application, domain, persistence, and maintenance responsibilities. Interfaces depend on public application and domain contracts. Harness adapters consume generated schemas and public process behavior rather than private Rust modules.

Most commands use a short-lived process. The MCP server serves one stdio connection and resolves cwd, project, and Task state again for every request. The runtime has no background process, project graph cache, or resident index.

### CLI contract

The public command tree is:

```text
tk search
tk read
tk create task
tk create subtask
tk update
tk log
tk init
tk check
tk rename
tk gc
tk schema generate
tk metadata migrate
tk metadata switch
tk mcp
tk install
tk uninstall
tk --version
```

`--actor` is not global. It belongs only to update, log, and rename operations that append WAL. `init --force` rewrites project configuration from the current explicit values and defaults without reading or changing Task data.

Human output and JSON output are both public. JSON uses one result envelope with `ok`, `data`, `warnings`, or `error`. Stable errors include a code, category, human message, and structured details. Callers branch on the code or category, not the message.

Exit codes keep one stable broad mapping. 0 is success. Request failures use 2, expected refusals use 3, storage and internal failures use 4, environment failures use 5, and cancellation before the first persistent write uses 130. Structured errors carry the detailed reason.

### Request context

A request selects cwd from an explicit value, then the Harness session directory, then the runtime process directory. A complete absolute Task path or material path may locate its own project independently of cwd.

actor is WAL attribution, not identity, authorization, or task assignment. Direct CLI writes default to `cli`. Context values are not persisted as Task state.

Project discovery and Git policy are separate. Reads, searches, and diagnostics locate and inspect a project without Git policy rejection. A persistent write runs the shared Git check immediately before its first write.

### Process and resource boundaries

The runtime bounds search candidates, process stdout and stderr, generated schemas, WAL reads, and protocol frames. Each subprocess stream and MCP JSON payload is limited to 1 MiB. Oversized MCP input closes the transport, and oversized output fails instead of emitting a partial frame.

Search processes candidates incrementally and keeps at most the best 100. Operations that require complete project knowledge, including checks, relationship graphs, migration, and representation switching, may use memory proportional to the number of Tasks.

A single-file write observes cancellation before atomic replacement. Once replacement starts, it finishes that replacement before returning. Multi-target commands observe cancellation between commit points. Cancellation before the first write leaves no persistent change. Cancellation after a commit point reports the same completed and uncompleted boundary as an I/O failure.

### Failure and version contracts

Expected domain and environment failures use the public result envelope. Panics, killed processes, malformed transport output, and broken protocol connections remain transport or internal failures. The runtime does not fabricate a domain result for them.

A WAL append failure is a warning after metadata commit. A required I/O failure during `check` reports an incomplete scan. A partial commit includes completed targets, uncompleted targets, and the original error.

The runtime publishes separate runtime, CLI contract, Task schema, component format, and cleanup manifest versions. `tk --version --output json` reports the runtime, CLI contract, Task schema, and component format versions needed by callers.

The complete command syntax lives in the [CLI reference](../../../projects/tk/docs/design/cli-reference.md). Runtime layering, resource limits, cancellation, and failure behavior live in the [runtime design](../../../projects/tk/docs/design/runtime.md).

## Alternatives considered

**Implement each interface separately.** Separate CLI, MCP, and native implementations would duplicate validation, defaults, error mapping, and compatibility behavior.

**Use a resident daemon.** A daemon would add process supervision, synchronization, cache invalidation, and service availability to a local file-based product.

**Expose private subcommands for adapters.** Hidden entry points would create a second process contract and allow Harness behavior to diverge from public CLI behavior.

**Encode every failure in a distinct exit number.** Numeric expansion would give scripts a second error taxonomy. Stable JSON codes and categories carry detail while exit codes retain broad shell semantics.

**Allow unbounded protocol and process output.** A malformed project or subprocess could exhaust a Harness session. Fixed limits make the failure boundary explicit.

## Consequences

Every interface shares one executable and one error model. Runtime changes can affect CLI, MCP, and native calls together, so generated contracts and compatibility checks must fail closed when they diverge.

Short-lived processes reread canonical state on every call. This avoids cache invalidation and stale project graphs at the cost of process startup and repeated bounded discovery.

The CLI is a public compatibility boundary. Command names, argument ownership, JSON fields, error codes, and version output require coordinated changes across runtime, adapters, Skills, documentation, and validation.

## Changes

### 2026-09-05: Creation no longer accepts body input

The create interface owns no body input. `tk create task` rejects `--body` as an unknown argument, and create tool requests and child Task items reject `body` as an unknown field. When the runtime creates a Task, it automatically writes `# <normalized-name>` as the initial body. The CLI contract version rises to 2.

### 2026-09-05: Rename guards against broken references

`tk rename` gains `--ignore-brokenlinks`. An execution that would move the Task path stops with a conflict error and exit status 3 before the first persistent write when references to the old path exist. The flag permits that move without touching the reference files. Dry-run reports the plan and references without writing. CLI and `tk_exec rename` use the same rule, and the CLI contract version stays at 2.
