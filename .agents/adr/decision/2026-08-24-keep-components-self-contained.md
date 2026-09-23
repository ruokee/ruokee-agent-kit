# ADR decision: Keep distributable components self-contained

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol

English | [中文](./2026-08-24-keep-components-self-contained.zh.md)

## Motivation

A repository-relative link from one distributable component to another may work in the source tree while failing when only the first component is installed. Skills, Extensions, Plugins, and Packages are installed and distributed as separate components, so such a link also creates an undeclared requirement for both to use compatible revisions.

The Python-specific code-quality migration exposed this problem directly. `python-engineering` linked back to files owned by `code-quality`, so the installed Skill was not self-contained. Similar links to repository support files have the same failure mode.

Language variants need the same boundary. A variant replaces or installs as one component and cannot assume that the source repository or another language tree is present.

## Decision

Treat every Skill, Extension, Plugin, and Package as a self-contained distributable component. For current Skills, the component roots are `skills/<name>/` and each `variants/<language>/skills/<name>/` tree. Future component categories follow the same rule under their own roots.

A repository file reference inside a component must resolve within that component's directory. Component files must not link to, depend on, or instruct Agents to load another Skill, Extension, Plugin, or Package. They must not depend on repository support files outside the component either.

This rule covers Markdown links, written file paths, and examples whose operation requires another repository component. It does not prohibit discussing a general concept or naming an external library that happens to share a component name. Public external sources and upstream documentation may still be cited when the component remains usable without another repository component.

Repository-wide documentation, ADRs, manifests, installers, and integration code outside component directories may reference components when describing or assembling them. The restriction applies to references originating inside a distributable component.

Record the rule in [`AGENTS.md`](../../../AGENTS.md) and remove existing cross-boundary references from every current language tree.

## Alternatives considered

None

## Consequences

Each component can be installed, versioned, and read without another repository component or the source repository layout.

Related components may repeat a small amount of guidance. Keep that material specific to each component instead of mirroring whole documents. When content moves between components, move the necessary explanation and remove the old cross-boundary reference in the same change.

Repository-level documentation remains the place for comparisons, composition guidance, and relationships between components. Reviews must treat a component link that resolves outside its own directory as a boundary violation.
