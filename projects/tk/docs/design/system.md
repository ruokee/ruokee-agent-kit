# System architecture

[简体中文](./system.zh.md)

## Product definition

tk is a persistent Task runtime for local projects.

tk stores state in project files. It does not create a database, global Task registry, background index, remote service, or resident daemon. It does not manage priorities, scheduling, boards, Issue mirroring, Agent orchestration, or session binding.

## System components

The system consists of the following parts:

- Rust runtime: responsible for Task domain rules, persistence, migration, project discovery, CLI, MCP, generated tool contracts, and component lifecycle. Not responsible for Harness session loops and model calls.
- Harness tools components: responsible for the selected tools Skill, tool registration, configuration or adapters, and its installation target. Task domain validation and storage rules are not their responsibility.
- Skill variants: responsible for the `tk`, `tk-zh`, `tk-cli`, and `tk-cli-zh` self-contained variants for Agent activation, authorization, Task usage, and material maintenance. Enforcing runtime invariants or installing components is not their responsibility.
- Public documentation: explains implementation and provides independently usable user references to the specified product contract. Specifications contain complete requirements and acceptance. Review history and local Task materials remain separate.
- ADR: responsible for long-term architectural decisions and their rationale. Not responsible for implementation progress and test logs.

One Cargo package builds one `tk` executable. Short-lived commands exit after execution. The MCP server exists only for the duration of one stdio connection and does not cache project state.

## Harness boundary

The [Harness definition](./harnesses.md#harness-definition) states what a Harness is. Codex, Claude Code, Pi, and OMP are the currently supported Harnesses. Hermes, DSH, and other Harnesses can be added without changing the definition of Harness.

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
- installing, updating, and uninstalling Harness components and standalone CLI Skills.

A Harness must not duplicate the Task domain rules. Pi and OMP adapters do not implement semantic version range parsing. Rust determines compatibility.

## Distribution boundary

`projects/tk/` contains one Rust runtime, four self-contained Skills, native component source for the current Harnesses, and public documentation. The specific directory layout is an implementation detail, not a public contract.

Each Harness tools selection is a self-contained distribution unit. A component must not reference other component directories in the repository. The selected tools Skill, in English or Chinese, and the Harness integration are included in the embedded Harness payload. Two additional payloads contain only the English or Chinese CLI Skill for installation into a Harness's ordinary Skill root or a custom root.

Only the Rust build logic assembles components. Cargo builds eight deterministic tools Harness payloads, two standalone CLI Skill payloads, one archive, and one manifest in `OUT_DIR`, then embeds the archive and manifest in the executable. Installation reads only artifacts embedded in the current executable.

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

## Harness tools component flow

```text
User selects a Harness in tools mode
  -> tk reads the embedded component
  -> Validate component format, compatibility range, paths, and digests
  -> Validate the Harness target and official interfaces
  -> Install or update tk-specific content and tk configuration entries
  -> Return the actual changes
```

A Harness CLI install writes the embedded CLI Skill to the Harness's user-level ordinary Skill root, removes the tools targets and registrations, and returns the actual changes. It selects no component, but it still validates the embedded bundle before writing.

The target result of uninstall is to restore the Harness to the state it would have had if tk had never been installed, while preserving all preexisting content and later changes unrelated to tk.

## Invariants at the system level

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
14. Harness installation, update, and uninstallation operate only on fixed tk-specific targets, the Harness's ordinary Skill root, and tk configuration entries. Custom-root operations manage only the `tk-cli` and `tk-cli-zh` children of the supplied Skill root; install may create the root and its parents. Neither lifecycle maintains installation history.
15. Public documentation describes only the current formal contract. It does not retain obsolete development-stage commands or superseded behavior.

## Platform boundary

The current implementation and automation target Linux. Paths, executable bits, process identity, and Harness user-level locations follow Linux behavior.

The runtime uses the fixed user-level path `$HOME/.local/bin/tk`. Component lifecycle commands must not install another runtime copy, wrapper, or parallel version.
