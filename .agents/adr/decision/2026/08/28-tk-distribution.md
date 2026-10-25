# tk distribution

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol, Ruokee
Reverses: [tk distribution](../../../archived/2026/08/28-r4-tk-distribution.md)

English | [中文](./28-tk-distribution.zh.md)

## Motivation

Distribute two self-contained CLI Skills from one deterministic embedded bundle.

Offline installation needs no checkout or installation database. The same bounded file operation can serve known Harness roots, project-local roots, and other explicitly selected Skill directories.

## Decision

### Runtime bundle

The Linux runtime is a regular executable with a Unix execution bit at `$HOME/.local/bin/tk`. Skill lifecycle verifies this prerequisite but never installs, updates, removes, wraps, or copies the runtime.

Rust assembles complete `tk-cli` and `tk-cli-zh` source trees into deterministic embedded artifacts. Each payload contains only its self-contained Skill, without a Harness identity, runtime copy, another component's files, product source, review records, or Task materials. Source and installed references resolve inside the same Skill.

Component format `5` records runtime compatibility, language and Skill identity, allowed payload paths, file types, Unix modes, and content digests. Runtime version and source revision describe the whole distribution. The [manifest definition](../../../../../projects/tk/docs/design/installation.md#manifest) owns its field layout. Installation uses embedded bytes only, without network access, a checkout, or local archive input.

### Public lifecycle

`tk install` and `tk uninstall` select exactly one of `--harness` and `--skill-root`. Harness selection only maps an ordinary Skill root; a relative custom root resolves from process cwd. English is the install default. Component operations reject global `--cwd`.

Both target forms own only `tk-cli` and `tk-cli-zh` directly under the selected root. Installation writes the complete selected Skill before removing the other language. It replaces drift and extra content inside the selected target and returns `no_change` for identical content. Uninstall removes both targets completely, including modifications and extra content. Both preserve the root and all other content; installation may create missing parent directories.

Planning reads only the fixed runtime, managed targets, and embedded distribution. It reads no Harness configuration, invokes no Harness command, and records no root list, ownership database, installation history, previous content, or continuation state. Task project discovery, Git policy, and WAL are outside Skill lifecycle.

Dry-run and execution share complete preflight. Invalid formats, incompatible runtime ranges, escaping paths, symlinks, special files, duplicate or missing or extra archive entries, metadata mismatches, and digest mismatches fail before persistent writes. Execution stages content, revalidates targets, commits in deterministic order, and stops on error or cancellation with completed and uncompleted items and the original error. There is no automatic rollback or resume state.

GC may remove only proven temporary content from ended processes. It neither modifies canonical Skill directories nor completes lifecycle operations.

### Contract ownership

The [distribution specification](../../../../spec/tk-distribution.md) and [interface specification](../../../../spec/tk-interface.md) fully state behavior, selection, defaults, failures, compatibility, and acceptance. The [CLI reference](../../../../../projects/tk/docs/design/cli-reference.md) independently explains use; [installation design](../../../../../projects/tk/docs/design/installation.md) explains implementation and planning. Neither replaces specification requirements.

## Alternatives considered

None

## Consequences

Payload changes require rebuilding and redistributing the executable. Installers need no host executable, while actual Skill discovery remains the Harness's responsibility.

A mistaken root can replace or delete existing `tk-cli` or `tk-cli-zh` directories. Dry-run and complete path reporting expose the boundary, but complete replacement and removal deliberately treat those exact children as owned targets.
