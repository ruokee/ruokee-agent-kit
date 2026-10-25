# tk Skill language

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol, Ruokee
Reverses: [tk Skill language](../../../archived/2026/09/02-r1-tk-language.md)

English | [中文](./02-tk-language.zh.md)

## Motivation

Select one CLI Skill language through the ordinary installation lifecycle.

Language selection belongs to install so users can install, switch, and inspect the selected identity through one operation.

## Decision

`tk install` accepts `--language <en|zh>`, defaulting to `en`. English selects `tk-cli`; Chinese selects `tk-cli-zh`. Both live under `projects/tk/skills/` with their independent discovery names, which installation preserves.

The two Skills provide equivalent behavior and each contains its complete references. Harness and custom-root targets use the same selection and default. Install, dry-run, text output, and JSON output report the resolved language and Skill.

Installation replaces the selected identity and removes the other language from the same root. Uninstall takes no language selector, removes both identities, and omits language and Skill from its results. [Distribution](../08/28-tk-distribution.md) owns the bounded lifecycle.

## Alternatives considered

None

## Consequences

One selected root retains one language after installation. Each language is independently packaged and discovered; maintaining semantic equivalence requires updating both together.
