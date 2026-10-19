# tk distribution

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol, Ruokee
Reverses: [tk distribution](./28-r2-tk-distribution.md)
Archived: 2026-10-19
Reversed by: [tk distribution](../../../decision/2026/08/28-tk-distribution.md)

English | [中文](./28-r3-tk-distribution.zh.md)

## Motivation

Distribute Harness components and Harness-independent CLI Skills from one embedded tk bundle, with a shared install, update, and uninstall path.

Component installation must remain deterministic, offline, inspectable, and reversible without a second installation database. Runtime installation and Harness integration keep separate ownership.

The `tk-cli` and `tk-cli-zh` Skills use only the public `tk` executable. They must be installable in a project-local or other Harness Skill directory without pretending that the directory is one of the four supported Harness integrations.

## Decision

### Runtime bundle

The Linux runtime remains one regular executable with a Unix execution bit at `$HOME/.local/bin/tk`. Harness components and directly installed CLI Skills verify it but never install, update, remove, wrap, or copy it.

`projects/tk/build.rs` is the only bundle assembler. Cargo produces one deterministic `tar.zst` and one manifest. The `components` collection contains multiple Harness selections spanning four Harnesses, two modes, and two languages. The separate `cli_skills` collection contains `en` and `zh` entries for the Harness-independent `tk-cli` and `tk-cli-zh` payloads.

Each Harness component entry records Harness, mode, language, Skill identity, `runtime_compat`, payload path, file types, Unix modes, and digests. Each `cli_skills` entry records language, Skill identity, `runtime_compat`, payload path, file types, Unix modes, and digests, with no Harness field. The manifest records runtime version and `source_revision` once at the top level. Component format version 3 owns this schema.

Tools payloads contain `tk` or `tk-zh` plus the selected Harness integration. Harness CLI payloads contain `tk-cli` or `tk-cli-zh` plus only the native manifest needed by that Harness. Harness-independent CLI payloads contain only the selected self-contained Skill. No payload contains a runtime copy, another component's files, review records, Task materials, or product source.

### Public lifecycle

The public `tk install` and `tk uninstall` synopses, their flag defaults and mutual exclusion, their absolute-root reporting, and the archive and result rules live in the [CLI reference](../../../../../projects/tk/docs/design/cli-reference.md); the lifecycle semantics, target layout, custom-root rules, and operation planning live in the [installation design](../../../../../projects/tk/docs/design/installation.md).

### Harness ownership

The four supported Harnesses retain their official component lifecycle, and custom-root operations require no Harness executable. tk stores no root list, ownership record, installation history, or continuation state.

## Alternatives considered

**Keep custom installation as a manual copy.** Manual copying provides no embedded source selection, digest validation, dry-run, deterministic update, residual-language cleanup, or bounded uninstall behavior.

**Add a `generic` Harness value.** A generic target has no Harness executable, official loading API, fixed path, or real-load validation. It would misuse the Harness concept and still require a directory argument.

**Add separate `tk skill install` and `tk skill uninstall` commands.** These commands would duplicate the current selection, archive, dry-run, result, and failure contracts for a second lifecycle with the same mechanics.

**Treat the argument as the final Skill directory.** Callers would need to choose or append the discovery name themselves, and language switching could overwrite one Skill identity with another at the same path.

## Consequences

The runtime carries eighteen payloads, so payload changes increase executable size and require rebuilding and redistributing the runtime.

Supported user-level Harness integrations keep their existing installation and real-load validation. Other Harnesses and projects can use the same CLI Skills when they can discover an ordinary Skill root, but successful file installation does not prove that a Harness loads the Skill.

A mistaken Skill root can replace or delete existing `tk-cli` or `tk-cli-zh` directories. Dry-run and complete path reporting expose the planned boundary, while clean install and uninstall deliberately treat those two exact children as tk-owned targets.
