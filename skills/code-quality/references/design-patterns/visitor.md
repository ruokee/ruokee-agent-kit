# Visitor

The Visitor pattern separates operations from the object structure they operate on. It lets you define new operations over a fixed set of node types without modifying those types. Each node type implements an `accept(visitor)` method that calls the visitor's corresponding `visit_*` method, enabling double dispatch.

The pattern is most valuable when the set of types is stable but the set of operations changes frequently. It inverts the usual tradeoff: adding a new operation is easy (add a new Visitor class), but adding a new node type requires updating all existing Visitors.

## Structure

- Element (node type): declares `accept(visitor)`.
- ConcreteElement: implements `accept` by calling `visitor.visit_concrete_element(self)`.
- Visitor (interface): declares a `visit_*` method for each element type.
- ConcreteVisitor: implements each `visit_*` with operation-specific logic.

## When The Pattern Fits

- The node type hierarchy is stable. New types are rare.
- New operations over the structure are common.
- Operations need access to the concrete type without `isinstance` cascades.
- The operation logic should not pollute the data classes.
- Multiple independent traversal concerns exist (lint, transform, serialize, pretty-print).

## When The Pattern Does Not Fit

- Node types change frequently. Every new type forces updates to all Visitors.
- The structure is simple enough that a single recursive function or `match`/`case` suffices.
- Only one or two operations exist. The ceremony of accept/visit adds no clarity.
- The language supports pattern matching or `singledispatch`, making double dispatch unnecessary.
- Operations do not need the full concrete type; a common interface method is enough.

## Python Alternatives

Python offers lighter alternatives to the classic Visitor:

- **`match`/`case` with structural patterns**: works for tagged unions, dataclass hierarchies, or typed dicts. No accept method needed.
- **`functools.singledispatch`**: dispatches on the first argument's type. It fits single-argument operations over a closed type set.
- **Dictionary dispatch**: map type to handler function. Simplest form; no infrastructure.
- **Method on node**: if operations are few and stable, put behavior directly on nodes. No pattern needed.

The classic accept/visit double-dispatch Visitor is most justified when you want a protocol enforcing that every visitor handles every type, you need to accumulate state across the traversal in the visitor object, or the type hierarchy is in a library you don't control.

## Common Implementation Issues

**Traversal responsibility.** Who walks the tree; the visitor, the node's accept method, or an external iterator? Keep it consistent within a structure. Mixing strategies leads to nodes being visited twice or skipped.

**Return values.** Classic Visitor uses void visits with accumulated state. For functional traversals where each visit produces a value, consider returning values from visit methods rather than mutating the visitor.

**Default handling.** Provide a `visit_default` or `generic_visit` for unknown node types. Without it, adding a new node type silently skips its visit rather than raising. This is especially important in evolving trees.

**Composite children.** For tree structures, decide whether `accept` recurses into children automatically or requires explicit visitor logic. Auto-recursion is convenient but may hide traversal order; explicit traversal gives the visitor control over depth-first vs breadth-first and allows pruning.

## Relationship To Strategy

[Strategy](./strategy.md) varies the algorithm behind a stable call site. Visitor varies the operations over a stable type hierarchy. Strategy is per-call-site; Visitor is per-node-type-family. If you have one operation over many types, Visitor might be overkill; [Strategy](./strategy.md) or a plain function suffices.
