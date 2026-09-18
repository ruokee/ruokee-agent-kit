# ADR proposal: Allow model invocation of architect

Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol

English | [中文](./2026-09-18-make-architect-model-invoked.zh.md)

## Motivation

The [current architect decision](../decision/2026-08-22-add-manual-architect-skill.md) makes the Skill user-invoked. Both language variants block model invocation, and the public capability indexes classify architect under user-invoked Skills.

That contract requires a person to name the Skill even when a request already contains clear system-level architecture work. The Agent can then perform architecture analysis or design without loading architect's reference navigation, evidence requirements, and output contract.

Ruokee wants the Agent to load architect when the task itself provides clear system-level architecture signals, while keeping explicit user invocation available. Ordinary engineering and product work should remain outside model invocation.

## Proposal

### Activation contract

Make architect a model-invoked Skill in both language variants. Remove `disable-model-invocation: true` from both `SKILL.md` files and delete both `agents/openai.yaml` files that set `policy.allow_implicit_invocation: false`. Among current first-party Skills, only architect and grill-me carry both manual-invocation controls. Removing them from architect leaves grill-me user-invoked and makes architect consistent with the other model-invoked components. Hosts that support Skill commands can still accept explicit user invocation.

Use architect when a task requires system-level architecture analysis, design, review, technology selection, or evolution. Activation signals include decisions that cross module, service, or deployment boundaries and judgments about system boundaries, data and state ownership, quality attributes, failure, scale, or long-term change.

Do not activate architect for single-module internal design, concrete implementation, code-level quality review, product behavior, priority ranking, or general discussion. Mentioning architecture or the architect Skill without requesting system-level architecture work is not an activation signal.

These positive and negative signals govern model or implicit invocation only. When a host supports Skill commands, an explicit user invocation loads architect even if the underlying request would not meet the model-invocation signals. Loading the Skill does not expand its scope or authorize implementation.

Tighten the English and Chinese frontmatter descriptions so the catalog exposes the same positive and negative signals. The descriptions state applicability and scope rather than narrating invocation policy. The Skill body remains the detailed authority after activation.

### Preserved capability contract

Keep the existing system-level scope, 29 Markdown documents, glossary and reference layout, absence of a `workflow/` directory, source and license obligations, reference navigation, evidence requirements, and output contract. Delete only the two policy-only `agents/openai.yaml` files from the component trees. The replacement decision must update its file trees, responsibility descriptions, and counts so they do not retain the removed policy files. The implementation changes how the Skill becomes available to the Agent. It does not turn architect into an implementation workflow or expand it into code-level or product-priority work.

### Decision replacement and documentation

This proposal conflicts with the current decision's manual-invocation choice. If accepted and implemented, it will reverse [Add a manually invoked architect Skill](../decision/2026-08-22-add-manual-architect-skill.md). The replacement decision must combine this accepted activation contract with every still-effective rule from the current decision.

Move architect from the user-invoked group to the Agent-invoked group in [README.md](../../../README.md) and [README.zh.md](../../../README.zh.md).

Repair every reference to the current decision and the statement that carries it, rather than changing only the link target. Known references include the [grill-me decision](../decision/2026-09-06-add-grill-me-skill.md), the active [ADR-maintenance proposal](./2026-09-03-add-adr-maintenance-skill.md), and the active [well-said proposal](./2026-09-12-add-well-said-skill.md). The grill-me decision must describe its user-invoked configuration directly, without depending on architect's invocation contract or configuration convention. The ADR-maintenance proposal must explain its manual-invocation alternative without treating architect as a current precedent. The well-said proposal should point its source-and-adaptation example to the corresponding section of the replacement architect decision.

## Alternatives considered

**Keep manual invocation.** The current architect decision selected this course. It leaves activation to deliberate human choice and prevents automatic false activations. It also means a task can clearly require system-level architecture work while the Agent cannot load the repository's architecture guidance unless the user remembers the Skill name.

## Acceptance criteria

1. Both architect components are model-invoked: neither `SKILL.md` contains `disable-model-invocation`, and neither component contains `agents/openai.yaml`.
2. The English and Chinese descriptions implement the activation contract above with aligned meaning, and the public capability indexes place architect in the Agent-invoked group.
3. On a host that supports Skill commands, explicit user invocation loads architect for at least one request that does not meet the model-invocation signals.
4. The preserved capability contract remains unchanged. The replacement decision's component trees and counts exclude `agents/openai.yaml` while retaining the 29 Markdown documents, glossary and reference layout, and absence of a `workflow/` directory.
5. Each new decision uses `Reverses` to link to the same-language archived decision. Each archived file has `Archived: YYYY-MM-DD`, followed by `Reversed by` linking to the same-language new decision, with the language link after the complete metadata block. The implementation moves both old files to `archived/` and removes the consumed proposal.
6. Every reference to the reversed decision and its surrounding factual or contract statement is repaired as specified above. Current records do not cite the archived decision as current authority.
7. Real OMP CLI validation under the current project testing rules covers every positive and negative signal in the activation contract, plus explicit invocation for a negative-signal request. The record includes exact inputs, expected outcomes, actual Skill-loading evidence, model and host versions, language variant, and limitations. Final-answer content alone is not evidence that the Skill loaded.

## Risks

A description that is still too broad can cause architect to load for ordinary engineering discussion. The extra context and system-level framing can divert a small task from its actual scope.

Model, host, or language differences can interpret the same catalog description differently. One variant may miss applicable architecture work or load for a request that another variant excludes, leaving behavior inconsistent across supported environments.

If implementation archives the current decision without repairing every inbound reference, a current decision or proposal can continue treating an archived choice as current authority. That would make the ADR set internally inconsistent.
