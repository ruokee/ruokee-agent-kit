# Agent Note: Use Motivation as the opening section

Status: proposed
Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol

English | [中文](./2026-08-22-use-motivation-heading-in-agent-notes.zh.md)

## Problem

The fixed `## Problem` opening assumes that every proposed decision responds to a defect or an undesirable situation. Some Agent Notes instead propose a wanted capability or other new addition. Those decisions have a reason, but do not necessarily begin with a problem.

Writers can force such a proposal into the current structure by inventing a problem scenario. That framing is unnatural and can distort the actual reason for the proposal. The opening section needs a neutral name that covers problems, requirements, and desired additions.

## Proposal

Replace the first required body heading in every Agent Note template:

- English: `## Problem` becomes `## Motivation`.
- Chinese: `## 问题` becomes `## 动机`.

`Motivation` records why the decision is being considered. Its content may describe an observed problem, a requirement, a desired capability, or another concrete reason for change. It does not weaken the expectation that the section state the reason precisely.

If accepted, update the fixed-format examples and authoring rules in `.agents/notes/README.md` and `.agents/notes/README.zh.md`. Record the format refinement in the implemented Note that owns the Agent Note mechanism.

Do not rewrite existing Note bodies solely to rename this heading. They remain valid records written under the earlier format. New Notes use `Motivation` after the proposal is accepted, and an existing Note may adopt it when a later substantive edit already requires changing that Note.

## Alternatives considered

**Keep `Problem`.** This is direct when a decision addresses a defect, but it continues to make new capability proposals sound like defect reports.

**Allow either `Problem` or `Motivation`.** This avoids rewriting the template, but gives one structural field two names and makes authoring and bilingual review less predictable.

**Require both sections.** Separate sections can distinguish a current deficiency from the reason for acting, but many Notes would repeat the same material or leave one section artificial.

## Acceptance criteria

- Proposed, implemented, and rejected templates use `## Motivation` in English and `## 动机` in Chinese as their first required body heading.
- The surrounding rules define motivation broadly enough to include problems, requirements, and desired additions.
- The Agent Note mechanism's implemented Note records the accepted format refinement.
- Existing Notes remain valid without a mechanical heading-only rewrite.
- The English and Chinese documentation describe the same rule.

## Risks

`Motivation` is broader than `Problem`, so writers may use it for vague aspirations. Review must still require a concrete reason for considering the decision.

Repository history will contain both opening headings. This adds one small search distinction, but avoids changing existing records without changing their decisions.
