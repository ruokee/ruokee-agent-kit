# Component self containment

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash
Reverses: [Component self containment](../../../archived/2026/08/24-r2-component-self-containment.md)

English | [中文](./24-component-self-containment.zh.md)

## Motivation

Keep publicly distributed component files self-contained while allowing declared runtime prerequisites and project-internal maintenance Skills.

A repository file reference that resolves outside an installed component can break when only that component is installed. Naming a tool or Skill through its public interface creates no such file reference. Components have legitimate runtime prerequisites, and readers need them stated. Language variants have the same boundary because each variant installs as one component.

The [predecessor](../../../archived/2026/08/24-r2-component-self-containment.md) classified every Skill as a distributable component. Internal Skills under `.agents/skills/` maintain this repository and must read its documents. Classify those Skills by their project-internal use, without weakening any public component's file boundary.

## Decision

Every publicly distributed Skill, Extension, Plugin, and Package is a self-contained component. Public Skill roots are `skills/<name>/` and each `variants/<language>/skills/<name>/` tree. Future distributed component categories follow the same rule under their own roots. Each language variant is independently self-contained.

Internal project maintenance Skills under `.agents/skills/` are repository material, not distributed components or an installation source. They may reference the project documents they maintain. This classification does not exempt public components from self-containment or authorize public distribution of internal Skills.

A repository file reference inside a distributed component must resolve within that component's directory. This covers Markdown links, written file paths, imports, package dependencies, and runtime file reads. A component must not link to, import, or read another repository component's files or package, and must not depend on repository support files outside its directory, including `.agents/spec/`, `.agents/rule/`, `.agents/skills/`, and other repository-level material. References such as `../code-quality/...`, `../../docs/...`, `skills/<name>/...`, repository-root-relative paths, and absolute paths do not resolve inside the component and violate this boundary.

Component text may name another component, tool, or Skill, declare it as a prerequisite, and instruct its use by name or through a public interface, including loading a Skill such as `skill://grill-me`. A declared prerequisite is not a file or code dependency. The component does not need to bundle the prerequisite, copy its implementation, or provide a fallback. A prerequisite must be stated explicitly rather than implied by a link into another component's files.

Self-containment means the component's file set is complete, installs independently, has a determinate version, and can be read on its own. It does not mean the component has no runtime prerequisites; its full function may depend on a declared prerequisite.

An example that needs files from another repository component violates the boundary. An example that invokes a public tool or Skill by name without reading another component's files is allowed. Public external sources, external URLs, upstream documentation, general concepts, and external libraries that share a component name remain allowed, provided the component does not need another repository component's files.

Repository-wide documentation, ADRs, manifests, installers, and integration code outside component directories may reference components when describing or assembling them. The restriction applies to references originating inside a distributable component.

## Alternatives considered

None

## Consequences

Each distributed component remains installable, versionable, and readable without another repository component or the source layout. It can declare the tools or Skills it requires. A missing or incompatible prerequisite can cause failure or a weaker result; the repository cannot guarantee its compatible version. Components still may not link another component's implementation.

Related components may repeat a small amount of guidance. Keep it specific to each component instead of mirroring whole documents. When content moves between components, move the necessary explanation and remove the old cross-boundary reference in the same change. Reviews treat a component file reference that resolves outside its own directory as a boundary violation.

Repository-level documentation owns comparisons, composition guidance, and component relationships. Internal maintenance Skills can read this material without creating a public installation dependency.

## Changes

### 2026-09-28 Component maintenance statements

A component's maintenance declaration and the evidence for its host adaptation follow [Adapt first party host components to host upgrades](../../../archived/2026/09/28-r1-host-maintenance.md) and live inside the component, so a component does not depend on a repository ADR, another component, or a repository-level table for either of them. This adds the declaration and its evidence to the material a component carries; it changes no boundary above.
