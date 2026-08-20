# Specification References

Read these files when a decision about coding conventions, typing, testing, documentation, or project-specific rules is central to the task. Each file is reference material: it explains what a convention is for and where its boundaries lie, not a checklist to apply blindly.

- [style](./style.md): the boundary between what a formatter and linter handle mechanically and what still needs human judgment — naming, module boundaries, abstraction level, and explicitness on top of the PEP 8 baseline.
- [type-hint](./type-hint.md): type annotations as interface contracts — type parameters and aliases, gradual typing strategy, `Any` containment, Protocol versus ABC, `TYPE_CHECKING` isolation, and how the type checkers relate.
- [testing](./testing.md): test organization, fixture design, parametrization, behavior coverage over line coverage, mock boundaries, and tests as executable documentation.
- [docstrings-api-docs](./docstrings-api-docs.md): where each kind of information belongs — signature versus docstring versus schema metadata versus documentation site — and when a docstring adds value versus repeats the signature.
- [custom-lint](./custom-lint.md): when a project-specific lint rule is warranted, how to design one that is mechanical and low-false-positive, and where it runs.

These documents describe conventions and their tradeoffs, not review policy. The review workflow lives under [`workflow`](skills/python-engineering/workflow/index.md).
