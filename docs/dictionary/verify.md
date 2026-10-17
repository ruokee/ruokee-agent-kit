# Verify

English | [中文](./verify.zh.md) | [Dictionary](./README.md)

Chinese term: 独立验证

An independent check of a candidate against its requirements and evidence, performed in isolated context and ending in a final verdict.

## Mechanism

Verify reads the Task, Plan, requirements, the actual candidate, and the applicable rules. It runs the checks the scope requires, compares the result with the acceptance criteria, and reports `passed`, `changes required`, or `unable to determine`. It saves its own report and does not edit the candidate.

Independence means the verifier did not implement the candidate. A fresh context prevents the implementer's reasoning from being read back as confirmation.

## Example

A verifier checked a bilingual proposal, ran the documentation checks, and reported `passed` while the merge gate remained outstanding.

## Avoid

Avoid calling a self-check independent Verify. Avoid treating a Verify pass as user acceptance, merge permission, or delivery.

## Related terms

[Ship](./ship.md), [complete check](./README.md).
