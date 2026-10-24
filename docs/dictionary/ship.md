# Ship

English | [中文](./ship.zh.md) | [Dictionary](./README.md)

Chinese term: 交付

The authorized delivery of an accepted result, including local commits and integration into the established target.

## Mechanism

Ship's outcome and readiness gates are project-defined. It acts only within the delivery request's effective grants; a Verify pass does not supply those grants. The [Git rules](../../.agents/rule/git.md) and [development rules](../../.agents/rule/development.md) own this repository's integration procedure. Push, publication, deployment, and installation retain their own permission boundaries.

## Example

A direct delivery request accepted an implementation candidate, authorized the local squash merge into `main`, and left push unauthorized.

## Avoid

Avoid "deploy" for a local merge. Avoid treating a merge as permission to close the Task or publish the result.

## Related terms

[Verify](./verify.md), [complete check](./README.md).
