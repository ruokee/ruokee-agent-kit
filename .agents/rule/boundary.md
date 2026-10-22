# Repository boundary

English | [中文](./boundary.zh.md)

The [repository spec](../spec/repository.md) states what this repository should contain, what it should not, and the form in which its components ship. These rules bind the actions that keep it that way.

## First party scope

- Keep only capabilities Ruokee authors and maintains in this repository.
- Do not add third-party capabilities, forks, or upstream mirrors. A first-party capability may cite, quote, or adapt third-party material.
- Decide fork status from whether the third-party capability itself is the subject of development and maintenance, not from the presence or amount of reused content alone.
- Preserve source authorship, and comply with the licenses and attribution requirements that apply to reused material.
- Keep license and notice files out of a Skill tree, where they can read as part of the capability. Record source attribution and license information at the repository level instead: in the repository README, in the README of a component that ships one, or in the decision that owns the material.
- Allow first-party manifests, adapters, installers, and validation tools in this repository when they support a capability it contains.

## Content layout

- Keep each capability in its host-native or build-native format. Do not force Plugins, extensions, executables, or host packages into `./skills/`.
- Store ordinary English Skills under `./skills/<name>/` and their Chinese variants under `./variants/zh/skills/<name>/`.
- Keep Skills included in independently maintained project components under their owning `projects/<component>/skills/` directories, as the [Skill layout decision](../adr/decision/2026/08/20-skill-variants.md#changes) specifies.
- Keep a pure Skill tree to host-discoverable Skill material such as `SKILL.md`, workflows, references, examples, and glossaries. Do not copy Plugin manifests, marketplace metadata, package changelogs, or host-specific Agent definitions into it.
- Keep every distributable component, including each language variant, self-contained. Its files may reference only files inside that component. A component may name another component, tool, or Skill and declare it as a prerequisite. The component must not link to, import, or read another component's files or package, or depend on repository support files.
- State a prerequisite explicitly instead of implying it through a link into another component's files.
- Write links inside a variant for the installed `skills/<name>/` path, without the source-only `variants/zh/` prefix.
- Add a top-level area only when a real component needs it, and do not prebuild empty capability categories.

## Public content

- Keep developer-local directories, machine inventories, deployment and recovery configuration, sensitive information, credentials, private hostnames, and internal service URLs out of tracked files, including Agent notes.
- Keep the device's model, provider, and channel configuration out of tracked files, including documentation and test fixtures. Describe models generically.
- Keep local links and information about ignored files and paths out of repository files, including commit messages.

## Component versions

- Commit a component's `X.Y.Z` version update together with the functional change it ships.
- Treat a task branch's combined changes as one change for versioning at its final squash merge. Do not increment the version for each commit or revision.
- Start new components at `0.1.0` by default. Keep the chosen version throughout revisions to an unpublished first addition.
- Increment `Z` by default, and let the maintainer decide any change to `X` or `Y`. An agent does not choose the level from the size of its change.
- Keep the version statement consistent between the component's manifest and the places the component documents its version.
