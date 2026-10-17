# Review tiers

English | [中文](./review-tiers.zh.md) | [Dictionary](./README.md)

Chinese term: 审查层次

The three levels used to check a change: automated checks, automated review, and human review.

## Mechanism

Each level catches different defects. An automated check runs a deterministic command. An automated review looks for problems a command cannot encode. Human review judges intent, tradeoffs, and whether the result is acceptable. A passing lower level does not establish the higher level.

## Example

A change runs its affected checks, receives automated review comments, and then goes to a person for acceptance. The person may accept with a known limitation that no check can express.

## Avoid

Avoid treating a green check as proof of correctness. Avoid treating an automated review as acceptance. Avoid using human review to repeat what a check already establishes.

## Automated check

A deterministic command that verifies syntax, types, tests, formatting, or links without judging design quality.

## Automated review

A model or tool pass that looks for defects a check cannot encode, but cannot establish correctness or grant acceptance.

## Human review

A person judging intent, tradeoffs, and acceptability that automated evidence cannot settle.
