# tk distribution

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol, Ruokee
Reverses: [tk distribution](../../../archived/2026/08/28-r3-tk-distribution.md)
Archived: 2026-10-25
Reversed by: [tk distribution](../../../decision/2026/08/28-tk-distribution.md)

English | [中文](./28-r4-tk-distribution.zh.md)

## Motivation

Distribute the Harness tools components and Harness-independent CLI Skills for tk from one embedded bundle, with a shared install, update, and uninstall path.

Component installation must remain deterministic, offline, inspectable, and reversible without a second installation database. Runtime installation and Harness integration keep separate ownership.

The `tk-cli` and `tk-cli-zh` Skills use only the public `tk` executable. They must be installable in a project-local or other Harness Skill directory, which is not one of the four supported Harness integrations.

## Decision

### Runtime bundle

The Linux runtime remains one regular executable with a Unix execution bit at `$HOME/.local/bin/tk`. Harness components and directly installed CLI Skills verify it but never install, update, remove, wrap, or copy it.

One build assembles a deterministic embedded distribution containing every supported Harness and language combination in tools mode and each language's Harness-independent CLI Skill. [Installation design](../../../../../projects/tk/docs/design/installation.md#embedded-payloads) owns the assembler and archive organization.

Component format version `4` records runtime compatibility, selection identity, allowed payload paths, file types, Unix modes, and content digests. Runtime version and source revision describe the distribution as a whole. Tools selections include a Harness identity; standalone CLI selections do not. The [manifest definition](../../../../../projects/tk/docs/design/installation.md#manifest) owns the field layout.

Tools payloads contain `tk` or `tk-zh` plus the selected Harness integration. Harness-independent CLI payloads contain only the selected self-contained Skill. No payload contains a runtime copy, another component's files, review records, Task materials, or product source.

### Public lifecycle

The public `tk install` and `tk uninstall` synopses, their flag defaults and mutual exclusion, their absolute-root reporting, and the archive and result rules live in the [CLI reference](../../../../../projects/tk/docs/design/cli-reference.md); the lifecycle semantics, target layout, custom-root rules, and operation planning live in the [installation design](../../../../../projects/tk/docs/design/installation.md).

A Harness CLI install writes `tk-cli` or `tk-cli-zh` to the Harness's user-level ordinary Skill root and creates no Harness registration. It removes that Harness's tools targets and any existing tk registration, and removes the other language variant. A failed registration removal keeps the tools targets and reports the removal as incomplete. A tools install removes both CLI Skill directories. Uninstall removes the tools targets, registrations, both CLI Skill directories, and any component directory.

Lifecycle planning reads fixed targets, known tk Skill targets, tk registration state, and embedded bytes. It keeps no ownership manifest, installation history, previous-content database, or partial-uninstall state. Dry-run and execution share complete preflight. Operations stage content, revalidate, commit in deterministic order, stop on error or cancellation, and report completed and incomplete items without automatic rollback.

Archive validation rejects unsupported formats, incompatible runtime ranges, escaping paths, symlinks, special files, duplicates, missing or extra entries, metadata mismatches, and digest mismatches before persistent writes. Installation does not use the network, `curl`, a checkout, or a local archive source.

### Harness ownership

Tools mode retains the four supported Harnesses' official component lifecycle. CLI mode installs ordinary Skills and does not invoke that lifecycle. Custom-root operations require no Harness executable. tk stores no root list, ownership record, installation history, or continuation state.

## Alternatives considered

None

## Consequences

The runtime carries the complete distribution, so payload additions increase executable size and payload changes require rebuilding and redistributing the runtime.

A CLI install or uninstall without a Harness executable still writes or removes Skill directories, while registration cleanup remains an incomplete item. The next run with a working Harness command completes that cleanup.

Supported user-level Harness integrations keep their existing tools installation and real-load validation. CLI installation proves only file placement; the Harness must scan the ordinary Skill root before the Skill is available.

A mistaken Skill root can replace or delete existing `tk-cli` or `tk-cli-zh` directories. Dry-run and complete path reporting expose the planned boundary, while clean install and uninstall deliberately treat those two exact children as tk-owned targets.

## Changes

### 2026-10-23 Specification completeness

The [distribution specification](../../../../spec/tk-distribution.md) and [interface specification](../../../../spec/tk-interface.md) fully state lifecycle behavior, selections, defaults, failures, compatibility, and acceptance. The CLI reference independently describes the same usage contract; installation design explains its implementation and operation planning. These references do not replace specification requirements. This applies the [specification decision](../../../decision/2026/10/04-specifications.md) without changing distribution or lifecycle behavior.
