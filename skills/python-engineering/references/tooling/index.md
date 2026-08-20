# Tooling References

Read these files when the task involves selecting, configuring, or reasoning about a specific Python tool. Each document explains what the tool does, where it sits in the workflow, and where its responsibility ends.

The tools divide into layers: environment and dependencies (uv), formatting and linting (ruff), type checking (ty, mypy, basedpyright), testing and coverage (pytest, coverage), the commit gate (pre-commit), and project-specific lint extension (flake8-plugin).

- [uv.md](./uv.md): project, dependency, lockfile, script, and Python-version manager.
- [ruff.md](./ruff.md): formatter and linter, what it auto-fixes and what it leaves to review.
- [ty.md](./ty.md): fast Rust-based type checker, its speed and maturity tradeoffs.
- [mypy.md](./mypy.md): mature strict type checker, plugins, gradual adoption.
- [basedpyright.md](./basedpyright.md): stricter community fork of pyright, IDE integration.
- [pytest.md](./pytest.md): test discovery, fixtures, parametrization, import modes.
- [coverage.md](./coverage.md): branch coverage, thresholds, what coverage does and does not prove.
- [pre-commit.md](./pre-commit.md): local hook framework, fast commit gate, optional CI use.
- [flake8-plugin.md](./flake8-plugin.md): AST-based plugin mechanism for project-specific rules.

No single tool guarantees quality. Each measures something narrow; correctness still comes from tests, review, and design.
