# Evaluation-Driven Architecture

Turn "good enough" in an LLM system into criteria you can check. Use exact checks for explicit contracts, and representative cases with semantic scoring where several answers can be valid. Match evaluation effort to failure costs. For a small tool, a repeatable comparison beats waiting forever for an evaluation platform.

## Verbatim assertion cannot cover non-deterministic output

`assert summarize(x) == "the expected sentence"` looks reassuring, but an open-ended summary can make it a trap for valid paraphrases. Sampling, model versions, and context change the wording; both answers may mean the same thing, yet a literal comparison reports a bug. Use semantic criteria such as factual accuracy and coverage of key points. Keep precision where it belongs: output formats, allowed values, authorization, refund idempotency, and state transitions can retain their assertion and contract tests. A model's freedom to rephrase does not extend to the refund amount.

Harder to spot is **silent regression**. Upgrade the model or change one line of system prompt, and ordinary answers become smoother while a class of refund-policy answers starts going wrong. Existing deterministic tests may stay green; a user complaint may arrive first. Compare the same representative cases before and after the change. Look at the overall quality distribution, individual failures, and high-risk categories. A higher average does not cancel out an unauthorized payment.

## The eval trio

**Eval set**: a batch of representative inputs plus expected points per item. Points/criteria, not verbatim standard answers. Example: the user asks "the shoes I bought last week came unglued—can I return them?" The expected points: cites the warranty policy, gives a clear yes/no, invents no nonexistent policy, appropriate tone—score how many points were hit, never compare verbatim.

**Scoring**: who judges good enough.

| Method | Fits | Cost |
| --- | --- | --- |
| Rule/programmatic checks | Objective criteria (keyword presence, format, citations present) | Cheap and stable; only judges hard criteria |
| LLM-as-judge | Subjective quality (is the answer good, is it relevant) | Flexible, but the judge is itself non-deterministic, fallible, and token-burning |
| Human sampling | Calibrating the other two; backstopping high-value scenarios | Good for defining standards and calibration, but limited by inter-annotator agreement, domain expertise, and cost |

Practice: rules first where rules can judge; LLM-as-judge for the subjective; regular human sampling to calibrate the judge—never blindly trust the model judge; it is also a model that errs (with a preference for long answers, for instance).

**Gates.** Evaluation results need to affect release decisions. Filing a pretty report after the run does not stop regression. For frequent releases or consequential use, wire suitable evaluations into CI; a small, low-risk tool can start with a short, repeatable local comparison. Set release criteria before inspecting candidate scores. Do not move the pass mark after the exam. A drop from 0.82 to 0.81 in one run may be noise, while an increased total can still hide a high-risk failure. When using statistical quality gates:

- Record model, prompt, data, and decoding settings; hold unrelated factors fixed and identify the intended change;
- Set hard criteria for high-risk behavior such as unauthorized payments; do not average those failures away;
- Tolerance bands, not single lines, on overall metrics;
- Repeat runs with averaged scores or paired comparison for components with randomness (sampling temperature, LLM judge);
- Report effect size and uncertainty where the sample supports them; otherwise state the evidence limit and gather more cases before claiming a regression;
- Calibrate the LLM judge against a human-labeled set and monitor its bias (e.g., the long-answer preference).

## Start small, from real failures

A newcomer hears "eval set" and dreams of thousands of items—then never starts. The correct posture:

1. **Seed from real production bad cases.** Every user complaint and every wrong-answer screenshot is the most valuable sample—they are real failures, not imagined ones. A dozen or two dozen items are enough to start running.
2. **Offline and online, two legs.** Offline eval: a fixed dataset wired into CI, gatekeeping before release. Online eval: sample and score real traffic or shadow-run scoring, gatekeeping after release—the real distribution is always more devious than the dataset.
3. **Keep adding cases.** Every newly discovered failure mode becomes one more eval item, exactly like writing regression tests. The eval set is alive and grows with the system.

Do not wait for the perfect eval set; get the loop running with a rough one first.

## Eval does not replace traditional testing; it adds a layer

Keep traditional tests for deterministic behavior and add semantic evaluation for open-ended quality. A refund recommendation needs judgment about policy fit and reasoning. Execution needs explicit assertions and contract tests for authorization, the amount, and executing a repeated request only once. The same business path can need both. Adding an LLM is no reason to march the existing tests out of the building.

The design of caging uncertainty away from side effects pays off again here: the deterministic parts can still be tested with deterministic means.

## Eval's costs and traps

Treating eval as an architectural component means weighing its costs like any component:

- **Money and time.** Every sample makes a real model call, and LLM-as-judge adds another call per scored item. Larger sets and more frequent runs cost more; balance coverage against cost.
- **Judges err.** LLM-as-judge is non-deterministic and biased; calibrate with human sampling and never treat its score as gospel.
- **Overfitting and aging.** Tuning against a fixed eval set for long optimizes for the test; out-of-set samples may not benefit; when the business changes, the old eval set goes stale. Keep it updated—an outdated eval is worse than none.

Eval can act as an AI system's quality fitness function, turning the answer quality you care about into recorded checks that can fail and affect release. When changing a model or prompt, comparable cases and inspectable failures beat betting blindly that nothing got worse. Set gates by risk and sample evidence, investigate meaningful regressions, and keep the failed cases. Passing one exam does not mean knowing every answer. Unseen inputs still call for production observation and new cases.

## Relationship to other documents

- The full account of non-determinism, the root constraint, is in [AI-era judgment](./01-ai-era-judgment.md).
- Shadow runs (the vehicle of online eval) are in [Evolution and migration](../12-evolution-and-migration.md).
- Fitness functions (the automated check of architecture boundaries) are in [Evolution and migration](../12-evolution-and-migration.md).
- The tradeoff framework of coverage versus cost is in [Thinking and tradeoffs](../01-thinking-and-tradeoffs.md).
