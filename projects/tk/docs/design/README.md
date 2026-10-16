# tk design

[简体中文](./README.zh.md)

These pages define tk's current public contracts and follow the [documentation rules](./documentation.md).

The [user guide](../guide.md) covers installation and routine use. The [CLI reference](./cli-reference.md) owns command syntax, options, defaults, and exit statuses.

## Architecture

- [System architecture](./system.md) defines product scope, system components, the Task and Harness boundary, and global invariants.
- [Data model](./data-model.md) defines Task schema, representations, discovery, WAL, writes, migration, rename, cleanup, and check behavior.
- [Runtime architecture](./runtime.md) defines layers, processes, request context, failure boundaries, and version dimensions.

## Interfaces

- [Tool API](./tool-api.md) defines the six logical tools, requests, unified results, and stable errors.
- [CLI reference](./cli-reference.md) defines the complete command tree and public spelling.
- [Harness integration](./harnesses.md) defines the Codex, Claude Code, Pi, and OMP components, native adapters, and build-time assembly.

## Installation

- [Installation](./installation.md) defines embedded components, install, update, clean uninstall, and compatibility.

## Skill behavior

- [Skill behavior](./skill.md) defines when Agents use tk, authorization, Task navigation, WAL practice, and material organization.

## Maintenance

- [Validation](./validation.md) defines the observable acceptance contract.
- [Documentation](./documentation.md) defines public document ownership, bilingual maintenance, links, and current-state writing.
- [Glossary](./GLOSSARY.md) defines product terms and fixed Chinese forms.
