# tk

## Goals

Give Agent work a durable project-local Task record that survives context loss and remains usable across sessions, Harnesses, and the CLI. Project files are the authoritative state. Users can inspect ordinary Markdown materials without running tk.

Provide Task discovery, search, reading, creation, relationships, lifecycle changes, logging, integrity checking, rename, metadata migration, representation switching, and temporary-file cleanup. Human CLI, stdio MCP, and Pi and OMP native tools use the same domain rules and public runtime.

Provide English and Chinese tools Skills and CLI Skills. Install, update, switch, and remove Harness integrations and standalone CLI Skills offline, using the distribution carried by the running executable.

The complete tk specification set comprises this product specification and the data, maintenance, interface, distribution, and Agent behavior specifications. Those areas define requirements, not a required internal module layout.

## Out of scope

- A database, global Task registry, background index, remote service, or resident daemon.
- Priorities, scheduling, inboxes, boards, Issue mirroring, Agent coordination, workflow execution, or persistent session binding.
- Locks, leases, compare-and-swap, automatic merging, automatic rollback, or continuation state for multi-target operations.
- Automatic rewriting of Markdown references during rename.
- Material patterns that add metadata, schema fields, runtime states, commands, or automatic directories.

## Public surface

The public executable is `tk`. All interfaces reach that runtime and expose consistent Task identities, storage semantics, result envelopes, stable error categories, and version information. Harness integrations do not maintain a second Task store or independently change validation rules.

The four Skill identities are:

| Mode | English | Chinese |
| --- | --- | --- |
| tools | `tk` | `tk-zh` |
| cli | `tk-cli` | `tk-cli-zh` |

Tools mode supports Codex, Claude Code, Pi, and OMP. CLI mode provides an ordinary Skill in a supported Harness's Skill root or a user-selected Skill root. Components and installed Skills contain all files they reference and do not depend on repository specifications, task materials, or review records.

## Invariants

- Task identities, managed metadata, relations, lifecycle, and managed paths belong to tk. Ordinary Task prose and supporting materials remain independently editable within the user's authorization.
- `TASK.md` headings are body content. They are independent of the managed name and directory suffix, have no 32-column limit, and do not require rename.
- Saved valid name formatting survives reads, checks, unrelated metadata writes, and representation switches. An explicit rename reaches its exact normalized target.
- Ordinary material symbolic links are neither followed nor diagnosed merely for being links. Managed storage keeps its own type requirements.
- Every domain check for a multi-target operation finishes before the first persistent write. Later I/O failure or cancellation reports actual progress without automatic rollback or continuation.
- Domain rejection is distinct from process or transport failure. No interface invents a successful domain result for incomplete or malformed transport output.
- Public usage documentation remains independently usable and describes the same requirements. Design explains implementation; validation material records methods and evidence. Neither replaces required behavior in the specification set.

## Host lower bound

Tools-mode OMP host code has a maintenance lower bound of `18.5.0`; Pi host code has a lower bound of `0.84.4`. These are maintenance commitments, with no upper bound, and are not runtime version gates. Codex and Claude Code integrations declare no host maintenance lower bound. CLI mode contains no host-process code and has no host maintenance lower bound.

The runtime and native/component contract version checks are separate compatibility requirements. They must not be replaced by host maintenance-version checks.

## Acceptance criteria

A conforming implementation must satisfy the data, maintenance, interface, distribution, and Agent behavior requirements together:

- The same project data yields the same domain behavior through CLI, MCP, and native tools, including rejected writes and non-fatal WAL warnings.
- Both metadata representations preserve Task identity and body bytes across supported metadata operations and representation changes.
- Valid name formatting, exact rename, ordinary symbolic links, complete discovery failures, lifecycle authorization, and multi-target partial results remain observable at public interfaces.
- All four Harness integrations and both languages install, load, and uninstall in real isolated Harness environments. OMP tools mode additionally completes one real tool call. CLI mode is discovered as an ordinary Skill. The actual loading result and post-uninstallation state are observed, not inferred from installed files.
- Skill scenarios exercise Task selection, creation policy, lifecycle permissions, catchup, WAL, repair authorization, material patterns, and mode-specific routing through installed Skills. Compilation and Markdown checks do not establish Agent behavior.
- Product artifacts are self-contained and exclude review records and task materials. Language pairs preserve the same behavior and constraints.
