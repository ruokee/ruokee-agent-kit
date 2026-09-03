# ADR decision: Add a tk CLI-only mode

Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol, Ruokee

English | [中文](./2026-09-02-add-tk-cli-only-mode.zh.md)

## Motivation

A Skill that teaches both logical operations and the public CLI gives an Agent two valid routes for the same Task operation. Route choice can then follow earlier calls rather than the installed integration contract.

Some installations also need Task guidance without operation registration or adapter context. This requires a separate Skill identity rather than conditional wording inside the tools Skill.

## Decision

tk provides a CLI-only mode through the self-contained `tk-cli` and `tk-cli-zh` Skills. Every Task operation in these Skills uses the public `tk` CLI.

CLI-only Skill content contains no logical operation names, discovery instructions, route comparison, tool failure handling, fallback behavior, or assumption that another entry route is absent. Each Skill includes the complete current CLI guidance needed for its own language.

A CLI-only Harness component installs the selected CLI Skill. Claude Code, Pi, and OMP also install the native manifest needed to load it; Codex needs no manifest. No CLI-only component installs MCP configuration, a native tool extension, or tk operation registration. The fixed `$HOME/.local/bin/tk` executable remains an external prerequisite.

[Skill language selection](./2026-09-02-select-tk-skill-language.md) owns the two language identities. [Selectable component distribution](./2026-09-02-distribute-selectable-tk-harness-components.md) owns installation and packaging.

## Alternatives considered

**Keep one mixed Skill and strengthen route wording.** The Agent would still load both execution models and consider two routes for covered operations.

**State that tools are unavailable in CLI-only mode.** The Skill does not need that assumption. It only needs to define the route it uses.

## Consequences

CLI-only installations carry less integration content and add no tk operation schemas to the Agent session. The Agent must select CLI subcommands and options itself, and the Harness cannot constrain request structure at the invocation boundary.

The CLI-only Skills must stay synchronized with the public CLI contract and remain free of integration-specific routing language.
