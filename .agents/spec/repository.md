# Repository

English | [中文](./repository.zh.md)

Spec for repository-wide conventions. The [repository instructions](../../AGENTS.md) and the [repository README](../../README.md) tell contributors how to apply them.

## Goals

- Hold only capabilities Ruokee authors and maintains, with the first-party code, packaging, installation, documentation, and validation needed to develop and distribute them.
- Keep each capability in its host-native or build-native format.
- Keep every distributable component self-contained.
- Record durable decisions as bilingual ADRs, and state the current target of each component and repository area as a bilingual spec.
- Develop on short-lived branches squash-merged into `main`, with affected checks during development and a complete check on the final candidate.

## Non-goals

- Third-party capabilities, forks, or upstream mirrors.
- Machine inventories, profiles, host selections, Fleet configuration, credentials, private hostnames, internal service URLs, or local model, provider, or channel names.
- Empty capability categories or structure prebuilt for hypothetical Skills, hosts, or requirements.
- Checks that install dependencies, format source files, or use global tools to hide missing local setup.

## Public surface

- Repository layout: [Repository layout](../../README.md#repository-layout).
- Git workflow, commit rules, and hooks: [Git](../../README.md#git) and [Git workflow](../../AGENTS.md#git-workflow).
- Check prerequisites, affected checks, and the complete merge gate: [Check prerequisites](../../README.md#check-prerequisites), [Affected checks](../../README.md#affected-checks), and [Complete merge validation](../../README.md#complete-merge-validation).
- Common commands: [Common commands](../../README.md#common-commands).
- ADR rules and glossary: [.agents/adr/README.md](../adr/README.md) and [.agents/adr/glossary.md](../adr/glossary.md).
- Spec rules: [.agents/spec/README.md](./README.md).

## Invariants

- A file inside a distributable component references only files inside that component. Components do not link to, depend on, or instruct use of another repository component, repository support files, or `.agents/spec/`.
- English Skills live under `skills/<name>/` and Chinese variants under `variants/zh/skills/<name>/`. The tk Skills keep their paths under `projects/tk/skills/`.
- Code, comments, configuration, and default public documentation are in English. Ordinary public documentation is paired as same-directory `name.md` and `name.zh.md`, entry pages as `README.md` and `README.zh.md`, with reciprocal language links. Both languages change together.
- Repository file links are relative to the containing document. They use `./` for the current directory or a descendant and `../` to leave it, never a leading `/`, a repository-root-relative destination, or an absolute GitHub URL.
- Prettier formats all tracked Markdown.
- Commit messages are English Conventional Commits. The optional scope is one of `skills`, `extensions`, `adr`, or `repo`, and a change spanning two areas carries no scope. The commit-msg hook enforces this.
- `main` is the only long-lived branch. Each change is developed on a short-lived branch and squash-merged into `main` after explicit authorization. Commit, merge, push, and branch deletion are separate authorization boundaries.
- `pnpm check:changed` runs the affected checks during development. Unknown, shared, or unreliably classified inputs fall back to one complete check.
- Complete `pnpm check` passes on the clean, committed final candidate that contains the target `main` before merge, and the candidate commit and tree, target commit, and result are recorded.
- Adding a component or document consumer, or changing required automated checks, updates the complete aggregate, the selector mapping, and the selector regression tests together.
- A review request does not authorize edits to the reviewed files.
- ADRs open with Motivation and keep to the content boundaries in the ADR rules. A spec never conflicts with a current decision.
- A change to a component's behavior updates its `X.Y.Z` version: `Z` for small compatible changes, `Y` for larger behavior or capability changes, and `X` for a rewrite.
- Components keep no unreachable code, duplicate implementation, or design held for a hypothetical requirement. Simplification keeps each component's goals, public commands, tools, settings, file formats, and behavior.

## Acceptance criteria

- `pnpm docs:lint` reports no Prettier changes for tracked Markdown.
- The commit-msg hook rejects a message with an unknown type or an out-of-set scope.
- `pnpm check:selector` passes.
- Complete `pnpm check` passes on the final candidate.
- Every public Markdown page outside Skills has its same-directory language pair with reciprocal links: ordinary pages as `name.md` and `name.zh.md`, entry pages as `README.md` and `README.zh.md`. Skills are checked against their existing layouts instead: English Skills under `skills/<name>/` with Chinese variants under `variants/zh/skills/<name>/`, and independently named tk Skills at their paths under `projects/tk/skills/`. This criterion does not move Skill files or add cross-language links between Skills.
- No reference inside a component resolves outside that component's directory.

## Related ADRs

- [Establish a first-party Agent capability kit](../adr/decision/2026-08-20-establish-first-party-capability-kit.md)
- [Use short-lived branches and squash into main](../adr/decision/2026-08-20-use-trunk-based-squash-workflow.md)
- [Use Motivation as the opening section](../adr/decision/2026-08-22-use-motivation-heading-in-adrs.md)
- [Keep distributable components self-contained](../adr/decision/2026-08-24-keep-components-self-contained.md)
- [Use document-relative links for file paths](../adr/decision/2026-08-24-use-document-relative-file-links.md)
- [Format Markdown with Prettier](../adr/decision/2026-09-02-format-markdown-with-prettier.md)
- [Review authorization](../adr/decision/2026-09-06-review-authorization.md)
- [Colocate English and Chinese public documentation](../adr/decision/2026-09-07-colocate-bilingual-docs.md)
- [Enforce commit message conventions](../adr/decision/2026-09-17-enforce-commit-message-conventions.md)
- [Clarify the ADR mechanism and content boundaries](../adr/decision/2026-09-23-clarify-adr-content-boundaries.md)
- [Scope development checks and retain a complete merge gate](../adr/decision/2026-09-30-scope-aware-repository-checks.md)
- [Add a specification layer](../adr/decision/2026-10-04-add-spec-layer.md)
