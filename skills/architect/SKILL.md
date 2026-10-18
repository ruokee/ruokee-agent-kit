---
name: architect
description: Use for system-level architecture analysis, design, review, technology selection, or evolution across module, service, or deployment boundaries, especially system boundaries, data and state ownership, quality attributes, failure, scale, or long-term change. Do not use for single-module design, concrete implementation, code-level review, product behavior, priority ranking, general discussion, or a mention of architecture alone.
metadata:
  version: "1.0.8"
---

# Architecture

Use this Skill for system-level architecture analysis, design, review, technology selection, and evolution. The model does the primary reasoning; the reference documents supply architecture knowledge, judgment rationale, common tradeoffs, and examples. They do not freeze architecture work into fixed steps.

## Scope

This Skill handles system-level judgment: system boundaries, data and state, quality attributes, failure, scale, and long-term change. It covers five kinds of work: analysis, design, review, selection, and evolution. Boundaries: single-module internal design, coding implementation, and code-level quality review are out of scope; defining product behavior and ranking priorities are out of scope. Both follow their own ordinary processes.

This Skill does not do concrete implementation. Project facts come from the current code and configuration; product behavior comes from product documentation; priority calls belong to the user. The Skill replaces none of these. When recording architecture decisions, follow the current project's recording convention.

## Reference Navigation

Choose documents by the signals of the current question and read only what is needed. Numbering is for directory navigation only; documents are not meant to be read in order.

- To form architecture judgment from requirements, constraints, and quality attributes, read [Architecture judgment](./references/01-architecture-judgment.md); pair it with system-design and technology-selection/principles.
- To take apart an unfamiliar system from code, configuration, and runtime evidence, read [System analysis](./references/02-system-analysis.md); pair it with views and distributed-systems.
- To choose views and abstraction levels for boundaries, relationships, and data flow, read [Views](./references/03-views.md); pair it with system-analysis.
- To compare when monoliths, microservices, event-driven, and other styles fit, read [Architecture styles](./references/04-architecture-styles.md); pair it with organization.
- For state ownership, data lifecycles, and storage boundaries, read [Data ownership](./references/05-data-ownership.md); pair it with consistency and technology-selection/data-stores.
- To derive a complete, verifiable system design from requirements, read [System design](./references/06-system-design.md); pair it with architecture-judgment and scaling.
- To record candidates, tradeoffs, consequences, and re-review conditions, read [Architecture decisions](./references/07-architecture-decisions.md); pair it with architecture-judgment.
- For constraints from networks, time, concurrency, and partial failure, read [Distributed systems](./references/08-distributed-systems.md); pair it with consistency and resilience.
- For consistency models, transaction boundaries, and conflict handling, read [Consistency](./references/09-consistency.md); pair it with distributed-systems and data-ownership.
- For timeout, retry, idempotency, isolation, and degradation design, read [Resilience](./references/10-resilience.md); pair it with distributed-systems and scaling.
- To find bottlenecks from load evidence and choose how to scale, read [Scaling](./references/11-scaling.md); pair it with data-ownership.
- For splitting, migrating, rolling back, retiring, and evolution trigger signals, read [Evolution](./references/12-evolution.md); pair it with architecture-decisions and organization.
- For team ownership, communication structure, and their relation to system boundaries, read [Organization](./references/13-organization.md); pair it with architecture-styles and evolution.
- For trust boundaries, identity and permissions, data isolation, and multi-tenant risks, read [Security](./references/14-security.md); pair it with data-ownership.
- For uncertainty, cost, and capability boundaries introduced by AI components, read [AI-era judgment](./references/ai/01-ai-era-judgment.md); pair it with ai/ai-system-design.
- For system boundaries of models, context, tools, memory, and orchestration, read [AI system design](./references/ai/02-ai-system-design.md); pair it with ai/ai-era-judgment and ai/evaluation-driven-architecture.
- To turn architecture constraints into AI-executable, verifiable specifications, read [Specifications for AI](./references/ai/03-specifications-for-ai.md); pair it with ai/reviewing-ai-output.
- To review the omissions specific to AI architecture output, read [Reviewing AI output](./references/ai/04-reviewing-ai-output.md); pair it with consistency, resilience, scaling, and security.
- To define AI system quality with evaluation targets, datasets, and feedback, read [Evaluation-driven architecture](./references/ai/05-evaluation-driven-architecture.md); pair it with ai/ai-system-design.
- For general questions, comparison dimensions, and exit conditions of technology selection, read [Selection principles](./references/technology-selection/01-principles.md); pair it with architecture-decisions.
- For constraints, team fit, and maintenance cost of languages and backend frameworks, read [Languages](./references/technology-selection/02-languages.md); pair it with technology-selection/principles.
- For data model, consistency, and operational cost of data stores, read [Data stores](./references/technology-selection/03-data-stores.md); pair it with data-ownership and consistency.
- To see what caches, message queues, and event systems each solve, read [Messaging](./references/technology-selection/04-messaging.md); pair it with consistency and resilience.
- For coupling, performance, and evolution cost of API and service communication styles, read [Communication](./references/technology-selection/05-communication.md); pair it with architecture-styles.
- For delivery, elasticity, and operational constraints of deployment shapes and cloud platforms, read [Deployment](./references/technology-selection/06-deployment.md); pair it with scaling and security.
- To learn how observability and reliability tooling supports failure detection and response, read [Observability](./references/technology-selection/07-observability.md); pair it with resilience.
- For AI infrastructure tradeoffs across training, inference, data, and cost, read [AI infrastructure](./references/technology-selection/08-ai-infrastructure.md); pair it with ai/ai-era-judgment and ai/evaluation-driven-architecture.

When terminology is unclear, read the [glossary](./glossary.md).

## Evidence Requirements

- Distinguish project facts, assumptions, suggestions, and user decisions, and label each category explicitly in output.
- Base judgments on the current project's code, configuration, and runtime evidence; the reference documents supply general judgment rationale, not project facts. Give project facts as `path:line`, config keys, command output, or observation windows.
- State uncertainty when evidence is missing; never pass generic assumptions off as project evidence.
- Company cases containing numerical claims, product-capability claims that affect decisions and may change across versions, and external research conclusions must cite a primary source with a publication date, product version, or access date. Stable category-level judgments and unverifiable rules of thumb do not need per-item citations; label the latter explicitly as heuristics and do not use them as upgrade triggers. Purely derived conclusions need no external citation.
- For derived conclusions (estimates, capacity reasoning, cost projections), show inputs, formulas, and uncertainty.
- Output distinguishes at least: observed (project evidence), derived from facts, unverified assumption, suggestion, and user decision.
- Citing upstream material marks the provenance of judgment rationale, not the decision itself.

## Output Contract

- Give candidate options with tradeoffs and applicability conditions for each, not a single answer; state the assumptions each judgment depends on.
- Translate technical tradeoffs into business consequences—cost, risk, and time; the user sets priorities.
- Analysis and design output centers on views and boundary descriptions; whether to proceed to implementation is the user's call.

## Sources

The topic map of the reference documents comes from [awesome-architecture](https://github.com/study8677/awesome-architecture/tree/7f43e49b95ad9c255418733738fddab4eb0f6a68) (by JingWen Fan, [MIT license](https://github.com/study8677/awesome-architecture/blob/7f43e49b95ad9c255418733738fddab4eb0f6a68/LICENSE)).
