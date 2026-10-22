# Component self containment

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol
Archived: 2026-10-21
Reversed by: [Component self containment](./24-r2-component-self-containment.md)

English | [中文](./24-r1-component-self-containment.zh.md)

## Motivation

Make every Skill, Extension, Plugin, and Package a self-contained distributable component that may not link to another component's files.

A repository-relative link from one distributable component to another may work in the source tree while failing when only the first component is installed. Skills, Extensions, Plugins, and Packages are installed and distributed as separate components, so such a link also creates an undeclared requirement for both to use compatible revisions.

The Python-specific code-quality migration exposed this problem directly. `python-engineering` linked back to files owned by `code-quality`, so the installed Skill was not self-contained. Similar links to repository support files have the same failure mode.

Language variants need the same boundary. A variant replaces or installs as one component and cannot assume that the source repository or another language tree is present.

## Decision

Treat every Skill, Extension, Plugin, and Package as a self-contained distributable component. For current Skills, the component roots are `skills/<name>/` and each `variants/<language>/skills/<name>/` tree. Future component categories follow the same rule under their own roots.

A repository file reference inside a component must resolve within that component's directory. Component files must not link to, depend on, or instruct Agents to load another Skill, Extension, Plugin, or Package. They must not depend on repository support files outside the component either.

This rule covers Markdown links, written file paths, and examples whose operation requires another repository component. It does not prohibit discussing a general concept or naming an external library that happens to share a component name. Public external sources and upstream documentation may still be cited when the component remains usable without another repository component.

Repository-wide documentation, ADRs, manifests, installers, and integration code outside component directories may reference components when describing or assembling them. The restriction applies to references originating inside a distributable component.

## Alternatives considered

None

## Consequences

Each component can be installed, versioned, and read without another repository component or the source repository layout.

Related components may repeat a small amount of guidance. Keep that material specific to each component instead of mirroring whole documents. When content moves between components, move the necessary explanation and remove the old cross-boundary reference in the same change.

Repository-level documentation remains the place for comparisons, composition guidance, and relationships between components. Reviews must treat a component link that resolves outside its own directory as a boundary violation.

## Changes

### 2026-09-28 Component maintenance statements

A component's maintenance declaration and the evidence for its host adaptation follow [Adapt first party host components to host upgrades](../09/28-r1-host-maintenance.md) and live inside the component, so a component does not depend on a repository ADR, another component, or a repository-level table for either of them. This adds the declaration and its evidence to the material a component carries; it changes no boundary above.
