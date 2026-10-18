# Languages

Selection judgment across three layers—language, runtime, framework—using five rulers: business complexity, performance, ecosystem, team, evolution. Use for choosing a stack for a new project and evaluating a language/framework switch.

## The three layers

Novices conflate the three. The language decides expression, type system, and ecosystem entry; architecturally, watch team familiarity, long-term maintenance, and whether errors surface early. The runtime decides concurrency model, memory, startup speed, and deployment shape; watch latency, throughput, resource cost, cold start. The framework decides conventions, component composition, and development cadence; watch delivery speed, testability, plugin ecosystem, and team consistency.

Asking only "Java or Go" is not a complete question. The complete question: given this team, this business, and these quality targets, what **run-and-deliver model** is needed?

The standard: a language/framework choice that measurably affects quality attributes is an architecture decision; if it only differs in code style, do not escalate it into an architecture war. Choosing a language is not a vote—"I like Go" and "Java hires are easy" are clues, not decisions. Keep asking: what is this business path's bottleneck? Does the team lack delivery speed, runtime efficiency, stability, or hiring availability most? Does the ecosystem have mature libraries, debugging tools, monitoring options? Three years on, can a newcomer read, change, and ship it?

## The five rulers

- Business complexity: ask whether there are many rules, much state, and many permissions; if so, lean toward a strong type system, strong engineering conventions, and a mature test ecosystem.
- Performance and resources: ask whether CPU, memory, and P99 tail latency are core; if so, lean toward low runtime overhead and a clear concurrency model.
- Ecosystem maturity: ask whether payments, auth, ORM, messaging, and monitoring have ready-made answers; if so, lean toward a deep ecosystem, rich docs, and a stable community.
- Team capability: ask what the team knows and whether hiring is easy; lean toward the team's primary language, or a new language with manageable learning cost.
- Delivery and evolution: ask whether the need is rapid iteration or long-term high reliability; lean toward clear framework conventions and an explicit migration path.

Do not switch stacks just because a language looks more advanced. Only when the new technology clearly buys a quality attribute and you are willing to pay the learning, operations, hiring, and migration costs does it merit candidacy.

## Tradeoffs of common backend languages

Not a ranking—a lens for forming judgment:

- Java/Kotlin on the JVM brings a mature ecosystem, enterprise libraries, and stable performance. It costs heavy projects, slow startup, and high framework complexity, and fits mid-to-large business systems, finance, e-commerce, and SaaS backends.
- Go deploys simply, has a direct concurrency model, and uses little memory. Its engineering-abstraction baggage is comparatively heavy. It fits gateways, infrastructure, microservices, and real-time paths.
- Python has a strong AI and data ecosystem and prototypes fast. Watch runtime performance and the concurrency model. It fits AI services, data platforms, and low-QPS backends.
- TypeScript/Node.js uses one language across frontend and backend and handles I/O concurrency well. It is unsuitable for CPU-heavy work. It fits BFFs, small-to-mid SaaS, and light real-time services.
- Rust delivers strong performance and memory safety, at the cost of a steep learning curve and slower delivery. It fits storage, proxies, engines, and performance-sensitive components.

A system need not use one language: main business services in Java/Go/TS; AI inference and data processing in Python; high-performance proxies or storage engines in Rust/Go; frontend and BFF in TypeScript. But polyglot brings a **cognitive tax**: builds, deploys, monitoring, debugging, hiring, and code review all multiply. A small team picking "the most fitting language" per module and introducing five stacks is usually overdrawing organizational capacity ahead of schedule.

## Default to mature frameworks without clear evidence against

A framework is essentially a set of conventions for the team: it provides routing, dependency injection, configuration, data access, auth, testing, and observability hooks; in return, it reduces freedom, adds learning and upgrade costs, and can make debugging less transparent. At MVP, prioritize lowering delivery risk; for long-term multi-person maintenance, prioritize lowering collaboration risk. Very often, a mature and slightly clumsy framework beats a cool, lightweight one that runs on team discipline alone.

First-round filter: many newcomers, long-term multi-person maintenance → convention-strong, well-documented, mature-ecosystem frameworks; extremely fast trial-and-error, unsettled business → lightweight frameworks plus clear module boundaries; heavy enterprise integration, transactions, permissions → mature enterprise frameworks; high-concurrency gateways → frameworks with low runtime overhead; AI/data-heavy services → near the Python ecosystem, wrapped in a stable API shell.

## When to switch stacks

Do not switch because it looks old; switching is driven by trigger signals: P99 persistently over SLO with the bottleneck in the runtime (not a code-style problem—a model mismatch; carve the hot path into a better-fitting runtime); team delivery slowing with framework conventions in the way (modularize first, migrate locally); ecosystem gaps forcing mass in-house building (move to a more mature stack); hiring and code review struggling (converge languages); security and compliance rising (upgrade critical components alone).

Switch stacks the way you split a monolith: no big-bang rewrite—draw boundaries first, run in parallel, shadow traffic, switch gradually.

## How to write the selection conclusion

In the decision record, do not write merely "we chose Go because Go is fast"; write why only the ingress layer was carved out and what cost was accepted: context (the checkout ingress is an I/O-heavy path with a 200ms P99 target; the team already runs Go), choice (ingress in Go; the business state machine stays in the Java order service), what was given up (single-language-repo simplicity; one more build pipeline), what was gained (lightweight ingress deployment; independent scaling and rate limiting), re-review conditions (if the ingress logic grows into complex business orchestration, or the team loses Go maintenance capacity, pull it back into the main stack).

## Relationship to other documents

- The unified selection decision tree is in [Selection principles](./01-principles.md).
- The gradual-migration techniques of stack switching (parallel run, shadow traffic) are in [Evolution](../12-evolution.md).
- The cognitive tax of polyglot and organizational capacity are in [Organization](../13-organization.md).
