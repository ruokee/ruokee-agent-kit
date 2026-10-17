# Ship

English | [中文](./ship.zh.md) | [Dictionary](./README.md)

Chinese term: 交付

The authorized delivery of an accepted result, including local commits and integration into the established target.

## Mechanism

Ship checks that the accepted scope is complete, Verify covers the current candidate, and the project's readiness gates are satisfied. It prepares or confirms a clean committed candidate containing the current target, runs the required checks, and performs the authorized squash merge. Push, publication, deployment, and installation need their own permissions.

## Example

A direct delivery request accepted a proposal, authorized the local squash merge into `main`, and left push unauthorized.

## Avoid

Avoid "deploy" for a local merge. Avoid treating a merge as permission to close the Task or publish the result.

## Related terms

[Verify](./verify.md), [complete check](./README.md).
