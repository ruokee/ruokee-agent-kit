# tk

English | [中文](./tk.zh.md)

Spec for [projects/tk](../../projects/tk/README.md). It states tk's goals, boundaries, and invariants. The design pages under [projects/tk/docs/design](../../projects/tk/docs/design/README.md) own the detailed contracts, and this spec links to them instead of restating them.

## Goals

- Give Agent work one durable, file-backed, project-local Task record that survives context loss and works across sessions, Harnesses, and the CLI. See [projects/tk/docs/design/system.md](../../projects/tk/docs/design/system.md).
- Keep Task domain rules, persistence, discovery, migration, maintenance, the CLI, stdio MCP, generated tool contracts, and the Harness component lifecycle in one Rust runtime. See [projects/tk/docs/design/runtime.md](../../projects/tk/docs/design/runtime.md).
- Reach that runtime through one public executable from every interface: the human CLI, stdio MCP, and native Pi and OMP tools, with one result, error, and version model. See [projects/tk/docs/design/tool-api.md](../../projects/tk/docs/design/tool-api.md) and [projects/tk/docs/design/cli-reference.md](../../projects/tk/docs/design/cli-reference.md).
- Ship four Skills, tools or CLI mode in English or Chinese, from one shared reference source per language. See [projects/tk/docs/design/skill.md](../../projects/tk/docs/design/skill.md).
- Install, update, and remove Harness components and standalone CLI Skills offline from one embedded bundle. See [projects/tk/docs/design/installation.md](../../projects/tk/docs/design/installation.md) and [projects/tk/docs/design/harnesses.md](../../projects/tk/docs/design/harnesses.md).

## Non-goals

- A database, global Task registry, background index, remote service, or resident daemon.
- Priorities, scheduling, inboxes, boards, Issue mirroring, Agent coordination, workflow execution, or session binding.
- Locks, leases, compare-and-swap, automatic merges, automatic rollback, or continuation state for multi-target operations.
- Rewriting Markdown references during rename.
- Usage patterns that add metadata, schema fields, runtime states, commands, or automatic directories.

## Public surface

- Product scope, system parts, and system-level invariants: [projects/tk/docs/design/system.md](../../projects/tk/docs/design/system.md).
- Task data model, lifecycle, writes, migration, rename, check, and GC: [projects/tk/docs/design/data-model.md](../../projects/tk/docs/design/data-model.md).
- Tool operations, results, and errors: [projects/tk/docs/design/tool-api.md](../../projects/tk/docs/design/tool-api.md).
- CLI commands, output, and exit statuses: [projects/tk/docs/design/cli-reference.md](../../projects/tk/docs/design/cli-reference.md).
- Harness components and adapters: [projects/tk/docs/design/harnesses.md](../../projects/tk/docs/design/harnesses.md).
- Bundle, install, update, and uninstall: [projects/tk/docs/design/installation.md](../../projects/tk/docs/design/installation.md).
- Skill behavior and usage patterns: [projects/tk/docs/design/skill.md](../../projects/tk/docs/design/skill.md).
- Getting started: [projects/tk/docs/guide.md](../../projects/tk/docs/guide.md).

## Invariants

- `projects/tk/` is the only maintained source area. One Cargo package builds one `tk` executable, and the Rust build is the only bundle assembler.
- Project files are the only authoritative Task state.
- Harness components register tools and configuration but do not duplicate Task validation or storage. They start the fixed public runtime directly and never install a second runtime, wrapper, or private executable.
- Adapters map operations through the public CLI. They do not parse version ranges; the runtime evaluates compatibility.
- An adapter whose preflight fails registers no operation and reports one bounded diagnostic without ending the session.
- CLI-mode Skills route every operation through the public CLI and contain no tool-operation names, discovery, route comparison, or fallback wording.
- Each assembled or installed component, including each Skill, references only files inside itself. Shared Skill references live once per language in the source tree and are copied into every Skill of that language at build time.
- Each behavior has one owning design page. Other pages link to it and add only the context their readers need. Public documentation states the current formal contract.
- No file inside a tk component links to `.agents/spec/`.

## Host lower bound

The tk OMP adapter follows the shared OMP lower bound, `18.5.0`, for the host-side code it ships in `tools` mode, declared in [projects/tk/omp/README.md](../../projects/tk/omp/README.md#compatibility). The Pi adapter keeps its own statement in [projects/tk/pi/README.md](../../projects/tk/pi/README.md#compatibility). The `cli` mode components and the Claude Code and Codex components ship no host-process code and have no maintenance lower bound. The general rules are in [.agents/spec/host-compatibility.md](./host-compatibility.md).

## Acceptance criteria

[projects/tk/docs/design/validation.md](../../projects/tk/docs/design/validation.md) owns tk's acceptance obligations, including the real Harness validation. The tk Rust, adapter, and Skill lifecycle checks run inside the repository's complete `pnpm check`.

## Related ADRs

- [Define the tk product architecture](../adr/decision/2026-08-21-define-tk-product-architecture.md)
- [Define the tk runtime and CLI](../adr/decision/2026-08-28-define-tk-runtime-and-cli.md)
- [Define the tk Task data model with closed rename and file system reference scanning](../adr/decision/2026-09-10-allow-closed-rename-filesystem-scan.md)
- [Integrate tk tools with Harnesses](../adr/decision/2026-09-02-integrate-tk-tools-with-harnesses.md)
- [Add a tk CLI-only mode](../adr/decision/2026-09-02-add-tk-cli-only-mode.md)
- [Integrate Skill language selection into tk install](../adr/decision/2026-09-02-select-tk-skill-language.md)
- [Distribute Harness components and custom CLI Skills](../adr/decision/2026-09-03-distribute-custom-cli-skills.md)
- [Align tk usage patterns with shared Skill reference sources](../adr/decision/2026-10-04-share-tk-skill-references.md)
- [Maintain host components against a shared OMP floor](../adr/decision/2026-10-04-raise-omp-host-floor.md)
- [Keep distributable components self-contained](../adr/decision/2026-08-24-keep-components-self-contained.md)
