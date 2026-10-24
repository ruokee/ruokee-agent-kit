# Task

English | [中文](./task.zh.md) | [Dictionary](./README.md)

Chinese term: 任务

A durable, project-local unit of work managed by tk, with a material directory and a lifecycle.

## Mechanism

tk owns a Task's identity and lifecycle. Stable goals and boundaries, detailed materials, and the chronological WAL have distinct roles. Status is `planning`, `open`, or `closed`; closing requires the maintainer's current confirmation. Storage and operations belong to [tk guidance](../../projects/tk/README.md).

A Task is not a single todo item. Use it when work needs to survive steps, sessions, or Agents, or when its state matters across handoffs.

## Material

A file in a Task's material directory that records analysis, plans, decisions, or evidence for that Task. Keep `TASK.md` for stable, long-lived content and put working detail in separate material files.

## Example

A multi-session feature Task keeps its requirements in `TASK.md` and its plan and verification report in separate material files.

## Avoid

Avoid "ticket" for a tk Task. Avoid putting transient session state or temporary permissions into task materials.
