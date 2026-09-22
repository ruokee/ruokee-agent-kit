# ADR decision: Establish a first-party Agent capability kit

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol

English | [中文](./2026-08-20-establish-first-party-capability-kit.zh.md)

## Motivation

The earlier `ruokee-skills` name described only Skills, while the work already included Plugins, packages, extensions, executables, installers, host adapters, and validation support. Renaming that repository in place would also carry forward a mixed structure and content that did not belong to the new public project.

The new repository needs a stable identity, an ownership rule, and a content model that does not force every Agent capability to pretend to be a Skill.

## Decision

Name the project and repository `ruokee-agent-kit`. Keep the complete `ruokee-` owner prefix. `agent` identifies the domain, while `kit` permits several kinds of independently useful components without claiming that the repository is an Agent Harness or a complete runtime stack.

Create the project as an independent repository. Do not rename or copy `ruokee-skills` wholesale. Select content deliberately and reorganize it under this repository's own rules.

Keep only capabilities that Ruokee authors and maintains publicly, together with the first-party code, packaging, installation, documentation, and validation needed to develop and distribute them. Do not use the repository as a catalog or mirror of software installed from third parties.

Treat Skill, Plugin, extension, executable project, optional variant, and host package as independent content kinds. Each may use its native format and own top-level area when the first real component establishes that need. An extension does not have to wrap a Skill, and a Plugin does not have to fit under `skills/`.

## Alternatives considered

None

## Consequences

The repository remains `ruokee-agent-kit` and stays independent from `ruokee-skills`. Every tracked capability has Ruokee as its public maintainer or is first-party support for such a capability. Third-party mirrors, forks, and installed-software inventories do not enter the repository.

Skills, Plugins, extensions, executables, variants, and host packages may use formats that match their actual behavior. New top-level structure appears only with a real component, so the repository does not prebuild empty categories.

`kit` is broad and common. The README and repository rules must keep the ownership and content boundary explicit. That breadth is not permission to add unrelated tooling. First-party support belongs here only when a repository capability needs it for development, installation, distribution, documentation, or validation.

## Changes

### 2026-09-12: Capability ownership and source use

Identify the capability that is the subject of development and maintenance. A first-party capability may cite, quote, or adapt third-party material. Fork status depends on whether the third-party capability itself is that subject, not on the presence or amount of reused content alone. Third-party capabilities, forks, and upstream mirrors remain outside the repository.

Reused material retains its source authorship and must satisfy the applicable license and attribution requirements. These obligations are separate from capability ownership. The principle applies to both [architect](./2026-09-18-make-architect-model-invoked.md#sources-and-adaptation) and [well-said](./2026-09-12-add-well-said-skill.md). architect's choice to rewrite source material is specific to that capability; rewriting is not a general prerequisite for first-party status.
