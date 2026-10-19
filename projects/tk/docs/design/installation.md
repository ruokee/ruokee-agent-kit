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

Cargo builds eight Harness tools payloads spanning four Harnesses and two languages. It also builds two Harness-independent CLI Skill payloads, one for each language. The build writes one deterministic `tar.zst` and one matching manifest in `OUT_DIR`.

The manifest stores Harness tools payloads under `components`, identified by Harness, language, and Skill. It stores standalone CLI Skill payloads under `cli_skills`, identified by language and Skill with no Harness field. The runtime embeds the manifest and archive through `include_bytes!`. Installation reads only these embedded artifacts and does not access the network.

The modes are `tools` and `cli`, and the languages are `en` and `zh`. CLI mode selects a Harness only to choose its ordinary Skill root and its registration cleanup; it uses the `cli_skills` payload rather than a component. The [CLI reference](./cli-reference.md#tk-install) holds the command defaults and the resolved Skill names.

## Manifest

The manifest records the static facts required for installation:

- component format version;
- runtime version and `runtime_compat`;
- `source_revision`;
- Harness, language, and Skill name for each Harness tools component;
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
7. For a Harness tools operation, the target Harness is available and its official interface or recorded direct configuration method can be executed. CLI mode does not require the Harness executable; failed registration cleanup keeps the tools targets and is reported as an incomplete item.

Archive validation does not establish source identity, signatures, installation ownership, or a historical digest system.

## Lifecycle

Every install and uninstall command selects exactly one target type: a supported Harness through `--harness`, or a Skill root through `--skill-root`.

Harness tools components have three basic lifecycle actions:

- install: write and register the selected component when no current tk component exists;
- update: replace the current component when its payload, registration, language, or Skill differs from the requested tools selection;
- uninstall: remove all tk-specific content and registrations, including known residual Skill variants.

A Harness CLI install writes `tk-cli` or `tk-cli-zh` to that Harness's user-level ordinary Skill root, creates no Harness registration, and installs no native manifest. It replaces drift inside the selected target, removes the other CLI Skill target, removes the Harness's tools targets, and removes any existing tk registration. A failed registration removal keeps the tools targets and is reported as incomplete. Custom-root install requires explicit CLI mode and writes the same Skill names under the supplied parent directory; it does not touch Harness targets or registrations.

Harness uninstall removes the tools targets, registrations, both CLI Skill directories, and the component directory. Custom-root uninstall removes both CLI Skill targets and has no mode or language selector.

A relative Skill root resolves from the process working directory. The global `--cwd` option is rejected for component operations. The reported `skill_root` is absolute.

Lifecycle planning uses only the fixed tk-specific targets, known Skill target names, tk configuration entries where applicable, and the selected embedded payload. It does not depend on installation history, a root registry, or another ownership database.

## Official Harness interfaces

When a supported Harness provides an official installation or uninstall API, tools mode uses that API first. tk accepts the targets and cleanup behavior defined by the official mechanism and verifies before execution that the command is available.

Only when a Harness has no usable official interface does tools mode directly manage the fixed tk-specific targets and tk configuration entries recorded in the component driver.

CLI mode does not use the official installation API. It invokes the official uninstall API only to remove an existing tk registration and continues when that command is unavailable.

Specific target paths, configuration keys, and official commands are implementation details of each Harness driver. Custom-root operations do not invoke a Harness interface or install Harness-specific wrappers, manifests, extensions, Packages, Plugins, MCP configuration, or operation registration.

## Preflight checks

Dry-run and execution share the same preflight checks:

- the fixed runtime prerequisite;
- the selected embedded manifest entry, archive, and compatibility range;
- every current target within the selected lifecycle's ownership boundary can be read;
- planned additions, replacements, and whole-directory deletions;
- no activity marker exists for a multi-target operation.

Harness tools operations additionally verify Harness availability, official interfaces, known residual targets, and complete shared-configuration parsing. Harness CLI operations verify the ordinary Skill root, the tools targets, and registration state. An unavailable Harness command or unreadable registration state does not fail CLI preflight; the registration removal becomes an incomplete cleanup item. Custom-root operations verify the absolute resolved root and the exact `tk-cli` and `tk-cli-zh` children. They do not inspect Harness configuration or unrelated entries in the root.

Preflight checks do not read Task projects, project configuration, WAL, Git state, or earlier installation history.

## Commit order

Prepare and validate first:

1. Create the minimal cleanup manifest and activity marker.
2. Prepare the selected payload in a tk temporary location.
3. Revalidate every observed target and, for Harness tools operations, shared configuration.

Then commit target changes in this order.

Harness tools operations:

1. Write or replace the selected component.
2. Add or update tk registration.
3. Remove superseded tk Skill targets.

Harness CLI operations:

1. Remove an existing tk registration. If removal fails or registration state is unreadable, keep the tools targets, continue with the Skill operations, and report the registration in `uncompleted`.
2. Remove the Harness's tools targets when registration cleanup succeeded or no registration was present.
3. Write or replace `tk-cli` or `tk-cli-zh` as selected by `--language`.
4. Remove the other CLI Skill variant.
5. Remove any leftover component directory. This cleanup does not depend on the registration result.

Custom-root operations:

1. Write or replace `tk-cli` or `tk-cli-zh` as selected by `--language`.
2. Remove the other CLI Skill variant.

Finally, delete the temporary content, manifest, and activity marker.

Custom-root install may create the supplied parent directory and its parents. It treats only `<skill-root>/tk-cli` and `<skill-root>/tk-cli-zh` as managed targets. Configuration must not point to temporary paths.

Stop immediately on an ordinary I/O error. The result lists completed and incomplete items. Do not roll back automatically, generate a continuation token, or continue after the process exits.

Rerunning install reads current files again. Return `no_change` only when the selected Skill content, the managed target set, and registration cleanup state all match the requested selection. A dry run with planned changes reports `would_install` instead.

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

## GC

Component operations use the [minimal cleanup manifest](./data-model.md#minimal-cleanup-manifest), which owns its content and the GC rules.

After an abnormal exit, GC may delete component temporary files, directories, manifests, and markers for processes that have ended. It never modifies canonical Harness targets, custom Skill roots, or Harness configuration.

## Coexistence with external content

Harness lifecycle operations manage their fixed tk-specific targets, the four known tk Skill target names, and tk entries in shared configuration. Custom-root operations manage only `tk-cli` and `tk-cli-zh` directly below the supplied root. Other Skills, Plugins, Packages, MCP registrations, user configuration, and neighboring directories are not included in the plan and are not deleted because of path proximity.

## Compatibility

The [Harness boundary](./system.md#harness-boundary) owns the split between Rust and the adapters for version compatibility.

If the component format is unsupported, the runtime is incompatible, the selected manifest entry is invalid, or the archive is invalid, fail before any persistent write. Harness tools operations also fail before writing when the Harness is unavailable. CLI operations still write or remove Skill directories; an unavailable Harness leaves only registration cleanup incomplete.
