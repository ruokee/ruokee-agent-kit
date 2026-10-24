# tk distribution

## Goals

Provide offline Linux user-level installation, update, selection switching, and clean removal of tk Harness integrations and ordinary CLI Skills. The installed result must not depend on the source checkout. Updating a checkout alone does not update the installed runtime or its distribution.

## Out of scope

Component lifecycle commands do not install, upgrade, or uninstall the runtime itself. They do not install a second runtime, wrapper, parallel runtime version, or private executable. They do not use network sources, accept a local archive, or depend on an installation-history database.

## Public surface

### Runtime

The fixed public runtime is `$HOME/.local/bin/tk`. It must be a regular file with at least one Unix execute bit. An actual launch failure preserves the operating-system error. Every integration starts this runtime directly, without a shell or fallback runtime.

### Selections

Tools mode supports Codex, Claude Code, Pi, and OMP, each in `en` and `zh`. Each selection contains only its Harness integration and selected tools Skill. Codex and Claude Code use MCP; Pi and OMP use native tools. Independently configured external MCP for Pi or OMP is outside the native component's ownership.

CLI mode installs an ordinary `tk-cli` or `tk-cli-zh` Skill, with no registration or native manifest. Tools mode selects `tk` or `tk-zh`. English is the default language. The complete distribution provides every supported Harness and language combination in tools mode and each language's Harness-independent CLI Skill. Each is self-contained, excludes other Harnesses' content, source code, task materials, and review records, and contains no runtime executable. Identical distribution inputs produce identical selected file paths, bytes, permissions, and distribution content.

Distribution format `4` identifies each selection by language and Skill, with a Harness identity only for tools selections. It declares the runtime version, source revision, runtime compatibility range, allowed payload paths, file types, Unix modes, and content digests. Compatibility and integrity checks must use these declared facts before writing.

An install selects exactly one of `--harness codex|claude|pi|omp` or `--skill-root <directory>`. Harness mode defaults to `tools`; custom-root installation requires explicit `--mode cli` and rejects tools mode. Relative Skill roots resolve from process cwd, not global `--cwd`, which component operations reject. Report the resolved root as an absolute `skill_root`.

Harness CLI roots are:

| Harness | Skill root |
| --- | --- |
| Codex | `$CODEX_HOME/skills` |
| Claude Code | `~/.claude/skills` |
| Pi | `~/.pi/agent/skills` |
| OMP | `~/.omp/agent/skills` |

Custom-root operations manage only direct children `tk-cli` and `tk-cli-zh`. They may create a missing root and its parents. They preserve the root, `tk`, `tk-zh`, and every other child; they do not inspect Harness configuration or unrelated children, require a Harness executable, or install Harness-specific integration.

### Installation

Installation uses only the selected distribution carried by the running executable. Preflight and dry-run check the fixed runtime, selected content's format and compatibility, completeness and integrity, readable managed targets, planned modifications, and absence of another active multi-target operation. Unsupported format, incompatible runtime, malformed selection, invalid paths, unsupported file types or permissions, duplicates, missing or extra content, and corrupt content fail before persistent writes. Preflight does not inspect Task data, WAL, project configuration, Git state, or installation history.

Tools operations additionally require the Harness, its usable installation interface, and complete shared-configuration parsing. Prefer the Harness's official install/uninstall API when available. Use fixed tk-specific targets and structured tk configuration only when no usable official API exists. Configuration must point to canonical targets, never temporary locations.

Tools install writes the selected integration and registration, then removes superseded tk Skill targets, including both CLI variants. CLI install creates no registration. It removes tk registration and tools targets, writes the selected CLI Skill, removes the other CLI variant, and removes leftover component content. When registration removal fails or cannot be read, keep the tools targets, continue Skill operations and independent leftover-component cleanup, and report registration cleanup as `uncompleted`. An unavailable Harness executable does not block CLI Skill writing or removal.

Installation converges to the full selected content, including replacing drift inside a dedicated target. Repeating an install returns `no_change` only when selected content, managed target set, and registration cleanup state all match. Otherwise it reports `installed` or `updated`; dry-run with changes reports `would_install`. The result includes exactly one of `harness` and absolute `skill_root`, plus resolved `mode`, `language`, `skill`, and planned or actual changes.

### Removal

Uninstall selects exactly one Harness or Skill root, takes no mode or language selector, and reports `would_uninstall`, `uninstalled`, or `no_change`. Custom-root results report `mode:cli` and omit `language` and `skill` because both CLI variants are removed.

A completed Harness uninstall removes all tk-specific targets and registrations, known residual Skill variants, and leftover component directories. Dedicated tk targets are deleted completely, including modified and extra content. Content digests do not preserve unusable tk fragments. Unrelated Skills, Plugins, Packages, MCP registrations, user configuration, neighboring paths, and later unrelated modifications remain intact. Registration-removal failure leaves the tools cleanup incomplete while Skill directories are still removed.

Shared configuration must be fully parsed before editing. Parse failure preserves the original file and fails. Remove only the structured tk entry without comparing its old value; preserve all other entries. A configuration file may be removed only when tk created it during the current lifecycle and it becomes empty after tk removal. Otherwise preserve the valid file, even if empty. Custom-root removal deletes only its two direct CLI Skill targets and preserves the root.

### Native loading

Before the first tool registration, Pi and OMP verify the fixed runtime file and execution bit, readable version JSON, valid native contract envelope, matching runtime versions, native contract version `3`, exact selected Harness, runtime compatibility `>=0.1,<0.2`, all six tool names and descriptions, an object-valued request schema for each tool, and required host-specific fields. Compatibility range evaluation belongs to the public runtime, not an independently divergent adapter rule.

The runtime supplies complete request schemas shared by MCP and native integrations, including fields, required inputs, defaults, and create union semantics. Adapters verify schema objects, not their internal field completeness. An empty properties object is outside the adapter's preflight rejection guarantee.

Preflight failure registers zero tools, emits one bounded diagnostic, and leaves the Harness session running. There is no fallback executable. If registration itself fails partway through, stop subsequent registration and report the error; the already accepted prefix may remain. Do not claim registration rollback.

OMP marks search, read, create, update, and log as essential and exec as discoverable through `loadMode`. Pi supplies no `loadMode`. Neither adapter changes logical request defaults, union schemas, domain validation, authorization, or storage behavior. Native calls retain the interface specification's cwd, actor, cancellation, result, and transport contracts.

## Invariants

Complete all domain preflight before the first persistent mutation. Recheck planned targets before committing. Commit multi-target operations in deterministic order, stop on ordinary I/O failure or cancellation between commits, and report actual `completed` and `uncompleted` items. Partial completion is a failure, not a supported partial-install mode. Do not roll back, create a continuation token, or continue after the producer exits.

GC may remove only proven abandoned tk temporary content. It does not change canonical Harness targets, custom Skill roots, or Harness configuration, and does not complete installation or removal.

## Host lower bound

OMP tools-mode host code has maintenance lower bound `18.5.0`; Pi has `0.84.4`. Neither has an upper bound or host-version runtime gate. CLI mode ships no host-process code. Codex and Claude Code have no host maintenance lower bound. These declarations do not replace runtime/component compatibility validation.

## Acceptance criteria

- Both languages of all four tools integrations install, load, and uninstall in real isolated Harness environments. OMP additionally completes one real tool call; Codex, Claude Code, and Pi need no model call after successful loading. Observe actual loading and post-removal state.
- CLI mode is placed and discovered as an ordinary Skill in each Harness root. Custom-root behavior covers relative and absolute roots, missing parents, language switches, dry-run, exact convergence, no change, and removal while preserving unrelated contents.
- Missing runtime, non-regular runtime, missing execute bits, invalid version or contract envelope, wrong Harness, incompatible runtime, missing tools, missing or non-object request schemas, and invalid host-specific fields produce zero registrations and one bounded diagnostic without ending the session. Intermediate registration failure stops at the accepted prefix. The runtime's normal schemas remain complete and consistent with its accepted requests.
- Mode and language switching remove superseded tk content. Failed registration cleanup preserves tools targets and reports incomplete work without preventing the specified CLI Skill operations.
- Shared-configuration parse failure preserves original bytes. Clean uninstall removes modified and extra tk-owned contents while preserving unrelated entries and later changes.
- Corrupt or mismatched distribution content fails before writes. A repeated identical install returns no change; drift is restored to the complete selection. All partial failures and GC effects remain accurately observable.
