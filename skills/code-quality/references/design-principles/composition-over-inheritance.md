# Composition over Inheritance

Favor assembling behavior from smaller parts — objects, functions, delegation — over inheriting
implementation from a base class. The guidance is "favor", not "forbid": inheritance has real
uses, but it is overused as a default reuse mechanism, and composition is usually the more
flexible and lower-coupling choice.

## Why inheritance creates coupling

Class inheritance bundles two things that are logically separate: *implementation reuse* (the
subclass gets the base class's code) and *subtype substitutability* (instances of the subclass
are expected to work wherever the base type is expected — see
[Liskov substitution](./solid.md)). When you inherit only to reuse code, you also inherit the
obligation to honor the base contract, plus exposure to every change in the base class.

This produces the *fragile base class* problem: a change to a base class can break subclasses
in ways that are hard to see, because subclasses depend on the base class's internal behavior,
not just its public interface. Deep hierarchies amplify this — behavior is smeared across
several levels, and understanding one class means reading all its ancestors.

Composition couples more loosely. An object that holds a collaborator depends only on that
collaborator's interface, and it can swap the collaborator without changing its own type. The
change radius of a composed design is smaller and more local.

## When inheritance IS appropriate

- **Genuine is-a with a stable contract.** When the subtype truly is a specialization of the
  base and can honor every base promise (Liskov), inheritance models the relationship
  faithfully. Exception hierarchies are a clean example: `class TimeoutError(NetworkError)`
  expresses a real classification used by `except` clauses.
- **Framework extension points.** Many frameworks are designed to be extended by subclassing a
  provided base (a Django view, a `unittest.TestCase`). Here inheritance is the framework's
  designated hook, and fighting it adds friction for no gain.
- **A small, stable abstract interface.** Inheriting from an abstract base that defines a
  narrow contract (and little or no implementation) is closer to interface implementation than
  to implementation inheritance, and carries less coupling.

The common thread: inherit when you want substitutability and the contract is stable, not when
you merely want to reuse a few methods.

## Python's mixin culture and its risks

Python supports multiple inheritance, and mixins are a common idiom: small classes that add a
slice of behavior to a host class. Used well — small, stateless, clearly named, depending only
on a documented interface of the host — they are reasonable. Used poorly they cause real
trouble:

- **Implicit state and initialization order.** A mixin that sets attributes or expects
  `super().__init__()` to be called in a particular order couples invisibly to the host and to
  other mixins. The method resolution order (MRO) determines what runs when, and a multi-mixin
  class can be hard to reason about.
- **Name collisions.** Several mixins defining or expecting the same attribute or method name
  interact in subtle ways through the MRO.

Keep mixins small, stateless, and named for what they add. If a mixin needs significant state
or a specific init sequence, that is a signal to use composition instead.

## Protocol as an alternative to ABC inheritance

When the goal is "this object must support these methods", Python's `typing.Protocol` lets you
express that structurally without an inheritance relationship. A class satisfies a Protocol by
having the right methods; it does not need to inherit from it. This gives you the type-checking
benefit of an interface and the [Interface Segregation](./solid.md) benefit of narrow,
caller-defined contracts, with none of the coupling of a shared base class. Prefer Protocol over
abstract base class inheritance when you only need to describe a capability, not share
implementation. See also [dependency-inversion](./dependency-inversion.md).

## Common mistakes

- **Banning inheritance outright.** Reaching for composition when a framework expects
  subclassing, or when there is a genuine stable is-a relationship, adds boilerplate and fights
  the grain of the tools.
- **Pass-through boilerplate.** Composition can degenerate into an object that forwards a dozen
  methods to a held collaborator. If almost every method is a one-line delegation, reconsider:
  maybe the wrapper earns its keep by narrowing or adapting the interface, or maybe the caller
  should hold the collaborator directly.
- **Faking subtypes for reuse.** Inheriting to grab a couple of helper methods, then overriding
  others to no-ops or `NotImplementedError`, violates Liskov and is the classic sign that
  composition (or a plain helper function) was the right tool.

## In Python

- Default to functions, constructor parameters, Protocols, strategy objects, and delegation for
  reuse and variation.
- Reserve inheritance for exception hierarchies, framework hooks, genuinely stable abstractions,
  and a few small, clear mixins.
- For shared code, prefer a module-level helper function or a composed collaborator over a base
  class whose only purpose is to hold the shared method.
