# ADR decision: Scope development checks and retain a complete merge gate

Decision owner: Ruokee
Decision writer: OMP GPT-6.1 Sol
Reverses: [Unify repository checks](../archived/2026-09-12-unify-repository-checks.md)

English | [中文](./2026-09-30-scope-aware-repository-checks.zh.md)

## Motivation

Use affected checks for development and review, complete checks for every final merge candidate, and independent worktrees except for exclusively held serial documentation work.

A Markdown and Rust baseline cannot detect failures in TypeScript components or native adapters. One explicit complete entry point remains necessary, but requiring it before every review also prepares unrelated environments and repeats unrelated checks for documentation and single-component work. Deferring complete validation to the final candidate reduces that repeated work without removing coverage from any merge result.

Working-directory isolation, dependency preparation, and check selection solve different problems. A worktree protects concurrent changes; it does not require every component's dependencies. Markdown can also be a runtime, package, or test input, so its extension alone cannot establish a formatting-only scope.

## Decision

### Entry points, coverage, and gates

The root [package.json](../../../package.json) provides `pnpm check:changed` for development and review, `pnpm check` for complete automation, `pnpm check:base` for the Markdown and Rust baseline, and `pnpm check:selector` for selection regression tests. Before requesting review, commit task changes, leave the working tree clean, and pass affected checks for the branch.

The complete entry point runs the baseline exactly once: Markdown formatting, Rust formatting, and Rust tests. It then runs every explicitly listed OMP target in the order maintained by the [coverage and command reference](../../../README.md#complete-merge-validation), each target's typecheck followed by its tests. Native tk adapter tests, Skill lifecycle tests, and selector regression tests follow in that order. The root aggregate reuses component scripts and lists targets explicitly; it does not recursively discover components.

After all review changes, complete validation is mandatory on the clean, committed final candidate before merge. The candidate must contain target `main`. Record the candidate commit and tree, target commit, command, and result. Further tracked changes, pending changes, a changed candidate, or an advancing target invalidate success and require complete validation of the new final state. An authorized squash merge must use the unchanged target and produce the validated tree.

Affected success is not complete merge validation and grants no merge or push permission. Keep the short-lived branch and squash authorization boundaries of the [branch workflow decision](./2026-08-20-use-trunk-based-squash-workflow.md). Automated success does not establish real-model behavior, interactive UI correctness, or real-machine behavior; existing component scenario obligations remain in force.

### Affected scope and failure behavior

Select paths from the merge base of `HEAD` and local `main`, or an explicitly selected baseline ref. Include committed, staged, unstaged, and non-ignored untracked changes, deleted paths, and both sides of renames. The selector reads Git without fetching or changing its state.

Use a repository-owned explicit mapping. Known scopes select the union of required checks without duplicates and preserve the complete entry point's relative order. Existing changed Markdown receives the repository's Prettier check. Known consumers take priority over explanatory-document rules: component source and test Markdown selects its component, tk packaging trees select tk checks, and installation documentation selects Skill lifecycle checks. Unknown components and unknown Markdown are not presumed to be formatting-only.

Shared check inputs, selector changes, unknown scopes, unreliable baselines or history, and unreliable path collection select one complete check instead of partial execution. Missing Git, an invalid checkout, and unresolved index conflicts fail directly. Missing required executables or selected local dependencies also fail; global tools must not conceal missing local setup. A deleted explanatory document may need no formatter, but a missing required input cannot be skipped.

Report the baseline, path sources, selected scopes and commands, fallback reason, and failing step. Execute checks sequentially, preserve child output, and stop at the first failure with a nonzero exit status. Earlier success cannot hide later failure. Complete fallback does not call the selector recursively.

### Working directories and environment ownership

Use independent worktrees for code, configuration, scripts, parallel tasks, and uncertain exclusivity. A serial explanatory Markdown or ADR task may use the main working directory only when it is clean, no parallel work is active, and exclusive use is confirmed. Switch to a short-lived branch before editing; never edit or commit directly on `main`.

A runtime template is source, not explanatory documentation. An explanatory document consumed by a test may still qualify for the directory exception, but retains its consumer checks. If scope expands beyond the exception or exclusive use is lost, stop shared-directory editing and preserve the work in an independent worktree before continuing. The selector does not establish exclusivity or manage branches and worktrees.

Environment setup remains explicit. Use the declared pnpm version and supported Node.js, Git, Rust with `rustfmt` and tk's build prerequisites when selected, and Bun compatible with the selected component lockfiles. Prepare root locked dependencies and only selected environments during development; prepare every environment for complete checks or fallback. Keep independent component dependency trees and locked versions. The [preparation matrix](../../../README.md#check-prerequisites) defines the commands and system prerequisites, including Git and a non-root environment for complete Skill lifecycle coverage.

Package-manager content caches may be reused within the same trust boundary, but branches must not share writable dependency directories or build output. Checks do not install dependencies, format source files, or upgrade tools. Successful checks leave tracked source and configuration unchanged; builds and tests may create their normal temporary and generated files. The pre-commit formatting hook retains its role.

### Maintenance and compatibility

Adding a component, changing required automated checks, or introducing a document consumer requires updating the explicit complete aggregate, selector mapping, and regression tests together. [README.md](../../../README.md), [README.zh.md](../../../README.zh.md), and [AGENTS.md](../../../AGENTS.md) describe the same gates, preparation boundaries, directory exception, and success invalidation. Component documentation stays consistent with invoked commands.

This decision reverses the complete-before-review clause of the previous check decision and preserves its complete coverage, explicit order, baseline, separate dependency trees, visible failure propagation, non-mutating checks, and scenario obligations. The [Markdown formatting decision](./2026-09-02-format-markdown-with-prettier.md) remains in force. This change does not migrate component layouts or introduce a workspace, task-graph dependency, CI platform, coverage threshold, testing framework, model-service invocation, or Harness installation operation.

## Alternatives considered

**Keep complete checks before review and use affected checks only during development.** This retains the former gate but repeats unrelated preparation and checks across review iterations. Complete checks belong to the final state without being removed from merge results.

**Use a worktree for every task and prepare dependencies by scope.** This keeps the simplest isolation rule and remains the fallback when exclusivity is uncertain. It still creates another directory and prepares root tools for serial explanatory documentation.

**Migrate to a workspace or add a task-graph tool.** These provide package graphs and affected tasks but would change independent lockfiles, environment preparation, and repository structure beyond the need. Explicit scopes reuse existing checks.

**Format all Markdown without consumer checks.** This is simpler, but runtime templates, packaged content, and tested installation steps can regress until final validation. Known consumers remain in affected scope.

**Keep the baseline and document a separate manual complete sequence.** This makes missing checks visible but still requires every caller to remember the sequence. One explicit complete entry point keeps its success meaningful.

## Consequences

Documentation and local component work can prepare and run only affected environments during development and review. Shared or unknown changes still need every complete-check prerequisite. Every merge result retains the complete automated gate, which can block even a documentation merge when an unrelated component fails.

Consumer mapping is maintained knowledge, not automatic semantic dependency analysis. An omitted relationship can miss a regression before final validation; explicit mappings, selection tests, conservative fallback, and mandatory complete checks limit that harm.

The directory exception and final candidate comparison depend on operator confirmation. Incorrect exclusivity can expose concurrent edits, and a stale successful result can authorize untested merge content. Worktree fallback and candidate, target, and tree checks are required; the selector does not provide a merge service or persisted success credential.
