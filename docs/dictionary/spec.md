# Spec

English | [中文](./spec.zh.md) | [Dictionary](./README.md)

Chinese term: 规格

A complete, implementation-independent statement of a target and its acceptance, as a long-term component or repository spec under `.agents/spec/` or as a Task Spec for one Task.

## Mechanism

A long-lived spec states the purpose, required capabilities, conditions, observable results, and acceptance completely. After the original implementation and its explanatory material are removed, the spec set still supports rebuilding substantially the same functionality with different internals. It contains no implementation descriptions or repository-file links, including language and decision links. An external index supplies navigation. Bare paths or references to current behavior cannot substitute for requirements.

Authors use confirmed requirements, effective decisions, and relevant sources to establish the target; the spec reader does not need those sources to fill gaps. A spec must not conflict with a current decision. Changes to goals, boundaries, or acceptance update the spec in the same change. ADRs retain the reasons and necessary historical contract; design explains implementation; user documentation remains independently usable.

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

The commands, formats, files, and behaviors that users or other components rely on and that a change must preserve or update. A spec completely states their confirmed requirements, including necessary parameters, quantities, defaults, failures, and compatibility. User documentation explains the same contract for its readers without becoming a prerequisite for understanding the spec.

## Out of scope

Work or content a component or repository area explicitly does not cover. A deferral is not automatically a permanent exclusion; state which one it is.
