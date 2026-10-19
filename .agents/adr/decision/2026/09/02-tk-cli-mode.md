# tk CLI mode

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol, Ruokee
Reverses: [tk CLI mode](../../../archived/2026/09/02-r1-tk-cli-mode.md)

English | [中文](./02-tk-cli-mode.zh.md)

## Motivation

Provide tk in a CLI-only form as the `tk-cli` and `tk-cli-zh` Skills.

These Skills route every Task operation through the public `tk` CLI. tk keeps Task progress, shared understanding, and supporting materials in ordinary project files.

A Skill that teaches both logical operations and the public CLI gives an Agent two routes for the same Task operation, so route choice can follow earlier calls instead of the installed integration contract.

Some installations also need Task guidance without operation registration or adapter context. A separate Skill identity avoids conditional wording inside the tools Skill.

## Decision

tk provides a CLI-only mode through the self-contained `tk-cli` and `tk-cli-zh` Skills. Every Task operation in these Skills uses the public `tk` CLI.

CLI-only Skill content contains no logical operation names, discovery instructions, route comparison, tool failure handling, fallback behavior, or assumption that another entry route is absent. Each Skill includes the complete current CLI guidance needed for its own language.

A CLI-mode Harness install writes `tk-cli` or `tk-cli-zh` to that Harness's user-level ordinary Skill root:

- Codex uses `$CODEX_HOME/skills`, which defaults to `~/.codex/skills`.
- Claude Code uses `~/.claude/skills`.
- Pi uses `~/.pi/agent/skills`.
- OMP uses `~/.omp/agent/skills`.

The install creates no Harness registration and installs no native manifest. It removes that Harness's tools targets and any existing tk registration, and removes the other language variant from the same root. A failed registration removal keeps the tools targets and reports the removal as incomplete. A tools install removes both CLI Skill directories from the same root, so one Harness keeps one tk selection.

`--mode cli --skill-root <dir>` keeps writing only `<dir>/tk-cli` or `<dir>/tk-cli-zh` and does not touch Harness targets or registrations. The fixed `$HOME/.local/bin/tk` executable remains an external prerequisite.

[Skill language selection](./02-tk-language.md) owns the two language identities. [Harness component and custom CLI Skill distribution](../08/28-tk-distribution.md) owns installation and packaging.

## Alternatives considered

**Keep one mixed Skill and strengthen route wording.** The Agent would still load both execution models and consider two routes for covered operations.

**State that tools are unavailable in CLI-only mode.** The Skill does not need that assumption. It only needs to define the route it uses.

## Consequences

CLI-only installations carry less integration content and add no tk operation schemas to the Agent session. The Agent must select CLI subcommands and options itself, and the Harness cannot constrain request structure at the invocation boundary.

Ordinary Skill discovery depends on the Harness version and its user-level Skill root. A Harness that does not scan the installed root does not load the Skill, even when the files are present.
