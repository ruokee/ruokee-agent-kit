# tk CLI Skill installation

Draft owner: Ruokee
Draft writer: DeepSeek V4.1 Flash

English | [中文](./19-tk-cli-skill-install.zh.md)

## Motivation

Install the CLI Skill for tk as an ordinary Skill in each supported Harness's user-level Skill root.

The English and Chinese forms are `tk-cli` and `tk-cli-zh`, and each routes Task operations through the public `tk` CLI.

The current CLI mode installs the Skill in two different ways. Codex writes the ordinary Skill directory. Claude Code installs a plugin, Pi installs a package, and OMP registers the plugin package `@ruokee/tk-omp`. Those three leave a Skill copy under the Harness's plugin or package directory, outside the ordinary Skill root. That copy can drift from the repository source, so the Harness may load an outdated Skill. The same mode also behaves differently on each Harness, and installation checks cannot use one rule.

[tk CLI mode](../../../decision/2026/09/02-tk-cli-mode.md) states that a CLI-only Harness component installs `tk-cli` or `tk-cli-zh`, and that Claude Code, Pi, and OMP also install the native manifest needed to load it. [tk distribution](../../../decision/2026/08/28-tk-distribution.md) states that the `components` collection spans four Harnesses, two modes, and two languages; component format version 3 owns that schema; Harness CLI payloads contain `tk-cli` or `tk-cli-zh` plus only the native manifest needed by that Harness; the runtime carries eighteen payloads; and supported user-level Harness integrations keep their existing installation and real-load validation.

These clauses and an ordinary-Skill-only installation cannot both hold. The component lifecycle registers a Harness object, and that registration depends on the native manifest. On Claude Code, Pi, and OMP, the component target is a directory outside the ordinary Skill root, and the registered component supplies the Skill from that directory. Adding an ordinary Skill target while keeping the component would produce two copies of the same Skill. Removing the CLI component from `components` reduces that collection to tools entries, drops the mode field and the Harness CLI payloads, changes the payload count, and requires a new format version. The clause that preserves the existing installation also fails, because CLI installation would no longer use the official component lifecycle.

## Proposal

### Installation target

A CLI-mode install writes `tk-cli` or `tk-cli-zh` to the Harness's user-level ordinary Skill root and creates no Harness registration:

- Codex uses `$CODEX_HOME/skills`, which defaults to `~/.codex/skills`.
- Claude Code uses `~/.claude/skills`.
- Pi uses `~/.pi/agent/skills`.
- OMP uses `~/.omp/agent/skills`.

`--language` defaults to `en` and writes `tk-cli`. The `zh` value writes `tk-cli-zh` and removes the other language variant from the same root. Skill identity and language mapping do not change. `--mode cli --skill-root <dir>` keeps writing only `<dir>/tk-cli` or `<dir>/tk-cli-zh`.

### One tk selection per Harness

A Harness CLI install (`--harness <h> --mode cli`) removes that Harness's tools targets and any existing tk registration. A Harness tools install (`--harness <h> --mode tools`) removes both CLI Skill directories from that Harness's Skill root. A failed registration removal keeps the tools targets and reports the removal as an incomplete item.

A Harness CLI install and `tk uninstall --harness <h>` also remove the `${XDG_DATA_HOME:-~/.local/share}/tk/components/<harness>` directory. On Claude Code, Pi, and OMP, that directory is the tools target. When the Harness executable is unavailable or its cleanup command fails, the Skill directory operation still completes and the command reports the registration cleanup as incomplete.

`--mode cli --skill-root <dir>` only manages `<dir>/tk-cli` and `<dir>/tk-cli-zh`. It does not touch Harness targets or registrations.

`tk uninstall --harness <h>` removes the Harness's tools targets, registration, both CLI Skill directories, and the component directory.

### Bundle schema

The `components` collection contains only tools entries and drops the per-entry mode field. The Harness-independent `cli_skills` collection provides the CLI selections used by all four Harnesses in both languages. Harness CLI payloads and their native manifest entries are removed. The runtime carries ten payloads. Component format version 4 owns the changed schema.

### Convergence

A Harness CLI install reports `no_change` only when the target content matches and no old registration, component directory, tools target, or other language variant remains. When cleanup items remain, it performs the available cleanup and reports the updates. A dry run with no changes reports `no_change`; a dry run with planned changes reports `would_install`.

### Failure handling

Registration cleanup and Skill directory operations are separate results. A missing Harness executable does not block the Skill directory side, and the command does not report cleanup as complete. A failed registration removal leaves the tools targets in place.

### Decision reversal

On acceptance, implementation archives [tk CLI mode](../../../decision/2026/09/02-tk-cli-mode.md) and [tk distribution](../../../decision/2026/08/28-tk-distribution.md) with their next revision numbers and writes complete bilingual successors at their canonical paths. The successors keep the still-effective rules, including tools mode content and registration, the fixed runtime executable, archive validation, deterministic lifecycle, real-load validation, and the public CLI contract.

## Alternatives considered

**Change only OMP.** OMP would write an ordinary Skill while Claude Code and Pi keep their plugin and package registrations. One mode would still install the Skill in two ways, so the installation check and the duplicate-copy problem remain on two Harnesses.

**Change OMP and Claude Code and keep the Pi package.** Pi would keep a Skill copy under its package directory. Pi also reads ordinary Skill roots, so a user could receive a stale package copy alongside the installed Skill.

**Write to the shared `~/.agents/skills` root.** That directory is a cross-tool location rather than a supported Harness's user-level Skill root. Pi reads it, so one language choice would affect every Harness that shares the directory.

## Acceptance criteria

1. A Harness CLI install on each of the four Harnesses creates `tk-cli` or `tk-cli-zh` under that Harness's user-level ordinary Skill root and creates no Harness registration.
2. `--language` defaults to `en`. Selecting `zh` leaves `tk-cli-zh` as the only tk CLI Skill in that root.
3. A Harness CLI install and a Harness tools install on the same Harness leave only the mode installed last. The CLI install removes that Harness's tools targets and registration, and the tools install removes both CLI Skill directories.
4. A Harness CLI install over a previous component installation leaves no tk plugin or package copy, no tk registration, and no component directory when the Harness executable is available.
5. When the Harness executable is unavailable, the Skill directory operations still complete and the result reports the registration cleanup as an incomplete item.
6. A failed registration removal leaves the Harness's tools targets in place and reports the removal as an incomplete item.
7. A repeated Harness CLI install with matching content and no cleanup work reports `no_change`.
8. `tk uninstall --harness <h>` removes the Harness's tools targets, registration, both CLI Skill directories, and the component directory.
9. `--mode cli --skill-root <dir>` writes only `<dir>/tk-cli` or `<dir>/tk-cli-zh` and leaves Harness targets and registrations unchanged.
10. Tools mode keeps its payload content and registration on all four Harnesses. CLI Skill content and identity do not change.
11. A newly started Harness discovers the installed Skill through its ordinary Skill mechanism.
12. The affected decisions are reversed and their successors record this contract.

## Risks

**A Harness may not discover the assumed ordinary Skill root.** Pi's user-level Skill locations and discovery rules depend on its version. If Pi does not scan the installed root, the install reports success while the Harness has no tk CLI Skill, and the user loses the guidance that the previous package provided.

**Registration cleanup can fail while the new Skill is installed.** The Harness then holds both the ordinary Skill and an old plugin copy. It can load a stale Skill or report a name conflict.

**An install can remove the tools targets before the Skill write succeeds.** The Skill directory write, or a process interruption, can fail after the tools targets and registration are gone. The Harness is then left with neither the tools integration nor the CLI Skill.

**An older runtime can restore a removed registration.** A runtime built before this change still registers the plugin or package. Running it after the new install recreates the duplicate Skill copy.
