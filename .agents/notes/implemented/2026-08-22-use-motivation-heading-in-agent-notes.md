# Agent Note: Use Motivation as the opening section

Status: implemented
Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol

English | [中文](./2026-08-22-use-motivation-heading-in-agent-notes.zh.md)

## Motivation

The fixed `## Problem` opening assumes that every proposed decision responds to a defect or an undesirable situation. Some Agent Notes instead propose a wanted capability or other new addition. Those decisions have a reason, but do not necessarily begin with a problem.

Writers can force such a proposal into the current structure by inventing a problem scenario. That framing is unnatural and can distort the actual reason for the proposal. The opening section needs a neutral name that covers problems, requirements, and desired additions.

## Decision

The first required body heading in every Agent Note template is `## Motivation` in English and `## 动机` in Chinese:

- English: `## Problem` becomes `## Motivation`.
- Chinese: `## 问题` becomes `## 动机`.

`Motivation` records why the decision is being considered. Its content may describe an observed problem, a requirement, a desired capability, or another concrete reason for change. It does not weaken the expectation that the section state the reason precisely.

The fixed-format examples and authoring rules in [`.agents/notes/README.md`](../README.md) and [`.agents/notes/README.zh.md`](../README.zh.md) use the new heading, and the surrounding rules define motivation broadly enough to include problems, requirements, and desired additions. The Agent Note mechanism's implemented Note records the format refinement in its `## Changes` section.

Every existing Note was migrated in the same change: apart from the policy edits to this note and the mechanism Note, migrating the other existing Notes changed only their opening headings. After that migration no Note body opens with the earlier heading. Historical references to the earlier heading inside this note and the mechanism Note's changes record remain as written.

## Alternatives considered

**Keep `Problem`.** This is direct when a decision addresses a defect, but it continues to make new capability proposals sound like defect reports.

**Allow either `Problem` or `Motivation`.** This avoids rewriting the template, but gives one structural field two names and makes authoring and bilingual review less predictable.

**Require both sections.** Separate sections can distinguish a current deficiency from the reason for acting, but many Notes would repeat the same material or leave one section artificial.

## Consequences

`Motivation` is broader than `Problem`, so writers may use it for vague aspirations. Review must still require a concrete reason for considering the decision.

Repository history contains both opening headings, because this note and earlier commits were written under the earlier format. Apart from the policy edits to this note and the mechanism Note, the migration changed only each note's heading, and the resulting one-time search distinction is accepted.

The English and Chinese documentation describe the same rule.
