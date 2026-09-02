# Installation

[简体中文](./installation.zh.md)

This page defines the Linux user-level tk runtime prerequisites, embedded Harness components, installation, update, uninstall, and failure semantics. See the [CLI reference](./cli-reference.md#tk-install) for command syntax and [Harness integration](./harnesses.md) for component contents.

## Runtime prerequisites

Harness components use the fixed runtime path:

```text
$HOME/.local/bin/tk
```

Before installing a component, verify that this path exists, is a regular file, and has at least one Unix execute bit set. If the actual launch fails, preserve the operating system error.

The tk component lifecycle does not install, update, or remove the runtime itself.

## Embedded components

Cargo builds sixteen payloads from four Harnesses, two modes, and two languages. It writes one deterministic `tar.zst` and one matching manifest in `OUT_DIR`.

Each selection is identified by Harness, mode, language, and Skill name. The runtime embeds the manifest and archive through `include_bytes!`. Installation reads only these embedded artifacts and does not access the network.

The modes are `tools` and `cli`. The languages are `en` and `zh`. Their Skill names are `tk`, `tk-zh`, `tk-cli`, and `tk-cli-zh`. Install defaults to tools mode and English.

## Manifest

The component manifest records the static facts required for installation:

- component format version;
- Harness, mode, language, and Skill name;
- runtime version;
- `runtime_compat`;
- `source_revision`;
- allowed relative paths, file types, permissions, and content digests within the archive.

The digests verify that the embedded archive is not corrupted or mismatched with its paths. They do not record installation ownership or determine what uninstall preserves.

When `TK_SOURCE_REVISION` is set, use its value. Otherwise, `source_revision` is `package-v<CARGO_PKG_VERSION>`. The build script does not invoke Git.

## Archive validation

Complete all of the following before any persistent write:

1. The manifest and archive can be decoded.
2. The component format is supported.
3. Rust determines that the runtime version satisfies `runtime_compat`.
4. The Harness, mode, language, Skill name, and payload root match the request.
5. Every archive path is a canonical relative path, is not absolute, contains no `..`, and does not escape.
6. File types, permissions, duplicate entries, missing entries, extra entries, and digests match the manifest.
7. The target Harness is available, and its official interface or recorded direct configuration method can be executed.

Archive validation does not establish source identity, signatures, installation ownership, or a historical digest system.

## Lifecycle

Harness components have only three basic lifecycle actions:

- install: write and register the selected component when no current tk component exists;
- update: replace the current component when its payload, registration, mode, language, or Skill differs from the requested selection;
- uninstall: remove all tk-specific content and registrations, including known residual Skill variants.

`tk install` performs install, update, or no_change according to the current state. Mode defaults to `tools` and language defaults to `en`. `tk uninstall` performs uninstall or no_change and takes no mode or language selector.

Lifecycle planning uses fixed tk-specific targets, known tk Skill variant targets, tk configuration entries, and the selected embedded component. It does not depend on installation history or another ownership database.

## Official Harness interfaces

When a Harness provides an official installation or uninstall API, use that API first. tk accepts the targets and cleanup behavior defined by the official mechanism and verifies before execution that the command is available.

Only when a Harness has no usable official interface does tk directly manage the fixed tk-specific targets and tk configuration entries recorded in the component driver.

Specific target paths, configuration keys, and official commands are implementation details of each Harness driver. They are not a cross-Harness architectural contract.

## Preflight checks

The dry-run and execution paths for install, update, and uninstall share the following preflight checks:

- runtime prerequisites;
- the selected embedded manifest entry, archive, and compatibility range;
- Harness availability and official interfaces;
- all current and known residual dedicated targets can be read;
- shared configuration can be parsed completely;
- planned additions, replacements, whole-directory deletions, and structured configuration deletions;
- no activity marker exists for a multi-target operation.

Preflight checks do not read Task projects, project configuration, WAL, or Git state.

## Installation and update

Commit an installation or update in this deterministic order:

1. Create the minimal cleanup manifest and activity marker.
2. Prepare the selected component content in a tk temporary location.
3. Revalidate all fixed targets, known residual targets, and shared configuration.
4. Commit the selected tk-specific files and directories.
5. Add, replace, or remove tk registration as required by the selected mode.
6. Delete tk-specific Skill targets superseded by the selection.
7. Delete the temporary content, manifest, and activity marker.

Configuration must not point to temporary paths.

Stop immediately on an ordinary I/O error. The result lists completed and incomplete items. Do not roll back automatically, generate a continuation token, or continue after the process exits.

Rerunning install reads the current state again. If it matches the embedded component, return no_change without reading domain state from the previous failure.

## Clean uninstall

After uninstall completes, the Harness must be equivalent to one where tk was never installed, while preserving preexisting content and later changes unrelated to tk.

### tk-specific targets

When a fixed path is explicitly dedicated to tk, uninstall deletes the entire file or directory. This also deletes user-modified files and extra content within the directory. For Codex, all four known Skill targets are dedicated tk paths and are removed together. Do not retain unusable tk fragments after uninstall.

This rule does not apply to shared directories.

### Shared structured configuration

Use the official uninstall API first when available. When shared configuration must be edited directly:

1. Read and parse it completely.
2. If parsing fails, leave the original file unchanged and return an error.
3. Delete only the structured configuration entry corresponding to tk, without comparing its old value.
4. Preserve all other configuration.
5. If tk created the configuration file during the current Harness lifecycle and the file is empty after removing the tk entry, the file may be deleted.
6. Otherwise, preserve the file, including a valid empty shared configuration file.

Each fixed Harness driver must explicitly identify which configuration files are tk-specific and which are shared.

### Uninstall commit

Complete all reads and parsing before uninstall modifies anything. Then, in deterministic order, revoke tk registrations, delete the active component target, delete known residual Skill variant targets, and remove tk entries from shared configuration. On an ordinary I/O error, stop and report completed and incomplete items.

Partial completion here is a failure state, not an optional partial-uninstall feature. tk does not preserve modified tk-specific files based on content digests.

## Temporary content and GC

Component operations use the [minimal cleanup manifest](./data-model.md#minimal-cleanup-manifest). The manifest records only the process identity, creation time, and tk temporary paths.

After an abnormal exit, GC may delete component temporary files, directories, manifests, and markers for processes that have ended. GC does not continue install, update, or uninstall, and does not modify canonical Harness targets or configuration.

## Coexistence with external content

tk operates only on its fixed tk-specific targets, the four known tk Skill target names, and tk entries in shared configuration. Other Skills, Plugins, Packages, MCP registrations, and user configuration are not included in the plan and are not deleted because of path proximity.

## Compatibility

Rust parses and evaluates `runtime_compat`. Pi and OMP TypeScript adapters only read the version and generated contract validated by Rust. They do not implement their own semver parsers.

If the component format is unsupported, the runtime is incompatible, the Harness is unavailable, or the archive is invalid, fail before any persistent write.
