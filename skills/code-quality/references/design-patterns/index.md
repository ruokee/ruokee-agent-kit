# Design Patterns

Design patterns are vocabulary for recurring design problems, not templates to apply by default. Each pattern names a shape that solves a specific variation problem: something varies, and the pattern isolates that variation behind a stable interface. The cost is always an extra layer of indirection.

Before reaching for a pattern, ask:

- Is the variation point real, or speculative? A pattern that abstracts a variation that never materializes is pure overhead.
- Would a simpler construct suffice? In Python, first-class functions, `dataclass`, `Protocol`, `match`, decorators, context managers, iterators, and dispatch maps absorb or collapse many classic object-oriented patterns.
- Does the pattern reduce the caller's understanding cost, or just add a hop?
- What is the failure cost: global state, hidden control flow, class explosion, harder testing, performance, or unclear lifecycle?

Solve the problem first, then decide whether a named pattern earns its keep. Do not pick a pattern and then hunt for a problem to fit it.

## Creational

- [factory.md](./factory.md): Factory Method — decouple creation from callers; often just a function in Python.
- [abstract-factory.md](./abstract-factory.md): Abstract Factory — create families of related objects that must vary together.
- [builder.md](./builder.md): Builder — construct complex objects step by step.

## Structural

- [adapter.md](./adapter.md): Adapter — make incompatible interfaces work together.
- [decorator.md](./decorator.md): Decorator pattern — add behavior by wrapping (distinct from Python's `@decorator` syntax).
- [facade.md](./facade.md): Facade — a simple interface over a complex subsystem.

## Behavioral

- [strategy.md](./strategy.md): Strategy — interchangeable algorithms behind a stable interface.
- [observer.md](./observer.md): Observer / Pub-Sub — one-to-many event notification.
- [command.md](./command.md): Command — encapsulate a request as an object.
- [state.md](./state.md): State — state-specific behavior via polymorphic state objects.
- [visitor.md](./visitor.md): Visitor — add operations to stable node types.

## Persistence / application

- [repository.md](./repository.md): Repository — abstract persistence behind a collection-like interface.
- [unit-of-work.md](./unit-of-work.md): Unit of Work — track changes and commit atomically.

For state machines in general (not just the State pattern), see [state-machine](skills/code-quality/references/programming-paradigms/state-machine.md).
