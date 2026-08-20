# Workflow

This Skill runs in one of three modes. Read the matching document, then act.

| Mode | When | Document |
|-|-|-|
| Fast review | Default. Daily self-check after development, small diff, single-file or PR review. | [fast-review.md](./fast-review.md) |
| Full review | Only when the user explicitly asks for a "full review", "complete review", "systematic review", or "architecture review". | [full-review.md](./full-review.md) |
| Analysis | Discussion, design comparison, mechanism explanation, refactoring planning, project-structure design. No diff to grade. | [analysis.md](./analysis.md) |

Default to fast review. Do not escalate to full review on your own — it is heavier and must be user-triggered. Switch to analysis whenever the user is asking *what to do* rather than *what is wrong*.

All three modes are read-only by default. Modify code only when the user asks for fixes, and stop for confirmation before any unsafe, bulk, or cross-file change.
