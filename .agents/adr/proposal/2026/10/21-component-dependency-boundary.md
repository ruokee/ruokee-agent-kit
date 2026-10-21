# Component dependency boundary

Draft owner: Ruokee
Draft writer: OMP DeepSeek V4.1 Flash

English | [中文](./21-component-dependency-boundary.zh.md)

## Motivation

Narrow component self-containment to file and code references so component text may name a required tool or Skill.

The current [component self-containment decision](../../../decision/2026/08/24-component-self-containment.md) prohibits component files from linking to, depending on, or instructing Agents to load another Skill, Extension, Plugin, or Package. It also says the rule covers examples whose operation requires another repository component. A literal reading forbids a workflow from declaring that it requires tk, or a Skill from naming another Skill it can load.

The [repository spec](../../../../spec/repository.md), [Skill spec](../../../../spec/skills.md), [boundary rules](../../../../rule/boundary.md), [component dictionary](../../../../../docs/dictionary/component.md), and [dictionary summary](../../../../../docs/dictionary/README.md) repeat the same broad wording. None distinguish a repository file reference from a prerequisite stated in text.

The failure the rule targets is a reference that resolves to a file outside the component and breaks when only that component is installed. Naming a tool or Skill through its public interface creates no such file reference. Components have legitimate runtime prerequisites, and a reader needs them stated.

## Proposal

Reverse the component self-containment decision and record a boundary between file and code references, which remain prohibited across components, and prerequisites stated in text, which become allowed.

### Effective conflict

The effective clause prohibits linking to, depending on, or instructing Agents to load another component, and covers examples whose operation requires another repository component. The proposed choice permits a component to declare another tool or Skill as a prerequisite and invoke it by name or through its public interface without a file reference. A workflow that requires tk and says so satisfies the proposed choice and violates the current clause, so the two cannot both hold.

### Reference boundary

A component's file set and code remain self-contained. A repository file reference inside a component must resolve within that component's directory. This covers Markdown links, written file paths, imports, package dependencies, and runtime file reads. Repository support files outside the component remain unavailable to it.

### Declared prerequisites

Component text may name another component, tool, or Skill, declare it as a prerequisite, and instruct its use by name or through a public interface, including loading a Skill such as `skill://grill-me`. A declared prerequisite is not a file or code dependency. The component does not need to bundle the prerequisite, copy its implementation, or provide a fallback.

Self-containment continues to mean that the component's file set is complete, installs independently, has a determinate version, and can be read on its own. It does not mean that the component has no runtime prerequisites. A prerequisite must be stated explicitly rather than implied by a link into another component's files.

### Examples

Allowed:

- A workflow requires tk and invokes the `tk` command, with no path to tk files.
- A Skill names another Skill, for example `skill://grill-me` or "load grill-me", without linking its files.
- A Skill lists another Skill as related reading by name.
- A component declares an installed external tool as a prerequisite without carrying its files.
- An example invokes a public tool or Skill by name.
- A component cites public external sources, external URLs, or upstream documentation, or mentions an external library that shares a component name.

Prohibited:

- A Markdown link, written path, or code reference that resolves to a repository file outside the component directory, including `../code-quality/...`, `../../docs/...`, `skills/<name>/...`, repository-root-relative paths, and absolute paths.
- An import, require, or runtime read of another component's files or package.
- A dependency on `.agents/spec/`, `.agents/rule/`, or other repository support files outside the component.
- An example that runs only after obtaining another component's files.
- A Chinese variant link written with the source-only `variants/zh/` prefix.

Repository documentation, ADRs, manifests, installers, and integration code outside components may continue to reference components.

Implementation replaces the decision with a complete successor that preserves the file boundary, aligns the repository spec, Skill spec, boundary rules, component dictionary, and dictionary summary in both languages, and does not change the component file layout, installation, distribution, or version behavior, or move component content.

## Alternatives considered

The requirement analysis considered the current prohibition, one narrower boundary option, and one bundling option.

**Keep the broad prohibition.** A component could not declare a real prerequisite, so readers would have to infer it. Legitimate name references, such as a workflow requiring tk or a Skill naming another Skill to load, would remain boundary violations.

**Prohibit only Markdown links.** Written paths, imports, and runtime reads would be allowed. A component could still refer to a file outside itself in a form that breaks after installation, so the failure the rule targets would return.

**Bundle every prerequisite.** A component would copy another component's files or implementation so no external prerequisite exists. This duplicates content across components and lets copies drift in version and behavior.

## Acceptance criteria

1. The successor decision and the repository spec, Skill spec, boundary rules, component dictionary, and dictionary summary express one boundary in both languages: file and code coupling is prohibited, while text may name another component, tool, or Skill and declare it as a prerequisite.
2. No clause in those sources can reasonably be read as prohibiting component text from mentioning another component, tool, or Skill. In the self-containment context, dependency means file or code dependency, or the wording states that meaning precisely.
3. A Skill that requires tk and invokes `tk` by name, with no tk file path, conforms.
4. A Skill that references grill-me or `skill://grill-me` by name without linking its files conforms.
5. A component that uses `../code-quality/...`, `../../docs/...`, a repository root path, an absolute path, a cross-component import, or a path-based read of another component's files does not conform.
6. An example that invokes a public tool or Skill by name is allowed. An example that can run only after obtaining another component's files does not conform.
7. The English and Chinese sources agree semantically, no component file moves, and installation, distribution, and version behavior do not change.
8. The reversal preserves the original decision's history and reasons in an archive and follows the ADR rules.
9. Existing self-containment checks, if any, keep testing file references and do not fail on text mentions, and no new automatic check rejects a mention of another component, tool, or Skill.

## Risks

**An incompatible prerequisite.** A component may declare another tool or Skill as a prerequisite without controlling its version. A user who installs the component with a missing or incompatible prerequisite gets a failure or a weaker result than the component promises. The component's full function then depends on that prerequisite, so self-containment no longer guarantees functional independence, while its file set and code references remain self-contained.

**Loose review of file references.** Under the narrower rule, a reviewer may treat a written path as a mere mention. A path accepted that way breaks an installed component that lacks the referenced files, and the file boundary erodes one case at a time.
