# tk CLI access

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol, Ruokee
Reverses: [tk CLI mode](../../../archived/2026/09/02-r2-tk-cli-mode.md)

English | [中文](./02-tk-cli-mode.zh.md)

## Motivation

Use the public `tk` CLI for every Task operation.

One command interface lets people, scripts, and Agents use the same Task behavior. Complete language-specific Skills explain that interface without conditional access instructions.

## Decision

The sole tk access interface is the CLI. `tk-cli` and `tk-cli-zh` are self-contained ordinary Skills with complete current commands, authorization guidance, error handling, and Task material guidance in their respective languages.

Installation selects exactly one of `--harness` and `--skill-root`, plus an optional language. A Harness selection only maps to its ordinary Skill root. Both targets write the selected Skill, remove the other language, and preserve the root and every unrelated child. Uninstall removes both CLI Skills.

The fixed `$HOME/.local/bin/tk` executable is an external prerequisite. Lifecycle commands neither read Harness configuration nor invoke host commands. They maintain no installation history or alternate access selection.

[Skill language](./02-tk-language.md) owns the two identities. [Distribution](../08/28-tk-distribution.md) owns packaging and lifecycle; [Harness integration](../08/28-tk-harness.md) owns root mappings and discovery responsibilities.

## Alternatives considered

None

## Consequences

The Agent selects CLI subcommands and options itself. Argument validation occurs in tk, so the Harness does not constrain their structure before invocation.

Ordinary Skill discovery depends on the Harness and its root configuration. A Harness that does not scan the installed root does not load the Skill even when its files are present.
