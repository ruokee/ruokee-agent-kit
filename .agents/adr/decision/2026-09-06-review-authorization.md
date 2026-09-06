# ADR decision: Review authorization

Decision owner: Ruokee
Draft writer: OMP

English | [中文](./2026-09-06-review-authorization.zh.md)

## Motivation

Cross-file, dependency, and architectural recommendations are part of a full review. Describing a change does not apply it, and maintaining an authorized report does not change the reviewed files.

## Decision

A review may report findings, recommendations, risks, and verification methods without separate approval to make those recommendations. Approval requirements apply when carrying out controlled changes, such as cross-file refactoring, dependency changes, architecture migration, or bulk edits.

A review request does not authorize changes to the reviewed files. Existing authorization to maintain Task materials or a report remains applicable.

The full-review workflows and their entry and stop rules in [code-quality](../../../skills/code-quality/SKILL.md) and [python-engineering](../../../skills/python-engineering/SKILL.md) express this boundary within each component. The English and Chinese variants have the same meaning, consistent with [the self-contained component decision](./2026-08-24-keep-components-self-contained.md).

## Alternatives considered

None

## Consequences

- A full review reports recommendations for cross-file, dependency, architectural, or bulk changes without first asking permission to recommend them.
- The review does not carry out those changes without the required authorization.
- Authorized report or Task material maintenance can continue during the review.
- The English and Chinese instructions express the same approval boundary, including their entry and stop rules.
