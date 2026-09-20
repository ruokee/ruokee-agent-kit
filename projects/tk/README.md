# tk

English | [中文](./README.zh.md)

tk is a persistent task management tool. It keeps task progress, shared understanding, and supporting materials in ordinary project files so work can continue across context compaction, sessions, and Agents.

A Task is a temporary project effort worth preserving. Creating one does not imply a commitment to execute or complete it.

## Access

One Rust runtime provides the `tk` CLI, a stdio MCP server, and native tool integrations for Pi and OMP. Components support Codex, Claude Code, Pi, and OMP, with tools or CLI modes and English or Chinese Skills. CLI Skills can also be installed into another Skill root without a Harness-specific integration.

The runtime owns Task rules and persistence. Harness components expose those operations without implementing a second set of rules.

## Runtime and components

The runtime is one executable at the fixed user-level path `$HOME/.local/bin/tk`. Harness components and standalone CLI Skills are separate from it: `tk install` writes them into a Harness or a Skill root, and they follow the runtime's rules.

`tk install` reads only the payloads embedded in the executable that runs it. Pulling newer repository content replaces neither the installed executable nor the components, and an older executable cannot install a newer component. Updating therefore takes two steps:

```sh
cd /path/to/ruokee-agent-kit
git pull
cargo build --release --manifest-path projects/tk/Cargo.toml
mkdir -p "$HOME/.local/bin"
install -m 755 projects/tk/target/release/tk "$HOME/.local/bin/tk"
tk install --harness omp --mode cli --language zh
```

Repeating `tk install` with the selection that is already current returns `no_change`. See [installation](./docs/design/installation.md) for the component lifecycle and the [user guide](./docs/guide.md) for runtime installation, component selection, and uninstall.

## Getting started

Start with the [user guide](./docs/guide.md) to install the runtime and a component, initialize a project, and create or resume a Task. The runtime is installed separately from Harness components.

See [Harness integration](./docs/design/harnesses.md) for the supported component forms and [installation](./docs/design/installation.md) for component installation, updates, and removal.

## Documentation

- [User guide](./docs/guide.md): installation and everyday workflows.
- [CLI reference](./docs/design/cli-reference.md): commands, arguments, and exit behavior.
- [Design index](./docs/design/README.md): architecture, data model, runtime, tool contracts, Skills, and component lifecycle.
- [Validation](./docs/design/validation.md): acceptance criteria and verification requirements.
