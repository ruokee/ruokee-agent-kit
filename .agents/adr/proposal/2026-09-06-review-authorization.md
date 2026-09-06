# ADR proposal: Review authorization

Decision owner: Ruokee
Draft writer: OMP

English | [中文](./2026-09-06-review-authorization.zh.md)

## Motivation

The full-review workflows in [skills/code-quality/workflow/full-review.md](../../../skills/code-quality/workflow/full-review.md) and [skills/python-engineering/workflow/full-review.md](../../../skills/python-engineering/workflow/full-review.md) require confirmation before recommending some changes. A requested review can therefore stop before reporting its most important findings, even though it would not change the reviewed files.

## Proposal

A review may report findings, recommendations, risks, and verification methods without separate approval to make those recommendations. Approval requirements apply when carrying out controlled changes, such as cross-file refactoring, dependency changes, architecture migration, or bulk edits.

A review request does not authorize changes to the reviewed files. Existing authorization to maintain Task materials or a report remains applicable.

Apply this distinction to the full-review workflows and any conflicting entry or stop rules in code-quality and python-engineering. Keep the English and Chinese variants equivalent. Each Skill must express the rule within its own component, consistent with [the self-contained component decision](../decision/2026-08-24-keep-components-self-contained.md).

## Alternatives considered

None

## Acceptance criteria

- A full review reports recommendations for cross-file, dependency, architectural, or bulk changes without first asking permission to recommend them.
- The review does not carry out those changes without the required authorization.
- Authorized report or Task material maintenance can continue during the review.
- The English and Chinese instructions express the same approval boundary, including their entry and stop rules.

## Risks

None
