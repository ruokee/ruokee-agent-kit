# Work patterns

English | [中文](./work-patterns.zh.md) | [Dictionary](./README.md)

Chinese term: 工作模式

Ways of dividing work between a person and an agent: human-in-the-loop, AFK, grilling, and prototyping.

## Mechanism

The patterns differ in where a person is needed. Grilling settles requirements before work. Prototyping reduces an unknown before the committed implementation. Human-in-the-loop keeps a person engaged during the session. AFK lets work proceed unattended and returns only decisions that need a person. A task can use more than one pattern.

## Example

A feature starts with grilling, prototypes a risky integration, continues AFK for mechanical slices, and pauses for human review before merge.

## Avoid

Avoid choosing AFK when a decision needs the user's authority. Avoid using grilling to ask questions the code or documentation can answer. Avoid treating a prototype as a deliverable.

## Human-in-the-loop

A work pattern in which a person stays engaged during the session, reviewing, redirecting, or deciding at defined points.

## AFK

A work pattern that lets an agent run unattended and returns only the decisions that need a person.

## Grilling

An interview pattern that asks at most three independent questions per round, with no round limit, records each answer, and closes after a confirmed summary unless the user ends it earlier.

## Prototyping

A work pattern that builds a small runnable version to resolve an uncertainty before the committed implementation.
