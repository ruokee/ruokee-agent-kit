# ADR proposal: Unify repository checks

Decision owner: Ruokee
Draft writer: OMP GPT-6 Astra

English | [中文](./2026-09-12-unify-repository-checks.zh.md)

## Motivation

The root [package.json](../../../package.json) defines `pnpm check` as Markdown formatting checks, tk Rust formatting checks, and Rust tests. The three OMP extensions have their own TypeScript checks and tests, and tk has native adapter tests that Cargo does not execute. A successful root check therefore does not establish that the repository's existing automated checks pass.

Contributors need one complete automated entry point with visible commands and reliable failure reporting. Component checks already exist; the missing part is their inclusion in the repository workflow.

## Proposal

### Entry points and coverage

Make `pnpm check`, run from the repository root, the complete automated check. Preserve the current Markdown and Rust sequence as `pnpm check:base` for targeted work. The complete command includes that sequence exactly once, then runs the component checks in this order:

| Order | Scope | Commands |
| --- | --- | --- |
| 1 | Repository baseline | `pnpm docs:lint`, `pnpm cargo:fmt:check`, then `pnpm cargo:test` through `pnpm check:base` |
| 2 | [projects/omp-status-bar/package.json](../../../projects/omp-status-bar/package.json) | `pnpm --dir projects/omp-status-bar run typecheck`, then `pnpm --dir projects/omp-status-bar run test` |
| 3 | [projects/omp-system-prompt/package.json](../../../projects/omp-system-prompt/package.json) | `pnpm --dir projects/omp-system-prompt run typecheck`, then `pnpm --dir projects/omp-system-prompt run test` |
| 4 | [projects/omp-codex-web-access/package.json](../../../projects/omp-codex-web-access/package.json) | `pnpm --dir projects/omp-codex-web-access run typecheck`, then `pnpm --dir projects/omp-codex-web-access run test` |
| 5 | [projects/tk/adapter-tests/common.test.ts](../../../projects/tk/adapter-tests/common.test.ts) | `bun test projects/tk/adapter-tests` |

Use explicit commands in the root package scripts. Component scripts remain the source of their local checks. The aggregate must select these targets explicitly rather than recursively discover tests throughout the repository. Adding or changing a component's required automated checks includes updating the root entry point in the same change.

`pnpm check:base` reports only its listed scope. The complete command is the repository check required before requesting review. Successful automation does not establish real-model behavior or interactive UI correctness; component-specific scenario validation retains its existing requirements.

### Prerequisites and execution

Use the pnpm version declared by the root `packageManager`, a Rust toolchain with `rustfmt` and tk's build prerequisites, and Bun capable of installing the committed component lockfiles and running their tests.

Dependency setup is explicit: run `pnpm install --frozen-lockfile` at the root and `bun install --frozen-lockfile` in each of the three OMP component directories. Keep the component dependency trees separate. The aggregate adds no dependency installation or automatic source formatting steps. Builds and tests may create their normal generated and temporary files.

Execute checks sequentially. Print each command with enough context to identify its component, preserve its output, and stop at the first failure. Any failed check, missing required executable, or missing dependency makes the aggregate exit nonzero. A successful earlier check must not hide a later failure.

This change aggregates existing automation. It introduces no CI platform, coverage threshold, test framework, model-service invocation, or Harness installation operation. The existing pre-commit formatting hook retains its role.

### Documentation and decision ownership

Update [README.md](../../../README.md), [README.zh.md](../../../README.zh.md), and [AGENTS.md](../../../AGENTS.md) to distinguish complete checks from baseline checks and explain the prerequisites. Keep component documentation consistent with the commands the aggregate invokes.

This adds a repository verification policy alongside [the Markdown formatting decision](../decision/2026-09-02-format-markdown-with-prettier.md). That decision's formatter and formatting requirements remain in force. No current decision needs reversal.

## Alternatives considered

**Keep the baseline command and document a separate manual command sequence.** This makes the omitted checks visible and allows developers to run them individually. It still leaves success of the standard root entry point insufficient to establish complete automated coverage, and requires every caller to remember the additional sequence.

## Acceptance criteria

1. One root `pnpm check` invocation executes every listed check in the specified order and succeeds only when all of them succeed. `pnpm check:base` preserves the Markdown and Rust sequence without claiming component coverage.
2. A normal complete run succeeds with the documented prerequisites and leaves tracked source and configuration files unchanged.
3. A controlled failing child command, introduced without modifying product source, makes the aggregate exit nonzero and prevents later checks from starting. Output identifies the failing command or component.
4. The root scripts reuse component scripts and existing tools. The change adds no automatic dependency installation, CI platform, coverage threshold, test framework, model-service call, or Harness installation.
5. The bilingual repository documentation and Agent instructions describe the same complete scope, baseline scope, setup steps, and failure behavior. Existing component-specific scenario requirements remain explicit.

## Risks

The broader default check needs all three component dependency trees and takes longer than the baseline. A missing dependency or failing component fixture can block completion even for a documentation-only change. Explicit setup instructions and the baseline entry point support targeted diagnosis, while the complete check remains required before review.
