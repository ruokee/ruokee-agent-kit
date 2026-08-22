# Project Agent guidelines

Ruokee Agent Kit is Ruokee's public repository for original Agent capabilities and their first-party development, validation, packaging, and distribution support.

Keep this file focused on repository knowledge that cannot be inferred from the files and tool configuration.

## Repository boundary

- Keep only capabilities authored and maintained by Ruokee in this repository.
- Do not add third-party capabilities, forks, upstream mirrors, or vendored third-party content.
- Do not add machine inventories, profiles, host selections, Fleet configuration, credentials, private hostnames, or internal service URLs.
- First-party manifests, adapters, installers, and validation tools may live here when they support a repository capability.

## Content layout

- Keep each capability in its host-native or build-native format. Do not force Plugins, extensions, executables, or host packages into `./skills/`.
- Store English Skills under `./skills/<name>/` and Chinese variants under `./variants/zh/skills/<name>/`.
- Keep pure Skill trees limited to host-discoverable Skill material such as `SKILL.md`, workflows, references, examples, and glossaries. Do not copy Plugin manifests, marketplace metadata, package changelogs, or host-specific Agent definitions into them.
- Write links inside variants for the installed `skills/<name>/` path, without the source-only `variants/zh/` prefix.
- Add a top-level area only when a real component requires it. Do not prebuild empty capability categories.

## Development

- Keep changes limited to the requested capability. Do not prebuild structure for hypothetical Skills or hosts.

## Documentation

- Read the relevant documentation before analyzing requirements or starting development.
- Keep documentation in sync with the code it describes. Update affected documents in the same change.
- Write code, comments, documentation, and configuration in English.
- Maintain user-facing Chinese documentation under `docs/zh/` alongside the English documentation when behavior or usage changes.
- Keep language links between corresponding English and Chinese documents.

## Agent Notes

- Use `Agent Note` as the repository term for an architecture decision record.
- Read [the Agent Note rules](./.agents/notes/README.md) before proposing or changing a durable architecture, contract, format, or repository-process decision.
- Keep each English Agent Note and its Chinese counterpart semantically aligned in the same change.
- The maintainer owns lifecycle decisions. Agents may draft a `proposed` note within an authorized change, but must not accept, reject, or archive it without explicit approval.

## File paths

- Prefix paths to files in the current directory or a descendant directory with `./`.
- Use one `../` when a path only needs to return to the parent directory.
- When a target requires returning two or more directory levels, write the path from the repository root without a leading `/`.
- For example, a document under `docs/zh/` must refer to the `<skill>` Skill as `skills/<skill>/SKILL.md`, not `../../skills/<skill>/SKILL.md`.

## Validation

- Install the Git hooks with `uvx pre-commit install --install-hooks`.
- Run `uvx pre-commit run --all-files` before requesting review.
- Add component-specific checks beside a Skill or tool when its implementation requires more than the repository baseline.

## Git workflow

- Use trunk-based development. `main` is the only long-lived branch.
- Develop each feature, fix, or documentation change on a short-lived branch created from current `main`. Do not modify `main` directly.
- Commit each atomic task to its branch by default. Stage only files that belong to the current task.
- Write commit messages in English and follow the Conventional Commits specification.
- Let `git commit` run the quality hooks. If hooks modify task files, review and restage them before retrying the commit.
- Use `git commit --amend` only to edit a commit message. Never use amend to add, remove, or replace committed file changes.
- Before requesting review, commit the task changes and leave the related working tree clean.
- A request to commit authorizes a branch commit only. Merging into `main` requires explicit user review and authorization.
- Squash-merge task branches into `main`. Do not use a plain merge, fast-forward merge, rebase-and-fast-forward, or direct ref movement.
- Do not push without explicit authorization.
