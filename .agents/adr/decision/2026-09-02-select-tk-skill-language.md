# ADR decision: Integrate Skill language selection into tk install

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol, Ruokee

English | [中文](./2026-09-02-select-tk-skill-language.zh.md)

## Motivation

`tk install` must select the Skill language so that a Chinese Skill uses the Harness component lifecycle rather than a separate manual install. A manually installed Chinese Skill sits outside that lifecycle: users must install and switch it separately, and tk cannot report or update the selected language as part of the component state.

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

English and Chinese Skills in the same mode provide equivalent behavior. Install, dry-run, text output, and JSON output report the resolved language and Skill. [Harness component and custom CLI Skill distribution](./2026-09-03-distribute-custom-cli-skills.md) owns switching and uninstallation behavior.

## Alternatives considered

**Use `--skill <tk|tk-zh|tk-cli|tk-cli-zh>`.** A four-value option hides the independent mode and language dimensions and duplicates Skill identities in the command contract.

**Require an explicit language every time.** This would break the existing install command. The English default preserves its behavior.

**Keep Chinese Skills outside tk install.** The selected language would remain unmanaged and could drift from the active component.

## Consequences

Each Harness install resolves to one of four Skill identities. Changing language uses the same component update lifecycle as changing mode.

The two language implementations in each mode must remain semantically aligned, but each directory is packaged and discovered independently.

## Changes

### 2026-09-03: Apply language selection to custom roots

Custom-root install uses the same `--language <en|zh>` selection and `en` default. Custom-root uninstall has no language selector and removes both known CLI Skill identities.
