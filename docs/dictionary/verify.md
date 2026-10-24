# Verify

English | [中文](./verify.zh.md) | [Dictionary](./README.md)

Chinese term: 独立验证

An independent check of a candidate against its requirements and evidence, performed in isolated context and ending in a final verdict.

## Mechanism

Verify judges a stable candidate against effective requirements and evidence without editing it. `passed` means the required result has sufficient evidence; `changes required` identifies an evidenced defect or unmet requirement; `unable to determine` means necessary evidence or prerequisites are missing. [workloop](../../projects/workloop/README.md) owns the assessment procedure and report contract.

Independence means the verifier did not implement the candidate. A fresh context prevents the implementer's reasoning from being read back as confirmation.

## Example

A verifier checked a bilingual decision, ran the documentation checks, and reported `passed` while the merge gate remained outstanding.

## Avoid

Avoid calling a self-check independent Verify. Avoid treating a Verify pass as user acceptance, merge permission, or delivery.

## Related terms

[Ship](./ship.md), [complete check](./README.md).
