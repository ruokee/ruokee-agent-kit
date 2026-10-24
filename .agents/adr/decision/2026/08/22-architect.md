# architect

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol
Reverses: [architect](../../../archived/2026/08/22-r2-architect.md)

English | [中文](./22-architect.zh.md)

## Motivation

Keep architect available for system-level task signals and explicit invocation, with reference organization owned by the component.

A task can require system-level judgment without naming a Skill. Model invocation supplies the architecture guidance in those cases. The predecessor also fixed internal directories, numbering, and source-chapter placement. Those constraints make reference maintenance a repository decision without improving activation, evidence, or output quality.

## Decision

### Capability scope

Provide complete, self-contained English and Chinese architect distributions under the ordinary Skill packaging contract. Cover system-level architecture analysis, design, review, technology selection, and evolution: boundaries, data and state ownership, quality attributes, failure, scale, and long-term change.

Do not perform concrete implementation, single-module internal design, code-quality review, product behavior definition, or priority ranking. Current code and configuration supply project facts, product documentation supplies behavior, and the user owns priorities. Loading the Skill grants no implementation authority.

The model supplies reasoning; references provide knowledge, grounds for judgment, tradeoffs, examples, and terminology without imposing a fixed sequence. Architecture-decision guidance follows the current project's recording convention.

### Activation contract

Architect is model-invoked. Neither language sets `disable-model-invocation` or uses host Agent policy to block implicit invocation. Positive signals include system-level judgments crossing module, service, or deployment boundaries.

Single-module design, implementation, code-quality review, product behavior, priorities, general discussion, and mentions without a system-level request do not trigger model invocation. Explicit user invocation remains supported where the host provides Skill commands, even outside those implicit signals.

Both frontmatter descriptions present equivalent positive and negative signals; the body is the detailed authority after activation. Public capability indexes classify architect as Agent-invoked. Other Skills retain their own invocation contracts.

### Knowledge structure

The component owns reference paths, filenames, numbering, and navigation. Each language retains complete architecture references and terminology, with equivalent coverage and usable installed links. Navigation is not a sequential-reading requirement.

Include constraint expression, output review, and quality validation for AI-assisted system architecture. Career motivation, general collaboration style, and AI-native organization topics are not priorities for this system architecture Skill. Templates and cases may supply examples; do not turn the Skill into a copied template catalogue.

### Evidence contract

Distinguish observed project facts, derived conclusions, unverified assumptions, recommendations, and user decisions. Cite current code, configuration, runtime evidence, or observation windows for project facts. Show inputs, formulas, and uncertainty for estimates. Version-sensitive external claims and numerical cases use primary sources with dates or versions.

Present options, tradeoffs, applicability, and assumptions, translating choices into cost, risk, and time consequences. Analysis and design center on system views and boundaries; the user decides whether implementation proceeds.

### Source adaptation

[`awesome-architecture`](https://github.com/study8677/awesome-architecture/tree/7f43e49b95ad9c255418733738fddab4eb0f6a68) supplies the topic map and source coverage. Project evidence, primary documentation, and other reliable architecture sources supplement and correct judgments. Do not track upstream directory structure, wording, or every update.

Write independently around the judgments a model needs rather than copying the source verbatim. Both language entries identify JingWen Fan, the MIT license, and the reviewed upstream revision. Preserve helpful explanations, derivations, counterexamples, complete cases, and experience-based judgment; exclude course pacing, reader exercises, and organization requiring continuous reading.

## Alternatives considered

Prescribe reference directories, two-digit prefixes, and source-chapter locations in the ADR. This stabilizes one source layout but couples ordinary navigation changes to public decisions. Component-owned navigation preserves complete coverage without that coupling.

## Consequences

Model, host, and language differences can still cause activation outside the intended scope. Catalog descriptions narrow signals; real-host checks record loading conditions and evidence.

Reference organization may evolve without changing the architecture contract. Self-containment, complete bilingual coverage, source obligations, evidence, and output requirements still constrain that work.
