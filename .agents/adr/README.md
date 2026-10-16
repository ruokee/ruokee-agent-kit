# Architecture decision records

English | [中文](./README.zh.md) | [Glossary](./glossary.md)

An **ADR** records the rationale and contract of a durable repository decision. ADRs are not progress logs, release notes, temporary plans, or summaries of routine changes. Write for a reader who has only the finished record and its accessible sources.

Read this guide and the [glossary](./glossary.md) before proposing or changing a durable architecture, contract, format, or repository-process decision.

The current target state of each component and repository area is stated in [specifications](../spec/README.md) under `.agents/spec/`. A spec links to the decisions behind it and must not conflict with a current decision.

## When to use an ADR

Search existing proposals and current decisions before planning a requirement. Determine whether the requirement adds an unrelated capability, extends a current decision without conflict, or conflicts with a current decision.

Create or update an ADR when a choice has real alternatives and changes a long-lived boundary such as architecture, ownership, a public or host contract, a persisted format, compatibility, or repository-wide development and release policy.

Confirm with the user whether a requirement needs a proposal; a small or quick change needs no ADR when it changes no durable choice.

Do not create one for a local bug fix, mechanical refactor, ordinary documentation update, status report, or temporary plan unless it changes one of those boundaries.

## Document layout

This repository uses `.agents/adr` as its ADR root:

```text
.agents/adr/proposal/YYYY/MM/DD-name.md
.agents/adr/decision/YYYY/MM/DD-name.md
.agents/adr/rejected/YYYY/MM/DD-name.md
.agents/adr/archived/YYYY/MM/DD-rN-name.md
```

`proposal` and `decision` are the two document types. `proposal/` contains active proposals and `rejected/` contains rejected proposals. `decision/` contains current decisions and `archived/` contains archived decisions. The directory expresses both type and state, so ADR files do not contain a `Status` field.

Use `Create decision`, `Update decision`, and `Reverse decision` as action phrases. `Reverse decision` is a verb phrase, not a noun label. A new decision links to an archived decision with `Reverses`; the archived decision links back with `Reversed by`.

`YYYY` is a four-digit year; `MM` and `DD` are two-digit month and day values. A decision's first proposal date and short canonical English topic name identify the current record and all its archives. Ordinary reversals preserve that identity and current path. `Archived: YYYY-MM-DD` records the actual archival date, and dated `Changes` entries keep their actual event dates.

A proposal uses its own first proposal date, including when it proposes to reverse an older decision. Rejection preserves that proposal date. The proposal's date does not replace the older decision's identity date.

Only archives carry `rN`. The first reversal of a decision produces `r1`; each later reversal increments its own sequence once, without resetting across days, months, or years. Another decision, a language counterpart, multiple relationship links, an ordinary update, a directory move, or a naming correction does not consume a number.

A successor continuing the original topic retains its identity and sequence. An extracted independent topic gets its own first proposal date, canonical name, and sequence while preserving actual source and reversal relationships. A shared predecessor or `Reverses` link alone does not mean shared identity.

Use the identity date for the year, month, and day of both the current decision and every archive, even when archival occurs in another year. Create time directories only for actual records; month directories have no file-count limit. Keep this guide and the glossary at the ADR root.

Apply the [naming rules](../rule/documentation.md#naming) to every retained filename, title, and subsection heading, including topic text after a `Changes` date. Name one subject with a short imperative, phrase, or noun, leaving details in the body. The complete leaf filename, including `DD`, any `rN`, topic, language suffix, and extension, must not exceed 60 characters.

Keep all four lifecycle directories in Git with `.gitkeep`, including when they contain ADR files.

Each glossary entry names the corresponding term in the other language within its concise definition.

## Bilingual files

Each ADR is one same-directory pair:

```text
DD-name.md
DD-name.zh.md
```

Archived pairs instead use `DD-rN-name.md` and `DD-rN-name.zh.md`, with the same date and revision number.

The unsuffixed file is English and the default public link. The `.zh.md` file is the Chinese audit copy. Both are semantically authoritative and must move together.

Authors may begin in either language, but both files must be complete in the same change. A semantic conflict blocks merge until the maintainer resolves it. Paths, commands, API names, metadata field names, and code identifiers retain their repository spelling.

Place reciprocal language links immediately below the complete metadata block. Keep the owner and writer fields identical across the pair. A proposal names them `Draft owner` and `Draft writer`; a decision names them `Decision owner` and `Decision writer`. The owner field names the accountable maintainer, and the writer field records the original writer, which does not change during later maintenance. When a writer field names a model, omit provider, router, and channel prefixes. A host or product name such as `OMP` may remain. Put relationship and lifecycle fields such as `Reverses`, `Archived`, and `Reversed by` after the writer field and before the language links.

## Proposal format

Document the active form before the rejected form. A title carries the topic alone in both languages, and the directory states the type and state.

### Active proposal

English header:

```markdown
# <title>

Draft owner: <name>
Draft writer: <writer>

English | [中文](./<filename>.zh.md)
```

Chinese header:

```markdown
# <标题>

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

The Chinese body uses `## 动机`, `## 提议`, `## 考虑过的替代方案`, `## 验收标准`, and `## 风险`. The English file may add an optional `## Analysis` section, and the Chinese file an optional `## 分析` section, immediately after the motivation section.

Merge an approved proposal to `main` as a dedicated change before implementation begins. Implementation starts from the resulting `main` on a new short-lived branch. One proposal may create several decisions, reverse several decisions, or do both.

After implementation, create the new decisions, update decisions that do not conflict, reverse conflicting decisions, and remove the consumed proposal in the implementation change. Git history preserves the proposal as the independently merged rationale.

### Rejected proposal

Move the bilingual proposal files to `rejected/YYYY/MM/` using the proposal's original date and canonical name without `rN`. Add `## Rejection reason` or `## 拒绝原因`, and freeze them after factual link repairs. Keep a rejected proposal only while its rationale prevents a realistic mistake.

## Decision format

Document the current form before the archived form.

### Current decision

English header:

```markdown
# <title>

Decision owner: <name>
Decision writer: <writer>

English | [中文](./<filename>.zh.md)
```

Chinese header:

```markdown
# <标题>

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

The Chinese body uses `## 动机`, `## 决定`, `## 考虑过的替代方案`, and `## 结果`. The English file may add an optional `## Analysis` section, and the Chinese file an optional `## 分析` section, immediately after the motivation section.

### Update decision

When new content does not conflict with a current decision, append it under a final `## Changes` or `## 变更` section. Record each update under a dated level-three heading. Link a new decision when the added content deserves its own ADR. Purely editorial maintenance creates no new choice and does not require a reversal.

### Reverse decision

Do not rewrite a current decision to express a conflicting choice. Create a proposal that names every decision to reverse and identifies the effective clause, the proposed choice, and why both cannot hold. Code size, an added feature, another host dependency, or a renamed file is not sufficient evidence by itself.

After implementation, combine each old decision's still-effective rules with the accepted proposal into a complete new decision. The successor preserves the still-effective rules within the decision's scope; it does not reproduce the component's implementation specification.

Perform the reversal in one change:

1. Identify the continuing decision by its first proposal date and canonical topic. Inspect its existing archives to choose the next unused revision number in its own sequence, starting at `r1`; do not reset it for a new day, month, or year.
2. Move both replaced language files from `decision/YYYY/MM/DD-name` to `archived/YYYY/MM/DD-rN-name`, keeping the identity date. Never overwrite an earlier archive. Add the actual `Archived: YYYY-MM-DD` before `Reversed by` in its metadata.
3. Write the complete bilingual successor at the unchanged canonical `decision/` path. Its `Reverses` points to the replaced archive, whose `Reversed by` points to its actual successor.
4. Repair earlier direct relationships. When A was reversed by B and C now reverses B, A's `Reversed by` must follow B into B's archive rather than continue to C at the current path. B still links to A; C links to B's archive.
5. Classify affected references by meaning. Current-authority references keep the canonical current path; a citation of a specific historical choice follows that version to its archive. Do not classify by the source file's directory. Recompute relative paths, reciprocal language links, inbound links, and heading fragments in the same change. Stable paths do not make heading fragments immutable.

For example, a decision first proposed on `2026-10-16` keeps `decision/2026/10/16-topic.md` through two reversals that day and further reversals in November and the next year. Those events create `archived/2026/10/16-r1-topic.md` through `16-r4-topic.md`, each with its actual archival date. Another decision starts its own `r1`. An independent topic extracted during a reversal gets a separate identity and starts its own sequence; it does not take the original topic's current path or inherit its counter. Both languages follow the same operations.

### Archived decision

An archived decision keeps the decision format, adds `Archived: YYYY-MM-DD` to its header metadata block before an optional `Reversed by`, and becomes frozen after relationship links and factual link repairs. Current documentation must not cite it as current authority.

## Authoring rules

### Opening the ADR

`## Motivation` opens both document types and states the concrete reason for considering or adopting the choice. Its first paragraph is one short sentence stating what is to be done, which is the choice to adopt or the work to perform. Write that action itself rather than what the record does, and make the sentence understandable without the title, links, or later text. The paragraphs after it carry the concrete problem, background, reasons, and evidence. A wanted capability need not be framed as a defect. A reversal proposal opens with the change it proposes, and a successor decision describes the complete choice it records.

The English file may add an optional `## Analysis` section, and the Chinese file an optional `## 分析` section, immediately after the motivation section and before `## Proposal`/`## 提议` or `## Decision`/`## 决定`. Omit it when there is no substantive analysis. Analysis records only observations, evidence, constraints, reasoning, and uncertainties that affect the choice. It is not an implementation plan or a copy of research notes, and it neither repeats the motivation section nor the alternatives section.

### Necessary contract material

An ADR records a coherent durable choice, its reasons, necessary boundaries and ownership, important public promises, and significant compatibility, safety, cost, and failure consequences. Include a technical detail only when omitting it would prevent the reader from understanding the choice or a material tradeoff, or would lose a contract that must be preserved, and use only the necessary fragment. Configuration authority, immutable identity, and process-wide side effects may be essential even when described with concrete identifiers.

Full API and configuration tables, schemas, command references, and maintained inventories belong in their owning public documentation. Internal function names, algorithm steps, file-by-file edits, execution plans, test commands, and validation logs belong in implementation documentation, code, tests, or task materials. Acceptance criteria describe observable outcomes rather than test procedures. An ADR links accessible public contracts and must not cite ignored task materials as public authority. Keep task execution records, including a task's lifecycle, working branches, commit identifiers, and session-only context, out of an ADR.

Relocating a binding clause does not cancel it. Keep its meaning and an accessible reference, and retain enough original detail in a historical record to explain the choice at that time; a link to changing current documentation cannot replace the historical contract.

### Closed constraints

Distinguish an intentionally closed protocol, ownership rule, or safety boundary from examples and a growing inventory. Prefer a link to the owning inventory over a fixed count or exhaustive file tree, and state the protected boundary and reason when a closed set or prohibition is necessary.

A present scope limit or an option not needed for an initial release is not automatically a permanent prohibition; describe that distinction when writing the decision. Do not retroactively downgrade an existing prohibition to escape it, or add speculative abstractions and configuration solely to make the wording extensible.

Defensive rules must address the actual operation and harm. Ordinary validation, repair, lifecycle changes, and repeated activation may need different preconditions; preserve identity, permission, and side-effect protections instead of replacing them with blanket restrictions unrelated to the protected boundary.

### Reviewing the entries

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

Archived decisions freeze after relationship and factual link repairs, and rejected proposals freeze after factual link repairs. Naming rules apply to every retained record. Correct filenames, titles, headings, identity dates, and revision order using content, relationship fields, proposal sources, and relevant Git history, and correct evidenced relationship errors. The [ADR mechanism decision](./decision/2026/08/22-adr-mechanism.md) defines this maintenance boundary. Preserve every recorded choice, reason, constraint, uncertainty, historical capability scope, original author, actual archival date, and event date. Identity-date normalization changes path dates, not actual events; Git preserves original paths and filename dates. Naming corrections add no reversal, do not unfreeze records, and change no binding promise. Do not leave duplicate old ADR files as compatibility aliases. A historical format example or Git object path may retain its original spelling when that spelling is the fact being cited.

The first version uses review, repository search, and Git history rather than a dedicated Skill, classification system, archive manifest, or custom checker. Add a mechanical check only after repeated maintenance or an observed failure identifies a concrete invariant.
