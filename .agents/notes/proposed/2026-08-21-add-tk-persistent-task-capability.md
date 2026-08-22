# Agent Note: Add tk as a persistent project-work capability

Status: proposed
Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol

English | [中文](./2026-08-21-add-tk-persistent-task-capability.zh.md)

## Motivation

`ruokee-agent-kit` has no capability for preserving the authoritative state of project work across Agent sessions and Harnesses. Conversations end, context is compacted, and models change. A long-running project cannot depend on one chat remaining available.

This state also cannot rely on LLM judgment for identifiers, relationships, lifecycle transitions, locking, paths, or structured updates. Every supported host must receive the same validation result for the same operation.

The repository therefore needs a new first-party capability. Existing Task experience supplies requirements and failure evidence, but this project is creating `tk` as a new feature rather than preserving an old public API.

## Proposal

### Capability and domain

Add `tk` as a Plugin under `plugins/tk/`, with an OMP-native installation package under `omp/tk/`. Both paths use one implementation and one generated contract.

Define a Task as a finite piece of project work that the user has decided to pursue and whose state is worth preserving across sessions. Ideas, backlog items, quick answers, current-session todos, Agent scheduling, and general project management remain outside the capability.

Use `tk` for the command, package, Plugin, and tool namespace. The persisted domain object remains Task, with Task ID and `TASK.md` as domain terms. The short name avoids the collision with OMP's `task` subagent tool without redefining Task as an abbreviation for another concept.

### Core and responsibility split

Implement one deterministic Rust Core. It owns discovery, identity, relationship and lifecycle invariants, locking, paths, managed metadata, WAL format, and structured errors. The tk Skill owns semantic usage rules such as confirmation, recovery, logging, assignment boundaries, and closure intent. Host adapters only translate registration and transport.

Rust is the initial implementation for this repository. Importing the previous Python and Nuitka implementation unchanged would retain slow, cache-sensitive standalone builds and carry an implementation this project does not need to support. Python behavior may inform fixtures, but `ruokee-agent-kit` does not publish parallel Python and Rust Cores or old `task_*` aliases.

Other domain Skills may create or relate Tasks after user intent permits persistence. They use the same public contract. tk does not add per-Skill commands, callbacks, or workflow languages.

### Metadata and files

Require `tk.toml` and `TASK.md` in every Task directory. `tk.toml` is the structured state owned by tk. `TASK.md` is the required plain Markdown entry point owned by people and Agents. WAL and ordinary files preserve chronological activity and detailed work products.

`tk_create` initializes the managed files. `tk_update` changes supported metadata and at most one lifecycle action. It accepts no body or generic Markdown patch field. Host file tools edit `TASK.md` and ordinary materials.

Current metadata is authoritative. Do not reconstruct it by replaying WAL, and do not make the Core inventory or impose one schema on ordinary project materials.

### Search and mutation

Expose `tk_search(query)` for ordered candidates matched from identifiers, names, directory names, paths, and supported metadata filters. Search results do not authorize mutation through fuzzy matching. Mutating tools require a precise reference.

The initial feature has no full-text search, vector search, embedding pipeline, query DSL, index daemon, or implicit current Task.

### Distribution and verification

Generate host schemas from the Core contract. Package, wrappers, runtime, generated schemas, and Skill must report the same version and protocol.

Validate the real Codex, Claude Code, Pi, and OMP installation entry points. Each installed path must exercise `search`, `read`, `create`, `update`, `log`, and restricted `exec`. Batch subtask creation must cover valid tagged-union input and atomically rejected invalid input. Directly invoking a cached runtime does not prove that the shipped host package works.

## Alternatives considered

**Import the previous Python Plugin unchanged.** This would deliver code sooner, but it would also establish slow standalone builds, mixed file ownership, old naming, and compatibility obligations as new project contracts.

**Implement tk as a pure Skill.** A Skill can guide semantic use but cannot enforce identity, lifecycle, relationships, locking, or atomic structured updates across hosts.

**Give each host its own implementation.** Host-specific Cores and schemas would drift. Adapters must consume one contract instead.

**Keep metadata in `TASK.md` frontmatter.** The Core and people would rewrite the same file, so a metadata update could alter user-authored Markdown.

**Make `TASK.md` optional.** Metadata-only Tasks would lose one stable human recovery entry point and add branches to every reading workflow.

**Keep `task` as the public namespace.** It collides with ordinary task terminology and OMP's subagent dispatch tool.

**Add full-text or vector search in the first feature.** Current use requires metadata and path candidate search. Indexing systems have no demonstrated requirement yet.

**Validate only the Core.** Previous wrapper, runtime, and generated-schema drift showed that source tests can pass while installed host calls fail.

## Acceptance criteria

1. `plugins/tk/` and `omp/tk/` consume one Rust Core and generated contract.
2. Every Task has stable identity, authoritative `tk.toml`, a required plain Markdown `TASK.md`, and durable WAL activity.
3. Core, Skill, adapters, and domain Skills have distinct responsibilities.
4. tk exposes no `TASK.md` body-editing parameter and metadata updates never rewrite that file.
5. `tk_search` defines exact candidate sources, filtering, ordering, ambiguity, and truncation while mutation requires a precise reference.
6. The first release contains no Python Core compatibility path or `task_*` host alias.
7. Package, wrapper, runtime, schemas, and Skill agree on version and protocol.
8. Installed Codex, Claude Code, Pi, and OMP packages complete the end-to-end smoke scenarios, including atomic batch rejection.
9. The feature does not expand into todo management, Agent orchestration, issue tracking, workflow execution, or knowledge indexing.

## Risks

`tk` is short, has low self-explanation, and can be confused with Tcl/Tk. Scoped package names, the README opening, Skill description, and `tk --help` must state that it manages persistent project work.

Separating metadata and Markdown creates two required files. The simpler ownership rule is worth that extra file, but tools must report a missing or conflicting file explicitly rather than guess.

A single Core does not prevent stale wrappers from being shipped. Release checks must exercise installed packages and compare reported contract versions.

The exact `tk.toml` schema belongs to the Rust contract types. This Note must not become a second field-level schema.
