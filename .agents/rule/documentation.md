# Documentation

English | [中文](./documentation.zh.md)

The [repository spec](../spec/repository.md) states the language, pairing, and link properties these rules keep true.

## Keeping documents current

- Keep documentation in sync with the code it describes, and update the affected documents in the same change.
- Write code, comments, configuration, and default public documentation in English.
- Maintain a language pair for every ordinary public Markdown page: same-directory `name.md` and `name.zh.md`, entry pages as `README.md` and `README.zh.md`, with reciprocal language links directly below the title of each file.
- Update both languages of a pair in the same change, and keep their meaning aligned.
- Keep Skill language variants in their existing component layouts instead of adding cross-language links between them.

## Naming

- Write a file name and a heading of any level as a short imperative sentence, a short phrase, or a noun, unless an additional requirement calls for another form.
- In a file name, the hyphens and the dot of a language suffix are the symbols the naming form requires rather than punctuation.
- Write no punctuation in a heading of any level. Only `-`, `.`, and `、` are exempt, in any position.
- Do not join several subjects in a file name or a heading with a conjunction such as `and`, `or`, `as well as`, `和`, `且`, `与`, `并`, `或`, or `以及`, or with the enumeration comma, unless an additional requirement calls for several subjects. Choices are no exception. Letters within a word and a prepositional phrase expressing one relation, as in `Relationship to other documents`, do not join subjects.
- Keep a file name and a heading to the one subject they name, and leave its parts to the body. Write `Adjust the Task directory layout` rather than `tk Task directory tree and subtask layout adjustment and rename`. A slash between two names, as in `Observer / Pub-Sub`, lists two subjects rather than one.
- Write the English term of a Chinese variant heading at the first occurrence of that term in the body rather than in parentheses inside the heading.
- An anchor declaration is an anchor rather than heading punctuation. This repository writes none, because its renderer derives a heading's anchor from the heading text, so renaming a heading requires updating the links that point at it in the same change.

## Cleanup

- Check a page with the [`well-said`](../../skills/well-said/SKILL.md) Skill, and clean what it reports before delivering the page.

## File links

- Write repository file links relative to the containing document: prefix a destination in the current directory or a descendant directory with `./`, and use as many `../` segments as needed to reach a file outside that tree.
- Do not use a leading `/`, a repository-root-relative destination, or an absolute GitHub URL for a file in this repository.
- Write the link text for a file from the repository root without a leading `/` when the text names that file.
- Write `AGENTS.md` as inline code rather than a link when a document mentions it. Its reader is the agent working in this repository, not the reader of the public documentation.

## Decisions

- Search the existing proposals and current decisions before planning a requirement, and determine whether it adds an unrelated capability, extends a current decision without conflict, or conflicts with a current decision.
- Read the [ADR rules](../adr/README.md) and the [glossary](../adr/glossary.md) before proposing or changing a durable architecture, contract, format, or repository-process decision.
- Confirm with the user whether a requirement needs a proposal under the [ADR criteria](../adr/README.md#when-to-use-an-adr). A small or quick change needs no ADR when it changes no durable choice.
- Merge a proposal to `main` on its own branch as a dedicated change, and start the implementation from the resulting `main` on a new short-lived branch.
- Write `None` in an English ADR section and `无` in its Chinese counterpart when nothing qualifies, instead of inventing alternatives or risks.
- Add non-conflicting content under `Changes`. Merge a proposal first and create a complete decision that reverses the old one when a choice conflicts.
- Keep English and Chinese counterparts of an ADR pair semantically aligned in the same change, and keep the writer field unchanged during later maintenance.
- Leave proposal approval, rejection, and decision archival to the maintainer. Drafting an ADR within authorized work does not include those lifecycle decisions, and taking one requires the maintainer's explicit approval.
- Keep task execution records, including lifecycle, working branches, commit identifiers, and session-only context, out of an ADR. Write for a reader who has only the finished record and its accessible sources.
- Keep ADR, spec, and rule retrieval in the [planning rules](./development.md#planning).

## Specs

- Read the [spec rules](../spec/README.md) and the affected specs before changing a component's or a repository area's goals, boundaries, or acceptance, and update them in the same change.
- Update the affected spec in the same change as the decision it follows.
