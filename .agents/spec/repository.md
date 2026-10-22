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
- Keep each decision's current reference stable through reversals, retain separately accessible historical versions, and group ADRs by lifecycle and first proposal year and month.
- State the repository's working rules as bilingual pages under `.agents/rule/`, so each normative statement has one owning layer.
- Develop on short-lived branches squash-merged into `main`, with affected checks during development and a complete check on the final candidate.

## Out of scope

- Third-party capabilities, forks, or upstream mirrors.
- Developer-local directories, machine inventories, deployment and recovery configuration, sensitive information, credentials, private hostnames, internal service URLs, or the device's model, provider, or channel configuration.
- Empty capability categories or structure prebuilt for hypothetical Skills, hosts, or requirements.
- Checks that install dependencies, format source files, or use global tools to hide missing local setup.
- Rules that apply only in a developer's local environment, or that contain sensitive information, specific models, providers, endpoints, or absolute paths.

## Public surface

- Repository layout: [Repository layout](../../README.md#repository-layout).
- Working rules by activity: [.agents/rule/README.md](../rule/README.md), which indexes the boundary, development, Git, documentation, and terminology rules.
- Shared vocabulary: [docs/dictionary/README.md](../../docs/dictionary/README.md) and the [terminology rules](../rule/terminology.md).
- Git workflow, commit rules, and hooks: [Git](../../README.md#git), [Git rules](../rule/git.md), and [validation rules](../rule/development.md#validation).
- Check prerequisites, affected checks, and the complete merge gate: [Check prerequisites](../../README.md#check-prerequisites), [Affected checks](../rule/development.md#checks), and [Complete merge validation](../../README.md#complete-merge-validation).
- Common commands: [Common commands](../../README.md#common-commands).
- ADR rules: [.agents/adr/README.md](../adr/README.md). ADR terms: [dictionary's ADR page](../../docs/dictionary/adr.md).
- Spec rules: [.agents/spec/README.md](./README.md).

## Invariants

- A file inside a distributable component references only files inside that component. Components do not link to, import, or read another repository component's files or package, and do not depend on repository support files such as `.agents/spec/` and `.agents/rule/`.
- Component text may name another component, tool, or Skill, declare it as a prerequisite, and instruct its use by name or through a public interface. A declared prerequisite is not a file reference.
- Ordinary English Skills live under `skills/<name>/` and Chinese variants under `variants/zh/skills/<name>/`. Skills included in independently maintained project components live under their owning `projects/<component>/skills/` directories.
- Code, comments, configuration, and default public documentation are in English. Ordinary public documentation is paired as same-directory `name.md` and `name.zh.md`, entry pages as `README.md` and `README.zh.md`, with reciprocal language links. Both languages change together.
- Repository file links are relative to the containing document. They use `./` for the current directory or a descendant and `../` to leave it, never a leading `/`, a repository-root-relative destination, or an absolute GitHub URL.
- Prettier formats all tracked Markdown.
- Commit messages are English Conventional Commits. The optional scope is one of `skills`, `extensions`, `adr`, or `repo`, and a change spanning two areas carries no scope. The commit-msg hook enforces this.
- `main` is the only long-lived branch. Each change is developed on a short-lived branch and squash-merged into `main` after explicit authorization.
- `pnpm check:changed` selects the affected checks for a change. Unknown, shared, or unreliably classified inputs fall back to one complete check.
- The complete aggregate, the selector mapping, and the selector regression tests cover the same components and document consumers.
- Every retained ADR follows the [ADR rules](../adr/README.md) for its body layout, identity date, revision sequence, naming, language pair, and maintenance, and writing or changing one follows the [documentation rules](../rule/documentation.md). A spec never conflicts with a current decision.
- ADR alternatives have evidence that they entered the same durable choice and explain material tradeoffs. Risk statements and accepted costs have credible causes and material consequences, including when recorded under `Consequences`. The [authoring rules](../adr/README.md#authoring-rules) own the criteria; genuine contracts, reasons, historical conditions, and bilingual meaning remain intact.
- A component's `X.Y.Z` version changes with the behavior it ships, and the [boundary rules](../rule/boundary.md) own the increment and its authority.
- Components keep no unreachable code, duplicate implementation, or design held for a hypothetical requirement. Simplification keeps each component's goals, public commands, tools, settings, file formats, and behavior.

## Acceptance criteria

- `pnpm docs:lint` reports no Prettier changes for tracked Markdown.
- The commit-msg hook rejects a message with an unknown type or an out-of-set scope.
- `pnpm check:selector` passes.
- `.agents/rule/` holds the layer README pair and one page pair per activity, and a Markdown-only change under it selects documentation checks instead of the complete check.
- Complete `pnpm check` passes on the clean, committed final candidate that contains the target `main`.
- Every public Markdown page outside Skills has its same-directory language pair with reciprocal links: ordinary pages as `name.md` and `name.zh.md`, entry pages as `README.md` and `README.zh.md`. Skills follow the layouts defined above and keep their file locations and identities, without cross-language links between Skills.
- No file reference inside a component resolves outside that component's directory.
- Same-day, cross-month, and cross-year reversals leave the canonical current path unchanged, keep later versions separately accessible, and advance only that decision's continuous sequence. Extracting an independent topic and correcting names follow the [ADR rules](../adr/README.md), and a reader can follow accurate direct predecessors and successors without mistaking a later version for an earlier record's direct successor.
- Every retained ADR meets the [ADR rules](../adr/README.md) for layout, naming, language pairs, and preserved historical content.
- Reviewing every retained ADR pair finds no unsupported, misclassified, or immaterial alternatives or risk statements. Empty alternatives and risk sections use the prescribed `None` or `无`; retained entries preserve their basis and conditions, not generic warnings or review logs.
- The ADR mechanism, guide, documentation rules, specification, dictionary, and actual references express the same contract. Current and historical citations, reciprocal language links, and heading fragments resolve to the intended content.

## Related ADRs

- [First party capabilities](../adr/decision/2026/08/20-first-party-capabilities.md)
- [Trunk development](../adr/decision/2026/08/20-trunk-development.md)
- [ADR opening](../adr/decision/2026/08/22-adr-opening.md)
- [Component self containment](../adr/decision/2026/08/24-component-self-containment.md)
- [Relative file links](../adr/decision/2026/08/24-relative-links.md)
- [Markdown formatting](../adr/decision/2026/09/02-markdown-formatting.md)
- [Review authorization](../adr/decision/2026/09/06-review-authorization.md)
- [Bilingual documentation](../adr/decision/2026/08/20-bilingual-docs.md)
- [Commit messages](../adr/decision/2026/09/17-commit-messages.md)
- [Repository checks](../adr/decision/2026/09/12-repository-checks.md)
- [Specifications](../adr/decision/2026/10/04-specifications.md)
- [Repository rules](../adr/decision/2026/10/12-repository-rules.md)
- [Repository dictionary](../adr/decision/2026/10/17-repository-dictionary.md)
- [ADR mechanism](../adr/decision/2026/08/22-adr-mechanism.md)
