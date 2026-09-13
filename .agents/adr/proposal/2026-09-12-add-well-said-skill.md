# ADR proposal: Add the well-said writing Skill

Decision owner: Ruokee
Draft writer: OMP GPT-6 Astra

English | [中文](./2026-09-12-add-well-said-skill.zh.md)

## Motivation

Agent writing can sound mechanical even when its facts are correct. Stock phrasing, excessive formatting, and repeated qualifications obscure the author's meaning. Corrections can also leave traces in the finished text: labels describing discarded ideas, repeated assurances of compliance, inaccessible draft references, and temporary instructions presented as lasting requirements.

The goal is writing that feels like a person expressing a considered thought, with an appropriate voice and enough information for its reader. Removing writing-session residue is the priority. Style cleanup and reducing unnecessary self-justification support the same goal, provided that facts, uncertainty, useful explanations, and the author's voice survive the edit.

These concerns need one maintainable Skill with shared preservation rules. Provide its complete writing guidance in one file so that ordinary drafting does not depend on recognizing a problem before retrieving the rules that explain it. Style, session residue, and self-justification can occur together and need to be handled together.

## Proposal

### Capability and scope

Add a first-party Skill named `well-said`. The name uses familiar words and fits everyday requests such as "Use well-said to check this text."

Apply it whenever the Agent writes, edits, or reviews user-visible natural language, including replies, reports, documentation, and code comments. Support explicit invocation as well as Agent activation from that scope. Apply the rules while drafting, not only as a cleanup pass after writing.

Executable code and configuration are outside its editing scope. Distinguish comments from executable content in mixed files. Preserve quotations, commands, identifiers, original logs, recorded outputs, and other literal material when their purpose or the request requires exact wording.

The Skill grants no additional file-editing authority. A review request remains read-only unless editing is authorized. Work within the user's requested files, text, and structure.

### Component layout and content ownership

The English component lives at `skills/well-said/`; its complete Chinese variant lives at `variants/zh/skills/well-said/`. Each provides all writing rules, preservation boundaries, and necessary examples in one `SKILL.md`, organized into readable sections.

Keep the required content complete, including the retained unslop material. Do not prebuild specialist reference files. Consider extracting substantial, infrequently used supplementary material only when the actual content and loading measurements justify it; ordinary writing must remain supported by the complete rules in `SKILL.md`.

Follow the [self-contained component decision](../decision/2026-08-24-keep-components-self-contained.md). Each language component includes its own rules and examples, with internal references resolving inside that component. Installed-path examples use `skills/well-said/` in both languages. The component must work without another Skill, personal instructions, private research, or the source repository.

Apply the [first-party capability decision](../decision/2026-08-20-establish-first-party-capability-kit.md) by identifying the capability that is the subject of development and maintenance. A first-party capability may cite, quote, or adapt third-party content. Whether it is a fork depends on whether the third-party capability itself is that subject, rather than on the presence or amount of reused content alone.

`well-said` is the independently designed and maintained capability, with its own purpose, organization, activation rules, and preservation boundaries. unslop supplies external material for its style section. Preserve most of the source wording, examples, and useful organization in `SKILL.md`, with necessary integration changes and additions. The reused material retains its original authorship.

The unslop source lineage includes [Cursor plugins' unslop](https://github.com/cursor/plugins/blob/main/pstack/skills/unslop/SKILL.md). Before incorporating and distributing copied content, identify the exact source revision and local additions, verify the applicable license, and retain required attribution and notices. Capability ownership and source-use obligations are separate questions; the source checks remain to be completed.

The [architect Skill](../decision/2026-08-22-add-manual-architect-skill.md#sources-and-adaptation) provides an existing example: it uses an external architecture repository as a topic map and source material while remaining an independently authored Skill. Its choice to rewrite that material is specific to architect; rewriting is not a general prerequisite for first-party status.

State this general ownership principle in [AGENTS.md](../../../AGENTS.md) and under `Changes` in the first-party capability decision. Clarify the content-boundary wording so that references to or reuse of third-party material within a first-party capability are not treated as importing a third-party capability, fork, or mirror. Retain the prohibition on those third-party capabilities and the source attribution and license obligations. Record well-said's capability contract in its own decision and link it from that update.

Develop the leakage section from the maintainer's existing writing-session cleanup rules, expressed as standalone guidance. Other examples may inform its preservation boundaries without importing their host or repository procedures. Write the proof-posture section around the concrete behavior described below. Consolidate shared rules and keep all sections consistent.

### Core rules

Place the scope, shared preservation rules, essential prohibitions, and brief self-check prominently in `SKILL.md`, alongside the complete subject guidance and examples:

- Write for a reader who has the finished content and its accessible sources. Follow current requirements; remove discarded concepts, correction labels, and references that only make sense inside the writing session.
- Let facts, observations, judgments, and useful actions carry the text. Put necessary reasons and sources beside the claims they support.
- Remove empty compliance assurances, generic self-protection, repeated verification commentary, filler, jargon, and mechanical phrasing. Preserve the author's actual tone, observations, and judgments.
- Preserve facts, numbers, conditions, negation, obligations, uncertainty, sources, and causal strength. Do not invent experiences, positions, measurements, or actors to make text feel human or concrete.
- Leave already clear text alone. Deliver the requested article, answer, diagnosis, or edit without adding an unsolicited cleanup report. Keep useful completion information, real blockers, and requested explanations.

Keep unslop's explicit prohibitions binding. State the essential punctuation rules directly: do not use em dashes, do not replace the same parenthetical construction with parentheses, en dashes, or hyphens, and replace curly quotes with straight quotes. Keep their detailed rules and examples in the same file. Literal-material protection continues to apply.

### Subject guidance

The style section retains unslop's 32 categories, covering inflated content, formulaic language, punctuation and formatting, chatbot phrases, filler, jargon, and plain expression. Terminology lists identify candidates for judgment; they do not authorize blind replacement of technical terms or deletion of real uncertainty.

The leakage section handles visible writing-session residue: correction labels, discarded or superseded requirements, temporary instructions promoted into policy, inaccessible draft or review references, unnecessary process narration, and statements framed around editing rather than the reader's subject. "Leakage" here names a problem in visible text; it does not require access to hidden model reasoning. Preserve valid facts within a contaminated sentence, useful history, migration obligations, actual software versions, and runtime old/new distinctions.

The proof-posture section handles text organized around proving the writer is entitled to make a claim: repeated self-justification, source-ranking or verification narration crowding out the subject, generic disclaimers, and unnecessary intermediate explanation. Reorder paragraphs when useful, consolidate repeated qualifications, and retain concrete evidence and limits where they matter. Tutorials, formal proofs, research methods, reproducibility instructions, audits, and consequential decisions still need their appropriate reasoning and risk information.

### Loading and application

Make the complete `SKILL.md` available before applying the Skill to output. A description, summary, or truncated excerpt is not the complete guidance; retrieve missing content when the host has not provided it. Reuse the full text already available in the current context without rereading it for every response. Restore needed content if context loss makes it unavailable.

Apply the relevant sections together while drafting or editing. Corrections, withdrawals, and replacements require checking current requirements and session residue; polishing requests require attention to style; repeated self-justification requires checking proof posture. These signals guide attention within the available text, not the loading of additional files. Ordinary output also follows the complete applicable rules, and clear text may remain unchanged.

If loading fails, use the available rules and preservation boundaries, explain the affected review limit when relevant, and do not claim the missing content was applied. Verify host discovery, complete loading, and rule compliance separately. Complete loading alone does not establish writing quality.

### Editing and delivery

Allow structural changes within the authorized scope, including reordering paragraphs, merging repetition, and rewriting openings or endings. For a very extensive change, the Agent may ask about a complete rewrite; prior authorization is sufficient, and no arbitrary change-percentage threshold is required. Preserve fixed structures and exact-wording requirements.

Review the result against the original information and current request. In particular, do not turn an untested environment into an unsupported environment, an obligation into completed behavior, or a hypothetical design into an existing capability. Preserve concrete unknowns and investigate meaningful contradictions rather than polishing them away.

Add the Skill to the English and Chinese capability indexes when implemented. Version the two language components consistently under the repository's version policy. The component remains a Skill with guidance and examples; it does not require a detector, scoring service, editing script, or Plugin wrapper.

## Alternatives considered

- Keep general style cleanup in the existing unslop Skill and add a separate leakage Skill. This was considered when choosing the capability boundary. It separates the rules that must jointly preserve meaning and does not provide the chosen unified writing behavior.
- Keep a short core and three specialist guides loaded on demand. This was considered when comparing file layouts. It can reduce context use when substantial specialist material is rarely needed, but adds signal recognition, file retrieval, and combined-guide handling. The complete single file avoids those dependencies for everyday writing; actual context savings and behavioral differences have not been measured.
- Put only navigation in the entry point and require the full unslop guide for every user-visible output. This was considered when deciding how to expose binding prohibitions. It requires additional reading while leaving the entry point unable to provide the unified writing rules on its own.
- Soften unslop's explicit prohibitions into defaults with stylistic exceptions. This was considered when choosing rule strength. The chosen writing preference retains the prohibitions while protecting literal material and meaning.
- Restrict edits to local wording and ask before structural changes. This was considered when choosing editing scope. It would add confirmation for authorized restructuring that proof-posture cleanup can require.

## Acceptance criteria

1. Both language components are complete and semantically aligned. Each `SKILL.md` contains all writing rules, preservation boundaries, and necessary examples, without requiring specialist reference files. Internal references resolve within each component; the public indexes describe the same scope and activation behavior.
2. The source categories, visible-session cleanup, proof-posture guidance, essential prohibitions, and preservation boundaries are covered by rules and examples in that file. Source revision, reuse permission, attribution, and notices are verified before copied content is distributed.
3. Real Harness tests cover luna and ds-flash separately, with both language components exercised. Record the candidate version, actual model and Harness versions, relevant instructions, inputs, outputs, and loading evidence. A proposal or automated repository check is not behavioral validation.
4. Tests cover ordinary drafting, existing-text cleanup, read-only review, authorized file edits, long-form structure, author voice, literal protection, useful explanations and history, and multi-turn additions, corrections, withdrawals, replacements, and temporary instructions. Verify both missed cleanup and harmful edits.
5. Test complete entry loading, reuse of available content, restoration after context loss, partial or unavailable content, explicit invocation, and ordinary host discovery. Include ordinary output and combined style, leakage, and proof-posture cases without requiring specialist file reads. Distinguish loading failures from noncompliance after loading.
6. Compare matched inputs with and without the candidate where supported. Record interference from existing writing rules and distinguish independent behavior from coexistence. If the host cannot provide the independent condition, report that limitation instead of claiming independent effectiveness.
7. Use human semantic judgment, allowing multiple valid rewrites. Style improvement cannot offset altered facts, lost obligations or qualifications, fabricated experience, or unauthorized edits. Judge each model and language separately.
8. Preserve failed outputs, adjust the relevant rules, rerun failures and neighboring preservation cases, and run the full applicable set on both models before acceptance. Test fresh inputs after freezing the candidate; any input used to adjust rules becomes a regression case. Repeat high-risk and previously failing scenarios and report variation rather than selecting the best output.
9. Run the repository's required automated checks. Report real-model results and remaining limitations separately; do not infer effectiveness for untested models, texts, or environments.
10. Repository guidance and the first-party capability decision distinguish capability ownership from third-party source use. The distinction applies generally, including to architect and well-said, and does not infer fork status from reused content alone. Reused material retains its provenance and satisfies its applicable license and attribution requirements.

## Risks

Overaggressive cleanup can erase qualifications, migration obligations, evidence, useful history, or author voice, producing fluent but misleading text. Shared preservation rules and paired keep/change cases must constrain every section.

Loading all guidance can consume context with details irrelevant to a particular response, and a long file can make essential rules easier to overlook. Measure the actual content and loading behavior, keep the structure readable, and check both missed cleanup and harmful edits.

An Agent may fail to discover the Skill, receive only part of its text, lose content from context, or ignore rules that it has read. A single file removes specialist retrieval steps but does not guarantee complete loading or compliance; loading evidence and actual outputs are both needed to locate failures.

Rules within the Skill and existing writing instructions can overlap or conflict, causing inconsistent edits. Existing rules can also mask weaknesses in the candidate and lead to overstated effectiveness.

Tuning rules to familiar examples can improve those examples without helping new writing. Fresh-input tests and regression checks are needed to expose that failure.

Copying source text without verifying its provenance and license can omit required attribution or distribute material without permission. The ownership of the new component does not resolve those obligations.
