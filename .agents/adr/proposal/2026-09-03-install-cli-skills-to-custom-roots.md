# ADR proposal: Install tk CLI Skills into custom roots

Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol, Ruokee

English | [中文](./2026-09-03-install-cli-skills-to-custom-roots.zh.md)

## Motivation

The `tk-cli` and `tk-cli-zh` Skills use only the public `tk` executable. Their Task behavior does not depend on MCP, native operations, or a Harness-specific adapter.

`tk install` currently requires Codex, Claude Code, Pi, or OMP. Users of another Harness must copy a Skill manually even when that Harness can discover an ordinary Skill directory. The same restriction prevents `tk install` from placing a CLI Skill in a project-local Skill directory.

A direct Skill target must preserve the current offline bundle, deterministic updates, dry-run, bounded cleanup, and no installation database. It must not turn an arbitrary directory into a fictitious Harness integration.

## Proposal

### Command and target selection

Keep the current Harness commands and add a custom Skill-root form:

```text
tk install --harness <codex|claude|pi|omp>
  [--mode <tools|cli>] [--language <en|zh>]
  [--dry-run]

tk install --mode cli --skill-root <directory>
  [--language <en|zh>] [--dry-run]

tk uninstall --harness <codex|claude|pi|omp> [--dry-run]

tk uninstall --skill-root <directory> [--dry-run]
```

`--harness` and `--skill-root` are mutually exclusive, and one is required. The custom form requires an explicit `--mode cli`; it rejects tools mode. Existing Harness defaults and behavior do not change.

A relative `--skill-root` resolves from the process working directory. An absolute path is used directly. Install and uninstall continue to reject global `--cwd`; the Skill root is an installation target, not tk project-discovery context.

### Skill-root semantics

`--skill-root` names the directory in which a Harness discovers Skills. It does not name the final Skill directory. The selected language determines the child target:

| Language | Installed target |
| --- | --- |
| `en` | `<skill-root>/tk-cli` |
| `zh` | `<skill-root>/tk-cli-zh` |

Install may create a missing root and its parents. It preserves the Skill's stable discovery name and does not rewrite Skill metadata or links.

The custom lifecycle owns only the two exact CLI Skill targets under the supplied root: `tk-cli` and `tk-cli-zh`. Installing one CLI Skill replaces its complete target and removes the other CLI target. Uninstall removes both. The `tk` and `tk-zh` tools Skills, all other entries, and the Skill root itself remain unchanged.

Multiple custom roots may coexist. tk stores no root list, ownership record, or installation history. Update and uninstall require the caller to supply the same root again.

### Harness boundary

Custom-root installation writes only the self-contained `tk-cli` or `tk-cli-zh` Skill. It does not:

- require or invoke a Harness executable;
- install a Plugin, Package, extension, or MCP configuration;
- add, inspect, or remove tk operation registration;
- claim that a Harness discovers or successfully loads the selected root.

The four supported Harnesses retain their official component lifecycle. Users should use `--harness` when installing or switching a user-level component for one of them. The custom form covers other Harnesses that load ordinary Skill directories and project-local Skill roots, including project-local roots used by a supported Harness.

### Bundle and lifecycle

Add two Harness-independent CLI Skill payloads to the embedded bundle, one for each language. Both come from the existing `projects/tk/skills/tk-cli/` and `projects/tk/skills/tk-cli-zh/` source trees. They contain no Harness manifest, adapter, registration, runtime copy, or source-tree dependency.

The existing `components` manifest collection remains exactly sixteen Harness selections. Add a separate top-level `cli_skills` collection keyed by `en` and `zh`. Each entry records its language, Skill identity, `runtime_compat`, payload path, and file records, with no Harness field. The component format version increases because the manifest schema changes.

The two custom payloads use the same deterministic archive, path validation, file-type restrictions, permissions, digests, runtime compatibility, and source revision as Harness components. Custom install, update, no-change, and uninstall use the existing complete-target lifecycle. Dry-run and execution share preflight and planning. Execution stages the selected payload, revalidates the two known CLI targets, commits in deterministic order, stops on cancellation or error, reports completed and uncompleted paths, and leaves no automatic rollback or continuation state. GC remains limited to tk temporary operation content.

Harness availability and registration checks do not apply to a custom root. Fixed runtime validation still applies because the installed CLI Skill requires the public user-level executable.

Text and JSON results report exactly one target field: `harness` for the existing form or the resolved absolute `skill_root` for the custom form. Custom results also report `mode: cli`, language, Skill identity, action, installed paths, and removed paths. Existing Harness results retain their current fields and meaning.

### Decision replacement

This proposal conflicts with [Distribute selectable tk Harness components](../decision/2026-09-02-distribute-selectable-tk-harness-components.md), which fixes the bundle at sixteen Harness payloads, requires a Harness for the public lifecycle, and limits planning to fixed Harness targets.

If accepted and implemented, this proposal will reverse that decision. The replacement decision must preserve the fixed external runtime, Rust-only assembly, offline embedded artifacts, deterministic lifecycle, no installation database, complete preflight, partial-commit reporting, and clean removal of known targets within each lifecycle's ownership boundary. It must add the two Harness-independent CLI Skill payloads and the explicit custom-root lifecycle.

Implementation may update the non-conflicting CLI-only mode, Skill language selection, and product architecture decisions under their `Changes` sections. Public English and Chinese CLI, installation, Harness, guide, validation, and Skill documentation must describe the same current contract.

## Alternatives considered

**Keep custom installation as a manual copy.** This requires no runtime change, but it gives users no embedded source selection, digest validation, dry-run, deterministic update, residual-language cleanup, or bounded uninstall behavior.

**Add a `generic` Harness value.** A generic target has no Harness executable, official loading API, fixed path, or real-load validation. It would misuse the Harness concept and would still need a directory argument.

**Add separate `tk skill install` and `tk skill uninstall` commands.** These commands could express the same behavior, but they would duplicate the existing selection, archive, dry-run, result, and failure contracts. The requested capability is a second target form for the current install lifecycle.

**Treat the argument as the final Skill directory.** Users would need to append or choose `tk-cli` and `tk-cli-zh` themselves. Language switching could overwrite one Skill identity with another at the same path. A Skill root preserves stable names and bounds cleanup to known children.

## Acceptance criteria

1. `tk install` and `tk uninstall` require exactly one of `--harness` and `--skill-root`.
2. The custom install form accepts only explicit CLI mode, retains the English language default, and rejects tools mode.
3. Relative and absolute Skill roots resolve to an absolute reported root, and install creates missing parents before writing the selected `tk-cli` or `tk-cli-zh` child.
4. Custom install performs no Harness availability, official API, configuration, extension, or operation-registration work.
5. Repeating an identical custom install returns `no_change`. Changing language or observed payload content returns `updated`, replaces the selected complete target, and removes the other known CLI Skill target under that root.
6. Custom uninstall removes `tk-cli` and `tk-cli-zh` under the supplied root, preserves the `tk` and `tk-zh` tools Skills, every other entry, and the root itself, and returns `no_change` when both CLI targets are absent.
7. The embedded archive and manifest retain the existing sixteen entries in `components` and add two Harness-independent entries in a separate `cli_skills` collection. The new entries have no Harness field, the component format version increases, repeated builds remain byte-for-byte deterministic, and validation rejects invalid payload metadata or paths before writes.
8. Custom dry-run and execution share the same preflight and plan. Cancellation and injected failures preserve the existing completed and uncompleted item contract, and GC removes only registered temporary content.
9. Text and JSON results contain exactly one of `harness` and `skill_root`. Custom results include the resolved root, CLI mode, language, Skill, action, installed paths, and removed paths.
10. Existing Harness install, update, switching, uninstall, and real-load validation remain unchanged for all sixteen selections.
11. Implementation replaces the conflicting distribution decision and updates affected English and Chinese public documentation and CLI Skills in the same change.

## Risks

A mistyped Skill root can replace or delete preexisting directories named `tk-cli` or `tk-cli-zh`. Dry-run and complete path reporting reduce surprises, but the lifecycle intentionally treats those exact children as tk CLI targets.

A Harness may ignore the supplied root or require a manifest or package wrapper. The command can succeed while the Harness does not load the Skill. Documentation and results must describe custom installation as file installation, not load validation.

Using a custom root to change an existing official tools-mode installation does not remove its MCP or native operation registration. The Harness may retain both the registered operations and the CLI Skill. Documentation must direct supported user-level component changes through `--harness`.
