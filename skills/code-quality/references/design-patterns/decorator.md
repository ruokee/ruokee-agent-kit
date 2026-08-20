# Decorator Pattern

This document covers the Gang of Four *structural* Decorator pattern: wrapping an object to add behavior. It is not about Python's `@decorator` syntax, though the two are related and that relationship is discussed below.

## Intent

Attach additional responsibilities to an object dynamically by wrapping it in another object that shares the same interface. Decorators provide a flexible alternative to subclassing for extending behavior, and they can be composed and stacked at runtime.

## Problem it solves

You have a component and several optional, independent behaviors you might add to it: buffering, compression, encryption, metrics, retries. Subclassing every combination explodes: `BufferedCompressedStream`, `BufferedEncryptedStream`, and so on. Decorator lets each behavior be its own wrapper that conforms to the component's interface and delegates to the wrapped object. You compose the behaviors you want at runtime by nesting wrappers, in whatever order and combination the situation needs.

## Structure and participants

- **Component**: the interface shared by raw objects and their decorators.
- **Concrete component**: the base object being decorated.
- **Decorator**: holds a Component, implements Component, and delegates to the wrapped object, adding behavior before or after delegation.
- **Concrete decorators**: each adds one responsibility.

Because every decorator implements the same Component interface and holds a Component, decorators and base objects are interchangeable and can nest arbitrarily. `Compress(Encrypt(FileStream(path)))` is itself a `Component`.

## Python-idiomatic implementation

When the "component" is a function or callable, Python's `@decorator` syntax expresses the pattern directly and is the idiomatic choice:

```python
def with_metrics(handler: Handler) -> Handler:
    @functools.wraps(handler)
    async def wrapped(request: Request) -> Response:
        with timer("handler.duration"):
            return await handler(request)
    return wrapped
```

`functools.wraps` preserves the wrapped callable's name, docstring, and signature metadata: omitting it breaks introspection and tooling.

The full *object* form is worth writing when you wrap a stateful object with many methods and want to compose behaviors at runtime:

```python
class Stream(Protocol):
    def read(self, n: int) -> bytes: ...
    def write(self, data: bytes) -> int: ...


class CompressingStream:
    def __init__(self, inner: Stream) -> None:
        self._inner = inner

    def read(self, n: int) -> bytes:
        return decompress(self._inner.read(n))

    def write(self, data: bytes) -> int:
        return self._inner.write(compress(data))
```

For wrapping objects with large interfaces where you only modify a few methods, `__getattr__` can forward the rest to the inner object: powerful but magical, so use it sparingly and document it.

## When to use

- You need to compose independent behaviors at runtime, in varying combinations or order.
- The behaviors are cross-cutting and stable: logging, caching, retry, auth, validation, metrics, transaction boundaries.
- Subclassing for every combination would explode the class count.

## When NOT to use

- There is one fixed behavior to add and no runtime composition; a plain `@decorator` function, or just inlining the behavior, is simpler than an object-decorator hierarchy.
- The added behavior needs resource lifecycle (acquire/release). A context manager expresses setup and teardown far more clearly than a decorator.
- You are reaching for decorators to add real business logic. Decorators should stay thin; business rules belong in the component.

## Failure modes

- **Hidden control flow**: stacked decorators obscure the order of execution, where exceptions are caught, and where time is spent. Deep stacks become hard to debug.
- **Lost metadata**: forgetting `functools.wraps` breaks `__name__`, docstrings, and signatures.
- **Behavior drift**: a decorator that subtly changes the component's contract (return types, raised errors) so wrapped and unwrapped objects are no longer substitutable.
- **Performance surprise**: each layer adds a call frame and possibly I/O; a metrics-plus-retry-plus-cache stack can cost more than the operation.

## Relationship to other patterns

[adapter.md](./adapter.md) changes an interface. Decorator keeps the same interface and adds behavior. Proxy also wraps with the same interface but controls *access* such as lazy loading or permissions rather than enriching behavior. The structures are nearly identical and differ in intent. Chained decorators resemble a pipeline; for sequential request handling, see Chain of Responsibility. When the behavior is resource lifecycle, prefer a context manager over a decorator.
