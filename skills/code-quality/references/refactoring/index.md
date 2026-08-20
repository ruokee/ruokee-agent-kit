# Refactoring

Reference documents for Martin Fowler-style refactoring: behavior-preserving restructuring driven by code smells. The aim is not "tidy code for its own sake" but a disciplined practice — recognize a symptom, protect the current behavior, then apply a small, named, reversible transformation. This directory holds the framework documents, the smell catalog, and individual leaf documents for the smells and refactorings that come up most often in day-to-day and agent-assisted work.

Start with the framework if you are deciding *whether* and *how* to refactor. Go to a specific smell document when you have already spotted a symptom and want to understand it and its fix. Go to a refactoring document when you know the move you want to make.

## Framework

| Question | Read |
|-|-|
| What is refactoring, when should I do it, when should I not | [fowler-refactoring.md](./fowler-refactoring.md) |
| What is a code smell, which category is this, is it worth fixing now | [code-smells.md](./code-smells.md) |
| How do I refactor without breaking behavior | [safe-refactoring.md](./safe-refactoring.md) |

## Smells

| Symptom | Read |
|-|-|
| Function does too much, mixes abstraction levels, hard to name | [long-function.md](./long-function.md) |
| Same knowledge expressed in several places | [duplicated-code.md](./duplicated-code.md) |
| Strings/ints/dicts used where a domain type belongs | [primitive-obsession.md](./primitive-obsession.md) |
| Method uses another object's data more than its own | [feature-envy.md](./feature-envy.md) |
| One logical change forces edits in many places | [shotgun-surgery.md](./shotgun-surgery.md) |
| One module changes for many unrelated reasons | [divergent-change.md](./divergent-change.md) |
| Function only forwards a call or renames without adding value | [thin-wrapper-function.md](./thin-wrapper-function.md) |

## Refactorings

| Move | Read |
|-|-|
| Pull a coherent fragment into its own named function | [extract-function.md](./extract-function.md) |
| Fold a function back into its callers | [inline-function.md](./inline-function.md) |
| Relocate behavior to a better owner | [move-function.md](./move-function.md) |

Smells and refactorings are two sides of one practice: a smell names the problem, a refactoring names the cure. The smell documents point to the refactorings that resolve them, and the refactoring documents note the smells that motivate them. For the principles behind these judgments — DRY, the Rule of Three, single responsibility — see `skills/code-quality/references/design-principles`.
