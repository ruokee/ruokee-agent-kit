# Subagent

English | [中文](./subagent.zh.md) | [Dictionary](./README.md)

Chinese term: 子代理

An agent launched by another agent with its own context, task, and result boundary.

## Mechanism

The parent defines a task that is self-contained: the target, the scope, the acceptance, the inputs, and the tools the child may use. The child runs in its own context and returns a result. The parent keeps the plan and the final judgment and integrates the result.

## Example

A parent splits file research into independent slices, sends one slice to each subagent, and integrates their evidence after all results arrive.

## Avoid

Avoid delegating the top-level plan or the whole delivery. Avoid assuming the child can see the parent's conversation. Avoid letting several subagents edit the same file or contract concurrently.

## Related terms

[Agent](./agent.md), [Task](./task.md), [handoff](./handoff.md).
