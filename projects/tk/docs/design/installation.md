# Installation

[简体中文](./installation.zh.md)

This page defines the Linux user-level tk runtime prerequisite, embedded Harness components and standalone CLI Skill payloads, installation, update, uninstall, and failure semantics. See the [CLI reference](./cli-reference.md#tk-install) for command syntax and [Harness integration](./harnesses.md) for supported Harness contents.

## Runtime prerequisite

Every component lifecycle uses the fixed runtime path:

```text
$HOME/.local/bin/tk
```

Before planning an operation, tk verifies that this path exists, is a regular file, and has at least one Unix execute bit set. If an actual Harness launch fails, tk preserves the operating system error.

Component lifecycle commands do not install, update, or remove the runtime itself.

## Embedded payloads

Cargo builds multiple Harness payloads spanning four Harnesses, two modes, and two languages. It also builds two Harness-independent CLI Skill payloads, one for each language. The build writes one deterministic `tar.zst` and one matching manifest in `OUT_DIR`.

The manifest stores Harness payloads under `components`, identified by Harness, mode, language, and Skill. It stores standalone CLI Skill payloads under `cli_skills`, identified by language and Skill with no Harness field. The runtime embeds the manifest and archive through `include_bytes!`. Installation reads only these embedded artifacts and does not access the network.

The modes are `tools` and `cli`. The languages are `en` and `zh`. Their Skill names are `tk`, `tk-zh`, `tk-cli`, and `tk-cli-zh`. Harness install defaults to tools mode and English. Custom-root install supports only CLI mode and defaults to English.

## Manifest

The manifest records the static facts required for installation:

- component format version;
- runtime version and `runtime_compat`;
- `source_revision`;
- Harness, mode, language, and Skill name for each Harness component;
- language and Skill name for each standalone CLI Skill;
- allowed relative paths, file types, permissions, and content digests within the archive.

The digests verify that the embedded archive is not corrupted or mismatched with its paths. They do not record installation ownership or determine what uninstall preserves.

When `TK_SOURCE_REVISION` is set, use its value. Otherwise, `source_revision` is `package-v<CARGO_PKG_VERSION>`. The build script does not invoke Git.

## Archive validation

Complete all of the following before any persistent write:

1. The manifest and archive can be decoded.
2. The component format is supported.
3. Rust determines that the runtime version satisfies `runtime_compat`.
4. The requested target, mode, language, Skill name, and payload root match the selected manifest entry.
5. Every archive path is a canonical relative path, is not absolute, contains no `..`, and does not escape.
6. File types, permissions, duplicate entries, missing entries, extra entries, and digests match the manifest.
7. For a Harness operation, the target Harness is available and its official interface or recorded direct configuration method can be executed.

Archive validation does not establish source identity, signatures, installation ownership, or a historical digest system.

## Lifecycle

Every install and uninstall command selects exactly one target type: a supported Harness through `--harness`, or a Skill root through `--skill-root`.

Harness components have three basic lifecycle actions:

- install: write and register the selected component when no current tk component exists;
- update: replace the current component when its payload, registration, mode, language, or Skill differs from the requested selection;
- uninstall: remove all tk-specific content and registrations, including known residual Skill variants.

Custom-root install requires explicit CLI mode. It writes `tk-cli` for English or `tk-cli-zh` for Chinese under the supplied parent directory, replaces drift inside the selected target, removes the other CLI Skill target, and converges to no_change when the managed targets match. Custom-root uninstall removes both CLI Skill targets and has no mode or language selector.

A relative Skill root resolves from the process working directory. The global `--cwd` option is rejected for component operations. The reported `skill_root` is absolute.

Lifecycle planning uses only the fixed tk-specific targets, known Skill target names, tk configuration entries where applicable, and the selected embedded payload. It does not depend on installation history, a root registry, or another ownership database.

## Official Harness interfaces

When a supported Harness provides an official installation or uninstall API, use that API first. tk accepts the targets and cleanup behavior defined by the official mechanism and verifies before execution that the command is available.

Only when a Harness has no usable official interface does tk directly manage the fixed tk-specific targets and tk configuration entries recorded in the component driver.

Specific target paths, configuration keys, and official commands are implementation details of each Harness driver. Custom-root operations do not invoke a Harness interface or install Harness-specific wrappers, manifests, extensions, Packages, Plugins, MCP configuration, or operation registration.

## Preflight checks

Dry-run and execution share the same preflight checks:

- the fixed runtime prerequisite;
- the selected embedded manifest entry, archive, and compatibility range;
- every current target within the selected lifecycle's ownership boundary can be read;
- planned additions, replacements, and whole-directory deletions;
- no activity marker exists for a multi-target operation.

Harness operations additionally verify Harness availability, official interfaces, known residual targets, and complete shared-configuration parsing. Custom-root operations verify the absolute resolved root and the exact `tk-cli` and `tk-cli-zh` children. They do not inspect Harness configuration or unrelated entries in the root.

Preflight checks do not read Task projects, project configuration, WAL, Git state, or earlier installation history.

## Installation and update

Commit an installation or update in this deterministic order:

1. Create the minimal cleanup manifest and activity marker.
2. Prepare the selected payload in a tk temporary location.
3. Revalidate every observed target and, for Harness operations, shared configuration.
4. Commit the selected tk-specific files and directories.
5. For Harness operations, add, replace, or remove tk registration as required by the selected mode.
6. Delete tk-specific Skill targets superseded by the selection.
7. Delete the temporary content, manifest, and activity marker.

Custom-root install may create the supplied parent directory and its parents. It treats only `<skill-root>/tk-cli` and `<skill-root>/tk-cli-zh` as managed targets. Configuration must not point to temporary paths.

Stop immediately on an ordinary I/O error. The result lists completed and incomplete items. Do not roll back automatically, generate a continuation token, or continue after the process exits.

Rerunning install reads current files again. If they match the selected embedded payload, return no_change without reading domain state from a previous failure.

## Clean uninstall

Clean uninstall removes every target owned by the selected lifecycle, including modified and extra content inside dedicated tk directories, while preserving unrelated content.

### Harness targets

After Harness uninstall completes, that Harness must be equivalent to one where tk was never installed. When a fixed path is explicitly dedicated to tk, uninstall deletes the entire file or directory. For Codex, all four known Skill targets are dedicated tk paths and are removed together. Do not retain unusable tk fragments after uninstall.

This rule does not apply to shared directories.

### Custom Skill roots

Custom-root uninstall removes both `<skill-root>/tk-cli` and `<skill-root>/tk-cli-zh`. It preserves the Skill root itself, `tk`, `tk-zh`, and every other child. It does not remove Harness registration because custom-root install never creates one.

### Shared structured configuration

Use the official Harness uninstall API first when available. When shared configuration must be edited directly:

1. Read and parse it completely.
2. If parsing fails, leave the original file unchanged and return an error.
3. Delete only the structured configuration entry corresponding to tk, without comparing its old value.
4. Preserve all other configuration.
5. If tk created the configuration file during the current Harness lifecycle and the file is empty after removing the tk entry, the file may be deleted.
6. Otherwise, preserve the file, including a valid empty shared configuration file.

Each fixed Harness driver must explicitly identify which configuration files are tk-specific and which are shared.

### Uninstall commit

Complete all reads and parsing before uninstall modifies anything. Harness uninstall revokes tk registrations, deletes the active component target and known residual Skill variants, and removes tk entries from shared configuration. Custom-root uninstall deletes the two CLI Skill targets. Both paths use deterministic order and stop on ordinary I/O errors with completed and incomplete items.

Partial completion is a failure state, not an optional partial-uninstall feature. tk does not preserve modified tk-specific files based on content digests.

## Temporary content and GC

Component operations use the [minimal cleanup manifest](./data-model.md#minimal-cleanup-manifest). The manifest records only the process identity, creation time, and tk temporary paths.

After an abnormal exit, GC may delete component temporary files, directories, manifests, and markers for processes that have ended. GC does not continue install, update, or uninstall, and does not modify canonical Harness targets, custom Skill roots, or Harness configuration.

## Coexistence with external content

Harness lifecycle operations manage their fixed tk-specific targets, the four known tk Skill target names, and tk entries in shared configuration. Custom-root operations manage only `tk-cli` and `tk-cli-zh` directly below the supplied root. Other Skills, Plugins, Packages, MCP registrations, user configuration, and neighboring directories are not included in the plan and are not deleted because of path proximity.

## Compatibility

Rust parses and evaluates `runtime_compat`. Pi and OMP TypeScript adapters only read the version and generated contract validated by Rust. They do not implement their own semver parsers.

If the component format is unsupported, the runtime is incompatible, the selected manifest entry is invalid, or the archive is invalid, fail before any persistent write. Harness operations also fail before writing when the Harness is unavailable.
