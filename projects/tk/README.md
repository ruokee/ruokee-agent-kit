# tk

English | [中文](./README.zh.md)

tk is a persistent task management tool. It keeps task progress, shared understanding, and supporting materials in ordinary project files so work can continue across context compaction, sessions, and Agents.

## Access

One Rust runtime provides the `tk` CLI, a stdio MCP server, and native tool integrations for Pi and OMP. Harness components support Codex, Claude Code, Pi, and OMP in tools mode. CLI mode installs an ordinary `tk-cli` or `tk-cli-zh` Skill into a Harness's user-level Skill root, and a custom root can receive either Skill directly.

The runtime owns Task rules and persistence. Harness components expose those operations without implementing a second set of rules.

## Distribution

The runtime is one executable at the fixed user-level path `$HOME/.local/bin/tk`. Harness components and standalone CLI Skills are separate from it: `tk install` writes them into a Harness or a Skill root, and they follow the runtime's rules.

An installed component comes from the payloads embedded in the executable that installed it, so updating the runtime and updating a component are separate steps. The [user guide](./docs/guide.md) covers both.

## Documentation

- [User guide](./docs/guide.md): runtime installation, component selection, initialization, and everyday workflows.
- [CLI reference](./docs/design/cli-reference.md): commands, arguments, and exit behavior.
- [Design index](./docs/design/README.md): architecture, data model, runtime, tool contracts, Harness integration, installation, Skills, and validation.
- [Validation](./docs/design/validation.md): acceptance criteria and verification requirements.
