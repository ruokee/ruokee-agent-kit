# tk architecture

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol
Reverses: [tk architecture](../../../archived/2026/08/21-r1-tk-architecture.md)

English | [中文](./21-tk-architecture.zh.md)

## Motivation

Provide durable, file-backed, project-local Task management through one CLI.

Agent work can outlive a conversation, model context, or Harness session. Ordinary project files keep objectives, relationships, materials, decisions, and activity available independently of those sessions. One public command boundary keeps Task semantics in the runtime and avoids maintaining separate access implementations.

## Decision

### Product definition

tk is a Linux-first persistent Task capability for local projects. A Task is a temporary project effort worth preserving. Creating one records the effort without a commitment to execute or complete it.

Project files are the only authoritative Task state. tk has no database, global Task registry, background index, remote service, or resident daemon. It provides no priorities, scheduling, inbox, boards, Issue mirroring, Agent coordination, workflow execution, or session binding.

### System ownership

One Cargo package under `projects/tk/` builds one executable named `tk`. Rust owns Task domain rules, persistence, discovery, schema migration, maintenance, CLI output, and Skill lifecycle. Each command exits after execution; each invocation rereads canonical state.

`projects/tk/` is the single maintained source area for the runtime, Skills, checks, and public documentation. No second source tree, compatibility directory, source alias, symlink, re-export, or checked-in generated component tree is maintained.

Two self-contained Skills, `tk-cli` and `tk-cli-zh`, guide Agents in English and Chinese. They use only the public CLI. Their source trees and installed payloads each contain all their own references. Public documentation describes the current contract; ADRs preserve durable choices and reasons.

### Harness boundary

Harnesses own model loops, prompts, context, permissions, hooks, Skill loading, and command execution. Task rules remain in Rust. Codex, Claude Code, Pi, and OMP have known ordinary Skill roots; any other suitable root can be selected explicitly.

The fixed Linux runtime is `$HOME/.local/bin/tk`. Skill lifecycle does not install, update, copy, wrap, or remove it. Installation owns only the two CLI Skill children of the selected root and does not inspect or modify Harness configuration.

### Decision ownership

Detailed contracts belong to [Task data](./28-tk-data.md), [runtime](./28-tk-runtime.md), [CLI access](../09/02-tk-cli-mode.md), [Skill language](../09/02-tk-language.md), [Harness integration](./28-tk-harness.md), [distribution](./28-tk-distribution.md), and [documentation](./29-tk-documentation.md).

## Alternatives considered

None

## Consequences

Tasks remain readable and maintainable without the Harness that created them. The CLI is the shared behavior and failure boundary for people, scripts, and Agents.

On-demand discovery avoids a permanent index but repeats bounded scans. Workflow, prioritization, Agent scheduling, and remote collaboration remain responsibilities of other systems.
