# ADR decision: Distribute selectable tk Harness components

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol, Ruokee
Reverses: [Distribute the tk runtime and Harness components](../archived/2026-08-28-distribute-tk-runtime-components.md)
Archived: 2026-09-03
Reversed by: [Distribute Harness components and custom CLI Skills](../decision/2026-09-03-distribute-custom-cli-skills.md)

English | [中文](./2026-09-02-distribute-selectable-tk-harness-components.zh.md)

## Motivation

Runtime installation and Harness integration have separate ownership. Component installation must remain deterministic, offline, inspectable, and reversible without a second installation database.

Each Harness now needs selectable tools or CLI mode and English or Chinese Skill content. Packaging and lifecycle behavior must treat those dimensions as one explicit component selection.

## Decision

The Linux runtime remains one regular executable with a Unix execution bit at `$HOME/.local/bin/tk`. Harness components verify and start it but never install, update, remove, wrap, or copy it.

`projects/tk/build.rs` is the only component assembler. Cargo produces one deterministic `tar.zst` and one manifest containing multiple payloads spanning four Harnesses, two modes, and two languages. The manifest records the runtime version once at the top level. Each component entry records Harness, mode, language, Skill identity, `runtime_compat`, payload path, file types, Unix modes, and digests. `source_revision` identifies the source for the complete bundle. The executable embeds the archive and manifest.

Tools payloads contain `tk` or `tk-zh` plus the selected Harness integration. CLI payloads contain `tk-cli` or `tk-cli-zh` and omit MCP configuration or native operation extensions. Components contain no runtime copy, another Harness's files, review records, or product source.

The public lifecycle is:

```text
tk install --harness <codex|claude|pi|omp>
  [--mode <tools|cli>] [--language <en|zh>] [--dry-run]
tk uninstall --harness <codex|claude|pi|omp> [--dry-run]
```

Mode defaults to `tools` and language defaults to `en`. Install and dry-run report the resolved Harness, mode, language, and Skill. A different selection updates the current component directly and removes known superseded Skill targets. Uninstall takes only the Harness, removes the active selection and known residual tk variants, and preserves unrelated content.

Lifecycle planning reads fixed targets, known tk Skill targets, tk registration state, and embedded bytes. It keeps no ownership manifest, installation history, previous-content database, or partial-uninstall state. Dry-run and execution share complete preflight. Operations stage content, revalidate, commit in deterministic order, stop on error or cancellation, and report completed and incomplete items without automatic rollback.

Archive validation rejects unsupported formats, incompatible runtime ranges, escaping paths, symlinks, special files, duplicates, missing or extra entries, metadata mismatches, and digest mismatches before persistent writes. Installation does not use the network, `curl`, a checkout, or a local archive source.

The current lifecycle contract lives in [Installation](../../../projects/tk/docs/design/installation.md) and the [user guide](../../../projects/tk/docs/guide.md).

## Alternatives considered

None

## Consequences

The runtime carries multiple payloads, so component additions increase executable size and release validation work. Updating any payload requires rebuilding and redistributing the runtime.

Install converges to `no_change` when targets and registrations match the selected payload. Clean uninstall deliberately deletes modified and extra files inside tk-specific targets, including all known tk Skill variant targets, while preserving unrelated shared content.
