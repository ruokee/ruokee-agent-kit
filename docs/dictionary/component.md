# Component

English | [中文](./component.zh.md) | [Dictionary](./README.md)

Chinese term: 组件

A first-party capability in this repository, kept in its host-native or build-native format with its own documentation, checks, and version.

## Mechanism

Each component is a distributable unit carrying the files its host or build system expects and its own checks. Internal source organization does not define the component boundary.

Components are self-contained, so each installs and ships without the rest of the repository.

## Example

`architect` is a Skill component. `tk` is an executable and host package. Both have their own directory, documentation, and version.

## Avoid

Avoid "module" for a repository capability. A module is a code boundary inside a component. Avoid "package" when the component is a Skill.

## Language variant

A complete translation of a component with the same file set and scope, maintained beside the English base. Each selected variant installs as a complete component under its installed identity.

## Self-contained

A property of a distributable component: its files reference only files inside that component and its code does not depend on other repository content. Component text may name another component, tool, or Skill and declare it as a runtime prerequisite; a name or declaration is not a file reference. A declared prerequisite may be absent or incompatible.
