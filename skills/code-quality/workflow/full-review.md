# Full Review — Code Quality

Heavy, systematic review. **User-triggered only** — never enter this mode on your own. Slower and more thorough than fast review, with staged reading and self-verification.

## Trigger

Only when the user explicitly asks for a "full review", "architecture review", "design review", or "refactoring assessment".

## Steps

### 1. Context intake

Before reading widely, write down:

- Review target — what is actually being judged (a module, a subsystem, a refactoring plan, a config).
- Must read — the code, config, or tests central to the target.
- Optional context — adjacent code that may explain a decision.
- Open questions — what is uncertain and might need the user.

### 2. Staged reading

Load reference docs by problem domain, not all at once. Read the nearest `AGENTS.md`/`CLAUDE.md`, then preferences (`.agents/preferences/code-quality.md` or `.agents/preferences/code-quality/index.md`). Pull a principle, pattern, refactoring, or paradigm doc only when a concrete signal points to it. Read code in stages — target first, then widen only as a finding requires.

### 3. Systematic matrix

Work through these dimensions, recording evidence per finding:

- Change direction and cost — what change is likely next, and how expensive the current structure makes it.
- Principle tensions — DRY vs KISS, abstraction vs duplication, flexibility vs YAGNI. Name the tradeoff, don't pick dogmatically.
- Pattern justification — for each named pattern, confirm the variation point it manages actually exists.
- Smell identification — long function, duplicated knowledge, primitive obsession, feature envy, shotgun surgery, divergent change, thin wrappers.
- Paradigm fit — does imperative/OO/functional-core/data-oriented/state-machine match the problem, or fight it.
- Test coverage — is behavior pinned well enough to refactor safely.
- Agent config — if applicable, judge `AGENTS.md`/`SKILL.md`/workflow config for contradiction, dead rules, and clarity.

### 4. Self-verify high-severity findings

For each high-severity finding, re-check the evidence, state your confidence, and actively consider the false positive: could the structure be deliberate, or driven by a reason-to-change you have not seen? Downgrade or drop findings that don't survive this.

### 5. Confirmation stop

Stop and ask before recommending or doing any: cross-file refactoring, architecture migration, or bulk change. Present the plan and its cost; let the user decide.

## Output Format

```text
Findings

- [severity, confidence] path:line Title
  Fact: observable evidence.
  Impact: change cost, readability, correctness, testability.
  Judgment: principle, pattern, smell, paradigm mismatch, or config smell.
  Evidence: support, counter-evidence, and remaining uncertainty.
  Recommendation: smallest sufficient change.
  Verification: command/check, or why none is needed.

Open Questions
- Items needing user or project confirmation.

Notes
- Downgraded, deliberate, or tool-handled items, with why.
```

Group findings by category. Be explicit about what you downgraded and why.

## Stop Rules

- Do not modify code without an explicit ask.
- Confirmation stop on cross-file refactors, migrations, and bulk changes.
- Do not force findings to satisfy a principle, or abstract on similarity alone.
- Do not present preferences as universal engineering truth.
- Separate fact, judgment, preference, and recommendation in every finding.
