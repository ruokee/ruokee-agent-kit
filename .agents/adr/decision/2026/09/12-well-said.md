# well-said

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash
Reverses: [well-said](../../../archived/2026/09/12-r3-well-said.md)

English | [中文](./12-well-said.zh.md)

## Motivation

Provide complete bilingual writing guidance before use, with internal file organization owned by the Skill.

The predecessor tied complete loading to a single instruction file. Complete guidance is the behavioral requirement; a fixed file count makes internal organization a repository decision. Removing that shape constraint does not permit selective loading of everyday writing rules.

Source credit belongs in the repository README, and license and provenance facts belong in this decision. A legal notice inside the instruction tree can be read as a capability rule. Ruokee's authorship of well-said remains distinct from Lauren Tan's authorship of reused unslop material.

## Decision

### Capability scope

Keep `well-said` independently authored and model-invoked. Its usage instruction is "Use when outputting anything", including replies, documentation, code and configuration comments, and agent communication. Explicit invocation remains available.

Each self-contained language component provides complete guidance on writing process, style patterns, defensive phrasing, visible writing-session residue, article writing, and author voice. Both languages preserve meaning and the author's actual observations and judgments, without depending on another Skill or repository support files.

Defensive phrasing may indicate unfinished work as well as a writing problem. Cover disclaiming conclusions, limits of knowledge, and accounts of work not performed, with Chinese and English representative expressions, harms, and responses. Expressions guide judgment rather than form a banned-word list.

Separate wording problems from missing work. State supported conclusions directly when wording is too cautious. Complete missing work or redo incorrect work within authorization. For sound work, organize useful paragraphs around readers' needs and delete empty ones. Preserve facts, risks, unknowns, permissions, necessary reasoning, and required status reports.

A rewrite starts from original requirements and source material. An earlier Skill is auxiliary evidence, not an acceptance checklist; differences in section coverage alone do not establish a defect.

### Component layout

Use the ordinary Skill language distribution contract. Each language has a `SKILL.md` entry with the version in frontmatter `metadata.version`; the component owns internal guidance organization without a fixed file count. Corresponding language file sets and behavior remain equivalent. Ordinary writing is supported by complete guidance, regardless of its organization.

Do not repeat source attribution, license text, or the version in instruction prose. The repository README credits the source Skill and author; this decision records provenance and license. The first formal release version is `1.0.0`; later releases follow repository version policy. Add no package manifest, detector, plugin, or runtime dependency to the ordinary Skill.

The [first-party capability decision](../08/20-first-party-capabilities.md) separates capability ownership from source authorship. Preserve most source wording, examples, and useful organization in the style section with necessary integration and additions. The retained material comes from [Cursor plugins / pstack](https://github.com/cursor/plugins/blob/99559f2f52047978602ef365589275831e76af07/pstack/skills/unslop/SKILL.md), revision `99559f2f52047978602ef365589275831e76af07`, under the [pstack MIT license](https://github.com/cursor/plugins/blob/99559f2f52047978602ef365589275831e76af07/pstack/LICENSE), copyright Lauren Tan, 2026. Verify provenance, permission, attribution, and notices before distributing further reused material.

### Editing authority

Apply guidance to prose, including code and configuration comments. Preserve quotations, commands, identifiers, original logs, recorded outputs, and other literal material when their purpose or the request requires exact wording. Follow requested files, text, and structure; review remains read-only without editing authority.

Keep unslop's explicit prohibitions binding. The [Skill entry](../../../../../skills/well-said/SKILL.md) provides the writing rules and examples. Authorized structural changes may reorder paragraphs, merge repetition, and rewrite openings or endings. For extensive changes the Agent may ask about a complete rewrite; existing authorization is sufficient, without an arbitrary percentage threshold. Preserve fixed structures.

Check the result against original information and the request. Do not turn untested into unsupported, obligations into completed behavior, or hypothetical designs into existing capabilities. Preserve concrete unknowns and investigate meaningful contradictions instead of polishing them away.

### Loading

Make the complete writing guidance available before applying it. An entry description, summary, or truncated excerpt is insufficient; retrieve missing guidance. Reuse complete text already present without rereading it for every reply, and restore it after context loss. Internal file organization must not make required guidance optional or defer it until a writing symptom appears.

Apply relevant rules together. Corrections, withdrawals, and replacements require checking current requirements and session residue; polishing requires attention to style; repeated self-justification requires checking proof posture. These signals direct attention within complete guidance, not selective retrieval of required rules. Ordinary output follows all applicable rules, and clear text may remain unchanged.

If loading fails, use available rules and preservation boundaries, explain the affected limit when relevant, and do not claim missing content was applied. Verify discovery, complete loading, and compliance separately. Complete loading alone does not prove writing quality. Use fresh-input and regression checks when validating writing behavior.

### Agent communication

Natural-language delegation, handoff, and review feedback serve the receiving agent and later readers. Pass the task, materials, authority, scope, relevant actual state, and acceptance. Short messages need only what changes the receiver's action.

Omit retries, waits, scheduling, and context-reorganization narration unless they affect that action. Preserve blockers, missing permissions, uncertain or partial writes, unmet dependencies, and information preventing duplicate side effects. Never present unfinished or unknown state as complete.

## Alternatives considered

Fix all guidance in one file. This simplifies retrieval but makes harmless reorganization a public contract change. Complete loading remains mandatory without fixing internal shape.

Load only a short core and specialist guides selected by signals. It can save context for rare material but adds selection and retrieval failure paths. Required writing guidance remains complete before use.

## Consequences

Internal organization can change without weakening writing or loading behavior. Complete loading can consume context with details irrelevant to a reply; measure content and loading behavior and keep navigation readable.

Overaggressive cleanup can remove qualifications, migration obligations, evidence, history, or author voice and produce fluent but misleading prose. Preservation rules and paired keep/change cases constrain all guidance; checks cover both missed cleanup and harmful edits.
