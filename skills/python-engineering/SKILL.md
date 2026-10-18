---
name: python-engineering
description: Use when evaluating or improving Python engineering practices, including project structure, dependencies and version policy, typing, testing, language features, standard-library mechanisms, and tooling.
metadata:
  version: "1.0.6"
---

# Python Engineering

Use this Skill for Python-specific engineering review, convention design, and analysis.

## Entry Conditions

Activate this Skill when the task is Python-specific engineering: project shape or package layout, Python version policy, dependency management, type hints and checking strategy, testing, docstrings, custom lint, grammar choices, standard-library mechanisms, or toolchain setup.

## Mode Selection

Three modes are available. Default to fast review.

- Fast review is the default for daily self-checks, small diffs, and PR review; read `./workflow/fast-review.md`.
- Full review applies when the user explicitly says "full review", "complete review", "systematic review", or "architecture review"; read `./workflow/full-review.md`.
- Analysis applies when the user asks for discussion, brainstorming, design comparison, mechanism analysis, or a refactoring plan; read `./workflow/analysis.md`.

Read-only constraint: when the user says "do not modify", "read-only", "just analyze", or "survey", do not run any command that writes files. Prefer `rg`, `git ls-files`, `git show`, `find`, `wc`, `nl`. Avoid `uv run`, `pytest`, `ruff check --fix`, `pre-commit run`, or any command that creates `.venv`, cache, or modifies source.

## Judgment Order

Route to leaf documents by signal. Read only what the task requires.

- For Python version, runtime target, and compatibility, read [python-version](./references/project/python-version.md), often alongside type-hint and structure.
- For project shape (script, flat, src, packaged app, or workspace), read [structure](./references/project/structure.md), often alongside dependency-management and uv.
- For runtime, development, and optional dependencies, locks, and groups, read [dependency-management](./references/project/dependency-management.md), often alongside uv and structure.
- For code style and the boundary between PEP 8 and formatters or review, read [style](./references/spec/style.md), often alongside ruff and custom-lint.
- For Python-specific applications of design principles, paradigms, and refactoring, read [Python design guidance](./references/spec/code-quality.md), often alongside style and type-hint.
- For type hints, annotations, `Any`, `cast`, Protocol, generics, type aliases, and type parameters, read [type-hint](./references/spec/type-hint.md), often alongside python-version and ty.
- For test organization, fixtures, parametrize, exceptions and warnings, log and output capture, mocking boundaries, and async tests, read [testing](./references/spec/testing.md), often alongside pytest.
- For docstrings, API docs, schema metadata, and information placement, read [docstrings-api-docs](./references/spec/docstrings-api-docs.md), often alongside type-hint.
- For project-specific mechanical rules and custom lint, read [custom-lint](./references/spec/custom-lint.md), often alongside flake8-plugin and pre-commit.
- For `match`/`case` and structural pattern matching, read [match-case](./references/grammar/match-case.md), often alongside type-hint.
- For `with`, `async with`, and resource-lifetime syntax, read [context-manager](./references/grammar/context-manager.md), often alongside contextlib and exception-groups.
- For `ExceptionGroup`, `except*`, and multiple errors, read [exception-groups](./references/grammar/exception-groups.md), often alongside context-manager.
- For decorators, higher-order functions, parameterized decorators, and decorator classes, read [decorator](./references/grammar/decorator.md), often alongside functools and common.
- For common stdlib modules such as pathlib, enum, dataclasses, and logging, read [common](./references/stdlib/common.md), often alongside functools and itertools.
- For `singledispatch`, `partial`, closures, and decorator helpers, read [functools](./references/stdlib/functools.md), often alongside decorator and common.
- For `itertools`, lazy pipelines, grouping, and batching, read [itertools](./references/stdlib/itertools.md), often alongside common and functools.
- For `contextlib`, `ExitStack`, and `AsyncExitStack`, read [contextlib](./references/stdlib/contextlib.md), often alongside context-manager and common.
- For uv dependency, lock, script, and workspace commands, read [uv](./references/tooling/uv.md), often alongside dependency-management and structure.
- For Ruff's formatter and linter responsibilities, read [ruff](./references/tooling/ruff.md), often alongside style and custom-lint.
- For ty as a fast type checker and for LSP feedback, read [ty](./references/tooling/ty.md), often alongside type-hint, mypy, and basedpyright.
- For mypy strict mode and legacy gates, read [mypy](./references/tooling/mypy.md), often alongside type-hint, ty, and basedpyright.
- For basedpyright strict mode and its comparison with Pyright, read [basedpyright](./references/tooling/basedpyright.md), often alongside type-hint, ty, and mypy.
- For pytest runner configuration, discovery, import mode, markers, strict mode, and plugins, read [pytest](./references/tooling/pytest.md), often alongside testing.
- For coverage.py, branch coverage, and thresholds, read [coverage](./references/tooling/coverage.md), often alongside testing and pytest.
- For pre-commit hooks, local gates, and CI integration, read [pre-commit](./references/tooling/pre-commit.md), often alongside custom-lint and ruff.
- For Flake8 plugin mechanics used by custom lint, read [flake8-plugin](./references/tooling/flake8-plugin.md), often alongside custom-lint and pre-commit.

When terminology is unclear or inconsistent, read the [glossary](./glossary.md).

## Output Contract

Report findings first. Separate facts, inferences, judgments, and recommendations. Do not repeat issues that a formatter, linter, or type checker can determine mechanically.

Output format is mode-specific. Follow the matching workflow document (`./workflow/fast-review.md`, `./workflow/full-review.md`, or `./workflow/analysis.md`). Analysis mode gives options and tradeoffs, not a findings list.

Write output in the language required by global, project, or user instructions; when none is specified, use the current conversation's language.

## Stop Rules

- Do not automatically run full review mode.
- Do not modify code unless the user asks for fixes.
- Do not run unsafe fixes, bulk suppressions, cross-file refactors, dependency changes, or lockfile-altering commands without explicit confirmation.
- Read-only and analysis tasks leave reviewed files unchanged. Existing authorization to maintain reports or Task materials still applies.
- Do not report issues that Ruff, ty, or pre-commit can catch mechanically. Note them once in Notes if relevant, then move on.
