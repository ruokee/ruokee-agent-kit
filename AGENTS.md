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
- Treat each Skill, Extension, Plugin, and Package, including each language variant, as a self-contained distributable component. Its files may reference only files within that component directory and must not link to, depend on, or instruct use of another repository component.
- Write links inside variants for the installed `skills/<name>/` path, without the source-only `variants/zh/` prefix.
- Add a top-level area only when a real component requires it. Do not prebuild empty capability categories.

## Development

- Keep changes limited to the requested capability. Do not prebuild structure for hypothetical Skills or hosts.

## Documentation

- Read the relevant documentation before analyzing requirements or starting development.
- Keep documentation in sync with the code it describes. Update affected documents in the same change.
- Write code, comments, configuration, and default public documentation in English.
- Pair ordinary public Markdown documentation in the same directory as `name.md` and `name.zh.md`; use `README.md` and `README.zh.md` for repository and component entry pages. Keep Skill language variants in their existing component layouts.
- Keep language links between corresponding English and Chinese documents.

## ADRs

- Use `ADR` as the repository term for an architecture decision record. This repository uses `.agents/adr` as its ADR root.
- Search existing proposals and current decisions before planning a requirement.
- Read [the ADR rules](./.agents/adr/README.md) and [glossary](./.agents/adr/glossary.md) before proposing or changing a durable architecture, contract, format, or repository-process decision.
- Do not invent alternatives or risks to fill required sections; write `None` or `无` when nothing qualifies.
- Keep each English ADR and its Chinese counterpart semantically aligned in the same change.
- Update non-conflicting content under `Changes`. For a conflicting choice, merge a proposal first and create a complete decision that reverses the old one.
- The maintainer owns proposal approval, rejection, and decision archival. Agents may draft a proposal within authorized work but must not make those lifecycle decisions without explicit approval.

## File paths

- Use Markdown links for repository file references that readers should follow, with each destination relative to the Markdown document containing it.
- Prefix destinations in the current directory or a descendant directory with `./`. Use as many `../` segments as needed to reach files outside that tree.
- Do not use a leading `/`, a repository-root-relative destination, or an absolute GitHub URL for a file in this repository.
- When the link text names a file, write it from the repository root without a leading `/`. For example, an ADR under `.agents/adr/decision/` links to the `<skill>` Skill as `[skills/<skill>/SKILL.md](../../../skills/<skill>/SKILL.md)`.

## Validation

- Install the Git hooks with `pnpm hooks:install`. It sets up the pre-commit formatting stage and the commit-msg message check.
- Install root and component dependencies as described in [README.md](./README.md#check-prerequisites) before running checks.
- Run `pnpm check` from the repository root before requesting review. It runs the Markdown check, tk Rust formatting and tests, all three OMP components' TypeScript checks and tests, and tk native adapter tests sequentially. It stops at the first failure with a nonzero exit status.
- Use `pnpm check:base` for targeted Markdown and Rust checks; it does not cover component checks. Check commands do not install dependencies or format source files.
- Keep component-specific checks beside their component and update the root aggregate when required automated checks change. Automated success does not replace required real-model or interactive UI validation.

## Git workflow

- Use trunk-based development. `main` is the only long-lived branch.
- Develop each feature, fix, or documentation change on a short-lived branch created from current `main`. Do not modify `main` directly.
- Commit each atomic task to its branch by default. Stage only files that belong to the current task.
- Write commit messages in English and follow the Conventional Commits specification. Types come from the standard set, and the optional scope is one of `skills`, `extensions`, `adr`, or `repo`; a change that spans two areas carries no scope. The commit-msg hook rejects a message that breaks these rules.
- Let `git commit` run the quality hooks. If hooks modify task files, review and restage them before retrying the commit.
- Use `git commit --amend` only to edit a commit message. Never use amend to add, remove, or replace committed file changes.
- Before requesting review, commit the task changes and leave the related working tree clean.
- A request to commit authorizes a branch commit only. Merging into `main` requires explicit user review and authorization.
- Squash-merge task branches into `main`. Do not use a plain merge, fast-forward merge, rebase-and-fast-forward, or direct ref movement.
- Do not push without explicit authorization.
