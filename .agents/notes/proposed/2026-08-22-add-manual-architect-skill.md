# Agent Note: Add a manually invoked architect Skill

Status: proposed
Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol

English | [中文](./2026-08-22-add-manual-architect-skill.zh.md)

## Motivation

Ruokee wants to add a first-party `architect` Skill. This is a request for a new capability, not a defect in the current implementation.

The Skill covers system-level architecture analysis, design, review, technology selection, and evolution. It should help the Agent reason about system boundaries, data and state, quality attributes, failure, scale, and long-term change using facts from the current project. Reference documents, source material, and directory structure support this requirement. They are not the requirement itself.

Ruokee wants to choose when to use this capability, usually during planning or design. Ordinary coding and general discussion must not load it automatically.

## Proposal

### Capability

Add a first-party Skill named `architect`. Its final English content belongs under `skills/architect/`, with a Chinese variant under `variants/zh/skills/architect/`.

The Skill handles system-level analysis, design, review, selection, and evolution. It does not perform implementation or replace project facts, current product documentation, or user decisions.

The model supplies the main reasoning ability. References provide architecture knowledge, grounds for judgment, common tradeoffs, and examples. They do not turn architecture work into a fixed sequence of steps.

### Activation condition

The Skill activates only when the user explicitly invokes `architect`. The model must not load it automatically. A natural-language request such as "do an architecture analysis" does not invoke it.

Its trigger statement answers when to use it: when the user explicitly invokes `architect` for system-level architecture analysis, design, review, technology selection, or evolution. It is not a catalogue of the Skill's contents.

Manual invocation defines this Skill's role. It is not a concession to discoverability and should not be listed as a risk. Most tasks do not need architecture design, and a false activation can steer the work away from its actual goal. That downside outweighs the occasional benefit of the model identifying an applicable case.

Architecture and system-level design require human participation. The Agent cannot determine from the current task alone whether the real requirements call for architecture design. Explicit invocation shows that a person has decided the current task needs this capability and knows that architecture work is underway.

Matt Pocock's [Model-invoked vs user-invoked](https://github.com/mattpocock/skills/blob/321658273cb1d20b76026717d027d505790106d4/.agents/invocation.md) likewise treats who can invoke a Skill as the axis that separates Skill roles: a user-invoked Skill is reachable only when a person types its name, while a model-invoked Skill is available to either the model or the user. This proposal follows that distinction.

### Knowledge structure

Keep `SKILL.md` short. It contains only the activation condition, scope, reference navigation, evidence requirements, and output contract. The Skill has no `workflow/` directory.

Put architecture knowledge under `references/`, with the glossary at the Skill root to match existing Skills. References serve both Agents and developers. Documents within one directory use two-digit prefixes to keep listings in a stable reading order. Directories are not numbered, and the numbers do not require sequential reading by the Agent. This numbering convention applies only to `architect`.

The tree below defines every document planned for the first release, 29 in each language directory. The release does not ship a subset. If review of the Chinese draft requires merging or splitting documents, update the trees and responsibility tables in both Note files first, then reassign the numbers. The first release still ships every document in the updated tree.

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

The first-release focus of each document is below. These short statements define the scope without prescribing a fixed section structure:

| Document | Scope | Source cues |
|-|-|-|
| `SKILL.md` | State the explicit invocation condition, scope, navigation, evidence requirements, and output contract. | This Note |
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
| `references/10-resilience.md` | Explain timeout, retry, idempotency, isolation, and degradation design. | Chapter 12 |
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

Chapters 23 through 25 cover constraint expression, output review, and quality validation when AI participates in system-level architecture work, so they belong under `ai/`. Chapter 01 focuses on career and learning motivation, chapter 26 on general collaboration style, and chapters 35 through 40 on AI-native organizations. They are not priorities for the first release of a system architecture Skill. Templates and cases may supply examples, but the Skill does not copy them into a separate template catalogue.

### Sources and adaptation

[`awesome-architecture`](https://github.com/study8677/awesome-architecture/tree/7f43e49b95ad9c255418733738fddab4eb0f6a68) is the topic map for the first release and determines which subjects the references cover. Project evidence, primary technical documentation, and other reliable architecture sources supplement and correct technical judgments. The Skill does not track the upstream directory structure or wording.

Implementation must not copy the tutorial verbatim. Rewrite its ideas around the judgments a model needs to make during architecture work. Both language versions of `SKILL.md` link the reviewed upstream revision and identify JingWen Fan as the author and MIT as the license. The references do not track every upstream revision.

Teaching material does not need blanket removal. Keep explanations, derivations, counterexamples, complete cases, and experience-based judgment when they help the model understand why a decision makes sense. Change the emphasis where the source assumes course pacing, reader exercises, or continuous reading.

Decision-related references teach only decision methods and defer to each project's existing record conventions. In this repository, for example, the Skill uses Agent Notes rather than inventing another decision-record format. This is an ordinary local-rule requirement.

### Development order

Write the Chinese variant first. Review its topic coverage, document boundaries, technical judgments, examples, and usefulness on real architecture tasks. Write the formal English Skill after the Chinese version passes review.

Express the approved Chinese meaning naturally in English rather than translating line by line. Both languages must be complete and semantically aligned before merge. This order takes advantage of the Chinese source material while keeping the repository's English path as the default published entry.

## Alternatives considered

**Adopt `architecture-copilot` directly.** It already provides a related Skill, but its references compress the source heavily and its interaction style favors sustained questioning. This proposal uses `awesome-architecture` as the first-release topic map and redesigns the references for the current requirement, so it cannot adopt that Skill directly.

**Add task workflows.** Workflows could standardize output steps, but they would constrain model reasoning to predefined procedures. The current requirement needs a concise Skill entry and references. There is no evidence that it also needs a `workflow/` layer.

**Put all knowledge in one file.** A single file is simple, but system design, distributed systems, security, evolution, and technology selection would be mixed together. Topic-based references let the Agent read material relevant to the current problem.

**Allow automatic activation.** Automatic activation occasionally identifies an applicable case, but a false activation can derail a task that does not need architecture design. The model also cannot determine from the current task alone whether the real requirements call for architecture design, so the cost of a false activation is higher.

## Acceptance criteria

1. `architect` activates only when the user explicitly invokes it. A natural-language request such as "do an architecture analysis" does not invoke it.
2. The trigger statement describes the usage condition rather than cataloguing the Skill's contents.
3. The Skill supports system-level analysis, design, review, technology selection, and evolution while remaining separate from implementation work.
4. `SKILL.md` is a concise entry point. Knowledge is organized through the root glossary and `references/`, with no `workflow/` directory. Within `architect`, reference documents in one directory use two-digit prefixes and directories remain unnumbered; a boundary change may renumber the whole directory.
5. The first release delivers all 29 documents shown in the tree in each language directory. It does not ship a subset.
6. Every planned document has a one-sentence scope and source cue. `awesome-architecture` is the first-release topic map; the Skill does not adopt the compressed structure of `architecture-copilot`.
7. Both language versions of `SKILL.md` link the reviewed `awesome-architecture` revision, identify JingWen Fan as the author, and name the MIT license. Published content does not copy upstream prose, tables, or diagrams verbatim.
8. References retain explanations, derivations, and examples that help judgment while changing the emphasis of course-oriented material.
9. Architecture-decision guidance follows existing project conventions rather than imposing one record format.
10. The Chinese variant is completed and reviewed before the English Skill is written. Both are complete and semantically aligned before merge.
11. Real architecture tasks test topic coverage and document boundaries in the Chinese draft. If boundaries change, update this Note before assigning final numbers.
12. Capability indexes and English and Chinese user documentation explain the manual activation condition and scope.
13. Repository checks pass after implementation.

## Risks

If references are split too finely, knowledge that should be read together will be scattered across files, increasing lookup and assembly cost. If they are too broad, each file will include substantial material unrelated to the current problem. Test the Chinese draft with real tasks to learn which topics belong together before merging or splitting files.

References that contain only conclusions and checklists leave the model without reasons for its judgments. Keeping too much course structure would instead organize them around lesson progression rather than architecture tasks. Adapt the emphasis and preserve the material that explains tradeoffs.

The capability relies mainly on model reasoning, so references cannot guarantee a correct analysis. The Skill must distinguish project facts, assumptions, recommendations, and user-owned decisions, and it must state uncertainty when evidence is missing.
