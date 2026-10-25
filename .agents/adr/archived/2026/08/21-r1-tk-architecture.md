# tk architecture

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol
Archived: 2026-10-25
Reversed by: [tk architecture](../../../decision/2026/08/21-tk-architecture.md)

English | [中文](./21-r1-tk-architecture.zh.md)

## Motivation

Define tk as a durable, file-backed, project-local record of Agent work.

Agent work can outlive one conversation, model context, or Harness session, so tk needs one durable record for the current objective, relationships, materials, decisions, and work history. Conversation history, branches, Issues, todo lists, and Harness state do not provide one representation that remains available across Codex, Claude Code, Pi, OMP, and direct CLI use.

The record must remain inspectable as ordinary files. It must not turn the repository into a workflow service, Agent orchestrator, global task database, or session store.

## Decision

### Product definition

tk is a Linux-first persistent Task capability for local projects. A Task is a temporary project effort worth preserving. Creating one records the effort but does not imply a commitment to execute or complete it.

Project files are the only authoritative Task state. tk has no database, global Task registry, background index, remote service, or resident daemon. It does not provide priorities, scheduling, an inbox, boards, Issue mirroring, Agent coordination, workflow execution, or session binding.

### System ownership

One Cargo package under `projects/tk/` builds one executable named `tk`. The Rust runtime owns Task domain rules, persistence, project discovery, migration, maintenance, CLI, stdio MCP, generated tool contracts, and Harness component lifecycle.

`projects/tk/` is the single maintained source area for the runtime, Harness source, adapter tests, Skills, and public tk documentation. The repository has no second tk source tree, compatibility directory, source alias, symlink, re-export, or checked-in generated component tree.

Harnesses own their model loop, prompts, context, permissions, hooks, Skill loading, and tool presentation. Harness components register tools and configuration but do not duplicate Task validation or storage rules.

Four self-contained Skills define Agent behavior for tools or CLI mode in English or Chinese. Public documentation records the current product contract. ADRs preserve long-lived decisions and their rationale.

### Harness boundary

A Harness is the software environment around a model that enables it to operate as an Agent. Codex, Claude Code, Pi, and OMP are the current integrations. Adding another Harness requires a self-contained component and integration contract, but it does not change the product definition.

All Task interfaces call the same public executable. Short-lived commands exit after one operation. The MCP server exists only for one stdio connection and does not cache project state.

The current platform contract is Linux. The runtime uses the fixed user-level path `$HOME/.local/bin/tk`. Harness components do not install a second runtime, wrapper, or private executable.

### Decision ownership

The following ADRs own the detailed contracts within this architecture:

- [Task data model](../../../decision/2026/08/28-tk-data.md);
- [runtime and CLI](./28-r1-tk-runtime.md);
- [CLI-only mode](../09/02-r2-tk-cli-mode.md);
- [Skill language selection](../09/02-r1-tk-language.md);
- [Harness tools integration](./28-r3-tk-harness.md);
- [Harness component and custom CLI Skill distribution](./28-r4-tk-distribution.md);
- [documentation and usage patterns](./29-r5-tk-documentation.md).

## Alternatives considered

None

## Consequences

A Task can be read and maintained without the Harness that created it. CLI, MCP, Pi, and OMP share one set of domain rules because each interface reaches the same executable.

The file-based design accepts on-demand discovery and bounded scans instead of a permanent index. Workflow, prioritization, Agent scheduling, and remote collaboration remain the responsibility of other systems.

The runtime is a shared failure boundary. A defect in the executable can affect every interface, while a Harness adapter defect remains limited to that integration. New integrations must preserve this ownership split instead of moving Task semantics into host-specific code.
