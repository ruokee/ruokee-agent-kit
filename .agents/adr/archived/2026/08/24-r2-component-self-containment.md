# Component self containment

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash
Reverses: [2026-08-24 r1 component self containment](./24-r1-component-self-containment.md)
Archived: 2026-10-22
Reversed by: [Component self containment](../../../decision/2026/08/24-component-self-containment.md)

English | [中文](./24-r2-component-self-containment.zh.md)

## Motivation

Keep component files self-contained while allowing component text to declare the tools and Skills it requires.

The earlier decision prohibited component files from linking to, depending on, or instructing Agents to load another Skill, Extension, Plugin, or Package, and covered examples whose operation required another repository component. Read literally, that wording also prohibited a workflow from stating that it requires tk, or a Skill from naming another Skill it can load. The failure the rule targets is a repository file reference that resolves outside the component and breaks when only that component is installed. Naming a tool or Skill through its public interface creates no such file reference. Components have legitimate runtime prerequisites, and a reader needs them stated.

Repository support files and cross-component links have the same failure mode. A component that links to files owned by another component or to repository-level material may work in the source tree but fail after installation, and it creates an undeclared requirement for compatible revisions. Language variants have the same boundary because a variant installs as one component.

## Decision

Treat every Skill, Extension, Plugin, and Package as a self-contained distributable component. For current Skills, the component roots are `skills/<name>/` and each `variants/<language>/skills/<name>/` tree. Future component categories follow the same rule under their own roots.

A repository file reference inside a component must resolve within that component's directory. This covers Markdown links, written file paths, imports, package dependencies, and runtime file reads. A component must not link to, import, or read another repository component's files or package, and must not depend on repository support files outside its directory, including `.agents/spec/`, `.agents/rule/`, and other repository-level material. References such as `../code-quality/...`, `../../docs/...`, `skills/<name>/...`, repository-root-relative paths, and absolute paths do not resolve inside the component and violate this boundary.

Component text may name another component, tool, or Skill, declare it as a prerequisite, and instruct its use by name or through a public interface, including loading a Skill such as `skill://grill-me`. A declared prerequisite is not a file or code dependency. The component does not need to bundle the prerequisite, copy its implementation, or provide a fallback. A prerequisite must be stated explicitly rather than implied by a link into another component's files.

Self-containment means the component's file set is complete, installs independently, has a determinate version, and can be read on its own. It does not mean the component has no runtime prerequisites; its full function may depend on a declared prerequisite.

An example that needs files from another repository component violates the boundary. An example that invokes a public tool or Skill by name without reading another component's files is allowed. Public external sources, external URLs, upstream documentation, general concepts, and external libraries that share a component name remain allowed, provided the component does not need another repository component's files.

Repository-wide documentation, ADRs, manifests, installers, and integration code outside component directories may reference components when describing or assembling them. The restriction applies to references originating inside a distributable component.

## Alternatives considered

None

## Consequences

Each component's file set remains installable, versionable, and readable without another repository component or the source repository layout. A component may state the tools or Skills it requires, so readers see the declared prerequisite. Its full function may depend on that prerequisite, and the repository cannot guarantee a compatible version; a missing or incompatible prerequisite can cause a failure or a weaker result. Components still may not link another component's implementation.

Related components may repeat a small amount of guidance. Keep that material specific to each component instead of mirroring whole documents. When content moves between components, move the necessary explanation and remove the old cross-boundary reference in the same change. Reviews must treat a component file reference that resolves outside its own directory as a boundary violation.

Repository-level documentation remains the place for comparisons, composition guidance, and relationships between components.

## Changes

### 2026-09-28 Component maintenance statements

A component's maintenance declaration and the evidence for its host adaptation follow [Adapt first party host components to host upgrades](../../../archived/2026/09/28-r1-host-maintenance.md) and live inside the component, so a component does not depend on a repository ADR, another component, or a repository-level table for either of them. This adds the declaration and its evidence to the material a component carries; it changes no boundary above.
