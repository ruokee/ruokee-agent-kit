# ADR proposal: Scope development checks and retain a complete merge gate

Draft owner: Ruokee
Draft writer: OMP GPT-6.1 Sol

English | [中文](./2026-09-30-scope-aware-repository-checks.zh.md)

## Motivation

Use affected checks before review and complete checks before merge, with a conditional main-directory exception for serial documentation work.

The [repository check decision](../decision/2026-09-12-unify-repository-checks.md) requires complete automation before requesting review. The root [package.json](../../../package.json) checks Markdown, Rust, every packaged OMP component, the native tk adapter, and the Skill lifecycle. Documentation and single-component work therefore need unrelated environments and checks before review, and review changes can require repeating the full sequence.

Working-directory isolation, dependency preparation, and validation scope solve different problems. A separate worktree protects concurrent work, but does not require installing unrelated component dependencies. Serial documentation work can avoid creating another directory when the existing main working directory is clean and its exclusive use is confirmed.

A file's Markdown extension does not establish that formatting is its only relevant check. The runtime prompt template is a component input, tk packages its Skill and adapter trees, and Skill lifecycle tests read the installation documentation. Affected validation must account for these known consumers while retaining a complete check for every merge result.

## Proposal

### Review and merge gates

Add `pnpm check:changed` as the affected automated check for development and review. Before requesting review, commit the task changes, leave the task working tree clean, and pass this check for the branch's affected scope.

Keep `pnpm check` as the single complete automated entry point. It remains mandatory after all review changes and before merge. Preserve all existing coverage, explicit component targets, relative execution order, command output, and first-failure propagation. The complete check also covers the affected-check selection logic.

Complete success applies to a specific final task state and target `main`. The candidate must contain the target `main` state before validation, and the merged content must equal the validated content. Further tracked changes, a changed candidate, or an advancing target `main` invalidate the result and require complete validation of the new final state. Affected-check success alone cannot authorize a merge.

Automated success does not replace existing real-model, interactive UI, or real-machine validation obligations. Keep the short-lived branch, clean review state, squash integration, and separate merge and push authorization boundaries of the [branch workflow decision](../decision/2026-08-20-use-trunk-based-squash-workflow.md).

### Affected scope and conservative fallback

Select changes relative to the branch's merge base with `main`, with an explicit alternative baseline allowed. Include committed, staged, unstaged, and non-ignored untracked changes. Classify deleted paths and both sides of renames so moving a file cannot silently remove its former consumer from the check set.

Use an explicit repository-owned mapping to existing checks. Known scopes select the union of their required checks, with no duplicate execution. Ordinary explanatory Markdown selects formatting for changed files that still exist. Known build or test inputs, including Markdown, also select their consumer checks. Shared check infrastructure and unknown scopes select the complete check.

An absent or unreliable baseline, insufficient history, or a classification failure must fall back to `pnpm check`, not report a reduced-scope success. Any selected check failure or missing required executable or local dependency must make the entry point fail. Report the identified scope, selected commands, complete fallback reason, and failing step; preserve child command output and stop at the first failure.

Keep the selection mechanism small and use the existing repository toolchain. Do not migrate components into a workspace or introduce a task-graph dependency for this change.

### Working-directory isolation

Allow a serial documentation or ADR task to use the existing main working directory only when it is clean, there is no parallel work, and exclusive use can be confirmed. Create and switch to a short-lived task branch before editing. Never edit or commit directly on `main`.

This exception covers explanatory Markdown, not source files, scripts, manifests, lockfiles, tool configuration, or generation rules. A runtime template does not become documentation because its filename ends in `.md`. A document read by a test remains eligible for the documentation exception if it is otherwise explanatory; its consumer checks still apply.

Use an independent worktree for code and other non-documentation work, parallel tasks, or whenever cleanliness or exclusive use cannot be confirmed. If a main-directory task expands beyond the exception or loses exclusive use, stop editing there and preserve the work in an independent worktree before continuing.

### Environment ownership and preparation

Prepare only the dependencies required by the selected checks during development, then prepare the complete environment for final validation or complete fallback. Use locked dependency versions and keep each component's dependency tree independent.

Reuse package-manager content caches within the same trust boundary, but do not share writable dependency directories or build output between branches. Checks must not install dependencies, format source files, or upgrade tools. The pre-commit formatting hook retains its existing responsibility.

Working-directory choice and check selection remain independent. Running a consumer check does not by itself turn an explanatory documentation task into a code task or require installing unrelated component dependencies.

### Decision compatibility

Reverse the [Unify repository checks decision](../decision/2026-09-12-unify-repository-checks.md) clause that requires the complete command before requesting review. This proposal requires affected validation at that gate and complete validation of the final merge candidate instead; both timing rules cannot hold as the repository's minimum review gate.

The successor decision must retain the current decision's still-effective complete coverage, explicit targets and execution order, baseline entry point, independent dependency setup, non-mutating check behavior, visible failure propagation, pre-commit role, documentation requirements, and component-specific scenario obligations. Add the affected-selection and working-directory policy without changing component layout, distribution contracts, or product behavior.

Keep public development instructions and both language versions of the repository documentation consistent with these gates, the conditional directory exception, scoped environment preparation, and complete-result invalidation rules.

## Alternatives considered

**Retain complete validation before review and add affected checks only for development.** This preserves the current gate unchanged, but review iterations can still repeat unrelated preparation and checks. The proposed gate defers complete automation until the final state without removing it from any merge result.

**Use a worktree for every task and prepare dependencies by scope.** This retains the simplest isolation rule and remains the fallback when exclusive use is uncertain. It does not avoid directory creation and root-tool setup for serial explanatory documentation work.

**Migrate to a workspace or introduce a task-graph tool.** These offer package graphs and affected-task facilities, but would change independent lockfiles, component preparation, and repository structure beyond the current need. Explicit scopes reuse the existing layout and checks.

**Format every Markdown change without consumer checks.** This makes selection simple, but runtime templates, packaged content, and tested installation steps can regress until final validation. Known consumers are included in affected checks instead.

## Acceptance criteria

1. Development and review have an affected-check entry point that covers branch and working-state changes, including deletions and both rename paths, and reports its actual scope and failures.
2. Known scopes select their check union without duplicate execution. Markdown build or test inputs include consumer checks; unknown or shared scope and unreliable classification select complete validation.
3. Missing required tools or local dependencies, failed selected checks, and incomplete execution cannot produce a successful affected result.
4. Every merge result retains the complete automated coverage. Success is valid only for the unchanged final candidate and target `main`, with existing component-specific scenario obligations preserved.
5. Only clean, serial, exclusively held explanatory documentation or ADR tasks may use the main working directory on a short-lived branch. Other work uses independent worktrees, and no task edits directly on `main`.
6. Development prepares only selected environments with locked versions and independent writable trees. Final or fallback validation requires the complete environment, without automatic installation or formatting inside checks.
7. The successor check decision preserves the current decision's still-effective rules, and public English and Chinese instructions describe the same gates and boundaries.

## Risks

An omitted consumer relationship can cause affected validation to miss a regression during development or review. Explicit mapping, selection regression tests, conservative complete fallback, and mandatory final complete checks reduce this risk, but cannot infer every semantic dependency.

Incorrect exclusive-use confirmation can let another session change the shared working directory or branch while a documentation task is active. The exception requires positive confirmation and falls back to an independent worktree when that confirmation is unavailable.

A complete result can be applied to unvalidated merge content if the task state or target `main` changes without invalidating the result. The merge gate must verify both states and content equality; this proposal does not add an automatic merge service to enforce that responsibility.
