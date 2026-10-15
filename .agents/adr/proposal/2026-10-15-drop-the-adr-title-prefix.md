# ADR proposal: Drop the ADR title prefix

Draft owner: Ruokee
Draft writer: OMP

English | [中文](./2026-10-15-drop-the-adr-title-prefix.zh.md)

## Motivation

Remove the type prefix from every ADR title.

The decision [Clarify ADR content boundaries](../decision/2026-09-23-clarify-adr-content-boundaries.md) requires a proposal title to open with `# ADR proposal: ` in English and `# ADR 提案：` in Chinese, and a decision title to open with `# ADR decision: ` or `# ADR 决定：`. Every ADR file carries one of those prefixes.

The lifecycle directory already states the record's type and state: `proposal/` and `rejected/` hold proposals, `decision/` and `archived/` hold decisions. The prefix repeats in the title what the path says, and the colon it carries conflicts with the repository heading rule, which leaves punctuation out of a heading. The same files carry other punctuation the rule forbids, in titles and in subheadings, so the cleanup rewrites them together.

Changing this wording means changing a clause of a current decision, so the repository requires a reversal rather than an edit: the clause is reversed, the reversed decision is archived, and a successor decision carries the rules that stay effective together with the new title form.

## Analysis

No tracked documentation links an anchor that the prefixes create. A search for `#adr-decision-`, `#adr-proposal-`, `#adr-决定`, and `#adr-提案` across tracked Markdown, scripts, and sources returns nothing. Removing the prefix therefore changes no inbound link.

The metadata layout, the language-link placement, and the section ordering follow the same pattern for both record types, so removing the prefix leaves one title form for all four lifecycle directories.

An active proposal, [Add an ADR maintenance skill](./2026-09-03-add-adr-maintenance-skill.md), keeps its prefix until the same cleanup rewrites it.

## Proposal

An ADR title carries the topic alone in both languages: `# <title>` in English and `# <标题>` in Chinese. The directory states the type and the state.

The change covers four parts.

1. `.agents/adr/README.md` and `README.zh.md` stop requiring the prefixes. The proposal and decision header examples open with `# <title>` and `# <标题>`.
2. The successor decision replaces the reversed decision's title clauses and preserves its still-effective rules: the terminology, the proposal workflow, the record format, the authoring rules, the decision lifecycle, the maintenance rules, and the recorded updates under `## Changes`.
3. The reversal follows the ADR rules: the successor decision names `Reverses`, the reversed decision gains `Reversed by` and `Archived:` with the archival date, and both language files of the reversed decision move to `archived/` in the same change.
4. Every ADR title loses the prefix in both languages, together with the other punctuation the repository heading rule forbids in those files, in titles and subheadings alike. The rewritten subheadings include the archived ones that carry an English possessive, such as `Keep a resumed process's first request in the native replay form`.

Step 4 edits files that are frozen. The decision [Clarify ADR content boundaries](../decision/2026-09-23-clarify-adr-content-boundaries.md) records one bounded exception per cleanup it authorizes, limited to the language pairs present when that cleanup begins. This proposal asks for such an exception for this cleanup, covering rewording of titles and subheadings only, and requires every recorded choice, reason, constraint, uncertainty, capability scope, authorship, date, and reversal relationship to survive the edit. The successor decision records the exception.

The consumed proposal is removed in the implementation change, as the ADR rules require.

## Alternatives considered

- Keep the prefix as a format literal, on the reading that the header template rather than prose mandates it. Considered while scoping this change. Rejected because the directory already states the type and state, so the title repeats it, and the colon keeps the conflict with the heading rule unresolved.
- Leave the ADR titles unchanged in this change and clean the other surfaces only. Considered while scoping this change. Rejected because the heading rule covers ADR titles as well, and the unclean files keep the rule and the repository in disagreement.

## Acceptance criteria

- Every ADR title in both languages carries the topic alone, with no type prefix.
- Every heading in an ADR file carries no punctuation the repository heading rule forbids.
- The `.agents/adr/README.md` pair presents the prefix-free title form for both record types.
- The successor decision exists with the reversed decision's still-effective rules, including the terminology, the proposal workflow, the record format, the authoring rules, the lifecycle, and the maintenance rules, while the reversed decision is archived with `Archived:` and `Reversed by` and the successor names `Reverses`.
- The archived pair keeps every recorded choice, reason, constraint, uncertainty, capability scope, authorship, date, and reversal relationship.
- The exception for this cleanup is recorded and limited to the pairs present when the cleanup began.
- No inbound link points at an anchor that the cleanup removes, whether the anchor comes from a title or from a subheading.
- The repository's complete check suite passes.

## Risks

- The title alone can no longer state the record type, so a reader or a script that classifies a record by its title silently misclassifies it. The directory, the reciprocal language links, and the metadata block still state the type.
- Rewriting frozen titles and subheadings can drop recorded content, leaving a historical decision, reason, or reversal relationship missing while the record looks intact. The exception limits the edit to rewording titles and subheadings, and the review compares each archived pair against its earlier revision.
