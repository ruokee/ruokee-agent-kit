# Agent Note: Maintain English and Chinese public documentation

Status: implemented
Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol

English | [中文](./2026-08-20-maintain-bilingual-public-documentation.zh.md)

## Problem

The repository is public and uses English for code and its default documentation, while Ruokee reviews technical decisions and usage details in Chinese. English-only documentation would remove that audit path. Mixing both languages in every file would double routine reading and make navigation noisy.

The project needs one language policy for user-facing documentation rather than a special exception for the root README.

## Decision

Write code, comments, configuration, and default public documentation in English. Maintain the corresponding Chinese user documentation under `docs/zh/` when behavior or usage changes.

Keep reciprocal language links between corresponding English and Chinese entry points. Each document must make sense on its own. Preserve paths, commands, API names, status values, and code identifiers in English so readers can search for the exact repository form.

Review both language versions in the same change. Require semantic agreement, not sentence-by-sentence or byte-for-byte translation. Chinese may use a more natural explanation as long as it preserves the same behavior, limits, and instructions.

Do not require translations for every internal implementation note, comment, generated file, or maintainer-only artifact. The paired policy applies to public behavior and usage documentation. Agent Notes use the stricter paired format defined by [Add the Agent Note mechanism](./2026-08-22-add-agent-notes.md).

## Alternatives considered

**Publish only English.** This follows common open-source practice but removes Ruokee's Chinese audit entry point.

**Publish only Chinese.** This makes public package, host, and installation decisions harder for non-Chinese contributors to review.

**Interleave both languages in one file.** Every reader would load both copies, search results would repeat, and section structure would become harder to maintain.

**Translate every tracked text file.** Comments, internal notes, generated files, and configuration do not all benefit from a second copy. Mandatory translation would add work without improving public use.

**Allow one language to lag.** That creates two conflicting descriptions of the same behavior. A behavior or usage change must update both public copies together.

## Consequences

English remains the default language for code, configuration, comments, and public documentation. Public behavior and usage changes update the corresponding Chinese documentation in the same change, with reciprocal links between entry points.

Commands, paths, API names, and code identifiers keep their repository spelling. Each language document remains independently readable and semantically agrees with its counterpart. Internal and generated files receive translations only when their audience requires them.

Semantic agreement cannot be proved mechanically. File-pair and link checks can catch omissions, but a person or capable Agent must still compare meaning.

Some public documents have no obvious counterpart. A change defines the pair when behavior or usage first requires Chinese documentation rather than creating empty placeholders.
