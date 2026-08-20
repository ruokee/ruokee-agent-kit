# Project Shape References

Read these files when a decision about a project's overall shape, supported runtimes, or dependency boundaries is central to the task. Each file is a reference: it explains the forces behind a choice, not a checklist to apply blindly.

- [python-version](./python-version.md): how to choose a minimum and target Python version, what `requires-python` means, which features each recent version unlocks, and when bumping the floor is justified.
- [structure](./structure.md): every common project form — single-file script, flat layout, src layout, packaged application, and workspace — with the signals that distinguish them and a decision table for picking one.
- [dependency-management](./dependency-management.md): the runtime/dev/optional/internal split, lockfile policy, dependency groups, version constraints, and dependency direction in a monorepo.

These documents describe forces and tradeoffs, not review policy. They give the context needed to judge a specific project; the review workflow lives under [`workflow`](skills/python-engineering/workflow/index.md).
