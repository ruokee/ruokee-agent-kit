# Spec

English | [中文](./spec.zh.md) | [Dictionary](./README.md)

Chinese term: 规格

A statement of a target state and its acceptance, as a long-term component or repository spec under `.agents/spec/` or as a Task Spec for one Task.

## Mechanism

A spec describes the target state, not the implementation or its history. It links the decisions that own the reasons behind its rules and must not conflict with a current decision. When a choice changes a component's goals, boundaries, or acceptance, the spec changes in the same change.

## Task Spec

The requirement basis for one Task: its problem and intended outcome, observable scenarios, constraints, acceptance conditions, and confirmed non-goals. It may come from the conversation or an existing requirement source and needs no separate file. When saved, it normally lands in `spec.md` in the owning Task's material directory. Design reasoning and unresolved choices stay outside the Task Spec. A Task Spec follows the Task's lifecycle and does not replace a repository or component spec; a required repository spec is incorporated during authorized execution.

## Example

`.agents/spec/repository.md` states the repository layout, invariants, and acceptance criteria that the rule and documentation layers serve.

## Avoid

Avoid using "spec" for a one-off design note or for an ADR. An ADR records why a choice was made; a spec states what is currently targeted.

## Invariant

A property a spec requires to remain true across changes, independent of implementation details. An invariant is a testable property of the result, not a step in the work.

## Acceptance criterion

An observable condition that distinguishes a conforming result from a deviation. Acceptance criteria follow the requirements and project rules; they do not invent benefit measurements or gates.

## Public surface

The commands, formats, files, and behaviors that users or other components rely on and that a change must preserve or update. A spec names the surface; the owning documentation holds the detailed reference.

## Out of scope

Work or content a component or repository area explicitly does not cover. A deferral is not automatically a permanent exclusion; state which one it is.
