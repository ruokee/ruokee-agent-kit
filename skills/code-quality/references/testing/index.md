# Testing

Reference documents for *test quality* — whether a test suite catches regressions, documents behavior, and survives refactoring. This is language-agnostic guidance: the principles and the anti-patterns that violate them. Language-specific mechanics (pytest fixtures, parametrize, mocking, async) live in the relevant engineering skill; for Python that is `python-engineering`.

The whole area rests on one sentence from Kent Beck: **a test should be coupled to the behavior of the code and decoupled from its structure.** [principles.md](./principles.md) derives the working rules from it; [test-smells.md](./test-smells.md) catalogs the failure modes as Fowler-style smells — symptoms that invite investigation, each with a false-positive boundary.

| Signal | Read |
|-|-|
| What makes a test worth keeping; behavior vs implementation, coverage, DAMP, isolation, fewer-stronger tests | [principles.md](./principles.md) |
| "I change code and must rewrite a wall of tests"; refactor breaks tests that assert internals | [test-smells.md](./test-smells.md) — Fragile Test, Change-Detector Test |
| Redundant / dead-weight tests; too many micro-tests; equal coverage from fewer tests | [test-smells.md](./test-smells.md) — Change-Detector, Testing the Wrong Thing |
| Tests coupled to implementation detail; testing utils/config/trivia | [test-smells.md](./test-smells.md) — Testing the Wrong Thing |
| Unreadable tests, one test asserting many behaviors, undescribed assertions | [test-smells.md](./test-smells.md) — Obscure Test, Assertion Roulette |
| Flaky tests, order-dependent, clock/network/random coupling | [test-smells.md](./test-smells.md) — Erratic / Non-Deterministic Test |
| Duplicated or near-duplicate fixtures and setup across tests | [test-smells.md](./test-smells.md) — Test Code Duplication |

The [code smells](skills/code-quality/references/refactoring/code-smells.md) under `skills/code-quality/references/refactoring` cover the *production* code a test exercises; this directory is about the test code itself. When the reason a unit is hard to test is that its dependencies are reached for internally rather than injected, that is a design signal — see [dependency-inversion](skills/code-quality/references/design-principles/dependency-inversion.md) and [TDD](skills/code-quality/references/design-principles/tdd.md).
