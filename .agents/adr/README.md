# Architecture decision records

English | [中文](./README.zh.md) | [Glossary](./glossary.md)

An **ADR** records the rationale and contract of a durable repository decision. ADRs are not progress logs, release notes, temporary plans, or summaries of routine changes.

## When to use an ADR

Search existing proposals and current decisions before planning a requirement. Determine whether the requirement adds an unrelated capability, extends a current decision without conflict, or conflicts with a current decision.

Create or update an ADR when a choice has real alternatives and changes a long-lived boundary such as architecture, ownership, a public or host contract, a persisted format, compatibility, or repository-wide development and release policy.

Do not create one for a local bug fix, mechanical refactor, ordinary documentation update, status report, or temporary plan unless it changes one of those boundaries.

## Location and document types

This repository uses `.agents/adr` as its ADR root:

```text
.agents/adr/proposal/yyyy-mm-dd-topic-title.md
.agents/adr/decision/yyyy-mm-dd-topic-title.md
.agents/adr/rejected/yyyy-mm-dd-topic-title.md
.agents/adr/archived/yyyy-mm-dd-topic-title.md
```

`proposal` and `decision` are the two document types. `proposal/` contains active proposals and `rejected/` contains rejected proposals. `decision/` contains current decisions and `archived/` contains archived decisions. The directory expresses both type and state, so ADR files do not contain a `Status` field.

Use `Create decision`, `Update decision`, and `Reverse decision` as action phrases. `Reverse decision` is a verb phrase, not a noun label. A new decision links to an archived decision with `Reverses`; the archived decision links back with `Reversed by`.

The filename date records the first proposal and does not change when a pair moves. Use a short English slug. The complete filename, including the date, language suffix, and extension, must not exceed 60 characters.

Keep all four lifecycle directories in Git with `.gitkeep`, including when they contain ADR files.

Each glossary entry names the corresponding term in the other language within its concise definition.

## Bilingual files

Each ADR is one same-directory pair:

```text
yyyy-mm-dd-topic-title.md
yyyy-mm-dd-topic-title.zh.md
```

The unsuffixed file is English and the default public link. The `.zh.md` file is the Chinese audit copy. Both are semantically authoritative and must move together.

Authors may begin in either language, but both files must be complete in the same change. A semantic conflict blocks merge until the maintainer resolves it. Paths, commands, API names, metadata field names, and code identifiers retain their repository spelling.

Place reciprocal language links immediately below the complete metadata block. Keep the owner and writer fields identical across the pair. A proposal names them `Draft owner` and `Draft writer`; a decision names them `Decision owner` and `Decision writer`. The owner field names the accountable maintainer, and the writer field records the original writer, which does not change during later maintenance. Put relationship and lifecycle fields such as `Reverses`, `Archived`, and `Reversed by` after the writer field and before the language links.

## Proposal format

Document the active form before the rejected form.

### Active proposal

English header:

```markdown
# ADR proposal: <title>

Draft owner: <name>
Draft writer: <writer>

English | [中文](./<filename>.zh.md)
```

Chinese header:

```markdown
# ADR 提案：<标题>

Draft owner: <name>
Draft writer: <writer>

[English](./<filename>.md) | 中文
```

The body uses these required sections:

```markdown
## Motivation
## Proposal
## Alternatives considered
## Acceptance criteria
## Risks
```

The Chinese body uses `## 动机`, `## 提议`, `## 考虑过的替代方案`, `## 验收标准`, and `## 风险`.

Merge an approved proposal to `main` as a dedicated change before implementation begins. Implementation starts from the resulting `main` on a new short-lived branch. One proposal may create several decisions, reverse several decisions, or do both.

After implementation, create the new decisions, update decisions that do not conflict, reverse conflicting decisions, and remove the consumed proposal in the implementation change. Git history preserves the proposal as the independently merged rationale.

### Rejected proposal

Move the bilingual proposal files to `rejected/`, add `## Rejection reason` or `## 拒绝原因`, and freeze them after factual link repairs. Keep a rejected proposal only while its rationale prevents a realistic mistake.

## Decision format

Document the current form before the archived form.

### Current decision

English header:

```markdown
# ADR decision: <title>

Decision owner: <name>
Decision writer: <writer>

English | [中文](./<filename>.zh.md)
```

Chinese header:

```markdown
# ADR 决定：<标题>

Decision owner: <name>
Decision writer: <writer>

[English](./<filename>.md) | 中文
```

The body uses these required sections:

```markdown
## Motivation
## Decision
## Alternatives considered
## Consequences
```

The Chinese body uses `## 动机`, `## 决定`, `## 考虑过的替代方案`, and `## 结果`.

### Update decision

When new content does not conflict with a current decision, append it under a final `## Changes` or `## 变更` section. Record each update under a dated level-three heading. Link a new decision when the added content deserves its own ADR.

### Reverse decision

Do not rewrite a current decision to express a conflicting choice. Create a proposal that names every decision to reverse. After implementation, combine each old decision's still-effective rules with the accepted proposal into a complete new decision.

Add `Reverses` to the new decision's header metadata block and `Reversed by` to each archived decision's header metadata block. Move both old-language files to `archived/` in the same change.

### Archived decision

An archived decision keeps the decision format, adds `Archived: YYYY-MM-DD` to its header metadata block before an optional `Reversed by`, and becomes frozen after relationship links and factual link repairs. Current documentation must not cite it as current authority.

## Authoring rules

`## Motivation` opens both document types and states the concrete reason for considering or adopting the choice.

When reviewing `## Alternatives considered` and `## Risks`, require the ADR to identify the requirement discussion or analysis in which each alternative became a real option and to name the harmful outcome of each risk. Delete unsupported or misclassified entries instead of rewriting them to sound plausible.

Use descriptive level-three headings inside a required section when its content needs structure. Do not replace required level-two headings or use subsections for progress history and copied implementation inventories.

### Alternatives considered

The required `## Alternatives considered` section records the result of checking for real alternatives. It does not require the author to produce alternatives when none existed.

Do not invent alternatives to make an ADR look complete. Record only options that already existed when the ADR was drafted or were genuinely considered while discussing or analyzing the requirement. An option that is merely imaginable, but never entered the choice, is not a considered alternative.

Each entry must be a different course of action for the same decision. A fact about the current repository, a requirement or constraint, an acceptance criterion, an implementation detail, or a restatement of the proposal is not an alternative.

If no entry meets these rules, write only `None` in the English section and only `无` in the Chinese section. That is a complete section, not missing content.

### Risks

The required `## Risks` section records credible ways the proposal could cause harm. It does not require the author to produce risks when none are known.

Do not invent risks to make an ADR look complete. A risk must describe a plausible harmful outcome caused by adopting the proposal or by failing to address or consider something relevant. Name the harmful outcome. A fact, requirement, constraint, invariant, acceptance criterion, or task is not a risk by itself.

For example, `Behavior must remain consistent` states a constraint, not a risk. A risk needs a credible failure path, such as separate implementations drifting and producing inconsistent behavior. The relevant failure path depends on the ADR.

If no entry meets these rules, write only `None` in the English section and only `无` in the Chinese section.

## Maintenance

The maintainer owns proposal approval, rejection, and decision archival. An Agent may draft and implement ADR changes within an authorized change, but must not make those lifecycle decisions without explicit approval.

Move both language files together and repair inbound links in the same change. Keep current decisions accurate when factual paths, names, or verification entry points move. Never use factual maintenance to reverse a decision.

The first version uses review, repository search, and Git history rather than a dedicated Skill, classification system, archive manifest, or custom checker. Add a mechanical check only after repeated maintenance or an observed failure identifies a concrete invariant.
