# Handoff

English | [中文](./handoff.zh.md) | [Dictionary](./README.md)

Chinese term: 交接

A durable record that lets a fresh session or agent continue work without the prior conversation.

## Mechanism

A handoff states the goal, accepted decisions, current state, evidence, next steps, stable constraints, and blockers. It is saved in a durable location that the next session can reach, such as a task material file. The next session reads the handoff instead of the old transcript; the old transcript remains available but is not the working context.

## Example

A session approaches its context limit. It writes the current state and next steps to a handoff, and a fresh session continues from that file.

## Avoid

Avoid treating a handoff as a progress log. Avoid recording session permission snapshots or temporary session details. Avoid leaving the next action implicit.

## Related terms

[Task](./task.md), [material](./task.md#material), [subagent](./subagent.md).
