# Plan

English | [中文](./plan.zh.md) | [Dictionary](./README.md)

Chinese term: 计划

An execution basis for a Task that groups work into independently assessable units with references, actions, acceptance, permissions, and dependencies.

## Mechanism

A Plan connects the intended result to complete, independently assessable work. It makes the execution basis, dependency order, acceptance, and permission boundaries clear. [workloop](../../projects/workloop/README.md) owns its required material and preparation method.

A Plan is not a task list. A list of todos or a tk relationship graph does not supply the references, acceptance, permissions, or dependency order an executor needs.

## Unit

A labeled, independently assessable result inside a Plan, such as U01. Labels are local to the Task; a completed unit keeps its label and evidence when the Plan is revised.

## Example

A feature Plan covers implementation, the affected decisions and rules, and verification of the final candidate.

## Avoid

Avoid treating a Plan as authorization to execute it. Saving a Plan does not grant implementation, merge, or delivery permission.
