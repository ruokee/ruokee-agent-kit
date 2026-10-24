# Skill language variants

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol
Reverses: [Skill language variants](../../../archived/2026/08/20-r2-skill-variants.md)

English | [中文](./20-skill-variants.zh.md)

## Motivation

Distribute complete, self-contained Skill language variants whose internal source layout belongs to their component.

The predecessor required project-owned Skills to occupy a fixed subdirectory. That couples ordinary source reorganization to repository-wide decisions without protecting an installed interface. Component ownership and host discovery provide the boundary; an internal directory name does not.

Source paths select language material, while installed Skills use the identity and path expected by their host. Source-only prefixes in installed links break that separation. Cross-component file references also fail when only one component is installed.

## Decision

Ordinary public English Skills use `skills/<name>/`, and their same-name Chinese variants use `variants/zh/skills/<name>/`. These roots are the repository installation interface. Keep corresponding file sets, subject matter, observable instructions, and versions aligned in the same change.

A project owns the sources and language resources of the Skills it distributes. It chooses its internal source layout, keeping those sources within its component. It may give language Skills separate, independently discoverable identities. Each language remains complete and self-contained, with equivalent instructions and versions maintained together. Component documentation owns its source layout and installation details; an internal move does not change an installed identity.

A pure Skill contains only material needed to discover, understand, and use it, including its `SKILL.md` entry and any required local guidance. It does not contain Plugin manifests, marketplace metadata, `meta.toml`, host-specific Agent definitions, package changelogs, or package-level README files. The component owns the organization of its supporting material.

Install the selected language at its normal host Skill path, without source-only layout prefixes. Write file references relative to the containing document and keep their targets inside that distributed component. Written paths, imports, package dependencies, and runtime reads do not permit access to another component or repository support files. An installed path does not grant cross-component access.

Each Skill explains its own domain, terms, and operating rules without loading another Skill to supply that explanation. It may name another component, tool, or Skill without declaring a dependency merely for the mention. State actual prerequisites explicitly and use them by name or public interface, including Skill loading interfaces. Prerequisites do not permit cross-component file references.

Imports preserve body meaning and distinguish path adaptation from editorial changes. Neither language may silently omit an observable capability or required instruction; language-specific explanations may differ where translation requires it.

## Alternatives considered

Require one project-internal source subdirectory. It makes source locations predictable, but a harmless internal move then changes repository policy. Installed identity, component ownership, and complete language distributions provide the required consistency without that coupling.

## Consequences

A source layout can change without changing public rules, provided installed identities, complete language distributions, and component-local references remain valid. Validation must exercise references after variant selection, not only against the source tree.

Source and installed paths intentionally differ. Consumers that rely on an undocumented internal source path must follow the component's maintained build or installation interface instead.
