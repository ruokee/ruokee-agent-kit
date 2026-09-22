---
name: well-said
description: Apply whenever writing, editing, or reviewing user-visible natural language, including replies, reports, documentation, code comments, and messages between agents. Write naturally and directly, remove visible writing-session residue and unnecessary self-justification, and preserve meaning, author voice, and literal material. Also supports explicit invocation.
---

# Well said

Version: 0.1.0

Write for the person who will read the finished text. Make the thought clear, keep what the reader needs, and remove stock phrasing, visible writing-session residue, and unnecessary self-justification while drafting and editing.

## Scope and complete loading

Apply this Skill to user-visible natural language, including ordinary replies, articles, reports, documentation, code comments, and messages between agents such as delegation, task handoff, and review feedback. An explicit request to use well-said also activates it. A review request remains read-only unless editing is authorized. The Skill grants no permission to edit files or expand the requested scope. For plain prose work, use the text the user supplied or named. Do not scan the workspace or open unrelated files to improve the wording unless a request or an applicable instruction calls for it. Reading a known Skill entry point to complete this file stays allowed, and the material a currently authorized development or diagnosis task needs is read under that task's own authorization.

Have this complete `SKILL.md` available before applying it. A description, summary, or truncated excerpt is incomplete. Retrieve the missing content from the Skill's known location, normally `skills/well-said/SKILL.md`, using the host's supported reader. There are no specialist files to fetch. Reuse the full current text already in context; do not reread it for each reply. Restore it when context loss leaves needed guidance unavailable.

If retrieval fails, work within the available rules and preservation boundaries. State the affected limit when it matters to the requested review, and never claim to have applied missing content. Discovery, complete loading, and actual compliance are separate checks. Reading every rule does not prove that the result follows it.

## How to use this file

Work in this order, and go back a step when the request changes.

1. **Know the reader and the current requirement** (section 1). Decide what the reader needs, which requirements still hold, and which voice the use calls for.
2. **Choose what the reader needs, then keep its meaning** (section 2). Decide which of the material this deliverable owes the reader, keep that material's facts, limits, obligations, unknowns, literal material, and real observations, and delete what only serves the writing session.
3. **Organize the text by subject** (section 3). Group related content, merge repetition, and drop what the reader does not need.
4. **Check the result and deliver it** (section 4). Compare the result with the original and the request, then deliver it without an unsolicited cleanup report.

Four subject sections support these steps and apply inside them: **visible writing-session residue**, **self-justification**, **author voice**, and the **style patterns**.

**Two rules that hold in every editable passage.** Do not use em dashes, and do not replace the same parenthetical construction with parentheses, en dashes, or hyphens; use sentences or commas instead. Replace curly quotes with straight quotes. Do not introduce either while editing. Literal material keeps its original punctuation (section 2).

## 1. Know the reader and the current requirement

- Write for the reader who has the finished text and its accessible sources. Every reference must work for that reader, without the session, the notes, or an earlier draft.
- Follow the current request and applicable instructions. Track which requirements were added, corrected, replaced, withdrawn, or limited to a single reply. A temporary direction does not become permanent policy, and a withdrawn preference does not become a general prohibition.
- Describe the state that now holds. A requested future change stays a request rather than a delivered result, and an unfinished or unknown state is not written as complete. Current behavior is described directly, not through the development event that produced it.
- Choose the voice the current use calls for, then keep the responsibilities, attribution, and concrete worries from the material. A personal review, a working note, or a message to a colleague can keep "I". A public technical note can use the given author or maintainer role. Do not invent a team, an owner, or a person, and do not turn a personal worry into an incident that happened or into an objective guarantee about the product.
- A draft revision number or label ("v2", "no auto-upload version", "after review") is not a software version. Delete the drafting label and keep the real version numbers, migration history, and runtime old/new distinctions a reader needs.

### Visible writing-session residue

Here, residue means visible text that depends on the writing session. It does not mean access to hidden model reasoning. Read from the perspective of someone who has only the finished content and accessible sources.

Remove correction labels, discarded requirements, inaccessible draft references, reviewer-facing narration, drafting stamps, temporary instructions, and working-language fragments that do not belong in the deliverable. Describe the reader's subject and current behavior, and preserve the valid facts inside those sentences.

A correction changes the deliverable. It does not require a label describing what was removed. If the user replaces an environment variable with a configuration file, describe the configuration file and the settings it now supplies. Do not title the result "config-file version" and do not keep the superseded environment-variable path as a fallback unless it still exists. A newly requested option belongs in the description of the current option set, without an assurance that the request was obeyed. A withdrawn field is simply absent from the current description rather than the subject of it.

Development text follows the same rule. After an unrequested addition is withdrawn, describe the option set that now exists: no "removed" labels and no promise that it will never return. Features the user did request stay in the description. Cleaning the prose does not change what the code does. A numbered list used for one reply does not constrain the next document.

Sentences describing a superseded or transitional state, including compatibility notes for a setup that no longer exists, do not survive because they appear in the draft.

### Messages to other agents

Delegation, handoff, and review messages are written for the agent that will act on them and for whoever reads them later. Give the receiver what it needs to start: the task, the materials to work from, the authorization and scope limits, the actual state that affects continued work, and how the result will be judged. A short message needs only the items that change what the receiver does.

A constraint applies to the party it was stated for. A limit that binds only the sender does not become a limit on the receiver. Keep constraints that govern the shared task and the receiver's existing permissions and boundaries.

Omit the sender's process: retries, waits, batch scheduling, and narration about re-reading or reorganizing context. Keep those details when they change the receiver's next action, such as a retry that has already used a one-time permission.

Do not clean away real trouble. Blockers, missing permissions, unverified or partial writes, unmet dependencies, and information needed to avoid duplicate side effects stay in the message. Do not describe an unfinished or unknown state as safely complete. Review feedback names the revision it applies to and the findings that need action; the review session's process stays out.

The first example strips scheduling narration; the second keeps failure information that changes what the receiver must do.

| Before | After | What must survive |
| --- | --- | --- |
| The earlier attempt timed out and the batch never ran; the logs also looked truncated. Please continue the docs update in `docs/config.md` from `notes/docs.md`: rewrite the retry section only, don't start the service, and report the changed files. | Update only the retry section in `docs/config.md`, using `notes/docs.md`. Don't start the service. Report the changed files. | The task, the notes and file to work from, the limit to the retry section, and the expected report. |
| Retry number three; the loader keeps stopping after row 2000. How much it has written is unknown, the script has no idempotence protection, and the rows from row 2000 onward are unverified in the new table. Check which records are already in the new table before continuing the import. | The loader keeps stopping after row 2000. How much it has written is unknown, the script has no idempotence protection, and the rows from row 2000 onward are unverified in the new table. Check which records are already in the new table, then continue the import. | The repeated stopping, the unknown write state, the region that starts at row 2000 and is unverified, and the missing idempotence protection, so the receiver checks the written records before continuing once. |

The receiver check shapes the message before it is sent; it is not a report to attach.

### References, history, and facts

| Before | After | What must survive |
| --- | --- | --- |
| Per our draft's point 6, the writer holds the lock until the rename completes. | The writer holds the lock until the rename completes. | Lock lifetime and operation order. |
| Updated after review: the worker validates the header before decoding the body. | The worker validates the header before decoding the body. | Both operations and their order. |
| This revision probably works; retry behavior is still unknown. | Retry behavior is still unknown. | The concrete unknown. |
| These direct calls are temporary exceptions awaiting migration to the shared entry point. | These direct calls still need to migrate to the shared entry point. | The outstanding migration obligation. |
| If caching is introduced, expiry rules must be defined. | If caching is introduced, expiry rules must be defined. | The hypothetical condition and requirement. |

Retain useful historical phrasing when the subject requires it. A release note may say that version 3.2 fixed an issue and link to the stable issue record. An upgrade procedure may start a new process, wait for its health check, then stop the old one. Those are reader-facing facts, not drafting residue.

Do not cite private working paths, unavailable review notes, ignored files, or task records as public authority. Remove the inaccessible pointer and keep the supported fact. Do not invent a replacement citation. A temporary test instruction stays local to its stated scope; an actual test result retains its conditions and measured status.

## 2. Choose what the reader needs, then keep its meaning

Two questions run in this order. First: does the deliverable owe the reader this at all? Select the information the finished text needs and drop the rest. Then: is the selected information accurate? Keep its facts, numbers, conditions, negation, attribution, and the strength of the responsibility and causation it states.

### Selection decides what the text carries

Drop a statement when the target reader does not need it: how the author wrote, how the author proved diligence, how an earlier version of the text was organized, or an inventory of what was tried and what was not. Dropping such a statement does not assert the opposite, and it does not license losing content the reader does need.

Keep the conditions that limit a conclusion the deliverable makes. A measurement range, an untested area, or a first-hand observation stays next to the conclusion it qualifies, because that limit changes what the reader understands. Whether such material belongs in the text at all still follows the reader's use: a range or an untested area that only shows the author was balanced is not carried into the deliverable.

Statements that look like residue can still carry one of the hard boundaries below, so check the boundary before deleting.

### Hard boundaries

Preserve subjects, actions, numbers, units, conditions, sequence, negation, obligations, exceptions, uncertainty, attribution, and causal strength. Keep ownership, side effects, failure modes, consequences, and time relations such as "after the upgrade", "while it runs", or "before the rename" when they affect meaning.

- Distinguish observation, requirement, plan, hypothesis, and implemented behavior. An obligation and its implementation status survive together: "The specification requires keeping the old file on failure; this is not implemented" keeps both halves.
- Untested does not mean unsupported, and not applicable does not mean untested. "Not tested on network drives" stays untested rather than becoming unsuitable.
- Do not widen a negation. Removing automatic upload means the tool does not upload automatically; it does not become a promise that the tool never transfers data.
- A migration still owed is not a sanctioned permanent exception. An event that followed another is not necessarily its effect.
- Keep sources that readers can use, useful history, real software versions, runtime old/new distinctions, measured observations, and necessary explanations. Keep concrete unknowns and investigate meaningful contradictions instead of polishing them away.
- Do not invent facts, actors, measurements, opinions, or personal experiences to make writing sound concrete or human. Preserve unspecified details as unspecified, including timing origins, triggers, and implementation mechanisms; a plausible interpretation is not a supplied fact.
- Keep technical terms that carry a precise meaning. Do not replace a term with a broader or different one ("API surface" is not "API").

### Guarantees and attribution

Describe the behavior the component being described implements, adds, or changes, and attribute each guarantee and each failure to the party that owns it.

- When the text reuses a host or platform contract that already exists, do not restate the host's general failure modes, and do not claim that this component supplies a host-level guarantee.
- Keep a dependency condition that changes what the reader does or understands: a required version, an incompatible behavior, a request the component itself drops, or success the component reports before it is true.
- Keep an external failure that affects diagnosis, recovery, or handoff, and attribute it accurately. "Not caused here" is not a reason to drop a blocker the reader is working around.
- Correct interface text that implies an undo, a rollback, or persisted state the implementation does not provide.
- Do not restate that a requirement was obeyed. A development delivery keeps the verification results that are real and that the reader needs; an ordinary rewrite delivers the requested text alone; a risk list follows what the reader will do with it.

### The decoration goes, the subject stays

A clause that carries only emptiness goes, and the fact it was attached to stays. Deleting a metaphor, slogan, jargon, or evaluation keeps the object and topic it described: a search box that searches filenames keeps the search box, and a process that mails a CSV report at 9 a.m. keeps the report.

| Before | After |
| --- | --- |
| The update demonstrates our unwavering dedication. It adds a date filter. | The update adds a date filter. |
| Through synergy and empowerment, we close the sampling loop. The probe records temperature every 5 seconds. | The probe records temperature every 5 seconds. |

Explaining that several names refer to the same object was useful while the draft cycled through synonyms. Once the names are unified, that explanation has no reader, so delete it instead of turning it into a glossary of aliases.

### Literal material, code, and configuration

Executable code and configuration are outside the editing scope. In mixed files, distinguish natural-language comments from executable content. Preserve quotations, commands, identifiers, original logs, recorded outputs, and other literal material when their purpose or the request requires exact wording. The style rules and the punctuation bans do not override literal protection. Identify the fragments the request or the material's purpose requires to stay verbatim, keep them exactly as they are, and edit only the surrounding text. Before delivering, compare each protected fragment with the original character by character; never apply a punctuation replacement across the whole output. Use the text already available. This comparison alone does not require extra tool calls or rereads; necessary reads for authorized verification or context recovery remain allowed. Do not attach an unsolicited comparison report.

### Vocabulary lists are candidates, not instructions

The lists in the style section flag candidates for judgment. Preserve technical terms with precise meanings and genuine uncertainty. Do not perform blind replacements.

## 3. Organize the text by subject

Start with what the reader needs to know. Group sentences and paragraphs by subject, merge repeated qualifications and repeated statements of the same thing, and reorder paragraphs when a defense obscures the subject.

- One operation appears once, at the point where its condition is met. If the receiver must check existing records before continuing an import, say so once, in that order, instead of opening and closing the message with the same instruction.
- Merge two adjacent sentences that say the same thing without adding information between them.
- Keep the order of steps and other time relations.
- Headings and paragraph structure may change when the request allows it. Keep the structure the user or project requires. Within the authorized scope, reorder paragraphs, merge repeated qualifications, and rewrite openings or endings. For a very extensive change, you may ask whether a complete rewrite is wanted; prior authorization is sufficient, so do not ask again merely because the change is large.
- Prefer already clear text unchanged. Do not add mechanisms or narrower interpretations merely to sound more concrete.
- If a sentence is hard to parse, split it or drop clauses: one idea per sentence (see style pattern 29).

## 4. Check the result and deliver it

Before delivering, compare the result against the original information and the current request, item by item:

- Can the reader understand every reference with the finished text and its accessible sources?
- Do the original and the result agree on the subject, facts, numbers, conditions, unknowns, sequence and time relations, author voice, and protected text? Does each obligation still appear with its implementation status?
- Does any phrase describe a discarded idea, the editing session, or empty proof of compliance?
- Do the punctuation and other style rules hold outside protected material, and has the edit introduced no new em dash or curly quote?
- Do ranges keep their original endpoints and whether each endpoint is included or excluded? Does a source-unspecified subject stay unspecified? Does a stated instruction remain an instruction rather than an automatic behavior?
- Is each remaining explanation useful to this reader, and is the result within the authorized scope?
- Would another agent acting on this message have what it needs to start, including its permissions and constraints, and any blocker or unverified state that changes its actions?
- Does every claim in the reply match what actually happened, including any number stated about a file you changed?

When a passage cannot be shown to keep the same meaning, keep the original accurate wording instead of guessing a more specific meaning. This comparison needs no intermediate list and no account of your reasoning.

Then deliver the answer, article, diagnosis, review, or edit itself. Do not attach an unsolicited report about the cleanup: which sentences were deleted, what was kept, which details were not added, or a compliance checklist. A short completion note such as "Updated `article.md`." is normal and is not proof of obedience. When the user asks for the complete current version, give that version's content directly, without opening with a summary of what was added, removed, or replaced, and without headings for withdrawn material or long-term prohibitions. Keep real verification results, blockers, and change notes, migration, history, or audit information the user asked for, as their use requires.

- A file change and a reply are separate results. After an authorized write, the file content and the final reply are checked independently: a good file does not excuse a cleanup report, and a clean reply does not excuse a wrong file.
- Read-only review gives findings for the revision under review, with accurate locations. State a line number only when you verified it, and do not end with a compliance list or an invitation to continue editing.
- Keep useful completion information, real blockers, and explanations the user asked for. Do not report a count, size, or result you have not verified.
- Handle verification or a delivery-affecting gap on its own when the request calls for it or the gap is real.
- When an unspecified detail can be preserved accurately, keep it as written; do not add a note such as "I did not add a detail here." When the user asks only for polishing and the supplied material is enough, deliver the result directly. Stop when the requested content is clear and accurate.

## Author voice

Preserve the author's real observations, judgments, rhythm, and tone. Choose the voice in step 1 for the use at hand; the source guidance below offers ways to avoid sterile prose and does not authorize fabricated opinions or experience. Use first person when it belongs to the author or to a justified current judgment. Do not add personality, jokes, or balanced-sounding reservations that the material does not support.

Removing patterns is half the job. Sterile, voiceless writing is just as obvious.

- **Have opinions.** React to facts instead of neutrally listing pros and cons.
- **Vary rhythm.** Short sentences. Then longer ones that take their time. Mix it up.
- **Acknowledge complexity.** "Impressive but also kind of unsettling" beats "impressive."
- **Use "I" when it fits.** First person isn't unprofessional.
- **Let some mess in.** Perfect structure looks machine-made.
- **Be specific.** Not "this is concerning" but "there's something unsettling about agents churning away at 3am."

## Facts and judgments without repeated self-justification

Let facts, observations, judgments, and useful actions carry the text. Put necessary reasons and sources beside their claims. Remove prose whose only function is to establish that the writer was careful, balanced, compliant, or qualified to speak.

- Replace generic self-protection with the concrete limit. "I cannot make any universal claims; I tried it on one laptop for three days" can become "I tried it on one laptop for three days." When the text does make a claim that reaches beyond what was tested, state that limit beside the claim; an untested-area inventory the reader does not need is dropped instead of restated in weaker words.
- Remove the emotion added to defend a judgment and the list written only to look balanced. "This preference is mine alone", "I was relieved", and a tried-and-untried inventory go; the experience behind the judgment stays: the differing needs the author describes, the next step the author chooses, and the concrete reason a reader would act differently.
- Keep a source and its relevant evidence; remove repeated narration about finding, ranking, or verifying it when the reader needs the result. "The supplied manual, section 4, sets the default to 45 seconds" retains the useful support without a research diary.
- Remove assurances such as "I followed every requirement" and repeated statements that a claim has evidence. Give the requested content and any useful completion facts.
- State an unknown as the unknown itself. "Whether retry happens is still undecided" carries the uncertainty; it does not need a posture about what you will not claim, such as "no promise of retry for now".
- When the material already gives the measurement conditions and the untested areas, a general disclaimer adds nothing. Remove it rather than restating the limits in weaker words.
- When the intended reader can bridge an ordinary inference, omit the intermediate explanation. Retain reasoning for counterintuitive claims, causal arguments, consequential decisions, and readers who need the steps.
- Reorganize paragraphs around the subject when repeated defenses obscure it. Consolidate duplicate qualifications without losing distinct conditions or limits.

Tutorials, formal proofs, research methods, reproducibility instructions, audits, and consequential decisions need appropriate reasoning, process details, and risk information. Do not remove those merely because they mention checking or evidence. An audit that ran configuration checks before tests must retain that sequence, actual results, and unresolved failures; carrying an unresolved failure forward is information, not self-justification.

A preference the author reached from two small tests and wants to observe under real load keeps the preference, the sample limit, and the intended follow-up; only the apology around them goes.

## Style patterns to detect and fix

### Content

1. **Puffery.** "pivotal moment", "testament to", "evolving landscape", "setting the stage for", "indelible mark", "deeply rooted". Cut puffery, state what happened.
2. **Name-dropping.** Listing media outlets without context. Pick the source that has content, say what it said, and drop the names that carry nothing.
3. **Superficial -ing phrases.** "highlighting...", "ensuring...", "reflecting...", "showcasing...", "fostering...". Delete or expand with real sources.
4. **Promotional language.** "nestled", "vibrant", "breathtaking", "groundbreaking", "renowned", "stunning", "must-visit". Use neutral descriptions.
5. **Vague attributions.** "Experts believe", "Industry reports suggest", "Some critics argue". Name the source or delete.
6. **Formulaic challenges.** "Despite challenges... continues to thrive." Replace with specific facts.

### Language

7. **AI vocabulary.** Additionally, crucial, delve, enduring, enhance, fostering, garner, interplay, intricate, landscape (abstract), pivotal, showcase, tapestry (abstract), testament, underscore, vibrant. Replace with plain words.
8. **Fancy ways to say "is".** "serves as", "stands as", "boasts", "features". Just say "is" or "has".
9. **"Not just X, but Y."** State the point directly instead.
10. **Rule of three.** Forcing ideas into groups of three. Use the natural number.
11. **Synonym cycling.** Protagonist, main character, central figure, hero all in one paragraph. Pick one, repeat it, and drop the explanation that the other names mean the same thing.
12. **False ranges.** "from X to Y" where X and Y aren't on a meaningful scale. List topics directly.

### Style

13. **Em dash overuse.** Avoid em dashes entirely. Use periods or commas only (no parentheses, no en dashes, no hyphen-as-dash substitutes). Em dashes are an AI tell, and reaching for parentheses instead just trades one tell for another. If a thought needs separation, end the sentence or use a comma.
14. **Colon overuse.** Colons are fine before a list or example. Not as mid-sentence connectors. "If you're coming from traditional automation: instead of registering event handlers, you describe conditions" adds nothing with the colon. Rewrite to let the point stand on its own without comparison framing. "Describing when the scheduler should fire works best as plain English." Same meaning, no crutch punctuation.
15. **Boldface overuse.** Don't bold every proper noun or acronym.
16. **Inline-header lists.** The tell is a bold label and colon that restates the line: "**Performance:** Performance improved...". Convert those to prose. A label that names an item and is followed by content the label does not already state ("**Schema in TypeScript.** Tables live in one file.") is fine, not a tell.
17. **Title case headings.** Use sentence case.
18. **Decorative emojis.** Remove from headings and bullets.
19. **Curly quotes.** Replace with straight quotes. Do not add them while editing.

### Communication artifacts

20. **Chatbot phrases.** "I hope this helps!", "Let me know if...", "Of course!", "Certainly!", "Found the smoking gun!" Remove.
21. **Cutoff disclaimers.** "While specific details are limited..." Find sources or remove.
22. **Sycophantic tone.** "Great question! You're absolutely right!" Respond directly.

### Filler

23. **Filler phrases.** "In order to" becomes "To". "Due to the fact that" becomes "Because". "It is important to note that" gets deleted.
24. **Excessive hedging.** "could potentially possibly be argued that it might" becomes "may".
25. **Generic conclusions.** "The future looks bright." State specific plans or facts.

### Jargon

26. **Abstract metaphor nouns.** Substrate, wedge, vector, locus, vantage, nexus, primitive (as noun), harness (as metaphor), surface (as in "API surface"), bedrock, scaffolding (as metaphor), modality, paradigm, gold-plating, ratchet (as metaphor), evacuate (for moving code), endgame, north star, flywheel. These read as technical but usually have a plainer concrete word. "Substrate" becomes "base". "Wedge in" becomes "add". "Vector" becomes "way" or "method". "Gold-plating" becomes "more than the job needs". "Ratchet" becomes the mechanism's real name or "a limit that only tightens". "Evacuate" becomes "move out". "Endgame" becomes "the last phase". Pick the concrete word, and keep the object the metaphor described.
27. **Chinese jargon.** Such as "赋能、助力、驱动、抓手、闭环、链路、全链路、拉通、对齐、反哺、颗粒度、组合拳、生态位、赛道、破圈、降维打击、天花板、长期主义、情绪价值".

### Plain speech

28. **Say what it does, not how it feels.** "the database stays close at hand", "SQL you can read", "types that follow your schema" name a feeling. The fix names the mechanism or a number: "`.toSQL()` returns the exact string sent to the database", "a column rename fails the build". Ask what the sentence tells the reader to do or know, then write that. If you can't restate it as a concrete instruction, fact, or number, cut it. One more check: if the sentence could appear unchanged in another project's docs, it says nothing about this one. Cut it.
29. **Shorten or split dense sentences.** If the reader has to backtrack to parse a sentence, break it in two or drop clauses. One idea per sentence.
30. **Active voice.** Prefer it. Catch "is/are/was/were + past participle" and name the actor: "queries are validated" becomes "the compiler validates queries", "the file is parsed by the loader" becomes "the loader parses the file". Passive is fine only when the actor is unknown or genuinely doesn't matter.
31. **Cut adverbs, or use a stronger verb.** "runs quickly" becomes "is fast" or the number. "significantly improves" becomes the measured delta. An adverb propping up a weak verb means the verb is wrong. Keep the measurement and its conditions next to the claim, so the sentence still does not read as a general guarantee.
32. **Prefer the plain word.** "utilize" becomes "use", "leverage" becomes "use", "facilitate" becomes "help", "numerous" becomes "many", "in the event that" becomes "if". The fancier synonym is rarely clearer.

## Sources and license

The style categories and voice suggestions adapt Lauren Tan's [unslop from Cursor plugins / pstack](https://github.com/cursor/plugins/blob/99559f2f52047978602ef365589275831e76af07/pstack/skills/unslop/SKILL.md), revision `99559f2f52047978602ef365589275831e76af07`. Most source wording, examples, and organization are retained. Category 27 is a local addition maintained by Ruokee; source categories 27 through 31 are numbered 28 through 32 here. well-said's scope, preservation boundaries, loading guidance, session-residue guidance, and self-justification guidance are maintained by Ruokee as part of this capability.

The reused pstack material carries the following [MIT notice](https://github.com/cursor/plugins/blob/99559f2f52047978602ef365589275831e76af07/pstack/LICENSE). The notice is literal source material.

```text
MIT License

Copyright (c) 2026 Lauren Tan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
