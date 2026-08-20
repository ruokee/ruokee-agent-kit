# Standard Library References

Read these files when a standard-library mechanism is central to the task. Each file explains the mechanism, its problem space, idiomatic use, and the boundary where it stops helping.

- [common](./common.md): high-frequency modules — `pathlib`, `enum`/`StrEnum`, `dataclasses`, `logging`, `collections`, and runtime `typing` utilities. Read when choosing the right value container, path API, finite value set, or logging shape.
- [functools](./functools.md): `singledispatch`, `partial`, `lru_cache`/`cache`, `reduce`, and `wraps`. Read for type-based dispatch, partial application, memoization, and decorator support.
- [itertools](./itertools.md): lazy iteration, batching, grouping, chaining, and the multiple-consumption pitfall. Read when building data pipelines or transforming sequences.
- [contextlib](./contextlib.md): `@contextmanager`, `ExitStack`, `suppress`, `redirect_*`, `nullcontext`, and `closing`. Read when writing or composing context managers.

The standard library is the default dependency. Reach for a third-party package only when a stdlib mechanism is genuinely insufficient, not before. These references describe mechanisms, not review rules; the review workflow lives under [`workflow`](skills/python-engineering/workflow/index.md).
