# Communication

Boundary judgment for inter-service communication: sync/async/streaming, internal/external, contract strength—and only then REST/gRPC/GraphQL/Webhook. Use for designing service boundaries, public APIs, and third-party integration.

## The communication style decides the coupling style

The same "order notifies inventory to deduct" can be a synchronous REST call, a synchronous gRPC call, a published event consumed asynchronously, a GraphQL on-demand query, or a Webhook callback. All work, but the coupling differs completely: synchronous calls give clear results, but the caller can be slowed or dragged to death by the callee; async events decouple, but results are not immediately known and consistency gets more complex; GraphQL gives client flexibility, but server-side governance and performance get harder; Webhooks fit external notification, but retry, signing, and idempotency are mandatory.

**Fix the interaction semantics first, then the protocol.** Do not start with "we will use gRPC"; first judge whether this path must know the result synchronously.

## Interaction style tradeoffs

- Synchronous request/response fits when the caller waits for the result on the spot, needs immediate validation, or must learn of failure at once. Every extra hop stacks tail latency, and any dependency's failure propagates down the chain.
- Asynchronous messaging or events fit when completion may lag, peaks need shaving, or one datum feeds multiple downstreams. They complicate state progression and demand idempotency, compensation, and backlog governance.
- Streaming fits output while generating, real-time state refresh, and long-task progress. It must handle connection keepalive, backpressure, and resume after disconnect.

Rules of thumb: the user must know immediately whether to proceed → sync; only needs to know it was accepted → async; needs to see change continuously → streaming.

## Every protocol has its niche

- REST suits public APIs, ordinary web and SaaS work, easy debugging, and a universal ecosystem. Avoid it for high-frequency internal calls or where a strictly typed contract is essential.
- gRPC suits internal service-to-service calls with low latency, high throughput, and a strong IDL. It is a poor fit for direct browser access and public APIs.
- GraphQL suits multi-client aggregated queries, frequently changing fields, and frontends that need flexible composition. Avoid it for complex writes, and for teams weak in caching, permission, and rate-limit governance.
- Webhooks suit third-party event notification, payment callbacks, and external integration. They are wrong for core paths that need a synchronous, strong result.
- MCP suits exposing tools, resources, and context to AI agents. It does not fit ordinary business service communication without agent semantics.

Public APIs favor understandable, stable, versionable; internal high-frequency calls favor strong contracts and performance; multi-client frontend aggregation considers GraphQL but demands governance capability; third-party callbacks must handle signing, idempotency, and replay attacks; agent tool interfaces must write permissions and human review into the protocol boundary.

## The contract matters more than the protocol

An API's biggest risk is not HTTP versus protobuf but an **unclear contract**: inputs and outputs (field meanings, required/optional, units, enums), error semantics (which are retryable? which are user errors? which are system errors?), idempotency (what happens replaying one request twice? where is the idempotency key?), versioning policy (how are fields added/deprecated? how long are old clients supported?), rate limits and quotas (who may call how much? what returns on excess?), security boundary (authentication, authorization, signing, audit).

Without contract governance, REST becomes messy URLs, GraphQL becomes arbitrary database exposure, and gRPC becomes a strongly typed ball of mud.

## Do not let internal call chains grow unbounded

The most common microservice performance problem is not one slow service but call-chain fan-out: user request → A → B/C → D/E/F/G. Each extra hop adds network latency, timeout and retry-storm risk, dependency-failure propagation, and trace-debugging cost.

Internal APIs need three companions: **timeout budgets** (upstream 500ms does not mean giving every downstream 500ms); **retry discipline** (retry only idempotent requests, with backoff and jitter); **degradation strategy** (return partial results or fallbacks when non-critical dependencies fail).

## Stability beats elegance in external APIs

A public API is a promise the moment it ships: backward compatibility (adding fields is usually safe; removing or changing meaning is dangerous); stable error codes (customers write logic against your error semantics); docs and examples (if external developers cannot understand it, elegance is worthless); signing and replay defense (especially payments, Webhooks, agent tool calls); audit and rate limiting (traceable when things break, containable when abused).

For platform products, the API is not an implementation detail—it is part of the product, and its versioning and compatibility policy is an architecture boundary.

## Relationship to other documents

- The full engineering of retry discipline, timeout budgets, and degradation is in [Resilience](../10-resilience.md).
- The semantic distinction of async events and command/event is in [Messaging](./04-messaging.md).
- The permission and human-review boundary of agent tool interfaces is in [Specifications for AI](../ai/03-specifications-for-ai.md).
- The unified selection decision tree is in [Selection principles](./01-principles.md).
