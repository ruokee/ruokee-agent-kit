# Selection Principles

The unified decision framework for technology selection: whether to introduce, which stage you are in, where it dies first, whether the team can sustain it, and whether you can exit. Use for any "should we adopt X" judgment; it is the overview of the other seven documents in this directory.

## The root node is not A versus B

The first question of selection is never "PostgreSQL or MongoDB", "REST or gRPC", "PaaS or K8s", but: **do we actually need to introduce new technology?**

If the existing stack can solve the problem within the target performance, cost, reliability, and delivery window, default to keeping it. Any new technology brings learning cost, integration cost, operations cost, and future migration cost. This is the same restraint as "monolith unless you must not", "workflow unless you must not", "managed API before self-built GPUs". Read selection as: **paying a definite cost for a definite problem.**

## First cut on the project stage

The same system has completely different answers at different stages:

- At MVP, the main contradiction is validation speed. Use as few components as possible, choose a mainstream stack, prefer managed services, and do not worry about migration cost yet.
- During growth, the main contradiction is controllable growth. Add observability and gradual rollout first, draw boundaries, and scale locally.
- At scale, the main contradiction is efficiency and cost. Only now is deep per-unit-cost optimization and platformization worth it.
- At the critical stage, the main contradiction is stability and compliance. Audit, isolation, disaster recovery, SLOs, and incident process become hard requirements.

A technology that is the right answer at maturity may be over-engineering at MVP. Validating demand: fewest components; sustaining growth: controllability; optimizing at scale: only then is complexity worth paying for unit cost and deep customization.

## Second cut on where the system dies first

Once the existing stack is confirmed insufficient, do not reach for a tool immediately—locate the failure mode first:

- When data corrupts and states disagree everywhere, check whether the data model matches transaction boundaries, whether idempotency and Outbox are in place, and whether reconciliation backstops them.
- When concentrated read traffic burns the primary store, evaluate a cache tier, read-model isolation, CDN offload, and ingress rate limiting.
- When instantaneous write floods crush the backend, introduce queue buffering, backpressure propagation, peak shaving, and asynchronization of non-critical paths.
- When deep call chains amplify tail latency, examine API boundary division, per-layer timeout budgets, degradation means, and trace-based localization.
- When every release is a heart-stopper, build deployment-platform capability, gradual rollout, fast rollback, and config governance.
- When incidents take half a day to diagnose, check metrics, logging, and tracing coverage, and whether SLO alerts point at the responsible party.
- When AI output quality degrades quietly, build eval baselines, trace observation, RAG retrieval evaluation, and model-routing fallbacks.
- When teams constantly wait on and block each other, draw module boundaries, evaluate platform-engineering investment, and sort out service ownership.

**Tools are only the shell of the answer; the failure mode is the actual question of selection.**

## Third cut on what the team can sustain

Many technologies look great in benchmarks but the team may not afford the upkeep: can they deploy it? Debug it? Is there monitoring? Who fixes it at 3 a.m.? Will version upgrades explode? Are there enough people who understand it?

A "higher-performing system nobody can repair" routinely loses in production to a "sufficient-performance system the team knows well". Selection is not a lab contest; it is a long-term operations contract. Leave operability and key-person risk out of the judgment, and what you selected is not a technology but a future incident.

## Fourth cut on the exit plan

A mature selection always has an exit plan: how is the new database's data migrated, how is dual-write verified, rolled back to where? Can the model vendor's API be adapted; can prompts and evals be reused? Is business logic swallowed by the framework; can it be layered away? How do a message system's topics/schemas/consumer offsets migrate? Can the cloud platform's images, configs, secrets, storage, and networks be moved out?

A selection without an exit route ties the future down. Before an important technology enters production, at minimum have a spike, a gradual-rollout plan, a rollback plan, and a decision record.

## The unified decision tree

Should we introduce a new technology?

1. The existing stack meets the targets → keep it, with local optimization.
2. It cannot, but we are at MVP → fewest components, fastest validation, low migration cost.
3. What is the failure mode? Data/consistency → storage and transaction boundaries first; latency/throughput → caching, batching, scaling approach first; availability/failure → redundancy, degradation, isolation first; AI quality → eval, RAG, model routing first; team collaboration → module boundaries and platform capability first.
4. Can the team sustain the candidates, and can you exit? No → pick something lighter. Yes → spike to verify → write the decision record → adopt gradually.

## What a selection decision record needs

The record's point is not format but writing "why chosen" and "how to retreat if wrong" clearly: context (current state and pain, ideally with numbers), goal (the failure mode to solve), candidates (at least two, each with its cost), choice and what was given up (what was gained, what was paid), re-review conditions (which signals trigger re-evaluation), exit plan (how to move it out).

## The question to ask first in each domain

- For language and framework, do not start with which is more advanced. Ask whether the team, ecosystem, runtime, and business complexity match.
- For databases and storage, do not start with which database is strongest. Ask who owns the source of truth and what the query shape is.
- For caches, queues, and events, do not start with whether to adopt Kafka. Ask whether the problem is a read hotspot, a time mismatch, or broadcasting a business fact.
- For APIs and communication, do not start with REST or gRPC. Ask whether the call is sync or async, internal or external, and how strong the contract must be.
- For the deployment platform, do not start with whether to adopt K8s. Ask whether the team needs platform capability and can sustain it.
- For observability and reliability, do not start with which monitoring tool. Ask what the user SLO is and how incidents end.
- For AI infrastructure, do not start with whether to self-host GPUs. Ask whether the scarce resource is the model, context, cost, quality, or controllability.

## Relationship to other documents

- The general writing of decision records (ADRs) is in [Architecture decisions](../07-architecture-decisions.md).
- Stage-judgment signals are in [Evolution](../12-evolution.md).
- The other seven documents in this directory expand each domain: [Languages](./02-languages.md), [Data stores](./03-data-stores.md), [Messaging](./04-messaging.md), [Communication](./05-communication.md), [Deployment](./06-deployment.md), [Observability](./07-observability.md), [AI infrastructure](./08-ai-infrastructure.md).
