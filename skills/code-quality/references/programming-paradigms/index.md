# Programming Paradigms

Reference documents for the programming paradigms and execution models that show up during code quality review. Python is a multi-paradigm language: functions, modules, objects, types, protocols, resource lifecycles, and async tasks are all composable tools. The point of these documents is to help you judge which paradigm fits a given problem, not to enforce a single house style.

A common failure mode — especially in agent-generated code — is to pick a paradigm first and then force the problem into it: everything becomes a class, or everything becomes a chain of higher-order functions, or every workflow becomes an implicit tangle of boolean flags. The better move is to read the shape of the problem and reach for the paradigm whose default assumptions match it.

Each document explains what the paradigm is, the assumption it rests on, when it fits, when it does not, the common ways it is misused, and how it translates into idiomatic Python. Where paradigms interact, the relevant documents say so in prose.

Route to the document that matches what you are looking at.

| Signal | Read |
|-|-|
| Step-by-step state mutation, scripts, orchestration, entry points | [imperative.md](./imperative.md) |
| Describing what not how — config, schema, routing, rule tables | [declarative.md](./declarative.md) |
| Long-lived stateful entities, polymorphism, framework extension | [object-oriented.md](./object-oriented.md) |
| Hard-to-test logic mixed with I/O, time, randomness, external calls | [functional-core.md](./functional-core.md) |
| Data shapes drive structure — ETL, APIs, batch, typed records | [data-oriented.md](./data-oriented.md) |
| Decoupling producers from consumers, hooks, signals, message queues | [event-driven.md](./event-driven.md) |
| Finite named states, named events, invalid transitions matter | [state-machine.md](./state-machine.md) |
| Who creates and who closes — files, locks, connections, pools | [resource-lifecycle.md](./resource-lifecycle.md) |
| Concurrent I/O, task groups, cancellation, backpressure | [async-concurrency.md](./async-concurrency.md) |

Design principles (DRY, SOLID, KISS, and so on) live under `skills/code-quality/references/design-principles`, and named structural patterns (Factory, Strategy, Observer) live under `skills/code-quality/references/design-patterns`. This directory is about the underlying execution model and where state, decisions, and side effects belong, not about specific named structures.

These paradigms are not mutually exclusive. A realistic service combines an imperative shell, a functional or data-oriented core, a state machine for lifecycle, declarative config, and structured async for I/O. Reading the right paradigm means matching each part of the system to the model that makes it cheapest to reason about.
