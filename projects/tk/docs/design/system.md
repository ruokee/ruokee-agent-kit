# System architecture

[简体中文](./system.zh.md)

## Product definition

tk is a persistent Task runtime for local projects. A Task is a temporary project effort worth preserving. Creating a Task does not imply a commitment to execute or complete it.

tk stores state in project files. It does not create a database, global Task registry, background index, remote service, or resident daemon. It does not manage priorities, scheduling, boards, Issue mirroring, Agent orchestration, or session binding.

## System components

The system consists of the following parts:

|Part|Responsible for|Not responsible for|
|-|-|-|
|Rust runtime|Task domain rules, persistence, migration, project discovery, CLI, MCP, generated tool contracts, and component lifecycle|Harness session loops and model calls|
|Harness components|Skill, tool registration, configuration or adapters, and their installation targets|Task domain validation and storage rules|
|Skill variants|Four self-contained mode and language variants for Agent activation, authorization, Task usage, and material maintenance|Enforcing runtime invariants or installing components|
|Public documentation|Current product contracts and user guidance|Review history and local Task materials|
|ADR|Long-term architectural decisions and their rationale|Implementation progress and test logs|

One Cargo package builds one `tk` executable. Short-lived commands exit after execution. The MCP server exists only for the duration of one stdio connection and does not cache project state.

## Task and Harness boundary

A Harness is the software environment around a model that enables the model to operate as an Agent. It includes the model interaction loop, system prompts, context management, tools, permissions, and hooks. Codex, Claude Code, Pi, and OMP are the currently supported Harnesses. Hermes, DSH, and other Harnesses can be added without changing the definition of Harness.

The Harness is responsible for:

- loading the Skill;
- registering MCP or native tools;
- providing the session working directory and available model information;
- presenting tool results and load errors.

The Rust runtime is responsible for:

- parsing and validating Tasks;
- enforcing lifecycle, relationship, migration, and path rules;
- reading and writing project state and the WAL;
- generating MCP and native tool contracts;
- installing, updating, and uninstalling Harness components.

A Harness must not duplicate the Task domain rules. Pi and OMP adapters do not implement semantic version range parsing. Rust determines compatibility.

## Source and distribution boundary

`projects/tk/` contains one Rust runtime, four self-contained Skills, native component source for the current Harnesses, and public documentation. The specific directory layout is an implementation detail, not a public contract.

Each Harness selection is a self-contained distribution unit. A component must not reference other component directories in the repository. The selected tools or CLI Skill, in English or Chinese, is included in the embedded payload.

Only the Rust build logic assembles components. Cargo builds sixteen deterministic payloads, one archive, and one manifest in `OUT_DIR`, then embeds the archive and manifest in the executable. Component installation reads only artifacts embedded in the current executable.

## Task operation flow

```text
Caller
  -> CLI, MCP, or native tool
  -> Resolve request context
  -> Locate the project and Task
  -> Perform strict reads and domain validation
  -> For writes, enforce Git policy and check for activity markers
  -> Complete all domain prechecks
  -> Commit in deterministic order
  -> Return a structured result
```

read, search, and pure diagnostics are not rejected by Git policy. Git policy checks run only before persistent writes.

## Harness component flow

```text
User selects a Harness
  -> tk reads the embedded component
  -> Validate component format, compatibility range, paths, and digests
  -> Validate the Harness target and official interfaces
  -> Install or update tk-specific content and tk configuration entries
  -> Return the actual changes
```

The target result of uninstall is to restore the Harness to the state it would have had if tk had never been installed, while preserving all preexisting content and later changes unrelated to tk.

## System-level invariants

1. UUIDv7 is the authoritative identity of a Task. Names describe Tasks, and paths locate them.
2. The only Task states are `planning`, `open`, and `closed`.
3. A project selects one Task root directory and one metadata representation.
4. split and embed are both fully supported representations. Neither is temporary or secondary.
5. Normal reads and writes accept only the current schema. Formally released older schemas are upgraded through stepwise migrators.
6. Ordinary writes do not use locks, leases, compare-and-swap, or automatic merging.
7. Single-file updates use atomic replacement. Multi-target operations complete all prechecks before committing in deterministic order.
8. If a multi-target write fails partway through, it stops and reports completed and incomplete items. It does not roll back automatically.
9. No domain operation state remains after the process for a multi-target operation exits. Subsequent calls reread the current canonical state.
10. GC deletes only temporary content created by tk and identified by the minimal cleanup manifest.
11. All Task project relationships remain within the same Task root directory.
12. Harness names and tool schema types are different concepts. A Harness is a product; `mcp` and `native` are schema types.
13. Component installation does not access the network, read Task projects, or run Git policy checks.
14. Installation, update, and uninstallation operate only on fixed tk-specific targets and tk configuration entries. They do not maintain installation history.
15. Public documentation describes only the current formal contract. It does not retain obsolete development-stage commands or superseded behavior.

## Platform boundary

The current implementation and automation target Linux. Paths, executable bits, process identity, and Harness user-level locations follow Linux behavior.

The runtime uses the fixed user-level path `$HOME/.local/bin/tk`. Harness components must not install another runtime copy, wrapper, or parallel version.
