# tk Skill language

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol, Ruokee

English | [中文](./02-tk-language.zh.md)

## Motivation

Select the Skill language in `tk install`, where `--language` combines with `--mode` to pick one discoverable Skill.

A manually installed Chinese Skill sits outside that lifecycle: users must install and switch it separately, and tk cannot report or update the selected language as part of the component state.

Mode and language are independent choices. Their command contract should express both dimensions without requiring users to memorize four Skill names.

## Decision

`tk install` accepts `--language <en|zh>` and defaults to `en`. Language combines with `--mode <tools|cli>` to select one independently discoverable Skill:

| Mode | Language | Skill |
| --- | --- | --- |
| `tools` | `en` | `tk` |
| `tools` | `zh` | `tk-zh` |
| `cli` | `en` | `tk-cli` |
| `cli` | `zh` | `tk-cli-zh` |

All four Skills live under `projects/tk/skills/` using their independent discovery names. Installation places the selected directory at the normal Harness Skill root without rewriting its identity.

English and Chinese Skills in the same mode provide equivalent behavior. Install, dry-run, text output, and JSON output report the resolved language and Skill. [Harness component and custom CLI Skill distribution](../08/28-tk-distribution.md) owns switching and uninstallation behavior.

## Alternatives considered

None

## Consequences

Each Harness install resolves to one of four Skill identities. Changing language replaces the selected identity through the same install lifecycle that switches modes.

The two language implementations in each mode must remain semantically aligned, but each directory is packaged and discovered independently.

## Changes

### 2026-09-03 Custom root language

Custom-root install uses the same `--language <en|zh>` selection and `en` default. Custom-root uninstall has no language selector and removes both known CLI Skill identities.
