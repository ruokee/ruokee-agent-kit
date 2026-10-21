# well-said

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash
Reverses: [well-said](../../../archived/2026/09/12-r2-well-said.md)

English | [中文](./12-well-said.zh.md)

## Motivation

Keep `well-said` as a bilingual Skill for natural, direct expression, with its source credit in the repository README and its license and provenance facts in this decision.

The [previous version](../../../archived/2026/09/12-r2-well-said.md) kept its attribution and license files beside the writing instructions. Neither place fits this material. A Skill file enters the Agent context as instructions, or is read beside them as part of one component, so a legal notice means nothing to a writing session and can read as part of the capability's rules. Attribution and license information serve a reader of the repository, which states them outside the Skill tree.

The rewrite starts from the capability's original requirements and source material. The previous Skill is an auxiliary reference, not an acceptance checklist. Differences in section coverage or scope do not by themselves establish a defect in the rewrite.

The record distinguishes Ruokee's authorship of well-said from Lauren Tan's authorship of the reused unslop material.

## Decision

### Capability scope

Keep `well-said` as an independently authored, model-invoked Skill. Its usage instruction is "Use when outputting anything", including replies, documentation, code comments, and agent communication. Explicit invocation remains supported. Applying writing guidance does not add permission to modify files or executable content.

Provide complete English and Chinese writing guidance in each component's `SKILL.md`. Organize it around the writing process, style patterns, defensive phrasing, visible writing-session residue, article writing, and author voice. Both variants preserve meaning and the author's actual observations and judgments. Neither version depends on another Skill or repository support files.

Treat defensive phrasing as a possible sign of unfinished work as well as a writing problem. Cover disclaiming conclusions, limits of knowledge, and accounts of work not performed. Both languages include Chinese and English representative expressions, with their harms and appropriate responses. These expressions guide judgment rather than form a banned-word list.

Separate the responses to wording and work problems. State an evidence-supported conclusion clearly when the wording is merely too cautious. Complete missing required work or redo incorrect work within the authorized scope. For sound work, rewrite useful paragraphs around the reader's needs and delete empty ones. Keep facts, material risks, important unknowns, permission conditions, necessary reasoning, and status reports required by the user or applicable workflow.

### Component layout

Keep the English component under `skills/well-said/` and the Chinese component under `variants/zh/skills/well-said/`. Each is a self-contained distributable holding only `SKILL.md`, which contains the writing instructions and the version in frontmatter `metadata.version`.

Do not repeat source attribution, license text, or the version in the Skill body. The repository README credits the source Skill and its author; this decision records the upstream path, the pinned revision, and the license.

Use `1.0.0` as the first formal release version. Later releases follow the repository's version policy. No package manifest, detector, plugin, or runtime dependency is added to the ordinary Skill.

The [first-party capability decision](../08/20-first-party-capabilities.md) distinguishes ownership of well-said from authorship of reused material. Preserve most of the source wording, examples, and useful organization in the style section, with necessary integration changes and additions. The retained wording comes from [Cursor plugins / pstack](https://github.com/cursor/plugins/blob/99559f2f52047978602ef365589275831e76af07/pstack/skills/unslop/SKILL.md), revision `99559f2f52047978602ef365589275831e76af07`, under the [pstack MIT license](https://github.com/cursor/plugins/blob/99559f2f52047978602ef365589275831e76af07/pstack/LICENSE), copyright Lauren Tan, 2026. Verify provenance, permission, attribution, and notices before distributing further reused material.

The complete writing guidance stays in one file. Extract substantial, infrequently used supplementary material only when actual content and loading measurements justify it. Ordinary writing must remain supported by the complete rules in `SKILL.md`.

### Editing authority

Executable code and configuration are outside its editing scope. Distinguish comments from executable content in mixed files. Preserve quotations, commands, identifiers, original logs, recorded outputs, and other literal material when their purpose or the request requires exact wording.

The Skill grants no additional file-editing authority. A review request remains read-only unless editing is authorized. Work within the user's requested files, text, and structure.

Keep unslop's explicit prohibitions binding; [skills/well-said/SKILL.md](../../../../../skills/well-said/SKILL.md) holds the punctuation rules, their examples, and the writing rules themselves. Literal-material protection continues to apply.

Allow structural changes within the authorized scope, including reordering paragraphs, merging repetition, and rewriting openings or endings. For a very extensive change, the Agent may ask about a complete rewrite; prior authorization is sufficient, and no arbitrary change-percentage threshold is required. Preserve fixed structures and exact-wording requirements.

Review the result against the original information and current request. In particular, do not turn an untested environment into an unsupported environment, an obligation into completed behavior, or a hypothetical design into an existing capability. Preserve concrete unknowns and investigate meaningful contradictions rather than polishing them away.

### Loading

Make the complete `SKILL.md` available before applying the Skill to output. A description, summary, or truncated excerpt is not the complete guidance; retrieve missing content when the host has not provided it. Reuse the full text already available in the current context without rereading it for every response. Restore needed content if context loss makes it unavailable.

Apply the relevant sections together while drafting or editing. Corrections, withdrawals, and replacements require checking current requirements and session residue; polishing requests require attention to style; repeated self-justification requires checking proof posture. These signals guide attention within the available text, not the loading of additional files. Ordinary output also follows the complete applicable rules, and clear text may remain unchanged.

If loading fails, use the available rules and preservation boundaries, explain the affected review limit when relevant, and do not claim the missing content was applied. Verify host discovery, complete loading, and rule compliance separately. Complete loading alone does not establish writing quality.

Use fresh-input tests and regression checks when validating the writing rules.

### Agent communication

The writing scope explicitly includes natural-language messages between agents: delegation, task handoff, and review feedback. These messages are written for the agent that will act on them and for whoever reads them later.

- Pass the task, materials, authorization and scope limits, the actual state that affects continued work, and acceptance criteria. A short message needs only the items that change what the receiver does.
- Omit the sender's retries, waits, batch scheduling, and context-reorganization narration unless they change the receiver's next action.
- Keep blockers, missing permissions, unverified or partial writes, unmet dependencies, and information needed to avoid duplicate side effects; do not present an unfinished or unknown state as complete.

## Alternatives considered

- Keep a short core and three specialist guides loaded on demand. It can reduce context use when substantial specialist material is rarely needed, but adds signal recognition, file retrieval, and combined-guide handling. The complete single file avoids those dependencies for everyday writing.

## Consequences

Overaggressive cleanup can erase qualifications, migration obligations, evidence, useful history, or author voice, producing fluent but misleading text. Shared preservation rules and paired keep/change cases must constrain every section.

Loading all guidance can consume context with details irrelevant to a particular response, and a long file can make essential rules easier to overlook. Measure the actual content and loading behavior, keep the structure readable, and check both missed cleanup and harmful edits.
