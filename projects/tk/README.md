# tk

English | [中文](./README.zh.md)

tk is a persistent task management tool. It keeps task progress, shared understanding, and supporting materials in ordinary project files so work can continue across context compaction, sessions, and Agents.

## Access

One Rust runtime provides the `tk` CLI and owns Task rules and persistence. Agents use the self-contained `tk-cli` or `tk-cli-zh` Skill. Install either language into the ordinary Skill root for Codex, Claude Code, Pi, or OMP, or choose a custom root.

## Deprecated access

MCP and native tools access have been removed. tk supports only the CLI. Users handle their own installation updates.

## Distribution

The runtime is one executable at `$HOME/.local/bin/tk`. `tk install` writes one of the two embedded CLI Skills to the selected root. Runtime installation and Skill installation are separate; the [user guide](./docs/guide.md) describes the current installation contract.

## Documentation

- [User guide](./docs/guide.md): runtime installation, component selection, initialization, and everyday workflows.
- [CLI reference](./docs/design/cli-reference.md): commands, arguments, and exit behavior.
- [Design index](./docs/design/README.md): architecture, data model, runtime, CLI, installation, Skills, and validation.
- [Validation](./docs/design/validation.md): acceptance criteria and verification requirements.
