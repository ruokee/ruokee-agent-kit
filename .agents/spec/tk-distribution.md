# tk distribution

## Goals

Provide offline Linux installation, update, language switching, and clean removal of ordinary CLI Skills in known Harness roots or user-selected roots. Installed content must not depend on a source checkout. Updating a checkout alone does not update the installed runtime or distribution.

## Out of scope

Component lifecycle commands do not install, upgrade, or uninstall the runtime itself. They do not install a second runtime, wrapper, parallel runtime version, or private executable. They do not use network sources, accept a local archive, or depend on an installation-history database.

## Public surface

### Runtime

The fixed public runtime is `$HOME/.local/bin/tk`. It must be a regular file with at least one Unix execute bit. An actual launch failure preserves the operating-system error.

### Selections

The distribution contains exactly two ordinary Skills: English `tk-cli` and Chinese `tk-cli-zh`. English is the default. Each contains its complete references, resolves every file reference inside itself in both source and installed form, and excludes other components, product source, Task materials, review records, and runtime executables. Identical distribution inputs produce identical selected paths, bytes, permissions, and distribution content.

Distribution format `5` identifies each selection by language and Skill without a Harness identity. It declares the runtime version, source revision, compatibility range `>=0.1,<0.2`, allowed payload paths, file types, Unix modes, and content digests. Compatibility and integrity checks use these facts before writing.

Install selects exactly one of `--harness codex|claude|pi|omp` and `--skill-root <directory>`, with optional `--language en|zh`. Relative roots resolve from process cwd. Component operations reject global `--cwd`. Custom-root results report an absolute `skill_root`.

Harness root mappings are:

| Harness | Skill root |
| --- | --- |
| Codex | `$CODEX_HOME/skills`, default `~/.codex/skills` |
| Claude Code | `~/.claude/skills` |
| Pi | `~/.pi/agent/skills` |
| OMP | `~/.omp/agent/skills` |

Both target forms manage only direct children `tk-cli` and `tk-cli-zh`. Installation may create a missing root and parents. Operations preserve the root and every other child, do not inspect Harness configuration or unrelated children, and require no Harness executable.

### Installation

Installation uses only the selected distribution carried by the running executable. Preflight and dry-run check the fixed runtime, selected content's format and compatibility, completeness and integrity, readable managed targets, planned modifications, and absence of another active multi-target operation. Unsupported format, incompatible runtime, malformed selection, invalid paths, unsupported file types or permissions, duplicates, missing or extra content, and corrupt content fail before persistent writes. Preflight does not inspect Task data, WAL, project configuration, Git state, or installation history.

Installation writes the complete selected Skill, then removes the other language from the same root.

Installation converges to the full selected content, replacing drift and extra contents inside the selected target. An identical selection and managed target set return `no_change`; otherwise the action is `installed` or `updated`. Dry-run with changes returns `would_install` without writing. Results contain exactly one of `harness` and absolute `skill_root`, plus resolved `language`, `skill`, and planned or actual changes.

### Removal

Uninstall selects exactly one Harness or Skill root, takes no language selector, and returns `would_uninstall`, `uninstalled`, or `no_change`. It reports exactly one target field and planned or actual changes, omitting `language` and `skill` because both identities are removed.

Removal deletes both direct CLI Skill targets completely, including modified and extra content. Content digests do not preserve fragments. The root, all other children, user configuration, neighboring paths, and later unrelated modifications remain intact. No Harness configuration is read or changed.

## Invariants

Complete all domain preflight before the first persistent mutation. Recheck planned targets before committing. Commit multi-target operations in deterministic order, stop on ordinary I/O failure or cancellation between commits, and report actual `completed` and `uncompleted` items. Partial completion is a failure, not a supported partial-install mode. Do not roll back, create a continuation token, or continue after the producer exits.

GC may remove only proven abandoned tk temporary content. It does not change canonical Skill targets, their roots, or user configuration, and does not complete installation or removal.

## Host lower bound

CLI Skills ship no host-process code and have no host maintenance lower bound. Runtime and distribution compatibility requirements remain independent.

## Acceptance criteria

- Both languages are placed and discovered as ordinary Skills in each known Harness root. Harness scenarios observe actual discovery and post-removal state, rather than infer it from installed files. OMP also exercises a Task command through the CLI.
- Both target forms support language switching, dry-run, exact convergence, no change, and removal while preserving unrelated content and configuration. Custom roots support relative and absolute paths and missing parent creation.
- Lifecycle succeeds without Harness executables or configuration access. Missing runtime, non-regular runtime, or missing execute bits fail before writes.
- Clean uninstall removes modified and extra content inside both owned targets while preserving their root and unrelated items.
- Corrupt or mismatched distribution content fails before writes. A repeated identical install returns no change; drift is restored to the complete selection. All partial failures and GC effects remain accurately observable.
