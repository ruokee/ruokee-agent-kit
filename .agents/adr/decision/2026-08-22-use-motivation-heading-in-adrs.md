# ADR decision: Use Motivation as the opening section

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol

English | [中文](./2026-08-22-use-motivation-heading-in-adrs.zh.md)

## Motivation

The fixed `## Problem` opening assumes that every proposed decision responds to a defect or an undesirable situation. Some ADRs instead propose a wanted capability or other new addition. Those decisions have a reason, but do not necessarily begin with a problem.

Writers can force such a proposal into the current structure by inventing a problem scenario. That framing is unnatural and can distort the actual reason for the proposal. The opening section needs a neutral name that covers problems, requirements, and desired additions.

## Decision

The first required body heading in every ADR template is `## Motivation` in English and `## 动机` in Chinese:

- English: `## Problem` becomes `## Motivation`.
- Chinese: `## 问题` becomes `## 动机`.

`Motivation` records why the decision is being considered. Its content may describe an observed problem, a requirement, a desired capability, or another concrete reason for change. It does not weaken the expectation that the section state the reason precisely.

The fixed-format examples and authoring rules in [`.agents/adr/README.md`](../README.md) and [`.agents/adr/README.zh.md`](../README.zh.md) use the new heading, and the surrounding rules define motivation broadly enough to include problems, requirements, and desired additions. The current [ADR mechanism decision](./2026-09-23-clarify-adr-content-boundaries.md) applies the heading to both proposals and decisions.

Every current proposal and decision template opens with `Motivation`. Historical Git revisions may retain references to the earlier `Problem` heading.

## Alternatives considered

**Keep `Problem`.** This is direct when a decision addresses a defect, but it continues to make new capability proposals sound like defect reports.

**Allow either `Problem` or `Motivation`.** This avoids rewriting the template, but gives one structural field two names and makes authoring and bilingual review less predictable.

**Require both sections.** Separate sections can distinguish a current deficiency from the reason for acting, but many ADRs would repeat the same material or leave one section artificial.

## Consequences

`Motivation` is broader than `Problem`, so writers may use it for vague aspirations. Review must still require a concrete reason for considering the decision.

Repository history contains both opening headings, but every current ADR uses `Motivation`; the one-time historical search distinction is accepted.

The English and Chinese documentation describe the same rule.

## Changes

### 2026-09-02: Apply Motivation to both ADR types

The separate proposal and decision templates both keep `Motivation` as their first required body section.

### 2026-09-23: Require an independently understandable opening and allow optional analysis

The [mechanism decision](./2026-09-23-clarify-adr-content-boundaries.md) refines this rule without conflict. The first sentence of `Motivation` identifies the subject and the concrete problem, intended change, or goal without relying on the title, links, or later text, and an optional `## Analysis` section may follow `Motivation`.
