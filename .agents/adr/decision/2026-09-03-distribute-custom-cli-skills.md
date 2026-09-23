# ADR decision: Distribute Harness components and custom CLI Skills

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol, Ruokee
Reverses: [Distribute selectable tk Harness components](../archived/2026-09-02-distribute-selectable-tk-harness-components.md)

English | [中文](./2026-09-03-distribute-custom-cli-skills.zh.md)

## Motivation

tk distributes Harness components and Harness-independent CLI Skills from one embedded bundle so that component installation remains deterministic, offline, inspectable, and reversible without a second installation database. Runtime installation and Harness integration keep separate ownership.

The `tk-cli` and `tk-cli-zh` Skills use only the public `tk` executable. They must be installable in a project-local or other Harness Skill directory without pretending that the directory is one of the four supported Harness integrations.

## Decision

### Runtime and embedded bundle

The Linux runtime remains one regular executable with a Unix execution bit at `$HOME/.local/bin/tk`. Harness components and directly installed CLI Skills verify it but never install, update, remove, wrap, or copy it.

`projects/tk/build.rs` is the only bundle assembler. Cargo produces one deterministic `tar.zst` and one manifest. The `components` collection contains multiple Harness selections spanning four Harnesses, two modes, and two languages. The separate `cli_skills` collection contains `en` and `zh` entries for the Harness-independent `tk-cli` and `tk-cli-zh` payloads.

Each Harness component entry records Harness, mode, language, Skill identity, `runtime_compat`, payload path, file types, Unix modes, and digests. Each `cli_skills` entry records language, Skill identity, `runtime_compat`, payload path, file types, Unix modes, and digests, with no Harness field. The manifest records runtime version and `source_revision` once at the top level. Component format version 3 owns this schema.

Tools payloads contain `tk` or `tk-zh` plus the selected Harness integration. Harness CLI payloads contain `tk-cli` or `tk-cli-zh` plus only the native manifest needed by that Harness. Harness-independent CLI payloads contain only the selected self-contained Skill. No payload contains a runtime copy, another component's files, review records, Task materials, or product source.

### Public lifecycle

The public commands are:

```text
tk install --harness <codex|claude|pi|omp>
  [--mode <tools|cli>] [--language <en|zh>] [--dry-run]

tk install --mode cli --skill-root <directory>
  [--language <en|zh>] [--dry-run]

tk uninstall --harness <codex|claude|pi|omp> [--dry-run]

tk uninstall --skill-root <directory> [--dry-run]
```

Each command requires exactly one of `--harness` and `--skill-root`. Harness install keeps the `tools` mode and `en` language defaults. Custom-root install requires explicit `--mode cli`, rejects tools mode, and defaults language to `en`.

Install and uninstall reject global `--cwd`. A relative Skill root resolves from the process working directory, and results report the absolute root.

### Harness and custom-root ownership

The four supported Harnesses retain their official component lifecycle. Harness install checks the Harness executable, uses its official interface or fixed driver, converges the selected component, and removes known superseded targets and registrations. Harness uninstall removes all tk-specific targets and registration owned by that Harness while preserving unrelated content.

`--skill-root` names the parent directory in which a Harness discovers Skills. The selected target is `<skill-root>/tk-cli` for English or `<skill-root>/tk-cli-zh` for Chinese. Install may create the root and its parents.

The custom lifecycle owns only those two exact CLI Skill targets. Installing one replaces its complete target and removes the other CLI target. Uninstall removes both. It preserves `tk`, `tk-zh`, every other entry, and the Skill root itself.

Custom-root operations do not require or invoke a Harness executable, install a Plugin, Package, extension, or MCP configuration, modify tk operation registration, or claim that a Harness loads the directory. Multiple custom roots may coexist. tk stores no root list, ownership record, installation history, or continuation state.

### Planning, validation, and results

Lifecycle planning reads the selected embedded payload and every target within that lifecycle's ownership boundary. Dry-run and execution share complete preflight. Operations stage content, revalidate observed targets, commit in deterministic order, stop on error or cancellation, and report completed and uncompleted items without automatic rollback. GC remains limited to registered tk temporary operation content.

Archive validation rejects unsupported formats, incompatible runtime ranges, escaping paths, symlinks, special files, duplicates, missing or extra entries, metadata mismatches, and digest mismatches before persistent writes. Installation uses no network, checkout, or local archive source.

Text and JSON results contain exactly one target field. Harness operations use `harness`; custom-root operations use `skill_root`. Install reports mode, language, and Skill. Harness uninstall omits those selection fields. Custom-root uninstall reports `mode: cli` and omits language and Skill because it removes both known CLI targets without consulting installation history.

## Alternatives considered

**Keep custom installation as a manual copy.** Manual copying provides no embedded source selection, digest validation, dry-run, deterministic update, residual-language cleanup, or bounded uninstall behavior.

**Add a `generic` Harness value.** A generic target has no Harness executable, official loading API, fixed path, or real-load validation. It would misuse the Harness concept and still require a directory argument.

**Add separate `tk skill install` and `tk skill uninstall` commands.** These commands would duplicate the current selection, archive, dry-run, result, and failure contracts for a second lifecycle with the same mechanics.

**Treat the argument as the final Skill directory.** Callers would need to choose or append the discovery name themselves, and language switching could overwrite one Skill identity with another at the same path.

## Consequences

The runtime carries eighteen payloads, so payload changes increase executable size and require rebuilding and redistributing the runtime.

Supported user-level Harness integrations keep their existing installation and real-load validation. Other Harnesses and projects can use the same CLI Skills when they can discover an ordinary Skill root, but successful file installation does not prove that a Harness loads the Skill.

A mistaken Skill root can replace or delete existing `tk-cli` or `tk-cli-zh` directories. Dry-run and complete path reporting expose the planned boundary, while clean install and uninstall deliberately treat those two exact children as tk-owned targets.
