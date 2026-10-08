# ADR proposal: Rewrite the well-said Skill

Draft owner: Ruokee
Draft writer: OMP

English | [中文](./2026-10-08-rewrite-well-said.zh.md)

## Motivation

Rewrite `well-said` as a bilingual Skill for natural, direct expression, with source attribution and licenses outside its writing instructions.

The rewrite starts from the capability's original requirements and source material. The previous Skill is an auxiliary reference, not an acceptance checklist. Differences in section coverage or scope do not by themselves establish a defect in the rewrite.

Writing guidance should tell the agent how to produce useful content. Source attribution and legal notices have a different purpose. Keeping them in adjacent files preserves their availability without making them part of the writing instructions. The files must distinguish Ruokee's authorship of well-said from Lauren Tan's authorship of the reused unslop material.

## Proposal

### Capability and writing guidance

Keep `well-said` as an independently authored, model-invoked Skill. Its usage instruction is "Use when outputting anything", including replies, documentation, code comments, and agent communication. Explicit invocation remains supported. Applying writing guidance does not add permission to modify files or executable content.

Provide complete English and Chinese writing guidance in each component's `SKILL.md`. Organize it around the writing process, style patterns, defensive phrasing, visible writing-session residue, article writing, and author voice. Both variants preserve meaning and the author's actual observations and judgments. Neither version depends on another Skill or repository support files.

Treat defensive phrasing as a possible sign of unfinished work as well as a writing problem. Cover disclaiming conclusions, limits of knowledge, and accounts of work not performed. Both languages include Chinese and English representative expressions, with their harms and appropriate responses. These expressions guide judgment rather than form a banned-word list.

Separate the responses to wording and work problems. State an evidence-supported conclusion clearly when the wording is merely too cautious. Complete missing required work or redo incorrect work within the authorized scope. For sound work, rewrite useful paragraphs around the reader's needs and delete empty ones. Keep facts, material risks, important unknowns, permission conditions, necessary reasoning, and status reports required by the user or applicable workflow.

### Component files, authorship, and version

Keep the English component under `skills/well-said/` and the Chinese component under `variants/zh/skills/well-said/`. Each is a self-contained distributable with the same file set:

- `SKILL.md` contains the writing instructions and the version in frontmatter `metadata.version`.
- `SOURCES.md` and `SOURCES.zh.md` identify authorship, the source revision, and the scope of reused material.
- `LICENSE` carries the repository's Ruokee MIT license for well-said's original material.
- `LICENSE.unslop` preserves the complete Lauren Tan MIT notice for the reused unslop material.

Do not repeat source attribution, license text, or the version in the Skill body. Source documents link only to files inside the component and to the external source. Installing or distributing a component carries its supporting files with it.

Use `1.0.0` as the first formal release version. Revision labels used during drafting are not software versions. Later releases follow the repository's version policy. No package manifest, detector, plugin, or runtime dependency is added to the ordinary Skill.

### Decision to reverse

Reverse [the current well-said decision](../decision/2026-09-12-add-well-said-skill.md) when implementing this proposal. Two explicit clauses conflict with the proposed file layout:

- **Component layout and content ownership** requires source attribution and the full third-party notice in each `SKILL.md`. This proposal places them in adjacent source and license files. Both placements cannot remain mandatory without duplicating material that the writing instructions do not need.
- **Editing and delivery** requires the semantic version in the `SKILL.md` body. This proposal uses `metadata.version` as the single version declaration. Keeping the body requirement would add a second declaration to maintain.

The successor decision must preserve the still-effective first-party ownership, self-contained bilingual distribution, editing authority, semantic preservation, loading, and validation requirements. Its writing guidance reflects the independent rewrite rather than requiring the previous Skill's section inventory or wording. The source attribution and license obligations remain binding after their relocation.

The existing decision remains current until the implementation change replaces it through the repository's ADR process. This proposal does not change the Skill installation mechanism or define an optional strict-mode plugin.

## Alternatives considered

- Continue editing the previous Skill. This was the approach rejected in favor of a rewrite from the original requirements and sources. It would keep the previous text as the starting point rather than adopt the chosen rewrite.
- Keep source attribution, legal notices, and the version in the Skill body. This is the current decision's layout. It mixes distribution information with writing instructions, while a body version would duplicate the proposed frontmatter declaration.

## Acceptance criteria

1. Both language components contain the complete writing guidance and agree on scope, rules, exceptions, examples, and version. Repository capability indexes describe the same usage.
2. Defensive-phrasing guidance explains both the harm and the response, distinguishes work from wording problems, and preserves information that changes the reader's judgment or action. Both languages include representative expressions from both languages.
3. Each component contains its own source documents and both license files. Attribution distinguishes well-said's authorship from the reused material's authorship. Source attribution and legal notices do not appear in the Skill body.
4. Both entry points declare `metadata.version: "1.0.0"`, with no duplicate body version. The complete component can be installed without another component or repository-only material.
5. Required repository checks and the existing real-host, real-model, and semantic-preservation validation requirements are satisfied. Verification checks both missed cleanup and harmful edits, and distinguishes discovery, loading, and actual output behavior.
6. The implementation supplies a complete successor decision, preserves still-effective requirements, updates affected specifications and public documentation, and replaces the old decision through the ADR lifecycle.

## Risks

A distributor that copies only `SKILL.md` could omit the required third-party notice. Each language component therefore includes its own complete supporting files, and distribution must preserve the component directory.

Treating representative expressions as automatic deletion rules could remove useful uncertainty or hide unfinished work. The guidance must distinguish a work problem from a wording problem, and validation must include cases where facts, limits, or required status reports should remain.
