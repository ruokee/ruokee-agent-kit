---
name: code-quality
description: Use when evaluating or improving code quality, including maintainability, abstractions, design principles and patterns, refactoring, code smells, test design, and architecture.
metadata:
  version: "1.0.6"
---

# Code Quality

Use this Skill to judge whether code, tests, architecture, refactoring plans, and abstractions have reasonable structure, change boundaries, and maintenance cost.

## Entry Conditions

Activate this Skill for maintainability, design quality, test quality or test smells, abstraction boundaries, refactoring, code smells, programming-paradigm choice, design-pattern use, or design principles. Load reference leaves by signal, not all at once.

If the task does not explicitly require code-quality analysis, do not load any document under `references/`, even if this `SKILL.md` was loaded.

## Mode Selection

Three modes are available. Default to fast review.

- Fast review is the default for daily self-checks, small diffs, and PR review; read `./workflow/fast-review.md`.
- Full review applies when the user explicitly asks for a "full review", "architecture review", "systematic review", or "refactoring assessment"; read `./workflow/full-review.md`.
- Analysis applies when the user asks for discussion, brainstorming, design exploration, paradigm comparison, or mechanism analysis; read `./workflow/analysis.md`.

## Judgment Order

1. Identify the primary concern: correctness, readability, change cost, testability, performance, or delivery cost.
2. Decide whether the issue belongs to principles, patterns, refactoring, or paradigms.
3. Route to the relevant leaf document below.
4. Report only issues with sufficient evidence.

- When knowledge is duplicated or the abstraction is wrong, read [DRY](./references/design-principles/dry.md), often alongside the Rule of Three and duplicated code.
- When two similar cases tempt an abstraction, read [Rule of Three](./references/design-principles/rule-of-three.md), often alongside DRY and KISS.
- When complexity is unnecessary, read [KISS](./references/design-principles/kiss.md), often alongside YAGNI and deep modules.
- When an extension point or flexibility arrives before the need, read [YAGNI](./references/design-principles/yagni.md), often alongside KISS and deep modules.
- For responsibility, substitutability, interface size, and dependency direction, read [SOLID](./references/design-principles/solid.md), often alongside composition over inheritance and dependency inversion.
- For deciding where behavior belongs, read [GRASP](./references/design-principles/grasp.md), often alongside Tell Don't Ask and feature envy.
- When code walks message chains and knows distant object structure, read [Law of Demeter](./references/design-principles/law-of-demeter.md), often alongside deep modules and facade.
- When callers query fields and then make domain decisions, read [Tell Don't Ask](./references/design-principles/tell-dont-ask.md), often alongside GRASP and feature envy.
- When choosing between inheritance and composition, or handling mixins and subclassing, read [Composition over Inheritance](./references/design-principles/composition-over-inheritance.md), often alongside SOLID and dependency inversion.
- For dependency inversion, DI, and the composition root, read [Dependency Inversion](./references/design-principles/dependency-inversion.md), often alongside adapter, repository, and unit of work.
- When practicing TDD, Red-Green-Refactor, or behavior-first tests, read [TDD](./references/design-principles/tdd.md), often alongside safe refactoring.
- For test design, test smells, fragile or flaky tests, over-mocking, coverage strategy, or fewer stronger tests, read [Testing Principles](./references/testing/principles.md), often alongside test smells and TDD.
- When tests break on refactoring, act as change detectors, are obscure or duplicated, or test config and utilities, read [Test Smells](./references/testing/test-smells.md), often alongside testing principles and code smells.
- For domain-driven design, bounded contexts, and domain modeling, read [DDD](./references/design-principles/ddd.md), often alongside deep modules and repository.
- For abstraction depth, information hiding, and shallow modules, read [Deep Modules](./references/design-principles/deep-modules.md), often alongside KISS and facade.
- When object creation varies by type, configuration, or environment, read [Factory](./references/design-patterns/factory.md), often alongside abstract factory and builder.
- When a matched family of products varies together, read [Abstract Factory](./references/design-patterns/abstract-factory.md), often alongside factory and builder.
- For complex staged construction, read [Builder](./references/design-patterns/builder.md), often alongside factory and abstract factory.
- When an algorithm or behavior varies behind a stable call site, read [Strategy](./references/design-patterns/strategy.md), often alongside factory and functional core.
- When one event notifies multiple subscribers, read [Observer](./references/design-patterns/observer.md), often alongside event-driven and command.
- When a foreign interface needs translation, read [Adapter](./references/design-patterns/adapter.md), often alongside facade and dependency inversion.
- When cross-cutting behavior wraps calls or objects, read [Decorator](./references/design-patterns/decorator.md), often alongside facade and thin wrapper function.
- For a simple surface over a complex subsystem, read [Facade](./references/design-patterns/facade.md), often alongside deep modules and adapter.
- When requests are queued, retried, audited, undone, or scheduled, read [Command](./references/design-patterns/command.md), often alongside state and observer.
- For state-specific behavior and the GoF State pattern, read [State](./references/design-patterns/state.md), often alongside state machine and command.
- When operations vary over stable node types such as an AST, tree, or schema, read [Visitor](./references/design-patterns/visitor.md), often alongside strategy.
- For persistence boundaries and ORM isolation, read [Repository](./references/design-patterns/repository.md), often alongside unit of work and dependency inversion.
- For transactions and consistency across repositories, read [Unit of Work](./references/design-patterns/unit-of-work.md), often alongside repository and dependency inversion.
- For behavior-preserving refactoring in the Fowler style, read [Fowler Refactoring](./references/refactoring/fowler-refactoring.md), often alongside safe refactoring and code smells.
- For general smell triage and the smell map, read [Code Smells](./references/refactoring/code-smells.md), often alongside the specific refactoring leaves.
- For a safe, behavior-preserving refactoring flow, read [Safe Refactoring](./references/refactoring/safe-refactoring.md), often alongside Fowler refactoring and TDD.
- When a function mixes phases, policy, I/O, and branching, read [Long Function](./references/refactoring/long-function.md), often alongside extract function and duplicated code.
- When a rule, mapping, schema, or piece of knowledge is copied, read [Duplicated Code](./references/refactoring/duplicated-code.md), often alongside DRY and extract function.
- When strings, dicts, or primitives carry stable domain meaning, read [Primitive Obsession](./references/refactoring/primitive-obsession.md), often alongside DDD and data-oriented.
- When a function envies another object's or module's data, read [Feature Envy](./references/refactoring/feature-envy.md), often alongside move function and GRASP.
- When one change requires scattered edits, read [Shotgun Surgery](./references/refactoring/shotgun-surgery.md), often alongside divergent change and move function.
- When one module changes for many unrelated reasons, read [Divergent Change](./references/refactoring/divergent-change.md), often alongside shotgun surgery.
- When a helper or wrapper adds no semantic boundary, read [Thin Wrapper Function](./references/refactoring/thin-wrapper-function.md), often alongside KISS and facade.
- To extract a coherent phase into a function, read [Extract Function](./references/refactoring/extract-function.md), often alongside long function and inline function.
- To inline a misleading or shallow function, read [Inline Function](./references/refactoring/inline-function.md), often alongside extract function.
- To move behavior to a better owner, read [Move Function](./references/refactoring/move-function.md), often alongside feature envy and GRASP.
- For direct steps, scripts, handlers, and orchestration, read [Imperative](./references/programming-paradigms/imperative.md), often alongside declarative.
- For configuration, schemas, tables, and declarations, read [Declarative](./references/programming-paradigms/declarative.md), often alongside imperative.
- For object identity, state, invariants, and polymorphism, read [Object-Oriented](./references/programming-paradigms/object-oriented.md), often alongside composition over inheritance and SOLID.
- To separate pure logic from a side-effect shell, read [Functional Core](./references/programming-paradigms/functional-core.md), often alongside strategy and declarative.
- For explicit data shapes, mappings, schemas, and tables, read [Data-Oriented](./references/programming-paradigms/data-oriented.md), often alongside primitive obsession and declarative.
- For events, hooks, event buses, pub/sub, and domain events, read [Event-Driven](./references/programming-paradigms/event-driven.md), often alongside observer and command.
- For state, status, event, and transition workflows, read [State Machine](./references/programming-paradigms/state-machine.md), often alongside state and resource lifecycle.
- For resource acquisition, ownership, and cleanup, read [Resource Lifecycle](./references/programming-paradigms/resource-lifecycle.md), often alongside state machine and unit of work.
- For async tasks, cancellation, timeouts, and backpressure, read [Async/Concurrency](./references/programming-paradigms/async-concurrency.md), often alongside event-driven and resource lifecycle.

When terminology is unclear or inconsistent, read the [glossary](./glossary.md).

## Output Contract

Lead with findings. Principles are not mechanical rules; explain tradeoffs. Patterns are not default templates; prove the variation point exists first. Separate facts, inferences, judgments, and recommendations. Do not repeat issues a formatter or linter catches mechanically.

Output format is mode-specific. Follow the matching workflow document (`./workflow/fast-review.md`, `./workflow/full-review.md`, or `./workflow/analysis.md`). Analysis mode gives tradeoffs and options, not a findings list.

Write output in the language required by global, project, or user instructions; when none is specified, use the current conversation's language.

## Stop Rules

- Do not force findings to satisfy a principle.
- Do not abstract merely because code looks similar.
- Do not treat similar code as duplicate knowledge without proving shared intent.
- Do not automatically apply refactors, patches, unsafe fixes, or bulk suppressions.
- Read-only and analysis tasks leave reviewed files unchanged. Existing authorization to maintain reports or Task materials still applies.
- Do not report issues that a formatter or linter can catch mechanically. Note them once if relevant, then move on.
