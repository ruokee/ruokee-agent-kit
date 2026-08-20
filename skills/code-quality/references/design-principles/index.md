# Design Principles

Reference documents for the design principles and engineering judgment frameworks used during code quality review. These are not mechanical rules. Most of them exist to manage complexity, control change, protect behavior, and improve readability. Treat them as a shared vocabulary for reasoning about tradeoffs, and resolve tensions between them with the context of the actual problem.

Each document explains what the principle is, the assumption it rests on, when it applies, when it does not, the common ways it is misused, and how it translates into Python rather than Java or C++ ceremony. Where principles interact or conflict, the relevant documents say so in prose.

Route to the document that matches the signal you are seeing in the code.

| Signal | Read |
|-|-|
| Duplicated knowledge, one rule expressed in many places, wrong abstraction | [dry.md](./dry.md) |
| Two similar cases, unsure whether to abstract yet | [rule-of-three.md](./rule-of-three.md) |
| Unnecessary complexity, too many concepts to hold in mind | [kiss.md](./kiss.md) |
| Speculative feature, extension point with no proven need | [yagni.md](./yagni.md) |
| Responsibility, substitutability, interface width, dependency direction | [solid.md](./solid.md) |
| Where should this behavior live, who owns this responsibility | [grasp.md](./grasp.md) |
| Train-wreck chains, caller reaching through distant object structure | [law-of-demeter.md](./law-of-demeter.md) |
| Caller pulls fields out then decides externally | [tell-dont-ask.md](./tell-dont-ask.md) |
| Inheritance vs composition, mixins, subclassing for reuse | [composition-over-inheritance.md](./composition-over-inheritance.md) |
| High-level logic coupled to I/O, time, randomness, external services | [dependency-inversion.md](./dependency-inversion.md) |
| Test-first, Red-Green-Refactor, behavior specification | [tdd.md](./tdd.md) |
| Complex business domain, ubiquitous language, bounded contexts | [ddd.md](./ddd.md) |
| Abstraction depth, information hiding, shallow modules, interface design | [deep-modules.md](./deep-modules.md) |

For SOLID's dependency-direction principle there are two views: [solid.md](./solid.md) covers it as one of the five, and [dependency-inversion.md](./dependency-inversion.md) goes deeper on DIP and dependency injection in Python. Read both when wiring up external dependencies.

Concrete design patterns (Factory, Strategy, Observer, Adapter, and so on) live under `skills/code-quality/references/design-patterns`. This directory is about when to abstract, when to wait, where responsibility belongs, and how to keep change cheap, not about specific named structures.
