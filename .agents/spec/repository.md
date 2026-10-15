# Repository

English | [中文](./repository.zh.md)

Spec for repository-wide conventions.

The [repository README](../../README.md) introduces the repository and explains how contributors work in it.

The [rule layer](../rule/README.md) states how work is done here.

## Goals

- Hold only capabilities Ruokee authors and maintains, with the first-party code, packaging, installation, documentation, and validation needed to develop and distribute them.
- Keep each capability in its host-native or build-native format.
- Keep every distributable component self-contained.
- Record durable decisions as bilingual ADRs, and state the current target of each component and repository area as a bilingual spec.
- State the repository's working rules as bilingual pages under `.agents/rule/`, so each normative statement has one owning layer.
- Develop on short-lived branches squash-merged into `main`, with affected checks during development and a complete check on the final candidate.

## Non-goals

- Third-party capabilities, forks, or upstream mirrors.
- Developer-local directories, machine inventories, deployment and recovery configuration, sensitive information, credentials, private hostnames, internal service URLs, or the device's model, provider, or channel configuration.
- Empty capability categories or structure prebuilt for hypothetical Skills, hosts, or requirements.
- Checks that install dependencies, format source files, or use global tools to hide missing local setup.
- Rules that apply only in a developer's local environment, or that contain sensitive information, specific models, providers, endpoints, or absolute paths.

## Public surface

- Repository layout: [Repository layout](../../README.md#repository-layout).
- Working rules by activity: [.agents/rule/README.md](../rule/README.md), which indexes the boundary, development, Git, and documentation rules.
- Git workflow, commit rules, and hooks: [Git](../../README.md#git), [Git rules](../rule/git.md), and [validation rules](../rule/development.md#validation).
- Check prerequisites, affected checks, and the complete merge gate: [Check prerequisites](../../README.md#check-prerequisites), [Affected checks](../../README.md#affected-checks), and [Complete merge validation](../../README.md#complete-merge-validation).
- Common commands: [Common commands](../../README.md#common-commands).
- ADR rules and glossary: [.agents/adr/README.md](../adr/README.md) and [.agents/adr/glossary.md](../adr/glossary.md).
- Spec rules: [.agents/spec/README.md](./README.md).

## Invariants

- A file inside a distributable component references only files inside that component. Components do not link to, depend on, or instruct use of another repository component, repository support files, `.agents/spec/`, or `.agents/rule/`.
- English Skills live under `skills/<name>/` and Chinese variants under `variants/zh/skills/<name>/`. The tk Skills keep their paths under `projects/tk/skills/`.
- Code, comments, configuration, and default public documentation are in English. Ordinary public documentation is paired as same-directory `name.md` and `name.zh.md`, entry pages as `README.md` and `README.zh.md`, with reciprocal language links. Both languages change together.
- Repository file links are relative to the containing document. They use `./` for the current directory or a descendant and `../` to leave it, never a leading `/`, a repository-root-relative destination, or an absolute GitHub URL.
- Prettier formats all tracked Markdown.
- Commit messages are English Conventional Commits. The optional scope is one of `skills`, `extensions`, `adr`, or `repo`, and a change spanning two areas carries no scope. The commit-msg hook enforces this.
- `main` is the only long-lived branch. Each change is developed on a short-lived branch and squash-merged into `main` after explicit authorization.
- `pnpm check:changed` selects the affected checks for a change. Unknown, shared, or unreliably classified inputs fall back to one complete check.
- The complete aggregate, the selector mapping, and the selector regression tests cover the same components and document consumers.
- ADRs open with Motivation and keep to the content boundaries in the [ADR rules](../adr/README.md), and writing or changing one follows the [documentation rules](../rule/documentation.md). A spec never conflicts with a current decision.
- A component's `X.Y.Z` version changes with the behavior it ships, and the [boundary rules](../rule/boundary.md) own the increment and its authority.
- Components keep no unreachable code, duplicate implementation, or design held for a hypothetical requirement. Simplification keeps each component's goals, public commands, tools, settings, file formats, and behavior.

## Acceptance criteria

- `pnpm docs:lint` reports no Prettier changes for tracked Markdown.
- The commit-msg hook rejects a message with an unknown type or an out-of-set scope.
- `pnpm check:selector` passes.
- `.agents/rule/` holds the layer README pair and one page pair per activity, and a Markdown-only change under it selects documentation checks instead of the complete check.
- Complete `pnpm check` passes on the clean, committed final candidate that contains the target `main`.
- Every public Markdown page outside Skills has its same-directory language pair with reciprocal links: ordinary pages as `name.md` and `name.zh.md`, entry pages as `README.md` and `README.zh.md`. Skills are checked against their existing layouts instead: English Skills under `skills/<name>/` with Chinese variants under `variants/zh/skills/<name>/`, and independently named tk Skills at their paths under `projects/tk/skills/`. This criterion does not move Skill files or add cross-language links between Skills.
- No reference inside a component resolves outside that component's directory.

## Related ADRs

- [Establish a first party Agent capability kit](../adr/decision/2026-08-20-establish-first-party-capability-kit.md)
- [Squash short lived branches into main](../adr/decision/2026-08-20-use-trunk-based-squash-workflow.md)
- [Use Motivation as the opening section](../adr/decision/2026-08-22-use-motivation-heading-in-adrs.md)
- [Keep distributable components self contained](../adr/decision/2026-08-24-keep-components-self-contained.md)
- [Use document relative links for file paths](../adr/decision/2026-08-24-use-document-relative-file-links.md)
- [Format Markdown with Prettier](../adr/decision/2026-09-02-format-markdown-with-prettier.md)
- [Review authorization](../adr/decision/2026-09-06-review-authorization.md)
- [Colocate bilingual public documentation](../adr/decision/2026-09-07-colocate-bilingual-docs.md)
- [Enforce commit message conventions](../adr/decision/2026-09-17-enforce-commit-message-conventions.md)
- [Scope development checks](../adr/decision/2026-09-30-scope-aware-repository-checks.md)
- [Add a specification layer](../adr/decision/2026-10-04-add-spec-layer.md)
- [Add a rule layer](../adr/decision/2026-10-12-add-rule-layer.md)
- [Clarify the ADR content boundaries](../adr/decision/2026-10-15-clarify-adr-content-boundaries.md)
