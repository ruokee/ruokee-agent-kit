# Project Agent guidelines

Ruokee Agent Kit provides Agent Skills and extensions.

## Project structure

- `./projects/`: Extensions, executables, and host packages, with source, documentation, and checks organized for their host or build system.
- `./skills/`: Ordinary English Skills, each with `SKILL.md` and any supporting references and workflows.
- `./variants/`: Language variants of components, with the same purpose and separate distributable directories.
- `./docs/`: Repository-wide user documentation, such as installation and maintenance instructions.
- `./scripts/`: Repository-wide installation, maintenance, and check scripts; component-specific scripts stay with their component.
- `./.agents/`: Decisions, specifications, and rules for repository development.
    - `adr/`: Durable choices and their reasons, including proposals and decisions.
    - `spec/`: Goals, boundaries, and acceptance criteria for components or repository areas.
    - `rule/`: Working rules organized by activity, governing actions, order, and permissions.

## Rules

### Boundary

[Boundary rules](./.agents/rule/boundary.md)

- Keep only components authored by the maintainer in this repository. Do not add third-party capabilities, forks, or upstream mirrors.
- Keep every distributable component self-contained. Its files may reference only files inside that component and must not link to, depend on, or instruct use of other repository content.
- Avoid tracking local directories, sensitive information, credentials, private hostnames, internal service URLs, or the device's model, provider, or channel configuration.
- Commit a component's `X.Y.Z` version update together with the functional change it ships. Increment `Z` by default; the maintainer decides changes to `X` or `Y`.

### Document

[Documentation rules](./.agents/rule/documentation.md)

- Provide English and Chinese project documentation as same-directory `name.md` and `name.zh.md` pairs. Keep translations and reciprocal links aligned.
- Keep documentation in sync with the code it describes. Update affected documents in the same change.
- Write a file name and each heading as a short imperative sentence, a short phrase, or a noun unless an additional requirement calls for another form. Keep one subject, and add a second one or list its parts only when an additional requirement calls for it.
- Specs define each component's goals and live in `./.agents/spec`. Read the [spec rules](./.agents/spec/README.md) when editing specs.
- ADRs record choices, including proposals and decisions, and live in `./.agents/adr`. Read the [ADR rules](./.agents/adr/README.md) when editing ADRs.
- Rules define repository working rules and live in `./.agents/rule`. Read the [rule layer's rules](./.agents/rule/README.md) when editing rules.

### Git

[Git rules](./.agents/rule/git.md)

- Use trunk-based development.
- Create a short-lived branch from current `main` for each change. Never edit or commit directly on `main`.
- Write commit messages in English and follow Conventional Commits. Use types from the standard set.
- Let `git commit` run the quality hooks. If a hook modifies task files, review and restage them before retrying the commit.
- Use `git commit --amend` only to edit a commit message. Never use amend to add, remove, or replace committed file changes.
- Squash-merge task branches into `main`. Do not use a plain merge, fast-forward merge, rebase-and-fast-forward, or direct ref movement.
- Before requesting code review, commit task changes and leave the related working tree clean. Ensure tests and quality checks pass.

## Development

[Development rules](./.agents/rule/development.md)

### Planning

- Search the relevant ADR proposals and decisions, specs, and rules before planning changes to a component's or repository area's goals, boundaries, or acceptance criteria.
- Limit changes to the requested capability or fix. Do not prebuild for hypothetical requirements.

### Validation

- Install Git hooks with `pnpm hooks:install`. This configures pre-commit formatting and commit-msg validation.
- Prepare root tools and only the selected component environments as described in [README.md](./README.md#check-prerequisites).
- Run `pnpm check:changed` from the repository root during development and before requesting review. It selects checks for changed components. Use targeted `pnpm check:*` commands only when needed.
- Let missing prerequisites fail the check. Do not skip tests or rewrite hooks to hide the problem.
- Keep component-specific checks beside their component.
- Automated success does not establish real runtime behavior or interactive UI correctness. As far as possible, consult applicable specs, ADRs, and rules when validating or evaluating work.
