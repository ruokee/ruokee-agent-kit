# ADR decision: Distribute the tk runtime and Harness components

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol
Archived: 2026-09-02
Reversed by: [Distribute selectable tk Harness components](./2026-09-02-distribute-selectable-tk-harness-components.md)

English | [中文](./2026-08-28-distribute-tk-runtime-components.zh.md)

## Motivation

tk distributes one user-level runtime plus one self-contained component for each of Codex, Claude Code, Pi, and OMP, with runtime installation and Harness integration under separate ownership. The [tk product architecture](../decision/2026-08-21-define-tk-product-architecture.md) defines that runtime and those components. The executable must be installed before a component can use it, while component installation must remain deterministic, offline, inspectable, and reversible without maintaining a second installation database.

Harness targets and official lifecycle APIs differ. Distribution still needs one result boundary for installation, update, no change, clean uninstall, and partial failure.

## Decision

### Runtime installation

The Linux runtime is a regular executable with a Unix execution bit at `$HOME/.local/bin/tk`. Release or user installation places the executable at that path. The Harness component lifecycle verifies and starts it but never installs, updates, or removes it.

There is one runtime path and one executable version. Harness components do not contain another runtime, wrapper, or private binary.

### Build-time component assembly

`projects/tk/build.rs` is the only component assembler. Cargo builds one self-contained component tree, deterministic `tar.zst` archive, and manifest for each supported Harness under `OUT_DIR`. The executable embeds every archive and manifest with `include_bytes!`.

Assembly reads the authoritative English Skill and source owned by the selected Harness. It validates self-containment and repository-relative links. Generated component trees and archives are not committed to Git, and no Python or second release assembler exists.

A manifest records component format, Harness, component version, `runtime_compat`, `source_revision`, allowed relative paths, file types, Unix modes, and content digests. `TK_SOURCE_REVISION` supplies `source_revision` when set. Otherwise it is `package-v<CARGO_PKG_VERSION>`. The build script does not call Git.

Installation reads only embedded bytes. Before a persistent write, archive validation rejects unsupported formats, incompatible runtime ranges, absolute or escaping paths, symlinks, special files, duplicate entries, missing or extra entries, mode mismatches, and digest mismatches. It does not access the network, download release assets, run `curl`, or accept a local archive source.

### Harness component contents

The Codex component contains the English Skill and MCP registration. The Claude Code component is a self-contained Plugin with the English Skill and MCP configuration. Pi and OMP use separate self-contained Packages with the English Skill and their native adapters.

Components do not contain the runtime, Chinese Skill, another Harness's files, review records, or product source. The [Harness integration ADR](./2026-08-28-integrate-tk-with-harnesses.md) owns tool and adapter behavior.

### Lifecycle

The public component commands require an explicit Harness:

```text
tk install --harness <codex|claude|pi|omp> [--dry-run]
tk uninstall --harness <codex|claude|pi|omp> [--dry-run]
```

`tk install` chooses install, update, or no change by comparing the embedded component with fixed tk-specific targets and tk entries in shared configuration. `tk uninstall` chooses uninstall or no change. The lifecycle does not infer a Harness from processes or directories and does not accept language, force, component version, project, actor, network source, or local archive options.

Lifecycle planning uses no ownership manifest, installation history, partial-uninstall state, or previous-content digest database. It reads current fixed targets, shared tk configuration entries, and the current embedded component.

When a Harness provides official install or uninstall APIs, tk uses them. Otherwise it manages only fixed tk-specific targets and fixed tk entries in shared structured configuration. Specific commands, paths, and keys remain driver details.

Dry-run and execution share complete preflight for the runtime, embedded component, compatibility, Harness availability, official interfaces, target readability, shared configuration parsing, planned changes, and activity markers.

Install and update stage content in a tk temporary location, revalidate targets and shared configuration, commit dedicated component targets, add or replace tk registration, remove superseded tk targets, then delete temporary content and markers. Configuration never points to staging.

### Clean uninstall and failures

Clean uninstall restores the Harness to the state it would have had if tk had never been installed while preserving unrelated content.

A fixed path dedicated to tk is deleted in full, including user modifications and extra files inside it. Shared configuration must parse completely before editing. Direct editing removes only the structured tk entry and preserves every other entry. After removal, an empty shared file is deleted only when tk created it during the current lifecycle; otherwise the file remains, including a valid empty file.

Component operations complete all reads and preflight before committing, then write in deterministic order. An error or cancellation stops the operation and reports completed and uncompleted items with the original error. It does not roll back automatically or return a continuation token. A later call replans from current targets.

GC may remove temporary component content and activity markers left by ended producers. It does not continue installation, update, or uninstall and does not modify canonical Harness targets or configuration.

The complete user and driver contracts live in the [installation design](../../../projects/tk/docs/design/installation.md) and [user guide](../../../projects/tk/docs/guide.md).

## Alternatives considered

**Install the runtime through each Harness component.** This would create multiple owners and versions of the executable. A fixed prerequisite keeps runtime distribution separate from Harness registration.

**Download release assets or accept a local source.** Network and source selection would add identity, trust, availability, and version coupling to an operation that can use bytes already carried by the executable.

**Maintain ownership manifests and installation history.** Historical state would become another database and could conflict with current targets after manual changes. Fixed targets and current configuration provide the required plan.

**Keep generated component trees or a Python assembler in the repository.** Multiple source and assembly paths could produce different payloads. One Rust build path gives publishing, installation, and validation the same bytes.

**Preserve modified files inside a tk-specific target.** This would leave fragments that no longer form a usable component and would violate the clean-uninstall result.

## Consequences

The runtime executable carries all four component archives and manifests, so its size includes those payloads. Updating component content requires rebuilding and redistributing the runtime.

Component installation works without network access or source checkout. Repeated installation converges to no change when fixed targets and registrations match the embedded component.

Clean uninstall deliberately deletes every file inside a tk-specific target, including user changes. Unrelated shared content remains outside that boundary. Harness API or configuration changes require driver updates and validation against the real Harness.

Runtime removal is a separate user or release action. Uninstalling every Harness component does not remove `$HOME/.local/bin/tk`.
