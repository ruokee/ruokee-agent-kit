# ADR decision: Allow model invocation of architect

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol
Reverses: [Add a manually invoked architect Skill](../archived/2026-08-22-add-manual-architect-skill.md)

English | [中文](./2026-09-18-make-architect-model-invoked.zh.md)

## Motivation

The repository provides a first-party `architect` Skill for system-level architecture analysis, design, review, technology selection, and evolution. Its reference navigation, evidence requirements, and output contract help the Agent reason from project facts about boundaries, data and state, quality attributes, failure, scale, and long-term change.

A task can clearly require that work without naming the Skill. Requiring the user to remember the Skill name can leave the Agent doing architecture work without the repository's architecture guidance. The Agent should load architect when the task supplies clear system-level signals, while explicit user invocation remains available and ordinary engineering or product work stays outside its activation scope.

## Decision

### Capability and scope

Keep a self-contained English Skill under `skills/architect/` and a complete Chinese variant under `variants/zh/skills/architect/`. Each component covers system-level architecture analysis, design, review, technology selection, and evolution.

The Skill handles judgments about system boundaries, data and state ownership, quality attributes, failure, scale, and long-term change. It does not perform concrete implementation, single-module internal design, code-level quality review, product behavior definition, or priority ranking. Project facts come from current code and configuration, product behavior from current product documentation, and priority decisions from the user.

The model supplies the main reasoning ability. References provide architecture knowledge, grounds for judgment, common tradeoffs, and examples without turning architecture work into a fixed sequence of steps. Architecture-decision guidance follows the current project's recording convention.

### Activation contract

Architect is model-invoked. Neither language variant sets `disable-model-invocation`, and neither component contains an `agents/openai.yaml` policy that blocks implicit invocation.

Use architect when a task requires system-level architecture analysis, design, review, technology selection, or evolution. Positive signals include decisions that cross module, service, or deployment boundaries and judgments about system boundaries, data and state ownership, quality attributes, failure, scale, or long-term change.

Do not activate architect for single-module internal design, concrete implementation, code-level quality review, product behavior, priority ranking, general discussion, or a mention of architecture or the Skill without a request for system-level architecture work.

These signals govern model or implicit invocation. A host that supports Skill commands may still load architect through explicit user invocation even when the underlying request does not meet the model-invocation signals. Loading the Skill does not expand its scope or authorize implementation.

The English and Chinese frontmatter descriptions expose semantically aligned positive and negative signals. The Skill body remains the detailed authority after activation.

### Knowledge structure

Each language component contains 29 Markdown documents: `SKILL.md`, a root glossary, 14 core references, 5 AI references, and 8 technology-selection references. It has no `agents/` or `workflow/` directory. Documents within one reference directory use two-digit prefixes for stable navigation; directories are not numbered, and numbering does not require sequential reading.

```text
skills/architect/
  SKILL.md
  glossary.md
  references/
    01-thinking-and-tradeoffs.md
    02-system-analysis.md
    03-views.md
    04-architecture-styles.md
    05-data-and-state.md
    06-system-design.md
    07-architecture-decisions.md
    08-distributed-systems.md
    09-consistency.md
    10-resilience.md
    11-scaling.md
    12-evolution-and-migration.md
    13-organization-and-ownership.md
    14-security-and-tenancy.md
    ai/
      01-ai-era-judgment.md
      02-ai-system-design.md
      03-specifications-for-ai.md
      04-reviewing-ai-output.md
      05-evaluation-driven-architecture.md
    technology-selection/
      01-principles.md
      02-languages-and-frameworks.md
      03-data-stores.md
      04-cache-messaging-and-events.md
      05-api-and-communication.md
      06-cloud-and-deployment.md
      07-observability-and-reliability.md
      08-ai-infrastructure.md
```

Each document has the following responsibility:

| Document | Scope | Source cues |
| --- | --- | --- |
| `SKILL.md` | State scope, navigation, evidence requirements, and the output contract. | This ADR |
| `glossary.md` | Define the architecture terms and Chinese-English equivalents used by the Skill. | Glossary |
| `references/01-thinking-and-tradeoffs.md` | Form architecture judgments from requirements, constraints, and quality attributes. | Chapters 02, 06, and 09 |
| `references/02-system-analysis.md` | Analyze an unfamiliar system from code, configuration, and runtime evidence. | Chapter 18 |
| `references/03-views.md` | Choose views and diagram boundaries, relationships, and data flow. | Chapter 03 |
| `references/04-architecture-styles.md` | Compare the fit and tradeoffs of common architecture styles. | Chapter 04 |
| `references/05-data-and-state.md` | Explain state ownership, data lifecycles, and storage boundaries. | Chapter 05 |
| `references/06-system-design.md` | Show a complete path from requirements to a verifiable system design. | Chapters 07 and 19 |
| `references/07-architecture-decisions.md` | Record candidates, tradeoffs, consequences, and review conditions. | Chapter 08 |
| `references/08-distributed-systems.md` | Explain constraints caused by networks, time, concurrency, and partial failure. | Chapter 10 |
| `references/09-consistency.md` | Compare consistency models, transaction boundaries, and conflict handling. | Chapter 11 |
| `references/10-resilience.md` | Explain timeout, retry, idempotency, isolation, and degradation design, plus RPO/RTO and recovery design. | Chapter 12 |
| `references/11-scaling.md` | Use load evidence to find bottlenecks and choose scaling methods. | Chapter 13 |
| `references/12-evolution-and-migration.md` | Use evolution trigger signals and technical-debt evidence to plan decomposition, migration, rollback, and retirement. | Chapters 08, 14, 20, and 21, plus the evolution-signals appendix |
| `references/13-organization-and-ownership.md` | Explain how team ownership and communication structure relate to system boundaries. | Chapters 08 and 15 |
| `references/14-security-and-tenancy.md` | Explain trust boundaries, identity and access, data isolation, and tenancy risk. | Chapter 16 |
| `references/ai/01-ai-era-judgment.md` | Explain uncertainty, cost, and capability boundaries introduced by AI components. | Chapter 17 |
| `references/ai/02-ai-system-design.md` | Explain system boundaries among models, context, tools, memory, and orchestration. | Chapter 22 |
| `references/ai/03-specifications-for-ai.md` | Express architecture constraints as executable and verifiable specifications for AI. | Chapter 23 |
| `references/ai/04-reviewing-ai-output.md` | Review only AI-specific omissions; reuse the consistency, resilience, scaling, and security references. | Chapter 24 |
| `references/ai/05-evaluation-driven-architecture.md` | Define AI-system quality through evaluation goals, datasets, and feedback. | Chapter 25 |
| `references/technology-selection/01-principles.md` | Give common questions, comparison dimensions, and exit conditions for technology selection. | Chapter 34 |
| `references/technology-selection/02-languages-and-frameworks.md` | Compare language and backend-framework constraints, team fit, and maintenance cost. | Chapter 27 |
| `references/technology-selection/03-data-stores.md` | Compare data models, consistency, and operational cost across storage choices. | Chapter 28 |
| `references/technology-selection/04-cache-messaging-and-events.md` | Distinguish the problems and boundaries of caches, message queues, and event systems. | Chapter 29 |
| `references/technology-selection/05-api-and-communication.md` | Compare API and service-communication choices by coupling, performance, and evolution cost. | Chapter 30 |
| `references/technology-selection/06-cloud-and-deployment.md` | Compare deployment models and cloud platforms by delivery, elasticity, and operational constraints. | Chapter 31 |
| `references/technology-selection/07-observability-and-reliability.md` | Connect observability and reliability tools to failure detection and response needs. | Chapter 32 |
| `references/technology-selection/08-ai-infrastructure.md` | Compare AI infrastructure tradeoffs across training, inference, data, and cost. | Chapter 33 |

Chapters 23 through 25 cover constraint expression, output review, and quality validation when AI participates in system-level architecture work, so they belong under `ai/`. Chapter 01 focuses on career and learning motivation, chapter 26 on general collaboration style, and chapters 35 through 40 on AI-native organizations. They are not priorities for this system architecture Skill. Templates and cases may supply examples, but the Skill does not copy them into a separate template catalogue.

### Evidence and output contract

The Skill distinguishes observed project facts, conclusions derived from those facts, unverified assumptions, recommendations, and user decisions. Project facts cite current code, configuration, runtime evidence, or observation windows. Derived estimates show inputs, formulas, and uncertainty. Version-sensitive external claims and numerical case studies use primary sources with dates or versions.

Outputs present candidate options, tradeoffs, applicability conditions, and assumptions. They translate technical choices into consequences for cost, risk, and time. Analysis and design center on system views and boundaries; the user decides whether implementation proceeds.

### Sources and adaptation

[`awesome-architecture`](https://github.com/study8677/awesome-architecture/tree/7f43e49b95ad9c255418733738fddab4eb0f6a68) is the topic map and source material for the reference coverage. Project evidence, primary technical documentation, and other reliable architecture sources supplement and correct technical judgments. The Skill does not track the upstream directory structure or wording.

The published material is independently written around the judgments a model needs during architecture work rather than copied verbatim. Both language versions of `SKILL.md` identify JingWen Fan and the MIT license and link the reviewed upstream revision. References do not track every upstream update.

Keep explanations, derivations, counterexamples, complete cases, and experience-based judgment when they help the model understand why a choice fits. Remove course pacing, reader exercises, and organization that assumes continuous reading.

## Alternatives considered

**Keep manual invocation.** The reversed decision selected deliberate user activation and prevented automatic false activations. It also left the Agent unable to load the repository's architecture guidance for a clearly system-level request unless the user remembered the Skill name.

**Adopt `architecture-copilot` directly.** It provides a related Skill, but its references compress the source heavily and its interaction style favors sustained questioning. The repository instead keeps an independently authored capability with references designed for this contract.

**Add task workflows.** Workflows could standardize output steps, but they would constrain model reasoning to predefined procedures. The capability needs a concise Skill entry and reference navigation rather than a `workflow/` layer.

**Put all knowledge in one file.** A single file would mix system design, distributed systems, security, evolution, and technology selection. Topic-based references let the Agent read only material relevant to the current problem.

## Consequences

- Architect can load from clear system-level task signals and through explicit user invocation. False activation remains possible, so the catalog descriptions carry narrow positive and negative signals.
- The public English and Chinese capability indexes classify architect as Agent-invoked. `grill-me` remains user-invoked through its own configuration.
- Each language component retains 29 Markdown documents, the glossary and reference layout, and no `workflow/` directory. The policy-only `agents/openai.yaml` files are removed.
- The system-level scope, source and license obligations, evidence requirements, reference navigation, and output contract remain in force. Concrete implementation and product-priority work remain outside the Skill.
- Both language variants remain complete and semantically aligned. Model, host, and language differences can still produce different activation judgments, so real-host checks record the environment and loading evidence.
- The capability still relies on model reasoning and cannot guarantee correct analysis. Outputs continue to distinguish evidence, derivation, assumptions, recommendations, and user decisions.
