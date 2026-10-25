# tk

## Goals

Give Agent work a durable project-local Task record that survives context loss and remains usable across sessions, Harnesses, and the CLI. Project files are the authoritative state. Users can inspect ordinary Markdown materials without running tk.

Provide Task discovery, search, reading, creation, relationships, lifecycle changes, logging, integrity checking, rename, metadata migration, representation switching, and temporary-file cleanup through the public CLI.

Provide English and Chinese CLI Skills. Install, update, switch languages, and remove ordinary Skills offline using the distribution carried by the running executable.

The complete tk specification set comprises this product specification and the data, maintenance, interface, distribution, and Agent behavior specifications. Those areas define requirements, not a required internal module layout.

## Out of scope

- A database, global Task registry, background index, remote service, or resident daemon.
- Priorities, scheduling, inboxes, boards, Issue mirroring, Agent coordination, workflow execution, or persistent session binding.
- Locks, leases, compare-and-swap, automatic merging, automatic rollback, or continuation state for multi-target operations.
- Automatic rewriting of Markdown references during rename.
- Material patterns that add metadata, schema fields, runtime states, commands, or automatic directories.

## Public surface

The public executable `tk` is the sole interface, with consistent Task identities, storage semantics, result envelopes, stable error categories, and version information.

English `tk-cli` and Chinese `tk-cli-zh` are ordinary Skills installed in a known Harness root or a user-selected root. Both source and installed Skills contain all files they reference and do not depend on other repository components, specifications, Task materials, or review records.

## Invariants

- Task identities, managed metadata, relations, lifecycle, and managed paths belong to tk. Ordinary Task prose and supporting materials remain independently editable within the user's authorization.
- `TASK.md` headings are body content. They are independent of the managed name and directory suffix, have no 32-column limit, and do not require rename.
- Saved valid name formatting survives reads, checks, unrelated metadata writes, and representation switches. An explicit rename reaches its exact normalized target.
- Ordinary material symbolic links are neither followed nor diagnosed merely for being links. Managed storage keeps its own type requirements.
- Every domain check for a multi-target operation finishes before the first persistent write. Later I/O failure or cancellation reports actual progress without automatic rollback or continuation.
- Domain rejection is distinct from process failure. Incomplete or malformed output is not fabricated into a successful domain result.
- Public usage documentation remains independently usable and describes the same requirements. Design explains implementation; validation material records methods and evidence. Neither replaces required behavior in the specification set.

## Host lower bound

The CLI Skills contain no host-process code and have no host maintenance lower bound. Runtime and component-format compatibility requirements remain independent.

## Acceptance criteria

A conforming implementation must satisfy the data, maintenance, interface, distribution, and Agent behavior requirements together:

- The CLI preserves domain behavior on existing project data, including rejected writes and non-fatal WAL warnings.
- Both metadata representations preserve Task identity and body bytes across supported metadata operations and representation changes.
- Valid name formatting, exact rename, ordinary symbolic links, complete discovery failures, lifecycle authorization, and multi-target partial results remain observable at public interfaces.
- Both languages install and uninstall in each known Harness root and custom roots without host commands or configuration access. Only the two CLI Skill children are managed; other content is preserved.
- Harness scenarios observe ordinary Skill discovery and post-uninstallation state. Installed Skill scenarios exercise Task selection, creation policy, lifecycle permissions, catchup, WAL, repair authorization, material patterns, and CLI command use. File placement, compilation, and Markdown checks do not establish Agent behavior.
- Product artifacts are self-contained and exclude review records and task materials. Language pairs preserve the same behavior and constraints.
