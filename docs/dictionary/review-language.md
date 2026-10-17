# Review language

English | [中文](./review-language.zh.md) | [Dictionary](./README.md)

Chinese term: 审查用语

Terms that describe evidence and judgment in a review.

## Mechanism

A review separates what is observed from what is concluded and from what is proposed. Naming each kind keeps a finding checkable and a recommendation open to a decision.

## Fact

Something directly observable in code, configuration, tests, or runtime behavior.

## Inference

A conclusion drawn from facts that may still have another explanation.

## Judgment

An evaluation of evidence against a stated engineering concern or tradeoff.

## Recommendation

A proposed direction or action supported by evidence, not a decision; in a review, the smallest sufficient action for a finding or a clearly framed decision.

## Finding

A supported concern that states the evidence, impact, and recommendation. A stylistic preference alone is not a finding.

## False positive

A plausible concern that does not apply after the surrounding constraints or intent are considered.

## Example

"The handler retries three times" is a fact. "Retries can duplicate the charge" is an inference. "The retry policy needs an idempotency key" is a recommendation. If the payment provider already deduplicates by key, the concern about duplicate charges is a false positive.
