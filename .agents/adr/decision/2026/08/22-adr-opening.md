# ADR opening

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol

English | [中文](./22-adr-opening.zh.md)

## Motivation

Rename the first required body heading of every ADR from `Problem` to `Motivation` in both languages.

The fixed `## Problem` opening assumes that every proposed decision responds to a defect or an undesirable situation. Some ADRs instead propose a wanted capability or other new addition. Those decisions have a reason, but do not necessarily begin with a problem.

Writers can force such a proposal into the current structure by inventing a problem scenario. That framing is unnatural and can distort the actual reason for the proposal. The opening section needs a neutral name that covers problems, requirements, and desired additions.

## Decision

The first required body heading in every ADR template is `## Motivation` in English and `## 动机` in Chinese:

- English: `## Problem` becomes `## Motivation`.
- Chinese: `## 问题` becomes `## 动机`.

`Motivation` records why the decision is being considered. Its content may describe an observed problem, a requirement, a desired capability, or another concrete reason for change. It does not weaken the expectation that the section state the reason precisely.

The [record formats](../../../../skills/maintain-adr/references/records.md) and [writing rules](../../../../skills/maintain-adr/references/writing.md) use this heading; [project language supplements](../../../README.md#languages) define its Chinese equivalent. Motivation includes problems, requirements, and desired additions. The [earlier ADR mechanism](../../../archived/2026/08/22-r7-adr-mechanism.md) applied the heading to both proposals and decisions.

Every current proposal and decision template opens with `Motivation`. Historical Git revisions may retain references to the earlier `Problem` heading.

## Alternatives considered

None

## Consequences

Repository history contains both opening headings, but every current ADR uses `Motivation`; the one-time historical search distinction is accepted.

## Changes

### 2026-09-02 Motivation scope

The separate proposal and decision templates both keep `Motivation` as their first required body section.

### 2026-09-23 Standalone opening

The [mechanism decision](../../../archived/2026/08/22-r3-adr-mechanism.md) refines this rule without conflict. The first sentence of `Motivation` identifies the subject and the concrete problem, intended change, or goal without relying on the title, links, or later text, and an optional `## Analysis` section may follow `Motivation`.

### 2026-09-29 Single sentence opening

The [mechanism update](../../../archived/2026/08/22-r3-adr-mechanism.md#2026-09-29-single-sentence-opening) refines this rule. The first paragraph of `Motivation` is one short sentence stating what is to be done, written as the action itself rather than as a description of the record, and the concrete problem, background, reasons, and evidence follow in later paragraphs.

### 2026-10-23 Record scope

The opening rule applies to the decision format retained by the [ADR mechanism](./22-adr-mechanism.md). References above to both templates describe the record types then in use; they do not require retaining a proposal type. Historical proposals keep their original openings. The meaning of `Motivation` and its single-sentence opening remain unchanged.
