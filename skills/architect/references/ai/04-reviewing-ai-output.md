# Reviewing AI Output

Reviewing for the omissions specific to AI output: non-determinism backstops, version drift, cost runaway, hallucination and citations, tool permissions, prompt injection. General problems (consistency, resilience, scale, security) reuse the corresponding topic documents; this page only provides routing signals.

## Why AI output needs its own review class

AI can write robust code or deliver a prototype with a smooth demo and brittle failure paths. The model, context, and task all affect the result. Missing timeouts, duplicate refunds, and unauthorized reads need evidence in the actual design, code, and tests; they cannot be deduced from "AI wrote it". One successful run establishes one successful run. Production traffic has not read the demo script.

Failure consequences set the review priorities. A refund path needs authorization and idempotency checks even if the prompt never mentioned them; mentioning them is no reason to skip acceptance either. A checklist helps reviewers revisit easy-to-miss questions, but do not assume AI always misses the same things. Identify the path, the missing behavior, and what happens when it fails, so the finding gives someone a concrete repair to make.

The full checklists for general dimensions are not expanded here; route by signal:

| What you hit | Where to check |
| --- | --- |
| Touches money/inventory: idempotency, concurrency, transaction boundaries | [Consistency](../09-consistency.md) |
| Calls external services/high concurrency: timeouts, retries, degradation, resource caps | [Resilience](../10-resilience.md) |
| Massive users: hotspots, fan-out, pagination, tail latency | [Scaling](../11-scaling.md) |
| User data/multi-tenant: authn, authz, isolation, secrets | [Security and tenancy](../14-security-and-tenancy.md) |

Below, only the AI-specific items.

## The AI-specific checklist

**Non-determinism backstop.** When the model output is wrong or unstable, is there a fallback? Are there guardrails or human review before side effects?

**Version drift.** Was the model version, system prompt, or context assembly changed? Is the change guarded by evaluations? In AI-produced systems these are invisible dependencies—a version swap does not mean unchanged behavior.

**Cost caps.** Does every call/task have token, step, and budget caps? Agent cost grows linearly with steps; a loop without caps is a money-burning machine.

**Hallucination and citations.** Are answers forced onto sources with citations? Is retrieval quality watched? In RAG, is retrieval result treated as untrusted input?

**Tool permissions.** Does the agent execute tools in a sandbox? Are permissions minimized? Do irreversible operations go through human confirmation?

**Prompt injection.** Is all external content (web pages, retrieval results, tool returns, user uploads) treated as untrusted input? Does the defense live in the structural layer (sandbox, allowlist, permissions) rather than the prompt layer?

**Evaluation gap.** Is there an eval preventing silent regression after model or prompt changes? See [Evaluation-driven architecture](./05-evaluation-driven-architecture.md).

## Pick checks by quality attribute

Walking the entire checklist item by item is its own over-engineering. First ask what accident-prone things the code or design touches. Money needs consistency and authorization checks, external calls need timeout and failure handling, and model use needs the applicable quality, permission, and injection checks. A read-only summarizer does not need a refund transaction system. Use the checklist as a question template, not a box-ticking ceremony. Answers need files, tests, or runtime evidence; "fully considered" is not evidence.

## Feed the checklist back for AI self-review; humans make the final judgment

Put applicable checks in the prompt, or in project rules that truly need to persist, and ask AI to check its output against concrete files, tests, and runtime observations. "Which line sets the timeout?" and "Where is the duplicate-request test?" are more useful than asking it to declare the design robust. Self-review may catch a missing timeout or idempotency check, but it may also reuse the original mistaken assumptions. Verify consequential claims independently. Stamping your own certificate harder does not add evidence.

The accountable reviewer makes the final acceptance judgment, especially for money and security. A model can analyze whether eventual consistency is acceptable here and describe latency, duplicate-execution, and reconciliation costs. It cannot invent the business's missing tolerance limits or approve risk on the owner's behalf. "AI has reviewed itself" cannot take over that judgment; required human approval stays required. Save some of the time gained from faster writing for verification, rather than spending all of it on more code.

## Relationship to other documents

- The knowledge behind each checklist item is in [Consistency](../09-consistency.md), [Resilience](../10-resilience.md), [Scaling](../11-scaling.md), [Security and tenancy](../14-security-and-tenancy.md).
- The judgment framework for picking checks by quality attribute is in [Thinking and tradeoffs](../01-thinking-and-tradeoffs.md).
- Writing constraints to the AI beforehand is in [Specifications for AI](./03-specifications-for-ai.md); continuous machine gating is in [Evaluation-driven architecture](./05-evaluation-driven-architecture.md).
