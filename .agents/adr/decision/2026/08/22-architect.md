# architect

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol
Reverses: [architect](../../../archived/2026/08/22-r1-architect.md)

English | [中文](./22-architect.zh.md)

## Motivation

Let the Agent load the `architect` Skill when a task shows clear system-level signals, while explicit user invocation remains available.

A task can clearly require system-level architecture work without naming the `architect` Skill, and requiring the user to remember the Skill name can leave the Agent doing that work without the repository's architecture guidance. The repository provides a first-party `architect` Skill for system-level architecture analysis, design, review, technology selection, and evolution, whose reference navigation, evidence requirements, and output contract help the Agent reason from project facts about boundaries, data and state, quality attributes, failure, scale, and long-term change.

The Agent should load architect when the task supplies clear system-level signals, while explicit user invocation remains available and ordinary engineering or product work stays outside its activation scope.

## Decision

### Capability scope

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

Each language component keeps one reference layout with no `agents/` or `workflow/` directory. Documents within one reference directory use two-digit prefixes for stable navigation; directories are not numbered, and numbering does not require sequential reading.

Chapters 23 through 25 cover constraint expression, output review, and quality validation when AI participates in system-level architecture work, so they belong under `ai/`. Chapter 01 focuses on career and learning motivation, chapter 26 on general collaboration style, and chapters 35 through 40 on AI-native organizations. They are not priorities for this system architecture Skill. Templates and cases may supply examples, but the Skill does not copy them into a separate template catalogue.

### Evidence contract

The Skill distinguishes observed project facts, conclusions derived from those facts, unverified assumptions, recommendations, and user decisions. Project facts cite current code, configuration, runtime evidence, or observation windows. Derived estimates show inputs, formulas, and uncertainty. Version-sensitive external claims and numerical case studies use primary sources with dates or versions.

Outputs present candidate options, tradeoffs, applicability conditions, and assumptions. They translate technical choices into consequences for cost, risk, and time. Analysis and design center on system views and boundaries; the user decides whether implementation proceeds.

### Source adaptation

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
- Each language component keeps the glossary and reference layout and has no `workflow/` directory. The policy-only `agents/openai.yaml` files are removed.
- The system-level scope, source and license obligations, evidence requirements, reference navigation, and output contract remain in force. Concrete implementation and product-priority work remain outside the Skill.
- Both language variants remain complete and semantically aligned. Model, host, and language differences can still produce different activation judgments, so real-host checks record the environment and loading evidence.
- The capability still relies on model reasoning and cannot guarantee correct analysis. Outputs continue to distinguish evidence, derivation, assumptions, recommendations, and user decisions.
