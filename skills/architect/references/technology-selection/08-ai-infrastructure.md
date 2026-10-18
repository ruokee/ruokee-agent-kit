# AI Infrastructure

The five-layer decomposition of the AI stack and its upgrade signals: managed APIs as the default start, gateways, RAG/vector stores, self-hosted inference, training and fine-tuning, and the gatekeeping layer. Use for infrastructure selection in LLM-bearing systems.

## What you actually self host

Hearing "AI infrastructure" one thinks of GPUs, vector stores, agent frameworks, model gateways, inference engines, training and fine-tuning, evaluation platforms. But step one is not listing components; it is asking: **are you actually building infrastructure, or just making an AI application?**

For an early product at MVP, the most sensible default is to call managed model APIs, add minimal logging and cost monitoring, and get the business loop running first. Only on clear trigger signals—runaway cost, data that must not leave the domain, missed latency targets, unacceptable vendor single-point risk, deep model customization needs—does sinking down to gateways, self-hosted inference, or GPU pools become worthwhile.

AI infrastructure is not "deeper is more advanced". The deeper you go, the more control you take back and the bigger the bill you accept: cost, capacity planning, failure recovery, security isolation, team operations capability.

## The five layers

| Layer | Components |
| --- | --- |
| Ingress governance | Model gateway, auth, rate limiting, cost accounting, model routing |
| Context | RAG, vector store, document permissions, rerank, citations |
| Inference | Inference serving, GPUs, KV cache, batching |
| Training and fine-tuning | Data versioning, job orchestration, checkpoints, experiment tracking, validation and promotion |
| Gatekeeping | Observability, eval, trace, human approval |

Not all five layers exist from day one. The correct order: **see the risk that cannot be skipped first, then add the layer that answers it**: cannot see cost—add the gateway or usage logging first; retrieval quality caps the answers—add RAG eval first; multiple teams calling models—add the unified gateway; GPU cost exceeding API cost—consider self-hosted inference; a genuine need to change model behavior—only then fine-tuning or training; agents executing side effects—permissions, human review, and audit are mandatory.

## Inference hosting as a cost decision

- Managed model APIs start fast, run stably, need little ops, and put new models at hand, at the cost of vendor lock-in, data traversing the vendor's path, and a unit cost that may overtake self-hosting at volume.
- Self-hosted inference puts the model, data, cost structure, and deployment environment fully under your control, but GPUs, VRAM, batching, scaling, failures, and capacity all land on you.
- Hybrid routing sends simple tasks to cheap models and only hard ones to strong models, but routing policy, evaluation, fallback, and cost accounting all get more complex.

The fork is a cost decision, not a vanity decision: it asks four questions: can the data leave the domain? can the managed API meet the latency target? is the call volume big enough that self-hosting is cheaper? can the team operate GPU serving? One yes usually does not justify self-hosting; hitting two or three together is when sinking the infrastructure makes sense.

## Choosing the extension route

- RAG grounds answers in material retrieved on the spot. Choose it when the knowledge base is large, content changes often, answers need citations, or permission filtering is required.
- Long context reads a body of material whole in the window in one pass. Choose it when material volume is limited, the task is one-shot, and the window is large enough.
- Fine-tuning adjusts the model's default behavior, output style, and fixed formats. Choose it when format requirements are rigid, domain vocabulary is stable, and high-quality samples are in hand.

The most common misjudgment: blaming the model for dumbness when retrieval was done poorly, or fine-tuning a "knowledge freshness" problem that RAG should have solved. The test sentence: **knowledge goes through retrieval; only behavior talks fine-tuning.** Need citations, updates, or permissions—get RAG right first.

## Building training infrastructure

Training infrastructure is not inference's extension; it is another ledger: data pipelines (cleaning, dedup, licensing compliance, versioning—or experiments cannot be reproduced), job orchestration (long-running jobs must be interruptible and resumable), GPUs and interconnect (multi-card training is sensitive to inter-card bandwidth and storage throughput, a different hardware profile from inference), checkpoints and model artifacts (resumable, version-traceable), experiment tracking (hyperparameters, datasets, metrics tied to each run), validation and promotion (offline metrics gate the eval set; the eval set gates the candidate release).

The fork: **when managed fine-tuning (API-provided services) meets the need, default to managed; only when training jobs are frequent enough that a self-built cluster pays off, or data/models cannot leave the domain, or deep customization of the training pipeline is required, build training infrastructure.** Most teams making AI applications never need the latter. Before self-building, also ask: does anyone on the team debug distributed training? How much does one training run cost, and how often do you iterate? These are the same account as self-hosted inference, at a higher threshold.

## Workflow first for agent frameworks

The first question stays the same: can a deterministic workflow solve it? Yes → workflow first (more predictable, testable, auditable); no → agent, but with permissions, budgets, human review, tracing, and eval mandatory.

Agent framework selection focuses on: can tool permissions be tiered? Is human approval supported? Is every step traced? Can budgets and maximum steps be capped? Are context compression and task resume supported?

## The gatekeeping layer is the production threshold

The biggest difference between AI systems and traditional ones is unstable output and drifting quality. Watching only API success rates after launch is not enough: what were the prompt and context? Which chunks were retrieved? What did the model call cost? Did any tool call exceed its permission? Does the final answer cite sources, or fabricate? Did quality regress after a model swap or prompt change?

When the system touches money, user data, or autonomous actions, eval is not "add later"—it is part of the architecture. Without eval, every model swap, prompt change, or retrieval-strategy change is essentially launching blind.

## Selection quick reference

- Just validating an AI product? Start with a managed model API plus basic logging. Add the gateway when multiple apps share it, cost becomes opaque, or vendor failures have wide impact.
- Multiple models or teams calling? Start with a model gateway as the unified entry, and move to unified auth, rate limiting, billing, and failover when those are needed.
- Answering from private knowledge? Start with RAG plus simple vector retrieval. Upgrade when retrieval quality is unstable, permissions are complex, or the knowledge base grows.
- Vector scale still small? Start with pgvector or single-node vector search. Move to a dedicated vector store at millions of vectors or more, when filtering is complex, or when latency is tight.
- Model call cost high? Start with model routing, caching, and quotas. Upgrade when API cost exceeds total self-hosted cost, or data cannot leave the domain.
- Autonomous actions needed? Start with a deterministic workflow. Move to an agent only when steps are open-ended and dynamic planning is required.
- Steady iteration needed? Start with trace plus a small eval set. Expand to full gates when the system is production-grade, touches money, or swaps models frequently.
- Changing model behavior? Start with a managed fine-tuning service. Build your own when training is frequent enough to pay off, data or models cannot leave the domain, or deep customization is needed.

## Relationship to other documents

- The full workflow-versus-agent judgment is in [AI system design](../ai/02-ai-system-design.md).
- The eval trio and gates are in [Evaluation-driven architecture](../ai/05-evaluation-driven-architecture.md).
- Vector storage and read-model selection are in [Data stores](./03-data-stores.md).
- Training-data versioning and the eval-set lifecycle are in [Data ownership](../05-data-ownership.md).
- The unified selection decision tree is in [Selection principles](./01-principles.md).
