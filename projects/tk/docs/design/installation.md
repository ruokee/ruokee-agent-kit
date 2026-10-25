# Installation

[简体中文](./installation.zh.md)

This page describes Linux user-level CLI Skill installation and removal. The [CLI reference](./cli-reference.md#tk-install) defines command syntax and results.

## Runtime prerequisite

The fixed runtime is `$HOME/.local/bin/tk`. Before planning an operation, tk verifies that it is a regular file with at least one Unix execute bit. Skill lifecycle commands do not install, update, copy, wrap, or remove the runtime itself.

## Embedded payloads

Cargo's `build.rs` collects the complete `tk-cli` and `tk-cli-zh` source trees. It writes a deterministic `tar.zst` and matching manifest in `OUT_DIR`; the runtime embeds both through `include_bytes!`. Installation reads only these embedded bytes, without network access, a source checkout, or a local archive input.

Each language is a self-contained Skill. Every file reference resolves inside its own tree. A missing Markdown target, escaping reference, duplicate path, unsupported file, or source-tree reference stops assembly. No payload contains a runtime executable, another component's files, product source, review records, or Task materials.

## Manifest

The manifest contains:

- `component_format_version`, currently `5`;
- `runtime_version`, `source_revision`, and `archive_sha256`;
- `cli_skills` entries for `en` and `zh`, each with `language`, `skill`, `runtime_compat`, `payload`, and `files`;
- each file's content digest and Unix mode.

`runtime_compat` is `>=0.1,<0.2`. Each selection has a language and Skill identity, independent of a Harness. When `TK_SOURCE_REVISION` is set, assembly uses it; otherwise it records `package-v<CARGO_PKG_VERSION>`. The build script does not invoke Git.

Digests check the embedded archive's integrity. They do not record installation ownership or decide which modified installed files survive removal.

## Skill roots

Every install or uninstall selects exactly one of `--harness` and `--skill-root`. A Harness only maps to an ordinary Skill root:

| Harness | Root |
| --- | --- |
| Codex | `$CODEX_HOME/skills`, default `~/.codex/skills` |
| Claude Code | `~/.claude/skills` |
| Pi | `~/.pi/agent/skills` |
| OMP | `~/.omp/agent/skills` |

A custom root is the parent directory of the installed Skill. Relative roots resolve from process cwd. Component commands reject global `--cwd`, and custom-root results report an absolute `skill_root`.

Both target types manage only the direct children `tk-cli` and `tk-cli-zh`. Neither reads Harness configuration, invokes Harness commands, inspects unrelated children, or keeps installation history. Installation may create missing parent directories. All other content stays outside the operation.

## Preflight checks

Dry-run and execution validate the fixed runtime, embedded format, runtime version and compatibility, both complete language selections, archive paths, file types, permissions, duplicates, missing or extra entries, and content digests. Invalid or mismatched content fails before persistent writes.

Existing user-level operation markers block execution, dry-run, and no-change lifecycle calls. GC removes ended-process markers; lifecycle calls do not bypass them.

Each archive path must be canonical and relative, without `..` or an escape from its payload. Installed managed targets must be readable so tk can compare their content and plan additions, replacements, and removals. Planning does not read Task data, project configuration, WAL, Git state, or installation history.

## Installation

English is the default. Installation writes the complete selected Skill and removes the other language variant. Drift inside the selected target, including extra files or directories, is replaced rather than preserved. Repeating an identical install returns `no_change`. A changed selection reports `installed` or `updated`; dry-run reports `would_install` without writing.

A changing operation creates a minimal cleanup manifest, stages the payload, and revalidates observed targets before committing. It writes or replaces the selected Skill first, then removes the other language. Finally it deletes temporary content and the operation manifest.

## Removal

Uninstall deletes both managed children in deterministic order, including user modifications and extra content inside those directories. It preserves the root and all other children. Content digests do not preserve fragments of the removed Skill.

The action is `uninstalled`, `would_uninstall`, or `no_change`. Results omit language and Skill because both identities are removed.

## Failures

All domain checks finish before the first persistent mutation. Changed targets fail the precommit recheck. Ordinary I/O errors and cancellation stop further commits. Results identify actual completed and uncompleted targets and retain the original error. Partial completion is a failure, without rollback, a continuation token, or work after process exit. A later invocation rereads canonical files and forms a new complete plan.

## GC

Lifecycle operations use the [minimal cleanup manifest](./data-model.md#minimal-cleanup-manifest). After an abnormal exit, GC may delete only proven temporary content belonging to an ended process. It does not modify canonical Skill roots or user configuration, or complete an installation or removal.
