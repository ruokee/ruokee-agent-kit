# Specifications for AI

Writing architectural constraints into persistent forms that load automatically when the runtime supports it and that machines can enforce. Use for holding architectural boundaries in AI-assisted development (vibe coding, agent coding): decision records, AGENTS.md-style rule files, and the layered placement of fitness functions.

## Give constraints a life beyond the chat

AI can produce the code; someone still has to make the specifications, constraints, and acceptance criteria clear. Say "remember idempotency on refunds" in chat, and it is in this round's context. Will it survive compression? Will the next session or colleague know it was said? Put constraints that must survive those transitions in the project's maintained records, then load them through runtime support or explicit caller injection. They need an address with a longer lease than the chat window.

For example, refund requests carry an idempotency key, repeated requests return the original result, and execution requires authorization. Write those requirements down, then check them against implementation and tests. AI may infer a requirement you omitted or miss one you emphasized; mutual understanding is not an acceptance test. Turn precisely testable invariants into checks. See [Reviewing AI output](./04-reviewing-ai-output.md) for the review method.

## The specification pyramid

Constraints layer by enforceability, harder and more unavoidable further down:

| Layer | Vehicle | What it constrains | Who reads it |
| --- | --- | --- | --- |
| Decision records | Documents in the project's existing format | Why it was decided, the tradeoffs | Humans + AI (understanding intent) |
| AGENTS.md-style rule files | Standing rules at the project root | Do / do not | AI (auto-loaded when the runtime supports and is configured) |
| Fitness functions / lint / CI | Automated tests | Red lines (violations block) | Machines |

Each layer has a job. Why dual-write was chosen and what it trades away belongs in the decision record. A recurring instruction such as refund idempotency belongs in the rule file. The rule against the domain layer importing the web layer belongs in a dependency check. A small tool may not need all three; maintaining the documents should not become its largest engineering effort. Let machines handle important, repeated checks when the maintenance cost is justified. Documents explain why; automated checks turn red on violations. Both earn their keep.

## Writing a good rule file

`AGENTS.md` / `CLAUDE.md` at the project root, auto-loaded every conversation when the runtime supports and is configured for the mechanism, is the AI's long-term memory. Most people write correct-sounding emptiness:

```
- Write high-quality, maintainable, scalable code
- Follow best practices
- Mind performance and security
```

The AI can do nothing with these—how high is high quality? Whose best practices? The useful form is specific, executable, carries the why, and includes counter-examples:

```
## Data and consistency
- Any interface touching money (charges, refunds) carries an idempotency key;
  a repeated request returns the previous result, never executes twice.
  Background in ADR-003.
- ❌ Never hand the payment API directly to the model; the model's output stops
  at refund proposals—the deterministic refund service does the acting.

## Resilience
- All external calls (model APIs / third parties) must set timeouts; retry with
  backoff only for recoverable errors, within idempotency, time-budget, and
  retry-budget limits. Rationale: dependencies will misbehave; but permanent
  errors, auth failures, exhausted quotas, and calls with non-idempotent side
  effects must not be auto-retried.

## Boundaries
- The domain layer must not import the web layer / framework. CI fails on it.
```

Five disciplines:

1. **Specific enough to execute.** Not "mind security", but "all external input is validated before storage; user content is untrusted input (prompt injection included)".
2. **Carry the why.** Give reasons like an ADR—only when AI and humans know the reason will they refrain from deleting a rule that looks redundant.
3. **Give counter-examples.** Pair an easily misapplied rule with a concrete mistake. "Refunds must be safe" leaves too much open; "the model calls the payment API directly, bypassing authorization" exposes the boundary. Explain what breaks.
4. **Short and sharp.** A rule file is standing context cost, billed by the token. Write the few highest-frequency, most-violated rules; do not write a novel.
5. **Evolve with the code.** An outdated rule is worse than none (it actively misleads the AI); when the rule changes, change it.

When design chooses A over B, keep the tradeoff in the decision record. Distill recurring, actionable constraints into the rule file and link to that rationale. AGENTS.md states the boundaries the AI must respect while working; detailed arguments stay in their primary document. Stuffing the entire decision history into standing context charges you by the token for every small question, while duplicate copies drift into competing accounts.

## If a machine can enforce it, do not settle for a document

The pyramid's bottom layer is the hardest. Constraints sort by machine-verifiability into their destination:

| Constraint | What it becomes |
| --- | --- |
| Domain layer decoupled from the framework | CI dependency check blocks on violation |
| Refund interface requires idempotency | Rule in the rule file; contract test fails on a missing idempotency key |
| A project has adopted a shared model boundary | Dependency check rejects calls that bypass the adopted boundary |
| p99 ceiling of 200ms | Performance test fails on breach |
| Why RAG instead of fine-tuning | Decision record (human-readable only, not machine-verifiable) |

Turn constraints that depend on reminders into checks that turn red. CI does not care whether a human or AI wrote the code; it blocks the violations it covers either way. But a green run only means the written checks passed. Missing tests do not raise their hands. Review still has to trace uncovered behavior and verify the assumptions behind each check.

## Specification is architecture

Writing constraints clearly and putting them where AI can read them is part of architecture work. "Refunds must be safe" leaves too much blank; "check authorization first, execute once per idempotency key" gives implementation and acceptance a shared basis. Ambiguity leaves choices open. Letting the model silently fill those blanks can bury an unmade business decision in code. Identify those choices, have the responsible owner decide, and guard the verifiable parts with checks.

## Relationship to other documents

- How to write decision records (ADRs) is in [Architecture decisions](../07-architecture-decisions.md).
- The full practice of fitness functions against architecture rot is in [Evolution and migration](../12-evolution-and-migration.md).
- Specifications govern before the fact; reviewing AI output after the fact is in [Reviewing AI output](./04-reviewing-ai-output.md).
