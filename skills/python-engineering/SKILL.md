---
name: python-engineering
description: Python engineering guidance for project layout, Python version policy, dependency management, coding specifications, type hints, testing, custom linting, Python grammar choices, standard-library usage, tooling, and Python code review. Use when asked to review, design, or discuss Python-specific conventions, project structure, package layout, dependency setup, typing/testing/linting specs, grammar usage, stdlib mechanisms, or Python project engineering practices.
---

# Python Engineering

Use this Skill for Python-specific engineering review, convention design, and analysis. It covers project shape, Python version policy, package structure, typing, tests, custom lint, grammar choices, standard-library mechanisms, tooling, and Python-focused code review.

For ordinary Python code review or daily self-check, also use `code-quality` unless the user explicitly narrows the scope.

## Entry Conditions

Activate this Skill when the task is Python-specific engineering: project shape or package layout, Python version policy, dependency management, type hints and checking strategy, testing, docstrings, custom lint, grammar choices, standard-library mechanisms, or toolchain setup.

## Mode Selection

Three modes are available. Default to fast review.

| Mode | Trigger | Read |
|-|-|-|
| Fast review | Default for daily self-check, small diff, PR review | `./workflow/fast-review.md` |
| Full review | User explicitly says "full review", "complete review", "systematic review" | `./workflow/full-review.md` |
| Analysis | User asks for discussion, brainstorm, design comparison, mechanism analysis, refactoring plan | `./workflow/analysis.md` |

Read-only constraint: when the user says "do not modify", "read-only", "just analyze", or "survey", do not run any command that writes files. Prefer `rg`, `git ls-files`, `git show`, `find`, `wc`, `nl`. Avoid `uv run`, `pytest`, `ruff check --fix`, `pre-commit run`, or any command that creates `.venv`, cache, or modifies source.

## Judgment Order

Route to leaf documents by signal. Read only what the task requires.

| Signal | Read First | Often Pair With |
|-|-|-|
| Python version, runtime target, compatibility | [python-version](./references/project/python-version.md) | type-hint, structure |
| Project shape: script, flat, src, packaged app, workspace | [structure](./references/project/structure.md) | dependency-management, uv |
| Runtime/dev/optional dependencies, lock, groups | [dependency-management](./references/project/dependency-management.md) | uv, structure |
| Code style, PEP 8 vs formatter/review boundary | [style](./references/spec/style.md) | ruff, custom-lint |
| Type hints, annotations, `Any`, `cast`, Protocol, generics, type alias, type parameters | [type-hint](./references/spec/type-hint.md) | python-version, ty |
| Test organization, fixtures, parametrize, exceptions/warnings, log/output capture, mocking boundary, async | [testing](./references/spec/testing.md) | pytest, code-quality testing |
| Docstring, API docs, schema metadata, information placement | [docstrings-api-docs](./references/spec/docstrings-api-docs.md) | type-hint |
| Project-specific mechanical rules, custom lint | [custom-lint](./references/spec/custom-lint.md) | flake8-plugin, pre-commit |
| `match`/`case`, structural pattern matching | [match-case](./references/grammar/match-case.md) | type-hint |
| `with`, `async with`, resource lifetime syntax | [context-manager](./references/grammar/context-manager.md) | contextlib, exception-groups |
| `ExceptionGroup`, `except*`, multi-error | [exception-groups](./references/grammar/exception-groups.md) | context-manager |
| Decorators, higher-order functions, parameterized decorators, decorator classes | [decorator](./references/grammar/decorator.md) | functools, common |
| Common stdlib: pathlib, enum, dataclasses, logging | [common](./references/stdlib/common.md) | functools, itertools |
| `singledispatch`, `partial`, closure, decorator helpers | [functools](./references/stdlib/functools.md) | decorator, common |
| `itertools`, lazy pipelines, grouping, batching | [itertools](./references/stdlib/itertools.md) | common, functools |
| `contextlib`, `ExitStack`, `AsyncExitStack` | [contextlib](./references/stdlib/contextlib.md) | context-manager, common |
| uv dependency, lock, script, workspace commands | [uv](./references/tooling/uv.md) | dependency-management, structure |
| Ruff formatter/linter responsibilities | [ruff](./references/tooling/ruff.md) | style, custom-lint |
| ty as fast type checker, LSP feedback | [ty](./references/tooling/ty.md) | type-hint, mypy, basedpyright |
| mypy strict, legacy gate | [mypy](./references/tooling/mypy.md) | type-hint, ty, basedpyright |
| basedpyright strict, Pyright comparison | [basedpyright](./references/tooling/basedpyright.md) | type-hint, ty, mypy |
| pytest runner config, discovery, import mode, markers, strict mode, plugins | [pytest](./references/tooling/pytest.md) | testing |
| coverage.py, branch coverage, threshold | [coverage](./references/tooling/coverage.md) | testing, pytest |
| pre-commit hooks, local gate, CI integration | [pre-commit](./references/tooling/pre-commit.md) | custom-lint, ruff |
| Flake8 plugin mechanics for custom lint | [flake8-plugin](./references/tooling/flake8-plugin.md) | custom-lint, pre-commit |

Directory `index.md` files serve human navigation and maintenance. Read an `index.md` only when the directory boundary itself is unclear.

## Preferences

After identifying relevant leaves, read project facts and optional preferences:

1. Read the nearest applicable `AGENTS.md` or project rules.
2. Read `pyproject.toml` and relevant config: `.pre-commit-config.yaml`, Makefile, CI, test config.
3. Look for preferences heuristically:
   - First try project-level: `.agents/preferences/python-engineering.md`, then `.agents/preferences/python-engineering/index.md`.
   - If not found, try user-level directories: `~/.codex/preferences/python-engineering.md`, `~/.claude/preferences/python-engineering.md`, or equivalent user config directory.
4. If no preferences are found at any level, continue silently.

Preferences may specify: minimum Python version, forbidden imports, default tools, docstring style, testing conventions, third-party library Skill references. Never present preferences as Python language facts or universal engineering conclusions.

## Output Contract

Report findings first. Separate facts, inferences, judgments, preferences, and suggestions; do not conflate them. Do not repeat issues that a formatter, linter, or type checker can determine mechanically.

Output format is mode-specific — follow the matching workflow document (`./workflow/fast-review.md`, `./workflow/full-review.md`, or `./workflow/analysis.md`). Analysis mode gives options and tradeoffs, not a findings list.

Write output in the language required by global, project, or user instructions; when none is specified, use the current conversation's language.

## Stop Rules

- Do not automatically run full review mode.
- Do not modify code unless the user asks for fixes.
- Do not run unsafe fixes, bulk suppressions, cross-file refactors, dependency changes, or lockfile-altering commands without explicit confirmation.
- Do not turn preferences into universal Python rules.
- Do not write file modifications during read-only or analysis tasks.
- Do not report issues that Ruff, ty, or pre-commit can catch mechanically — note them once in Notes if relevant, then move on.
