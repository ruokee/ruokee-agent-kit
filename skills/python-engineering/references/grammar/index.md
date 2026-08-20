# Grammar And Mechanism References

Read these files when a Python language construct is central to the task: deciding whether to use it, judging an existing use, or explaining its behavior.

- `match-case.md`: structural pattern matching (Python 3.10+), its syntax forms, and when it beats or loses to `if`/`elif` and dispatch tables.
- `context-manager.md`: the `with` / `async with` protocol, resource lifetime, generator-based managers, and exception handling in `__exit__`.
- `decorator.md`: decorators as higher-order functions, parameterized and class-based forms, metadata preservation, and the typing cost.
- `exception-groups.md`: `ExceptionGroup` and `except*` (Python 3.11+) for concurrent and batched failures, and when a single exception is the right tool instead.

These documents describe mechanisms, not review policy. They give the context a human or agent needs to judge a specific use; the review workflow itself lives under `workflow/`.
