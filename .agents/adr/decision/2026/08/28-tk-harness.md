# tk Harness integration

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol, Ruokee
Reverses: [tk Harness integration](../../../archived/2026/08/28-r3-tk-harness.md)

English | [中文](./28-tk-harness.zh.md)

## Motivation

Integrate tk with Harnesses through ordinary Skills and public CLI commands.

The same Task behavior is usable wherever an Agent can load a Skill and execute `tk`. Root placement is the only Harness-specific responsibility needed in tk; domain validation and persistence remain in the runtime.

## Decision

`tk-cli` and `tk-cli-zh` provide complete CLI guidance. The Harness discovers the selected Skill, supplies the command working directory and available model information, executes the command, and presents its result. Agents pass actual authorization and explicit actor attribution where applicable.

`--harness` maps Codex to `$CODEX_HOME/skills`, defaulting to `~/.codex/skills`; Claude Code to `~/.claude/skills`; Pi to `~/.pi/agent/skills`; and OMP to `~/.omp/agent/skills`. `--skill-root` accepts another ordinary Skill root.

Both target forms use the same bounded file lifecycle. tk manages only `tk-cli` and `tk-cli-zh` directly under the selected root. It neither reads Harness configuration nor invokes Harness commands. The fixed `$HOME/.local/bin/tk` remains an external prerequisite.

Rust owns Task validation, storage, search ranking, schema migration, compatibility, and installation. Skills explain use and authorization without duplicating enforcement. CLI failure results, cancellation, and partial completion retain their runtime semantics.

The [installation design](../../../../../projects/tk/docs/design/installation.md), [CLI reference](../../../../../projects/tk/docs/design/cli-reference.md), and [CLI Skill](../../../../../projects/tk/skills/tk-cli/SKILL.md) provide independently usable guidance. The [tk specification set](../../../../spec/README.md#tk) states complete behavior and acceptance.

## Alternatives considered

None

## Consequences

Root mappings require no host executable or host configuration parser. Runtime defects affect every caller; Skill discovery still depends on the Harness scanning the chosen root. File installation alone does not establish that discovery occurred.
