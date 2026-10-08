# ADR decision: Rewrite the well-said Skill

Decision owner: Ruokee
Decision writer: OMP
Reverses: [Add the well-said writing Skill](../archived/2026-09-12-add-well-said-skill.md)

English | [中文](./2026-10-08-rewrite-well-said.zh.md)

## Motivation

Rewrite `well-said` as a bilingual Skill for natural, direct expression, with source attribution and licenses outside its writing instructions.

The rewrite starts from the capability's original requirements and source material. The previous Skill is an auxiliary reference, not an acceptance checklist. Differences in section coverage or scope do not by themselves establish a defect in the rewrite.

Writing guidance should tell the agent how to produce useful content. Source attribution and legal notices have a different purpose. Keeping them in adjacent files preserves their availability without making them part of the writing instructions. The files must distinguish Ruokee's authorship of well-said from Lauren Tan's authorship of the reused unslop material.

## Decision

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

The [first-party capability decision](./2026-08-20-establish-first-party-capability-kit.md) distinguishes ownership of well-said from authorship of reused material. Preserve most of the source wording, examples, and useful organization in the style section, with necessary integration changes and additions. The [source documents](../../../skills/well-said/SOURCES.md) identify the pinned unslop revision and reuse scope. Verify provenance, permission, attribution, and notices before distributing further reused material.

The complete writing guidance stays in one file. Extract substantial, infrequently used supplementary material only when actual content and loading measurements justify it. Ordinary writing must remain supported by the complete rules in `SKILL.md`.

### Preservation and editing authority

Executable code and configuration are outside its editing scope. Distinguish comments from executable content in mixed files. Preserve quotations, commands, identifiers, original logs, recorded outputs, and other literal material when their purpose or the request requires exact wording.

The Skill grants no additional file-editing authority. A review request remains read-only unless editing is authorized. Work within the user's requested files, text, and structure.

- Write for a reader who has the finished content and its accessible sources. Follow current requirements; remove discarded concepts, correction labels, and references that only make sense inside the writing session.
- Let facts, observations, judgments, and useful actions carry the text. Put necessary reasons and sources beside the claims they support.
- Remove empty compliance assurances, generic self-protection, repeated verification commentary, filler, jargon, and mechanical phrasing. Preserve the author's actual tone, observations, and judgments.
- Preserve facts, numbers, conditions, negation, obligations, uncertainty, sources, and causal strength. Do not invent experiences, positions, measurements, or actors to make text feel human or concrete.
- Prefer returning already clear text unchanged. Deliver the requested article, answer, diagnosis, or edit without adding an unsolicited cleanup report. Keep useful completion information, real blockers, and requested explanations.

Keep unslop's explicit prohibitions binding. State the essential punctuation rules directly: do not use em dashes, do not replace the same parenthetical construction with parentheses, en dashes, or hyphens, and replace curly quotes with straight quotes. Keep their detailed rules and examples in the same file. Literal-material protection continues to apply.

Allow structural changes within the authorized scope, including reordering paragraphs, merging repetition, and rewriting openings or endings. For a very extensive change, the Agent may ask about a complete rewrite; prior authorization is sufficient, and no arbitrary change-percentage threshold is required. Preserve fixed structures and exact-wording requirements.

Review the result against the original information and current request. In particular, do not turn an untested environment into an unsupported environment, an obligation into completed behavior, or a hypothetical design into an existing capability. Preserve concrete unknowns and investigate meaningful contradictions rather than polishing them away.

### Loading and application

Make the complete `SKILL.md` available before applying the Skill to output. A description, summary, or truncated excerpt is not the complete guidance; retrieve missing content when the host has not provided it. Reuse the full text already available in the current context without rereading it for every response. Restore needed content if context loss makes it unavailable.

Apply the relevant sections together while drafting or editing. Corrections, withdrawals, and replacements require checking current requirements and session residue; polishing requests require attention to style; repeated self-justification requires checking proof posture. These signals guide attention within the available text, not the loading of additional files. Ordinary output also follows the complete applicable rules, and clear text may remain unchanged.

If loading fails, use the available rules and preservation boundaries, explain the affected review limit when relevant, and do not claim the missing content was applied. Verify host discovery, complete loading, and rule compliance separately. Complete loading alone does not establish writing quality.

### Agent communication

The writing scope explicitly includes natural-language messages between agents: delegation, task handoff, and review feedback. These messages are written for the agent that will act on them and for whoever reads them later.

- Pass the task, materials, authorization and scope limits, the actual state that affects continued work, and acceptance criteria. A short message needs only the items that change what the receiver does.
- Omit the sender's retries, waits, batch scheduling, and context-reorganization narration unless they change the receiver's next action.
- Keep blockers, missing permissions, unverified or partial writes, unmet dependencies, and information needed to avoid duplicate side effects; do not present an unfinished or unknown state as complete.

### Validation requirements

1. Both language components contain the complete writing guidance and agree on scope, rules, exceptions, examples, and version. Repository capability indexes describe the same usage.
2. Defensive-phrasing guidance explains both the harm and the response, distinguishes work from wording problems, and preserves information that changes the reader's judgment or action. Both languages include representative expressions from both languages.
3. Each component contains its own source documents and both license files. Attribution distinguishes well-said's authorship from the reused material's authorship. Source attribution and legal notices do not appear in the Skill body.
4. Both entry points declare `metadata.version: "1.0.0"`, with no duplicate body version. The complete component can be installed without another component or repository-only material.
5. Real Harness tests use real models and cover two of them separately, with both language components exercised. Record the candidate version, actual model and Harness versions, relevant instructions, inputs, outputs, and loading evidence. A proposal or automated repository check is not behavioral validation.
6. Tests cover ordinary drafting, existing-text cleanup, read-only review, authorized file edits, long-form structure, author voice, literal protection, useful explanations and history, and multi-turn additions, corrections, withdrawals, replacements, and temporary instructions. Verify both missed cleanup and harmful edits.
7. Test complete entry loading, reuse of available content, restoration after context loss, partial or unavailable content, explicit invocation, and ordinary host discovery. Include ordinary output and combined style, leakage, and proof-posture cases without requiring specialist file reads. Distinguish loading failures from noncompliance after loading.
8. Compare matched inputs with and without the candidate where supported. Record interference from existing writing rules and distinguish independent behavior from coexistence. If the host cannot provide the independent condition, report that limitation instead of claiming independent effectiveness.
9. Use human semantic judgment, allowing multiple valid rewrites. Style improvement cannot offset altered facts, lost obligations or qualifications, fabricated experience, or unauthorized edits. Judge each model and language separately.
10. Preserve failed outputs and assess their effect on practical use. Real-model tests expose problems rather than require every observed problem to be fixed before release. When the overall guidance is usable, remaining issues may be recorded for improvement based on real usage. Rule changes require maintainer agreement. After an approved change, rerun failures and neighboring preservation cases and run the full applicable set on both models. Test fresh inputs after freezing the candidate. Any input used to adjust rules becomes a regression case. Repeat high-risk and previously failing scenarios and report variation rather than selecting the best output.
11. Run the repository's required automated checks. Report real-model results and remaining limitations separately; do not infer effectiveness for untested models, texts, or environments.
12. Repository guidance and the first-party capability decision distinguish capability ownership from third-party source use. The distinction applies generally, including to architect and well-said, and does not infer fork status from reused content alone. Reused material retains its provenance and satisfies its applicable license and attribution requirements.

## Alternatives considered

- Continue editing the previous Skill. This was the approach rejected in favor of a rewrite from the original requirements and sources. It would keep the previous text as the starting point rather than adopt the chosen rewrite.
- Keep source attribution, legal notices, and the version in the Skill body. This was the superseded layout. It mixes distribution information with writing instructions, while a body version would duplicate the frontmatter declaration.
- Keep general style cleanup in the existing unslop Skill and add a separate leakage Skill. This was considered when choosing the capability boundary. It separates the rules that must jointly preserve meaning and does not provide the chosen unified writing behavior.
- Keep a short core and three specialist guides loaded on demand. This was considered when comparing file layouts. It can reduce context use when substantial specialist material is rarely needed, but adds signal recognition, file retrieval, and combined-guide handling. The complete single file avoids those dependencies for everyday writing; actual context savings and behavioral differences have not been measured.
- Put only navigation in the entry point and require the full unslop guide for every user-visible output. This was considered when deciding how to expose binding prohibitions. It requires additional reading while leaving the entry point unable to provide the unified writing rules on its own.
- Soften unslop's explicit prohibitions into defaults with stylistic exceptions. This was considered when choosing rule strength. The chosen writing preference retains the prohibitions while protecting literal material and meaning.
- Restrict edits to local wording and ask before structural changes. This was considered when choosing editing scope. It would add confirmation for authorized restructuring that proof-posture cleanup can require.

## Consequences

Overaggressive cleanup can erase qualifications, migration obligations, evidence, useful history, or author voice, producing fluent but misleading text. Shared preservation rules and paired keep/change cases must constrain every section.

Loading all guidance can consume context with details irrelevant to a particular response, and a long file can make essential rules easier to overlook. Measure the actual content and loading behavior, keep the structure readable, and check both missed cleanup and harmful edits.

An Agent may fail to discover the Skill, receive only part of its text, lose content from context, or ignore rules that it has read. A single file removes specialist retrieval steps but does not guarantee complete loading or compliance; loading evidence and actual outputs are both needed to locate failures.

Rules within the Skill and existing writing instructions can overlap or conflict, causing inconsistent edits. Existing rules can also mask weaknesses in the candidate and lead to overstated effectiveness.

Tuning rules to familiar examples can improve those examples without helping new writing. Fresh-input tests and regression checks are needed to expose that failure.

Copying source text without verifying its provenance and license can omit required attribution or distribute material without permission. The ownership of the new component does not resolve those obligations.

A distributor that copies only `SKILL.md` could omit the required third-party notice. Each language component therefore includes its own complete supporting files, and distribution must preserve the component directory.
