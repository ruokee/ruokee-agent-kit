# ADR decision: Unify repository checks

Decision owner: Ruokee
Draft writer: OMP GPT-6 Astra

English | [中文](./2026-09-12-unify-repository-checks.zh.md)

## Motivation

Repository verification spans Markdown formatting, tk Rust code, three independently packaged OMP extensions, and the native tk adapter. The root [package.json](../../../package.json) and component scripts need one complete entry point so a successful repository check covers all existing automation.

A Markdown and Rust check alone cannot detect failures in the TypeScript extensions or native adapter. Explicit component targets and reliable failure propagation give contributors a consistent complete check.

## Decision

### Entry points and coverage

`pnpm check`, run from the repository root, is the complete automated check. `pnpm check:base` provides the Markdown and Rust sequence for targeted work. The complete command includes that sequence exactly once, then runs the component checks in this order:

| Order | Scope | Commands |
| --- | --- | --- |
| 1 | Repository baseline | `pnpm docs:lint`, `pnpm cargo:fmt:check`, then `pnpm cargo:test` through `pnpm check:base` |
| 2 | [projects/omp-status-bar/package.json](../../../projects/omp-status-bar/package.json) | `pnpm --dir projects/omp-status-bar run typecheck`, then `pnpm --dir projects/omp-status-bar run test` |
| 3 | [projects/omp-system-prompt/package.json](../../../projects/omp-system-prompt/package.json) | `pnpm --dir projects/omp-system-prompt run typecheck`, then `pnpm --dir projects/omp-system-prompt run test` |
| 4 | [projects/omp-codex-web-access/package.json](../../../projects/omp-codex-web-access/package.json) | `pnpm --dir projects/omp-codex-web-access run typecheck`, then `pnpm --dir projects/omp-codex-web-access run test` |
| 5 | [projects/tk/adapter-tests/common.test.ts](../../../projects/tk/adapter-tests/common.test.ts) | `bun test projects/tk/adapter-tests` |

The root package scripts list explicit commands joined with `&&` and reuse component scripts for local checks. Targets are explicit rather than recursively discovered throughout the repository. Adding or changing a component's required automated checks includes updating the root entry point in the same change.

`pnpm check:base` reports only its listed scope. The complete command is the repository check required before requesting review. Successful automation does not establish real-model behavior or interactive UI correctness; component-specific scenario validation retains its existing requirements.

### Prerequisites and execution

Use the pnpm version declared by the root `packageManager`, a Rust toolchain with `rustfmt` and tk's build prerequisites, and Bun capable of installing the committed component lockfiles and running their tests.

Dependency setup is explicit: run `pnpm install --frozen-lockfile` at the root and `bun install --frozen-lockfile` in each of the three OMP component directories. Keep the component dependency trees separate. The aggregate adds no dependency installation or automatic source formatting steps. Builds and tests may create their normal generated and temporary files.

Execute checks sequentially. Print each command with enough context to identify its component, preserve its output, and stop at the first failure. Any failed check, missing required executable, or missing dependency makes the aggregate exit nonzero. A successful earlier check must not hide a later failure.

The aggregate runs existing automation without adding a CI platform, coverage threshold, test framework, model-service invocation, or Harness installation operation. The pre-commit formatting hook retains its role.

### Documentation

[README.md](../../../README.md), [README.zh.md](../../../README.zh.md), and [AGENTS.md](../../../AGENTS.md) distinguish complete checks from baseline checks and explain the prerequisites. Component documentation must remain consistent with the commands the aggregate invokes.

This repository verification policy complements [the Markdown formatting decision](./2026-09-02-format-markdown-with-prettier.md). That decision's formatter and formatting requirements remain in force.

## Alternatives considered

**Keep the baseline command and document a separate manual command sequence.** This makes the omitted checks visible and allows developers to run them individually. It still leaves success of the standard root entry point insufficient to establish complete automated coverage, and requires every caller to remember the additional sequence.

## Consequences

One root command reports whether all required automated checks pass. Successful checks leave tracked source and configuration files unchanged; builds and tests may create their normal generated and temporary files.

The complete check needs all three component dependency trees and takes longer than the baseline. A missing dependency or failing component fixture can block completion even for a documentation-only change. Explicit setup instructions and the baseline entry point support targeted diagnosis, while the complete check remains required before review.
