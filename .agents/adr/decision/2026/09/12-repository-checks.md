# Repository checks

Decision owner: Ruokee
Decision writer: OMP GPT-6.1 Sol
Reverses: [Repository checks](../../../archived/2026/09/12-r1-repository-checks.md)

English | [中文](./12-repository-checks.zh.md)

## Motivation

Use affected checks for development and review, complete checks for every final merge candidate, and independent worktrees except for exclusively held serial documentation work.

A Markdown and Rust baseline cannot detect failures in TypeScript components or native adapters. One explicit complete entry point remains necessary, but requiring it before every review also prepares unrelated environments and repeats unrelated checks for documentation and single-component work. Deferring complete validation to the final candidate reduces that repeated work without removing coverage from any merge result.

Working-directory isolation, dependency preparation, and check selection solve different problems. A worktree protects concurrent changes; it does not require every component's dependencies. Markdown can also be a runtime, package, or test input, so its extension alone cannot establish a formatting-only scope.

## Decision

The complete entry point is mandatory on the clean, committed final candidate after all review changes and before merge. The candidate must contain target `main`, and an authorized squash merge must use the unchanged target and produce the validated tree.

Affected success is not complete merge validation and grants no merge or push permission. Keep the short-lived branch and squash authorization boundaries of the [branch workflow decision](../08/20-trunk-development.md). Automated success does not establish real-model behavior, interactive UI correctness, or real-machine behavior; existing component scenario obligations remain in force.

This decision reverses the complete-before-review clause of the previous check decision and preserves its complete coverage, explicit order, baseline, separate dependency trees, visible failure propagation, non-mutating checks, and scenario obligations. The [Markdown formatting decision](./02-markdown-formatting.md) remains in force. This change does not migrate component layouts or introduce a workspace, task-graph dependency, CI platform, coverage threshold, testing framework, model-service invocation, or Harness installation operation.

The [selector](../../../../../scripts/check-changed.mjs) owns ordered check targets and explicit consumer mapping. Component READMEs and their validation guides own exact preparation and check commands. The repository's [check prerequisites](../../../../../README.md#check-prerequisites), [complete merge validation](../../../../../README.md#complete-merge-validation), [development rules](../../../../rule/development.md), and [Git rules](../../../../rule/git.md) own shared entry points, fallback, the working-directory exception, and maintenance obligations.

## Alternatives considered

**Keep complete checks before review and use affected checks only during development.** This retains the former gate but repeats unrelated preparation and checks across review iterations. Complete checks belong to the final state without being removed from merge results.

**Use a worktree for every task and prepare dependencies by scope.** This keeps the simplest isolation rule and remains the fallback when exclusivity is uncertain. It still creates another directory and prepares root tools for serial explanatory documentation.

## Consequences

Documentation and local component work can prepare and run only affected environments during development and review. Shared or unknown changes still need every complete-check prerequisite. Every merge result retains the complete automated gate, which can block even a documentation merge when an unrelated component fails.

Consumer mapping is maintained knowledge, not automatic semantic dependency analysis. An omitted relationship can miss a regression before final validation; explicit mappings, selection tests, conservative fallback, and mandatory complete checks limit that harm.

The directory exception and final candidate comparison depend on operator confirmation. Incorrect exclusivity can expose concurrent edits, and a stale successful result can authorize untested merge content. Worktree fallback and candidate, target, and tree checks are required; the selector does not provide a merge service or persisted success credential.
