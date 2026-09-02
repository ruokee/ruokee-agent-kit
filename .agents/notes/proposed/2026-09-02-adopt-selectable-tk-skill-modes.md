# Agent Note: Adopt selectable tk Skill modes

Status: proposed
Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol, Ruokee

English | [中文](./2026-09-02-adopt-selectable-tk-skill-modes.zh.md)

## Motivation

The current tk Skill permits both logical tools and the public CLI. In an observed OMP session, an Agent loaded that Skill, made 16 direct CLI calls and only two native tool calls, then returned to the CLI after successful native calls. Both routes were valid, so the first route selected continued to shape later operations.

Two current decisions also bind every Harness component to one English tools-mode Skill. The [Harness integration decision](../implemented/2026-08-28-integrate-tk-with-harnesses.md) fixes the installed Skill language and OMP tool loading metadata. The [runtime and component distribution decision](../implemented/2026-08-28-distribute-tk-runtime-and-harness-components.md) embeds one English component per Harness and rejects mode and language options.

The desired change keeps the existing tools mode, adds a mode that uses only the public CLI, and lets installation select one of four Skill identities by mode and language. This requires two existing decisions to be replaced and two new decisions to be added. The four final decisions have separate scopes and form one atomic contract change.

## Proposal

### New decision: Add a CLI-only mode

The existing installation already provides a `tk` tools-mode Skill. It prefers logical tools for most Task operations but does not disable the CLI completely; exec is itself a proxy for the public CLI. The new decision adds a `tk-cli` Skill that uses only the public CLI alongside the existing tools mode.

CLI-only Skill content contains no tool names, tool discovery, route comparison, tool failure, or fallback behavior. It does not state or assume that tools are absent.

A CLI-only component is lighter. It installs no Harness adapter and registers no tool schema in the Agent session, which reduces installed content and context use. The Agent must select CLI subcommands and options, and the Harness cannot constrain request structure at the invocation boundary.

### New decision: Integrate Skill language selection into `tk install`

The Chinese Skill was previously managed as a separate variant and did not enter the installation flow automatically. Users had to install and switch it manually.

The new decision adds Chinese Skills to the `tk install` selection and switching flow. The tools Skills use `tk` and `tk-zh` for English and Chinese, while the CLI-only Skills use `tk-cli` and `tk-cli-zh`.

The English and Chinese Skills provide equivalent behavior within each mode. The Chinese Skills have independent discovery names and are not same-name source variants.

### Replacement decision: Harness tool integration

tk keeps six logical tools: search, read, create, update, log, and exec. MCP and native schemas continue to come from the same Rust request types, and Harness adapters remain responsible only for conversion.

Tools-mode Skills prefer the dedicated search, read, create, update, and log tools for covered operations and do not retry a refused or failed logical operation by calling the CLI directly. exec continues to proxy the public CLI for its supported commands.

Tools-mode components install either `tk` or `tk-zh` with the corresponding Harness integration. Codex and Claude Code use MCP. Pi and OMP use native extensions. OMP marks search, read, create, update, and log as `essential`; exec remains `discoverable`.

Adapter preflight, fixed runtime execution, bounded output, cancellation, transport error separation, and partial registration behavior remain part of the Harness integration decision.

### Replacement decision: Component distribution

The runtime remains one executable at `$HOME/.local/bin/tk`. Component assembly remains deterministic, embedded, offline, and owned solely by `projects/tk/build.rs`.

Each Harness receives four selectable component variants:

| `mode` | `language` | Skill | tk integration |
| --- | --- | --- | --- |
| `tools` | `en` | `tk` | MCP or native tools |
| `tools` | `zh` | `tk-zh` | MCP or native tools |
| `cli` | `en` | `tk-cli` | none |
| `cli` | `zh` | `tk-cli-zh` | none |

`tk install` accepts `--mode <tools|cli>` and `--language <en|zh>`. The defaults are `tools` and `en`. Installation, dry-run, text output, and JSON output report the resolved mode, language, and Skill.

A mode or language change updates the current Harness installation without requiring uninstall. After success, the Harness has one tk Skill and only the integration required by that mode. Harness-only uninstall removes the current selection and known residual tk variants while preserving unrelated content.

The lifecycle continues to use current fixed targets, registrations, and embedded content rather than an installation-history database. Preflight, partial failure, cancellation, GC, and clean uninstall remain deterministic and offline.

Tools mode installs the Skill and its Harness adapter. Harness components verify and start the executable but do not install, update, remove, wrap, or copy it.

CLI-only mode installs only the `tk-cli` or `tk-cli-zh` Skill.

Each Skill and integration may reference only files inside its own directory, following the [self-contained distributable component decision](../implemented/2026-08-24-keep-distributable-components-self-contained.md).

### Required decision changes

This Note proposes one atomic change represented by four new implemented decisions. The existing Harness integration and component distribution decisions remain authoritative while this Note has status `proposed`.

The target repository state has these Agent Note changes:

1. move the [Harness integration decision](../implemented/2026-08-28-integrate-tk-with-harnesses.md) and [runtime and component distribution decision](../implemented/2026-08-28-distribute-tk-runtime-and-harness-components.md) to `archived/`;
2. add four focused decision pairs under `implemented/`:
   - `2026-09-02-add-tk-cli-only-mode`;
   - `2026-09-02-integrate-skill-language-selection-into-tk-install`;
   - `2026-09-02-integrate-tk-tools-with-harnesses`;
   - `2026-09-02-distribute-selectable-tk-harness-components`;
3. add reciprocal supersession links between each archived decision and its replacement;
4. remove this proposal;
5. add `proposed/.gitkeep` and leave it as the only entry in `proposed/`.

The repository-wide [language variant decision](../implemented/2026-08-20-package-self-contained-skill-variants.md) remains current. It continues to govern same-name source variants. The four tk Skills use independent discovery names and therefore do not change that rule. The tk product architecture and documentation maintenance decisions also remain current and receive dated changes that record the four new decisions and the updated paths and responsibilities.

## Alternatives considered

**Keep one mixed Skill and strengthen route wording.** The Skill would still teach two execution systems and allow the Agent to consider both for the same operation. With a CLI-only mode, a CLI-only installation loads no tool rules, while tools mode no longer treats the CLI as an equivalent route for operations that have dedicated logical tools.

**Select a Skill with `--skill <tk|tk-zh|tk-cli|tk-cli-zh>`.** One four-value option hides the independent mode and language dimensions and duplicates Skill names in the command contract.

**Require explicit mode and language options.** Mandatory options would break the existing install command. Defaults preserve the current English tools-mode behavior while explicit options select the other combinations.

## Acceptance criteria

- The `proposed/` directory contains this authoritative bilingual pair and no other Agent Note.
- While this Note has status `proposed`, the two existing implemented decisions remain current.
- The target repository state archives exactly the two named decision pairs and adds exactly the four named focused decision pairs under `implemented/`.
- The two replacement decisions cross-link their archived predecessors; the two new decisions archive no prior decision. The CLI-only mode decision owns only that mode's Skill identity and behavior, while the Skill language installation decision owns only the `tk install` language-selection contract.
- The target repository state removes this proposal pair, adds `proposed/.gitkeep`, and leaves it as the only entry in `proposed/`.
- The four Skill directories are self-contained, and each Harness installation loads exactly one of them.
- Tools mode prefers logical tools for covered operations, does not retry failures by calling the CLI directly, and retains exec as a proxy for the public CLI; CLI-only Skill content contains no tool-related descriptions or assumptions.
- Cargo assembles 16 valid selections across four Harnesses, two modes, and two languages.
- Install defaults, explicit selection, switching, no-change behavior, structured results, and Harness-only uninstall match this proposal.
- Product code, bilingual public documentation, isolated Harness validation, and the four implemented decisions describe the same completed behavior.

## Risks

The four final decisions cover different contracts but depend on one another. Their scopes must remain separate, and their cross-references must keep the combined behavior coherent.

Four complete Skill directories and 16 embedded component selections increase review work and the size of embedded archives and the executable. Release checks must measure the actual size and exercise all 16 selections.

A failed mode or language switch can leave completed and uncompleted changes under the existing partial-completion contract. Transition validation must cover both mode directions and both language directions for every Harness.
